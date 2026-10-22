import {
  JourneyStage,
  TravelerProfile,
  TimelineDay,
  ConfirmedBookingItem,
  TransferTrackingRecord
} from '../types';
import { SingleTravelerContext } from '../types/travelerContext';

// ============================================================================
// 1. TRAVELER LIFECYCLE PHASES
// Represents the real-world temporal and operational position of the traveler.
// ============================================================================

export type TravelerLifecyclePhase =
  | 'DISCOVERY'
  | 'BOOKING'
  | 'PRE_TRIP'
  | 'IN_TRANSIT'
  | 'ARRIVAL'
  | 'IN_DAHAB'
  | 'ACTIVE_TRIP'
  | 'DISRUPTED'
  | 'DEPARTURE'
  | 'POST_TRIP';

// ============================================================================
// 2. CONTEXTUAL ENUMS
// ============================================================================

export type LocationContextState =
  | 'UNKNOWN'
  | 'OUTSIDE_DAHAB'
  | 'APPROACHING_DAHAB'
  | 'IN_TRANSIT'
  | 'ARRIVED_DAHAB'
  | 'IN_DAHAB'
  | 'LEAVING_DAHAB';

export type BookingContextState =
  | 'NO_BOOKING'
  | 'PLANNING'
  | 'HOLD_ACTIVE'
  | 'BOOKING_CONFIRMED'
  | 'SUPPLIER_PENDING'
  | 'BOOKING_FAILED'
  | 'RECOVERY_REQUIRED'
  | 'COMPLETED';

export type TimeContextState =
  | 'BEFORE_TRIP'
  | 'TRIP_DAY'
  | 'EARLY_MORNING'
  | 'MORNING'
  | 'MIDDAY'
  | 'AFTERNOON'
  | 'SUNSET'
  | 'EVENING'
  | 'LATE_NIGHT';

export interface LocationSignal {
  state: LocationContextState;
  source: 'GPS_HARDWARE' | 'TRANSFER_TELEMETRY' | 'CHECKIN_SIGNAL' | 'INFERRED_SCHEDULE' | 'UNKNOWN';
  confidence: number; // 0.0 to 1.0
  freshness: 'LIVE' | 'RECENT' | 'STALE' | 'UNKNOWN';
  lastObserved?: string;
}

export interface TravelerLifecycleSnapshot {
  lifecyclePhase: TravelerLifecyclePhase;
  locationSignal: LocationSignal;
  bookingState: BookingContextState;
  timeContext: TimeContextState;
  isDisrupted: boolean;
  hasActiveActivity: boolean;
  activeActivityTitle?: string;
  activeActivityTitleAr?: string;
  hasRecentFinishedActivity: boolean;
  recentActivityTitle?: string;
  freeWindowMinutes: number;
  explanation: string;
}

// ============================================================================
// 2b. WHERE THE TRAVELER ACTUALLY IS
// ============================================================================

/** Dahab's calendar date, matching how trips store startDate/endDate. */
export function dahabToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
}

/**
 * The traveler's stage, read from their trip.
 *
 * `journeyStage` used to be set from `currentRoute` — opening /home made you
 * 'discover', opening /departure made you 'departure'. That is which page is
 * open, not where anybody is in their trip, and since the whole lifecycle
 * resolver below keys off this value, the entire notion of "where the traveler
 * is" was really just "what they last clicked". A traveler standing in Dahab
 * who tapped Home became a discovery-mode visitor.
 *
 * The trip is the honest source: its status is now advanced server-side from
 * committed bookings and its own dates (see server/services/tripStatusReconciler).
 */
export function journeyStageFromTrip(
  trip: { status: string; startDate?: string; endDate?: string } | null | undefined,
  today: string = dahabToday()
): JourneyStage {
  if (!trip) return 'discover';

  switch (trip.status) {
    case 'DRAFT':
      return 'plan';
    case 'PLANNED':
      // There is a plan; what it needs next is to be booked.
      return 'book';
    case 'CONFIRMED':
      // Booked and not yet travelling. The trip only leaves CONFIRMED on the
      // morning it starts, so this always means "before departure".
      return 'prepare';
    case 'IN_DESTINATION':
      // The first day is its own thing — airport transfer, check-in, the first
      // two hours — and the rest of the trip is not.
      return trip.startDate && today === trip.startDate ? 'arrive' : 'experience';
    case 'COMPLETED':
      return 'post_trip';
    case 'CANCELLED':
    default:
      return 'discover';
  }
}

