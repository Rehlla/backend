import crypto from 'crypto';
import { db } from '../db/database';
import { PushSubscriptionEntity } from '../db/schema';
import { notificationService } from './notificationService';

/**
 * Web Push delivery (VAPID, RFC 8292 + 8291-tickle).
 *
 * Why this exists: SOS-grade events (booking confirmed, driver arriving,
 * wind-shift rebook) must reach travelers outside the app. The in-app
 * notification table is durable but silent; this service is the realtime
 * nudge on top of it.
 *
 * Honesty contract (same rule as the SMS gateway): a send is only DELIVERED
 * when a provider accepted it. Without VAPID credentials there is no sender
 * at all — sends are recorded as skipped, the in-app notification is still
 * written (the message itself is never lost), and the summary says so.
 *
 * Sends are payload-free "tickles": the POST carries no body, so there is no
 * aes128gcm payload crypto to get wrong and no PII transits the push service.
 * The client refetches /api/notifications on wake, exactly like the SMS
 * fallback path. Keys are stored now so a future encrypted-payload sender can
 * address the same subscriptions without re-enrollment.
 *
 * Client contract:
 *   GET  /api/push/vapid-key            → { publicKey } (app's VAPID public key)
 *   POST /api/push/subscribe            → { endpoint, keys: { p256dh, auth } }
 *   DELETE /api/push/subscribe          → { endpoint }
 */

export interface PushSubscribeInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userAgent?: string;
}

export interface PushSendSummary {
  userId: string;
  notificationId: string;
  attempted: number;
  delivered: number;
  pruned: number;
  failed: number;
  /** Present when no push left the server (e.g. VAPID not configured). */
  skipped?: string;
}

const B64URL = /^[A-Za-z0-9_-]+=*$/;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol === 'https:') return true;
    // Plain-http only for local development, never for real endpoints.
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
}

function assertSubscriptionInput(input: PushSubscribeInput): void {
  if (!input || typeof input.endpoint !== 'string' || !isHttpUrl(input.endpoint)) {
    throw new Error('Push subscription endpoint must be an https: URL (http only for localhost).');
  }
  if (input.endpoint.length > 2000) throw new Error('Push subscription endpoint is too long.');
  const keys = input.keys;
  if (!keys || typeof keys.p256dh !== 'string' || typeof keys.auth !== 'string') {
    throw new Error('Push subscription keys.p256dh and keys.auth are required.');
  }
  if (!B64URL.test(keys.p256dh) || keys.p256dh.length < 80) {
    throw new Error('Push subscription keys.p256dh is not a valid application-server key.');
  }
  if (!B64URL.test(keys.auth) || keys.auth.length < 16) {
    throw new Error('Push subscription keys.auth is not a valid auth secret.');
  }
  if (input.userAgent !== undefined && (typeof input.userAgent !== 'string' || input.userAgent.length > 500)) {
    throw new Error('Push subscription userAgent must be a short string.');
  }
}

function b64urlToBuffer(value: string): Buffer {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function b64url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function vapidEnv(): { subject: string; publicKey: string; privateKey: string } | null {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  return subject && publicKey && privateKey ? { subject, publicKey, privateKey } : null;
}

export function vapidConfigured(): boolean {
  return vapidEnv() !== null;
}

/** Ops helper: generates a VAPID pair to store as VAPID_PUBLIC_KEY/PRIVATE_KEY. */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const privJwk = privateKey.export({ format: 'jwk' }) as { d?: string };
  if (!privJwk.d) throw new Error('VAPID key generation did not produce a private scalar.');
  // Re-derive the public point from the scalar: single code path with the
  // signer, so generated keys always verify.
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(b64urlToBuffer(privJwk.d));
  return { publicKey: b64url(ecdh.getPublicKey()), privateKey: privJwk.d };
}

