/**
 * Formatting for a trip's real dates.
 *
 * "Oct 12 – Oct 16, 2026" was written as a literal string in three places on
 * the my-trip page — the header, the trip-style panel and the timeline banner —
 * so a trip starting on any other date still displayed October. The trip
 * record carries startDate and endDate; this reads them, and says nothing when
 * they are absent rather than inventing a range.
 */
export function formatTripDateRange(
  startDate: string | undefined,
  endDate: string | undefined,
  locale: 'en' | 'ar'
): string | null {
  if (!startDate || !endDate) return null;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const tag = locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const comma = locale === 'ar' ? '،' : ',';
  const dayMonth = (date: Date) =>
    date.toLocaleDateString(tag, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startDate.slice(0, 10) === endDate.slice(0, 10)) return `${dayMonth(start)}${comma} ${endYear}`;
  return startYear === endYear
    ? `${dayMonth(start)} – ${dayMonth(end)}${comma} ${endYear}`
    : `${dayMonth(start)}${comma} ${startYear} – ${dayMonth(end)}${comma} ${endYear}`;
}
