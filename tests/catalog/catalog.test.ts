import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import { invalidatePermissionCache } from '../../server/services/permissionService';
import { caller, signedIn, type OpsTestServer } from '../ops/opsTestApp';
import { startCatalogApp, json, seedReference, IMG, T } from './catalogTestApp';

/**
 * /api/admin/catalog (docs/CATALOG_API_CONTRACT.md): schema, CRUD per type,
 * the completeness gate, If-Match, delete-in-use, rate and slot ranges.
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

const BASE = '/api/admin/catalog';

describe('schema', () => {
  it('Operations sees every type with sections, children and child item types', async () => {
    const { token } = signedIn('Operations');
    const r = await json(call('GET', `${BASE}/schema`, { token }));
    expect(r.status).toBe(200);
    const types = r.body.types.map((t: any) => t.type);
    expect(types).toEqual(['activity', 'package', 'transfer-zone', 'transfer-bus', 'transfer-driver', 'hotel', 'restaurant']);
    const hotel = r.body.types.find((t: any) => t.type === 'hotel');
    expect(hotel.label).toEqual({ en: 'Hotels & stays', ar: 'الفنادق والإقامات' });
    const fields = hotel.sections.flatMap((s: any) => s.fields);
    expect(fields.find((f: any) => f.key === 'title')).toMatchObject({ kind: 'i18nText', required: true });
    expect(fields.find((f: any) => f.key === 'area').options.map((o: any) => o.value)).toEqual(['lighthouse', 'mashraba']);
    expect(fields.find((f: any) => f.key === 'images')).toMatchObject({ kind: 'gallery', min: 1, max: 20 });
    expect(hotel.children).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'rooms', itemType: 'hotel-room' }),
      expect.objectContaining({ key: 'rates', kind: 'rateCalendar' }),
    ]));
    const room = r.body.itemTypes.find((t: any) => t.type === 'hotel-room');
    const roomKeys = room.sections.flatMap((s: any) => s.fields.map((f: any) => f.key));
    expect(roomKeys).toEqual(expect.arrayContaining(['images', 'amenities', 'priceFromEGP']));
  });

  it('Product sees only its four areas; a Traveler is refused', async () => {
    const { token } = signedIn('Product');
    const r = await json(call('GET', `${BASE}/schema`, { token }));
    expect(r.body.types.map((t: any) => t.type)).toEqual(['activity', 'package', 'hotel', 'restaurant']);
    const trav = signedIn('Traveler');
    expect((await call('GET', `${BASE}/schema`, { token: trav.token })).status).toBe(403);
    expect((await call('GET', `${BASE}/transfer-zone`, { token })).status).toBe(403);
  });
});

describe('CRUD per type', () => {
  const cases: [string, Record<string, unknown>, Record<string, unknown>][] = [
    ['activity', { title: T('Reef walk'), supplierId: 'SUP-A', fields: { category: 'diving', area: 'lighthouse', priceFromEGP: 900 } }, { fields: { durationMinutes: 90 } }],
    ['package', { title: T('Three days'), fields: { durationDays: 3, priceFromEGP: 5000 } }, { summary: T('Short break') }],
    ['transfer-zone', { title: T('Taba'), fields: { haul: 'long', priceFromEGP: 3000, distanceKm: 140 } }, { fields: { sharedEGP: 1200 } }],
    ['transfer-bus', { title: T('Go Bus'), fields: { priceFromEGP: 400, departLabel: '11:40 PM', seats: 10 } }, { fields: { seats: 12 } }],
    ['transfer-driver', { title: T('Salem Ahmed'), fields: { phone: '+201000000000', car: T('Toyota Hiace') } }, { fields: { plate: 'ABC 123' } }],
    ['hotel', { title: T('Blue Bay Inn'), supplierId: 'SUP-B', fields: { area: 'mashraba', priceFromEGP: 1500 } }, { fields: { amenities: ['wifi', 'pool'] } }],
    ['restaurant', { title: T('Sea Grill'), fields: { area: 'lighthouse', cuisine: ['seafood'] } }, { summary: T('Fish by the sea') }],
  ];

  it.each(cases)('%s: create (always draft) → get → patch → list', async (type, createBody, patchBody) => {
    const { token } = signedIn('Operations');
    const created = await json(call('POST', `${BASE}/${type}`, { token, body: { ...createBody, status: 'published' } }));
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const item = created.body;
    expect(item).toMatchObject({ type, status: 'draft', title: createBody.title });
    expect(item.completeness).toBeGreaterThanOrEqual(0);
    expect(item.completeness).toBeLessThanOrEqual(1);

    const got = await json(call('GET', `${BASE}/${type}/${encodeURIComponent(item.id)}`, { token }));
    expect(got.status).toBe(200);
    expect(got.headers.get('etag')).toBe(`"${item.updatedAt}"`);
    expect(got.body.item.id).toBe(item.id);

    const patched = await json(call('PATCH', `${BASE}/${type}/${encodeURIComponent(item.id)}`, { token, body: patchBody, headers: { 'if-match': `"${item.updatedAt}"` } }));
    expect(patched.status, JSON.stringify(patched.body)).toBe(200);
    expect(patched.body.item.updatedAt > item.updatedAt).toBe(true);
    for (const [k, v] of Object.entries((patchBody.fields as Record<string, unknown>) ?? {})) expect(patched.body.item.fields[k]).toEqual(v);

    const listed = await json(call('GET', `${BASE}/${type}?status=draft&q=${encodeURIComponent((createBody.title as any).en.slice(0, 4))}`, { token }));
    expect(listed.body.items.map((e: any) => e.id)).toContain(item.id);
    expect(listed.body).toHaveProperty('nextCursor');
    expect(listed.body.total).toBeGreaterThanOrEqual(1);

    // Every write is audited with before/after.
    const audit = db.auditEvents.filter(a => a.entityType === `catalog.${type}` && a.entityId === item.id).map(a => a.action);
    expect(audit).toEqual(expect.arrayContaining(['CATALOG_CREATE', 'CATALOG_UPDATE']));
  });

  it('rejects unknown fields and bad values with 400', async () => {
    const { token } = signedIn('Operations');
    const bad = await json(call('POST', `${BASE}/hotel`, { token, body: { title: T('X'), fields: { nope: 1 } } }));
    expect(bad.status).toBe(400);
    const bad2 = await json(call('POST', `${BASE}/hotel`, { token, body: { title: T('X'), fields: { area: 'atlantis' } } }));
    expect(bad2.status).toBe(400);
    const bad3 = await json(call('POST', `${BASE}/hotel`, { token, body: { title: T('X'), images: ['javascript:alert(1)'] } }));
    expect(bad3.status).toBe(400);
  });

  it('Product can draft but not publish', async () => {
    const { token } = signedIn('Product');
    const c = await json(call('POST', `${BASE}/package`, { token, body: { title: T('P') } }));
    expect(c.status).toBe(201);
    expect((await call('POST', `${BASE}/package/${c.body.id}/publish`, { token, body: {} })).status).toBe(403);
  });
});

async function completeHotel(token: string) {
  const c = await json(call('POST', `${BASE}/hotel`, { token, body: { title: T('Reef Lodge'), supplierId: 'SUP-B', fields: { area: 'lighthouse' } } }));
  return c.body;
}

describe('publish gate, If-Match, lifecycle', () => {
  it('422 incomplete lists the missing fields; completing then publishing flips the entity on', async () => {
    const { token } = signedIn('Operations');
    const h = await completeHotel(token);
    const r = await json(call('POST', `${BASE}/hotel/${h.id}/publish`, { token, body: {} }));
    expect(r.status).toBe(422);
    expect(r.body.type).toBe('https://dahab.travel/errors/incomplete');
    expect(r.body.missing).toEqual(expect.arrayContaining(['summary', 'priceFromEGP', 'images']));

    const p = await json(call('PATCH', `${BASE}/hotel/${h.id}`, { token, body: { summary: T('Quiet rooms'), images: [IMG], fields: { priceFromEGP: 1200, maxGuests: 2 } } }));
    expect(p.body.item.completeness).toBe(1);
    expect(p.body.item.coverImage).toBe(IMG);
    const ok = await json(call('POST', `${BASE}/hotel/${h.id}/publish`, { token, body: {} }));
    expect(ok.status).toBe(200);
    expect(ok.body.item.status).toBe('published');
    expect(db.accommodations.find(a => a.id === h.id)!.active).toBe(true);
    expect(db.accommodations.find(a => a.id === h.id)!.coverImageUrl).toBe(IMG);

    expect((await json(call('POST', `${BASE}/hotel/${h.id}/archive`, { token, body: {} }))).status).toBe(400);
    const arch = await json(call('POST', `${BASE}/hotel/${h.id}/archive`, { token, body: { reason: 'closed for season' } }));
    expect(arch.body.item.status).toBe('archived');
    expect(db.accommodations.find(a => a.id === h.id)!.active).toBe(false);
    expect((await json(call('POST', `${BASE}/hotel/${h.id}/publish`, { token, body: {} }))).status).toBe(409);
    const restored = await json(call('POST', `${BASE}/hotel/${h.id}/restore`, { token, body: {} }));
    expect(restored.body.item.status).toBe('draft');
    // Archived rows drop out of the default list.
    const list = await json(call('GET', `${BASE}/hotel?status=draft`, { token }));
    expect(list.body.items.some((e: any) => e.id === h.id)).toBe(true);
  });

  it('If-Match with a stale updatedAt answers 409 stale', async () => {
    const { token } = signedIn('Operations');
    const h = await completeHotel(token);
    const first = await json(call('PATCH', `${BASE}/hotel/${h.id}`, { token, body: { fields: { rooms: 4 } }, headers: { 'if-match': h.updatedAt } }));
    expect(first.status).toBe(200);
    const stale = await json(call('PATCH', `${BASE}/hotel/${h.id}`, { token, body: { fields: { rooms: 5 } }, headers: { 'if-match': `"${h.updatedAt}"` } }));
    expect(stale.status).toBe(409);
    expect(stale.body.type).toBe('https://dahab.travel/errors/stale');
    expect(stale.body.currentUpdatedAt).toBe(first.body.item.updatedAt);
  });

  it('a price change above 30% needs a reason', async () => {
    const { token } = signedIn('Operations');
    const h = await completeHotel(token);
    await call('PATCH', `${BASE}/hotel/${h.id}`, { token, body: { fields: { priceFromEGP: 1000 } } });
    const r = await json(call('PATCH', `${BASE}/hotel/${h.id}`, { token, body: { fields: { priceFromEGP: 2000 } } }));
    expect(r.status).toBe(400);
    expect(r.body.type).toBe('https://dahab.travel/errors/reason-required');
    const ok = await json(call('PATCH', `${BASE}/hotel/${h.id}`, { token, body: { fields: { priceFromEGP: 2000 }, reason: 'new season prices' } }));
    expect(ok.body.item.priceFromEGP).toBe(2000);
    expect(db.productSkus.find(s => s.id === db.accommodations.find(a => a.id === h.id)!.skuId)!.basePriceEGP).toBe(2000);
  });

  it('duplicate makes a new draft; bulk publishes and reports per id', async () => {
    const { token } = signedIn('Operations');
    const c = await json(call('POST', `${BASE}/package`, { token, body: { title: T('Desert'), summary: T('Sand'), images: [IMG], fields: { durationDays: 2, priceFromEGP: 3000, days: [{ day: 1, titleEn: 'Go', titleAr: 'يلا' }] } } }));
    const dup = await json(call('POST', `${BASE}/package/${c.body.id}/duplicate`, { token }));
    expect(dup.status).toBe(201);
    expect(dup.body).toMatchObject({ status: 'draft', title: { en: 'Desert (copy)' } });
    const incomplete = await json(call('POST', `${BASE}/package`, { token, body: { title: T('Empty') } }));
    const b = await json(call('POST', `${BASE}/package/bulk`, { token, body: { ids: [c.body.id, incomplete.body.id, 'PKG-NOPE'], action: 'publish', reason: 'launch' } }));
    expect(b.status).toBe(200);
    expect(b.body.succeeded).toBe(1);
    expect(b.body.results[1].error.status).toBe(422);
    expect(b.body.results[2].error.status).toBe(404);
    const price = await json(call('POST', `${BASE}/package/bulk`, { token, body: { ids: [c.body.id], action: 'price', value: { percent: 10 }, reason: 'inflation' } }));
    expect(price.body.results[0].ok).toBe(true);
    expect(db.tripPackages.find(p => p.id === c.body.id)!.startingPriceEGP).toBe(3300);
  });
});

describe('delete', () => {
  it('only unbooked drafts are hard-deleted; booked or published answer 409 in-use', async () => {
    const { token } = signedIn('Operations');
    const a = await json(call('POST', `${BASE}/activity`, { token, body: { title: T('Canyon dive'), supplierId: 'SUP-A', fields: { category: 'diving', priceFromEGP: 800 } } }));
    const skuId = db.activities.find(x => x.id === a.body.id)!.skuId!;
    expect(skuId).toBeTruthy();
    db.bookings.push({ id: 'BK-1', skuId, supplierId: 'SUP-A' } as any);
    expect((await json(call('DELETE', `${BASE}/activity/${a.body.id}`, { token, body: {} }))).status).toBe(400);
    const inUse = await json(call('DELETE', `${BASE}/activity/${a.body.id}`, { token, body: { reason: 'clean up' } }));
    expect(inUse.status).toBe(409);
    expect(inUse.body.type).toBe('https://dahab.travel/errors/in-use');

    const p = await json(call('POST', `${BASE}/package`, { token, body: { title: T('Throwaway') } }));
    const del = await json(call('DELETE', `${BASE}/package/${p.body.id}`, { token, body: { reason: 'typo record' } }));
    expect(del.status).toBe(200);
    expect(db.tripPackages.some(x => x.id === p.body.id)).toBe(false);
    expect(db.catalogMeta.some(m => m.entityId === p.body.id)).toBe(false);

    const z = await json(call('POST', `${BASE}/transfer-zone`, { token, body: { title: T('Nuweiba'), fields: { priceFromEGP: 1000, distanceKm: 80 } } }));
    await call('POST', `${BASE}/transfer-zone/${z.body.id}/publish`, { token, body: {} });
    const pub = await json(call('DELETE', `${BASE}/transfer-zone/${z.body.id}`, { token, body: { reason: 'clean up' } }));
    expect(pub.status).toBe(409);
  });
});

describe('children', () => {
  it('hotel rooms: create with images and amenities, patch, delete', async () => {
    const { token } = signedIn('Operations');
    const h = await completeHotel(token);
    const room = await json(call('POST', `${BASE}/hotel/${h.id}/rooms`, { token, body: { title: T('Sea view double'), images: [IMG], fields: { code: 'SEA', priceFromEGP: 1800, totalUnits: 3, amenities: ['balcony'] } } }));
    expect(room.status, JSON.stringify(room.body)).toBe(201);
    expect(room.body).toMatchObject({ type: 'hotel-room', images: [IMG], fields: { amenities: ['balcony'] } });
    const rt = db.roomTypes.find(r => r.id === room.body.id)!;
    expect(rt.supplierId).toBe('SUP-B');
    expect(db.productSkus.some(s => s.id === rt.skuId && s.pricingBasis === 'per_night')).toBe(true);
    const p = await json(call('PATCH', `${BASE}/hotel/${h.id}/rooms/${room.body.id}`, { token, body: { images: [IMG, '/images/hotels/x.jpg'], fields: { amenities: ['balcony', 'wifi'] } } }));
    expect(p.body.item.images).toHaveLength(2);
    expect(db.roomTypes.find(r => r.id === room.body.id)!.amenities).toEqual(['balcony', 'wifi']);
    const detail = await json(call('GET', `${BASE}/hotel/${h.id}`, { token }));
    expect(detail.body.children.rooms.map((r: any) => r.id)).toEqual([room.body.id]);
    const del = await json(call('DELETE', `${BASE}/hotel/${h.id}/rooms/${room.body.id}`, { token, body: { reason: 'wrong room' } }));
    expect(del.status).toBe(200);
    expect(db.roomTypes.some(r => r.id === room.body.id)).toBe(false);
  });

  it('restaurant menu items', async () => {
    const { token } = signedIn('Operations');
    const v = await json(call('POST', `${BASE}/restaurant`, { token, body: { title: T('Cafe'), fields: { area: 'lighthouse' } } }));
    const m = await json(call('POST', `${BASE}/restaurant/${v.body.id}/menu`, { token, body: { title: T('Falafel'), fields: { section: 'street_food', priceEGP: 60 } } }));
    expect(m.status).toBe(201);
    const off = await json(call('PATCH', `${BASE}/restaurant/${v.body.id}/menu/${m.body.id}`, { token, body: { fields: { available: false } } }));
    expect(off.body.item.status).toBe('hidden');
    expect(off.body.item.fields).toMatchObject({ section: 'street_food', priceEGP: 60, available: false });
    expect(off.body.item.priceFromEGP).toBe(60);
  });
});

describe('rate calendar', () => {
  it('PUT applies a price to the weekdays in an inclusive range; GET reads it back', async () => {
    const { token } = signedIn('Operations');
    const h = await completeHotel(token);
    const room = await json(call('POST', `${BASE}/hotel/${h.id}/rooms`, { token, body: { title: T('Double'), fields: { code: 'DBL', priceFromEGP: 1000, totalUnits: 2 } } }));
    // 2026-11-01 is a Sunday; Fri+Sat in 1..14 Nov = 6, 7, 13, 14.
    const put = await json(call('PUT', `${BASE}/hotel/${h.id}/rates`, { token, body: { roomId: room.body.id, from: '2026-11-01', to: '2026-11-14', nightlyEGP: 1200, weekdays: [5, 6] } }));
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(put.body.applied).toBe(4);
    expect(db.roomRateNights.filter(n => n.roomTypeId === room.body.id).map(n => n.date).sort()).toEqual(['2026-11-06', '2026-11-07', '2026-11-13', '2026-11-14']);

    const closed = await json(call('PUT', `${BASE}/hotel/${h.id}/rates`, { token, body: { roomId: room.body.id, from: '2026-11-10', to: '2026-11-10', closed: true, reason: 'maintenance' } }));
    expect(closed.body.applied).toBe(1);

    const got = await json(call('GET', `${BASE}/hotel/${h.id}/rates?roomId=${room.body.id}&from=2026-11-05&to=2026-11-10`, { token }));
    const byDate = Object.fromEntries(got.body.nights.map((n: any) => [n.date, n]));
    expect(byDate['2026-11-05']).toMatchObject({ nightlyEGP: 1000, closed: false });
    expect(byDate['2026-11-06']).toMatchObject({ nightlyEGP: 1200, closed: false });
    expect(byDate['2026-11-10']).toMatchObject({ closed: true });

    const big = await json(call('PUT', `${BASE}/hotel/${h.id}/rates`, { token, body: { roomId: room.body.id, from: '2026-11-01', to: '2026-11-02', nightlyEGP: 5000 } }));
    expect(big.status).toBe(400);
    const tooLong = await json(call('PUT', `${BASE}/hotel/${h.id}/rates`, { token, body: { roomId: room.body.id, from: '2026-01-01', to: '2027-01-03', nightlyEGP: 1000 } }));
    expect(tooLong.status).toBe(400);
  });
});

describe('activity departures', () => {
  it('PUT opens slots per weekday/time, respects bookings, and closes them', async () => {
    const { token } = signedIn('Operations');
    const a = await json(call('POST', `${BASE}/activity`, { token, body: { title: T('Night dive'), supplierId: 'SUP-A', fields: { category: 'diving', priceFromEGP: 1000 } } }));
    const put = await json(call('PUT', `${BASE}/activity/${a.body.id}/slots`, { token, body: { from: '2026-11-01', to: '2026-11-07', times: ['08:30', '14:00'], capacity: 6, weekdays: [1, 3] } }));
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(put.body).toMatchObject({ created: 4, dates: 2 });
    const skuId = db.activities.find(x => x.id === a.body.id)!.skuId!;
    const monday = db.inventorySlots.find(s => s.skuId === skuId && s.date === '2026-11-02' && s.timeSlot === '08:30 AM')!;
    expect(monday.totalCapacity).toBe(6);
    monday.reservedCapacity = 2;

    const closed = await json(call('PUT', `${BASE}/activity/${a.body.id}/slots`, { token, body: { from: '2026-11-02', to: '2026-11-02', times: ['08:30'], capacity: 0, closed: true } }));
    expect(closed.body).toMatchObject({ updated: 1, created: 0 });
    expect(monday.totalCapacity).toBe(2);
    expect(monday.status).toBe('SOLD_OUT');

    const got = await json(call('GET', `${BASE}/activity/${a.body.id}/slots?from=2026-11-02&to=2026-11-02`, { token }));
    expect(got.body.items).toHaveLength(2);
    expect(got.body.items[0].fields).toMatchObject({ time: '08:30', capacity: 2, reserved: 2 });
    const booked = await json(call('DELETE', `${BASE}/activity/${a.body.id}/slots/${monday.id}`, { token, body: { reason: 'remove it' } }));
    expect(booked.status).toBe(409);
  });
});

describe('stream', () => {
  it('writes emit CatalogItemChanged events', async () => {
    const { staffEventStream } = await import('../../server/services/staffEventStream');
    const { token } = signedIn('Operations');
    const lastId = staffEventStream.since(0).at(-1)?.id ?? 0;
    await call('POST', `${BASE}/package`, { token, body: { title: T('Stream me') } });
    const events = staffEventStream.since(lastId);
    expect(events.some(e => e.data.type === 'CatalogItemChanged' && e.data.entityType === 'catalog.package')).toBe(true);
  });
});
