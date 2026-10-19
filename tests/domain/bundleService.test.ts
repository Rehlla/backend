import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import {
  createBundle, updateBundle, deleteBundle, getBundle, getActiveBundles,
  findApplicableBundles, computeBestBundleDiscount, applyBundleDiscounts,
} from '../../server/services/bundleService';
import type { ProductSkuEntity, SupplierEntity } from '../../server/db/schema';

const now = '2026-01-01T00:00:00.000Z';

function seedSkus() {
  const supplier: SupplierEntity = {
    id: 'SUP-1', businessName: 'Test', businessNameAr: 'اختبار',
    category: 'diving', tier: 'Vetted Local Partner', status: 'Active',
    area: 'dahab', createdAt: now,
  };
  db.suppliers.push(supplier);

  const skus: ProductSkuEntity[] = [
    { id: 'SKU-1', supplierId: 'SUP-1', serviceType: 'diving', title: 'Dive 1', titleAr: 'غوص 1', description: '', basePriceEGP: 500, currency: 'EGP', maxCapacityPerSlot: 4, active: true, cancellationPolicyHours: 24 },
    { id: 'SKU-2', supplierId: 'SUP-1', serviceType: 'diving', title: 'Dive 2', titleAr: 'غوص 2', description: '', basePriceEGP: 600, currency: 'EGP', maxCapacityPerSlot: 4, active: true, cancellationPolicyHours: 24 },
    { id: 'SKU-3', supplierId: 'SUP-1', serviceType: 'transfer', title: 'Transfer', titleAr: 'نقل', description: '', basePriceEGP: 300, currency: 'EGP', maxCapacityPerSlot: 4, active: true, cancellationPolicyHours: 24 },
  ];
  db.productSkus.push(...skus);
}

describe('bundleService', () => {
  beforeEach(() => {
    const adapter = new InMemoryPersistenceAdapter();
    db.setAdapter(adapter);
    seedSkus();
  });

  describe('createBundle', () => {
    it('creates a bundle with valid inputs', () => {
      const bundle = createBundle({
        name: 'Dive Duo', nameAr: 'ثنائي الغوص',
        description: 'Two dives discounted', descriptionAr: 'غوصان بخصم',
        eligibleSkuIds: ['SKU-1', 'SKU-2'], discountPercent: 15,
      });
      expect(bundle.id).toMatch(/^BUNDLE-/);
      expect(bundle.discountPercent).toBe(15);
      expect(bundle.eligibleSkuIds).toEqual(['SKU-1', 'SKU-2']);
    });

    it('throws with fewer than 2 eligible SKUs', () => {
      expect(() => createBundle({
        name: 'Solo', nameAr: 'وحيد',
        description: 'One SKU', descriptionAr: 'صفحة واحدة',
        eligibleSkuIds: ['SKU-1'], discountPercent: 10,
      })).toThrow('at least 2');
    });

    it('throws with invalid discount percent', () => {
      expect(() => createBundle({
        name: 'Bad', nameAr: 'سيء',
        description: 'Bad', descriptionAr: 'سيء',
        eligibleSkuIds: ['SKU-1', 'SKU-2'], discountPercent: 100,
      })).toThrow('between 1 and 99');
    });

    it('throws with non-existent SKU', () => {
      expect(() => createBundle({
        name: 'Bad', nameAr: 'سيء',
        description: 'Bad', descriptionAr: 'سيء',
        eligibleSkuIds: ['SKU-1', 'SKU-999'], discountPercent: 10,
      })).toThrow('not found');
    });
  });

  describe('updateBundle', () => {
    it('updates bundle fields', () => {
      const bundle = createBundle({
        name: 'Original', nameAr: 'أصلي',
        description: 'Desc', descriptionAr: 'وصف',
        eligibleSkuIds: ['SKU-1', 'SKU-2'], discountPercent: 10,
      });
      const updated = updateBundle(bundle.id, { name: 'Updated', discountPercent: 20 });
      expect(updated.name).toBe('Updated');
      expect(updated.discountPercent).toBe(20);
    });
  });

  describe('deleteBundle', () => {
    it('deletes a bundle', () => {
      const bundle = createBundle({
        name: 'ToDelete', nameAr: 'للحذف',
        description: 'Desc', descriptionAr: 'وصف',
        eligibleSkuIds: ['SKU-1', 'SKU-2'], discountPercent: 10,
      });
      expect(deleteBundle(bundle.id)).toBe(true);
      expect(getBundle(bundle.id)).toBeUndefined();
    });

    it('returns false for non-existent bundle', () => {
      expect(deleteBundle('BUNDLE-999')).toBe(false);
    });
  });

  describe('findApplicableBundles', () => {
    it('finds bundles that match cart items', () => {
      createBundle({
        name: 'Dive Duo', nameAr: 'ثنائي الغوص',
        description: 'Desc', descriptionAr: 'وصف',
        eligibleSkuIds: ['SKU-1', 'SKU-2'], discountPercent: 15,
      });
      const applicable = findApplicableBundles(['SKU-1', 'SKU-2', 'SKU-3']);
      expect(applicable).toHaveLength(1);
    });

    it('returns empty when no bundles match', () => {
      createBundle({
        name: 'Dive Duo', nameAr: 'ثنائي الغوص',
        description: 'Desc', descriptionAr: 'وصف',
        eligibleSkuIds: ['SKU-1', 'SKU-2'], discountPercent: 15,
      });
      const applicable = findApplicableBundles(['SKU-3']);
      expect(applicable).toHaveLength(0);
    });
  });

  describe('computeBestBundleDiscount', () => {
    it('computes the best discount for matching cart', () => {
      createBundle({
        name: 'Dive Duo', nameAr: 'ثنائي الغوص',
        description: 'Desc', descriptionAr: 'وصف',
        eligibleSkuIds: ['SKU-1', 'SKU-2'], discountPercent: 20,
      });
      const result = computeBestBundleDiscount(['SKU-1', 'SKU-2']);
      expect(result).not.toBeNull();
      expect(result!.subtotalEGP).toBe(1100); // 500 + 600
      expect(result!.discountEGP).toBe(220); // 20% of 1100
      expect(result!.totalEGP).toBe(880);
    });

    it('returns null when no bundles apply', () => {
      expect(computeBestBundleDiscount(['SKU-3'])).toBeNull();
    });
  });

  describe('applyBundleDiscounts', () => {
    it('applies bundle discount to cart items', () => {
      createBundle({
        name: 'Dive Duo', nameAr: 'ثنائي الغوص',
        description: 'Desc', descriptionAr: 'وصف',
        eligibleSkuIds: ['SKU-1', 'SKU-2'], discountPercent: 15,
      });
      const result = applyBundleDiscounts([
        { skuId: 'SKU-1', quantity: 1 },
        { skuId: 'SKU-2', quantity: 1 },
        { skuId: 'SKU-3', quantity: 1 },
      ]);
      expect(result.subtotalEGP).toBe(1400); // 500 + 600 + 300
      expect(result.bundleDiscountEGP).toBe(165); // 15% of 1100
      expect(result.totalEGP).toBe(1235);
      expect(result.appliedBundle).not.toBeNull();
    });

    it('returns no discount when no bundles apply', () => {
      const result = applyBundleDiscounts([{ skuId: 'SKU-3', quantity: 1 }]);
      expect(result.bundleDiscountEGP).toBe(0);
      expect(result.appliedBundle).toBeNull();
    });
  });
});
