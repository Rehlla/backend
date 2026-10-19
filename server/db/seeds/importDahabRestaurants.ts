import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import type { DiningVenueEntity } from '../schema';
import type { TripadvisorVenueRef, TripadvisorVenueReview } from '../../../src/shared/diningVenue';

export interface ImportRestaurantsResult {
  success: boolean;
  importedAt: string;
  total: number;
  created: number;
  enriched: number;
  /** Importer-owned rows removed because the seed no longer holds their
   *  listing (merged into a primary, or excluded as non-dining). */
  pruned: number;
  summary: string;
}

/** One row of data/dahab_restaurants.json (see scripts/build-restaurants-seed.ts). */
interface RestaurantSeed {
  locationId: string;
  rank: number | null;
  nameEn: string;
  nameAr: string;
  nameEnTransliterated: boolean;
  rating: number | null;
  reviewCount: number | null;
  cuisines: string[];
  cuisinesAr: string[];
  priceBand: DiningVenueEntity['priceBand'];
  priceRangeRaw: string | null;
  areaId: string;
  areaResolution: string;
  coordinates: { lat: number; lng: number } | null;
  telephone: string | null;
  streetAddress: string | null;
  postalCode: string | null;
  openingHours: string;
  openingHoursStructured: Record<string, { opens: string | null; closes: string | null }> | null;
  menuUrl: string | null;
  acceptsReservations: boolean | null;
  award: string | null;
  openStatus: string | null;
  coverImageUrl: string;
  tripadvisorUrl: string;
  sourceImageUrls: string[];
  quickReviews: string[];
  /** Latest full review texts (newest first, capped by the seed build). */
  reviews: TripadvisorVenueReview[];
  /** Secondary Tripadvisor listings of the same venue, kept for provenance. */
  duplicateListings?: string[];
  /** Kept separate but flagged for human review (possible duplicates). */
  reviewFlagged?: boolean;
}

/**
 * Tripadvisor locationId -> curated dining id, for the pairs the name matcher
 * below cannot see because Tripadvisor titles the venue in Arabic while the
 * corpus holds it in English. Same role as DINING_ALIASES in the research
 * importer: deterministic, auditable, and never a guess.
 */
const TRIPADVISOR_ALIASES: Record<string, string> = {
  // "يام يام" (rank 9) is the Yum Yum the corpus already curates.
  '2640106': 'dining_yum_yum_falafel',
  // "جاكيز" (rank 33) is Jackie's Mexican & Bedouin Lounge.
  '13577005': 'dining_jackies'
};

/**
 * Words that carry no identity for matching. "Shark Restaurant" and "Shark
 * Waterfront Grill & Seafood" must match on {shark} alone; "Restaurant",
 * "Waterfront", "Seafood" say nothing about WHICH venue this is in a town
 * where every second card says them.
 */
const GENERIC_NAME_TOKENS = new Set([
  'restaurant', 'cafe', 'café', 'coffee', 'the', 'dahab', 'seafood', 'waterfront',
  'grill', 'kitchen', 'kitchens', 'pizzeria', 'trattoria', 'bar', 'bistro',
  'music', 'lounge', 'authentic', 'egyptian', 'artisan', 'mexican', 'bedouin',
  'italian', 'and', 'seafront', 'juices', 'fresh', 'fish', 'sea', 'food',
  'view', 'camp', 'eco', 'banquet', 'stargazing', 'coastal', 'carpet'
]);

function distinctiveTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1 && !GENERIC_NAME_TOKENS.has(t))
  );
}

/**
 * Finds the corpus venue a Tripadvisor row describes, or null.
 *
 * Identity comes in three tiers, most exact first:
 *
 *   1. the alias table (listings Tripadvisor titles in Arabic while the
 *      corpus holds the venue in English — the name matcher cannot see them);
 *   2. a previous import's link (`tripadvisor.locationId`) — this is how
 *      re-runs land on the same row without any matching at all;
 *   3. distinctive-token name equality — against the CURATED corpus only.
 *
 * Tier 3 never runs over venues this importer created (`dining_ta_*`):
 * Tripadvisor legitimately holds near-identical listings ("Blue House Thai
 * Restaurant" and "Blue House Restaurant & Cafe", two "Miami Fish" rows)
 * whose identity is their locationId, not their names. Letting listings match
 * each other merged those twins into one venue and corrupted it on every
 * re-import — the exact "second Yum Yum" class of defect the research
 * importer's comments warn about.
 */
