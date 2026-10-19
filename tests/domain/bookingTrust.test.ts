import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService } from '../../server/services/commerceService';
import { nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';
import type { ProductSkuEntity } from '../../server/db/schema';

/**
 * P4 booking-trust domain contract:
 * - findAlternatives returns only SKUs with REAL capacity for the party on
 *   the requested date, using the same math as createHold — an alternative
 *   shown to a traveler must actually be holdable.
 * - explainPrice derives the total from the SKU catalogue (per-person vs
 *   per-stay basis) — the same numbers checkout charges, no invented fees.
 */

const today = '2026-09-10';

function seedTransferFamily(): { origin: ProductSkuEntity; cheaper: ProductSkuEntity; pricier: ProductSkuEntity } {
  const origin = seedSku({
    id: 'SKU-TRF-A',
    serviceType: 'transfer',
    title: 'Private Car Transfer',
    titleAr: 'انتقال خاص',
    basePriceEGP: 1200,
    maxCapacityPerSlot: 4,
    supplierId: 'SUP-TRF',
  });
  const cheaper = seedSku({
    id: 'SKU-TRF-B',
    serviceType: 'transfer',
    title: 'Shared Shuttle',
    titleAr: 'باص مشترك',
    basePriceEGP: 450,
    maxCapacityPerSlot: 12,
    supplierId: 'SUP-TRF',
  });
  const pricier = seedSku({
    id: 'SKU-TRF-C',
    serviceType: 'transfer',
    title: 'VIP 4x4 Transfer',
    titleAr: 'انتقال VIP',
    basePriceEGP: 1800,
    maxCapacityPerSlot: 3,
    supplierId: 'SUP-TRF',
  });
  return { origin, cheaper, pricier };
}

describe('findAlternatives (P4 booking trust)', () => {
  beforeEach(() => {
    resetDb();
    seedTrip();
  });

  it('returns same-serviceType SKUs with real capacity, ranked by price distance', () => {
    seedTransferFamily();
    const alts = commerceService.findAlternatives({
      skuId: 'SKU-TRF-A',
      date: today,
      timeSlot: '10:30 AM',
      passengersCount: 2,
    });
    // All three candidates have space for 2; ranked by price distance:
    // 450 (dist 750) < 1800 (dist 600)? No: 1800-1200=600 < 750 → VIP first.
    expect(alts.map(a => a.skuId)).toEqual(['SKU-TRF-C', 'SKU-TRF-B']);
    expect(alts[0].basePriceEGP).toBe(1800);
    expect(alts[1].basePriceEGP).toBe(450);
  });

  it('excludes SKUs without capacity for the party (same math as createHold)', () => {
    const { cheaper } = seedTransferFamily();
    // Fill the shuttle: 12 seats, reserve 11 → only 1 left, party of 2 fails.
    db.inventorySlots.push({
      id: 'SLOT-TRF-B-FULL',
      skuId: cheaper.id,
      date: today,
      timeSlot: '10:30 AM',
      totalCapacity: 12,
      reservedCapacity: 11,
      heldCapacity: 0,
      priceEGP: cheaper.basePriceEGP,
      status: 'ALMOST_FULL',
    });
    const alts = commerceService.findAlternatives({
      skuId: 'SKU-TRF-A',
      date: today,
      timeSlot: '10:30 AM',
      passengersCount: 2,
    });
    expect(alts.map(a => a.skuId)).toEqual(['SKU-TRF-C']);
  });

  it('counts held capacity as unavailable (expired holds give it back)', () => {
    const { cheaper } = seedTransferFamily();
    // The shuttle is full because of an EXPIRED hold: findAlternatives must
    // release expired holds first, then see the seat as free.
    db.holds.push({
      id: 'HOLD-EXPIRED-1',
      holdToken: 'HLD-TRF-EXPIRED',
      skuId: cheaper.id,
      slotId: 'SLOT-TRF-B-EXPIRED',
      tripId: 'TRIP-TEST',
      travelerId: 'USR-TEST',
      serviceType: 'transfer',
      passengersCount: 12,
      amountEGP: cheaper.basePriceEGP,
      expiresAt: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
      status: 'ACTIVE',
      idempotencyKey: 'IDK-EXPIRED-1',
      createdAt: new Date().toISOString(),
    });
    db.inventorySlots.push({
      id: 'SLOT-TRF-B-EXPIRED',
      skuId: cheaper.id,
      date: today,
      timeSlot: '10:30 AM',
      totalCapacity: 12,
      reservedCapacity: 0,
      heldCapacity: 12,
      priceEGP: cheaper.basePriceEGP,
      status: 'SOLD_OUT',
    });
    const alts = commerceService.findAlternatives({
      skuId: 'SKU-TRF-A',
      date: today,
      timeSlot: '10:30 AM',
      passengersCount: 2,
    });
    expect(alts.map(a => a.skuId)).toContain('SKU-TRF-B');
    const shuttle = db.inventorySlots.find(s => s.id === 'SLOT-TRF-B-EXPIRED');
    expect(shuttle?.heldCapacity).toBe(0);
    expect(shuttle?.status).toBe('AVAILABLE');
  });

  it('never suggests the origin SKU itself or inactive SKUs', () => {
    const origin = seedTransferFamily().origin;
    seedSku({
      id: 'SKU-TRF-INACTIVE',
      serviceType: 'transfer',
      basePriceEGP: 1000,
      maxCapacityPerSlot: 10,
      active: false,
      supplierId: 'SUP-TRF',
    });
    const alts = commerceService.findAlternatives({
      skuId: origin.id,
      date: today,
      passengersCount: 1,
    });
    expect(alts.map(a => a.skuId)).not.toContain(origin.id);
    expect(alts.map(a => a.skuId)).not.toContain('SKU-TRF-INACTIVE');
  });

  it('returns [] for an unknown origin SKU instead of guessing', () => {
    seedTransferFamily();
    const alts = commerceService.findAlternatives({
      skuId: 'SKU-DOES-NOT-EXIST',
      date: today,
      passengersCount: 2,
    });
    expect(alts).toEqual([]);
  });
});

describe('explainPrice (P4 booking trust)', () => {
  beforeEach(() => {
    resetDb();
    seedTrip();
  });

  it('prices non-hotel SKUs per person', () => {
    seedSku({ id: 'SKU-DIV-P', serviceType: 'diving', basePriceEGP: 2700 });
    const result = commerceService.explainPrice({
      items: [{ skuId: 'SKU-DIV-P', passengersCount: 2 }],
    });
    expect(result.lines[0].basis).toBe('per_person');
    expect(result.lines[0].amountEGP).toBe(5400);
    expect(result.totalEGP).toBe(5400);
  });

  it('prices hotel SKUs per stay regardless of party size', () => {
    seedSku({ id: 'SKU-HTL-P', serviceType: 'hotel', basePriceEGP: 12500 });
    const result = commerceService.explainPrice({
      items: [{ skuId: 'SKU-HTL-P', passengersCount: 3 }],
    });
    expect(result.lines[0].basis).toBe('per_stay');
    expect(result.lines[0].amountEGP).toBe(12500);
    expect(result.totalEGP).toBe(12500);
  });

  it('sums mixed baskets and carries cancellation windows', () => {
    seedSku({ id: 'SKU-HTL-M', serviceType: 'hotel', basePriceEGP: 12500, cancellationPolicyHours: 48 });
    seedSku({ id: 'SKU-TRF-M', serviceType: 'transfer', basePriceEGP: 1200, cancellationPolicyHours: 24 });
    const result = commerceService.explainPrice({
      items: [
        { skuId: 'SKU-HTL-M', passengersCount: 2 },
        { skuId: 'SKU-TRF-M', passengersCount: 2 },
      ],
    });
    expect(result.totalEGP).toBe(14900); // 12500 stay + 1200×2 per-person
    expect(result.lines[0].cancellationPolicyHours).toBe(48);
    expect(result.lines[1].cancellationPolicyHours).toBe(24);
  });

  it('throws UnknownSkuError for a catalogue miss', () => {
    expect(() =>
      commerceService.explainPrice({ items: [{ skuId: 'SKU-GHOST' }] })
    ).toThrow();
  });
});
