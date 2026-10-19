import { describe, it, expect, beforeEach } from 'vitest';
import { priceSkuLine, pricingBasisOf, skuForClient } from '../../server/services/commerceService';
import { quoteLine } from '../../src/services/pricingQuote';
import { db } from '../../server/db/database';
import { resetDb, seedSku } from '../helpers/fixtures';
import type { ProductSkuEntity } from '../../server/db/schema';

/**
 * The quoted price and the charged price must be the same number.
 *
 * They were not. `/book-now` computed `basePriceEGP * guestsCount` for every
 * checkout, while the server prices a hotel per stay — the block price,
 * unmultiplied — via `priceSkuLine`. So a room booked for two guests was
 * quoted at double and the server rejected the final step with 409
 * PRICE_CHANGED. The error arrived after the traveller had entered their card
 * details, and it named no field they could act on.
 *
 * This file pins the two rules together so a future basis has to be taught to
 * both, and asserts the inventory projection that feeds the client carries the
 * resolved basis at all — the first fix addressed only the client, where
 * `pricingBasis` is undefined on every catalogue row, so it changed nothing.
 */
describe('quoted price matches charged price', () => {
  const sku = (over: Partial<ProductSkuEntity>): ProductSkuEntity => ({
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
  } as ProductSkuEntity);

  const cases: Array<[string, Partial<ProductSkuEntity>]> = [
    ['a hotel stay is the block price, whatever the party', { serviceType: 'hotel', basePriceEGP: 9000 }],
    ['a private car is charged once, whoever rides in it', { id: 'SKU-TRF-ZONE-MASBAT-private', serviceType: 'transfer', basePriceEGP: 2400 }],
    ['a premium car is charged once', { id: 'SKU-TRF-SSH-premium', serviceType: 'transfer', basePriceEGP: 2400 }],
    ['a shared transfer seat is per person', { id: 'SKU-TRF-ZONE-MASBAT-shared', serviceType: 'transfer', basePriceEGP: 400 }],
    ['an activity is per person', { serviceType: 'diving', basePriceEGP: 1400 }],
  ];

  for (const [label, over] of cases) {
    it(`agrees on ${label}`, () => {
      const line = sku(over);
      for (const party of [1, 2, 3, 5]) {
        expect(
          quoteLine(line.basePriceEGP, pricingBasisOf(line), party),
          `party of ${party}`
        ).toBe(priceSkuLine(line, party).amountEGP);
      }
    });
  }

  it('reads an absent basis as per person, matching the server default for a diving line', () => {
    const dive = sku({ serviceType: 'diving', basePriceEGP: 700 });
    expect(dive.pricingBasis).toBeUndefined();
    expect(quoteLine(dive.basePriceEGP, dive.pricingBasis, 3)).toBe(
      priceSkuLine(dive, 3).amountEGP
    );
  });

  it('never multiplies a block price by a party that does not scale it', () => {
    // The literal bug: a 5-night hotel package at 9,000 EGP quoted for two guests.
    expect(quoteLine(9000, 'per_stay', 2)).toBe(9000);
    expect(quoteLine(2400, 'per_vehicle', 4)).toBe(2400);
  });

  it('treats a party below one as one rather than quoting zero', () => {
    expect(quoteLine(1000, 'per_person', 0)).toBe(1000);
    expect(priceSkuLine(sku({ basePriceEGP: 1000 }), 0).amountEGP).toBe(1000);
  });
});

/**
 * The client cannot infer the basis, so the server has to hand it over.
 *
 * `pricingBasis` is an optional field and nothing writes it: no seed, no
 * importer, no admin route. Every basis in the catalogue comes from
 * `pricingBasisOf`'s fallback rules (hotel -> per_stay, private/premium zone
 * transfer -> per_vehicle). A response that omits it therefore leaves the
 * client guessing per_person, which is wrong for exactly the two verticals
 * where guessing produces a rejected checkout.
 */
describe('inventory projects a resolvable pricing basis', () => {
  beforeEach(() => {
    resetDb();
  });

  it('projects the resolved basis for every active sku, not the stored field', () => {
    seedSku({ id: 'SKU-TEST-HOTEL', serviceType: 'hotel', basePriceEGP: 9000 });
    // The tier rule keys on the SKU id, so the id has to look like the real
    // ones (`SKU-TRF-ZONE-<place>-private`) for the fallback to engage.
    seedSku({ id: 'SKU-TRF-TEST-private', serviceType: 'transfer', basePriceEGP: 2400 });
    seedSku({ id: 'SKU-TEST-DIVE', serviceType: 'diving', basePriceEGP: 1400 });

    // None of them store it.
    for (const s of db.productSkus.filter(x => x.id.includes('TEST'))) {
      expect(s.pricingBasis).toBeUndefined();
    }

    // Exactly what GET /api/inventory/:serviceType maps through.
    const projected = (serviceType: string) =>
      db.productSkus
        .filter(s => s.serviceType === serviceType && s.active)
        .map(skuForClient);

    const byId = Object.fromEntries(
      [...projected('hotel'), ...projected('transfer'), ...projected('diving')].map(r => [
        r.id,
        r.pricingBasis,
      ])
    );

    expect(byId['SKU-TEST-HOTEL']).toBe('per_stay');
    expect(byId['SKU-TRF-TEST-private']).toBe('per_vehicle');
    expect(byId['SKU-TEST-DIVE']).toBe('per_person');

    // And a projected line is priced exactly as the server would charge it.
    const hotel = projected('hotel')[0];
    expect(quoteLine(hotel.basePriceEGP, hotel.pricingBasis, 2)).toBe(
      priceSkuLine(hotel, 2).amountEGP
    );
  });
});