// ============================================================================
// 3. DETERMINISTIC LIFECYCLE RESOLVER
// ============================================================================

export function deriveTravelerLifecycle(params: {
  journeyStage: JourneyStage;
  profile?: TravelerProfile;
  tripDays?: TimelineDay[];
  bookings?: ConfirmedBookingItem[];
  transferTracking?: TransferTrackingRecord;
  travelerContext?: SingleTravelerContext;
  hasDisruption?: boolean;
  isAuthenticated?: boolean;
  isTestMode?: boolean;
}): TravelerLifecycleSnapshot {
  const {
    journeyStage,
    bookings = [],
    transferTracking,
    travelerContext,
    hasDisruption = false,
    isAuthenticated = false,
    isTestMode = false
  } = params;

  // 0. Strict Anonymous Isolation: Unauthenticated visitors without explicit test mode get PUBLIC DISCOVERY
  if (!isAuthenticated && !isTestMode) {
    return {
      lifecyclePhase: 'DISCOVERY',
      locationSignal: {
        state: 'OUTSIDE_DAHAB',
        source: 'UNKNOWN',
        confidence: 0.1,
        freshness: 'UNKNOWN'
      },
      bookingState: 'NO_BOOKING',
      timeContext: 'BEFORE_TRIP',
      isDisrupted: false,
      hasActiveActivity: false,
      hasRecentFinishedActivity: false,
      freeWindowMinutes: 0,
      explanation: 'Public anonymous session: strict isolation enforced. Zero private trip, booking, or schedule state exposed.'
    };
  }

  // 1. Check Disruption condition (highest operational override)
  // Boolean(...) because `x?.y && y.some(...)` evaluates to `undefined` — not
  // `false` — when safetyContext is unset, and this value is returned in a
  // snapshot field declared as `boolean`.
  const isDisrupted = Boolean(
    hasDisruption ||
    journeyStage === 'recovery' ||
    travelerContext?.safetyContext?.some(s => s.status === 'CRITICAL_BLOCK')
  );

  // 2. Classify Booking State
  let bookingState: BookingContextState = 'NO_BOOKING';
  if (bookings.length > 0) {
    const hasFailed = bookings.some(b => b.status === 'Changed');
    if (hasFailed) {
      bookingState = 'BOOKING_FAILED';
    } else {
      bookingState = 'BOOKING_CONFIRMED';
    }
  } else if (journeyStage === 'plan' || journeyStage === 'preview') {
    bookingState = 'PLANNING';
  } else if (journeyStage === 'post_trip') {
    bookingState = 'COMPLETED';
  }

  // 3. Classify Location Signal
  let locationSignal: LocationSignal = {
    state: 'UNKNOWN',
    source: 'UNKNOWN',
    confidence: 0.2,
    freshness: 'UNKNOWN'
  };

  const isTransferActive =
    transferTracking &&
    (transferTracking.status === 'DISPATCHED' ||
      transferTracking.status === 'AT_AIRPORT' ||
      transferTracking.status === 'PASSENGER_PICKED_UP');

  if (isTransferActive) {
    locationSignal = {
      state: 'APPROACHING_DAHAB',
      source: 'TRANSFER_TELEMETRY',
      confidence: 0.95,
      freshness: 'LIVE',
      lastObserved: transferTracking?.lastGpsUpdate
    };
  } else if (journeyStage === 'arrive') {
    locationSignal = {
      state: 'ARRIVED_DAHAB',
      source: 'CHECKIN_SIGNAL',
      confidence: 0.9,
      freshness: 'LIVE'
    };
  } else if (
    journeyStage === 'experience' ||
    journeyStage === 'spontaneous' ||
    journeyStage === 'food' ||
    journeyStage === 'recovery' ||
    journeyStage === 'help'
  ) {
    locationSignal = {
      state: 'IN_DAHAB',
      source: 'INFERRED_SCHEDULE',
      confidence: 0.85,
      freshness: 'RECENT'
    };
  } else if (journeyStage === 'departure') {
    locationSignal = {
      state: 'LEAVING_DAHAB',
      source: 'INFERRED_SCHEDULE',
      confidence: 0.9,
      freshness: 'LIVE'
    };
  } else if (journeyStage === 'discover' || journeyStage === 'plan' || journeyStage === 'preview' || journeyStage === 'prepare') {
    locationSignal = {
      state: 'OUTSIDE_DAHAB',
      source: 'INFERRED_SCHEDULE',
      confidence: 0.8,
      freshness: 'RECENT'
    };
  }

  // 4. Classify Time Context
  const hour = new Date().getHours();
  let timeContext: TimeContextState = 'MIDDAY';
  if (journeyStage === 'discover' || journeyStage === 'plan' || journeyStage === 'preview' || journeyStage === 'prepare') {
    timeContext = 'BEFORE_TRIP';
  } else if (hour >= 5 && hour < 8) {
    timeContext = 'EARLY_MORNING';
  } else if (hour >= 8 && hour < 12) {
    timeContext = 'MORNING';
  } else if (hour >= 12 && hour < 15) {
    timeContext = 'MIDDAY';
  } else if (hour >= 15 && hour < 17) {
    timeContext = 'AFTERNOON';
  } else if (hour >= 17 && hour < 19) {
    timeContext = 'SUNSET';
  } else if (hour >= 19 && hour < 23) {
    timeContext = 'EVENING';
  } else {
    timeContext = 'LATE_NIGHT';
  }

  // 5. Activity context
  const freeWindowMinutes = travelerContext?.availability?.freeWindowMinutes ?? 120;
  const hasActiveActivity =
    travelerContext?.availability?.nextActivityTime?.includes('Active') ||
    journeyStage === 'experience' && freeWindowMinutes < 45;
  const activeActivityTitle = travelerContext?.availability?.nextActivityTitle;
  const activeActivityTitleAr = travelerContext?.availability?.nextActivityTitleAr;
  const hasRecentFinishedActivity = journeyStage === 'spontaneous' || (journeyStage === 'food' && freeWindowMinutes >= 90);

  // 6. Derive Canonical TravelerLifecyclePhase
  let lifecyclePhase: TravelerLifecyclePhase = 'DISCOVERY';

  if (isDisrupted) {
    lifecyclePhase = 'DISRUPTED';
  } else if (journeyStage === 'post_trip') {
    lifecyclePhase = 'POST_TRIP';
  } else if (journeyStage === 'departure') {
    lifecyclePhase = 'DEPARTURE';
  } else if (isTransferActive) {
    lifecyclePhase = 'IN_TRANSIT';
  } else if (journeyStage === 'arrive' || locationSignal.state === 'ARRIVED_DAHAB') {
    lifecyclePhase = 'ARRIVAL';
  } else if (hasActiveActivity) {
    lifecyclePhase = 'ACTIVE_TRIP';
  } else if (
    journeyStage === 'experience' ||
    journeyStage === 'spontaneous' ||
    journeyStage === 'food' ||
    journeyStage === 'help' ||
    locationSignal.state === 'IN_DAHAB'
  ) {
    lifecyclePhase = 'IN_DAHAB';
  } else if (journeyStage === 'prepare' || (bookings.length > 0 && locationSignal.state === 'OUTSIDE_DAHAB')) {
    lifecyclePhase = 'PRE_TRIP';
  } else if (journeyStage === 'plan' || journeyStage === 'preview') {
    lifecyclePhase = 'BOOKING';
  } else {
    lifecyclePhase = 'DISCOVERY';
  }

  const explanation = `Lifecycle derived as ${lifecyclePhase} from journeyStage=${journeyStage}, bookings=${bookings.length}, isDisrupted=${isDisrupted}, locationState=${locationSignal.state}`;

  return {
    lifecyclePhase,
    locationSignal,
    bookingState,
    timeContext,
    isDisrupted,
    hasActiveActivity: Boolean(hasActiveActivity),
    activeActivityTitle,
    activeActivityTitleAr,
    hasRecentFinishedActivity,
    recentActivityTitle: activeActivityTitle,
    freeWindowMinutes,
    explanation
  };
}
