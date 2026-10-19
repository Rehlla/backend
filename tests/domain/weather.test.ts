import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  compassPoint,
  describeWeatherCode,
  kmhToKnots,
  weatherService
} from '../../server/services/weatherService';

/**
 * `/api/telemetry/weather` used to return a fixed object — 28°C air, 24°C
 * water, 14 kn NE, 28m visibility, "GREEN_ALL_CLEAR" — stamped with a live
 * timestamp and `freshness: '2 mins ago'`. Measured against the real source on
 * the day this was written, the air temperature in Dahab was 33.4°C.
 */

describe('unit conversion and labelling', () => {
  it('reports wind in knots, which is what every surface in the product speaks', () => {
    // The upstream publishes km/h.
    expect(kmhToKnots(17.5)).toBeCloseTo(9.4, 1);
    expect(kmhToKnots(0)).toBe(0);
  });

  it('labels a bearing with the point it actually is', () => {
    // 350° is N. A coarser 8-point rose would call it NW and be wrong by 45°.
    expect(compassPoint(350)).toBe('N');
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(45)).toBe('NE');
    expect(compassPoint(180)).toBe('S');
    expect(compassPoint(270)).toBe('W');
  });

  it('handles bearings outside 0–360 rather than producing an undefined label', () => {
    expect(compassPoint(-90)).toBe('W');
    expect(compassPoint(720)).toBe('N');
  });

  it('describes a WMO code in both languages', () => {
    expect(describeWeatherCode(0).en).toBe('Clear sky');
    expect(describeWeatherCode(0).ar).toBe('سماء صافية');
    expect(describeWeatherCode(95).en).toBe('Thunderstorm');
    // An unknown code is named as unknown, not silently reported as clear.
    expect(describeWeatherCode(500).en).toBe('Unknown');
  });
});

describe('reading the current conditions', () => {
  const payload = {
    current: {
      time: '2026-08-30T22:15',
      temperature_2m: 33.4,
      apparent_temperature: 32.1,
      wind_speed_10m: 17.5,
      wind_direction_10m: 350,
      weather_code: 0
    },
    hourly: {
      time: ['2026-08-30T21:00', '2026-08-30T22:00', '2026-08-30T23:00'],
      sea_surface_temperature: [26.8, 26.6, 26.5]
    },
    daily: { sunrise: ['2026-08-30T05:42'], sunset: ['2026-08-30T18:24'] }
  };

  beforeEach(() => {
    weatherService.clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    weatherService.clearCache();
  });

  const stubFetch = (impl: () => Promise<unknown>) =>
    vi.stubGlobal('fetch', vi.fn(impl));

  it('returns the reading the source published', async () => {
    stubFetch(async () => ({ ok: true, json: async () => payload }));
    const result = await weatherService.getCurrentConditions();

    expect(result).not.toBeNull();
    expect(result!.airTemperatureC).toBe(33.4);
    expect(result!.windKnots).toBeCloseTo(9.4, 1);
    expect(result!.windDirection).toBe('N');
    expect(result!.condition).toBe('Clear sky');
  });

  it('takes the sea temperature for the hour the reading belongs to', async () => {
    stubFetch(async () => ({ ok: true, json: async () => payload }));
    const result = await weatherService.getCurrentConditions();
    // 22:15 belongs to the 22:00 row, not the first row in the array.
    expect(result!.waterTemperatureC).toBe(26.6);
  });

  it('reports the time of the reading, not the time of the request', async () => {
    stubFetch(async () => ({ ok: true, json: async () => payload }));
    const result = await weatherService.getCurrentConditions();
    expect(result!.observedAt).toContain('2026-08-30');
  });

  it('returns null rather than a fallback when the source cannot be read', async () => {
    // The whole point: a number nobody measured must not reach the traveler.
    stubFetch(async () => {
      throw new Error('network down');
    });
    expect(await weatherService.getCurrentConditions()).toBeNull();
  });

  it('returns null on a non-OK response', async () => {
    stubFetch(async () => ({ ok: false, json: async () => ({}) }));
    expect(await weatherService.getCurrentConditions()).toBeNull();
  });

  it('returns null when the payload has no usable reading', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ current: {} }) }));
    expect(await weatherService.getCurrentConditions()).toBeNull();
  });

  it('leaves the sea temperature null rather than guessing it', async () => {
    stubFetch(async () => ({
      ok: true,
      json: async () => ({ ...payload, hourly: { time: [], sea_surface_temperature: [] } })
    }));
    const result = await weatherService.getCurrentConditions();
    expect(result!.waterTemperatureC).toBeNull();
    // The air temperature is still real; one missing field does not void the rest.
    expect(result!.airTemperatureC).toBe(33.4);
  });

  it('does not re-request within the cache window', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => payload }));
    vi.stubGlobal('fetch', fetchMock);

    await weatherService.getCurrentConditions();
    await weatherService.getCurrentConditions();
    await weatherService.getCurrentConditions();

    // The upstream publishes every 15 minutes; asking per page load gains
    // nothing and is what a cache is for.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reads each destination at its own coordinates and caches them separately', async () => {
    const fetchMock = vi.fn(async (_url: string) => ({ ok: true, json: async () => payload }));
    vi.stubGlobal('fetch', fetchMock);

    await weatherService.getCurrentConditions('dahab');
    await weatherService.getCurrentConditions('siwa');
    await weatherService.getCurrentConditions('siwa');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('latitude=28.5097');
    // Siwa is in the Western Desert, ~900 km west of Dahab.
    expect(String(fetchMock.mock.calls[1][0])).toContain('longitude=25.5195');
  });

  it('does not cache a failure, so recovery is immediate', async () => {
    let attempt = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        attempt += 1;
        if (attempt === 1) throw new Error('transient');
        return { ok: true, json: async () => payload };
      })
    );

    expect(await weatherService.getCurrentConditions()).toBeNull();
    const second = await weatherService.getCurrentConditions();
    expect(second?.airTemperatureC).toBe(33.4);
  });
});
