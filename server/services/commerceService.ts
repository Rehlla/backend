import crypto from 'crypto';
import { db } from '../db/database';
import { reconcileTripStatus } from './tripStatusReconciler';
import type { CommercePricingBasis, CommerceServiceType } from '../db/schema';
import { HoldEntity, BookingEntity, InventorySlotEntity, ProductSkuEntity } from '../db/schema';
import { paymentService } from './paymentService';
import { notificationService } from './notificationService';
import { distributedLockService } from './distributedLockService';
import { supplierCalendarService } from './supplierCalendarService';
import { assertCheckoutAllowed } from './fraudDetectionService';
import { parseSlotClock } from './serviceTime';

const HOLD_TTL_MINUTES = 15;

/**
 * Raised when a slot cannot satisfy the requested party size. Carries a 409 so
 * callers can distinguish "sold out" from a malformed request.
 */
export class InsufficientCapacityError extends Error {
  public readonly status = 409;
  public readonly type = 'https://dahab.travel/errors/insufficient-capacity';
  public readonly title = 'Not Enough Availability';
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'InsufficientCapacityError';
    this.details = details;
  }
}

/**
 * Raised when a checkout names inventory that does not exist, or that exists
 * under a different service type. A 400 rather than a 409: nothing is sold out,
 * the request is simply wrong, and retrying it unchanged will not help.
 */
/**
 * Raised when the supplier has blocked the requested date on their calendar
 * (blueprint row #12). A 409 like sold-out capacity: the request is well-formed
 * and the supplier may well serve other dates — retrying unchanged will not
 * help, but choosing another date will.
 */
export class SupplierDateBlockedError extends Error {
  public readonly status = 409;
  public readonly type = 'https://dahab.travel/errors/supplier-date-blocked';
  public readonly title = 'Supplier Unavailable';
  public readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'SupplierDateBlockedError';
    this.details = details;
  }
}

export class UnknownSkuError extends Error {
  public readonly status = 400;
  public readonly type = 'https://dahab.travel/errors/unknown-sku';
  public readonly title = 'Unknown Product';
  public readonly details: Record<string, unknown>;

  constructor(skuId: string, actualServiceType?: string, requestedServiceType?: string) {
    super(
      actualServiceType && requestedServiceType
        ? `Product "${skuId}" is a ${actualServiceType} product and cannot be booked as ${requestedServiceType}.`
        : `Product "${skuId}" does not exist. A booking cannot be created for inventory that is not in the catalogue.`
    );
    this.name = 'UnknownSkuError';
    this.details = { skuId, actualServiceType, requestedServiceType };
  }
}

/**
 * The checkout named a trip that does not exist.
 *
 * The store still carries the result of this going unchecked: a CAPTURED
 * booking, its payment and two ledger entries all filed against
 * 'DHB-TRIP-DAHAB-FIRST-TIMER' — a plan-template slug that a since-fixed client
 * path sent in place of the traveller's real trip id. Nothing rejected it, so
 * four money rows point at an itinerary that was never created.
 *
 * The client is fixed, but its fallback is now the empty string, and an empty
 * or unknown trip id would still be accepted here. Validating server-side
 * closes the whole class rather than the one path that caused it.
 */
export class UnknownTripError extends Error {
  public readonly status = 400;
  public readonly type = 'https://dahab.travel/errors/unknown-trip';
  public readonly title = 'Unknown Trip';
  public readonly details: Record<string, unknown>;

  constructor(tripId: string) {
    super(
      tripId
        ? `Trip "${tripId}" does not exist. A booking cannot be filed against an itinerary that is not in the database.`
        : 'No trip was supplied. A booking has to belong to a traveller\'s itinerary.'
    );
    this.name = 'UnknownTripError';
    this.details = { tripId };
  }
}

/**
 * A checkout broke a commerce rule the client can act on (re-hold, re-confirm
 * the price). `code` is the machine-readable reason the UI branches on; the
 * message is for humans.
 */
export class CheckoutRuleError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'CheckoutRuleError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * The catalogue price is not what the client showed the traveller. A 409, not
 * a silent correction: charging a different amount than the one confirmed is
 * exactly what checkout must never do, so the UI re-confirms at the new price.
 */
export class PriceChangedError extends CheckoutRuleError {
  constructor(details: { skuId: string; quotedAmountEGP: number; currentAmountEGP: number }) {
    super(
      `The price for "${details.skuId}" is ${details.currentAmountEGP} EGP, not ${details.quotedAmountEGP} EGP. Please review and confirm again.`,
      409,
      'PRICE_CHANGED',
      details
    );
    this.name = 'PriceChangedError';
  }
}

/**
 * The SKU's supplier is not Active (Suspended by Operations, or not yet
 * verified). Holds and checkouts used to ignore supplier status entirely, so a
 * supplier Ops had suspended kept taking bookings — and payouts.
 */
export class SupplierUnavailableError extends CheckoutRuleError {
  constructor(supplierId: string, status: string, skuId?: string) {
    super(
      'This provider is not accepting bookings right now. Please choose another option.',
      409,
      'SUPPLIER_UNAVAILABLE',
      { supplierId, supplierStatus: status, ...(skuId ? { skuId } : {}) }
    );
    this.name = 'SupplierUnavailableError';
  }
}

