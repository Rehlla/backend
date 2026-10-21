/**
 * Sprint 6.1 — Sub-destination seeds.
 *
 * Sub-destinations are NOT cities: they are curated points of interest that live
 * inside an existing city boundary and are served under the parent city's
 * namespace (`/api/cities/:parentSlug/sub/:subSlug/places`).
 *
 * Coordinate anchors are the real gazetteer values:
 *  - Ras Muhammad National Park: 27°46′10″N 34°12′35″E -> 27.7694 / 34.2097
 *  - Colored Canyon entrance: 29°08′46″N 34°35′41.50″E -> 29.146 / 34.594
 */

export type SubDestinationType = 'protected_area' | 'canyon' | 'temple_complex';

export interface SubDestinationSeed {
  /** Stable slug, also the JSON filename under data/cities/sub/ */
  slug: string;
  /** Parent city slug — must exist in CITIES_SEED */
  parent: string;
  /** Wikidata entity of the anchor point */
  wikidata: string;
  /** Anchor coordinate (decimal degrees) */
  coords: { lat: number; lng: number };
  /** Extraction rectangle used to build the flat seed */
  bounds: { lat: [number, number]; lng: [number, number] };
  /** Real feature count in the flat seed file */
  featureCount: number;
  /** Real tourism-tagged feature count in the flat seed file */
  tourismCount: number;
  /** Accent colour used by the design system */
  color: string;
  /** Classification of the sub-destination */
  type: SubDestinationType;
}

export const SUB_DESTINATIONS_SEED: Record<string, SubDestinationSeed> = {
  ras_mohamed: {
    slug: 'ras_mohamed',
    parent: 'sharm',
    wikidata: 'Q185362',
    coords: { lat: 27.7694, lng: 34.2097 },
    bounds: { lat: [27.7, 27.85], lng: [34.15, 34.3] },
    featureCount: 21,
    tourismCount: 20,
    color: '#059669',
    type: 'protected_area',
  },
  colored_canyon: {
    slug: 'colored_canyon',
    parent: 'nuweiba',
    wikidata: 'Q5144362',
    coords: { lat: 29.146, lng: 34.594 },
    bounds: { lat: [29.1, 29.2], lng: [34.55, 34.7] },
    featureCount: 13,
    tourismCount: 10,
    color: '#D97706',
    type: 'canyon',
  },
  abu_simbel: {
    slug: 'abu_simbel',
    parent: 'aswan',
    wikidata: 'Q641',
    coords: { lat: 22.3372, lng: 31.6256 },
    bounds: { lat: [22.33, 22.38], lng: [31.6, 31.65] },
    featureCount: 27,
    tourismCount: 13,
    color: '#FBBF24',
    type: 'temple_complex',
  },
};

/** Sub-destination slugs grouped by their parent city slug. */
export function subDestinationsFor(parentSlug: string): SubDestinationSeed[] {
  return Object.values(SUB_DESTINATIONS_SEED).filter((s) => s.parent === parentSlug);
}

/** Look up a sub-destination and assert it belongs to the given parent city. */
export function findSubDestination(parentSlug: string, subSlug: string): SubDestinationSeed | undefined {
  const seed = SUB_DESTINATIONS_SEED[subSlug];
  if (!seed || seed.parent !== parentSlug) return undefined;
  return seed;
}