function matchVenue(entry: RestaurantSeed): DiningVenueEntity | null {
  const aliasedId = TRIPADVISOR_ALIASES[entry.locationId];
  if (aliasedId) {
    const aliased = db.diningVenues.find(v => v.id === aliasedId);
    if (aliased) return aliased;
  }
  // Re-run stability: a previous import already linked this listing.
  const linked = db.diningVenues.find(v => v.tripadvisor?.locationId === entry.locationId);
  if (linked) return linked;

  const entryTokens = distinctiveTokens(entry.nameEn);
  if (entryTokens.size === 0) return null;
  for (const venue of db.diningVenues) {
    if (venue.id.startsWith('dining_ta_')) continue;
    const venueTokens = distinctiveTokens(venue.nameEn);
    if (venueTokens.size === 0) continue;
    const shared = [...entryTokens].filter(t => venueTokens.has(t));
    const isSubset = shared.length === entryTokens.size || shared.length === venueTokens.size;
    if (shared.length > 0 && isSubset) return venue;
  }
  return null;
}

function tripadvisorRef(entry: RestaurantSeed): TripadvisorVenueRef {
  return {
    locationId: entry.locationId,
    url: entry.tripadvisorUrl,
    rating: entry.rating ?? undefined,
    reviewCount: entry.reviewCount ?? undefined,
    rank: entry.rank,
    priceRangeRaw: entry.priceRangeRaw,
    telephone: entry.telephone,
    streetAddress: entry.streetAddress,
    postalCode: entry.postalCode,
    menuUrl: entry.menuUrl,
    acceptsReservations: entry.acceptsReservations,
    award: entry.award,
    openStatus: entry.openStatus,
    quickReviews: entry.quickReviews,
    reviews: entry.reviews,
    openingHoursStructured: entry.openingHoursStructured,
    imageUrls: entry.sourceImageUrls,
    nameEnTransliterated: entry.nameEnTransliterated,
    ...(entry.duplicateListings && entry.duplicateListings.length
      ? { duplicateListings: entry.duplicateListings }
      : {}),
    ...(entry.reviewFlagged ? { reviewFlagged: true } : {})
  };
}

/**
 * Converges one seed row onto a venue record.
 *
 * Three kinds of field, three rules:
 *
 *   - Tripadvisor-mirror fields (rating, reviewCount, coverImageUrl,
 *     cuisineAr, openingHoursAr, the tripadvisor provenance object) REFRESH on
 *     every import: the seed is their authority, and ratings move between
 *     scrapes.
 *   - Platform fields on a CURATED venue (phone, openingHours, coordinates,
 *     cuisine, nameAr, area labels) only fill ABSENT values: a curated value a
 *     field researcher verified always wins over a listing — the same merge()
 *     rule the research importer documents.
 *   - Identity fields on an importer-OWNED venue (dining_ta_*) refresh fully:
 *     the seed is the authority for rows this module created, so a re-scrape
 *     that changes a venue's official English name, cuisines, hours or area
 *     converges the stored row instead of freezing the first import's values.
 */