/**
 * Refuses a booking against a supplier whose record says they cannot serve.
 *
 * Mirrors dahabKnowledgeOs.validateSupplierGovernanceGate's statuses
 * (Suspended / Pending_Verification) but only for suppliers that exist: a SKU
 * whose supplier row is missing is a catalogue-integrity problem, not a
 * governance decision, and refusing it here would take down every SKU seeded
 * ahead of its supplier record.
 */
export function assertSupplierBookable(supplierId: string, skuId?: string): void {
  const supplier = db.suppliers.find(s => s.id === supplierId);
  if (supplier && supplier.status !== 'Active') {
    throw new SupplierUnavailableError(supplierId, supplier.status, skuId);
  }
}

/**
 * The one pricing rule for a SKU line. Hotels are per stay (basePriceEGP is
 * the block price); every other service type is per person.
 *
 * Holds, checkout and the price explainer all call this. They used to price
 * independently — the hold at basePriceEGP whatever the party size, checkout at
 * whatever the client sent — so the explainer's "same numbers checkout will
 * charge" was true of none of them.
 */
/**
 * How a line's price scales. Shared with the SKU types (CommercePricingBasis)
 * so a room type's `per_night` basis is a known case here rather than an
 * untyped string arriving at checkout.
 */
export type PricingBasis = CommercePricingBasis;

/**
 * Basis for a SKU: its own `pricingBasis`, else hotels per stay, private and
 * premium transfers per vehicle (also for rows created before the field
 * existed — their ids end in the tier), everything else per person.
 */
export function pricingBasisOf(sku: ProductSkuEntity): PricingBasis {
  if (sku.pricingBasis) return sku.pricingBasis;
  if (sku.serviceType === 'hotel') return 'per_stay';
  if (sku.serviceType === 'transfer' && /^SKU-TRF-.+-(private|premium)$/.test(sku.id)) return 'per_vehicle';
  return 'per_person';
}

export function priceSkuLine(sku: ProductSkuEntity, passengersCount?: number): {
  basis: PricingBasis;
  passengersCount: number;
  unitPriceEGP: number;
  amountEGP: number;
} {
  const passengers = Math.max(1, Math.floor(passengersCount ?? 1));
  const basis = pricingBasisOf(sku);
  const amountEGP = basis === 'per_person' ? sku.basePriceEGP * passengers : sku.basePriceEGP;
  return { basis, passengersCount: passengers, unitPriceEGP: sku.basePriceEGP, amountEGP };
}

/**
 * A SKU as the client is allowed to see it, with the pricing basis resolved.
 *
 * `pricingBasis` is optional and nothing writes it — not a seed, an importer or
 * an admin route — so every basis in the catalogue comes from `pricingBasisOf`'s
 * fallbacks. Returning raw rows leaves the client to guess per_person, which is
 * wrong for exactly the two verticals where guessing produces a rejected
 * checkout: a hotel (per stay) and a private/premium zone transfer (per
 * vehicle). Both were quoted at double and refused at checkout with 409
 * PRICE_CHANGED.
 *
 * Exporting this rather than inlining it in the route keeps one definition the
 * contract test can pin (tests/domain/pricingQuoteParity.test.ts).
 */
export function skuForClient(sku: ProductSkuEntity): ProductSkuEntity & { pricingBasis: PricingBasis } {
  return { ...sku, pricingBasis: pricingBasisOf(sku) };
}

export class CommerceService {
  // Release holds that have exceeded their TTL
  public releaseExpiredHolds() {
    const now = new Date().toISOString();
    db.runInTransaction(() => {
      db.holds.forEach(h => {
        if (h.status === 'ACTIVE' && h.expiresAt < now) {
          h.status = 'EXPIRED';
          const slot = db.inventorySlots.find(s => s.id === h.slotId);
          if (slot) {
            slot.heldCapacity = Math.max(0, slot.heldCapacity - h.passengersCount);
            if (slot.status === 'SOLD_OUT' && slot.reservedCapacity + slot.heldCapacity < slot.totalCapacity) {
              slot.status = 'AVAILABLE';
            }
          }
        }
      });
    });
  }

  // Explicitly release a specific hold
  public releaseHold(holdToken: string): boolean {
    let released = false;
    db.runInTransaction(() => {
      const hold = db.holds.find(h => h.holdToken === holdToken && h.status === 'ACTIVE');
      if (hold) {
        hold.status = 'RELEASED';
        const slot = db.inventorySlots.find(s => s.id === hold.slotId);
        if (slot) {
          slot.heldCapacity = Math.max(0, slot.heldCapacity - hold.passengersCount);
          if (slot.status === 'SOLD_OUT' && slot.reservedCapacity + slot.heldCapacity < slot.totalCapacity) {
            slot.status = 'AVAILABLE';
          }
        }
        released = true;
      }
    });
    return released;
  }

