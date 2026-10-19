import { describe, expect, it, beforeEach } from 'vitest';
import type { Response } from 'express';
import { apiAccessPolicy, isPublicApiPath, requiredRolesFor } from '../../server/middleware/apiAccessPolicy';
import type { AuthenticatedRequest } from '../../server/middleware/correlationMiddleware';
import { db } from '../../server/db/database';
import { rentalService } from '../../server/services/rentalService';
import { resetDb, seedRentalListing, seedTrip, nextIdempotencyKey } from '../helpers/fixtures';

type Role = 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';

interface Outcome { status: number | null; nexted: boolean }
function run(path: string, method = 'GET', role?: Role): Outcome {
  const outcome: Outcome = { status: null, nexted: false };
  const req = {
    path,
    method,
    originalUrl: `/api${path}`,
    correlationId: 'test-correlation',
    user: role ? { userId: 'USR-TEST', role } : undefined
  } as unknown as AuthenticatedRequest;
  const res = {
    status(code: number) { outcome.status = code; return this; },
    json() { return this; }
  } as unknown as Response;
  apiAccessPolicy(req, res, () => { outcome.nexted = true; });
  return outcome;
}
const allow = (o: Outcome) => o.nexted && o.status === null;

/** YYYY-MM-DD for today + offsetDays in local time — keeps fixture windows relative to "now". */
const localDate = (offset: number) => {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('sv-SE');
};

describe('rentals API access policy', () => {
  it('browse, detail, check-availability and quote are public', () => {
    expect(allow(run('/rentals'))).toBe(true);
    expect(allow(run('/rentals/mountain-bike'))).toBe(true);
    expect(allow(run('/rentals/check-availability', 'POST'))).toBe(true);
    expect(allow(run('/rentals/quote', 'POST'))).toBe(true);
  });

  it('anonymous access to booking mutations fails closed', () => {
    expect(run('/rental-bookings', 'POST').status).toBe(401);
    expect(run('/rental-bookings/RENTAL-1/checkout', 'POST').status).toBe(401);
    expect(run('/rentals/provider').status).toBe(401);
  });

  it('a Traveler cannot reach provider or admin management paths', () => {
    expect(allow(run('/rentals/provider', 'GET', 'Traveler'))).toBe(false);
    expect(allow(run('/rental-bookings/provider', 'GET', 'Traveler'))).toBe(false);
    expect(allow(run('/rentals/RENT-1/status', 'PATCH', 'Traveler'))).toBe(false);
    expect(requiredRolesFor('/rentals/RENT-1/status')).toEqual(['Operations', 'Admin']);
  });

  it('provider paths require Supplier / Operations / Admin', () => {
    expect(requiredRolesFor('/rentals/provider')).toEqual(['Supplier', 'Operations', 'Admin']);
    expect(requiredRolesFor('/rental-bookings/RENTAL-1/accept')).toEqual(['Supplier', 'Operations', 'Admin']);
    expect(allow(run('/rental-bookings/RENTAL-1/accept', 'POST', 'Supplier'))).toBe(true);
    expect(allow(run('/rental-bookings/RENTAL-1/accept', 'POST', 'Traveler'))).toBe(false);
  });

  it('a travel booking mutation is allowed for any authenticated user (ownership is handler-side)', () => {
    expect(allow(run('/rental-bookings', 'POST', 'Traveler'))).toBe(true);
    expect(allow(run('/rental-bookings', 'GET', 'Traveler'))).toBe(true);
  });
});

