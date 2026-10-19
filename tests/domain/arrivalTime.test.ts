import { describe, it, expect } from 'vitest';
import {
  addMinutes,
  checkInTimeFor,
  minutesBetween,
  progressPercent,
  formatClock,
  formatDayAndMonth,
  formatDuration,
  DEFAULT_CHECK_IN_HOUR
} from '../../src/utils/arrivalTime';

/**
 * The arrival pages displayed a frozen clock: 10:00 AM arrival, "2h 20m
 * remaining", a hardcoded one-third progress bar and a 3:00 PM check-in, all as
 * literal strings in translations.ts. This is the arithmetic that replaced it.
 *
 * `now` is always passed in, so none of this depends on when the suite runs.
 */

const at = (h: number, m = 0) => new Date(2026, 8, 15, h, m, 0, 0);

describe('checkInTimeFor', () => {
  it('returns today at the check-in hour, in the viewer timezone', () => {
    const t = checkInTimeFor(at(10, 30));
    expect(t.getHours()).toBe(DEFAULT_CHECK_IN_HOUR);
    expect(t.getMinutes()).toBe(0);
    expect(t.getDate()).toBe(15);
  });

  it('does not mutate the date it was given', () => {
    const now = at(10, 30);
    checkInTimeFor(now);
    expect(now.getHours()).toBe(10);
  });

  it('accepts a different hour, for when structured check-in data exists', () => {
    expect(checkInTimeFor(at(10), 14).getHours()).toBe(14);
  });
});

describe('minutesBetween', () => {
  it('counts whole minutes forward', () => {
    expect(minutesBetween(at(10), at(12, 20))).toBe(140);
  });

  it('goes negative once the target has passed', () => {
    // A traveler opening the page at 6 PM must not be told they have time left.
    expect(minutesBetween(at(18), checkInTimeFor(at(18)))).toBe(-180);
  });
});

describe('progressPercent', () => {
  const start = at(10);
  const end = at(15);

  it('is 0 at the start and 100 at the end', () => {
    expect(progressPercent(start, end, at(10))).toBe(0);
    expect(progressPercent(start, end, at(15))).toBe(100);
  });

  it('tracks the middle of the window', () => {
    expect(progressPercent(start, end, at(12, 30))).toBe(50);
  });

  it('clamps instead of overflowing its track', () => {
    // The bar was a hardcoded w-1/3; an unclamped value renders outside it.
    expect(progressPercent(start, end, at(9))).toBe(0);
    expect(progressPercent(start, end, at(20))).toBe(100);
  });

  it('does not divide by zero when check-in has already arrived', () => {
    expect(progressPercent(at(15), at(15), at(15))).toBe(100);
  });
});

describe('formatClock', () => {
  it('renders a 12-hour English clock', () => {
    expect(formatClock(at(10, 0), 'en')).toBe('10:00 AM');
    expect(formatClock(at(15, 5), 'en')).toBe('3:05 PM');
  });

  it('renders Arabic-Indic digits and Arabic meridiem', () => {
    const morning = formatClock(at(10, 0), 'ar');
    expect(morning).toMatch(/[٠-٩]/);
    expect(morning).toContain('١٠');
    expect(formatClock(at(15, 5), 'ar')).toContain('٣');
  });

  it('distinguishes morning from afternoon in both languages', () => {
    expect(formatClock(at(10), 'en')).not.toBe(formatClock(at(22), 'en'));
    expect(formatClock(at(10), 'ar')).not.toBe(formatClock(at(22), 'ar'));
  });
});

describe('formatDayAndMonth', () => {
  it('renders a short date in each language', () => {
    expect(formatDayAndMonth(at(10), 'en')).toMatch(/Sep\s?15|15\s?Sep/);
    expect(formatDayAndMonth(at(10), 'ar')).toMatch(/[٠-٩]/);
  });
});

describe('formatDuration', () => {
  it('formats hours and minutes in English', () => {
    expect(formatDuration(140, 'en')).toBe('2h 20m');
    expect(formatDuration(45, 'en')).toBe('45m');
    expect(formatDuration(120, 'en')).toBe('2h');
  });

  it('respects Arabic dual and plural forms', () => {
    // The hand-written copy said "ساعتان و٢٠ دقيقة"; "2 ساعة" would be a
    // regression in quality even with the number finally correct.
    expect(formatDuration(140, 'ar')).toBe('ساعتان و٢٠ دقيقة');
    expect(formatDuration(60, 'ar')).toBe('ساعة');
    expect(formatDuration(61, 'ar')).toBe('ساعة ودقيقة');
    expect(formatDuration(122, 'ar')).toBe('ساعتان ودقيقتان');
    expect(formatDuration(245, 'ar')).toBe('٤ ساعات و٥ دقائق');
    expect(formatDuration(45, 'ar')).toBe('٤٥ دقيقة');
  });

  it('never shows a negative countdown', () => {
    expect(formatDuration(-90, 'en')).toBe('0m');
    expect(formatDuration(-90, 'ar')).toBe('٠ دقيقة');
  });
});

describe('addMinutes', () => {
  it('accumulates a plan offset from the arrival moment', () => {
    const arrived = at(11, 40);
    const offsets = [0, 20, 60, 105, 135];
    expect(offsets.map(o => formatClock(addMinutes(arrived, o), 'en')))
      .toEqual(['11:40 AM', '12:00 PM', '12:40 PM', '1:25 PM', '1:55 PM']);
  });

  it('rolls over midnight without breaking', () => {
    expect(formatClock(addMinutes(at(23, 50), 30), 'en')).toBe('12:20 AM');
  });
});
