import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import { createAccommodation } from '../../services/accommodationService';
import { resolveAreaProfileId } from './accommodationAreaMap';

export interface ImportAccommodationsResult {
  success: boolean;
  importedAt: string;
  total: number;
  created: number;
  updated: number;
  summary: string;
}

/** Property id (ACC-...) -> supplier id, stable across re-imports so upserts
 *  land on the same supplier/SKU pair instead of creating duplicates. */
const supplierIdFor = (accommodationId: string) => `SUP-${accommodationId}`;
const skuIdFor = (accommodationId: string) => `SKU-${accommodationId}`;

/**
 * Idempotent import of the generalized Dahab accommodations catalogue.
 *
 * Reads the committed data/dahab_accommodations.json (boot-critical: THROWS
 * when missing, matching importDahabHotels.ts's discipline) and delegates
 * the actual supplier + SKU + AccommodationEntity upsert to
 * accommodationService.createAccommodation(), so this importer and the admin
 * POST /api/admin/accommodations endpoint never drift apart.
 */
export function importDahabAccommodations(): ImportAccommodationsResult {
  const startTime = Date.now();
  let created = 0;
  let updated = 0;

  const datasetPath = seedPath('dahab_accommodations.json');
  if (!fs.existsSync(datasetPath)) {
    throw new Error(
      `Seed catalogue ${datasetPath} is missing. A checkout without it cannot boot the accommodations catalogue.`
    );
  }

  let rawData: any;
  try {
    rawData = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
  }

  const catalogue = (rawData?.accommodations || []) as Array<Record<string, any>>;

  const seenSlugs = new Set<string>();
  const seenIds = new Set<string>();
  for (const entry of catalogue) {
    if (!entry.slug || !entry.id) {
      throw new Error('Catalogue contains an accommodation missing slug or id.');
    }
    if (seenSlugs.has(entry.slug)) throw new Error(`Duplicate accommodation slug: ${entry.slug}.`);
    if (seenIds.has(entry.id)) throw new Error(`Duplicate accommodation id: ${entry.id}.`);
    seenSlugs.add(entry.slug);
    seenIds.add(entry.id);
  }

  for (const entry of catalogue) {
    // Counts an entry as "existed" when the id OR the slug is already present,
    // mirroring the slug-fallback upsert in accommodationService.createAccommodation.
    const existed = db.accommodations.some(a => a.id === entry.id) ||
      db.accommodations.some(a => a.slug === entry.slug);
    // areaId: prefer the entry's own area_profiles id, but only if it actually
    // resolves — older catalogue versions carry editorial ids like
    // "city_centre" in areaId. Fall back to the legacy `area` mapping.
    let areaId = entry.areaId;
    if (!areaId || !db.areaProfiles.some(p => p.id === areaId)) {
      areaId = resolveAreaProfileId(entry.area);
    }

    createAccommodation({
      id: entry.id,
      supplierId: supplierIdFor(entry.id),
      skuId: skuIdFor(entry.id),
      slug: entry.slug,
      name: entry.name,
      nameAr: entry.nameAr,
      propertyType: entry.propertyType,
      category: entry.category,
      priceBand: entry.priceBand,
      areaId,
      area: entry.area,
      areaName: entry.areaName,
      areaNameAr: entry.areaNameAr,
      rating: Number(entry.rating),
      reviewCount: Number(entry.reviewCount),
      ratingSource: entry.ratingSource,
      typeChips: entry.typeChips || [],
      typeChipsAr: entry.typeChipsAr || [],
      tagline: entry.tagline,
      taglineAr: entry.taglineAr,
      description: entry.description,
      descriptionAr: entry.descriptionAr,
      amenities: entry.amenities || [],
      amenitiesAr: entry.amenitiesAr || [],
      perNightEGP: Number(entry.perNightEGP),
      packageNights: Number(entry.packageNights || 1),
      rooms: Number(entry.rooms || 0),
      maxGuests: Number(entry.maxGuests || 2),
      bestFor: entry.bestFor,
      bestForAr: entry.bestForAr,
      note: entry.note,
      noteAr: entry.noteAr,
      latitude: entry.latitude,
      longitude: entry.longitude,
      active: entry.active !== false
    });

    if (existed) updated += 1; else created += 1;
  }

  return {
    success: true,
    importedAt: new Date().toISOString(),
    total: catalogue.length,
    created,
    updated,
    summary: `Accommodations catalogue imported: ${catalogue.length} properties (${created} created, ${updated} updated).`
  };
}
