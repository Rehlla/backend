/**
 * Traveler-facing booking lifecycle presentation.
 *
 * The server tracks fine-grained supplier states (see
 * server/services/bookingLifecycle.ts: PENDING_CONFIRMATION → CONFIRMED →
 * ASSIGNED → … → COMPLETED, plus the rental branch). Travelers do not need
 * dispatch-level detail — they need to answer "where is my booking and what
 * happens next". This module collapses the machine into four stages plus
 * terminal outcomes, in one place, so the bookings hub, the manage modal
 * and any future surface render the same story.
 *
 * Pure functions only: safe for the node test project.
 */

export type TimelineStageState = 'done' | 'current' | 'todo' | 'terminal-good' | 'terminal-bad';

export interface TimelineStage {
  /** i18n key suffix under `bookings.timeline.` (requested|confirmed|inservice|completed). */
  key: 'requested' | 'confirmed' | 'inservice' | 'completed';
  state: TimelineStageState;
}

/** Terminal outcomes that replace the stepper with a single verdict. */
export interface TimelineTerminal {
  terminal: true;
  /** i18n key suffix under `bookings.status.` — reuses the manage-modal vocabulary. */
  labelKey: string;
  tone: 'good' | 'bad';
}

const IN_SERVICE = new Set([
  'ASSIGNED',
  'DISPATCHED',
  'EN_ROUTE',
  'IN_PROGRESS',
  'ARRIVED',
  'READY_FOR_PICKUP',
  'ACTIVE',
  'RETURNED',
]);

/**
 * Collapse a server supplierState (+ refund flag) into the traveler timeline.
 * Unknown states fail closed to a single current "requested" step rather than
 * an empty or misleading stepper.
 */
export function bookingTimeline(
  supplierState: string,
  refunded = false
): { stages: TimelineStage[]; terminal: TimelineTerminal | null } {
  const state = (supplierState || '').toUpperCase();

  const terminalFor = (labelKey: string, tone: 'good' | 'bad'): TimelineTerminal => ({ terminal: true, labelKey, tone });

  if (refunded) {
    return { stages: [], terminal: terminalFor('bookings.status.REFUNDED', 'bad') };
  }

  switch (state) {
    case 'COMPLETED':
      return { stages: [], terminal: terminalFor('bookings.status.COMPLETED', 'good') };
    case 'CANCELLED':
      return { stages: [], terminal: terminalFor('bookings.status.CANCELLED', 'bad') };
    case 'REJECTED':
    case 'EXPIRED':
    case 'FAILED':
      return { stages: [], terminal: terminalFor('bookings.status.default', 'bad') };
    default:
      break;
  }

  // Live bookings walk the four traveler stages. The current step is the
  // furthest reached; everything before it is done.
  let currentIndex = 0; // PENDING_CONFIRMATION and unknowns
  if (state === 'CONFIRMED') currentIndex = 1;
  else if (IN_SERVICE.has(state)) currentIndex = 2;

  const keys: TimelineStage['key'][] = ['requested', 'confirmed', 'inservice', 'completed'];
  const stages = keys.map((key, i): TimelineStage => ({
    key,
    state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'todo',
  }));
  return { stages, terminal: null };
}
