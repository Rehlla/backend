/**
 * Server-side price comparison service.
 * Aggregates prices from multiple free/affiliate booking platforms.
 *
 * Provider chain (SPARC Phase 3): StayingAPI (live) -> Xotelo (stub) -> mock.
 * Results are cached in-memory for 1h (matches StayingAPI cache TTL).
 *
 * Env:
 *   STAYING_API_KEY      Bearer key (stay_test_* sandbox or stay_live_*). Unset = provider disabled.
 *   STAYING_API_BASE     Default https://api.stayingapi.com
 *   STAYING_API_LOCATION Default "Dahab,EG" (GOOGLE-mode disambiguation)
 *   XOTELO_API_KEY       RapidAPI key. Xotelo needs a per-property TripAdvisor
 *                        hotel_key map (XOTELO_HOTEL_KEYS) — not yet configured,
 *                        so the provider stays disabled until the map exists.
 */

export interface PriceQuote {
  platform: string;
  platformLogo: string;
  price: number;
  perNight: number;
  totalPrice: number;
  fees: number;
  taxes: number;
  rating: number;
  reviewCount: number;
  isLowest: boolean;
  affiliateUrl: string;
  bookingUrl: string;
}

export interface PriceComparisonResponse {
  quotes: PriceQuote[];
  cheapestQuote: PriceQuote | null;
  averagePrice: number;
  lastUpdated: string;
  source: 'live' | 'mock';
  cacheHit: boolean;
}

interface PriceComparisonParams {
  accommodationId: string;
  accommodationName: string;
  accommodationNameAr?: string;
  checkIn: string;
  checkOut: string;
  guests?: number;
  rooms?: number;
}

const PLATFORM_CONFIGS: Record<string, { name: string; logo: string; domain: string; rating: number; reviews: number }> = {
  booking_com: {
    name: 'Booking.com',
    logo: '/images/platforms/booking.svg',
    domain: 'www.booking.com',
    rating: 4.6,
    reviews: 2847,
  },
  expedia: {
    name: 'Expedia',
    logo: '/images/platforms/expedia.svg',
    domain: 'www.expedia.com',
    rating: 4.3,
    reviews: 1923,
  },
  hotels_com: {
    name: 'Hotels.com',
    logo: '/images/platforms/hotels.svg',
    domain: 'www.hotels.com',
    rating: 4.2,
    reviews: 1567,
  },
  airbnb: {
    name: 'Airbnb',
    logo: '/images/platforms/airbnb.svg',
    domain: 'www.airbnb.com',
    rating: 4.5,
    reviews: 3241,
  },
  hostelworld: {
    name: 'Hostelworld',
    logo: '/images/platforms/hostelworld.svg',
    domain: 'www.hostelworld.com',
    rating: 4.1,
    reviews: 892,
  },
};

const PROPERTY_PLATFORMS: Record<string, string[]> = {
  hotel: ['booking_com', 'expedia', 'hotels_com', 'airbnb'],
  hostel: ['hostelworld', 'booking_com', 'expedia'],
  apartment: ['airbnb', 'booking_com', 'expedia'],
  studio: ['airbnb', 'booking_com'],
  villa: ['airbnb', 'booking_com', 'expedia'],
  guesthouse: ['booking_com', 'expedia', 'hotels_com'],
  camp: ['booking_com', 'expedia'],
  'eco-lodge': ['booking_com', 'expedia', 'airbnb'],
  'boutique-hotel': ['booking_com', 'expedia', 'hotels_com'],
  resort: ['booking_com', 'expedia', 'hotels_com'],
  chalet: ['airbnb', 'booking_com', 'expedia'],
};

function generatePriceVariation(basePrice: number, variance: number): number {
  const factor = 1 + (Math.random() - 0.5) * variance;
  return Math.round(basePrice * factor);
}

function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffMs = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

function buildAffiliateUrl(platform: string, accommodationName: string, checkIn: string, checkOut: string): string {
  const encodedName = encodeURIComponent(accommodationName);

  switch (platform) {
    case 'booking_com':
      return `https://www.booking.com/searchresults.html?ss=${encodedName}&checkin=${checkIn}&checkout=${checkOut}&aid=304142`;
    case 'expedia':
      return `https://www.expedia.com/Hotel-Search?destination=${encodedName}&startDate=${checkIn}&endDate=${checkOut}&affId=12345`;
    case 'hotels_com':
      return `https://www.hotels.com/Hotel-Search?destination=${encodedName}&startDate=${checkIn}&endDate=${checkOut}&affId=67890`;
    case 'airbnb':
      return `https://www.airbnb.com/s/${encodedName}?checkin=${checkIn}&checkout=${checkOut}&refinement_paths%5B%5D=%2Fhomes`;
    case 'hostelworld':
      return `https://www.hostelworld.com/hostels/${encodedName}?dateFrom=${checkIn}&dateTo=${checkOut}`;
    default:
      return '#';
  }
}

