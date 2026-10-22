/**
 * The verticals the commerce engine sells. Mirrors CommerceServiceType in
 * server/db/schema.ts — 'wellness' and 'dining' arrived with the Book Now
 * catalogue's in-destination services, which have real inventory now.
 */
export type CommerceServiceType =
  | 'transfer'
  | 'diving'
  | 'hotel'
  | 'safari'
  | 'wellness'
  | 'dining'
  | 'rental';

export type PaymentState =
  | 'INITIATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'CAPTURED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'DISPUTED';

export type LedgerEntryType =
  | 'HOLD_ESCROW'
  | 'PAYMENT_CAPTURED'
  | 'SUPPLIER_PAYOUT'
  | 'PLATFORM_COMMISSION'
  /** Returns the platform's fee to escrow when the underlying payment is
   *  refunded. Without it a full refund leaves escrow short by the commission. */
  | 'COMMISSION_REVERSAL'
  | 'REFUND_ISSUED'
  | 'RECOVERY_CREDIT'
  | 'ADJUSTMENT';

/**
 * A confirmed booking as shown to the traveler.
 *
 * Canonical home for what was duplicated in src/types.ts and
 * src/components/mytrip/myTripData.ts with different status unions.
 */
export interface ConfirmedBookingItem {
  id: string;
  serviceType: CommerceServiceType;
  title: string;
  subtitle: string;
  details: string;
  datesOrTime: string;
  priceEGP: number;
  provider: string;
  confirmationCode: string;
  status: 'Confirmed ✓' | 'Pending' | 'Changed';
  location: string;
  iconType: 'building' | 'car' | 'waves' | 'compass' | 'sparkles' | 'utensils' | 'bike';
  phone?: string;
  included?: string[];
  cancellationPolicy?: string;
  /** Set on a future-ride price lock. The card draws the four-step timeline. */
  futureRide?: { driverAssigned: boolean };
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  idempotencyKey: string;
  bookingRef: string;
  tripId: string;
  type: LedgerEntryType;
  amountEGP: number;
  debitAccount: string;
  creditAccount: string;
  currency: 'EGP' | 'USD' | 'EUR';
  timestamp: string;
  status: 'SETTLED' | 'PENDING' | 'VOIDED';
  signatureHash: string;
  /**
   * Contextual detail attached to the entry. The named keys below are the
   * conventional ones; callers legitimately attach extra context (payment
   * method, gateway, supplier name, pickup location...).
   *
   * The server's LedgerEntryEntity.metadata is `Record<string, any>`, so the
   * closed shape here was narrower than the contract it mirrors and rejected
   * valid call sites.
   */
  metadata?: {
    serviceType?: string;
    supplierId?: string;
    travelerName?: string;
    reason?: string;
    [key: string]: unknown;
  };
}

export interface SupplierEntity {
  id: string;
  businessName: string;
  businessNameAr?: string;
  category?: 'transfer' | 'diving' | 'hotel' | 'safari' | 'restaurant' | 'logistics';
  vertical?: string;
  tier?: 'Tier 1 Certified' | 'Tier 2 Certified' | 'Vetted Local Partner';
  status: 'Active' | 'Pending_Verification' | 'Suspended' | string;
  leadContact?: string;
  ownerName?: string;
  phone: string;
  email: string;
  area?: string;
  location?: string;
  licenseNumber?: string;
  cdwsLicenseNumber?: string;
  cdwsExpiryDate?: string;
  rating: number;
  reviewCount: number;
  onboardedAt?: string;
  approvedBy?: string;
  commissionRate?: number;
  payoutMethod?: string;
  payoutDetails?: Record<string, any>;
  payoutAccountNumber?: string;
  whatsappNumber?: string;
  metadata?: Record<string, any>;
}

