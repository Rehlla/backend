import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { db } from '../db/database';
import {
  DiningOrderError,
  DiningQuoteRequest,
  diningOrderService
} from '../services/diningOrderService';
import {
  optionalEnum,
  optionalString,
  requiredArray,
  requiredEnum,
  requiredString
} from '../middleware/bodyParams';

/**
 * /api/dining — the ordering surface.
 *
 * Public before sign-up (browse, menu, quote, zone resolution) exactly like
 * /api/rentals: a traveler must be able to see what a dinner costs and whether
 * it reaches them before being asked for an account. Placing the order,
 * reading orders and cancelling are authenticated, and moving an order through
 * its states is Operations/Admin.
 *
 * Every route reads its body with optional chaining so a missing body becomes a
 * validator 400 rather than a TypeError 500, and identity always comes from
 * req.user — never from a body field.
 */

function sendError(res: Response, err: any) {
  if (err instanceof DiningOrderError) {
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }
  return res.status(err?.status || 400).json({ error: err?.message || 'Request could not be processed.' });
}

/**
 * The line items as the request shape they have on the wire. Kept local rather
 * than in bodyParams because it is dining-specific and the shared module is
 * for primitives; the pattern is rentalRoutes.ts's optionalStringArray.
 */
function readItems(value: unknown): Array<{ menuItemId: string; quantity: number; notes?: string }> {
  const raw = requiredArray(value, 'items', 25) as Array<Record<string, unknown>>;
  const items = raw.map((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      throw new Error(`items[${index}] must be an object.`);
    }
    const menuItemId = optionalString(entry.menuItemId, `items[${index}].menuItemId`, 128);
    if (!menuItemId) throw new Error(`items[${index}].menuItemId is required.`);
    const quantity = Number(entry.quantity);
    if (!Number.isFinite(quantity)) throw new Error(`items[${index}].quantity must be a number.`);
    return { menuItemId, quantity, notes: optionalString(entry.notes, `items[${index}].notes`, 200) };
  });
  if (items.length === 0) throw new Error('An order needs at least one item.');
  return items;
}

/** Shared by the quote and create routes so the two can never diverge. */
function readQuoteRequest(req: AuthenticatedRequest): DiningQuoteRequest {
  const body = req.body || {};
  return {
    venueId: requiredString(body.venueId, 'venueId', 128),
    items: readItems(body.items),
    fulfillment: requiredEnum(body.fulfillment, ['DELIVERY', 'PICKUP'] as const, 'fulfillment'),
    zoneId: optionalString(body.zoneId, 'zoneId', 64),
    latitude: body.latitude === undefined ? undefined : Number(body.latitude),
    longitude: body.longitude === undefined ? undefined : Number(body.longitude),
    addressText: optionalString(body.addressText, 'addressText', 300),
    locationSource: optionalEnum(body.locationSource, ['geo', 'manual', 'reverse_geocoded'] as const, 'locationSource')
  };
}

export const diningRouter = Router();

/**
 * Venues that can actually take an order, with the economics the list needs to
 * decide whether to show "delivers to you" at all.
 */
diningRouter.get('/venues', (_req: AuthenticatedRequest, res: Response) => {
  try {
    const venues = diningOrderService.listOrderableVenues().map(venue => ({
      id: venue.id,
      slug: venue.slug,
      nameEn: venue.nameEn,
      nameAr: venue.nameAr,
      areaId: venue.areaId,
      coordinates: venue.coordinates,
      cuisine: venue.cuisine,
      priceBand: venue.priceBand,
      rating: venue.rating,
      reviewCount: venue.reviewCount,
      coverImageUrl: venue.coverImageUrl,
      dietaryOptions: venue.dietaryOptions,
      openingHours: venue.openingHours,
      wifiNomadFriendly: venue.wifiNomadFriendly,
      averageMealPriceEGP: venue.averageMealPriceEGP,
      itemCount: db.diningMenuItems.filter(m => m.venueId === venue.id && m.available).length,
      cheapestDishEGP: cheapestAvailableDish(venue.id),
      delivery: venue.delivery
        ? {
            acceptsDelivery: venue.delivery.acceptsDelivery,
            minOrderEGP: venue.delivery.minOrderEGP,
            prepMinutes: venue.prepMinutes
          }
        : { acceptsDelivery: false, minOrderEGP: 0, prepMinutes: venue.prepMinutes }
    }));
    res.json({ venues, count: venues.length });
  } catch (err: any) {
    sendError(res, err);
  }
});

/** One venue with its menu. Public: browsing is how a traveler chooses. */
diningRouter.get('/venues/:slug', (req: AuthenticatedRequest, res: Response) => {
  try {
    const venue = diningOrderService.findVenueBySlug(requiredString(req.params.slug, 'slug', 160));
    if (!venue) return res.status(404).json({ error: 'Restaurant not found.' });

    const tableSku = diningOrderService.tableSkuFor(venue);
    res.json({
      venue: {
        id: venue.id,
        slug: venue.slug,
        nameEn: venue.nameEn,
        nameAr: venue.nameAr,
        areaId: venue.areaId,
        areaName: venue.areaName,
        coordinates: venue.coordinates,
        cuisine: venue.cuisine,
        cuisineAr: venue.cuisineAr,
        priceBand: venue.priceBand,
        seatingStyle: venue.seatingStyle,
        rating: venue.rating,
        reviewCount: venue.reviewCount,
        coverImageUrl: venue.coverImageUrl,
        phone: venue.phone,
        dietaryOptions: venue.dietaryOptions,
        openingHours: venue.openingHours,
        openingHoursAr: venue.openingHoursAr,
        wifiNomadFriendly: venue.wifiNomadFriendly,
        averageMealPriceEGP: venue.averageMealPriceEGP,
        delivery: venue.delivery,
        prepMinutes: venue.prepMinutes
      },
      menu: diningOrderService.menuFor(venue.id),
      deliveryZones: diningOrderService.zonesServedBy(venue),
      // The reservation runs through the existing hold/checkout spine; the skuId
      // is what /api/commerce/hold needs.
      tableBooking: tableSku
        ? {
            skuId: tableSku.id,
            basePriceEGP: tableSku.basePriceEGP,
            maxCapacityPerSlot: tableSku.maxCapacityPerSlot,
            timeSlots: tableSku.timeSlots,
            cancellationPolicyHours: tableSku.cancellationPolicyHours
          }
        : null
    });
  } catch (err: any) {
    sendError(res, err);
  }
});

