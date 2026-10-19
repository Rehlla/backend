import { describe, it, expect } from 'vitest';
import {
  isBookingLive,
  planTripDetailsUpdate,
  tripDetailsConstraints,
  type PolicyBooking,
  type PolicyItem,
  type PolicyTrip,
} from '../../src/shared/tripDetailsPolicy';

const TODAY = '2026-10-08';

const trip = (over: Partial<PolicyTrip> = {}): PolicyTrip => ({
  status: 'CONFIRMED',
  title: 'Eel Garden',
  travelersCount: 3,
  lengthDays: 1,
  startDate: '2026-10-09',
  endDate: '2026-10-09',
  pace: 'Balanced',
  budget: 'Moderate',
  ...over,
});

// The live trip from QA: two outings on 9 Oct, one of them for three people,
// and a stale day number left by the booking flow.
const items: PolicyItem[] = [
  { id: 'snorkel', dayNumber: 2, status: 'CONFIRMED', bookingId: 'B1' },
  { id: 'boat', dayNumber: 2, status: 'CONFIRMED', bookingId: 'B2' },
];
const bookings: PolicyBooking[] = [
  { id: 'B1', passengersCount: 3, scheduledDate: '2026-10-09', active: true },
  { id: 'B2', passengersCount: 2, scheduledDate: '2026-10-09', active: true },
];

const plan = (patch: Parameters<typeof planTripDetailsUpdate>[3], t = trip(), i = items, b = bookings) =>
  planTripDetailsUpdate(t, i, b, patch, TODAY);

describe('tripDetailsConstraints', () => {
  it('reads the floor and the booked days from live bookings only', () => {
    const rules = tripDetailsConstraints(trip(), items, [
      ...bookings,
      { id: 'B3', passengersCount: 8, scheduledDate: '2026-10-12', active: false },
    ]);
    expect(rules.minTravelers).toBe(3);
    expect(rules.bookedDates).toEqual(['2026-10-09']);
    expect(rules.lastPlannedDay).toBe(0);
  });

  it('locks the start once in Dahab and everything but the name once closed', () => {
    const inDahab = tripDetailsConstraints(trip({ status: 'IN_DESTINATION' }), items, bookings);
    expect(inDahab.canEditStart).toBe(false);
    expect(inDahab.canEditLength).toBe(true);

    const done = tripDetailsConstraints(trip({ status: 'COMPLETED' }), items, bookings);
    expect(done.canEditTitle).toBe(true);
    expect(done.canEditParty || done.canEditLength || done.canEditPreferences).toBe(false);
  });
});

