import crypto from 'crypto';
import { db } from '../db/database';
import { distributedLockService } from './distributedLockService';
import { ledgerService } from './ledgerService';
import { notificationService } from './notificationService';
import {
  STAY_DEPOSIT_PERCENT,
  QUOTE_TTL_MINUTES,
  StayQuoteError,
  assertCheckInNotPast,
  dahabToday,
  quoteStay,
} from './hotelPricingService';
import { checkStay } from './hotelAvailabilityService';
import { DEFAULT_PAYEE_PHONE, normaliseEgyptMobile, walletPayee } from './walletPayeeService';
import type {
  HotelBookingEntity,
  HotelGuestDetail,
  HotelPaymentInstructions,
  HotelPaymentMethod,
  HotelPriceBreakdown,
} from '../db/schema';

/**
 * The life of a stay: reserve, pay a deposit offline, get confirmed, arrive.
 *
 * The platform moves no money. The traveller pays the deposit outside the
 * system — instapay, a wallet, cash at the property — and staff record that it
 * arrived. That makes two transitions human rather than automatic, and the
 * state machine below is built around that honestly rather than pretending a
 * webhook confirmed something nobody verified.
 *
 *   PENDING_PAYMENT ──markPaid──▶ PENDING_CONFIRMATION ──approve──▶ CONFIRMED
 *          │                            │
 *          ├── expires ──▶ EXPIRED      ├── reject ──▶ REJECTED (+refund)
 *          └── cancel ──▶ CANCELLED     └── cancel ──▶ CANCELLED (+refund if in window)
 *
 * Inventory is never decremented anywhere in this file. A booking holds its
 * nights by existing with a status that hotelAvailabilityService counts; a
 * cancel releases them by becoming a status it does not count. One source of
 * truth, no counters to drift.
 */

/** How long a payment hold keeps its rooms after reserving. */
export const STAY_HOLD_MINUTES = 30;

/** How a traveller pays a deposit, as a runtime list the route validators can
 *  enum against. Mirrors HotelPaymentMethod. */
export const STAY_PAYMENT_METHODS = [
  'CASH_ON_ARRIVAL',
  'CASH_AT_PROPERTY',
  'INSTAPAY',
  'VODAFONE_CASH',
  'BANK_TRANSFER',
] as const satisfies readonly HotelPaymentMethod[];

/**
 * Where the deposit is paid. The property rows carry no contact details — the
 * catalogue has never had them — so until admin fills real property numbers
 * (Phase 7's queue), the deposit is collected through the platform's own
 * concierge line and instructions say so plainly.
 */
const PLATFORM_DEPOSIT_CONTACT = DEFAULT_PAYEE_PHONE;

const DEPOSIT_INSTRUCTIONS: Record<HotelPaymentMethod, { en: string; ar: string }> = {
  CASH_ON_ARRIVAL: {
    en: 'No deposit now — pay the full amount at the property on arrival.',
    ar: 'مفيش عربون دلوقتي — ادفع المبلغ كامل في العقار يوم الوصول.',
  },
  CASH_AT_PROPERTY: {
    en: 'Pay the deposit in cash at the property reception and quote your reference.',
    ar: 'ادفع العربون كاش في استقبال العقار واذكر رقم الحجز.',
  },
  INSTAPAY: {
    en: 'Send the deposit by InstaPay to {phone} and write {ref} in the note. Then tell us the number you paid from.',
    ar: 'ابعت العربون InstaPay على {phone} واكتب {ref} في الملاحظة. بعدها قولنا الرقم اللي دفعت منه.',
  },
  VODAFONE_CASH: {
    en: 'Send the deposit by Vodafone Cash to {phone}. Then tell us the number you paid from.',
    ar: 'ابعت العربون فودافون كاش على {phone}. بعدها قولنا الرقم اللي دفعت منه.',
  },
  BANK_TRANSFER: {
    en: `Transfer the deposit and quote reference {ref} — confirmation follows once it is seen.`,
    ar: `حوّل العربون واذكر رقم الحجز {ref} — التأكيد بيجي أول ما الرصيد يوصل.`,
  },
};