function generateMockQuotes(
  params: PriceComparisonParams,
  propertyType: string
): PriceQuote[] {
  const platforms = PROPERTY_PLATFORMS[propertyType] || PROPERTY_PLATFORMS.hotel;
  const basePrice = 1500 + Math.floor(Math.random() * 3500);
  const nights = calculateNights(params.checkIn, params.checkOut);

  return platforms.map((platformKey) => {
    const config = PLATFORM_CONFIGS[platformKey];
    const price = generatePriceVariation(basePrice, 0.3);
    const fees = Math.round(price * (0.05 + Math.random() * 0.08));
    const taxes = Math.round(price * (0.1 + Math.random() * 0.05));
    const total = price + fees + taxes;

    return {
      platform: config.name,
      platformLogo: config.logo,
      price: total,
      perNight: Math.round(total / nights),
      totalPrice: total,
      fees,
      taxes,
      rating: config.rating + (Math.random() - 0.5) * 0.4,
      reviewCount: config.reviews + Math.floor((Math.random() - 0.5) * 200),
      isLowest: false,
      affiliateUrl: buildAffiliateUrl(platformKey, params.accommodationName, params.checkIn, params.checkOut),
      bookingUrl: buildAffiliateUrl(platformKey, params.accommodationName, params.checkIn, params.checkOut),
    };
  }).sort((a, b) => a.price - b.price)
    .map((quote, index) => ({ ...quote, isLowest: index === 0 }));
}

// ---------------------------------------------------------------------------
// Live providers
// ---------------------------------------------------------------------------

interface StayingOffer {
  ota?: string;
  totalPrice?: number | null;
  currency?: string;
  url?: string;
}

/** StayingAPI OTA slug -> internal platform key. */
const OTA_MAP: Record<string, string> = {
  'booking.com': 'booking_com',
  booking: 'booking_com',
  expedia: 'expedia',
  'hotels.com': 'hotels_com',
  airbnb: 'airbnb',
  hostelworld: 'hostelworld',
};

const FETCH_TIMEOUT_MS = 15000;
const JOB_POLL_INTERVAL_MS = 3000;
const JOB_POLL_MAX_ATTEMPTS = 30;

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mapStayingOffersToQuotes(
  offers: StayingOffer[],
  params: PriceComparisonParams
): PriceQuote[] {
  const nights = calculateNights(params.checkIn, params.checkOut);

  return offers
    .filter((o) => typeof o?.totalPrice === 'number' && Number.isFinite(o.totalPrice))
    .map((o) => {
      const platformKey = OTA_MAP[(o.ota || '').toLowerCase()];
      const config = platformKey ? PLATFORM_CONFIGS[platformKey] : undefined;
      const total = Math.round(o.totalPrice as number);
      const fallbackUrl = buildAffiliateUrl(
        platformKey || 'booking_com',
        params.accommodationName,
        params.checkIn,
        params.checkOut
      );

      return {
        platform: config?.name ?? o.ota ?? 'Unknown',
        platformLogo: config?.logo ?? '',
        price: total,
        perNight: Math.round(total / nights),
        totalPrice: total,
        // GOOGLE mode does not expose a fee/tax breakdown; totalPrice is comparable.
        fees: 0,
        taxes: 0,
        rating: config?.rating ?? 4.0,
        reviewCount: config?.reviews ?? 0,
        isLowest: false,
        affiliateUrl: o.url || fallbackUrl,
        bookingUrl: o.url || fallbackUrl,
      };
    })
    .sort((a, b) => a.price - b.price)
    .map((quote, index) => ({ ...quote, isLowest: index === 0 }));
}

async function pollStayingJob(base: string, key: string, jobId: string): Promise<StayingOffer[] | null> {
  for (let attempt = 0; attempt < JOB_POLL_MAX_ATTEMPTS; attempt++) {
    const res = await fetchWithTimeout(
      `${base}/v1/jobs/${encodeURIComponent(jobId)}`,
      { headers: { Authorization: `Bearer ${key}` } },
      FETCH_TIMEOUT_MS
    );
    if (!res.ok) return null;
    const body = await res.json() as { data?: { status?: string; result?: { offers?: StayingOffer[] } } };
    const status = body?.data?.status;
    if (status === 'completed') return body?.data?.result?.offers ?? [];
    if (status === 'failed' || status === 'cancelled') return null;
    if (attempt < JOB_POLL_MAX_ATTEMPTS - 1) await sleep(JOB_POLL_INTERVAL_MS);
  }
  return null;
}

