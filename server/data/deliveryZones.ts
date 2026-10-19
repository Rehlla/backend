/**
 * Dahab delivery geography.
 *
 * These zones exist because "deliver to the customer's location" needs a
 * priceable unit, and a raw lat/lng cannot carry one: the fee a kitchen
 * charges for a drop-off is a function of where the customer is relative to
 * THAT kitchen, not of where the customer is relative to town centre.
 *
 * So the split is deliberate:
 *   - this file owns GEOGRAPHY ONLY (where a zone is, what it is called);
 *   - the per-venue MENU SEED owns ECONOMICS (which zones that kitchen
 *     delivers to, for how much, and how long it takes).
 *
 * The five zones are the same Dahab NEIGHBOURHOODS the transfer catalogue
 * prices hops by (server/data/transferRoutes.ts DAHAB_ZONES), but they are
 * not the same coordinates, and that is deliberate.
 *
 * The transfer table places Assala in the southern valley (28.4700), because a
 * transfer is a road route and the road runs south. The dining corpus places
 * 'assalah' at 28.5120 — the uphill neighbourhood above Masbat, where Ralph's
 * and Yum Yum actually are. Copying the transfer coordinate here would have put
 * a kitchen's own doorstep 5km from its own delivery zone, so Assala is
 * anchored to where the kitchens are and a dinner ordered from Assalah is
 * priced as a short drop rather than a cross-town run.
 *
 * They are duplicated rather than imported because the two verticals price
 * different things off the same real-world places: a transfer hop is priced by
 * road distance and vehicle tier, a delivery is priced per zone. Coupling them
 * would mean a change to either catalogue silently repriced the other.
 *
 * What is NOT here, on purpose:
 *   - delivery fees and ETAs: those belong to the venue (see
 *     data/dahab_menus.json), because a kitchen 200m from Eel Garden and one
 *     6km away must not quote the same drop.
 *   - a maximum radius: that is a policy decision of the delivery service and
 *     is asserted (and tested) there, not baked into a coordinate table.
 */

export interface DiningDeliveryZone {
  zoneId: string;
  labelEn: string;
  labelAr: string;
  latitude: number;
  longitude: number;
  /** What THIS kitchen charges to drop here. Absent on the zone catalogue
   *  itself, where geography is known but the price is not. */
  feeEGP?: number;
  etaMinutes?: number;
}

export const DINING_DELIVERY_ZONES: DiningDeliveryZone[] = [
  {
    zoneId: 'eel_garden',
    labelEn: 'Eel Garden & Mashraba',
    labelAr: 'حديقة الأنقليس والمشربة',
    latitude: 28.5050,
    longitude: 34.5180
  },
  {
    zoneId: 'lighthouse',
    labelEn: 'Lighthouse',
    labelAr: 'الفانوس',
    latitude: 28.5020,
    longitude: 34.5192
  },
  {
    zoneId: 'masbat',
    labelEn: 'Masbat',
    labelAr: 'المشباط',
    latitude: 28.4972,
    longitude: 34.5161
  },
  {
    zoneId: 'lagoon',
    labelEn: 'Lagoon & South',
    labelAr: 'اللاجونا والجنوب',
    latitude: 28.4800,
    longitude: 34.5200
  },
  {
    zoneId: 'assala',
    labelEn: 'Assalah',
    labelAr: 'عسلة',
    latitude: 28.5120,
    longitude: 34.5155
  },
  {
    zoneId: 'blue_hole',
    labelEn: 'Blue Hole',
    labelAr: 'البحيرة الزرقاء',
    latitude: 28.5590,
    longitude: 34.5370
  }
];

const ZONE_BY_ID = new Map(DINING_DELIVERY_ZONES.map(zone => [zone.zoneId, zone]));

export function findDeliveryZone(zoneId: string): DiningDeliveryZone | undefined {
  return ZONE_BY_ID.get(zoneId);
}

/** Zone ids, for validating a seed file that names zones as plain strings. */
export const DELIVERY_ZONE_IDS: readonly string[] = DINING_DELIVERY_ZONES.map(z => z.zoneId);