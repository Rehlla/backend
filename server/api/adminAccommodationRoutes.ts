import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { requireAuth } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import { db } from '../db/database';
import {
  requiredString,
  optionalString,
  requiredEnum,
  optionalEnum,
  requiredCount,
  InvalidRequestBodyError
} from '../middleware/bodyParams';
import { stringParam } from '../middleware/queryParams';
import {
  PROPERTY_TYPES,
  ACCOMMODATION_CATEGORIES,
  ACCOMMODATION_PRICE_BANDS,
  PROPERTY_SOURCE_TYPES,
  createAccommodation,
  updateAccommodation,
  setAccommodationActive,
  toAccommodationView,
  listSources,
  addSource,
  updateSource,
  deleteSource
} from '../services/accommodationService';

export const adminAccommodationRouter = Router();
adminAccommodationRouter.use(requireAuth);
adminAccommodationRouter.use(requireRole('Operations', 'Admin', 'Product'));

function sendError(res: Response, err: any) {
  const status = err.status || (err.message?.includes('not found') ? 404 : 400);
  res.status(status).json({ error: err.message });
}

function requiredNumber(value: unknown, field: string): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new InvalidRequestBodyError(field, 'must be a number.');
  return n;
}

function requiredStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) {
    throw new InvalidRequestBodyError(field, 'must be an array of strings.');
  }
  return value as string[];
}

adminAccommodationRouter.get('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const q = stringParam(req.query.q, 'q');
    const active = req.query.active != null ? req.query.active === 'true' : undefined;
    let items = db.accommodations;
    if (active !== undefined) items = items.filter(a => a.active === active);
    if (q) items = items.filter(a => a.name.toLowerCase().includes(q.toLowerCase()) || a.nameAr.includes(q));
    res.json({ accommodations: items.map(toAccommodationView) });
  } catch (err: any) {
    sendError(res, err);
  }
});

adminAccommodationRouter.post('/', (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const accommodation = createAccommodation({
      slug: requiredString(body.slug, 'slug', 128),
      name: requiredString(body.name, 'name', 200),
      nameAr: requiredString(body.nameAr, 'nameAr', 200),
      propertyType: requiredEnum(body.propertyType, PROPERTY_TYPES, 'propertyType'),
      category: requiredEnum(body.category, ACCOMMODATION_CATEGORIES, 'category'),
      priceBand: requiredEnum(body.priceBand, ACCOMMODATION_PRICE_BANDS, 'priceBand'),
      areaId: requiredString(body.areaId, 'areaId', 64),
      area: requiredString(body.area, 'area', 64),
      areaName: requiredString(body.areaName, 'areaName', 120),
      areaNameAr: requiredString(body.areaNameAr, 'areaNameAr', 120),
      rating: requiredNumber(body.rating, 'rating'),
      reviewCount: requiredCount(body.reviewCount, 'reviewCount', 0, 1_000_000),
      ratingSource: optionalString(body.ratingSource, 'ratingSource', 120),
      typeChips: requiredStringArray(body.typeChips || [], 'typeChips'),
      typeChipsAr: requiredStringArray(body.typeChipsAr || [], 'typeChipsAr'),
      tagline: requiredString(body.tagline, 'tagline', 300),
      taglineAr: requiredString(body.taglineAr, 'taglineAr', 300),
      description: requiredString(body.description, 'description', 3000),
      descriptionAr: requiredString(body.descriptionAr, 'descriptionAr', 3000),
      amenities: requiredStringArray(body.amenities || [], 'amenities'),
      amenitiesAr: requiredStringArray(body.amenitiesAr || [], 'amenitiesAr'),
      perNightEGP: requiredNumber(body.perNightEGP, 'perNightEGP'),
      packageNights: requiredCount(body.packageNights, 'packageNights', 1, 60),
      rooms: requiredCount(body.rooms, 'rooms', 0, 2000),
      maxGuests: requiredCount(body.maxGuests, 'maxGuests', 1, 50),
      bestFor: requiredString(body.bestFor, 'bestFor', 300),
      bestForAr: requiredString(body.bestForAr, 'bestForAr', 300),
      note: requiredString(body.note, 'note', 500),
      noteAr: requiredString(body.noteAr, 'noteAr', 500),
      latitude: body.latitude != null ? requiredNumber(body.latitude, 'latitude') : undefined,
      longitude: body.longitude != null ? requiredNumber(body.longitude, 'longitude') : undefined,
      active: body.active !== false,
      featured: body.featured === true
    });
    res.status(201).json({ accommodation: toAccommodationView(accommodation) });
  } catch (err: any) {
    sendError(res, err);
  }
});

