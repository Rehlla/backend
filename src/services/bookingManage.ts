import { ApiError } from './apiError';
import type { BookingDetail, RichAvailabilityResponse } from './api';

/**
 * Traveller-facing booking management helpers.
 *
 * The rule these helpers encode is a rule about what the UI may *offer*: the
 * backend remains the source of truth, and every action still round-trips to
 * the server before anything is claimed. When the server says a booking is in
 * a terminal state the manage buttons are hidden or disabled; when the server
 * reports availability, these helpers only turn the reported numbers into
 * presentation states — never into a capacity decision of their own.
 */

/**
 * States in which a booking can no longer be cancelled or rescheduled.
 * Mirrors the terminal set enforced server-side in bookingService.ts; keeping
 * it here only decides whether the buttons are offered at all.
 */
export const TERMINAL_SUPPLIER_STATES: ReadonlyArray<string> = [
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'FAILED'
];

/** Payment states in which the money side can no longer be acted on. */
const TERMINAL_PAYMENT_STATES: ReadonlyArray<string> = [
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'CANCELLED',
  'FAILED',
  'DISPUTED'
];

export type BookingActionEligibility =
  | { allowed: true }
  | { allowed: false; reason: 'terminal' | 'noRefundPending' };

export function cancellationEligibility(booking: Pick<BookingDetail, 'supplierState' | 'paymentState'>): BookingActionEligibility {
  if (TERMINAL_SUPPLIER_STATES.includes(booking.supplierState)) {
    return { allowed: false, reason: 'terminal' };
  }
  if (TERMINAL_PAYMENT_STATES.includes(booking.paymentState)) {
    return { allowed: false, reason: 'noRefundPending' };
  }
  return { allowed: true };
}

