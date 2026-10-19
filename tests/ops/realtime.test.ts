import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { invalidatePermissionCache, setOverrides } from '../../server/services/permissionService';
import { staffEventStream, streamEvent, RING_SIZE } from '../../server/services/staffEventStream';
import { HEARTBEAT_MS } from '../../server/api/staffRealtimeRoutes';
import { createIntegrationHealthService } from '../../server/services/integrationHealthService';
import { getConfig } from '../../server/config';
import { PaymentService } from '../../server/services/paymentService';
import { notificationService } from '../../server/services/notificationService';
import { startOpsApp, caller, createUser, signedIn, type OpsTestServer } from './opsTestApp';

/**
 * Realtime + operations additions (docs/OPS_API_CONTRACT.md): SSE stream
 * filtering and replay, permission-filtered search, overview ETag,
 * integration probes, and the commission setting.
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
  staffEventStream.reset();
});

interface SseEvent { id: string; event: string; data: any }

/** Opens /api/stream and collects parsed events in the background. */
async function openStream(token: string, query = '', headers: Record<string, string> = {}) {
  const ac = new AbortController();
  const res = await fetch(`${srv.base}/api/stream${query}`, {
    headers: { cookie: `dahab_auth_token=${token}`, ...headers },
    signal: ac.signal,
  });
  const events: SseEvent[] = [];
  let raw = '';
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let ready!: () => void;
  const opened = new Promise<void>(r => { ready = r; });
  (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });
        if (raw.includes('retry:')) ready();
        let idx;
        while ((idx = raw.indexOf('\n\n')) >= 0) {
          const block = raw.slice(0, idx);
          raw = raw.slice(idx + 2);
          const lines = block.split('\n');
          const get = (k: string) => lines.find(l => l.startsWith(`${k}: `))?.slice(k.length + 2);
          const data = get('data');
          if (data) events.push({ id: get('id')!, event: get('event')!, data: JSON.parse(data) });
        }
      }
    } catch {
      // aborted
    }
  })();
  if (res.status === 200) await opened;
  return { res, events, close: () => ac.abort() };
}

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms));

