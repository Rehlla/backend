import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService } from '../../server/services/commerceService';
import { supplierService } from '../../server/services/supplierService';
import { transferService } from '../../server/services/transferService';
import { heldItem, nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * Two supplier routes could complete a booking, and they disagreed:
 *
 * - /api/suppliers/bookings/:id/respond (supplierService.updateBookingState)
 *   skipped the lifecycle state machine — COMPLETE straight from
 *   PENDING_CONFIRMATION scheduled a payout for a service never delivered.
 * - /api/suppliers/bookings/:id/status (transferService.updateSupplierStatus)
 *   validated transitions but never scheduled a payout at all.
 *
 * Both now validate with canTransition and both schedule exactly one payout.
 */

function cardBooking() {
  const { bookings } = commerceService.completeMultiServiceCheckout({
    tripId: 'TRIP-TEST',
    travelerUserId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+201000000000',
    travelerEmail: 'traveler@example.test',
    items: [heldItem()],
    paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'PAYMOB', cardLast4: '4242' }
  });
  return bookings[0].bookingRef;
}

const respond = (ref: string, action: 'ACCEPT' | 'REJECT' | 'DISPATCH' | 'COMPLETE', assignedResource?: Record<string, string>) =>
  supplierService.updateBookingState({ bookingId: ref, supplierId: 'SUP-TEST', action, assignedResource });

const payoutsFor = (ref: string) => db.payoutSchedule.filter(p => p.bookingRef === ref && p.payoutState !== 'CANCELLED');
const stateOf = (ref: string) => db.bookings.find(b => b.bookingRef === ref)!.supplierState;

function statusOf(fn: () => unknown): number | undefined {
  try { fn(); } catch (err) { return (err as { status?: number }).status; }
  return undefined;
}

describe('supplier completion — one lifecycle, one payout', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('respond COMPLETE refuses to skip the lifecycle (409, no payout)', () => {
    const ref = cardBooking();
    expect(statusOf(() => respond(ref, 'COMPLETE'))).toBe(409);
    expect(stateOf(ref)).toBe('PENDING_CONFIRMATION');
    expect(payoutsFor(ref)).toHaveLength(0);
  });

  it('respond DISPATCH with a resource records the assignment on the way', () => {
    const ref = cardBooking();
    respond(ref, 'ACCEPT');
    respond(ref, 'DISPATCH', { driverName: 'Assigned Driver', driverPhone: '+201111111111' });
    expect(stateOf(ref)).toBe('DISPATCHED');
  });

  it('respond COMPLETE after a real journey schedules exactly one payout', () => {
    const ref = cardBooking();
    respond(ref, 'ACCEPT');
    for (const s of ['ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED'] as const) transferService.updateSupplierStatus(ref, s);
    respond(ref, 'COMPLETE');
    expect(stateOf(ref)).toBe('COMPLETED');
    expect(payoutsFor(ref)).toHaveLength(1);
    expect(payoutsFor(ref)[0].amountEGP).toBe(Math.round(1200 * 0.85));
  });

  it('the status route schedules the payout when it reaches COMPLETED', () => {
    const ref = cardBooking();
    respond(ref, 'ACCEPT');
    for (const s of ['ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED'] as const) transferService.updateSupplierStatus(ref, s);
    expect(stateOf(ref)).toBe('COMPLETED');
    expect(payoutsFor(ref)).toHaveLength(1);
  });

  it('the status route validates transitions itself (409)', () => {
    const ref = cardBooking();
    expect(statusOf(() => transferService.updateSupplierStatus(ref, 'COMPLETED'))).toBe(409);
    expect(payoutsFor(ref)).toHaveLength(0);
  });

  it('completing through one route then the other never schedules a second payout', () => {
    const ref = cardBooking();
    respond(ref, 'ACCEPT');
    for (const s of ['ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED'] as const) transferService.updateSupplierStatus(ref, s);
    expect(statusOf(() => respond(ref, 'COMPLETE'))).toBe(409);
    expect(db.payoutSchedule.filter(p => p.bookingRef === ref)).toHaveLength(1);
  });
});
