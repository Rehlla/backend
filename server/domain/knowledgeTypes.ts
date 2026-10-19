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

export type AccessMethodType = 'WALK' | 'SHORE' | 'BOAT' | 'VEHICLE' | '4X4' | 'CAMEL' | 'HIKE' | 'MIXED' | 'UNKNOWN';

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
  confidence: number; // 0.0 - 1.0
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
  confidence: number; // 0.0 - 1.0
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

export interface EntityIdentity {
  internalId: string;
  canonicalName: string;
  canonicalNameAr: string;
  aliases: string[];
  arabicNames: string[];
  transliterations: string[];
  category: string;
  areaId: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  googlePlaceId?: string;
  externalIds?: Record<string, string>;
  operationalStatus: BusinessOperationalStatus;
  supplierId?: string;
  mergeHistory: {
    mergedFromId: string;
    timestamp: string;
    resolvedBy: string;
    confidence: number;
  }[];
  qualityScore: {
    completeness: number; // 0-100
    freshness: number;    // 0-100
    sourceQuality: number;// 0-100
    consistency: number;  // 0-100
    identityConfidence: number; // 0-100
    overall: number;      // 0-100
  };
}

export interface AreaProfile {
  id: string;
  nameEn: string;
  nameAr: string;
  coordinates: { lat: number; lng: number };
  radiusMeters: number;
  atmosphere: string;
  atmosphereAr: string;
  personaAffinity: string[];
  activityAffinity: string[];
  foodAffinity: string[];
  walkabilityScore: number; // 1-10
  noiseProfile: 'Tranquil' | 'Moderate' | 'Lively' | 'Vibrant Nightlife';
  transportFriction: 'Low (Walking)' | 'Medium (Short Taxi)' | 'High (4x4 / Boat Only)';
  stayProfile: string;
  eveningProfile: string;
}

export interface ActivityDetail {
  id: string;
  skuId?: string;
  titleEn: string;
  titleAr: string;
  category: 'diving' | 'safari' | 'water_sport' | 'wellness' | 'culture' | 'food';
  placeId: string;
  areaId: string;
  durationMinutes: number;
  accessMethod: AccessMethodType;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  experienceLevelRequired: string;
  basePriceEGP: number;
  bookingMode: BookNowEligibility;
  supplierId?: string;
  seasonalityMonths: number[];
  environmentalSensitivities: {
    maxWindKnots?: number;
    minVisibilityMeters?: number;
    requiresDaylight?: boolean;
  };
  dependencies: string[];
  preparationTips: string[];
  preparationTipsAr: string[];
  travelerFitPersonas: string[];
  recoveryAlternativeIds?: string[];
}

export interface DiningVenue {
  id: string;
  nameEn: string;
  nameAr: string;
  areaId: string;
  coordinates: { lat: number; lng: number };
  cuisine: string[];
  priceBand: 'Budget ($)' | 'Moderate ($$)' | 'Premium ($$$)';
  averageMealPriceEGP: number;
  seatingStyle: 'Bedouin Carpet Waterfront' | 'Courtyard Garden' | 'Bistro' | 'Street Counter';
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
}

export interface TransportServiceOption {
  id: string;
  skuId?: string;
  titleEn: string;
  titleAr: string;
  fromZone: string;
  toZone: string;
  vehicleType: 'Sedan AC' | 'Toyota HiAce Van' | 'Bedouin 4x4 Jeep' | 'Open-Bed Hilux' | 'Speedboat';
  durationMinutes: number;
  priceEGP: number;
  capacityMaxPax: number;
  luggageCapacityBags: number;
  bookingMode: BookNowEligibility;
  supplierId: string;
}

export interface RegulatorySafetyDecree {
  id: string;
  titleEn: string;
  titleAr: string;
  category: RuleCategory;
  authority: string;
  sourceDocRef: string;
  effectiveDate: string;
  summaryEn: string;
  summaryAr: string;
  enforcementAction: string;
  revalidationPolicy: string;
  verifiedAt: string;
}

export interface EmergencyResourceItem {
  id: string;
  nameEn: string;
  nameAr: string;
  category: 'Hyperbaric Chamber' | 'Hospital ER' | 'Urgent Clinic' | '24h Pharmacy' | 'Tourism Police' | 'Ambulance';
  address: string;
  coordinates: { lat: number; lng: number };
  hotlineNumbers: string[];
  authority: string;
  operatingHours: string;
  responseCapabilitiesEn: string;
  responseCapabilitiesAr: string;
  verifiedAt: string;
  revalidationDays: number;
}

export interface KnowledgeSnapshotRecord {
  versionId: string;
  createdAt: string;
  totalFacts: number;
  totalEntities: number;
  totalSources: number;
  qualityScoreOverall: number;
  openConflictsCount: number;
  staleFactsCount: number;
  fingerprintHash: string;
  factsSummary: Record<string, number>;
}

export type ResearchDomain =
  | 'Geography'
  | 'Diving'
  | 'Freediving'
  | 'Snorkeling'
  | 'Water Sports'
  | 'Wind'
  | 'Marine'
  | 'Weather'
  | 'Food'
  | 'Accommodation'
  | 'Transport'
  | 'Mobility'
  | 'Desert'
  | 'Mountains'
  | 'Bedouin'
  | 'Protected Areas'
  | 'Health'
  | 'Emergency'
  | 'Regulation'
  | 'Seasonality'
  | 'Pricing'
  | 'Supplier Ecosystem'
  | 'Traveler Personas'
  | 'Traveler Journeys'
  | 'Market Intelligence'
  | 'Competitors';

