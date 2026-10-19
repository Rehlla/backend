import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService } from '../../server/services/commerceService';
import { cancelBooking, getBooking } from '../../server/services/bookingService';
import { heldItem, nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * Free cancellation is measured BEFORE the service starts, not since booking.
 *
 * The window was `hoursSinceBooking < cancellationPolicyHours`: a dive booked a
 * month ahead lost its refund a day after purchase, while a dive booked for
 * tonight could be cancelled for a full refund an hour before the boat left.
 * A 24h policy means "free until 24h before the start" (Africa/Cairo).
 */

/** Cairo wall-clock date and HH:MM label `hoursAhead` from now. */
function cairoSlot(hoursAhead: number): { date: string; time: string } {
  const at = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Cairo', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).formatToParts(at);
  const get = (t: string) => parts.find(p => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}

function book(date: string, time: string) {
  const line = heldItem({ date, time });
  const { bookings } = commerceService.completeMultiServiceCheckout({
    tripId: 'TRIP-TEST',
    travelerUserId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+201000000000',
    travelerEmail: 'traveler@example.test',
    items: [line],
    paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'PAYMOB', cardLast4: '4242' }
  });
  return bookings[0];
}

const cancel = (b: { id: string; tripId: string; confirmationCode: string }) =>
  cancelBooking({
    bookingId: b.id, tripId: b.tripId, userId: 'USR-TEST', userRole: 'Traveler',
    reason: 'Plans changed', cancellationKey: b.confirmationCode
  });

describe('cancellation window — hours before the service starts', () => {
  beforeEach(() => { resetDb(); seedSku({ cancellationPolicyHours: 24 }); seedTrip(); });

  it('refunds a booking made long ago for a service still days away', () => {
    const slot = cairoSlot(10 * 24);
    const b = book(slot.date, slot.time);
    // Booked a month ago: the old "since booking" rule refused this refund.
    db.bookings.find(x => x.id === b.id)!.createdAt = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();

    const result = cancel(b);
    expect(result.refunded).toBe(true);
    expect(result.refundAmountEGP).toBe(b.amountEGP);
  });

  it('does not refund a booking made a minute ago for a service starting within the policy window', () => {
    const slot = cairoSlot(12);
    const b = book(slot.date, slot.time);

    const result = cancel(b);
    expect(result.success).toBe(true);
    expect(result.refunded).toBe(false);
    expect(db.bookings.find(x => x.id === b.id)!.supplierState).toBe('CANCELLED');
  });

  it('exposes freeCancellationUntil = service start (Cairo) minus the policy hours', () => {
    const b = book('2027-01-15', '08:30 AM (Morning Dive)');
    const summary = getBooking({ bookingId: b.id, userId: 'USR-TEST', userRole: 'Traveler' });
    // 08:30 Cairo in January is UTC+2 → 06:30Z; minus 24h.
    expect(summary.freeCancellationUntil).toBe('2027-01-14T06:30:00.000Z');
  });

  it('follows Egyptian summer time when placing the deadline', () => {
    const b = book('2027-07-15', '08:30 AM (Morning Dive)');
    const summary = getBooking({ bookingId: b.id, userId: 'USR-TEST', userRole: 'Traveler' });
    // Egypt observes DST (UTC+3) in July → 05:30Z; minus 24h.
    expect(summary.freeCancellationUntil).toBe('2027-07-14T05:30:00.000Z');
  });

  it('treats a slot label with no clock time as starting at the beginning of its day', () => {
    const b = book('2027-01-15', 'FULL_DAY');
    const summary = getBooking({ bookingId: b.id, userId: 'USR-TEST', userRole: 'Traveler' });
    // 00:00 Cairo (UTC+2) → 2027-01-14T22:00Z; minus 24h.
    expect(summary.freeCancellationUntil).toBe('2027-01-13T22:00:00.000Z');
  });
});
