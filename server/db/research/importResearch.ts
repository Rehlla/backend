import type { DiningPriceBand } from '../../../src/shared/priceBand';
import { toDietaryOptions } from '../../../src/shared/diningVenue';
/**
 * Imports the docs/research corpus into the database.
 *
 *   npm run db:research          # report the plan, write nothing
 *   npm run db:research:apply    # apply it
 *
 * ---------------------------------------------------------------------------
 * Why this enriches rather than inserts
 * ---------------------------------------------------------------------------
 * The obvious reading of "seed the database from the research" is to insert
 * every row. That would be wrong here, and destructively so.
 *
 * The research entities are ALREADY in the database, under a different naming
 * convention, loaded previously from server/data/dkosExpansionData.ts. The
 * atlas lists 10 places; the database has 17. The atlas lists 9 activities; the
 * database has 22. `place-lighthouse` in the docs is `place_lighthouse_reef` in
 * the database; `act-eel-snorkel` is `act_eel_garden_sunset_snorkel`.
 *
 * The activities table already shows what happens when this is ignored: it
 * carries two ID conventions for overlapping entities — `act_blue_hole_safari_dive`
 * beside `ACT-BLUE-HOLE-SAFARI`, `act_wadi_gnai_rock_climbing` beside
 * `ACT-WADI-GNAI-CLIMBING` — because a previous import inserted rather than
 * matched. Inserting again would add a third set.
 *
 * What the research genuinely holds that the database does not is *fields*:
 * access mode, shore entry type, connectivity, remoteness tier, dive depths and
 * certification requirements, signature dishes, walk times, payment methods,
 * emergency response protocols, and a twelve-month seasonality matrix.
 *
 * So each row is matched to an existing record and merged into it. Rows that
 * match nothing are reported, and created only where the domain clearly wants
 * new records (dining venues, emergency resources). Nothing is overwritten
 * blindly: existing values win unless --overwrite is passed.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { SQLITE_FILE } from '../paths';
import { TABLE_SPECS, SPEC_BY_COLLECTION } from '../sqlite/tableSpecs';
import { entityToRow, upsertSql } from '../sqlite/schemaBuilder';
import {
  parseTables,
  findTable,
  cell,
  bestMatch,
  coordinates,
  numberRange,
  firstNumber
} from './markdownTable';
import {
  ACTIVITY_ALIASES,
  DIVE_SITE_ALIASES,
  DINING_ALIASES,
  EMERGENCY_ALIASES,
  NEW_DIVE_SITES,
  NEW_ACTIVITIES,
  NEW_DINING
} from './aliases';

const RESEARCH_DIR = path.join(process.cwd(), 'docs', 'research');

type Row = Record<string, string>;
type Entity = Record<string, any>;

interface Change {
  collection: string;
  kind: 'ENRICH' | 'CREATE' | 'UNMATCHED' | 'AMBIGUOUS';
  id: string;
  /** The name as it appears in the research document. */
  label: string;
  /** The record it was matched to, so every mapping is auditable in the report. */
  target?: string;
  fields: string[];
  note?: string;
}

const changes: Change[] = [];


function tableFrom(file: string, ...required: string[]) {
  const full = path.join(RESEARCH_DIR, file);
  if (!fs.existsSync(full)) return null;
  return findTable(parseTables(fs.readFileSync(full, 'utf-8')), ...required);
}

/**
 * Merges research fields into an entity.
 *
 * Only absent fields are filled unless `overwrite` is set: the seeded data was
 * curated and verified, and a document is not automatically more current than
 * the record it describes. Returns the names of the fields actually changed, so
 * the report can show what a run would do rather than just that it ran.
 */
function merge(entity: Entity, additions: Record<string, unknown>, overwrite: boolean): string[] {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(additions)) {
    if (value === undefined || value === null || value === '') continue;
    const existing = entity[key];
    const isEmpty =
      existing === undefined ||
      existing === null ||
      existing === '' ||
      (Array.isArray(existing) && existing.length === 0);
    if (!isEmpty && !overwrite) continue;
    if (JSON.stringify(existing) === JSON.stringify(value)) continue;
    entity[key] = value;
    applied.push(key);
  }
  return applied;
}