  // Multi-vertical Availability Check
  public checkAvailability(params: {
    serviceType: CommerceServiceType;
    skuId?: string;
    date: string;
    timeSlot?: string;
    passengers?: number;
  }): {
    available: boolean;
    skus: ProductSkuEntity[];
    slots: InventorySlotEntity[];
    priceEGP: number;
  } {
    this.releaseExpiredHolds();

    let targetSkus = db.productSkus.filter(s => s.serviceType === params.serviceType && s.active);
    if (params.skuId) {
      targetSkus = targetSkus.filter(s => s.id === params.skuId);
    }

    if (targetSkus.length === 0) {
      return { available: false, skus: [], slots: [], priceEGP: 0 };
    }

    const primarySku = targetSkus[0];
    let slots = db.inventorySlots.filter(s => s.skuId === primarySku.id && s.date === params.date);

    const projectSlot = (timeSlot: string, idx: number): InventorySlotEntity => ({
      id: `SLOT-${primarySku.id}-${params.date}-${idx}`,
      skuId: primarySku.id,
      date: params.date,
      timeSlot,
      totalCapacity: primarySku.maxCapacityPerSlot || 10,
      reservedCapacity: 0,
      heldCapacity: 0,
      priceEGP: primarySku.basePriceEGP,
      status: 'AVAILABLE'
    });

    if (primarySku.timeSlots?.length) {
      // Every declared departure, whether or not it has been booked yet: one
      // booked departure materialises a slot, and that must not hide the rest
      // of the day. Projected, not persisted — see below.
      // Matched on clock time so a slot labelled '08:30 AM (Morning Dive)' is
      // the declared '08:30 AM' departure, not a second one. Clockless slots
      // ('ASAP' from Book Now) are not departures and stay out of the list.
      const clockKey = (label: string) => {
        const clock = parseSlotClock(label);
        return clock ? clock.hours * 60 + clock.minutes : null;
      };
      const materialised = slots;
      const declared = primarySku.timeSlots.map(clockKey);
      slots = primarySku.timeSlots.map(
        (time, idx) =>
          materialised.find(s => s.timeSlot === time || (declared[idx] !== null && clockKey(s.timeSlot) === declared[idx])) ??
          projectSlot(time, idx)
      );
      slots.push(
        ...materialised.filter(s => {
          const key = clockKey(s.timeSlot);
          return key !== null && !slots.includes(s) && !declared.includes(key);
        })
      );
    }

    // Auto-generate dynamic slots if date is new
    if (slots.length === 0) {
      const defaultTimes = params.serviceType === 'hotel'
        ? ['Standard Check-in 14:00']
        : params.serviceType === 'rental'
        ? ['FULL_DAY']
        : params.serviceType === 'diving'
        ? ['08:30 AM (Morning Dive)', '01:30 PM (Afternoon Dive)']
        : params.serviceType === 'safari'
        ? ['02:00 AM (Sunrise Trek)', '03:30 PM (Sunset Safari)']
        : ['08:00 AM', '10:30 AM', '01:00 PM', '04:30 PM', '08:00 PM', '11:30 PM'];

      // Projected, not persisted. This method is reachable anonymously, and
      // persisting here meant any request for an unseen date pushed rows and
      // rewrote the entire database file to disk — unbounded growth and write
      // amplification from an unauthenticated endpoint. createHold materialises
      // the slot for real when someone actually books it.
      slots = defaultTimes.map(projectSlot);
    }

    const pax = params.passengers || 2;
    const availableSlots = slots.filter(s => (s.totalCapacity - (s.reservedCapacity + s.heldCapacity)) >= pax);

    return {
      available: availableSlots.length > 0,
      skus: targetSkus,
      slots,
      priceEGP: primarySku.basePriceEGP
    };
  }

