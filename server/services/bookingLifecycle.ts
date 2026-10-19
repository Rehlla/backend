/**
 * Booking lifecycle state machine.
 *
 * The supplier state on a BookingEntity represents where the booking is in its
 * lifecycle. Without transition validation, a supplier could jump from
 * PENDING_CONFIRMATION straight to COMPLETED — bypassing ASSIGNED and
 * DISPATCHED, which exist so the traveler knows who is coming and the ops
 * console can see the vehicle in transit.
 *
 * This module encodes the legal transitions so the supplier status endpoint
 * can reject impossible jumps with a 409 Conflict instead of silently
 * accepting them.
 */

type SupplierState =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'ASSIGNED'
  | 'DISPATCHED'
  | 'EN_ROUTE'
  | 'IN_PROGRESS'
  | 'ARRIVED'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED'
  | 'READY_FOR_PICKUP'
  | 'ACTIVE'
  | 'RETURNED';

/**
 * Allowed forward transitions for each state.
 *
 * The standard transfer path is:
 *   PENDING_CONFIRMATION → CONFIRMED → ASSIGNED → DISPATCHED → EN_ROUTE →
 *   IN_PROGRESS → ARRIVED → COMPLETED
 *
 * The rental path adds:
 *   CONFIRMED → READY_FOR_PICKUP → ACTIVE → RETURNED → COMPLETED
 *
 * Any pre-terminal state can reach CANCELLED (traveler or supplier-initiated).
 * PENDING_CONFIRMATION can reach REJECTED (supplier declines).
 * Terminal states (COMPLETED, CANCELLED, REJECTED, EXPIRED, FAILED) have no
 * outgoing transitions.
 */
const TRANSITIONS: Record<SupplierState, SupplierState[]> = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED:            ['ASSIGNED', 'CANCELLED', 'READY_FOR_PICKUP'],
  ASSIGNED:             ['DISPATCHED', 'CANCELLED'],
  DISPATCHED:           ['EN_ROUTE', 'CANCELLED'],
  EN_ROUTE:             ['IN_PROGRESS', 'ARRIVED', 'CANCELLED'],
  IN_PROGRESS:          ['ARRIVED', 'COMPLETED', 'CANCELLED'],
  ARRIVED:              ['COMPLETED', 'CANCELLED'],
  READY_FOR_PICKUP:     ['ACTIVE', 'CANCELLED'],
  ACTIVE:               ['RETURNED', 'CANCELLED'],
  RETURNED:             ['COMPLETED', 'CANCELLED'],
  // Terminal — no outgoing transitions.
  COMPLETED:            [],
  CANCELLED:            [],
  REJECTED:             [],
  EXPIRED:              [],
  FAILED:               [],
};

/**
 * Returns true when a transition from `from` to `to` is allowed by the
 * lifecycle state machine. Unknown states are treated as having no allowed
 * transitions (fail-closed).
 */
export function canTransition(from: SupplierState, to: SupplierState): boolean {
  const allowed = TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Returns the set of states reachable from `from`, useful for UI hints
 * (e.g. greying out invalid status buttons in the supplier portal).
 */
export function allowedTransitions(from: SupplierState): SupplierState[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Throws a 409 when `from → to` is not a legal lifecycle step. Shared by both
 * supplier routes (/respond and /status) so neither can complete — and pay out
 * — a booking that never went through acceptance and delivery.
 */
export function assertTransition(from: SupplierState, to: SupplierState): void {
  if (canTransition(from, to)) return;
  const err = new Error(`Cannot transition from "${from}" to "${to}".`) as Error & {
    status?: number;
    details?: Record<string, unknown>;
  };
  err.status = 409;
  err.details = { currentState: from, requestedState: to };
  throw err;
}
