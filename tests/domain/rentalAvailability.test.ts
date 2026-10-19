import { describe, expect, it, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { rentalService } from '../../server/services/rentalService';
import { InsufficientCapacityError } from '../../server/services/commerceService';
import { resetDb, seedRentalListing, seedRentalBooking, seedTrip, nextIdempotencyKey } from '../helpers/fixtures';

/**
 * YYYY-MM-DD for today + offsetDays in LOCAL time — mirrors the service's
 * todayLocal() contract (rentalService). Fixture windows are always relative
 * to "now" so the suite cannot rot when the calendar moves past a hardcoded
 * date (this file previously froze 2026-09-10 and failed the moment that
 * date became yesterday).
 */
const future = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toLocaleDateString('sv-SE'); // YYYY-MM-DD in local time
};
const past = (offsetDays: number): string => future(-offsetDays);

describe('rental availability engine', () => {
  beforeEach(() => {
    resetDb();
    seedTrip();
  });

  it('computes the worked example: fleet 10, A 10–12 × 4, B 11–13 × 3', () => {
    const listing = seedRentalListing();
    seedRentalBooking(listing, { startDate: future(0), endDate: future(2), quantity: 4 });
    seedRentalBooking(listing, { startDate: future(1), endDate: future(3), quantity: 3 });

    const check = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(3),
      quantity: 1
    });

    expect(check.availablePerDay.map(d => ({ date: d.date, available: d.available }))).toEqual([
      { date: future(0), available: 6 },
      { date: future(1), available: 3 },
      { date: future(2), available: 3 },
      { date: future(3), available: 7 }
    ]);
    expect(check.windowAvailable).toBe(3);
  });

  it('rejects a window where any single day falls short, naming the reason day', () => {
    const listing = seedRentalListing();
    seedRentalBooking(listing, { startDate: future(0), endDate: future(2), quantity: 4 });
    seedRentalBooking(listing, { startDate: future(1), endDate: future(3), quantity: 3 });

    const check = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(1),
      endDate: future(2),
      quantity: 4
    });
    expect(check.available).toBe(false);
    expect(check.windowAvailable).toBe(3);
    expect(check.reasonDay).toBe(future(1));

    const fits = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(1),
      endDate: future(2),
      quantity: 3
    });
    expect(fits.available).toBe(true);
  });

  it('treats the end date as inclusive — a same-day rental occupies exactly one day', () => {
    const listing = seedRentalListing();
    const check = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(15),
      endDate: future(15),
      quantity: 10
    });
    expect(check.available).toBe(true);
    expect(check.availablePerDay).toHaveLength(1);
  });

  it('subtracts maintenance blocks from availability', () => {
    const listing = seedRentalListing();
    rentalService.createMaintenanceBlock({
      listingId: listing.id,
      startDate: future(20),
      endDate: future(22),
      quantityBlocked: 4,
      reason: 'Service',
      createdBy: 'SUP-TEST'
    });

    const check = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(20),
      endDate: future(21),
      quantity: 7
    });
    expect(check.available).toBe(false); // 10 - 4 blocked = 6 free
    expect(check.availablePerDay[0].available).toBe(6);

    const outside = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(23),
      endDate: future(24),
      quantity: 10
    });
    expect(outside.available).toBe(true);
  });

  it('does not let a maintenance block over-commit a day with confirmed bookings', () => {
    const listing = seedRentalListing({ quantity: 10 });
    seedRentalBooking(listing, { startDate: future(20), endDate: future(22), quantity: 5 });

    let status: number | undefined;
    try {
      rentalService.createMaintenanceBlock({
        listingId: listing.id,
        startDate: future(20),
        endDate: future(21),
        quantityBlocked: 6, // 5 booked + 6 blocked = 11 > 10
        reason: 'Service',
        createdBy: 'SUP-TEST'
      });
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(409);
    expect(db.rentalMaintenanceBlocks).toHaveLength(0);
  });

  it('releases inventory for non-consuming statuses (CANCELLED, COMPLETED, RETURNED, REJECTED)', () => {
    const listing = seedRentalListing();
    seedRentalBooking(listing, { startDate: future(30), endDate: future(32), quantity: 3, status: 'CANCELLED' });
    seedRentalBooking(listing, { startDate: future(30), endDate: future(32), quantity: 2, status: 'COMPLETED' });
    seedRentalBooking(listing, { startDate: future(30), endDate: future(32), quantity: 1, status: 'REJECTED' });

    const check = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(30),
      endDate: future(32),
      quantity: 10
    });
    expect(check.available).toBe(true);
    expect(check.availablePerDay[0].committed).toBe(0);
  });

  it('releases inventory when a PENDING_PAYMENT hold expires', () => {
    const listing = seedRentalListing();
    const { booking } = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      startDate: future(60),
      endDate: future(61),
      quantity: 5,
      idempotencyKey: nextIdempotencyKey()
    });

    // The hold materialised day slots holding 5 of the 10 bikes.
    const slot = db.inventorySlots.find(s => s.skuId === listing.skuId && s.date === future(60));
    expect(slot!.heldCapacity).toBe(5);

    // Force expiry; the next availability check self-heals by sweeping it.
    booking.expiresAt = '2020-01-01T00:00:00.000Z';
    const after = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(60),
      endDate: future(61),
      quantity: 6
    });
    expect(after.available).toBe(true);
    expect(db.rentalBookings.find(b => b.id === booking.id)!.status).toBe('CANCELLED');
    expect(db.inventorySlots.find(s => s.skuId === listing.skuId && s.date === future(60))!.heldCapacity).toBe(0);
  });

  it('rejects a hold when the last unit is gone, and a retry with the same key is idempotent', () => {
    const listing = seedRentalListing({ quantity: 1 });

    const first = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      startDate: future(0),
      endDate: future(0),
      quantity: 1,
      idempotencyKey: nextIdempotencyKey()
    });
    expect(first.booking.status).toBe('PENDING_PAYMENT');

    let status: number | undefined;
    let caught: unknown;
    try {
      rentalService.createRentalBooking({
        listingId: listing.id,
        tripId: 'TRIP-TEST',
        userId: 'USR-TEST',
        travelerName: 'T',
        travelerPhone: '',
        travelerEmail: 't@t.test',
        startDate: future(0),
        endDate: future(0),
        quantity: 1,
        idempotencyKey: nextIdempotencyKey()
      });
    } catch (err: any) {
      status = err.status;
      caught = err;
    }
    expect(status).toBe(409);
    expect(caught).toBeInstanceOf(InsufficientCapacityError);

    // Same key retry returns the same hold instead of failing.
    const replay = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      startDate: future(0),
      endDate: future(0),
      quantity: 1,
      idempotencyKey: first.booking.idempotencyKey!
    });
    expect(replay.replayed).toBe(true);
    expect(replay.booking.id).toBe(first.booking.id);
    expect(db.rentalBookings.filter(b => b.status === 'PENDING_PAYMENT')).toHaveLength(1);
  });
});

