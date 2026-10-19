import fs from 'fs';
import crypto from 'crypto';
import { db } from '../db/database';
import { seedPath } from '../db/paths';
import {
  AccommodationEntity,
  AccommodationSearchFilters,
  PropertySourceEntity,
  PropertySourceType,
  PropertyType
} from '../db/schema';
import { resolveBookability } from './bookabilityReconciler';

export const PROPERTY_TYPES: readonly PropertyType[] = [
  'hotel', 'hostel', 'apartment', 'studio', 'villa',
  'guesthouse', 'camp', 'eco-lodge', 'boutique-hotel', 'resort', 'chalet'
];
export const ACCOMMODATION_CATEGORIES = ['budget', 'mid-range', 'boutique', 'resort'] as const;
export const ACCOMMODATION_PRICE_BANDS = ['budget', 'moderate', 'premium'] as const;
export const PROPERTY_SOURCE_TYPES: readonly PropertySourceType[] = [
  'WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'BOOKING_COM', 'AIRBNB', 'OTHER'
];

/** A handful of amenity synonyms so "sea view" and "seaview" both match. */
const AMENITY_SYNONYMS: Record<string, string> = {
  seaview: 'sea view',
  'sea-view': 'sea view',
  wifi: 'wifi',
  'wi-fi': 'wifi',
  ac: 'air conditioning',
  aircon: 'air conditioning'
};

function normalizeAmenity(raw: string): string {
  const lower = raw.trim().toLowerCase();
  return AMENITY_SYNONYMS[lower] || lower;
}

function hasAmenity(entity: AccommodationEntity, wanted: string): boolean {
  const target = normalizeAmenity(wanted);
  const haystack = [...entity.amenities, ...entity.typeChips, entity.tagline, entity.description]
    .join(' ')
    .toLowerCase();
  return haystack.includes(target);
}

/**
 * Static catalogue chrome (updated label, disclaimer) lives in the seed file
 * alongside the properties, not per-row runtime state — read once at boot,
 * same pattern hotelRoutes.ts used.
 */
let catalogueMeta: { updatedLabel?: string; disclaimer?: { en: string; ar: string } } = {};

try {
  const seedFile = seedPath('dahab_accommodations.json');
  if (fs.existsSync(seedFile)) {
    const parsed = JSON.parse(fs.readFileSync(seedFile, 'utf-8'));
    catalogueMeta = {
      updatedLabel: parsed.metadata?.updatedLabel,
      disclaimer: parsed.metadata?.disclaimer
    };
  }
} catch {
  catalogueMeta = {};
}

export function getAccommodationCatalogueMeta() {
  return catalogueMeta;
}

export function toAccommodationView(entity: AccommodationEntity) {
  const view = {
    ...entity,
    packageTotalEGP: entity.perNightEGP * entity.packageNights,
    bookable: resolveBookability(entity.skuId)
  };
  // The gallery/source photo URL arrays are seed-file provenance, not display
  // data, and the catalogue endpoint serves the whole collection at once: kept
  // on the row, they pushed the response past 3MB and past the client's
  // 8-second fetch timeout, so the grid silently rendered empty. The listing
  // URL, cover and location id still travel.
  if (view.tripadvisor) {
    const { galleryPhotoUrls: _gallery, sourceImageUrls: _source, ...rest } = view.tripadvisor;
    view.tripadvisor = rest;
  }
  return view;
}

/** Area-guide entries derived from the real area_profiles, scoped to areas
 *  that actually have an active property — not the old seed's disconnected
 *  areaGuide[] array. */
export function getAreaGuide(activeAccommodations: AccommodationEntity[]) {
  const usedAreaIds = new Set(activeAccommodations.map(a => a.areaId));
  return db.areaProfiles
    .filter(a => usedAreaIds.has(a.id))
    .map(a => ({
      id: a.id,
      name: a.nameEn,
      nameAr: a.nameAr,
      description: a.atmosphere,
      descriptionAr: a.atmosphereAr
    }));
}

