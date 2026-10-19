import { describe, it, expect } from 'vitest';
import { resolveTripPass, clockMinutes } from '../../src/services/homeTripPass';
import type { TripEntity, TripItemWithSupplier } from '../../src/shared/types/trip';
import type { ConfirmedBookingItem } from '../../src/shared/types/commerce';

const NOW = new Date('2026-10-08T15:00:00Z'); // 18:00 in Dahab, 8 Oct

const trip = (over: Partial<TripEntity> = {}): TripEntity => ({
  id: 'TRIP-1',
  userId: 'USR-1',
  title: 'Eel Garden',
  status: 'CONFIRMED',
  lengthDays: 1,
  travelersCount: 3,
  budget: 'Moderate',
  pace: 'Balanced',
  interests: [],
  startDate: '2026-10-09',
  endDate: '2026-10-09',
  totalEstimatedEGP: 0,
  totalPaidEGP: 0,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const item = (over: Partial<TripItemWithSupplier>): TripItemWithSupplier => ({
  id: 'ITEM',
  tripId: 'TRIP-1',
  serviceType: 'diving',
  skuId: 'SKU',
  title: 'Outing',
  dayNumber: 1,
  priceEGP: 0,
  status: 'CONFIRMED',
  createdAt: '',
  updatedAt: '',
  supplier: null,
  ...over,
});

const booking = (id: string, datesOrTime: string, status: ConfirmedBookingItem['status']): ConfirmedBookingItem => ({
  id,
  serviceType: 'diving',
  title: 'Diving',
  subtitle: '',
  details: '',
  datesOrTime,
  priceEGP: 0,
  provider: '',
  confirmationCode: id,
  status,
  location: '',
  iconType: 'waves',
});

describe('resolveTripPass', () => {
  it('is absent without a trip', () => {
    expect(resolveTripPass(null, [], [], { now: NOW })).toBeNull();
  });

  it('orders outings by booked date and departure, with the booking status', () => {
    const pass = resolveTripPass(
      trip(),
      [
        item({ id: 'snorkel', title: 'Eel Garden Sunset Guided Snorkel', titleAr: 'سنوركلينج', timeSlot: '03:30 PM', bookingId: 'B1', dayNumber: 2 }),
        item({ id: 'boat', title: 'Glass Bottom Boat Cruise', timeSlot: '12:30 PM', bookingId: 'B2', dayNumber: 2 }),
      ],
      [booking('B1', '2026-10-09 · 03:30 PM', 'Pending'), booking('B2', '2026-10-09 · 12:30 PM', 'Confirmed ✓')],
      { now: NOW }
    )!;

    expect(pass.stops.map((s) => s.id)).toEqual(['boat', 'snorkel']);
    // The booking's own date wins over the item's day number.
    expect(pass.stops.every((s) => s.date === '2026-10-09')).toBe(true);
    expect(pass.stops.map((s) => s.status)).toEqual(['confirmed', 'pending']);
    expect(pass.stops[1].titleAr).toBe('سنوركلينج');
    expect(pass.pendingCount).toBe(1);
    expect(pass.nextDate).toBe('2026-10-09');
    expect(pass.daysUntilNext).toBe(1);
    expect(pass.travelers).toBe(3);
  });

  it('leads with upcoming outings and counts the rest', () => {
    const items = ['2026-10-07', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'].map((date, i) =>
      item({ id: `i${i}`, bookingId: `B${i}`, timeSlot: '09:00 AM' })
    );
    const bookings = ['2026-10-07', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12'].map((date, i) =>
      booking(`B${i}`, `${date} · 09:00 AM`, 'Confirmed ✓')
    );
    const pass = resolveTripPass(trip({ startDate: '2026-10-07', endDate: '2026-10-12' }), items, bookings, { now: NOW })!;
    expect(pass.stops.map((s) => s.id)).toEqual(['i1', 'i2', 'i3']);
    expect(pass.moreCount).toBe(1);
    expect(pass.pendingCount).toBe(0);
  });

  it('drops cancelled items and invents no date or countdown', () => {
    const pass = resolveTripPass(
      trip({ startDate: undefined, endDate: undefined }),
      [item({ id: 'gone', status: 'CANCELLED' }), item({ id: 'idea', status: 'SUGGESTED' })],
      [],
      { now: NOW }
    )!;
    expect(pass.stops.map((s) => s.id)).toEqual(['idea']);
    expect(pass.stops[0].status).toBe('planned');
    expect(pass.stops[0].date).toBeUndefined();
    expect(pass.nextDate).toBeUndefined();
    expect('daysUntilNext' in pass).toBe(false);
  });

  it('places an unbooked item by the trip start and its day number', () => {
    const pass = resolveTripPass(trip({ startDate: '2026-10-10' }), [item({ id: 'x', dayNumber: 3 })], [], { now: NOW })!;
    expect(pass.stops[0].date).toBe('2026-10-12');
    expect(pass.daysUntilNext).toBe(4);
  });
});

describe('clockMinutes', () => {
  it('reads 12-hour and 24-hour departures', () => {
    expect(clockMinutes('12:30 AM')).toBe(30);
    expect(clockMinutes('12:30 PM')).toBe(750);
    expect(clockMinutes('03:30 PM')).toBe(930);
    expect(clockMinutes('15:30')).toBe(930);
    expect(clockMinutes('ASAP')).toBeNull();
  });
});