adminAccommodationRouter.put('/:id', (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const patch: Record<string, unknown> = {};
    for (const key of [
      'name', 'nameAr', 'tagline', 'taglineAr', 'description', 'descriptionAr',
      'bestFor', 'bestForAr', 'note', 'noteAr', 'areaId', 'area', 'areaName', 'areaNameAr'
    ]) {
      if (body[key] !== undefined) patch[key] = optionalString(body[key], key, 3000);
    }
    if (body.propertyType !== undefined) patch.propertyType = requiredEnum(body.propertyType, PROPERTY_TYPES, 'propertyType');
    if (body.category !== undefined) patch.category = requiredEnum(body.category, ACCOMMODATION_CATEGORIES, 'category');
    if (body.priceBand !== undefined) patch.priceBand = requiredEnum(body.priceBand, ACCOMMODATION_PRICE_BANDS, 'priceBand');
    if (body.perNightEGP !== undefined) patch.perNightEGP = requiredNumber(body.perNightEGP, 'perNightEGP');
    if (body.packageNights !== undefined) patch.packageNights = requiredCount(body.packageNights, 'packageNights', 1, 60);
    if (body.rooms !== undefined) patch.rooms = requiredCount(body.rooms, 'rooms', 0, 2000);
    if (body.maxGuests !== undefined) patch.maxGuests = requiredCount(body.maxGuests, 'maxGuests', 1, 50);
    if (body.amenities !== undefined) patch.amenities = requiredStringArray(body.amenities, 'amenities');
    if (body.amenitiesAr !== undefined) patch.amenitiesAr = requiredStringArray(body.amenitiesAr, 'amenitiesAr');
    if (body.typeChips !== undefined) patch.typeChips = requiredStringArray(body.typeChips, 'typeChips');
    if (body.typeChipsAr !== undefined) patch.typeChipsAr = requiredStringArray(body.typeChipsAr, 'typeChipsAr');
    if (body.featured !== undefined) patch.featured = body.featured === true;

    const accommodation = updateAccommodation(req.params.id, patch as any);
    res.json({ accommodation: toAccommodationView(accommodation) });
  } catch (err: any) {
    sendError(res, err);
  }
});

adminAccommodationRouter.patch('/:id/active', (req: AuthenticatedRequest, res: Response) => {
  try {
    if (typeof req.body?.active !== 'boolean') {
      throw new InvalidRequestBodyError('active', 'is required and must be a boolean.');
    }
    const accommodation = setAccommodationActive(req.params.id, req.body.active);
    res.json({ accommodation: toAccommodationView(accommodation) });
  } catch (err: any) {
    sendError(res, err);
  }
});

adminAccommodationRouter.get('/:id/sources', (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ sources: listSources(req.params.id, true) });
  } catch (err: any) {
    sendError(res, err);
  }
});

adminAccommodationRouter.post('/:id/sources', (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const sourceType = requiredEnum(body.sourceType, PROPERTY_SOURCE_TYPES, 'sourceType');
    if (sourceType === 'OTHER' && !optionalString(body.label, 'label', 120)) {
      throw new InvalidRequestBodyError('label', 'is required when sourceType is OTHER.');
    }
    const source = addSource({
      accommodationId: req.params.id,
      sourceType,
      url: requiredString(body.url, 'url', 500),
      label: optionalString(body.label, 'label', 120),
      displayOrder: body.displayOrder != null ? requiredNumber(body.displayOrder, 'displayOrder') : undefined,
      addedByUserId: req.user!.userId
    });
    res.status(201).json({ source });
  } catch (err: any) {
    sendError(res, err);
  }
});

adminAccommodationRouter.patch('/:id/sources/:sourceId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const body = req.body || {};
    const patch: Record<string, unknown> = {};
    if (body.url !== undefined) patch.url = requiredString(body.url, 'url', 500);
    if (body.label !== undefined) patch.label = optionalString(body.label, 'label', 120);
    if (body.displayOrder !== undefined) patch.displayOrder = requiredNumber(body.displayOrder, 'displayOrder');
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') throw new InvalidRequestBodyError('active', 'must be a boolean.');
      patch.active = body.active;
    }
    if (body.sourceType !== undefined) patch.sourceType = requiredEnum(body.sourceType, PROPERTY_SOURCE_TYPES, 'sourceType');
    const source = updateSource(req.params.sourceId, patch as any);
    res.json({ source });
  } catch (err: any) {
    sendError(res, err);
  }
});

adminAccommodationRouter.delete('/:id/sources/:sourceId', (req: AuthenticatedRequest, res: Response) => {
  try {
    const removed = deleteSource(req.params.sourceId);
    if (!removed) return res.status(404).json({ error: 'Source link not found.' });
    res.json({ removed: true });
  } catch (err: any) {
    sendError(res, err);
  }
});
