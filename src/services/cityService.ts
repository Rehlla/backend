import { fetchWithTimeout } from './api';

function cityHeaders() {
  return { 'Accept': 'application/json; charset=utf-8', 'Content-Type': 'application/json' };
}

export type CityDataKind = 'places' | 'hotels' | 'food' | 'meta';

function cityUrl(slug: string, sub?: string, kind: CityDataKind = 'places') {
  const base = `/api/cities/${encodeURIComponent(slug)}`;
  if (sub) return `${base}/sub/${encodeURIComponent(sub)}/${kind}`;
  return `${base}/${kind}`;
}

async function getJson(url: string, label: string) {
  const res = await fetchWithTimeout(url, { headers: { ...cityHeaders(), 'Accept': 'application/json; charset=utf-8' } });
  if (!res.ok) throw new Error(`${label} ${res.status}`);
  return res.json();
}

/**
 * Generic city fetch — any of the 12 rebuilt destinations, any resource.
 * No dahab special-casing: the slug comes from the route.
 */
export async function fetchCityData(slug: string, kind: CityDataKind = 'places') {
  return getJson(cityUrl(slug, undefined, kind), `City ${kind}`);
}

/**
 * Generic sub-destination fetch — parent city + sub slug, any resource.
 */
export async function fetchSubData(parent: string, sub: string, kind: CityDataKind = 'places') {
  return getJson(cityUrl(parent, sub, kind), `Sub ${kind}`);
}

/**
 * Generic Nile cruise route fetch (6 stops, Luxor -> Abu Simbel).
 */
export async function fetchCruiseRoutes() {
  return getJson('/api/nile-cruise/routes', 'Cruise');
}

export async function fetchCityPlaces(slug: string) {
  return fetchCityData(slug, 'places');
}
export async function fetchCityHotels(slug: string, limit?: number, page?: number) {
  // The generic /hotels endpoint also exposes the REAL paginated list
  // (items[], page, limit, pages) — pass limit/page to page through it, or
  // omit them for the server defaults (limit 12, page 1).
  let url = `/api/cities/${encodeURIComponent(slug)}/hotels`;
  const search = new URLSearchParams();
  if (limit !== undefined) search.set('limit', String(limit));
  if (page !== undefined) search.set('page', String(page));
  const qs = search.toString();
  if (qs) url += `?${qs}`;
  return getJson(url, 'City hotels');
}
export async function fetchCityFood(slug: string) {
  return fetchCityData(slug, 'food');
}
export async function fetchCityMeta(slug: string) {
  return fetchCityData(slug, 'meta');
}
export async function fetchSubPlaces(parent: string, sub: string) {
  return fetchSubData(parent, sub, 'places');
}
export async function fetchSubHotels(parent: string, sub: string) {
  return fetchSubData(parent, sub, 'hotels');
}
export async function fetchSubFood(parent: string, sub: string) {
  return fetchSubData(parent, sub, 'food');
}
export async function fetchNileCruiseRoutes() {
  return fetchCruiseRoutes();
}
