import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import { createAccommodation, updateAccommodation } from '../../services/accommodationService';
import type { AccommodationEntity } from '../schema';

export interface ImportScrapeGraphResult {
  success: boolean;
  importedAt: string;
  total: number;
  created: number;
  enriched: number;
  deactivated: number;
  summary: string;
}

/** One row of data/scrapegraph_hotels.json (see scripts/scrapegraph-fetch.ts). */
interface ScrapeGraphHotelSeed {
  url: string;
  data: {
    name?: string;
    rating?: number;
    reviewCount?: number;
    amenities?: string[];
    description?: string;
    images?: string[];
    address?: string;
    pricePerNight?: number;
    currency?: string;
  } | null;
  error: string | null;
}

interface ScrapeGraphFile {
  fetchedAt: string;
  results: ScrapeGraphHotelSeed[];
}

/**
 * Words that carry no identity for matching, so "Dahab Bay Resort" matches
 * "Dahab Bay Resort & Spa" on {bay} alone — same matcher the Tripadvisor
 * importer uses.
 */
const GENERIC_NAME_TOKENS = new Set([
  'hotel', 'the', 'resort', 'dahab', 'and', 'village', 'house', 'inn', 'camp',
  'hostel', 'lodge', 'diving', 'center', 'centre', 'bay', 'sea', 'palace',
  'motel', 'b&b', 'guest', 'apartment', 'apartments', 'studio', 'chalet',
  'villa', 'eclipse', 'park', 'spa', 'resort&'
]);

function distinctiveTokens(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1 && !GENERIC_NAME_TOKENS.has(t))
  );
}

/**
 * Finds the catalogue row a ScrapeGraph listing describes, or null.
 *
 *   1. `ACCTSG-<hash>` — a row this importer owns from a previous run.
 *   2. Slug equality — the catalogue slugifies names.
 *   3. Distinctive-token equality/subset against the curated corpus.
 */
function matchAccommodation(entry: ScrapeGraphHotelSeed): AccommodationEntity | null {
  if (!entry.data?.name) return null;

  const urlHash = hashString(entry.url);
  const ownedId = `ACCTSG-${urlHash}`;
  const owned = db.accommodations.find((a) => a.id === ownedId);
  if (owned) return owned;

  const slug = slugify(entry.data.name);
  const bySlug = db.accommodations.find((a) => a.slug === slug);
  if (bySlug) return bySlug;

  const entryTokens = distinctiveTokens(entry.data.name);
  if (entryTokens.size === 0) return null;
  for (const venue of db.accommodations) {
    if (venue.id.startsWith('ACCTSG-')) continue;
    const venueTokens = distinctiveTokens(venue.name);
    if (venueTokens.size === 0) continue;
    const shared = [...entryTokens].filter((t) => venueTokens.has(t));
    const isSubset = shared.length === entryTokens.size || shared.length === venueTokens.size;
    if (shared.length > 0 && isSubset) return venue;
  }
  return null;
}

/**
 * Idempotent import of ScrapeGraph-sourced hotel data.
 *
 * Reads data/scrapegraph_hotels.json (optional: skips silently when missing,
 * unlike boot-critical seeds) and:
 *
 *   - ENRICHES a curated stay it can match, adding only rating/reviewCount
 *     from the scrape (never overwriting curated content);
 *   - CREATES every listing not yet in the catalogue as an `ACCTSG-<hash>`
 *     row, with the same supplier + SKU pattern as other importers;
 *   - DEACTIVATES importer-owned rows the scrape no longer holds.
 */