const listOf = (value: string): string[] =>
  value
    .split(/[,;]|\s+\/\s+/)
    .map(s => s.trim())
    .filter(Boolean);

// ---------------------------------------------------------------------------
// Per-domain importers
// ---------------------------------------------------------------------------

function importPlaces(state: Record<string, Entity[]>, overwrite: boolean) {
  const table = tableFrom('DAHAB_GEOGRAPHY_ATLAS.md', 'place / zone id', 'official name');
  if (!table) return;

  for (const row of table.rows) {
    const name = cell(row, 'official name');
    const found = bestMatch(name, state.places, p => `${p.nameEn || ''} ${(p.aliases || []).join(' ')}`);

    if (!found.match) {
      changes.push({
        collection: 'places',
        kind: found.ambiguous ? 'AMBIGUOUS' : 'UNMATCHED',
        id: cell(row, 'place / zone id'),
        label: name,
        target: found.suggestion?.id,
        fields: [],
        note: found.ambiguous
          ? 'several places match equally well'
          : found.suggestion
            ? `closest is ${found.suggestion.nameEn} - too weak to act on`
            : 'no place in the database resembles this name'
      });
      continue;
    }
    const place = found.match;

    const distance = cell(row, 'distance from lighthouse');
    const applied = merge(
      place,
      {
        researchId: cell(row, 'place / zone id'),
        accessMode: cell(row, 'access mode'),
        shoreEntryType: cell(row, 'shore entry'),
        connectivity: cell(row, 'connectivity'),
        remotenessTier: cell(row, 'remoteness'),
        distanceFromLighthouseKm: firstNumber(distance),
        travelTimeFromLighthouse: distance.includes('/') ? distance.split('/')[1].trim() : '',
        researchCoordinates: coordinates(cell(row, 'gps'))
      },
      overwrite
    );
    if (applied.length) {
      changes.push({
        collection: 'places',
        kind: 'ENRICH',
        id: place.id,
        label: name,
        target: place.nameEn,
        fields: applied
      });
    }
  }
}

function importDiveSites(state: Record<string, Entity[]>, overwrite: boolean) {
  const table = tableFrom('DAHAB_DIVING_RESEARCH.md', 'dive site name', 'max depth');
  if (!table) return;

  for (const row of table.rows) {
    const name = cell(row, 'dive site name');
    const aliasId = DIVE_SITE_ALIASES[name];
    const aliased = aliasId ? state.places.find(p => p.id === aliasId) : undefined;
    const found = aliased
      ? { match: aliased, suggestion: aliased, ambiguous: false }
      : bestMatch(name, state.places, p => `${p.nameEn || ''} ${(p.aliases || []).join(' ')}`);

    if (!found.match && NEW_DIVE_SITES[name]) {
      const blueprint = NEW_DIVE_SITES[name];
      const created: Entity = {
        id: blueprint.id,
        nameEn: name,
        nameAr: blueprint.nameAr,
        aliases: [],
        arabicNames: [blueprint.nameAr],
        transliterations: [],
        areaId: blueprint.areaId,
        category: blueprint.category,
        coordinates: null,
        googlePlaceId: null,
        operationalStatus: 'OPERATIONAL',
        descriptionEn: '',
        descriptionAr: '',
        verifiedAt: new Date().toISOString(),
        source: 'docs/research/DAHAB_DIVING_RESEARCH.md'
      };
      state.places.push(created);
      changes.push({
        collection: 'places',
        kind: 'CREATE',
        id: created.id,
        label: `dive site: ${name}`,
        fields: Object.keys(created),
        note: `ASSUMPTION: placed in area '${blueprint.areaId}' — inferred from the research text, please confirm`
      });
      found.match = created;
    }

    if (!found.match) {
      changes.push({
        collection: 'places',
        kind: found.ambiguous ? 'AMBIGUOUS' : 'UNMATCHED',
        id: '-',
        label: `dive site: ${name}`,
        target: found.suggestion?.id,
        fields: [],
        note: found.ambiguous
          ? 'several places match equally well'
          : found.suggestion
            ? `closest is ${found.suggestion.nameEn} - too weak to act on`
            : 'no matching place'
      });
      continue;
    }
    const site = found.match;

    const depth = numberRange(cell(row, 'max depth'));
    const applied = merge(
      site,
      {
        diveProfile: {
          maxDepthMetersMin: depth?.min ?? null,
          maxDepthMetersMax: depth?.max ?? null,
          certificationRequirement: cell(row, 'certification'),
          shoreEntry: cell(row, 'shore entry'),
          currents: cell(row, 'currents', 'surge'),
          hazards: cell(row, 'special hazards', 'hazards'),
          bestTimeOfDay: cell(row, 'best time')
        }
      },
      overwrite
    );
    if (applied.length) {
      changes.push({
        collection: 'places',
        kind: 'ENRICH',
        id: site.id,
        label: `dive profile: ${name}`,
        target: site.nameEn,
        fields: applied
      });
    }
  }
}