  // Create Concurrency-Safe Hold for any vertical
  public createHold(params: {
    skuId: string;
    tripId: string;
    travelerId: string;
    date: string;
    timeSlot: string;
    passengersCount: number;
    idempotencyKey: string;
  }): HoldEntity {
    this.releaseExpiredHolds();

    // Idempotency
    const existing = db.holds.find(h => h.idempotencyKey === params.idempotencyKey && h.status === 'ACTIVE');
    if (existing) {
      return existing;
    }

    const sku = db.productSkus.find(s => s.id === params.skuId);
    if (!sku) throw new Error(`SKU does not exist: ${params.skuId}`);

    // A Suspended / unverified supplier cannot be reserved against.
    assertSupplierBookable(sku.supplierId, sku.id);

    // Supplier calendar gate (blueprint row #12). A supplier who blocked a date
    // refused to serve it — a hold must not succeed for inventory they will
    // not deliver, regardless of what the slot math says.
    if (supplierCalendarService.isDateBlocked(sku.supplierId, params.date)) {
      const reason = supplierCalendarService.blocksForSupplier(sku.supplierId)
        .find(b => b.startDate <= params.date && params.date <= b.endDate)?.reason;
      throw new SupplierDateBlockedError(
        `${sku.title || sku.supplierId} is not accepting bookings for ${params.date}${reason ? `: ${reason}` : '.'}`,
        { skuId: params.skuId, supplierId: sku.supplierId, date: params.date, reason }
      );
    }

    const lockKey = `lock:slot:${params.skuId}:${params.date}:${params.timeSlot}`;
    const lease = distributedLockService.tryAcquire(lockKey, 5000);

    try {
      let holdResult!: HoldEntity;

      db.runInTransaction(() => {
        let slot = db.inventorySlots.find(s => s.skuId === params.skuId && s.date === params.date && s.timeSlot === params.timeSlot);
        if (!slot) {
          slot = {
            // Random suffix: two time slots of one SKU and date materialised in
            // the same millisecond used to share an id, so a hold's slotId
            // resolved to the wrong slot and checkout reserved capacity there.
            id: `SLOT-${params.skuId}-${params.date}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
            skuId: params.skuId,
            date: params.date,
            timeSlot: params.timeSlot,
            totalCapacity: sku.maxCapacityPerSlot || 10,
            reservedCapacity: 0,
            heldCapacity: 0,
            priceEGP: sku.basePriceEGP,
            status: 'AVAILABLE'
          };
          db.inventorySlots.push(slot);
        }

        const availableCapacity = slot.totalCapacity - (slot.reservedCapacity + slot.heldCapacity);
        if (availableCapacity < params.passengersCount) {
          // Previously this raised totalCapacity by passengersCount * 4 and
          // carried on, which made inventory unbounded: every hold succeeded and
          // every booking was confirmed regardless of what the supplier could
          // actually deliver. The surrounding lock, TTL and idempotency
          // machinery protected a number that was never enforced.
          throw new InsufficientCapacityError(
            `Only ${Math.max(0, availableCapacity)} place(s) remain for ${sku.title || params.skuId} ` +
            `on ${params.date} at ${params.timeSlot}; ${params.passengersCount} were requested.`,
            { skuId: params.skuId, date: params.date, timeSlot: params.timeSlot, requested: params.passengersCount, available: Math.max(0, availableCapacity) }
          );
        }

        const expires = new Date();
        expires.setMinutes(expires.getMinutes() + HOLD_TTL_MINUTES);

        const prefix = sku.serviceType.substring(0, 3).toUpperCase();
        const holdToken = `HLD-${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

        const hold: HoldEntity = {
          id: `HOLD-${Date.now()}`,
          holdToken,
          skuId: params.skuId,
          slotId: slot.id,
          tripId: params.tripId,
          travelerId: params.travelerId,
          serviceType: sku.serviceType,
          passengersCount: params.passengersCount,
          // The whole party's price, from the same rule checkout charges. This
          // was sku.basePriceEGP, so a party of four held four seats for the
          // price of one — and /api/commerce/checkout settles hold.amountEGP.
          amountEGP: priceSkuLine(sku, params.passengersCount).amountEGP,
          expiresAt: expires.toISOString(),
          status: 'ACTIVE',
          idempotencyKey: params.idempotencyKey,
          createdAt: new Date().toISOString()
        };

        slot.heldCapacity += params.passengersCount;
        if (slot.reservedCapacity + slot.heldCapacity >= slot.totalCapacity) {
          slot.status = 'SOLD_OUT';
        }
        db.holds.push(hold);
        db.logAudit(params.travelerId, 'Traveler', 'HOLD_CREATED', 'Hold', hold.id, {
          holdToken,
          serviceType: hold.serviceType,
          expiresAt: hold.expiresAt,
          amountEGP: hold.amountEGP
        });
        db.saveToDisk();
        holdResult = hold;
      });

      return holdResult;
    } finally {
      if (lease) {
        distributedLockService.release(lease);
      }
    }
  }

  // Unified Multi-Service Checkout & Booking Confirmation
  public completeMultiServiceCheckout(params: {
    tripId: string;
    /**
     * Who the booking is for, from the caller's verified session.
     *
     * The confirmation notification used to be addressed to a literal
     * 'USR-AHMED-01' — so every booking notification the platform has ever
     * produced was filed against the demo user, whoever actually booked.
     *
     * Also the identity every item's hold must belong to: a hold is the
     * caller's reservation, and settling someone else's would book capacity
     * they reserved.
     */
    travelerUserId: string;
    travelerName: string;
    travelerPhone: string;
    travelerEmail: string;
    items: Array<{
      serviceType: CommerceServiceType;
      skuId: string;
      holdToken?: string;
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
      /** Last four digits only — full PANs must never reach the server. */
      cardLast4?: string;
      cardBrand?: string;
      cardHolderName?: string;
    };
  }): {
    success: boolean;
    tripId: string;
    bookings: BookingEntity[];
    totalAmountEGP: number;
    paymentState: string;
    transactionId: string;
    /** True when this idempotencyKey had already been settled (a retry). */
    replayed?: boolean;
  } {
    // Resolve every item's inventory BEFORE the payment is processed.
    //
    // processCheckout runs outside db.runInTransaction and writes a payment
    // plus its ledger entries, so a throw from inside the transaction below
    // would leave the traveler charged for a booking that was never created.
    // Whatever is wrong with the request has to be found while nothing has
    // happened yet.
    // The trip has to exist before anything is charged, for exactly the reason
    // the SKUs are resolved here: this runs before processCheckout, so a throw
    // after payment would leave the traveller charged for a booking that could
    // never be filed correctly.
    if (!params.tripId || !db.trips.some(t => t.id === params.tripId)) {
      throw new UnknownTripError(params.tripId);
    }

    // Replay protection for the WHOLE checkout, not just the payment. A client
    // that times out after a committed response (or double-submits) retries with
    // the same idempotencyKey. processCheckout already short-circuits on the
    // payment, but the booking/totals loop below ran unconditionally, so every
    // retry pushed a brand-new set of bookings and added the total to
    // trip.totalPaidEGP again — duplicate bookings, inflated paid total, for one
    // payment. If a payment already exists for this key, the bookings were
    // created on the first attempt and this is a retry: return without doing
    // any of it again.
    const existingPayment = db.payments.find(p => p.idempotencyKey === params.paymentParams.idempotencyKey);
    if (existingPayment) {
      return {
        success: true,
        replayed: true,
        tripId: params.tripId,
        bookings: db.bookings.filter(b => b.tripId === params.tripId),
        totalAmountEGP: existingPayment.amountEGP,
        paymentState: existingPayment.state,
        transactionId: existingPayment.transactionId
      };
    }

    const resolvedSkus = params.items.map(item => {
      const sku = db.productSkus.find(s => s.id === item.skuId);
      if (!sku) throw new UnknownSkuError(item.skuId);
      if (sku.serviceType !== item.serviceType) {
        throw new UnknownSkuError(item.skuId, sku.serviceType, item.serviceType);
      }
      return sku;
    });

    // Supplier status gate. Re-checked here, not only at hold time: Operations
    // may suspend a supplier while a traveller's hold is still open.
    resolvedSkus.forEach(sku => assertSupplierBookable(sku.supplierId, sku.id));

    // Supplier calendar gate — runs BEFORE processCheckout for the same reason
    // the SKU resolution does: the payment step writes money rows outside the
    // booking transaction, so any rejection discovered after it would leave the
    // traveller charged for a booking the supplier has already refused.
    for (const item of params.items) {
      const sku = resolvedSkus.find(s => s.id === item.skuId);
      if (sku && supplierCalendarService.isDateBlocked(sku.supplierId, item.scheduledDate)) {
        const reason = supplierCalendarService.blocksForSupplier(sku.supplierId)
          .find(b => b.startDate <= item.scheduledDate && item.scheduledDate <= b.endDate)?.reason;
        throw new SupplierDateBlockedError(
          `${sku.title || sku.supplierId} is not accepting bookings for ${item.scheduledDate}${reason ? `: ${reason}` : '.'}`,
          { skuId: sku.id, supplierId: sku.supplierId, date: item.scheduledDate, reason }
        );
      }
    }

    // Every line settles an ACTIVE hold the caller owns, and is charged the
    // catalogue price for the held party — never the client's amountEGP.
    //
    // The hold was optional and the amount was the body's, so a crafted
    // request could book capacity nobody had reserved (every SKU carries
    // maxCapacityPerSlot) and pay any price it liked for it. Checked here, still
    // before processCheckout, so a rejected line costs the traveller nothing.
    this.releaseExpiredHolds();
    const seenHolds = new Set<string>();
    const priced = params.items.map((item, index) => {
      const sku = resolvedSkus[index];
      if (!item.holdToken) {
        throw new CheckoutRuleError(
          `"${sku.title || sku.id}" has no reservation. Please select your slot again.`,
          400, 'HOLD_REQUIRED', { skuId: sku.id }
        );
      }
      const hold = db.holds.find(h => h.holdToken === item.holdToken);
      if (!hold || hold.status !== 'ACTIVE' || seenHolds.has(hold.holdToken)) {
        throw new CheckoutRuleError(
          'Your reservation has expired or is invalid. Please select your slot again.',
          409, 'HOLD_EXPIRED', { skuId: sku.id, holdToken: item.holdToken }
        );
      }
      seenHolds.add(hold.holdToken);
      if (hold.travelerId !== params.travelerUserId) {
        throw new CheckoutRuleError('You may only settle your own reservation.', 403, 'HOLD_NOT_OWNED', { holdToken: item.holdToken });
      }
      // The booking is filed at the line's date/time, and cancel/reschedule
      // release the slot at the booking's date/time — so the line must be the
      // slot the hold actually reserved, for the party it reserved.
      const slot = db.inventorySlots.find(s => s.id === hold.slotId);
      if (
        hold.skuId !== sku.id ||
        hold.tripId !== params.tripId ||
        (slot && (slot.date !== item.scheduledDate || slot.timeSlot !== item.scheduledTime)) ||
        (item.passengersCount !== undefined && item.passengersCount !== hold.passengersCount)
      ) {
        throw new CheckoutRuleError(
          'This reservation does not match the booking details. Please select your slot again.',
          400, 'HOLD_MISMATCH', { skuId: sku.id, holdToken: item.holdToken }
        );
      }
      const amountEGP = priceSkuLine(sku, hold.passengersCount).amountEGP;
      if (item.amountEGP !== amountEGP) {
        throw new PriceChangedError({ skuId: sku.id, quotedAmountEGP: item.amountEGP, currentAmountEGP: amountEGP });
      }
      return { amountEGP, passengersCount: hold.passengersCount };
    });

    const totalAmountEGP = priced.reduce((acc, line) => acc + line.amountEGP, 0);

    // Fraud gate, on the server-priced total — after the replay check above,
    // so a retry is replayed rather than scored as a duplicate payment.
    assertCheckoutAllowed({
      userId: params.travelerUserId,
      transactionId: params.paymentParams.idempotencyKey,
      amountEGP: totalAmountEGP
    });

    // 1. Process payment settlement with idempotency
    const paymentResult = paymentService.processCheckout({
      idempotencyKey: params.paymentParams.idempotencyKey,
      tripId: params.tripId,
      amountEGP: totalAmountEGP,
      provider: params.paymentParams.provider || 'PAYMOB',
      cardLast4: params.paymentParams.cardLast4,
      cardBrand: params.paymentParams.cardBrand,
      cardHolderName: params.paymentParams.cardHolderName,
      payerEmail: params.travelerEmail,
      payerPhone: params.travelerPhone
    });

    // The session's user, then the trip's owner, and only then a marker that
    // says plainly that the owner is unknown. Never another traveler's id.
    const notificationUserId =
      params.travelerUserId ||
      db.trips.find(t => t.id === params.tripId)?.userId ||
      'UNATTRIBUTED';

    const confirmedBookings: BookingEntity[] = [];
    const now = new Date().toISOString();

    db.runInTransaction(() => {
      // 2. Iterate each item and convert into authoritative BookingEntity
      params.items.forEach((item, index) => {
        // Resolved above, before the payment. It used to be looked up here with
        // a fallback to *any* SKU of the same service type and a hardcoded
        // 'SUP-SHUTTLE-01' supplier, so a checkout naming inventory that did
        // not exist — which the Book Now catalogue did for all eight of its
        // services — still created a real booking, dispatched to a real
        // supplier, for something that supplier does not sell.
        const sku = resolvedSkus[index];
        const supplierId = sku.supplierId;
        const prefix = item.serviceType.substring(0, 3).toUpperCase();
        // Was `Math.floor(100 + Math.random() * 900)` — 900 possible refs per
        // service type, used as the primary key. A collision is more likely than
        // not after ~35 bookings, and db.bookings.find(b => b.id === ...) would
        // then return somebody else's booking: wrong traveler, wrong payout,
        // wrong voucher. 12 random hex chars makes that negligible.
        const bookingRef = `DHB-${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
        const confirmationCode = `DHB-${prefix}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

        // If a hold was used, mark it converted. Only an ACTIVE hold reserves
        // anything: an EXPIRED or RELEASED hold already gave its capacity back
        // (releaseExpiredHolds / releaseHold), and converting it anyway would
        // move held capacity to reserved for a seat the traveler never held —
        // inventory that the supplier cannot actually deliver.
        if (item.holdToken) {
          const hold = db.holds.find(h => h.holdToken === item.holdToken);
          if (hold && hold.status === 'ACTIVE') {
            hold.status = 'CONVERTED';
            const slot = db.inventorySlots.find(s => s.id === hold.slotId);
            if (slot) {
              slot.heldCapacity = Math.max(0, slot.heldCapacity - hold.passengersCount);
              slot.reservedCapacity += hold.passengersCount;
              if (slot.reservedCapacity + slot.heldCapacity >= slot.totalCapacity) {
                slot.status = 'SOLD_OUT';
              }
            }
          }
        }

        const booking: BookingEntity = {
          id: bookingRef,
          bookingRef,
          tripId: params.tripId,
          supplierId,
          skuId: sku?.id || item.skuId,
          serviceType: item.serviceType,
          amountEGP: priced[index].amountEGP,
          // The booking's payment state must mirror the payment that settled
          // it. Cash-on-arrival never captured anything — it is PENDING until
          // the traveler pays on site.
          paymentState: paymentResult.payment.state,
          // The supplier has not seen this yet, so it cannot be CONFIRMED.
          //
          // Writing CONFIRMED at the moment of purchase did two things: it told
          // the traveler a named supplier had accepted their booking when
          // nobody had, and it made the booking invisible in the supplier's own
          // queue — supplierService counts PENDING_CONFIRMATION as
          // `pendingActionCount`, so every booking ever created bypassed the
          // acceptance step the portal exists to run. updateBookingState moves
          // it to CONFIRMED when the supplier actually accepts.
          supplierState: 'PENDING_CONFIRMATION',
          travelerName: params.travelerName,
          travelerPhone: params.travelerPhone,
          travelerEmail: params.travelerEmail,
          // Was a hardcoded 2 for every booking, so a solo traveler and a
          // party of six were dispatched to the supplier identically. The held
          // party is the one that was reserved and priced.
          passengersCount: priced[index].passengersCount,
          pickupLocation: item.pickupLocation,
          dropoffLocation: item.dropoffLocation,
          specialRequests: item.specialRequests,
          scheduledDate: item.scheduledDate,
          scheduledTime: item.scheduledTime,
          confirmationCode,
          // Left unassigned, deliberately.
          //
          // Every transfer used to be created already carrying "Mahmoud Salem",
          // phone +20 100 876 5432, a Toyota HiAce and plate ط ج د 4821; every
          // dive "Omar Soliman (PADI MSDT Instructor)"; every safari "Sheikh
          // Salem Al-Jabali". Identical on every booking, invented at the
          // moment of purchase, and shown to the traveler as the person to look
          // for at the airport. Assignment is the supplier's act — it is what
          // supplierService.updateBookingState('ASSIGNED') exists to record —
          // and a booking that nobody has accepted yet must not name a driver.
          assignedResource: undefined,
          createdAt: now,
          updatedAt: now
        };

        db.bookings.push(booking);
        confirmedBookings.push(booking);

        // Attach to the itinerary line this booking actually fulfils.
        //
        // The match used to be `tripId + serviceType`, taking the FIRST item of
        // that type and re-pointing it at the new booking. So a traveler with a
        // 2,700 EGP dive already on their trip who booked a second, cheaper one
        // had their existing line hijacked: its bookingId moved to the new
        // booking while its price and title stayed the old one's, the original
        // booking was orphaned from the itinerary, and the new booking got no
        // line of its own. Observed in this store as a 2,700 EGP item pointing
        // at a 180 EGP booking.
        //
        // A line is only the right one if it is for the same product and is not
        // already booked.
        let tripItem = db.tripItems.find(
          ti =>
            ti.tripId === params.tripId &&
            ti.skuId === sku.id &&
            !ti.bookingId &&
            ti.status !== 'CANCELLED'
        );
        if (tripItem) {
          tripItem.status = 'CONFIRMED';
          tripItem.bookingId = booking.id;
          // Keep the line's price as the amount actually charged, so the
          // itinerary and the ledger cannot disagree.
          tripItem.priceEGP = priced[index].amountEGP;
          tripItem.updatedAt = now;
        } else {
          tripItem = {
            id: `ITEM-${Date.now()}-${prefix}`,
            tripId: params.tripId,
            serviceType: item.serviceType,
            skuId: sku?.id || item.skuId,
            title: sku?.title || `${item.serviceType.toUpperCase()} Booking`,
            dayNumber: item.serviceType === 'hotel' ? 1 : item.serviceType === 'transfer' ? 1 : 2,
            timeSlot: item.scheduledTime,
            priceEGP: priced[index].amountEGP,
            status: 'CONFIRMED',
            bookingId: booking.id,
            createdAt: now,
            updatedAt: now
          };
          db.tripItems.push(tripItem);
        }

        // Send confirmation notifications
        notificationService.sendNotification({
          userId: notificationUserId,
          type: 'BOOKING_CREATED',
          channel: 'WHATSAPP',
          title: `Booking Confirmed: ${booking.serviceType.toUpperCase()}`,
          message: `Your booking ${booking.bookingRef} is confirmed! Voucher code: ${confirmationCode}.`,
          metadata: { recipientPhone: params.travelerPhone, bookingRef: booking.bookingRef, priceEGP: booking.amountEGP }
        });
      });

      // Update Trip totals
      const trip = db.trips.find(t => t.id === params.tripId);
      if (trip) {
        trip.totalPaidEGP += totalAmountEGP;
        trip.updatedAt = now;
      }

      // Advance the trip's own lifecycle from what is now true of it.
      //
      // This was `trip.status = 'CONFIRMED'`, unconditionally, which could only
      // ever move a trip forwards by accident. A traveler already in Dahab
      // (IN_DESTINATION) who booked a massage was sent *back* to CONFIRMED and
      // dropped out of the in-destination experience; a cancelled trip was
      // quietly revived by any booking against it. reconcileTripStatus only
      // moves forward and refuses to touch a terminal trip.
      reconcileTripStatus(params.tripId, params.travelerName);

      db.logAudit(params.travelerName, 'Traveler', 'MULTI_CHECKOUT_COMPLETED', 'Trip', params.tripId, {
        totalAmountEGP,
        bookingsCount: confirmedBookings.length,
        transactionId: paymentResult.payment.transactionId
      });
    });      return {
      success: true,
      tripId: params.tripId,
      bookings: confirmedBookings,
      totalAmountEGP,
      paymentState: paymentResult.payment.state,
      transactionId: paymentResult.payment.transactionId
    };
  }

  /**
   * P4 booking-trust: when a hold fails with InsufficientCapacityError, the
   * traveler needs honest alternatives NOW, not an apology. This scans the
   * catalogue for SKUs of the same service type with real capacity for the
   * party on the requested date — same truth the hold endpoint enforces, so
   * an alternative shown here can actually be held.
   *
   * Runs releaseExpiredHolds() first so expired holds give capacity back and
   * a "sold out" verdict is never stale. Availability math mirrors createHold
   * exactly: totalCapacity - (reservedCapacity + heldCapacity).
   */
  public findAlternatives(params: {
    skuId: string;
    date: string;
    timeSlot?: string;
    passengersCount: number;
    /** Max candidates to return (default 3). */
    limit?: number;
  }): Array<{
    skuId: string;
    title: string;
    titleAr: string;
    serviceType: string;
    supplierId: string;
    basePriceEGP: number;
    currency: 'EGP';
    timeSlot: string;
    available: number;
    status: InventorySlotEntity['status'];
    reason: string;
    reasonAr: string;
  }> {
    this.releaseExpiredHolds();

    const originSku = db.productSkus.find(s => s.id === params.skuId);
    if (!originSku) {
      // Unknown origin SKU: no alternatives can be honest.
      return [];
    }

    const limit = Math.max(1, Math.min(params.limit ?? 3, 8));
    const out: ReturnType<CommerceService['findAlternatives']> = [];

    // Candidates: same serviceType, active, different id. Ranked by (a) price
    // distance from the origin SKU, then (b) most remaining seats, then (c) id
    // for deterministic ordering.
    const candidates = db.productSkus
      .filter(s => s.active && s.serviceType === originSku.serviceType && s.id !== originSku.id)
      // A supplier who has blocked the requested date cannot serve the
      // traveler either — the candidate list stays honest even when the origin
      // SKU's own supplier is blocked (the hold would then fail on the
      // calendar, not on capacity, and the panel must show real options).
      .filter(s => !supplierCalendarService.isDateBlocked(s.supplierId, params.date))
      .map(s => {
        const slot = db.inventorySlots.find(
          sl => sl.skuId === s.id && sl.date === params.date && (!params.timeSlot || sl.timeSlot === params.timeSlot)
        );
        const totalCapacity = s.maxCapacityPerSlot || 10;
        const reserved = slot?.reservedCapacity ?? 0;
        const held = slot?.heldCapacity ?? 0;
        const available = totalCapacity - (reserved + held);
        return { sku: s, slot, available, priceDistance: Math.abs(s.basePriceEGP - originSku.basePriceEGP) };
      })
      .filter(c => c.available >= params.passengersCount)
      .sort((a, b) => a.priceDistance - b.priceDistance || b.available - a.available || a.sku.id.localeCompare(b.sku.id))
      .slice(0, limit);

    for (const c of candidates) {
      // When the caller named a timeSlot and no slot row exists yet for this
      // candidate, the capacity is the SKU's full maxCapacityPerSlot — same
      // as createHold's lazy slot creation. The slot's own timeSlot is what
      // the traveler would actually book.
      const timeSlot = c.slot?.timeSlot ?? params.timeSlot ?? '10:30 AM';
      out.push({
        skuId: c.sku.id,
        title: c.sku.title,
        titleAr: c.sku.titleAr,
        serviceType: c.sku.serviceType,
        supplierId: c.sku.supplierId,
        basePriceEGP: c.sku.basePriceEGP,
        currency: 'EGP',
        timeSlot,
        available: c.available,
        status: c.slot?.status ?? 'AVAILABLE',
        reason: c.sku.basePriceEGP < originSku.basePriceEGP
          ? 'Cheaper and has space'
          : c.sku.basePriceEGP > originSku.basePriceEGP
            ? 'Pricier but has space'
            : 'Same price and has space',
        reasonAr: c.sku.basePriceEGP < originSku.basePriceEGP
          ? 'أرخص وفيه أماكن'
          : c.sku.basePriceEGP > originSku.basePriceEGP
            ? 'أغلى لكن فيه أماكن'
            : 'بنفس السعر وفيه أماكن',
      });
    }
    return out;
  }

  /**
   * P4 booking-trust: the price explainer. Returns the same numbers checkout
   * will charge — SKU-catalogue truth, not the client's arithmetic — with a
   * per-unit basis so the traveler sees WHY the total is the total.
   * Hotel SKUs are priced per stay (basePriceEGP covers the whole block);
   * every other service type is per person.

   * Holds, checkout and this endpoint read the same rows, so an explainer
   * total that checkout would later reject is impossible by construction.
   */
  public explainPrice(params: {
    items: Array<{ skuId: string; passengersCount?: number; nights?: number }>;
  }): {
    currency: 'EGP';
    lines: Array<{ skuId: string; title: string; titleAr: string; serviceType: string; basis: PricingBasis; passengersCount: number; nights: number | null; unitPriceEGP: number; amountEGP: number; supplierId: string; cancellationPolicyHours: number }>;
    totalEGP: number;
  } {
    const lines = params.items.map(item => {
      const sku = db.productSkus.find(s => s.id === item.skuId);
      if (!sku) throw new UnknownSkuError(item.skuId);
      const nights = item.nights === undefined ? null : Math.max(1, Math.floor(item.nights));
      // No fees are invented here — priceSkuLine is the rule holds and
      // checkout charge by, so the explainer shows exactly what is charged.
      const { basis, passengersCount: passengers, amountEGP } = priceSkuLine(sku, item.passengersCount);
      return {
        skuId: sku.id,
        title: sku.title,
        titleAr: sku.titleAr,
        serviceType: sku.serviceType,
        basis,
        passengersCount: passengers,
        nights,
        unitPriceEGP: sku.basePriceEGP,
        amountEGP,
        supplierId: sku.supplierId,
        cancellationPolicyHours: sku.cancellationPolicyHours,
      };
    });
    const totalEGP = lines.reduce((sum, l) => sum + l.amountEGP, 0);
    return { currency: 'EGP', lines, totalEGP };
  }
}

export const commerceService = new CommerceService();
