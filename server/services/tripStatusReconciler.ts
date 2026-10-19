import { db } from '../db/database';
import { TripEntity, TripItemEntity } from '../db/schema';

/**
 * Moving a trip through its own lifecycle.
 *
 * `PATCH /api/trips/:tripId/status` has validated transitions since it was
 * written and **nothing has ever called it** — not the checkout, not the
 * frontend, nothing. Every trip in the store therefore sits at the status it
 * was created with, forever. A traveler who has paid for a dive still has a
 * PLANNED trip; the day they land in Dahab changes nothing; the day they fly
 * home changes nothing.
 *
 * That single frozen field is what keeps most of the product asleep. The
 * pre-arrival briefing, the arrival flow, the first-two-hours guide, the daily
 * companion, departure and post-trip are all built and all reachable only by
 * someone who knows the URL, because the thing that should surface them —
 * where the traveler is in their trip — never moves.
 *
 * Status is derived here rather than pushed by the client, for one reason: a
 * trip must become IN_DESTINATION on the morning it starts whether or not
 * anybody opened the app. A client-pushed transition cannot promise that.
 */

/** Dahab's calendar date. Cairo observes DST, so the offset is not fixed. */
export function dahabToday(now: Date = new Date()): string {
  // en-CA renders as YYYY-MM-DD, which is the format trips store dates in and
  // which compares correctly as a plain string.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/** A line the traveler has actually committed to, rather than merely planned. */
const isCommitted = (item: TripItemEntity): boolean =>
  (item.status === 'BOOKED' || item.status === 'CONFIRMED') && Boolean(item.bookingId);

/**
 * The status this trip should be at, given what is stored about it.
 *
 * Pure, and only ever moves forward: COMPLETED and CANCELLED are terminal, and
 * nothing here can send a trip backwards. Called repeatedly until it settles,
 * so a trip whose dates passed while nobody was looking catches up in one go.
 *
 * A trip with no dates stops at CONFIRMED on purpose. Without a start date
 * there is no honest basis for saying the traveler has arrived, and guessing
 * would put someone into the arrival flow for a trip that has not begun.
 */
export function deriveTripStatus(
  trip: TripEntity,
  items: TripItemEntity[],
  today: string = dahabToday()
): TripEntity['status'] {
  let status = trip.status;

  // Terminal. A cancelled trip is not resurrected by a stray booking, and a
  // completed one is not reopened by the clock.
  if (status === 'CANCELLED' || status === 'COMPLETED') return status;

  for (;;) {
    if (status === 'DRAFT') {
      if (items.length === 0) return status;
      status = 'PLANNED';
      continue;
    }

    if (status === 'PLANNED') {
      // Money has been committed against at least one line. That is what
      // separates a plan from a trip that is going to happen.
      if (!items.some(isCommitted)) return status;
      status = 'CONFIRMED';
      continue;
    }

    if (status === 'CONFIRMED') {
      if (!trip.startDate || today < trip.startDate) return status;
      status = 'IN_DESTINATION';
      continue;
    }

    if (status === 'IN_DESTINATION') {
      // The trip is over when its last day is over, not when every supplier
      // has got round to marking their booking complete — otherwise one
      // forgetful dive centre keeps a traveler "in destination" indefinitely.
      if (!trip.endDate || today <= trip.endDate) return status;
      status = 'COMPLETED';
      continue;
    }

    return status;
  }
}

export interface TripStatusReconciliation {
  trip: TripEntity;
  changed: boolean;
  from: TripEntity['status'];
  to: TripEntity['status'];
}

/**
 * Brings one trip's status in line with its own facts, writing only on change.
 *
 * Safe to call on every read of a trip: the derivation is a handful of string
 * comparisons, and a trip already at the right status costs nothing.
 */
export function reconcileTripStatus(
  tripId: string,
  actorId: string = 'system',
  now: Date = new Date()
): TripStatusReconciliation | null {
  const trip = db.trips.find(t => t.id === tripId);
  if (!trip) return null;

  const items = db.tripItems.filter(i => i.tripId === tripId);
  const from = trip.status;
  const to = deriveTripStatus(trip, items, dahabToday(now));

  if (to === from) return { trip, changed: false, from, to };

  trip.status = to;
  trip.updatedAt = now.toISOString();

  db.logAudit(actorId, 'System', 'TRIP_STATUS_CHANGED', 'Trip', tripId, {
    from,
    to,
    reason: 'derived from trip dates and committed bookings'
  });

  return { trip, changed: true, from, to };
}

/** Reconciles every trip belonging to one traveler. Used on the trips list. */
export function reconcileTripsForUser(userId: string, now: Date = new Date()): number {
  let changed = 0;
  for (const trip of db.trips.filter(t => t.userId === userId)) {
    const result = reconcileTripStatus(trip.id, userId, now);
    if (result?.changed) changed += 1;
  }
  return changed;
}
