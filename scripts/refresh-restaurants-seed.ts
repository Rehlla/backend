/**
 * Merges the fresh Tripadvisor restaurants pull into data/dahab_restaurants.json.
 *
 * - Rows the existing rich seed already holds keep their curated detail
 *   (hours, menu, coordinates, full cuisine lists); only the Tripadvisor-mirror
 *   fields refresh (rating, reviewCount, rank, reviews, priceRangeRaw when empty).
 * - Listings the seed does not hold are appended as full RestaurantSeed rows
 *   (nulls where the pull has no observation — the importer fills or omits).
 * - Reviews embedded per venue are the newest page-1 pulls, capped.
 *
 * Run: npx tsx scripts/refresh-restaurants-seed.ts
 */
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const EXISTING = path.join(ROOT, 'data', 'dahab_restaurants.json');
const FRESH = path.join(ROOT, 'data', 'tripadvisor', 'dahab_restaurants.json');
const REVIEWS = path.join(ROOT, 'data', 'tripadvisor', 'reviews.json');
const MAX_REVIEWS_PER_VENUE = 15;

function bandOf(priceRange: string | null): 'Budget ($)' | 'Moderate ($$)' | 'Premium ($$$)' {
  if (!priceRange) return 'Moderate ($$)';
  const n = (priceRange.match(/\$/g) || []).length;
  if (n <= 1) return 'Budget ($)';
  if (n === 2) return 'Moderate ($$)';
  return 'Premium ($$$)';
}

function km(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const t = Math.PI / 180;
  const h =
    Math.sin(((bLat - aLat) * t) / 2) ** 2 +
    Math.cos(aLat * t) * Math.cos(bLat * t) * Math.sin(((bLng - aLng) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function main(): Promise<void> {
  // The seed is untracked local state: keep a timestamped backup first.
  const backup = path.join(
    process.env.TEMP || '/tmp',
    `dahab_restaurants.json.bak-${Date.now()}`,
  );
  fs.copyFileSync(EXISTING, backup);
  console.log(`backup: ${backup}`);

  const existing = JSON.parse(fs.readFileSync(EXISTING, 'utf-8')) as {
    metadata: Record<string, any>;
    restaurants: Record<string, any>[];
  };
  const fresh = JSON.parse(fs.readFileSync(FRESH, 'utf-8')) as {
    places: Record<string, any>[];
  };
  const reviewStore = fs.existsSync(REVIEWS)
    ? (JSON.parse(fs.readFileSync(REVIEWS, 'utf-8')) as Record<string, { reviews?: Record<string, any>[] }>)
    : {};

  const byId = new Map(existing.restaurants.map((r) => [String(r.locationId), r]));
  const withCoords = existing.restaurants.filter(
    (r) => r.coordinates && typeof r.coordinates.lat === 'number',
  );
  const stats = { matched: 0, updated: 0, added: 0, reviewsEmbedded: 0 };

  fresh.places.forEach((p, idx) => {
    const id = String(p.id);
    const rank = idx + 1;
    const reviews = (reviewStore[id]?.reviews || []).slice(0, MAX_REVIEWS_PER_VENUE);
    const row = byId.get(id);
    if (row) {
      stats.matched++;
      let touched = false;
      if (p.rating != null && row.rating !== p.rating) {
        row.rating = p.rating;
        touched = true;
      }
      if (p.reviewCount != null && row.reviewCount !== p.reviewCount) {
        row.reviewCount = p.reviewCount;
        touched = true;
      }
      if (row.rank !== rank) {
        row.rank = rank;
        touched = true;
      }
      if ((!row.priceRangeRaw || row.priceRangeRaw === '') && p.priceRange) {
        row.priceRangeRaw = p.priceRange;
        row.priceBand = bandOf(p.priceRange);
        touched = true;
      }
      if ((!row.cuisines || row.cuisines.length === 0) && p.cuisines) {
        row.cuisines = p.cuisines
          .split(',')
          .map((c: string) => c.trim())
          .filter(Boolean);
        touched = true;
      }
      row.reviews = reviews;
      stats.reviewsEmbedded += reviews.length;
      if (touched) stats.updated++;
      return;
    }
    // New listing the rich seed never held.
    // Fresh restaurant rows carry no coordinates, so the area stays
    // unresolved (the importer renders '' as blank, not as somewhere it isn't).
    const areaId = '';
    const cuisines = (p.cuisines ? String(p.cuisines).split(',').map((c: string) => c.trim()).filter(Boolean) : []);
    const name = p.name || `Venue ${id}`;
    const slug = name
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const venue = {
      locationId: id,
      rank,
      nameEn: name,
      nameAr: name,
      nameEnTransliterated: false,
      rating: p.rating ?? null,
      reviewCount: p.reviewCount ?? null,
      cuisines,
      cuisinesAr: [],
      priceBand: bandOf(p.priceRange ?? null),
      priceRangeRaw: p.priceRange ?? null,
      areaId,
      areaResolution: 'unresolved',
      coordinates: null,
      telephone: null,
      streetAddress: null,
      postalCode: null,
      openingHours: '',
      openingHoursStructured: null,
      menuUrl: null,
      acceptsReservations: null,
      award: null,
      openStatus: null,
      coverImageUrl: '',
      tripadvisorUrl: p.url ? `https://www.tripadvisor.com${p.url}` : null,
      sourceImageUrls: [],
      quickReviews: [],
      reviews,
      slug,
    };
    existing.restaurants.push(venue);
    stats.added++;
    stats.reviewsEmbedded += reviews.length;
  });

  existing.metadata = {
    ...existing.metadata,
    refreshedAt: new Date().toISOString(),
    refresher: 'scripts/refresh-restaurants-seed.ts',
    totalRestaurants: existing.restaurants.length,
  };
  fs.writeFileSync(EXISTING, JSON.stringify(existing, null, 1));
  console.log(
    `matched: ${stats.matched} | rows touched: ${stats.updated} | added: ${stats.added} | reviews embedded: ${stats.reviewsEmbedded}`,
  );
}
main();
