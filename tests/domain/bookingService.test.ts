import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService } from '../../server/services/commerceService';
import {
  getBooking,
  getTripBookings,
  cancelBooking,
  rescheduleBooking,
  getRichAvailability
} from '../../server/services/bookingService';
import { futureDate, nextIdempotencyKey, resetDb, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * The traveller-facing booking surface — detail, cancel, reschedule and rich
 * availability — must enforce ownership server-side and must keep inventory
 * exactly in step with the booking's lifecycle.
 *
 * These tests drive the real service layer over the in-memory adapter: a
 * booking is created the way a real traveller creates one (hold, then
 * checkout), so the inventory rows under test are the ones production writes.
 */

// Relative, not pinned: free cancellation is measured against the service
// start, so a fixed date becomes a past booking as the calendar moves.
const DATE = futureDate(30);
const NEXT_DAY = futureDate(31);
const MORNING = '08:30 AM (Morning Dive)';
const AFTERNOON = '01:30 PM (Afternoon Dive)';
const IDK = () => nextIdempotencyKey();

const BOOKING_ID = 'BK-SERVICE-TEST-1';

function statusOf(err: unknown): number {
  return (err as { status?: number }).status ?? -1;
}

/** Creates a held + checked-out booking for USR-TEST / TRIP-TEST on a slot. */
function bookFor(
  over: { userId?: string; tripId?: string; time?: string; date?: string; pax?: number; key?: string; provider?: 'PAYMOB' | 'CASH_ON_ARRIVAL' } = {}
) {
  const userId = over.userId ?? 'USR-TEST';
  const tripId = over.tripId ?? 'TRIP-TEST';
  const date = over.date ?? DATE;
  const time = over.time ?? MORNING;
  const pax = over.pax ?? 2;

  const hold = commerceService.createHold({
    skuId: 'SKU-DIVE-TEST',
    tripId,
    travelerId: userId,
    date,
    timeSlot: time,
    passengersCount: pax,
    idempotencyKey: over.key ?? IDK()
  });

  return commerceService.completeMultiServiceCheckout({
    tripId,
    travelerUserId: userId,
    travelerName: 'Test Traveler',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 'traveler@test.test',
    items: [
      {
        serviceType: 'diving',
        skuId: 'SKU-DIVE-TEST',
        holdToken: hold.holdToken,
        scheduledDate: date,
        scheduledTime: time,
        amountEGP: 1200 * pax,
        passengersCount: pax
      }
    ],
    paymentParams: { idempotencyKey: IDK(), provider: over.provider ?? 'CASH_ON_ARRIVAL' }
  });
}

function slotAt(date = DATE, time = MORNING) {
  return db.inventorySlots.find(s => s.skuId === 'SKU-DIVE-TEST' && s.date === date && s.timeSlot === time);
}

describe('bookingService — ownership (backend-authoritative)', () => {
  beforeEach(() => {
    resetDb();
    seedSku({ maxCapacityPerSlot: 8 });
    seedTrip();
    // A second trip belonging to somebody else, to prove the ref alone is not
    // enough to read or act on a booking.
    db.trips.push({
      id: 'TRIP-OTHER',
      userId: 'USR-OTHER',
      title: 'Someone else\'s trip',
      status: 'PLANNED',
      lengthDays: 3,
      travelersCount: 2,
      budget: 'Moderate',
      pace: 'Balanced',
      interests: [],
      totalEstimatedEGP: 0,
      totalPaidEGP: 0,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z'
    });
  });

  it('lets the trip owner read their booking', () => {
    const { bookings } = bookFor();
    const summary = getBooking({ bookingId: bookings[0].id, userId: 'USR-TEST', userRole: 'Traveler' });
    expect(summary.id).toBe(bookings[0].id);
    expect(summary.scheduledDate).toBe(DATE);
  });

  it('refuses another traveller who knows only the booking reference', () => {
    const { bookings } = bookFor();
    expect(() =>
      getBooking({ bookingId: bookings[0].bookingRef, userId: 'USR-OTHER', userRole: 'Traveler' })
    ).toThrowError(/permission/);
  });

  it('never tells User B the booking exists — 404, not 403, on trip-bookings listing', () => {
    bookFor();
    expect(() =>
      getTripBookings({ tripId: 'TRIP-TEST', userId: 'USR-OTHER', userRole: 'Traveler' })
    ).toThrowError(/permission/);
    // The listing endpoint answers 403 for a trip that exists but is not yours.
    expect(() => getTripBookings({ tripId: 'TRIP-TEST', userId: 'USR-OTHER', userRole: 'Traveler' }))
      .toThrowError(expect.objectContaining({ status: 403 }));
  });

  it('lets a supplier read a booking of their own service', () => {
    const { bookings } = bookFor();
    const summary = getBooking({ bookingId: bookings[0].id, userId: 'SUP-TEST', userRole: 'Supplier' });
    expect(summary.bookingRef).toBeTruthy();
  });

  it('rejects an unknown booking with 404', () => {
    expect(() => getBooking({ bookingId: 'NOPE', userId: 'USR-TEST', userRole: 'Traveler' })).toThrowError(
      expect.objectContaining({ status: 404 })
    );
  });

  it('User A cannot cancel User B’s booking', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    expect(() =>
      cancelBooking({
        bookingId: b.id,
        tripId: b.tripId,
        userId: 'USR-OTHER',
        userRole: 'Traveler',
        reason: 'test',
        cancellationKey: b.confirmationCode
      })
    ).toThrowError(/permission/);
    expect(db.bookings.find(x => x.id === b.id)!.supplierState).not.toBe('CANCELLED');
  });

  it('User A cannot reschedule User B’s booking', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    expect(() =>
      rescheduleBooking({
        bookingId: b.id,
        tripId: b.tripId,
        userId: 'USR-OTHER',
        userRole: 'Traveler',
        newDate: DATE,
        newTime: AFTERNOON,
        idempotencyKey: IDK()
      })
    ).toThrowError(/permission/);
    expect(db.bookings.find(x => x.id === b.id)!.scheduledTime).toBe(MORNING);
  });
});

