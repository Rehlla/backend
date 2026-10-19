import { db } from '../db/database';
import { resolveBookability, ResolvedBookability } from './bookabilityReconciler';
import { CommerceServiceType } from '../db/schema';

/**
 * Availability-joined trip generation.
 *
 * The AI prompt now outputs *draft* prices (best-effort from its training
 * data). This service replaces every hallucinated number with the actual
 * database price and attaches real bookability, so the traveler sees exactly
 * what the platform can sell, not what the model imagined.
 *
 * Rule: if no bookable SKU exists for a given activity, `priceEGP` is set to
 * 0 and `bookable` is false. A bookable price is *never* overridden — the
 * database is always authoritative.
 */

export interface EnrichedActivity {
  /** Original AI id (e.g. "act-1-2"). */
  id: string;
  title: string;
  titleAr: string;
  timeSlot: string;
  location: string;
  category: string;
  description: string;
  descriptionAr: string;

  /** Real price from the database (0 when unbookable). */
  priceEGP: number;
  /** Whether this item can be held/checked-out right now. */
  bookable: boolean;
  /** Present when bookable — the SKU to pass to /api/commerce/hold. */
  skuId?: string;
  /** Human-readable why-not when unbookable (e.g. "no_active_sku"). */
  unbookableReason?: string;
  /** Resolved bookability detail when bookable. */
  bookability?: ResolvedBookability;
}

export interface EnrichedDay {
  dayNumber: number;
  title: string;
  titleAr: string;
  theme: string;
  activities: EnrichedActivity[];
  /** Sum of bookable item prices for this day. */
  dayTotalEGP: number;
}

export interface EnrichedTrip {
  tripTitle: string;
  tripTitleAr: string;
  summary: string;
  summaryAr: string;
  fitScore: number;
  days: EnrichedDay[];
  /** Total across all days (bookable + non-bookable known prices). */
  totalEstimatedEGP: number;
  /** How many activities the platform can actually sell. */
  bookableCount: number;
  /** Total activities across all days. */
  totalCount: number;
  /** Percent of the itinerary that is immediately purchasable. */
  bookablePercent: number;
}

/**
 * Authoritative price for a SKU, or null when the SKU is missing/inactive.
 *
 * Shared by the itinerary enricher and /api/trip/apply-ai: a persisted AI
 * plan can never carry a price the client invented — when a SKU is present,
 * the database is the only source of truth.
 */
