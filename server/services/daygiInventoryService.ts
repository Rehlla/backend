import { db } from '../db/database';
import type { DayGiMultiOptionItem, DayGiMultiOptionResult } from '../../src/shared';
import type { SupplierOfferEntity } from '../db/schema';
import { resolveBookability } from './bookabilityReconciler';

/**
 * Real-inventory option sourcing for DayGI.
 *
 * The previous post-activity branch always showed the same three hardcoded
 * options (Ali Baba, Everyday Cafe, Lighthouse Snorkel) regardless of what
 * real suppliers had verified offers for. This module queries the
 * `supplierOffers` table — populated at boot from
 * `dahab_local_commerce.json` via `importDahabLocalCommerce()` — so the
 * options canvas carries genuine supplier data: real names, real prices,
 * real inclusions, real verification status.
 *
 * Offers are deduplicated by activity (cheapest wins), filtered to Active
 * suppliers with real prices, and categorized from the supplier's domain.
 */

interface InventoryOptionContext {
  /** Preferred categories to pick from ('FOOD', 'RELAX', 'ACTIVITY', 'CULTURE'). */
  categories?: string[];
  /** Max options to return (default 3). */
  maxOptions?: number;
  /** Min price (EGP) — filters out free/no-price offers when set. */
  minPriceEGP?: number;
  /** Max price (EGP). */
  maxPriceEGP?: number;
  /** Text to match against activity names (case-insensitive). */
  searchText?: string;
}

const DEFAULT_CATEGORIES = ['ACTIVITY', 'RELAX', 'FOOD', 'CULTURE'];

function classifyOffer(offer: SupplierOfferEntity): DayGiMultiOptionItem['category'] {
  const name = (offer.sourceActivityName || '').toLowerCase();
  const supplierCat = offer.canonicalCategory?.toLowerCase() || '';
  if (name.includes('dive') || name.includes('snorkel') || name.includes('safari') ||
      name.includes('trek') || name.includes('climb') || name.includes('quad') ||
      name.includes('yacht') || name.includes('boat') || supplierCat === 'diving') {
    return 'ACTIVITY';
  }
  if (name.includes('tea') || name.includes('cafe') || name.includes('relax') || supplierCat === 'hotel') {
    return 'RELAX';
  }
  if (name.includes('food') || name.includes('lunch') || name.includes('buffet') || supplierCat === 'restaurant') {
    return 'FOOD';
  }
  return 'ACTIVITY';
}

function buildWhyItFits(offer: SupplierOfferEntity, lang: 'en' | 'ar'): string {
  const includes = offer.includes?.slice(0, 3).join(', ');
  const duration = offer.duration;
  const departure = offer.departureTime;
  if (lang === 'ar') {
    const parts: string[] = [];
    if (includes) parts.push(`يشمل: ${includes}`);
    if (duration) parts.push(`المدة: ${duration}`);
    if (departure) parts.push(`انطلاق ${departure}`);
    return parts.join(' · ') || 'عرض موثق من مورّد محلي معتمد';
  }
  const parts: string[] = [];
  if (includes) parts.push(`Includes: ${includes}`);
  if (duration) parts.push(`Duration: ${duration}`);
  if (departure) parts.push(`Departs ${departure}`);
  return parts.join(' · ') || 'Verified offer from a vetted local supplier';
}

