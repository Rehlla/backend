import type { CommerceServiceType } from '../shared/types/commerce';
import type { CommerceHold, MultiCheckoutResult } from './api';
import { checkoutIssueFrom, type CheckoutIssue } from './checkoutError';

/**
 * Hold first, then pay — the order /api/commerce/checkout/multi requires.
 *
 * Every checkout line must settle an ACTIVE hold the session user owns, for
 * the same SKU, trip, slot and party size; the server charges the catalogue
 * price and refuses a different client amount with 409 PRICE_CHANGED. This
 * module is that sequence, written once, so the planner, Book Now and the
 * concierge modal cannot each get a different part of it wrong:
 *
 *   1. hold every line (reusing a hold the caller already took),
 *   2. compare what the traveller was shown with what the holds cost, and
 *      stop for a re-confirmation when they differ,
 *   3. settle with the amounts the traveller agreed to.
 *
 * A PRICE_CHANGED from the server lands in the same re-confirm step with the
 * holds kept, so confirming retries against the very same reservations.
 */

export interface CheckoutLine {
  serviceType: CommerceServiceType;
  skuId: string;
  /** YYYY-MM-DD. */
  scheduledDate: string;
  /** The slot label the hold is taken on, e.g. '10:30 AM' or 'Check-in 14:00'. */
  scheduledTime: string;
  passengersCount: number;
  /** The price the traveller was shown for this line. */
  amountEGP: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  specialRequests?: string;
  /** A hold the caller already took for exactly this line (e.g. the planner's transfer step). */
  existingHold?: Pick<CommerceHold, 'holdToken' | 'amountEGP'> & { expiresAt?: string };
}

export interface HeldLine extends CheckoutLine {
  holdToken: string;
  /** The catalogue price for the held party — what the server will charge. */
  heldAmountEGP: number;
  expiresAt?: string;
}

export interface HeldCheckoutDeps {
  createHold(params: {
    skuId: string;
    tripId: string;
    date: string;
    timeSlot: string;
    passengersCount: number;
    idempotencyKey: string;
  }): Promise<Pick<CommerceHold, 'holdToken' | 'amountEGP'> & { expiresAt?: string }>;
  completeMultiCheckout(params: {
    tripId: string;
    travelerName: string;
    travelerPhone: string;
    travelerEmail: string;
    items: Array<{
      serviceType: CommerceServiceType;
      skuId: string;
      holdToken: string;
      scheduledDate: string;
      scheduledTime: string;
      amountEGP: number;
      passengersCount?: number;
      pickupLocation?: string;
      dropoffLocation?: string;
      specialRequests?: string;
    }>;
    paymentParams: {
      idempotencyKey: string;
      provider?: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
      cardLast4?: string;
      cardBrand?: string;
      cardHolderName?: string;
    };
  }): Promise<MultiCheckoutResult>;
}

export interface HeldCheckoutRequest {
  tripId: string;
  traveler: { name: string; phone: string; email: string };
  lines: CheckoutLine[];
  payment: {
    provider: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
    cardLast4?: string;
    cardBrand?: string;
    cardHolderName?: string;
  };
  /**
   * One key per attempt. Hold keys and the payment key derive from it, so a
   * double tap replays rather than double-books. A re-hold needs a new one.
   */
  attemptKey: string;
}

export type HeldCheckoutOutcome =
  | { kind: 'confirmed'; result: MultiCheckoutResult; held: HeldLine[]; tripId: string }
  /** The holds cost something other than what was shown. Nothing was charged. */
  | { kind: 'priceChanged'; held: HeldLine[]; shownTotalEGP: number; currentTotalEGP: number }
  /** `held` is null when the failure happened while holding. Nothing was charged. */
  | { kind: 'failed'; issue: CheckoutIssue; held: HeldLine[] | null };

/** Holds every line in order; a line with `existingHold` is reused, not held again. */
export async function holdLines(
  deps: Pick<HeldCheckoutDeps, 'createHold'>,
  tripId: string,
  lines: CheckoutLine[],
  attemptKey: string
): Promise<HeldLine[]> {
  const held: HeldLine[] = [];
  for (const [index, line] of lines.entries()) {
    const hold =
      line.existingHold ??
      (await deps.createHold({
        skuId: line.skuId,
        tripId,
        date: line.scheduledDate,
        timeSlot: line.scheduledTime,
        passengersCount: line.passengersCount,
        idempotencyKey: `${attemptKey}-HOLD-${index}-${line.skuId}`,
      }));
    held.push({ ...line, holdToken: hold.holdToken, heldAmountEGP: hold.amountEGP, expiresAt: hold.expiresAt });
  }
  return held;
}

