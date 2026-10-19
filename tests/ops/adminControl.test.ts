import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { invalidatePermissionCache } from '../../server/services/permissionService';
import { PaymentService } from '../../server/services/paymentService';
import { startOpsApp, caller, createUser, signedIn, type OpsTestServer } from './opsTestApp';

/**
 * /api/admin control plane (docs/OPS_API_CONTRACT.md, Admin: control):
 * settings + rollback, flags, kill switches, maintenance, approvals,
 * Idempotency-Key, the audit log and read-only view-as.
 */

let srv: OpsTestServer;
let call: ReturnType<typeof caller>;
beforeAll(async () => {
  srv = await startOpsApp(app => {
    // Stand-ins for inline server.ts routes the gates cover.
    app.post('/api/commerce/checkout', (_req, res) => res.json({ ok: 'checkout ran' }));
    app.get('/api/commerce/checkout/status', (_req, res) => res.json({ ok: 'read ran' }));
    app.get('/api/trips', (_req, res) => res.json({ ok: 'trips' }));
  });
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

describe('settings', () => {
  it('lists the seeded keys with defaults', async () => {
    const { token } = signedIn('Admin');
    const r = await json(call('GET', '/api/admin/settings', { token }));
    const byKey = Object.fromEntries(r.body.items.map((s: any) => [s.key, s]));
    expect(byKey['commerce.commissionRate']).toMatchObject({ value: 0.15, type: 'number', version: 1 });
    expect(byKey['commerce.refundApprovalThresholdEgp'].value).toBe(5000);
    expect(byKey['commerce.currency'].value).toBe('EGP');
    expect(byKey['support.slaMinutes'].value).toBe(30);
    expect(byKey['support.hours'].value).toBe('09:00-23:00');
    expect(byKey['sms.templates'].type).toBe('json');
    expect(byKey['system.maintenanceMessage'].value).toHaveProperty('ar');
  });

  it('set bumps the version, history lists it, rollback restores an earlier value', async () => {
    const { token } = signedIn('Admin');
    expect((await call('PUT', '/api/admin/settings/support.slaMinutes', { token, body: { value: 45 } })).status).toBe(400);
    expect((await call('PUT', '/api/admin/settings/support.slaMinutes', { token, body: { value: 'x', reason: 'bad type' } })).status).toBe(400);
    expect((await call('PUT', '/api/admin/settings/nope.key', { token, body: { value: 1, reason: 'unknown' } })).status).toBe(404);

    const v2 = await json(call('PUT', '/api/admin/settings/support.slaMinutes', { token, body: { value: 45, reason: 'busy season' } }));
    expect(v2.body).toMatchObject({ value: 45, version: 2 });
    await call('PUT', '/api/admin/settings/support.slaMinutes', { token, body: { value: 60, reason: 'even busier' } });

    const hist = await json(call('GET', '/api/admin/settings/support.slaMinutes/history', { token }));
    expect(hist.body.items.map((h: any) => h.version)).toEqual([3, 2, 1]);
    expect(hist.body.items[1]).toMatchObject({ value: 45, reason: 'busy season' });

    const rb = await json(call('POST', '/api/admin/settings/support.slaMinutes/rollback', { token, body: { version: 1, reason: 'back to normal' } }));
    expect(rb.status).toBe(200);
    expect(rb.body).toMatchObject({ value: 30, version: 4 });
    expect((await call('POST', '/api/admin/settings/support.slaMinutes/rollback', { token, body: { version: 99, reason: 'missing' } })).status).toBe(404);
    expect(db.auditEvents.filter(e => e.action === 'SETTING_UPDATED' && e.entityId === 'support.slaMinutes')).toHaveLength(3);
  });

  it('Operations can read settings only with admin.settings.view', async () => {
    const { token } = signedIn('Operations');
    expect((await call('GET', '/api/admin/settings', { token })).status).toBe(403);
  });
});

describe('approvals', () => {
  it('commission change is queued, the requester cannot approve it, a second admin approval executes it', async () => {
    const a = signedIn('Admin');
    const b = signedIn('Admin');
    expect(PaymentService.COMMISSION_RATE).toBe(0.15);

    const q = await json(call('PUT', '/api/admin/settings/commerce.commissionRate', { token: a.token, body: { value: 0.12, reason: 'promo quarter' } }));
    expect(q.status).toBe(403);
    expect(q.body.type).toBe('https://dahab.travel/errors/approval-required');
    const approvalId = q.body.approvalId;
    expect(PaymentService.COMMISSION_RATE).toBe(0.15);

    const pending = await json(call('GET', '/api/admin/approvals?status=pending', { token: b.token }));
    expect(pending.body.items.map((x: any) => x.id)).toEqual([approvalId]);
    expect(pending.body.total).toBe(1);

    const self = await json(call('POST', `/api/admin/approvals/${approvalId}/decide`, { token: a.token, body: { decision: 'approve' } }));
    expect(self.status).toBe(403);

    const ok = await json(call('POST', `/api/admin/approvals/${approvalId}/decide`, { token: b.token, body: { decision: 'approve', note: 'fine' } }));
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ status: 'approved', decidedBy: b.user.id, decisionNote: 'fine' });
    expect(PaymentService.COMMISSION_RATE).toBe(0.12);

    expect((await call('POST', `/api/admin/approvals/${approvalId}/decide`, { token: b.token, body: { decision: 'reject' } })).status).toBe(409);
  });

  it('granting Admin executes on approval; rejecting leaves the account unchanged', async () => {
    const a = signedIn('Admin');
    const b = signedIn('Admin');
    const t1 = createUser('Operations');
    const t2 = createUser('Operations');
    const id1 = (await json(call('PATCH', `/api/admin/users/${t1.id}`, { token: a.token, body: { roleId: 'Admin', reason: 'promote one' } }))).body.approvalId;
    const id2 = (await json(call('PATCH', `/api/admin/users/${t2.id}`, { token: a.token, body: { roleId: 'Admin', reason: 'promote two' } }))).body.approvalId;
    await call('POST', `/api/admin/approvals/${id1}/decide`, { token: b.token, body: { decision: 'approve' } });
    await call('POST', `/api/admin/approvals/${id2}/decide`, { token: b.token, body: { decision: 'reject' } });
    expect(db.users.find(u => u.id === t1.id)!.role).toBe('Admin');
    expect(db.users.find(u => u.id === t2.id)!.role).toBe('Operations');
  });

  it('a refund above commerce.refundApprovalThresholdEgp is queued, not executed', async () => {
    const { token } = signedIn('Operations');
    db.bookings.push({ id: 'BK-1', bookingRef: 'REF-1', tripId: 'TRIP-1', supplierId: 'SUP-1', paymentState: 'CAPTURED', amountEGP: 9000 } as any);
    const r = await json(call('POST', '/api/operations/refund', { token, body: { bookingRef: 'REF-1', amountEGP: 6000, reason: 'big refund' } }));
    expect(r.status).toBe(403);
    expect(r.body.type).toBe('https://dahab.travel/errors/approval-required');
    const approval = db.approvals.find(x => x.id === r.body.approvalId)!;
    expect(approval).toMatchObject({ action: 'refund', status: 'pending' });
    expect(approval.payload).toMatchObject({ amountEGP: 6000, supplierId: 'SUP-1' });
    expect(db.ledgerEntries.filter(e => e.type === 'REFUND_ISSUED')).toHaveLength(0);
  });

  it('Operations cannot see or decide approvals', async () => {
    const { token } = signedIn('Operations');
    expect((await call('GET', '/api/admin/approvals', { token })).status).toBe(403);
  });
});

