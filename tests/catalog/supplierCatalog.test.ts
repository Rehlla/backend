import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { invalidatePermissionCache } from '../../server/services/permissionService';
import { caller, signedIn, type OpsTestServer } from '../ops/opsTestApp';
import { startCatalogApp, json, seedReference, IMG, T } from './catalogTestApp';

/**
 * /api/supplier/catalog (docs/CATALOG_API_CONTRACT.md, supplier portal):
 * ownership isolation, body supplierId ignored, publish → review + approval,
 * price changes above 30% queued for review.
 */

let srv: OpsTestServer;
let call: ReturnType<typeof caller>;
beforeAll(async () => {
  srv = await startCatalogApp();
  call = caller(srv.base);
});
afterAll(() => srv.close());
beforeEach(() => {
  resetDb();
  invalidatePermissionCache();
  seedReference();
});

const SUP = '/api/supplier/catalog';
const STAFF = '/api/admin/catalog';

const supplierA = () => signedIn('Supplier', { supplierId: 'SUP-A' });
const supplierB = () => signedIn('Supplier', { supplierId: 'SUP-B' });

describe('supplier isolation', () => {
  it('creates only for itself, ignoring a body supplierId', async () => {
    const { token } = supplierA();
    const r = await json(call('POST', `${SUP}/restaurant`, { token, body: { title: T('A kitchen'), supplierId: 'SUP-B', fields: { area: 'lighthouse', supplierId: 'SUP-B' } } }));
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.supplierId).toBe('SUP-A');
    expect(db.diningVenues.find(v => v.id === r.body.id)!.supplierId).toBe('SUP-A');

    // A PATCH cannot move it to another supplier either.
    const p = await json(call('PATCH', `${SUP}/restaurant/${r.body.id}`, { token, body: { supplierId: 'SUP-B', fields: { phone: '+20100' } } }));
    expect(p.status).toBe(200);
    expect(p.body.item.supplierId).toBe('SUP-A');
  });

  it("cannot list, read, edit or delete another supplier's records (404, no probing)", async () => {
    const a = supplierA();
    const b = supplierB();
    const mine = await json(call('POST', `${SUP}/package`, { token: b.token, body: { title: T('B package') } }));
    expect(mine.body.supplierId).toBe('SUP-B');

    const list = await json(call('GET', `${SUP}/package?status=draft`, { token: a.token }));
    expect(list.body.items).toEqual([]);
    expect((await call('GET', `${SUP}/package/${mine.body.id}`, { token: a.token })).status).toBe(404);
    expect((await call('PATCH', `${SUP}/package/${mine.body.id}`, { token: a.token, body: { title: T('hijack') } })).status).toBe(404);
    expect((await call('DELETE', `${SUP}/package/${mine.body.id}`, { token: a.token, body: { reason: 'not mine' } })).status).toBe(404);
    expect((await call('POST', `${SUP}/package/${mine.body.id}/publish`, { token: a.token, body: {} })).status).toBe(404);
    expect(db.tripPackages.find(p => p.id === mine.body.id)!.titleEn).toBe('B package');

    const own = await json(call('GET', `${SUP}/package?status=draft`, { token: b.token }));
    expect(own.body.items.map((e: any) => e.id)).toEqual([mine.body.id]);
  });

  it('transfer types and staff routes are off limits; an unlinked supplier is refused', async () => {
    const { token } = supplierA();
    expect((await call('GET', `${SUP}/transfer-zone`, { token })).status).toBe(403);
    expect((await call('GET', `${STAFF}/package`, { token })).status).toBe(403);
    const schema = await json(call('GET', `${SUP}/schema`, { token }));
    expect(schema.body.types.map((t: any) => t.type)).toEqual(['activity', 'package', 'hotel', 'restaurant']);
    const unlinked = signedIn('Supplier');
    expect((await call('GET', `${SUP}/package`, { token: unlinked.token })).status).toBe(403);
    const ops = signedIn('Operations');
    expect((await call('GET', `${SUP}/package`, { token: ops.token })).status).toBe(403);
  });
});

describe('supplier publish → review', () => {
  it('creates an approval; a second staff member approving publishes it', async () => {
    const { token, user } = supplierA();
    const c = await json(call('POST', `${SUP}/package`, { token, body: { title: T('Sinai week'), summary: T('Seven days'), images: [IMG], fields: { durationDays: 7, priceFromEGP: 20000, days: [{ day: 1, titleEn: 'Arrive', titleAr: 'الوصول' }] } } }));
    const pub = await json(call('POST', `${SUP}/package/${c.body.id}/publish`, { token, body: {} }));
    expect(pub.status, JSON.stringify(pub.body)).toBe(202);
    expect(pub.body.item.status).toBe('review');
    const approval = db.approvals.find(a => a.id === pub.body.approvalId)!;
    expect(approval).toMatchObject({ action: 'catalog.package.publish', status: 'pending', requestedBy: user.id });
    expect(db.tripPackages.find(p => p.id === c.body.id)!.status).toBe('review');

    const admin = signedIn('Admin');
    const decided = await json(call('POST', `/api/admin/approvals/${approval.id}/decide`, { token: admin.token, body: { decision: 'approve', note: 'looks good' } }));
    expect(decided.status, JSON.stringify(decided.body)).toBe(200);
    expect(decided.body.status).toBe('approved');
    expect(db.tripPackages.find(p => p.id === c.body.id)!.status).toBe('published');
  });

  it('an incomplete record is refused before any approval is queued', async () => {
    const { token } = supplierA();
    const c = await json(call('POST', `${SUP}/package`, { token, body: { title: T('Half done') } }));
    const pub = await json(call('POST', `${SUP}/package/${c.body.id}/publish`, { token, body: {} }));
    expect(pub.status).toBe(422);
    expect(db.approvals).toHaveLength(0);
  });

  it('a price change above 30% is queued, not applied; a small one applies', async () => {
    const { token } = supplierA();
    const c = await json(call('POST', `${SUP}/activity`, { token, body: { title: T('Shore dive'), fields: { category: 'diving', priceFromEGP: 1000 } } }));
    expect(c.body.supplierId).toBe('SUP-A');
    const small = await json(call('PATCH', `${SUP}/activity/${c.body.id}`, { token, body: { fields: { priceFromEGP: 1100 } } }));
    expect(small.status).toBe(200);
    expect(small.body.item.priceFromEGP).toBe(1100);
    const big = await json(call('PATCH', `${SUP}/activity/${c.body.id}`, { token, body: { fields: { priceFromEGP: 2000 } } }));
    expect(big.status).toBe(202);
    expect(big.body.item.priceFromEGP).toBe(1100);
    const approval = db.approvals.find(a => a.id === big.body.approvalId)!;
    expect(approval.action).toBe('catalog.activity.price');

    const admin = signedIn('Admin');
    await call('POST', `/api/admin/approvals/${approval.id}/decide`, { token: admin.token, body: { decision: 'approve' } });
    expect(db.activities.find(a => a.id === c.body.id)!.basePriceEGP).toBe(2000);
  });
});
