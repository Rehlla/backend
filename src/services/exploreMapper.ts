import type { DahabActivity, DahabPlace } from '../shared/types/knowledge';
import type { NearMeItem } from '../types';

/**
 * Turns the destination corpus into the cards Explore already renders.
 *
 * Explore showed six hardcoded venues while /api/dahab/activities and
 * /api/dahab/places held 22 activities and 17 places — with descriptions,
 * durations, difficulty, real prices and a verification date — and nothing in
 * the app had ever called either endpoint.
 *
 * Fields the corpus does not carry are left undefined rather than filled:
 * there is no photograph, no walking distance from wherever the traveler is
 * standing, and no rating. The card omits what is missing.
 */

const CATEGORY_BY_ACTIVITY: Record<DahabActivity['category'], NearMeItem['category']> = {
  diving: 'experience',
  water_sport: 'experience',
  safari: 'experience',
  culture: 'experience',
  wellness: 'experience',
  food: 'food'
};

/** Price bands from the real base price, in EGP. */
function priceLevelOf(basePriceEGP: number): NearMeItem['priceLevel'] {
  if (basePriceEGP <= 600) return '$';
  if (basePriceEGP <= 2000) return '$$';
  return '$$$';
}

/** "45 min" / "2h 30m" — from durationMinutes, which is always present. */
export function formatDuration(minutes: number, isArabic: boolean): string {
  if (minutes < 60) return isArabic ? `${minutes} دقيقة` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hoursPart = isArabic
    ? hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`
    : `${hours}h`;
  if (rest === 0) return hoursPart;
  return isArabic ? `${hoursPart} و${rest} دقيقة` : `${hoursPart} ${rest}m`;
}

/** Turns 'blue_hole' into 'Blue Hole' — the corpus stores area ids, not labels. */
export function areaLabel(areaId: string): string {
  return areaId
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function activityToNearMeItem(
  activity: DahabActivity,
  placesById: Map<string, DahabPlace>,
  isArabic: boolean
): NearMeItem {
  const place = placesById.get(activity.placeId);
  const area = place ? (isArabic ? place.nameAr : place.nameEn) : areaLabel(activity.areaId);

  return {
    id: activity.id,
    name: activity.titleEn,
    nameAr: activity.titleAr,
    category: CATEGORY_BY_ACTIVITY[activity.category] ?? 'experience',
    priceLevel: priceLevelOf(activity.basePriceEGP),
    // The SKU's price when there is one, because that is what checkout charges
    // and the two disagree (the Blue Hole activity is written up at 2,200 EGP
    // and SKU-DIV-002 sells it for 3,400).
    basePriceEGP: activity.bookable?.basePriceEGP ?? activity.basePriceEGP,
    skuId: activity.bookable?.skuId,
    serviceType: activity.bookable?.serviceType,
    // The tag carries what the record actually knows: how long it takes and
    // who it suits.
    tag: `${formatDuration(activity.durationMinutes, false)} · ${activity.difficulty}`,
    tagAr: `${formatDuration(activity.durationMinutes, true)} · ${activity.difficulty}`,
    description: place?.descriptionEn || activity.experienceLevelRequired,
    descriptionAr: place?.descriptionAr || activity.experienceLevelRequired,
    location: area,
    locationAr: area,
    // The corpus has no opening hours for an activity; the duration is what it
    // does have, and saying so beats printing a plausible "09:00 – 17:00".
    openHours: formatDuration(activity.durationMinutes, false),
    openHoursAr: formatDuration(activity.durationMinutes, true),
    bestFor: activity.experienceLevelRequired,
    bestForAr: activity.experienceLevelRequired
  };
}

export function buildExploreItems(
  activities: DahabActivity[],
  places: DahabPlace[],
  isArabic: boolean
): NearMeItem[] {
  const placesById = new Map(places.map(place => [place.id, place]));
  return activities.map(activity => activityToNearMeItem(activity, placesById, isArabic));
}
