import fs from 'fs';
import { db } from '../database';
import { seedPath } from '../paths';
import { createAccommodation, updateAccommodation } from '../../services/accommodationService';
import type { AccommodationEntity } from '../schema';

export interface ImportStaysResult {
  success: boolean;
  importedAt: string;
  total: number;
  created: number;
  enriched: number;
  deactivated: number;
  summary: string;
}

/** One row of data/dahab_tripadvisor_stays.json (see
 *  scripts/build-tripadvisor-stays-seed.ts). */
interface StaySeed {
  locationId: string;
  rank: number | null;
  nameEn: string;
  nameAr: string;
  propertyType: AccommodationEntity['propertyType'];
  category: AccommodationEntity['category'];
  priceBand: AccommodationEntity['priceBand'];
  perNightEGP: number;
  packageNights: number;
  areaId: string;
  areaName: string;
  areaNameAr: string;
  rating: number;
  reviewCount: number;
  ratingSource: string;
  typeChips: string[];
  typeChipsAr: string[];
  amenities: string[];
  amenitiesAr: string[];
  maxGuests: number;
  latitude: number | null;
  longitude: number | null;
  coverImageUrl: string;
  slug: string;
  tripadvisor: AccommodationEntity['tripadvisor'];
}

/**
 * Words that carry no identity for matching, so "Daniela Diving Resort Dahab"
 * matches "Daniela Diving Resort" on {daniela} alone — the same matcher the
 * Tripadvisor dining importer uses. Curated names ("Le Meridien Dahab Resort")
 * and their TA listing names must agree on at least one distinctive token.
 */
