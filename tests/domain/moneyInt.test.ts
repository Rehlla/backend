/** Money-integrity guard (gap M-1 of report 11) — whole-EGP at the write seam. */
import { describe, expect, it } from 'vitest';
import { moneyInt } from '../../server/services/money';
import { priceSkuLine } from '../../server/services/commerceService';
import type { ProductSkuEntity } from '../../server/db/schema';

describe('moneyInt', () => {
  it('passes integers through untouched', () => {
    expect(moneyInt(1400)).toBe(1400);
    expect(moneyInt(0)).toBe(0);
  });

  it('rounds fractional EGP to the nearest whole piaster-free amount', () => {
    expect(moneyInt(12.4)).toBe(12);
    expect(moneyInt(12.5)).toBe(13);
    expect(moneyInt(0.1 + 0.2)).toBe(0);
    expect(moneyInt(-2.4)).toBe(-2);
  });
});

describe('priceSkuLine emits whole-EGP amounts', () => {
  it('rounds a fractional per_person quotation (the M-1 write seam)', () => {
    const sku = {
      id: 'SKU-TMP-1',
      basePriceEGP: 433.3,
      serviceType: 'diving',
    } as unknown as ProductSkuEntity;
    // 433.3 x 3 = 1299.9 → 1300, so a hold never carries fractional EGP.
    const line = priceSkuLine(sku, 3);
    expect(line.amountEGP).toBe(1300);
    expect(Number.isInteger(line.amountEGP)).toBe(true);
  });
});