export function importDahabScrapeGraph(): ImportScrapeGraphResult {
  const datasetPath = seedPath('scrapegraph_hotels.json');
  if (!fs.existsSync(datasetPath)) {
    return {
      success: true,
      importedAt: new Date().toISOString(),
      total: 0,
      created: 0,
      enriched: 0,
      deactivated: 0,
      summary: 'ScrapeGraph hotels: seed file not found, skipped (optional).',
    };
  }

  let raw: ScrapeGraphFile;
  try {
    raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
  }

  const entries = raw.results || [];
  const seenUrlHashes = new Set<string>();
  for (const entry of entries) {
    if (!entry.url) {
      throw new Error('ScrapeGraph seed contains a row missing url.');
    }
    const hash = hashString(entry.url);
    if (seenUrlHashes.has(hash)) {
      throw new Error(`Duplicate URL in ScrapeGraph seed: ${entry.url}`);
    }
    seenUrlHashes.add(hash);
  }

  let created = 0;
  let enriched = 0;

  for (const entry of entries) {
    if (!entry.data?.name) continue;

    const urlHash = hashString(entry.url);
    const existing = matchAccommodation(entry);

    if (existing && !existing.id.startsWith('ACCTSG-')) {
      // Curated row: only refresh rating/reviewCount from the scrape.
      if (enrichCurated(existing, entry.data)) enriched += 1;
      continue;
    }

    if (existing) {
      // Importer-owned: update if changed.
      if (ownedRowDiffers(existing, entry.data)) {
        updateAccommodation(existing.id, {
          rating: entry.data.rating ?? existing.rating,
          reviewCount: entry.data.reviewCount ?? existing.reviewCount,
          ratingSource: 'ScrapeGraph',
          perNightEGP: entry.data.pricePerNight ?? existing.perNightEGP,
        });
        enriched += 1;
      }
      continue;
    }

    const baseSlug = slugify(entry.data.name) ?? `accommodation-${urlHash}`;
    createAccommodation({
      id: `ACCTSG-${urlHash}`,
      slug: db.accommodations.some((a) => a.slug === baseSlug)
        ? `${baseSlug}-${urlHash}`
        : baseSlug,
      name: entry.data.name,
      nameAr: entry.data.name,
      propertyType: 'hotel',
      category: 'mid-range',
      priceBand: entry.data.pricePerNight && entry.data.pricePerNight > 3000 ? 'premium' : 'moderate',
      areaId: 'dahab',
      area: 'dahab',
      areaName: 'Dahab',
      areaNameAr: 'دهب',
      rating: entry.data.rating ?? 0,
      reviewCount: entry.data.reviewCount ?? 0,
      ratingSource: 'ScrapeGraph',
      typeChips: [],
      typeChipsAr: [],
      tagline: `Hotel in Dahab.`,
      taglineAr: 'فندق في دهب.',
      description: entry.data.description ?? `${entry.data.name} in Dahab.`,
      descriptionAr: entry.data.description ?? `${entry.data.name} في دهب.`,
      amenities: entry.data.amenities ?? [],
      amenitiesAr: entry.data.amenities ?? [],
      perNightEGP: entry.data.pricePerNight ?? 0,
      packageNights: 5,
      rooms: 10,
      maxGuests: 2,
      bestFor: 'Travelers looking for accommodation in Dahab.',
      bestForAr: 'المسافرين الباحثين عن إقامة في دهب.',
      note: 'Rates are indicative, from ScrapeGraph listing averages; confirm with the property before booking.',
      noteAr: 'الأسعار تقديرية من متوسطات ScrapeGraph؛ يُرجى التأكيد مع المنشأة قبل الحجز.',
      coverImageUrl: entry.data.images?.[0] ?? undefined,
      supplierId: `SUP-ACCTSG-${urlHash}`,
      skuId: `SKU-ACCTSG-${urlHash}`,
      sourceUrl: entry.url,
      active: true,
      featured: false,
    });
    created += 1;
  }

  // Deactivate importer-owned rows the scrape no longer holds.
  let deactivated = 0;
  for (const venue of db.accommodations) {
    if (!venue.id.startsWith('ACCTSG-')) continue;
    const stillInSeed = [...seenUrlHashes].some((h) => venue.id === `ACCTSG-${h}`);
    if (stillInSeed) continue;
    if (venue.active) {
      updateAccommodation(venue.id, { active: false });
      deactivated += 1;
    }
  }

  db.saveToDisk();

  return {
    success: true,
    importedAt: new Date().toISOString(),
    total: entries.length,
    created,
    enriched,
    deactivated,
    summary:
      `ScrapeGraph hotels imported: ${entries.length} listings ` +
      `(${created} created, ${enriched} enriched, ${deactivated} deactivated).`,
  };
}

function enrichCurated(venue: AccommodationEntity, data: ScrapeGraphHotelSeed['data']): boolean {
  if (!data) return false;
  let touched = false;
  const patch: Record<string, unknown> = {};

  if (data.rating && data.rating > 0 && venue.rating !== data.rating) {
    patch.rating = data.rating;
    touched = true;
  }
  if (data.reviewCount && data.reviewCount > 0 && venue.reviewCount !== data.reviewCount) {
    patch.reviewCount = data.reviewCount;
    touched = true;
  }
  if (touched) {
    patch.ratingSource = 'ScrapeGraph';
    updateAccommodation(venue.id, patch as any);
  }
  return touched;
}

function ownedRowDiffers(venue: AccommodationEntity, data: ScrapeGraphHotelSeed['data']): boolean {
  if (!data) return false;
  return (
    venue.rating !== (data.rating ?? venue.rating) ||
    venue.reviewCount !== (data.reviewCount ?? venue.reviewCount) ||
    venue.perNightEGP !== (data.pricePerNight ?? venue.perNightEGP)
  );
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashString(s: string): string {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
