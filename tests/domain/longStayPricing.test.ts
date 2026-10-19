import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import { computeDurationPrice, hasLongStayPricing, getLongStayAccommodations, computeLongStaySavings } from '../../server/services/longStayService';
import type { AccommodationEntity } from '../../server/db/schema';

function makeAccommodation(overrides: Partial<AccommodationEntity> = {}): AccommodationEntity {
  return {
    id: 'ACC-TEST',
    slug: 'test-acc',
    name: 'Test Place',
    nameAr: 'مكان اختبار',
    propertyType: 'apartment',
    category: 'mid-range',
    priceBand: 'moderate',
    areaId: 'AREA-1',
    area: 'dahab-old-town',
    areaName: 'Old Town',
    areaNameAr: 'المدينة القديمة',
    rating: 4.5,
    reviewCount: 10,
    typeChips: ['wifi'],
    typeChipsAr: ['واي فاي'],
    tagline: 'Cozy apartment',
    taglineAr: 'شقة مريحة',
    description: 'A nice place',
    descriptionAr: 'مكان جميل',
    amenities: ['wifi'],
    amenitiesAr: ['واي فاي'],
    perNightEGP: 500,
    packageNights: 1,
    rooms: 1,
    maxGuests: 2,
    bestFor: 'Couples',
    bestForAr: 'الأزواج',
    note: 'Nice',
    noteAr: 'جميل',
    skuId: 'SKU-TEST',
    active: true,
    featured: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('longStayService', () => {
  beforeEach(() => {
    const adapter = new InMemoryPersistenceAdapter();
    db.setAdapter(adapter);
  });

  describe('computeDurationPrice', () => {
    it('computes flat daily pricing when no weekly/monthly rates set', () => {
      const acc = makeAccommodation({ perNightEGP: 500 });
      const result = computeDurationPrice(acc, 5);
      expect(result.totalEGP).toBe(2500);
      expect(result.monthlyBlocks).toBe(0);
      expect(result.weeklyBlocks).toBe(0);
      expect(result.remainderNights).toBe(5);
    });

    it('applies weekly rate for 7+ nights when weeklyRateEGP is set', () => {
      const acc = makeAccommodation({ perNightEGP: 500, weeklyRateEGP: 3000 });
      const result = computeDurationPrice(acc, 7);
      expect(result.weeklyBlocks).toBe(1);
      expect(result.remainderNights).toBe(0);
      expect(result.totalEGP).toBe(3000);
    });

    it('applies weekly + remainder for 10 nights', () => {
      const acc = makeAccommodation({ perNightEGP: 500, weeklyRateEGP: 3000 });
      const result = computeDurationPrice(acc, 10);
      expect(result.weeklyBlocks).toBe(1);
      expect(result.remainderNights).toBe(3);
      expect(result.totalEGP).toBe(3000 + 1500); // 4500
    });

    it('applies monthly rate for 28+ nights when monthlyRateEGP is set', () => {
      const acc = makeAccommodation({ perNightEGP: 500, monthlyRateEGP: 10000 });
      const result = computeDurationPrice(acc, 28);
      expect(result.monthlyBlocks).toBe(1);
      expect(result.remainderNights).toBe(0);
      expect(result.totalEGP).toBe(10000);
    });

    it('applies monthly + weekly + remainder for 40 nights', () => {
      const acc = makeAccommodation({ perNightEGP: 500, weeklyRateEGP: 3000, monthlyRateEGP: 10000 });
      const result = computeDurationPrice(acc, 40);
      // 28 (monthly) + 7 (weekly) + 5 (daily)
      expect(result.monthlyBlocks).toBe(1);
      expect(result.weeklyBlocks).toBe(1);
      expect(result.remainderNights).toBe(5);
      expect(result.totalEGP).toBe(10000 + 3000 + 2500); // 15500
    });

    it('applies monthly rate even without weekly rate', () => {
      const acc = makeAccommodation({ perNightEGP: 500, monthlyRateEGP: 10000 });
      const result = computeDurationPrice(acc, 35);
      // 28 (monthly) + 7 (daily since no weekly)
      expect(result.monthlyBlocks).toBe(1);
      expect(result.weeklyBlocks).toBe(0);
      expect(result.remainderNights).toBe(7);
      expect(result.totalEGP).toBe(10000 + 3500); // 13500
    });

    it('does not apply weekly rate for < 7 nights', () => {
      const acc = makeAccommodation({ perNightEGP: 500, weeklyRateEGP: 3000 });
      const result = computeDurationPrice(acc, 6);
      expect(result.weeklyBlocks).toBe(0);
      expect(result.totalEGP).toBe(3000);
    });

    it('does not apply monthly rate for < 28 nights', () => {
      const acc = makeAccommodation({ perNightEGP: 500, monthlyRateEGP: 10000 });
      const result = computeDurationPrice(acc, 27);
      expect(result.monthlyBlocks).toBe(0);
      expect(result.totalEGP).toBe(13500);
    });

    it('rounds to nearest integer', () => {
      const acc = makeAccommodation({ perNightEGP: 333, weeklyRateEGP: 2100 });
      const result = computeDurationPrice(acc, 10);
      expect(result.totalEGP).toBe(Math.round(2100 + 3 * 333));
    });

    it('throws for 0 nights', () => {
      const acc = makeAccommodation();
      expect(() => computeDurationPrice(acc, 0)).toThrow('at least 1 night');
    });
  });

  describe('hasLongStayPricing', () => {
    it('returns false when neither weekly nor monthly rate set', () => {
      expect(hasLongStayPricing(makeAccommodation())).toBe(false);
    });
    it('returns true when weekly rate set', () => {
      expect(hasLongStayPricing(makeAccommodation({ weeklyRateEGP: 3000 }))).toBe(true);
    });
    it('returns true when monthly rate set', () => {
      expect(hasLongStayPricing(makeAccommodation({ monthlyRateEGP: 10000 }))).toBe(true);
    });
  });

  describe('getLongStayAccommodations', () => {
    it('returns only accommodations with long-stay pricing', () => {
      db.accommodations.push(makeAccommodation({ id: 'ACC-1', weeklyRateEGP: 3000 }));
      db.accommodations.push(makeAccommodation({ id: 'ACC-2' }));
      const results = getLongStayAccommodations();
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('ACC-1');
    });

    it('filters by areaId when provided', () => {
      db.accommodations.push(makeAccommodation({ id: 'ACC-1', areaId: 'A1', weeklyRateEGP: 3000 }));
      db.accommodations.push(makeAccommodation({ id: 'ACC-2', areaId: 'A2', weeklyRateEGP: 3000 }));
      const results = getLongStayAccommodations('A1');
      expect(results).toHaveLength(1);
      expect(results[0].areaId).toBe('A1');
    });
  });

  describe('computeLongStaySavings', () => {
    it('returns null when no long-stay pricing', () => {
      expect(computeLongStaySavings(makeAccommodation(), 10)).toBeNull();
    });

    it('computes savings vs flat daily rate', () => {
      const acc = makeAccommodation({ perNightEGP: 500, weeklyRateEGP: 3000 });
      const savings = computeLongStaySavings(acc, 7);
      expect(savings).not.toBeNull();
      expect(savings!.dailyTotalEGP).toBe(3500);
      expect(savings!.longStayTotalEGP).toBe(3000);
      expect(savings!.savingsEGP).toBe(500);
      expect(savings!.savingsPercent).toBe(Math.round((500 / 3500) * 100));
    });

    it('returns null when weekly rate is more expensive (no savings)', () => {
      const acc = makeAccommodation({ perNightEGP: 100, weeklyRateEGP: 1000 });
      const savings = computeLongStaySavings(acc, 7);
      expect(savings).toBeNull();
    });
  });

  describe('a property sold by room type', () => {
    it("quotes the long-stay line from the cheapest room type, the same rates checkout charges", () => {
      const acc = makeAccommodation({ perNightEGP: 900, monthlyRateEGP: 9000 });
      const base = {
        accommodationId: acc.id, skuId: 'SKU-RT', supplierId: 'SUP-1', code: 'STD', nameAr: 'غرفة',
        maxGuestsPerUnit: 2, minNights: 1, maxNights: 60, cancellationPolicyHours: 48, totalUnits: 1,
        inventorySource: 'SEED_PUBLISHED' as const, amenities: [], images: [], displayOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      };
      db.roomTypes.push(
        { ...base, id: 'RT-SEA', name: 'Sea view', baseNightlyEGP: 800, monthlyRateEGP: 15000, active: true },
        { ...base, id: 'RT-GARDEN', name: 'Garden', baseNightlyEGP: 500, weeklyRateEGP: 3000, active: true },
        { ...base, id: 'RT-OFF', name: 'Retired', baseNightlyEGP: 100, active: false },
      );

      const breakdown = computeDurationPrice(acc, 10);
      expect(breakdown.perNightEGP).toBe(500);
      expect(breakdown.weeklyBlocks).toBe(1);
      expect(breakdown.totalEGP).toBe(3000 + 3 * 500);
      expect(computeLongStaySavings(acc, 7)!.longStayTotalEGP).toBe(3000);
    });
  });
});
