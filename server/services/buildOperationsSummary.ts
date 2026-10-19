import type { TripEntity, BookingEntity, LedgerEntryEntity } from '../db/schema';

export interface OperationsSummary {
  activeTrips: number;
  pendingBookings: number;
  pendingSupplierConfirmations: number;
  paymentIssues: number;
  atRiskTrips: number;
}

const ACTIVE_TRIP_STATUSES: TripEntity['status'][] = ['PLANNED', 'CONFIRMED', 'IN_DESTINATION'];
const UNCAPTURED_PAYMENT_STATES: BookingEntity['paymentState'][] = ['INITIATED', 'PENDING'];
const BLOCKING_BOOKING_STATES: BookingEntity['supplierState'][] = ['REJECTED', 'CANCELLED'];

/**
 * Build the summary counters the Command Center drives its Overview cards and
 * badge polls from. Counts are derived from the authoritative trip/booking/
 * ledger collections rather than from a hand-maintained counter, so a loaded
 * dashboard reflects the real store.
 *
 * A trip is "at risk" when it is still active but carries a booking that has
 * fallen over (rejected or cancelled by the supplier), since that means the
 * traveler's plan is quietly broken until an operator intervenes.
 */
export function buildOperationsSummary(
  trips: TripEntity[],
  bookings: BookingEntity[],
  ledgerEntries: LedgerEntryEntity[]
): OperationsSummary {
  const activeTrips = trips.filter((t) => ACTIVE_TRIP_STATUSES.includes(t.status)).length;
  const pendingBookings = bookings.filter((b) => UNCAPTURED_PAYMENT_STATES.includes(b.paymentState)).length;
  const pendingSupplierConfirmations = bookings.filter(
    (b) => b.supplierState === 'PENDING_CONFIRMATION'
  ).length;
  const paymentIssues = ledgerEntries.filter((e) => e.status === 'PENDING').length;

  const brokenTripIds = new Set(
    bookings
      .filter((b) => BLOCKING_BOOKING_STATES.includes(b.supplierState))
      .map((b) => b.tripId)
  );
  const activeTripSet = new Set(
    trips.filter((t) => ACTIVE_TRIP_STATUSES.includes(t.status)).map((t) => t.id)
  );
  const atRiskTrips = [...brokenTripIds].filter((id) => activeTripSet.has(id)).length;

  return {
    activeTrips,
    pendingBookings,
    pendingSupplierConfirmations,
    paymentIssues,
    atRiskTrips,
  };
}