describe('planTripDetailsUpdate', () => {
  it('renames, tidying the whitespace', () => {
    const result = plan({ title: '  Dahab   with friends ' });
    expect(result.ok && result.changes).toEqual({ title: 'Dahab with friends' });
  });

  it('refuses a name too short or too long', () => {
    expect(plan({ title: 'A' })).toMatchObject({ ok: false, code: 'TITLE_LENGTH' });
    expect(plan({ title: 'x'.repeat(81) })).toMatchObject({ ok: false, code: 'TITLE_LENGTH' });
  });

  it('grows the party freely but never below the largest booking', () => {
    expect(plan({ travelersCount: 5 })).toMatchObject({ ok: true, changes: { travelersCount: 5 } });
    expect(plan({ travelersCount: 2 })).toMatchObject({
      ok: false,
      code: 'TRAVELERS_BELOW_BOOKED',
      params: { n: 3 },
    });
    expect(plan({ travelersCount: 21 })).toMatchObject({ ok: false, code: 'TRAVELERS_RANGE' });
  });

  it('extends the trip and re-anchors booked outings to their booked day', () => {
    const result = plan({ startDate: '2026-10-08', lengthDays: 4 });
    expect(result).toMatchObject({
      ok: true,
      changes: { startDate: '2026-10-08', endDate: '2026-10-11', lengthDays: 4 },
    });
    // Booked on the 9th, the trip now starts on the 8th: day 2.
    expect(result.ok && result.itemDays).toEqual([]);

    const later = plan({ lengthDays: 3 });
    expect(later.ok && later.changes).toEqual({ endDate: '2026-10-11', lengthDays: 3 });
    // Starting on the 9th, both outings are on day 1, not the stale day 2.
    expect(later.ok && later.itemDays).toEqual([
      { id: 'snorkel', dayNumber: 1 },
      { id: 'boat', dayNumber: 1 },
    ]);
  });

  it('keeps every live booking inside the dates', () => {
    expect(plan({ startDate: '2026-10-10' })).toMatchObject({
      ok: false,
      code: 'BOOKING_OUTSIDE_DATES',
      params: { date: '2026-10-09' },
    });
    // A cancelled booking does not hold the dates in place.
    const cancelled = bookings.map((b) => ({ ...b, active: false }));
    const cancelledItems = items.map((i) => ({ ...i, status: 'CANCELLED' }));
    expect(plan({ startDate: '2026-10-10' }, trip(), cancelledItems, cancelled)).toMatchObject({ ok: true });
  });

  it('refuses a start in the past and a trip outside 1–30 days', () => {
    expect(plan({ startDate: '2026-10-07' })).toMatchObject({ ok: false, code: 'START_IN_PAST' });
    expect(plan({ lengthDays: 0 })).toMatchObject({ ok: false, code: 'LENGTH_RANGE' });
    expect(plan({ lengthDays: 31 })).toMatchObject({ ok: false, code: 'LENGTH_RANGE' });
  });

  it('will not strand unbooked plans past the last day', () => {
    const planned = trip({ status: 'PLANNED', lengthDays: 4, endDate: '2026-10-12' });
    const withPlans: PolicyItem[] = [{ id: 'idea', dayNumber: 4, status: 'SUGGESTED' }];
    expect(plan({ lengthDays: 3 }, planned, withPlans, [])).toMatchObject({
      ok: false,
      code: 'PLANS_BEYOND_END',
      params: { day: 4 },
    });
    // Moving the start carries unbooked plans along: no day numbers change.
    const moved = plan({ startDate: '2026-11-01' }, planned, withPlans, []);
    expect(moved).toMatchObject({ ok: true, changes: { startDate: '2026-11-01', endDate: '2026-11-04' } });
    expect(moved.ok && moved.itemDays).toEqual([]);
  });

  it('honours the lifecycle: started trips keep their start, closed trips only rename', () => {
    const inDahab = trip({ status: 'IN_DESTINATION', startDate: '2026-10-06', endDate: '2026-10-09', lengthDays: 4 });
    expect(plan({ startDate: '2026-10-08' }, inDahab)).toMatchObject({ ok: false, code: 'DATES_LOCKED' });
    expect(plan({ lengthDays: 6 }, inDahab)).toMatchObject({ ok: true, changes: { lengthDays: 6 } });
    expect(plan({ lengthDays: 2 }, inDahab, [], [])).toMatchObject({ ok: false, code: 'END_IN_PAST' });

    const done = trip({ status: 'COMPLETED' });
    expect(plan({ travelersCount: 4 }, done)).toMatchObject({ ok: false, code: 'TRIP_CLOSED' });
    expect(plan({ title: 'Our Dahab week' }, done)).toMatchObject({ ok: true });
  });

  it('changes pace and budget, and reports nothing when nothing changed', () => {
    expect(plan({ pace: 'Relaxed', budget: 'Premium' })).toMatchObject({
      ok: true,
      changes: { pace: 'Relaxed', budget: 'Premium' },
    });
    expect(plan({ title: 'Eel Garden', travelersCount: 3 })).toEqual({ ok: true, changes: {}, itemDays: [] });
  });
});

describe('isBookingLive', () => {
  it('treats cancelled, rejected and refunded bookings as no longer binding', () => {
    expect(isBookingLive('PENDING_CONFIRMATION', 'PENDING')).toBe(true);
    expect(isBookingLive('CONFIRMED', 'CAPTURED')).toBe(true);
    expect(isBookingLive('CANCELLED', 'PENDING')).toBe(false);
    expect(isBookingLive('REJECTED', 'PENDING')).toBe(false);
    expect(isBookingLive('CONFIRMED', 'REFUNDED')).toBe(false);
  });
});
