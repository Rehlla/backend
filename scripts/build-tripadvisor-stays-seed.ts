/**
 * Rebuilds data/dahab_tripadvisor_stays.json from a fresh Tripadvisor scrape.
 *
 * Reads the raw GraphQL pull (data/tripadvisor/dahab_hotels.json) plus the
 * previous seed (for area preservation, price fallbacks and overlap report)
 * and writes the seed in the exact StaySeed shape
 * server/db/seeds/importDahabTripadvisorStays.ts consumes. Also downloads
 * cover images for listings that have none yet.
 *
 * Run: npx tsx scripts/build-tripadvisor-stays-seed.ts
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const FRESH = path.join(ROOT, 'data', 'tripadvisor', 'dahab_hotels.json');
const SEED = path.join(ROOT, 'data', 'dahab_tripadvisor_stays.json');
const REVIEWS = path.join(ROOT, 'data', 'tripadvisor', 'reviews.json');
const IMG_DIR = path.join(ROOT, 'public', 'images', 'hotels');
const DAHAB = { lat: 28.4906, lng: 34.516 };
/** Reviews embedded per listing (newest first as pulled). */
const MAX_REVIEWS_PER_STAY = 15;

interface FreshPlace {
  id: number;
  name: string | null;
  url: string | null;
  rating: number | null;
  reviewCount: number | null;
  rank: string | null;
  type: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  address: { fullAddress?: string | null } | null;
  priceMin: number | null;
  lowestPrice: string | null;
  stars: unknown;
  photo: string | null;
  amenities: { amenityName?: string }[] | null;
}

const TYPE_MAP: Record<string, string> = {
  Hotel: 'hotel',
  'Small Hotel': 'hotel',
  Inn: 'hotel',
  'Limited Service Property': 'hotel',
  'Specialty Hotel': 'boutique-hotel',
  'Specialty Inn': 'boutique-hotel',
  Resort: 'resort',
  'Specialty Resort': 'resort',
  Hostel: 'hostel',
  Condominium: 'apartment',
  'Apartment Hotel': 'apartment',
  Villa: 'villa',
  'Cabin/Campground': 'camp',
  Lodge: 'eco-lodge',
  'Guest house': 'guesthouse',
  'Bed and Breakfast': 'guesthouse',
  'Specialty B&B': 'guesthouse',
};

/* Same generic-token set the stays importer uses for matching, so the
 * duplicate groups agree with what the importer would link. */
const GENERIC_TOKENS = new Set([
  'hotel', 'the', 'resort', 'dahab', 'and', 'village', 'house', 'inn', 'camp',
  'hostel', 'lodge', 'diving', 'center', 'centre', 'bay', 'sea', 'palace',
  'motel', 'b&b', 'guest', 'apartment', 'apartments', 'studio', 'chalet',
  'villa', 'eclipse', 'park',
]);

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !GENERIC_TOKENS.has(t))
    .sort()
    .join(' ');
}

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const t = Math.PI / 180;
  const h =
    Math.sin(((bLat - aLat) * t) / 2) ** 2 +
    Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin(((bLng - aLng) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function parseEgp(s: string | null): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, '').match(/(\d[\d]*)/);
  return m ? Number(m[1]) : null;
}

