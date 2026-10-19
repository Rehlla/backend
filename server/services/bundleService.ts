import crypto from 'crypto';
import { db } from '../db/database';
import { BundleEntity, CommerceServiceType, ProductSkuEntity } from '../db/schema';

/**
 * Dynamic Bundle Service
 *
 * Creates and manages discount bundles that combine multiple SKUs into a
 * discounted package. Bundles are evaluated at checkout time — they never
 * pre-exist as bookable SKUs. The discount applies to the sum of individual
 * SKU prices when the cart contains enough eligible items.
 */

const nowIso = () => new Date().toISOString();
const genId = (prefix: string) => `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

/**
 * Create a new bundle definition.
 */
export function createBundle(input: {
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  eligibleSkuIds: string[];
  discountPercent: number;
  minItems?: number;
  maxItems?: number;
  serviceTypes?: CommerceServiceType[];
}): BundleEntity {
  if (input.eligibleSkuIds.length < 2) {
    throw new Error('A bundle must have at least 2 eligible SKUs.');
  }
  if (input.discountPercent <= 0 || input.discountPercent >= 100) {
    throw new Error('Discount percent must be between 1 and 99.');
  }

  // Verify all SKUs exist.
  for (const skuId of input.eligibleSkuIds) {
    if (!db.productSkus.find(s => s.id === skuId)) {
      throw new Error(`SKU ${skuId} not found.`);
    }
  }

  const now = nowIso();
  const bundle: BundleEntity = {
    id: genId('BUNDLE'),
    name: input.name,
    nameAr: input.nameAr,
    description: input.description,
    descriptionAr: input.descriptionAr,
    eligibleSkuIds: input.eligibleSkuIds,
    discountPercent: input.discountPercent,
    minItems: input.minItems ?? 2,
    maxItems: input.maxItems,
    serviceTypes: input.serviceTypes,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  db.bundles.push(bundle);
  db.saveToDisk();
  return bundle;
}

/**
 * Update an existing bundle.
 */
export function updateBundle(
  bundleId: string,
  patch: Partial<Pick<BundleEntity, 'name' | 'nameAr' | 'description' | 'descriptionAr' | 'eligibleSkuIds' | 'discountPercent' | 'minItems' | 'maxItems' | 'serviceTypes' | 'active'>>
): BundleEntity {
  const bundle = db.bundles.find(b => b.id === bundleId);
  if (!bundle) throw new Error(`Bundle ${bundleId} not found.`);

  if (patch.eligibleSkuIds && patch.eligibleSkuIds.length < 2) {
    throw new Error('A bundle must have at least 2 eligible SKUs.');
  }
  if (patch.discountPercent !== undefined && (patch.discountPercent <= 0 || patch.discountPercent >= 100)) {
    throw new Error('Discount percent must be between 1 and 99.');
  }

  Object.assign(bundle, patch, { updatedAt: nowIso() });
  db.saveToDisk();
  return bundle;
}

/**
 * Delete a bundle.
 */
export function deleteBundle(bundleId: string): boolean {
  const idx = db.bundles.findIndex(b => b.id === bundleId);
  if (idx === -1) return false;
  db.bundles.splice(idx, 1);
  db.saveToDisk();
  return true;
}

/**
 * Get a bundle by ID.
 */
export function getBundle(bundleId: string): BundleEntity | undefined {
  return db.bundles.find(b => b.id === bundleId);
}

/**
 * Get all active bundles.
 */
export function getActiveBundles(): BundleEntity[] {
  return db.bundles.filter(b => b.active);
}

/**
 * Find applicable bundles for a set of SKU IDs in the cart.
 * Returns bundles where the cart contains at least minItems of the eligible SKUs.
 */
export function findApplicableBundles(cartSkuIds: string[]): BundleEntity[] {
  const activeBundles = getActiveBundles();
  return activeBundles.filter(bundle => {
    const eligibleInCart = cartSkuIds.filter(skuId => bundle.eligibleSkuIds.includes(skuId));
    return eligibleInCart.length >= bundle.minItems;
  });
}

export interface BundleDiscountResult {
  /** The bundle applied. */
  bundle: BundleEntity;
  /** The SKU IDs from the cart that qualify for this bundle. */
  qualifyingSkuIds: string[];
  /** Sum of individual SKU prices before discount. */
  subtotalEGP: number;
  /** Discount amount in EGP. */
  discountEGP: number;
  /** Total after discount. */
  totalEGP: number;
}

/**
 * Compute the best bundle discount for a set of cart SKU IDs.
 * If multiple bundles apply, returns the one with the highest discount.
 */
export function computeBestBundleDiscount(cartSkuIds: string[]): BundleDiscountResult | null {
  const applicable = findApplicableBundles(cartSkuIds);
  if (applicable.length === 0) return null;

  let bestResult: BundleDiscountResult | null = null;

  for (const bundle of applicable) {
    // Determine which SKUs in the cart qualify.
    let qualifyingSkuIds = cartSkuIds.filter(skuId => bundle.eligibleSkuIds.includes(skuId));

    // Respect maxItems limit.
    if (bundle.maxItems && qualifyingSkuIds.length > bundle.maxItems) {
      qualifyingSkuIds = qualifyingSkuIds.slice(0, bundle.maxItems);
    }

    // Sum the prices of qualifying SKUs.
    let subtotalEGP = 0;
    for (const skuId of qualifyingSkuIds) {
      const sku = db.productSkus.find(s => s.id === skuId);
      if (sku) subtotalEGP += sku.basePriceEGP;
    }

    const discountEGP = Math.round((subtotalEGP * bundle.discountPercent) / 100);
    const totalEGP = subtotalEGP - discountEGP;

    if (!bestResult || discountEGP > bestResult.discountEGP) {
      bestResult = {
        bundle,
        qualifyingSkuIds,
        subtotalEGP,
        discountEGP,
        totalEGP,
      };
    }
  }

  return bestResult;
}

/**
 * Compute bundle discount for all applicable bundles (stacking not supported —
 * returns only the single best discount). This is the entry point used by
 * checkout/payment flows.
 */
export function applyBundleDiscounts(
  items: Array<{ skuId: string; quantity: number }>
): {
  subtotalEGP: number;
  bundleDiscountEGP: number;
  appliedBundle: BundleEntity | null;
  qualifyingSkuIds: string[];
  totalEGP: number;
} {
  // Flatten cart items into a list of SKU IDs (respecting quantity).
  const cartSkuIds: string[] = [];
  let subtotalEGP = 0;
  for (const item of items) {
    const sku = db.productSkus.find(s => s.id === item.skuId);
    if (sku) {
      subtotalEGP += sku.basePriceEGP * item.quantity;
      for (let i = 0; i < item.quantity; i++) {
        cartSkuIds.push(item.skuId);
      }
    }
  }

  const best = computeBestBundleDiscount(cartSkuIds);

  return {
    subtotalEGP,
    bundleDiscountEGP: best?.discountEGP ?? 0,
    appliedBundle: best?.bundle ?? null,
    qualifyingSkuIds: best?.qualifyingSkuIds ?? [],
    totalEGP: best ? subtotalEGP - best.discountEGP : subtotalEGP,
  };
}
