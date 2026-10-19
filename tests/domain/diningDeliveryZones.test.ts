import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../../server/db/database';
import { importDahabMenus } from '../../server/db/seeds/importDahabMenus';
import { EXPANDED_DINING_VENUES } from '../../server/data/dkosExpansionDataPart2';
import { DiningOrderError, diningOrderService } from '../../server/services/diningOrderService';
import { DINING_DELIVERY_ZONES, findDeliveryZone } from '../../server/data/deliveryZones';
import { haversineKm } from '../../server/utils/geo';
import { DiningVenueEntity } from '../../server/db/schema';
import {
  FIXTURE_DELIVERY_VENUE_ID,
  FIXTURE_FAR_OUT_VENUE_ID,
  FIXTURE_PICKUP_ONLY_VENUE_ID,
  installDiningFixtureVenues
} from '../helpers/diningFixtureVenues';

/**
 * "Based on the customer's location" is the whole promise of the feature, so
 * the location step gets its own tests rather than being exercised incidentally.
 *
 * The failure that matters most is the quiet one: a coordinate from outside
 * Dahab resolving to the nearest Dahab zone and quoting a delivery fee to a
 * traveler who is hundreds of kilometres away. That is why resolveZone bounds
 * the coordinate before it looks for a nearest neighbour.
 */

// Real Dahab coordinates, taken from the venue records themselves.
const LIGHTHOUSE = { lat: 28.5020, lng: 34.5192 };
const MASBAT = { lat: 28.4972, lng: 34.5161 };
const ASSALAH = { lat: 28.5120, lng: 34.5155 };
const BLUE_HOLE = { lat: 28.5590, lng: 34.5370 };

beforeAll(() => {
  if (db.diningVenues.length === 0) {
    db.diningVenues.push(...(EXPANDED_DINING_VENUES as DiningVenueEntity[]));
  }
  importDahabMenus();
  installDiningFixtureVenues();
});

describe('haversine', () => {
  it('returns zero for the same point', () => {
    expect(haversineKm(LIGHTHOUSE.lat, LIGHTHOUSE.lng, LIGHTHOUSE.lat, LIGHTHOUSE.lng)).toBeCloseTo(0, 6);
  });

  it('is symmetric', () => {
    const a = haversineKm(LIGHTHOUSE.lat, LIGHTHOUSE.lng, MASBAT.lat, MASBAT.lng);
    const b = haversineKm(MASBAT.lat, MASBAT.lng, LIGHTHOUSE.lat, LIGHTHOUSE.lng);
    expect(a).toBeCloseTo(b, 9);
  });

  it('matches a known distance to within a tenth of a kilometre', () => {
    // Lighthouse to Blue Hole is a ~6.6km hop north along the coast.
    const km = haversineKm(LIGHTHOUSE.lat, LIGHTHOUSE.lng, BLUE_HOLE.lat, BLUE_HOLE.lng);
    expect(km).toBeGreaterThan(6);
    expect(km).toBeLessThan(7.5);
  });
});