function textRelevance(entity: AccommodationEntity, q: string | undefined): number {
  if (!q) return 0.5;
  const needle = q.trim().toLowerCase();
  if (!needle) return 0.5;
  if (entity.name.toLowerCase().includes(needle) || entity.nameAr.includes(needle)) return 1;
  if (
    entity.tagline.toLowerCase().includes(needle) ||
    entity.description.toLowerCase().includes(needle) ||
    entity.taglineAr.includes(needle) ||
    entity.descriptionAr.includes(needle)
  ) {
    return 0.7;
  }
  if (entity.typeChips.some(c => c.toLowerCase().includes(needle)) || entity.amenities.some(a => a.toLowerCase().includes(needle))) {
    return 0.5;
  }
  return 0.15;
}

/** Applies the hard filters, then computes the soft ranking score. With no
 *  `q` and no filters, this reduces to today's rating-desc ordering — no
 *  regression for plain browsing. See accommodation search architecture in
 *  the implementation plan for the weight rationale. */
export function searchAccommodations(filters: AccommodationSearchFilters, includeInactive = false) {
  let items = db.accommodations.filter(a => includeInactive || a.active);

  if (filters.propertyTypes?.length) {
    items = items.filter(a => filters.propertyTypes!.includes(a.propertyType));
  }
  if (filters.categories?.length) {
    items = items.filter(a => filters.categories!.includes(a.category));
  }
  if (filters.priceBands?.length) {
    items = items.filter(a => filters.priceBands!.includes(a.priceBand));
  }
  if (filters.areaIds?.length) {
    items = items.filter(a => filters.areaIds!.includes(a.areaId) || filters.areaIds!.includes(a.area));
  }
  if (filters.minRating !== undefined) {
    items = items.filter(a => a.rating >= filters.minRating!);
  }
  if (filters.maxPerNightEGP !== undefined) {
    items = items.filter(a => a.perNightEGP <= filters.maxPerNightEGP!);
  }
  if (filters.guests !== undefined) {
    items = items.filter(a => a.maxGuests >= filters.guests!);
  }
  if (filters.mustHaveAmenities?.length) {
    items = items.filter(a => filters.mustHaveAmenities!.every(am => hasAmenity(a, am)));
  }

  const priceValues = items.map(a => a.perNightEGP);
  const maxPrice = Math.max(1, ...priceValues);
  const wantsCheap = /cheap|budget|affordable|رخيص|اقتصادي/i.test(filters.q || '');

  const scored = items.map(entity => {
    const relevance = textRelevance(entity, filters.q);
    const areaMatch = filters.areaIds?.length
      ? (filters.areaIds.includes(entity.areaId) ? 1 : 0)
      : 0.5;
    const niceToHave = filters.niceToHaveAmenities?.length
      ? filters.niceToHaveAmenities.filter(am => hasAmenity(entity, am)).length / filters.niceToHaveAmenities.length
      : 0;
    const priceScore = wantsCheap ? 1 - entity.perNightEGP / maxPrice : 0.5;

    const score =
      40 * relevance +
      25 * (entity.rating / 5) +
      15 * areaMatch +
      10 * niceToHave +
      10 * priceScore +
      5 * (entity.featured ? 1 : 0);

    return { entity, score };
  });

  let sort = filters.sort || 'relevance';
  scored.sort((a, b) => {
    if (sort === 'price_asc') return a.entity.perNightEGP - b.entity.perNightEGP;
    if (sort === 'price_desc') return b.entity.perNightEGP - a.entity.perNightEGP;
    if (sort === 'rating') return b.entity.rating - a.entity.rating || b.entity.reviewCount - a.entity.reviewCount;
    return b.score - a.score || b.entity.rating - a.entity.rating || b.entity.reviewCount - a.entity.reviewCount;
  });

  return scored.map(s => s.entity);
}

export interface CreateAccommodationInput {
  slug: string;
  name: string;
  nameAr: string;
  propertyType: PropertyType;
  category: AccommodationEntity['category'];
  priceBand: AccommodationEntity['priceBand'];
  areaId: string;
  area: string;
  areaName: string;
  areaNameAr: string;
  rating: number;
  reviewCount: number;
  ratingSource?: string;
  typeChips: string[];
  typeChipsAr: string[];
  tagline: string;
  taglineAr: string;
  description: string;
  descriptionAr: string;
  amenities: string[];
  amenitiesAr: string[];
  perNightEGP: number;
  packageNights: number;
  rooms: number;
  maxGuests: number;
  bestFor: string;
  bestForAr: string;
  note: string;
  noteAr: string;
  latitude?: number;
  longitude?: number;
  active?: boolean;
  featured?: boolean;
  /** Self-hosted cover photo under public/images/hotels/. A published CMS
   *  catalog binding still overrides it at serve time. */
  coverImageUrl?: string;
  /** Provenance for rows the Tripadvisor stays seed owns or enriched. */
  tripadvisor?: AccommodationEntity['tripadvisor'];
  /** Pre-assigned ids, used only by the idempotent seed importer. */
  id?: string;
  supplierId?: string;
  skuId?: string;
  /** External listing URL used by the ScrapeGraph scheduler for price refresh. */
  sourceUrl?: string;
}

