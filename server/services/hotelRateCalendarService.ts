import { db } from '../db/database';
import type { RoomRateNightEntity, RoomTypeEntity } from '../db/schema';
import { enumerateNights, nightlyRateFor } from './hotelPricingService';
import { roomsHeldByBookingOn } from './hotelAvailabilityService';

/**
 * The per-night view of a room type, shared by the desk (adminHotelRoutes)
 * and the property owner (propertyStayRoutes) so both read the same numbers.
 */

export const MAX_CALENDAR_NIGHTS = 62;

export interface RateCalendarNight {
  date: string;
  nightlyEGP: number;
  overridden: boolean;
  minNights?: number;
  closed: boolean;
  closedReason?: string;
  booked: number;
}

export interface RateCalendar {
  roomTypeId: string;
  totalUnits: number;
  baseNightlyEGP: number;
  nights: RateCalendarNight[];
}

/** Night-by-night price, closures and rooms held for [from, to). */
export function buildRateCalendar(roomType: RoomTypeEntity, from: string, to: string): RateCalendar {
  const nights = enumerateNights(from, to);
  if (nights.length === 0 || nights.length > MAX_CALENDAR_NIGHTS) {
    throw Object.assign(new Error(`"to" must be 1–${MAX_CALENDAR_NIGHTS} nights after "from".`), { status: 400 });
  }
  const overrides = new Map<string, RoomRateNightEntity>(
    db.roomRateNights.filter(r => r.roomTypeId === roomType.id).map(r => [r.date, r])
  );
  const bookings = db.hotelBookings.filter(b => b.roomTypeId === roomType.id);
  return {
    roomTypeId: roomType.id,
    totalUnits: roomType.totalUnits,
    baseNightlyEGP: roomType.baseNightlyEGP,
    nights: nights.map(date => {
      const override = overrides.get(date);
      return {
        date,
        nightlyEGP: nightlyRateFor(roomType, overrides, date),
        overridden: override?.nightlyEGP != null,
        minNights: override?.minNights,
        closed: Boolean(override?.closed),
        closedReason: override?.closedReason,
        booked: bookings.reduce((sum, b) => sum + roomsHeldByBookingOn(b, date), 0),
      };
    }),
  };
}

/**
 * Close or reopen a run of nights [from, to) without touching their prices —
 * what a property owner may do on their own calendar (a private event, a
 * renovation, a sold-out weekend sold elsewhere). Returns the nights changed.
 */
export function setNightsClosed(
  roomType: RoomTypeEntity,
  from: string,
  to: string,
  closed: boolean,
  reason: string | undefined,
  userId: string
): number {
  const nights = enumerateNights(from, to);
  if (nights.length === 0 || nights.length > MAX_CALENDAR_NIGHTS) {
    throw Object.assign(new Error(`"to" must be 1–${MAX_CALENDAR_NIGHTS} nights after "from".`), { status: 400 });
  }
  const now = new Date().toISOString();
  for (const date of nights) {
    const existing = db.roomRateNights.find(r => r.roomTypeId === roomType.id && r.date === date);
    if (existing) {
      existing.closed = closed;
      existing.closedReason = closed ? reason ?? existing.closedReason : undefined;
      existing.updatedAt = now;
    } else if (closed) {
      db.roomRateNights.push({
        id: `RRN-${roomType.id}-${date}`,
        accommodationId: roomType.accommodationId,
        roomTypeId: roomType.id,
        date,
        closed: true,
        closedReason: reason,
        createdByUserId: userId,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  return nights.length;
}