export function rescheduleEligibility(booking: Pick<BookingDetail, 'supplierState'>): BookingActionEligibility {
  if (TERMINAL_SUPPLIER_STATES.includes(booking.supplierState)) {
    return { allowed: false, reason: 'terminal' };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Rich availability presentation
// ---------------------------------------------------------------------------

export type SlotAvailabilityKind =
  | 'available'
  | 'limited'
  | 'sold-out'
  | 'fits-no-party';

export interface AvailabilitySlotView {
  id: string;
  timeSlot: string;
  priceEGP: number;
  capacityRemaining: number;
  kind: SlotAvailabilityKind;
}

/** Seats at or below which a fit is shown as "only a few left". */
export const LIMITED_REMAINING = 2;

/**
 * A slot's presentation state. The server reports `availableCapacity` (its own
 * total minus reserved and held seats) and the raw status; this only turns
 * those numbers into the states the UI renders, for the party size in hand.
 */
export function slotAvailabilityKind(slot: {
  availableCapacity: number;
  status: string;
}, passengers: number): SlotAvailabilityKind {
  if (slot.availableCapacity < passengers) {
    // Might read AVAILABLE on a full slot if the party grew after the server
    // answered; the party cannot fit either way.
    return slot.availableCapacity <= 0 ? 'sold-out' : 'fits-no-party';
  }
  if (slot.status === 'SOLD_OUT') return 'sold-out';
  if (slot.status === 'ALMOST_FULL' || slot.availableCapacity <= LIMITED_REMAINING) return 'limited';
  return 'available';
}

/**
 * Builds the per-slot rows shown in the availability picker.
 * Returns an empty list for a date with no scheduled slots — an "unavailable
 * that day" state the caller renders as its own empty result.
 */
export function availabilitySlotViews(
  response: Pick<RichAvailabilityResponse, 'slots'>,
  passengers: number
): AvailabilitySlotView[] {
  return response.slots.map(slot => ({
    id: slot.id,
    timeSlot: slot.timeSlot,
    priceEGP: slot.priceEGP,
    capacityRemaining: Math.max(0, slot.availableCapacity),
    kind: slotAvailabilityKind(slot, passengers)
  }));
}

// ---------------------------------------------------------------------------
// User-facing error mapping
// ---------------------------------------------------------------------------

export type BookingErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'notFound'
  | 'conflict'
  | 'invalidState'
  | 'rateLimited'
  | 'server'
  | 'network'
  | 'badRequest'
  | 'unknown';

export interface BookingErrorInfo {
  code: BookingErrorCode;
  /** Raw backend detail, for logging only — never rendered to the traveller. */
  detail?: string;
}

/**
 * Maps any thrown failure to a code the UI can translate. Status codes are the
 * contract; raw backend sentences are not surfaced to travellers, so the
 * detail is only carried for diagnostics.
 */
export function bookingActionError(error: unknown): BookingErrorInfo {
  if (error instanceof ApiError) {
    const detail = error.message;
    switch (error.status) {
      case 401: return { code: 'unauthorized', detail };
      case 403: return { code: 'forbidden', detail };
      case 404: return { code: 'notFound', detail };
      case 409: return { code: 'conflict', detail };
      case 422: return { code: 'invalidState', detail };
      case 429: return { code: 'rateLimited', detail };
      case 400: return { code: 'badRequest', detail };
      default:
        return { code: error.status >= 500 ? 'server' : 'unknown', detail };
    }
  }
  // A plain Error from fetchWithTimeout (timeout) or a TypeError (offline,
  // DNS failure) — nothing was decided by the server.
  return { code: 'network', detail: error instanceof Error ? error.message : undefined };
}

// ---------------------------------------------------------------------------
// Free-cancellation deadline (server: bookingService freeCancellationUntil)
// ---------------------------------------------------------------------------

const DAHAB_TZ = 'Africa/Cairo';

/**
 * "Thu 12 Nov, 09:30" / "الخميس، 12 نوفمبر، 09:30" — always Dahab's clock
 * (the deadline is a Cairo wall time whatever the traveller's device says)
 * and Western digits in both languages, like every price and time on screen.
 */
export function formatCairoDeadline(iso: string, language: 'en' | 'ar'): string | null {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', {
    timeZone: DAHAB_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(at));
}

export type FreeCancellationView =
  | { kind: 'until'; when: string }
  | { kind: 'ended'; when: string };

/**
 * What to say about free cancellation, from the server's deadline. Null when
 * the server gave none (no usable date), so nothing is promised.
 */
export function freeCancellationView(
  freeCancellationUntil: string | null | undefined,
  language: 'en' | 'ar',
  now: number = Date.now()
): FreeCancellationView | null {
  if (!freeCancellationUntil) return null;
  const when = formatCairoDeadline(freeCancellationUntil, language);
  if (!when) return null;
  return Date.parse(freeCancellationUntil) > now ? { kind: 'until', when } : { kind: 'ended', when };
}

// ---------------------------------------------------------------------------
// Review eligibility (server: reviewService.verifyStay)
// ---------------------------------------------------------------------------

/**
 * Supplier states in which the booking was accepted and not called off.
 * Mirrors ACCEPTED_LIVE_STATES in server/services/reviewService.ts.
 */
export const REVIEWABLE_ACCEPTED_STATES: ReadonlyArray<string> = [
  'CONFIRMED', 'ASSIGNED', 'DISPATCHED', 'EN_ROUTE', 'IN_PROGRESS', 'ARRIVED',
  'READY_FOR_PICKUP', 'ACTIVE', 'RETURNED'
];

/** Minutes Africa/Cairo is ahead of UTC at an instant (DST-aware via Intl). */
function cairoOffsetMinutes(at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DAHAB_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(at));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((wallAsUtc - Math.floor(at / 1000) * 1000) / 60000);
}

/** The instant the scheduled day ends in Dahab (next day 00:00 Cairo), or null for an unusable date. */
export function cairoEndOfDay(scheduledDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate || '')) return null;
  const [y, m, d] = scheduledDate.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d + 1, 0, 0);
  let instant = wallAsUtc - cairoOffsetMinutes(wallAsUtc) * 60000;
  instant = wallAsUtc - cairoOffsetMinutes(instant) * 60000;
  return instant;
}

/**
 * Whether to invite a review: the supplier marked the booking COMPLETED, or
 * accepted it and its scheduled day in Dahab is over.
 *
 * The server's rule is the same with one refinement the client cannot see —
 * it ends a timed service at start + the SKU's duration. Waiting for the end
 * of the day is never earlier than that, so an invitation shown here is one
 * the server will accept. Paid-but-not-yet-happened (paymentState CAPTURED)
 * used to qualify; the server now refuses it with 409.
 */
export function isReviewEligible(
  booking: Pick<BookingDetail, 'supplierState' | 'scheduledDate'>,
  now: number = Date.now()
): boolean {
  if (booking.supplierState === 'COMPLETED') return true;
  if (!REVIEWABLE_ACCEPTED_STATES.includes(booking.supplierState)) return false;
  const end = cairoEndOfDay(booking.scheduledDate);
  return end !== null && end <= now;
}
