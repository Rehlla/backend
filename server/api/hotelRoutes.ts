import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { db } from '../db/database';
import { AccommodationEntity, HotelEntity } from '../db/schema';
import { resolveBookability } from '../services/bookabilityReconciler';
import { getAreaGuide, getAccommodationCatalogueMeta } from '../services/accommodationService';

export const hotelRouter = Router();

/**
 * Compatibility shim: /api/hotels now reads from the generalized
 * `accommodations` table (see accommodationRoutes.ts for the live surface)
 * instead of the frozen legacy `hotels` table, but returns the exact
 * pre-existing HotelEntity JSON shape so nothing calling this endpoint today
 * breaks. New integrations should use GET /api/accommodations?propertyType=hotel.
 */
const HOTEL_CATEGORIES = ['budget', 'mid-range', 'boutique', 'resort'] as const;
const HOTEL_PRICE_BANDS = ['budget', 'moderate', 'premium'] as const;

function toLegacyHotelShape(a: AccommodationEntity): HotelEntity {
  return {
    id: a.id,
    slug: a.slug,
    name: a.name,
    nameAr: a.nameAr,
    category: a.category,
    priceBand: a.priceBand,
    area: a.area,
    areaName: a.areaName,
    areaNameAr: a.areaNameAr,
    rating: a.rating,
    reviewCount: a.reviewCount,
    ratingSource: a.ratingSource,
    typeChips: a.typeChips,
    typeChipsAr: a.typeChipsAr,
    tagline: a.tagline,
    taglineAr: a.taglineAr,
    description: a.description,
    descriptionAr: a.descriptionAr,
    amenities: a.amenities,
    amenitiesAr: a.amenitiesAr,
    perNightEGP: a.perNightEGP,
    packageNights: a.packageNights,
    rooms: a.rooms,
    bestFor: a.bestFor,
    bestForAr: a.bestForAr,
    note: a.note,
    noteAr: a.noteAr,
    coordinates: a.latitude !== undefined && a.longitude !== undefined ? [a.latitude, a.longitude] : undefined,
    skuId: a.skuId,
    active: a.active,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt
  };
}

const toHotelView = (hotel: HotelEntity) => ({
  ...hotel,
  packageTotalEGP: hotel.perNightEGP * hotel.packageNights,
  bookable: resolveBookability(hotel.skuId)
});

function hotelAccommodations(): HotelEntity[] {
  return db.accommodations
    .filter(a => a.propertyType === 'hotel' && a.active)
    .map(toLegacyHotelShape);
}

/** Browsing the full catalogue: filters, stats and editorial chrome. */
hotelRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('X-Deprecated-Use', '/api/accommodations?propertyType=hotel');
  const category = req.query.category as string | undefined;
  const priceBand = req.query.priceBand as string | undefined;
  const area = req.query.area as string | undefined;

  let hotels = hotelAccommodations();
  if (category && (HOTEL_CATEGORIES as readonly string[]).includes(category)) {
    hotels = hotels.filter(h => h.category === category);
  }
  if (priceBand && (HOTEL_PRICE_BANDS as readonly string[]).includes(priceBand)) {
    hotels = hotels.filter(h => h.priceBand === priceBand);
  }
  if (area) {
    hotels = hotels.filter(h => h.area === area || h.areaName === area);
  }

  hotels = [...hotels].sort((a, b) => (b.rating - a.rating) || (b.reviewCount - a.reviewCount));

  const meta = getAccommodationCatalogueMeta();
  const stats = {
    total: hotels.length,
    averageRating: hotels.length
      ? Math.round((hotels.reduce((sum, h) => sum + h.rating, 0) / hotels.length) * 10) / 10
      : 0,
    totalReviews: hotels.reduce((sum, h) => sum + h.reviewCount, 0),
    priceBands: HOTEL_PRICE_BANDS,
    updatedLabel: meta.updatedLabel
  };

  const activeHotelEntities = db.accommodations.filter(a => a.propertyType === 'hotel' && a.active);

  res.json({
    hotels: hotels.map(toHotelView),
    areas: getAreaGuide(activeHotelEntities),
    stats,
    disclaimer: meta.disclaimer,
    filters: {
      categories: HOTEL_CATEGORIES,
      priceBands: HOTEL_PRICE_BANDS
    }
  });
});

/** A single hotel: full detail plus the availability contract needed to book. */
hotelRouter.get('/:slug', (req: AuthenticatedRequest, res: Response) => {
  res.setHeader('X-Deprecated-Use', '/api/accommodations/:slug');
  const slug = req.params.slug?.toLowerCase().trim();
  const accommodation = db.accommodations.find(a => a.slug === slug && a.propertyType === 'hotel' && a.active);
  if (!accommodation) {
    return res.status(404).json({ error: 'Hotel not found.' });
  }
  const hotel = toLegacyHotelShape(accommodation);

  const sku = db.productSkus.find(s => s.id === hotel.skuId);
  const supplier = db.suppliers.find(s => s.id === sku?.supplierId);
  const meta = getAccommodationCatalogueMeta();

  res.json({
    hotel: toHotelView(hotel),
    sku: sku
      ? {
          id: sku.id,
          title: sku.title,
          titleAr: sku.titleAr,
          basePriceEGP: sku.basePriceEGP,
          maxCapacityPerSlot: sku.maxCapacityPerSlot,
          active: sku.active,
          serviceType: sku.serviceType
        }
      : null,
    supplier: supplier
      ? {
          id: supplier.id,
          businessName: supplier.businessName,
          businessNameAr: supplier.businessNameAr,
          area: supplier.area,
          city: supplier.city,
          coordinates: supplier.coordinates,
          rating: supplier.rating,
          reviewCount: supplier.reviewCount
        }
      : null,
    areaGuide: getAreaGuide([accommodation]).find(a => a.id === accommodation.areaId) || null,
    disclaimer: meta.disclaimer
  });
});

export const getHotelCatalogueMeta = () => getAccommodationCatalogueMeta();
