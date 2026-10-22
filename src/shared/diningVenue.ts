import { canonicalPriceBand } from './priceBand';

/**
 * Repairs, on read, the dining rows the research importer wrote against the
 * wrong shapes.
 *
 * `importResearch.ts` built its venue objects field-by-field without ever being
 * checked against `DahabDiningVenue`, and got four fields wrong on the rows it
 * created:
 *
 *   - `priceBand` was written from a second vocabulary ('BUDGET' | 'MID' |
 *     'PREMIUM') that nothing else in the codebase reads.
 *   - `cuisine` was written as the raw spreadsheet cell — a string — where the
 *     type declares `string[]`.
 *   - `areaId` was written as `null` whenever the row's zone matched no known
 *     area, where the type declares `string`.
 *   - `dietaryOptions` was written as a list of free-text labels
 *     (`['Vegetarian', 'Vegan Pizza options']`) where the type declares an
 *     object of four booleans.
 *
 * The defects hid one another. The restaurants grid filtered by exact
 * membership of the three canonical price labels, so all four affected venues
 * (Athanor, Jackie's, Friends, King Chicken) were dropped before anything tried
 * to render them. Fixing the band made them visible and the string `cuisine`
 * immediately crashed the card: `'Egyptian'.slice(0, 4).map` is not a function.
 *
 * The `areaId` one is the crash that took /food down: the dining mapper calls
 * `areaLabel(venue.areaId)`, which opens with `areaId.split('_')`.
 *
 * Normalising here rather than only in the importer is deliberate — the rows
 * are already in the store, and a restore from any existing backup brings them
 * back.
 */

/** The four flags DahabDiningVenue.dietaryOptions declares. */
export interface DiningDietaryOptions {
  vegan: boolean;
  vegetarian: boolean;
  halal: boolean;
  freshSeafoodCatch: boolean;
}

/** One Tripadvisor review text captured for a venue. Mirrors the extractor
 *  shape: newest first, capped per venue by the seed build. */
export interface TripadvisorVenueReview {
  rId: string | null;
  author: string | null;
  rating: number | null;
  title: string | null;
  visitDate: string | null;
  tripType: string | null;
  written: string | null;
  language: string | null;
  truncated: boolean;
  text: string | null;
}
/**
 * Tripadvisor provenance for venues imported from data/dahab_restaurants.json
 * (see server/db/seeds/importDahabRestaurants.ts).
 *
 * Everything here is a copy of what the scrape observed — rating, review
 * count and photos are Tripadvisor's, not measurements this platform took.
 * Re-scrape and re-run scripts/build-restaurants-seed.ts to refresh them.
 */
export interface TripadvisorVenueRef {
  locationId: string;
  url: string;
  rating?: number;
  reviewCount?: number;
  rank?: number | null;
  priceRangeRaw?: string | null;
  telephone?: string | null;
  streetAddress?: string | null;
  postalCode?: string | null;
  menuUrl?: string | null;
  acceptsReservations?: boolean | null;
  award?: string | null;
  openStatus?: string | null;
  quickReviews?: string[];
  /** Latest full review texts captured for this venue (newest first, capped
   *  by the seed build). Refreshed wholesale with the rest of this object. */
  reviews?: TripadvisorVenueReview[];
  openingHoursStructured?: Record<string, { opens: string | null; closes: string | null }> | null;
  imageUrls?: string[];
  nameEnTransliterated?: boolean;
  /** Secondary Tripadvisor locationIds of the same physical venue, merged
   *  into this row by the seed build (see scripts/build-restaurants-seed.ts). */
  duplicateListings?: string[];
  /** This row was kept separate from a near-identical listing but the build
   *  flagged it for human review. */
  reviewFlagged?: boolean;
}
/**
 * Coerces `dietaryOptions` into the declared object.
 *
 * The importer wrote free-text labels, so the booleans are recovered by
 * matching those labels. Anything unrecognised simply leaves a flag false —
 * this reads what the corpus said, it does not guess beyond it.
 */
export function toDietaryOptions(raw: unknown): DiningDietaryOptions {
  const empty: DiningDietaryOptions = {
    vegan: false,
    vegetarian: false,
    halal: false,
    freshSeafoodCatch: false,
  };

  if (Array.isArray(raw)) {
    const text = raw.filter(x => typeof x === 'string').join(' ').toLowerCase();
    return {
      vegan: /vegan/.test(text),
      vegetarian: /vegetarian/.test(text),
      halal: /halal/.test(text),
      freshSeafoodCatch: /seafood|fresh catch|fish/.test(text),
    };
  }

  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return {
      vegan: o.vegan === true,
      vegetarian: o.vegetarian === true,
      halal: o.halal === true,
      freshSeafoodCatch: o.freshSeafoodCatch === true,
    };
  }

  return empty;
}

/** Coerces the corpus's `cuisine` into the list every consumer expects. */
export function toCuisineList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((c): c is string => typeof c === 'string' && c.trim().length > 0);
  }
  if (typeof raw === 'string') {
    // The importer's cell values are comma or slash separated.
    return raw
      .split(/[,/|]/)
      .map(c => c.trim())
      .filter(Boolean);
  }
  return [];
}

/**
 * Returns the venue with every repaired field in its declared shape.
 *
 * The same object is returned untouched when nothing needed repair, so this is
 * cheap on the healthy majority of rows. An unrecognised price band is left
 * exactly as stored — a visible odd label is better than a silently missing
 * restaurant, which is the failure this whole module exists to undo.
 */
export function normalizeDiningVenue<
  T extends { priceBand?: unknown; cuisine?: unknown; areaId?: unknown; dietaryOptions?: unknown }
>(venue: T): T {
  const band = canonicalPriceBand(venue.priceBand);
  const cuisine = toCuisineList(venue.cuisine);
  const dietaryOptions = toDietaryOptions(venue.dietaryOptions);

  const bandChanged = band !== null && band !== venue.priceBand;
  const cuisineChanged = !Array.isArray(venue.cuisine) || cuisine.length !== venue.cuisine.length;
  const areaChanged = typeof venue.areaId !== 'string';
  const dietChanged =
    !venue.dietaryOptions ||
    typeof venue.dietaryOptions !== 'object' ||
    Array.isArray(venue.dietaryOptions);

  if (!bandChanged && !cuisineChanged && !areaChanged && !dietChanged) return venue;

  return {
    ...venue,
    ...(bandChanged ? { priceBand: band } : {}),
    ...(cuisineChanged ? { cuisine } : {}),
    // Empty, not invented: a venue whose zone matched no known area has no
    // area, and the UI renders that as blank rather than as somewhere it isn't.
    ...(areaChanged ? { areaId: '' } : {}),
    ...(dietChanged ? { dietaryOptions } : {}),
  };
}