export class StayBookingError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(message: string, code: string, details: Record<string, unknown> = {}, status = 400) {
    super(message);
    this.name = 'StayBookingError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

// Dahab's date, not UTC: a booking made at 1am in Cairo used to carry
// yesterday's date in its reference.
const bookingRef = () =>
  `HTL-${dahabToday().replace(/-/g, '')}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

const confirmationCode = () =>
  `DHB-HTL-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const nowIso = () => new Date().toISOString();

function findBooking(ref: string): HotelBookingEntity | undefined {
  return db.hotelBookings.find(b => b.bookingRef === ref || b.id === ref);
}

function requireBooking(ref: string): HotelBookingEntity {
  const booking = findBooking(ref);
  if (!booking) {
    throw new StayBookingError('No reservation with that reference.', 'UNKNOWN_BOOKING', { ref }, 404);
  }
  return booking;
}

/** The traveller may act on their own stay; Operations and Admin may act on any. */
function mayActOnStay(
  actor: { userId: string; role: string } | null | undefined,
  booking: HotelBookingEntity
): boolean {
  if (!actor) return false;
  return actor.role === 'Operations' || actor.role === 'Admin' || booking.userId === actor.userId;
}

/**
 * A payment hold past its deadline releases its rooms. Run opportunistically —
 * availability already treats an expired hold as released, so this sweep only
 * moves the row's status so the bookings queue stops showing dead reservations.
 */
export function releaseExpiredStayHolds(): number {
  const now = nowIso();
  let released = 0;
  db.runInTransaction(() => {
    for (const b of db.hotelBookings) {
      if (
        b.status === 'PENDING_PAYMENT' &&
        b.holdExpiresAt !== undefined &&
        b.holdExpiresAt <= now
      ) {
        b.status = 'EXPIRED';
        b.updatedAt = now;
        released += 1;
        notificationService.sendNotification({
          userId: b.userId,
          type: 'SYSTEM',
          title: 'Reservation lapsed',
          message: `The payment window for ${b.bookingRef} closed before a deposit was recorded. If you already paid, reply with your receipt and we will restore it if the rooms are still free.`,
          metadata: { bookingRef: b.bookingRef },
        });
      }
    }
  });
  return released;
}

export interface ReserveStayParams {
  accommodationId: string;
  roomTypeId: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  adults: number;
  children: number;
  guestDetails?: HotelGuestDetail[];
  specialRequests?: string;
  arrivalTime?: string;
  paymentMethod: HotelPaymentMethod;
  idempotencyKey: string;
  /** The traveller's trip this stay belongs to, already checked as theirs by
   *  the route. Absent for a stay booked straight from a hotel page. */
  tripId?: string;
}

/**
 * Holds the rooms and opens a reservation awaiting its deposit.
 *
 * The lock is taken before anything is measured: the availability check and the
 * insert both happen inside it, so two travellers asking for the last room of a
 * night are serialised rather than both told yes. Everything is one transaction,
 * so a refusal leaves no half-written row behind.
 */
export function reserveStay(
  params: ReserveStayParams,
  traveler: { userId: string; name: string; phone: string; email: string }
): HotelBookingEntity {
  // Dead payment holds release before anything is measured, so a room freed by
  // an expired hold is bookable in the same breath it stops being held.
  releaseExpiredStayHolds();

  const roomType = db.roomTypes.find(r => r.id === params.roomTypeId);
  if (!roomType || roomType.accommodationId !== params.accommodationId) {
    throw new StayBookingError(
      'This room type does not exist for the selected property.',
      'UNKNOWN_ROOM_TYPE',
      { roomTypeId: params.roomTypeId, accommodationId: params.accommodationId },
      404
    );
  }

  // A retried submit replays the reservation it already made rather than
  // holding the same nights twice under two references.
  // Scoped to the caller: a key is the client's retry token, not a lookup
  // handle — another account sending the same key must never get this row.
  const existing = db.hotelBookings.find(
    b => b.idempotencyKey === params.idempotencyKey && b.userId === traveler.userId
  );
  if (existing) return existing;

  assertCheckInNotPast(params.checkIn);

  const lockKey = `lock:stay:${roomType.id}`;
  const lease = distributedLockService.tryAcquire(lockKey, 5000);
  if (!lease) {
    throw new StayBookingError(
      'That room is being booked by someone else right now — try again in a moment.',
      'ROOM_LOCKED',
      { roomTypeId: roomType.id },
      409
    );
  }

  try {
    let booking!: HotelBookingEntity;
    db.runInTransaction(() => {
      // Re-priced here, not trusted from the page: the snapshot on this row is
      // what the traveller owes, and it is computed under the same lock that
      // guarantees the rooms are still there.
      const quote = quoteStay({
        accommodationId: params.accommodationId,
        roomTypeId: params.roomTypeId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        rooms: params.rooms,
        adults: params.adults,
        children: params.children,
      });

      const availability = checkStay({
        accommodationId: params.accommodationId,
        roomTypeId: params.roomTypeId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        rooms: params.rooms,
      });
      if (!availability.available) {
        throw new StayBookingError(
          availability.unavailableReason === 'NIGHT_CLOSED'
            ? 'Part of this stay is not available for sale.'
            : 'Those rooms were just taken for part of your dates.',
          availability.unavailableReason ?? 'TOO_MANY_ROOMS',
          { firstUnavailableDate: availability.firstUnavailableDate },
          409
        );
      }

      const now = nowIso();
      const method = params.paymentMethod;
      const instruction = DEPOSIT_INSTRUCTIONS[method];
      // One reference for everything the traveller sees and quotes: it used to
      // be generated twice, so the payment instructions named a reference that
      // matched no booking.
      const ref = bookingRef();
      // Cash on arrival takes no deposit, so there is nothing to wait 30
      // minutes for: the stay goes straight to the property for approval, the
      // whole amount is due at the desk, and no payment hold can expire it.
      // (With a hold, every cash-on-arrival booking used to lapse unpaid.)
      const noDeposit = method === 'CASH_ON_ARRIVAL';
      const holdExpiresAt = noDeposit ? undefined : new Date(Date.now() + STAY_HOLD_MINUTES * 60_000).toISOString();
      const depositEGP = noDeposit ? 0 : quote.depositEGP;
      const balanceDueEGP = noDeposit ? quote.totalEGP : quote.balanceDueEGP;
      // Wallet deposits name the real wallet (and, for Vodafone Cash, the
      // dial code that pre-fills it); everything else keeps the concierge line.
      const payee = walletPayee(method, depositEGP);
      const contactPhone = payee?.phone ?? PLATFORM_DEPOSIT_CONTACT;
      const fill = (text: string) => text.replace('{ref}', ref).replace('{phone}', payee?.localPhone ?? contactPhone);

      booking = {
        id: `HBS-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
        bookingRef: ref,
        accommodationId: roomType.accommodationId,
        roomTypeId: roomType.id,
        skuId: roomType.skuId,
        supplierId: roomType.supplierId,
        tripId: params.tripId ?? '',
        userId: traveler.userId,
        travelerName: traveler.name,
        travelerPhone: traveler.phone,
        travelerEmail: traveler.email,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        nights: quote.nights,
        rooms: params.rooms,
        adults: params.adults,
        children: params.children,
        guestDetails: params.guestDetails ?? [],
        specialRequests: params.specialRequests,
        arrivalTime: params.arrivalTime,
        status: noDeposit ? 'PENDING_CONFIRMATION' : 'PENDING_PAYMENT',
        paymentState: 'INITIATED',
        depositPercent: noDeposit ? 0 : STAY_DEPOSIT_PERCENT,
        depositEGP,
        balanceDueEGP,
        paymentInstructions: {
          method,
          amountEGP: depositEGP,
          reference: ref,
          // Dahab's calendar day, like every other date the guest sees.
          deadline: holdExpiresAt ? dahabToday(new Date(holdExpiresAt)) : params.checkIn,
          contactPhone,
          ...(payee ? { payee } : {}),
          instructions: fill(instruction.en),
          instructionsAr: fill(instruction.ar),
        },
        priceBreakdown: {
          nights: quote.nights,
          nightsDetail: quote.nightsDetail,
          baseEGP: quote.baseEGP,
          longStayDiscountEGP: quote.longStayDiscountEGP,
          serviceFeeEGP: quote.serviceFeeEGP,
          taxEGP: quote.taxEGP,
          totalEGP: quote.totalEGP,
          currency: 'EGP',
          depositEGP,
          balanceDueEGP,
        } satisfies HotelPriceBreakdown,
        cancellationPolicyHours: roomType.cancellationPolicyHours,
        freeCancellationUntil: quote.freeCancellationUntil,
        holdExpiresAt,
        idempotencyKey: params.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      };

      db.hotelBookings.push(booking);
    });

    return booking;
  } finally {
    distributedLockService.release(lease);
  }
}

/**
 * The traveller shows how they paid. Nothing is confirmed by this — proof is a
 * claim until staff see the money, so the status does not move here.
 */
export function recordPaymentProof(
  ref: string,
  actor: { userId: string; role: string },
  input: { proofUrl: string; method?: HotelPaymentMethod; reference?: string }
): HotelBookingEntity {
  const booking = requireBooking(ref);
  if (!mayActOnStay(actor, booking)) {
    throw new StayBookingError('This reservation is not yours to amend.', 'NOT_YOUR_BOOKING', {}, 403);
  }
  if (booking.status !== 'PENDING_PAYMENT') {
    throw new StayBookingError(
      'This reservation is not waiting for a deposit.',
      'NOT_PENDING_PAYMENT',
      { status: booking.status },
      409
    );
  }
  if (
    booking.status === 'PENDING_PAYMENT' &&
    booking.holdExpiresAt !== undefined &&
    booking.holdExpiresAt <= nowIso()
  ) {
    throw new StayBookingError(
      'The payment window for this reservation has closed — please book again.',
      'HOLD_EXPIRED',
      { holdExpiresAt: booking.holdExpiresAt },
      409
    );
  }

  booking.paymentProofUrl = input.proofUrl;
  if (input.method) booking.paymentInstructions.method = input.method;
  // The traveller's transaction id is theirs to report, never a replacement
  // for the booking reference the desk matches transfers against.
  if (input.reference) booking.paymentInstructions.payerReference = input.reference;
  booking.paymentInstructions.claimedAt ??= nowIso();
  booking.updatedAt = nowIso();
  return booking;
}

/**
 * "I've sent it": the wallet number the deposit came from and, if the app
 * showed one, its transaction id. A wallet transfer lands in the payee app as
 * "from 010…", so this is what lets the desk match it without a screenshot.
 * Like a receipt it is a claim — the status waits for staff.
 */
export function claimWalletPayment(
  ref: string,
  actor: { userId: string; role: string },
  input: { payerNumber?: string; payerReference?: string }
): HotelBookingEntity {
  const booking = requireBooking(ref);
  if (!mayActOnStay(actor, booking)) {
    throw new StayBookingError('This reservation is not yours to amend.', 'NOT_YOUR_BOOKING', {}, 403);
  }
  // EXPIRED too: the sweep may lapse the hold while the traveller is still in
  // their wallet app, and markPaid accepts a lapsed hold if rooms remain.
  if (booking.status !== 'PENDING_PAYMENT' && booking.status !== 'EXPIRED') {
    throw new StayBookingError(
      'This reservation is not waiting for a deposit.',
      'NOT_PENDING_PAYMENT',
      { status: booking.status },
      409
    );
  }
  const payer = input.payerNumber ? normaliseEgyptMobile(input.payerNumber) : null;
  if (input.payerNumber && !payer) {
    throw new StayBookingError('Enter the Egyptian mobile number you paid from (01xxxxxxxxx).', 'INVALID_PAYER_NUMBER', {}, 400);
  }
  const reference = input.payerReference?.trim();
  if (!payer && !reference) {
    throw new StayBookingError('Add the number you paid from or the transaction id.', 'CLAIM_EMPTY', {}, 400);
  }

  // No hold check: money sent a minute after the window closed is still money
  // the desk must match, and markPaid re-checks the rooms for a lapsed hold.
  if (payer) booking.paymentInstructions.payerNumber = payer.localPhone;
  if (reference) booking.paymentInstructions.payerReference = reference;
  booking.paymentInstructions.claimedAt = nowIso();
  booking.updatedAt = nowIso();
  return booking;
}

/**
 * Staff have seen the deposit. The rooms move from "held" to "reserved" by the
 * status change alone, and the escrow entry records money the platform is
 * holding on the traveller's behalf until the stay is delivered.
 */
export function markPaid(
  ref: string,
  actor: { userId: string; role: string; },
  input: { method?: HotelPaymentMethod; reference?: string }
): HotelBookingEntity {
  const booking = requireBooking(ref);
  if (actor.role !== 'Operations' && actor.role !== 'Admin') {
    throw new StayBookingError('Only staff can record a deposit as received.', 'FORBIDDEN', {}, 403);
  }
  if (booking.status !== 'PENDING_PAYMENT' && booking.status !== 'EXPIRED') {
    throw new StayBookingError(
      'This reservation is not waiting for a deposit.',
      'NOT_PENDING_PAYMENT',
      { status: booking.status },
      409
    );
  }

  // A deposit that arrives after the hold lapsed: availability already counts
  // a lapsed hold as free, so those rooms may have been sold to someone else.
  // Take the late money only if the rooms are still there; otherwise refuse
  // rather than confirm a double booking.
  const lapsed =
    booking.status === 'EXPIRED' ||
    (booking.holdExpiresAt !== undefined && booking.holdExpiresAt <= nowIso());
  if (lapsed) {
    const stillFree = checkStay({
      accommodationId: booking.accommodationId,
      roomTypeId: booking.roomTypeId,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      rooms: booking.rooms,
    });
    if (!stillFree.available) {
      throw new StayBookingError(
        'The payment window closed and those rooms have since been taken — return the deposit or offer other dates.',
        'HOLD_EXPIRED_ROOMS_TAKEN',
        { holdExpiresAt: booking.holdExpiresAt, firstUnavailableDate: stillFree.firstUnavailableDate },
        409
      );
    }
  }

  const now = nowIso();
  booking.status = 'PENDING_CONFIRMATION';
  booking.paymentState = 'AUTHORIZED';
  booking.holdExpiresAt = undefined;
  booking.paidAt = now;
  if (input.method) booking.paymentInstructions.method = input.method;
  // The desk's transaction id sits beside the booking reference, never over
  // it: the traveller's page and every later lookup still quote the HTL ref.
  if (input.reference) booking.paymentInstructions.payerReference = input.reference;
  booking.updatedAt = now;

  ledgerService.recordDoubleEntry({
    transactionId: `TXN-STAY-${booking.id}`,
    idempotencyKey: `STAY-DEPOSIT-${booking.id}`,
    bookingRef: booking.bookingRef,
    tripId: booking.tripId || booking.bookingRef,
    type: 'HOLD_ESCROW',
    amountEGP: booking.depositEGP,
    debitAccount: `TRAVELER_${booking.paymentInstructions.method}`,
    creditAccount: 'PLATFORM_ESCROW_MAIN',
    metadata: { stage: 'deposit', method: booking.paymentInstructions.method },
  });

  notificationService.sendNotification({
    userId: booking.userId,
    type: 'PAYMENT_SUCCESS',
    title: 'Deposit received',
    message: `We have your deposit for ${booking.bookingRef}. The property is confirming your stay.`,
    metadata: { bookingRef: booking.bookingRef },
  });

  return booking;
}

/**
 * The property accepts or declines. Acceptance creates the commerce booking the
 * rest of the platform already speaks — trip items, the operations dashboard and
 * the ledger all light up without knowing stays exist.
 */
export function respondToStay(
  ref: string,
  actor: { userId: string; role: string; supplierId?: string },
  input: { approve: boolean; reason?: string }
): HotelBookingEntity {
  const booking = requireBooking(ref);
  // Staff, or the property itself — a Supplier account linked to the very
  // supplier the stay was booked with (the owner answering their own guest).
  const isStaff = actor.role === 'Operations' || actor.role === 'Admin';
  const isTheProperty = actor.role === 'Supplier' && !!actor.supplierId && actor.supplierId === booking.supplierId;
  if (!isStaff && !isTheProperty) {
    throw new StayBookingError('Only staff or the property can confirm or reject a stay.', 'FORBIDDEN', {}, 403);
  }
  if (booking.status !== 'PENDING_CONFIRMATION') {
    throw new StayBookingError(
      'Only a paid, unconfirmed reservation can be responded to.',
      'NOT_PENDING_CONFIRMATION',
      { status: booking.status },
      409
    );
  }

  const now = nowIso();

  if (!input.approve) {
    booking.status = 'REJECTED';
    booking.cancelReason = input.reason;
    booking.updatedAt = now;
    releaseDeposit(booking, 'The property could not take this stay.');
    notificationService.sendNotification({
      userId: booking.userId,
      type: 'EXCEPTION_ALERT',
      title: 'Stay declined',
      message: `${booking.bookingRef} was declined by the property${input.reason ? `: ${input.reason}` : '.'} Your deposit is being returned.`,
      metadata: { bookingRef: booking.bookingRef },
    });
    return booking;
  }

  booking.status = 'CONFIRMED';
  booking.confirmationCode = confirmationCode();
  booking.updatedAt = now;

  const code = booking.confirmationCode;
  const core: typeof db.bookings[number] = {
    id: booking.bookingRef,
    bookingRef: booking.bookingRef,
    tripId: booking.tripId || booking.bookingRef,
    tripItemId: undefined,
    supplierId: booking.supplierId,
    skuId: booking.skuId,
    serviceType: 'hotel',
    amountEGP: booking.priceBreakdown.totalEGP,
    paymentState: booking.paymentState,
    supplierState: 'CONFIRMED',
    travelerName: booking.travelerName,
    travelerPhone: booking.travelerPhone,
    travelerEmail: booking.travelerEmail,
    passengersCount: booking.adults + booking.children,
    pickupLocation: undefined,
    dropoffLocation: undefined,
    scheduledDate: booking.checkIn,
    scheduledTime: 'Standard Check-in 14:00',
    checkOut: booking.checkOut,
    nights: booking.nights,
    rooms: booking.rooms,
    roomTypeId: booking.roomTypeId,
    specialRequests: booking.specialRequests,
    confirmationCode: code,
    createdAt: now,
    updatedAt: now,
  };
  db.bookings.push(core);
  booking.bookingRefLinked = booking.bookingRef;

  if (booking.tripId) {
    const tripItem = db.tripItems.find(
      ti => ti.tripId === booking.tripId && ti.skuId === booking.skuId && !ti.bookingId && ti.status !== 'CANCELLED'
    );
    if (tripItem) {
      tripItem.status = 'CONFIRMED';
      tripItem.bookingId = core.id;
      tripItem.priceEGP = core.amountEGP;
      tripItem.updatedAt = now;
    } else {
      db.tripItems.push({
        id: `ITEM-${Date.now()}-HTL`,
        tripId: booking.tripId,
        serviceType: 'hotel',
        skuId: booking.skuId,
        title: `Stay — ${booking.checkIn} → ${booking.checkOut}`,
        dayNumber: 1,
        timeSlot: 'Standard Check-in 14:00',
        priceEGP: core.amountEGP,
        status: 'CONFIRMED',
        bookingId: core.id,
        createdAt: now,
        updatedAt: now,
      } as typeof db.tripItems[number]);
    }
  }

  notificationService.sendNotification({
    userId: booking.userId,
    type: 'SUPPLIER_CONFIRMED',
    title: 'Stay confirmed',
    message: `Your stay ${booking.bookingRef} is confirmed (${booking.checkIn} → ${booking.checkOut}). Code ${code}.`,
    metadata: { bookingRef: booking.bookingRef },
  });

  return booking;
}

/**
 * A confirmed stay also lives in `db.bookings` and, on a trip, `db.tripItems`
 * (see respondToStay). Cancelling or moving the stay used to leave both
 * untouched, so the operations views and the trip still showed a live booking
 * for a cancelled stay, or the old dates for a moved one.
 */
function syncLinkedRecords(booking: HotelBookingEntity): void {
  const now = nowIso();
  const core = db.bookings.find(b => b.id === booking.bookingRef);
  const cancelled = booking.status === 'CANCELLED';
  if (core) {
    if (cancelled) {
      core.supplierState = 'CANCELLED';
    } else {
      core.scheduledDate = booking.checkIn;
      core.checkOut = booking.checkOut;
      core.nights = booking.nights;
      core.amountEGP = booking.priceBreakdown.totalEGP;
    }
    core.paymentState = booking.paymentState;
    core.updatedAt = now;
  }
  for (const item of db.tripItems) {
    if (item.bookingId !== booking.bookingRef) continue;
    if (cancelled) {
      item.status = 'CANCELLED';
    } else {
      item.title = `Stay — ${booking.checkIn} → ${booking.checkOut}`;
      item.priceEGP = booking.priceBreakdown.totalEGP;
    }
    item.updatedAt = now;
  }
}

/** Moves the platform booking (and its trip item) with the stay's lifecycle. */
function setCoreSupplierState(booking: HotelBookingEntity, state: 'IN_PROGRESS' | 'COMPLETED'): void {
  const core = db.bookings.find(b => b.id === booking.bookingRef);
  if (core) {
    core.supplierState = state;
    core.updatedAt = booking.updatedAt;
  }
  if (state === 'COMPLETED') {
    for (const item of db.tripItems) {
      if (item.bookingId === booking.bookingRef && item.status !== 'CANCELLED') {
        item.status = 'CONFIRMED';
        item.updatedAt = booking.updatedAt;
      }
    }
  }
}

/**
 * The deposit goes back where it came from. Offline money returns offline, so
 * this records the obligation rather than moving anything.
 */
function releaseDeposit(booking: HotelBookingEntity, note: string): void {
  if (booking.paymentState !== 'AUTHORIZED' && booking.paymentState !== 'CAPTURED') return;
  const refunded = booking.paymentState === 'CAPTURED' ? booking.priceBreakdown.totalEGP : booking.depositEGP;
  booking.paymentState = 'REFUNDED';
  booking.updatedAt = nowIso();

  ledgerService.recordDoubleEntry({
    transactionId: `TXN-STAY-RFND-${booking.id}`,
    idempotencyKey: `STAY-REFUND-${booking.id}`,
    bookingRef: booking.bookingRef,
    tripId: booking.tripId || booking.bookingRef,
    type: 'REFUND_ISSUED',
    amountEGP: refunded,
    debitAccount: 'PLATFORM_ESCROW_MAIN',
    creditAccount: `TRAVELER_${booking.paymentInstructions.method}`,
    metadata: { stage: 'release', note },
  });
}

/**
 * Cancels a stay. Free inside the cancellation window; after it, the deposit is
 * forfeited and the traveller is told so at cancel time, not at check-in.
 */
export function cancelStay(
  ref: string,
  actor: { userId: string; role: string },
  input: { reason?: string }
): { booking: HotelBookingEntity; refundEGP: number; withinFreeWindow: boolean } {
  const booking = requireBooking(ref);
  if (!mayActOnStay(actor, booking)) {
    throw new StayBookingError('This reservation is not yours to cancel.', 'NOT_YOUR_BOOKING', {}, 403);
  }
  if (!['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED'].includes(booking.status)) {
    throw new StayBookingError(
      'This reservation can no longer be cancelled.',
      'NOT_CANCELLABLE',
      { status: booking.status },
      409
    );
  }

  const withinFreeWindow = nowIso() <= booking.freeCancellationUntil;
  const now = nowIso();
  booking.status = 'CANCELLED';
  booking.cancelReason = input.reason;
  booking.updatedAt = now;

  let refundEGP = 0;
  if (booking.paymentState === 'AUTHORIZED' || booking.paymentState === 'CAPTURED') {
    if (withinFreeWindow) {
      refundEGP = booking.paymentState === 'CAPTURED' ? booking.priceBreakdown.totalEGP : booking.depositEGP;
      releaseDeposit(booking, 'cancelled within the free window');
    } else {
      // Outside the window the deposit stays with the property. The payment
      // state is left as recorded — nothing was returned.
      refundEGP = 0;
    }
  }

  syncLinkedRecords(booking);

  notificationService.sendNotification({
    userId: booking.userId,
    type: 'SYSTEM',
    title: 'Stay cancelled',
    message: `${booking.bookingRef} cancelled.` +
      (refundEGP > 0
        ? ` Your ${refundEGP.toLocaleString()} EGP deposit is being returned.`
        : withinFreeWindow
          ? ''
          : ' The deposit was past the free-cancellation window, so it is not returned.'),
    metadata: { bookingRef: booking.bookingRef },
  });

  return { booking, refundEGP, withinFreeWindow };
}

/**
 * Moves a stay to new dates, atomically.
 *
 * The old nights are given up only if the new ones can be taken: the booking is
 * temporarily released, the new window checked, and on a refusal everything is
 * restored and the traveller sees a refusal rather than a lost reservation.
 */
export function rescheduleStay(
  ref: string,
  actor: { userId: string; role: string },
  input: { checkIn: string; checkOut: string }
): HotelBookingEntity {
  const booking = requireBooking(ref);
  if (!mayActOnStay(actor, booking)) {
    throw new StayBookingError('This reservation is not yours to move.', 'NOT_YOUR_BOOKING', {}, 403);
  }
  if (!['PENDING_PAYMENT', 'PENDING_CONFIRMATION', 'CONFIRMED'].includes(booking.status)) {
    throw new StayBookingError(
      'This reservation can no longer be moved.',
      'NOT_RESCHEDULABLE',
      { status: booking.status },
      409
    );
  }
  // Once the balance is in, the money is final; a new total would need a
  // refund or a top-up nobody records. Moving it is a desk conversation.
  if (booking.balanceSettledAt) {
    throw new StayBookingError(
      'This stay is fully paid — contact us to change its dates.',
      'ALREADY_SETTLED',
      { balanceSettledAt: booking.balanceSettledAt },
      409
    );
  }
  // Only a NEW check-in is held to today: a guest already in house may still
  // move their check-out.
  if (input.checkIn !== booking.checkIn) assertCheckInNotPast(input.checkIn);

  const lockKey = `lock:stay:${booking.roomTypeId}`;
  const lease = distributedLockService.tryAcquire(lockKey, 5000);
  if (!lease) {
    throw new StayBookingError(
      'The calendar is being updated right now — try again in a moment.',
      'ROOM_LOCKED',
      { roomTypeId: booking.roomTypeId },
      409
    );
  }

  try {
    const previous = {
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      nights: booking.nights,
      breakdown: booking.priceBreakdown,
      freeUntil: booking.freeCancellationUntil,
      depositEGP: booking.depositEGP,
      balanceDueEGP: booking.balanceDueEGP,
      status: booking.status,
    };

    db.runInTransaction(() => {
      // Give up the old nights so the new window can be measured honestly —
      // an overlapping move would otherwise fight its own hold.
      booking.status = 'CANCELLED';
      try {
        const availability = checkStay({
          accommodationId: booking.accommodationId,
          roomTypeId: booking.roomTypeId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          rooms: booking.rooms,
        });
        if (!availability.available) {
          throw new StayBookingError(
            'The new dates are not available.',
            availability.unavailableReason ?? 'TOO_MANY_ROOMS',
            { firstUnavailableDate: availability.firstUnavailableDate },
            409
          );
        }

        const quote = quoteStay({
          accommodationId: booking.accommodationId,
          roomTypeId: booking.roomTypeId,
          checkIn: input.checkIn,
          checkOut: input.checkOut,
          rooms: booking.rooms,
          adults: booking.adults,
          children: booking.children,
        });

        booking.checkIn = input.checkIn;
        booking.checkOut = input.checkOut;
        booking.nights = quote.nights;
        booking.priceBreakdown = {
          nights: quote.nights,
          nightsDetail: quote.nightsDetail,
          baseEGP: quote.baseEGP,
          longStayDiscountEGP: quote.longStayDiscountEGP,
          serviceFeeEGP: quote.serviceFeeEGP,
          taxEGP: quote.taxEGP,
          totalEGP: quote.totalEGP,
          currency: 'EGP',
          depositEGP: quote.depositEGP,
          balanceDueEGP: quote.balanceDueEGP,
        };
        // A deposit already received stays what it was (the ledger holds that
        // exact amount); only the balance moves with the new total. Unpaid
        // stays are simply re-quoted, keeping a no-deposit stay deposit-free.
        const depositPaid = booking.paymentState === 'AUTHORIZED' || booking.paymentState === 'CAPTURED';
        const noDeposit = previous.depositEGP === 0;
        const nextDeposit = depositPaid || noDeposit ? previous.depositEGP : quote.depositEGP;
        booking.depositEGP = nextDeposit;
        booking.balanceDueEGP = Math.max(0, quote.totalEGP - nextDeposit);
        booking.priceBreakdown.depositEGP = booking.depositEGP;
        booking.priceBreakdown.balanceDueEGP = booking.balanceDueEGP;
        if (booking.status !== 'CANCELLED' && previous.status === 'PENDING_PAYMENT') {
          booking.paymentInstructions.amountEGP = nextDeposit;
        }
        // Moving dates must not buy a fresh free-cancellation window: a guest
        // already inside the penalty period keeps the earlier deadline.
        booking.freeCancellationUntil = depositPaid
          ? (previous.freeUntil < quote.freeCancellationUntil ? previous.freeUntil : quote.freeCancellationUntil)
          : quote.freeCancellationUntil;
        booking.status = previous.status;
        booking.updatedAt = nowIso();
        syncLinkedRecords(booking);
        notificationService.sendNotification({
          userId: booking.userId,
          type: 'SYSTEM',
          title: 'Stay moved',
          message: `${booking.bookingRef} now runs ${booking.checkIn} → ${booking.checkOut}. New total ${booking.priceBreakdown.totalEGP.toLocaleString()} EGP, balance ${booking.balanceDueEGP.toLocaleString()} EGP.`,
          metadata: { bookingRef: booking.bookingRef },
        });
      } catch (err) {
        booking.status = previous.status;
        throw err;
      }
    });

    return booking;
  } finally {
    distributedLockService.release(lease);
  }
}

/** The balance was taken at the property. Closes the stay's money story. */
export function settleBalance(
  ref: string,
  actor: { userId: string; role: string },
  input: { amountEGP?: number }
): HotelBookingEntity {
  const booking = requireBooking(ref);
  if (actor.role !== 'Operations' && actor.role !== 'Admin') {
    throw new StayBookingError('Only staff can settle a balance.', 'FORBIDDEN', {}, 403);
  }
  if (booking.status !== 'IN_HOUSE' && booking.status !== 'CONFIRMED') {
    throw new StayBookingError(
      'Only a confirmed or in-house stay can be settled.',
      'NOT_SETTLABLE',
      { status: booking.status },
      409
    );
  }

  if (booking.balanceSettledAt) {
    throw new StayBookingError(
      'The balance for this stay is already recorded.',
      'ALREADY_SETTLED',
      { balanceSettledAt: booking.balanceSettledAt },
      409
    );
  }
  // Settlement closes the money story, so it records the full balance. A
  // smaller figure used to be accepted and still marked the stay CAPTURED,
  // reading as fully paid; a larger one would over-credit escrow.
  const amount = input.amountEGP ?? booking.balanceDueEGP;
  if (amount !== booking.balanceDueEGP) {
    throw new StayBookingError(
      `The balance due is ${booking.balanceDueEGP.toLocaleString()} EGP — record the full amount once it is collected.`,
      'BALANCE_MISMATCH',
      { amountEGP: amount, balanceDueEGP: booking.balanceDueEGP },
      400
    );
  }

  const now = nowIso();
  booking.paymentState = 'CAPTURED';
  booking.balanceSettledAt = now;
  booking.updatedAt = now;

  ledgerService.recordDoubleEntry({
    transactionId: `TXN-STAY-BAL-${booking.id}`,
    idempotencyKey: `STAY-BALANCE-${booking.id}`,
    bookingRef: booking.bookingRef,
    tripId: booking.tripId || booking.bookingRef,
    type: 'PAYMENT_CAPTURED',
    amountEGP: amount,
    debitAccount: `TRAVELER_${booking.paymentInstructions.method}`,
    creditAccount: 'PLATFORM_ESCROW_MAIN',
    metadata: { stage: 'balance', method: booking.paymentInstructions.method },
  });

  return booking;
}

/** Check-in recorded at the property. */
export function checkInStay(ref: string, actor: { userId: string; role: string }): HotelBookingEntity {
  const booking = requireBooking(ref);
  if (actor.role !== 'Operations' && actor.role !== 'Admin') {
    throw new StayBookingError('Only staff can record a check-in.', 'FORBIDDEN', {}, 403);
  }
  if (booking.status !== 'CONFIRMED') {
    throw new StayBookingError('Only a confirmed stay can be checked in.', 'NOT_CHECKABLE', { status: booking.status }, 409);
  }
  // Dahab's date: a guest cannot be in the room before their first night.
  const today = dahabToday();
  if (today < booking.checkIn) {
    throw new StayBookingError(
      `Check-in opens on ${booking.checkIn}.`,
      'TOO_EARLY',
      { checkIn: booking.checkIn, today },
      409
    );
  }
  booking.status = 'IN_HOUSE';
  booking.updatedAt = nowIso();
  setCoreSupplierState(booking, 'IN_PROGRESS');
  notificationService.sendNotification({
    userId: booking.userId,
    type: 'SYSTEM',
    title: 'Welcome — you are checked in',
    message: `${booking.bookingRef}: checked in. Check-out is ${booking.checkOut}.`,
    metadata: { bookingRef: booking.bookingRef },
  });
  return booking;
}

/**
 * The guest never arrived. Only once their first night has come, and only for
 * a confirmed stay. The deposit stays with the property (that is what it was
 * for), the rooms are released, and the linked records close.
 */
export function markNoShow(ref: string, actor: { userId: string; role: string }): HotelBookingEntity {
  const booking = requireBooking(ref);
  if (actor.role !== 'Operations' && actor.role !== 'Admin') {
    throw new StayBookingError('Only staff can record a no-show.', 'FORBIDDEN', {}, 403);
  }
  if (booking.status !== 'CONFIRMED') {
    throw new StayBookingError('Only a confirmed stay can be a no-show.', 'NOT_NO_SHOW', { status: booking.status }, 409);
  }
  const today = dahabToday();
  if (today < booking.checkIn) {
    throw new StayBookingError(
      `The guest is not due until ${booking.checkIn}.`,
      'TOO_EARLY',
      { checkIn: booking.checkIn, today },
      409
    );
  }
  booking.status = 'NO_SHOW';
  booking.updatedAt = nowIso();
  const core = db.bookings.find(b => b.id === booking.bookingRef);
  if (core) {
    core.supplierState = 'CANCELLED';
    core.updatedAt = booking.updatedAt;
  }
  for (const item of db.tripItems) {
    if (item.bookingId === booking.bookingRef) {
      item.status = 'CANCELLED';
      item.updatedAt = booking.updatedAt;
    }
  }
  notificationService.sendNotification({
    userId: booking.userId,
    type: 'SYSTEM',
    title: 'Marked as no-show',
    message: `${booking.bookingRef}: the property recorded that you did not arrive. If this is wrong, contact us today.`,
    metadata: { bookingRef: booking.bookingRef },
  });
  return booking;
}

/** The stay is over, the guest is gone. */
export function completeStay(ref: string, actor: { userId: string; role: string }): HotelBookingEntity {
  const booking = requireBooking(ref);
  if (actor.role !== 'Operations' && actor.role !== 'Admin') {
    throw new StayBookingError('Only staff can complete a stay.', 'FORBIDDEN', {}, 403);
  }
  if (booking.status !== 'IN_HOUSE') {
    throw new StayBookingError('Only an in-house stay can be completed.', 'NOT_COMPLETABLE', { status: booking.status }, 409);
  }
  booking.status = 'COMPLETED';
  booking.updatedAt = nowIso();
  // The platform booking closes too: reviews (reviewService.verifyStay) and
  // the trip timeline read COMPLETED from it, not from the stay row.
  setCoreSupplierState(booking, 'COMPLETED');
  notificationService.sendNotification({
    userId: booking.userId,
    type: 'SYSTEM',
    title: 'Thanks for staying',
    message: `${booking.bookingRef} is complete. You can now review your stay.`,
    metadata: { bookingRef: booking.bookingRef },
  });
  return booking;
}

/** Every stay the traveller booked, newest first — with or without a trip. */
export function staysForUser(userId: string): HotelBookingEntity[] {
  return db.hotelBookings
    .filter(b => b.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** A reservation by reference, for the traveller's own view. */
export function getStayByRef(ref: string): HotelBookingEntity {
  return requireBooking(ref);
}

/** Every stay filed under a trip. */
export function staysForTrip(tripId: string): HotelBookingEntity[] {
  return db.hotelBookings.filter(b => b.tripId === tripId);
}

export { QUOTE_TTL_MINUTES, StayQuoteError };