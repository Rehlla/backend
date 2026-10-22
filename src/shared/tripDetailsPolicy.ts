/**
 * What a traveler may change about their own trip — title, dates, length,
 * party size, pace and budget — and what those changes must respect.
 *
 * Shared by the PATCH /api/trips/:tripId handler (which enforces it) and the
 * edit sheet on /my-trip (which shows the same limits before the traveler
 * hits them). Pure: the day is a parameter.
 *
 * The rules come from what is already committed:
 *  - A finished or cancelled trip keeps its record; only its name can change.
 *  - Once the traveler is in Dahab the start date is history; the length can
 *    still change, as long as the trip does not end in the past.
 *  - The party cannot shrink below the largest booking: a boat booked for
 *    three is not a trip for two. Changing a booking goes through the booking.
 *  - The dates must still contain every live booking, and a booked outing's
 *    day number follows its booked date.
 *  - Unbooked plans move with the trip; a shorter trip cannot strand them past
 *    its last day.
 */

export const TRIP_PACES = ['Relaxed', 'Balanced', 'Active'] as const;
export const TRIP_BUDGETS = ['Budget', 'Moderate', 'Premium'] as const;
export type TripPace = (typeof TRIP_PACES)[number];
export type TripBudget = (typeof TRIP_BUDGETS)[number];

export const TRIP_DETAIL_FIELDS = ['title', 'travelersCount', 'startDate', 'lengthDays', 'pace', 'budget'] as const;

export const TRIP_LIMITS = {
  titleMin: 2,
  titleMax: 80,
  travelersMin: 1,
  travelersMax: 20,
  lengthMin: 1,
  lengthMax: 30,
} as const;

export type TripLifecycleStatus = 'DRAFT' | 'PLANNED' | 'CONFIRMED' | 'IN_DESTINATION' | 'COMPLETED' | 'CANCELLED';

export interface PolicyTrip {
  status: TripLifecycleStatus;
  title: string;
  travelersCount: number;
  lengthDays: number;
  startDate?: string;
  endDate?: string;
  pace: string;
  budget: string;
}

export interface PolicyItem {
  id: string;
  dayNumber: number;
  status: string;
  bookingId?: string;
}

export interface PolicyBooking {
  id: string;
  bookingRef?: string;
  tripItemId?: string;
  passengersCount: number;
  scheduledDate?: string;
  /** False once the booking is cancelled, rejected, refunded or expired. */
  active: boolean;
}

export interface TripDetailsPatch {
  title?: string;
  travelersCount?: number;
  startDate?: string;
  lengthDays?: number;
  pace?: TripPace;
  budget?: TripBudget;
}

export type TripDetailsErrorCode =
  | 'TRIP_CLOSED'
  | 'DATES_LOCKED'
  | 'TITLE_LENGTH'
  | 'TRAVELERS_RANGE'
  | 'TRAVELERS_BELOW_BOOKED'
  | 'LENGTH_RANGE'
  | 'START_IN_PAST'
  | 'END_IN_PAST'
  | 'BOOKING_OUTSIDE_DATES'
  | 'PLANS_BEYOND_END';

export interface TripDetailsError {
  ok: false;
  code: TripDetailsErrorCode;
  field: keyof TripDetailsPatch;
  params: Record<string, string | number>;
  message: string;
}

export interface TripDetailsPlan {
  ok: true;
  changes: Partial<Pick<PolicyTrip, 'title' | 'travelersCount' | 'startDate' | 'endDate' | 'lengthDays' | 'pace' | 'budget'>>;
  /** Booked items whose day number moves to match their booked date. */
  itemDays: { id: string; dayNumber: number }[];
}

export interface TripDetailsConstraints {
  canEditTitle: boolean;
  canEditParty: boolean;
  canEditStart: boolean;
  canEditLength: boolean;
  canEditPreferences: boolean;
  /** The largest live booking's party, at least 1. */
  minTravelers: number;
  /** Dates of live bookings, sorted, unique. */
  bookedDates: string[];
  /** Highest day number an unbooked plan sits on. */
  lastPlannedDay: number;
}

const CLOSED: readonly TripLifecycleStatus[] = ['COMPLETED', 'CANCELLED'];

const DEAD_SUPPLIER_STATES = new Set(['CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED']);
const DEAD_PAYMENT_STATES = new Set(['REFUNDED', 'CANCELLED', 'FAILED']);

/** A booking still binds the trip until it is cancelled, rejected, refunded or expired. */
export const isBookingLive = (supplierState: string, paymentState: string): boolean =>
  !DEAD_SUPPLIER_STATES.has(supplierState) && !DEAD_PAYMENT_STATES.has(paymentState);

export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export const daysBetween = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const bookingOf = (item: PolicyItem, bookings: PolicyBooking[]): PolicyBooking | undefined =>
  bookings.find(
    (b) =>
      b.tripItemId === item.id ||
      (item.bookingId !== undefined && (b.id === item.bookingId || b.bookingRef === item.bookingId))
  );

export function tripDetailsConstraints(
  trip: PolicyTrip,
  items: PolicyItem[],
  bookings: PolicyBooking[]
): TripDetailsConstraints {
  const live = bookings.filter((b) => b.active);
  const closed = CLOSED.includes(trip.status);
  const bookedItemIds = new Set(
    items.filter((i) => bookingOf(i, live) !== undefined).map((i) => i.id)
  );
  const plans = items.filter((i) => i.status !== 'CANCELLED' && !bookedItemIds.has(i.id));

  return {
    canEditTitle: true,
    canEditParty: !closed,
    canEditStart: !closed && trip.status !== 'IN_DESTINATION',
    canEditLength: !closed,
    canEditPreferences: !closed,
    minTravelers: Math.max(1, ...live.map((b) => b.passengersCount || 0)),
    bookedDates: [...new Set(live.map((b) => b.scheduledDate).filter((d): d is string => Boolean(d)))].sort(),
    lastPlannedDay: Math.max(0, ...plans.map((i) => i.dayNumber)),
  };
}

