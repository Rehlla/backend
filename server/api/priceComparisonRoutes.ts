import { Router, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { fetchPriceComparison } from '../services/priceComparisonService';
import {
  optionalString,
  optionalCount,
  pickAllowedKeys,
  rejectRawCardData,
  requiredString,
  requiredEnum,
  requiredCalendarDate,
  PRICE_COMPARISON_KEYS,
} from '../middleware/bodyParams';
import { PROPERTY_TYPES } from '../services/accommodationService';

export const priceComparisonRouter = Router();

/**
 * POST /api/price-comparison
 *
 * Compare prices for a specific accommodation across multiple platforms.
 * Request Body:
 * {
 *   accommodationId: string,
 *   accommodationName: string,
 *   accommodationNameAr?: string,
 *   checkIn: string (YYYY-MM-DD),
 *   checkOut: string (YYYY-MM-DD),
 *   guests: number,
 *   rooms: number
 * }
 *
 * Response:
 * {
 *   quotes: PriceQuote[],
 *   cheapestQuote: PriceQuote | null,
 *   averagePrice: number,
 *   lastUpdated: string
 * }
 *
 * This used to hand-roll its checks with truthiness tests and a
 * `new Date(string)` parse, then forward `guests`/`rooms` unvalidated and
 * `propertyType` as an unchecked cast. Every field now goes through
 * bodyParams: card-shaped keys are rejected outright, the party is range
 * checked, and the property type has to be one the catalogue actually holds.
 *
 * `propertyType` matters beyond tidiness — it is a component of the provider
 * cache key, and the cache is a 500-entry FIFO. Leaving it free-form let any
 * signed-in caller mint unlimited distinct keys and flush every cached quote.
 *
 * An empty or unrecognised body is a 400. The route used to answer one, which
 * only worked because `pickAllowedKeys` rejects a body that names no known key.
 */
priceComparisonRouter.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    rejectRawCardData(req.body);
    const body = pickAllowedKeys(req.body, PRICE_COMPARISON_KEYS, 'body');

    const accommodationId = requiredString(body.accommodationId, 'accommodationId', 128);
    const accommodationName = requiredString(body.accommodationName, 'accommodationName', 200);

    const checkIn = requiredCalendarDate(body.checkIn, 'checkIn');
    const checkOut = requiredCalendarDate(body.checkOut, 'checkOut');
    if (checkOut <= checkIn) {
      return res.status(400).json({ error: 'Check-out must be after check-in' });
    }

    const result = await fetchPriceComparison(
      {
        accommodationId,
        accommodationName,
        accommodationNameAr: optionalString(body.accommodationNameAr, 'accommodationNameAr', 200),
        checkIn,
        checkOut,
        guests: optionalCount(body.guests, 'guests', 1, 50) ?? 1,
        rooms: optionalCount(body.rooms, 'rooms', 1, 20) ?? 1,
      },
      body.propertyType === undefined
        ? 'hotel'
        : requiredEnum(body.propertyType, PROPERTY_TYPES, 'propertyType')
    );

    res.json(result);
  } catch (error: any) {
    // A rejected body is the caller's problem and is already fully described by
    // InvalidRequestBodyError; logging it on every 400 would let a client flood
    // the log with validation noise. Provider faults are ours and need the trace.
    const status = error?.status ?? 500;
    if (status >= 500) console.error('Price comparison error:', error);
    res.status(status).json({
      error: status >= 500 ? 'Internal server error' : error?.message || 'Invalid request.',
    });
  }
});

/**
 * GET /api/price-comparison/available-platforms
 */
priceComparisonRouter.get('/available-platforms', (_req: AuthenticatedRequest, res: Response) => {
  const platforms = [
    { id: 'booking_com', name: 'Booking.com', logo: '/images/platforms/booking.svg', supportedTypes: ['hotel', 'hostel', 'apartment', 'villa', 'guesthouse', 'camp', 'eco-lodge', 'boutique-hotel', 'resort', 'chalet'] },
    { id: 'expedia', name: 'Expedia', logo: '/images/platforms/expedia.svg', supportedTypes: ['hotel', 'hostel', 'apartment', 'villa', 'guesthouse', 'camp', 'eco-lodge', 'boutique-hotel', 'resort', 'chalet'] },
    { id: 'hotels_com', name: 'Hotels.com', logo: '/images/platforms/hotels.svg', supportedTypes: ['hotel', 'resort', 'boutique-hotel'] },
    { id: 'airbnb', name: 'Airbnb', logo: '/images/platforms/airbnb.svg', supportedTypes: ['apartment', 'studio', 'villa', 'guesthouse', 'camp', 'eco-lodge', 'chalet'] },
    { id: 'hostelworld', name: 'Hostelworld', logo: '/images/platforms/hostelworld.svg', supportedTypes: ['hostel'] },
  ];
  res.json({ platforms });
});

export default priceComparisonRouter;
