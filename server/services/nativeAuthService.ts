import crypto from 'crypto';
import { db } from '../db/database';
import type { DeviceSessionEntity, PushDeviceEntity, SessionEntity } from '../db/schema';
import { auditService } from './auditService';
import { getConfig } from '../config';

/**
 * Native (Flutter) token lifecycle (docs/OPS_API_CONTRACT.md, Auth).
 *
 * A native login creates a device session. It carries:
 *  - the legacy 72 h `session.token` (kept for dahab-mobile, which predates
 *    refresh tokens), tied to the device session;
 *  - a short access token (ACCESS_TOKEN_TTL_MINUTES, default 15) — an
 *    ordinary SessionEntity row with kind 'access', so every existing
 *    validator (optionalAuth, requireAuth) accepts it unchanged;
 *  - a rotating refresh token, stored only as a sha256 hash.
 *
 * Refresh rotates: the presented token is marked used and a new one issued.
 * Presenting a used (or revoked) token again is treated as theft: the whole
 * device session family is revoked, its tokens deleted, and
 * AUTH_REFRESH_REUSE is audited.
 */

export type Platform = DeviceSessionEntity['platform'];
const PLATFORMS: Platform[] = ['ios', 'android', 'web'];

export function normalizePlatform(v: unknown): Platform {
  return typeof v === 'string' && (PLATFORMS as string[]).includes(v) ? (v as Platform) : 'unknown';
}

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
const unauthorized = (message: string) => Object.assign(new Error(message), { status: 401 });

export interface IssuedTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
}

