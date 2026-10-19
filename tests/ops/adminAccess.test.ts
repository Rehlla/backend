import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { authService } from '../../server/services/authService';
import { invalidatePermissionCache } from '../../server/services/permissionService';
import { startOpsApp, caller, createUser, signedIn, type OpsTestServer } from './opsTestApp';

/** /api/admin users, roles, overrides, sessions and the catalogue (docs/OPS_API_CONTRACT.md, Admin: access). */

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
  return { status: r.status, body: await r.json() };
};

describe('users', () => {
  it('lists users in the list shape with filters and paging; Operations is 403', async () => {
    const { token } = signedIn('Admin');
    createUser('Operations');
    createUser('Supplier', { supplierId: 'SUP-1', status: 'suspended' });
    createUser('Traveler');

    const all = await json(call('GET', '/api/admin/users?limit=2', { token }));
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(2);
    expect(all.body.total).toBe(4);
    expect(typeof all.body.nextCursor).toBe('string');
    expect(all.body.items[0]).toHaveProperty('deviceCount');
    expect(all.body.items[0].passwordHash).toBeUndefined();

    const page2 = await json(call('GET', `/api/admin/users?limit=2&cursor=${all.body.nextCursor}`, { token }));
    expect(page2.body.items).toHaveLength(2);
    expect(page2.body.nextCursor).toBeNull();

    const suspended = await json(call('GET', '/api/admin/users?status=suspended', { token }));
    expect(suspended.body.items.map((u: any) => u.role)).toEqual(['Supplier']);

    const { token: opsToken } = signedIn('Operations');
    expect((await call('GET', '/api/admin/users', { token: opsToken })).status).toBe(403);
    expect((await call('GET', '/api/admin/users')).status).toBe(401);
  });

  it('detail carries roleId, overrides, effective permissions and devices', async () => {
    const { token } = signedIn('Admin');
    const target = createUser('Operations');
    const d = await json(call('GET', `/api/admin/users/${target.id}`, { token }));
    expect(d.status).toBe(200);
    expect(d.body.roleId).toBe('Operations');
    expect(d.body.overrides).toEqual([]);
    expect(d.body.effectivePermissions).toContain('ops.overview.view');
    expect(d.body.devices).toEqual([]);
    expect((await call('GET', '/api/admin/users/USR-NOPE', { token })).status).toBe(404);
  });

  it('invite returns a one-time temp password that signs in', async () => {
    const { token } = signedIn('Admin');
    const r = await json(call('POST', '/api/admin/users', { token, body: { email: 'New.Desk@ops.test', name: 'New Desk', roleId: 'Operations' } }));
    expect(r.status).toBe(201);
    expect(r.body.user).toMatchObject({ email: 'new.desk@ops.test', role: 'Operations', status: 'active' });
    expect(() => authService.login('new.desk@ops.test', r.body.tempPassword)).not.toThrow();
    expect((await call('POST', '/api/admin/users', { token, body: { email: 'new.desk@ops.test', name: 'Dup', roleId: 'Operations' } })).status).toBe(409);
    expect((await call('POST', '/api/admin/users', { token, body: { email: 'boss@ops.test', name: 'Boss', roleId: 'Admin' } })).status).toBe(403);
    expect((await call('POST', '/api/admin/users', { token, body: { email: 'bad', name: 'x', roleId: 'Operations' } })).status).toBe(400);
  });

  it('PATCH requires a reason, suspends (revoking sessions), and queues Admin grants for approval', async () => {
    const { user: me, token } = signedIn('Admin');
    const { user: target, token: targetToken } = signedIn('Operations');

    expect((await call('PATCH', `/api/admin/users/${target.id}`, { token, body: { status: 'suspended' } })).status).toBe(400);

    const sus = await json(call('PATCH', `/api/admin/users/${target.id}`, { token, body: { status: 'suspended', reason: 'left the company' } }));
    expect(sus.status).toBe(200);
    expect(sus.body.user.status).toBe('suspended');
    expect((await call('GET', '/api/auth/me', { token: targetToken })).status).toBe(401);
    expect(db.auditEvents.some(e => e.action === 'USER_UPDATED' && e.entityId === target.id)).toBe(true);

    expect((await call('PATCH', `/api/admin/users/${me.id}`, { token, body: { status: 'suspended', reason: 'self' } })).status).toBe(400);

    const other = createUser('Operations');
    const grant = await json(call('PATCH', `/api/admin/users/${other.id}`, { token, body: { roleId: 'Admin', reason: 'promotion' } }));
    expect(grant.status).toBe(403);
    expect(grant.body.type).toBe('https://dahab.travel/errors/approval-required');
    expect(grant.body.approvalId).toMatch(/^APR-/);
    expect(db.users.find(u => u.id === other.id)!.role).toBe('Operations');
  });

  it('a delegated user manager cannot change an Admin account', async () => {
    const { token } = signedIn('Operations');
    const opsUser = db.users[db.users.length - 1];
    db.userPermissionOverrides.push({ id: 'O1', userId: opsUser.id, permission: 'admin.users.manage', effect: 'grant', createdBy: 'x', createdAt: '' });
    invalidatePermissionCache();
    const adminUser = createUser('Admin');
    expect((await call('PATCH', `/api/admin/users/${adminUser.id}`, { token, body: { status: 'suspended', reason: 'coup attempt' } })).status).toBe(403);
  });

  it('PUT overrides replaces the set and returns effective permissions; not on yourself', async () => {
    const { user: me, token } = signedIn('Admin');
    const target = createUser('Operations');
    const r = await json(call('PUT', `/api/admin/users/${target.id}/overrides`, {
      token, body: { overrides: [{ permission: 'ops.commerce.refund', effect: 'deny' }, { permission: 'admin.users.view', effect: 'grant' }], reason: 'tighten refunds' },
    }));
    expect(r.status).toBe(200);
    expect(r.body.overrides).toHaveLength(2);
    expect(r.body.overrides[0]).toHaveProperty('createdBy', me.id);
    expect(r.body.effectivePermissions).not.toContain('ops.commerce.refund');
    expect(r.body.effectivePermissions).toContain('admin.users.view');

    const cleared = await json(call('PUT', `/api/admin/users/${target.id}/overrides`, { token, body: { overrides: [], reason: 'reset all' } }));
    expect(cleared.body.overrides).toEqual([]);

    expect((await call('PUT', `/api/admin/users/${me.id}/overrides`, { token, body: { overrides: [], reason: 'self edit' } })).status).toBe(403);
    expect((await call('PUT', `/api/admin/users/${target.id}/overrides`, { token, body: { overrides: [{ permission: '*', effect: 'grant' }], reason: 'sneaky' } })).status).toBe(400);
    expect((await call('PUT', `/api/admin/users/${target.id}/overrides`, { token, body: { overrides: [{ permission: 'x.y.z', effect: 'grant' }], reason: 'unknown' } })).status).toBe(400);
  });

  it('revoke-sessions kills every session and reports the count', async () => {
    const { token } = signedIn('Admin');
    const target = createUser('Operations');
    const s1 = authService.login(target.email, 'ops-test-password-123456').session.token;
    authService.login(target.email, 'ops-test-password-123456');
    const r = await json(call('POST', `/api/admin/users/${target.id}/revoke-sessions`, { token, body: { reason: 'lost laptop' } }));
    expect(r.status).toBe(200);
    expect(r.body.revokedCount).toBe(2);
    expect(authService.validateToken(`Bearer ${s1}`)).toBeNull();
  });
});

