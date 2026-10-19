import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import { createAccommodation } from '../../services/accommodationService';
import { SIWA_AREA_PROFILES, NUWEIBA_AREA_PROFILES } from '../../data/sinewibaAreaProfiles';

export interface ImportSinewibaAccommodationsResult {
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
 * Idempotent import of Siwa and Nuweiba accommodation catalogues.
 *
 * Reads the committed data/siwa_accommodations.json and
 * data/nuweiba_accommodations.json, upserts area profiles, then delegates
 * supplier + SKU + AccommodationEntity creation to
 * accommodationService.createAccommodation().
 */
export function importSinewibaAccommodations(): ImportSinewibaAccommodationsResult {
  const startTime = Date.now();
  let created = 0;
  let updated = 0;

  // Seed area profiles for both destinations
  const allProfiles = [...SIWA_AREA_PROFILES, ...NUWEIBA_AREA_PROFILES];

  for (const profile of allProfiles) {
    const idx = db.areaProfiles.findIndex(a => a.id === profile.id);
    if (idx >= 0) {
      db.areaProfiles[idx] = { ...db.areaProfiles[idx], ...profile };
    } else {
      db.areaProfiles.push(profile);
    }
  }

  const siwaPath = seedPath('siwa_accommodations.json');
  const nuweibaPath = seedPath('nuweiba_accommodations.json');

  for (const datasetPath of [siwaPath, nuweibaPath]) {
    if (!fs.existsSync(datasetPath)) {
      throw new Error(
        `Seed catalogue ${datasetPath} is missing. A checkout without it cannot boot the accommodations catalogue.`
      );
    }
  }

  interface DatasetEntry {
    id: string;
    slug: string;
    areaId: string;
    area: string;
    [key: string]: any;
  }

  const importDataset = (datasetPath: string, destinationLabel: string) => {
    let rawData: any;
    try {
      rawData = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
    } catch (err: any) {
      throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
    }

    const catalogue = (rawData?.accommodations || []) as DatasetEntry[];

    const seenSlugs = new Set<string>();
    const seenIds = new Set<string>();
    for (const entry of catalogue) {
      if (!entry.slug || !entry.id) {
        throw new Error(`${destinationLabel} catalogue contains an accommodation missing slug or id.`);
      }
      if (seenSlugs.has(entry.slug)) throw new Error(`Duplicate accommodation slug in ${destinationLabel}: ${entry.slug}.`);
      if (seenIds.has(entry.id)) throw new Error(`Duplicate accommodation id in ${destinationLabel}: ${entry.id}.`);
      seenSlugs.add(entry.slug);
      seenIds.add(entry.id);
    }

    for (const entry of catalogue) {
      const existed = db.accommodations.some(a => a.id === entry.id) ||
        db.accommodations.some(a => a.slug === entry.slug);

      let areaId = entry.areaId;
      if (!areaId || !db.areaProfiles.some(p => p.id === areaId)) {
        throw new Error(
          `No area_profiles mapping for areaId "${areaId}" in ${destinationLabel} entry ${entry.id}. ` +
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
        perNightEGP: Number(entry.perNightEGP),
        packageNights: Number(entry.packageNights || 1),
        rooms: Number(entry.rooms || 1),
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
  };

  importDataset(siwaPath, 'Siwa');
  importDataset(nuweibaPath, 'Nuweiba');

  const elapsed = Date.now() - startTime;
  const total = created + updated;

  return {
    success: true,
    importedAt: new Date().toISOString(),
    total,
    created,
    updated,
    summary: `Imported ${total} Siwa + Nuweiba accommodations (${created} created, ${updated} updated) in ${elapsed}ms`
  };
}
