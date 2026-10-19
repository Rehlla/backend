import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/db/database';
import {
  dahabToday,
  deriveTripStatus,
  reconcileTripStatus
} from '../../server/services/tripStatusReconciler';
import { journeyStageFromTrip } from '../../src/services/travelerLifecycleResolver';
import { resetDb } from '../helpers/fixtures';
import type { TripEntity, TripItemEntity } from '../../server/db/schema';

/**
 * A trip has to move through its own life.
 *
 * `PATCH /api/trips/:tripId/status` validated transitions from the day it was
 * written and had zero callers, so every trip sat at the status it was created
 * with forever: paying for a dive did not confirm the trip, landing in Dahab
 * did not start it, and flying home did not end it. Six built surfaces — the
 * briefing, arrival, the first two hours, the daily companion, departure and
 * post-trip — were unreachable as a result.
 */

const trip = (over: Partial<TripEntity> = {}): TripEntity => ({
  id: 'TRIP-1',
  userId: 'USR-1',
  title: 'Dahab trip',
  status: 'PLANNED',
  lengthDays: 5,
  travelersCount: 2,
  budget: 'Moderate',
  pace: 'Balanced',
  interests: [],
  startDate: '2026-09-10',
  endDate: '2026-09-14',
  totalEstimatedEGP: 0,
  totalPaidEGP: 0,
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over
});

const item = (over: Partial<TripItemEntity> = {}): TripItemEntity => ({
  id: 'ITEM-1',
  tripId: 'TRIP-1',
  serviceType: 'diving',
  skuId: 'SKU-DIV-002',
  title: 'Blue Hole',
  dayNumber: 2,
  timeSlot: '09:00 AM',
  priceEGP: 3400,
  status: 'SUGGESTED',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  ...over
});

const booked = () => item({ status: 'CONFIRMED', bookingId: 'DHB-DIV-1' });

describe('deriveTripStatus', () => {
  it('leaves a plan alone until something is actually booked', () => {
    expect(deriveTripStatus(trip(), [item()], '2026-09-01')).toBe('PLANNED');
  });

  it('confirms the trip once a line carries a real booking', () => {
    expect(deriveTripStatus(trip(), [booked()], '2026-09-01')).toBe('CONFIRMED');
  });

  it('does not confirm on a line that is merely marked booked with no booking behind it', () => {
    const halfway = item({ status: 'BOOKED', bookingId: undefined });
    expect(deriveTripStatus(trip(), [halfway], '2026-09-01')).toBe('PLANNED');
  });

  it('starts the trip on its first morning, without anyone opening the app', () => {
    expect(deriveTripStatus(trip({ status: 'CONFIRMED' }), [booked()], '2026-09-10'))
      .toBe('IN_DESTINATION');
  });

  it('does not start the trip the day before', () => {
    expect(deriveTripStatus(trip({ status: 'CONFIRMED' }), [booked()], '2026-09-09'))
      .toBe('CONFIRMED');
  });

  it('keeps the trip running on its last day', () => {
    expect(deriveTripStatus(trip({ status: 'IN_DESTINATION' }), [booked()], '2026-09-14'))
      .toBe('IN_DESTINATION');
  });

  it('completes the trip once its last day is over', () => {
    expect(deriveTripStatus(trip({ status: 'IN_DESTINATION' }), [booked()], '2026-09-15'))
      .toBe('COMPLETED');
  });

  it('catches a long-neglected trip up in one pass', () => {
    // Booked in advance, nobody opened the app, and the whole trip has been and
    // gone. It must not be stuck at PLANNED.
    expect(deriveTripStatus(trip({ status: 'PLANNED' }), [booked()], '2026-10-01'))
      .toBe('COMPLETED');
  });

  it('promotes a draft once it has anything in it', () => {
    expect(deriveTripStatus(trip({ status: 'DRAFT' }), [item()], '2026-09-01')).toBe('PLANNED');
    expect(deriveTripStatus(trip({ status: 'DRAFT' }), [], '2026-09-01')).toBe('DRAFT');
  });

  it('stops at CONFIRMED when the trip has no dates, rather than guessing', () => {
    const undated = trip({ status: 'CONFIRMED', startDate: undefined, endDate: undefined });
    expect(deriveTripStatus(undated, [booked()], '2026-12-31')).toBe('CONFIRMED');
  });

  it('never revives a cancelled trip', () => {
    expect(deriveTripStatus(trip({ status: 'CANCELLED' }), [booked()], '2026-09-12'))
      .toBe('CANCELLED');
  });

  it('never reopens a completed trip', () => {
    expect(deriveTripStatus(trip({ status: 'COMPLETED' }), [booked()], '2026-09-12'))
      .toBe('COMPLETED');
  });

  it('never moves a trip backwards', () => {
    // The defect this replaces: checkout set `trip.status = 'CONFIRMED'`
    // unconditionally, so a traveler already in Dahab who booked a massage was
    // dropped out of the in-destination experience.
    expect(deriveTripStatus(trip({ status: 'IN_DESTINATION' }), [booked()], '2026-09-12'))
      .toBe('IN_DESTINATION');
  });
});

