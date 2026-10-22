import type { ConfirmedBookingItem } from '../shared/types/commerce';
import type { TripEntity, TripItemWithSupplier } from '../shared/types/trip';
import { dahabToday } from './travelerLifecycleResolver';

/**
 * The homepage trip pass: the traveler's own trip, read into what the next-step
 * card shows — when, how long, how many people, and each booked outing with
 * its departure and its real status.
 *
 * Pure (the clock is a parameter) and, like the resolver beside it, it invents
 * nothing: a date the booking does not hold is left out, and a booking the
 * operator has not confirmed is never shown as confirmed.
 */

export type PassStopStatus = 'confirmed' | 'pending' | 'changed' | 'planned';

export interface PassStop {
  id: string;
  titleEn: string;
  titleAr?: string;
  supplierEn?: string;
  supplierAr?: string;
  /** YYYY-MM-DD, when the booking or the trip's dates place it. */
  date?: string;
  /** The departure as booked, e.g. "03:30 PM". */
  time?: string;
  durationMinutes?: number;
  status: PassStopStatus;
}

export interface TripPass {
  startDate?: string;
  endDate?: string;
  lengthDays?: number;
  travelers?: number;
  /** Date of the next outing (or the trip's start when no outing is dated). */
  nextDate?: string;
  /** Whole days from today (Dahab time) to `nextDate`; absent when past or unknown. */
  daysUntilNext?: number;
  stops: PassStop[];
  /** Outings in the trip beyond the ones listed. */
  moreCount: number;
  pendingCount: number;
}

const ISO_DATE = /^(\d{4}-\d{2}-\d{2})/;

const dayDiff = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Minutes past midnight for "03:30 PM" / "15:30"; null when not a clock time. */
export function clockMinutes(time: string | undefined): number | null {
  const m = time?.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let hours = Number(m[1]) % 24;
  const meridiem = m[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + Number(m[2]);
}

const statusOf = (
  item: TripItemWithSupplier,
  booking: ConfirmedBookingItem | undefined
): PassStopStatus => {
  if (booking) {
    if (booking.status === 'Changed') return 'changed';
    return booking.status === 'Pending' ? 'pending' : 'confirmed';
  }
  if (item.status === 'CONFIRMED' || item.status === 'BOOKED') return 'confirmed';
  if (item.status === 'HELD') return 'pending';
  return 'planned';
};

export function resolveTripPass(
  trip: TripEntity | null | undefined,
  items: TripItemWithSupplier[] = [],
  bookings: ConfirmedBookingItem[] = [],
  options: { now?: Date; limit?: number } = {}
): TripPass | null {
  if (!trip) return null;
  const today = dahabToday(options.now);
  const limit = options.limit ?? 3;

  const all: PassStop[] = items
    .filter((item) => item.status !== 'CANCELLED')
    .map((item) => {
      const booking = item.bookingId ? bookings.find((b) => b.id === item.bookingId) : undefined;
      const bookedDate = booking?.datesOrTime.match(ISO_DATE)?.[1];
      const date =
        bookedDate ?? (trip.startDate && item.dayNumber > 0 ? addDays(trip.startDate, item.dayNumber - 1) : undefined);
      return {
        id: item.id,
        titleEn: item.title,
        titleAr: item.titleAr,
        supplierEn: item.supplier?.businessName,
        supplierAr: item.supplier?.businessNameAr || undefined,
        date,
        time: item.timeSlot || undefined,
        durationMinutes: item.durationMinutes && item.durationMinutes > 0 ? item.durationMinutes : undefined,
        status: statusOf(item, booking),
      };
    })
    .sort(
      (a, b) =>
        (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
        (clockMinutes(a.time) ?? 1e4) - (clockMinutes(b.time) ?? 1e4)
    );

  // Upcoming outings lead; once the trip is behind them, the whole trip shows.
  const upcoming = all.filter((s) => !s.date || s.date >= today);
  const pool = upcoming.length > 0 ? upcoming : all;
  const stops = pool.slice(0, limit);

  const nextDate = stops.find((s) => s.date)?.date ?? trip.startDate;
  const until = nextDate ? dayDiff(today, nextDate) : undefined;

  return {
    startDate: trip.startDate,
    endDate: trip.endDate,
    lengthDays: trip.lengthDays > 0 ? trip.lengthDays : undefined,
    travelers: trip.travelersCount > 0 ? trip.travelersCount : undefined,
    nextDate,
    ...(until !== undefined && until >= 0 ? { daysUntilNext: until } : {}),
    stops,
    moreCount: Math.max(0, pool.length - stops.length),
    pendingCount: all.filter((s) => s.status === 'pending').length,
  };
}