describe('permissions and roles', () => {
  it('serves the catalogue', async () => {
    const { token } = signedIn('Admin');
    const r = await json(call('GET', '/api/admin/permissions', { token }));
    expect(r.body.items.find((p: any) => p.key === 'ops.commerce.refund')).toMatchObject({ group: 'ops', dangerous: true });
    expect(r.body.items.every((p: any) => p.labelEn && p.labelAr)).toBe(true);
  });

  it('lists system roles with user counts; creates, edits and deletes a custom role', async () => {
    const { token } = signedIn('Admin');
    createUser('Operations');
    const roles = await json(call('GET', '/api/admin/roles', { token }));
    const opsRole = roles.body.items.find((r: any) => r.id === 'Operations');
    expect(opsRole).toMatchObject({ isSystem: true, userCount: 1 });
    expect(roles.body.items.find((r: any) => r.id === 'Admin').permissions).toEqual(['*']);

    const created = await json(call('POST', '/api/admin/roles', { token, body: { name: 'Night desk', description: 'Overnight', permissions: ['ops.overview.view', 'ops.support.*'] } }));
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: 'Night desk', isSystem: false, userCount: 0 });
    expect((await call('POST', '/api/admin/roles', { token, body: { name: 'Bad', permissions: ['nope.x'] } })).status).toBe(400);
    expect((await call('POST', '/api/admin/roles', { token, body: { name: 'God', permissions: ['*'] } })).status).toBe(400);

    const patched = await json(call('PATCH', `/api/admin/roles/${created.body.id}`, { token, body: { name: 'Night shift', permissions: ['ops.overview.view'], reason: 'narrow it' } }));
    expect(patched.body).toMatchObject({ name: 'Night shift', permissions: ['ops.overview.view'] });

    // System roles: permissions may change, names may not, never deleted.
    expect((await call('PATCH', '/api/admin/roles/Operations', { token, body: { name: 'Ops', reason: 'rename' } })).status).toBe(400);
    expect((await call('PATCH', '/api/admin/roles/Product', { token, body: { permissions: ['cms.content.view'], reason: 'narrow' } })).status).toBe(200);
    expect((await call('DELETE', '/api/admin/roles/Operations', { token })).status).toBe(400);

    // A role in use cannot be deleted.
    const u = createUser('Operations', { roleId: created.body.id });
    expect((await call('DELETE', `/api/admin/roles/${created.body.id}`, { token })).status).toBe(409);
    db.users.splice(db.users.indexOf(u), 1);
    expect((await call('DELETE', `/api/admin/roles/${created.body.id}`, { token })).status).toBe(200);
  });

  it('roles.manage is needed to write roles', async () => {
    const { token } = signedIn('Operations');
    expect((await call('POST', '/api/admin/roles', { token, body: { name: 'X', permissions: [] } })).status).toBe(403);
  });
});
