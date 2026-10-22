import type { DiningPriceBand } from '../priceBand';

export type TemporalState = 'CURRENT' | 'HISTORICAL' | 'FUTURE' | 'SEASONAL' | 'EXPIRED' | 'UNKNOWN';

export type SourceType = 
  | 'AUTHORITATIVE' 
  | 'APPROVED_OPERATIONAL' 
  | 'VERIFIED_LOCAL' 
  | 'GOOGLE_MAPS' 
  | 'MARKETPLACE' 
  | 'COMMUNITY' 
  | 'INFERENCE';

export type ConfidenceTier = 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

export type ConflictClassification = 'BENIGN' | 'TEMPORAL' | 'SCOPE_DIFFERENCE' | 'TRUE_CONFLICT' | 'UNRESOLVED';

export type EntityResolutionMatchStatus = 'EXACT' | 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'DISTINCT' | 'DUPLICATE' | 'UNKNOWN';

export type DkosAccessMethodType = 'WALK' | 'SHORE' | 'BOAT' | 'VEHICLE' | '4X4' | 'CAMEL' | 'HIKE' | 'MIXED' | 'UNKNOWN';

export type BookNowEligibility = 'BOOK_NOW' | 'REQUEST_NOW' | 'DISCOVER_ONLY' | 'WALK_IN' | 'PLAN_LATER' | 'UNKNOWN';

export type BusinessOperationalStatus = 'OBSERVED' | 'CANDIDATE' | 'UNDER_REVIEW' | 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export type RuleCategory = 'GENERAL_TRAVEL_KNOWLEDGE' | 'REGULATORY' | 'SAFETY_CRITICAL';

export interface ResearchSourceRecord {
  id: string;
  name: string;
  sourceType: SourceType;
  authorityWeight: number; // 0.0 - 1.0
  publisher: string;
  documentRef?: string;
  url?: string;
  lastAudited: string;
  revalidationIntervalDays: number;
}

export interface EvidenceNode {
  id: string;
  factId: string;
  sourceId: string;
  claim: string;
  observedAt: string;
  verifiedAt: string;
  rawPayload?: any;
  confidence: number;
  authorityScore: number;
  independenceId: string;
  notes?: string;
}

export interface TemporalFact<T = any> {
  id: string;
  subjectId: string;
  subjectType: string;
  predicate: string;
  value: T;
  primarySourceId: string;
  sourceType: SourceType;
  observedAt: string;
  verifiedAt: string;
  validFrom: string;
  validUntil?: string;
  confidence: number;
  confidenceTier: ConfidenceTier;
  status: TemporalState;
  supersedesFactId?: string;
  supersededByFactId?: string;
  verificationOwner: string;
  notes?: string;
}

export interface ConflictSet {
  id: string;
  entityId: string;
  property: string;
  claimA: {
    value: any;
    sourceId: string;
    observedAt: string;
    authorityScore: number;
  };
  claimB: {
    value: any;
    sourceId: string;
    observedAt: string;
    authorityScore: number;
  };
  classification: ConflictClassification;
  explanation: string;
  resolvedValue?: any;
  resolvedAt?: string;
  resolvedBy?: string;
  status: 'OPEN' | 'RESOLVED' | 'AUTO_RECONCILED';
}

export interface SpatialCoordinates {
  lat: number;
  lng: number;
  zone: string;
  subArea?: string;
  precisionMeters?: number;
}

