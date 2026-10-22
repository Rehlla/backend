/**
 * Clock arithmetic for the arrival and first-two-hours pages.
 *
 * Those pages used to display a frozen 10:00 AM arrival, a fixed "2h 20m
 * remaining", a hardcoded one-third progress bar and a static 3:00 PM check-in,
 * all as literal strings in translations.ts. A traveler opening the page at any
 * other time was shown someone else's morning.
 *
 * Everything here is pure and takes `now` as an argument so it can be tested
 * without freezing timers.
 */

export type SupportedLanguage = 'en' | 'ar';

/**
 * 3:00 PM. Not a new claim: it is the check-in time the arrival copy has always
 * stated, and the standard for the hotels in this catalogue. Structured
 * check-in data does not exist yet — ConfirmedBookingItem.datesOrTime is free
 * text — so callers may pass a real hour once it does.
 */
export const DEFAULT_CHECK_IN_HOUR = 15;

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Today's check-in moment, in the viewer's own timezone. */
export function checkInTimeFor(now: Date, hour: number = DEFAULT_CHECK_IN_HOUR): Date {
  const at = new Date(now);
  at.setHours(hour, 0, 0, 0);
  return at;
}

/** Whole minutes from `from` to `to`. Negative once `to` has passed. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

/**
 * How far `now` has travelled from `start` to `end`, as 0–100.
 *
 * Clamped at both ends: the progress bar was a hardcoded `w-1/3`, and an
 * unclamped value would render outside its track for anyone opening the page
 * before their arrival moment or after check-in.
 */
export function progressPercent(start: Date, end: Date, now: Date): number {
  const span = end.getTime() - start.getTime();
  if (span <= 0) return 100;
  const done = ((now.getTime() - start.getTime()) / span) * 100;
  return Math.min(100, Math.max(0, Math.round(done)));
}

const LOCALE: Record<SupportedLanguage, string> = { en: 'en-US', ar: 'ar-EG' };

/** e.g. "10:00 AM" / "١٠:٠٠ ص" — Arabic-Indic digits come from the locale. */
export function formatClock(date: Date, language: SupportedLanguage): string {
  return date.toLocaleTimeString(LOCALE[language], { hour: 'numeric', minute: '2-digit' });
}

/** e.g. "Oct 12" / "١٢ أكتوبر" */
export function formatDayAndMonth(date: Date, language: SupportedLanguage): string {
  return date.toLocaleDateString(LOCALE[language], { day: 'numeric', month: 'short' });
}

const arabicNumber = (n: number) => n.toLocaleString('ar-EG');

/**
 * Arabic marks singular, dual and plural differently, and the existing copy
 * ("ساعتان و٢٠ دقيقة") got that right by hand. Producing "2 ساعة" here would be
 * a regression in quality even though the number would finally be correct.
 */
function arabicUnit(value: number, one: string, two: string, few: string, many: string): string {
  if (value === 1) return one;
  if (value === 2) return two;
  if (value >= 3 && value <= 10) return `${arabicNumber(value)} ${few}`;
  return `${arabicNumber(value)} ${many}`;
}

/** e.g. "2h 20m" / "ساعتان و٢٠ دقيقة". Negative input is treated as zero. */
export function formatDuration(totalMinutes: number, language: SupportedLanguage): string {
  const safe = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;

  if (language === 'en') {
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  }

  const hourPart = arabicUnit(hours, 'ساعة', 'ساعتان', 'ساعات', 'ساعة');
  const minutePart = arabicUnit(minutes, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة');
  if (hours === 0) return minutePart;
  if (minutes === 0) return hourPart;
  return `${hourPart} و${minutePart}`;
}
