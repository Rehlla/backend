/**
 * Public-listing browse for a destination.
 *
 * The Tripadvisor pull is not inventory: prices on one hotel disagree with
 * each other, restaurants have no photo, phone or coordinates, and nothing
 * has a supplier or a rate plan. These selectors keep a card only when it
 * can be shown honestly, and they never emit a number the platform would
 * charge.
 */

export const BROWSE_DESTINATIONS = ['dahab', 'nuweiba', 'siwa'] as const;
export type BrowseDestination = (typeof BROWSE_DESTINATIONS)[number];
export type BrowseKind = 'stay' | 'restaurant';

export interface BrowseStay {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  photoUrl: string;
  locality: string | null;
  propertyType: string | null;
  url: string | null;
  lat: number | null;
  lng: number | null;
  bookable: false;
}

export interface BrowseRestaurant {
  id: string;
  name: string;
  rating: number | null;
  reviewCount: number;
  cuisines: string[];
  priceBand: string | null;
  quote: string | null;
  orderable: false;
}

/** Boxes do not overlap. A coordinate outside its place is dropped, which
 *  also keeps a duplicated listing (Eden Camp sits in two files) in the one
 *  place its coordinates actually fall. */
const BOX: Record<BrowseDestination, { latMin: number; latMax: number; lngMin: number; lngMax: number }> = {
  dahab: { latMin: 28.4, latMax: 28.68, lngMin: 34.42, lngMax: 34.62 },
  nuweiba: { latMin: 28.68, latMax: 29.35, lngMin: 34.42, lngMax: 34.95 },
  siwa: { latMin: 29.05, latMax: 29.4, lngMin: 25.2, lngMax: 26.1 },
};

interface RawPlace {
  id?: number | string;
  name?: string | null;
  url?: string | null;
  rating?: number | string | null;
  reviewCount?: number | string | null;
  type?: string | null;
  lat?: number | null;
  lng?: number | null;
  address?: { locality?: string | null } | null;
  priceMin?: number | null;
  priceUSDMin?: number | null;
  lowestPrice?: string | null;
  priceRange?: string | null;
  photo?: string | null;
  cuisines?: string | null;
  reviews?: Array<{ text?: string | null }> | null;
}

function inBox(destination: BrowseDestination, lat: number, lng: number): boolean {
  const box = BOX[destination];
  return lat >= box.latMin && lat < box.latMax && lng >= box.lngMin && lng <= box.lngMax;
}

function positiveRating(raw: unknown): number | null {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n <= 0 || n > 5) return null;
  return Math.round(n * 10) / 10;
}

function reviewCount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : 0;
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function listingUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  if (raw.startsWith('https://')) return raw;
  if (raw.startsWith('/')) return `https://www.tripadvisor.com${raw}`;
  return null;
}

function photoUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('https://')) return null;
  return raw.replace(/\{width\}/g, '800').replace(/\{height\}/g, '600');
}

function hasListedPrice(place: RawPlace): boolean {
  if (typeof place.priceMin === 'number' && place.priceMin > 0) return true;
  if (typeof place.priceUSDMin === 'number' && place.priceUSDMin > 0) return true;
  if (typeof place.lowestPrice === 'string' && /\d/.test(place.lowestPrice)) return true;
  if (typeof place.priceRange === 'string' && /\d/.test(place.priceRange)) return true;
  return false;
}

function priceBand(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  if (!/^\$+(?: - \$+)?$/.test(trimmed)) return null;
  return trimmed;
}

function quoteFrom(reviews: RawPlace['reviews']): string | null {
  const text = reviews?.find((review) => typeof review?.text === 'string' && review.text.trim().length > 0)?.text;
  if (!text) return null;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > 160 ? `${trimmed.slice(0, 157)}...` : trimmed;
}

function byRating(a: { rating: number | null; reviewCount: number; name: string }, b: { rating: number | null; reviewCount: number; name: string }): number {
  const ar = a.rating ?? -1;
  const br = b.rating ?? -1;
  if (br !== ar) return br - ar;
  if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
  return a.name.localeCompare(b.name);
}

export function browseStays(destination: BrowseDestination, places: readonly RawPlace[]): BrowseStay[] {
  const stays: BrowseStay[] = [];
  for (const place of places) {
    const name = typeof place.name === 'string' ? place.name.trim() : '';
    const photo = photoUrl(place.photo);
    const rating = positiveRating(place.rating);
    const lat = typeof place.lat === 'number' ? place.lat : NaN;
    const lng = typeof place.lng === 'number' ? place.lng : NaN;
    if (!name || place.id == null || !photo || rating == null || !hasListedPrice(place)) continue;
    if (!inBox(destination, lat, lng)) continue;
    stays.push({
      id: String(place.id),
      name,
      rating,
      reviewCount: reviewCount(place.reviewCount),
      photoUrl: photo,
      locality: place.address?.locality?.trim() || null,
      propertyType: typeof place.type === 'string' && place.type.trim() ? place.type.trim() : null,
      url: listingUrl(place.url),
      lat,
      lng,
      bookable: false,
    });
  }
  return stays.sort(byRating);
}

export function browseRestaurants(destination: BrowseDestination, places: readonly RawPlace[]): BrowseRestaurant[] {
  const restaurants: BrowseRestaurant[] = [];
  for (const place of places) {
    const name = typeof place.name === 'string' ? place.name.trim() : '';
    if (!name || place.id == null) continue;
    const cuisines = typeof place.cuisines === 'string'
      ? place.cuisines.split(',').map((part) => part.trim()).filter(Boolean).slice(0, 4)
      : [];
    restaurants.push({
      id: `${destination}:${String(place.id)}`,
      name,
      rating: positiveRating(place.rating),
      reviewCount: reviewCount(place.reviewCount),
      cuisines,
      priceBand: priceBand(place.priceRange),
      quote: quoteFrom(place.reviews),
      orderable: false,
    });
  }
  return restaurants.sort(byRating);
}
