import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { commerceService, SupplierUnavailableError } from '../../server/services/commerceService';
import { transferService } from '../../server/services/transferService';
import { rentalService } from '../../server/services/rentalService';
import { futureDate, heldItem, nextIdempotencyKey, resetDb, seedRentalListing, seedSku, seedTrip } from '../helpers/fixtures';

/**
 * A supplier Operations has suspended (or not yet verified) cannot be booked.
 *
 * Holds and every checkout path ignored supplier status, so a Suspended
 * supplier kept taking bookings — and, on completion, payouts. Each path must
 * refuse with 409 SUPPLIER_UNAVAILABLE before any money moves.
 */

function seedSupplier(status: 'Active' | 'Suspended' | 'Pending_Verification') {
  const existing = db.suppliers.find(s => s.id === 'SUP-TEST');
  if (existing) {
    existing.status = status;
    return;
  }
  db.suppliers.push({
    id: 'SUP-TEST',
    businessName: 'Test Divers',
    businessNameAr: 'غواصو الاختبار',
    category: 'diving',
    tier: 'Vetted Local Partner',
    status,
    area: 'lighthouse'
  });
}

const suspend = () => { db.suppliers.find(s => s.id === 'SUP-TEST')!.status = 'Suspended'; };

function expectUnavailable(fn: () => unknown) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(SupplierUnavailableError);
    expect((err as SupplierUnavailableError).status).toBe(409);
    expect((err as SupplierUnavailableError).code).toBe('SUPPLIER_UNAVAILABLE');
    return;
  }
  throw new Error('expected SUPPLIER_UNAVAILABLE');
}

describe('supplier availability gate — holds and commerce checkout', () => {
  beforeEach(() => { resetDb(); seedSku(); seedTrip(); });

  it('refuses a hold for a Suspended supplier', () => {
    seedSupplier('Suspended');
    expectUnavailable(() => heldItem());
    expect(db.holds).toHaveLength(0);
  });

  it('refuses a hold for a supplier still Pending_Verification', () => {
    seedSupplier('Pending_Verification');
    expectUnavailable(() => heldItem());
  });

  it('still holds for an Active supplier', () => {
    seedSupplier('Active');
    expect(heldItem().holdToken).toBeTruthy();
  });

  it('refuses multi-service checkout when the supplier was suspended after the hold', () => {
    seedSupplier('Active');
    const line = heldItem();
    suspend();
    expectUnavailable(() => commerceService.completeMultiServiceCheckout({
      tripId: 'TRIP-TEST',
      travelerUserId: 'USR-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+201000000000',
      travelerEmail: 'traveler@example.test',
      items: [line],
      paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'CASH_ON_ARRIVAL' }
    }));
    expect(db.payments).toHaveLength(0);
    expect(db.bookings).toHaveLength(0);
  });

  it('refuses single (hold-settling) checkout when the supplier was suspended after the hold', () => {
    seedSupplier('Active');
    const line = heldItem();
    suspend();
    expectUnavailable(() => transferService.completeBooking({
      holdToken: line.holdToken,
      tripId: 'TRIP-TEST',
      travelerName: 'Test Traveler',
      travelerPhone: '+201000000000',
      travelerEmail: 'traveler@example.test',
      pickupLocation: 'SSH',
      dropoffLocation: 'Dahab',
      scheduledDate: line.scheduledDate,
      scheduledTime: line.scheduledTime,
      paymentParams: { idempotencyKey: nextIdempotencyKey(), provider: 'CASH_ON_ARRIVAL' }
    }));
    expect(db.payments).toHaveLength(0);
    expect(db.bookings).toHaveLength(0);
  });
});

describe('supplier availability gate — rentals', () => {
  beforeEach(() => { resetDb(); seedTrip(); });

  const hold = (listingId: string) => rentalService.createRentalBooking({
    listingId,
    tripId: 'TRIP-TEST',
    userId: 'USR-TEST',
    travelerName: 'Renter',
    travelerPhone: '+201000000002',
    travelerEmail: 'renter@test',
    startDate: futureDate(30),
    endDate: futureDate(32),
    quantity: 1,
    idempotencyKey: nextIdempotencyKey()
  });

  it('refuses a rental hold for a Suspended supplier', () => {
    const listing = seedRentalListing();
    suspend();
    expectUnavailable(() => hold(listing.id));
  });

  it('refuses rental checkout when the supplier was suspended after the hold', () => {
    const listing = seedRentalListing();
    const { booking } = hold(listing.id);
    suspend();
    expectUnavailable(() => rentalService.checkoutRentalBooking({
      rentalBookingId: booking.id,
      tripId: 'TRIP-TEST',
      travelerName: 'Renter',
      travelerPhone: '+201000000002',
      travelerEmail: 'renter@test',
      idempotencyKey: nextIdempotencyKey(),
      provider: 'CASH_ON_ARRIVAL'
    }));
    expect(db.payments).toHaveLength(0);
  });
});
