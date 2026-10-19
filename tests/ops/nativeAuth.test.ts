import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { authService } from '../../server/services/authService';
import { invalidatePermissionCache } from '../../server/services/permissionService';
import { startOpsApp, caller, createUser, signedIn, PASSWORD, type OpsTestServer } from './opsTestApp';

/**
 * Auth additions from docs/OPS_API_CONTRACT.md: native login tokens, /me
 * permissions + flags (and no tokens for the website), refresh rotation and
 * reuse detection, device sessions, push registration, suspension.
 */

let srv: OpsTestServer;
let call: ReturnType<typeof caller>;

beforeAll(async () => {
  srv = await startOpsApp();
  call = caller(srv.base);
});
afterAll(() => srv.close());
beforeEach(() => {
  resetDb();
  invalidatePermissionCache();
});

const nativeLogin = async (email: string, device = { name: 'Pixel 9', platform: 'android' }) => {
  const res = await call('POST', '/api/auth/login', { native: true, body: { email, password: PASSWORD, device } });
  return { res, body: await res.json() };
};

describe('POST /api/auth/login', () => {
  it('native gets session.token, access + refresh tokens, permissions and flags', async () => {
    const u = createUser('Operations');
    const { res, body } = await nativeLogin(u.email);
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.id).toBe(u.id);
    expect(body.user.passwordHash).toBeUndefined();
    expect(body.session).toMatchObject({ userId: u.id, role: 'Operations' });
    expect(typeof body.session.token).toBe('string');
    expect(body.accessToken).toMatch(/^acc_/);
    expect(Date.parse(body.accessTokenExpiresAt)).toBeGreaterThan(Date.now());
    expect(body.refreshToken).toMatch(/^rt_/);
    expect(body.permissions).toContain('ops.overview.view');
    expect(body.flags['killswitch.payments']).toBe(false);
    expect(body.flags['system.maintenance']).toBe(false);
    // Refresh token is stored hashed only.
    expect(db.refreshTokens.some(r => r.tokenHash === body.refreshToken)).toBe(false);
  });

  it('the website gets the same body without any token', async () => {
    const u = createUser('Operations');
    const res = await call('POST', '/api/auth/login', { body: { email: u.email, password: PASSWORD } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/dahab_auth_token=.*HttpOnly/);
    expect(body.session.token).toBeUndefined();
    expect(body.accessToken).toBeUndefined();
    expect(body.refreshToken).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(/tok_|acc_|rt_/);
    expect(body.permissions).toContain('ops.overview.view');
    expect(body.flags).toBeTypeOf('object');
  });

  it('a suspended account cannot sign in, and its live session stops validating', async () => {
    const { user, token } = signedIn('Operations');
    expect(authService.validateToken(`Bearer ${token}`)).not.toBeNull();
    db.users.find(u => u.id === user.id)!.status = 'suspended';
    expect(authService.validateToken(`Bearer ${token}`)).toBeNull();
    const res = await call('POST', '/api/auth/login', { body: { email: user.email, password: PASSWORD } });
    expect(res.status).toBe(401);
    expect((await call('GET', '/api/auth/me', { token })).status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('web: no token anywhere, plus permissions and flags', async () => {
    const { token } = signedIn('Admin');
    const res = await call('GET', '/api/auth/me', { token });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.session.token).toBeUndefined();
    expect(body.accessToken).toBeUndefined();
    expect(body.refreshToken).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(token);
    expect(body.permissions).toEqual(['*']);
    expect(body.flags).toHaveProperty('killswitch.ai', false);
    expect(body.user.passwordHash).toBeUndefined();
  });

  it('native: session.token is present', async () => {
    const { token } = signedIn('Supplier', { supplierId: 'SUP-1' });
    const body = await (await call('GET', '/api/auth/me', { token, native: true })).json();
    expect(body.session.token).toBe(token);
    expect(body.permissions).toContain('supplier.inbox.view');
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates on every use; the new access token works', async () => {
    const u = createUser('Operations');
    const { body: login } = await nativeLogin(u.email);
    const r1 = await call('POST', '/api/auth/refresh', { native: true, body: { refreshToken: login.refreshToken } });
    expect(r1.status).toBe(200);
    const t1 = await r1.json();
    expect(t1.refreshToken).not.toBe(login.refreshToken);
    expect(t1.accessToken).not.toBe(login.accessToken);
    expect((await call('GET', '/api/auth/me', { token: t1.accessToken, native: true })).status).toBe(200);
    // The superseded access token is dead.
    expect((await call('GET', '/api/auth/me', { token: login.accessToken, native: true })).status).toBe(401);
  });

  it('reusing a spent refresh token revokes the device family, 401s and audits AUTH_REFRESH_REUSE', async () => {
    const u = createUser('Operations');
    const { body: login } = await nativeLogin(u.email);
    const t1 = await (await call('POST', '/api/auth/refresh', { native: true, body: { refreshToken: login.refreshToken } })).json();

    const reuse = await call('POST', '/api/auth/refresh', { native: true, body: { refreshToken: login.refreshToken } });
    expect(reuse.status).toBe(401);
    expect((await reuse.json()).type).toBe('https://dahab.travel/errors/invalid-token');

    expect(db.auditEvents.some(e => e.action === 'AUTH_REFRESH_REUSE')).toBe(true);
    // The legitimate (rotated) tokens die with the family.
    expect((await call('POST', '/api/auth/refresh', { native: true, body: { refreshToken: t1.refreshToken } })).status).toBe(401);
    expect((await call('GET', '/api/auth/me', { token: t1.accessToken, native: true })).status).toBe(401);
    expect((await call('GET', '/api/auth/me', { token: login.session.token, native: true })).status).toBe(401);
    expect(db.deviceSessions.every(d => d.userId !== u.id || d.revokedAt)).toBe(true);
  });

  it('is public but rejects garbage', async () => {
    expect((await call('POST', '/api/auth/refresh', { body: { refreshToken: 'rt_nope' } })).status).toBe(401);
    expect((await call('POST', '/api/auth/refresh', { body: {} })).status).toBe(401);
  });

  it('a suspended user cannot refresh', async () => {
    const u = createUser('Operations');
    const { body: login } = await nativeLogin(u.email);
    db.users.find(x => x.id === u.id)!.status = 'suspended';
    expect((await call('POST', '/api/auth/refresh', { body: { refreshToken: login.refreshToken } })).status).toBe(401);
  });
});

describe('device sessions', () => {
  it('lists own devices with current flag; deleting one signs it out', async () => {
    const u = createUser('Operations');
    const { body: a } = await nativeLogin(u.email, { name: 'iPhone', platform: 'ios' });
    const { body: b } = await nativeLogin(u.email, { name: 'Pixel', platform: 'android' });
    const other = createUser('Operations');
    await nativeLogin(other.email);

    const list = await (await call('GET', '/api/auth/devices', { token: a.session.token, native: true })).json();
    expect(list.items).toHaveLength(2);
    const current = list.items.find((d: any) => d.current);
    expect(current).toMatchObject({ name: 'iPhone', platform: 'ios' });
    const pixel = list.items.find((d: any) => d.name === 'Pixel');

    // Another user's device id is not found.
    const foreignId = db.deviceSessions.find(d => d.userId === other.id)!.id;
    expect((await call('DELETE', `/api/auth/devices/${foreignId}`, { token: a.session.token, native: true })).status).toBe(404);

    expect((await call('DELETE', `/api/auth/devices/${pixel.id}`, { token: a.session.token, native: true })).status).toBe(200);
    expect((await call('GET', '/api/auth/me', { token: b.accessToken, native: true })).status).toBe(401);
    expect((await call('POST', '/api/auth/refresh', { body: { refreshToken: b.refreshToken } })).status).toBe(401);
    expect((await call('GET', '/api/auth/me', { token: a.accessToken, native: true })).status).toBe(200);
  });

  it('POST /api/devices registers an FCM token against the current device session', async () => {
    const u = createUser('Operations');
    const { body } = await nativeLogin(u.email);
    const res = await call('POST', '/api/devices', { token: body.accessToken, native: true, body: { fcmToken: 'fcm-abc', platform: 'android' } });
    expect(res.status).toBe(201);
    const out = await res.json();
    expect(out.platform).toBe('android');
    expect(out.deviceSessionId).toBe(db.deviceSessions.find(d => d.userId === u.id)!.id);
    expect(db.pushDevices).toHaveLength(1);
    expect((await call('POST', '/api/devices', { token: body.accessToken, native: true, body: {} })).status).toBe(400);
    expect((await call('POST', '/api/devices', { body: { fcmToken: 'x' } })).status).toBe(401);
  });
});