export interface KnowledgeEntity {
  id: string;
  canonicalName: string;
  canonicalNameAr: string;
  aliases: string[];
  entityType: 'PLACE' | 'REEF' | 'EXPEDITION' | 'VENUE' | 'SUPPLIER' | 'EMERGENCY' | 'ZONE';
  coordinates: SpatialCoordinates;
  bookNowEligibility: BookNowEligibility;
  operationalStatus: BusinessOperationalStatus;
  primarySourceId: string;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

/**
 * The destination knowledge the backend publishes at /api/dahab/*.
 *
 * These mirror PlaceEntity, ActivityDetailEntity and DiningVenueEntity in
 * server/db/schema.ts. They are declared here rather than imported from the
 * server because the dependency arrow must not point that way — the audit's
 * ARCH-4 — and because these are the *wire* shapes, which is a narrower
 * commitment than the storage shapes.
 *
 * The whole corpus — 17 places, 22 activities, the dining venues — was
 * reachable and unused: every page rendered its own hardcoded copy instead.
 */
export interface DahabPlace {
  id: string;
  nameEn: string;
  nameAr: string;
  aliases: string[];
  arabicNames: string[];
  areaId: string;
  category: string;
  /**
   * Null until a position is confirmed — the research import creates dive sites
   * from text rather than GPS (see server/db/research/importResearch.ts), and
   * /api/dahab/places publishes them as-is. Consumers that need lat/lng must
   * check for null; the maps skip unpositioned records.
   */
  coordinates: SpatialCoordinates | null;
  operationalStatus: BusinessOperationalStatus;
  descriptionEn: string;
  descriptionAr: string;
  /** When the record was last checked. Rendered instead of an invented rating. */
  verifiedAt: string;
}

/**
 * What it takes to actually sell an activity, resolved by the server from the
 * commerce catalogue. Null when the activity cannot be booked online.
 *
 * `basePriceEGP` is the SKU's price — the amount checkout charges — which is
 * not always the activity's own `basePriceEGP`. Show this one.
 */
export interface ResolvedBookability {
  skuId: string;
  serviceType: string;
  basePriceEGP: number;
  currency: string;
  supplierId: string;
  maxCapacityPerSlot: number;
  cancellationPolicyHours?: number;
  pricingBasis?: 'per_person' | 'per_stay' | 'per_vehicle';
  durationMinutes?: number;
  description?: string;
  descriptionAr?: string;
  includedItems?: string[];
  includedItemsAr?: string[];
  timeSlots?: string[];
  meetingPoint?: string;
  meetingPointAr?: string;
  supplierName?: string;
  supplierNameAr?: string;
}

export interface DahabActivity {
  id: string;
  /**
   * Set only when a real, sellable row exists in the commerce catalogue.
   *
   * Every value this field carried used to be a dangling reference — see
   * server/services/bookabilityReconciler — so prefer `bookable` over reading
   * this and `bookingMode` and inferring.
   */
  skuId?: string;
  bookable?: ResolvedBookability | null;
  titleEn: string;
  titleAr: string;
  category: 'diving' | 'safari' | 'water_sport' | 'wellness' | 'culture' | 'food';
  placeId: string;
  areaId: string;
  durationMinutes: number;
  accessMethod: DkosAccessMethodType;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  experienceLevelRequired: string;
  basePriceEGP: number;
  bookingMode: BookNowEligibility;
  supplierId?: string;
  seasonalityMonths: number[];
  environmentalSensitivities?: {
    maxWindKnots?: number;
    minWindKnots?: number;
    minVisibilityMeters?: number;
    requiresDaylight?: boolean;
  };
  dependencies?: string[];
  travelerFitPersonas?: string[];
  preparationTips: string[];
  preparationTipsAr: string[];
}

/**
 * One row of the Tripadvisor-style "Things to Do" catalogue
 * (GET /api/dahab/attractions), merged server-side from places, activities and
 * diving/safari suppliers.
 *
 * `rating`/`reviewCount` are only present when a real measurement exists
 * (supplier records) — nothing else in the corpus has one, and the UI renders
 * "no ratings yet" rather than inventing stars. `image` is a real photo of the
 * spot from the editorial gallery pool when a match exists, otherwise the card
 * renders a gradient.
 */
export interface DahabAttraction {
  id: string;
  slug: string;
  kind: 'sight' | 'activity' | 'experience';
  nameEn: string;
  nameAr: string;
  bucket: string;
  categoryLabelEn: string;
  categoryLabelAr: string;
  descriptionEn: string;
  descriptionAr: string;
  rating?: number;
  reviewCount?: number;
  durationMinutes?: number;
  difficulty?: string;
  priceEGP?: number;
  skuId?: string;
  bookable: boolean;
  areaId: string;
  areaLabelEn?: string;
  areaLabelAr?: string;
  coordinates?: { lat: number; lng: number };
  image?: string;
  tags: string[];
  contact?: { whatsapp?: string; phone?: string; website?: string; instagram?: string };
}

export interface AttractionCategory {
  id: string;
  labelEn: string;
  labelAr: string;
  count: number;
}

export interface DahabDiningVenue {
  id: string;
  nameEn: string;
  nameAr: string;
  areaId: string;
  coordinates: SpatialCoordinates;
  cuisine: string[];
  priceBand: DiningPriceBand;
  averageMealPriceEGP: number;
  seatingStyle: string;
  dietaryOptions: {
    vegan: boolean;
    vegetarian: boolean;
    halal: boolean;
    freshSeafoodCatch: boolean;
  };
  wifiNomadFriendly: boolean;
  openingHours: string;
  bookingEligibility: BookNowEligibility;
  supplierId?: string;
  /** Tripadvisor aggregate rating (out of 5), when imported. */
  rating?: number;
  reviewCount?: number;
  /** Self-hosted cover photo under public/images/restaurants/. */
  coverImageUrl?: string;
  phone?: string;
  cuisineAr?: string[];
  openingHoursAr?: string;
  /** Arabic area label, when the venue's seed stamped it. */
  areaNameAr?: string;
  areaName?: string;
}


/**
 * Editorial content served from /api/dahab/content/*.
 *
 * These lived inside the components that rendered them, so a copy change meant
 * a rebuild and a deploy. Declared here as the wire shapes, taken verbatim from
 * those components — the same records, the same fields. Each component keeps
 * its own copy as the offline fallback.
 */
export interface DahabGalleryPhoto {
  id: string;
  title: string;
  titleAr: string;
  spot: string;
  spotAr: string;
  category: 'diving' | 'sunset' | 'desert' | 'lagoon' | 'bedouin' | 'local';
  categoryLabel: string;
  categoryLabelAr: string;
  imageUrl: string;
  photographer: string;
  resolution: string;
  description: string;
  descriptionAr: string;
  bestTime: string;
  bestTimeAr: string;
  tags: string[];
  depthOrHeight?: string;
}

export interface DahabCuratedStory {
  id: string;
  title: string;
  titleAr: string;
  category: string;
  categoryAr: string;
  tagline: string;
  taglineAr: string;
  duration: string;
  durationAr: string;
  location: string;
  locationAr: string;
  /** Absent: nothing measures a rating. Was an invented 4.8–5.0. */
  rating?: number;
  image: string;
  description: string;
  descriptionAr: string;
  activityToAdd: {
    time: string;
    title: string;
    titleAr: string;
    type: 'Activity' | 'Experience' | 'Dining' | 'Leisure';
    location: string;
    locationAr: string;
    notes: string;
    notesAr: string;
    duration: string;
    durationAr: string;
  };
}
