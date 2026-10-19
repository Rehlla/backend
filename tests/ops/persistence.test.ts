import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { db } from '../../server/db/database';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import { findOneBy } from '../../server/db/sqlite/query';
import { authService } from '../../server/services/authService';
import { nativeAuthService } from '../../server/services/nativeAuthService';
import { setOverrides, ensureSystemRoles, invalidatePermissionCache } from '../../server/services/permissionService';
import { userAdminService } from '../../server/services/userAdminService';
import { settingsService } from '../../server/services/settingsService';
import { flagService } from '../../server/services/flagService';
import { approvalService } from '../../server/services/approvalService';
import { integrationHealthService } from '../../server/services/integrationHealthService';
import type { SessionEntity } from '../../server/db/schema';
import { createUser, PASSWORD } from './opsTestApp';

/**
 * Every staff-control-plane collection round-trips through the SQLite
 * adapter (tableSpecs.ts) and lives in the in-memory adapter.
 */

const admin = { userId: 'USR-ADM', role: 'Admin' };
let dir = '';
let adapter: SqlitePersistenceAdapter | null = null;

afterEach(() => {
  adapter?.close();
  adapter = null;
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = '';
  db.setAdapter(new InMemoryPersistenceAdapter());
  invalidatePermissionCache();
});

/** Writes one row into each new collection through the real services. */
function writeEverything() {
  const u = createUser('Operations');
  db.saveToDisk();
  const login = authService.login(u.email, PASSWORD);
  const device = nativeAuthService.createDeviceSession(u.id, { name: 'Pixel', platform: 'android' });
  db.runInTransaction(() => {
    db.sessions.find(s => s.id === login.session.id)!.deviceSessionId = device.id;
  });
  const tokens = nativeAuthService.issueTokens(u.id, u.role, device.id);
  nativeAuthService.registerPushDevice(u.id, device.id, 'fcm-1', 'android');
  ensureSystemRoles();
  db.saveToDisk();
  userAdminService.createRole({ name: 'Night desk', permissions: ['ops.overview.view'] }, admin);
  setOverrides(u.id, [{ permission: 'ops.commerce.refund', effect: 'deny' }], admin, 'persist me');
  settingsService.set('support.slaMinutes', 45, admin, 'persist me');
  flagService.update('killswitch.ai', { enabled: true }, admin, 'persist me');
  approvalService.request('setting.update', 'x', { key: 'commerce.commissionRate', value: 0.1, reason: 'r' }, admin);
  integrationHealthService.update('paymob', { enabled: false }, admin, 'persist me');
  db.idempotencyKeys.push({ id: 'IDK-1', userId: u.id, route: 'POST /x', status: 'complete', responseStatus: 200, responseBody: { ok: 1 }, createdAt: '2026-01-01T00:00:00Z', expiresAt: '2099-01-01T00:00:00Z' });
  db.runInTransaction(() => {
    db.sessions.find(s => s.token === login.session.token)!.viewAs = { userId: 'USR-T', startedAt: '2026-01-01T00:00:00Z', reason: 'debug' };
  });
  db.saveToDisk();
  return { u, login, device, tokens };
}

function expectEverything(userId: string) {
  expect(db.roles.map(r => r.id)).toEqual(expect.arrayContaining(['Traveler', 'Supplier', 'Operations', 'Product', 'Admin']));
  expect(db.roles.some(r => r.name === 'Night desk')).toBe(true);
  expect(db.userPermissionOverrides).toEqual([expect.objectContaining({ userId, permission: 'ops.commerce.refund', effect: 'deny' })]);
  expect(db.settings.find(s => s.id === 'support.slaMinutes')).toMatchObject({ value: 45, version: 2 });
  expect(db.settingsHistory.filter(h => h.key === 'support.slaMinutes').map(h => h.version).sort()).toEqual([1, 2]);
  expect(db.featureFlags.find(f => f.id === 'killswitch.ai')!.enabled).toBe(true);
  expect(db.approvals).toHaveLength(1);
  expect(db.idempotencyKeys.find(k => k.id === 'IDK-1')!.responseBody).toEqual({ ok: 1 });
  expect(db.deviceSessions).toEqual([expect.objectContaining({ userId, name: 'Pixel', platform: 'android' })]);
  expect(db.refreshTokens).toHaveLength(1);
  expect(db.pushDevices).toEqual([expect.objectContaining({ fcmToken: 'fcm-1' })]);
  expect(db.integrationConfigs.find(c => c.id === 'paymob')!.enabled).toBe(false);
}

describe('staff control plane persistence', () => {
  it('SQLite: every new collection survives a reopen; session viewAs/deviceSessionId/kind persist', () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-ops-'));
    const file = path.join(dir, 'ops.sqlite');
    adapter = new SqlitePersistenceAdapter(file);
    db.setAdapter(adapter);
    const { u, login, device, tokens } = writeEverything();

    // The indexed read path (a copy from SQL) sees the mutation of the live row.
    const viaSql = findOneBy<SessionEntity>('sessions', 'token', login.session.token)!;
    expect(viaSql.viewAs?.userId).toBe('USR-T');
    expect(viaSql.deviceSessionId).toBe(device.id);

    adapter.close();
    adapter = new SqlitePersistenceAdapter(file);
    db.setAdapter(adapter);
    invalidatePermissionCache();

    expectEverything(u.id);
    const reloaded = db.sessions.find(s => s.token === login.session.token)!;
    expect(reloaded.viewAs?.userId).toBe('USR-T');
    expect(db.sessions.find(s => s.token === tokens.accessToken)!.kind).toBe('access');
    // (No findOneBy here: query.ts caches prepared statements per SQL text, bound to the closed connection.)
    expect(nativeAuthService.refresh(tokens.refreshToken).accessToken).toMatch(/^acc_/);
  });

  it('in-memory adapter holds every new collection', () => {
    db.setAdapter(new InMemoryPersistenceAdapter());
    const { u } = writeEverything();
    expectEverything(u.id);
  });
});
