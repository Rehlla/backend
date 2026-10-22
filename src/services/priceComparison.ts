/**
 * Client-side Price Comparison Service
 *
 * Calls the server API at /api/price-comparison which aggregates
 * prices from multiple free affiliate booking platforms.
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

export interface PriceComparisonRequest {
  accommodationId: string;
  accommodationName: string;
  accommodationNameAr?: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  guests: number;
  rooms: number;
}

export interface PriceComparisonResponse {
  quotes: PriceQuote[];
  cheapestQuote: PriceQuote | null;
  averagePrice: number;
  lastUpdated: string;
  source?: 'live' | 'mock';
  cacheHit?: boolean;
}

/**
 * Fetch price comparison for a specific accommodation
 */
export async function fetchPriceComparison(
  request: PriceComparisonRequest,
  propertyType: string = 'hotel'
): Promise<PriceComparisonResponse> {
  const response = await fetch('/api/price-comparison', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...request, propertyType }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch prices' }));
    throw new Error(error.error || 'Failed to fetch prices');
  }

  return response.json();
}

/**
 * Fetch prices for multiple accommodations (batch request)
 */
export async function fetchBulkPriceComparisons(
  accommodations: Array<PriceComparisonRequest & { propertyType: string }>
): Promise<Map<string, PriceComparisonResponse>> {
  const results = new Map<string, PriceComparisonResponse>();

  for (const acc of accommodations) {
    try {
      const comparison = await fetchPriceComparison(acc, acc.propertyType);
      results.set(acc.accommodationId, comparison);
    } catch {
      // Skip failed requests
    }
  }

  return results;
}

export default {
  fetchPriceComparison,
  fetchBulkPriceComparisons,
};