describe('GET /api/stream', () => {
  it('requires a session and declares the contract constants', async () => {
    expect((await fetch(`${srv.base}/api/stream`)).status).toBe(401);
    expect(HEARTBEAT_MS).toBe(25_000);
    expect(RING_SIZE).toBe(200);
  });

  it('filters by topic permission and by supplierId', async () => {
    const ops = signedIn('Operations');
    const admin = signedIn('Admin');
    const sup = signedIn('Supplier', { supplierId: 'SUP-1' });
    const trav = signedIn('Traveler');

    const sOps = await openStream(ops.token);
    const sAdmin = await openStream(admin.token);
    const sSup = await openStream(sup.token);
    const sTrav = await openStream(trav.token);
    expect(sOps.res.headers.get('content-type')).toMatch(/text\/event-stream/);

    streamEvent('BookingCreated', { entityType: 'Booking', entityId: 'BK-1', summary: 'b1', supplierId: 'SUP-1' });
    streamEvent('BookingCreated', { entityType: 'Booking', entityId: 'BK-2', summary: 'b2', supplierId: 'SUP-2' });
    streamEvent('ApprovalRequested', { entityType: 'Approval', entityId: 'APR-1', summary: 'a1' });
    streamEvent('SupportMessageReceived', { entityType: 'SupportMessage', entityId: 'SUP-MSG-1', summary: 's1' });
    streamEvent('NotificationSent', { entityType: 'Notification', entityId: 'N-1', summary: 'n1', userId: trav.user.id });
    await settle();

    const ids = (s: { events: SseEvent[] }) => s.events.map(e => e.data.entityId);
    expect(ids(sOps)).toEqual(['BK-1', 'BK-2', 'SUP-MSG-1', 'N-1']);
    expect(ids(sAdmin)).toEqual(['BK-1', 'BK-2', 'APR-1', 'SUP-MSG-1', 'N-1']);
    expect(ids(sSup)).toEqual(['BK-1']);
    expect(ids(sTrav)).toEqual(['N-1']);

    const first = sOps.events[0];
    expect(first.event).toBe('ops');
    expect(first.data).toMatchObject({ type: 'BookingCreated', entityType: 'Booking', entityId: 'BK-1', summary: 'b1' });
    expect(typeof first.data.at).toBe('string');
    expect(first.data.supplierId).toBeUndefined();
    for (const s of [sOps, sAdmin, sSup, sTrav]) s.close();
  });

  it('a deny override takes effect on the next event; topics narrow the subscription', async () => {
    const ops = signedIn('Operations');
    const s = await openStream(ops.token, '?topics=support');
    streamEvent('BookingCreated', { entityType: 'Booking', entityId: 'BK-1', summary: 'x' });
    streamEvent('SupportMessageReceived', { entityType: 'SupportMessage', entityId: 'M-1', summary: 'x' });
    await settle();
    setOverrides(ops.user.id, [{ permission: 'ops.support.view', effect: 'deny' }], { userId: 'ADM', role: 'Admin' }, 'no support');
    streamEvent('SupportMessageReceived', { entityType: 'SupportMessage', entityId: 'M-2', summary: 'x' });
    await settle();
    expect(s.events.map(e => e.data.entityId)).toEqual(['M-1']);
    s.close();
  });

  it('replays from Last-Event-ID', async () => {
    const ops = signedIn('Operations');
    const e1 = streamEvent('BookingCreated', { entityType: 'Booking', entityId: 'BK-1', summary: 'x' });
    streamEvent('BookingCreated', { entityType: 'Booking', entityId: 'BK-2', summary: 'x' });
    streamEvent('BookingCreated', { entityType: 'Booking', entityId: 'BK-3', summary: 'x' });
    const s = await openStream(ops.token, '', { 'Last-Event-ID': String(e1.id) });
    await settle();
    expect(s.events.map(e => e.data.entityId)).toEqual(['BK-2', 'BK-3']);
    expect(s.events[0].id).toBe(String(e1.id + 1));
    s.close();
  });

  it('keeps only the last 200 events', () => {
    for (let i = 0; i < RING_SIZE + 25; i++) streamEvent('BookingCreated', { entityType: 'Booking', entityId: `BK-${i}`, summary: 'x' });
    const all = staffEventStream.since(0);
    expect(all).toHaveLength(RING_SIZE);
    expect(all[0].data.entityId).toBe('BK-25');
  });

  it('services emit: approvals (bus), EXCEPTION_ALERT notifications (exceptions topic)', async () => {
    const admin = signedIn('Admin');
    const other = signedIn('Admin');
    const s = await openStream(admin.token, '?topics=approvals,exceptions');
    // Commission change queues an approval → ApprovalRequested on the bus.
    await call('PUT', '/api/admin/settings/commerce.commissionRate', { token: other.token, body: { value: 0.1, reason: 'stream test' } });
    notificationService.sendNotification({ userId: 'USR-X', type: 'EXCEPTION_ALERT', title: 'Stay declined', message: 'x' });
    await settle(250);
    const byTopic = s.events.map(e => `${e.event}:${e.data.type}`);
    expect(byTopic).toEqual(expect.arrayContaining(['approvals:ApprovalRequested', 'exceptions:ExceptionRaised']));
    s.close();
  });
});

describe('GET /api/search', () => {
  beforeEach(() => {
    db.bookings.push(
      { id: 'BK-A', bookingRef: 'DHB-ALPHA', supplierId: 'SUP-1', travelerName: 'Alpha Guest', travelerEmail: 'alpha@x.test', serviceType: 'diving', supplierState: 'CONFIRMED' } as any,
      { id: 'BK-B', bookingRef: 'DHB-ALPHB', supplierId: 'SUP-2', travelerName: 'Alpha Other', serviceType: 'diving', supplierState: 'CONFIRMED' } as any,
    );
    db.suppliers.push({ id: 'SUP-1', businessName: 'Alpha Divers', category: 'diving', status: 'ACTIVE' } as any);
  });

  it('staff see bookings + suppliers, users only with admin.users.view', async () => {
    createUser('Traveler', { name: 'Alpha Person' });
    const ops = signedIn('Operations');
    const r = await (await call('GET', '/api/search?q=alpha', { token: ops.token })).json();
    const types = r.items.map((i: any) => `${i.type}:${i.id}`);
    expect(types).toEqual(expect.arrayContaining(['booking:BK-A', 'booking:BK-B', 'supplier:SUP-1']));
    expect(types.some((t: string) => t.startsWith('user:'))).toBe(false);

    const admin = signedIn('Admin');
    const ra = await (await call('GET', '/api/search?q=alpha&types=user', { token: admin.token })).json();
    expect(ra.items.length).toBeGreaterThan(0);
    expect(ra.items.every((i: any) => i.type === 'user')).toBe(true);
    expect(ra.items[0]).toHaveProperty('route');
  });

  it('a supplier sees only its own bookings; a traveler sees nothing', async () => {
    const sup = signedIn('Supplier', { supplierId: 'SUP-1' });
    const r = await (await call('GET', '/api/search?q=alpha', { token: sup.token })).json();
    expect(r.items.map((i: any) => i.id)).toEqual(['BK-A']);
    const trav = signedIn('Traveler');
    expect((await (await call('GET', '/api/search?q=alpha', { token: trav.token })).json()).items).toEqual([]);
    expect((await call('GET', '/api/search?q=alpha')).status).toBe(401);
  });
});

