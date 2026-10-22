/**
 * Travel-date helpers for the DayGI composer.
 *
 * Kept out of the component so the timezone behaviour is testable: a calendar
 * day the traveler clicks is that day in *their* timezone, not the same day
 * somewhere else.
 */

/**
 * A local calendar day as `YYYY-MM-DD`.
 *
 * `toISOString()` converts to UTC first, which is a day early for anyone east
 * of Greenwich — in Egypt (UTC+2) clicking the 20th would report the 19th, and
 * the chip under the button would disagree with the day that was highlighted.
 */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parses `YYYY-MM-DD` as a local calendar day.
 *
 * `new Date('2026-10-20')` is UTC midnight, which formats as the 19th for
 * anyone west of Greenwich — the same off-by-one from the other direction.
 */
export function fromISODate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
    return null;
  }
  return date;
}

/** `20 Oct` / `٢٠ أكتوبر` — the traveler's own calendar day, never shifted. */
export function formatTravelDay(iso: string, lang: 'en' | 'ar'): string {
  const date = fromISODate(iso);
  if (!date) return iso;
  return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short'
  });
}

export function formatDateRange(start: string, end: string, lang: 'en' | 'ar'): string {
  if (start === end) return formatTravelDay(start, lang);
  return `${formatTravelDay(start, lang)} – ${formatTravelDay(end, lang)}`;
}
