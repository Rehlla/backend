import { describe, expect, it, vi, afterEach } from 'vitest';
import { cartoTileUrl, hasCartoKey, CARTO_ATTRIBUTION } from '../../src/lib/mapTiles';

/**
 * The tile URL must carry `?key=` exactly as CARTO documents it
 * (?api_key= renders the watermark tiles); without a key the URL still
 * builds so maps degrade visibly instead of crashing. Env is stubbed per
 * test because the helper reads it lazily.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cartoTileUrl', () => {
  it('appends the dashboard key as ?key= when configured', () => {
    vi.stubEnv('VITE_CARTO_MAPS_API_KEY', 'test-key-123');
    expect(hasCartoKey()).toBe(true);
    expect(cartoTileUrl('streets')).toBe(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=test-key-123'
    );
    expect(cartoTileUrl('dark')).toBe(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=test-key-123'
    );
  });

  it('falls back to keyless OSM tiles when unconfigured', () => {
    vi.stubEnv('VITE_CARTO_MAPS_API_KEY', '');
    expect(hasCartoKey()).toBe(false);
    // P1-18: returning an unkeyed CARTO URL did not degrade the map, it
    // watermarked every tile with "API KEY REQUIRED". OSM needs no key.
    expect(cartoTileUrl()).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(cartoTileUrl()).not.toContain('cartocdn.com');
    expect(cartoTileUrl()).not.toContain('key=');
  });

  it('keeps the documented attribution', () => {
    expect(CARTO_ATTRIBUTION).toContain('OpenStreetMap');
    expect(CARTO_ATTRIBUTION).toContain('carto.com/attribution');
  });
});