describe('GET /api/operations/overview', () => {
  it('sends an ETag and answers 304 to a matching If-None-Match', async () => {
    const { token } = signedIn('Operations');
    const r1 = await call('GET', '/api/operations/overview', { token });
    expect(r1.status).toBe(200);
    const etag = r1.headers.get('etag')!;
    expect(etag).toMatch(/^".+"$/);
    expect((await r1.json()).summary).toBeDefined();
    const r2 = await call('GET', '/api/operations/overview', { token, headers: { 'If-None-Match': etag } });
    expect(r2.status).toBe(304);
    db.trips.push({ id: 'TRIP-NEW', userId: 'U', title: 't', status: 'PLANNED', createdAt: '', updatedAt: '' } as any);
    expect((await call('GET', '/api/operations/overview', { token, headers: { 'If-None-Match': etag } })).status).toBe(200);
  });
});

describe('integration probes', () => {
  const envWith = (over: Record<string, string>) => () => getConfig({ NODE_ENV: 'test', ...over } as any);

  it("reports 'unconfigured' with no keys and never calls fetch", async () => {
    let calls = 0;
    const svc = createIntegrationHealthService({ fetch: async () => { calls++; return { status: 200, ok: true }; }, env: envWith({}), firebaseCheck: async () => false });
    const items = await svc.list();
    expect(items.map(i => i.status)).toEqual(items.map(() => 'unconfigured'));
    expect(items.every(i => i.keyHint === null)).toBe(true);
    expect(calls).toBe(0);
  });

  it('probes through the injected fetch, hints the key, caches for 60 s, and check() forces', async () => {
    let t = 1_000_000;
    let calls = 0;
    const svc = createIntegrationHealthService({
      fetch: async () => { calls++; return { status: 200, ok: true }; },
      env: envWith({ OPENAI_API_KEY: 'sk-test-abcd1234' }),
      now: () => t,
      firebaseCheck: async () => false,
    });
    const ai = (await svc.list()).find(i => i.id === 'ai')!;
    expect(ai).toMatchObject({ status: 'healthy', keyHint: '••••1234', mode: 'sandbox', enabled: true });
    expect(calls).toBe(1);
    t += 30_000;
    await svc.list();
    expect(calls).toBe(1);
    t += 31_000;
    await svc.list();
    expect(calls).toBe(2);
    await svc.check('ai');
    expect(calls).toBe(3);
  });

  it('classifies failures: 401 down, 429 degraded, network error down', async () => {
    const mk = (f: () => Promise<{ status: number; ok: boolean }>) =>
      createIntegrationHealthService({ fetch: f, env: envWith({ OPENAI_API_KEY: 'sk-x-9999' }), firebaseCheck: async () => true });
    expect((await mk(async () => ({ status: 401, ok: false })).check('ai')).status).toBe('down');
    expect((await mk(async () => ({ status: 429, ok: false })).check('ai')).status).toBe('degraded');
    const net = await mk(async () => { throw new Error('ECONNRESET'); }).check('ai');
    expect(net.status).toBe('down');
    expect(net.detail).toMatch(/ECONNRESET/);
  });

  it('legacyList keeps the shape the web SystemHealth panel reads', async () => {
    const svc = createIntegrationHealthService({ fetch: async () => ({ status: 200, ok: true }), env: envWith({}), firebaseCheck: async () => false });
    const rows = await svc.legacyList();
    for (const r of rows) {
      expect(Object.keys(r).sort()).toEqual(['detail', 'freshness', 'lastFailure', 'lastSuccess', 'name', 'purpose', 'status']);
      expect(['healthy', 'degraded', 'down']).toContain(r.status);
    }
  });

  it('/api/operations/integrations answers { integrations, total }', async () => {
    const { token } = signedIn('Operations');
    const body = await (await call('GET', '/api/operations/integrations', { token })).json();
    expect(Array.isArray(body.integrations)).toBe(true);
    expect(body.total).toBe(body.integrations.length);
  });
});

describe('commission', () => {
  it('PaymentService.COMMISSION_RATE reads commerce.commissionRate, default 0.15', () => {
    expect(PaymentService.COMMISSION_RATE).toBe(0.15);
    db.settings.push({ id: 'commerce.commissionRate', value: 0.2, version: 2, updatedBy: 'x', updatedAt: '' });
    expect(PaymentService.COMMISSION_RATE).toBe(0.2);
    db.settings[0].value = 'garbage';
    expect(PaymentService.COMMISSION_RATE).toBe(0.15);
  });
});