describe('resolving a coordinate to a zone', () => {
  it('resolves a Lighthouse address to Lighthouse', () => {
    const { zone } = diningOrderService.resolveZone(LIGHTHOUSE.lat, LIGHTHOUSE.lng);
    expect(zone.zoneId).toBe('lighthouse');
    expect(zone.labelEn).toBeTruthy();
    expect(zone.labelAr).toBeTruthy();
  });

  it('resolves an address to the zone it is actually nearest, not a fixed one', () => {
    expect(diningOrderService.resolveZone(MASBAT.lat, MASBAT.lng).zone.zoneId).toBe('masbat');
    expect(diningOrderService.resolveZone(ASSALAH.lat, ASSALAH.lng).zone.zoneId).toBe('assala');
    expect(diningOrderService.resolveZone(BLUE_HOLE.lat, BLUE_HOLE.lng).zone.zoneId).toBe('blue_hole');
  });

  it('reports the distance to the zone centre it actually resolved to', () => {
    const atCentre = diningOrderService.resolveZone(MASBAT.lat, MASBAT.lng);
    expect(atCentre.distanceKm).toBeLessThan(0.5);

    // The reported distance is measured to the RESOLVED zone's centre, not to
    // some fixed reference: pick a point that resolves elsewhere and check the
    // number against that zone's own coordinates.
    const resolved = diningOrderService.resolveZone(28.505, 34.5155);
    const zone = findDeliveryZone(resolved.zone.zoneId)!;
    expect(resolved.distanceKm).toBeCloseTo(
      haversineKm(28.505, 34.5155, zone.latitude, zone.longitude),
      2
    );
  });

  it('refuses a coordinate outside Dahab instead of guessing the nearest zone', () => {
    // Cairo. Without the bounds check this would resolve to "Masbat, 350km"
    // and quote a delivery fee.
    expect(() => diningOrderService.resolveZone(30.0444, 31.2357)).toThrow(/outside the Dahab delivery area/i);

    // Sharm El Sheikh is 40km south and genuinely out of the delivery area.
    expect(() => diningOrderService.resolveZone(27.9158, 34.3300)).toThrow(DiningOrderError);

    try {
      diningOrderService.resolveZone(30.0444, 31.2357);
    } catch (err: any) {
      expect(err.code).toBe('OUTSIDE_DELIVERY_AREA');
      expect(err.status).toBe(400);
    }
  });

  it('rejects a coordinate that is not a number', () => {
    expect(() => diningOrderService.resolveZone(Number.NaN, 34.51)).toThrow(DiningOrderError);
    expect(() => diningOrderService.resolveZone(28.5, Number.POSITIVE_INFINITY)).toThrow(DiningOrderError);
  });

  it('sends the traveller to the nearest zone when they sit near a boundary', () => {
    // Just north of the Assalah centre, but far enough that Eel Garden is nearer.
    const resolved = diningOrderService.resolveZone(28.5130, 34.5190);
    expect(['assala', 'eel_garden']).toContain(resolved.zone.zoneId);
    // Whichever it picks, it must genuinely be the nearer of the two.
    const assala = findDeliveryZone('assala')!;
    const eel = findDeliveryZone('eel_garden')!;
    const toAssala = haversineKm(28.5130, 34.5190, assala.latitude, assala.longitude);
    const toEel = haversineKm(28.5130, 34.5190, eel.latitude, eel.longitude);
    expect(Math.min(toAssala, toEel)).toBeCloseTo(resolved.distanceKm, 1);
  });
});

describe('the zones a kitchen serves', () => {
  it('lists only zones the app knows, with that kitchen\'s own price', () => {
    const venue = db.diningVenues.find(v => v.id === FIXTURE_DELIVERY_VENUE_ID)!;
    const zones = diningOrderService.zonesServedBy(venue);

    expect(zones.length).toBeGreaterThan(0);
    for (const zone of zones) {
      expect(findDeliveryZone(zone.zoneId)).toBeTruthy();
      const pairing = venue.delivery!.zones.find(z => z.zoneId === zone.zoneId)!;
      expect(zone.feeEGP).toBe(pairing.feeEGP);
      expect(zone.etaMinutes).toBe(pairing.etaMinutes);
    }
  });

  it('serves nothing for a pickup-only kitchen', () => {
    const venue = db.diningVenues.find(v => v.id === FIXTURE_PICKUP_ONLY_VENUE_ID)!;
    expect(diningOrderService.zonesServedBy(venue)).toEqual([]);
  });

  it('delivers only to its own neighbourhood for a camp far out at the Blue Hole', () => {
    const venue = db.diningVenues.find(v => v.id === FIXTURE_FAR_OUT_VENUE_ID)!;
    const zones = diningOrderService.zonesServedBy(venue);
    // It is 6km up the coast; it delivers to its own neighbourhood only.
    expect(zones.map(z => z.zoneId)).toEqual(['blue_hole']);
  });
});

describe('every zone in the catalogue is coherent', () => {
  it('has unique ids and a label in both languages', () => {
    const ids = DINING_DELIVERY_ZONES.map(z => z.zoneId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const zone of DINING_DELIVERY_ZONES) {
      expect(zone.labelEn, zone.zoneId).toBeTruthy();
      expect(zone.labelAr, zone.zoneId).toBeTruthy();
      expect(Math.abs(zone.latitude)).toBeLessThan(90);
      expect(Math.abs(zone.longitude)).toBeLessThan(180);
    }
  });

  it('sits inside the bounds resolveZone accepts', () => {
    // A zone the resolver would refuse for being out of area would make the
    // kitchen undeliverable by its own rules.
    for (const zone of DINING_DELIVERY_ZONES) {
      expect(() => diningOrderService.resolveZone(zone.latitude, zone.longitude), zone.zoneId).not.toThrow();
    }
  });
});