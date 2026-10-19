import { describe, expect, it } from 'vitest';
import {
  buildTimelineDays,
  buildTravelerBookings,
  selectActiveTrip,
  travelerStatusOf,
  tripItemToConfirmedBookingItem
} from '../../src/services/tripBookingMapper';
import type { TripBookingRecord, TripEntity, TripItemWithSupplier } from '../../src/shared';

const supplier = {
  id: 'SUP-HTL-01',
  businessName: 'Ali Baba Hotel',
  businessNameAr: 'فندق علي بابا',
  phone: '+20 100 111 2222',
  area: 'Mashraba',
  tier: 'Tier 1 Certified'
};

const booking = (over: Partial<TripBookingRecord> = {}): TripBookingRecord => ({
  id: 'BKG-1',
  bookingRef: 'DHB-TRF-2026-042',
  tripId: 'TRIP-1',
  supplierId: 'SUP-TRF-01',
  skuId: 'SKU-TRF-001',
  serviceType: 'transfer',
  amountEGP: 1400,
  paymentState: 'CAPTURED',
  supplierState: 'CONFIRMED',
  travelerName: 'Traveler',
  travelerPhone: '+20 100 000 0000',
  travelerEmail: 't@example.com',
  passengersCount: 2,
  scheduledDate: '2026-08-30',
  scheduledTime: '10:30 AM',
  confirmationCode: 'DHB-SSH-8942-OK',
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
  supplier: { ...supplier, id: 'SUP-TRF-01', businessName: 'Sinai Comfort Shuttle' },
  ...over
});

const item = (over: Partial<TripItemWithSupplier> = {}): TripItemWithSupplier => ({
  id: 'ITEM-001',
  tripId: 'TRIP-1',
  serviceType: 'hotel',
  skuId: 'SKU-HTL-001',
  title: 'Ali Baba Hotel — 5 Nights Sea View',
  dayNumber: 1,
  timeSlot: 'Check-in 14:00',
  priceEGP: 12500,
  status: 'CONFIRMED',
  bookingId: 'DHB-HTL-2026-081',
  createdAt: '2026-08-20T10:00:00.000Z',
  updatedAt: '2026-08-20T10:00:00.000Z',
  supplier,
  ...over
});

const trip = (over: Partial<TripEntity> = {}): TripEntity => ({
  id: 'TRIP-1',
  userId: 'USR-1',
  title: 'Trip',
  status: 'PLANNED',
  lengthDays: 5,
  travelersCount: 2,
  budget: 'Moderate',
  pace: 'Balanced',
  interests: [],
  totalEstimatedEGP: 0,
  totalPaidEGP: 0,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  ...over
});

describe('travelerStatusOf', () => {
  it('is Confirmed only when the money was captured and the supplier has it', () => {
    expect(travelerStatusOf(booking())).toBe('Confirmed ✓');
  });

  it('is Pending while the supplier has not confirmed, even after capture', () => {
    // Telling a traveler "Confirmed" because the card cleared, while no
    // supplier has accepted the booking, is the exact failure this phase exists
    // to stop repeating.
    expect(travelerStatusOf(booking({ supplierState: 'PENDING_CONFIRMATION' }))).toBe('Pending');
  });

  it('is Pending when the payment was only authorised, not captured', () => {
    expect(travelerStatusOf(booking({ paymentState: 'AUTHORIZED' }))).toBe('Pending');
  });

  it.each(['REFUNDED', 'PARTIALLY_REFUNDED', 'FAILED', 'CANCELLED', 'DISPUTED'] as const)(
    'reports a %s payment as Changed rather than Confirmed',
    state => {
      expect(travelerStatusOf(booking({ paymentState: state }))).toBe('Changed');
    }
  );

  it('reports a supplier rejection as Changed', () => {
    expect(travelerStatusOf(booking({ supplierState: 'REJECTED' }))).toBe('Changed');
  });
});

