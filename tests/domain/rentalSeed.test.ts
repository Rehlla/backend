import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { importDahabRentals } from '../../server/db/seeds/importDahabRentals';
import { resolveBookability } from '../../server/services/bookabilityReconciler';
import { resetDb } from '../helpers/fixtures';

describe('dahab rentals catalogue', () => {
  beforeEach(() => {
    resetDb();
  });

  it('seeds the catalogue with one ' + "'rental'" + ' SKU and extras per listing', () => {
    const result = importDahabRentals();

    expect(result.success).toBe(true);
    expect(result.rentalsCount).toBe(6);
    expect(db.rentalListings.length).toBe(6);
    expect(db.rentalBookings).toHaveLength(0);

    const rentalSuppliers = db.suppliers.filter(s => s.category === 'bike_rental');
    expect(rentalSuppliers.length).toBe(2);

    const rentalSkus = db.productSkus.filter(s => s.serviceType === 'rental');
    expect(rentalSkus.length).toBe(6);
    for (const sku of rentalSkus) {
      expect(sku.basePriceEGP).toBeGreaterThan(0);
      expect(sku.maxCapacityPerSlot).toBeGreaterThan(0);
    }

    for (const listing of db.rentalListings) {
      const sku = db.productSkus.find(s => s.id === listing.skuId);
      expect(sku, `${listing.name} has a rental SKU`).toBeDefined();
      expect(sku!.basePriceEGP).toBe(listing.dailyRateEGP);
      expect(sku!.maxCapacityPerSlot).toBe(listing.quantity);
      expect(db.rentalExtras.filter(e => e.listingId === listing.id).length).toBeGreaterThan(0);
    }
  });

  it('leaves contact fields off the suppliers — booking goes through the platform', () => {
    importDahabRentals();
    for (const supplier of db.suppliers.filter(s => s.category === 'bike_rental')) {
      expect(supplier.phone).toBeUndefined();
      expect(supplier.email).toBeUndefined();
      expect(supplier.whatsapp).toBeUndefined();
    }
  });

  it('does not pre-seed inventory day-slots: they materialise on hold', () => {
    importDahabRentals();
    const rentalSlots = db.inventorySlots.filter(
      s => (db.productSkus.find(k => k.id === s.skuId)?.serviceType) === 'rental'
    );
    expect(rentalSlots).toHaveLength(0);
  });

  it('every catalogued listing resolves to sellable inventory', () => {
    importDahabRentals();
    for (const listing of db.rentalListings) {
      const bookable = resolveBookability(listing.skuId);
      expect(bookable, `${listing.name} is bookable`).not.toBeNull();
      expect(bookable!.serviceType).toBe('rental');
    }
  });

  it('is idempotent: a second run updates in place, never duplicates', () => {
    const first = importDahabRentals();
    expect(first.rentalsCreated).toBe(6);

    const second = importDahabRentals();
    expect(second.rentalsCreated).toBe(0);
    expect(second.rentalsUpdated).toBe(6);
    expect(second.suppliersCreated).toBe(0);
    expect(second.skusCreated).toBe(0);
    expect(db.rentalListings.length).toBe(6);
    expect(db.productSkus.filter(s => s.serviceType === 'rental')).toHaveLength(6);
    expect(db.suppliers.filter(s => s.category === 'bike_rental')).toHaveLength(2);

    // The catalogue copy keeps its original createdAt across the update.
    const firstListing = db.rentalListings[0];
    firstListing.createdAt = '2020-01-01T00:00:00.000Z';
    const third = importDahabRentals();
    expect(third.rentalsUpdated).toBe(6);
    expect(db.rentalListings[0].createdAt).toBe('2020-01-01T00:00:00.000Z');
  });
});