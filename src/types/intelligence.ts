export type SourceCollectionMethod =
  | 'Official API'
  | 'Authorized Feed'
  | 'Public Web Page'
  | 'Indirect / Aggregated'
  | 'Unsupported Scraping';

export type SourceAuthType =
  | 'OAuth2 / API Key'
  | 'Public RSS / JSON-LD'
  | 'HTML Microdata'
  | 'Manual Inspection'
  | 'None';

export type SourceRobotsStatus =
  | 'Allowed (robots.txt OK)'
  | 'API Terms of Service Governed'
  | 'Restricted / Requires Consent'
  | 'NOT PRODUCTION-READY';

export type SourceProductionReadiness =
  | 'Production-Ready'
  | 'Candidate Feed'
  | 'NOT PRODUCTION-READY';

export interface IntelligenceSource {
  id: string;
  name: string;
  category: 'Google Maps' | 'TripAdvisor' | 'Booking.com' | 'Social' | 'Local Dive Directory' | 'Sinai Tourism Portal' | 'Competitor Website';
  targetUrl: string;
  frequency: 'Realtime' | 'Hourly' | 'Daily' | 'Weekly';
  status: 'Active' | 'Throttled' | 'Degraded' | 'Paused';
  lastRun: string;
  freshness: string;
  successRate: number;
  itemsObserved: number;
  rateLimit: string;
  // Hardened Source Governance fields
  collectionMethod: SourceCollectionMethod;
  authType: SourceAuthType;
  robotsStatus: SourceRobotsStatus;
  allowedDataTypes: string[];
  retentionPolicy: string;
  usageClassification: 'Intelligence Only' | 'Vetting Reference' | 'Internal Benchmark';
  riskLevel: 'Low' | 'Medium' | 'High (Legal/IP)' | 'Critical';
  productionReadiness: SourceProductionReadiness;
  governanceNotes: string;
}

