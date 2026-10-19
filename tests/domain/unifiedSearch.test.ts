import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { resetDb } from '../helpers/fixtures';
import {
  unifiedSearchEngine,
  toSearchResultItems,
} from '../../server/services/unifiedSearchEngine';

function seedCatalog() {
  db.productSkus.push({
    id: 'SKU-SEARCH-TEST',
    supplierId: 'SUP-TEST',
    serviceType: 'diving',
    title: 'Test Dive',
    titleAr: 'غطسة اختبارية',
    description: 'Fixture.',
    basePriceEGP: 1500,
    currency: 'EGP',
    maxCapacityPerSlot: 6,
    active: true,
    cancellationPolicyHours: 24,
  } as any);
  db.activities.push({
    id: 'ACT-SEARCH-DIVE',
    skuId: 'SKU-SEARCH-TEST',
    titleEn: 'Test Reef Dive',
    titleAr: 'غطسة تجريبية',
    category: 'diving',
    placeId: 'place_lighthouse_reef',
    areaId: 'lighthouse',
    durationMinutes: 50,
    accessMethod: 'SHORE',
    difficulty: 'Beginner',
    experienceLevelRequired: 'None',
    basePriceEGP: 1500,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-TEST',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {},
    dependencies: [],
    preparationTips: [],
    preparationTipsAr: [],
    travelerFitPersonas: [],
  } as any);
  db.activities.push({
    id: 'ACT-SEARCH-WALK',
    titleEn: 'Sunset Walk',
    titleAr: 'تمشية الغروب',
    category: 'culture',
    placeId: 'place_lighthouse_reef',
    areaId: 'lighthouse',
    durationMinutes: 60,
    accessMethod: 'WALK',
    difficulty: 'Beginner',
    experienceLevelRequired: 'None',
    basePriceEGP: 0,
    bookingMode: 'DISCOVER_ONLY',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {},
    dependencies: [],
    preparationTips: [],
    preparationTipsAr: [],
    travelerFitPersonas: [],
  } as any);
}

beforeEach(() => {
  resetDb();
  seedCatalog();
});

describe('unified search availability + explanations', () => {
  it('attaches sellable-product truth to each recommendation', () => {
    const result = unifiedSearchEngine.search('diving near lighthouse', 10);
    expect(result.recommendations.length).toBeGreaterThan(0);
    const dive = result.recommendations.find(r => r.activity.id === 'ACT-SEARCH-DIVE')!;
    expect(dive).toBeDefined();
    expect(dive.booking).toEqual({ bookable: true, priceEGP: 1500, currency: 'EGP' });
    const walk = result.recommendations.find(r => r.activity.id === 'ACT-SEARCH-WALK')!;
    expect(walk.booking).toBeNull();
  });

  it('carries the ranker explanation on every recommendation', () => {
    const result = unifiedSearchEngine.search('diving', 10);
    for (const rec of result.recommendations) {
      expect(typeof rec.whyMatched.primaryReasonEn).toBe('string');
      expect(rec.whyMatched.primaryReasonEn.length).toBeGreaterThan(0);
      expect(typeof rec.whyMatched.primaryReasonAr).toBe('string');
    }
  });

  it('flattens recommendations to the drawer wire shape with why + availability', () => {
    const result = unifiedSearchEngine.search('diving near lighthouse', 10);
    const items = toSearchResultItems(result.recommendations);
    expect(items.length).toBeGreaterThan(0);
    const dive = items.find(i => i.id === 'ACT-SEARCH-DIVE')!;
    expect(dive).toMatchObject({
      type: 'activity',
      name: 'Test Reef Dive',
      nameAr: 'غطسة تجريبية',
      bookable: true,
      priceEGP: 1500,
    });
    expect(dive.whyEn.length).toBeGreaterThan(0);
    expect(dive.whyAr.length).toBeGreaterThan(0);
    expect(typeof dive.score).toBe('number');
    const walk = items.find(i => i.id === 'ACT-SEARCH-WALK')!;
    expect(walk.bookable).toBe(false);
  });

  it('deduplicates repeated ids across activities and dining', () => {
    const result = unifiedSearchEngine.search('diving and food', 10);
    const items = toSearchResultItems(result.recommendations);
    const keys = items.map(i => `${i.type}:${i.id}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('emits follow-up suggestions from parsed interests', () => {
    // Route-level shape is asserted here via the engine contract the route
    // spreads: parsedIntent.interests feeds `suggestions`.
    const result = unifiedSearchEngine.search('diving and seafood dinner', 3);
    expect(result.parsedIntent.interests).toContain('diving');
    expect(result.parsedIntent.interests).toContain('food');
  });

  it('reports matched:false instead of fabricating results for gibberish', () => {
    // Zero-result recovery: input with no intent tokens and no lexical
    // overlap must return empty recommendations, not a fake top-3.
    const result = unifiedSearchEngine.search('zzzqqx fake gibberish', 3);
    expect(result.matched).toBe(false);
    expect(result.recommendations).toEqual([]);
  });

  it('matches specific catalog names lexically even without intent words', () => {
    // "Test Reef Dive" is the seeded activity title; no intent token in the
    // query, but the lexical gate must still find it.
    const result = unifiedSearchEngine.search('reef', 10);
    expect(result.matched).toBe(true);
    expect(result.recommendations.some(r => r.activity.id === 'ACT-SEARCH-DIVE')).toBe(true);
  });

  it('keeps intent-only queries matched (diving without any catalog word)', () => {
    const result = unifiedSearchEngine.search('diving', 10);
    expect(result.matched).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
