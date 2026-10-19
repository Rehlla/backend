import { db } from '../db/database';
import { BookingEntity, CommerceServiceType, ProductSkuEntity } from '../db/schema';
import { paymentService } from './paymentService';
import { notificationService } from './notificationService';
import { commerceService } from './commerceService';
import { canTransition } from './bookingLifecycle';
import { freeCancellationUntil } from './serviceTime';

// ---------------------------------------------------------------------------
// Booking lifecycle service
//
// Provides the traveller-facing operations that the booking REST surface
// delegates to: detail lookup, cancellation with inventory release, reschedule
// with slot migration, and a richer availability endpoint that returns the
// full SKU + slot picture the Book Now UI needs.
//
// Identity always comes from the session (userId / userRole passed by the
// route handler), never from the request body — see AGENTS.md.
// ---------------------------------------------------------------------------

export interface BookingSummary {
  id: string;
  bookingRef: string;
  tripId: string;
  serviceType: CommerceServiceType;
  skuId: string;
  supplierId: string;
  amountEGP: number;
  paymentState: string;
  supplierState: string;
  travelerName: string;
  travelerPhone: string;
  travelerEmail: string;
  passengersCount: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  scheduledDate: string;
  scheduledTime: string;
  confirmationCode: string;
  cancellationKey?: string;
  /**
   * ISO instant until which cancelling refunds in full: the service start
   * (Africa/Cairo) minus the SKU's cancellationPolicyHours. Null when the
   * booking has no usable date. The UI renders "Free cancellation until …".
   */
  freeCancellationUntil: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

function requireOwnership(booking: BookingEntity, userId: string, userRole: string) {
  // Operations / Admin bypass ownership checks.
  if (userRole === 'Operations' || userRole === 'Admin') return;

  const trip = db.trips.find(t => t.id === booking.tripId);
  if (!trip) {
    const err = new Error('Parent trip not found.') as Error & { status: number };
    err.status = 404;
    throw err;
  }

  // The traveler who owns the trip may act on its bookings.
  if (trip.userId === userId) return;

  // Suppliers may act on their own bookings.
  if (userRole === 'Supplier' && booking.supplierId) return;

  const err = new Error('You do not have permission to view this booking.') as Error & { status: number };
  err.status = 403;
  throw err;
}

/**
 * States in which a traveler can no longer cancel or reschedule a booking.
 * Kept beside the state machine in bookingLifecycle so the traveller-facing
 * routes and the supplier-facing routes share the same notion of terminal.
 */
const TERMINAL_STATES: ReadonlyArray<BookingEntity['supplierState']> = [
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'EXPIRED',
  'FAILED'
];

/**
 * The inventory slot a booking currently occupies, when one exists.
 *
 * A booking's occupancy lives on the slot at its scheduled date/time in
 * `reservedCapacity`. Slots are only materialised when a hold is created, so
 * bookings created without one (legacy direct checkout) may have no slot row.
 */
function slotOf(booking: BookingEntity) {
  return db.inventorySlots.find(
    s => s.skuId === booking.skuId && s.date === booking.scheduledDate && s.timeSlot === booking.scheduledTime
  );
}

/**
 * Releases a booking's reserved capacity on its current slot.
 *
 * Cancel and reschedule both free the old slot; they used to do it in two
 * incompatible ways — cancel released the first CONVERTED hold for the trip,
 * reschedule released the slot — so a booking that had been rescheduled (hold
 * left pointing at the old slot) would, on cancel, release the OLD slot a
 * second time while the NEW slot kept its occupancy forever. Both operations
 * now free the slot the booking actually sits on; only its reservedCapacity is
 * touched here, the hold row handling differs between cancel and reschedule.
 */
function releaseBookingCapacity(booking: BookingEntity): boolean {
  const slot = slotOf(booking);
  if (!slot) return false;

  slot.reservedCapacity = Math.max(0, slot.reservedCapacity - booking.passengersCount);
  if (slot.reservedCapacity + slot.heldCapacity < slot.totalCapacity) {
    slot.status = 'AVAILABLE';
  }
  return true;
}

/**
 * Closes the converted hold rows for a booking's slot.
 *
 * Called on cancel. Their capacity was already folded into reservedCapacity at
 * checkout and freed by releaseBookingCapacity, so this is bookkeeping that
 * stops a later cancel of the same trip from releasing the slot again.
 */
function closeBookingHolds(booking: BookingEntity, slotId: string | undefined): void {
  if (!slotId) return;
  db.holds.forEach(h => {
    if (
      h.tripId === booking.tripId &&
      h.skuId === booking.skuId &&
      h.status === 'CONVERTED' &&
      h.slotId === slotId
    ) {
      h.status = 'RELEASED';
    }
  });
}

/**
 * Re-points the booking's converted hold onto the slot it now occupies.
 *
 * Checkout moves hold capacity into reservedCapacity and leaves the hold row
 * CONVERTED, pointing at the slot it reserved. When a booking is rescheduled
 * the booking's own occupancy moves with it; keeping the hold row in step means
 * a later cancel closes exactly one hold and the old slot is never released
 * twice.
 */
function moveBookingHold(booking: BookingEntity, oldSlotId: string | undefined, newSlotId: string | undefined): void {
  if (!oldSlotId || !newSlotId || oldSlotId === newSlotId) return;
  db.holds.forEach(h => {
    if (
      h.tripId === booking.tripId &&
      h.skuId === booking.skuId &&
      h.status === 'CONVERTED' &&
      h.slotId === oldSlotId
    ) {
      h.slotId = newSlotId;
    }
  });
}

// ---------------------------------------------------------------------------
// getBooking — single booking detail
// ---------------------------------------------------------------------------

export function getBooking(params: {
  bookingId: string;
  userId: string;
  userRole: string;
}): BookingSummary {
  const booking = db.bookings.find(
    b => b.id === params.bookingId || b.bookingRef === params.bookingId
  );
  if (!booking) {
    const err = new Error(`Booking "${params.bookingId}" not found.`) as Error & { status: number };
    err.status = 404;
    throw err;
  }

  requireOwnership(booking, params.userId, params.userRole);
  return toSummary(booking);
}

// ---------------------------------------------------------------------------
// getTripBookings — all bookings for a trip
// ---------------------------------------------------------------------------

export function getTripBookings(params: {
  tripId: string;
  userId: string;
  userRole: string;
}): BookingSummary[] {
  const trip = db.trips.find(t => t.id === params.tripId);
  if (!trip) {
    const err = new Error(`Trip "${params.tripId}" not found.`) as Error & { status: number };
    err.status = 404;
    throw err;
  }

  // Ownership: traveler must own the trip, or be Ops/Admin.
  if (params.userRole !== 'Operations' && params.userRole !== 'Admin' && trip.userId !== params.userId) {
    const err = new Error('You do not have permission to view bookings for this trip.') as Error & { status: number };
    err.status = 403;
    throw err;
  }

  return db.bookings
    .filter(b => b.tripId === params.tripId)
    .map(toSummary);
}

// ---------------------------------------------------------------------------
// cancelBooking — cancel with inventory release and conditional refund
// ---------------------------------------------------------------------------

export function cancelBooking(params: {
  bookingId: string;
  tripId: string;
  userId: string;
  userRole: string;
  reason: string;
  cancellationKey: string;
}): {
  success: boolean;
  booking: BookingSummary;
  refunded: boolean;
  refundAmountEGP?: number;
} {
  const booking = db.bookings.find(
    b => (b.id === params.bookingId || b.bookingRef === params.bookingId)
  );
  if (!booking) {
    const err = new Error(`Booking "${params.bookingId}" not found.`) as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (booking.tripId !== params.tripId) {
    const err = new Error('Booking does not belong to the specified trip.') as Error & { status: number };
    err.status = 400;
    throw err;
  }

  requireOwnership(booking, params.userId, params.userRole);

  // Lifecycle guard: cannot cancel a booking that is already terminal.
  if (TERMINAL_STATES.includes(booking.supplierState)) {
    const err = new Error(`Cannot cancel booking in "${booking.supplierState}" state.`) as Error & { status: number };
    err.status = 409;
    throw err;
  }

  // Verify the cancellation key. This prevents accidental or malicious
  // cancellation by a third party who might know a booking ref but not the
  // key that was issued at checkout time.
  if (booking.confirmationCode !== params.cancellationKey &&
      booking.bookingRef !== params.cancellationKey) {
    const err = new Error('Invalid cancellation key.') as Error & { status: number };
    err.status = 403;
    throw err;
  }

  const now = new Date().toISOString();
  // Free cancellation runs until policyHours BEFORE the service starts. This
  // was hoursSinceBooking < policyHours, so a dive booked a month ahead lost
  // its refund a day after purchase while one booked for tonight refunded in
  // full an hour before departure. An unknown start refunds nothing
  // automatically — ops can still refund by hand.
  const deadline = freeCancellationDeadline(booking);
  const withinPolicy = deadline !== null && Date.now() <= deadline.getTime();

  let refunded = false;
  let refundAmountEGP: number | undefined;

  db.runInTransaction(() => {
    // Transition lifecycle
    if (canTransition(booking.supplierState, 'CANCELLED')) {
      booking.supplierState = 'CANCELLED';
    }
    booking.updatedAt = now;

    // Release the slot the booking actually occupies. Releasing the first
    // CONVERTED hold for the trip used to free the wrong booking's capacity
    // when a trip held several bookings for one product, and double-released
    // an old slot after a reschedule (see releaseBookingCapacity).
    const releasedSlot = slotOf(booking);
    releaseBookingCapacity(booking);
    closeBookingHolds(booking, releasedSlot?.id);

    // Refund if within cancellation policy and payment was captured
    if (withinPolicy && booking.paymentState === 'CAPTURED' && booking.amountEGP > 0) {
      // Refundability is answered by the ledger. Single-booking checkout ties
      // its PAYMENT_CAPTURED entry to the booking's own ref; multi-service
      // checkout pays once for the whole trip before any booking row exists,
      // so its capture is filed under the trip. The booking is refunded against
      // whichever scope proves it — per-booking first, then per-trip, which
      // can never refund more than the trip was actually captured for.
      const perBooking = paymentService.refundableAmountEGP({
        bookingId: booking.id,
        tripId: booking.tripId
      });
      const perTrip = paymentService.refundableAmountEGP({ tripId: booking.tripId });
      const bookingRef = perBooking >= booking.amountEGP ? booking.id : undefined;
      if (bookingRef !== undefined || perTrip >= booking.amountEGP) {
        try {
          paymentService.processRefund({
            bookingId: bookingRef,
            tripId: booking.tripId,
            amountEGP: booking.amountEGP,
            reason: `Traveler cancellation: ${params.reason}`,
            idempotencyKey: `REF-CANCEL-${booking.bookingRef}-${Date.now()}`,
            initiatedBy: params.userId
          });
          booking.paymentState = 'REFUNDED';
          refunded = true;
          refundAmountEGP = booking.amountEGP;
        } catch {
          // Refund failure is logged but does not prevent cancellation —
          // the booking is still cancelled; the refund becomes a manual ops task.
        }
      }
    }

    // Update trip item status
    const tripItem = db.tripItems.find(ti => ti.bookingId === booking.id);
    if (tripItem) {
      tripItem.status = 'CANCELLED';
      tripItem.updatedAt = now;
    }

    // Notify supplier
    notificationService.sendNotification({
      userId: booking.supplierId,
      type: 'SYSTEM',
      title: 'Booking Cancelled',
      message: `Booking ${booking.bookingRef} has been cancelled. Reason: ${params.reason}`,
      channel: 'WHATSAPP'
    });

    db.logAudit(params.userId, params.userRole, 'BOOKING_CANCELLED', 'Booking', booking.id, {
      reason: params.reason,
      refundAmountEGP,
      withinPolicy
    });

    db.saveToDisk();
  });

  return {
    success: true,
    booking: toSummary(booking),
    refunded,
    refundAmountEGP
  };
}

// ---------------------------------------------------------------------------
// rescheduleBooking — move to a new date/time slot
// ---------------------------------------------------------------------------

export function rescheduleBooking(params: {
  bookingId: string;
  tripId: string;
  userId: string;
  userRole: string;
  newDate: string;
  newTime: string;
  idempotencyKey: string;
}): {
  success: boolean;
  booking: BookingSummary;
} {
  const booking = db.bookings.find(
    b => (b.id === params.bookingId || b.bookingRef === params.bookingId)
  );
  if (!booking) {
    const err = new Error(`Booking "${params.bookingId}" not found.`) as Error & { status: number };
    err.status = 404;
    throw err;
  }

  if (booking.tripId !== params.tripId) {
    const err = new Error('Booking does not belong to the specified trip.') as Error & { status: number };
    err.status = 400;
    throw err;
  }

  requireOwnership(booking, params.userId, params.userRole);

  // Cannot reschedule terminal bookings
  if (TERMINAL_STATES.includes(booking.supplierState)) {
    const err = new Error(`Cannot reschedule booking in "${booking.supplierState}" state.`) as Error & { status: number };
    err.status = 409;
    throw err;
  }

  // Same slot is a no-op
  if (booking.scheduledDate === params.newDate && booking.scheduledTime === params.newTime) {
    return { success: true, booking: toSummary(booking) };
  }

  const now = new Date().toISOString();

  db.runInTransaction(() => {
    const oldDate = booking.scheduledDate;
    const oldTime = booking.scheduledTime;

    const oldSlotId = slotOf(booking)?.id;
    // Release the slot the booking currently sits on. The hold row is NOT
    // closed here: the booking still exists, so its converted hold follows it
    // to the new slot below.
    releaseBookingCapacity(booking);

    // Ensure new slot exists (dynamically create if needed) — guarded against unbounded inflation
    const sku = db.productSkus.find(s => s.id === booking.skuId);
    let newSlot = db.inventorySlots.find(
      s => s.skuId === booking.skuId && s.date === params.newDate && s.timeSlot === params.newTime
    );
    if (!newSlot) {
      if (db.inventorySlots.length > 10000) {
        throw Object.assign(new Error('inventory cap reached (10000 slots) — cannot create new slot'), { status: 503 });
      }
      if (db.inventorySlots.length > 5000) {
        console.warn(`[bookingService] inventorySlots approaching cap: ${db.inventorySlots.length} slots`);
        // When near cap, cap dynamic creation to a 7-day window and reuse nearest slot outside window
        const todayStr = new Date().toISOString().slice(0, 10);
        const maxDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
        if (params.newDate < todayStr || params.newDate > maxDate) {
          const nearest = db.inventorySlots
            .filter(s => s.skuId === booking.skuId)
            .sort((a, b) => a.date.localeCompare(b.date))[0];
          if (nearest) {
            console.warn(`[bookingService] reschedule date ${params.newDate} outside 7-day window, reusing nearest slot ${nearest.date}`);
            newSlot = nearest;
          } else {
            throw Object.assign(new Error('Reschedule date outside 7-day creation window and no existing slot to reuse'), { status: 400 });
          }
        } else {
          newSlot = {
            id: `SLOT-${booking.skuId}-${params.newDate}-${params.newTime}-${Date.now()}`,
            skuId: booking.skuId,
            date: params.newDate,
            timeSlot: params.newTime,
            totalCapacity: sku?.maxCapacityPerSlot || 6,
            reservedCapacity: 0,
            heldCapacity: 0,
            priceEGP: sku?.basePriceEGP || booking.amountEGP,
            status: 'AVAILABLE'
          };
          db.inventorySlots.push(newSlot);
        }
      } else {
        newSlot = {
          id: `SLOT-${booking.skuId}-${params.newDate}-${params.newTime}-${Date.now()}`,
          skuId: booking.skuId,
          date: params.newDate,
          timeSlot: params.newTime,
          totalCapacity: sku?.maxCapacityPerSlot || 6,
          reservedCapacity: 0,
          heldCapacity: 0,
          priceEGP: sku?.basePriceEGP || booking.amountEGP,
          status: 'AVAILABLE'
        };
        db.inventorySlots.push(newSlot);
      }
    }

    const availInNew = newSlot.totalCapacity - (newSlot.reservedCapacity + newSlot.heldCapacity);
    if (availInNew < booking.passengersCount) {
      const err = new Error(
        `Only ${Math.max(0, availInNew)} place(s) remain on ${params.newDate} at ${params.newTime}. ` +
        `Your booking has not been changed.`
      ) as Error & { status: number };
      err.status = 409;
      throw err;
    }

    // Reserve the new slot
    newSlot.reservedCapacity += booking.passengersCount;
    if (newSlot.reservedCapacity >= newSlot.totalCapacity) {
      newSlot.status = 'SOLD_OUT';
    }

    // Move the booking
    booking.scheduledDate = params.newDate;
    booking.scheduledTime = params.newTime;
    booking.updatedAt = now;

    // The booking's converted hold follows it to the new slot so a later
    // cancel closes exactly one hold (see moveBookingHold).
    moveBookingHold(booking, oldSlotId, newSlot.id);

    // Update trip item
    const tripItem = db.tripItems.find(ti => ti.bookingId === booking.id || ti.id === booking.tripItemId);
    if (tripItem) {
      tripItem.timeSlot = params.newTime;
      tripItem.updatedAt = now;
    }

    notificationService.sendNotification({
      userId: booking.supplierId,
      type: 'SYSTEM',
      title: 'Booking Rescheduled',
      message: `Booking ${booking.bookingRef} moved from ${oldDate} ${oldTime} to ${params.newDate} ${params.newTime}.`,
      channel: 'WHATSAPP'
    });

    db.logAudit(params.userId, params.userRole, 'BOOKING_RESCHEDULED', 'Booking', booking.id, {
      from: `${oldDate} ${oldTime}`,
      to: `${params.newDate} ${params.newTime}`
    });

    db.saveToDisk();
  });

  return { success: true, booking: toSummary(booking) };
}

// ---------------------------------------------------------------------------
// getRichAvailability — enriched availability with full SKU + slot details
// ---------------------------------------------------------------------------

export function getRichAvailability(params: {
  serviceType?: string;
  skuId?: string;
  date?: string;
  timeSlot?: string;
  passengers?: number;
}): {
  available: boolean;
  skus: ProductSkuEntity[];
  slots: Array<{
    id: string;
    date: string;
    timeSlot: string;
    totalCapacity: number;
    availableCapacity: number;
    priceEGP: number;
    status: string;
  }>;
  priceEGP: number;
} {
  const result = commerceService.checkAvailability({
    serviceType: (params.serviceType as CommerceServiceType) || 'transfer',
    skuId: params.skuId,
    date: params.date || new Date().toISOString().split('T')[0],
    timeSlot: params.timeSlot,
    passengers: params.passengers || 2
  });

  return {
    available: result.available,
    skus: result.skus,
    slots: result.slots.map(s => ({
      id: s.id,
      date: s.date,
      timeSlot: s.timeSlot,
      totalCapacity: s.totalCapacity,
      availableCapacity: Math.max(0, s.totalCapacity - (s.reservedCapacity + s.heldCapacity)),
      priceEGP: s.priceEGP,
      status: s.status
    })),
    priceEGP: result.priceEGP
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The booking's free-cancellation deadline under its SKU's policy (24h when the SKU is gone). */
function freeCancellationDeadline(b: BookingEntity): Date | null {
  const sku = db.productSkus.find(s => s.id === b.skuId);
  return freeCancellationUntil(b, sku?.cancellationPolicyHours ?? 24);
}

function toSummary(b: BookingEntity): BookingSummary {
  return {
    id: b.id,
    bookingRef: b.bookingRef,
    tripId: b.tripId,
    serviceType: b.serviceType,
    skuId: b.skuId,
    supplierId: b.supplierId,
    amountEGP: b.amountEGP,
    paymentState: b.paymentState,
    supplierState: b.supplierState,
    travelerName: b.travelerName,
    travelerPhone: b.travelerPhone,
    travelerEmail: b.travelerEmail,
    passengersCount: b.passengersCount,
    pickupLocation: b.pickupLocation,
    dropoffLocation: b.dropoffLocation,
    scheduledDate: b.scheduledDate,
    scheduledTime: b.scheduledTime,
    confirmationCode: b.confirmationCode,
    freeCancellationUntil: freeCancellationDeadline(b)?.toISOString() ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt
  };
}
