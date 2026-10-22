export type JourneyStage =
  | 'discover'
  | 'plan'
  | 'preview'
  | 'book'
  | 'prepare'
  | 'arrive'
  | 'experience'
  | 'spontaneous'
  | 'food'
  | 'recovery'
  | 'help'
  | 'departure'
  | 'post_trip';

export interface TripEntity {
  id: string;
  userId: string;
  title: string;
  status: 'DRAFT' | 'PLANNED' | 'CONFIRMED' | 'IN_DESTINATION' | 'COMPLETED' | 'CANCELLED';
  lengthDays: number;
  travelersCount: number;
  budget: 'Budget' | 'Moderate' | 'Premium';
  pace: 'Relaxed' | 'Balanced' | 'Active';
  interests: string[];
  startDate?: string;
  endDate?: string;
  totalEstimatedEGP: number;
  totalPaidEGP: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripItemEntity {
  id: string;
  tripId: string;
  serviceType: 'hotel' | 'transfer' | 'diving' | 'safari' | 'activity' | 'food' | string;
  skuId: string;
  title: string;
  dayNumber: number;
  timeSlot?: string;
  priceEGP: number;
  status: 'SUGGESTED' | 'HELD' | 'BOOKED' | 'CONFIRMED' | 'CANCELLED';
  bookingId?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface TripDayActivity {
  id: string;
  userId?: string;
  dayNumber: number;
  time: string;
  title: string;
  location?: string;
  status: string;
  notes?: string;
  updatedAt?: string;
}

/**
 * Canonical itinerary activity.
 *
 * This interface previously existed three times — here, in src/types.ts, and in
 * src/components/mytrip/myTripData.ts — and the copies had drifted apart. The
 * myTripData copy carried six fields the others lacked and a different status
 * union, which is why `TimelineDay[]` was not assignable to `TimelineDay[]`.
 * src/types.ts now re-exports from here, and myTripData imports from here.
 *
 * The unions below are the union of what the seed data actually contains and
 * what components actually assign — widened to fit reality, not to silence
 * errors.
 */
export type TimelineActivityType =
  | 'Arrival'
  | 'Transfer'
  | 'Accommodation'
  | 'Exploration'
  | 'Dining'
  | 'Activity'
  | 'Leisure'
  | 'Cafe'
  | 'Experience'
  | 'Culture';

export type TimelineActivityStatus =
  | 'Booked ✓'
  | 'Added ✓'
  | 'Suggested'
  | 'Free Time'
  | 'Pending'
  | 'Confirmed';

export interface TimelineActivity {
  id: string;
  time: string;
  title: string;
  type: TimelineActivityType;
  status: TimelineActivityStatus;
  /**
   * The commerce product behind this line, when there is one.
   *
   * This is what makes an itinerary line bookable: the checkout matches an
   * unbooked trip item to its booking **by skuId**, so a line carrying one can
   * be turned into a real booking and a line without one cannot. It was absent
   * entirely, which is why "confirm" on the timeline could only mint a fake
   * reference locally.
   */
  skuId?: string;
  serviceType?: string;
  location?: string;
  notes?: string;
  duration?: string;
  priceEGP?: number;
  meetingPoint?: string;
  whatToBring?: string[];
  guideName?: string;
  // Fields that previously existed only on the myTripData copy but are read by
  // TripTimeline and the MyTrip section components.
  bookingRef?: string;
  provider?: string;
  inclusions?: string[];
  timeOfDay?: 'morning' | 'midday' | 'afternoon' | 'golden_hour' | 'evening' | 'night';
  isNextUp?: boolean;
  coordinates?: string;
}

export interface TimelineDay {
  dayNumber: number;
  dateStr: string;
  title: string;
  subtitle: string;
  activities: TimelineActivity[];
}

/**
 * A trip item as GET /api/trips/:tripId/bookings returns it: the stored item
 * plus the supplier resolved through its SKU.
 *
 * The item is the spine of what the traveler booked. Its booking record may be
 * missing — the seeded trip has two such items — and the views must still show
 * the item rather than silently dropping it.
 */
export interface TripItemWithSupplier extends TripItemEntity {
  /** The booked SKU's Arabic title, when the catalogue has one. */
  titleAr?: string;
  durationMinutes?: number;
  supplier: import('./commerce').BookingSupplierSummary | null;
}
