import type { DayGiTripHealth, DayGiTripHealthIssue } from '../shared/types/daygi';
import type { ConflictSeverity, TripConflict, TripHealthSummary } from '../types/tripOs';

/**
 * Turns the computed trip health into what the trip-preview panel renders.
 *
 * That panel used to read `INITIAL_TRIP_HEALTH` from src/data/tripOsDefaults.ts
 * — a fixed object reporting "All Systems Green", zero conflicts, and one
 * informational note:
 *
 *   "Optimal Dive-to-Fly Surface Interval — your final dive is on Day 2,
 *    providing 72+ hours before your Day 5 flight (well beyond PADI 18h
 *    requirement)."
 *
 * That is a decompression-safety statement. It was shown to every traveler,
 * whatever they had booked and on whatever dates, and nothing had checked it.
 *
 * `daygiTripHealthService.evaluateTripHealth` genuinely derives its issues from
 * the trip's items, bookings and holds, and is served at
 * GET /api/daygi/health/:tripId. This maps that result onto the panel's shape.
 */

const SEVERITY: Record<DayGiTripHealthIssue['severity'], ConflictSeverity> = {
  HIGH: 'critical',
  MEDIUM: 'warning',
  LOW: 'info'
};

/** The issue kinds the panel groups by, mapped onto its own vocabulary. */
const SOURCE: Record<DayGiTripHealthIssue['type'], TripConflict['source']> = {
  PAYMENT_PENDING: 'payment',
  SUPPLIER_PENDING: 'availability',
  SCHEDULE_CONFLICT: 'timing',
  INSUFFICIENT_TRAVEL_TIME: 'transfer',
  ACTIVITY_DEPENDENCY: 'timing',
  CONDITION_UNCERTAINTY: 'weather',
  MISSING_REQUIREMENT: 'fatigue'
};

function statusOf(health: DayGiTripHealth, counts: Record<ConflictSeverity, number>): TripHealthSummary['status'] {
  if (counts.critical > 0) return 'conflict';
  if (counts.warning > 0) return 'attention';
  return health.issues.length === 0 ? 'good' : 'attention';
}

export function toTripHealthSummary(health: DayGiTripHealth): TripHealthSummary {
  const conflicts: TripConflict[] = health.issues.map((issue, index) => ({
    id: `${issue.type}-${index}`,
    severity: SEVERITY[issue.severity] ?? 'info',
    title: issue.titleEn,
    titleAr: issue.titleAr,
    description: issue.messageEn,
    descriptionAr: issue.messageAr,
    // The computed health does not attribute an issue to a day; 0 means "the
    // trip" rather than a day the panel would otherwise highlight wrongly.
    affectedDayNumber: 0,
    source: SOURCE[issue.type] ?? 'timing',
    suggestedFix: issue.suggestedFixEn,
    suggestedFixAr: issue.suggestedFixAr,
    // An issue the service still reports is, by definition, not resolved. The
    // fixed data marked its one conflict `resolved: true`, which is how a panel
    // showing a conflict could also show "All Systems Green".
    resolved: false,
    autoFixable: Boolean(issue.actionKey)
  }));

  const counts: Record<ConflictSeverity, number> = {
    critical: conflicts.filter(c => c.severity === 'critical').length,
    warning: conflicts.filter(c => c.severity === 'warning').length,
    info: conflicts.filter(c => c.severity === 'info').length
  };

  return {
    status: statusOf(health, counts),
    // The service's own summary, not a label asserting everything is fine.
    statusLabel: health.summaryEn,
    statusLabelAr: health.summaryAr,
    criticalCount: counts.critical,
    warningCount: counts.warning,
    infoCount: counts.info,
    conflicts
  };
}

/**
 * What the panel shows before a reading arrives, or when there is no trip.
 *
 * Deliberately `unverified` rather than `good`: not having checked is not the
 * same as having checked and found nothing, and the difference matters on a
 * page a diver reads.
 */
export const UNVERIFIED_TRIP_HEALTH: TripHealthSummary = {
  status: 'unverified',
  statusLabel: 'Not checked yet',
  statusLabelAr: 'لسه ما اتفحصتش',
  criticalCount: 0,
  warningCount: 0,
  infoCount: 0,
  conflicts: []
};
