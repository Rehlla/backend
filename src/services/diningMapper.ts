import { normalizeDiningVenue } from '../shared/diningVenue';
import type { DahabDiningVenue } from '../shared/types/knowledge';
import type { FoodCategory, FoodOption } from '../shared/types/food';

/**
 * Turns the destination corpus's dining venues into the cards Food renders.
 *
 * Food showed three curated restaurants while /api/dahab/food held ten real
 * venues — with cuisines, price bands, average meal prices, opening hours and
 * dietary flags — and nothing had ever called it.
 *
 * The corpus carries no menu, so a venue mapped here has no `popularDishes`
 * and cannot be ordered from. That is not a gap to paper over: every one of
 * the ten is `bookingEligibility: 'WALK_IN'`, so ordering from them online is
 * something the platform genuinely cannot do. The card says so instead.
 */

const CATEGORY_BY_CUISINE: Array<{ match: RegExp; category: FoodCategory }> = [
  { match: /bakery|breakfast|coffee|pastr/i, category: 'breakfast' },
  { match: /street|falafel|shawarma|quick|counter/i, category: 'quick' },
  { match: /seafood|grill|mediterranean/i, category: 'datenight' },
  { match: /egyptian|bedouin|local/i, category: 'local' }
];

export function categoryOf(venue: DahabDiningVenue): FoodCategory {
  const haystack = venue.cuisine.join(' ');
  return CATEGORY_BY_CUISINE.find(rule => rule.match.test(haystack))?.category ?? 'local';
}

const PRICE_LEVEL: Record<DahabDiningVenue['priceBand'], FoodOption['priceLevel']> = {
  'Budget ($)': 'Low',
  'Moderate ($$)': 'Low–Moderate',
  'Premium ($$$)': 'Moderate'
};

/**
 * 'eel_garden' → 'Eel Garden'. The corpus stores area ids, not labels.
 *
 * Accepts the absent case: the research importer writes `areaId: null` when a
 * row's zone matches no known area, and `null.split('_')` is what crashed the
 * whole Food & Dining screen into its error boundary.
 */
export function areaLabel(areaId: string | null | undefined): string {
  if (!areaId) return '';
  return areaId
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function diningVenueToFoodOption(rawVenue: DahabDiningVenue): FoodOption {
  // Single choke point for the /food path. Four corpus rows violate
  // DahabDiningVenue on four fields at once; see src/shared/diningVenue.ts.
  const venue = normalizeDiningVenue(rawVenue);
  const area = areaLabel(venue.areaId);
  const cuisine = venue.cuisine.join(' · ');
  const diets = [
    venue.dietaryOptions.freshSeafoodCatch ? 'Fresh catch' : null,
    venue.dietaryOptions.vegan ? 'Vegan' : null,
    venue.dietaryOptions.vegetarian ? 'Vegetarian' : null,
    venue.dietaryOptions.halal ? 'Halal' : null,
    venue.wifiNomadFriendly ? 'Wi-Fi' : null
  ].filter((label): label is string => label !== null);

  return {
    id: venue.id,
    name: venue.nameEn,
    nameAr: venue.nameAr,
    category: categoryOf(venue),
    categoryTag: cuisine,
    categoryTagAr: cuisine,
    title: venue.nameEn,
    titleAr: venue.nameAr,
    description: diets.join(' · '),
    descriptionAr: diets.join(' · '),
    // The corpus knows where a venue is, not how far the traveler is from it.
    distance: area,
    distanceAr: area,
    distanceKm: area,
    estimatedTime: venue.openingHours,
    estimatedTimeAr: venue.openingHours,
    priceLevel: PRICE_LEVEL[venue.priceBand] ?? 'Low–Moderate',
    priceEstimate: `EGP ${venue.averageMealPriceEGP} per person (average)`,
    priceEstimateAr: `متوسط ${venue.averageMealPriceEGP} ج.م للفرد`,
    // rating and reviewCount are deliberately absent: nothing measures them.
    badge: 'Relaxed',
    badgeAr: 'روقان ع البحر',
    cuisine,
    cuisineAr: cuisine,
    openingStatus: venue.openingHours,
    openingStatusAr: venue.openingHours,
    diningDuration: venue.openingHours,
    diningDurationAr: venue.openingHours,
    deliveryTime: venue.bookingEligibility,
    deliveryTimeAr: venue.bookingEligibility,
    imageUrl: venue.coverImageUrl || '',
    // No menu in the corpus, so no ordering. The card must not offer a basket
    // it cannot fill.
    popularDishes: []
  };
}

export function buildDiningOptions(venues: DahabDiningVenue[]): FoodOption[] {
  return venues.map(diningVenueToFoodOption);
}
