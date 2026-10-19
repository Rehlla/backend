import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import {
  hasPermission,
  resolve,
  setOverrides,
  invalidatePermissionCache,
} from '../../server/services/permissionService';
import { requirePermission } from '../../server/middleware/rbacMiddleware';
import {
  PERMISSION_RULES,
  requiredPermissionsFor,
  requiredRolesFor,
} from '../../server/middleware/apiAccessPolicy';
import { PERMISSION_CATALOG, SYSTEM_ROLE_DEFAULTS, grantCovers } from '../../server/auth/permissionCatalog';
import { userAdminService } from '../../server/services/userAdminService';

/**
 * permissionService + requirePermission + the PERMISSION_RULES layer of the
 * access policy (docs/OPS_API_CONTRACT.md, Permissions).
 */

const admin = { userId: 'USR-ADM', role: 'Admin' as const };
const ops = { userId: 'USR-OPS', role: 'Operations' as const };
const product = { userId: 'USR-PRD', role: 'Product' as const };
const supplier = { userId: 'USR-SUP', role: 'Supplier' as const };
const traveler = { userId: 'USR-TRV', role: 'Traveler' as const };

beforeEach(() => {
  resetDb();
  invalidatePermissionCache();
});

describe('permissionService', () => {
  it('Admin holds * and resolves to ["*"]', () => {
    expect(hasPermission(admin, 'admin.users.manage')).toBe(true);
    expect(hasPermission(admin, 'ops.commerce.refund')).toBe(true);
    expect(resolve(admin)).toEqual(['*']);
  });

  it('default role grants follow the contract table', () => {
    expect(hasPermission(ops, 'ops.commerce.refund')).toBe(true);
    expect(hasPermission(ops, 'cms.content.edit')).toBe(true);
    expect(hasPermission(ops, 'supplier.inbox.view')).toBe(true);
    expect(hasPermission(ops, 'supplier.inbox.respond')).toBe(false);
    expect(hasPermission(ops, 'admin.users.view')).toBe(false);
    expect(hasPermission(product, 'cms.theme.manage')).toBe(true);
    expect(hasPermission(product, 'ops.overview.view')).toBe(true);
    expect(hasPermission(product, 'ops.trips.view')).toBe(false);
    expect(hasPermission(supplier, 'supplier.stays.manage')).toBe(true);
    expect(hasPermission(supplier, 'ops.overview.view')).toBe(false);
    expect(resolve(traveler)).toEqual([]);
    expect(hasPermission(null, 'ops.overview.view')).toBe(false);
  });

  it('a grant override adds a key; a deny override removes one', () => {
    setOverrides(ops.userId, [
      { permission: 'admin.users.view', effect: 'grant' },
      { permission: 'ops.commerce.refund', effect: 'deny' },
    ], admin, 'test overrides');
    expect(hasPermission(ops, 'admin.users.view')).toBe(true);
    expect(hasPermission(ops, 'ops.commerce.refund')).toBe(false);
    expect(hasPermission(ops, 'ops.commerce.view')).toBe(true);
    const keys = resolve(ops);
    expect(keys).toContain('admin.users.view');
    expect(keys).not.toContain('ops.commerce.refund');
  });

  it('deny beats * — even an Admin loses a denied key', () => {
    setOverrides(admin.userId, [{ permission: 'admin.viewas', effect: 'deny' }], { userId: 'USR-OTHER', role: 'Admin' }, 'take one thing away');
    expect(hasPermission(admin, 'admin.viewas')).toBe(false);
    expect(hasPermission(admin, 'admin.users.manage')).toBe(true);
    expect(resolve(admin)).not.toContain('admin.viewas');
    expect(resolve(admin)).not.toEqual(['*']);
  });

  it('a prefix deny (ops.*) removes the whole area', () => {
    setOverrides(ops.userId, [{ permission: 'ops.*', effect: 'deny' }], admin, 'freeze');
    expect(hasPermission(ops, 'ops.overview.view')).toBe(false);
    expect(hasPermission(ops, 'cms.content.view')).toBe(true);
  });

  it('a custom role narrows an account below its base role', () => {
    const role = userAdminService.createRole({ name: 'Read-only desk', permissions: ['ops.overview.view'] }, admin);
    db.users.push({
      id: ops.userId, email: 'o@x.test', name: 'O', phone: '', passwordHash: '', role: 'Operations', roleId: role.id,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    });
    invalidatePermissionCache();
    expect(hasPermission(ops, 'ops.overview.view')).toBe(true);
    expect(hasPermission(ops, 'ops.commerce.refund')).toBe(false);
  });

  it('rejects unknown permission keys on override writes', () => {
    expect(() => setOverrides(ops.userId, [{ permission: 'ops.nope.never', effect: 'grant' }], admin, 'bad')).toThrow(/Unknown permission/);
  });
});

