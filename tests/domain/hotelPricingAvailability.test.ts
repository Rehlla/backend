import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import {
  quoteStay,
  StayQuoteError,
  assertCheckInNotPast,
  dahabToday,
  enumerateNights,
  blockPricedTotalEGP,
  STAY_DEPOSIT_PERCENT,
  nightlyRateFor,
  requiredMinNights,
} from '../../server/services/hotelPricingService';
import {
  checkStay,
  roomsHeldByBookingOn,
  availabilityForProperties,
} from '../../server/services/hotelAvailabilityService';
import { resetDb } from '../helpers/fixtures';
import type { AccommodationEntity, HotelBookingEntity, RoomRateNightEntity, RoomTypeEntity } from '../../server/db/schema';

/**
 * The pricing and availability engine for stays.
 *
 * These two services are what make "2 nights at this sea-view room, 2 adults"
 * a number and an honest answer, so the cases below are the ones that cost
 * money or trust when wrong: a closed night must not price, a minimum stay
 * must bind, a long-stay block must discount and never surcharge, an expired
 * hold must release its room, and a booking that ends the morning someone
 * else arrives must not double-count the night between them.
 */
describe('stay pricing', () => {
  beforeEach(() => {
    resetDb();
  });

  const accommodation = (id: string, skuId: string): AccommodationEntity => ({
    id,
    slug: id.toLowerCase(),
    name: id,
    nameAr: id,
    propertyType: 'hotel',
    category: 'mid-range',
    priceBand: 'moderate',
    areaId: 'masbat',
    area: 'masbat',
    areaName: 'Masbat',
    areaNameAr: 'مصبط',
    rating: 4.5,
    reviewCount: 10,
    typeChips: [],
    typeChipsAr: [],
    tagline: '',
    taglineAr: '',
    description: '',
    descriptionAr: '',
    amenities: [],
    amenitiesAr: [],
    perNightEGP: 900,
    packageNights: 5,
    rooms: 10,
    maxGuests: 3,
    bestFor: '',
    bestForAr: '',
    note: '',
    noteAr: '',
    skuId,
    active: true,
    featured: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  const roomType = (over: Partial<RoomTypeEntity> = {}): RoomTypeEntity => ({
    id: 'RT-ACC-A',
    accommodationId: 'ACC-A',
    skuId: 'SKU-RT-ACC-A',
    supplierId: 'SUP-ACC-A',
    code: 'STD',
    name: 'Standard',
    nameAr: 'عادي',
    maxGuestsPerUnit: 2,
    baseNightlyEGP: 1000,
    minNights: 1,
    maxNights: 30,
    cancellationPolicyHours: 48,
    totalUnits: 5,
    inventorySource: 'SEED_PUBLISHED',
    amenities: [],
    images: [],
    active: true,
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  const seed = (roomTypeOver: Partial<RoomTypeEntity> = {}) => {
    db.accommodations.push(accommodation('ACC-A', 'SKU-ACC-A'));
    db.roomTypes.push(roomType(roomTypeOver));
  };

  const quote = (over: Record<string, unknown> = {}) =>
    quoteStay({
      accommodationId: 'ACC-A',
      roomTypeId: 'RT-ACC-A',
      checkIn: '2026-07-10',
      checkOut: '2026-07-13',
      rooms: 1,
      adults: 2,
      children: 0,
      ...over,
    } as never);

  it('prices each night from the calendar and totals nights × rooms', () => {
    seed();
    const q = quote();

    expect(q.nights).toBe(3);
    expect(q.nightsDetail.map(n => n.date)).toEqual(['2026-07-10', '2026-07-11', '2026-07-12']);
    expect(q.baseEGP).toBe(3000);
    // Zero-fee zero-tax: the total is the stay, nothing invented on top.
    expect(q.totalEGP).toBe(3000);
    expect(q.depositEGP).toBe(Math.round(3000 * STAY_DEPOSIT_PERCENT));
    expect(q.balanceDueEGP).toBe(q.totalEGP - q.depositEGP);
  });

  it('uses a date override over the standing rate, night by night', () => {
    seed();
    db.roomRateNights.push({
      id: 'RRN-1',
      accommodationId: 'ACC-A',
      roomTypeId: 'RT-ACC-A',
      date: '2026-07-11',
      nightlyEGP: 1800,
      closed: false,
      createdByUserId: 'USR-ADMIN',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies RoomRateNightEntity);

    const q = quote();
    expect(q.nightsDetail[1].nightlyEGP).toBe(1800);
    expect(q.baseEGP).toBe(1000 + 1800 + 1000);
  });

  it('refuses a closed night rather than pricing it', () => {
    seed();
    db.roomRateNights.push({
      id: 'RRN-2',
      accommodationId: 'ACC-A',
      roomTypeId: 'RT-ACC-A',
      date: '2026-07-11',
      nightlyEGP: 0,
      closed: true,
      closedReason: 'maintenance',
      createdByUserId: 'USR-ADMIN',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies RoomRateNightEntity);

    try {
      quote();
      expect.unreachable('a closed night must not price');
    } catch (e) {
      expect(e).toBeInstanceOf(StayQuoteError);
      expect((e as StayQuoteError).code).toBe('NIGHT_CLOSED');
      expect((e as StayQuoteError).details).toMatchObject({ date: '2026-07-11' });
    }
  });

  it('enforces the minimum and maximum stay, including a date-level minimum', () => {
    seed({ minNights: 2 });
    expect(() => quote({ checkIn: '2026-07-10', checkOut: '2026-07-11' })).toThrow(/at least 2/);

    db.roomRateNights.push({
      id: 'RRN-3',
      accommodationId: 'ACC-A',
      roomTypeId: 'RT-ACC-A',
      date: '2026-07-12',
      minNights: 4,
      closed: false,
      createdByUserId: 'USR-ADMIN',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies RoomRateNightEntity);
    // Three nights touching a four-night-minimum date must be refused; the
    // strictest requirement in the window wins.
    expect(() => quote({ checkIn: '2026-07-10', checkOut: '2026-07-13' })).toThrow(/at least 4/);

    seed({ minNights: 1 });
    expect(() => quote({ checkIn: '2026-07-10', checkOut: '2026-08-20' })).toThrow(/at most 30/);
  });

  it('discounts long stays through weekly and monthly blocks, never surcharging', () => {
    // 10 nights, weekly 6300 (vs 1000×7): one block + 3 nightly.
    const weekly = blockPricedTotalEGP(
      Array.from({ length: 10 }, () => 1000), 1, undefined, 6300
    );
    expect(weekly).toBe(6300 + 3000);

// 30 nights, monthly 24000: one full 28-night block + the last 2 nights at
// their nightly rate — the block covers the earliest nights, the remainder
// is priced as slept.
const monthly = blockPricedTotalEGP(
  Array.from({ length: 30 }, () => 1000), 1, 24000
);
expect(monthly).toBe(24000 + 2000);

// A block rate entered above the nightly sum must never turn a discount into
// a surcharge: the block prices at what it prices, and the quote clamps the
// discount at zero (asserted through quoteStay further down).
const inverted = blockPricedTotalEGP(
  Array.from({ length: 7 }, () => 1000), 1, undefined, 9000
);
expect(inverted).toBe(9000);

    seed({ weeklyRateEGP: 6300 });
    const q = quote({ checkIn: '2026-07-10', checkOut: '2026-07-20' });
    expect(q.baseEGP).toBe(10000);
    expect(q.longStayDiscountEGP).toBe(700);
    expect(q.totalEGP).toBe(9300);

// The clamp: a mis-entered weekly rate above the nightly sum discounts to
// zero rather than inflating the total.
db.roomTypes[0].weeklyRateEGP = 9000;
const clamped = quote({ checkIn: '2026-07-10', checkOut: '2026-07-17' });
    expect(clamped.baseEGP).toBe(7000);
    expect(clamped.longStayDiscountEGP).toBe(0);
    expect(clamped.totalEGP).toBe(7000);
  });

  it('prices per room: two rooms double every night line', () => {
    seed();
    const q = quote({ rooms: 2 });
    expect(q.baseEGP).toBe(6000);
    expect(q.nightsDetail.every(n => n.rooms === 2 && n.totalEGP === 2000)).toBe(true);
  });

  it('rejects a party a room cannot sleep and more rooms than exist', () => {
    seed({ maxGuestsPerUnit: 2, totalUnits: 5 });
    expect(() => quote({ adults: 5 })).toThrow(/sleeps up to 2/);
    expect(() => quote({ rooms: 6 })).toThrow(/not part of this room type/);
  });

  it('refuses an unknown or unsellable room type', () => {
    seed({ totalUnits: 0, active: false });
    try {
      quote();
      expect.unreachable();
    } catch (e) {
      expect((e as StayQuoteError).code).toBe('INACTIVE_ROOM_TYPE');
      expect((e as StayQuoteError).status).toBe(409);
    }
    try {
      quote({ roomTypeId: 'RT-GHOST' });
      expect.unreachable();
    } catch (e) {
      expect((e as StayQuoteError).code).toBe('UNKNOWN_ROOM_TYPE');
      expect((e as StayQuoteError).status).toBe(404);
    }
  });

  it('counts check-out morning as departure, not a slept night', () => {
    expect(enumerateNights('2026-07-10', '2026-07-11')).toEqual(['2026-07-10']);
    expect(enumerateNights('2026-07-10', '2026-07-13')).toHaveLength(3);
  });

  it('free cancellation sits policy hours before the 14:00 check-in', () => {
    seed({ cancellationPolicyHours: 48 });
    const q = quote();
    expect(q.freeCancellationUntil).toBe('2026-07-08T14:00:00.000Z');
  });

  it('applies the strictest date minimum across the window', () => {
    seed({ minNights: 1 });
    const overrides = new Map([
      ['2026-07-12', { minNights: 4 } as unknown as RoomRateNightEntity],
    ]);
    const rt = roomType();
    expect(requiredMinNights(rt, overrides, enumerateNights('2026-07-10', '2026-07-13'))).toBe(4);
    expect(requiredMinNights(rt, overrides, enumerateNights('2026-07-01', '2026-07-05'))).toBe(1);
    expect(nightlyRateFor(rt, new Map(), '2026-07-10')).toBe(1000);
  });
});

describe('stay availability', () => {
  beforeEach(() => {
    resetDb();
  });

  const roomType = (over: Partial<RoomTypeEntity> = {}): RoomTypeEntity => ({
    id: 'RT-ACC-A',
    accommodationId: 'ACC-A',
    skuId: 'SKU-RT-ACC-A',
    supplierId: 'SUP-ACC-A',
    code: 'STD',
    name: 'Standard',
    nameAr: 'عادي',
    maxGuestsPerUnit: 2,
    baseNightlyEGP: 1000,
    minNights: 1,
    maxNights: 30,
    cancellationPolicyHours: 48,
    totalUnits: 3,
    inventorySource: 'SEED_PUBLISHED',
    amenities: [],
    images: [],
    active: true,
    displayOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  const booking = (over: Partial<HotelBookingEntity>): HotelBookingEntity => ({
    id: 'HB-1',
    bookingRef: 'HTL-20260710-0001',
    accommodationId: 'ACC-A',
    roomTypeId: 'RT-ACC-A',
    skuId: 'SKU-RT-ACC-A',
    supplierId: 'SUP-ACC-A',
    tripId: 'TRIP-1',
    userId: 'USR-1',
    travelerName: 'T',
    travelerPhone: '+201000000000',
    travelerEmail: 't@example.com',
    checkIn: '2026-07-10',
    checkOut: '2026-07-13',
    nights: 3,
    rooms: 1,
    adults: 2,
    children: 0,
    guestDetails: [],
    status: 'CONFIRMED',
    paymentState: 'PENDING',
    depositPercent: 0.2,
    depositEGP: 600,
    balanceDueEGP: 2400,
    paymentInstructions: {
      method: 'INSTAPAY',
      amountEGP: 600,
      reference: 'REF-1',
      deadline: '2026-07-10',
      contactPhone: '+201002328005',
      instructions: 'Pay the deposit.',
    },
    priceBreakdown: {
      nights: 3,
      nightsDetail: [],
      baseEGP: 3000,
      longStayDiscountEGP: 0,
      serviceFeeEGP: 0,
      taxEGP: 0,
      totalEGP: 3000,
      currency: 'EGP',
      depositEGP: 600,
      balanceDueEGP: 2400,
    },
    cancellationPolicyHours: 48,
    freeCancellationUntil: '2026-07-08T14:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
  });

  const check = (over: Record<string, unknown> = {}) =>
    checkStay({
      accommodationId: 'ACC-A',
      roomTypeId: 'RT-ACC-A',
      checkIn: '2026-07-10',
      checkOut: '2026-07-13',
      rooms: 1,
      ...over,
    } as never);

  it('derives units left from bookings, not a stored counter', () => {
    db.roomTypes.push(roomType());
    const a = check();

    expect(a.available).toBe(true);
    expect(a.nights.every(n => n.unitsLeft === 3)).toBe(true);
    expect(a.minUnitsLeft).toBe(3);

    db.hotelBookings.push(booking({ id: 'HB-1', rooms: 2 }));
    const after = check();
    expect(after.available).toBe(true);
    expect(after.nights.every(n => n.unitsLeft === 1)).toBe(true);
    expect(after.minUnitsLeft).toBe(1);
  });

  it('refuses when the request needs more rooms than any night can host', () => {
    db.roomTypes.push(roomType());
    db.hotelBookings.push(booking({ id: 'HB-1', rooms: 2 }));

    const a = check({ rooms: 2 });
    expect(a.available).toBe(false);
    expect(a.unavailableReason).toBe('TOO_MANY_ROOMS');
    expect(a.firstUnavailableDate).toBe('2026-07-10');
    // The honest scarcity figure: the tightest night in the window.
    expect(a.minUnitsLeft).toBe(1);
  });

  it('does not double-count the night a previous stay ends on', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    db.hotelBookings.push(booking({ id: 'HB-1', checkIn: '2026-07-08', checkOut: '2026-07-10' }));

    // The previous stay sleeps the 8th and 9th; the 10th is free from 14:00.
    const a = check({ checkIn: '2026-07-10', checkOut: '2026-07-12' });
    expect(a.available).toBe(true);
    expect(a.nights[0].unitsLeft).toBe(1);
  });

  it('releases inventory of cancelled, rejected and no-show bookings', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    const released: HotelBookingEntity['status'][] = ['CANCELLED', 'REJECTED', 'NO_SHOW', 'COMPLETED'];
    for (const [i, status] of released.entries()) {
      db.hotelBookings.push(booking({ id: `HB-${i}`, status, checkIn: '2026-07-10', checkOut: '2026-07-13' }));
    }
    expect(check().available).toBe(true);
  });

  it('releases the room of an expired payment hold, but holds it while live', () => {
    db.roomTypes.push(roomType({ totalUnits: 1 }));
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    const past = new Date(Date.now() - 10 * 60_000).toISOString();

    db.hotelBookings.push(booking({ id: 'HB-LIVE', status: 'PENDING_PAYMENT', holdExpiresAt: future }));
    expect(check().available).toBe(false);

    db.hotelBookings[0] = booking({ id: 'HB-LIVE', status: 'PENDING_PAYMENT', holdExpiresAt: past });
    expect(check().available).toBe(true);

    // No expiry recorded at all: conservatively still holding.
    db.hotelBookings[0] = booking({ id: 'HB-LIVE', status: 'PENDING_PAYMENT' });
    expect(check().available).toBe(false);
  });

  it('reports a closed night through the calendar, with its reason', () => {
    db.roomTypes.push(roomType());
    db.roomRateNights.push({
      id: 'RRN-9',
      accommodationId: 'ACC-A',
      roomTypeId: 'RT-ACC-A',
      date: '2026-07-11',
      closed: true,
      closedReason: 'owner block',
      createdByUserId: 'USR-ADMIN',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies RoomRateNightEntity);

    const a = check();
    expect(a.available).toBe(false);
    expect(a.unavailableReason).toBe('NIGHT_CLOSED');
    expect(a.firstUnavailableDate).toBe('2026-07-11');
    expect(a.nights[1]).toMatchObject({ closed: true, reason: 'owner block', available: false });
  });

  it('shows a closed night on the calendar while keeping its price', () => {
    db.roomTypes.push(roomType());
    const a = check({ checkIn: '2026-07-10', checkOut: '2026-07-11' });
    expect(a.nights[0]).toMatchObject({
      date: '2026-07-10',
      nightlyEGP: 1000,
      unitsLeft: 3,
      available: true,
    });
  });

  it('refuses an inactive room type without a units answer', () => {
    db.roomTypes.push(roomType({ active: false }));
    const a = check();
    expect(a.available).toBe(false);
    expect(a.unavailableReason).toBe('INACTIVE_ROOM_TYPE');
    expect(a.nights).toHaveLength(0);
  });
});

describe('listing-page availability sweep', () => {
  beforeEach(() => {
    resetDb();
  });

  it('answers per property in one pass, honouring party size', () => {
    db.roomTypes.push(
      {
        id: 'RT-A', accommodationId: 'ACC-A', skuId: 'SKU-RT-A', supplierId: 'SUP-A',
        code: 'STD', name: 'A', nameAr: 'A', maxGuestsPerUnit: 2, baseNightlyEGP: 800,
        minNights: 1, maxNights: 30, cancellationPolicyHours: 48, totalUnits: 4,
        inventorySource: 'SEED_PUBLISHED', amenities: [], images: [], active: true,
        displayOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'RT-B', accommodationId: 'ACC-B', skuId: 'SKU-RT-B', supplierId: 'SUP-B',
        code: 'STD', name: 'B', nameAr: 'B', maxGuestsPerUnit: 2, baseNightlyEGP: 500,
        minNights: 1, maxNights: 30, cancellationPolicyHours: 48, totalUnits: 2,
        inventorySource: 'SEED_PUBLISHED', amenities: [], images: [], active: true,
        displayOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        // Inactive: held back by the backfill for want of a capacity.
        id: 'RT-C', accommodationId: 'ACC-C', skuId: 'SKU-RT-C', supplierId: 'SUP-C',
        code: 'STD', name: 'C', nameAr: 'C', maxGuestsPerUnit: 2, baseNightlyEGP: 300,
        minNights: 1, maxNights: 30, cancellationPolicyHours: 48, totalUnits: 0,
        inventorySource: 'SEED_PUBLISHED', amenities: [], images: [], active: false,
        displayOrder: 0, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
      }
    );
    db.hotelBookings.push({
      ...({} as HotelBookingEntity),
      id: 'HB-B', bookingRef: 'HTL-1', accommodationId: 'ACC-B', roomTypeId: 'RT-B',
      skuId: 'SKU-RT-B', supplierId: 'SUP-B', tripId: 'TRIP-1', userId: 'USR-1',
      travelerName: 'T', travelerPhone: '+201000000000', travelerEmail: 't@e.com',
      checkIn: '2026-07-10', checkOut: '2026-07-13', nights: 3, rooms: 2,
      adults: 2, children: 0, guestDetails: [], status: 'CONFIRMED',
      paymentState: 'PENDING', depositPercent: 0.2, depositEGP: 0, balanceDueEGP: 0,
      paymentInstructions: {
        method: 'INSTAPAY', amountEGP: 0, reference: 'R', deadline: '2026-07-10',
        contactPhone: '+201002328005', instructions: '',
      },
      priceBreakdown: {
        nights: 3, nightsDetail: [], baseEGP: 0, longStayDiscountEGP: 0,
        serviceFeeEGP: 0, taxEGP: 0, totalEGP: 0, currency: 'EGP',
        depositEGP: 0, balanceDueEGP: 0,
      },
      cancellationPolicyHours: 48, freeCancellationUntil: '2026-07-08T14:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    } as HotelBookingEntity);

    const sweep = availabilityForProperties({
      accommodationIds: ['ACC-A', 'ACC-B', 'ACC-C'],
      checkIn: '2026-07-10',
      checkOut: '2026-07-13',
      rooms: 1,
      guests: 2,
    });

    expect(sweep.get('ACC-A')).toMatchObject({ available: true, minUnitsLeft: 4, fromNightlyEGP: 800 });
    // Both units of B are already confirmed for those nights.
    expect(sweep.get('ACC-B')).toMatchObject({ available: false, minUnitsLeft: 0 });
    // C never had a capacity to sell.
    expect(sweep.get('ACC-C')).toMatchObject({ available: false, minUnitsLeft: 0 });

    // A family of five is not served by a two-guest room, however empty it is.
    const family = availabilityForProperties({
      accommodationIds: ['ACC-A'],
      checkIn: '2026-07-10',
      checkOut: '2026-07-12',
      rooms: 1,
      guests: 5,
    });
    expect(family.get('ACC-A')!.available).toBe(false);
  });

  it('treats an empty window as no answer rather than everything available', () => {
    const sweep = availabilityForProperties({
      accommodationIds: [],
      checkIn: '2026-07-10',
      checkOut: '2026-07-12',
      rooms: 1,
      guests: 2,
    });
    expect(sweep.size).toBe(0);
    const cancelled: HotelBookingEntity = {
      ...({} as HotelBookingEntity),
      status: 'CANCELLED',
      checkIn: '2026-07-10',
      checkOut: '2026-07-11',
      rooms: 2,
    };
    expect(roomsHeldByBookingOn(cancelled, '2026-07-10')).toBe(0);
  });
});

describe('past check-in guard', () => {
  it("uses Dahab's date, not UTC: 23:30 UTC is already tomorrow in Cairo", () => {
    // Cairo is UTC+3 in October (summer time), so 2026-10-14T23:30Z is 02:30 on the 15th.
    const lateNightUtc = new Date('2026-10-14T23:30:00Z');
    expect(dahabToday(lateNightUtc)).toBe('2026-10-15');
    expect(() => assertCheckInNotPast('2026-10-14', lateNightUtc)).toThrow(StayQuoteError);
    expect(() => assertCheckInNotPast('2026-10-15', lateNightUtc)).not.toThrow();
  });

  it('accepts tonight and refuses yesterday', () => {
    const now = new Date('2026-10-14T12:00:00Z');
    expect(() => assertCheckInNotPast('2026-10-14', now)).not.toThrow();
    try {
      assertCheckInNotPast('2026-10-13', now);
      throw new Error('expected a refusal');
    } catch (err) {
      expect((err as StayQuoteError).code).toBe('CHECK_IN_IN_PAST');
    }
  });
});
