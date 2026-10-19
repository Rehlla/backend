import { describe, it, expect } from 'vitest';
import { priceSkuLine, pricingBasisOf } from '../../server/services/commerceService';
import type { ProductSkuEntity } from '../../server/db/schema';

const sku = (over: Partial<ProductSkuEntity>): ProductSkuEntity =>
  ({
    id: 'SKU-X',
    supplierId: 'SUP-1',
    serviceType: 'diving',
    title: 'x',
    basePriceEGP: 1000,
    currency: 'EGP',
    maxCapacityPerSlot: 10,
    active: true,
    cancellationPolicyHours: 24,
    ...over,
  }) as ProductSkuEntity;

describe('pricing basis', () => {
  it('charges a private or premium car once, whoever rides in it', () => {
    const car = sku({ id: 'SKU-TRF-SSH-private', serviceType: 'transfer', basePriceEGP: 2400, pricingBasis: 'per_vehicle' });
    expect(priceSkuLine(car, 3)).toMatchObject({ basis: 'per_vehicle', amountEGP: 2400 });
  });

  it('treats transfer SKUs created before the field existed by their tier', () => {
    expect(pricingBasisOf(sku({ id: 'SKU-TRF-SSH-premium', serviceType: 'transfer' }))).toBe('per_vehicle');
    expect(pricingBasisOf(sku({ id: 'SKU-TRF-SSH-shared', serviceType: 'transfer' }))).toBe('per_person');
  });

  it('keeps shared seats and activities per person, hotels per stay', () => {
    expect(priceSkuLine(sku({ id: 'SKU-TRF-SSH-shared', serviceType: 'transfer', basePriceEGP: 400 }), 2).amountEGP).toBe(800);
    expect(priceSkuLine(sku({ basePriceEGP: 1400 }), 2).amountEGP).toBe(2800);
    expect(priceSkuLine(sku({ serviceType: 'hotel', basePriceEGP: 9000 }), 2).amountEGP).toBe(9000);
  });
});
