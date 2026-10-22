/**
 * GraphQL client for the SPA — POST /api/graphql over the same-origin cookie
 * session. See docs/POLYGLOT_API.md for the full contract.
 *
 * The public fields (platform, catalogue cards, areas, room types, stay
 * quotes) need no session. support/daygi fields ride the cookie; without one
 * their resolvers answer "Authentication required.", which surfaces here as a
 * rejected promise carrying that message.
 */

export interface GraphQLErrorShape {
  message: string;
  path?: ReadonlyArray<string | number>;
}

export interface GraphQLResponse<T> {
  data?: T | null;
  errors?: ReadonlyArray<GraphQLErrorShape>;
}

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await fetch('/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  });
  if (!response.ok) {
    throw new Error(`GraphQL request failed with HTTP ${response.status}.`);
  }
  const body = (await response.json()) as GraphQLResponse<T>;
  if (body.errors?.length) {
    throw new Error(body.errors[0].message);
  }
  return body.data as T;
}

/**
 * Named fragments keep the shipped queries readable in one place; the field
 * lists mirror server/graphql/typeDefs.ts, which is the source of truth.
 */

/** Listing grids and the map — the ?view=card projection, one round-trip. */
export const ACCOMMODATION_CARDS_QUERY = `
  query AccommodationCards($filters: AccommodationCardFilters) {
    accommodationCards(filters: $filters) {
      cards { id slug name nameAr propertyType category priceBand areaId areaName areaNameAr
              rating reviewCount typeChips typeChipsAr tagline taglineAr
              perNightEGP weeklyRateEGP monthlyRateEGP packageNights rooms maxGuests
              latitude longitude skuId active featured coverImageUrl packageTotalEGP }
      areas { id name nameAr }
      stats { total averageRating totalReviews }
    }
  }
`;

/** A property's sellable room types, feeding the quote. */
export const ROOM_TYPES_QUERY = `
  query RoomTypes($slug: String!) {
    roomTypes(slug: $slug) {
      accommodationId
      heldBack
      roomTypes { id name nameAr code baseNightlyEGP weeklyRateEGP monthlyRateEGP
                  maxGuestsPerUnit minNights maxNights totalUnits
                  cancellationPolicyHours amenities images active }
    }
  }
`;

/** What a stay costs — never a promise; the reserve flow re-prices under a lock. */
export const STAY_QUOTE_QUERY = `
  query StayQuote($slug: String!, $input: StayQuoteInput!) {
    stayQuote(slug: $slug, input: $input) {
      nights baseEGP longStayDiscountEGP serviceFeeEGP taxEGP totalEGP
      depositEGP balanceDueEGP currency minNights freeCancellationUntil expiresAt
    }
  }
`;
