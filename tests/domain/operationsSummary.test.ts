import { describe, expect, it } from 'vitest';
import { buildOperationsSummary } from '../../server/services/buildOperationsSummary';
import type { BookingEntity, LedgerEntryEntity, TripEntity } from '../../server/db/schema';

/**
 * The Command Center's Overview cards and badge polls were reading counter
 * fields that /api/operations/overview never returned, so five cards stayed at
 * 0 and the ops badge never lit. The counters are now derived from the real
 * collections by buildOperationsSummary, which this tests.
 */

const trip = (over: Partial<TripEntity> = {}): TripEntity => ({
  id: 'trip-1',
  userId: 'u1',
  title: 'Trip',
  status: 'CONFIRMED',
  lengthDays: 3,
  travelersCount: 2,
  budget: 'Moderate',
  pace: 'Balanced',
  interests: [],
  totalEstimatedEGP: 3000,
  totalPaidEGP: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const booking = (over: Partial<BookingEntity> = {}): BookingEntity => ({
  id: 'booking-1',
  bookingRef: 'BK-1',
  tripId: 'trip-1',
  supplierId: 'sup-1',
  skuId: 'sku-1',
  serviceType: 'diving',
  amountEGP: 500,
  paymentState: 'CAPTURED',
  supplierState: 'PENDING_CONFIRMATION',
  travelerName: 't',
  travelerPhone: '1',
  travelerEmail: 'x@x.com',
  passengersCount: 1,
  scheduledDate: '2026-01-10',
  scheduledTime: '10:00',
  confirmationCode: 'C',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const ledger = (over: Partial<LedgerEntryEntity> = {}): LedgerEntryEntity => ({
  id: 'ledger-1',
  transactionId: 't1',
  idempotencyKey: 'k1',
  bookingRef: 'BK-1',
  tripId: 'trip-1',
  type: 'PAYMENT_CAPTURED',
  amountEGP: 500,
  debitAccount: 'a',
  creditAccount: 'b',
  currency: 'EGP',
  timestamp: '2026-01-01T00:00:00.000Z',
  status: 'SETTLED',
  signatureHash: 'h',
  ...over,
});

describe('buildOperationsSummary', () => {
  it('counts active trips from the real status vocabulary', () => {
    const trips = [
      trip({ status: 'PLANNED' }),
      trip({ id: 't2', status: 'CONFIRMED' }),
      trip({ id: 't3', status: 'IN_DESTINATION' }),
      trip({ id: 't4', status: 'COMPLETED' }),
      trip({ id: 't5', status: 'CANCELLED' }),
      trip({ id: 't6', status: 'DRAFT' }),
    ];
    const s = buildOperationsSummary(trips, [], []);
    expect(s.activeTrips).toBe(3);
    expect(s.pendingBookings).toBe(0);
    expect(s.pendingSupplierConfirmations).toBe(0);
    expect(s.paymentIssues).toBe(0);
    expect(s.atRiskTrips).toBe(0);
  });

  it('counts bookings whose payment is not yet captured as pending', () => {
    const bookings = [
      booking({ paymentState: 'INITIATED' }),
      booking({ id: 'b2', paymentState: 'PENDING' }),
      booking({ id: 'b3', paymentState: 'CAPTURED' }),
    ];
    expect(buildOperationsSummary([], bookings, []).pendingBookings).toBe(2);
  });

  it('counts bookings awaiting supplier confirmation', () => {
    const bookings = [
      booking({ supplierState: 'PENDING_CONFIRMATION' }),
      booking({ id: 'b2', supplierState: 'PENDING_CONFIRMATION' }),
      booking({ id: 'b3', supplierState: 'CONFIRMED' }),
    ];
    expect(buildOperationsSummary([], bookings, []).pendingSupplierConfirmations).toBe(2);
  });

  it('counts pending ledger entries as payment issues', () => {
    const entries = [
      ledger({ status: 'PENDING' }),
      ledger({ id: 'l2', status: 'PENDING' }),
      ledger({ id: 'l3', status: 'SETTLED' }),
    ];
    expect(buildOperationsSummary([], [], entries).paymentIssues).toBe(2);
  });

  it('flags an active trip at risk when a booking on it has been rejected or cancelled', () => {
    const trips = [trip({ id: 'tA', status: 'CONFIRMED' }), trip({ id: 'tB', status: 'CONFIRMED' })];
    const bookings = [
      booking({ tripId: 'tA', supplierState: 'REJECTED' }),
      booking({ tripId: 'tA', supplierState: 'CANCELLED' }),
      booking({ tripId: 'tB', supplierState: 'CONFIRMED' }),
    ];
    expect(buildOperationsSummary(trips, bookings, []).atRiskTrips).toBe(1);
  });

  it('does not flag a broken booking on a trip that is itself finished', () => {
    const trips = [trip({ id: 'tA', status: 'COMPLETED' })];
    const bookings = [booking({ tripId: 'tA', supplierState: 'CANCELLED' })];
    expect(buildOperationsSummary(trips, bookings, []).atRiskTrips).toBe(0);
  });
});