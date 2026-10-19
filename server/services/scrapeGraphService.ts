/**
 * ScrapeGraph AI service for fetching structured data from travel websites.
 * Uses native fetch with AbortController for timeouts (project convention).
 */

const SCRAPEGRAPH_API_BASE = 'https://api.scrapegraphai.com/v1';
const DEFAULT_TIMEOUT_MS = 60_000;

export interface ScrapeGraphScrapeParams {
  url: string;
  prompt: string;
  outputFormat?: 'json' | 'markdown' | 'html';
  waitFor?: number;
}

export interface ScrapeGraphScrapeResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  creditsUsed?: number;
}

export interface ScrapeGraphStatus {
  healthy: boolean;
  apiKeyConfigured: boolean;
  message: string;
}

let apiKey: string | null = null;

export function initScrapeGraph(apiKeyValue: string | undefined): void {
  apiKey = apiKeyValue ?? null;
}

export function getScrapeGraphStatus(): ScrapeGraphStatus {
  const configured = !!apiKey;
  return {
    healthy: configured,
    apiKeyConfigured: configured,
    message: configured
      ? 'ScrapeGraph AI is configured and ready'
      : 'SCRAPEGRAPH_API_KEY is not set — ScrapeGraph features are disabled',
  };
}

async function scrape<T = Record<string, unknown>>(
  params: ScrapeGraphScrapeParams,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  if (!apiKey) {
    throw new Error('SCRAPEGRAPH_API_KEY is not configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SCRAPEGRAPH_API_BASE}/scrape`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: params.url,
        prompt: params.prompt,
        output_format: params.outputFormat ?? 'json',
        ...(params.waitFor ? { wait_for: params.waitFor } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`ScrapeGraph API error ${response.status}: ${body.slice(0, 200)}`);
    }

    const json = (await response.json()) as {
      success: boolean;
      data?: T;
      error?: string;
      credits_used?: number;
    };

    if (!json.success) {
      throw new Error(json.error ?? 'ScrapeGraph returned success=false');
    }

    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Typed scrapers for travel data ─────────────────────────────────────────

export interface ScrapedHotelPrice {
  platform: string;
  pricePerNight: number;
  currency: string;
  availability: boolean;
  url: string;
}

export interface ScrapedHotelInfo {
  name: string;
  rating: number;
  reviewCount: number;
  amenities: string[];
  description: string;
  images: string[];
  address: string;
  pricePerNight: number;
  currency: string;
}

export interface ScrapedActivityInfo {
  name: string;
  description: string;
  duration: string;
  price: number;
  currency: string;
  includes: string[];
  rating: number;
  images: string[];
}

/**
 * Scrape hotel price comparison from a specific platform page.
 */
export async function scrapeHotelPrice(
  hotelName: string,
  platformUrl: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): Promise<ScrapedHotelPrice> {
  const result = await scrape<ScrapedHotelPrice>({
    url: platformUrl,
    prompt: `Extract the hotel price for "${hotelName}" for dates ${checkIn} to ${checkOut}, ${guests} guests. Return the price per night, currency, availability status, and booking URL.`,
    waitFor: 3000,
  });
  return result;
}

/**
 * Scrape hotel details from a listing page (TripAdvisor, Google, etc.)
 */
export async function scrapeHotelDetails(url: string): Promise<ScrapedHotelInfo> {
  const result = await scrape<ScrapedHotelInfo>({
    url,
    prompt: 'Extract hotel name, star rating, review count, amenities list, description, image URLs, address, and nightly price.',
    waitFor: 2000,
  });
  return result;
}

/**
 * Scrape activity/tour details from a listing page.
 */
export async function scrapeActivityDetails(url: string): Promise<ScrapedActivityInfo> {
  const result = await scrape<ScrapedActivityInfo>({
    url,
    prompt: 'Extract activity name, description, duration, price, what is included, rating, and image URLs.',
    waitFor: 2000,
  });
  return result;
}

/**
 * Bulk-scrape multiple URLs with the same prompt (e.g., all hotel pages).
 */
export async function scrapeBulk<T>(
  urls: string[],
  prompt: string,
  delayMs: number = 1000,
): Promise<Array<{ url: string; data: T | null; error: string | null }>> {
  const results: Array<{ url: string; data: T | null; error: string | null }> = [];

  for (const url of urls) {
    try {
      const data = await scrape<T>({ url, prompt });
      results.push({ url, data, error: null });
    } catch (err) {
      results.push({
        url,
        data: null,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
