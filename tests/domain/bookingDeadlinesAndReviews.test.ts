import { describe, expect, it } from 'vitest';
import {
  cairoEndOfDay,
  formatCairoDeadline,
  freeCancellationView,
  isReviewEligible,
} from '../../src/services/bookingManage';

describe('free-cancellation deadline', () => {
  // 07:30Z on 12 Nov 2026 is 09:30 in Cairo (UTC+2 in winter).
  const iso = '2026-11-12T07:30:00.000Z';

  it('reads "Thu 12 Nov, 09:30" in Dahab time, Western digits in both languages', () => {
    expect(formatCairoDeadline(iso, 'en')).toBe('Thu 12 Nov, 09:30');
    const ar = formatCairoDeadline(iso, 'ar')!;
    expect(ar).toContain('12');
    expect(ar).toContain('09:30');
    expect(ar).not.toMatch(/[٠-٩]/);
  });

  it('says "until" before the deadline and "ended" after it; nothing when the server gave none', () => {
    const before = Date.parse('2026-11-01T00:00:00Z');
    const after = Date.parse('2026-11-13T00:00:00Z');
    expect(freeCancellationView(iso, 'en', before)).toEqual({ kind: 'until', when: 'Thu 12 Nov, 09:30' });
    expect(freeCancellationView(iso, 'en', after)).toEqual({ kind: 'ended', when: 'Thu 12 Nov, 09:30' });
    expect(freeCancellationView(null, 'en', before)).toBeNull();
    expect(freeCancellationView(undefined, 'en', before)).toBeNull();
    expect(freeCancellationView('not a date', 'en', before)).toBeNull();
  });
});

describe('review invitations follow the server rule', () => {
  // 12 Nov 2026 ends at 13 Nov 00:00 Cairo = 12 Nov 22:00Z.
  const endOf12Nov = Date.parse('2026-11-12T22:00:00Z');

  it('computes the end of the scheduled day in Cairo', () => {
    expect(cairoEndOfDay('2026-11-12')).toBe(endOf12Nov);
    // Summer time (UTC+3): 13 Jul 00:00 Cairo = 12 Jul 21:00Z.
    expect(cairoEndOfDay('2026-07-12')).toBe(Date.parse('2026-07-12T21:00:00Z'));
    expect(cairoEndOfDay('')).toBeNull();
  });

  it('invites once the supplier marked the booking COMPLETED, whatever the date', () => {
    expect(isReviewEligible({ supplierState: 'COMPLETED', scheduledDate: '2099-01-01' }, endOf12Nov - 1)).toBe(true);
  });

  it('invites an accepted booking only after its day is over', () => {
    const booking = { supplierState: 'CONFIRMED', scheduledDate: '2026-11-12' };
    expect(isReviewEligible(booking, endOf12Nov - 1)).toBe(false);
    expect(isReviewEligible(booking, endOf12Nov)).toBe(true);
  });

  it('never invites a paid-but-not-happened, unaccepted or called-off booking', () => {
    const later = endOf12Nov + 86_400_000;
    for (const supplierState of ['PENDING_CONFIRMATION', 'CANCELLED', 'REJECTED', 'EXPIRED', 'FAILED']) {
      expect(isReviewEligible({ supplierState, scheduledDate: '2026-11-12' }, later), supplierState).toBe(false);
    }
  });
});