export function resolveSkuPrice(skuId: string): { priceEGP: number; serviceType: string } | null {
  const sku = db.productSkus.find(s => s.id === skuId && s.active);
  return sku ? { priceEGP: sku.basePriceEGP, serviceType: sku.serviceType } : null;
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

interface SkuCandidate {
  skuId: string;
  priceEGP: number;
  serviceType: CommerceServiceType;
  bookability: ResolvedBookability;
}

/** Active SKUs indexed once per call (the DB is small; no need to memoize). */
function activeSkuIndex(): SkuCandidate[] {
  return db.productSkus
    .filter(sku => sku.active)
    .map(sku => {
      const resolved = resolveBookability(sku.id);
      return resolved ? { skuId: sku.id, priceEGP: sku.basePriceEGP, serviceType: sku.serviceType, bookability: resolved } : null;
    })
    .filter((c): c is SkuCandidate => c !== null);
}

/** Map AI category labels to the serviceType taxonomy used by productSkus. */
function categoryToServiceTypes(category: string): CommerceServiceType[] {
  const c = category.toLowerCase();
  if (c === 'diving' || c === 'snorkel' || c === 'snorkeling') return ['diving'];
  if (c === 'transfer') return ['transfer'];
  if (c === 'safari' || c === 'adventure' || c === 'excursion') return ['safari'];
  if (c === 'food' || c === 'dining') return ['dining'];
  if (c === 'rental' || c === 'bike' || c === 'kite') return ['rental'];
  if (c === 'accommodation') return ['hotel'];
  if (c === 'wellness') return ['wellness'];
  return [];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Fuzzy relevance: returns 0–1 for how well a SKU matches an activity.
 * The AI gives us titles like "Lighthouse Sunset Snorkel"; the SKU might be
 * named "Lighthouse Guided Snorkel Tour" or carry a description mentioning
 * "lighthouse snorkel".
 */
function relevance(activityTitle: string, skuTitle: string, skuDesc: string): number {
  const aWords = new Set(normalize(activityTitle).split(' '));
  const sWords = new Set(normalize(skuTitle).split(' '));
  const dWords = new Set(normalize(skuDesc).split(' '));

  let score = 0;
  // Word overlap with the SKU title.
  for (const w of aWords) { if (sWords.has(w)) score += 0.15; }
  // Word overlap with the SKU description (weaker).
  for (const w of aWords) { if (dWords.has(w)) score += 0.05; }
  return Math.min(score, 1);
}

function findBestMatch(
  activity: { title: string; category: string },
  candidates: SkuCandidate[],
  skuTitle: (skuId: string) => string,
  skuDesc: (skuId: string) => string,
): SkuCandidate | null {
  const types = categoryToServiceTypes(activity.category);
  if (types.length === 0) return null;
  const filtered = candidates.filter(c => types.includes(c.serviceType));
  if (filtered.length === 0) return null;

  let best: SkuCandidate | null = null;
  let bestScore = 0;
  for (const c of filtered) {
    const score = relevance(activity.title, skuTitle(c.skuId), skuDesc(c.skuId));
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  // Require at least 0.15 relevance to avoid random pairings.
  return bestScore >= 0.15 ? best : null;
}

// ---------------------------------------------------------------------------
// Enrichment
// ---------------------------------------------------------------------------

export function enrichItinerary(raw: any): EnrichedTrip {
  const candidates = activeSkuIndex();

  // Build a lookup for accommodation names/descriptions (they live in
  // `accommodations`, not `productSkus`).
  const accBySku = new Map(db.accommodations.map(a => [a.skuId, a]));
  const rentalBySku = new Map(db.rentalListings.map(r => [r.skuId, r]));

  const skuTitle = (skuId: string): string => {
    const acc = accBySku.get(skuId);
    if (acc) return `${acc.name} ${acc.nameAr}`;
    const rent = rentalBySku.get(skuId);
    if (rent) return `${rent.name} ${rent.nameAr}`;
    const sku = db.productSkus.find(s => s.id === skuId);
    return sku?.title || '';
  };

  const skuDesc = (skuId: string): string => {
    const acc = accBySku.get(skuId);
    if (acc) return `${acc.description} ${acc.descriptionAr}`;
    const rent = rentalBySku.get(skuId);
    if (rent) return `${rent.description} ${rent.descriptionAr}`;
    const sku = db.productSkus.find(s => s.id === skuId);
    return sku?.description || '';
  };

  const days: EnrichedDay[] = (raw.days || []).map((day: any) => {
    const activities: EnrichedActivity[] = (day.activities || []).map((act: any) => {
      const match = findBestMatch(act, candidates, skuTitle, skuDesc);

      if (match) {
        return {
          id: act.id,
          title: act.title,
          titleAr: act.titleAr || '',
          timeSlot: act.timeSlot || '',
          location: act.location || '',
          category: act.category || '',
          description: act.description || '',
          descriptionAr: act.descriptionAr || '',
          priceEGP: match.priceEGP,
          bookable: true,
          skuId: match.skuId,
          bookability: match.bookability,
        };
      }

      // No SKU found: mark as unbookable with zero price so the traveler
      // never sees a hallucinated number next to a "not available" item.
      return {
        id: act.id,
        title: act.title,
        titleAr: act.titleAr || '',
        timeSlot: act.timeSlot || '',
        location: act.location || '',
        category: act.category || '',
        description: act.description || '',
        descriptionAr: act.descriptionAr || '',
        priceEGP: 0,
        bookable: false,
        unbookableReason: 'no_active_sku',
      };
    });

    const dayTotalEGP = activities.reduce((sum, a) => sum + (a.bookable ? a.priceEGP : 0), 0);
    return { ...day, activities, dayTotalEGP };
  });

  const allActivities = days.flatMap(d => d.activities);
  const bookableCount = allActivities.filter(a => a.bookable).length;
  const totalCount = allActivities.length;
  // Total only sums *bookable* prices — the trustworthy number.
  const totalEstimatedEGP = days.reduce((sum, d) => sum + d.dayTotalEGP, 0);

  return {
    tripTitle: raw.tripTitle || 'Dahab Trip',
    tripTitleAr: raw.tripTitleAr || 'رحلة دهب',
    summary: raw.summary || '',
    summaryAr: raw.summaryAr || '',
    fitScore: raw.fitScore || 90,
    days,
    totalEstimatedEGP,
    bookableCount,
    totalCount,
    bookablePercent: totalCount > 0 ? Math.round((bookableCount / totalCount) * 100) : 0,
  };
}

/**
 * Enrich a trip and return both the enriched version and the original raw
 * itinerary (so the client can still show the full AI narrative alongside the
 * bookable prices).
 */
export function enrichTripWithAvailability(raw: any): { raw: any; enriched: EnrichedTrip } {
  return { raw, enriched: enrichItinerary(raw) };
}
