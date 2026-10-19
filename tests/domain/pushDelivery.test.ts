import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { db } from '../../server/db/database';
import {
  smsGatewayService,
  smsDispatchLogs,
} from '../../server/services/smsGatewayService';
import {
  pushService,
  signVapidToken,
  rawSignatureToDer,
  generateVapidKeys,
  vapidConfigured,
} from '../../server/services/pushService';

/**
 * Delivery honesty: a message that never left this server must never read as
 * delivered (blueprint P0 row #6 — seeds and the no-credential simulator path
 * used to report DELIVERED with fake Twilio SIDs), and Web Push must report
 * exactly what the push service accepted.
 */

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/test-sub-1';
const KEYS = {
  // 87-char base64url p256dh stand-in, 22-char auth stand-in.
  p256dh: 'B' + 'A'.repeat(86),
  auth: 'C'.repeat(22),
};

function clearPush() {
  db.pushSubscriptions.splice(0, db.pushSubscriptions.length);
}

function saveEnv() {
  return {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_PHONE_NUMBER,
    subj: process.env.VAPID_SUBJECT,
    pub: process.env.VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY,
  };
}
function restoreEnv(saved: ReturnType<typeof saveEnv>) {
  const set = (k: string, v: string | undefined) => {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  };
  set('TWILIO_ACCOUNT_SID', saved.sid);
  set('TWILIO_AUTH_TOKEN', saved.token);
  set('TWILIO_PHONE_NUMBER', saved.from);
  set('VAPID_SUBJECT', saved.subj);
  set('VAPID_PUBLIC_KEY', saved.pub);
  set('VAPID_PRIVATE_KEY', saved.priv);
}

let saved: ReturnType<typeof saveEnv>;

beforeEach(() => {
  saved = saveEnv();
  clearPush();
  vi.unstubAllGlobals();
});

afterEach(() => {
  restoreEnv(saved);
  clearPush();
  vi.unstubAllGlobals();
});

function smsInput() {
  return {
    to: '+201001112222',
    recipientName: 'Test Driver',
    recipientRole: 'DRIVER' as const,
    message: 'Hello from honesty tests',
  };
}

describe('SMS delivery honesty', () => {
  it('ships seeds marked SIMULATED, never DELIVERED with fake provider SIDs', () => {
    const seeds = smsDispatchLogs.filter(r => r.id.startsWith('SMS-INIT-'));
    expect(seeds.length).toBeGreaterThan(0);
    for (const s of seeds) {
      expect(s.status).toBe('SIMULATED');
      expect(s.simulated).toBe(true);
      expect(s.providerMessageSid).toBe('SIMULATED');
    }
  });

  it('records SIMULATED when no Twilio credentials exist (no gateway, only the log)', async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    const record = await smsGatewayService.sendSms(smsInput());
    expect(record.status).toBe('SIMULATED');
    expect(record.simulated).toBe(true);
    expect(record.providerMessageSid).toBe('SIMULATED');
    expect(record.providerError).toBeUndefined();
  });

  it('records SENT (accepted, not delivered) with the real SID when Twilio takes it', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'tok_test';
    process.env.TWILIO_PHONE_NUMBER = '+12055550199';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ sid: 'SM_real_sid_1' }) })));
    const record = await smsGatewayService.sendSms(smsInput());
    expect(record.status).toBe('SENT');
    expect(record.simulated).toBe(false);
    expect(record.providerMessageSid).toBe('SM_real_sid_1');
  });

  it('records SIMULATED with the provider error when Twilio rejects or is unreachable', async () => {
    process.env.TWILIO_ACCOUNT_SID = 'AC_test';
    process.env.TWILIO_AUTH_TOKEN = 'tok_test';
    process.env.TWILIO_PHONE_NUMBER = '+12055550199';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })));
    const rejected = await smsGatewayService.sendSms(smsInput());
    expect(rejected.status).toBe('SIMULATED');
    expect(rejected.simulated).toBe(true);
    expect(rejected.providerError).toMatch(/401/);

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('socket hangup'); }));
    const unreachable = await smsGatewayService.sendSms(smsInput());
    expect(unreachable.status).toBe('SIMULATED');
    expect(unreachable.providerError).toMatch(/socket hangup/);
  });
});

describe('push subscriptions', () => {
  it('rejects non-https endpoints, localhost excepted, and malformed keys', () => {
    expect(() => pushService.subscribePush('U1', { endpoint: 'not-a-url', keys: KEYS })).toThrow(/https/);
    expect(() => pushService.subscribePush('U1', { endpoint: 'http://evil.example/push', keys: KEYS })).toThrow(/https/);
    expect(() => pushService.subscribePush('U1', { endpoint: ENDPOINT, keys: { p256dh: 'short', auth: KEYS.auth } })).toThrow(/p256dh/);
    expect(() => pushService.subscribePush('', { endpoint: ENDPOINT, keys: KEYS })).toThrow(/user id/);
    // https + localhost-http are accepted.
    expect(pushService.subscribePush('U1', { endpoint: ENDPOINT, keys: KEYS }).created).toBe(true);
    expect(pushService.subscribePush('U1', { endpoint: 'http://localhost:3000/push/x', keys: KEYS }).created).toBe(true);
  });

  it('upserts by endpoint: a re-login reassigns the browser, never duplicates it', () => {
    pushService.subscribePush('U1', { endpoint: ENDPOINT, keys: KEYS });
    const again = pushService.subscribePush('U2', { endpoint: ENDPOINT, keys: KEYS });
    expect(again.created).toBe(false);
    expect(db.pushSubscriptions.filter(s => s.endpoint === ENDPOINT)).toHaveLength(1);
    expect(db.pushSubscriptions.find(s => s.endpoint === ENDPOINT)!.userId).toBe('U2');
    expect(pushService.subscriptionsFor('U1')).toHaveLength(0);
  });

  it('unsubscribes only the owning browser', () => {
    pushService.subscribePush('U1', { endpoint: ENDPOINT, keys: KEYS });
    expect(pushService.unsubscribePush(ENDPOINT, 'U2')).toBe(false);
    expect(pushService.unsubscribePush(ENDPOINT, 'U1')).toBe(true);
    expect(pushService.unsubscribePush(ENDPOINT, 'U1')).toBe(false);
  });
});

