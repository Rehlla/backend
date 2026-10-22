import type { AppRoute } from '../types';
import type {
  TravelerLifecyclePhase,
  TravelerLifecycleSnapshot
} from './travelerLifecycleResolver';

/**
 * The homepage's "what do I do next" gate — one decision, one card.
 *
 * The homepage used to render the same marketing hero to every visitor: a
 * traveler standing in Dahab with an activity running saw what a first-time
 * anonymous visitor sees. `TripContext.lifecycle` already knows where the
 * traveler is (it drives arrival, the daily companion, departure and
 * post-trip) but the homepage never read it.
 *
 * This module is the whole decision, and it is pure: no React, no DOM, no
 * fetch, no clock. `resolveHomeNextStep` turns the lifecycle snapshot into
 * copy keys and two REAL routes, so every branch is unit-testable without a
 * browser and the view layer has nothing left to decide.
 *
 * Two rules it enforces by construction:
 *
 * 1. Routes are not invented here. Every value below exists as a `case` in
 *    App.tsx's router, and tests/domain/homeNextStep.test.ts reads that file
 *    and fails if one disappears — a dead CTA is worse than no CTA.
 * 2. No numbers are invented. `liveValue` carries only values the app already
 *    holds for this traveler (their running/next activity from the traveler
 *    context, else their real trip title) and the field is OMITTED when
 *    neither exists, so the card never shows a fabricated reading.
 */

export interface HomeNextStep {
  /** The lifecycle phase this card is for — also the `data-nextstep` hook. */
  mode: TravelerLifecyclePhase;
  eyebrowKey: string;
  titleKey: string;
  bodyKey: string;
  primaryKey: string;
  primaryRoute: AppRoute;
  secondaryKey?: string;
  secondaryRoute?: AppRoute;
  /**
   * A real reading for this traveler, or absent. Never a placeholder: the
   * view renders the chip only when this is present.
   */
  liveValue?: string;
}

export interface HomeNextStepContext {
  /** The traveler's real trip, when they have one. Read-only here. */
  activeTrip?: { title?: string | null } | null;
  /** Bookings the operator has not confirmed yet. */
  pendingBookings?: number;
}

interface PhaseCopy {
  eyebrowKey: string;
  titleKey: string;
  bodyKey: string;
  primaryKey: string;
  primaryRoute: AppRoute;
  secondaryKey: string;
  secondaryRoute: AppRoute;
}