describe('rental booking window validation', () => {
  beforeEach(() => {
    resetDb();
    seedTrip();
  });

  it('rejects a window that starts in the past', () => {
    const listing = seedRentalListing();
    expect(() =>
      rentalService.checkAvailability({
        listingId: listing.id,
        startDate: past(1),
        endDate: future(2),
        quantity: 1
      })
    ).toThrowError(/start date must be today or later/i);
  });

  it('allows a window that starts today', () => {
    const listing = seedRentalListing();
    const check = rentalService.checkAvailability({
      listingId: listing.id,
      startDate: future(0),
      endDate: future(2),
      quantity: 1
    });
    expect(check.available).toBe(true);
  });

  it('rejects an inverted range (end before start)', () => {
    const listing = seedRentalListing();
    expect(() =>
      rentalService.checkAvailability({
        listingId: listing.id,
        startDate: future(5),
        endDate: future(2),
        quantity: 1
      })
    ).toThrowError(/end date must be on or after the start date/i);
  });

  it('rejects a past-date hold at booking time too', () => {
    const listing = seedRentalListing();
    const trip = db.trips[0];
    expect(() =>
      rentalService.createRentalBooking({
        listingId: listing.id,
        tripId: trip.id,
        userId: trip.userId,
        travelerName: 'Test',
        travelerPhone: '+20000000000',
        travelerEmail: 't@example.com',
        startDate: past(1),
        endDate: past(1),
        quantity: 1,
        idempotencyKey: nextIdempotencyKey()
      })
    ).toThrowError(/start date must be today or later/i);
    expect(db.rentalBookings).toHaveLength(0);
  });
});
