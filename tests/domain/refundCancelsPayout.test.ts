import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { paymentService } from '../../server/services/paymentService';
import { supplierService } from '../../server/services/supplierService';
import { transferService } from '../../server/services/transferService';
import { heldItem, nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * A refund must stop the supplier's payout for the money given back.
 *
 * payoutService.cancelPayout existed and was never called: a booking refunded
 * inside the 24h payout hold still had its 85% payout settle from escrow, so
 * the platform paid the supplier with the money it had just returned.
 */

/** A card-paid booking (capture filed under its own ref), completed by the supplier. */
function completedCardBooking(pax = 2) {
  const line = heldItem({ pax });
  const { booking } = transferService.completeBooking({
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
  });
  supplierService.updateBookingState({ bookingId: booking.bookingRef, supplierId: 'SUP-TEST', action: 'ACCEPT' });
  for (const s of ['ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'COMPLETED'] as const) {
    transferService.updateSupplierStatus(booking.bookingRef, s);
  }
  return db.bookings.find(b => b.bookingRef === booking.bookingRef)!;
}

const payoutOf = (ref: string) => db.payoutSchedule.find(p => p.bookingRef === ref)!;

describe('refund vs pending payout', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('cancels the pending payout when the booking is refunded in full', () => {
    const booking = completedCardBooking();
    expect(payoutOf(booking.bookingRef).payoutState).toBe('PENDING');

    paymentService.processRefund({
      bookingId: booking.bookingRef,
      tripId: booking.tripId,
      amountEGP: booking.amountEGP,
      reason: 'Service not as described',
      idempotencyKey: nextIdempotencyKey()
    });

    expect(payoutOf(booking.bookingRef).payoutState).toBe('CANCELLED');
  });

  it('reduces the pending payout to the supplier share of what is left after a partial refund', () => {
    const booking = completedCardBooking(); // 2 × 1200 = 2400
    paymentService.processRefund({
      bookingId: booking.bookingRef,
      tripId: booking.tripId,
      amountEGP: 400,
      reason: 'Partial goodwill refund',
      idempotencyKey: nextIdempotencyKey()
    });

    const payout = payoutOf(booking.bookingRef);
    expect(payout.payoutState).toBe('PENDING');
    expect(payout.amountEGP).toBe(Math.round((2400 - 400) * 0.85));
  });

  it('leaves a completed booking COMPLETED after a refund', () => {
    const booking = completedCardBooking();
    paymentService.processRefund({
      bookingId: booking.bookingRef,
      tripId: booking.tripId,
      amountEGP: booking.amountEGP,
      reason: 'Refund after delivery',
      idempotencyKey: nextIdempotencyKey()
    });
    expect(db.bookings.find(b => b.bookingRef === booking.bookingRef)!.supplierState).toBe('COMPLETED');
  });
});