/** ECDSA signatures come out of Node as DER; VAPID transmits raw R||S. */
export function rawSignatureToDer(raw: Buffer): Buffer {
  if (raw.length !== 64) throw new Error('VAPID signature must be 64 raw bytes.');
  const trim = (part: Buffer): Buffer => {
    let i = 0;
    while (i < part.length - 1 && part[i] === 0) i++;
    let out = part.subarray(i);
    if (out[0]! & 0x80) out = Buffer.concat([Buffer.from([0]), out]);
    return out;
  };
  const r = trim(raw.subarray(0, 32));
  const s = trim(raw.subarray(32, 64));
  return Buffer.concat([
    Buffer.from([0x30, 2 + r.length + 2 + s.length, 0x02, r.length]),
    r,
    Buffer.from([0x02, s.length]),
    s,
  ]);
}

function derToRaw(der: Buffer): Buffer {
  let o = 0;
  if (der[o++] !== 0x30) throw new Error('VAPID signature is not a DER sequence.');
  let len = der[o++]!;
  if (len & 0x80) o += len & 0x7f;
  const takeInt = (): Buffer => {
    if (der[o++] !== 0x02) throw new Error('VAPID signature has no DER integer.');
    const n = der[o++]!;
    let v = der.subarray(o, o + n);
    o += n;
    while (v.length > 32) {
      if (v[0] !== 0) throw new Error('VAPID signature integer overflows 32 bytes.');
      v = v.subarray(1);
    }
    const out = Buffer.alloc(32);
    v.copy(out, 32 - v.length);
    return out;
  };
  return Buffer.concat([takeInt(), takeInt()]);
}

