// ---------------------------------------------------------------------------
// src/types.ts — thin barrel re-exporting the canonical shared library types
// and the handful of client-only types that have no shared counterpart.
//
// DayGi types, Commerce types, Trip types, Transfer types, etc. live in
// src/shared/ and are re-exported here via `export * from './shared'`.
// This file adds ONLY types unique to the client bundle.
// ---------------------------------------------------------------------------

export * from './shared';

// Re-export domain-specific type modules that live under src/types/
export * from './types/intelligence';
export * from './types/tripOs';
export * from './types/dahabContext';

// Re-export types that live in shared/ but were previously duplicated in this
// file. Canonical definitions are in shared/; these re-exports preserve the
// `@/types` import path for existing consumers.
export type { JourneyStage } from './shared/types/trip';
export type {
  TimelineActivity,
  TimelineActivityType,
  TimelineActivityStatus,
  TimelineDay
} from './shared/types/trip';
export type { ConfirmedBookingItem } from './shared/types/commerce';
export type { LedgerEntry } from './shared/types/commerce';
export type { PaymentState, LedgerEntryType } from './shared/types/commerce';
export type { TransferTrackingRecord } from './shared/types/commerce';
export type { TripDayActivity } from './shared/types/trip';

// ---------------------------------------------------------------------------
// CLIENT-ONLY TYPES (not in shared/)
// ---------------------------------------------------------------------------

export interface CategoryItem {
  id: string;
  title: string;
  titleAr?: string;
  tagline: string;
  taglineAr?: string;
  description: string;
  descriptionAr?: string;
  image: string;
  highlights: string[];
  highlightsAr?: string[];
}

export interface HowItWorksStep {
  number: string;
  title: string;
  description: string;
  subtext?: string;
  iconName: string;
}

export interface DayPlanItem {
  day: number;
  title: string;
  subtitle: string;
  highlights: string[];
  tag: string;
  timeEstimate: string;
  accentColor?: string;
  /** Arabic copy for the day; older Dahab programmes carry English only. */
  titleAr?: string;
  subtitleAr?: string;
  highlightsAr?: string[];
}

export type { TravelerProfile } from './shared/types/user';

export type AppRoute =
  | '/'
  | '/plan'
  | '/home'
  | '/discover'
  | '/memories'
  | '/live'
  | '/daygi'
  | '/ai-director'
  | '/explore'
  | '/plan-for-me'
  | '/trip-builder'
  | '/trip-preview'
  | '/my-trip'
  | '/my-trip/day'
  | '/my-trip/activity'
  | '/bookings'
  | '/quick-book'
  | '/book-now'
  | '/food'
  | '/hotels'
  | '/transfers'
  | '/transfers/local'
  | '/transfers/intercity'
  | '/help'
  | '/change-recovery'
  | '/departure'
  | '/post-trip'
  | '/profile'
  | '/favorites'
  | '/ops-console'
  | '/supplier-portal'
  | '/market-intelligence'
  | '/admin/content'
  | '/rentals-page'
  | '/accommodations'
  | '/hotels'
  | '/arrive'
  | '/first-two-hours'
  | '/auth/sign-in'
  | '/auth/sign-up'
  | '/auth/forgot-password'
  | '/auth/verify'
  | '/auth/callback'
  | '/programs'
  | '/experiences'
  | '/about'
  | '/faq'
  | '/travel-guides'
  | '/listings'
  | '/restaurants'
  | '/hotels'
  | '/hotels/checkout'
  | '/hotels/stays'
  | '/rentals'
  | '/attractions'
  | '/cities'
  | '/parties'
  | '/parties/admin'
  | '/preview'
  | '/design'
  | '/404'
  | '/stays'
  | '/contact';

export interface FoodOrderItem {
  id: string;
  restaurantName: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  status: 'preparing' | 'picked_up' | 'on_the_way' | 'delivered';
  placedTime: string;
  estimatedDelivery: string;
  deliveryAddress: string;
}

export interface NearMeItem {
  id: string;
  name: string;
  nameAr?: string;
  category: 'food' | 'coffee' | 'beach' | 'experience' | 'nightlife';
  distance?: string;
  walkMinutes?: number;
  priceLevel: '$' | '$$' | '$$$';
  basePriceEGP?: number;
  skuId?: string;
  serviceType?: string;
  rating?: number;
  reviewsCount?: number;
  tag: string;
  tagAr?: string;
  image?: string;
  description: string;
  descriptionAr?: string;
  location: string;
  locationAr?: string;
  openHours: string;
  openHoursAr?: string;
  bestFor: string;
  bestForAr?: string;
}

export interface PassportBadge {
  id: string;
  title: string;
  titleAr: string;
  category: string;
  icon: string;
  unlocked: boolean;
  unlockedDate?: string;
  description: string;
  descriptionAr: string;
  xpPoints: number;
}

export interface TripCrewMember {
  id: string;
  name: string;
  avatar: string;
  role: 'Organizer' | 'Co-Traveler';
  status: 'Ready' | 'In Dahab';
  activityVotes: { [activityId: string]: 'love' | 'thumbs_up' | 'pass' };
}