/**
 * Which zones this kitchen delivers to, and what each costs from a coordinate.
 * Answers "can they reach me, and for how much" without building a cart first.
 */
diningRouter.get('/delivery-zones', (req: AuthenticatedRequest, res: Response) => {
  try {
    const venueId = requiredString(req.query.venueId, 'venueId', 128);
    const venue = diningOrderService.findVenueById(venueId);
    if (!venue) return res.status(404).json({ error: 'Restaurant not found.' });

    const zones = diningOrderService.zonesServedBy(venue);
    const lat = req.query.lat === undefined ? undefined : Number(req.query.lat);
    const lng = req.query.lng === undefined ? undefined : Number(req.query.lng);

    // A coordinate outside Dahab is an honest refusal, not an error: the client
    // shows "we don't deliver to you" rather than a failure.
    if (lat === undefined || lng === undefined) {
      return res.json({ acceptsDelivery: venue.delivery?.acceptsDelivery ?? false, zones });
    }

    const resolved = diningOrderService.resolveZone(lat, lng);
    const match = zones.find(z => z.zoneId === resolved.zone.zoneId);
    res.json({
      acceptsDelivery: venue.delivery?.acceptsDelivery ?? false,
      minOrderEGP: venue.delivery?.minOrderEGP ?? 0,
      zones,
      nearestZone: match ? { ...match, distanceKm: resolved.distanceKm } : null,
      // Present but null when the nearest zone is not one this kitchen serves.
      resolvable: Boolean(match)
    });
  } catch (err: any) {
    sendError(res, err);
  }
});

/**
 * Price an order without placing it. Public, like /api/rentals/quote — the
 * traveler needs the number before they are willing to sign in.
 */
diningRouter.post('/quote', (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json(diningOrderService.quote(readQuoteRequest(req)));
  } catch (err: any) {
    sendError(res, err);
  }
});

/**
 * Place an order. Identity from the session.
 *
 * If the client sends a total it is IGNORED, not compared: the quote is
 * recomputed here from the menu rows, so a tampered cart total cannot be
 * charged and a menu price that moved under the traveler is simply re-quoted.
 */
diningRouter.post('/orders', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    const body = req.body || {};
    const request = readQuoteRequest(req);
    const order = diningOrderService.createOrder(
      { userId: actor.userId, role: actor.role },
      {
        ...request,
        idempotencyKey: optionalString(body.idempotencyKey, 'idempotencyKey', 128),
        notes: optionalString(body.notes, 'notes', 500)
      }
    );
    res.status(201).json({ order });
  } catch (err: any) {
    sendError(res, err);
  }
});

/** The caller's own orders. Operations sees everyone's (apiAccessPolicy). */
diningRouter.get('/orders', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    const orders = diningOrderService.listOrders({ userId: actor.userId, role: actor.role });
    res.json({
      orders: orders.map(o => ({ ...o, venue: diningOrderService.venueSummaryFor(o) })),
      count: orders.length
    });
  } catch (err: any) {
    sendError(res, err);
  }
});

diningRouter.get('/orders/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    const order = diningOrderService.findOrder(requiredString(req.params.id, 'id', 160));
    // 404 rather than 403: confirming the reference exists is the leak.
    if (!order || !diningOrderService.mayRead({ userId: actor.userId, role: actor.role }, order)) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    res.json({ order: { ...order, venue: diningOrderService.venueSummaryFor(order) } });
  } catch (err: any) {
    sendError(res, err);
  }
});

diningRouter.post('/orders/:id/cancel', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    const order = diningOrderService.cancelOrder(
      { userId: actor.userId, role: actor.role },
      requiredString(req.params.id, 'id', 160),
      optionalString(req.body?.reason, 'reason', 300)
    );
    res.json({ order });
  } catch (err: any) {
    sendError(res, err);
  }
});

/**
 * Advance an order through its states. Operations/Admin only — this is what
 * replaces the client-side "simulate status" buttons.
 */
diningRouter.post('/orders/:id/status', (req: AuthenticatedRequest, res: Response) => {
  try {
    const order = diningOrderService.advanceStatus(
      requiredString(req.params.id, 'id', 160),
      requiredEnum(req.body?.status, [
        'CONFIRMED',
        'PREPARING',
        'READY_FOR_PICKUP',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'REJECTED'
      ] as const, 'status'),
      optionalString(req.body?.reason, 'reason', 300)
    );
    res.json({ order });
  } catch (err: any) {
    sendError(res, err);
  }
});

function cheapestAvailableDish(venueId: string): number | null {
  const prices = db.diningMenuItems
    .filter(m => m.venueId === venueId && m.available)
    .map(m => m.priceEGP);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}