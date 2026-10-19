import { db } from '../db/database';
import { EXPERIENCE_SKU_BY_ACTIVITY } from '../db/seeds/experienceProducts';
import { pricingBasisOf, type PricingBasis } from './commerceService';

/**
 * Makes `skuId` on a catalogue activity mean what it says: a row that exists in
 * db.productSkus and that checkout will actually accept.
 *
 * It did not mean that. The catalogue carried ten skuIds — SKU-DIVE-BH-01,
 * SKU-SAFARI-RAG-01, SKU-TRANS-SSH-01 and the rest — with **zero** overlap with
 * the seventeen real product SKUs, plus however many
 * importDahabLocalCommerce synthesised from the activity id. Every one was a
 * dangling reference to inventory that does not exist, and eighteen of those
 * activities were marked `BOOK_NOW`, so the catalogue advertised online
 * bookability it could not honour. Anything that forwarded such an id to
 * checkout got an UnknownSkuError; anything that trusted `bookingMode` showed
 * the traveler a Book button with nothing behind it.
 *
 * That disconnect is why Explore and Book Now behaved as separate products:
 * the thing you could browse was never the thing you could buy.
 */

/**
 * Activities whose skuId is repointed at the real product that sells them.
 *
 * Deliberately short. An entry belongs here only when the activity and the SKU
 * are the *same product* — same site, same access, same shape of day. Filling
 * this table out by category similarity is how a traveler ends up dispatched to
 * a supplier for something they did not buy, which is exactly what
 * UnknownSkuError in commerceService was written to prevent: booking a 180 EGP
 * gear delivery once created a real dispatch to a dive centre that does not
 * sell it.
 *
 * Rejected on those grounds:
 * - act_ras_abu_galum_boat_safari → SKU-SAF-002 is Wadi Qnai by quad bike, not
 *   Ras Abu Galum by boat. Different place, different vehicle.
 * - the stargazing and St. Catherine pairing → SKU-SAF-001 is a Mount Moses
 *   sunrise trek, a different expedition on a different mountain.
 * Those activities are sold by their own products instead, defined with them
 * in seeds/experienceProducts.ts.
 */
const RESOLVED_SKU_BY_ACTIVITY: Readonly<Record<string, string>> = {
  ...EXPERIENCE_SKU_BY_ACTIVITY,
  // Blue Hole & Bells: both 240 minutes, both reached by 4x4, both a guided
  // two-dive day with a Bedouin lunch.
  act_blue_hole_safari_dive: 'SKU-DIV-002',
  // Sharm airport to Dahab in a private van: 65 minutes on the activity, 60 on
  // the SKU, the same road and the same vehicle class.
  act_ssh_airport_private_transfer: 'SKU-TRF-001',
  // SKU-DIV-001 is sold as "Coral Canyon & Lighthouse", so it is the bookable
  // product behind both of these shore dives.
  act_lighthouse_guided_dive: 'SKU-DIV-001',
  act_the_canyon_scuba_adventure: 'SKU-DIV-001'
};

export interface BookabilityReconciliationResult {
  /** Activities left pointing at a SKU that exists. */
  bookable: number;
  /** Activities whose dangling skuId was cleared. */
  downgraded: number;
  /** Ids of the activities that were cleared, for the boot log and tests. */
  downgradedIds: string[];
}

/**
 * The booking mode an activity falls back to once it has no sellable SKU.
 *
 * REQUEST_NOW rather than DISCOVER_ONLY: these are real services that a real
 * supplier will run, they just cannot be transacted online yet. Saying
 * "discover only" would understate them as much as BOOK_NOW overstated them.
 */
const FALLBACK_BOOKING_MODE = 'REQUEST_NOW';

/**
 * Reconciles every catalogue activity against the commerce inventory.
 *
 * Must run after both seeding passes — runMigrationsAndSeed (which fills
 * productSkus, and calls importDahabLocalCommerce) and
 * dahabKnowledgeOs.bootstrapValidatedCorpus (which fills activities from the
 * static corpus). Running it earlier, against an empty catalogue, cannot tell
 * "this SKU does not exist" apart from "inventory has not loaded yet", so it
 * declines to act in that case rather than clearing the whole catalogue.
 */
export function reconcileActivityBookability(): BookabilityReconciliationResult {
  const result: BookabilityReconciliationResult = { bookable: 0, downgraded: 0, downgradedIds: [] };

  if (db.productSkus.length === 0) {
    // No inventory loaded. Nothing can be judged against it.
    return result;
  }

  const sellable = new Set(db.productSkus.filter(sku => sku.active).map(sku => sku.id));

  for (const activity of db.activities) {
    const mapped = RESOLVED_SKU_BY_ACTIVITY[activity.id];
    if (mapped && sellable.has(mapped)) {
      activity.skuId = mapped;
      // An earlier boot may have downgraded it before its product existed.
      activity.bookingMode = 'BOOK_NOW';
      result.bookable += 1;
      continue;
    }

    if (activity.skuId && sellable.has(activity.skuId)) {
      result.bookable += 1;
      continue;
    }

    if (activity.skuId) {
      result.downgraded += 1;
      result.downgradedIds.push(activity.id);
      delete activity.skuId;
    }

    // The claim goes with the inventory. An activity with nothing to sell must
    // not keep advertising BOOK_NOW.
    if (activity.bookingMode === 'BOOK_NOW') {
      activity.bookingMode = FALLBACK_BOOKING_MODE;
    }
  }

  return result;
}

/**
 * The commerce facts a traveler-facing surface needs to offer this activity for
 * sale, or null when it cannot be sold online.
 *
 * Price comes from the SKU rather than the activity so that the number shown is
 * the number charged. They disagree today — the Blue Hole activity says 2,200
 * EGP and SKU-DIV-002 charges 3,400 — and the checkout uses the SKU.
 */
export interface ResolvedBookability {
  skuId: string;
  serviceType: string;
  basePriceEGP: number;
  currency: string;
  supplierId: string;
  maxCapacityPerSlot: number;
  cancellationPolicyHours?: number;
  pricingBasis: PricingBasis;
  durationMinutes?: number;
  description?: string;
  descriptionAr?: string;
  includedItems?: string[];
  includedItemsAr?: string[];
  /** The departures run each day, when the product declares them. */
  timeSlots?: string[];
  /** Where the supplier meets the traveler. */
  meetingPoint?: string;
  meetingPointAr?: string;
  supplierName?: string;
  supplierNameAr?: string;
}

export function resolveBookability(skuId?: string): ResolvedBookability | null {
  if (!skuId) return null;
  const sku = db.productSkus.find(s => s.id === skuId && s.active);
  if (!sku) return null;
  const supplier = db.suppliers.find(s => s.id === sku.supplierId);

  return {
    skuId: sku.id,
    serviceType: sku.serviceType,
    basePriceEGP: sku.basePriceEGP,
    currency: sku.currency,
    supplierId: sku.supplierId,
    maxCapacityPerSlot: sku.maxCapacityPerSlot,
    cancellationPolicyHours: sku.cancellationPolicyHours,
    pricingBasis: pricingBasisOf(sku),
    durationMinutes: sku.durationMinutes,
    description: sku.description,
    descriptionAr: sku.descriptionAr,
    includedItems: sku.includedItems,
    includedItemsAr: sku.includedItemsAr,
    timeSlots: sku.timeSlots,
    meetingPoint: sku.routeFrom,
    meetingPointAr: sku.routeFromAr,
    supplierName: supplier?.businessName,
    supplierNameAr: supplier?.businessNameAr
  };
}