async function main(): Promise<void> {
  const fresh = JSON.parse(fs.readFileSync(FRESH, 'utf-8')) as { places: FreshPlace[] };
  const oldSeed = JSON.parse(fs.readFileSync(SEED, 'utf-8')) as {
    stays: Record<string, any>[];
  };
  const reviewStore = fs.existsSync(REVIEWS)
    ? (JSON.parse(fs.readFileSync(REVIEWS, 'utf-8')) as Record<string, { reviews?: Record<string, any>[] }>)
    : {};
  const oldById = new Map(oldSeed.stays.map((s) => [String(s.locationId), s]));
  const areaNameById = new Map<string, { areaName: string; areaNameAr: string }>();
  for (const s of oldSeed.stays) {
    if (!areaNameById.has(s.areaId)) {
      areaNameById.set(s.areaId, { areaName: s.areaName, areaNameAr: s.areaNameAr });
    }
  }
  const oldWithCoords = oldSeed.stays.filter(
    (s) => typeof s.latitude === 'number' && typeof s.longitude === 'number',
  );
  // median perNightEGP per propertyType, for listings with no price at all
  const pricesByType = new Map<string, number[]>();
  for (const s of oldSeed.stays) {
    if (s.perNightEGP > 0) {
      const arr = pricesByType.get(s.propertyType) || [];
      arr.push(s.perNightEGP);
      pricesByType.set(s.propertyType, arr);
    }
  }
  const medianByType = new Map<string, number>();
  for (const [t, arr] of pricesByType) {
    const sorted = [...arr].sort((a, b) => a - b);
    medianByType.set(t, sorted[Math.floor(sorted.length / 2)]);
  }

  const stats = { kept: 0, excludedFar: 0, noName: 0, fallbackPrice: 0, downloaded: 0, downloadFailed: 0 };
  const stays: Record<string, any>[] = [];
  const seenSlugs = new Set<string>();

  for (const p of fresh.places) {
    const locationId = String(p.id);
    if (!p.name) {
      stats.noName++;
      continue;
    }
    // New listings far outside the platform's Dahab scope are out; rows the
    // previous seed already carries are always preserved.
    if (!oldById.has(locationId) && p.lat != null && p.lng != null) {
      if (km(DAHAB.lat, DAHAB.lng, p.lat, p.lng) > 30) {
        stats.excludedFar++;
        continue;
      }
    }
    const propertyType = TYPE_MAP[p.type || ''] || 'hotel';
    let perNightEGP = p.priceMin ?? parseEgp(p.lowestPrice) ?? null;
    if (perNightEGP == null) {
      perNightEGP = medianByType.get(propertyType) ?? 0;
      stats.fallbackPrice++;
    }
    const priceBand = perNightEGP < 850 ? 'budget' : perNightEGP < 3000 ? 'moderate' : 'premium';
    let category: string;
    if (propertyType === 'resort') category = 'resort';
    else if (propertyType === 'boutique-hotel') category = 'boutique';
    else if (propertyType === 'hotel') category = priceBand === 'premium' ? 'boutique' : 'mid-range';
    else if (propertyType === 'camp' || propertyType === 'hostel' || propertyType === 'guesthouse') category = 'budget';
    else category = 'mid-range';

    // Area: preserve the previous seed's assignment; otherwise nearest
    // neighbour among previously-mapped stays; otherwise Masbat.
    let areaId: string;
    const prev = oldById.get(locationId);
    if (prev) {
      areaId = prev.areaId;
    } else if (p.lat != null && p.lng != null && oldWithCoords.length > 0) {
      let best = oldWithCoords[0];
      let bestD = Infinity;
      for (const c of oldWithCoords) {
        const d = km(p.lat, p.lng, c.latitude, c.longitude);
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      areaId = best.areaId;
    } else {
      areaId = 'masbat';
    }
    const areaNames = areaNameById.get(areaId) || { areaName: areaId, areaNameAr: areaId };

    const rankM = (p.rank || '').match(/^#(\d+) of/);
    let slug = slugify(p.name) || `stay-${locationId}`;
    if (seenSlugs.has(slug)) slug = `${slug}-${locationId}`;
    seenSlugs.add(slug);

    const photo800 = p.photo ? p.photo.replace('{width}', '800').replace('{height}', '600') : null;
    stays.push({
      locationId,
      rank: rankM ? Number(rankM[1]) : null,
      nameEn: p.name,
      nameAr: p.name,
      propertyType,
      category,
      priceBand,
      perNightEGP: Math.round(perNightEGP),
      packageNights: propertyType === 'hotel' || propertyType === 'boutique-hotel' || propertyType === 'resort' ? 5 : 1,
      areaId,
      areaName: areaNames.areaName,
      areaNameAr: areaNames.areaNameAr,
      rating: p.rating ?? 0,
      reviewCount: p.reviewCount ?? 0,
      ratingSource: 'Tripadvisor',
      typeChips: p.type ? [p.type] : [],
      typeChipsAr: [],
      amenities: (p.amenities || []).map((a) => a.amenityName).filter(Boolean),
      amenitiesAr: [],
      maxGuests: 2,
      latitude: p.lat,
      longitude: p.lng,
      coverImageUrl: `/images/hotels/ta_${locationId}.jpg`,
      slug,
      tripadvisor: {
        locationId,
        url: p.url ? `https://www.tripadvisor.com${p.url}` : `https://www.tripadvisor.com/Hotel_Review-g297547-d${locationId}-Reviews-.html`,
        reviews: (reviewStore[locationId]?.reviews || []).slice(0, MAX_REVIEWS_PER_STAY),
        duplicateListings: [] as string[],
        hotelClass: null,
        hotelStyle: [],
        roomFeatures: [],
        roomTypes: [],
        languagesSpoken: [],
        listingPrice: p.lowestPrice ?? null,
        priceRange: null,
        award: null,
        telephone: p.phone ?? null,
        streetAddress: p.address?.fullAddress ?? null,
        sourceImageUrls: photo800 ? [photo800] : [],
        galleryPhotoUrls: [],
      },
    });
    stats.kept++;
  }

  // Secondary listings of the same physical property, by distinctive-name group.
  const groups = new Map<string, string[]>();
  for (const s of stays) {
    const key = normName(s.nameEn);
    if (!key) continue;
    const arr = groups.get(key) || [];
    arr.push(s.locationId);
    groups.set(key, arr);
  }
  let dupRows = 0;
  for (const s of stays) {
    const key = normName(s.nameEn);
    const ids = (groups.get(key) || []).filter((id) => id !== s.locationId);
    if (ids.length > 0) {
      s.tripadvisor.duplicateListings = ids;
      dupRows++;
    }
  }

  // Cover images for listings that have none yet.
  fs.mkdirSync(IMG_DIR, { recursive: true });
  const existing = new Set(fs.readdirSync(IMG_DIR));
  for (const s of stays) {
    const file = `ta_${s.locationId}.jpg`;
    if (existing.has(file)) continue;
    const src = s.tripadvisor.sourceImageUrls[0];
    if (!src) continue;
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(path.join(IMG_DIR, file), Buffer.from(await res.arrayBuffer()));
      stats.downloaded++;
    } catch {
      stats.downloadFailed++;
    }
  }

  const oldIds = new Set(oldSeed.stays.map((s) => String(s.locationId)));
  const newIds = new Set(stays.map((s) => s.locationId));
  const gone = [...oldIds].filter((id) => !newIds.has(id));
  const added = [...newIds].filter((id) => !oldIds.has(id));

  fs.writeFileSync(
    SEED,
    JSON.stringify(
      {
        metadata: {
          datasetName: 'dahab_tripadvisor_stays',
          description:
            'Dahab hotel/hostel/camp listings scraped from Tripadvisor. Imported at boot by server/db/seeds/importDahabTripadvisorStays.ts: enriches curated stays it can match, creates the rest as ACCTA-<tripadvisorId> rows.',
          source: 'Tripadvisor (tripadvisor.com) - Dahab Hotels GraphQL pull, offsets 0-450',
          generatedAt: new Date().toISOString(),
          totalStays: stays.length,
          usdToEgpRate: 48,
          generator: 'scripts/build-tripadvisor-stays-seed.ts',
        },
        stays,
      },
      null,
      1,
    ),
  );

  console.log(`kept: ${stats.kept} | excluded-far: ${stats.excludedFar} | no-name: ${stats.noName}`);
  console.log(`overlap: ${oldIds.size - gone.length} | gone (will deactivate): ${gone.length} [${gone.join(',')}] | added: ${added.length}`);
  console.log(`price fallback (type median): ${stats.fallbackPrice}`);
  console.log(`duplicate groups: ${dupRows} rows carry duplicateListings`);
  console.log(`covers downloaded: ${stats.downloaded} | failed: ${stats.downloadFailed}`);
}
main();
