import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { rentalService } from '../../server/services/rentalService';
import { resetDb, seedRentalListing, seedTrip } from '../helpers/fixtures';
import type { RentalExtraEntity } from '../../server/db/schema';

/**
 * YYYY-MM-DD for today + offsetDays in LOCAL time — mirrors the service's
 * todayLocal() contract (rentalService). Pricing fixtures use dynamic dates
 * so the suite cannot rot when the calendar moves past a hardcoded date.
 */
const future = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
};

function seedExtra(over: Partial<RentalExtraEntity> = {}): RentalExtraEntity {
  const extra: RentalExtraEntity = {
    id: 'EXT-TEST-HLMT',
    listingId: 'RENT-TEST',
    name: 'Helmet',
    nameAr: 'خوذة',
    priceEGP: 50,
    pricingBasis: 'FLAT',
    active: true,
    ...over
  };
  db.rentalExtras.push(extra);
  return extra;
}

describe('rental pricing engine', () => {
  beforeEach(() => {
    resetDb();
    seedTrip();
  });

  it('prices a plain window as days × daily rate × quantity (no discount rules fire)', () => {
    // Two days keeps this under the multi-day discount threshold (>= 3).
    const listing = seedRentalListing(); // 300/day, qty 10
    const quote = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(1),
      quantity: 2
    });
    expect(quote.breakdown.baseEGP).toBe(300 * 2 * 2);
    expect(quote.breakdown.totalEGP).toBe(300 * 2 * 2);
    expect(quote.breakdown.days).toBe(2);
  });

  it('applies the weekly rate for 7-day spans and the daily remainder beyond', () => {
    // Multi-day discount disabled so the weekly math is isolated.
    const listing = seedRentalListing({ multiDayMinDays: undefined, multiDayDiscountPercent: undefined });

    const week = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(6),
      quantity: 1
    });
    expect(week.breakdown.baseEGP).toBe(1800);
    expect(week.breakdown.discountEGP).toBe(2100 - 1800); // vs 7 × 300

    const weekPlus = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(7),
      quantity: 1
    });
    expect(weekPlus.breakdown.baseEGP).toBe(1800 + 300);
  });

  it('stacks the multi-day discount on top of the weekly rate', () => {
    const listing = seedRentalListing(); // weekly 1800 AND >=3 days at 10%
    const week = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(6),
      quantity: 1
    });
    expect(week.breakdown.baseEGP).toBe(1620); // 1800 − 180
  });

  it('applies the multi-day discount on top (3+ days at 10%)', () => {
    const listing = seedRentalListing(); // multiDay ≥3 → 10%
    const three = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(2),
      quantity: 1
    });
    expect(three.breakdown.baseEGP).toBe(810); // 900 − 90
    expect(three.breakdown.discountEGP).toBe(90);

    // Discount scales with quantity.
    const threeForTwo = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(2),
      quantity: 2
    });
    expect(threeForTwo.breakdown.baseEGP).toBe(1620);
  });

  it('adds extras — FLAT once per booking, PER_DAY multiplied by span days', () => {
    const listing = seedRentalListing();
    seedExtra({ id: 'EXT-HLMT', name: 'Helmet', priceEGP: 50, pricingBasis: 'FLAT' });
    seedExtra({ id: 'EXT-CHLD', name: 'Child seat', priceEGP: 100, pricingBasis: 'PER_DAY' });

    const quote = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(2),
      quantity: 1,
      extraIds: ['EXT-HLMT', 'EXT-CHLD']
    });
    expect(quote.breakdown.extrasEGP).toBe(50 + 100 * 3);
    expect(quote.breakdown.totalEGP).toBe(quote.breakdown.baseEGP + quote.breakdown.extrasEGP);
    expect(quote.extras).toHaveLength(2);
    expect(quote.extras.find(e => e.extraId === 'EXT-CHLD')!.count).toBe(3);
  });

  it('rejects an unknown or foreign extra', () => {
    const listing = seedRentalListing();
    let status: number | undefined;
    try {
      rentalService.quote({
        listingId: listing.id,
        startDate: future(0),
        endDate: future(2),
        quantity: 1,
        extraIds: ['EXT-NOT-MINE']
      });
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(400);
  });

  it('adds the delivery zone fee and rejects unsupported zones', () => {
    const listing = seedRentalListing(); // deliveryZones: mashraba 0, assalah 100
    const delivered = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(1),
      quantity: 1,
      deliveryMode: 'DELIVERY',
      deliveryZoneId: 'assalah'
    });
    expect(delivered.breakdown.deliveryEGP).toBe(100);
    expect(delivered.breakdown.totalEGP).toBe(delivered.breakdown.baseEGP + 100);

    let status: number | undefined;
    try {
      rentalService.quote({
        listingId: listing.id,
        startDate: future(0),
        endDate: future(1),
        quantity: 1,
        deliveryMode: 'DELIVERY',
        deliveryZoneId: 'blue_hole'
      });
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(400);
  });

  it('shows the deposit separately — it is refundable and not part of the payable total', () => {
    const listing = seedRentalListing(); // deposit 500
    const quote = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(2),
      quantity: 1
    });
    expect(quote.breakdown.depositEGP).toBe(500);
    expect(quote.breakdown.totalEGP).toBe(quote.breakdown.baseEGP); // deposit excluded
  });

  it('snapshots the breakdown into a hold so checkout cannot be repriced', () => {
    const listing = seedRentalListing();
    seedExtra({ id: 'EXT-HLMT', name: 'Helmet', priceEGP: 50, pricingBasis: 'FLAT' });

    const { booking } = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      startDate: future(0),
      endDate: future(2),
      quantity: 2,
      extraIds: ['EXT-HLMT']
    });

    // Rate edited after the hold was taken — the snapshot must not move.
    listing.dailyRateEGP = 9999;
    const quote = rentalService.quote({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(2),
      quantity: 2,
      extraIds: ['EXT-HLMT']
    });
    expect(quote.breakdown.totalEGP).not.toBe(booking.priceBreakdown.totalEGP);
    // Snapshot: 3 days × 300 × 2 bikes = 1800, −10% multi-day = 1620, + helmet 50.
    expect(booking.priceBreakdown.totalEGP).toBe(1620 + 50);
  });
});