/** Signs a VAPID JWT (aud = push-service origin, 12h expiry). Exported for tests. */
export function signVapidToken(audience: string, subject: string, privateKeyB64: string): string {
  const header = b64url(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;
  const payload = b64url(Buffer.from(JSON.stringify({ aud: audience, exp, sub: subject })));
  const signingInput = `${header}.${payload}`;
  // The env stores only the 32-byte private scalar; Node's JWK importer wants
  // the full key, so re-derive the public point with ECDH (P-256 scalar mult).
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(b64urlToBuffer(privateKeyB64));
  const pub = ecdh.getPublicKey();
  const key = crypto.createPrivateKey({
    key: {
      kty: 'EC',
      crv: 'P-256',
      x: b64url(pub.subarray(1, 33)),
      y: b64url(pub.subarray(33, 65)),
      d: privateKeyB64,
    } as any,
    format: 'jwk',
  });
  const der = crypto.sign('sha256', Buffer.from(signingInput), key);
  return `${signingInput}.${b64url(derToRaw(der))}`;
}

/**
 * Subscribe (or re-subscribe) a browser. The endpoint is the dedupe key: a
 * re-login from the same browser reassigns the row to the new user instead of
 * duplicating it, so a device never receives another traveler's nudges.
 */
export function subscribePush(
  userId: string,
  input: PushSubscribeInput
): { subscription: PushSubscriptionEntity; created: boolean } {
  if (!userId) throw new Error('Push subscribe requires a user id.');
  assertSubscriptionInput(input);
  const now = new Date().toISOString();
  let created = false;
  let row: PushSubscriptionEntity | undefined;
  db.runInTransaction(() => {
    row = db.pushSubscriptions.find(s => s.endpoint === input.endpoint);
    if (row) {
      row.userId = userId;
      row.keys = { p256dh: input.keys.p256dh, auth: input.keys.auth };
      if (input.userAgent !== undefined) row.userAgent = input.userAgent;
      row.failureCount = 0;
    } else {
      row = {
        id: `PUSH-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        userId,
        endpoint: input.endpoint,
        keys: { p256dh: input.keys.p256dh, auth: input.keys.auth },
        ...(input.userAgent ? { userAgent: input.userAgent } : {}),
        createdAt: now,
        failureCount: 0,
      };
      db.pushSubscriptions.unshift(row);
      created = true;
    }
    db.logAudit('PushService', 'System', created ? 'PUSH_SUBSCRIBED' : 'PUSH_RESUBSCRIBED', 'PushSubscription', row.id, {
      userId,
    });
  });
  return { subscription: row!, created };
}

/** Remove a subscription. Returns false when the endpoint was unknown. */
export function unsubscribePush(endpoint: string, userId?: string): boolean {
  const idx = db.pushSubscriptions.findIndex(s => s.endpoint === endpoint);
  if (idx < 0) return false;
  const row = db.pushSubscriptions[idx]!;
  // A traveler may only remove their own browser; ops tooling passes no user.
  if (userId && row.userId !== userId) return false;
  db.runInTransaction(() => {
    db.pushSubscriptions.splice(idx, 1);
    db.logAudit('PushService', 'System', 'PUSH_UNSUBSCRIBED', 'PushSubscription', row.id, { userId: userId || 'ops' });
  });
  return true;
}

export function subscriptionsFor(userId: string): PushSubscriptionEntity[] {
  return db.pushSubscriptions.filter(s => s.userId === userId);
}

async function tickle(sub: PushSubscriptionEntity, vapid: { subject: string; publicKey: string; privateKey: string }, urgency: 'normal' | 'high'): Promise<'delivered' | 'pruned' | 'failed'> {
  const audience = new URL(sub.endpoint).origin;
  const token = signVapidToken(audience, vapid.subject, vapid.privateKey);
  let res: Response;
  try {
    res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${token}, k=${vapid.publicKey}`,
        TTL: '86400',
        Urgency: urgency,
      },
    });
  } catch {
    return 'failed';
  }
  if (res.status === 201 || res.status === 202) return 'delivered';
  // 404/410: the browser revoked the subscription; keeping the row would
  // retry a dead mailbox forever.
  if (res.status === 404 || res.status === 410) return 'pruned';
  return 'failed';
}

/**
 * Notify a user: always writes the durable in-app notification, then attempts
 * the realtime push nudge for each of their subscribed browsers.
 */
export async function notifyUser(
  userId: string,
  params: { type?: 'BOOKING_CREATED' | 'PAYMENT_SUCCESS' | 'SUPPLIER_CONFIRMED' | 'DISPATCH_UPDATE' | 'EXCEPTION_ALERT' | 'SYSTEM'; title: string; message: string; urgency?: 'normal' | 'high' }
): Promise<PushSendSummary> {
  const notification = notificationService.sendNotification({
    userId,
    type: params.type || 'SYSTEM',
    title: params.title,
    message: params.message,
    channel: 'PUSH',
    metadata: { urgency: params.urgency || 'normal' },
  });

  const subs = subscriptionsFor(userId);
  const summary: PushSendSummary = {
    userId,
    notificationId: notification.id,
    attempted: subs.length,
    delivered: 0,
    pruned: 0,
    failed: 0,
  };

  const vapid = vapidEnv();
  if (!vapid) {
    // No sender configured: the in-app record above is the delivery. Say so
    // on the record itself so no dashboard can read it as "pushed".
    summary.skipped = 'missing-vapid-credentials';
    notification.status = 'QUEUED';
    notification.metadata = { ...(notification.metadata || {}), pushSkipped: summary.skipped };
    return summary;
  }

  const urgency = params.urgency || 'normal';
  for (const sub of subs) {
    const outcome = await tickle(sub, vapid, urgency);
    db.runInTransaction(() => {
      if (outcome === 'delivered') {
        summary.delivered++;
        sub.failureCount = 0;
        sub.lastUsedAt = new Date().toISOString();
      } else if (outcome === 'pruned') {
        summary.pruned++;
        const idx = db.pushSubscriptions.findIndex(s => s.id === sub.id);
        if (idx >= 0) db.pushSubscriptions.splice(idx, 1);
        db.logAudit('PushService', 'System', 'PUSH_PRUNED', 'PushSubscription', sub.id, { userId, reason: 'endpoint-gone' });
      } else {
        summary.failed++;
        sub.failureCount++;
      }
    });
  }
  notification.status = summary.delivered > 0 ? 'SENT' : summary.attempted === 0 ? 'QUEUED' : 'FAILED';
  notification.metadata = {
    ...(notification.metadata || {}),
    pushAttempted: summary.attempted,
    pushDelivered: summary.delivered,
    pushPruned: summary.pruned,
    pushFailed: summary.failed,
  };
  return summary;
}

export const pushService = {
  subscribePush,
  unsubscribePush,
  subscriptionsFor,
  notifyUser,
  vapidConfigured,
  generateVapidKeys,
};
