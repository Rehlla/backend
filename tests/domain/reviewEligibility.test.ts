import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { reviewService, ReviewRejectedError } from '../../server/services/reviewService';
import type { BookingEntity } from '../../server/db/schema';
import { futureDate, resetDb, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * A verified review needs a service that actually happened.
 *
 * The gate accepted `paymentState === 'CAPTURED' || supplierState ===
 * 'COMPLETED'`, and card checkout captures at purchase — so a traveller could
 * review a dive the moment they paid for it, weeks before getting in the water.
 * Now: COMPLETED by the supplier, or an accepted booking whose service end has
 * passed.
 */

let seq = 0;
function booking(over: Partial<BookingEntity>): string {
  const ref = `DHB-DIV-REV-${++seq}`;
  const now = new Date().toISOString();
  db.bookings.push({
    id: ref, bookingRef: ref, tripId: 'TRIP-TEST', supplierId: 'SUP-TEST', skuId: 'SKU-DIVE-TEST',
    serviceType: 'diving', amountEGP: 1200, paymentState: 'CAPTURED', supplierState: 'CONFIRMED',
    travelerName: 'T', travelerPhone: '+201000000000', travelerEmail: 't@example.test', passengersCount: 1,
    scheduledDate: futureDate(10), scheduledTime: '08:30 AM', confirmationCode: 'C', createdAt: now, updatedAt: now,
    ...over
  });
  return ref;
}

const submit = (bookingRef: string) =>
  reviewService.submitReview({ bookingRef, userId: 'USR-TEST', rating: 5, body: 'Great dive.' });

function rejectionStatus(fn: () => unknown): number | undefined {
  try { fn(); } catch (err) { expect(err).toBeInstanceOf(ReviewRejectedError); return (err as ReviewRejectedError).status; }
  return undefined;
}

describe('review eligibility', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('refuses a review right after payment, before the service has happened', () => {
    expect(rejectionStatus(() => submit(booking({ paymentState: 'CAPTURED', supplierState: 'CONFIRMED' })))).toBe(409);
  });

  it('accepts a review once the supplier marked the booking COMPLETED', () => {
    expect(submit(booking({ supplierState: 'COMPLETED', scheduledDate: futureDate(10) })).moderationStatus).toBe('pending');
  });

  it('accepts a review for an accepted booking whose service has ended', () => {
    expect(submit(booking({ supplierState: 'CONFIRMED', scheduledDate: futureDate(-3) })).moderationStatus).toBe('pending');
  });

  it('refuses a cancelled booking even after its date has passed', () => {
    expect(rejectionStatus(() => submit(booking({ supplierState: 'CANCELLED', scheduledDate: futureDate(-3) })))).toBe(409);
  });

  it('refuses a booking the supplier never accepted, even after its date has passed', () => {
    expect(rejectionStatus(() => submit(booking({ supplierState: 'PENDING_CONFIRMATION', scheduledDate: futureDate(-3) })))).toBe(409);
  });
});
