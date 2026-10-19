import { describe, expect, it } from 'vitest';
import { UNVERIFIED_TRIP_HEALTH, toTripHealthSummary } from '../../src/services/tripHealthMapper';
import type { DayGiTripHealth, DayGiTripHealthIssue } from '../../src/shared';

/**
 * The trip-preview panel used to read a fixed `INITIAL_TRIP_HEALTH`: "All
 * Systems Green", zero conflicts, and one informational note stating that the
 * traveler's final dive was on Day 2, "providing 72+ hours before your Day 5
 * flight (well beyond PADI 18h requirement)". A decompression-safety claim,
 * shown to everyone, checked by nothing.
 */

const issue = (over: Partial<DayGiTripHealthIssue> = {}): DayGiTripHealthIssue => ({
  type: 'SUPPLIER_PENDING',
  severity: 'MEDIUM',
  titleEn: 'Supplier has not confirmed',
  titleAr: 'المورّد لسه ما أكّدش',
  messageEn: 'One booking is waiting on the supplier.',
  messageAr: 'حجز واحد مستني تأكيد المورّد.',
  suggestedFixEn: 'Contact the supplier.',
  suggestedFixAr: 'كلّم المورّد.',
  ...over
});

const health = (over: Partial<DayGiTripHealth> = {}): DayGiTripHealth => ({
  status: 'HEALTHY',
  score: 90,
  evaluatedAt: '2026-08-31T10:00:00.000Z',
  summaryEn: 'One booking is awaiting confirmation.',
  summaryAr: 'حجز واحد مستني تأكيد.',
  issues: [],
  metrics: { confirmedBookings: 3, pendingBookings: 1, conflictsCount: 0, budgetAdherencePercent: 100 },
  ...over
});

describe('mapping computed health onto the panel', () => {
  it('carries the service’s own summary rather than a fixed label', () => {
    // Was the literal "All Systems Green" whatever the trip looked like.
    const summary = toTripHealthSummary(health());
    expect(summary.statusLabel).toBe('One booking is awaiting confirmation.');
    expect(summary.statusLabelAr).toBe('حجز واحد مستني تأكيد.');
  });

  it('reports good only when the service found nothing', () => {
    expect(toTripHealthSummary(health({ issues: [] })).status).toBe('good');
  });

  it('reports a conflict when something is high severity', () => {
    const summary = toTripHealthSummary(health({ issues: [issue({ severity: 'HIGH' })] }));
    expect(summary.status).toBe('conflict');
    expect(summary.criticalCount).toBe(1);
  });

  it('reports attention for a medium issue', () => {
    const summary = toTripHealthSummary(health({ issues: [issue({ severity: 'MEDIUM' })] }));
    expect(summary.status).toBe('attention');
    expect(summary.warningCount).toBe(1);
  });

  it('never marks a reported issue resolved', () => {
    // The fixed data marked its only conflict `resolved: true`, which is how a
    // panel that had a conflict could also read "All Systems Green".
    const summary = toTripHealthSummary(health({ issues: [issue()] }));
    expect(summary.conflicts[0].resolved).toBe(false);
  });

  it('maps each issue kind onto the panel’s own source vocabulary', () => {
    const kinds: Array<[DayGiTripHealthIssue['type'], string]> = [
      ['PAYMENT_PENDING', 'payment'],
      ['SCHEDULE_CONFLICT', 'timing'],
      ['INSUFFICIENT_TRAVEL_TIME', 'transfer'],
      ['CONDITION_UNCERTAINTY', 'weather']
    ];
    for (const [type, source] of kinds) {
      expect(toTripHealthSummary(health({ issues: [issue({ type })] })).conflicts[0].source).toBe(source);
    }
  });

  it('marks an issue auto-fixable only when the service supplied an action', () => {
    expect(toTripHealthSummary(health({ issues: [issue()] })).conflicts[0].autoFixable).toBe(false);
    expect(
      toTripHealthSummary(health({ issues: [issue({ actionKey: 'CONTACT_SUPPLIER' })] })).conflicts[0]
        .autoFixable
    ).toBe(true);
  });

  it('counts each severity separately', () => {
    const summary = toTripHealthSummary(
      health({
        issues: [issue({ severity: 'HIGH' }), issue({ severity: 'MEDIUM' }), issue({ severity: 'LOW' })]
      })
    );
    expect([summary.criticalCount, summary.warningCount, summary.infoCount]).toEqual([1, 1, 1]);
  });
});

describe('before a reading arrives', () => {
  it('is unverified, not good', () => {
    // Not having checked is not the same as having checked and found nothing —
    // and the difference matters on a page a diver reads.
    expect(UNVERIFIED_TRIP_HEALTH.status).toBe('unverified');
    expect(UNVERIFIED_TRIP_HEALTH.conflicts).toHaveLength(0);
  });
});