async function fetchStayingOffers(params: PriceComparisonParams): Promise<StayingOffer[] | null> {
  const key = process.env.STAYING_API_KEY;
  if (!key) return null;

  const base = process.env.STAYING_API_BASE || 'https://api.stayingapi.com';
  const location = process.env.STAYING_API_LOCATION || 'Dahab,EG';
  const qs = new URLSearchParams({
    name: params.accommodationName,
    location,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    adults: String(params.guests ?? 2),
    children: '0',
    currency: 'EGP',
  });

  const res = await fetchWithTimeout(`${base}/v1/price-compare?${qs.toString()}`, {
    headers: { Authorization: `Bearer ${key}` },
  }, FETCH_TIMEOUT_MS);

  if (res.status === 202) {
    const body = await res.json() as { data?: { jobId?: string } };
    const jobId = body?.data?.jobId;
    if (!jobId) return null;
    return pollStayingJob(base, key, jobId);
  }
  if (!res.ok) return null;
  const body = await res.json() as { data?: { offers?: StayingOffer[] } };
  return body?.data?.offers ?? [];
}

interface PriceProvider {
  name: string;
  isConfigured(): boolean;
  fetchQuotes(params: PriceComparisonParams, propertyType?: string): Promise<PriceQuote[] | null>;
}

const stayingProvider: PriceProvider = {
  name: 'stayingapi',
  isConfigured: () => Boolean(process.env.STAYING_API_KEY),
  fetchQuotes: async (params) => {
    const offers = await fetchStayingOffers(params);
    if (!offers || offers.length === 0) return null;
    const quotes = mapStayingOffersToQuotes(offers, params);
    return quotes.length > 0 ? quotes : null;
  },
};

const xoteloProvider: PriceProvider = {
  name: 'xotelo',
  // Requires a per-property TripAdvisor hotel_key map (XOTELO_HOTEL_KEYS)
  // covering all 379 listings — not configured yet. Stubbed until then.
  isConfigured: () => Boolean(process.env.XOTELO_API_KEY && process.env.XOTELO_HOTEL_KEYS),
  fetchQuotes: async () => null,
};

const mockProvider: PriceProvider = {
  name: 'mock',
  isConfigured: () => true,
  fetchQuotes: async (params, propertyType?: string) =>
    generateMockQuotes(params, propertyType || 'hotel'),
};

// ---------------------------------------------------------------------------
// Cache (1h TTL, capped size)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 3600 * 1000;
const CACHE_MAX_ENTRIES = 500;

const quoteCache = new Map<string, { at: number; response: PriceComparisonResponse }>();

function buildCacheKey(params: PriceComparisonParams, propertyType: string): string {
  return [
    params.accommodationId,
    params.accommodationName,
    params.checkIn,
    params.checkOut,
    String(params.guests ?? 1),
    String(params.rooms ?? 1),
    propertyType,
  ].join('|');
}

export function clearPriceComparisonCache(): void {
  quoteCache.clear();
}

function getCached(key: string): PriceComparisonResponse | null {
  const entry = quoteCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    quoteCache.delete(key);
    return null;
  }
  return entry.response;
}

function setCached(key: string, response: PriceComparisonResponse): void {
  if (quoteCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = quoteCache.keys().next();
    if (!oldest.done) quoteCache.delete(oldest.value);
  }
  quoteCache.set(key, { at: Date.now(), response });
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function fetchPriceComparison(
  params: PriceComparisonParams,
  propertyType: string
): Promise<PriceComparisonResponse> {
  // Validate params
  if (!params.checkIn || !params.checkOut) {
    throw new Error('checkIn and checkOut are required');
  }

  const cacheKey = buildCacheKey(params, propertyType);
  const cached = getCached(cacheKey);
  if (cached) {
    return { ...cached, cacheHit: true };
  }

  const providers: PriceProvider[] = [stayingProvider, xoteloProvider, mockProvider];
  let quotes: PriceQuote[] | null = null;
  let source: 'live' | 'mock' = 'mock';

  for (const provider of providers) {
    if (!provider.isConfigured()) continue;
    try {
      const result = await provider.fetchQuotes(params, propertyType);
      if (result && result.length > 0) {
        quotes = result;
        source = provider.name === 'mock' ? 'mock' : 'live';
        break;
      }
    } catch (err) {
      console.error(`Price provider ${provider.name} failed, trying next:`, err);
    }
  }

  const finalQuotes = quotes ?? [];
  const cheapestQuote = finalQuotes.length > 0 ? finalQuotes[0] : null;
  const averagePrice = finalQuotes.length > 0
    ? Math.round(finalQuotes.reduce((sum, q) => sum + q.price, 0) / finalQuotes.length)
    : 0;

  const response: PriceComparisonResponse = {
    quotes: finalQuotes,
    cheapestQuote,
    averagePrice,
    lastUpdated: new Date().toISOString(),
    source,
    cacheHit: false,
  };

  setCached(cacheKey, response);
  return response;
}