const COPY: Record<TravelerLifecyclePhase, PhaseCopy> = {
  // مجهول — جديد على دهب، لسه مفيش رحلة.
  DISCOVERY: {
    eyebrowKey: 'home.nextStep.discovery.eyebrow',
    titleKey: 'home.nextStep.discovery.title',
    bodyKey: 'home.nextStep.discovery.body',
    primaryKey: 'home.nextStep.discovery.primary',
    primaryRoute: '/trip-builder',
    secondaryKey: 'home.nextStep.discovery.secondary',
    secondaryRoute: '/explore'
  },
  // مسودة — عنده رحلة بدأها ولسه مكمّلهاش.
  BOOKING: {
    eyebrowKey: 'home.nextStep.booking.eyebrow',
    titleKey: 'home.nextStep.booking.title',
    bodyKey: 'home.nextStep.booking.body',
    primaryKey: 'home.nextStep.booking.primary',
    primaryRoute: '/trip-builder',
    secondaryKey: 'home.nextStep.booking.secondary',
    secondaryRoute: '/my-trip'
  },
  // محجوز — الرحلة مؤكدة وقبل السفر.
  PRE_TRIP: {
    eyebrowKey: 'home.nextStep.preTrip.eyebrow',
    titleKey: 'home.nextStep.preTrip.title',
    bodyKey: 'home.nextStep.preTrip.body',
    primaryKey: 'home.nextStep.preTrip.primary',
    primaryRoute: '/my-trip',
    secondaryKey: 'home.nextStep.preTrip.secondary',
    secondaryRoute: '/help'
  },
  IN_TRANSIT: {
    eyebrowKey: 'home.nextStep.inTransit.eyebrow',
    titleKey: 'home.nextStep.inTransit.title',
    bodyKey: 'home.nextStep.inTransit.body',
    primaryKey: 'home.nextStep.inTransit.primary',
    primaryRoute: '/my-trip',
    secondaryKey: 'home.nextStep.inTransit.secondary',
    secondaryRoute: '/first-two-hours'
  },
  ARRIVAL: {
    eyebrowKey: 'home.nextStep.arrival.eyebrow',
    titleKey: 'home.nextStep.arrival.title',
    bodyKey: 'home.nextStep.arrival.body',
    primaryKey: 'home.nextStep.arrival.primary',
    primaryRoute: '/arrive',
    secondaryKey: 'home.nextStep.arrival.secondary',
    secondaryRoute: '/first-two-hours'
  },
  IN_DAHAB: {
    eyebrowKey: 'home.nextStep.inDahab.eyebrow',
    titleKey: 'home.nextStep.inDahab.title',
    bodyKey: 'home.nextStep.inDahab.body',
    primaryKey: 'home.nextStep.inDahab.primary',
    primaryRoute: '/my-trip',
    secondaryKey: 'home.nextStep.inDahab.secondary',
    secondaryRoute: '/explore'
  },
  ACTIVE_TRIP: {
    eyebrowKey: 'home.nextStep.activeTrip.eyebrow',
    titleKey: 'home.nextStep.activeTrip.title',
    bodyKey: 'home.nextStep.activeTrip.body',
    primaryKey: 'home.nextStep.activeTrip.primary',
    primaryRoute: '/my-trip',
    secondaryKey: 'home.nextStep.activeTrip.secondary',
    secondaryRoute: '/food'
  },
  DISRUPTED: {
    eyebrowKey: 'home.nextStep.disrupted.eyebrow',
    titleKey: 'home.nextStep.disrupted.title',
    bodyKey: 'home.nextStep.disrupted.body',
    primaryKey: 'home.nextStep.disrupted.primary',
    primaryRoute: '/change-recovery',
    secondaryKey: 'home.nextStep.disrupted.secondary',
    secondaryRoute: '/help'
  },
  DEPARTURE: {
    eyebrowKey: 'home.nextStep.departure.eyebrow',
    titleKey: 'home.nextStep.departure.title',
    bodyKey: 'home.nextStep.departure.body',
    primaryKey: 'home.nextStep.departure.primary',
    primaryRoute: '/departure',
    secondaryKey: 'home.nextStep.departure.secondary',
    secondaryRoute: '/my-trip'
  },
  POST_TRIP: {
    eyebrowKey: 'home.nextStep.postTrip.eyebrow',
    titleKey: 'home.nextStep.postTrip.title',
    bodyKey: 'home.nextStep.postTrip.body',
    primaryKey: 'home.nextStep.postTrip.primary',
    primaryRoute: '/post-trip',
    secondaryKey: 'home.nextStep.postTrip.secondary',
    secondaryRoute: '/trip-builder'
  }
};

/** Trims to a display value, or undefined so the field is truly absent. */
const reading = (value: string | null | undefined): string | undefined => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

export function resolveHomeNextStep(
  lifecycle: TravelerLifecycleSnapshot,
  context: HomeNextStepContext = {}
): HomeNextStep {
  const base = COPY[lifecycle.lifecyclePhase];
  // "Everything is set" is only true once every operator has confirmed.
  const copy =
    lifecycle.lifecyclePhase === 'PRE_TRIP' && (context.pendingBookings ?? 0) > 0
      ? { ...base, titleKey: 'home.nextStep.preTrip.titlePending', bodyKey: 'home.nextStep.preTrip.bodyPending' }
      : base;

  // The traveler's running/next activity outranks the trip title: it is the
  // more specific fact, and both come from data the app already holds.
  const liveValue =
    reading(lifecycle.activeActivityTitle) ?? reading(context.activeTrip?.title);

  return {
    mode: lifecycle.lifecyclePhase,
    eyebrowKey: copy.eyebrowKey,
    titleKey: copy.titleKey,
    bodyKey: copy.bodyKey,
    primaryKey: copy.primaryKey,
    primaryRoute: copy.primaryRoute,
    secondaryKey: copy.secondaryKey,
    secondaryRoute: copy.secondaryRoute,
    ...(liveValue ? { liveValue } : {})
  };
}
