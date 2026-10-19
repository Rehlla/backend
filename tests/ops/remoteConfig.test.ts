import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { resetDb } from '../helpers/fixtures';
import { invalidatePermissionCache } from '../../server/services/permissionService';
import { flagService } from '../../server/services/flagService';
import { compareVersions } from '../../server/services/remoteConfigService';
import { startOpsApp, caller, signedIn, type OpsTestServer } from './opsTestApp';

/**
 * GET /api/config — unified remote config (docs/OPS_API_CONTRACT.md).
 *
 * The one document the web app and both Flutter apps fetch on boot:
 * maintenance state, kill switches, per-caller feature flags, the
 * client-safe settings subset, per-platform app gates and the announcement
 * banner. Public by design, ETag-cached, and reachable during maintenance.
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

const json = async (p: Promise<Response>) => {
  const r = await p;
  return { status: r.status, headers: r.headers, body: await r.json() };
};

const ACTOR = { userId: 'USR-T-Admin-1', role: 'Admin' };

describe('public shape and defaults', () => {
  it('serves anonymous callers with safe defaults', async () => {
    const r = await json(call('GET', '/api/config'));
    expect(r.status).toBe(200);
    expect(r.body.version).toMatch(/^cfg-[0-9a-f]{12}$/);
    expect(r.body.issuedAt).toBeTruthy();
    expect(r.body.maintenance).toMatchObject({ active: false });
    expect(r.body.maintenance.message).toHaveProperty('ar');
    expect(r.body.killswitches).toMatchObject({
      payments: false, bookings: false, ai: false, sms: false, supplierSignup: false,
    });
    expect(r.body.flags).toEqual({});
    expect(r.body.settings).toMatchObject({ supportHours: '09:00-23:00', supportSlaMinutes: 30, currency: 'EGP' });
    expect(r.body.settings).not.toHaveProperty('sms');
    expect(r.body.settings).not.toHaveProperty('commissionRate');
    expect(r.body.apps.android).toMatchObject({
      minVersion: '1.0.0', latestVersion: '1.0.0', updateRequired: false, updateAvailable: false,
    });
    expect(r.body.announcement).toBeNull();
  });

  it('rejects an unknown platform', async () => {
    expect((await call('GET', '/api/config?platform=watch')).status).toBe(400);
  });

  it('answers 304 when If-None-Match matches the ETag', async () => {
    const first = await call('GET', '/api/config');
    const etag = first.headers.get('etag');
    expect(etag).toBeTruthy();
    const second = await call('GET', '/api/config', { headers: { 'if-none-match': etag! } });
    expect(second.status).toBe(304);
  });
});

describe('control-plane reflection', () => {
  it('reflects a thrown kill switch without a release', async () => {
    flagService.update('killswitch.payments', { enabled: true }, ACTOR, 'test');
    const r = await json(call('GET', '/api/config'));
    expect(r.body.killswitches.payments).toBe(true);
    expect(r.body.killswitches.bookings).toBe(false);
  });

  it('reflects maintenance mode and stays reachable while it is on', async () => {
    flagService.update('system.maintenance', { enabled: true }, ACTOR, 'test');
    // The whole point of the exemption: clients learn about maintenance here.
    const r = await json(call('GET', '/api/config'));
    expect(r.status).toBe(200);
    expect(r.body.maintenance.active).toBe(true);
    // …while every other anonymous route is dark (a public catalogue read
    // reaches the maintenance gate and answers 503).
    expect((await call('GET', '/api/content/pages')).status).toBe(503);
  });

  it('evaluates feature flags per caller: rollout, roles, disabled', async () => {
    flagService.update('ui.newCheckout', { enabled: true, rolloutPercent: 100 }, ACTOR, 'test');
    flagService.update('ui.staffOnly', { enabled: true, rolloutPercent: 100, roles: ['Admin'] }, ACTOR, 'test');
    flagService.update('ui.dead', { enabled: false }, ACTOR, 'test');

    const anon = await json(call('GET', '/api/config'));
    expect(anon.body.flags).toMatchObject({ 'ui.newCheckout': true, 'ui.dead': false });
    expect(anon.body.flags['ui.staffOnly']).toBe(false);

    const { token } = signedIn('Admin');
    const admin = await json(call('GET', '/api/config', { token }));
    expect(admin.body.flags['ui.staffOnly']).toBe(true);
  });

  it('reflects edited settings and the announcement banner', async () => {
    const { token } = signedIn('Admin');
    expect(
      (await call('PUT', '/api/admin/settings/support.slaMinutes', { token, body: { value: 45, reason: 'test' } })).status,
    ).toBe(200);
    expect(
      (await call('PUT', '/api/admin/settings/announce.banner', {
        token, body: { value: { enabled: true, tone: 'warn', en: 'Storm', ar: 'عاصفة' }, reason: 'test' },
      })).status,
    ).toBe(200);

    const r = await json(call('GET', '/api/config'));
    expect(r.body.settings.supportSlaMinutes).toBe(45);
    expect(r.body.announcement).toMatchObject({ tone: 'warn', text: { en: 'Storm', ar: 'عاصفة' } });
  });
});

describe('app gates', () => {
  it('forces an update below the minimum and nudges below the latest', async () => {
    const { token } = signedIn('Admin');
    for (const [key, value] of [
      ['apps.androidMinVersion', '2.0.0'],
      ['apps.androidLatestVersion', '2.1.0'],
    ] as const) {
      expect((await call('PUT', `/api/admin/settings/${key}`, { token, body: { value, reason: 'test' } })).status).toBe(200);
    }

    const old = await json(call('GET', '/api/config?platform=android&appVersion=1.0.0'));
    expect(old.body.apps.android).toMatchObject({ updateRequired: true, updateAvailable: true });

    const current = await json(call('GET', '/api/config?platform=android&appVersion=2.1.0'));
    expect(current.body.apps.android).toMatchObject({ updateRequired: false, updateAvailable: false });

    // The gate is per platform: an android build never trips the ios gate.
    expect(current.body.apps.ios).toMatchObject({ updateRequired: false, updateAvailable: false });

    // No version sent means no gating, only the declared floors.
    const web = await json(call('GET', '/api/config'));
    expect(web.body.apps.android).toMatchObject({ minVersion: '2.0.0', updateRequired: false });
  });

  it('rejects a non-dotted minimum version at the settings gate', async () => {
    const { token } = signedIn('Admin');
    expect(
      (await call('PUT', '/api/admin/settings/apps.androidMinVersion', { token, body: { value: 'two', reason: 'test' } })).status,
    ).toBe(400);
  });
});

describe('compareVersions', () => {
  it('compares numerically, not lexicographically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1);
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
    expect(compareVersions('bogus', '1.0.0')).toBe(-1);
  });
});
