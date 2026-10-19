import { db } from '../db/database';
import type { HotelBookingEntity, RoomTypeEntity } from '../db/schema';
import { enumerateNights, nightlyRateFor, requiredMinNights, StayQuoteError } from './hotelPricingService';

/**
 * Works out what is actually left to sell, from the bookings that exist.
 *
 * There is no inventory table for stays, on purpose. Units on a night are
 * `totalUnits − (rooms already booked over that night) − (closed nights)`, and
 * the bookings themselves are the ledger of what is taken. A materialised
 * slot table would have to be pruned forever and would drift from the bookings
 * it was derived from — the same reason the catalogue never pre-seeded hotel
 * slots. The derivation is one indexed query per room type, and correctness
 * comes from the same rows the money settles against.
 *
 * ---------------------------------------------------------------------------
 * Which bookings hold a night
 * ---------------------------------------------------------------------------
 * PENDING_PAYMENT holds stock for as long as its hold is unexpired — that is
 * the entire point of the hold window, and an expired one releases it.
 * PENDING_CONFIRMATION and CONFIRMED hold stock because the traveller has paid
 * or the property is about to host them. IN_HOUSE is a guest already in a room.
 * Cancelled, rejected, completed and no-show bookings release their nights.
 */

/** Statuses that occupy inventory on their nights. */
const INVENTORY_HOLDING_STATUSES = new Set<HotelBookingEntity['status']>([
  'PENDING_PAYMENT',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'IN_HOUSE',
]);

/**
 * Rooms taken by this booking on a given night, or 0 when it does not overlap.
 *
 * A stay occupies `[checkIn, checkOut)` — the same half-open window the quote
 * prices, so a stay ending on the 13th does not fight a stay starting on the
 * 13th for the night of the 13th. An expired PENDING_PAYMENT hold is treated as
 * released at the moment it expired, not when a cleanup pass notices.
 */
export function roomsHeldByBookingOn(booking: HotelBookingEntity, date: string): number {
  if (!INVENTORY_HOLDING_STATUSES.has(booking.status)) return 0;
  if (
    booking.status === 'PENDING_PAYMENT' &&
    booking.holdExpiresAt !== undefined &&
    booking.holdExpiresAt <= new Date().toISOString()
  ) {
    return 0;
  }
  return booking.checkIn <= date && date < booking.checkOut ? booking.rooms : 0;
}

export interface NightAvailability {
  date: string;
  nightlyEGP: number;
  minNights: number;
  totalUnits: number;
  unitsLeft: number;
  available: boolean;
  closed: boolean;
  reason?: string;
}

export interface StayAvailability {
  available: boolean;
  roomTypeId: string;
  totalUnits: number;
  /** Per-night view across the requested window. */
  nights: NightAvailability[];
  /** First night that cannot host the request, when the stay is unavailable. */
  firstUnavailableDate?: string;
  /** Fewest units that remain across the whole window — the honest "N left". */
  minUnitsLeft: number;
  minNights: number;
  maxNights: number;
  /** Why the stay was refused, when it was. */
  unavailableReason?: 'INACTIVE_ROOM_TYPE' | 'NIGHT_CLOSED' | 'TOO_MANY_ROOMS' | 'MIN_NIGHTS';
}

/**
 * Availability for one room type across one window, plus a per-night calendar.
 *
 * `unitsLeft` counts the rooms the caller asked for against every night, so a
 * villa with two units shows "1 left" the moment one booking overlaps either
 * night of the requested window — the figure a traveller can act on, not an
 * average across dates.
 */
export function checkStay(params: {
  accommodationId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
}): StayAvailability {
  const roomType = db.roomTypes.find(
    r => r.id === params.roomTypeId && r.accommodationId === params.accommodationId
  );

  if (!roomType) {
    throw new StayQuoteError(
      'This room type does not exist for the selected property.',
      'UNKNOWN_ROOM_TYPE',
      { roomTypeId: params.roomTypeId, accommodationId: params.accommodationId },
      404
    );
  }

  const nights = enumerateNights(params.checkIn, params.checkOut);
  if (nights.length < 1) {
    throw new StayQuoteError(
      'Check-out must be after check-in.',
      'INVALID_DATES',
      { checkIn: params.checkIn, checkOut: params.checkOut }
    );
  }

  const minNights = requiredMinNights(roomType, overridesByDateFor(roomType, nights), nights);

  const base: StayAvailability = {
    available: false,
    roomTypeId: roomType.id,
    totalUnits: roomType.totalUnits,
    nights: [],
    minUnitsLeft: 0,
    minNights,
    maxNights: roomType.maxNights,
  };

  if (!roomType.active || roomType.totalUnits <= 0) {
    return { ...base, unavailableReason: 'INACTIVE_ROOM_TYPE' };
  }
  if (params.rooms > roomType.totalUnits) {
    return { ...base, unavailableReason: 'TOO_MANY_ROOMS' };
  }
  if (nights.length < minNights) {
    return { ...base, unavailableReason: 'MIN_NIGHTS' };
  }

  const overrides = overridesByDateFor(roomType, nights);
  const bookings = db.hotelBookings.filter(b => b.roomTypeId === roomType.id);

  let minUnitsLeft = roomType.totalUnits;
  let firstUnavailableDate: string | undefined;
  let unavailableReason: StayAvailability['unavailableReason'];

  const detail: NightAvailability[] = nights.map(date => {
    const override = overrides.get(date);
    const held = bookings.reduce((acc, b) => acc + roomsHeldByBookingOn(b, date), 0);
    const unitsLeft = Math.max(0, roomType.totalUnits - held);
    if (unitsLeft < minUnitsLeft) minUnitsLeft = unitsLeft;

    let available = true;
    let reason: string | undefined;

    if (override?.closed) {
      available = false;
      reason = override.closedReason ?? 'closed';
      unavailableReason ??= 'NIGHT_CLOSED';
    } else if (unitsLeft < params.rooms) {
      available = false;
      unavailableReason ??= 'TOO_MANY_ROOMS';
    }
    if (!available && firstUnavailableDate === undefined) firstUnavailableDate = date;

    return {
      date,
      nightlyEGP: nightlyRateFor(roomType, overrides, date),
      minNights: override?.minNights ?? roomType.minNights,
      totalUnits: roomType.totalUnits,
      unitsLeft,
      available,
      closed: override?.closed ?? false,
      reason,
    };
  });

  const available = firstUnavailableDate === undefined;

  return {
    available,
    roomTypeId: roomType.id,
    totalUnits: roomType.totalUnits,
    nights: detail,
    firstUnavailableDate,
    minUnitsLeft,
    minNights,
    maxNights: roomType.maxNights,
    unavailableReason: available ? undefined : unavailableReason,
  };
}