describe('flags, kill switches and maintenance', () => {
  it('lists seeded switches; Product may view, only admin.flags.manage may change', async () => {
    const { token } = signedIn('Product');
    const r = await json(call('GET', '/api/admin/flags', { token }));
    const keys = r.body.items.map((f: any) => f.key);
    expect(keys).toEqual(expect.arrayContaining(['killswitch.payments', 'killswitch.bookings', 'killswitch.ai', 'killswitch.sms', 'killswitch.supplierSignup', 'system.maintenance']));
    expect((await call('PUT', '/api/admin/flags/killswitch.payments', { token, body: { enabled: true, reason: 'nope' } })).status).toBe(403);
  });

  it('a thrown kill switch answers 503 .../kill-switch on gated mutations only', async () => {
    const { token: admin } = signedIn('Admin');
    const { token: traveler } = signedIn('Traveler');
    expect((await call('POST', '/api/commerce/checkout', { token: traveler, body: {} })).status).toBe(200);

    const put = await json(call('PUT', '/api/admin/flags/killswitch.payments', { token: admin, body: { enabled: true, reason: 'paymob outage' } }));
    expect(put.body).toMatchObject({ key: 'killswitch.payments', enabled: true });

    const blocked = await json(call('POST', '/api/commerce/checkout', { token: traveler, body: {} }));
    expect(blocked.status).toBe(503);
    expect(blocked.body).toMatchObject({ type: 'https://dahab.travel/errors/kill-switch', killSwitch: 'killswitch.payments' });
    // Reads stay up.
    expect((await call('GET', '/api/commerce/checkout/status', { token: traveler })).status).toBe(200);
    // /me reports the thrown switch.
    expect((await json(call('GET', '/api/auth/me', { token: traveler }))).body.flags['killswitch.payments']).toBe(true);

    await call('PUT', '/api/admin/flags/killswitch.payments', { token: admin, body: { enabled: false, reason: 'recovered' } });
    expect((await call('POST', '/api/commerce/checkout', { token: traveler, body: {} })).status).toBe(200);
  });

  it('killswitch.sms stops /operations/sms-dispatch', async () => {
    const { token: admin } = signedIn('Admin');
    await call('PUT', '/api/admin/flags/killswitch.sms', { token: admin, body: { enabled: true, reason: 'sms spam' } });
    const r = await json(call('POST', '/api/operations/sms-dispatch', { token: admin, body: { to: '+201000000001', recipientName: 'Driver', message: 'hi' } }));
    expect(r.status).toBe(503);
    expect(r.body.killSwitch).toBe('killswitch.sms');
  });

  it('unknown kill switch keys are 404; new feature flags are created; rolloutPercent is validated', async () => {
    const { token } = signedIn('Admin');
    expect((await call('PUT', '/api/admin/flags/killswitch.everything', { token, body: { enabled: true, reason: 'nope' } })).status).toBe(404);
    const f = await json(call('PUT', '/api/admin/flags/ops.newInbox', { token, body: { enabled: true, rolloutPercent: 50, roles: ['Operations'], reason: 'pilot' } }));
    expect(f.body).toMatchObject({ key: 'ops.newInbox', kind: 'flag', rolloutPercent: 50, roles: ['Operations'] });
    expect((await call('PUT', '/api/admin/flags/ops.newInbox', { token, body: { enabled: true, rolloutPercent: 150, reason: 'bad' } })).status).toBe(400);
  });

  it('maintenance: non-staff /api gets 503, staff and /api/auth keep working', async () => {
    const { token: admin } = signedIn('Admin');
    const { token: traveler } = signedIn('Traveler');
    const { token: opsToken } = signedIn('Operations');
    await call('PUT', '/api/admin/flags/system.maintenance', { token: admin, body: { enabled: true, reason: 'db migration' } });

    const t = await json(call('GET', '/api/trips', { token: traveler }));
    expect(t.status).toBe(503);
    expect(t.body.type).toBe('https://dahab.travel/errors/maintenance');
    expect(t.body.message).toHaveProperty('ar');
    expect((await call('GET', '/api/auth/me', { token: traveler })).status).toBe(200);
    expect((await call('GET', '/api/trips', { token: opsToken })).status).toBe(200);
    expect((await call('GET', '/api/operations/overview', { token: opsToken })).status).toBe(200);

    await call('PUT', '/api/admin/flags/system.maintenance', { token: admin, body: { enabled: false, reason: 'done' } });
    expect((await call('GET', '/api/trips', { token: traveler })).status).toBe(200);
  });
});

