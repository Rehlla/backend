import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import { supplierService } from '../../server/services/supplierService';
import { resetDb } from '../helpers/fixtures';
import type { BookingEntity } from '../../server/db/schema';

/**
 * P6 supplier Revenue & Analytics contract: every number derives from the
 * same bookings the dashboard reads, with the same 85% payout share. Empty
 * states stay null/zero — never a flattering default.
 */

const SUP = 'SUP-REV-TEST';

function seedBooking(over: Partial<BookingEntity>): BookingEntity {
  const base: BookingEntity = {
    id: `BKG-${Math.random().toString(36).slice(2, 8)}`,
    bookingRef: `DHB-DIV-2026-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
    tripId: 'TRIP-TEST',
    supplierId: SUP,
    skuId: 'SKU-DIV-TEST',
    serviceType: 'diving',
    amountEGP: 1000,
    paymentState: 'CAPTURED',
    supplierState: 'CONFIRMED',
    travelerName: 'Test Traveler',
    travelerPhone: '+20 100 000 0000',
    travelerEmail: 't@example.com',
    passengersCount: 2,
    scheduledDate: '2026-09-10',
    scheduledTime: '09:00 AM',
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const booking = { ...base, ...over };
  db.bookings.push(booking);
  return booking;
}

beforeEach(() => {
  resetDb();
});

describe('getSupplierRevenueAnalytics (P6)', () => {
  it('derives totals, payout share and completion rate from real bookings', () => {
    seedBooking({ supplierState: 'COMPLETED', amountEGP: 1000 });
    seedBooking({ supplierState: 'CONFIRMED', amountEGP: 2000 });
    seedBooking({ supplierState: 'CANCELLED', amountEGP: 500 });

    const result = supplierService.getSupplierRevenueAnalytics(SUP, 30);

    expect(result.supplierId).toBe(SUP);
    expect(result.currency).toBe('EGP');
    expect(result.totals.bookingsCount).toBe(3);
    expect(result.totals.grossBookingsEGP).toBe(3500);
    // 85% share, completed only
    expect(result.totals.payoutEGP).toBe(850);
    expect(result.totals.escrowPendingEGP).toBe(1700); // CONFIRMED only
    expect(result.totals.completedCount).toBe(1);
    expect(result.totals.cancelledCount).toBe(1);
    // completion = completed / (completed + cancelled)
    expect(result.totals.completionRate).toBeCloseTo(0.5, 5);
    expect(result.totals.avgBookingEGP).toBe(Math.round(3500 / 3));
  });

  it('returns null rate and zero escrow for an empty book of business', () => {
    const result = supplierService.getSupplierRevenueAnalytics(SUP, 30);
    expect(result.totals.bookingsCount).toBe(0);
    expect(result.totals.completionRate).toBeNull();
    expect(result.totals.avgBookingEGP).toBeNull();
    expect(result.totals.escrowPendingEGP).toBe(0);
    expect(result.daily).toHaveLength(30);
    expect(result.daily.every(d => d.bookingsCount === 0 && d.grossEGP === 0)).toBe(true);
  });

  it('buckets daily series inside the window and excludes older bookings', () => {
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    seedBooking({ amountEGP: 1200, createdAt: old });
    const result = supplierService.getSupplierRevenueAnalytics(SUP, 7); // 7-day window
    expect(result.totals.bookingsCount).toBe(1); // totals still count all bookings
    // but the 10-day-old booking must NOT appear in the 7-day daily series
    expect(result.daily.reduce((acc, d) => acc + d.bookingsCount, 0)).toBe(0);
  });

  it('groups revenue by service type sorted by gross', () => {
    seedBooking({ serviceType: 'diving', amountEGP: 1000 });
    seedBooking({ serviceType: 'hotel', amountEGP: 5000 });
    seedBooking({ serviceType: 'hotel', amountEGP: 2000 });
    const result = supplierService.getSupplierRevenueAnalytics(SUP, 30);
    expect(result.byServiceType[0].serviceType).toBe('hotel');
    expect(result.byServiceType[0].grossEGP).toBe(7000);
    expect(result.byServiceType[0].payoutEGP).toBe(5950); // 85% of 7000
    expect(result.byServiceType[1].serviceType).toBe('diving');
  });

  it('counts scheduled payouts from the payout schedule (PENDING only)', () => {
    seedBooking({ supplierState: 'COMPLETED', bookingRef: 'DHB-DIV-2026-PAYSCHED' });
    db.payoutSchedule.push({
      id: 'PAY-1',
      supplierId: SUP,
      bookingRef: 'DHB-DIV-2026-PAYSCHED',
      amountEGP: 850,
      payoutState: 'PENDING',
      settleAfter: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });
    const result = supplierService.getSupplierRevenueAnalytics(SUP, 30);
    expect(result.totals.payoutScheduledEGP).toBe(850);
  });

  it('ranks top bookings by amount', () => {
    seedBooking({ amountEGP: 1000 });
    seedBooking({ amountEGP: 9000 });
    seedBooking({ amountEGP: 4000 });
    const result = supplierService.getSupplierRevenueAnalytics(SUP, 30);
    expect(result.topBookings[0].amountEGP).toBe(9000);
    expect(result.topBookings[0].payoutEGP).toBe(7650);
    expect(result.topBookings).toHaveLength(3);
  });
});