/** Calendar overrides that matter to this window, keyed by date. */
function overridesByDateFor(
  roomType: RoomTypeEntity,
  nights: string[]
): Map<string, (typeof db.roomRateNights)[number]> {
  const map = new Map<string, (typeof db.roomRateNights)[number]>();
  for (const row of db.roomRateNights) {
    if (row.roomTypeId === roomType.id && nights.includes(row.date)) {
      map.set(row.date, row);
    }
  }
  return map;
}

export interface PropertyAvailabilitySummary {
  accommodationId: string;
  available: boolean;
  /** Smallest units-left across every room type and every night. */
  minUnitsLeft: number;
  /** The cheapest sellable nightly rate across the window's room types. */
  fromNightlyEGP?: number;
}

/**
 * One pass over the catalogue for the listing page.
 *
 * `/hotels` with dates must filter server-side — the page used to download the
 * whole catalogue and filter in the browser, and availability cannot be computed
 * in the browser without shipping every booking to every visitor. This is the
 * shape the listing endpoint will call: one room-type-indexed pass, one summary
 * row per property.
 */
export function availabilityForProperties(params: {
  accommodationIds: string[];
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
}): Map<string, PropertyAvailabilitySummary> {
  const summaries = new Map<string, PropertyAvailabilitySummary>();
  if (params.accommodationIds.length === 0) return summaries;

  const wanted = new Set(params.accommodationIds);
  const roomTypesByProperty = new Map<string, RoomTypeEntity[]>();
  for (const rt of db.roomTypes) {
    if (!wanted.has(rt.accommodationId)) continue;
    const list = roomTypesByProperty.get(rt.accommodationId) ?? [];
    list.push(rt);
    roomTypesByProperty.set(rt.accommodationId, list);
  }

  const nights = enumerateNights(params.checkIn, params.checkOut);
  const holdsPerNight = new Map<string, number>();
  for (const booking of db.hotelBookings) {
    if (!INVENTORY_HOLDING_STATUSES.has(booking.status)) continue;
    if (
      booking.status === 'PENDING_PAYMENT' &&
      booking.holdExpiresAt !== undefined &&
      booking.holdExpiresAt <= new Date().toISOString()
    ) {
      continue;
    }
    for (const date of nights) {
      if (roomsHeldByBookingOn(booking, date) > 0) {
        holdsPerNight.set(
          `${booking.roomTypeId}|${date}`,
          (holdsPerNight.get(`${booking.roomTypeId}|${date}`) ?? 0) + booking.rooms
        );
      }
    }
  }

  for (const accommodationId of params.accommodationIds) {
    const roomTypes = roomTypesByProperty.get(accommodationId) ?? [];
    let propertyAvailable = false;
    let minUnitsLeft = Number.MAX_SAFE_INTEGER;
    let fromNightlyEGP: number | undefined;

    for (const rt of roomTypes) {
      if (!rt.active || rt.totalUnits <= 0) continue;
      // The room must physically sleep the party; a two-guest studio is not a
      // result for a family of five however many units remain.
      if (params.guests > params.rooms * rt.maxGuestsPerUnit) continue;

      let fitsThisType = true;
      for (const date of nights) {
        const held = holdsPerNight.get(`${rt.id}|${date}`) ?? 0;
        if (rt.totalUnits - held < params.rooms) {
          fitsThisType = false;
          break;
        }
      }
      if (!fitsThisType) continue;

      propertyAvailable = true;
      minUnitsLeft = Math.min(
        minUnitsLeft,
        ...nights.map(d => rt.totalUnits - (holdsPerNight.get(`${rt.id}|${d}`) ?? 0))
      );
      fromNightlyEGP = Math.min(fromNightlyEGP ?? rt.baseNightlyEGP, rt.baseNightlyEGP);
    }

    summaries.set(accommodationId, {
      accommodationId,
      available: propertyAvailable,
      minUnitsLeft: propertyAvailable ? minUnitsLeft : 0,
      fromNightlyEGP,
    });
  }

  return summaries;
}