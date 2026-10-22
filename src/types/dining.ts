/**
 * Dining order types.
 *
 * Separate from server/db/schema.ts on purpose: the server entity is the
 * persistence shape (whole rows, optional-by-nothing, snake_case-free), while
 * this is the wire shape the client receives from /api/dining. Keeping them
 * separate is the same discipline the rest of the codebase uses — the client
 * has its own mirrors (src/shared/types/*) rather than importing server modules
 * into the bundle, and importing server/db/schema.ts would drag better-sqlite3
 * types and the whole persistence vocabulary into the SPA's type graph.
 *
 * What is deliberately NOT here: a client-side price. Every figure below comes
 * from a server quote or a persisted order, never from the browser. The UI
 * renders what it is told; it never recomputes a total, because a cart total
 * computed client-side is the exact number a tampered client sends back.
 */

export type DiningOrderStatus =
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'FAILED';

export type DiningOrderFulfillment = 'DELIVERY' | 'PICKUP';

export type DiningMenuItemCategory =
  | 'breakfast'
  | 'mains'
  | 'grill'
  | 'seafood'
  | 'street_food'
  | 'bakery'
  | 'desserts'
  | 'drinks';

export interface DiningMenuItem {
  id: string;
  venueId: string;
  nameEn: string;
  nameAr: string;
  category: DiningMenuItemCategory;
  descriptionEn?: string;
  descriptionAr?: string;
  priceEGP: number;
  dietary: Array<'vegan' | 'vegetarian' | 'halal'>;
  available: boolean;
  prepMinutes?: number;
  sortOrder: number;
}

/** What one kitchen charges to drop in one zone. */
export interface DiningVenueDeliveryZone {
  zoneId: string;
  labelEn: string;
  labelAr: string;
  latitude: number;
  longitude: number;
  feeEGP: number;
  etaMinutes: number;
}

/** Enough to decide "can they reach me, and for how much" on a card. */
export interface DiningVenueDeliverySummary {
  acceptsDelivery: boolean;
  minOrderEGP: number;
  prepMinutes?: number;
}

/** The list row: a venue that can actually take an order. */
export interface DiningVenueSummary {
  id: string;
  slug?: string;
  nameEn: string;
  nameAr: string;
  areaId: string;
  coordinates?: { lat: number; lng: number };
  cuisine: string[];
  priceBand: string;
  rating?: number;
  reviewCount?: number;
  coverImageUrl?: string;
  dietaryOptions?: {
    vegan: boolean;
    vegetarian: boolean;
    halal: boolean;
    freshSeafoodCatch: boolean;
  };
  openingHours: string;
  wifiNomadFriendly: boolean;
  averageMealPriceEGP?: number;
  /** Dishes available right now — a venue with 0 is not worth tapping into. */
  itemCount: number;
  cheapestDishEGP: number | null;
  delivery: DiningVenueDeliverySummary;
}

/** The detail row, with the menu attached. */
export interface DiningVenueDetail extends DiningVenueSummary {
  areaName?: string;
  areaNameAr?: string;
  cuisineAr?: string[];
  seatingStyle?: string;
  phone?: string;
  openingHoursAr?: string;
  prepMinutes?: number;
}

/** A reservation settles through the existing hold/checkout spine. */
export interface DiningTableBooking {
  skuId: string;
  basePriceEGP: number;
  maxCapacityPerSlot: number;
  timeSlots: string[] | undefined;
  cancellationPolicyHours: number;
}

export interface DiningVenueMenuResponse {
  venue: DiningVenueDetail;
  menu: DiningMenuItem[];
  deliveryZones: DiningVenueDeliveryZone[];
  tableBooking: DiningTableBooking | null;
}

export interface DiningDeliveryZonesResponse {
  acceptsDelivery: boolean;
  minOrderEGP: number;
  zones: DiningVenueDeliveryZone[];
  nearestZone?: DiningVenueDeliveryZone & { distanceKm: number } | null;
  /** Present when a coordinate was supplied; false when the nearest zone is
   *  one this kitchen does not serve. */
  resolvable?: boolean;
}

export interface DiningOrderLine {
  menuItemId: string;
  nameEn: string;
  nameAr: string;
  quantity: number;
  unitPriceEGP: number;
  lineTotalEGP: number;
  notes?: string;
}

export interface DiningPriceBreakdown {
  subtotalEGP: number;
  deliveryFeeEGP: number;
  serviceFeeEGP: number;
  totalEGP: number;
  currency: 'EGP';
}

export interface DiningOrderDeliveryLocation {
  zoneId: string;
  labelEn: string;
  labelAr: string;
  latitude: number;
  longitude: number;
  addressText?: string;
  source: 'geo' | 'manual' | 'reverse_geocoded';
}

export interface DiningOrder {
  id: string;
  orderRef: string;
  venueId: string;
  /** The kitchen behind the order, resolved live by the server. Undefined only
   *  when the venue has since been removed — the client then shows the order
   *  reference rather than guessing a name from the id. */
  venue?: { nameEn: string; nameAr: string; slug?: string };
  userId: string;
  supplierId?: string;
  status: DiningOrderStatus;
  fulfillment: DiningOrderFulfillment;
  lines: DiningOrderLine[];
  priceBreakdown: DiningPriceBreakdown;
  deliveryLocation?: DiningOrderDeliveryLocation;
  etaMinutes?: number;
  promisedAt?: string;
  notes?: string;
  paymentMethod: 'CASH_ON_ARRIVAL';
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** A refusal the server returned instead of a quote. */
export interface DiningQuoteRefusal {
  code:
    | 'NO_DELIVERY'
    | 'ZONE_NOT_SERVED'
    | 'BELOW_MINIMUM'
    | 'TOO_FAR';
  message: string;
}

export interface DiningQuote {
  venueId: string;
  venueSlug?: string;
  venueNameEn: string;
  venueNameAr: string;
  fulfillment: DiningOrderFulfillment;
  lines: DiningOrderLine[];
  priceBreakdown: DiningPriceBreakdown;
  deliveryLocation?: Omit<DiningOrderDeliveryLocation, 'addressText'>;
  etaMinutes?: number;
  promisedAt?: string;
  refusal?: DiningQuoteRefusal;
}

/** One requested dish, before the server has priced it. */
export interface DiningCartLineInput {
  menuItemId: string;
  quantity: number;
  notes?: string;
}

/**
 * Where the food goes. Held on the client so a return visit does not re-ask,
 * and sent as EITHER a zone or a coordinate — never as a free-text address the
 * server would have to guess a zone from.
 */
export interface DeliveryLocationDraft {
  zoneId?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  source: 'geo' | 'manual' | 'reverse_geocoded';
}