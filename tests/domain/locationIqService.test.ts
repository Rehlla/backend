import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { locationIqService } from '../../server/services/locationIqService';

/**
 * LocationIQ reverse geocoding for the "from anywhere" transfer tab.
 *
 * The browser hands the server a lat/lng; this service turns it into a readable
 * city so the hub can say "Detected: Cairo" while pricing from the nearest
 * served origin. The key is optional — with no key, or on any upstream failure,
 * it must return null so the client falls back to plain nearest-origin
 * matching. It must never fabricate a location.
 */

const validFetch = (payload: Record<string, unknown>) =>
  vi.fn().mockResolvedValue(
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  );

const cairoAddress = {
  address: {
    city: 'Cairo',
    state: 'Cairo Governorate',
    country: 'Egypt',
    country_code: 'eg'
  },
  display_name: 'Cairo, Cairo Governorate, Egypt',
  lat: '30.0444',
  lon: '31.2357'
};

describe('locationIqService.reverseGeocode', () => {
  beforeEach(() => {
    process.env.LOCATIONIQ_API_KEY = 'pk.test';
  });
  afterEach(() => {
    delete process.env.LOCATIONIQ_API_KEY;
    vi.unstubAllGlobals();
  });

  it('returns null with no API key (optional-key behaviour)', async () => {
    delete process.env.LOCATIONIQ_API_KEY;
    const result = await locationIqService.reverseGeocode(30.0444, 31.2357);
    expect(result).toBeNull();
  });

  it('returns null for a coordinate outside Egypt', async () => {
    const fetchMock = validFetch({
      address: {
        city: 'Paris',
        state: 'Île-de-France',
        country: 'France',
        country_code: 'fr'
      },
      display_name: 'Paris, France',
      lat: '48.8566',
      lon: '2.3522'
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await locationIqService.reverseGeocode(48.8566, 2.3522);
    expect(result).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('labels an Egypt coordinate with city and region', async () => {
    vi.stubGlobal('fetch', validFetch(cairoAddress));

    const place = await locationIqService.reverseGeocode(30.0444, 31.2357);
    expect(place).not.toBeNull();
    expect(place!.label).toBe('Cairo');
    expect(place!.region).toBe('Cairo Governorate');
    expect(place!.countryCode).toBe('eg');
  });

  it('labels only what the address block names (town/village/county fallback)', async () => {
    vi.stubGlobal(
      'fetch',
      validFetch({
        address: {
          village: 'El Gouna',
          county: 'Hurghada',
          state: 'Red Sea Governorate',
          country: 'Egypt',
          country_code: 'eg'
        },
        display_name: 'El Gouna, Hurghada, Red Sea Governorate, Egypt',
        lat: '27.3942',
        lon: '33.6783'
      })
    );

    const place = await locationIqService.reverseGeocode(27.3942, 33.6783);
    expect(place).not.toBeNull();
    expect(place!.label).toBe('El Gouna');
    expect(place!.region).toBe('Red Sea Governorate');
  });

  it('returns null when the upstream answers non-OK', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 429 }))
    );

    const result = await locationIqService.reverseGeocode(30.0444, 31.2357);
    expect(result).toBeNull();
  });

  it('returns null when the request rejects (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const result = await locationIqService.reverseGeocode(30.0444, 31.2357);
    expect(result).toBeNull();
  });

  it('returns null on a payload without an address block', async () => {
    vi.stubGlobal('fetch', validFetch({ error: 'Unable to geocode' }));
    const result = await locationIqService.reverseGeocode(30.0444, 31.2357);
    expect(result).toBeNull();
  });
});