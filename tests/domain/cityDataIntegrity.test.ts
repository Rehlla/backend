/**
 * City data integrity gate (gap M-3 of report 11).
 *
 * The multi-city registry and the flat data seeds must never drift apart: a
 * city seeded in CITIES_SEED without its file (or a file whose counters or
 * feature shape drifted from the seed) is exactly the kind of lie the old
 * catchall stub used to print. This runs in `npm test`, so CI fails closed
 * before a broken city surface can ship.
 */
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CITIES_SEED, CityKind, CityService } from '../../server/db/citiesSeed';

const CITIES_DIR = path.join(process.cwd(), 'data', 'cities');

/** The semantic lineage (10 §4.1) and the surfaces each row may declare. */
const KINDS: CityKind[] = ['sea', 'oasis', 'desert', 'river'];
const SERVICES: CityService[] = ['exp', 'stay', 'sights', 'food', 'bike', 'transfer', 'night'];

describe('city registry shape', () => {
  it('indexes exactly the 12 catalogued cities, uniquely, in both languages', () => {
    expect(CITIES_SEED).toHaveLength(12);
    expect(new Set(CITIES_SEED.map((c) => c.slug)).size).toBe(12);
    for (const seed of CITIES_SEED) {
      expect(seed.nameAr.length).toBeGreaterThan(0);
      expect(seed.nameEn.length).toBeGreaterThan(0);
      expect(seed.featureCount).toBeGreaterThan(0);
      expect(seed.catalogue === 'live' || seed.catalogue === 'early').toBe(true);
    }
  });

  it('every city declares a known kind and only known services', () => {
    for (const seed of CITIES_SEED) {
      if (seed.kind) expect(KINDS).toContain(seed.kind);
      for (const s of seed.services ?? []) expect(SERVICES).toContain(s);
    }
  });

  it('bilingual copy carries no foreign or mixed-script residue', () => {
    // Report 11 shipped with seed blurbs containing stray foreign codepoints
    // (a Bengali glyph, Latin inside Arabic). This is the regression net.
    const BAD = /[\u0370-\u03FF\u0400-\u04FF\u0980-\u09FF\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF]/;
    const MIXED = /[\u0600-\u06FF][a-zA-Z]+|[a-zA-Z]+[\u0600-\u06FF]/;
    for (const seed of CITIES_SEED) {
      const ar = [seed.nameAr, seed.vibe, seed.blurb?.ar, seed.region?.ar].filter(Boolean) as string[];
      expect(ar.length).toBeGreaterThan(0);
      for (const s of ar) {
        expect(s.match(BAD), `foreign codepoint in ${seed.slug}: ${s}`).toBe(null);
        expect(s.match(MIXED), `mixed-script in ${seed.slug}: ${s}`).toBe(null);
      }
      if (seed.blurb) {
        expect(seed.blurb.en.length).toBeGreaterThan(0);
        expect(seed.blurb.ar.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('flat data seeds match the registry', () => {
  for (const seed of CITIES_SEED) {
    it(`${seed.slug}.json exists and matches CITIES_SEED`, () => {
      const file = JSON.parse(fs.readFileSync(path.join(CITIES_DIR, `${seed.slug}.json`), 'utf8'));
      const features = file.features as any[];

      // Counters: the registry, the file header and the feature list agree.
      expect(file.featureCount).toBe(seed.featureCount);
      expect(file.tourismCount).toBe(seed.tourismCount);
      expect(features).toHaveLength(seed.featureCount);
      expect(features.length).toBeGreaterThanOrEqual(seed.tourismCount);

      // Every feature carries the flat-shape contract fields. Measured
      // reality (Oct 2026): ids are strings in 5 files and numbers in the
      // other 7 — accept both; ~6.3k OSM rows have NO name at all (empty
      // strings) — a raw-OSM data-quality follow-up, not a shape violation.
      // The gate pins the shape: id always resolvable, the name keys always
      // present, coords real. Surfaces filter on tags, so a nameless row only
      // surfaces where it also carries a matching amenity tag (report 11's
      // M-3 follow-up tracks that cleanup).
      for (const f of features) {
        const idOK =
          (typeof f.id === 'string' && f.id.length > 0) ||
          (typeof f.id === 'number' && Number.isFinite(f.id));
        expect(idOK, `id in ${seed.slug}.json`).toBe(true);
        expect(
          ('name' in f && 'nameEn' in f && 'nameAr' in f),
          `name keys for ${JSON.stringify(f.id)} (${seed.slug})`
        ).toBe(true);
        expect(Number.isFinite(f.lat) && Number.isFinite(f.lng), `coords for ${JSON.stringify(f.id)} (${seed.slug})`).toBe(true);
      }
    });
  }
});
