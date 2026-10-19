import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { db } from '../db/database';
import { stringParam, enumListParam, stringListParam } from '../middleware/queryParams';
import {
  requiredString,
  requiredCalendarDate,
  requiredCount,
  optionalCount,
  pickAllowedKeys,
  rejectRawCardData,
  STAY_QUOTE_KEYS,
  InvalidRequestBodyError,
} from '../middleware/bodyParams';
import { AccommodationSearchFilters } from '../db/schema';
import {
  PROPERTY_TYPES,
  ACCOMMODATION_CATEGORIES,
  ACCOMMODATION_PRICE_BANDS,
  searchAccommodations,
  toAccommodationView,
  getAreaGuide,
  getAccommodationCatalogueMeta,
  listSources
} from '../services/accommodationService';
import { parseAccommodationSearchIntent } from '../services/aiReasoningService';
import * as longStayService from '../services/longStayService';
import { assertCheckInNotPast, quoteStay } from '../services/hotelPricingService';
import { checkStay } from '../services/hotelAvailabilityService';
import {
  applyAccommodationOverlay,
  applyAccommodationViewOverlays,
  applySkuOverlay,
  applySupplierOverlay,
  getPublishedOverlays,
} from '../services/catalogContentService';

export const accommodationRouter = Router();

function sendError(res: Response, err: any) {
  const status = err.status || 400;
  res.status(status).json({ error: err.message });
}

function filtersFromQuery(req: AuthenticatedRequest): AccommodationSearchFilters {
  const minRating = req.query.minRating != null ? Number(req.query.minRating) : undefined;
  const maxPerNightEGP = req.query.maxPerNightEGP != null ? Number(req.query.maxPerNightEGP) : undefined;
  const guests = req.query.guests != null ? Number(req.query.guests) : undefined;

  return {
    q: stringParam(req.query.q, 'q'),
    propertyTypes: enumListParam(req.query.propertyType, PROPERTY_TYPES, 'propertyType'),
    categories: enumListParam(req.query.category, ACCOMMODATION_CATEGORIES, 'category'),
    priceBands: enumListParam(req.query.priceBand, ACCOMMODATION_PRICE_BANDS, 'priceBand'),
    areaIds: stringListParam(req.query.areaId, 'areaId'),
    minRating: Number.isFinite(minRating) ? minRating : undefined,
    maxPerNightEGP: Number.isFinite(maxPerNightEGP) ? maxPerNightEGP : undefined,
    guests: Number.isFinite(guests) ? guests : undefined,
    mustHaveAmenities: stringListParam(req.query.mustHaveAmenities, 'mustHaveAmenities'),
    sort: enumListParam(req.query.sort, ['relevance', 'rating', 'price_asc', 'price_desc'] as const, 'sort')?.[0]
  };
}

/** Browsing the full catalogue: filters, stats and editorial chrome. */
accommodationRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const filters = filtersFromQuery(req);
    const results = searchAccommodations(filters);
    const meta = getAccommodationCatalogueMeta();

    const stats = {
      total: results.length,
      averageRating: results.length
        ? Math.round((results.reduce((sum, a) => sum + a.rating, 0) / results.length) * 10) / 10
        : 0,
      totalReviews: results.reduce((sum, a) => sum + a.reviewCount, 0),
      updatedLabel: meta.updatedLabel
    };

    const views = applyAccommodationViewOverlays(results.map(toAccommodationView));
    // ?view=card: what a listing card and the map need, nothing more. The
    // gallery, the Tripadvisor provenance block and the sellable SKU were
    // ~60% of a 5 MB response that a slow Sinai connection timed out on, and
    // the detail page fetches them per stay anyway. Without the flag the full
    // shape is unchanged for every other caller.
    const cardView = req.query.view === 'card';
    const accommodations = cardView
      ? views.map(v => {
          const {
            galleryImageUrls: _gallery,
            tripadvisor: _tripadvisor,
            bookable: _bookable,
            note: _note,
            noteAr: _noteAr,
            bestFor: _bestFor,
            bestForAr: _bestForAr,
            ...card
          } = v as typeof v & Record<string, unknown>;
          return card;
        })
      : views;

    res.json({
      accommodations,
      areas: getAreaGuide(db.accommodations.filter(a => a.active)),
      stats,
      disclaimer: meta.disclaimer,
      filters: {
        propertyTypes: PROPERTY_TYPES,
        categories: ACCOMMODATION_CATEGORIES,
        priceBands: ACCOMMODATION_PRICE_BANDS
      }
    });
  } catch (err: any) {
    sendError(res, err);
  }
});

/** Natural-language search intent, parsed into the same AccommodationSearchFilters
 *  structured search uses. The model only ever produces a filter object — the
 *  GET / query above remains the single source of truth for results. */