describe('VAPID signatures', () => {
  it('generates keys whose signatures verify against the public half', () => {
    const { publicKey, privateKey } = generateVapidKeys();
    expect(vapidConfigured()).toBe(false);
    process.env.VAPID_SUBJECT = 'mailto:ops@dahab.travel';
    process.env.VAPID_PUBLIC_KEY = publicKey;
    process.env.VAPID_PRIVATE_KEY = privateKey;
    expect(vapidConfigured()).toBe(true);

    const token = signVapidToken('https://fcm.googleapis.com', 'mailto:ops@dahab.travel', privateKey);
    const [h, p, s] = token.split('.');
    const payload = JSON.parse(Buffer.from(p!, 'base64url').toString('utf8'));
    expect(payload.aud).toBe('https://fcm.googleapis.com');
    expect(payload.sub).toBe('mailto:ops@dahab.travel');
    expect(payload.exp).toBeGreaterThan(Date.now() / 1000);

    // Verify the ECDSA signature with the public key only.
    const pubRaw = Buffer.from(publicKey, 'base64url');
    const pub = crypto.createPublicKey({
      key: {
        kty: 'EC',
        crv: 'P-256',
        x: pubRaw.subarray(1, 33).toString('base64url'),
        y: pubRaw.subarray(33, 65).toString('base64url'),
      } as any,
      format: 'jwk',
    });
    expect(crypto.verify('sha256', Buffer.from(`${h}.${p}`), pub, rawSignatureToDer(Buffer.from(s!, 'base64url')))).toBe(true);
  });
});

describe('push delivery honesty', () => {
  function withVapid() {
    const keys = generateVapidKeys();
    process.env.VAPID_SUBJECT = 'mailto:ops@dahab.travel';
    process.env.VAPID_PUBLIC_KEY = keys.publicKey;
    process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  }

  it('writes the in-app notification but skips push (and says so) without VAPID', async () => {
    delete process.env.VAPID_SUBJECT;
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    pushService.subscribePush('U9', { endpoint: ENDPOINT, keys: KEYS });
    const summary = await pushService.notifyUser('U9', { title: 'Driver arriving', message: 'Your driver is outside.' });
    expect(summary.attempted).toBe(1);
    expect(summary.delivered).toBe(0);
    expect(summary.skipped).toBe('missing-vapid-credentials');
    const ntf = db.notifications.find(n => n.id === summary.notificationId)!;
    expect(ntf.channel).toBe('PUSH');
    expect(ntf.status).toBe('QUEUED');
    expect(ntf.metadata?.pushSkipped).toBe('missing-vapid-credentials');
  });

  it('counts provider acceptance per endpoint and prunes dead mailboxes', async () => {
    withVapid();
    pushService.subscribePush('U9', { endpoint: ENDPOINT, keys: KEYS });
    pushService.subscribePush('U9', { endpoint: 'https://updates.push.services.mozilla.com/wpush/v2/dead', keys: KEYS });

    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url);
      if (String(url).includes('mozilla')) return { status: 410 };
      return { status: 201 };
    }));

    const summary = await pushService.notifyUser('U9', { title: 'Confirmed', message: 'Booking confirmed.' });
    expect(summary.attempted).toBe(2);
    expect(summary.delivered).toBe(1);
    expect(summary.pruned).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBeUndefined();
    // Dead mailbox pruned; live one kept with failure count reset.
    expect(db.pushSubscriptions.some(s => s.endpoint.includes('mozilla'))).toBe(false);
    expect(db.pushSubscriptions.find(s => s.endpoint === ENDPOINT)!.failureCount).toBe(0);
    // Every push POST carried a VAPID authorization header, never a body.
    const fetchMock = fetch as unknown as { mock: { calls: any[][] } };
    for (const call of fetchMock.mock.calls) {
      expect(call[1].method).toBe('POST');
      expect(String(call[1].headers.Authorization)).toMatch(/^vapid t=.+, k=.+$/);
      expect(call[1].body).toBeUndefined();
    }
    expect(calls).toHaveLength(2);
  });

  it('increments failure counts instead of claiming delivery on 5xx', async () => {
    withVapid();
    pushService.subscribePush('U9', { endpoint: ENDPOINT, keys: KEYS });
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 503 })));
    const summary = await pushService.notifyUser('U9', { title: 'T', message: 'M' });
    expect(summary.failed).toBe(1);
    expect(summary.delivered).toBe(0);
    expect(db.pushSubscriptions.find(s => s.endpoint === ENDPOINT)!.failureCount).toBe(1);
    const ntf = db.notifications.find(n => n.id === summary.notificationId)!;
    expect(ntf.status).toBe('FAILED');
  });
});
