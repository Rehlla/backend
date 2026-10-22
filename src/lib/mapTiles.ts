/**
 * CARTO basemap tiles shared by the app's Leaflet maps.
 *
 * Since 25 September 2026 CARTO serves raster tiles only with an API key
 * (`?key=`); without one every tile renders an "API KEY REQUIRED" notice
 * instead of the map. The key is read lazily so tests can stub it and so no
 * module evaluates secrets at import time.
 *
 * The key is public by design (it ships in tile URLs, like a Mapbox public
 * token) and is protected by HTTP-referrer restrictions in the CARTO
 * dashboard — see VITE_CARTO_MAPS_API_KEY in .env.example. Note the
 * dashboard treats localhost/127.0.0.1 as a separate host: local dev needs
 * its own allowances or its own key.
 */

export type BasemapTheme = 'streets' | 'dark';

function cartoKey(): string | undefined {
  const key = import.meta.env.VITE_CARTO_MAPS_API_KEY as string | undefined;
  return key && key.length > 0 ? key : undefined;
}

export function hasCartoKey(): boolean {
  return cartoKey() !== undefined;
}

/**
 * The Leaflet tile URL for the requested theme.
 *
 * With a CARTO key we use CARTO (both raster and dark styles). Without one we
 * fall back to OpenStreetMap's standard tiles, which need no key. Previously
 * the un-keyed CARTO URL was returned anyway, and CARTO answered those requests
 * with "API KEY REQUIRED" tiles — so the map rendered, but stamped with a
 * watermark across every tile (P1-18). Degrading to OSM keeps the map usable and
 * watermark-free; only the visual style differs.
 */
export function cartoTileUrl(theme: BasemapTheme = 'streets'): string {
  const key = cartoKey();
  if (!key) {
    return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  }
  // The dark style lives outside the rastertiles/ prefix — that asymmetry is
  // CARTO's, mirrored from the long-standing accommodations map setup.
  const style = theme === 'dark' ? 'dark_all' : 'rastertiles/voyager';
  return `https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png?key=${key}`;
}

export const CARTO_SUBDOMAINS = 'abcd';

export const CARTO_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
  '© <a href="https://carto.com/attribution/">CARTO</a>';
