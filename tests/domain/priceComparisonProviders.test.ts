import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPriceComparisonCache,
  fetchPriceComparison,
  mapStayingOffersToQuotes,
} from '../../server/services/priceComparisonService';

const PARAMS = {
  accommodationId: 'test-hotel',
  accommodationName: 'Test Hotel Dahab',
  checkIn: '2026-10-01',
  checkOut: '2026-10-03', // 2 nights
  guests: 2,
  rooms: 1,
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const STAYING_200 = {
  data: {
    property: 'Test Hotel Dahab',
    checkIn: '2026-10-01',
    checkOut: '2026-10-03',
    currency: 'EGP',
    min: 2000,
    median: 2100,
    offers: [
      { ota: 'expedia', totalPrice: 2200, currency: 'EGP', url: 'https://expedia.example/offer' },
      { ota: 'booking.com', totalPrice: 2000, currency: 'EGP', url: 'https://booking.example/offer' },
    ],
  },
  meta: { creditsCharged: 30 },
};

describe('mapStayingOffersToQuotes', () => {
  it('maps offers to sorted quotes with lowest flagged', () => {
    const quotes = mapStayingOffersToQuotes(STAYING_200.data.offers, PARAMS);
    expect(quotes).toHaveLength(2);
    expect(quotes[0].platform).toBe('Booking.com');
    expect(quotes[0].price).toBe(2000);
    expect(quotes[0].perNight).toBe(1000); // 2000 / 2 nights
    expect(quotes[0].isLowest).toBe(true);
    expect(quotes[0].affiliateUrl).toBe('https://booking.example/offer');
    expect(quotes[1].platform).toBe('Expedia');
    expect(quotes[1].isLowest).toBe(false);
  });

  it('drops offers without a numeric totalPrice', () => {
    const quotes = mapStayingOffersToQuotes(
      [...STAYING_200.data.offers, { ota: 'agoda', totalPrice: null, currency: 'EGP', url: '' }],
      PARAMS
    );
    expect(quotes).toHaveLength(2);
  });
});

describe('fetchPriceComparison provider chain', () => {
  const OLD_KEY = process.env.STAYING_API_KEY;

  beforeEach(() => {
    clearPriceComparisonCache();
    delete process.env.STAYING_API_KEY;
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    if (OLD_KEY === undefined) delete process.env.STAYING_API_KEY;
    else process.env.STAYING_API_KEY = OLD_KEY;
    vi.unstubAllGlobals();
    clearPriceComparisonCache();
  });

  it('uses StayingAPI live quotes when the key is set (200 path)', async () => {
    process.env.STAYING_API_KEY = 'stay_test_key';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, STAYING_200));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPriceComparison({ ...PARAMS }, 'hotel');

    expect(result.source).toBe('live');
    expect(result.cacheHit).toBe(false);
    expect(result.quotes).toHaveLength(2);
    expect(result.cheapestQuote?.platform).toBe('Booking.com');
    expect(result.averagePrice).toBe(2100);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v1/price-compare');
  });

  it('polls the async job on a 202 response', async () => {
    process.env.STAYING_API_KEY = 'stay_test_key';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(202, { data: { jobId: 'job-1' } }))
      .mockResolvedValueOnce(
        jsonResponse(200, { data: { status: 'completed', result: STAYING_200.data } })
      );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPriceComparison({ ...PARAMS }, 'hotel');

    expect(result.source).toBe('live');
    expect(result.quotes).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/v1/jobs/job-1');
  });

  it('falls back to mock when no API key is set', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchPriceComparison({ ...PARAMS }, 'hotel');

    expect(result.source).toBe('mock');
    expect(result.quotes.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to mock when the live call throws', async () => {
    process.env.STAYING_API_KEY = 'stay_test_key';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('socket hang up')));

    const result = await fetchPriceComparison({ ...PARAMS }, 'hotel');

    expect(result.source).toBe('mock');
    expect(result.quotes.length).toBeGreaterThan(0);
  });

  it('serves the second identical request from cache', async () => {
    process.env.STAYING_API_KEY = 'stay_test_key';
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, STAYING_200));
    vi.stubGlobal('fetch', fetchMock);

    const first = await fetchPriceComparison({ ...PARAMS }, 'hotel');
    const second = await fetchPriceComparison({ ...PARAMS }, 'hotel');

    expect(first.cacheHit).toBe(false);
    expect(second.cacheHit).toBe(true);
    expect(second.source).toBe('live');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still validates dates before hitting providers', async () => {
    await expect(fetchPriceComparison({ ...PARAMS, checkIn: '' }, 'hotel')).rejects.toThrow(
      'checkIn and checkOut are required'
    );
  });
});