describe('bookingService — cancellation', () => {
  beforeEach(() => {
    resetDb();
    seedSku({ maxCapacityPerSlot: 8 });
    seedTrip();
  });

  it('cancels within policy, refunds a captured booking and releases the slot', () => {
    // A captured payment (PAYMOB) is what a refund can return. Cash-on-arrival
    // settles nothing at checkout, so cancelling it releases the slot without
    // issuing a refund — asserted in the next test.
    const { bookings } = bookFor({ provider: 'PAYMOB' });
    const b = bookings[0];
    expect(slotAt()!.reservedCapacity).toBe(2);

    const result = cancelBooking({
      bookingId: b.id,
      tripId: b.tripId,
      userId: 'USR-TEST',
      userRole: 'Traveler',
      reason: 'Traveler request',
      cancellationKey: b.confirmationCode
    });

    expect(result.success).toBe(true);
    expect(result.refunded).toBe(true);
    expect(result.refundAmountEGP).toBe(b.amountEGP);
    const updated = db.bookings.find(x => x.id === b.id)!;
    expect(updated.supplierState).toBe('CANCELLED');
    expect(updated.paymentState).toBe('REFUNDED');
    // Inventory returned to the pool.
    expect(slotAt()!.reservedCapacity).toBe(0);
    // The converted hold is closed so nothing can release the slot again.
    expect(db.holds.every(h => h.status === 'RELEASED' || h.status === 'EXPIRED')).toBe(true);
  });

  it('cancels a cash-on-arrival booking without inventing a refund', () => {
    // Nothing was captured at checkout, so there is nothing to refund — but
    // the slot must still return to the pool and the hold must close.
    const { bookings } = bookFor({ provider: 'CASH_ON_ARRIVAL' });
    const b = bookings[0];
    expect(db.bookings.find(x => x.id === b.id)!.paymentState).toBe('PENDING');

    const result = cancelBooking({
      bookingId: b.id,
      tripId: b.tripId,
      userId: 'USR-TEST',
      userRole: 'Traveler',
      reason: 'Traveler request',
      cancellationKey: b.confirmationCode
    });

    expect(result.success).toBe(true);
    expect(result.refunded).toBe(false);
    // No refund was invented — the field stays absent (client renders `?? 0`).
    expect(result.refundAmountEGP).toBeUndefined();
    const updated = db.bookings.find(x => x.id === b.id)!;
    expect(updated.supplierState).toBe('CANCELLED');
    expect(updated.paymentState).toBe('PENDING');
    expect(slotAt()!.reservedCapacity).toBe(0);
  });

  it('cancels without a refund once the free-cancellation window has passed', () => {
    // A captured booking whose service starts within the SKU's 24h window:
    // today, with no clock time, starts at 00:00 Cairo — already inside it.
    const { bookings } = bookFor({ provider: 'PAYMOB' });
    const b = bookings[0];
    const late = db.bookings.find(x => x.id === b.id)!;
    late.scheduledDate = new Date().toISOString().slice(0, 10);
    late.scheduledTime = 'FULL_DAY';

    const result = cancelBooking({
      bookingId: b.id,
      tripId: b.tripId,
      userId: 'USR-TEST',
      userRole: 'Traveler',
      reason: 'Changed plans',
      cancellationKey: b.confirmationCode
    });
    expect(result.success).toBe(true);
    expect(result.refunded).toBe(false);
    expect(db.bookings.find(x => x.id === b.id)!.supplierState).toBe('CANCELLED');
  });

  it('rejects a second cancel of the same booking with 409', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    cancelBooking({
      bookingId: b.id, tripId: b.tripId, userId: 'USR-TEST', userRole: 'Traveler',
      reason: 'first', cancellationKey: b.confirmationCode
    });
    try {
      cancelBooking({
        bookingId: b.id, tripId: b.tripId, userId: 'USR-TEST', userRole: 'Traveler',
        reason: 'second', cancellationKey: b.confirmationCode
      });
      expect.unreachable('second cancel should have been rejected');
    } catch (err) {
      expect(statusOf(err)).toBe(409);
    }
  });

  it('rejects a cancel when the booking reference is known but the key is not', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    try {
      cancelBooking({
        bookingId: b.bookingRef, tripId: b.tripId, userId: 'USR-TEST', userRole: 'Traveler',
        reason: 'guess', cancellationKey: 'WRONG-KEY'
      });
      expect.unreachable('wrong key should be rejected');
    } catch (err) {
      expect(statusOf(err)).toBe(403);
    }
    expect(db.bookings.find(x => x.id === b.id)!.supplierState).not.toBe('CANCELLED');
  });

  it('cancels a legacy booking that never touched inventory without corrupting it', () => {
    // A booking from the old direct checkout (no holdToken) — no slot row, no
    // hold. Checkout now refuses to create these, but the store still holds
    // them, so the row is seeded as it was written. Cancelling must be a no-op
    // on inventory, not a crash.
    const now = new Date().toISOString();
    const b = {
      id: 'DHB-DIV-LEGACY-1', bookingRef: 'DHB-DIV-LEGACY-1', tripId: 'TRIP-TEST', supplierId: 'SUP-TEST',
      skuId: 'SKU-DIVE-TEST', serviceType: 'diving' as const, amountEGP: 2400, paymentState: 'PENDING' as const,
      supplierState: 'PENDING_CONFIRMATION' as const, travelerName: 'Test Traveler', travelerPhone: '+20 100 000 0000',
      travelerEmail: 'traveler@test.test', passengersCount: 2, scheduledDate: DATE, scheduledTime: MORNING,
      confirmationCode: 'DHB-DIV-LEGACY', createdAt: now, updatedAt: now
    };
    db.bookings.push(b);
    const out = cancelBooking({
      bookingId: b.id, tripId: b.tripId, userId: 'USR-TEST', userRole: 'Traveler',
      reason: 'legacy', cancellationKey: b.confirmationCode
    });
    expect(out.success).toBe(true);
    expect(db.bookings.find(x => x.id === b.id)!.supplierState).toBe('CANCELLED');
  });

  it('rejects a cancel filed against the wrong trip', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    try {
      cancelBooking({
        bookingId: b.id, tripId: 'TRIP-OTHER', userId: 'USR-TEST', userRole: 'Traveler',
        reason: 'wrong trip', cancellationKey: b.confirmationCode
      });
      expect.unreachable('wrong trip should be rejected');
    } catch (err) {
      expect(statusOf(err)).toBe(400);
    }
  });
});

