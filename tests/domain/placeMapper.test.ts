import { describe, expect, it } from 'vitest';
import {
  DAHAB_CENTRE,
  bearingLabel,
  buildMapPlaces,
  distanceKm,
  mapCategoryOf,
  projectToIllustration,
  toMappedPlace
} from '../../src/services/placeMapper';
import type { DahabPlace } from '../../src/shared';

/**
 * Both maps shipped their own hardcoded spot list — 12 in one, 8 in the other —
 * while /api/dahab/places held 17 real records, and neither map had ever called
 * it. The two lists disagreed with each other and with the corpus.
 */

const place = (over: Partial<DahabPlace> = {}): DahabPlace => ({
  id: 'place_blue_hole',
  nameEn: 'The Blue Hole',
  nameAr: 'البلو هول',
  aliases: [],
  arabicNames: [],
  areaId: 'blue_hole',
  category: 'Dive Site',
  coordinates: { lat: 28.5721, lng: 34.5372 },
  operationalStatus: 'ACTIVE',
  descriptionEn: 'A submarine sinkhole north of town.',
  descriptionAr: 'حفرة بحرية شمال البلد.',
  verifiedAt: '2026-08-20T00:00:00Z',
  ...over
});

describe('distance', () => {
  it('computes a real great-circle distance rather than repeating a written one', () => {
    // The Blue Hole is about 8 km north of the town centre; the hardcoded list
    // said "8.5 km North" beside coordinates that were never used to check it.
    const km = distanceKm(DAHAB_CENTRE, { lat: 28.5721, lng: 34.5372 });
    expect(km).toBeGreaterThan(7);
    expect(km).toBeLessThan(9);
  });

  it('is zero for the same point', () => {
    expect(distanceKm(DAHAB_CENTRE, DAHAB_CENTRE)).toBe(0);
  });

  it('is symmetric', () => {
    const a = { lat: 28.41, lng: 34.42 };
    const b = { lat: 28.645, lng: 34.58 };
    expect(distanceKm(a, b)).toBe(distanceKm(b, a));
  });
});

describe('bearing', () => {
  it('names the direction from the coordinates', () => {
    expect(bearingLabel(DAHAB_CENTRE, { lat: 28.60, lng: 34.5136 }).en).toBe('North');
    expect(bearingLabel(DAHAB_CENTRE, { lat: 28.40, lng: 34.5136 }).en).toBe('South');
    expect(bearingLabel(DAHAB_CENTRE, { lat: 28.60, lng: 34.58 }).en).toBe('North-East');
  });

  it('calls a point at the origin central rather than picking a direction', () => {
    expect(bearingLabel(DAHAB_CENTRE, DAHAB_CENTRE).en).toBe('Central');
  });
});

describe('projecting onto the illustrated map', () => {
  it('puts a northern place above a southern one', () => {
    const north = projectToIllustration({ lat: 28.645, lng: 34.5 });
    const south = projectToIllustration({ lat: 28.41, lng: 34.5 });
    // Percent from the top, so north is the smaller number.
    expect(north.latPct).toBeLessThan(south.latPct);
  });

  it('puts an eastern place to the right of a western one', () => {
    const east = projectToIllustration({ lat: 28.5, lng: 34.58 });
    const west = projectToIllustration({ lat: 28.5, lng: 34.42 });
    expect(east.lngPct).toBeGreaterThan(west.lngPct);
  });

  it('keeps every marker inside the illustration', () => {
    // A coordinate outside the drawn bounds must not render off-canvas.
    for (const coords of [{ lat: 30, lng: 36 }, { lat: 27, lng: 33 }]) {
      const p = projectToIllustration(coords);
      expect(p.latPct).toBeGreaterThanOrEqual(4);
      expect(p.latPct).toBeLessThanOrEqual(96);
      expect(p.lngPct).toBeGreaterThanOrEqual(4);
      expect(p.lngPct).toBeLessThanOrEqual(96);
    }
  });
});

describe('categories', () => {
  it.each([
    ['Dive Site / Beach', 'Dive Site'],
    ['Marine Protected Area', 'Dive Site'],
    ['Eco Sanctuary / Kitesurf Lagoon', 'Beach & Lagoon'],
    ['Desert Oasis / Climbing Crags', 'Desert Valley'],
    ['Promenade / Bazaar', 'Café & Dining']
  ])('maps the corpus category %s onto %s', (corpus, expected) => {
    expect(mapCategoryOf(place({ category: corpus })).en).toBe(expected);
  });
});

describe('building the map', () => {
  it('carries the record’s own description and verification date', () => {
    const mapped = toMappedPlace(place());
    expect(mapped.description).toBe('A submarine sinkhole north of town.');
    expect(mapped.verifiedAt).toBe('2026-08-20T00:00:00Z');
  });

  it('leaves out records that are not destinations', () => {
    // The corpus includes a highway checkpoint and a transport hub, which exist
    // for routing and safety, not for visiting.
    const result = buildMapPlaces([
      place(),
      place({ id: 'p2', category: 'Highway / Security Checkpoint', nameEn: 'Checkpoint' })
    ]);
    expect(result.map(r => r.id)).toEqual(['place_blue_hole']);
  });

  it('leaves out a suspended record rather than sending a traveler to it', () => {
    const result = buildMapPlaces([place({ operationalStatus: 'SUSPENDED' })]);
    expect(result).toHaveLength(0);
  });

  it('orders by real distance, nearest first', () => {
    const near = place({ id: 'near', coordinates: { lat: 28.505, lng: 34.514 } });
    const far = place({ id: 'far', coordinates: { lat: 28.645, lng: 34.58 } });
    expect(buildMapPlaces([far, near]).map(r => r.id)).toEqual(['near', 'far']);
  });

  it('says "in town" instead of a misleadingly precise distance', () => {
    const mapped = toMappedPlace(place({ coordinates: { lat: 28.5029, lng: 34.5137 } }));
    expect(mapped.distance).toBe('In town');
  });

  it('leaves out a record the pipeline could not position', () => {
    // The research import creates dive sites from text (importResearch.ts), so
    // /api/dahab/places carries records with coordinates: null. A map cannot
    // place those — and must not crash on them.
    const result = buildMapPlaces([place(), place({ id: 'nowhere', coordinates: null })]);
    expect(result.map(r => r.id)).toEqual(['place_blue_hole']);
  });

  it('leaves out a record with unusable coordinates', () => {
    const result = buildMapPlaces([
      place(),
      place({ id: 'broken', coordinates: { lat: NaN, lng: 34.5 } })
    ]);
    expect(result.map(r => r.id)).toEqual(['place_blue_hole']);
  });
});
