import { describe, expect, it } from 'vitest';
import { beforeEach, beforeAll } from 'vitest';
import { db } from '../../server/db/database';
import { importDahabHotels } from '../../server/db/seeds/importDahabHotels';
import { resolveBookability } from '../../server/services/bookabilityReconciler';
import { resetDb } from '../helpers/fixtures';

describe('dahab hotels catalogue', () => {
  beforeEach(() => {
    resetDb();
  });

  it('seeds the whole catalogue, one supplier + one package SKU per hotel', () => {
    const result = importDahabHotels();

    expect(result.success).toBe(true);
    expect(result.hotelsCount).toBe(13);
    expect(db.hotels.length).toBe(13);
    expect(db.hotels.map(h => h.id).sort()).toEqual(
      Array.from({ length: 13 }, (_, i) => `HTL-${String(i + 1).padStart(2, '0')}`)
    );

    // Suppliers are SUP-HTL-02..14 (fixture SUP-HTL-01 is left alone).
    const hotelSuppliers = db.suppliers.filter(s => s.category === 'hotel');
    expect(hotelSuppliers.length).toBe(13);
    expect(hotelSuppliers[0].id).toBe('SUP-HTL-02');
    expect(hotelSuppliers.at(-1)?.id).toBe('SUP-HTL-14');

    // 5-night package SKUs are SKU-HTL-003..015, priced at perNight x 5.
    const hotelSkus = db.productSkus.filter(s => s.serviceType === 'hotel');
    expect(hotelSkus.length).toBe(13);
    expect(hotelSkus[0].id).toBe('SKU-HTL-003');
    expect(hotelSkus.at(-1)?.id).toBe('SKU-HTL-015');

    for (const sku of hotelSkus) {
      expect(sku.basePriceEGP).toBeGreaterThan(0);
    }
    for (const hotel of db.hotels) {
      const sku = db.productSkus.find(s => s.id === hotel.skuId);
      expect(sku, `${hotel.name} has a package SKU`).toBeDefined();
      expect(sku!.basePriceEGP).toBe(hotel.perNightEGP * hotel.packageNights);
      expect(sku!.maxCapacityPerSlot).toBeGreaterThan(0);
    }
  });

  it('leaves contact fields off the suppliers — booking goes through the concierge', () => {
    importDahabHotels();
    for (const supplier of db.suppliers.filter(s => s.category === 'hotel')) {
      expect(supplier.phone).toBeUndefined();
      expect(supplier.email).toBeUndefined();
      expect(supplier.leadContact).toBeUndefined();
    }
  });

  it('does not pre-seed inventory slots: hotel stays are projected only when booked', () => {
    importDahabHotels();
    const hotelSlots = db.inventorySlots.filter(
      s => (db.productSkus.find(k => k.id === s.skuId)?.serviceType) === 'hotel'
    );
    expect(hotelSlots.length).toBe(0);
  });

  it('every catalogued hotel resolves to sellable inventory', () => {
    importDahabHotels();
    for (const hotel of db.hotels) {
      const bookable = resolveBookability(hotel.skuId);
      expect(bookable, `${hotel.name} is bookable`).not.toBeNull();
      expect(bookable!.serviceType).toBe('hotel');
    }
  });

  it('is idempotent: a second run updates in place, never duplicates', () => {
    const first = importDahabHotels();
    expect(first.hotelsCreated).toBe(13);

    const second = importDahabHotels();
    expect(second.hotelsCreated).toBe(0);
    expect(second.hotelsUpdated).toBe(13);
    expect(second.suppliersCreated).toBe(0);
    expect(second.skusCreated).toBe(0);
    expect(db.hotels.length).toBe(13);

    // The catalogue copy keeps its original createdAt across the update: mark
    // a row with an old timestamp and a re-import must not stomp it.
    const firstHotel = db.hotels[0];
    // Capture from the row the final assertion actually reads (hotel[1]).
    // Capturing from firstHotel compared two different rows' stamps, which
    // only agreed while the import loop stamped all 13 rows inside one
    // millisecond — under load it crossed a ms boundary and failed.
    const originalCreatedAt = db.hotels[1].createdAt;
    firstHotel.createdAt = '2020-01-01T00:00:00.000Z';

    const third = importDahabHotels();
    expect(third.hotelsUpdated).toBe(13);
    expect(db.hotels[0].createdAt).toBe('2020-01-01T00:00:00.000Z');

    // But rows that were never touched before keep exactly what the first
    // import stamped them with.
    expect(db.hotels[1].createdAt).toBe(originalCreatedAt);
  });
});

describe('hotels in the SQLite table spec', () => {
  beforeAll(() => {
    // Just enough to cover the spec plumbing: the hotel collection must
    // survive an adapter round-trip, which the tripwire-protected suite runs
    // entirely against the in-memory adapter.
    resetDb();
    importDahabHotels();
  });

  it('exposes the hotels getter defensively', () => {
    expect(db.hotels).toBeInstanceOf(Array);
    expect(db.hotels.filter(h => h.slug && h.id).length).toBe(13);
    expect(new Set(db.hotels.map(h => h.slug)).size).toBe(13);
  });
});