const fail = (
  code: TripDetailsErrorCode,
  field: keyof TripDetailsPatch,
  message: string,
  params: Record<string, string | number> = {}
): TripDetailsError => ({ ok: false, code, field, params, message });

export function planTripDetailsUpdate(
  trip: PolicyTrip,
  items: PolicyItem[],
  bookings: PolicyBooking[],
  patch: TripDetailsPatch,
  today: string
): TripDetailsPlan | TripDetailsError {
  const rules = tripDetailsConstraints(trip, items, bookings);
  const changes: TripDetailsPlan['changes'] = {};

  if (patch.title !== undefined) {
    const title = patch.title.trim().replace(/\s+/g, ' ');
    if (title.length < TRIP_LIMITS.titleMin || title.length > TRIP_LIMITS.titleMax) {
      return fail('TITLE_LENGTH', 'title', `The trip name must be ${TRIP_LIMITS.titleMin}–${TRIP_LIMITS.titleMax} characters.`, {
        min: TRIP_LIMITS.titleMin,
        max: TRIP_LIMITS.titleMax,
      });
    }
    if (title !== trip.title) changes.title = title;
  }

  const closedFields = (['travelersCount', 'startDate', 'lengthDays', 'pace', 'budget'] as const).filter(
    (f) => patch[f] !== undefined
  );
  if (!rules.canEditParty && closedFields.length > 0) {
    return fail('TRIP_CLOSED', closedFields[0], 'This trip is closed; only its name can change.');
  }

  if (patch.travelersCount !== undefined && patch.travelersCount !== trip.travelersCount) {
    const n = patch.travelersCount;
    if (!Number.isInteger(n) || n < TRIP_LIMITS.travelersMin || n > TRIP_LIMITS.travelersMax) {
      return fail('TRAVELERS_RANGE', 'travelersCount', `Travelers must be between ${TRIP_LIMITS.travelersMin} and ${TRIP_LIMITS.travelersMax}.`, {
        min: TRIP_LIMITS.travelersMin,
        max: TRIP_LIMITS.travelersMax,
      });
    }
    if (n < rules.minTravelers) {
      return fail(
        'TRAVELERS_BELOW_BOOKED',
        'travelersCount',
        `A booking on this trip is for ${rules.minTravelers} people; change that booking first.`,
        { n: rules.minTravelers }
      );
    }
    changes.travelersCount = n;
  }

  if (patch.pace !== undefined && patch.pace !== trip.pace) changes.pace = patch.pace;
  if (patch.budget !== undefined && patch.budget !== trip.budget) changes.budget = patch.budget;

  const startChanges = patch.startDate !== undefined && patch.startDate !== trip.startDate;
  const lengthChanges = patch.lengthDays !== undefined && patch.lengthDays !== trip.lengthDays;
  const itemDays: TripDetailsPlan['itemDays'] = [];

  if (startChanges || lengthChanges) {
    if (startChanges && !rules.canEditStart) {
      return fail('DATES_LOCKED', 'startDate', 'The trip has started; its start date can no longer change.');
    }
    const length = patch.lengthDays ?? trip.lengthDays;
    if (!Number.isInteger(length) || length < TRIP_LIMITS.lengthMin || length > TRIP_LIMITS.lengthMax) {
      return fail('LENGTH_RANGE', 'lengthDays', `A trip runs ${TRIP_LIMITS.lengthMin}–${TRIP_LIMITS.lengthMax} days.`, {
        min: TRIP_LIMITS.lengthMin,
        max: TRIP_LIMITS.lengthMax,
      });
    }
    const start = patch.startDate ?? trip.startDate;
    if (startChanges && start! < today) {
      return fail('START_IN_PAST', 'startDate', 'The trip cannot start in the past.', { today });
    }

    if (start) {
      const end = addDays(start, length - 1);
      if (trip.status === 'IN_DESTINATION' && end < today) {
        return fail('END_IN_PAST', 'lengthDays', 'The trip cannot end before today.', { today });
      }
      const outside = rules.bookedDates.find((d) => d < start || d > end);
      if (outside) {
        return fail(
          'BOOKING_OUTSIDE_DATES',
          startChanges ? 'startDate' : 'lengthDays',
          `A booking on ${outside} would fall outside the trip; keep the dates around it or change that booking first.`,
          { date: outside }
        );
      }
      for (const item of items) {
        if (item.status === 'CANCELLED') continue;
        const booking = bookingOf(item, bookings.filter((b) => b.active));
        if (!booking?.scheduledDate) continue;
        const day = daysBetween(start, booking.scheduledDate) + 1;
        if (day !== item.dayNumber) itemDays.push({ id: item.id, dayNumber: day });
      }
      if (start !== trip.startDate) changes.startDate = start;
      if (end !== trip.endDate) changes.endDate = end;
    }

    if (rules.lastPlannedDay > length) {
      return fail(
        'PLANS_BEYOND_END',
        'lengthDays',
        `Day ${rules.lastPlannedDay} still has plans; remove or move them before shortening the trip.`,
        { day: rules.lastPlannedDay }
      );
    }
    if (length !== trip.lengthDays) changes.lengthDays = length;
  }

  return { ok: true, changes, itemDays };
}
