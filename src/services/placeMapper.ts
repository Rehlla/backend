import type { DahabPlace, SpatialCoordinates } from '../shared/types/knowledge';

/**
 * Turns the destination corpus's places into what the maps render.
 *
 * Both maps shipped their own hardcoded list — 12 spots in
 * InteractiveSinaiMap, 8 in DahabSpatialContextMap — while /api/dahab/places
 * held 17 real records with real coordinates, real descriptions and a
 * verification date, and neither map had ever called it.
 *
 * The two lists also disagreed with each other and with the corpus: the same
 * place appeared under three different names, at three different positions.
 */

/** Dahab town centre, used as the origin for "how far is this". */
export const DAHAB_CENTRE = { lat: 28.5028, lng: 34.5136 };

/**
 * Great-circle distance in kilometres.
 *
 * The maps displayed distances as text — "8.5 km North", "3.2 km" — written by
 * hand next to coordinates that could have produced them. Now they are computed
 * from the two positions, so a corrected coordinate corrects the distance.
 */
export function distanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)) * 10) / 10;
}

/** Which way it lies from the origin, from the coordinates rather than by hand. */
export function bearingLabel(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): { en: string; ar: string } {
  const dLat = to.lat - from.lat;
  const dLng = to.lng - from.lng;
  if (Math.abs(dLat) < 0.004 && Math.abs(dLng) < 0.004) return { en: 'Central', ar: 'وسط البلد' };

  const vertical = dLat > 0.004 ? 'N' : dLat < -0.004 ? 'S' : '';
  const horizontal = dLng > 0.004 ? 'E' : dLng < -0.004 ? 'W' : '';
  const key = `${vertical}${horizontal}`;
  const labels: Record<string, { en: string; ar: string }> = {
    N: { en: 'North', ar: 'شمالاً' },
    S: { en: 'South', ar: 'جنوباً' },
    E: { en: 'East', ar: 'شرقاً' },
    W: { en: 'West', ar: 'غرباً' },
    NE: { en: 'North-East', ar: 'شمال شرق' },
    NW: { en: 'North-West', ar: 'شمال غرب' },
    SE: { en: 'South-East', ar: 'جنوب شرق' },
    SW: { en: 'South-West', ar: 'جنوب غرب' }
  };
  return labels[key] ?? { en: 'Central', ar: 'وسط البلد' };
}

/**
 * The bounding box the illustrated map is drawn to.
 *
 * InteractiveSinaiMap positions markers with `latPct`/`lngPct` — percentages of
 * an illustration, not coordinates — and those percentages were hand-placed.
 * Projecting the real coordinates into the same box means a marker sits where
 * the place actually is, and a corrected coordinate moves it.
 *
 * The bounds cover the corpus (lat 28.41–28.645, lng 34.42–34.58) with a small
 * margin so nothing lands on the very edge.
 */
const MAP_BOUNDS = { north: 28.66, south: 28.40, west: 34.40, east: 34.60 };

export interface ProjectedPosition {
  /** Percent from the top of the illustration. */
  latPct: number;
  /** Percent from the left of the illustration. */
  lngPct: number;
}

