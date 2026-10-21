import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { db } from '../db/database';
import { findByIdOrRef } from '../db/lookups';
import { rentalService, RENTAL_ZONES } from '../services/rentalService';
import {
  requiredString,
  optionalString,
  requiredCount,
  requiredCalendarDate,
  optionalEnum
} from '../middleware/bodyParams';
import { applyRentalViewOverlays } from '../services/catalogContentService';

/**
 * Who the caller may act for, matching server.ts's resolveActingSupplierId:
 * Supplier accounts are pinned to their own linked business; Operations and
 * Admin may act for a named supplier. Everyone else: nothing.
 */
function actingSupplierId(req: AuthenticatedRequest, requested?: string): string | null {
  const user = req.user;
  if (!user) return null;
  if (user.role === 'Operations' || user.role === 'Admin') return requested || user.supplierId || null;
  if (user.role === 'Supplier') return user.supplierId || null;
  return null;
}

function mayReadBooking(actor: NonNullable<AuthenticatedRequest['user']>, userId: string): boolean {
  return actor.userId === userId || actor.role === 'Operations' || actor.role === 'Admin';
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
    throw new Error('extraIds must be an array of strings.');
  }
  return value as string[];
}

function sendError(res: Response, err: any) {
  res.status(err.status || 400).json({ error: err.message, code: err.code, details: err.details });
}

// ---------------------------------------------------------------------------
// /api/rentals — public catalogue, quoting and availability; provider/admin
// management under role-scoped paths.
// ---------------------------------------------------------------------------
export const rentalRouter = Router();

rentalRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const category = optionalString(req.query.category, 'category', 32);
    const subcategory = optionalString(req.query.subcategory, 'subcategory', 32);
    const zone = optionalString(req.query.zone, 'zone', 32);
    const q = optionalString(req.query.q, 'q', 120);
    const priceMin = req.query.priceMin != null ? Number(req.query.priceMin) : undefined;
    const priceMax = req.query.priceMax != null ? Number(req.query.priceMax) : undefined;
    const startDate = optionalString(req.query.startDate, 'startDate', 10);
    const endDate = optionalString(req.query.endDate, 'endDate', 10);
    const quantity = req.query.quantity != null ? Number(req.query.quantity) : undefined;
    const sort = optionalString(req.query.sort, 'sort', 24) || 'featured';

    const listings = rentalService.listListings({
      category,
      subcategory,
      zone,
      q,
      priceMin: Number.isFinite(priceMin) ? priceMin : undefined,
      priceMax: Number.isFinite(priceMax) ? priceMax : undefined,
      startDate,
      endDate,
      quantity: Number.isFinite(quantity) && quantity! > 0 ? Math.floor(quantity!) : undefined
    });

    const sorted = [...listings].sort((a, b) => {
      if (sort === 'price_asc') return a.dailyRateEGP - b.dailyRateEGP;
      if (sort === 'price_desc') return b.dailyRateEGP - a.dailyRateEGP;
      if (sort === 'rating') return (b.rating || 0) - (a.rating || 0);
      return (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || (b.rating || 0) - (a.rating || 0);
    });

    res.json({
      rentals: applyRentalViewOverlays(sorted.map(l => rentalService.getListingView(l))),
      categories: ['bike', 'e-bike'],
      zones: RENTAL_ZONES,
      stats: {
        total: sorted.length,
        averageRating: sorted.length
          ? Math.round((sorted.reduce((sum, l) => sum + (l.rating || 0), 0) / sorted.length) * 10) / 10
          : 0
      },
      filters: { sortOptions: ['featured', 'price_asc', 'price_desc', 'rating'] }
    });
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalRouter.get('/provider', (req: AuthenticatedRequest, res: Response) => {
  try {
    // Admin/Operations may ask for a named supplier (query); a linked
    // Supplier gets their own.
    const supplierId = actingSupplierId(req, optionalString(req.query.supplierId, 'supplierId', 128));
    if (!supplierId) return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
    const listings = rentalService.providerListings(supplierId);
    res.json({ rentals: listings.map(l => rentalService.getListingView(l)) });
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalRouter.get('/:slug', (req: AuthenticatedRequest, res: Response) => {
  try {
    const slug = req.params.slug?.toLowerCase().trim();
    const listing = db.rentalListings.find(l => l.slug === slug && l.status === 'APPROVED' && l.active);
    if (!listing) return res.status(404).json({ error: 'Rental not found.' });

    const startDate = optionalString(req.query.startDate, 'startDate', 10);
    const endDate = optionalString(req.query.endDate, 'endDate', 10);
    const quantity = req.query.quantity != null ? Number(req.query.quantity) : undefined;

    let availability = null;
    if (startDate && endDate && Number.isFinite(quantity) && quantity! > 0) {
      availability = rentalService.checkAvailability({
        listingId: listing.id,
        startDate,
        endDate,
        quantity: Math.floor(quantity!)
      });
    }

    res.json({
      rental: applyRentalViewOverlays([rentalService.getListingView(listing)])[0],
      zones: RENTAL_ZONES,
      availability
    });
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalRouter.post('/check-availability', (req: AuthenticatedRequest, res: Response) => {
  try {
    const listingId = requiredString(req.body?.listingId, 'listingId', 128);
    const startDate = requiredCalendarDate(req.body?.startDate, 'startDate');
    const endDate = requiredCalendarDate(req.body?.endDate, 'endDate');
    const quantity = requiredCount(req.body?.quantity, 'quantity', 1, 50);
    res.json(rentalService.checkAvailability({ listingId, startDate, endDate, quantity }));
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalRouter.post('/quote', (req: AuthenticatedRequest, res: Response) => {
  try {
    const listingId = requiredString(req.body?.listingId, 'listingId', 128);
    const startDate = requiredCalendarDate(req.body?.startDate, 'startDate');
    const endDate = requiredCalendarDate(req.body?.endDate, 'endDate');
    const quantity = requiredCount(req.body?.quantity, 'quantity', 1, 50);
    const deliveryMode = optionalEnum(req.body?.deliveryMode, ['PICKUP', 'DELIVERY'] as const, 'deliveryMode') || 'PICKUP';
    res.json(
      rentalService.quote({
        listingId,
        startDate,
        endDate,
        quantity,
        extraIds: optionalStringArray(req.body?.extraIds),
        deliveryMode,
        deliveryZoneId: optionalString(req.body?.deliveryZoneId, 'deliveryZoneId', 64)
      })
    );
  } catch (err: any) {
    sendError(res, err);
  }
});

/** Create a maintenance block. Provider for own listings; Ops/Admin for any. */
rentalRouter.post('/:id/maintenance-blocks', (req: AuthenticatedRequest, res: Response) => {
  try {
    const supplierId = actingSupplierId(req, optionalString(req.body?.supplierId, 'supplierId', 128));
    if (!supplierId) return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
    const listing = db.rentalListings.find(l => l.id === req.params.id);
    if (!listing) return res.status(404).json({ error: 'Rental not found.' });
    const isOps = req.user!.role === 'Operations' || req.user!.role === 'Admin';
    if (!isOps && listing.supplierId !== supplierId) {
      return res.status(403).json({ error: 'This listing belongs to a different supplier.' });
    }

    const block = rentalService.createMaintenanceBlock({
      listingId: listing.id,
      startDate: requiredCalendarDate(req.body?.startDate, 'startDate'),
      endDate: requiredCalendarDate(req.body?.endDate, 'endDate'),
      quantityBlocked: requiredCount(req.body?.quantityBlocked, 'quantityBlocked', 1, 100),
      reason: optionalString(req.body?.reason, 'reason', 200) || 'Maintenance',
      createdBy: supplierId
    });
    res.status(201).json({ block });
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalRouter.delete('/:id/maintenance-blocks/:blockId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const supplierId = actingSupplierId(req);
    const removed = rentalService.deleteMaintenanceBlock({
      blockId: req.params.blockId,
      supplierId: supplierId || undefined,
      actorRole: req.user!.role
    });
    res.json({ removed });
  } catch (err: any) {
    sendError(res, err);
  }
});

/** Approve / reject / suspend / feature a listing — Operations & Admin only. */
rentalRouter.patch('/:id/status', (req: AuthenticatedRequest, res: Response) => {
  try {
    const listing = rentalService.setListingStatus({
      listingId: req.params.id,
      status: requiredString(req.body?.status, 'status', 32) as any,
      actor: req.user!
    });
    res.json({ rental: rentalService.getListingView(listing) });
  } catch (err: any) {
    sendError(res, err);
  }
});

// ---------------------------------------------------------------------------
// /api/rental-bookings — traveler hold/checkout/cancel, provider actions.
// ---------------------------------------------------------------------------
export const rentalBookingRouter = Router();

rentalBookingRouter.get('/provider', (req: AuthenticatedRequest, res: Response) => {
  try {
    // Admin/Operations may ask for a named supplier (query, like server.ts's
    // /api/suppliers/:supplierId/bookings); a linked Supplier gets their own.
    const supplierId = actingSupplierId(req, optionalString(req.query.supplierId, 'supplierId', 128));
    if (!supplierId) return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
    const bookings = rentalService.providerBookings(supplierId, {
      status: optionalString(req.query.status, 'status', 32),
      from: optionalString(req.query.from, 'from', 10),
      to: optionalString(req.query.to, 'to', 10)
    });
    res.json({ bookings });
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalBookingRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    const result = rentalService.createRentalBooking({
      listingId: requiredString(req.body?.listingId, 'listingId', 128),
      tripId: requiredString(req.body?.tripId, 'tripId', 128),
      // Identity from the session, never the body.
      userId: actor.userId,
      travelerName: actor.name,
      travelerEmail: actor.email,
      travelerPhone: optionalString(req.body?.travelerPhone, 'travelerPhone', 32) || '',
      startDate: requiredCalendarDate(req.body?.startDate, 'startDate'),
      endDate: requiredCalendarDate(req.body?.endDate, 'endDate'),
      quantity: requiredCount(req.body?.quantity, 'quantity', 1, 50),
      deliveryMode: optionalEnum(req.body?.deliveryMode, ['PICKUP', 'DELIVERY'] as const, 'deliveryMode') || 'PICKUP',
      deliveryZoneId: optionalString(req.body?.deliveryZoneId, 'deliveryZoneId', 64),
      deliveryAddress: optionalString(req.body?.deliveryAddress, 'deliveryAddress', 300),
      pickupTime: optionalString(req.body?.pickupTime, 'pickupTime', 64),
      extraIds: optionalStringArray(req.body?.extraIds),
      notes: optionalString(req.body?.notes, 'notes', 500),
      idempotencyKey: optionalString(req.body?.idempotencyKey, 'idempotencyKey', 128)
    });
    res.status(201).json(result);
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalBookingRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    const canSeeAll = actor.role === 'Operations' || actor.role === 'Admin';
    const bookings = db.rentalBookings
      .filter(b => canSeeAll || b.userId === actor.userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ bookings });
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalBookingRouter.get('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = findByIdOrRef(db.rentalBookings, req.params.id);
    if (!booking) return res.status(404).json({ error: 'Rental booking not found.' });
    if (!mayReadBooking(req.user!, booking.userId)) {
      // 404, not 403: confirming the id exists would itself leak a booking.
      return res.status(404).json({ error: 'Rental booking not found.' });
    }
    res.json({ booking });
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalBookingRouter.post('/:id/checkout', (req: AuthenticatedRequest, res: Response) => {
  try {
    const actor = req.user!;
    const booking = findByIdOrRef(db.rentalBookings, req.params.id);
    if (!booking) return res.status(404).json({ error: 'Rental booking not found.' });
    if (!mayReadBooking(actor, booking.userId)) {
      return res.status(404).json({ error: 'Rental booking not found.' });
    }
    const result = rentalService.checkoutRentalBooking({
      rentalBookingId: booking.id,
      tripId: requiredString(req.body?.tripId, 'tripId', 128),
      travelerName: actor.name,
      travelerPhone: optionalString(req.body?.travelerPhone, 'travelerPhone', 32) || booking.travelerPhone,
      travelerEmail: actor.email,
      idempotencyKey: requiredString(req.body?.idempotencyKey, 'idempotencyKey', 128),
      provider: optionalEnum(req.body?.provider, ['PAYMOB', 'STRIPE', 'CASH_ON_ARRIVAL'] as const, 'provider'),
      cardLast4: optionalString(req.body?.cardLast4, 'cardLast4', 4),
      cardBrand: optionalString(req.body?.cardBrand, 'cardBrand', 32),
      cardHolderName: optionalString(req.body?.cardHolderName, 'cardHolderName', 120)
    });
    res.json(result);
  } catch (err: any) {
    sendError(res, err);
  }
});

rentalBookingRouter.post('/:id/cancel', (req: AuthenticatedRequest, res: Response) => {
  try {
    const booking = findByIdOrRef(db.rentalBookings, req.params.id);
    if (!booking) return res.status(404).json({ error: 'Rental booking not found.' });
    if (!mayReadBooking(req.user!, booking.userId)) {
      return res.status(404).json({ error: 'Rental booking not found.' });
    }
    const updated = rentalService.cancelRentalBooking({
      bookingId: booking.id,
      actor: req.user!,
      reason: optionalString(req.body?.reason, 'reason', 300)
    });
    res.json({ booking: updated });
  } catch (err: any) {
    sendError(res, err);
  }
});

/** Provider actions: accept / reject / mark-returned / complete. */
function providerAction(
  req: AuthenticatedRequest,
  res: Response,
  run: (bookingId: string, supplierId: string) => any
) {
  try {
    // Admin/Operations may act for a named supplier (body, like server.ts's
    // /api/suppliers/bookings/:bookingId/respond); a linked Supplier gets
    // their own and a requested id they do not own is refused below.
    const supplierId = actingSupplierId(req, optionalString(req.body?.supplierId, 'supplierId', 128));
    if (!supplierId) return res.status(403).json({ error: 'Your account is not linked to a supplier.' });
    const booking = findByIdOrRef(db.rentalBookings, req.params.id);
    if (!booking) return res.status(404).json({ error: 'Rental booking not found.' });
    if (booking.supplierId !== supplierId && !(req.user!.role === 'Operations' || req.user!.role === 'Admin')) {
      return res.status(403).json({ error: 'This booking belongs to a different supplier.' });
    }
    res.json({ booking: run(booking.id, supplierId) });
  } catch (err: any) {
    sendError(res, err);
  }
}

rentalBookingRouter.post('/:id/accept', (req: AuthenticatedRequest, res: Response) =>
  providerAction(req, res, (bookingId, supplierId) => rentalService.acceptRentalBooking({ bookingId, supplierId })));

rentalBookingRouter.post('/:id/reject', (req: AuthenticatedRequest, res: Response) =>
  providerAction(req, res, (bookingId, supplierId) =>
    rentalService.rejectRentalBooking({ bookingId, supplierId, reason: optionalString(req.body?.reason, 'reason', 300) })));

rentalBookingRouter.post('/:id/mark-returned', (req: AuthenticatedRequest, res: Response) =>
  providerAction(req, res, (bookingId, supplierId) =>
    rentalService.markRentalReturned({
      bookingId,
      supplierId,
      damageReport: optionalString(req.body?.damageReport, 'damageReport', 500),
      depositDeductionEGP: req.body?.depositDeductionEGP != null ? Number(req.body.depositDeductionEGP) : undefined,
      lateFeeEGP: req.body?.lateFeeEGP != null ? Number(req.body.lateFeeEGP) : undefined
    })));

rentalBookingRouter.post('/:id/complete', (req: AuthenticatedRequest, res: Response) =>
  providerAction(req, res, (bookingId, supplierId) => rentalService.completeRentalBooking({ bookingId, supplierId })));