describe('reconcileTripStatus', () => {
  beforeEach(() => {
    resetDb();
  });

  it('writes the new status and records why', () => {
    db.trips.push(trip({ status: 'PLANNED' }));
    db.tripItems.push(booked());

    const result = reconcileTripStatus('TRIP-1', 'USR-1', new Date('2026-09-01T09:00:00Z'));

    expect(result?.changed).toBe(true);
    expect(result?.from).toBe('PLANNED');
    expect(result?.to).toBe('CONFIRMED');
    expect(db.trips[0].status).toBe('CONFIRMED');
    expect(db.auditEvents.some(e => e.action === 'TRIP_STATUS_CHANGED')).toBe(true);
  });

  it('writes nothing when the trip is already where it should be', () => {
    db.trips.push(trip({ status: 'PLANNED' }));
    db.tripItems.push(item());
    const before = db.auditEvents.length;

    const result = reconcileTripStatus('TRIP-1', 'USR-1', new Date('2026-09-01T09:00:00Z'));

    expect(result?.changed).toBe(false);
    expect(db.auditEvents).toHaveLength(before);
  });

  it('returns null for a trip that does not exist', () => {
    expect(reconcileTripStatus('TRIP-NOPE')).toBeNull();
  });

  it('does not let one trip advance on another trip’s bookings', () => {
    db.trips.push(trip({ id: 'TRIP-A', status: 'PLANNED' }));
    db.trips.push(trip({ id: 'TRIP-B', status: 'PLANNED' }));
    db.tripItems.push(item({ id: 'ITEM-A', tripId: 'TRIP-A', status: 'CONFIRMED', bookingId: 'DHB-1' }));

    reconcileTripStatus('TRIP-B', 'USR-1', new Date('2026-09-01T09:00:00Z'));

    expect(db.trips.find(t => t.id === 'TRIP-B')!.status).toBe('PLANNED');
  });
});

describe('dahabToday', () => {
  it('reads the calendar date in Dahab, not UTC', () => {
    // 22:30 UTC on the 9th is already the 10th in Cairo (UTC+2/+3), and a trip
    // starting on the 10th should begin.
    expect(dahabToday(new Date('2026-09-09T22:30:00Z'))).toBe('2026-09-10');
  });

  it('formats as YYYY-MM-DD, which is what trips store and how they compare', () => {
    expect(dahabToday(new Date('2026-09-10T09:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('journeyStageFromTrip', () => {
  it('treats someone with no trip as discovering', () => {
    expect(journeyStageFromTrip(null)).toBe('discover');
  });

  it('sends a booked-but-not-yet-travelling traveler to prepare', () => {
    expect(journeyStageFromTrip({ status: 'CONFIRMED' }, '2026-09-01')).toBe('prepare');
  });

  it('distinguishes arrival day from the rest of the trip', () => {
    const inDahab = { status: 'IN_DESTINATION', startDate: '2026-09-10', endDate: '2026-09-14' };
    expect(journeyStageFromTrip(inDahab, '2026-09-10')).toBe('arrive');
    expect(journeyStageFromTrip(inDahab, '2026-09-12')).toBe('experience');
  });

  it('sends a finished trip to post-trip', () => {
    expect(journeyStageFromTrip({ status: 'COMPLETED' }, '2026-09-20')).toBe('post_trip');
  });

  it('does not leave a cancelled trip claiming a stage', () => {
    expect(journeyStageFromTrip({ status: 'CANCELLED' }, '2026-09-12')).toBe('discover');
  });
});
