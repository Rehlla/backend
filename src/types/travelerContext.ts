import { AppRoute, ConfirmedBookingItem, TimelineDay, TravelerProfile } from '../types';
import { TripBrief } from '../types/tripOs';
import { LiveDahabConditions, DahabAreaId } from '../types/dahabContext';

export type TravelerJourneyPhase =
  | 'ARRIVE'
  | 'SETTLE'
  | 'DISCOVER'
  | 'BOOK'
  | 'EAT'
  | 'MOVE'
  | 'EXPERIENCE'
  | 'ADAPT'
  | 'RECOVER'
  | 'DEPART';

export type NextBestActionType =
  | 'Continue trip'
  | 'Book now'
  | 'Confirm supplier'
  | 'Get food'
  | 'Prepare for activity'
  | 'Resolve conflict'
  | 'Choose recovery'
  | 'Head to pickup'
  | 'Start offline pack';

export interface TrustBadgeProvenance {
  badgeId: string;
  label: string;
  labelAr: string;
  source: string;
  verificationAuthority: string;
  verifiedAt: string;
  expirationDate: string;
  status: 'VERIFIED' | 'REQUIRES_VERIFICATION' | 'SOURCE_BACKED';
  evidenceSummary: string;
  evidenceSummaryAr: string;
}

export interface DynamicDataRecord<T> {
  data: T;
  source: string;
  observedAt: string;
  freshness: 'Live (<15m)' | 'Fresh (<1h)' | 'Aging (1-4h)' | 'Stale (>4h)';
  status: 'OPERATIONAL' | 'DEGRADED' | 'REQUIRES_VERIFICATION';
}

export interface NextBestAction {
  id: string;
  type: NextBestActionType;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  actionLabel: string;
  actionLabelAr: string;
  targetRoute: AppRoute;
  targetParams?: Record<string, any>;
  reason: string;
  reasonAr: string;
  badge?: TrustBadgeProvenance;
  payload?: any;
}

export interface SafetyContextItem {
  id: string;
  type: 'NO_FLY' | 'WEATHER' | 'ELEVATION' | 'REEF_TIDE' | 'OFFLINE_GAP';
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  status: 'SAFE' | 'WARNING' | 'CRITICAL_BLOCK';
  hoursRemaining?: number;
  authoritativeSource: string;
  verificationStatus: 'VERIFIED' | 'REQUIRES_VERIFICATION';
}

export interface SingleTravelerContext {
  user: TravelerProfile & {
    authId?: string;
    role: 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';
    isSynced: boolean;
  };
  trip: TripBrief & {
    days: TimelineDay[];
    activeDayNumber: number;
    totalDays: number;
  };
  currentLocation: {
    id: string;
    name: string;
    nameAr: string;
    areaId: DahabAreaId;
    coords: [number, number];
    isWaterfront: boolean;
  };
  currentTime: {
    dayNumber: number;
    timeFormatted: string; // e.g. "06:15 AM", "11:30 AM", "13:00"
    minutesFromMidnight: number;
    isEarlyMorning: boolean;
    isMidday: boolean;
    isSunsetHour: boolean;
    isNight: boolean;
  };
  bookings: ConfirmedBookingItem[];
  pendingTasks: Array<{
    id: string;
    title: string;
    titleAr: string;
    dueBy: string;
    status: 'PENDING' | 'DONE';
    associatedService?: string;
  }>;
  preferences: {
    pace: 'Relaxed' | 'Balanced' | 'Active';
    budget: 'Budget' | 'Moderate' | 'Premium';
    interests: string[];
    dietary: string[];
  };
  conditions: LiveDahabConditions;
  availability: {
    freeWindowMinutes: number;
    nextActivityTime?: string;
    nextActivityTitle?: string;
    nextActivityTitleAr?: string;
    nextActivityLocation?: string;
  };
  safetyContext: SafetyContextItem[];
  nextBestActions: NextBestAction[];
  activeJourneyPhase: TravelerJourneyPhase;
}

export interface GoldenJourneyStep {
  stepNumber: number;
  phase: TravelerJourneyPhase;
  title: string;
  titleAr: string;
  systemAction: string;
  userFacingOutcome: string;
  verifiedEvidence: string;
  status: 'PASSED' | 'IN_PROGRESS' | 'PENDING';
}

export interface GoldenJourneyScenario {
  id: string;
  code: 'JOURNEY_A' | 'JOURNEY_B' | 'JOURNEY_C' | 'JOURNEY_D' | 'JOURNEY_E' | 'JOURNEY_F' | 'JOURNEY_G';
  title: string;
  titleAr: string;
  persona: string;
  contextSummary: string;
  steps: GoldenJourneyStep[];
  successCriteria: string;
}
