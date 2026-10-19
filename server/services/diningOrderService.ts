import crypto from 'crypto';
import { db } from '../db/database';
import { DINING_DELIVERY_ZONES, DiningDeliveryZone, findDeliveryZone } from '../data/deliveryZones';
import { nearestByDistance } from '../utils/geo';
import { deliveryZoneFor, venueDeliversTo } from '../db/seeds/importDahabMenus';
import {
  DiningMenuItemEntity,
  DiningOrderDeliveryLocation,
  DiningOrderEntity,
  DiningOrderFulfillment,
  DiningOrderLine,
  DiningOrderPriceBreakdown,
  DiningOrderStatus,
  DiningVenueEntity,
  ProductSkuEntity
} from '../db/schema';

/**
 * Dining orders and delivery quoting.
 *
 * Three things this service refuses to do, and why each refusal is the point:
 *
 * 1. Trust a price. Every amount in a quote is computed here from the menu row
 *    and the venue's own delivery policy. A client's total is never read — the
 *    hold/checkout spine refuses a mismatched amount with 409 PRICE_CHANGED
 *    rather than quietly correcting it at settlement, and a food order has no
 *    hold step, so the discipline has to start one layer earlier.
 *
 * 2. Accept an order for a dish that does not exist, is unavailable, or has
 *    changed price since it was read. Item names and unit prices are snapshotted
 *    onto the order lines so a later menu edit cannot rewrite what was ordered.
 *
 * 3. Guess a delivery zone. A zone is resolved from a coordinate, or supplied
 *    by the client as a zone the server then confirms the venue actually serves.
 *    There is no "somewhere in Dahab" fallback, because a wrong zone is a wrong
 *    fee and a wrong ETA for a traveler who is relying on them.
 *
 * MONEY, EXPLICITLY: an order moves no money. The payment row is recorded as
 * PENDING for cash-on-arrival so operations can settle by hand, but no ledger
 * entry, no BookingEntity and no payout is created here. That is Phase 4's
 * job. Nothing in this file may add a financial field without that work.
 */

/** A kitchen will not cook a single dish for a courier. */
const MAX_QUANTITY_PER_LINE = 20;
const MAX_LINES_PER_ORDER = 25;

/**
 * Delivery is priced off the zone the venue declares, never off straight-line
 * distance. Two reasons: distance is not a road distance in a town where the
 * only road runs north-south, and the kitchen knows its own territory better
 * than a haversine does. The haversine still runs, as a sanity check that the
 * coordinate the client sent is somewhere in Dahab at all.
 */
const MAX_DELIVERY_DISTANCE_KM = 25;
const DAHAB_BOUNDS = { minLat: 28.30, maxLat: 28.75, minLng: 34.30, maxLng: 34.75 };

export class DiningOrderError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;

  constructor(message: string, status: number, code: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DiningOrderError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Order progress. A copy of the states on DiningOrderEntity, kept here as the
 * single writable authority — the type describes what can exist, this map
 * describes what can move to what.
 *
 * PENDING_CONFIRMATION is reachable only on creation and is not a state the
 * kitchen has acted on yet. A traveler may cancel up to and including
 * PREPARING — the kitchen has bought the food but not cooked it. At
 * READY_FOR_PICKUP the food exists, and cancelling then throws away something
 * already made, so that is where cancellation ends. OUT_FOR_DELIVERY and
 * DELIVERED only exist for DELIVERY fulfilment.
 */
const TRANSITIONS: Record<DiningOrderStatus, DiningOrderStatus[]> = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'REJECTED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY_FOR_PICKUP', 'CANCELLED'],
  // Cancellation stops here: the food is made and someone has to eat it.
  READY_FOR_PICKUP: ['OUT_FOR_DELIVERY', 'DELIVERED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  // Terminal.
  CANCELLED: [],
  REJECTED: [],
  FAILED: []
};

export function allowedOrderTransitions(status: DiningOrderStatus): DiningOrderStatus[] {
  return TRANSITIONS[status] || [];
}