/** Returns active, priceable supplier offers, deduplicated by activity (cheapest). */
export function getVerifiedOffers(context: InventoryOptionContext = {}): SupplierOfferEntity[] {
  const {
    categories = DEFAULT_CATEGORIES,
    maxOptions = 3,
    minPriceEGP = 0,
    maxPriceEGP = Number.MAX_SAFE_INTEGER,
    searchText
  } = context;

  // All offers from active suppliers with a real price
  const activeSuppliers = new Set(
    db.suppliers.filter(s => s.status === 'Active').map(s => s.id)
  );
  let candidates = (db.supplierOffers || []).filter(offer => {
    if (!activeSuppliers.has(offer.supplierId)) return false;
    const price = offer.basePriceEGP ?? offer.price;
    if (typeof price !== 'number' || price <= 0) return false;
    if (price < minPriceEGP || price > maxPriceEGP) return false;
    if (searchText) {
      const hay = `${offer.titleEn || ''} ${offer.titleAr || ''} ${offer.sourceActivityName || ''}`.toLowerCase();
      if (!hay.includes(searchText.toLowerCase())) return false;
    }
    return true;
  });

  // Group by activity name (case-insensitive) and keep cheapest per activity
  const byActivity = new Map<string, SupplierOfferEntity>();
  for (const offer of candidates) {
    const key = (offer.sourceActivityName || offer.titleEn || '').toLowerCase().trim();
    const existing = byActivity.get(key);
    if (!existing) {
      byActivity.set(key, offer);
    } else {
      const curPrice = offer.basePriceEGP ?? offer.price;
      const existingPrice = existing.basePriceEGP ?? existing.price;
      if (curPrice < existingPrice) byActivity.set(key, offer);
    }
  }

  // Category filter
  let filtered = Array.from(byActivity.values()).filter(offer => {
    const cat = classifyOffer(offer);
    return categories.includes(cat);
  });

  // If not enough after category filter, relax it
  if (filtered.length < maxOptions) {
    filtered = Array.from(byActivity.values());
  }

  /**
   * Sellable first.
   *
   * An option the traveler cannot act on is a dead end, so offers that resolve
   * to a live SKU outrank equally-priced ones that only exist as information.
   * Price still decides within each tier.
   */
  filtered.sort((a, b) => {
    const bookableDiff = Number(isOfferBookable(b)) - Number(isOfferBookable(a));
    if (bookableDiff !== 0) return bookableDiff;
    const pa = a.basePriceEGP ?? a.price;
    const pb = b.basePriceEGP ?? b.price;
    return pa - pb;
  });

  return filtered.slice(0, maxOptions);
}

/**
 * The SKU an offer can actually be booked against, or null.
 *
 * An offer is a supplier's quote; a SKU is sellable inventory. They are only
 * the same thing when the offer's activity was repointed at a live product by
 * `reconcileActivityBookability()` and that product still resolves. Anything
 * else must reach the canvas without a `skuId`: forwarding a guess produces the
 * UnknownSkuError checkout was built to refuse.
 */
function resolveOfferSku(offer: SupplierOfferEntity): string | null {
  if (!offer.activityId) return null;
  const activity = db.activities.find(a => a.id === offer.activityId);
  if (!activity?.skuId) return null;
  return resolveBookability(activity.skuId)?.skuId ?? null;
}

function isOfferBookable(offer: SupplierOfferEntity): boolean {
  return resolveOfferSku(offer) !== null;
}

/**
 * Builds a multi-option result from real supplier offers, matching the
 * DayGiMultiOptionResult shape the canvas already renders.
 */
export function buildOptionsFromInventory(
  context: InventoryOptionContext & {
    postActivityContext?: DayGiMultiOptionResult['postActivityContext'];
  } = {}
): DayGiMultiOptionResult {
  const { postActivityContext } = context;
  const offers = getVerifiedOffers(context);
  const options: DayGiMultiOptionItem[] = offers.map((offer) => {
    const price = offer.basePriceEGP ?? offer.price;
    const titleEn = offer.titleEn || offer.sourceActivityName;
    const titleAr = offer.titleAr || titleEn;
    const supplier = db.suppliers.find(s => s.id === offer.supplierId);
    // Only a genuinely sellable product earns a Book button. An offer without
    // one is still shown — it is verified local inventory the traveler can
    // ask about — it just does not pretend checkout can take it.
    const skuId = resolveOfferSku(offer);
    const bookability = skuId ? resolveBookability(skuId) : null;
    return {
      id: `INV-${offer.id}`,
      titleEn,
      titleAr,
      category: classifyOffer(offer),
      location: supplier?.area || 'Dahab',
      travelTimeMins: 15, // Default: all Dahab locations are within ~15 min
      priceEGP: price,
      whyItFitsEn: buildWhyItFits(offer, 'en'),
      whyItFitsAr: buildWhyItFits(offer, 'ar'),
      skuId: skuId ?? undefined,
      actionKey: bookability ? 'CONFIRM_DIRECT_BOOKING' : undefined
    };
  });

  return {
    postActivityContext,
    options
  };
}

/** Returns a formatted list of offers for a specific search intent. */
export function searchOffers(searchText: string, maxOptions = 3): DayGiMultiOptionResult {
  return buildOptionsFromInventory({ searchText, maxOptions });
}
