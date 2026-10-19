import { describe, expect, it } from 'vitest';
import { toISODate, fromISODate, formatTravelDay, formatDateRange } from '../../src/shared/daygiTravelDates';

/**
 * The composer calendar must report the day the traveler actually clicked.
 *
 * Both directions of the bug are invisible to a UTC test machine: `toISOString`
 * on a local date is a day early east of Greenwich (Egypt is UTC+2), and
 * `new Date('YYYY-MM-DD')` is a day late west of it. Together they made the
 * range chip read "19 Oct – 24 Oct" for a 20–25 selection.
 */

describe('daygiTravelDates', () => {
  it('serializes a local calendar day without shifting it', () => {
    expect(toISODate(new Date(2026, 9, 20))).toBe('2026-10-20');
    expect(toISODate(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(toISODate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('pads single-digit months and days', () => {
    expect(toISODate(new Date(2026, 8, 5))).toBe('2026-09-05');
  });

  it('parses an ISO date back to the same local calendar day', () => {
    const d = fromISODate('2026-10-20');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(9);
    expect(d!.getDate()).toBe(20);
  });

  it('rejects malformed and impossible dates', () => {
    expect(fromISODate('')).toBeNull();
    expect(fromISODate('2026-10')).toBeNull();
    expect(fromISODate('20-10-2026')).toBeNull();
    expect(fromISODate('not-a-date')).toBeNull();
    expect(fromISODate('2026-02-30')).toBeNull();
    expect(fromISODate('2026-13-01')).toBeNull();
  });

  it('formats the day the traveler picked, not its UTC neighbour', () => {
    expect(formatTravelDay('2026-10-20', 'en')).toBe('20 Oct');
    expect(formatTravelDay('2026-01-01', 'en')).toBe('1 Jan');
  });

  it('round-trips a selected range back to the same visible dates', () => {
    const start = toISODate(new Date(2026, 9, 20));
    const end = toISODate(new Date(2026, 9, 25));
    expect(formatDateRange(start, end, 'en')).toBe('20 Oct – 25 Oct');
  });

  it('shows a single day once when start and end match', () => {
    expect(formatDateRange('2026-10-20', '2026-10-20', 'en')).toBe('20 Oct');
  });

  it('falls back to the raw value for an unparseable date', () => {
    expect(formatTravelDay('garbage', 'en')).toBe('garbage');
  });

  it('renders Arabic dates for the Arabic locale', () => {
    const arabic = formatTravelDay('2026-10-20', 'ar');
    expect(arabic).toBeTruthy();
    expect(arabic).not.toBe('2026-10-20');
  });
});