describe('bookingService — rescheduling', () => {
  beforeEach(() => {
    resetDb();
    seedSku({ maxCapacityPerSlot: 8 });
    seedTrip();
  });

  it('moves the booking and its capacity to the new slot', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    const result = rescheduleBooking({
      bookingId: b.id,
      tripId: b.tripId,
      userId: 'USR-TEST',
      userRole: 'Traveler',
      newDate: DATE,
      newTime: AFTERNOON,
      idempotencyKey: IDK()
    });
    expect(result.success).toBe(true);
    const updated = db.bookings.find(x => x.id === b.id)!;
    expect(updated.scheduledTime).toBe(AFTERNOON);
    expect(slotAt(DATE, MORNING)!.reservedCapacity).toBe(0);
    expect(slotAt(DATE, AFTERNOON)!.reservedCapacity).toBe(2);
    // The converted hold follows the booking to the new slot, so a later
    // cancel releases the new slot exactly once.
    expect(db.holds.filter(h => h.status === 'CONVERTED')).toHaveLength(1);
    expect(db.holds.find(h => h.status === 'CONVERTED')!.slotId).toBe(slotAt(DATE, AFTERNOON)!.id);
  });

  it('leaves the old booking untouched when the new slot is sold out (atomic)', () => {
    const { bookings } = bookFor(); // pax 2 on the morning slot
    // Fill the afternoon slot to capacity with another party.
    bookFor({ time: AFTERNOON, pax: 8 });
    expect(slotAt(DATE, AFTERNOON)!.reservedCapacity).toBe(8);

    const b = bookings[0];
    try {
      rescheduleBooking({
        bookingId: b.id,
        tripId: b.tripId,
        userId: 'USR-TEST',
        userRole: 'Traveler',
        newDate: DATE,
        newTime: AFTERNOON,
        idempotencyKey: IDK()
      });
      expect.unreachable('reschedule into a full slot should throw');
    } catch (err) {
      expect(statusOf(err)).toBe(409);
    }
    // The old booking is still exactly where it was.
    const after = db.bookings.find(x => x.id === b.id)!;
    expect(after.scheduledTime).toBe(MORNING);
    expect(after.scheduledDate).toBe(DATE);
    expect(slotAt(DATE, MORNING)!.reservedCapacity).toBe(2);
    expect(slotAt(DATE, AFTERNOON)!.reservedCapacity).toBe(8);
    expect(db.bookings.filter(x => x.id === b.id)).toHaveLength(1);
  });

  it('treats a same-slot request as a no-op', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    const result = rescheduleBooking({
      bookingId: b.id,
      tripId: b.tripId,
      userId: 'USR-TEST',
      userRole: 'Traveler',
      newDate: DATE,
      newTime: MORNING,
      idempotencyKey: IDK()
    });
    expect(result.success).toBe(true);
    expect(slotAt()!.reservedCapacity).toBe(2);
  });

  it('refuses to reschedule a booking in a terminal state', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    const row = db.bookings.find(x => x.id === b.id)!;
    row.supplierState = 'CANCELLED';
    try {
      rescheduleBooking({
        bookingId: b.id,
        tripId: b.tripId,
        userId: 'USR-TEST',
        userRole: 'Traveler',
        newDate: DATE,
        newTime: AFTERNOON,
        idempotencyKey: IDK()
      });
      expect.unreachable('terminal bookings cannot be rescheduled');
    } catch (err) {
      expect(statusOf(err)).toBe(409);
    }
  });

  it('releases the old slot before a second reschedule of the same booking', () => {
    const { bookings } = bookFor();
    const b = bookings[0];
    rescheduleBooking({
      bookingId: b.id, tripId: b.tripId, userId: 'USR-TEST', userRole: 'Traveler',
      newDate: DATE, newTime: AFTERNOON, idempotencyKey: IDK()
    });
    rescheduleBooking({
      bookingId: b.id, tripId: b.tripId, userId: 'USR-TEST', userRole: 'Traveler',
      newDate: NEXT_DAY, newTime: MORNING, idempotencyKey: IDK()
    });
    expect(slotAt(DATE, MORNING)!.reservedCapacity).toBe(0);
    expect(slotAt(DATE, AFTERNOON)!.reservedCapacity).toBe(0);
    expect(slotAt(NEXT_DAY, MORNING)!.reservedCapacity).toBe(2);
    expect(db.holds.filter(h => h.status === 'CONVERTED')).toHaveLength(1);
    expect(db.holds.find(h => h.status === 'CONVERTED')!.slotId).toBe(slotAt(NEXT_DAY, MORNING)!.id);
  });
});