export interface ProductSkuEntity {
  id: string;
  supplierId: string;
  serviceType: CommerceServiceType | string;
  title: string;
  titleAr: string;
  description: string;
  routeFrom?: string;
  routeTo?: string;
  durationMinutes?: number;
  basePriceEGP: number;
  currency: 'EGP' | 'USD' | 'EUR';
  maxCapacityPerSlot: number;
  active: boolean;
  includedItems?: string[];
  cancellationPolicyHours?: number;
  pricingBasis?: 'per_person' | 'per_stay' | 'per_vehicle';
  timeSlots?: string[];
  descriptionAr?: string;
  includedItemsAr?: string[];
  routeFromAr?: string;
}

export interface InventorySlotEntity {
  id: string;
  skuId: string;
  date: string;
  timeSlot: string;
  totalCapacity: number;
  reservedCapacity: number;
  heldCapacity: number;
  status: 'OPEN' | 'SOLD_OUT' | 'LOCKED';
}

export interface HoldEntity {
  id: string;
  holdToken: string;
  skuId: string;
  tripId: string;
  travelerId: string;
  date: string;
  timeSlot: string;
  units: number;
  amountEGP: number;
  expiresAt: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CONVERTED' | 'RELEASED';
  idempotencyKey: string;
  createdAt: string;
}

/**
 * A booking as the server actually stores and returns it.
 *
 * This replaces an earlier `BookingEntity` declared here that no component ever
 * used and that shared almost no fields with the server's record — it promised
 * `referenceCode`, `voucherCode`, `qrPayload`, `commissionRate` and a
 * `titleAr`, none of which exist on `BookingEntity` in server/db/schema.ts.
 * Two types with one name, one of them fictional, is what Phase B spent most of
 * its effort undoing; this one mirrors the wire shape of
 * GET /api/trips/:tripId/bookings and nothing else.
 */
/** The supplier summary returned alongside a trip's bookings and items. */
export interface BookingSupplierSummary {
  id: string;
  businessName: string;
  businessNameAr: string;
  phone: string;
  whatsapp?: string;
  area: string;
  tier: string;
}

export interface TripBookingRecord {
  id: string;
  bookingRef: string;
  tripId: string;
  tripItemId?: string;
  supplierId: string;
  skuId: string;
  serviceType: CommerceServiceType;
  amountEGP: number;
  paymentState: PaymentState;
  supplierState:
    | 'PENDING_CONFIRMATION'
    | 'CONFIRMED'
    | 'ASSIGNED'
    | 'DISPATCHED'
    | 'EN_ROUTE'
    | 'IN_PROGRESS'
    | 'ARRIVED'
    | 'COMPLETED'
    | 'REJECTED'
    | 'CANCELLED';
  travelerName: string;
  travelerPhone: string;
  travelerEmail: string;
  passengersCount: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  scheduledDate: string;
  scheduledTime: string;
  flightNumber?: string;
  specialRequests?: string;
  confirmationCode: string;
  hubQuote?: { asap: boolean };
  assignedResource?: {
    driverName?: string;
    driverNameAr?: string;
    driverPhone?: string;
    vehicleModel?: string;
    vehiclePlate?: string;
    guideName?: string;
    guidePhone?: string;
    diveSite?: string;
    expeditionRoute?: string;
  };
  createdAt: string;
  updatedAt: string;
  /** Null when the supplier record has been removed; the booking still stands. */
  supplier: BookingSupplierSummary | null;
}