const GENERIC_NAME_TOKENS = new Set([
  'hotel', 'the', 'resort', 'dahab', 'and', 'village', 'house', 'inn', 'camp',
  'hostel', 'lodge', 'diving', 'center', 'centre', 'bay', 'sea', 'palace',
  'motel', 'b&b', 'guest', 'apartment', 'apartments', 'studio', 'chalet',
  'villa', 'eclipse', 'park'
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
 * Finds the catalogue row a Tripadvisor listing describes, or null.
 *
 *   1. `ACCTA-<locationId>` — a row this importer owns from a previous run
 *      (matched first so a re-scrape converges it in place).
 *   2. A curated row already carrying this Tripadvisor locationId.
 *   3. Slug equality — the catalogue slugifies names, so this catches a
 *      curated rename that token matching would miss.
 *   4. Distinctive-token equality/subset against the curated corpus, which
 *      never runs over ACCTA-* rows (two distinct Dahab listings can share a
 *      near-identical name; their identity is the locationId, not the name).
 *
 * Tiers 3 and 4 skip any row already claimed by a DIFFERENT Tripadvisor
 * listing. Without that guard the second listing of a double-name pair (two
 * "Dahab Plaza Hotel" entries, 22 reviews apart on Tripadvisor) would keep
 * re-linking the same curated row and clobbering the first one's locationId,
 * leaving that listing with no home in the catalogue.
 */
function matchAccommodation(entry: StaySeed): AccommodationEntity | null {
  const ownedId = `ACCTA-${entry.locationId}`;
  const owned = db.accommodations.find((a) => a.id === ownedId);
  if (owned) return owned;

  const linked = db.accommodations.find((a) => a.tripadvisor?.locationId === entry.locationId);
  if (linked) return linked;

  const claimedByOther = (a: AccommodationEntity) =>
    a.tripadvisor?.locationId !== undefined && a.tripadvisor.locationId !== entry.locationId;

  const bySlug = db.accommodations.find((a) => a.slug === entry.slug && !claimedByOther(a));
  if (bySlug) return bySlug;

  const entryTokens = distinctiveTokens(entry.nameEn);
  if (entryTokens.size === 0) return null;
  for (const venue of db.accommodations) {
    if (venue.id.startsWith('ACCTA-') || claimedByOther(venue)) continue;
    const venueTokens = distinctiveTokens(venue.name);
    if (venueTokens.size === 0) continue;
    const shared = [...entryTokens].filter((t) => venueTokens.has(t));
    const isSubset = shared.length === entryTokens.size || shared.length === venueTokens.size;
    if (shared.length > 0 && isSubset) return venue;
  }
  return null;
}

/**
 * Fills only the Tripadvisor-mirror fields of a curated row, never the
 * curated values: the listing refreshes the rating (which a field researcher
 * did not measure) but the curated name, price band, area, description and
 * amenities are the platform's own. Returns true when anything changed.
 */
/** Whether the row's cover needs replacing by the seed's cover.
 *
 *  An earlier importer iteration stored the scrape's bare `localCoverImage`
 *  (`/images/hotels/15815078.jpg`) while the copy step actually writes
 *  `ta_15815078.jpg`, so those rows point at a file that never existed and
 *  their cards silently fall back to a placeholder. That exact signature — a
 *  hotels path whose basename is bare digits — is unambiguously our own broken
 *  write, so it is repaired here rather than left to rot.
 *
 *  Deliberately narrow: a curated photo (`/images/hotels/bridge.jpg`) or a CMS
 *  binding (`/api/media/...`) is real content the platform owns, and curated
 *  stays authoritative, so neither is touched. */
function hasUsableCover(stored: string | undefined, seedCover: string): boolean {
  if (!stored) return false;
  if (stored === seedCover) return true;
  return !/^\/images\/hotels\/\d+\.(jpg|jpeg|png|webp)$/i.test(stored);
}

function enrichCurated(venue: AccommodationEntity, entry: StaySeed): boolean {
  let touched = false;
  const patch: Record<string, unknown> = {};

  if (entry.rating > 0 && venue.rating !== entry.rating) { patch.rating = entry.rating; touched = true; }
  if (entry.reviewCount > 0 && venue.reviewCount !== entry.reviewCount) { patch.reviewCount = entry.reviewCount; touched = true; }
  if (venue.ratingSource !== 'Tripadvisor') { patch.ratingSource = 'Tripadvisor'; touched = true; }
  if (entry.coverImageUrl && !hasUsableCover(venue.coverImageUrl, entry.coverImageUrl)) {
    patch.coverImageUrl = entry.coverImageUrl;
    touched = true;
  }
  if (venue.tripadvisor?.locationId !== entry.locationId) { patch.tripadvisor = entry.tripadvisor; touched = true; }
  // The stored provenance predates the reviews capture: refresh it when the
  // seed carries more review texts than the row holds (upgrade-only, so a
  // partial re-scrape never shrinks what a fuller one already stored).
  const storedReviews = (venue.tripadvisor as { reviews?: unknown[] } | undefined)?.reviews;
  const entryReviews = (entry.tripadvisor as { reviews?: unknown[] } | undefined)?.reviews;
  if (
    venue.tripadvisor?.locationId === entry.locationId &&
    (entryReviews?.length || 0) > (storedReviews?.length || 0)
  ) {
    patch.tripadvisor = entry.tripadvisor;
    touched = true;
  }
  // Real GPS beats the curated seed's centroid, but only where it is absent.
  if (venue.latitude === undefined && entry.latitude != null) { patch.latitude = entry.latitude; touched = true; }
  if (venue.longitude === undefined && entry.longitude != null) { patch.longitude = entry.longitude; touched = true; }
  // Tripadvisor amenities fill the curated row only when it carries none.
  if (venue.amenities.length === 0 && entry.amenities.length > 0) { patch.amenities = entry.amenities; touched = true; }
  if (venue.amenitiesAr.length === 0 && entry.amenitiesAr.length > 0) { patch.amenitiesAr = entry.amenitiesAr; touched = true; }

  if (touched) updateAccommodation(venue.id, patch as any);
  return touched;
}

/** Whether an importer-owned row differs from the seed in any field the seed
 *  is authoritative for. Deliberately ignores updatedAt, which
 *  createAccommodation bumps on every call — comparing whole rows would make
 *  every re-import look like a change. */
function ownedRowDiffers(venue: AccommodationEntity, entry: StaySeed): boolean {
  return (
    venue.name !== entry.nameEn ||
    venue.nameAr !== entry.nameAr ||
    // The row may hold the seed slug or the `-<locationId>` disambiguated
    // form the create path assigns on a curated slug collision.
    (venue.slug !== entry.slug && venue.slug !== `${entry.slug}-${entry.locationId}`) ||
    venue.propertyType !== entry.propertyType ||
    venue.category !== entry.category ||
    venue.priceBand !== entry.priceBand ||
    venue.areaId !== entry.areaId ||
    venue.areaName !== entry.areaName ||
    venue.areaNameAr !== entry.areaNameAr ||
    venue.perNightEGP !== entry.perNightEGP ||
    venue.packageNights !== entry.packageNights ||
    venue.rating !== entry.rating ||
    venue.reviewCount !== entry.reviewCount ||
    venue.ratingSource !== entry.ratingSource ||
    venue.amenities.join('|') !== entry.amenities.join('|') ||
    venue.amenitiesAr.join('|') !== entry.amenitiesAr.join('|') ||
    (venue.coverImageUrl || '') !== entry.coverImageUrl ||
    venue.latitude !== (entry.latitude ?? venue.latitude) ||
    venue.longitude !== (entry.longitude ?? venue.longitude) ||
    venue.tripadvisor?.locationId !== entry.locationId
  );
}

/**
 * Idempotent import of the Tripadvisor-sourced stays catalogue, converged
 * into the accommodations catalogue that backs /api/accommodations and the
 * Stay & Taste surfaces.
 *
 * Reads the committed data/dahab_tripadvisor_stays.json (boot-critical:
 * THROWS when missing, matching the other seed importers) and:
 *
 *   - ENRICHES a curated stay it can match, adding only the listing's own
 *     measurements (rating, review count, cover photo, GPS, Tripadvisor
 *     provenance) and never overwriting curated content;
 *   - CREATES every listing the corpus does not hold as an `ACCTA-<id>` row,
 *     with the same supplier + package SKU + property triple that
 *     importDahabAccommodations writes, so booking and admin paths behave
 *     identically;
 *   - DEACTIVATES importer-owned rows the seed no longer holds (a listing
 *     merged into another, or dropped from Tripadvisor). Inactive rather than
 *     deleted: a SKU may already sit on a booking, and the corpus never
 *     hard-deletes inventory.
 *
 * The philosophy is the one server/db/research/importResearch.ts documents —
 * enrich, don't blind-insert — otherwise the directory would carry "JAZ
 * Dahabeya Resort" and "JAZ Dahabeya" as two properties.
 */
export function importDahabTripadvisorStays(): ImportStaysResult {
  const datasetPath = seedPath('dahab_tripadvisor_stays.json');
  if (!fs.existsSync(datasetPath)) {
    throw new Error(
      `Seed catalogue ${datasetPath} is missing. A checkout without it cannot boot the stays directory.`
    );
  }

  let raw: { stays?: StaySeed[] };
  try {
    raw = JSON.parse(fs.readFileSync(datasetPath, 'utf-8'));
  } catch (err: any) {
    throw new Error(`Failed to parse ${datasetPath}: ${err.message}`);
  }

  const entries = raw.stays || [];
  const seenLocationIds = new Set<string>();
  for (const entry of entries) {
    if (!entry.locationId || !entry.nameEn || !entry.slug) {
      throw new Error('Stay seed contains a row missing locationId, nameEn or slug.');
    }
    if (seenLocationIds.has(entry.locationId)) {
      throw new Error(`Duplicate Tripadvisor locationId in seed: ${entry.locationId}.`);
    }
    seenLocationIds.add(entry.locationId);
  }

  let created = 0;
  let enriched = 0;

  for (const entry of entries) {
    const existing = matchAccommodation(entry);

    if (existing && !existing.id.startsWith('ACCTA-')) {
      // A curated row: the listing only refreshes what it measured.
      if (enrichCurated(existing, entry)) enriched += 1;
      continue;
    }

    if (existing) {
      // Importer-owned from a previous run: converge the full record so a
      // re-scrape updates names, rates, amenities and area in place. Counted
      // only when something actually differs, so an unchanged re-import
      // reports zero.
      if (ownedRowDiffers(existing, entry)) {
        createAccommodation({
          ...stayToInput(entry, existing.id),
          // Keep whatever slug this row already holds (it may carry the
          // disambiguated `-<locationId>` suffix from a first create).
          slug: existing.slug,
          coverImageUrl: entry.coverImageUrl || undefined,
          tripadvisor: entry.tripadvisor,
        });
        enriched += 1;
      }
      continue;
    }

    createAccommodation({
      ...stayToInput(entry, `ACCTA-${entry.locationId}`),
      // A curated row may already hold this slug under a name the matcher
      // did not link (createAccommodation throws on a slug collision, which
      // would abort the whole seed transaction). Disambiguate with the
      // Tripadvisor id instead — the seed itself stays immutable.
      slug: db.accommodations.some((a) => a.slug === entry.slug)
        ? `${entry.slug}-${entry.locationId}`
        : entry.slug,
      supplierId: `SUP-ACCTA-${entry.locationId}`,
      skuId: `SKU-ACCTA-${entry.locationId}`,
      coverImageUrl: entry.coverImageUrl || undefined,
      tripadvisor: entry.tripadvisor,
    });
    created += 1;
  }

  // Deactivate importer-owned rows the seed no longer holds.
  let deactivated = 0;
  for (const venue of db.accommodations) {
    if (!venue.id.startsWith('ACCTA-')) continue;
    if (venue.tripadvisor?.locationId && seenLocationIds.has(venue.tripadvisor.locationId)) continue;
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
      `Tripadvisor stays catalogue imported: ${entries.length} listings ` +
      `(${created} created, ${enriched} enriched, ${deactivated} deactivated).`
  };
}

/** Maps a seed row onto the createAccommodation input, deriving the
 *  template copy the curated catalogue uses (tagline/description/bestFor
 *  follow its shape) and marking the rates as indicative estimates. */
function stayToInput(entry: StaySeed, id: string) {
  const propertyLabel = entry.propertyType.replace('-', ' ');
  const tagline = `${titleCase(propertyLabel)} in ${entry.areaName}, Dahab.`;
  const taglineAr = `${arabicTypeLabel(entry.propertyType)} في ${entry.areaNameAr}، دهب.`;
  const description =
    `${entry.nameEn} is a ${propertyLabel} located in ${entry.areaName}, Dahab. ` +
    `It offers ${entry.amenities.slice(0, 3).join(', ').toLowerCase()} for travelers exploring the Red Sea.`;
  const descriptionAr =
    `${entry.nameAr} هو ${arabicTypeLabel(entry.propertyType)} يقع في ${entry.areaNameAr}، دهب. ` +
    `يوفر ${entry.amenitiesAr.slice(0, 3).join('، ')} للمسافرين الذين يستكشفون البحر الأحمر.`;
  return {
    id,
    slug: entry.slug,
    name: entry.nameEn,
    nameAr: entry.nameAr,
    propertyType: entry.propertyType,
    category: entry.category,
    priceBand: entry.priceBand,
    areaId: entry.areaId,
    area: entry.areaId,
    areaName: entry.areaName,
    areaNameAr: entry.areaNameAr,
    rating: entry.rating,
    reviewCount: entry.reviewCount,
    ratingSource: entry.ratingSource,
    typeChips: entry.typeChips,
    typeChipsAr: entry.typeChipsAr,
    tagline,
    taglineAr,
    description,
    descriptionAr,
    amenities: entry.amenities,
    amenitiesAr: entry.amenitiesAr,
    perNightEGP: entry.perNightEGP,
    packageNights: entry.packageNights,
    rooms: 10,
    maxGuests: entry.maxGuests,
    bestFor: `Travelers looking for ${propertyLabel} accommodation in ${entry.areaName}.`,
    bestForAr: `المسافرين الباحثين عن إقامة ${arabicTypeLabel(entry.propertyType)} في ${entry.areaNameAr}.`,
    note: 'Rates are indicative, from Tripadvisor listing averages; confirm with the property before booking.',
    noteAr: 'الأسعار تقديرية من متوسطات قوائم Tripadvisor؛ يُرجى التأكيد مع المنشأة قبل الحجز.',
    latitude: entry.latitude ?? undefined,
    longitude: entry.longitude ?? undefined,
    active: true,
    featured: false
  };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function arabicTypeLabel(propertyType: AccommodationEntity['propertyType']): string {
  switch (propertyType) {
    case 'hotel': return 'فندق';
    case 'resort': return 'منتجع';
    case 'hostel': return 'نزل شباب';
    case 'camp': return 'استراحة';
    case 'guesthouse': return 'منزل ضيافة';
    case 'villa': return 'فيلا';
    case 'apartment': return 'شقة';
    case 'studio': return 'ستوديو';
    case 'chalet': return 'شاليه';
    case 'eco-lodge': return 'نزل بيئي';
    case 'boutique-hotel': return 'فندق بوتيك';
    default: return 'إقامة';
  }
}