import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { backfillRoomTypes } from '../../server/db/seeds/backfillRoomTypes';
import { resetDb } from '../helpers/fixtures';
import type { AccommodationEntity } from '../../server/db/schema';

/**
 * Guards the backfill that gives every property a sellable room type.
 *
 * This is the migration that decides which of the catalogue's properties a
 * traveller can actually book, so the cases below are the ones that would be
 * expensive to get wrong: a property with no known room count must not become
 * bookable by guesswork, a Tripadvisor placeholder capacity must not present
 * itself as fact, and a re-run must never stamp a seed placeholder back over a
 * capacity an admin has already verified.
 */
describe('room type backfill', () => {
  beforeEach(() => {
    resetDb();
  });

  const accommodation = (over: Partial<AccommodationEntity>): AccommodationEntity => ({
    id: 'ACC-TEST-01',
    slug: 'test-stay',
    name: 'Test Stay',
    nameAr: 'إقامة اختبارية',
    propertyType: 'hotel',
    category: 'mid-range',
    priceBand: 'moderate',
    areaId: 'masbat',
    area: 'masbat',
    areaName: 'Masbat',
    areaNameAr: 'مصبط',
    rating: 4.5,
    reviewCount: 120,
    typeChips: [],
    typeChipsAr: [],
    tagline: 'A test stay',
    taglineAr: 'إقامة اختبارية',
    description: 'A test stay.',
    descriptionAr: 'إقامة اختبارية.',
    amenities: [],
    amenitiesAr: [],
    perNightEGP: 900,
    packageNights: 5,
    rooms: 12,
    maxGuests: 3,
    bestFor: 'Testing',
    bestForAr: 'للاختبار',
    note: '',
    noteAr: '',
    skuId: 'SKU-ACC-TEST-01',
    active: true,
    featured: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  const run = (accommodations: AccommodationEntity[]) => {
    db.accommodations.push(...accommodations);
    return backfillRoomTypes();
  };

  it('creates one room type per active property, carrying the property rate as the nightly rate', () => {
    run([accommodation({ id: 'ACC-A', skuId: 'SKU-ACC-A' }), accommodation({ id: 'ACC-B', skuId: 'SKU-ACC-B' })]);

    expect(db.roomTypes.length).toBe(2);
    const a = db.roomTypes.find(r => r.id === 'RT-ACC-A');
    expect(a).toBeDefined();
    expect(a!.accommodationId).toBe('ACC-A');
    expect(a!.baseNightlyEGP).toBe(900);
    expect(a!.totalUnits).toBe(12);
    expect(a!.active).toBe(true);
    // One room type, one SKU, priced by the night — that pairing is what lets a
    // stay be quoted for its length rather than a fixed package.
    expect(a!.skuId).toBe('SKU-RT-ACC-A');
    const sku = db.productSkus.find(s => s.id === 'SKU-RT-ACC-A');
    expect(sku).toBeDefined();
    expect(sku!.pricingBasis).toBe('per_night');
    expect(sku!.basePriceEGP).toBe(900);
    expect(sku!.maxCapacityPerSlot).toBe(12);
  });

  it('leaves a property with no room count unsellable rather than guessing a capacity', () => {
    const result = run([
      accommodation({ id: 'ACC-KNOWN', rooms: 20, skuId: 'SKU-ACC-KNOWN' }),
      // rooms: 0 is what 636 live properties carry. It means "unknown", not "empty",
      // and copying it through as zero is the whole point of this case.
      accommodation({ id: 'ACC-UNKNOWN', rooms: 0, skuId: 'SKU-ACC-UNKNOWN' }),
      accommodation({ id: 'ACC-NAN', rooms: Number.NaN, skuId: 'SKU-ACC-NAN' }),
    ]);

    expect(result.unsellable).toBe(2);

    const unknown = db.roomTypes.find(r => r.id === 'RT-ACC-UNKNOWN');
    expect(unknown!.totalUnits).toBe(0);
    expect(unknown!.active).toBe(false);
    const nan = db.roomTypes.find(r => r.id === 'RT-ACC-NAN');
    expect(nan!.totalUnits).toBe(0);
    expect(nan!.active).toBe(false);

    // Neither may be reachable through the commerce kernel either.
    for (const rt of [unknown!, nan!]) {
      const sku = db.productSkus.find(s => s.id === rt.skuId);
      expect(sku, `${rt.id} has a nightly SKU`).toBeDefined();
      expect(sku!.active, `${rt.id}'s SKU is not sellable`).toBe(false);
      expect(sku!.maxCapacityPerSlot).toBe(0);
    }
  });

  it('marks a Tripadvisor-derived capacity as an estimate, never as fact', () => {
    run([
      // The Tripadvisor importer hardcodes rooms: 10 — a placeholder, not a count.
      accommodation({ id: 'ACCTA-999', ratingSource: 'Tripadvisor', rooms: 10, skuId: 'SKU-ACCTA-999' }),
      // A curated row that genuinely reports ten rooms is a published figure.
      accommodation({ id: 'ACC-CURATED', ratingSource: 'Booking.com', rooms: 10, skuId: 'SKU-ACC-CURATED' }),
    ]);

    expect(db.roomTypes.find(r => r.id === 'RT-ACCTA-999')!.inventorySource).toBe('TRIPADVISOR_ESTIMATE');
    expect(db.roomTypes.find(r => r.id === 'RT-ACC-CURATED')!.inventorySource).toBe('SEED_PUBLISHED');
    expect(db.roomTypes.every(r => r.inventorySource !== 'ADMIN_VERIFIED')).toBe(true);
  });

  it('is idempotent: a second run updates in place and never duplicates', () => {
    run([accommodation({ id: 'ACC-A', skuId: 'SKU-ACC-A' })]);
    const first = db.roomTypes.length;
    const skuCount = db.productSkus.filter(s => s.id === 'SKU-RT-ACC-A').length;

    const second = backfillRoomTypes();

    expect(second.created).toBe(0);
    expect(second.updated).toBe(1);
    expect(db.roomTypes.length).toBe(first);
    expect(db.productSkus.filter(s => s.id === 'SKU-RT-ACC-A').length).toBe(skuCount);
  });

  it('never reverts a capacity an admin has verified back to the seed placeholder', () => {
    run([accommodation({ id: 'ACC-A', rooms: 10, skuId: 'SKU-ACC-A' })]);

    const rt = db.roomTypes[0];
    rt.totalUnits = 25;
    rt.inventorySource = 'ADMIN_VERIFIED';
    rt.baseNightlyEGP = 1450;
    db.productSkus.find(s => s.id === rt.skuId)!.basePriceEGP = 1450;

    // The catalogue re-imports the property with its (still placeholder) rooms: 10.
    backfillRoomTypes();

    expect(rt.totalUnits).toBe(25);
    expect(rt.inventorySource).toBe('ADMIN_VERIFIED');
    expect(rt.baseNightlyEGP).toBe(1450);
    expect(db.productSkus.find(s => s.id === rt.skuId)!.basePriceEGP).toBe(1450);
  });

  it('respects a corrected capacity on a re-run without losing the active flag', () => {
    run([accommodation({ id: 'ACC-A', rooms: 0, skuId: 'SKU-ACC-A' })]);
    expect(db.roomTypes[0].active).toBe(false);

    // An admin learns the real count and fixes the catalogue row itself.
    db.accommodations[0].rooms = 7;
    backfillRoomTypes();

    expect(db.roomTypes[0].totalUnits).toBe(7);
    expect(db.roomTypes[0].active).toBe(true);
    expect(db.productSkus.find(s => s.id === db.roomTypes[0].skuId)!.active).toBe(true);
  });

  it('skips inactive properties entirely', () => {
    run([accommodation({ id: 'ACC-OFF', active: false, rooms: 30, skuId: 'SKU-ACC-OFF' })]);
    expect(db.roomTypes.find(r => r.id === 'RT-ACC-OFF')).toBeUndefined();
    expect(db.productSkus.find(s => s.id === 'SKU-RT-ACC-OFF')).toBeUndefined();
  });

  it('reuses the fulfilment supplier of the property it belongs to', () => {
    db.productSkus.push({
      id: 'SKU-ACC-A',
      supplierId: 'SUP-HTL-01',
      serviceType: 'hotel',
      title: 'Package',
      titleAr: 'باقة',
      description: 'Legacy package SKU.',
      basePriceEGP: 4500,
      currency: 'EGP',
      maxCapacityPerSlot: 10,
      active: true,
      cancellationPolicyHours: 48,
    });
    run([accommodation({ id: 'ACC-A', skuId: 'SKU-ACC-A' })]);

    expect(db.roomTypes[0].supplierId).toBe('SUP-HTL-01');
    expect(db.productSkus.find(s => s.id === 'SKU-RT-ACC-A')!.supplierId).toBe('SUP-HTL-01');
  });
});

/**
 * The whole catalogue, through the real importers.
 *
 * Structural invariants rather than hardcoded counts: the seed files are
 * committed and change without warning, and what must hold is not "581 rows"
 * but "every active property has exactly one room type, and only the ones with
 * a real capacity are sellable".
 */
describe('room type backfill over the full catalogue', () => {
  beforeEach(() => {
    resetDb();
  });

  it('covers every active property, and sells only what has a capacity', async () => {
    const { importDahabAccommodations } = await import('../../server/db/seeds/importDahabAccommodations');
    const { importDahabTripadvisorStays } = await import('../../server/db/seeds/importDahabTripadvisorStays');
    importDahabAccommodations();
    importDahabTripadvisorStays();

    const active = db.accommodations.filter(a => a.active);
    const result = backfillRoomTypes();

    expect(result.total).toBe(active.length);
    expect(db.roomTypes.length).toBe(active.length);
    expect(new Set(db.roomTypes.map(r => r.id)).size).toBe(active.length);

    // Every sellable room type corresponds to a property that reported a capacity.
    const withCapacity = active.filter(a => Number(a.rooms) > 0);
    expect(db.roomTypes.filter(r => r.active).length).toBe(withCapacity.length);
    expect(result.unsellable).toBe(active.length - withCapacity.length);

    // A sellable room type is reachable through a sellable nightly SKU.
    for (const rt of db.roomTypes.filter(r => r.active)) {
      const sku = db.productSkus.find(s => s.id === rt.skuId);
      expect(sku, `${rt.id} has a nightly SKU`).toBeDefined();
      expect(sku!.pricingBasis).toBe('per_night');
      expect(sku!.active).toBe(true);
      expect(sku!.maxCapacityPerSlot).toBe(rt.totalUnits);
    }

    // And the legacy package SKUs were not touched — the backfill is additive.
    const legacyHotelSkus = db.productSkus.filter(
      s => s.serviceType === 'hotel' && !s.id.startsWith('SKU-RT-')
    );
    expect(legacyHotelSkus.length).toBeGreaterThan(0);
    expect(legacyHotelSkus.every(s => s.pricingBasis !== 'per_night')).toBe(true);
  });

  it('is idempotent across a full re-run', async () => {
    const { importDahabAccommodations } = await import('../../server/db/seeds/importDahabAccommodations');
    const { importDahabTripadvisorStays } = await import('../../server/db/seeds/importDahabTripadvisorStays');
    importDahabAccommodations();
    importDahabTripadvisorStays();

    backfillRoomTypes();
    const afterFirst = db.roomTypes.length;
    const skuSnapshot = db.productSkus.length;

    const second = backfillRoomTypes();
    expect(second.created).toBe(0);
    expect(db.roomTypes.length).toBe(afterFirst);
    expect(db.productSkus.length).toBe(skuSnapshot);
  });
});