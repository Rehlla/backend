import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import {
  enrichItinerary,
  enrichTripWithAvailability,
  resolveSkuPrice,
} from '../../server/services/availabilityJoinService';
import type { ProductSkuEntity, CommerceServiceType } from '../../server/db/schema';

/**
 * Availability-joined AI generation (blueprint §P, rule: "AI proposes only
 * what the ledger can sell").
 *
 * The AI prompt outputs draft prices; enrichItinerary must replace every
 * hallucinated number with the real database price and attach bookability —
 * and /api/trip/apply-ai persists through resolveSkuPrice so the client can
 * never smuggle a price or a SKU.
 */

const makeSku = (
  id: string,
  serviceType: CommerceServiceType,
  title: string,
  priceEGP: number,
  active = true
): ProductSkuEntity => ({
  id,
  supplierId: 'SUP-1',
  serviceType,
  title,
  titleAr: title,
  description: '',
  durationMinutes: 60,
  basePriceEGP: priceEGP,
  currency: 'EGP',
  maxCapacityPerSlot: 6,
  active,
  cancellationPolicyHours: 24,
});

const rawItinerary = {
  tripTitle: 'Reef & Canyon Escape',
  days: [
    {
      dayNumber: 1,
      title: 'Reef Day',
      activities: [
        {
          id: 'act-1-1',
          title: 'Lighthouse Sunset Snorkel',
          category: 'snorkel',
          timeSlot: '02:00 PM',
          estimatedPriceEGP: 999, // hallucinated — must never surface
        },
        {
          id: 'act-1-2',
          title: 'Yoga on the beach',
          category: 'relax',
          estimatedPriceEGP: 350, // no bookable SKU exists for relax
        },
      ],
    },
    {
      dayNumber: 2,
      title: 'Desert Day',
      activities: [
        {
          id: 'act-2-1',
          title: 'Blue Hole Diving',
          category: 'diving',
          estimatedPriceEGP: 800,
        },
      ],
    },
  ],
};

beforeEach(() => {
  // Fresh SKU universe per test.
  db.productSkus.splice(0, db.productSkus.length);
});

describe('enrichItinerary', () => {
  it('substitutes the real DB price and attaches skuId + bookability for matched SKUs', () => {
    db.productSkus.push(
      makeSku('SKU-SNORKEL-1', 'diving', 'Lighthouse Guided Snorkel Tour', 650),
      makeSku('SKU-DIVE-1', 'diving', 'Blue Hole Dive Day', 1400),
    );
    const trip = enrichItinerary(rawItinerary);
    const snorkel = trip.days[0].activities[0];
    expect(snorkel.priceEGP).toBe(650);
    expect(snorkel.bookable).toBe(true);
    expect(snorkel.skuId).toBe('SKU-SNORKEL-1');
    expect(snorkel.bookability?.basePriceEGP).toBe(650);
    // The AI's 999 never surfaces.
    expect(snorkel.priceEGP).not.toBe(999);
  });

  it('keeps AI estimates only as non-bookable budget items when no SKU exists', () => {
    db.productSkus.push(makeSku('SKU-DIVE-1', 'diving', 'Blue Hole Dive Day', 1400));
    const trip = enrichItinerary(rawItinerary);
    const yoga = trip.days[0].activities[1];
    expect(yoga.bookable).toBe(false);
    // No invented prices: an unsellable item carries 0, never the AI's guess.
    expect(yoga.priceEGP).toBe(0);
    expect(yoga.unbookableReason).toBe('no_active_sku');
    expect(yoga.skuId).toBeUndefined();
  });

  it('ignores inactive SKUs entirely', () => {
    db.productSkus.push(
      makeSku('SKU-SNORKEL-1', 'diving', 'Lighthouse Guided Snorkel Tour', 650, false),
      makeSku('SKU-DIVE-1', 'diving', 'Blue Hole Dive Day', 1400),
    );
    const trip = enrichItinerary(rawItinerary);
    expect(trip.days[0].activities[0].bookable).toBe(false);
  });

  it('maps AI categories onto the canonical service-type taxonomy', () => {
    // 'safari' and 'food' categories should reach 'safari'/'dining' SKUs;
    // a mismatched service type ('excursion') is deliberately not matched.
    db.productSkus.push(makeSku('SKU-EXC', 'safari', 'Wadi Gnai 4x4 Safari', 900));
    db.productSkus.push(makeSku('SKU-DIN', 'dining', 'Lighthouse Bay Seafood Dinner', 450));
    db.productSkus.push(makeSku('SKU-WRONG', 'rental', 'Beach Cruiser Bike', 300));
    const trip = enrichItinerary({
      days: [
        {
          dayNumber: 1,
          activities: [
            { id: 'a1', title: 'Canyon Safari Adventure', category: 'safari', estimatedPriceEGP: 111 },
            { id: 'a2', title: 'Seafood dinner at the promenade', category: 'food', estimatedPriceEGP: 222 },
          ],
        },
      ],
    });
    expect(trip.days[0].activities[0].bookable).toBe(true);
    expect(trip.days[0].activities[0].priceEGP).toBe(900);
    expect(trip.days[0].activities[1].bookable).toBe(true);
    expect(trip.days[0].activities[1].priceEGP).toBe(450);
  });

  it('totals only bookable prices and reports bookablePercent honestly', () => {
    db.productSkus.push(
      makeSku('SKU-SNORKEL-1', 'diving', 'Lighthouse Guided Snorkel Tour', 650),
      makeSku('SKU-DIVE-1', 'diving', 'Blue Hole Dive Day', 1400),
    );
    const trip = enrichItinerary(rawItinerary);
    // 3 activities, 2 bookable (650 + 1400 = 2050).
    expect(trip.days[0].dayTotalEGP).toBe(650);
    expect(trip.days[1].dayTotalEGP).toBe(1400);
    expect(trip.totalEstimatedEGP).toBe(2050);
    expect(trip.bookableCount).toBe(2);
    expect(trip.totalCount).toBe(3);
    expect(trip.bookablePercent).toBe(67);
  });

  it('preserves the raw itinerary alongside the enriched trip', () => {
    db.productSkus.push(makeSku('SKU-SNORKEL-1', 'diving', 'Lighthouse Guided Snorkel Tour', 650));
    const result = enrichTripWithAvailability(rawItinerary);
    expect(result.raw).toBe(rawItinerary);
    expect(result.enriched.days[0].activities[0].bookable).toBe(true);
  });
});

describe('resolveSkuPrice (apply-ai authority)', () => {
  it('returns the DB price for an active SKU', () => {
    db.productSkus.push(makeSku('SKU-DIVE-1', 'diving', 'Blue Hole Dive Day', 1400));
    expect(resolveSkuPrice('SKU-DIVE-1')).toEqual({ priceEGP: 1400, serviceType: 'diving' });
  });

  it('returns null for missing or inactive SKUs', () => {
    db.productSkus.push(makeSku('SKU-DIVE-1', 'diving', 'Blue Hole Dive Day', 1400, false));
    expect(resolveSkuPrice('SKU-DIVE-1')).toBeNull();
    expect(resolveSkuPrice('SKU-NOPE')).toBeNull();
    expect(resolveSkuPrice('')).toBeNull();
  });
});