describe('Idempotency-Key', () => {
  it('a replay returns the first response with Idempotent-Replay: true and does not re-run', async () => {
    const { token } = signedIn('Operations');
    const send = () => call('POST', '/api/operations/sms-dispatch', {
      token, headers: { 'Idempotency-Key': 'k-123' }, body: { to: '+201000000001', recipientName: 'Driver', message: 'pickup 9am' },
    });
    const first = await json(send());
    expect(first.status).toBe(200);
    expect(first.headers.get('idempotent-replay')).toBeNull();
    const sent = db.auditEvents.filter(e => e.action === 'SMS_DISPATCHED').length;

    const second = await json(send());
    expect(second.status).toBe(200);
    expect(second.headers.get('idempotent-replay')).toBe('true');
    expect(second.body).toEqual(first.body);
    expect(db.auditEvents.filter(e => e.action === 'SMS_DISPATCHED').length).toBe(sent);

    // A different user with the same key is a different operation.
    const other = signedIn('Operations');
    const third = await json(call('POST', '/api/operations/sms-dispatch', {
      token: other.token, headers: { 'Idempotency-Key': 'k-123' }, body: { to: '+201000000001', recipientName: 'Driver', message: 'pickup 9am' },
    }));
    expect(third.headers.get('idempotent-replay')).toBeNull();
  });
});