function importActivities(state: Record<string, Entity[]>, overwrite: boolean) {
  const table = tableFrom('DAHAB_ACTIVITIES_ATLAS.md', 'activity id', 'name');
  if (!table) return;

  for (const row of table.rows) {
    const name = cell(row, 'name');
    const researchId = cell(row, 'activity id');
    const aliasId = ACTIVITY_ALIASES[researchId];
    const aliased = aliasId ? state.activities.find(a => a.id === aliasId) : undefined;
    const found = aliased
      ? { match: aliased, suggestion: aliased, ambiguous: false }
      : bestMatch(name, state.activities, a => `${a.titleEn || ''} ${a.id || ''}`);

    if (!found.match && NEW_ACTIVITIES[researchId]) {
      const blueprint = NEW_ACTIVITIES[researchId];
      const price = numberRange(cell(row, 'price'));
      // "2.0 Hours" / "1.0 - 2.0 Hours" → minutes, midpoint for a range.
      // These rows used to be created with `durationMinutes: null`, which
      // rendered as "null min" on every card that showed the activity.
      const idealHours = numberRange(cell(row, 'ideal duration'));
      const durationMinutes = idealHours
        ? Math.round(((idealHours.min + idealHours.max) / 2) * 60)
        : null;
      const created: Entity = {
        id: blueprint.id,
        titleEn: name,
        titleAr: cell(row, 'arabic name'),
        category: blueprint.category,
        placeId: blueprint.placeId,
        areaId: blueprint.areaId,
        durationMinutes,
        accessMethod: '',
        difficulty: cell(row, 'skill level'),
        experienceLevelRequired: cell(row, 'skill level'),
        basePriceEGP: price ? Math.round((price.min + price.max) / 2) : null,
        // No SKU and no supplier: the catalogue already downgrades
        // uninventoried experiences to REQUEST_NOW, which is the honest state
        // for something nobody has agreed to deliver yet.
        skuId: null,
        supplierId: null,
        bookingMode: 'REQUEST_NOW',
        seasonalityMonths: [],
        environmentalSensitivities: [],
        source: 'docs/research/DAHAB_ACTIVITIES_ATLAS.md'
      };
      state.activities.push(created);
      changes.push({
        collection: 'activities',
        kind: 'CREATE',
        id: created.id,
        label: name,
        fields: Object.keys(created),
        note: 'not present in the database; created without inventory (REQUEST_NOW)'
      });
      found.match = created;
    }

    if (!found.match) {
      changes.push({
        collection: 'activities',
        kind: found.ambiguous ? 'AMBIGUOUS' : 'UNMATCHED',
        id: researchId,
        label: name,
        target: found.suggestion?.id,
        fields: [],
        note: found.ambiguous
          ? 'several activities match equally well'
          : found.suggestion
            ? `closest is ${found.suggestion.id} - too weak to act on`
            : 'no matching activity'
      });
      continue;
    }
    const activity = found.match;

    const price = numberRange(cell(row, 'price'));
    // Backfills durationMinutes on activities created by earlier import runs
    // (which set it to null). merge() only writes absent/empty fields, so a
    // curated duration already on the record is never overwritten.
    const idealHours = numberRange(cell(row, 'ideal duration'));
    const applied = merge(
      activity,
      {
        researchId,
        skillLevel: cell(row, 'skill level'),
        bookingModality: cell(row, 'booking modality'),
        idealDuration: cell(row, 'ideal duration'),
        durationMinutes: idealHours
          ? Math.round(((idealHours.min + idealHours.max) / 2) * 60)
          : null,
        equipmentNeeded: cell(row, 'equipment', 'prep'),
        observedPriceRangeEGP: price ? { min: price.min, max: price.max } : null
      },
      overwrite
    );
    if (applied.length) {
      changes.push({
        collection: 'activities',
        kind: 'ENRICH',
        id: activity.id,
        label: name,
        target: activity.titleEn || activity.id,
        fields: applied
      });
    }
  }
}