describe('rental ownership and price integrity', () => {
  beforeEach(() => {
    resetDb();
    seedTrip();
  });

  it('a second supplier cannot accept, reject, return or complete another supplier\'s booking', () => {
    const listing = seedRentalListing();
    const { booking } = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      startDate: localDate(0),
      endDate: localDate(2),
      quantity: 1,
      idempotencyKey: nextIdempotencyKey()
    });
    rentalService.checkoutRentalBooking({
      rentalBookingId: booking.id,
      tripId: 'TRIP-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      idempotencyKey: nextIdempotencyKey()
    });

    for (const run of [
      () => rentalService.acceptRentalBooking({ bookingId: booking.id, supplierId: 'SUP-OTHER' }),
      () => rentalService.rejectRentalBooking({ bookingId: booking.id, supplierId: 'SUP-OTHER' }),
      () => rentalService.markRentalReturned({ bookingId: booking.id, supplierId: 'SUP-OTHER' }),
      () => rentalService.completeRentalBooking({ bookingId: booking.id, supplierId: 'SUP-OTHER' })
    ]) {
      let status: number | undefined;
      try { run(); } catch (err: any) { status = err.status; }
      expect(status).toBe(403);
    }
  });

  it('a booking cannot be checked out under another trip', () => {
    const listing = seedRentalListing();
    const { booking } = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      startDate: localDate(0),
      endDate: localDate(2),
      quantity: 1,
      idempotencyKey: nextIdempotencyKey()
    });

    let status: number | undefined;
    try {
      rentalService.checkoutRentalBooking({
        rentalBookingId: booking.id,
        tripId: 'TRIP-OTHER',
        travelerName: 'T',
        travelerPhone: '',
        travelerEmail: 't@t.test',
        idempotencyKey: nextIdempotencyKey()
      });
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(400);
    expect(db.bookings).toHaveLength(0);
  });

  it('the checkout amount comes from the server snapshot, not from any client value', () => {
    const listing = seedRentalListing();
    const { booking } = rentalService.createRentalBooking({
      listingId: listing.id,
      tripId: 'TRIP-TEST',
      userId: 'USR-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      startDate: localDate(0),
      endDate: localDate(2),
      quantity: 2,
      idempotencyKey: nextIdempotencyKey()
    });

    // A tamper attempt (the client has no amount field at all — but even if it
    // did, the settled row must carry the snapshot total: 2 × 3 × 300 = 1800
    // minus the 10% multi-day discount = 1620).
    rentalService.checkoutRentalBooking({
      rentalBookingId: booking.id,
      tripId: 'TRIP-TEST',
      travelerName: 'T',
      travelerPhone: '',
      travelerEmail: 't@t.test',
      idempotencyKey: nextIdempotencyKey()
    });
    expect(db.bookings[0].amountEGP).toBe(1620);
    expect(db.payments[0].amountEGP).toBe(1620);
  });

  it('a listing cannot be bookable while suspended', () => {
    const listing = seedRentalListing({ status: 'SUSPENDED' });
    let status: number | undefined;
    try {
      rentalService.createRentalBooking({
        listingId: listing.id,
        tripId: 'TRIP-TEST',
        userId: 'USR-TEST',
        travelerName: 'T',
        travelerPhone: '',
        travelerEmail: 't@t.test',
        startDate: '2026-10-01',
        endDate: '2026-10-03',
        quantity: 1,
        idempotencyKey: nextIdempotencyKey()
      });
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(409);
  });

  it('only Operations/Admin may change listing status', () => {
    const listing = seedRentalListing();
    let status: number | undefined;
    try {
      rentalService.setListingStatus({
        listingId: listing.id,
        status: 'SUSPENDED',
        actor: { userId: 'USR-TRAVELER', role: 'Traveler' }
      });
    } catch (err: any) {
      status = err.status;
    }
    expect(status).toBe(403);
    expect(db.rentalListings[0].status).toBe('APPROVED');
  });

  it('exposes nothing sensitive on public endpoints', () => {
    expect(isPublicApiPath('/rentals', 'GET')).toBe(true);
    expect(isPublicApiPath('/rentals/mountain-bike', 'GET')).toBe(true);
    expect(isPublicApiPath('/rentals/provider', 'GET')).toBe(false);
    expect(isPublicApiPath('/rental-bookings', 'GET')).toBe(false);
  });
});