export function projectToIllustration(coords: { lat: number; lng: number }): ProjectedPosition {
  const clamp = (v: number) => Math.max(4, Math.min(96, v));
  // North is at the top, so latitude runs downward.
  const latPct = ((MAP_BOUNDS.north - coords.lat) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * 100;
  const lngPct = ((coords.lng - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * 100;
  return { latPct: Math.round(clamp(latPct)), lngPct: Math.round(clamp(lngPct)) };
}

export type MapSpotCategory =
  | 'Dive Site'
  | 'Desert Valley'
  | 'Beach & Lagoon'
  | 'Café & Dining'
  | 'Local Culture';

/** The corpus stores free-text categories; the maps colour by a small set. */
export function mapCategoryOf(place: DahabPlace): { en: MapSpotCategory; ar: string } {
  const c = place.category.toLowerCase();
  if (c.includes('dive') || c.includes('reef') || c.includes('marine')) {
    return { en: 'Dive Site', ar: 'موقع غوص' };
  }
  if (c.includes('lagoon') || c.includes('beach')) return { en: 'Beach & Lagoon', ar: 'شاطئ وبحيرة' };
  if (c.includes('desert') || c.includes('oasis') || c.includes('nature') || c.includes('mountain')) {
    return { en: 'Desert Valley', ar: 'وادي وصحراء' };
  }
  if (c.includes('market') || c.includes('bazaar') || c.includes('promenade')) {
    return { en: 'Café & Dining', ar: 'كافيهات ومطاعم' };
  }
  return { en: 'Local Culture', ar: 'ثقافة محلية' };
}

export interface MappedPlace {
  id: string;
  name: string;
  nameAr: string;
  category: MapSpotCategory;
  categoryAr: string;
  lat: number;
  lng: number;
  latPct: number;
  lngPct: number;
  distanceKm: number;
  distance: string;
  distanceAr: string;
  description: string;
  descriptionAr: string;
  /** When the record was last checked — shown instead of an invented rating. */
  verifiedAt: string;
  operationalStatus: string;
}

/**
 * Places a traveler would actually go to.
 *
 * The corpus includes records that exist for routing and safety rather than for
 * visiting — a highway checkpoint, a transport hub — and a map of things to see
 * should not offer them as destinations.
 */
const NOT_A_DESTINATION = /checkpoint|highway|transport hub|public services/i;

export function toMappedPlace(place: DahabPlace, origin = DAHAB_CENTRE): MappedPlace {
  // A record the research pipeline could not position (an unconfirmed dive
  // site, say) has no coordinates to derive a distance or bearing from. The
  // maps filter those out in buildMapPlaces; a direct call that slips past
  // the guard should name the record rather than throw about 'null'.
  if (
    !place.coordinates ||
    !Number.isFinite(place.coordinates.lat) ||
    !Number.isFinite(place.coordinates.lng)
  ) {
    throw new Error(`Place '${place.nameEn}' has no usable coordinates to map.`);
  }

  const km = distanceKm(origin, place.coordinates);
  const bearing = bearingLabel(origin, place.coordinates);
  const position = projectToIllustration(place.coordinates);
  const category = mapCategoryOf(place);

  return {
    id: place.id,
    name: place.nameEn,
    nameAr: place.nameAr,
    category: category.en,
    categoryAr: category.ar,
    lat: place.coordinates.lat,
    lng: place.coordinates.lng,
    latPct: position.latPct,
    lngPct: position.lngPct,
    distanceKm: km,
    distance: km < 0.6 ? 'In town' : `${km} km ${bearing.en}`,
    distanceAr: km < 0.6 ? 'داخل البلد' : `${km} كم ${bearing.ar}`,
    description: place.descriptionEn,
    descriptionAr: place.descriptionAr,
    verifiedAt: place.verifiedAt,
    operationalStatus: place.operationalStatus
  };
}

/**
 * Whether a record has coordinates a map can place.
 *
 * The corpus stores null until a position is confirmed — the research import
 * creates dive sites from text rather than GPS — so this is a data condition,
 * not an invented one. A record without a position is excluded from the map
 * exactly like a non-destination or a suspended one: it exists for other
 * surfaces, not for drawing markers.
 */
function hasUsableCoordinates(
  place: DahabPlace
): place is DahabPlace & { coordinates: SpatialCoordinates } {
  const c = place.coordinates;
  if (!c) return false;
  return Number.isFinite(c.lat) && Number.isFinite(c.lng);
}

export function buildMapPlaces(places: DahabPlace[], origin = DAHAB_CENTRE): MappedPlace[] {
  return places
    .filter(p => !NOT_A_DESTINATION.test(p.category))
    // A suspended or rejected record is not somewhere to send a traveler.
    .filter(p => p.operationalStatus !== 'SUSPENDED' && p.operationalStatus !== 'REJECTED')
    .filter(hasUsableCoordinates)
    .map(p => toMappedPlace(p, origin))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
