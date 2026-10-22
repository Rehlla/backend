/**
 * The dining price-band vocabulary, and a coercion for the legacy one.
 *
 * `DahabDiningVenue.priceBand` has always been declared as the three display
 * labels below. The research importer, however, wrote a different vocabulary —
 * `bandFor()` in server/db/research/importResearch.ts returned
 * 'BUDGET' | 'MID' | 'PREMIUM', and defaulted to 'MID' when a row carried no
 * price. Nothing type-checked that boundary, so four venues (Athanor, Jackie's,
 * Friends, King Chicken) sit in the store with `priceBand: 'MID'`.
 *
 * The consequence was not a cosmetic one. RestaurantsView filters by exact
 * membership of the three canonical labels, so those four venues were dropped
 * from the grid on every render, with no filter a traveller could switch off to
 * bring them back — the page said "15 Restaurants" in its stats and listed 11.
 *
 * Coercing on the read path rather than only fixing the importer is deliberate:
 * the rows are already written, and any store restored from an older backup
 * will carry them again.
 */

export const DINING_PRICE_BANDS = [
  'Budget ($)',
  'Moderate ($$)',
  'Premium ($$$)',
] as const;

export type DiningPriceBand = (typeof DINING_PRICE_BANDS)[number];

/**
 * Legacy spellings, lower-cased, mapped onto the canonical label.
 *
 * Keyed on the lower-cased form so a future importer writing 'Mid' or 'mid'
 * lands in the same place.
 */
const LEGACY_BANDS: Readonly<Record<string, DiningPriceBand>> = {
  budget: 'Budget ($)',
  mid: 'Moderate ($$)',
  moderate: 'Moderate ($$)',
  premium: 'Premium ($$$)',
};

/**
 * The canonical band for a stored value.
 *
 * Returns null rather than guessing when the value is neither canonical nor a
 * known legacy spelling — callers decide whether an unrecognised band means
 * "hide" or "show anyway", and this module does not make that choice for them.
 */
export function canonicalPriceBand(raw: unknown): DiningPriceBand | null {
  if (typeof raw !== 'string') return null;

  const trimmed = raw.trim();
  if ((DINING_PRICE_BANDS as readonly string[]).includes(trimmed)) {
    return trimmed as DiningPriceBand;
  }

  return LEGACY_BANDS[trimmed.toLowerCase()] ?? null;
}

/**
 * Whether two band values mean the same thing once legacy spellings are
 * resolved. Used by the `?price=` filter so `price=Moderate ($$)` also matches
 * a row still stored as 'MID'.
 */
export function priceBandMatches(stored: unknown, wanted: unknown): boolean {
  const a = canonicalPriceBand(stored);
  const b = canonicalPriceBand(wanted);
  if (a && b) return a === b;
  // Neither resolves: fall back to a case-insensitive literal comparison so an
  // unrecognised band is still filterable rather than silently unmatchable.
  return String(stored ?? '').trim().toLowerCase() === String(wanted ?? '').trim().toLowerCase();
}