describe('requirePermission over HTTP', () => {
  let server: Server;
  let base = '';
  beforeAll(async () => {
    const app = express();
    app.use((req, _res, next) => {
      const who = req.header('x-test-user');
      if (who) {
        const [userId, role] = who.split(':');
        (req as any).user = { userId, role, name: userId, email: `${userId}@x.test` };
      }
      next();
    });
    app.get('/guarded', requirePermission('ops.commerce.refund'), (_req, res) => res.json({ ok: true }));
    await new Promise<void>(r => { server = app.listen(0, '127.0.0.1', () => r()); });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>(r => server.close(() => r())));
  const get = (who?: string) => fetch(`${base}/guarded`, { headers: who ? { 'x-test-user': who } : {} });

  it('401 without a session, 403 without the key, 200 with it', async () => {
    const r401 = await get();
    expect(r401.status).toBe(401);
    expect((await r401.json()).type).toBe('https://dahab.travel/errors/unauthorized');
    const r403 = await get('USR-P:Product');
    expect(r403.status).toBe(403);
    expect((await r403.json()).type).toBe('https://dahab.travel/errors/forbidden');
    expect((await get('USR-O:Operations')).status).toBe(200);
    expect((await get('USR-A:Admin')).status).toBe(200);
  });

  it('a deny override turns the 200 into 403', async () => {
    setOverrides('USR-O', [{ permission: 'ops.commerce.refund', effect: 'deny' }], admin, 'deny refund');
    expect((await get('USR-O:Operations')).status).toBe(403);
  });
});

describe('ROLE_RULES are unchanged and PERMISSION_RULES change nobody', () => {
  // One probe per ROLE_RULE, with the roles the rule granted before the
  // permission layer existed. If a rule is edited, this table must be too.
  const ROLE_TABLE: [string, string, string[] | null][] = [
    ['/commerce/ledger/anomalies', 'GET', ['Operations', 'Admin']],
    ['/commerce/refund', 'POST', ['Operations', 'Admin']],
    ['/operations/overview', 'GET', ['Operations', 'Admin']],
    ['/suppliers', 'GET', ['Traveler', 'Supplier', 'Operations', 'Product', 'Admin']],
    ['/suppliers/SUP-1/dashboard', 'GET', ['Supplier', 'Operations', 'Admin']],
    ['/market/sources', 'GET', ['Product', 'Operations', 'Admin']],
    ['/intelligence/features', 'GET', ['Product', 'Operations', 'Admin']],
    ['/intelligence-core/query', 'POST', ['Operations', 'Admin']],
    ['/admin/accommodations', 'GET', ['Operations', 'Admin', 'Product']],
    ['/admin/hotel/room-types', 'GET', ['Operations', 'Admin']],
    ['/dining/orders/ORD-1/status', 'POST', ['Operations', 'Admin']],
    ['/rentals/provider/listings', 'GET', ['Supplier', 'Operations', 'Admin']],
    ['/property-stays', 'GET', ['Supplier', 'Operations', 'Admin']],
    ['/rentals/R-1/maintenance-blocks', 'POST', ['Supplier', 'Operations', 'Admin']],
    ['/rentals/R-1/status', 'PATCH', ['Operations', 'Admin']],
    ['/rental-bookings/provider', 'GET', ['Supplier', 'Operations', 'Admin']],
    ['/rental-bookings/RB-1/accept', 'POST', ['Supplier', 'Operations', 'Admin']],
    ['/dahab/commerce/refresh', 'POST', ['Product', 'Operations', 'Admin']],
    ['/dahab/commerce/jobs/run', 'POST', ['Operations', 'Admin']],
    ['/dahab/admin/parties', 'GET', ['Operations', 'Admin']],
    ['/support/messages/M-1/reply', 'POST', ['Operations', 'Admin']],
    ['/support/messages/M-1/escalate', 'POST', ['Operations', 'Admin']],
    ['/support/escalation-queue', 'GET', ['Operations', 'Admin']],
    ['/support/counts', 'GET', ['Operations', 'Admin']],
    ['/sms/logs', 'GET', ['Operations', 'Admin']],
    ['/bundles', 'POST', ['Admin', 'Operations']],
    ['/bundles/B-1', 'PATCH', ['Admin', 'Operations']],
    ['/bundles/B-1', 'GET', null],
    ['/fraud/signals', 'GET', ['Admin', 'Operations']],
    ['/reviews/pending', 'GET', ['Operations', 'Admin']],
    ['/reviews/RV-1/moderate', 'POST', ['Operations', 'Admin']],
    ['/payouts/pending', 'GET', ['Operations', 'Admin']],
    ['/admin/push/send', 'POST', ['Operations', 'Admin']],
    ['/jobs/status', 'GET', ['Operations', 'Admin']],
    ['/events/recent', 'GET', ['Operations', 'Admin']],
    ['/daygi/beta/dashboard', 'GET', ['Product', 'Operations', 'Admin']],
    ['/testing/golden-journey', 'POST', ['Admin']],
    ['/admin/content/pages', 'GET', ['Operations', 'Admin', 'Product']],
    // New staff endpoints are gated by requirePermission in their routers, not by ROLE_RULES.
    ['/admin/users', 'GET', null],
    ['/stream', 'GET', null],
    ['/search', 'GET', null],
    ['/trips', 'GET', null],
  ];

  it.each(ROLE_TABLE)('requiredRolesFor(%s, %s)', (path, method, roles) => {
    expect(requiredRolesFor(path, method)).toEqual(roles);
  });

  it('every role a ROLE_RULE admits holds a key the matching PERMISSION_RULE asks for', () => {
    const failures: string[] = [];
    for (const [path, method, roles] of ROLE_TABLE) {
      const methods = method === 'GET' ? ['GET'] : [method];
      for (const m of methods) {
        const keys = requiredPermissionsFor(path, m);
        if (!keys) continue;
        for (const role of roles || ['Traveler', 'Supplier', 'Operations', 'Product', 'Admin']) {
          if (!roles && role === 'Traveler') continue;
          const grants = SYSTEM_ROLE_DEFAULTS[role as keyof typeof SYSTEM_ROLE_DEFAULTS].permissions;
          if (!keys.some(k => grants.some(g => grantCovers(g, k)))) failures.push(`${role} ${m} ${path} needs one of ${keys.join('|')}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it('every PERMISSION_RULE key exists in the catalogue', () => {
    const catalogue = new Set(PERMISSION_CATALOG.map(p => p.key));
    const keys = PERMISSION_RULES.flatMap(r => [...(r.all || []), ...(r.read || []), ...(r.write || [])]);
    expect(keys.filter(k => !catalogue.has(k))).toEqual([]);
  });
});