function importDining(state: Record<string, Entity[]>, overwrite: boolean) {
  const table = tableFrom('DAHAB_FOOD_RESEARCH.md', 'venue id', 'name');
  if (!table) return;

  for (const row of table.rows) {
    const name = cell(row, 'name');
    const researchId = cell(row, 'venue id');
    const price = numberRange(cell(row, 'price range'));
    const additions = {
      researchId,
      signatureDish: cell(row, 'signature dish'),
      walkTimeFromLighthouse: cell(row, 'walk time'),
      paymentMethods: listOf(cell(row, 'payment method')),
      observedPriceRangeEGP: price ? { min: price.min, max: price.max } : null,
      dietaryOptionsResearch: listOf(cell(row, 'dietary'))
    };

    const aliasId = DINING_ALIASES[researchId];
    const aliased = aliasId ? state.diningVenues.find(v => v.id === aliasId) : undefined;
    const found = aliased
      ? { match: aliased, suggestion: aliased, ambiguous: false }
      : bestMatch(name, state.diningVenues, v => `${v.nameEn || ''}`);

    if (found.match) {
      const applied = merge(found.match, additions, overwrite);
      if (applied.length) {
        changes.push({
          collection: 'diningVenues',
          kind: 'ENRICH',
          id: found.match.id,
          label: name,
          target: found.match.nameEn,
          fields: applied
        });
      }
      continue;
    }

    // Creation is opt-in, never a fallback. A missed match and a genuine gap
    // look identical here, and defaulting to "new" produced a second Yum Yum in
    // an earlier draft, so only the curated NEW_DINING list decides.
    if (!NEW_DINING.has(researchId)) {
      changes.push({
        collection: 'diningVenues',
        kind: found.ambiguous ? 'AMBIGUOUS' : 'UNMATCHED',
        id: researchId,
        label: name,
        target: found.suggestion?.id,
        fields: [],
        note: found.suggestion
          ? `closest is ${found.suggestion.nameEn} - add an alias if that is the same venue`
          : 'no matching venue, and not listed as a new one'
      });
      continue;
    }

    const id = `dining_${researchId.replace(/^rest-/, '').replace(/-/g, '_')}`;
    if (state.diningVenues.some(v => v.id === id)) continue;

    const venue: Entity = {
      id,
      nameEn: name,
      nameAr: cell(row, 'arabic name'),
      // '' not null: DahabDiningVenue.areaId is string, and areaLabel() in the
      // dining mapper opens with areaId.split('_').
      areaId: matchAreaId(state, cell(row, 'zone')) ?? '',
      // listOf, not the raw cell: DahabDiningVenue.cuisine is string[], and a
      // bare string here reached the UI as `'Egyptian'.slice(0, 4).map(...)`.
      cuisine: listOf(cell(row, 'cuisine')),
      // No observed price: the mid band is the honest default, in the
      // vocabulary the rest of the system reads.
      priceBand: price ? bandFor(price.max) : ('Moderate ($$)' satisfies DiningPriceBand),
      averageMealPriceEGP: price ? Math.round((price.min + price.max) / 2) : null,
      seatingStyle: '',
      // The type declares four booleans, not a list of free-text labels.
      dietaryOptions: toDietaryOptions(listOf(cell(row, 'dietary'))),
      wifiNomadFriendly: false,
      openingHours: '',
      bookingEligibility: 'WALK_IN',
      supplierId: null,
      source: 'docs/research/DAHAB_FOOD_RESEARCH.md',
      ...additions
    };
    state.diningVenues.push(venue);
    changes.push({
      collection: 'diningVenues',
      kind: 'CREATE',
      id,
      label: name,
      fields: Object.keys(venue),
      note: 'not present in the database'
    });
  }
}