export type FreshnessStatus = 'FRESH' | 'AGING' | 'STALE' | 'UNKNOWN';

export interface DomainFreshnessRule {
  domain: ResearchDomain;
  freshDaysMax: number;
  agingDaysMax: number;
  criticality: 'CRITICAL_SAFETY' | 'OPERATIONAL_COMMERCIAL' | 'GENERAL_KNOWLEDGE';
  enforcementAction: 'REFUSE_CLAIM' | 'WARN_OPERATIONS' | 'FLAG_FOR_AUDIT';
}

export interface KnowledgeSearchLog {
  id: string;
  correlationId: string;
  query: string;
  queryType: 'UNIFIED_NATURAL_LANGUAGE' | 'STRUCTURED_FILTER' | 'CONTEXT_LOOKUP' | 'AREA_DISCOVERY';
  domain?: string;
  latencyMs: number;
  candidateCount: number;
  rankedCount: number;
  cacheHit: boolean;
  sourceStatus: 'ALL_AUTHORITATIVE' | 'MIXED_VERIFIED' | 'COMMUNITY_UNVERIFIED';
  resultConfidence: number;
  timestamp: string;
}

export interface WhyMatchedReason {
  overallScore: number;
  primaryReasonEn: string;
  primaryReasonAr: string;
  factors: {
    geographicFit: { score: number; textEn: string; textAr: string };
    timeFit: { score: number; textEn: string; textAr: string };
    paceFit: { score: number; textEn: string; textAr: string };
    availability: { score: number; textEn: string; textAr: string };
    supplierTrust: { score: number; textEn: string; textAr: string };
    environmentalSafety: { score: number; textEn: string; textAr: string };
  };
  evidenceLineage: {
    factId: string;
    source: string;
    verifiedAt: string;
    confidenceTier: string;
  }[];
}

export interface KnowledgeGapItem {
  id: string;
  entityId: string;
  entityType: 'Place' | 'Activity' | 'DiningVenue' | 'Supplier' | 'Area' | 'TransportRoute';
  entityName: string;
  zone: string;
  gapType: 'MISSING_COORDINATES' | 'MISSING_ACCESS_METHOD' | 'UNVERIFIED_SUPPLIER' | 'MISSING_PRICE' | 'MISSING_OPERATING_HOURS' | 'MISSING_BOOKING_MODE' | 'LOW_FACT_DENSITY';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  remediationPlan: string;
  detectedAt: string;
}

export interface HumanReviewItem {
  id: string;
  entityId: string;
  entityName: string;
  category: string;
  zone: string;
  sourceType: SourceType;
  sourceId: string;
  reason: 'STAGE_PROMOTION' | 'CONFLICT_DETECTED' | 'CATEGORY_MISMATCH' | 'SUPPLIER_SUSPENSION_REVIEW' | 'SAFETY_VARIATION';
  details: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface StagedObservation {
  id: string;
  sourceId: string;
  nameEn: string;
  nameAr?: string;
  category: string;
  zone: string;
  coordinates?: { lat: number; lng: number };
  googlePlaceId?: string;
  rawPayload?: Record<string, any>;
  observedAt: string;
  status: 'OBSERVED' | 'UNDER_REVIEW' | 'PROMOTED' | 'REJECTED';
}

export interface TrustBadgeRecord {
  badge: 'CDWS_CERTIFIED' | 'EEAA_PROTECTORATES_PERMIT' | 'MOHP_HEALTH_REGISTERED' | 'BEDOUIN_GUILD_AUTHENTICATED' | 'DIRECT_FIELD_VERIFIED' | 'ECO_CONSERVATION_COMPLIANT';
  labelEn: string;
  labelAr: string;
  issuingAuthority: string;
  verifiedSourceId: string;
  verifiedAt: string;
  expiresAt: string;
  badgeLevel: 'GOVERNMENT_AUTHORITATIVE' | 'OPERATIONAL_GOLD' | 'COMMUNITY_SILVER';
}

export interface ExpansionMetricsSummary {
  microZonesCount: number;
  operationalCategoriesCount: number;
  placesCount: number;
  activitiesCount: number;
  diningCount: number;
  emergencyCount: number;
  suppliersCount: number;
  sourcesCount: number;
  temporalFactsCount: number;
  factsPerEntityRatio: number;
  coveragePercent: number;
  verifiedAuthoritativePercent: number;
  gapQueueCount: number;
  reviewQueueCount: number;
}

export interface QuestionKnowledgeItem {
  id: string;
  questionEn: string;
  questionAr: string;
  category: 'Safety' | 'Logistics' | 'Marine' | 'Payment' | 'Customs' | 'Mobility';
  governingFactIds: string[];
  authoritativeSourceId: string;
  answerEn: string;
  answerAr: string;
  verifiedAt: string;
}

export type {
  VerificationLevel,
  PricingBasis,
  LocalCommerceSourceType,
  RawSupplierSourceEntity,
  RawOfferSourceEntity,
  SupplierOfferEntity,
  MarketPriceStatEntity
} from '../db/schema';