describe('buildTravelerBookings', () => {
  it('keeps a booked item that has no booking record behind it', () => {
    // The seeded trip is exactly this: CONFIRMED items carrying a bookingId
    // with no row in db.bookings. Rendering only booking records dropped them.
    const result = buildTravelerBookings([item()], []);
    expect(result).toHaveLength(1);
    expect(result[0].subtitle).toBe('Ali Baba Hotel — 5 Nights Sea View');
    expect(result[0].priceEGP).toBe(12500);
  });

  it('does not lose any money across items and bookings', () => {
    const items = [
      item(),
      item({ id: 'ITEM-002', priceEGP: 4200, bookingId: 'DHB-SAF-2026-095', serviceType: 'safari' })
    ];
    const total = buildTravelerBookings(items, []).reduce((sum, b) => sum + b.priceEGP, 0);
    expect(total).toBe(16700);
  });

  it('prefers the booking record for an item that has one', () => {
    const linked = item({ id: 'ITEM-TRF', serviceType: 'transfer', priceEGP: 1400, bookingId: 'BKG-1' });
    const result = buildTravelerBookings([linked], [booking()]);
    expect(result).toHaveLength(1);
    // The confirmation code exists only on the booking record.
    expect(result[0].confirmationCode).toBe('DHB-SSH-8942-OK');
    // The traveler-facing title exists only on the item.
    expect(result[0].subtitle).toBe('Ali Baba Hotel — 5 Nights Sea View');
  });

  it('matches an item to a booking by its reference as well as by its id', () => {
    const linked = item({ id: 'ITEM-TRF', bookingId: 'DHB-TRF-2026-042' });
    const result = buildTravelerBookings([linked], [booking()]);
    expect(result[0].confirmationCode).toBe('DHB-SSH-8942-OK');
  });

  it('appends a booking that belongs to no item instead of dropping it', () => {
    const result = buildTravelerBookings([], [booking()]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('BKG-1');
  });

  it('never counts one booking twice', () => {
    const linked = item({ id: 'ITEM-TRF', bookingId: 'BKG-1' });
    const result = buildTravelerBookings([linked], [booking()]);
    expect(result).toHaveLength(1);
  });

  it('ignores items that were never booked', () => {
    const suggested = item({ id: 'ITEM-SUGG', status: 'SUGGESTED', bookingId: undefined });
    expect(buildTravelerBookings([suggested], [])).toHaveLength(0);
  });
});

describe('tripItemToConfirmedBookingItem', () => {
  it('leaves the provider blank rather than inventing one', () => {
    const mapped = tripItemToConfirmedBookingItem(item({ supplier: null }));
    expect(mapped.provider).toBe('—');
    expect(mapped.phone).toBeUndefined();
  });

  it('uses the supplier resolved through the SKU when there is one', () => {
    const mapped = tripItemToConfirmedBookingItem(item());
    expect(mapped.provider).toBe('Ali Baba Hotel');
    expect(mapped.phone).toBe('+20 100 111 2222');
  });
});

describe('selectActiveTrip', () => {
  it('returns null rather than inventing a trip id', () => {
    expect(selectActiveTrip([])).toBeNull();
  });

  it('prefers the trip that is under way over a more recent draft', () => {
    const inDestination = trip({ id: 'LIVE', status: 'IN_DESTINATION', updatedAt: '2026-01-01T00:00:00.000Z' });
    const draft = trip({ id: 'DRAFT', status: 'DRAFT', updatedAt: '2026-08-29T00:00:00.000Z' });
    expect(selectActiveTrip([draft, inDestination])?.id).toBe('LIVE');
  });

  it('breaks a tie on the most recently updated', () => {
    const older = trip({ id: 'OLD', status: 'PLANNED', updatedAt: '2026-01-01T00:00:00.000Z' });
    const newer = trip({ id: 'NEW', status: 'PLANNED', updatedAt: '2026-08-29T00:00:00.000Z' });
    expect(selectActiveTrip([older, newer])?.id).toBe('NEW');
  });

  it('does not let an unparseable date sort as the newest', () => {
    const dated = trip({ id: 'DATED', status: 'PLANNED', updatedAt: '2026-08-29T00:00:00.000Z' });
    const undated = trip({ id: 'UNDATED', status: 'PLANNED', updatedAt: 'not a date', createdAt: 'also not' });
    expect(selectActiveTrip([undated, dated])?.id).toBe('DATED');
  });

  it('does not open on a cancelled trip when a live one exists', () => {
    const cancelled = trip({ id: 'X', status: 'CANCELLED', updatedAt: '2026-08-29T00:00:00.000Z' });
    const confirmed = trip({ id: 'OK', status: 'CONFIRMED', updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(selectActiveTrip([cancelled, confirmed])?.id).toBe('OK');
  });
});

describe('buildTimelineDays', () => {
  /**
   * The timeline is where a planned line becomes a bookable one. That needs two
   * things carried through from the stored item: the status, so a line that is
   * only suggested is not drawn as confirmed, and the skuId, which is what the
   * Book action sends to checkout and what checkout matches the resulting
   * booking back to. Neither used to survive the mapping.
   */
  it('carries the product id, so the line can be booked', () => {
    const days = buildTimelineDays(trip(), [
      item({ id: 'ITEM-DIVE', skuId: 'SKU-DIV-002', status: 'SUGGESTED', dayNumber: 2 })
    ]);

    expect(days[0].activities[0].skuId).toBe('SKU-DIV-002');
    expect(days[0].activities[0].serviceType).toBe('hotel');
  });

  it('leaves skuId absent when the item has no product behind it', () => {
    // The server stores "no product" as an empty string. An empty string is not
    // a SKU, and a Book button must not appear for one.
    const days = buildTimelineDays(trip(), [item({ skuId: '', status: 'SUGGESTED' })]);

    expect(days[0].activities[0].skuId).toBeUndefined();
  });

  it('shows a suggested item as suggested, not as booked', () => {
    const days = buildTimelineDays(trip(), [item({ status: 'SUGGESTED', bookingId: undefined })]);

    expect(days[0].activities[0].status).toBe('Suggested');
    expect(days[0].activities[0].bookingRef).toBeUndefined();
  });

  it('shows the real reference once the item is actually booked', () => {
    const days = buildTimelineDays(trip(), [
      item({ status: 'BOOKED', bookingId: 'DHB-DIV-2026-118' })
    ]);

    expect(days[0].activities[0].status).toBe('Booked ✓');
    expect(days[0].activities[0].bookingRef).toBe('DHB-DIV-2026-118');
  });

  it('groups items into their own days, in order', () => {
    const days = buildTimelineDays(trip(), [
      item({ id: 'ITEM-D3', dayNumber: 3 }),
      item({ id: 'ITEM-D1', dayNumber: 1 })
    ]);

    expect(days.map(d => d.dayNumber)).toEqual([1, 3]);
  });
});