export interface CrawlJob {
  id: string;
  sourceId: string;
  sourceName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  status: 'Completed' | 'Running' | 'Failed' | 'Queued';
  recordsExtracted: number;
  recordsNormalized: number;
  anomaliesFound: number;
  payloadSize: string;
  logs: string[];
  retryCount?: number;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface RawObservation {
  id: string;
  source: string;
  source_id: string;
  source_url: string;
  observed_at: string;
  fetched_at: string;
  freshness: string;
  parser_version: string;
  connector_version: string;
  entityCandidateName: string;
  entityCandidateNameAr?: string;
  categoryHint: string;
  rawSnippet: string;
  rawJson: Record<string, any>;
  confidence: number;
  verification_status: 'Unverified Observation' | 'Staged for Review' | 'Vetted & Promoted' | 'Rejected / Noise';
  provenanceSignature: string; // SHA256 hash
  triageNotes?: string;
}

export interface NormalizedPrice {
  original_amount: number;
  original_currency: 'EGP' | 'USD' | 'EUR' | 'GBP';
  normalized_amount: number; // Always in EGP
  normalized_currency: 'EGP';
  exchange_rate: number;
  exchange_rate_timestamp: string;
  source_timestamp: string;
  movement_type: 'Organic Price Adjustment' | 'FX Fluctuation' | 'Seasonal Shift' | 'Unverified';
  fx_drift_flag: boolean;
  unit: string;
  originalString: string;
}

export interface NormalizedEntity {
  id: string;
  observationId: string;
  canonicalName: string;
  canonicalNameAr: string;
  vertical: 'Diving & Watersports' | 'Desert Safari & Trekking' | 'Accommodations & Camps' | 'Dining & Cafes' | 'Transfers & Logistics' | 'Wellness & Yoga';
  area: 'Lighthouse' | 'Eel Garden' | 'Blue Hole' | 'Canyon' | 'Mashraba' | 'Assalah' | 'Lagoona' | 'Wadi Qnai' | 'Ras Abu Galum' | 'St. Catherine';
  coordinates: { lat: number; lng: number };
  observedPrice: NormalizedPrice;
  contact: { phone?: string; whatsapp?: string; instagram?: string; website?: string };
  operatingHours: string;
  amenities: string[];
  confidenceScore: number;
  extractionEngine: string;
}

export type EntityResolutionType =
  | 'Deterministic Exact Match'
  | 'Deterministic Phone/Tax Match'
  | 'Probabilistic AI Suggestion'
  | 'Manual Ambiguity Review';

export interface EntityResolutionMatch {
  id: string;
  normalizedEntityId: string;
  incomingName: string;
  matchedSupplierId?: string;
  matchedSupplierName?: string;
  matchScore: number; // 0 to 100
  matchReason: string;
  resolutionType: EntityResolutionType;
  resolutionStatus: 'Matched to Existing' | 'Potential New Supplier Candidate' | 'Duplicate Observation' | 'Unresolved Ambiguity';
  requiresHumanReview: boolean;
  verifiedProductionLink?: boolean;
  testScenarioCategory?: 'obvious_duplicate' | 'similar_names' | 'same_location_diff_supplier' | 'same_supplier_diff_products' | 'transliteration_variants' | 'ar_en_variants';
}

export type SupplierVettingStage =
  | 'Discovered'
  | 'Reviewed'
  | 'Candidate'
  | 'Contacted'
  | 'Verified'
  | 'Approved'
  | 'Onboarded'
  | 'Rejected';

export type SupplierLifecycleStage =
  | 'Observation'
  | 'Normalization'
  | 'Entity Resolution'
  | 'Candidate'
  | 'Contacted'
  | 'Verified'
  | 'Approved'
  | 'In Supplier OS'
  | SupplierVettingStage;

export interface DiscoveredSupplierCandidate {
  id: string;
  businessName: string;
  businessNameAr: string;
  category: string;
  area: string;
  sourceReferences: { source: string; url: string; observedAt: string; parserVersion?: string }[];
  licenseStatusDetected: 'CDWS Registered' | 'Ministry of Tourism Listed' | 'Informal / Local Bedouin Guild' | 'Unverified / Unknown';
  leadContact: string;
  offeringsCount: number;
  estimatedRating: number;
  reviewsObservedCount: number;
  vettingStage: SupplierVettingStage;
  // A history records every stage the candidate passed through, including the
  // pipeline stages that are in SupplierLifecycleStage but not in the narrower
  // SupplierVettingStage (Observation, Normalization, Entity Resolution).
  stageHistory: { stage: SupplierLifecycleStage; timestamp: string; actorRole: string; actorEmail: string; notes: string }[];
  suggestedTier: 'Tier 1 Standard' | 'Tier 2 Certified' | 'Tier 3 Premium Sinai Partner';
  explicitVerificationConfirmed: boolean;
  verificationEvidence?: string[];
  currentStage?: SupplierLifecycleStage;
  vettingStatus?: string;
  verifiedBy?: string;
  /**
   * Granular vetting outcomes recorded by the Supplier OS promotion workflow in
   * MarketIntelligenceView. The model previously carried only the coarse
   * `explicitVerificationConfirmed` boolean, so the workflow was writing these
   * onto candidate objects with nowhere in the contract to hold them.
   * `verifiedAt` complements the existing `verifiedBy`.
   */
  verifiedAt?: string;
  licenseCheckPassed?: boolean;
  safetyCheckPassed?: boolean;
  /** Bedouin guide operators require a tribal agreement in addition to a licence. */
  tribalAgreementValidated?: boolean;
  authoritativeSupplierId?: string;
}

export interface CompetitorOffering {
  id: string;
  competitorName: string;
  serviceTitle: string;
  vertical: string;
  observedPriceEGP: number;
  dahabPlatformPriceEGP: number;
  priceDifferencePct: number;
  inclusionsObserved: string[];
  cancellationTerms: string;
  pickupLocations: string[];
  lastPriceCheck: string;
  fulfillmentSpeed: string;
  notes: string;
  priceMovementOrigin: 'Direct Local Tariff Change' | 'USD/EGP FX Drift' | 'Seasonal Promotion';
}

export interface PriceMarketIndex {
  id: string;
  serviceKey: string;
  serviceName: string;
  serviceNameAr: string;
  marketMinEGP: number;
  marketMedianEGP: number;
  marketMaxEGP: number;
  dahabPlatformRateEGP: number;
  currencyVolatility: 'Stable' | 'Rising (+8%)' | 'Volatile (+18%)' | 'Cooling (-5%)';
  sampleCount: number;
  dateRange: string;
  freshness: string;
  confidenceScore: number;
  hasSufficientEvidence: boolean; // True if sampleCount >= 5 and confidence >= 75
  movementReason: 'Local Supply Demand' | 'Fuel/Inflation Tariff' | 'FX Fluctuation' | 'Insufficient Data';
  trend: 'up' | 'down' | 'flat';
  actionRecommendation: string;
  historical7DaySpread: { date: string; median: number; dahabRate: number; fxRateUSD: number }[];
}

export interface ReviewSentimentSignal {
  id: string;
  entityName: string;
  source: string;
  sourceUrl: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Urgent Complaint';
  rating: number;
  category: 'Equipment Safety' | 'Transfer Punctuality' | 'Guide Quality' | 'Food Hygiene' | 'Value for Money' | 'Environmental Practice';
  excerpt: string;
  extractedKeywords: string[];
  date: string;
  isAuthoritativeFact: false; // Review intelligence is STRICTLY an advisory signal
  triggeredAction: 'Ops Partner Review Dispatched' | 'Safety Audit Scheduled' | 'Knowledge Base Note' | 'No Action Needed';
  actionableInsight: string;
}

export interface TravelerContentTrend {
  id: string;
  queryTopic: string;
  queryTopicAr: string;
  searchVolumeScore: number; // 0-100
  growthVelocity: string;
  sentimentContext: 'Inquiry' | 'Safety Concern' | 'Booking Intent' | 'Logistics Question';
  coverageInDahabPlatform: 'Covered in AI Director' | 'Missing Guide Page' | 'Partially Covered' | 'Need FAQ Update';
  actionSuggested: string;
}

export type ChangeRadarState = 'new' | 'reviewed' | 'confirmed' | 'dismissed' | 'actioned';

export interface ChangeRadarEvent {
  id: string;
  timestamp: string;
  entityName: string;
  changeType: 'PRICE_MUTATION' | 'STATUS_CHANGE' | 'SCHEDULE_UPDATE' | 'NEW_OFFERING' | 'POLICY_CHANGE' | 'ROAD_ACCESS';
  severity: 'Info' | 'Notice' | 'Action Required' | 'Critical Alert';
  description: string;
  descriptionAr: string;
  oldValue?: string;
  newValue?: string;
  source_id: string;
  sourceUrl: string;
  confidence: number;
  reviewer?: string;
  /** When the reviewer above acted. Complements `reviewer`, which already existed. */
  reviewedAt?: string;
  resolution_state: ChangeRadarState;
  isProductTruth: boolean; // MUST be false until explicitly verified by Ops approval
  requiresAuthoritativeApproval: boolean;
}

export interface RegulatoryRoadCondition {
  id: string;
  sector: 'Road Access & Checkpoints' | 'Marine & Reef Protected Zones' | 'Mountain & Desert Trekking Permits' | 'Weather Advisory';
  title: string;
  titleAr: string;
  statusObserved: 'Normal Open' | 'Delays / Swell Warning' | 'Permit Check Required' | 'Restricted / Closed';
  source: string;
  sourceUrl: string;
  observedAt: string;
  fetchedAt: string;
  freshness: string;
  confidence: number;
  verificationStatus: 'Unverified Observation' | 'Verified by Sinai Ops' | 'Actioned in Traveler Advisories';
  impactOnBookings: 'None' | 'Manual Traveler Advisory' | 'Alternative Route Recommended' | 'Requires Ops Re-scheduling';
  notes: string;
}

// ============================================================================
// ACTION INTEGRATION MODELS (Proving Intelligence Safely Changes the Platform)
// ============================================================================

export interface AuthoritativeSupplier {
  id: string;
  businessName: string;
  businessNameAr: string;
  category: string;
  area: string;
  leadContact: string;
  licenseNumber: string;
  tier: 'Tier 1 Standard' | 'Tier 2 Certified' | 'Tier 3 Premium Sinai Partner';
  status: 'Active' | 'Onboarding' | 'Suspended';
  rating: number;
  reviewCount: number;
  onboardedAt: string;
  approvedBy: string;
  provenanceSignature: string;
  linkedCandidateId: string;
  activeRequestsCount: number;
  capacitySummary: string;
  initialSlots: { time: string; title: string; booked: number; total: number; notes: string }[];
  roster: { name: string; role: string; status: string; license: string }[];
  auditLog: { timestamp: string; actor: string; action: string; notes: string }[];
}

export interface PricingDecisionAction {
  id: string;
  observationId: string;
  competitorName: string;
  serviceTitle: string;
  observedPriceEGP: number;
  currentPlatformPriceEGP: number;
  recommendedAction: 'MAINTAIN_CURRENT' | 'MERCHANDISING_HIGHLIGHT' | 'PARTNER_TIER_DISCOUNT' | 'TARIFF_REVISION';
  rationale: string;
  authorizedBy?: string;
  authorizedAt?: string;
  status: 'PROPOSED' | 'APPROVED' | 'DISMISSED';
  merchandisingBadge?: string;
}

export interface ContentProductBridge {
  id: string;
  queryId: string;
  questionTopic: string;
  travelerIntent: 'Arrival Friction' | 'Safety Anxiety' | 'Kite/Wind Timing' | 'Work & Connectivity';
  confidenceScore: number;
  contentOpportunity: string;
  productOpportunity: string;
  targetSurfaces: ('PreArrivalBriefing' | 'EarlyArrivalView' | 'DailyCompanion' | 'AIDirector' | 'Explorer')[];
  status: 'PROPOSED' | 'ADOPTED' | 'DISMISSED';
  adoptedBy?: string;
  adoptedAt?: string;
  customerFacingOutcome: string;
}

export interface RegulatoryGovernanceAudit {
  signalId: string;
  corridorOrArea: string;
  authoritativeSource: string;
  freshnessSLA: string;
  verificationStatus: 'Unverified Observation' | 'Verified by Sinai Ops' | 'Actioned in Traveler Advisories';
  escalationPolicy: string;
  allowedDownstreamConsumers: string[];
  preventedAutomatedActions: string[];
  customerFacingWording: string;
  fallbackWhenStale: string;
}

// ============================================================================
// AI-POWERED PRODUCT OPPORTUNITY & FEEDBACK MODELS
// ============================================================================

export type OpportunityStatus =
  | 'Detected'
  | 'Qualified'
  | 'Proposed'
  | 'Reviewed'
  | 'Accepted'
  | 'Rejected'
  | 'Deferred'
  | 'Implemented'
  | 'Measured'
  | 'Validated'
  | 'Failed'
  | 'Inconclusive';

export type ProductArea =
  | 'Arrival Experience'
  | 'Diving & Safety'
  | 'Desert Safari & Culture'
  | 'Accommodations & Camps'
  | 'Food & Nightlife'
  | 'Logistics & Transfers'
  | 'Pricing & Merchandising'
  | 'Dahab Companion AI';

export interface OpportunityDecision {
  decision: 'Accepted' | 'Rejected' | 'Deferred' | 'Request Evidence';
  decidedByRole: 'Sinai Product Lead' | 'Ops Manager' | 'Head of Growth' | 'Safety Auditor';
  decidedByEmail: string;
  decidedAt: string;
  rationale: string;
  linkedSystem?: 'Feature Register' | 'Supplier OS' | 'Pricing Desk' | 'Dahab Companion' | 'Operations Console';
  linkedEntityId?: string;
  linkedFeatureId?: string;
}

export interface OpportunityHypothesis {
  targetUser: string;
  intervention: string;
  primaryMetric: string;
  secondaryMetric: string;
  baselineValue: string;
  targetValue: string;
  evaluationWindowDays: number;
  successCriteria: string;
  outcomeStatus?: 'Pending Measurement' | 'Validated' | 'Failed' | 'Inconclusive';
  measuredPrimaryValue?: string;
  measuredSecondaryValue?: string;
  outcomeNotes?: string;
  outcomeRecordedAt?: string;
  outcomeRecordedBy?: string;
}

export interface ProductOpportunity {
  id: string;
  title: string;
  titleAr: string;
  summary: string;
  summaryAr: string;
  productArea: ProductArea;
  suggestedAction: string;
  suggestedActionAr: string;
  confidenceScore: number; // 0.00 to 1.00
  freshness: string;
  evidenceCount: number;
  linkedSignalIds: string[];
  linkedSignalSources: string[];
  status: OpportunityStatus;
  statusHistory: {
    status: OpportunityStatus;
    timestamp: string;
    actor: string;
    notes: string;
  }[];
  decision?: OpportunityDecision;
  hypothesis?: OpportunityHypothesis;
  duplicateOfId?: string;
  aiDrafted: boolean;
  provenanceHash: string;
}

export interface FeatureRegisterItem {
  id: string;
  title: string;
  titleAr: string;
  category: ProductArea;
  currentStatus: 'In Production' | 'In Beta' | 'Roadmap / Planned' | 'Deprecated';
  componentRoute: string;
  description: string;
  descriptionAr: string;
  keyMetricsTracked: string[];
  ownerTeam: string;
}

export interface GroundedIntelligenceQueryResponse {
  query: string;
  answer: string;
  answerAr?: string;
  isGrounded: boolean;
  hasSufficientEvidence: boolean;
  /**
   * Where the prose came from. Previously the response carried a hardcoded
   * `confidence: 0.92` and a `sourcesUsed` array citing external feeds that
   * were never queried — invented provenance on an answer travelers plan
   * around. Both are replaced by facts the server can actually observe.
   */
  answerSource: 'gemini' | 'deterministic';
  /** The model that produced the answer, or null on the deterministic path. */
  model: string | null;
  /** The datasets placed in the prompt, and how many records each contributed. */
  groundedIn: { dataset: string; recordCount: number }[];
  suggestedOpportunities?: Partial<ProductOpportunity>[];
}