function convergeVenue(venue: DiningVenueEntity, entry: RestaurantSeed, owned: boolean): boolean {
  let touched = false;
  const refresh = (key: keyof DiningVenueEntity, value: unknown) => {
    if (value === undefined) return;
    if (JSON.stringify(venue[key]) !== JSON.stringify(value)) {
      (venue as any)[key] = value;
      touched = true;
    }
  };
  const fill = (key: keyof DiningVenueEntity, value: unknown) => {
    if (value === undefined) return;
    const existing = venue[key];
    const isEmpty =
      existing === undefined ||
      existing === null ||
      existing === '' ||
      (Array.isArray(existing) && existing.length === 0);
    if (!isEmpty) return;
    (venue as any)[key] = value;
    touched = true;
  };

  refresh('tripadvisor', tripadvisorRef(entry));
  refresh('rating', entry.rating ?? undefined);
  refresh('reviewCount', entry.reviewCount ?? undefined);
  refresh('coverImageUrl', entry.coverImageUrl || undefined);
  refresh('cuisineAr', entry.cuisinesAr.length > 0 ? entry.cuisinesAr : undefined);
  refresh('openingHoursAr', entry.openingHours || undefined);
  fill('phone', entry.telephone || undefined);
  fill('openingHours', entry.openingHours || undefined);
  fill('coordinates', entry.coordinates ?? undefined);
  fill('cuisine', entry.cuisines.length > 0 ? entry.cuisines : undefined);
  fill('nameAr', entry.nameAr || undefined);
  const areaLabels = areaLabelsFor(entry.areaId);
  fill('areaName', areaLabels.nameEn);
  fill('areaNameAr', areaLabels.nameAr);

  if (owned) {
    // The seed is the authority for rows this importer created — including
    // the areaId itself and the identity fields a curated venue would own.
    refresh('nameEn', entry.nameEn);
    refresh('nameAr', entry.nameAr || undefined);
    refresh('cuisine', entry.cuisines.length > 0 ? entry.cuisines : undefined);
    refresh('openingHours', entry.openingHours || undefined);
    refresh('coordinates', entry.coordinates ?? undefined);
    refresh('phone', entry.telephone || undefined);
    const areaId =
      entry.areaId && db.areaProfiles.some(a => a.id === entry.areaId) ? entry.areaId : '';
    refresh('areaId', areaId);
    refresh('areaName', areaLabels.nameEn);
    refresh('areaNameAr', areaLabels.nameAr);
    // freshSeafoodCatch follows the cuisines the seed now declares.
    const freshSeafoodCatch = entry.cuisines.some(c => /seafood/i.test(c));
    if (venue.dietaryOptions && venue.dietaryOptions.freshSeafoodCatch !== freshSeafoodCatch) {
      venue.dietaryOptions = { ...venue.dietaryOptions, freshSeafoodCatch };
      touched = true;
    }
  }
  return touched;
}

/** Area display labels for a seed-resolved areaId, from the live area
 *  profiles; undefined members when the id resolves to nothing, so fill()
 *  never writes an empty label over and over. */
function areaLabelsFor(areaId: string): { nameEn?: string; nameAr?: string } {
  if (!areaId) return {};
  const area = db.areaProfiles.find(a => a.id === areaId);
  return area ? { nameEn: area.nameEn || undefined, nameAr: area.nameAr || undefined } : {};
}

/**
 * Idempotent import of the Tripadvisor-sourced Dahab restaurant catalogue.
 *
 * Reads the committed data/dahab_restaurants.json (boot-critical: THROWS when
 * missing, matching importDahabAccommodations' discipline — a checkout without
 * the seed cannot boot the restaurant directory) and converges it into
 * db.diningVenues:
 *
 *   - a row that describes an already-curated venue ENRICHES it (rating,
 *     review count, photo, phone, Tripadvisor link) without overwriting any
 *     curated value;
 *   - a row that describes no curated venue creates a new one with a stable
 *     id (`dining_ta_<locationId>`), so re-imports upsert in place.
 *
 * The philosophy is the one server/db/research/importResearch.ts documents:
 * enrich, don't blind-insert — otherwise the grid would carry "Shark
 * Restaurant" beside "Shark Waterfront Grill & Seafood" as two venues.
 */