describe('audit', () => {
  it('lists audit events in the contract shape with filters; CSV export needs admin.audit.export', async () => {
    const { user, token } = signedIn('Admin');
    await call('PUT', '/api/admin/settings/support.slaMinutes', { token, body: { value: 40, reason: 'audit me' } });
    const r = await json(call('GET', '/api/admin/audit?action=SETTING_UPDATED', { token }));
    expect(r.body.total).toBe(1);
    expect(r.body.nextCursor).toBeNull();
    expect(r.body.items[0]).toMatchObject({ actor: user.id, actorRole: 'Admin', action: 'SETTING_UPDATED', entityType: 'Setting', entityId: 'support.slaMinutes', before: 30, after: 40, reason: 'audit me' });
    expect(typeof r.body.items[0].timestamp).toBe('string');

    const csv = await call('GET', '/api/admin/audit/export?action=SETTING_UPDATED', { token });
    expect(csv.headers.get('content-type')).toMatch(/text\/csv/);
    const lines = (await csv.text()).trim().split('\n');
    expect(lines[0]).toBe('id,timestamp,actor,actorRole,action,entityType,entityId,reason,correlationId,before,after');
    expect(lines).toHaveLength(2);

    const { token: opsToken } = signedIn('Operations');
    expect((await call('GET', '/api/admin/audit', { token: opsToken })).status).toBe(200);
    expect((await call('GET', '/api/admin/audit/export', { token: opsToken })).status).toBe(403);
  });

  it('/api/operations/audit-events keeps the legacy shape without params and the list shape with them', async () => {
    const { token } = signedIn('Operations');
    const legacy = await json(call('GET', '/api/operations/audit-events', { token }));
    expect(Array.isArray(legacy.body.auditEvents)).toBe(true);
    expect(legacy.body.items).toBeUndefined();
    const list = await json(call('GET', '/api/operations/audit-events?limit=1', { token }));
    expect(list.body.items).toHaveLength(1);
    expect(list.body).toHaveProperty('nextCursor');
    expect(list.body.total).toBeGreaterThanOrEqual(1);
  });
});

describe('view-as', () => {
  it('reads as the target, refuses writes with 403 view-as-readonly, and ends cleanly', async () => {
    const admin = signedIn('Admin');
    const target = createUser('Supplier', { supplierId: 'SUP-9' });

    expect((await call('POST', '/api/admin/view-as', { token: admin.token, body: { userId: admin.user.id, reason: 'self look' } })).status).toBe(400);
    const otherAdmin = createUser('Admin');
    expect((await call('POST', '/api/admin/view-as', { token: admin.token, body: { userId: otherAdmin.id, reason: 'admin look' } })).status).toBe(403);

    const start = await json(call('POST', '/api/admin/view-as', { token: admin.token, body: { userId: target.id, reason: 'debug supplier inbox' } }));
    expect(start.status).toBe(200);
    expect(start.body.viewAs).toMatchObject({ userId: target.id, email: target.email });
    // The live session row carries it (persists through runInTransaction on every adapter).
    expect(db.sessions.find(s => s.token === admin.token)!.viewAs?.userId).toBe(target.id);

    const me = await json(call('GET', '/api/auth/me', { token: admin.token }));
    expect(me.body.user.id).toBe(target.id);
    expect(me.body.viewAs).toEqual({ userId: target.id, email: target.email });
    expect(me.body.permissions).toContain('supplier.inbox.view');
    expect(me.body.session.viewAs).toBeUndefined();

    // Reads run as the supplier: the admin console is closed.
    expect((await call('GET', '/api/admin/users', { token: admin.token })).status).toBe(403);
    // Writes are refused outright.
    const w = await json(call('PUT', '/api/admin/settings/support.slaMinutes', { token: admin.token, body: { value: 50, reason: 'during view-as' } }));
    expect(w.status).toBe(403);
    expect(w.body.type).toBe('https://dahab.travel/errors/view-as-readonly');
    expect((await call('POST', '/api/devices', { token: admin.token, body: { fcmToken: 'x' } })).status).toBe(403);

    const end = await json(call('DELETE', '/api/admin/view-as', { token: admin.token }));
    expect(end.body).toEqual({ success: true });
    expect((await call('GET', '/api/admin/users', { token: admin.token })).status).toBe(200);
    expect(db.auditEvents.some(e => e.action === 'VIEW_AS_STARTED')).toBe(true);
    expect(db.auditEvents.some(e => e.action === 'VIEW_AS_ENDED')).toBe(true);
  });

  it('needs admin.viewas', async () => {
    const { token } = signedIn('Operations');
    const t = createUser('Traveler');
    expect((await call('POST', '/api/admin/view-as', { token, body: { userId: t.id, reason: 'peek please' } })).status).toBe(403);
  });
});
