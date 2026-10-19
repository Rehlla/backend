import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import { createAccommodation } from '../../services/accommodationService';

export interface ImportGoogleMapsAccommodationsResult {
  success: boolean;
  importedAt: string;
  total: number;
  created: number;
  updated: number;
  summary: string;
}

const supplierIdFor = (accommodationId: string) => `SUP-${accommodationId}`;
const skuIdFor = (accommodationId: string) => `SKU-${accommodationId}`;

/**
 * Idempotent import of Google Maps verified accommodations.
 *
 * Reads the committed data/google_maps_accommodations.json and upserts
 * each entry through accommodationService.createAccommodation().
 */
export function importGoogleMapsAccommodations(): ImportGoogleMapsAccommodationsResult {
  const startTime = Date.now();
  let created = 0;
  let updated = 0;

  const datasetPath = seedPath('google_maps_accommodations.json');
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
      throw new Error('Google Maps catalogue contains an accommodation missing slug or id.');
    }
    if (seenSlugs.has(entry.slug)) throw new Error(`Duplicate accommodation slug: ${entry.slug}.`);
    if (seenIds.has(entry.id)) throw new Error(`Duplicate accommodation id: ${entry.id}.`);
    seenSlugs.add(entry.slug);
    seenIds.add(entry.id);
  }

  for (const entry of catalogue) {
    const existed = db.accommodations.some(a => a.id === entry.id) ||
      db.accommodations.some(a => a.slug === entry.slug);

    let areaId = entry.areaId;
    if (!areaId || !db.areaProfiles.some(p => p.id === areaId)) {
      throw new Error(
        `No area_profiles mapping for areaId "${areaId}" in entry ${entry.id}. ` +
        'Add it to sinewibaAreaProfiles.ts before importing.'
      );
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
      perNightEGP: Number(entry.perNightEGP || 0),
      packageNights: Number(entry.packageNights || 1),
      rooms: Number(entry.rooms || 0),
      maxGuests: Number(entry.maxGuests || 2),
      bestFor: entry.bestFor || '',
      bestForAr: entry.bestForAr || '',
      note: entry.note || '',
      noteAr: entry.noteAr || '',
      latitude: entry.latitude,
      longitude: entry.longitude,
      active: entry.active !== false
    });

    if (existed) {
      updated++;
    } else {
      created++;
    }
  }

  const elapsed = Date.now() - startTime;
  const total = created + updated;

  return {
    success: true,
    importedAt: new Date().toISOString(),
    total,
    created,
    updated,
    summary: `Imported ${total} Google Maps accommodations (${created} created, ${updated} updated) in ${elapsed}ms`
  };
}
