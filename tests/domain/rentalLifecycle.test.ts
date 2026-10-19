import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { db } from '../../server/db/database';
import { rentalService } from '../../server/services/rentalService';
import { resetDb, seedRentalListing, seedTrip, nextIdempotencyKey } from '../helpers/fixtures';

const travelActor = { userId: 'USR-TEST', role: 'Traveler' as const };
const opsActor = { userId: 'USR-OPS', role: 'Operations' as const };

function hold(listingId: string, over: { startDate?: string; endDate?: string; quantity?: number; idempotencyKey?: string } = {}) {
  return rentalService.createRentalBooking({
    listingId,
    tripId: 'TRIP-TEST',
    userId: 'USR-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 'traveler@test.test',
    startDate: over.startDate || localDate(0),
    endDate: over.endDate || localDate(2),
    quantity: over.quantity || 2,
    idempotencyKey: over.idempotencyKey || nextIdempotencyKey()
  }).booking;
}

function checkout(bookingId: string) {
  return rentalService.checkoutRentalBooking({
    rentalBookingId: bookingId,
    tripId: 'TRIP-TEST',
    travelerName: 'Test Traveler',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 'traveler@test.test',
    idempotencyKey: nextIdempotencyKey()
  });
}

const localDate = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
};

describe('rental booking lifecycle', () => {
  beforeEach(() => {
    resetDb();
    seedTrip();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a 15-minute hold that consumes day-slot inventory', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id);
    expect(booking.status).toBe('PENDING_PAYMENT');
    expect(booking.expiresAt).toBeDefined();

    const slot = db.inventorySlots.find(s => s.skuId === listing.skuId && s.date === localDate(0));
    expect(slot).toBeDefined();
    expect(slot!.heldCapacity).toBe(2);
    expect(slot!.totalCapacity).toBe(10);
  });

  it('gives every hold a unique placeholder bookingRef (SQLite UNIQUE(booking_ref))', () => {
    const listing = seedRentalListing();
    // Two holds + one cancelled hold: the in-memory adapter never enforces
    // UNIQUE, but SQLite does — the old '' placeholder collided on the second
    // hold. Each hold must carry a distinct ref even before checkout.
    const first = hold(listing.id);
    const second = hold(listing.id, { quantity: 1 });
    rentalService.cancelRentalBooking({ bookingId: first.id, actor: travelActor });
    const third = hold(listing.id);

    const refs = [first.bookingRef, second.bookingRef, third.bookingRef];
    for (const ref of refs) {
      expect(ref).toMatch(/^DHB-REN-HOLD-/);
      expect(ref.length).toBeGreaterThan(0);
    }
    expect(new Set(refs).size).toBe(3);
  });

  it('checkout settles at the snapshot price, creates the booking row and trip item', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id, { quantity: 2 });
    const result = checkout(booking.id);

    // Snapshot: 3 days × 300 × 2 bikes = 1800, −10% multi-day = 1620.
    expect(result.success).toBe(true);
    expect(result.totalAmountEGP).toBe(1620);

    const updated = db.rentalBookings.find(b => b.id === booking.id)!;
    expect(updated.status).toBe('PENDING_CONFIRMATION');
    expect(updated.paymentState).toBe('CAPTURED');
    expect(updated.bookingRef).toBe(result.bookingRef);

    const row = db.bookings.find(b => b.bookingRef === result.bookingRef);
    expect(row).toBeDefined();
    expect(row!.serviceType).toBe('rental');
    expect(row!.supplierState).toBe('PENDING_CONFIRMATION');
    expect(row!.amountEGP).toBe(1620);
    expect(row!.passengersCount).toBe(2);

    const trip = db.trips.find(t => t.id === 'TRIP-TEST')!;
    expect(trip.totalPaidEGP).toBe(1620);
    expect(db.tripItems.some(ti => ti.tripId === 'TRIP-TEST' && ti.bookingId === result.bookingRef)).toBe(true);

    // Slot accounting moved from held to reserved.
    const slot = db.inventorySlots.find(s => s.skuId === listing.skuId && s.date === localDate(0));
    expect(slot!.heldCapacity).toBe(0);
    expect(slot!.reservedCapacity).toBe(2);
  });

  it('is replay-safe: a checkout retry with the same payment key never duplicates', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id);
    const key = nextIdempotencyKey();

    const first = rentalService.checkoutRentalBooking({
      rentalBookingId: booking.id,
      tripId: 'TRIP-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+20 100 000 0000',
      travelerEmail: 'traveler@test.test',
      idempotencyKey: key
    });
    expect(first.success).toBe(true);
    expect(first.replayed).toBeUndefined();

    // The client retries with the SAME key after a timeout — must not double-book.
    const replayed = rentalService.checkoutRentalBooking({
      rentalBookingId: booking.id,
      tripId: 'TRIP-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+20 100 000 0000',
      travelerEmail: 'traveler@test.test',
      idempotencyKey: key
    });
    expect(replayed.replayed).toBe(true);
    expect(replayed.bookingRef).toBe(first.bookingRef);
    expect(db.bookings.filter(b => b.bookingRef === first.bookingRef)).toHaveLength(1);
    expect(db.payments.filter(p => p.idempotencyKey === key)).toHaveLength(1);
    expect(db.rentalBookings.filter(b => b.id === booking.id)).toHaveLength(1);
  });

  it('accept moves to CONFIRMED; reject refunds and releases inventory', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id);
    checkout(booking.id);

    rentalService.acceptRentalBooking({ bookingId: booking.id, supplierId: listing.supplierId });
    expect(db.rentalBookings.find(b => b.id === booking.id)!.status).toBe('CONFIRMED');
    expect(db.bookings.find(b => b.bookingRef === booking.bookingRef)!.supplierState).toBe('CONFIRMED');

    // Still consuming inventory after acceptance.
    const consuming = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: localDate(0),
      endDate: localDate(2),
      quantity: 9
    });
    expect(consuming.available).toBe(false);
  });

  it('reject refunds the traveler and releases inventory', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id);
    checkout(booking.id);

    rentalService.rejectRentalBooking({ bookingId: booking.id, supplierId: listing.supplierId, reason: 'No stock' });
    const updated = db.rentalBookings.find(b => b.id === booking.id)!;
    expect(updated.status).toBe('REJECTED');
    expect(updated.paymentState).toBe('REFUNDED');
    expect(db.bookings.find(b => b.bookingRef === booking.bookingRef)!.supplierState).toBe('REJECTED');

    const refunded = db.ledgerEntries.some(e => e.type === 'REFUND_ISSUED' && e.bookingRef === booking.bookingRef);
    expect(refunded).toBe(true);

    const freed = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: localDate(0),
      endDate: localDate(2),
      quantity: 10
    });
    expect(freed.available).toBe(true);
  });

  it('cancels within the free window with a full refund', () => {
    const listing = seedRentalListing(); // cancellationPolicyHours 24
    const booking = hold(listing.id, { startDate: '2027-01-10', endDate: '2027-01-12' });
    checkout(booking.id);
    rentalService.acceptRentalBooking({ bookingId: booking.id, supplierId: listing.supplierId });

    const cancelled = rentalService.cancelRentalBooking({ bookingId: booking.id, actor: travelActor, reason: 'Plan changed' });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.paymentState).toBe('REFUNDED');
    expect(db.ledgerEntries.some(e => e.type === 'REFUND_ISSUED' && e.bookingRef === booking.bookingRef)).toBe(true);
  });

  it('allows cancellation past the free window but does not refund', () => {
    vi.useFakeTimers({ now: new Date('2027-01-10T10:00:00+02:00') });
    const listing = seedRentalListing();
    // Fixed date + frozen clock: startDate is "today" (2027-01-10) so now > startTs − 24h (outside free window) without midnight flip.
    const booking = hold(listing.id, { startDate: '2027-01-10', endDate: '2027-01-12' });
    checkout(booking.id);

    const cancelled = rentalService.cancelRentalBooking({ bookingId: booking.id, actor: travelActor });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.paymentState).toBe('CAPTURED'); // no refund issued
    expect(db.ledgerEntries.some(e => e.type === 'REFUND_ISSUED' && e.bookingRef === booking.bookingRef)).toBe(false);
    vi.useRealTimers();
  });

  it('cancels an unpaid hold with no money movement', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id);
    const cancelled = rentalService.cancelRentalBooking({ bookingId: booking.id, actor: travelActor });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.paymentState).toBe('INITIATED');
    expect(db.bookings).toHaveLength(0);

    const freed = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: localDate(0),
      endDate: localDate(2),
      quantity: 10
    });
    expect(freed.available).toBe(true);
  });

  it('ops can override-cancel any non-terminal booking with a full refund', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id);
    checkout(booking.id);
    rentalService.acceptRentalBooking({ bookingId: booking.id, supplierId: listing.supplierId });
    rentalService.reconcileBookingStates();

    const cancelled = rentalService.cancelRentalBooking({ bookingId: booking.id, actor: opsActor, reason: 'Dispute' });
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.paymentState).toBe('REFUNDED');
  });

  it('mark-returned releases inventory, records deposits, and complete settles the 85% payout', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id);
    checkout(booking.id);
    rentalService.acceptRentalBooking({ bookingId: booking.id, supplierId: listing.supplierId });

    // startDate arrives → READY_FOR_PICKUP; provider hands over → ACTIVE.
    const readyBooking = db.rentalBookings.find(b => b.id === booking.id)!;
    readyBooking.status = 'READY_FOR_PICKUP';
    readyBooking.paymentState = 'CAPTURED';
    rentalService.markRentalReturned({ bookingId: booking.id, supplierId: listing.supplierId });

    const returned = db.rentalBookings.find(b => b.id === booking.id)!;
    expect(returned.status).toBe('RETURNED');
    expect(returned.depositStatus).toBe('RETURNED');

    const freed = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: localDate(0),
      endDate: localDate(2),
      quantity: 10
    });
    expect(freed.available).toBe(true);

    rentalService.completeRentalBooking({ bookingId: booking.id, supplierId: listing.supplierId });
    expect(db.rentalBookings.find(b => b.id === booking.id)!.status).toBe('COMPLETED');
    expect(db.bookings.find(b => b.bookingRef === booking.bookingRef)!.supplierState).toBe('COMPLETED');

    // 24h payout hold: schedule entry created, not yet settled (blueprint row #12).
    const payoutSchedule = db.payoutSchedule.find(p => p.bookingRef === booking.bookingRef);
    expect(payoutSchedule).toBeDefined();
    expect(payoutSchedule!.payoutState).toBe('PENDING');
    expect(payoutSchedule!.amountEGP).toBe(Math.round(1620 * 0.85)); // 1377
  });

  it('mark-returned with damage deducts deposit and books a late fee adjustment', () => {
    const listing = seedRentalListing(); // deposit 500
    const booking = hold(listing.id);
    checkout(booking.id);
    const ready = db.rentalBookings.find(b => b.id === booking.id)!;
    ready.status = 'READY_FOR_PICKUP';

    rentalService.markRentalReturned({
      bookingId: booking.id,
      supplierId: listing.supplierId,
      damageReport: 'Bent rear derailleur',
      depositDeductionEGP: 250,
      lateFeeEGP: 150
    });
    const returned = db.rentalBookings.find(b => b.id === booking.id)!;
    expect(returned.depositStatus).toBe('DEDUCTED');
    expect(returned.depositDeductionEGP).toBe(250);
    expect(returned.damageReport).toBe('Bent rear derailleur');
    expect(returned.lateFeeEGP).toBe(150);
    expect(db.ledgerEntries.some(e => e.type === 'ADJUSTMENT' && e.metadata?.reason === 'RENTAL_LATE_FEE')).toBe(true);
  });

  it('a provider cannot act on another provider\'s booking', () => {
    const listing = seedRentalListing();
    const booking = hold(listing.id);
    checkout(booking.id);

    let status: number | undefined;
    try {
      rentalService.acceptRentalBooking({ bookingId: booking.id, supplierId: 'SUP-OTHER' });
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(403);
  });

  it('reconciles CONFIRMED → READY_FOR_PICKUP when the start date arrives', () => {
    vi.useFakeTimers({ now: new Date('2027-01-10T10:00:00+02:00') });
    const listing = seedRentalListing();
    const booking = hold(listing.id, { startDate: '2027-01-10', endDate: '2027-01-12' });
    checkout(booking.id);
    rentalService.acceptRentalBooking({ bookingId: booking.id, supplierId: listing.supplierId });

    rentalService.reconcileBookingStates();
    const updated = db.rentalBookings.find(b => b.id === booking.id)!;
    expect(updated.status).toBe('READY_FOR_PICKUP');
    expect(db.bookings.find(b => b.bookingRef === booking.bookingRef)!.supplierState).toBe('READY_FOR_PICKUP');
    vi.useRealTimers();
  });

  it('rejects holds for listings that are not approved or active', () => {
    const listing = seedRentalListing({ status: 'SUSPENDED' });
    let status: number | undefined;
    try {
      hold(listing.id);
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(409);
  });
});
