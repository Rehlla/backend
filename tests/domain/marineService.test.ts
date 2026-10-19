import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  marineService,
  assessActivity,
  isWaterActivity,
} from '../../server/services/marineService';

/**
 * Modeled sea state carries the strictest honesty rule in this product
 * (see marineService.ts): model output labeled as model, verdicts only from
 * written thresholds, null — never a calm-sea fabrication — on failure.
 */

const modelPayload = {
  current: {
    time: '2026-08-30T14:15',
    wave_height: 0.6,
    wind_wave_height: 0.4,
    swell_wave_height: 0.5,
    water_temperature: 27.1,
  },
  hourly: {
    time: ['2026-08-30T13:00', '2026-08-30T14:00'],
    swell_wave_direction: [350, 10],
    swell_wave_period: [6.5, 7.0],
  },
};

const dive = (over: Record<string, unknown> = {}) => ({
  category: 'diving',
  areaId: 'blue_hole',
  titleEn: 'Test Dive',
  environmentalSensitivities: {},
  ...over,
});

describe('reading the modeled sea state', () => {
  beforeEach(() => marineService.clearCache());
  afterEach(() => {
    vi.unstubAllGlobals();
    marineService.clearCache();
  });

  const stubFetch = (impl: () => Promise<unknown>) => vi.stubGlobal('fetch', vi.fn(impl));

  it('returns the model run with swell detail for the current hour', async () => {
    stubFetch(async () => ({ ok: true, json: async () => modelPayload }));
    const reading = await marineService.getCurrentReading();
    expect(reading).not.toBeNull();
    expect(reading!.waveHeightM).toBe(0.6);
    expect(reading!.swellWaveM).toBe(0.5);
    expect(reading!.swellDirectionDegrees).toBe(10);
    expect(reading!.swellPeriodSeconds).toBe(7.0);
    expect(reading!.waterTempC).toBe(27.1);
    expect(reading!.kind).toBe('model');
    expect(reading!.source).toMatch(/model/i);
  });

  it('returns null rather than a calm sea when the model has no wave fields', async () => {
    // A run with zero wave fields is a missing run, not flat water.
    stubFetch(async () => ({ ok: true, json: async () => ({ current: { time: '2026-08-30T14:15' } }) }));
    expect(await marineService.getCurrentReading()).toBeNull();
  });

  it('returns null on network failure, bad status, and empty payloads', async () => {
    stubFetch(async () => { throw new Error('network down'); });
    expect(await marineService.getCurrentReading()).toBeNull();
    marineService.clearCache();
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    expect(await marineService.getCurrentReading()).toBeNull();
    marineService.clearCache();
    stubFetch(async () => ({ ok: true, json: async () => ({}) }));
    expect(await marineService.getCurrentReading()).toBeNull();
  });

  it('caches within the TTL window', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => modelPayload }));
    stubFetch(fetchMock);
    await marineService.getCurrentReading();
    await marineService.getCurrentReading();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('water-activity suitability', () => {
  it('scopes judging to water categories only', () => {
    expect(isWaterActivity('diving')).toBe(true);
    expect(isWaterActivity('water_sport')).toBe(true);
    expect(isWaterActivity('safari')).toBe(false);
    expect(isWaterActivity('food')).toBe(false);
  });

  it('honors the activity’s own wind limit first', () => {
    const strict = dive({ environmentalSensitivities: { maxWindKnots: 15 } });
    expect(assessActivity(strict, 14).verdict).toBe('go');
    expect(assessActivity(strict, 17).verdict).toBe('caution');
    expect(assessActivity(strict, 25).verdict).toBe('avoid');
  });

  it('applies the outer-reef research band to diving by default', () => {
    expect(assessActivity(dive(), 18).verdict).toBe('go');
    expect(assessActivity(dive(), 20).verdict).toBe('caution');
    expect(assessActivity(dive(), 24).verdict).toBe('avoid');
  });

  it('gives Lighthouse Bay its documented +2 kn of shelter', () => {
    const lagoon = dive({ areaId: 'lighthouse' });
    expect(assessActivity(lagoon, 20).verdict).toBe('go');
    expect(assessActivity(dive({ areaId: 'canyon' }), 20).verdict).toBe('caution');
  });

  it('applies the Laguna kite window (12–28 kn)', () => {
    const kite = { category: 'water_sport', areaId: 'blue_lagoon', titleEn: 'Kite', environmentalSensitivities: {} };
    expect(assessActivity(kite, 8).verdict).toBe('caution');
    expect(assessActivity(kite, 20).verdict).toBe('go');
    expect(assessActivity(kite, 30).verdict).toBe('caution');
    expect(assessActivity(kite, 35).verdict).toBe('avoid');
  });

  it('explains every verdict bilingually with the measured value', () => {
    const assessed = assessActivity(dive(), 24);
    expect(assessed.verdict).toBe('avoid');
    expect(assessed.reasons.length).toBeGreaterThan(0);
    expect(assessed.reasons[0].en).toContain('24');
    expect(assessed.reasons[0].ar.length).toBeGreaterThan(0);
  });
});
