/** Unit coverage for the pure city-record mappers (server/services/cityRecord.ts). */
import { describe, expect, it } from 'vitest';
import {
  cityCenter,
  etagFor,
  findCitySeed,
  fullCityRecord,
  lightCity,
  swFrom,
} from '../../server/services/cityRecord';
import { CITIES_SEED, CitySeed } from '../../server/db/citiesSeed';

const dahab = () => findCitySeed('dahab') as CitySeed;
const sharm = () => findCitySeed('sharm') as CitySeed;

describe('findCitySeed', () => {
  it('normalizes case and whitespace', () => {
    expect(findCitySeed(' DAHAB ')?.slug).toBe('dahab');
    expect(findCitySeed('sharm')?.slug).toBe('sharm');
  });

  it('returns undefined for unlisted cities', () => {
    expect(findCitySeed('cairo')).toBeUndefined();
  });
});

describe('swFrom', () => {
  it('is the [abyss, salt, accent] triple sourced from chrome + swatch', () => {
    const seed = dahab();
    expect(swFrom(seed)).toEqual([seed.chrome.abyss, seed.chrome.salt, seed.swatch[0]]);
    expect(swFrom(seed)).toHaveLength(3);
  });
});

describe('cityCenter', () => {
  it('is the rounded bounds midpoint', () => {
    const seed = { ...dahab(), bounds: { latMin: 28.4, latMax: 28.6, lngMin: 34.45, lngMax: 34.58 } };
    expect(cityCenter(seed)).toEqual({ lat: 28.5, lng: 34.515 });
  });

  it('never fails without bounds (all 12 seeded rows carry them anyway)', () => {
    const plan = { ...dahab(), bounds: undefined };
    expect(cityCenter(plan as CitySeed)).toEqual({ lat: 0, lng: 0 });
  });

  it('is inside every city bounds box', () => {
    for (const seed of CITIES_SEED) {
      const { lat, lng } = cityCenter(seed);
      expect(lat).toBeGreaterThanOrEqual(seed.bounds!.latMin);
      expect(lat).toBeLessThanOrEqual(seed.bounds!.latMax);
      expect(lng).toBeGreaterThanOrEqual(seed.bounds!.lngMin);
      expect(lng).toBeLessThanOrEqual(seed.bounds!.lngMax);
    }
  });
});

describe('lightCity / fullCityRecord', () => {
  it('light records carry the bilingual sheet fields', () => {
    const light = lightCity(sharm());
    expect(light.id).toBe('sharm');
    expect(light.name).toEqual({ ar: 'شرم الشيخ', en: 'Sharm El Sheikh' });
    expect(light.vibe).toEqual({ ar: 'غوص وحياة ليلية', en: 'Diving and nightlife' });
    expect(light.catalogue).toBe('early');
    expect(light.sw).toHaveLength(3);
    expect(light.counts).toEqual({ features: 2778, sights: 158 });
  });

  it('full records add planner/transfer and prefer file counters', () => {
    const seed = sharm();
    const withFile = fullCityRecord(seed, { featureCount: 9999, tourismCount: 88 });
    expect(withFile.counts).toEqual({ features: 9999, sights: 88 });
    expect(withFile.planner).toEqual(seed.planner);
    expect(withFile.transfer).toEqual(seed.transfer);

    const withoutFile = fullCityRecord(seed, null);
    expect(withoutFile.counts).toEqual({ features: seed.featureCount, sights: seed.tourismCount });
  });
});

describe('etagFor', () => {
  it('is deterministic and contents-addressed', () => {
    const payload = { city: 'dahab', counts: 1 };
    expect(etagFor(payload)).toBe(etagFor({ city: 'dahab', counts: 1 }));
    expect(etagFor(payload)).toMatch(/^"[0-9a-f]{40}"$/);
    expect(etagFor(payload)).not.toBe(etagFor({ city: 'dahab', counts: 2 }));
  });
});
