import { db } from '../../server/db/database';
import type { DiningMenuItemEntity, DiningVenueEntity } from '../../server/db/schema';

/**
 * Test-only kitchens covering delivery policies the live menu seed no longer
 * carries: a delivering cafe with a minimum order, a pickup-only grill and a
 * camp 6km out that drops to its own neighbourhood only.
 *
 * The seed (data/dahab_menus.json) is curated content and shrinks or grows
 * with the business; the order rules these venues exercise must not depend on
 * which real restaurants happen to be listed this week.
 *
 * Call AFTER importDahabMenus(): the importer prunes dishes of venues it does
 * not know, so installing first would see these menus removed.
 */
export const FIXTURE_DELIVERY_VENUE_ID = 'dining_fixture_delivery_cafe';
export const FIXTURE_PICKUP_ONLY_VENUE_ID = 'dining_fixture_pickup_grill';
export const FIXTURE_FAR_OUT_VENUE_ID = 'dining_fixture_blue_hole_camp';

const baseVenue = {
  cuisine: ['Test Kitchen'],
  priceBand: 'Budget ($)' as const,
  dietaryOptions: { vegan: true, vegetarian: true, halal: true, freshSeafoodCatch: false },
  wifiNomadFriendly: false,
  openingHours: '08:00 - 23:00 Daily',
  bookingEligibility: 'WALK_IN' as const
};

const FIXTURE_VENUES: DiningVenueEntity[] = [
  {
    ...baseVenue,
    id: FIXTURE_DELIVERY_VENUE_ID,
    slug: 'fixture-delivery-cafe',
    nameEn: 'Fixture Delivery Cafe',
    nameAr: 'مقهى توصيل تجريبي',
    areaId: 'masbat',
    coordinates: { lat: 28.5008, lng: 34.5182 },
    prepMinutes: 12,
    delivery: {
      acceptsDelivery: true,
      minOrderEGP: 100,
      serviceFeePercent: 0,
      zones: [
        { zoneId: 'masbat', feeEGP: 15, etaMinutes: 6 },
        { zoneId: 'lighthouse', feeEGP: 20, etaMinutes: 10 },
        { zoneId: 'eel_garden', feeEGP: 25, etaMinutes: 14 },
        { zoneId: 'lagoon', feeEGP: 35, etaMinutes: 20 }
      ]
    }
  },
  {
    ...baseVenue,
    id: FIXTURE_PICKUP_ONLY_VENUE_ID,
    slug: 'fixture-pickup-grill',
    nameEn: 'Fixture Pickup Grill',
    nameAr: 'مشويات استلام تجريبية',
    areaId: 'masbat',
    prepMinutes: 25,
    delivery: { acceptsDelivery: false, minOrderEGP: 0, serviceFeePercent: 0, zones: [] }
  },
  {
    ...baseVenue,
    id: FIXTURE_FAR_OUT_VENUE_ID,
    slug: 'fixture-blue-hole-camp',
    nameEn: 'Fixture Blue Hole Camp',
    nameAr: 'مخيم بلو هول تجريبي',
    areaId: 'blue_hole',
    prepMinutes: 35,
    delivery: {
      acceptsDelivery: true,
      minOrderEGP: 150,
      serviceFeePercent: 0,
      zones: [{ zoneId: 'blue_hole', feeEGP: 20, etaMinutes: 10 }]
    }
  }
];

function dish(id: string, venueId: string, priceEGP: number, sortOrder: number): DiningMenuItemEntity {
  return {
    id,
    venueId,
    nameEn: `Fixture dish ${id}`,
    nameAr: `طبق تجريبي ${id}`,
    category: 'mains',
    priceEGP,
    dietary: [],
    available: true,
    sortOrder
  };
}

const FIXTURE_ITEMS: DiningMenuItemEntity[] = [
  dish('FX-DC-01', FIXTURE_DELIVERY_VENUE_ID, 60, 1),
  dish('FX-DC-02', FIXTURE_DELIVERY_VENUE_ID, 180, 2),
  dish('FX-PG-01', FIXTURE_PICKUP_ONLY_VENUE_ID, 60, 1),
  dish('FX-PG-02', FIXTURE_PICKUP_ONLY_VENUE_ID, 380, 2),
  dish('FX-BH-01', FIXTURE_FAR_OUT_VENUE_ID, 20, 1),
  dish('FX-BH-02', FIXTURE_FAR_OUT_VENUE_ID, 380, 2)
];

/** Idempotent: safe to call from several suites sharing one in-memory store. */
export function installDiningFixtureVenues(): void {
  for (const venue of FIXTURE_VENUES) {
    const index = db.diningVenues.findIndex(v => v.id === venue.id);
    if (index === -1) db.diningVenues.push({ ...venue });
    else db.diningVenues[index] = { ...venue };
  }
  for (const item of FIXTURE_ITEMS) {
    const index = db.diningMenuItems.findIndex(m => m.id === item.id);
    if (index === -1) db.diningMenuItems.push({ ...item });
    else db.diningMenuItems[index] = { ...item };
  }
}
