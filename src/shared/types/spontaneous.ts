/**
 * The recommendation cards the "What Should I Do Now?" flow renders.
 *
 * Declared here rather than in the component because `spontaneousMapper`
 * builds these from the `/api/context/fit-window` reply, and a service
 * importing a component creates the same import cycle `food.ts` exists to
 * avoid.
 */

export type RecommendationMood = 'chill' | 'explore' | 'adventure';

export interface SpontaneousOption {
  id: string;
  mood: RecommendationMood;
  tag: 'Chill' | 'Explore' | 'Adventure';
  tagAr: 'روقان' | 'استكشاف' | 'مغامرة';
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  duration: string;
  durationAr: string;
  durationMinutes: number;
  priceLevel: 'Low' | 'Moderate';
  priceEstimate: string;
  priceEstimateAr: string;
  distance: string;
  distanceAr: string;
  distanceKm: string;
  pace: string;
  paceAr: string;
  icon: string;
  /** "12:00 PM – 01:15 PM" from the moment the option was returned. */
  timeSlot: string;
  whyItFits: string;
  whyItFitsAr: string;
  whyThisDetailed: string;
  whyThisDetailedAr: string;
  whyItWorks: string;
  whyItWorksAr: string;
  isTightFit?: boolean;
  timeBufferMinutes?: number;
  /** Where the backend would send a traveler choosing this option. */
  actionRoute?: string;
}