/**
 * The band for an observed maximum meal price.
 *
 * Returns the display labels declared by DahabDiningVenue.priceBand. This used
 * to return 'BUDGET' | 'MID' | 'PREMIUM', a second vocabulary nothing else in
 * the codebase understood: the restaurants page filters by exact membership of
 * the three labels below, so every venue this function touched was dropped from
 * the grid with no filter that could reveal it.
 */
const bandFor = (max: number): DiningPriceBand =>
  max <= 200 ? 'Budget ($)' : max <= 600 ? 'Moderate ($$)' : 'Premium ($$$)';

function matchAreaId(state: Record<string, Entity[]>, zone: string): string | null {
  if (!zone) return null;
  const found = bestMatch(zone, state.areaProfiles, a => `${a.nameEn || ''} ${a.id || ''}`);
  return found.match ? found.match.id : null;
}

function importEmergency(state: Record<string, Entity[]>, overwrite: boolean) {
  const table = tableFrom('DAHAB_EMERGENCY_RESOURCE_REGISTER.md', 'resource name', 'hotlines');
  if (!table) return;

  for (const row of table.rows) {
    const name = cell(row, 'resource name');
    const additions = {
      hotlines: listOf(cell(row, 'hotlines')),
      responseProtocol: cell(row, 'response protocol'),
      addressResearch: cell(row, 'address'),
      researchCoordinates: coordinates(cell(row, 'address', 'coordinates'))
    };

    const aliasId = EMERGENCY_ALIASES[name];
    const aliased = aliasId ? state.emergencyResources.find(r => r.id === aliasId) : undefined;
    const found = aliased
      ? { match: aliased, suggestion: aliased, ambiguous: false }
      : bestMatch(name, state.emergencyResources, r => `${r.nameEn || r.name || ''}`);

    if (found.match) {
      const applied = merge(found.match, additions, overwrite);
      if (applied.length) {
        changes.push({
          collection: 'emergencyResources',
          kind: 'ENRICH',
          id: found.match.id,
          label: name,
          target: found.match.nameEn || found.match.name,
          fields: applied
        });
      }
      continue;
    }

    // Never invented. The emergency register is what a traveller in trouble is
    // shown, so a duplicated or half-known hospital entry is worse than a
    // missing field. An unmatched row is reported for a human to map.
    changes.push({
      collection: 'emergencyResources',
      kind: found.ambiguous ? 'AMBIGUOUS' : 'UNMATCHED',
      id: '-',
      label: name,
      target: found.suggestion?.id,
      fields: [],
      note: found.suggestion
        ? `closest is ${found.suggestion.nameEn || found.suggestion.name} - add an alias if that is the same resource`
        : 'no matching emergency resource'
    });
  }
}

