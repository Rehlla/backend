/**
 * Contracts served by the `/api/context/*` endpoints (`mapsContextService`).
 *
 * Previously declared inside that server service and imported by the client
 * from `server/...`, which mixed the two module graphs. A client service and
 * two views consume these, so — as with `food.ts` — the shapes live here.
 */

export interface RouteEstimate {
  origin: string;
  destination: string;
  durationMinutes: number;
  distanceKm: number;
  transitMode: 'Walk' | '4x4 Taxi' | 'Boat / Camel' | 'Minibus';
  transitModeAr: string;
  displayEstimateEn: string;
  displayEstimateAr: string;
  isWalkable: boolean;
  confidence: number;
  observedAt: string;
  source: string;
}

export interface WindowFitOption {
  id: string;
  titleEn: string;
  titleAr: string;
  category: 'dive' | 'food' | 'sunset' | 'desert' | 'relaxation';
  categoryLabelEn: string;
  categoryLabelAr: string;
  totalRequiredMinutes: number;
  activityDurationMinutes: number;
  travelMinutesOneWay: number;
  transitMode: string;
  transitModeAr: string;
  locationNameEn: string;
  locationNameAr: string;
  costEgp: number;
  fitHeadlineEn: string;
  fitHeadlineAr: string;
  reasonEn: string;
  reasonAr: string;
  actionRoute: string;
  imageUrl: string;
}

export interface PostActivityFoodSpot {
  id: string;
  nameEn: string;
  nameAr: string;
  cuisineEn: string;
  cuisineAr: string;
  travelMinutes: number;
  isWalkable: boolean;
  distanceDisplay: string;
  bestDishEn: string;
  bestDishAr: string;
  priceBand: 'EGP 80–180' | 'EGP 150–350' | 'EGP 250–550';
  highlightEn: string;
  highlightAr: string;
  rating: number;
  imageUrl: string;
}

export interface FitWindowResponse {
  availableMinutes: number;
  options: WindowFitOption[];
  recommendedContextEn: string;
  recommendedContextAr: string;
}

export interface PostActivityFoodResponse {
  anchorLocation: string;
  spots: PostActivityFoodSpot[];
  contextPromptEn: string;
  contextPromptAr: string;
}

export interface ParsedSearchIntent {
  activityCategory: 'diving' | 'desert' | 'relaxation' | 'food' | 'general';
  maxDurationMinutes: number;
  locationPreference: 'nearby' | 'blue_hole' | 'canyon' | 'laguna' | 'any';
  budgetLevel: 'budget' | 'moderate' | 'premium';
  timeSlot: 'now' | 'morning' | 'sunset' | 'night';
  confidence: number;
}