const nowIso = () => new Date().toISOString();
const genId = (prefix: string) => `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

/**
 * Creates (or, when `input.id` names an existing row, upserts) one property:
 * a `hotel`-category supplier, a package ProductSkuEntity, and the
 * AccommodationEntity row — inside one transaction, same three-writes
 * pattern as importDahabHotels.ts. Shared by the admin POST endpoint and the
 * seed importer so they never drift.
 */
export function createAccommodation(input: CreateAccommodationInput): AccommodationEntity {
  return db.runInTransaction(() => {
    // Pre-assigned id (seed importer): match an existing row by id first, then
    // fall back to slug so legacy databases seeded from older catalogues with
    // different ids are updated in place instead of tripping the slug guard.
    const existing = input.id
      ? db.accommodations.find(a => a.id === input.id) || db.accommodations.find(a => a.slug === input.slug)
      : undefined;
    if (!existing && db.accommodations.some(a => a.slug === input.slug)) {
      throw new Error(`An accommodation with slug "${input.slug}" already exists.`);
    }

    const id = existing ? existing.id : input.id || genId('ACC');
    const packagePriceEGP = input.perNightEGP * input.packageNights;

    let sku = existing ? db.productSkus.find(s => s.id === existing.skuId) : undefined;
    let supplier = sku ? db.suppliers.find(s => s.id === sku!.supplierId) : undefined;

    if (!supplier) {
      supplier = {
        id: input.supplierId || genId('SUP-ACC'),
        businessName: input.name,
        businessNameAr: input.nameAr,
        category: 'hotel',
        businessType: `Directory accommodation — ${input.propertyType.toUpperCase()}`,
        tier: 'Vetted Local Partner',
        status: 'Active',
        serviceTypes: ['hotel'],
        area: input.area,
        address: input.areaName,
        city: 'Dahab',
        country: 'Egypt',
        latitude: input.latitude,
        longitude: input.longitude,
        coordinates: input.latitude !== undefined && input.longitude !== undefined
          ? { lat: input.latitude, lng: input.longitude }
          : undefined,
        rating: input.rating,
        reviewCount: input.reviewCount,
        metadata: { source: 'accommodationService', propertyType: input.propertyType, category: input.category, priceBand: input.priceBand }
      };
      db.suppliers.push(supplier);
    }

    if (!sku) {
      sku = {
        id: input.skuId || genId('SKU-ACC'),
        supplierId: supplier.id,
        serviceType: 'hotel',
        title: `${input.name} — ${input.packageNights}-Night Stay`,
        titleAr: `${input.nameAr} — إقامة ${input.packageNights} ليالٍ`,
        description: `${input.description}\n${input.note}`,
        routeFrom: input.areaName,
        routeTo: input.name,
        durationMinutes: input.packageNights * 1440,
        basePriceEGP: packagePriceEGP,
        currency: 'EGP',
        maxCapacityPerSlot: 10,
        active: true,
        includedItems: [
          `${input.packageNights} Night(s) Stay`,
          'Taxes & fees',
          `Amenities: ${input.amenities.join(', ')}`
        ].slice(0, 3),
        cancellationPolicyHours: 48
      };
      db.productSkus.push(sku!);
    } else {
      sku.basePriceEGP = packagePriceEGP;
    }

    const record: AccommodationEntity = {
      id,
      slug: input.slug,
      name: input.name,
      nameAr: input.nameAr,
      propertyType: input.propertyType,
      category: input.category,
      priceBand: input.priceBand,
      areaId: input.areaId,
      area: input.area,
      areaName: input.areaName,
      areaNameAr: input.areaNameAr,
      rating: input.rating,
      reviewCount: input.reviewCount,
      ratingSource: input.ratingSource,
      typeChips: input.typeChips,
      typeChipsAr: input.typeChipsAr,
      tagline: input.tagline,
      taglineAr: input.taglineAr,
      description: input.description,
      descriptionAr: input.descriptionAr,
      amenities: input.amenities,
      amenitiesAr: input.amenitiesAr,
      perNightEGP: input.perNightEGP,
      packageNights: input.packageNights,
      rooms: input.rooms,
      maxGuests: input.maxGuests,
      bestFor: input.bestFor,
      bestForAr: input.bestForAr,
      note: input.note,
      noteAr: input.noteAr,
      latitude: input.latitude,
      longitude: input.longitude,
      skuId: sku!.id,
      active: input.active !== false,
      featured: input.featured === true,
      // Absent on the input keeps whatever the row already held: an admin
      // re-save without a cover must not erase the seeded photo.
      ...(input.coverImageUrl !== undefined || existing?.coverImageUrl
        ? { coverImageUrl: input.coverImageUrl ?? existing?.coverImageUrl }
        : {}),
      ...(input.tripadvisor !== undefined || existing?.tripadvisor
        ? { tripadvisor: input.tripadvisor ?? existing?.tripadvisor }
        : {}),
      ...(input.sourceUrl !== undefined || existing?.sourceUrl
        ? { sourceUrl: input.sourceUrl ?? existing?.sourceUrl }
        : {}),
      createdAt: existing?.createdAt ?? nowIso(),
      updatedAt: nowIso()
    };

    if (existing) {
      db.accommodations[db.accommodations.indexOf(existing)] = record;
    } else {
      db.accommodations.push(record);
    }
    return record;
  });
}

export function updateAccommodation(id: string, patch: Partial<CreateAccommodationInput>): AccommodationEntity {
  const existing = db.accommodations.find(a => a.id === id);
  if (!existing) throw new Error('Accommodation not found.');
  return createAccommodation({ ...existing, ...patch, id: existing.id, supplierId: undefined, skuId: existing.skuId });
}

export function setAccommodationActive(id: string, active: boolean): AccommodationEntity {
  const existing = db.accommodations.find(a => a.id === id);
  if (!existing) throw new Error('Accommodation not found.');
  existing.active = active;
  existing.updatedAt = nowIso();
  return existing;
}

// ---------------------------------------------------------------------------
// External reference links (property_sources) — informational only.
// ---------------------------------------------------------------------------

export function listSources(accommodationId: string, includeInactive = false): PropertySourceEntity[] {
  return db.propertySources
    .filter(s => s.accommodationId === accommodationId && (includeInactive || s.active))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

/** Source links render as public "Also listed on" links: https only. */
function assertHttpsUrl(url: string): void {
  if (!/^https:\/\/[^\s]+$/i.test(url)) {
    throw new Error('A source link must be a full https:// address.');
  }
}

export function addSource(input: {
  accommodationId: string;
  sourceType: PropertySourceType;
  url: string;
  label?: string;
  displayOrder?: number;
  addedByUserId: string;
}): PropertySourceEntity {
  if (!db.accommodations.some(a => a.id === input.accommodationId)) {
    throw new Error('Accommodation not found.');
  }
  assertHttpsUrl(input.url);
  const record: PropertySourceEntity = {
    id: genId('SRC'),
    accommodationId: input.accommodationId,
    sourceType: input.sourceType,
    url: input.url,
    label: input.label,
    displayOrder: input.displayOrder ?? db.propertySources.filter(s => s.accommodationId === input.accommodationId).length,
    active: true,
    addedByUserId: input.addedByUserId,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  db.propertySources.push(record);
  return record;
}

export function updateSource(sourceId: string, patch: Partial<Pick<PropertySourceEntity, 'url' | 'label' | 'displayOrder' | 'active' | 'sourceType'>>): PropertySourceEntity {
  const existing = db.propertySources.find(s => s.id === sourceId);
  if (!existing) throw new Error('Source link not found.');
  if (patch.url !== undefined) assertHttpsUrl(patch.url);
  Object.assign(existing, patch, { updatedAt: nowIso() });
  return existing;
}

export function deleteSource(sourceId: string): boolean {
  const index = db.propertySources.findIndex(s => s.id === sourceId);
  if (index === -1) return false;
  db.propertySources.splice(index, 1);
  return true;
}
