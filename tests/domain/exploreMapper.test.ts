import { describe, expect, it } from 'vitest';
import { activityToNearMeItem } from '../../src/services/exploreMapper';
import type { DahabActivity, DahabPlace } from '../../src/shared';

/**
 * What an Explore card has to carry for the rest of the journey to work.
 *
 * The mapper used to read `basePriceEGP` only to pick a `$`/`$$`/`$$$` band and
 * then discard the number, along with the SKU. Everything added to a trip from
 * Explore therefore arrived with no price — which the server rejected outright,
 * "priceEGP must be greater than zero" — and no product, so even the ones that
 * saved could never be booked afterwards.
 */

const activity = (over: Partial<DahabActivity> = {}): DahabActivity => ({
  id: 'act_eel_garden_sunset_snorkel',
  titleEn: 'Eel Garden Sunset Guided Snorkel',
  titleAr: 'سنوركل الغروب في إيل جاردن',
  category: 'diving',
  placeId: 'place_eel_garden',
  areaId: 'eel_garden',
  durationMinutes: 45,
  accessMethod: 'SHORE',
  difficulty: 'Beginner',
  experienceLevelRequired: 'None',
  basePriceEGP: 450,
  bookingMode: 'REQUEST_NOW',
  seasonalityMonths: [1],
  preparationTips: [],
  preparationTipsAr: [],
  ...over
} as DahabActivity);

const noPlaces = new Map<string, DahabPlace>();

describe('activityToNearMeItem', () => {
  it('carries the price the corpus knows, instead of dropping it', () => {
    const item = activityToNearMeItem(activity(), noPlaces, false);
    expect(item.basePriceEGP).toBe(450);
  });

  it('prefers the SKU price, because that is what checkout charges', () => {
    const bookable = activity({
      id: 'act_blue_hole_safari_dive',
      basePriceEGP: 2200,
      bookable: {
        skuId: 'SKU-DIV-002',
        serviceType: 'diving',
        basePriceEGP: 3400,
        currency: 'EGP',
        supplierId: 'SUP-DIVE-02',
        maxCapacityPerSlot: 6
      }
    });

    const item = activityToNearMeItem(bookable, noPlaces, false);
    expect(item.basePriceEGP).toBe(3400);
    expect(item.skuId).toBe('SKU-DIV-002');
    expect(item.serviceType).toBe('diving');
  });

  it('leaves the product empty for something with no inventory behind it', () => {
    const item = activityToNearMeItem(activity(), noPlaces, false);
    expect(item.skuId).toBeUndefined();
    expect(item.serviceType).toBeUndefined();
  });

  it('still bands the price for display', () => {
    expect(activityToNearMeItem(activity({ basePriceEGP: 450 }), noPlaces, false).priceLevel).toBe('$');
    expect(activityToNearMeItem(activity({ basePriceEGP: 1400 }), noPlaces, false).priceLevel).toBe('$$');
    expect(activityToNearMeItem(activity({ basePriceEGP: 3400 }), noPlaces, false).priceLevel).toBe('$$$');
  });

  it('carries a genuinely free activity as zero rather than as nothing', () => {
    // A beach or a promenade walk costs nothing, and 0 is now a price the trip
    // endpoint accepts. Losing the field entirely is what it must not do.
    const item = activityToNearMeItem(activity({ basePriceEGP: 0 }), noPlaces, false);
    expect(item.basePriceEGP).toBe(0);
  });
});