function importSeasonality(state: Record<string, Entity[]>, overwrite: boolean) {
  const table = tableFrom('DAHAB_SEASONALITY_MATRIX.md', 'month', 'sea temp');
  if (!table) return;

  const MONTHS = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  for (const row of table.rows) {
    const monthName = cell(row, 'month').toLowerCase().trim();
    const index = MONTHS.indexOf(monthName);
    if (index < 0) continue;

    const month = String(index + 1).padStart(2, '0');
    const facts: Array<[string, string, unknown]> = [
      ['seaTemperatureC', cell(row, 'sea temp'), firstNumber(cell(row, 'sea temp'))],
      ['airTemperatureC', cell(row, 'air temp'), cell(row, 'air temp')],
      ['windConditions', cell(row, 'wind'), cell(row, 'wind')],
      ['crowdAndPricingTier', cell(row, 'crowd'), cell(row, 'crowd')],
      ['recommendedActivities', cell(row, 'recommended activities'), cell(row, 'recommended activities')],
      ['operationalAlerts', cell(row, 'operational alerts', 'key operational'), cell(row, 'operational alerts', 'key operational')]
    ];

    for (const [predicate, raw, value] of facts) {
      if (!raw) continue;
      const id = `FACT-SEASON-${month}-${predicate.toUpperCase()}`;
      const existing = state.temporalFacts.find(f => f.id === id);
      const fact: Entity = {
        id,
        subjectId: 'DAHAB_DESTINATION',
        subjectType: 'Destination',
        predicate,
        value,
        primarySourceId: 'DAHAB_FIELD_AUDIT_Q3_2026',
        sourceType: 'APPROVED_OPERATIONAL',
        observedAt: '2026-08-01T00:00:00.000Z',
        verifiedAt: '2026-08-01T00:00:00.000Z',
        // Bounded to the month it describes, which is the whole point of
        // modelling seasonality as temporal facts rather than as a static table.
        validFrom: `2026-${month}-01T00:00:00.000Z`,
        validUntil: `2027-${month}-01T00:00:00.000Z`,
        confidence: 0.92,
        confidenceTier: 'HIGH',
        status: 'CURRENT',
        verificationOwner: 'Platform Ground Ops',
        source: 'docs/research/DAHAB_SEASONALITY_MATRIX.md'
      };

      if (existing) {
        const applied = merge(existing, fact, overwrite);
        if (applied.length) {
          changes.push({
            collection: 'temporalFacts',
            kind: 'ENRICH',
            id,
            label: `${monthName} ${predicate}`,
            fields: applied
          });
        }
      } else {
        state.temporalFacts.push(fact);
        changes.push({
          collection: 'temporalFacts',
          kind: 'CREATE',
          id,
          label: `${monthName} ${predicate}`,
          fields: ['value']
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes('--apply');
  const overwrite = argv.includes('--overwrite');

  const dbFile = SQLITE_FILE();
  if (!fs.existsSync(dbFile)) {
    console.error(`No database at ${dbFile}. Run: npm run db:migrate`);
    process.exit(1);
  }

  const sqlite = new Database(dbFile);
  sqlite.pragma('foreign_keys = ON');

  // Load only the collections this importer touches.
  const state: Record<string, Entity[]> = {};
  const touched = ['places', 'activities', 'diningVenues', 'emergencyResources', 'areaProfiles', 'temporalFacts'];
  for (const collection of touched) {
    const spec = SPEC_BY_COLLECTION.get(collection)!;
    state[collection] = (
      sqlite.prepare(`SELECT data FROM ${spec.table} ORDER BY seq`).all() as Array<{ data: string }>
    ).map(r => JSON.parse(r.data));
  }

  console.log(`Research : ${RESEARCH_DIR}`);
  console.log(`Database : ${dbFile}`);
  console.log(`Mode     : ${apply ? 'APPLY' : 'dry run (nothing written)'}${overwrite ? ' + overwrite' : ''}`);
  console.log('');

  importPlaces(state, overwrite);
  importDiveSites(state, overwrite);
  importActivities(state, overwrite);
  importDining(state, overwrite);
  importEmergency(state, overwrite);
  importSeasonality(state, overwrite);

  // Report
  const byKind = (kind: Change['kind']) => changes.filter(c => c.kind === kind);
  for (const kind of ['CREATE', 'ENRICH', 'UNMATCHED', 'AMBIGUOUS'] as const) {
    const group = byKind(kind);
    if (!group.length) continue;
    console.log(`${kind} (${group.length})`);
    for (const c of group) {
      const detail =
        kind === 'ENRICH'
          ? `+${c.fields.join(', +')}`
          : kind === 'CREATE'
            ? c.note || ''
            : c.note || '';
      const arrow = c.target && c.kind === 'ENRICH' ? `${c.label}  ->  ${c.target}` : c.label;
      console.log(`  ${c.collection.padEnd(18)} ${c.id.padEnd(34)} ${arrow}`);
      if (detail) console.log(`  ${' '.repeat(18)} ${' '.repeat(34)} ${detail}`);
    }
    console.log('');
  }

  if (!changes.length) {
    console.log('Nothing to do — the research is already reflected in the database.');
    sqlite.close();
    return;
  }

  if (!apply) {
    console.log(`${changes.length} change(s) planned. Re-run with --apply to write them.`);
    sqlite.close();
    return;
  }

  const write = sqlite.transaction(() => {
    for (const collection of touched) {
      const spec = SPEC_BY_COLLECTION.get(collection)!;
      const stmt = sqlite.prepare(upsertSql(spec));
      state[collection].forEach((entity, index) => stmt.run(entityToRow(spec, entity, index)));
    }
  });
  write();

  const created = byKind('CREATE').length;
  const enriched = byKind('ENRICH').length;
  console.log(`Applied: ${created} created, ${enriched} enriched.`);
  console.log('Run `npm run db:check` to confirm integrity.');
  sqlite.close();
}

main();