export function importDahabRestaurants(): ImportRestaurantsResult {
  const datasetPath = seedPath('dahab_restaurants.json');
  if (!fs.existsSync(datasetPath)) {
    throw new Error(
      `Seed catalogue ${datasetPath} is missing. A checkout without it cannot boot the restaurants directory.`
    );
  }

  let raw: { restaurants?: RestaurantSeed[] };
  try {
    raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
  }

  const entries = raw.restaurants || [];
  const seenLocationIds = new Set<string>();
  for (const entry of entries) {
    if (!entry.locationId || !entry.nameEn) {
      throw new Error('Restaurant seed contains a row missing locationId or nameEn.');
    }
    if (seenLocationIds.has(entry.locationId)) {
      throw new Error(`Duplicate Tripadvisor locationId in seed: ${entry.locationId}.`);
    }
    seenLocationIds.add(entry.locationId);
  }

  let created = 0;
  let enriched = 0;
  let pruned = 0;

  for (const entry of entries) {
    const existing = matchVenue(entry);
    if (existing) {
      // Curated venue: mirror fields refresh, curated values win. A venue
      // this importer previously created reaches the same branch through the
      // locationId link — its dining_ta_ id marks it owned, so the seed
      // refreshes its identity too.
      if (convergeVenue(existing, entry, existing.id.startsWith('dining_ta_'))) enriched += 1;
      continue;
    }

    const id = `dining_ta_${entry.locationId}`;
    // An earlier run created it: re-converge in place, never duplicate. These
    // rows belong to this importer, so the seed refreshes their identity too.
    const prior = db.diningVenues.find(v => v.id === id);
    if (prior) {
      if (convergeVenue(prior, entry, true)) enriched += 1;
      continue;
    }

    // areaId rides into the row as given only when it names a real area
    // profile; anything else keeps '' — the "no area" the dining mapper
    // renders as blank rather than as somewhere it isn't.
    const areaId =
      entry.areaId && db.areaProfiles.some(a => a.id === entry.areaId) ? entry.areaId : '';
    const areaLabels = areaLabelsFor(areaId);

    const isSeafoodHouse = entry.cuisines.some(c => /seafood/i.test(c));
    const venue: DiningVenueEntity = {
      id,
      nameEn: entry.nameEn,
      nameAr: entry.nameAr,
      areaId,
      ...(entry.coordinates ? { coordinates: entry.coordinates } : {}),
      cuisine: entry.cuisines,
      priceBand: entry.priceBand,
      dietaryOptions: {
        // Halal is the norm for Dahab's kitchens and every curated venue
        // claims it; a listing that says otherwise is rare enough that a
        // human should say it first. The other flags stay unclaimed: the
        // listing proves none of them.
        vegan: false,
        vegetarian: false,
        halal: true,
        freshSeafoodCatch: isSeafoodHouse
      },
      wifiNomadFriendly: false,
      openingHours: entry.openingHours,
      ...(entry.openingHours ? { openingHoursAr: entry.openingHours } : {}),
      bookingEligibility: 'WALK_IN',
      ...(entry.rating !== null ? { rating: entry.rating } : {}),
      ...(entry.reviewCount !== null ? { reviewCount: entry.reviewCount } : {}),
      ...(entry.coverImageUrl ? { coverImageUrl: entry.coverImageUrl } : {}),
      ...(entry.telephone ? { phone: entry.telephone } : {}),
      ...(entry.cuisinesAr.length > 0 ? { cuisineAr: entry.cuisinesAr } : {}),
      ...(areaLabels.nameEn ? { areaName: areaLabels.nameEn } : {}),
      ...(areaLabels.nameAr ? { areaNameAr: areaLabels.nameAr } : {}),
      source: 'data/dahab_restaurants.json (Tripadvisor listings)',
      tripadvisor: tripadvisorRef(entry)
    };
    db.diningVenues.push(venue);
    created += 1;
  }

  // Prune importer-owned rows the seed no longer holds. A re-scrape can merge
  // an accidental double-listing into its primary or exclude a non-dining
  // entry; the rows an earlier import created for those listings have no seed
  // row to converge onto, so this boot is the last one that may hold them.
  // Curated venues are never pruned — they are not this importer's to remove.
  for (let i = db.diningVenues.length - 1; i >= 0; i--) {
    const venue = db.diningVenues[i];
    if (
      venue.id.startsWith('dining_ta_') &&
      venue.tripadvisor?.locationId &&
      !seenLocationIds.has(venue.tripadvisor.locationId)
    ) {
      db.diningVenues.splice(i, 1);
      pruned += 1;
    }
  }

  // The collections above were mutated in memory; the adapters persist on
  // save, not on every mutation — the same contract dahabKnowledgeOs honors
  // after seedInto. Without this, a boot imports into memory and the next
  // process restart silently loses the whole catalogue.
  db.saveToDisk();

  return {
    success: true,
    importedAt: new Date().toISOString(),
    total: entries.length,
    created,
    enriched,
    pruned,
    summary:
      `Tripadvisor restaurants catalogue imported: ${entries.length} listings ` +
      `(${created} created, ${enriched} enriched, ${pruned} pruned).`
  };
}