/** Can the traveler still cancel, or is the food already made? */
export function isCancellable(status: DiningOrderStatus): boolean {
  return allowedOrderTransitions(status).includes('CANCELLED');
}

export interface DiningQuoteRequest {
  venueId: string;
  items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
  fulfillment: DiningOrderFulfillment;
  zoneId?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  locationSource?: DiningOrderDeliveryLocation['source'];
}

export interface DiningQuote {
  venueId: string;
  venueSlug?: string;
  venueNameEn: string;
  venueNameAr: string;
  fulfillment: DiningOrderFulfillment;
  lines: DiningOrderLine[];
  priceBreakdown: DiningOrderPriceBreakdown;
  deliveryLocation?: Omit<DiningOrderDeliveryLocation, 'addressText'>;
  etaMinutes?: number;
  promisedAt?: string;
  /** Set when the order is refused; the caller decides whether to surface it
   *  as an error or as an honest "we do not deliver to you" panel. */
  refusal?: { code: string; message: string };
}

function nowIso(): string {
  return new Date().toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Smallest charge the kitchen will accept for a single delivery run. */
const SERVICE_FEE_MIN_EGP = 10;

export class DiningOrderService {
  // ------------------------------------------------------------------ catalogue

  /**
   * Venues that can actually take an order.
   *
   * A venue with no menu seed is excluded rather than shown with an empty menu:
   * listing it would advertise ordering to a traveler who cannot complete it.
   */
  public listOrderableVenues(): DiningVenueEntity[] {
    const ids = new Set(db.diningMenuItems.map(m => m.venueId));
    return db.diningVenues.filter(v => v.slug && ids.has(v.id));
  }

  public findVenueBySlug(slug: string): DiningVenueEntity | undefined {
    const normalized = slug.trim().toLowerCase();
    return db.diningVenues.find(v => v.slug?.toLowerCase() === normalized);
  }

  public findVenueById(venueId: string): DiningVenueEntity | undefined {
    return db.diningVenues.find(v => v.id === venueId);
  }

  public menuFor(venueId: string, { includeUnavailable = false } = {}): DiningMenuItemEntity[] {
    return db.diningMenuItems
      .filter(m => m.venueId === venueId && (includeUnavailable || m.available))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.nameEn.localeCompare(b.nameEn));
  }

  /**
   * The venue's table SKU, which is what settles a reservation through the
   * existing hold/checkout spine (see importDahabMenus).
   */
  public tableSkuFor(venue: DiningVenueEntity): ProductSkuEntity | undefined {
    if (!venue.supplierId) return undefined;
    return db.productSkus.find(s => s.serviceType === 'dining' && s.supplierId === venue.supplierId);
  }

  // -------------------------------------------------------------------- zones

  /**
   * Resolve a coordinate to the nearest zone, but only within Dahab.
   *
   * The bounds check is not politeness: a coordinate from another governorate
   * would resolve to the nearest Dahab zone and quote a delivery fee to a
   * traveler who is hundreds of kilometres away, which is the exact failure a
   * "nearest zone" helper invites.
   */
  public resolveZone(latitude: number, longitude: number) {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new DiningOrderError('latitude and longitude are required.', 400, 'INVALID_LOCATION');
    }
    if (
      latitude < DAHAB_BOUNDS.minLat ||
      latitude > DAHAB_BOUNDS.maxLat ||
      longitude < DAHAB_BOUNDS.minLng ||
      longitude > DAHAB_BOUNDS.maxLng
    ) {
      throw new DiningOrderError(
        'That location is outside the Dahab delivery area.',
        400,
        'OUTSIDE_DELIVERY_AREA'
      );
    }
    const nearest = nearestByDistance(latitude, longitude, DINING_DELIVERY_ZONES, z => ({
      latitude: z.latitude,
      longitude: z.longitude
    }));
    if (!nearest) {
      throw new DiningOrderError('No delivery zone could be resolved for that location.', 400, 'NO_ZONE');
    }
    return { zone: nearest.entry, distanceKm: round2(nearest.km) };
  }

  /** Zones this kitchen delivers to, for the address picker. */
  public zonesServedBy(venue: DiningVenueEntity): DiningDeliveryZone[] {
    if (!venue.delivery?.acceptsDelivery) return [];
    const served: DiningDeliveryZone[] = [];
    for (const pairing of venue.delivery.zones) {
      const zone = findDeliveryZone(pairing.zoneId);
      if (!zone) continue; // a zone the app no longer knows about is not offered
      served.push({ ...zone, feeEGP: pairing.feeEGP, etaMinutes: pairing.etaMinutes });
    }
    return served;
  }

  // ------------------------------------------------------------------- quoting

  /**
   * Price an order. Never throws for a legitimate "we will not do this" — the
   * refusal comes back on the quote so the client can explain itself honestly
   * instead of showing a generic failure.
   */
  public quote(request: DiningQuoteRequest): DiningQuote {
    const venue = this.findVenueById(request.venueId);
    if (!venue) {
      throw new DiningOrderError('Restaurant not found.', 404, 'VENUE_NOT_FOUND');
    }

    const lines = this.buildLines(venue.id, request.items);
    const subtotalEGP = round2(lines.reduce((sum, l) => sum + l.lineTotalEGP, 0));

    const base: DiningQuote = {
      venueId: venue.id,
      venueSlug: venue.slug,
      venueNameEn: venue.nameEn,
      venueNameAr: venue.nameAr,
      fulfillment: request.fulfillment,
      lines,
      priceBreakdown: {
        subtotalEGP,
        deliveryFeeEGP: 0,
        serviceFeeEGP: 0,
        totalEGP: subtotalEGP,
        currency: 'EGP'
      }
    };

    // PICKUP charges nothing to deliver and promises only kitchen time.
    if (request.fulfillment === 'PICKUP') {
      const prep = venue.prepMinutes ?? 20;
      base.etaMinutes = prep;
      base.promisedAt = new Date(Date.now() + prep * 60_000).toISOString();
      return base;
    }

    if (!venue.delivery?.acceptsDelivery) {
      base.refusal = {
        code: 'NO_DELIVERY',
        message: `${venue.nameEn} does not deliver. Collect your order instead.`
      };
      return base;
    }

    const zone = this.resolveZoneFor(venue, request, base);
    if (!zone) return base;

    const pairing = deliveryZoneFor(venue, zone.zoneId);
    if (!pairing) {
      base.refusal = {
        code: 'ZONE_NOT_SERVED',
        message: `${venue.nameEn} does not deliver to ${zone.labelEn}.`
      };
      return base;
    }

    if (subtotalEGP < venue.delivery.minOrderEGP) {
      base.refusal = {
        code: 'BELOW_MINIMUM',
        message: `Minimum delivery order is ${venue.delivery.minOrderEGP} EGP.`
      };
      return base;
    }

    // Packaging: a percentage, but never below the smallest sensible envelope.
    const serviceFeeEGP = round2(Math.max(subtotalEGP * (venue.delivery.serviceFeePercent / 100), SERVICE_FEE_MIN_EGP));

    const etaMinutes = (venue.prepMinutes ?? 20) + pairing.etaMinutes;
    base.deliveryLocation = {
      zoneId: zone.zoneId,
      labelEn: zone.labelEn,
      labelAr: zone.labelAr,
      latitude: zone.latitude,
      longitude: zone.longitude,
      source: request.locationSource ?? 'manual'
    };
    base.etaMinutes = etaMinutes;
    base.promisedAt = new Date(Date.now() + etaMinutes * 60_000).toISOString();
    base.priceBreakdown = {
      subtotalEGP,
      deliveryFeeEGP: round2(pairing.feeEGP),
      serviceFeeEGP,
      totalEGP: round2(subtotalEGP + pairing.feeEGP + serviceFeeEGP),
      currency: 'EGP'
    };

    return base;
  }

  /**
   * Resolve which zone this delivery is to, from either a coordinate or a
   * client-named zone. Returns undefined once the quote already carries a
   * refusal, so the caller stops there.
   */
  private resolveZoneFor(
    venue: DiningVenueEntity,
    request: DiningQuoteRequest,
    base: DiningQuote
  ): { zoneId: string; labelEn: string; labelAr: string; latitude: number; longitude: number } | undefined {
    if (base.refusal) return undefined;

    if (request.zoneId) {
      // The client naming a zone is a convenience, not an authority: it is
      // confirmed against the app's geography before it is priced.
      const zone = findDeliveryZone(request.zoneId);
      if (!zone) {
        throw new DiningOrderError(`Unknown delivery zone '${request.zoneId}'.`, 400, 'UNKNOWN_ZONE');
      }
      return zone;
    }

    if (request.latitude !== undefined && request.longitude !== undefined) {
      const { zone, distanceKm } = this.resolveZone(request.latitude, request.longitude);
      if (distanceKm > MAX_DELIVERY_DISTANCE_KM) {
        base.refusal = {
          code: 'TOO_FAR',
          message: 'That spot is too far for delivery.'
        };
        return undefined;
      }
      return zone;
    }

    throw new DiningOrderError(
      'A delivery zone or coordinates are required.',
      400,
      'LOCATION_REQUIRED'
    );
  }

  /**
   * Build priced lines from the catalogue. The unit price comes from the menu
   * row, never from the request, and the name is snapshotted so a later menu
   * edit cannot rewrite what the kitchen was told to cook.
   */
  private buildLines(
    venueId: string,
    requested: Array<{ menuItemId: string; quantity: number; notes?: string }>
  ): DiningOrderLine[] {
    if (!Array.isArray(requested) || requested.length === 0) {
      throw new DiningOrderError('An order needs at least one item.', 400, 'EMPTY_ORDER');
    }
    if (requested.length > MAX_LINES_PER_ORDER) {
      throw new DiningOrderError(`An order may hold at most ${MAX_LINES_PER_ORDER} different dishes.`, 400, 'TOO_MANY_LINES');
    }

    const lines: DiningOrderLine[] = [];
    for (const entry of requested) {
      const menuItemId = String(entry.menuItemId || '');
      const rawQuantity = Number(entry.quantity);
      // An integer is required, and a fractional one is REFUSED rather than
      // floored: silently cooking 2 of 3 is the same failure the checkout spine
      // refuses with PRICE_CHANGED rather than quietly correcting.
      const quantity = rawQuantity;
      if (!menuItemId) throw new DiningOrderError('A menu item id is required.', 400, 'INVALID_LINE');
      if (!Number.isFinite(rawQuantity) || !Number.isInteger(rawQuantity)) {
        throw new DiningOrderError(
          `Quantity for ${menuItemId} must be a whole number.`,
          400,
          'INVALID_QUANTITY'
        );
      }
      if (quantity < 1 || quantity > MAX_QUANTITY_PER_LINE) {
        throw new DiningOrderError(
          `Quantity for ${menuItemId} must be between 1 and ${MAX_QUANTITY_PER_LINE}.`,
          400,
          'INVALID_QUANTITY'
        );
      }

      const item = db.diningMenuItems.find(m => m.id === menuItemId);
      // Same message for "no such dish", "sold out" and "another kitchen's
      // dish": a menu should not tell a competitor's dish ids apart from its
      // unavailable ones. A foreign dish must never be priced on this cart —
      // this kitchen would be sent an order it does not cook.
      if (!item || !item.available || item.venueId !== venueId) {
        throw new DiningOrderError(`${menuItemId} is not available.`, 400, 'ITEM_UNAVAILABLE', { menuItemId });
      }

      lines.push({
        menuItemId: item.id,
        nameEn: item.nameEn,
        nameAr: item.nameAr,
        quantity,
        unitPriceEGP: item.priceEGP,
        lineTotalEGP: round2(item.priceEGP * quantity),
        notes: entry.notes ? String(entry.notes).slice(0, 200) : undefined
      });
    }
    return lines;
  }

  // -------------------------------------------------------------------- orders

  /**
   * Place an order. Identity comes from the session caller, never the body.
   *
   * Replaying the same idempotencyKey returns the original order rather than a
   * second kitchen ticket, so a double-tap on a slow Sinai connection cannot
   * cook two dinners.
   */
  public createOrder(
    actor: { userId: string; role?: string },
    request: DiningQuoteRequest & { idempotencyKey?: string; notes?: string }
  ): DiningOrderEntity {
    const venue = this.findVenueById(request.venueId);
    if (!venue) throw new DiningOrderError('Restaurant not found.', 404, 'VENUE_NOT_FOUND');

    if (request.idempotencyKey) {
      const existing = db.diningOrders.find(o => o.idempotencyKey === request.idempotencyKey);
      if (existing) return existing;
    }

    const quote = this.quote(request);
    if (quote.refusal) {
      throw new DiningOrderError(quote.refusal.message, 422, quote.refusal.code, { venueId: venue.id });
    }

    const stamp = nowIso();
    const orderRef = buildOrderRef();
    const id = `dining-order-${orderRef.toLowerCase()}`;

    return db.runInTransaction(() => {
      const order: DiningOrderEntity = {
        id,
        orderRef,
        venueId: venue.id,
        userId: actor.userId,
        supplierId: venue.supplierId,
        status: 'PENDING_CONFIRMATION',
        fulfillment: request.fulfillment,
        lines: quote.lines,
        priceBreakdown: quote.priceBreakdown,
        deliveryLocation:
          request.fulfillment === 'DELIVERY' && quote.deliveryLocation
            ? {
                ...quote.deliveryLocation,
                addressText: request.addressText ? String(request.addressText).slice(0, 300) : undefined
              }
            : undefined,
        etaMinutes: quote.etaMinutes,
        promisedAt: quote.promisedAt,
        notes: request.notes ? String(request.notes).slice(0, 500) : undefined,
        // What the traveler was told they will pay. Nothing is charged here.
        // Cash only: Paymob was explicitly rejected for this product, and with
        // no ledger yet there is nothing to settle online anyway.
        paymentMethod: 'CASH_ON_ARRIVAL',
        idempotencyKey: request.idempotencyKey,
        createdAt: stamp,
        updatedAt: stamp
      };
      db.diningOrders.push(order);

      // No PaymentEntity, no ledger entry, no BookingEntity — see the file
      // header. The order records the promise; charging it is Phase 4.
      db.logAudit(
        actor.userId,
        actor.role ?? 'Traveler',
        'DINING_ORDER_CREATED',
        'DiningOrder',
        order.id,
        {
          orderRef: order.orderRef,
          venueId: venue.id,
          fulfillment: order.fulfillment,
          totalEGP: order.priceBreakdown.totalEGP,
          zoneId: order.deliveryLocation?.zoneId,
          idempotencyKey: request.idempotencyKey
        }
      );

      return order;
    });
  }

  /**
   * A traveler may read only their own orders. Operations and Admin read all —
   * and a request for someone else's order answers 404, not 403, because
   * confirming the ref exists is itself the leak (rentalRoutes.ts:293).
   */
  public mayRead(actor: { userId: string; role?: string }, order: DiningOrderEntity): boolean {
    return (
      order.userId === actor.userId ||
      actor.role === 'Operations' ||
      actor.role === 'Admin'
    );
  }

  public findOrder(idOrRef: string): DiningOrderEntity | undefined {
    const needle = String(idOrRef || '').trim();
    return db.diningOrders.find(o => o.id === needle || o.orderRef.toLowerCase() === needle.toLowerCase());
  }

  /** Newest first. An actor only ever sees rows they may read. */
  public listOrders(actor: { userId: string; role?: string }): DiningOrderEntity[] {
    return [...db.diningOrders]
      .filter(o => this.mayRead(actor, o))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  /**
   * The kitchen behind an order, for the tracking screen.
   *
   * The order row stores only venueId — on purpose, so a venue rename does not
   * rewrite history — but a traveler watching a progress bar needs the name NOW,
   * from the live venue row. Resolved at read time, and undefined when the
   * venue has since been removed, which the client renders as the reference
   * rather than inventing a name from the id.
   */
  public venueSummaryFor(order: DiningOrderEntity): { nameEn: string; nameAr: string; slug?: string } | undefined {
    const venue = this.findVenueById(order.venueId);
    if (!venue) return undefined;
    return { nameEn: venue.nameEn, nameAr: venue.nameAr, slug: venue.slug };
  }

  /**
   * Advance an order. Operations only — the traveler watches this move, never
   * drives it. An illegal transition is a 409 rather than a silent no-op, so a
   * double-click cannot skip the kitchen.
   */
  public advanceStatus(
    orderId: string,
    next: DiningOrderStatus,
    reason?: string
  ): DiningOrderEntity {
    const order = this.findOrder(orderId);
    if (!order) throw new DiningOrderError('Order not found.', 404, 'ORDER_NOT_FOUND');

    const allowed = allowedOrderTransitions(order.status);
    if (!allowed.includes(next)) {
      throw new DiningOrderError(
        `An order cannot move from ${order.status} to ${next}.`,
        409,
        'ILLEGAL_TRANSITION',
        { from: order.status, to: next, allowed }
      );
    }

    // OUT_FOR_DELIVERY only means something if someone is carrying the food.
    if (next === 'OUT_FOR_DELIVERY' && order.fulfillment !== 'DELIVERY') {
      throw new DiningOrderError(
        'A pickup order cannot be marked out for delivery.',
        409,
        'FULFILLMENT_MISMATCH'
      );
    }

    const stamp = nowIso();
    return db.runInTransaction(() => {
      order.status = next;
      order.updatedAt = stamp;
      if (next === 'CANCELLED' || next === 'REJECTED') {
        order.cancellationReason = reason ? String(reason).slice(0, 300) : undefined;
      }
      db.logAudit(
        order.userId,
        'Operations',
        `DINING_ORDER_${next}`,
        'DiningOrder',
        order.id,
        { orderRef: order.orderRef, to: next, reason }
      );
      return order;
    });
  }

  /**
   * A traveler's own cancellation. Refused once the food exists: by then the
   * kitchen has spent the food, and taking money for a dish that is already on
   * the way is worse than telling the traveler no.
   */
  public cancelOrder(
    actor: { userId: string; role?: string },
    orderId: string,
    reason?: string
  ): DiningOrderEntity {
    const order = this.findOrder(orderId);
    if (!order) throw new DiningOrderError('Order not found.', 404, 'ORDER_NOT_FOUND');

    if (!this.mayRead(actor, order)) {
      throw new DiningOrderError('Order not found.', 404, 'ORDER_NOT_FOUND');
    }

    if (!isCancellable(order.status)) {
      throw new DiningOrderError(
        `An order that is already ${order.status.replace(/_/g, ' ').toLowerCase()} cannot be cancelled.`,
        409,
        'NOT_CANCELLABLE',
        { status: order.status }
      );
    }

    const stamp = nowIso();
    return db.runInTransaction(() => {
      order.status = 'CANCELLED';
      order.cancellationReason = reason ? String(reason).slice(0, 300) : undefined;
      order.updatedAt = stamp;
      db.logAudit(
        actor.userId,
        actor.role ?? 'Traveler',
        'DINING_ORDER_CANCELLED',
        'DiningOrder',
        order.id,
        { orderRef: order.orderRef, reason }
      );
      return order;
    });
  }
}

/** DNG-<3 letters>-<year>-<6 hex>: quotable over the phone, unlike a uuid. */
function buildOrderRef(): string {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `DNG-${suffix.slice(0, 3)}-${year}-${suffix}`;
}

export const diningOrderService = new DiningOrderService();
export { deliveryZoneFor, venueDeliversTo };