export const shownTotal = (lines: Array<{ amountEGP: number }>): number =>
  lines.reduce((sum, l) => sum + l.amountEGP, 0);

export const heldTotal = (held: HeldLine[]): number =>
  held.reduce((sum, l) => sum + l.heldAmountEGP, 0);

/** The traveller agreed to the held prices: each line is now settled at what its hold costs. */
export const acceptHeldPrices = (held: HeldLine[]): HeldLine[] =>
  held.map(line => ({ ...line, amountEGP: line.heldAmountEGP }));

async function settle(
  deps: Pick<HeldCheckoutDeps, 'completeMultiCheckout'>,
  req: HeldCheckoutRequest,
  held: HeldLine[]
): Promise<HeldCheckoutOutcome> {
  try {
    const result = await deps.completeMultiCheckout({
      tripId: req.tripId,
      travelerName: req.traveler.name,
      travelerPhone: req.traveler.phone,
      travelerEmail: req.traveler.email,
      items: held.map(line => ({
        serviceType: line.serviceType,
        skuId: line.skuId,
        holdToken: line.holdToken,
        scheduledDate: line.scheduledDate,
        scheduledTime: line.scheduledTime,
        amountEGP: line.amountEGP,
        passengersCount: line.passengersCount,
        pickupLocation: line.pickupLocation,
        dropoffLocation: line.dropoffLocation,
        specialRequests: line.specialRequests,
      })),
      // The same key across a price re-confirmation: the rejected attempt
      // stopped before payment, so nothing is replayed — and a double tap on
      // "confirm" cannot pay twice.
      paymentParams: { idempotencyKey: `${req.attemptKey}-PAY`, ...req.payment },
    });
    return { kind: 'confirmed', result, held, tripId: req.tripId };
  } catch (err) {
    const issue = checkoutIssueFrom(err);
    if (issue.code === 'PRICE_CHANGED' && issue.currentAmountEGP !== undefined) {
      // The server's price wins. Record it on the line it names (or, unnamed,
      // on the only line) and send the traveller back to re-confirm; the
      // holds are still active, so confirming retries the same reservation.
      const target = issue.skuId ?? (held.length === 1 ? held[0].skuId : undefined);
      if (target) {
        const updated = held.map(line =>
          line.skuId === target ? { ...line, heldAmountEGP: issue.currentAmountEGP as number } : line
        );
        return {
          kind: 'priceChanged',
          held: updated,
          shownTotalEGP: shownTotal(updated),
          currentTotalEGP: heldTotal(updated),
        };
      }
    }
    return { kind: 'failed', issue, held };
  }
}

/**
 * Runs hold → price check → settle.
 *
 * Pass `held` (from a previous `priceChanged` outcome) with
 * `acceptCurrentPrice: true` to settle at the confirmed prices on the same
 * holds. Pass neither to start from scratch.
 */
export async function runHeldCheckout(
  deps: HeldCheckoutDeps,
  req: HeldCheckoutRequest,
  resume?: { held: HeldLine[]; acceptCurrentPrice: boolean }
): Promise<HeldCheckoutOutcome> {
  let held: HeldLine[];
  if (resume) {
    held = resume.held;
  } else {
    try {
      held = await holdLines(deps, req.tripId, req.lines, req.attemptKey);
    } catch (err) {
      return { kind: 'failed', issue: checkoutIssueFrom(err), held: null };
    }
  }

  if (resume?.acceptCurrentPrice) {
    held = acceptHeldPrices(held);
  } else if (held.some(line => line.heldAmountEGP !== line.amountEGP)) {
    // Asking before paying beats a 409 after: the hold already says what
    // checkout will charge.
    return { kind: 'priceChanged', held, shownTotalEGP: shownTotal(held), currentTotalEGP: heldTotal(held) };
  }

  return settle(deps, req, held);
}

/** A fresh attempt key. Not a booking reference — only an idempotency seed. */
export function newAttemptKey(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now()}-${random}`;
}

/**
 * YYYY-MM-DD in the traveller's local calendar, `offsetDays` from today.
 *
 * Several callers held on `new Date().toISOString().split('T')[0]`, the UTC
 * date — which in Dahab (UTC+2/+3) is still yesterday until 02:00/03:00.
 */
export function localCalendarDate(offsetDays = 0, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + offsetDays);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