describe('bookingService — rich availability', () => {
  beforeEach(() => {
    resetDb();
    seedSku({ maxCapacityPerSlot: 8 });
    seedTrip();
  });

  it('reports per-slot capacity including held seats and sold-out slots', () => {
    // One party holds (not yet booked) the afternoon slot.
    commerceService.createHold({
      skuId: 'SKU-DIVE-TEST', tripId: 'TRIP-TEST', travelerId: 'USR-TEST',
      date: DATE, timeSlot: AFTERNOON, passengersCount: 5, idempotencyKey: IDK()
    });
    // Another party books the morning slot solid.
    bookFor({ time: MORNING, pax: 8 });

    const result = getRichAvailability({ serviceType: 'diving', skuId: 'SKU-DIVE-TEST', date: DATE, passengers: 2 });
    expect(result.available).toBe(true);
    const morning = result.slots.find(s => s.timeSlot === MORNING)!;
    const afternoon = result.slots.find(s => s.timeSlot === AFTERNOON)!;
    expect(morning.availableCapacity).toBe(0);
    expect(morning.status).toBe('SOLD_OUT');
    expect(afternoon.availableCapacity).toBe(3);
    // Held seats are counted against availability.
    expect(afternoon.totalCapacity - afternoon.availableCapacity).toBe(5);
  });

  it('returns empty slot lists (rather than inventing rows) when a date has no slots and no skus', () => {
    const result = getRichAvailability({ serviceType: 'diving', skuId: 'SKU-DIVE-NOPE', date: '2030-01-01', passengers: 2 });
    expect(result.available).toBe(false);
    expect(result.slots).toHaveLength(0);
    expect(result.skus).toHaveLength(0);
  });
});
