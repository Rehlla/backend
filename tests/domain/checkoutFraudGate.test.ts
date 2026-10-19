import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService } from '../../server/services/commerceService';
import { transferService } from '../../server/services/transferService';
import { rentalService } from '../../server/services/rentalService';
import { FraudBlockedError } from '../../server/services/fraudDetectionService';
import { futureDate, heldItem, nextIdempotencyKey, resetDb, seedRentalListing, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * Every checkout path runs the same fraud gate before money moves.
 *
 * Only /api/commerce/checkout/multi evaluated fraud, so a blocked user could
 * still pay through the single (hold-settling) checkout or the rental
 * checkout. And because the multi route evaluated BEFORE the checkout's replay
 * check, a client retrying with the same idempotency key tripped the
 * duplicate_payment rule (risk 80 → block) and was permanently blocked.
 */

function blockUser(userId = 'USR-TEST') {
  const now = new Date().toISOString();
  db.fraudUserStats.push({
    userId, attemptsLastHour: 0, attemptsLastDay: 0, refundsLast30Days: 0, capturesLast30Days: 0,
    refundRate: 0, maxAmountLast30Days: 0, avgAmountRecent: 0, cumulativeRiskScore: 100,
    blocked: true, blockedReason: 'Test block', updatedAt: now
  });
}

function expectBlocked(fn: () => unknown) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(FraudBlockedError);
    expect((err as FraudBlockedError).status).toBe(403);
    expect((err as FraudBlockedError).code).toBe('FRAUD_BLOCKED');
    return;
  }
  throw new Error('expected FRAUD_BLOCKED');
}

const multi = (idempotencyKey = nextIdempotencyKey()) => commerceService.completeMultiServiceCheckout({
  tripId: 'TRIP-TEST',
  travelerUserId: 'USR-TEST',
  travelerName: 'Test Traveler',
  travelerPhone: '+201000000000',
  travelerEmail: 'traveler@example.test',
  items: [heldItem({ time: `T-${idempotencyKey}` })],
  paymentParams: { idempotencyKey, provider: 'PAYMOB', cardLast4: '4242' }
});

describe('checkout fraud gate', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('blocks multi-service checkout for a blocked user before any money moves', () => {
    blockUser();
    expectBlocked(() => multi());
    expect(db.payments).toHaveLength(0);
  });

  it('blocks the single hold-settling checkout for a blocked user', () => {
    const line = heldItem();
    blockUser();
    expectBlocked(() => transferService.completeBooking({
      holdToken: line.holdToken,
      tripId: 'TRIP-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+201000000000',
      travelerEmail: 'traveler@example.test',
      pickupLocation: 'SSH',
      dropoffLocation: 'Dahab',
      scheduledDate: line.scheduledDate,
      scheduledTime: line.scheduledTime,
      paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'PAYMOB', cardLast4: '4242' }
    }));
    expect(db.payments).toHaveLength(0);
  });

  it('blocks rental checkout for a blocked user', () => {
    const listing = seedRentalListing();
    const { booking } = rentalService.createRentalBooking({
      listingId: listing.id, tripId: 'TRIP-TEST', userId: 'USR-TEST', travelerName: 'Renter',
      travelerPhone: '+201000000002', travelerEmail: 'renter@test', startDate: futureDate(30), endDate: futureDate(32),
      quantity: 1, idempotencyKey: nextIdempotencyKey()
    });
    blockUser();
    expectBlocked(() => rentalService.checkoutRentalBooking({
      rentalBookingId: booking.id, tripId: 'TRIP-TEST', travelerName: 'Renter', travelerPhone: '+201000000002',
      travelerEmail: 'renter@test', idempotencyKey: nextIdempotencyKey(), provider: 'PAYMOB', cardLast4: '4242'
    }));
    expect(db.payments).toHaveLength(0);
  });

  it('evaluates every allowed checkout (signals and stats are recorded per user)', () => {
    multi();
    expect(db.fraudUserStats.some(s => s.userId === 'USR-TEST')).toBe(true);
  });

  it('replays a retried checkout instead of blocking it as a duplicate payment', () => {
    const key = nextIdempotencyKey();
    multi(key);
    const retry = multi(key);
    expect(retry.replayed).toBe(true);
    expect(db.fraudUserStats.find(s => s.userId === 'USR-TEST')?.blocked).toBe(false);
  });
});