accommodationRouter.post('/search-intent', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const query = requiredString(req.body?.query, 'query', 500);
    const language = req.body?.language === 'ar' ? 'ar' : 'en';
    const result = await parseAccommodationSearchIntent(query, language);
    res.json(result);
  } catch (err: any) {
    if (err instanceof InvalidRequestBodyError) return sendError(res, err);
    sendError(res, { status: 500, message: 'Could not parse search intent.' });
  }
});

/** Public: list accommodations offering long-stay (weekly/monthly) pricing.
 *  Registered BEFORE /:slug — Express matches in registration order, so a
 *  later registration would be swallowed by the slug handler (404, because
 *  `long-stay` is not an accommodation slug). */
accommodationRouter.get('/long-stay', (req: AuthenticatedRequest, res: Response) => {
  const areaId = typeof req.query.areaId === 'string' ? req.query.areaId : undefined;
  const results = longStayService.getLongStayAccommodations(areaId);
  res.json({ accommodations: results });
});

// ---------------------------------------------------------------------------
// Stays: room types, availability and quotes
//
// These sit after /long-stay for the same ordering reason, and are all public:
// browsing what a property sells, what is left and what it costs is what the
// listing and detail pages do before anyone signs up. Reserving is not — that
// lives in hotelBookingRoutes behind a session.
// ---------------------------------------------------------------------------

const stayBySlug = (slug: string | undefined) => {
  const normalized = slug?.toLowerCase().trim();
  return normalized ? db.accommodations.find(a => a.slug === normalized && a.active) : undefined;
};

/** Public: the room types a property sells, cheapest-order, sellable only. */
accommodationRouter.get('/:slug/room-types', (req: AuthenticatedRequest, res: Response) => {
  const accommodation = stayBySlug(req.params.slug);
  if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

  const roomTypes = db.roomTypes
    .filter(rt => rt.accommodationId === accommodation.id && rt.active && rt.totalUnits > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.baseNightlyEGP - b.baseNightlyEGP);

  res.json({
    accommodationId: accommodation.id,
    roomTypes,
    /** A stay with no room count is held back, not guessed — say why it is absent. */
    heldBack: db.roomTypes.some(rt => rt.accommodationId === accommodation.id && !rt.active),
  });
});

/** Public: per-night availability across a window, per room type.
 *  Query: checkIn, checkOut (YYYY-MM-DD), rooms, adults, children. */
accommodationRouter.get('/:slug/availability', (req: AuthenticatedRequest, res: Response) => {
  try {
    const accommodation = stayBySlug(req.params.slug);
    if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

    const checkIn = requiredCalendarDate(req.query.checkIn, 'checkIn');
    const checkOut = requiredCalendarDate(req.query.checkOut, 'checkOut');
    const rooms = requiredCount(req.query.rooms, 'rooms', 1, 20);
    const adults = requiredCount(req.query.adults, 'adults', 1, 30);
    const children = optionalCount(req.query.children, 'children', 0, 20) ?? 0;

    const candidates = db.roomTypes.filter(
      rt => rt.accommodationId === accommodation.id && rt.active && rt.totalUnits > 0
    );
    if (candidates.length === 0) {
      return res.json({ accommodationId: accommodation.id, available: false, reason: 'INACTIVE_ROOM_TYPE', roomTypes: [] });
    }

    const roomTypes = candidates.map(rt => {
      try {
        const availability = checkStay({
          accommodationId: accommodation.id,
          roomTypeId: rt.id,
          checkIn,
          checkOut,
          rooms,
        });
        const fitsParty = adults + children <= rooms * rt.maxGuestsPerUnit;
        return {
          ...availability,
          roomTypeId: rt.id,
          name: rt.name,
          nameAr: rt.nameAr,
          fitsParty,
          available: availability.available && fitsParty,
        };
      } catch {
        // An unreadable window for one type must not blank the whole answer.
        return { roomTypeId: rt.id, available: false };
      }
    });

    res.json({
      accommodationId: accommodation.id,
      available: roomTypes.some(rt => rt.available === true),
      roomTypes,
    });
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Invalid availability request.' });
  }
});

/** Public: what a stay costs. Stateless — the reservation re-prices under a
 *  lock and snapshots the result, so this figure is never a promise. */
accommodationRouter.post('/:slug/quote', (req: AuthenticatedRequest, res: Response) => {
  try {
    rejectRawCardData(req.body);
    const body = pickAllowedKeys(req.body, STAY_QUOTE_KEYS, 'body');
    const accommodation = stayBySlug(req.params.slug);
    if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

    const checkIn = requiredCalendarDate(body.checkIn, 'checkIn');
    assertCheckInNotPast(checkIn);
    const quote = quoteStay({
      accommodationId: accommodation.id,
      roomTypeId: requiredString(body.roomTypeId, 'roomTypeId', 128),
      checkIn,
      checkOut: requiredCalendarDate(body.checkOut, 'checkOut'),
      rooms: requiredCount(body.rooms, 'rooms', 1, 20),
      adults: requiredCount(body.adults, 'adults', 1, 30),
      children: optionalCount(body.children, 'children', 0, 20) ?? 0,
    });
    res.json({ quote });
  } catch (err: any) {
    const status = err?.status ?? 400;
    res.status(status).json({
      error: status >= 500 ? 'Could not price this stay.' : err?.message || 'Invalid quote request.',
      code: err?.code,
    });
  }
});

