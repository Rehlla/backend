import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService } from '../../server/services/commerceService';
import { futureDate, nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * The price a traveller pays is the catalogue's, not the client's.
 *
 * Multi-service checkout used to charge whatever `amountEGP` the request body
 * carried and treated the hold as optional, so a crafted request could buy a
 * 1,200 EGP dive for 1 EGP, or book capacity nobody had reserved. Holds were
 * priced at `basePriceEGP` whatever the party size, so a party of four held
 * four seats for the price of one.
 */

const DATE = futureDate(30);
const TIME = '08:30 AM (Morning Dive)';

function hold(pax: number, over: { userId?: string; skuId?: string } = {}) {
  return commerceService.createHold({
    skuId: over.skuId ?? 'SKU-DIVE-TEST',
    tripId: 'TRIP-TEST',
    travelerId: over.userId ?? 'USR-TEST',
    date: DATE,
    timeSlot: TIME,
    passengersCount: pax,
    idempotencyKey: nextIdempotencyKey()
  });
}

function checkout(item: Partial<{ holdToken: string; amountEGP: number; passengersCount: number }>, userId = 'USR-TEST') {
  return commerceService.completeMultiServiceCheckout({
    tripId: 'TRIP-TEST',
    travelerUserId: userId,
    travelerName: 'Test Traveler',
    travelerPhone: '+201000000000',
    travelerEmail: 'traveler@example.test',
    items: [{
      serviceType: 'diving',
      skuId: 'SKU-DIVE-TEST',
      scheduledDate: DATE,
      scheduledTime: TIME,
      amountEGP: item.amountEGP ?? 1200,
      ...(item.holdToken ? { holdToken: item.holdToken } : {}),
      ...(item.passengersCount ? { passengersCount: item.passengersCount } : {})
    }],
    paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'CASH_ON_ARRIVAL' }
  });
}

function rejection(fn: () => unknown): { status?: number; code?: string; details?: Record<string, unknown> } {
  try {
    fn();
  } catch (err) {
    return err as { status?: number; code?: string; details?: Record<string, unknown> };
  }
  throw new Error('expected the call to be rejected');
}

describe('hold pricing', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('prices a per-person hold for the whole party', () => {
    expect(hold(4).amountEGP).toBe(1200 * 4);
  });

  it('prices a hold exactly as the price explainer does', () => {
    const explained = commerceService.explainPrice({ items: [{ skuId: 'SKU-DIVE-TEST', passengersCount: 3 }] });
    expect(hold(3).amountEGP).toBe(explained.totalEGP);
  });

  it('keeps a hotel hold per stay', () => {
    seedSku({ id: 'SKU-HOTEL-TEST', serviceType: 'hotel', basePriceEGP: 5000 });
    expect(hold(2, { skuId: 'SKU-HOTEL-TEST' }).amountEGP).toBe(5000);
  });
});

describe('multi-service checkout price and hold', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('refuses a checkout with no hold and takes no money', () => {
    const err = rejection(() => checkout({}));
    expect(err.status).toBe(400);
    expect(err.code).toBe('HOLD_REQUIRED');
    expect(db.payments).toHaveLength(0);
    expect(db.bookings).toHaveLength(0);
  });

  it('refuses a hold that belongs to another traveller', () => {
    const foreign = hold(1, { userId: 'USR-OTHER' });
    const err = rejection(() => checkout({ holdToken: foreign.holdToken }));
    expect(err.status).toBe(403);
    expect(err.code).toBe('HOLD_NOT_OWNED');
    expect(db.payments).toHaveLength(0);
  });

  it('refuses a hold that is no longer active', () => {
    const h = hold(1);
    commerceService.releaseHold(h.holdToken);
    const err = rejection(() => checkout({ holdToken: h.holdToken }));
    expect(err.status).toBe(409);
    expect(err.code).toBe('HOLD_EXPIRED');
  });

  it('rejects a client amount that differs from the catalogue price with PRICE_CHANGED', () => {
    const h = hold(2);
    const err = rejection(() => checkout({ holdToken: h.holdToken, amountEGP: 1 }));
    expect(err.status).toBe(409);
    expect(err.code).toBe('PRICE_CHANGED');
    expect(err.details).toMatchObject({ skuId: 'SKU-DIVE-TEST', quotedAmountEGP: 1, currentAmountEGP: 2400 });
    expect(db.payments).toHaveLength(0);
    expect(db.ledgerEntries).toHaveLength(0);
    expect(db.bookings).toHaveLength(0);
    // The hold survives so the traveller can re-confirm at the real price.
    expect(db.holds.find(x => x.holdToken === h.holdToken)?.status).toBe('ACTIVE');
  });

  it('charges the server price for the held party size', () => {
    const h = hold(2);
    const result = checkout({ holdToken: h.holdToken, amountEGP: 2400 });
    expect(result.totalAmountEGP).toBe(2400);
    expect(result.bookings[0].amountEGP).toBe(2400);
    expect(result.bookings[0].passengersCount).toBe(2);
    expect(db.payments[0].amountEGP).toBe(2400);
  });

  it('refuses a party size that differs from what was held', () => {
    const h = hold(2);
    const err = rejection(() => checkout({ holdToken: h.holdToken, amountEGP: 4800, passengersCount: 4 }));
    expect(err.status).toBe(400);
    expect(err.code).toBe('HOLD_MISMATCH');
  });
});