export function createDeviceSession(userId: string, device?: { name?: unknown; platform?: unknown }): DeviceSessionEntity {
  const now = new Date().toISOString();
  const name = typeof device?.name === 'string' && device.name.trim() ? device.name.trim().slice(0, 120) : 'Unknown device';
  const ds: DeviceSessionEntity = {
    id: `DEV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    userId,
    name,
    platform: normalizePlatform(device?.platform),
    createdAt: now,
    lastSeenAt: now,
  };
  db.runInTransaction(() => { db.deviceSessions.push(ds); });
  return ds;
}

function mintAccess(userId: string, role: string, deviceSessionId: string): SessionEntity {
  const ttlMin = getConfig().ACCESS_TOKEN_TTL_MINUTES;
  const now = Date.now();
  return {
    id: `SES-ACC-${now}-${crypto.randomBytes(2).toString('hex')}`,
    userId,
    token: `acc_${crypto.randomBytes(24).toString('hex')}`,
    role,
    kind: 'access',
    deviceSessionId,
    expiresAt: new Date(now + ttlMin * 60_000).toISOString(),
    createdAt: new Date(now).toISOString(),
  };
}

/** Issues a fresh access + refresh pair for a device session. */
export function issueTokens(userId: string, role: string, deviceSessionId: string): IssuedTokens {
  const access = mintAccess(userId, role, deviceSessionId);
  const refreshToken = `rt_${crypto.randomBytes(32).toString('base64url')}`;
  const now = Date.now();
  db.runInTransaction(() => {
    db.sessions.push(access);
    db.refreshTokens.push({
      id: `RT-${now}-${crypto.randomBytes(3).toString('hex')}`,
      deviceSessionId,
      userId,
      tokenHash: sha256(refreshToken),
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + getConfig().REFRESH_TOKEN_TTL_DAYS * 86_400_000).toISOString(),
    });
  });
  return { accessToken: access.token, accessTokenExpiresAt: access.expiresAt, refreshToken };
}

/** Revokes a device session: its refresh tokens, its access tokens and its legacy session token. */
export function revokeFamily(deviceSessionId: string, reason: string): void {
  const now = new Date().toISOString();
  db.runInTransaction(() => {
    const ds = db.deviceSessions.find(d => d.id === deviceSessionId);
    if (ds && !ds.revokedAt) {
      ds.revokedAt = now;
      ds.revokedReason = reason;
    }
    for (const r of db.refreshTokens) if (r.deviceSessionId === deviceSessionId && !r.revokedAt) r.revokedAt = now;
    for (let i = db.sessions.length - 1; i >= 0; i--) {
      if (db.sessions[i].deviceSessionId === deviceSessionId) db.sessions.splice(i, 1);
    }
  });
}

export function refresh(refreshToken: string, correlationId?: string): IssuedTokens {
  if (typeof refreshToken !== 'string' || !refreshToken) throw unauthorized('A refresh token is required.');
  const row = db.refreshTokens.find(r => r.tokenHash === sha256(refreshToken));
  if (!row) throw unauthorized('Invalid refresh token.');

  if (row.usedAt || row.revokedAt) {
    revokeFamily(row.deviceSessionId, 'refresh-token-reuse');
    auditService.record({
      actor: row.userId, actorRole: 'System', action: 'AUTH_REFRESH_REUSE', entityType: 'DeviceSession', entityId: row.deviceSessionId,
      after: { refreshTokenId: row.id, previouslyUsedAt: row.usedAt ?? null, previouslyRevokedAt: row.revokedAt ?? null },
      reason: 'A spent refresh token was presented again; the device session family was revoked.', correlationId,
    });
    throw unauthorized('Refresh token reuse detected. Sign in again.');
  }
  if (Date.parse(row.expiresAt) <= Date.now()) throw unauthorized('Refresh token expired. Sign in again.');

  const ds = db.deviceSessions.find(d => d.id === row.deviceSessionId);
  const user = db.users.find(u => u.id === row.userId);
  if (!ds || ds.revokedAt || !user || user.status === 'suspended') throw unauthorized('Session revoked. Sign in again.');

  const tokens = issueTokens(user.id, user.role, ds.id);
  const now = new Date().toISOString();
  db.runInTransaction(() => {
    row.usedAt = now;
    const next = db.refreshTokens[db.refreshTokens.length - 1];
    row.replacedById = next?.id;
    ds.lastSeenAt = now;
    // The previous access tokens of this device are superseded.
    for (let i = db.sessions.length - 1; i >= 0; i--) {
      const s = db.sessions[i];
      if (s.deviceSessionId === ds.id && s.kind === 'access' && s.token !== tokens.accessToken) db.sessions.splice(i, 1);
    }
  });
  return tokens;
}

export function listDevices(userId: string, currentDeviceSessionId?: string) {
  return db.deviceSessions
    .filter(d => d.userId === userId && !d.revokedAt)
    .map(d => ({ id: d.id, name: d.name, platform: d.platform, lastSeenAt: d.lastSeenAt, createdAt: d.createdAt, current: d.id === currentDeviceSessionId }));
}

export function revokeOwnDevice(userId: string, id: string, correlationId?: string): boolean {
  const ds = db.deviceSessions.find(d => d.id === id && d.userId === userId && !d.revokedAt);
  if (!ds) return false;
  revokeFamily(id, 'user-signed-out-device');
  auditService.record({ actor: userId, actorRole: 'User', action: 'DEVICE_SESSION_REVOKED', entityType: 'DeviceSession', entityId: id, correlationId });
  return true;
}

export function registerPushDevice(userId: string, deviceSessionId: string | undefined, fcmToken: string, platform: unknown): PushDeviceEntity {
  const now = new Date().toISOString();
  let row = db.pushDevices.find(p => p.fcmToken === fcmToken);
  db.runInTransaction(() => {
    if (row) {
      // A token moves with the app install; the latest sign-in owns it.
      row.userId = userId;
      row.deviceSessionId = deviceSessionId;
      row.platform = normalizePlatform(platform);
      row.updatedAt = now;
    } else {
      row = {
        id: `PDV-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userId, deviceSessionId, fcmToken, platform: normalizePlatform(platform), createdAt: now, updatedAt: now,
      };
      db.pushDevices.push(row);
    }
  });
  return row!;
}

export const nativeAuthService = {
  normalizePlatform, createDeviceSession, issueTokens, revokeFamily, refresh, listDevices, revokeOwnDevice, registerPushDevice,
};