export interface PaymentEntity {
  id: string;
  bookingRef: string;
  tripId: string;
  travelerId: string;
  amountEGP: number;
  currency: 'EGP' | 'USD' | 'EUR';
  gateway: 'Paymob' | 'VodafoneCash' | 'InstaPay' | 'CashOnArrival' | 'Direct';
  gatewayTransactionId?: string;
  state: PaymentState;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransferTrackingRecord {
  bookingId: string;
  referenceCode: string;
  driverName: string;
  driverNameAr?: string;
  driverPhone: string;
  vehicleModel: string;
  vehiclePlate: string;
  pickupLocation: string;
  dropoffLocation: string;
  scheduledTime: string;
  flightNumber?: string;
  flightStatus?: 'ON_TIME' | 'DELAYED' | 'LANDED';
  status: 'ASSIGNED' | 'DISPATCHED' | 'AT_AIRPORT' | 'PASSENGER_PICKED_UP' | 'COMPLETED';
  lastGpsUpdate: string;
}

export type VerificationLevel =
  | 'SOURCE_REPORTED'
  | 'WEB_CONFIRMED'
  | 'SUPPLIER_CONFIRMED'
  | 'REGULATORY_VERIFIED'
  | 'FULLY_VERIFIED'
  | 'EXPIRED'
  | 'SUSPENDED';

export type PricingBasis =
  | 'PER_PERSON'
  | 'PER_GROUP'
  | 'PER_BOOKING'
  | 'SINGLE'
  | 'DOUBLE'
  | 'SNGL_DBL'
  | 'VIP_PER_PERSON'
  | 'STARTING_FROM'
  | 'PRICE_ON_INQUIRY'
  | 'INQUIRY'
  | 'UNKNOWN';

export type FreshnessStatus = 'CURRENT' | 'RECENT' | 'STALE' | 'UNKNOWN';

export type LocalCommerceSourceType =
  | 'USER_PROVIDED_IMAGE'
  | 'REGULATORY'
  | 'SUPPLIER_OWNED'
  | 'COMMERCIAL_MARKETPLACE'
  | 'LOCAL_DIRECTORY'
  | 'COMMUNITY'
  | 'AUTHORITATIVE';

export interface RawSupplierSourceEntity {
  id: string;
  sourceType: LocalCommerceSourceType;
  sourceReference: string;
  sourceUrl?: string;
  sourceImage?: string;
  sourceCapturedAt?: string;
  supplierNameRaw: string;
  supplierNameArRaw?: string;
  contactRaw?: string;
  whatsappRaw?: string;
  socialRaw?: string;
  addressRaw?: string;
  bookingInstructionsRaw?: string;
  extractedConfidence: number;
  verificationStatus: VerificationLevel;
  verifiedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface RawOfferSourceEntity {
  id: string;
  rawSupplierSourceId: string;
  sourceType: LocalCommerceSourceType;
  sourceReference: string;
  supplierNameRaw: string;
  activityNameRaw: string;
  activityNameArRaw?: string;
  destinationRaw?: string;
  priceRaw: string;
  currencyRaw: string;
  pricingBasisRaw?: string;
  singlePriceRaw?: string;
  doublePriceRaw?: string;
  vipPriceRaw?: string;
  scheduleRaw?: string;
  durationRaw?: string;
  inclusionsRaw?: string[];
  exclusionsRaw?: string[];
  transportRaw?: string;
  equipmentRaw?: string;
  bookingConditionsRaw?: string;
  extractedConfidence: number;
  verificationStatus: VerificationLevel;
  notes?: string;
  createdAt: string;
}

export interface SupplierOfferEntity {
  id: string;
  supplierId: string;
  activityId: string;
  canonicalCategory: string;
  sourceActivityName: string;
  titleAr: string;
  titleEn: string;
  price: number;
  currency: 'EGP' | 'USD' | 'EUR';
  pricingBasis: PricingBasis;
  singlePrice?: number;
  doublePrice?: number;
  vipPrice?: number;
  groupPrice?: number;
  departureTime?: string;
  returnTime?: string;
  duration?: string;
  durationMinutes?: number;
  includes: string[];
  excludes: string[];
  transportType?: string;
  equipmentProvided?: string;
  bookingChannels: string[];
  sourceType: LocalCommerceSourceType;
  sourceReferences: string[];
  sourceImage?: string;
  sourceCapturedAt?: string;
  verificationStatus: VerificationLevel;
  verificationSource?: string;
  verifiedAt?: string;
  sourceFreshness: FreshnessStatus;
  extractionConfidence: number;
  active: boolean;
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketPriceStatEntity {
  activityId: string;
  activityNameEn: string;
  activityNameAr: string;
  currency: 'EGP';
  lowestObservedPrice: number;
  highestObservedPrice: number;
  medianObservedPrice: number;
  observedOfferCount: number;
  priceRange: string;
  offers: Array<{
    offerId: string;
    supplierId: string;
    supplierName: string;
    price: number;
    pricingBasis: PricingBasis;
    verificationStatus: VerificationLevel;
    freshnessStatus: FreshnessStatus;
  }>;
  label: 'OBSERVED_MARKET_DATA';
  lastCalculatedAt: string;
}

// ------------------------------------------------------------------ hotels
// Wire shapes for GET /api/hotels and GET /api/hotels/:slug. They mirror
// HotelEntity in server/db/schema.ts plus the server-side enrichments
// (packageTotalEGP, bookable) that a listing page needs.

export type HotelCategory = 'budget' | 'mid-range' | 'boutique' | 'resort';
export type HotelPriceBand = 'budget' | 'moderate' | 'premium';

export interface HotelEntity {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  category: HotelCategory;
  priceBand: HotelPriceBand;
  area: string;
  areaName: string;
  areaNameAr: string;
  rating: number;
  reviewCount: number;
  ratingSource?: string;
  typeChips: string[];
  typeChipsAr: string[];
  tagline: string;
  taglineAr: string;
  description: string;
  descriptionAr: string;
  amenities: string[];
  amenitiesAr: string[];
  perNightEGP: number;
  packageNights: number;
  rooms: number;
  bestFor: string;
  bestForAr: string;
  note: string;
  noteAr: string;
  coordinates?: [number, number];
  skuId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  /** 5-night package cost = perNightEGP x packageNights. */
  packageTotalEGP: number;
  /** Resolved by the server so the card reflects real sellable inventory. */
  bookable: {
    skuId: string;
    serviceType: string;
    basePriceEGP: number;
    currency: string;
    supplierId: string;
    maxCapacityPerSlot: number;
    cancellationPolicyHours?: number;
  } | null;
}

export interface HotelAreaGuideEntry {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  spots?: string[];
  spotsAr?: string[];
}

export interface HotelCatalogueStats {
  total: number;
  averageRating: number;
  totalReviews: number;
  priceBands: string[];
  updatedLabel?: string;
}

export interface HotelCatalogueResponse {
  hotels: HotelEntity[];
  areas: HotelAreaGuideEntry[];
  stats: HotelCatalogueStats;
  disclaimer?: { en: string; ar: string };
  filters: { categories: HotelCategory[]; priceBands: HotelPriceBand[] };
}

export interface HotelDetailSku {
  id: string;
  title: string;
  titleAr: string;
  basePriceEGP: number;
  maxCapacityPerSlot: number;
  active: boolean;
  serviceType: string;
}

export interface HotelDetailSupplier {
  id: string;
  businessName: string;
  businessNameAr?: string;
  area?: string;
  city?: string;
  coordinates?: { lat: number; lng: number };
  rating?: number;
  reviewCount?: number;
}

export interface HotelDetailResponse {
  hotel: HotelEntity;
  sku: HotelDetailSku | null;
  supplier: HotelDetailSupplier | null;
  areaGuide: HotelAreaGuideEntry | null;
  disclaimer?: { en: string; ar: string };
}

// ---------------------------------------------------------------------------
// Accommodations — generalized successor to the hotels shapes above. Mirrors
// AccommodationEntity in server/db/schema.ts. /api/hotels keeps working as a
// compatibility shim over this same data (see server/api/hotelRoutes.ts).
// ---------------------------------------------------------------------------

export type PropertyType =
  | 'hotel' | 'hostel' | 'apartment' | 'studio' | 'villa'
  | 'guesthouse' | 'camp' | 'eco-lodge' | 'boutique-hotel' | 'resort' | 'chalet';

export type PropertySourceType = 'WHATSAPP' | 'INSTAGRAM' | 'WEBSITE' | 'BOOKING_COM' | 'AIRBNB' | 'OTHER';

export interface PropertySourceEntity {
  id: string;
  accommodationId: string;
  sourceType: PropertySourceType;
  url: string;
  label?: string;
  displayOrder: number;
  active: boolean;
}

export interface AccommodationEntity {
  id: string;
  slug: string;
  name: string;
  nameAr: string;
  propertyType: PropertyType;
  category: HotelCategory;
  priceBand: HotelPriceBand;
  areaId: string;
  area: string;
  areaName: string;
  areaNameAr: string;
  rating: number;
  reviewCount: number;
  ratingSource?: string;
  typeChips: string[];
  typeChipsAr: string[];
  tagline: string;
  taglineAr: string;
  description: string;
  descriptionAr: string;
  amenities: string[];
  amenitiesAr: string[];
  perNightEGP: number;
  packageNights: number;
  rooms: number;
  maxGuests: number;
  bestFor: string;
  bestForAr: string;
  note: string;
  noteAr: string;
  latitude?: number;
  longitude?: number;
  skuId: string;
  active: boolean;
  featured: boolean;
  packageTotalEGP: number;
  bookable: { skuId: string } | null;
  /** CMS catalog-binding overlays (cover/gallery), present when published. */
  coverImageUrl?: string;
  coverImageFocal?: { x: number; y: number };
  coverImageSrcSet?: string;
  galleryImageUrls?: string[];
}

export interface AccommodationSearchFilters {
  q?: string;
  propertyTypes?: PropertyType[];
  categories?: HotelCategory[];
  priceBands?: HotelPriceBand[];
  areaIds?: string[];
  minRating?: number;
  maxPerNightEGP?: number;
  guests?: number;
  mustHaveAmenities?: string[];
  niceToHaveAmenities?: string[];
  sort?: 'relevance' | 'rating' | 'price_asc' | 'price_desc';
}

export interface AccommodationCatalogueResponse {
  accommodations: AccommodationEntity[];
  areas: HotelAreaGuideEntry[];
  stats: { total: number; averageRating: number; totalReviews: number; updatedLabel?: string };
  disclaimer?: { en: string; ar: string };
  filters: { propertyTypes: PropertyType[]; categories: HotelCategory[]; priceBands: HotelPriceBand[] };
}

export interface AccommodationDetailResponse {
  accommodation: AccommodationEntity;
  sku: HotelDetailSku | null;
  supplier: HotelDetailSupplier | null;
  areaGuide: HotelAreaGuideEntry | null;
  sources: PropertySourceEntity[];
  disclaimer?: { en: string; ar: string };
}

export interface AccommodationSearchIntentResult {
  filters: AccommodationSearchFilters;
  confidence: number;
  source: 'gemini' | 'fallback';
}

// ---------------------------------------------------------------------------
// Rentals (bikes MVP — the generic rental domain)
// ---------------------------------------------------------------------------

export type RentalCategory = 'bike' | 'e-bike';

export interface RentalDeliveryZone {
  zoneId: string;
  feeEGP: number;
}

export interface RentalExtra {
  id: string;
  name: string;
  nameAr: string;
  priceEGP: number;
  /** FLAT = once per booking; PER_DAY = price x span days. */
  pricingBasis: 'FLAT' | 'PER_DAY';
  active: boolean;
}

/** The listing view the server builds in rentalService.getListingView. */
export interface RentalListingView {
  id: string;
  slug: string;
  supplierId: string;
  skuId: string;
  category: RentalCategory;
  subcategory: string;
  name: string;
  nameAr: string;
  tagline: string;
  taglineAr: string;
  description: string;
  descriptionAr: string;
  features: string[];
  featuresAr: string[];
  specs: Record<string, string | number | boolean>;
  images: string[];
  /** Fleet size — the availability engine subtracts committed + blocked per day. */
  quantity: number;
  dailyRateEGP: number;
  weeklyRateEGP?: number;
  multiDayMinDays?: number;
  multiDayDiscountPercent?: number;
  /** Refundable deposit; recorded at booking, settled manually at return in MVP. */
  depositEGP: number;
  pickupZoneId: string;
  deliveryZones: RentalDeliveryZone[];
  pickupMode: 'SHOP' | 'BOTH';
  rating?: number;
  reviewCount?: number;
  featured: boolean;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  active: boolean;
  cancellationPolicyHours: number;
  policies: { en: string; ar: string };
  createdAt: string;
  updatedAt: string;
  /** Resolved against real sellable inventory. */
  bookable: boolean;
  sku: {
    id: string;
    title: string;
    titleAr: string;
    basePriceEGP: number;
    maxCapacityPerSlot: number;
    active: boolean;
    serviceType: string;
  } | null;
  supplier: {
    id: string;
    businessName: string;
    businessNameAr?: string;
    area?: string;
    address?: string;
    city?: string;
    rating?: number;
    reviewCount?: number;
    whatsapp?: string;
    phone?: string;
  } | null;
  extras: RentalExtra[];
  maintenanceBlocks: RentalMaintenanceBlock[];
}

export interface RentalDayAvailability {
  date: string;
  available: number;
  committed: number;
  blocked: number;
}

export interface RentalAvailabilityResult {
  listingId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  available: boolean;
  windowAvailable: number;
  availablePerDay: RentalDayAvailability[];
  reasonDay?: string;
}

export interface RentalPriceBreakdown {
  days: number;
  dailyRateEGP: number;
  baseEGP: number;
  discountEGP: number;
  extrasEGP: number;
  deliveryEGP: number;
  /** Refundable — recorded at booking, not part of the payable total. */
  depositEGP: number;
  totalEGP: number;
}

export interface RentalQuoteExtra {
  extraId: string;
  name: string;
  nameAr: string;
  priceEGP: number;
  count: number;
}

export interface RentalQuoteResult {
  listingId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  breakdown: RentalPriceBreakdown;
  extras: RentalQuoteExtra[];
  deliveryMode: 'PICKUP' | 'DELIVERY';
  deliveryZoneId?: string;
  deliveryFeeEGP: number;
  cancellationPolicyHours: number;
}

export type RentalBookingStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'READY_FOR_PICKUP'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'RETURNED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export interface RentalBookingView {
  id: string;
  bookingRef: string;
  listingId: string;
  skuId: string;
  supplierId: string;
  tripId: string;
  userId: string;
  travelerName: string;
  travelerPhone: string;
  travelerEmail: string;
  startDate: string;
  endDate: string;
  quantity: number;
  status: RentalBookingStatus;
  paymentState: string;
  holdToken?: string;
  priceBreakdown: RentalPriceBreakdown;
  deliveryMode: 'PICKUP' | 'DELIVERY';
  deliveryZoneId?: string;
  deliveryAddress?: string;
  pickupTime?: string;
  extras: { extraId: string; name: string; nameAr: string; priceEGP: number; count: number }[];
  depositStatus: 'RECORDED' | 'RETURNED' | 'DEDUCTED';
  depositDeductionEGP?: number;
  damageReport?: string;
  lateFeeEGP?: number;
  notes?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  listing?: Pick<RentalListingView, 'id' | 'slug' | 'name' | 'nameAr' | 'images' | 'dailyRateEGP' | 'depositEGP' | 'category' | 'pickupZoneId'> & { supplierName?: string; supplierNameAr?: string };
}

export interface RentalCatalogueStats {
  total: number;
  averageRating: number;
}

export interface RentalZone {
  id: string;
  name: string;
  nameAr: string;
}

export interface RentalCatalogueResponse {
  rentals: RentalListingView[];
  categories: RentalCategory[];
  zones: RentalZone[];
  stats: RentalCatalogueStats;
  filters: { sortOptions: ('featured' | 'price_asc' | 'price_desc' | 'rating')[] };
}

export interface RentalDetailResponse {
  rental: RentalListingView;
  zones: RentalZone[];
  availability: RentalAvailabilityResult | null;
}

export interface RentalMaintenanceBlock {
  id: string;
  listingId: string;
  startDate: string;
  endDate: string;
  quantityBlocked: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}
