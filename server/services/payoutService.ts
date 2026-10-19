import crypto from 'crypto';
import { db } from '../db/database';
import type { PayoutScheduleEntity } from '../db/schema';
import { ledgerService } from './ledgerService';

/**
 * 24-hour payout scheduling (blueprint row #12).
 *
 * When a booking reaches COMPLETED, instead of immediately creating the
 * SUPPLIER_PAYOUT ledger entry, a PayoutSchedule entry is created with a
 * 24-hour hold. After the hold expires, a sweep converts it into a real
 * ledger entry. This gives the platform a buffer for disputes and refunds
 * before funds leave escrow.
 *
 * The sweep runs on a setInterval (like rentalService.startScheduledSweep).
 */

const HOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const SWEEP_INTERVAL_MS = 60_000;     // check every 60 seconds
let sweepTimer: ReturnType<typeof setInterval> | null = null;

// ----- Public API -----

/**
 * Creates a pending payout schedule entry for a completed booking.
 * Called by supplierService.updateBookingState when action === 'COMPLETE'.
 */
export function schedulePayout(params: {
  supplierId: string;
  bookingRef: string;
  amountEGP: number;
}): PayoutScheduleEntity {
  const { supplierId, bookingRef, amountEGP } = params;
  if (!supplierId || !bookingRef || !amountEGP) {
    throw new Error('supplierId, bookingRef, and amountEGP are required.');
  }

  // Idempotent: don't double-schedule for the same booking.
  const existing = db.payoutSchedule.find(
    p => p.bookingRef === bookingRef && p.payoutState !== 'CANCELLED'
  );
  if (existing) return existing;

  const now = new Date();
  const settleAfter = new Date(now.getTime() + HOLD_MS);

  const entry: PayoutScheduleEntity = {
    id: `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    supplierId,
    bookingRef,
    amountEGP,
    payoutState: 'PENDING',
    settleAfter: settleAfter.toISOString(),
    createdAt: now.toISOString(),
  };

  db.payoutSchedule.push(entry);
  return entry;
}

/**
 * Returns all payout schedule entries for a supplier.
 */
export function payoutsForSupplier(supplierId: string): PayoutScheduleEntity[] {
  return db.payoutSchedule.filter(p => p.supplierId === supplierId);
}

/**
 * Returns payout schedule entries for a specific booking.
 */
export function payoutForBooking(bookingRef: string): PayoutScheduleEntity | undefined {
  return db.payoutSchedule.find(p => p.bookingRef === bookingRef);
}

/**
 * Returns pending payouts that are eligible for settlement (hold expired).
 */
export function eligiblePayouts(): PayoutScheduleEntity[] {
  const now = new Date().toISOString();
  return db.payoutSchedule.filter(
    p => p.payoutState === 'PENDING' && p.settleAfter <= now
  );
}

/**
 * Settles a single payout: creates the SUPPLIER_PAYOUT ledger entry and
 * marks the schedule as SETTLED. Returns the created ledger entry id.
 * Guards against escrow overdraw: if PLATFORM_ESCROW_MAIN holds less than
 * the payout amount the settlement is deferred (left PENDING for a later
 * sweep after more PAYMENT_CAPTURED funds arrive).
 */
export function settlePayout(payoutId: string): string | null {
  const payout = db.payoutSchedule.find(p => p.id === payoutId && p.payoutState === 'PENDING');
  if (!payout) return null;
  if (payout.settleAfter > new Date().toISOString()) return null; // still in hold

  // Escrow balance guard — do not overdraw PLATFORM_ESCROW_MAIN. Computed
  // the same way ledgerService.verifyLedgerIntegrity does: net credits minus
  // debits for the escrow account across all ledger entries.
  const escrowBalance = ledgerService.verifyLedgerIntegrity().escrowBalanceEGP;
  if (escrowBalance < payout.amountEGP) {
    console.warn(`[Payout] insufficient escrow for ${payout.id}: need ${payout.amountEGP} EGP, have ${escrowBalance} EGP — leaving PENDING`);
    return null;
  }

  // Create the actual SUPPLIER_PAYOUT ledger entry.
  const booking = db.bookings.find(b => b.bookingRef === payout.bookingRef);
  const ledgerEntry = ledgerService.recordDoubleEntry({
    transactionId: `TXN-PAYOUT-${payout.id}`,
    idempotencyKey: `payout-settle-${payout.id}`,
    bookingRef: payout.bookingRef,
    tripId: booking?.tripId || 'UNKNOWN',
    type: 'SUPPLIER_PAYOUT',
    amountEGP: payout.amountEGP,
    debitAccount: 'PLATFORM_ESCROW_MAIN',
    creditAccount: `SUPPLIER_PAYABLE_${payout.supplierId}`,
    metadata: {
      payoutScheduleId: payout.id,
      settledBy: 'sweep',
    },
  });

  payout.payoutState = 'SETTLED';
  payout.settledAt = new Date().toISOString();
  payout.ledgerEntryId = ledgerEntry.id;

  return ledgerEntry.id;
}

/**
 * Cancels a pending payout (e.g. when a refund is issued before settlement).
 */
export function cancelPayout(bookingRef: string): boolean {
  const payout = db.payoutSchedule.find(
    p => p.bookingRef === bookingRef && p.payoutState === 'PENDING'
  );
  if (!payout) return false;
  payout.payoutState = 'CANCELLED';
  return true;
}

/**
 * Brings a booking's PENDING payout in line with a refund: cancelled when
 * nothing captured remains, otherwise capped at `supplierShareEGP` (the
 * supplier's share of what is left). Called by paymentService.processRefund.
 *
 * A SETTLED payout is left alone — that money has already left escrow, and
 * recovering it from the supplier is an ops clawback, not something to
 * rewrite here. Returns the payout it changed, if any.
 */
export function adjustPayoutForRefund(bookingRef: string, supplierShareEGP: number, refundId: string): PayoutScheduleEntity | undefined {
  const payout = db.payoutSchedule.find(
    p => p.bookingRef === bookingRef && p.payoutState === 'PENDING'
  );
  if (!payout) return undefined;
  const previousEGP = payout.amountEGP;
  if (supplierShareEGP <= 0) {
    payout.payoutState = 'CANCELLED';
  } else if (supplierShareEGP < payout.amountEGP) {
    payout.amountEGP = supplierShareEGP;
  } else {
    return undefined;
  }
  // The audit row is the payout's note: there is no notes column on it.
  db.logAudit('PayoutEngine', 'System', 'PAYOUT_ADJUSTED_FOR_REFUND', 'PayoutSchedule', payout.id, {
    bookingRef,
    refundId,
    previousEGP,
    amountEGP: payout.amountEGP,
    payoutState: payout.payoutState
  });
  return payout;
}

// ----- Sweep -----

function sweep(): void {
  const eligible = eligiblePayouts();
  for (const payout of eligible) {
    try {
      settlePayout(payout.id);
    } catch {
      // Settlement failed (e.g. ledger write error). Leave as PENDING for
      // the next sweep cycle. The hold timer doesn't reset — it will keep
      // retrying every 60s until it succeeds or is cancelled.
    }
  }
}

/**
 * Starts the payout sweep interval. Safe to call multiple times (no-op if
 * already running). Matches the rentalService.startScheduledSweep pattern.
 */
export function startPayoutSweep(): void {
  if (sweepTimer) return;
  sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
}

/** Stops the sweep interval. For graceful shutdown. */
export function stopPayoutSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}

export const payoutService = {
  schedulePayout,
  payoutsForSupplier,
  payoutForBooking,
  eligiblePayouts,
  settlePayout,
  cancelPayout,
  adjustPayoutForRefund,
  startPayoutSweep,
  stopPayoutSweep,
};