/**
 * Public: what guests who actually stayed here said.
 *
 * The catalogue ships its own rating and review count, which are marketing
 * numbers from Tripadvisor. These are the platform's own, and they are only
 * ever tied to a completed stay - reviewService.submitReview refuses a review
 * for a booking the supplier has not finished, so nothing here can be a
 * recommendation from someone who never arrived.
 *
 * Approved only: a review is held for moderation until staff clear it, and an
 * unmoderated opinion is not something to publish under a property's name.
 */
accommodationRouter.get('/:slug/reviews', (req: AuthenticatedRequest, res: Response) => {
  try {
    const accommodation = stayBySlug(req.params.slug);
    if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 8));

    // Reviews hang off the supplier that fulfils the property's room types, so
    // one property's reviews are that supplier's.
    const supplierIds = new Set(
      db.roomTypes.filter(rt => rt.accommodationId === accommodation.id).map(rt => rt.supplierId)
    );
    if (accommodation.skuId) {
      const sku = db.productSkus.find(s => s.id === accommodation.skuId);
      if (sku) supplierIds.add(sku.supplierId);
    }

    const approved = db.reviews
      .filter(r => supplierIds.has(r.supplierId) && r.moderationStatus === 'approved')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const start = (page - 1) * limit;
    const slice = approved.slice(start, start + limit);

    // A review is a public record, so the author is a first name and an initial
    // rather than a full name.
    const withAuthors = slice.map(r => {
      const user = db.users.find(u => u.id === r.userId);
      const name = user?.name?.trim() ?? '';
      const parts = name ? name.split(/\s+/) : [];
      return {
        id: r.id,
        rating: r.rating,
        title: r.title,
        body: r.body,
        bodyAr: r.bodyAr,
        supplierResponse: r.supplierResponse,
        supplierResponseAt: r.supplierResponseAt,
        authorFirstName: parts[0] || 'Guest',
        authorInitial: parts.length > 1 ? parts.at(-1)?.[0] : undefined,
        createdAt: r.createdAt,
      };
    });

    const count = approved.length;
    res.json({
      reviews: withAuthors,
      page,
      limit,
      total: count,
      hasMore: start + slice.length < count,
      // The platform's own aggregate, kept apart from the catalogue's rating.
      platformAverage: count > 0
        ? Math.round((approved.reduce((a, r) => a + r.rating, 0) / count) * 10) / 10
        : null,
      platformCount: count,
    });
  } catch (err: any) {
    res.status(err?.status || 400).json({ error: err?.message || 'Invalid request.' });
  }
});

/** A single property: full detail plus the availability contract and any
 *  admin-curated external reference links. */
accommodationRouter.get('/:slug', (req: AuthenticatedRequest, res: Response) => {
  try {
    const slug = req.params.slug?.toLowerCase().trim();
    const accommodation = db.accommodations.find(a => a.slug === slug && a.active);
    if (!accommodation) return res.status(404).json({ error: 'Accommodation not found.' });

    const sku = db.productSkus.find(s => s.id === accommodation.skuId);
    const supplier = db.suppliers.find(s => s.id === sku?.supplierId);
    const areaGuide = getAreaGuide([accommodation]).find(a => a.id === accommodation.areaId) || null;
    const meta = getAccommodationCatalogueMeta();

    // Published CMS copy/imagery overrides (no-op when nothing is published).
    const overlayMap = getPublishedOverlays('accommodation', [accommodation.id]);
    const skuMap = getPublishedOverlays('sku', sku ? [sku.id] : []);
    const supplierMap = getPublishedOverlays('supplier', supplier ? [supplier.id] : []);

    res.json({
      accommodation: applyAccommodationOverlay(toAccommodationView(accommodation), overlayMap[accommodation.id] ?? null),
      sku: sku
        ? applySkuOverlay({ id: sku.id, title: sku.title, titleAr: sku.titleAr, basePriceEGP: sku.basePriceEGP, maxCapacityPerSlot: sku.maxCapacityPerSlot, active: sku.active, serviceType: sku.serviceType }, skuMap[sku.id] ?? null)
        : null,
      supplier: supplier
        ? applySupplierOverlay({ id: supplier.id, businessName: supplier.businessName, businessNameAr: supplier.businessNameAr, area: supplier.area, city: supplier.city, coordinates: supplier.coordinates, rating: supplier.rating, reviewCount: supplier.reviewCount }, supplierMap[supplier.id] ?? null)
        : null,
      areaGuide,
      sources: listSources(accommodation.id),
      disclaimer: meta.disclaimer
    });
  } catch (err: any) {
    sendError(res, err);
  }
});
