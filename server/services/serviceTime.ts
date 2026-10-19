// ---------------------------------------------------------------------------
// When a booked service actually happens.
//
// Bookings carry a calendar date (YYYY-MM-DD) and a free-text slot label
// ('08:30 AM (Morning Dive)', 'Check-in 14:00', 'FULL_DAY', 'ASAP'). Policies
// that depend on the service's real start or end — free cancellation, review
// eligibility — need an instant, in Dahab's own timezone.
//
// Africa/Cairo is resolved through Intl rather than a fixed +2: Egypt
// reinstated summer time in 2023, so the offset is +3 for half the year.
// ---------------------------------------------------------------------------

const DAHAB_TZ = 'Africa/Cairo';
const HOUR_MS = 60 * 60 * 1000;

const cairoParts = new Intl.DateTimeFormat('en-US', {
  timeZone: DAHAB_TZ,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit'
});

/** Minutes Africa/Cairo is ahead of UTC at the given instant. */
function cairoOffsetMinutes(at: number): number {
  const parts = cairoParts.formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((wallAsUtc - Math.floor(at / 1000) * 1000) / 60000);
}

/** The UTC instant of a Cairo wall-clock time on a calendar date. */
export function cairoWallTime(date: string, hours: number, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hours, minutes);
  // Offset at the first guess, then again at the corrected instant, so a time
  // on a DST changeover day lands on the right side of the switch.
  let instant = wallAsUtc - cairoOffsetMinutes(wallAsUtc) * 60000;
  instant = wallAsUtc - cairoOffsetMinutes(instant) * 60000;
  return new Date(instant);
}

/** The first clock time in a slot label ('08:30 AM (Morning Dive)', 'Check-in 14:00'), or null. */
export function parseSlotClock(label: string): { hours: number; minutes: number } | null {
  const match = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(label || '');
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/**
 * When the service starts, or null when the booking has no usable date.
 *
 * A label with no clock time ('FULL_DAY', 'ASAP') starts at 00:00 Cairo on its
 * date — the earliest it could — so a deadline derived from it is never later
 * than the truth.
 */
export function serviceStartAt(booking: { scheduledDate: string; scheduledTime: string }): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.scheduledDate || '')) return null;
  const clock = parseSlotClock(booking.scheduledTime) ?? { hours: 0, minutes: 0 };
  return cairoWallTime(booking.scheduledDate, clock.hours, clock.minutes);
}

/**
 * The last instant a booking can be cancelled for a full refund: the service
 * start minus the SKU's cancellationPolicyHours. Null when the start is unknown.
 */
export function freeCancellationUntil(
  booking: { scheduledDate: string; scheduledTime: string },
  policyHours: number
): Date | null {
  const start = serviceStartAt(booking);
  return start ? new Date(start.getTime() - policyHours * HOUR_MS) : null;
}

/**
 * When the service is over: start + the SKU's durationMinutes when it is
 * known, otherwise the end of the scheduled day in Cairo. Null when the date
 * is unusable.
 */
/**
 * A stay spans nights, not a slot: its end is the departure morning.
 *
 * A hotel booking carries `checkOut` for exactly this and `scheduledDate` is
 * only the first night. Without this a five-night stay would be judged over
 * the morning after night one - so a traveller could review the property
 * before they had even arrived.
 */
export function serviceEndAt(
  booking: { scheduledDate: string; scheduledTime: string; checkOut?: string; nights?: number },
  durationMinutes?: number
): Date | null {
  if (booking.checkOut && /^\d{4}-\d{2}-\d{2}$/.test(booking.checkOut)) {
    return cairoWallTime(booking.checkOut, 0, 0);
  }
  const start = serviceStartAt(booking);
  if (!start) return null;
  if (durationMinutes && durationMinutes > 0 && parseSlotClock(booking.scheduledTime)) {
    return new Date(start.getTime() + durationMinutes * 60000);
  }
  const nextDay = new Date(`${booking.scheduledDate}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return cairoWallTime(nextDay.toISOString().slice(0, 10), 0, 0);
}

