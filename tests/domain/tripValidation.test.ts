import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService, UnknownTripError } from '../../server/services/commerceService';
import { heldItem, nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';
import { retentionService } from '../../server/services/retentionService';

/**
 * A booking must belong to a trip that exists.
 *
 * The store still carries what happened without this check: a CAPTURED
 * booking, its payment and two ledger entries all filed against
 * 'DHB-TRIP-DAHAB-FIRST-TIMER' — a plan-template slug a client path sent in
 * place of the traveller's real trip id. Four money rows point at an itinerary
 * that never existed, and nothing rejected any of them.
 */
const checkout = (tripId: string) =>
  commerceService.completeMultiServiceCheckout({
    tripId,
    travelerUserId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 'test@example.com',
    // Held against the real trip: the unknown-trip check runs before any hold
    // is looked at, so the hold only matters for the trip that exists.
    items: [heldItem({ time: '09:00 AM' })],
    paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'CASH_ON_ARRIVAL' }
  });

describe('checkout requires a real trip', () => {
  beforeEach(() => {
    resetDb();
    seedSku();
    seedTrip();
  });

  it('accepts a checkout against a trip that exists', () => {
    expect(checkout('TRIP-TEST').success).toBe(true);
  });

  it('refuses the plan-template slug that produced the orphaned rows', () => {
    expect(() => checkout('DHB-TRIP-DAHAB-FIRST-TIMER')).toThrow(UnknownTripError);
  });

  it('refuses an empty trip id, which is what the client now sends as a fallback', () => {
    expect(() => checkout('')).toThrow(UnknownTripError);
  });

  it('takes no money and writes no booking when it refuses', () => {
    const paymentsBefore = db.payments.length;
    const ledgerBefore = db.ledgerEntries.length;

    expect(() => checkout('TRIP-GHOST')).toThrow(UnknownTripError);

    // The check runs before processCheckout for this reason: a throw after
    // settlement would leave the traveller charged for a booking that could
    // never be filed.
    expect(db.payments).toHaveLength(paymentsBefore);
    expect(db.ledgerEntries).toHaveLength(ledgerBefore);
    expect(db.bookings).toHaveLength(0);
  });

  it('reports it as a bad request, not a server fault', () => {
    try {
      checkout('TRIP-GHOST');
      expect.unreachable('checkout should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnknownTripError);
      expect((err as UnknownTripError).status).toBe(400);
      expect((err as UnknownTripError).details).toEqual({ tripId: 'TRIP-GHOST' });
    }
  });
});

describe('retention', () => {
  const session = (id: string, expiresAt: string) => ({
    id,
    userId: 'USR-TEST',
    token: `tok_${id}`,
    role: 'Traveler',
    expiresAt,
    createdAt: '2026-01-01T00:00:00.000Z'
  });

  beforeEach(() => resetDb());

  it('removes expired sessions, which were previously kept forever', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    db.sessions.push(session('SES-OLD', past) as never, session('SES-LIVE', future) as never);

    const removed = retentionService.sweepExpiredSessions();

    expect(removed).toBe(1);
    expect(db.sessions.map(s => s.id)).toEqual(['SES-LIVE']);
  });

  it('never removes a live session — this must not sign anyone out mid-booking', () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();
    db.sessions.push(session('SES-LIVE', future) as never);

    expect(retentionService.sweepExpiredSessions()).toBe(0);
    expect(db.sessions).toHaveLength(1);
  });

  it('leaves the audit log alone while it is under the retention limit', () => {
    for (let n = 0; n < 5; n++) {
      db.auditEvents.push({ id: `AUD-${n}` } as never);
    }
    expect(retentionService.archiveOldAuditEvents(10).archived).toBe(0);
    expect(db.auditEvents).toHaveLength(5);
  });
});
