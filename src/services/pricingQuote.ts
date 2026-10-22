/**
 * How a quoted line turns into a number of pounds.
 *
 * This exists because the client and the server once disagreed, and the
 * disagreement only surfaced at the last step of checkout as a 409
 * PRICE_CHANGED. `priceSkuLine` in server/services/commerceService.ts is the
 * rule the server actually charges by; this is the same rule for the number
 * shown before checkout. `tests/domain/pricingQuoteParity.test.ts` asserts the
 * two agree, so a new basis has to be taught to both or the suite fails.
 *
 * Returns null for `per_night`, which cannot be priced from a party size at
 * all — see the case below.
 *
 * Only a per-person line scales with the party. A stay is sold as a block and
 * a private vehicle is priced as the vehicle — booking a room for two guests
 * is one room, not two.
 */
export type ClientPricingBasis = 'per_person' | 'per_stay' | 'per_vehicle' | 'per_night';

/**
 * `basis` is absent on most catalogue rows: `pricingBasis` is an optional
 * field and nothing writes it for the rows that rely on the service-type
 * default. Absent therefore means per_person, which is what every defaulting
 * vertical actually is (diving, safari, wellness, dining, shared transfers).
 * The verticals that are *not* per_person — hotels, private/premium zone
 * transfers — are projected explicitly by GET /api/inventory/:serviceType, so
 * this fallback is a safety net rather than the live path.
 */
export function quoteLine(
  basePriceEGP: number,
  basis: ClientPricingBasis | undefined,
  partySize: number
): number | null {
  const party = Math.max(1, Math.floor(partySize));
  switch (basis ?? 'per_person') {
    case 'per_person':
      return basePriceEGP * party;
    case 'per_stay':
    case 'per_vehicle':
      return basePriceEGP;
    case 'per_night':
      // Deliberately not a number. A night's rate is scaled by the length of the
      // stay, and this function is handed a party size, not a duration — so
      // there is no correct answer to compute from these arguments. Returning
      // the bare nightly rate would show a traveller one night's price for a
      // week, and returning basePriceEGP * party would show one night's rate
      // times the number of adults. A stay has to come from the server quote
      // (hotelPricingService), which knows the dates and the rate calendar.
      return null;
    default:
      return null;
  }
}