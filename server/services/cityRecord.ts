/**
 * City record mapping (reports 04 §12 / 08 §4 / 11, gaps C-1 + C-4).
 *
 * Pure functions over the city seed plus optional data-file statistics — no
 * fs, no router, no state — so the shapes the city surfaces return come from
 * one testable place instead of being inlined in the handlers. cityRoutes and
 * weatherRoutes both read from here.
 */
import { createHash } from 'node:crypto';
import { CitySeed } from '../db/citiesSeed';
import { CITIES_SEED } from '../db/citiesSeed';

/** One seeded city, by slug (normalized). */
export function findCitySeed(slug: string): CitySeed | undefined {
  const normalized = String(slug || '').trim().toLowerCase();
  return CITIES_SEED.find((c) => c.slug === normalized);
}

/**
 * The three-color triple clients theme from: [abyss, salt, accent]. The seed
 * already carries `chrome` and a two-stop `swatch`, so the accent is the
 * first swatch stop and nothing new has to be authored per city.
 */
export function swFrom(seed: CitySeed): [string, string, string] {
  return [seed.chrome.abyss, seed.chrome.salt, seed.swatch[0]];
}

/** Bounds-center point the weather surface reads conditions for. */
export function cityCenter(seed: CitySeed): { lat: number; lng: number } {
  const b = seed.bounds;
  return {
    // Seeded rows always carry bounds; the guard keeps this pure arithmetic.
    // 4 decimal places is ~11 m — far inside any city box.
    lat: b ? Math.round(((b.latMin + b.latMax) / 2) * 10000) / 10000 : 0,
    lng: b ? Math.round(((b.lngMin + b.lngMax) / 2) * 10000) / 10000 : 0,
  };
}

/** Light record — GET /api/cities. No data-file reads: seed counters only. */
export function lightCity(seed: CitySeed) {
  return {
    id: seed.slug,
    slug: seed.slug,
    name: { ar: seed.nameAr, en: seed.nameEn },
    region: seed.region ?? null,
    blurb: seed.blurb ?? null,
    vibe: { ar: seed.vibe, en: seed.vibeEn ?? seed.vibe },
    kind: seed.kind ?? 'sea',
    services: seed.services ?? ['sights'],
    catalogue: seed.catalogue,
    heroImage: seed.heroImage,
    sw: swFrom(seed),
    geo: {
      center: cityCenter(seed),
      bounds: seed.bounds ? { ...seed.bounds } : null,
    },
    counts: { features: seed.featureCount, sights: seed.tourismCount },
    wikidata: seed.wikidata ?? null,
    population: seed.population ?? null,
  };
}

/**
 * Full record — GET /api/cities/:slug. `file` is the flat data seed when
 * present, so the counters come from the same source the lists do.
 */
export function fullCityRecord(seed: CitySeed, file: unknown) {
  const data = (file ?? null) as { featureCount?: number; tourismCount?: number } | null;
  return {
    ...lightCity(seed),
    planner:
      seed.planner ??
      { pool: seed.catalogue === 'live' ? 'experiences' : 'areas', heatAvoid: false },
    transfer: seed.transfer ?? [],
    counts: {
      features: data?.featureCount ?? seed.featureCount,
      sights: data?.tourismCount ?? seed.tourismCount,
    },
  };
}

/** Strong ETag over the serialized record (contents-addressed, not clock-based). */
export function etagFor(payload: unknown): string {
  return `"${createHash('sha1').update(JSON.stringify(payload)).digest('hex')}"`;
}
