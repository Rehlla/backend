import {
  IntelligenceSource,
  CrawlJob,
  RawObservation,
  NormalizedEntity,
  EntityResolutionMatch,
  DiscoveredSupplierCandidate,
  CompetitorOffering,
  PriceMarketIndex,
  ReviewSentimentSignal,
  TravelerContentTrend,
  ChangeRadarEvent,
  RegulatoryRoadCondition,
  AuthoritativeSupplier,
  PricingDecisionAction,
  ContentProductBridge,
  RegulatoryGovernanceAudit,
  ProductOpportunity,
  FeatureRegisterItem
} from '../types/intelligence';

// ============================================================================
// 1. INTELLIGENCE INGESTION SOURCES (Configured Registries & Feeds)
// ============================================================================
export const initialSources: IntelligenceSource[] = [
  {
    id: 'SRC-001',
    name: 'Google Maps Places & Reviews API',
    category: 'Google Maps',
    targetUrl: 'https://places.googleapis.com/v1/places:searchNearby',
    frequency: 'Hourly',
    status: 'Active',
    lastRun: '12 mins ago',
    freshness: 'Fresh (<1h)',
    successRate: 99.4,
    itemsObserved: 342,
    rateLimit: '60 req/min',
    collectionMethod: 'Official API',
    authType: 'OAuth2 / API Key',
    robotsStatus: 'API Terms of Service Governed',
    allowedDataTypes: ['Business Name', 'GPS Coordinates', 'Aggregated Rating', 'Operating Hours', 'Price Level (1-4)'],
    retentionPolicy: '30-Day Aggregated Cache / Real-time Lookups',
    usageClassification: 'Intelligence Only',
    riskLevel: 'Low',
    productionReadiness: 'Production-Ready',
    governanceNotes: 'Governed by Google Maps Platform API ToS. Cached place IDs and geographic coordinates only; no raw reviewer PII stored.'
  },
  {
    id: 'SRC-002',
    name: 'CDWS Egypt Official Dive Center Registry',
    category: 'Sinai Tourism Portal',
    targetUrl: 'https://cdws.travel/dive-centers/south-sinai/dahab',
    frequency: 'Daily',
    status: 'Active',
    lastRun: '3 hours ago',
    freshness: 'Fresh (<6h)',
    successRate: 100,
    itemsObserved: 64,
    rateLimit: '10 req/min',
    collectionMethod: 'Authorized Feed',
    authType: 'Public RSS / JSON-LD',
    robotsStatus: 'Allowed (robots.txt OK)',
    allowedDataTypes: ['Dive Center Legal Name', 'CDWS License Number', 'License Expiry', 'Authorized Manager', 'Safety Rating'],
    retentionPolicy: 'Permanent Reference Registry',
    usageClassification: 'Vetting Reference',
    riskLevel: 'Low',
    productionReadiness: 'Production-Ready',
    governanceNotes: 'Official statutory regulator registry for diving centers and safari operators in Egypt. Used as Ground Truth for CDWS license verification.'
  },
  {
    id: 'SRC-003',
    name: 'TripAdvisor Public Activity & Tour Listings',
    category: 'TripAdvisor',
    targetUrl: 'https://tripadvisor.com/Attractions-g297547-Dahab',
    frequency: 'Daily',
    status: 'Throttled',
    lastRun: '1 hour ago',
    freshness: 'Fresh (<2h)',
    successRate: 96.8,
    itemsObserved: 188,
    rateLimit: '5 req/min',
    collectionMethod: 'Public Web Page',
    authType: 'HTML Microdata',
    robotsStatus: 'NOT PRODUCTION-READY',
    allowedDataTypes: ['Aggregated Rating', 'Tour Title', 'Public Excerpt Snippet'],
    retentionPolicy: '14-Day Ephemeral Sentiment Cache',
    usageClassification: 'Intelligence Only',
    riskLevel: 'High (Legal/IP)',
    productionReadiness: 'NOT PRODUCTION-READY',
    governanceNotes: 'FLAGGED NOT PRODUCTION-READY: No commercial Content API license active. Currently using public microdata headers for test observations only. Must obtain enterprise API before live commercial use.'
  },
  {
    id: 'SRC-004',
    name: 'Dahab Community Travelers & Expats Hub',
    category: 'Social',
    targetUrl: 'https://community.dahab.live/traveler-feed',
    frequency: 'Realtime',
    status: 'Active',
    lastRun: 'Just now',
    freshness: 'Real-time (<5m)',
    successRate: 98.1,
    itemsObserved: 812,
    rateLimit: '120 req/min',
    collectionMethod: 'Authorized Feed',
    authType: 'Public RSS / JSON-LD',
    robotsStatus: 'Allowed (robots.txt OK)',
    allowedDataTypes: ['Public Inquiry Topics', 'General Feedback', 'Logistics Questions'],
    retentionPolicy: '7-Day Rolling Trend Cache',
    usageClassification: 'Intelligence Only',
    riskLevel: 'Low',
    productionReadiness: 'Production-Ready',
    governanceNotes: 'Sanitized public community RSS. PII stripped at gateway parser v2.1.'
  },
  {
    id: 'SRC-005',
    name: 'Facebook Dahab Community Public Groups',
    category: 'Social',
    targetUrl: 'https://facebook.com/groups/dahab.community.public',
    frequency: 'Daily',
    status: 'Paused',
    lastRun: '2 days ago',
    freshness: 'Stale (>24h)',
    successRate: 82.0,
    itemsObserved: 45,
    rateLimit: '2 req/min',
    collectionMethod: 'Unsupported Scraping',
    authType: 'None',
    robotsStatus: 'NOT PRODUCTION-READY',
    allowedDataTypes: ['None - Prohibited'],
    retentionPolicy: 'Purged immediately',
    usageClassification: 'Intelligence Only',
    riskLevel: 'Critical',
    productionReadiness: 'NOT PRODUCTION-READY',
    governanceNotes: 'CRITICAL AUDIT NOTICE: Meta Graph API approval required. Web scraping Facebook is strictly prohibited under Meta Terms of Service. PAUSED and locked from pipeline.'
  },
  {
    id: 'SRC-006',
    name: 'OTA & Aggregator Competitor Tariff Monitor',
    category: 'Competitor Website',
    targetUrl: 'https://pricing.redsea-excursions.demo/tariffs',
    frequency: 'Hourly',
    status: 'Active',
    lastRun: '28 mins ago',
    freshness: 'Fresh (<1h)',
    successRate: 97.5,
    itemsObserved: 420,
    rateLimit: '30 req/min',
    collectionMethod: 'Indirect / Aggregated',
    authType: 'Manual Inspection',
    robotsStatus: 'Allowed (robots.txt OK)',
    allowedDataTypes: ['Public Tour Package Name', 'Advertised Retail Price', 'Inclusion List'],
    retentionPolicy: '90-Day Time-Series Historical Pricing Table',
    usageClassification: 'Internal Benchmark',
    riskLevel: 'Medium',
    productionReadiness: 'Candidate Feed',
    governanceNotes: 'Publicly advertised brochure rates. Used solely for internal Ops price benchmarking against Dahab fixed partner rates.'
  }
];

// ============================================================================
// 2. CRAWL RUNS & PIPELINE EXECUTION HISTORY
// ============================================================================
export const initialCrawlJobs: CrawlJob[] = [
  {
    id: 'CRW-8902',
    sourceId: 'SRC-001',
    sourceName: 'Google Maps Places & Reviews API',
    startedAt: '14:48:10',
    completedAt: '14:49:22',
    durationMs: 72400,
    status: 'Completed',
    recordsExtracted: 34,
    recordsNormalized: 34,
    anomaliesFound: 1,
    payloadSize: '2.4 MB',
    retryCount: 0,
    correlationId: 'corr-gm-dhb-8902-39f8',
    idempotencyKey: 'idem-SRC001-20260825-1448',
    logs: [
      '[INFO] Connection established to Places API endpoint with API_KEY credentials.',
      '[INFO] Ingesting batch 1..5 for Lighthouse & Eel Garden geofence.',
      '[INFO] Extracted 12 updated business hours, 3 price mutations.',
      '[WARN] Anomaly detected: Coral Coast Cafe marked as Temporarily Closed on 1 feed, open on Instagram.',
      '[INFO] Normalization stage passed with 99.1% parsing score.',
      '[INFO] SHA256 provenance signature logged for all 34 raw observations.'
    ]
  },
  {
    id: 'CRW-8901',
    sourceId: 'SRC-006',
    sourceName: 'OTA & Aggregator Competitor Tariff Monitor',
    startedAt: '14:32:00',
    completedAt: '14:33:45',
    durationMs: 105000,
    status: 'Completed',
    recordsExtracted: 58,
    recordsNormalized: 56,
    anomaliesFound: 2,
    payloadSize: '4.1 MB',
    retryCount: 1,
    correlationId: 'corr-cmp-dhb-8901-71a2',
    idempotencyKey: 'idem-SRC006-20260825-1432',
    logs: [
      '[INFO] Polling OTA public tariff endpoints.',
      '[INFO] Monitored 14 competitor package itineraries across Sharm-Dahab transfer & Blue Hole dive.',
      '[WARN] Extracted price delta on Blue Hole Guided Snorkel: Competitor hiked rate from 750 EGP to 900 EGP (+20%).',
      '[INFO] Currency conversion checked: Verified 900 EGP is local tariff increase, NOT USD FX drift (CBE Mid-rate USD/EGP = 48.60).',
      '[INFO] Normalized schema pushed to Price Intelligence Index.'
    ]
  },
  {
    id: 'CRW-8900',
    sourceId: 'SRC-004',
    sourceName: 'Dahab Community Travelers & Expats Hub',
    startedAt: '14:15:20',
    completedAt: '14:16:10',
    durationMs: 50200,
    status: 'Completed',
    recordsExtracted: 89,
    recordsNormalized: 89,
    anomaliesFound: 0,
    payloadSize: '1.2 MB',
    retryCount: 0,
    correlationId: 'corr-soc-dhb-8900-11cc',
    idempotencyKey: 'idem-SRC004-20260825-1415',
    logs: [
      '[INFO] Ingesting RSS feed from authorized community bridge.',
      '[INFO] Extracted 42 trending traveler queries regarding high wind conditions at Laguna.',
      '[INFO] Sentiment pipeline classified 86% positive, 14% logistics inquiries.',
      '[INFO] Change radar alert dispatched for wind forecast updates.'
    ]
  }
];

// ============================================================================
// 3. RAW OBSERVATIONS FEED (Live Staging with Strict Provenance)
// ============================================================================
export const initialRawObservations: RawObservation[] = [
  {
    id: 'OBS-4401',
    source: 'Google Maps Places & Reviews API',
    source_id: 'SRC-001',
    source_url: 'https://places.googleapis.com/v1/places/ChIJX9a_dahab_01',
    observed_at: '2026-08-25T14:48:12Z',
    fetched_at: '2026-08-25T14:49:10Z',
    freshness: '12 mins ago',
    parser_version: 'v2.4.1-gmaps-places',
    connector_version: 'v1.8.0-cloud-run',
    entityCandidateName: 'Sinai Nomad Free-Diving Hub',
    entityCandidateNameAr: 'مركز سيناء نوماد للغوص الحر',
    categoryHint: 'Diving & Watersports',
    rawSnippet: 'Specialized Freediving AIDA 2/3 courses, breathing workshops at Eel Garden & Blue Hole. +20 120 449 8812. Open 08:00 - 19:00.',
    rawJson: {
      place_id: 'ChIJX9a_dahab_01',
      formatted_address: 'Peace Road, Eel Garden, Dahab, South Sinai',
      rating: 4.9,
      user_ratings_total: 128,
      types: ['freediving_center', 'sports_complex'],
      price_level: 2
    },
    confidence: 94,
    verification_status: 'Staged for Review',
    provenanceSignature: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    triageNotes: 'High-confidence candidate with strong reviews. Not yet in Dahab Supplier OS.'
  },
  {
    id: 'OBS-4402',
    source: 'TripAdvisor Public Activity & Tour Listings',
    source_id: 'SRC-003',
    source_url: 'https://tripadvisor.com/dahab/safari-bedouin-star-nights',
    observed_at: '2026-08-25T14:30:00Z',
    fetched_at: '2026-08-25T14:33:12Z',
    freshness: '30 mins ago',
    parser_version: 'v1.2.0-ta-microdata',
    connector_version: 'v1.8.0-cloud-run',
    entityCandidateName: 'Wadi Qnai Bedouin Stargazing & Candlelit Dinner',
    entityCandidateNameAr: 'عشاء بدوي ورصد نجوم في وادي قني',
    categoryHint: 'Desert Safari & Trekking',
    rawSnippet: 'Traditional Mandi dinner under Sinai constellations, Bedouin herbal tea, local acoustic rababa performance. 850 EGP per person.',
    rawJson: {
      ta_id: 'TA_78942_DHB',
      price_range: '800 - 950 EGP',
      duration: '4-5 hours',
      guide_clan: 'Muziena Tribe'
    },
    confidence: 88,
    verification_status: 'Unverified Observation',
    provenanceSignature: '8f4c2e6b1a9d3e5f7a0c2b4d6e8f0a2b4c6e8f0a2b4c6e8f0a2b4c6e8f0a2b4c',
    triageNotes: 'Matches existing partner Sheikh Salem offering. Linked to supplier entity SUP-408.'
  },
  {
    id: 'OBS-4403',
    source: 'OTA & Aggregator Competitor Tariff Monitor',
    source_id: 'SRC-006',
    source_url: 'https://pricing.redsea-excursions.demo/dahab-st-catherine-sunrise',
    observed_at: '2026-08-25T14:20:00Z',
    fetched_at: '2026-08-25T14:21:40Z',
    freshness: '40 mins ago',
    parser_version: 'v3.0.1-tariff-crawler',
    connector_version: 'v1.8.0-cloud-run',
    entityCandidateName: 'Mount Sinai & St. Catherine Sunrise Hike Package',
    entityCandidateNameAr: 'رحلة شروق جبل موسى ودير سانت كاترين',
    categoryHint: 'Desert Safari & Trekking',
    rawSnippet: 'Midnight departure (22:30), guided ascent to Mount Moses summit, visit 6th-century monastery. Price: 1,450 EGP (was 1,200 EGP).',
    rawJson: {
      offering_code: 'COMP-STCAT-01',
      price_egp: 1450,
      pickup_points: ['Lighthouse', 'Mashraba', 'Assalah'],
      transport_type: 'AC Minivan HiAce'
    },
    confidence: 96,
    verification_status: 'Unverified Observation',
    provenanceSignature: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    triageNotes: 'Price hike detected (+20.8%). Dahab Platform rate is currently 1,300 EGP.'
  },
  {
    id: 'OBS-4404',
    source: 'Dahab Community Travelers & Expats Hub',
    source_id: 'SRC-004',
    source_url: 'https://community.dahab.live/threads/eel-garden-organics-391',
    observed_at: '2026-08-25T13:50:00Z',
    fetched_at: '2026-08-25T14:02:15Z',
    freshness: '1 hour ago',
    parser_version: 'v2.1.0-community-rss',
    connector_version: 'v1.8.0-cloud-run',
    entityCandidateName: 'Zeytouna Organic Bedouin Bakery',
    entityCandidateNameAr: 'مخبز زيتونة البدوي العضوي',
    categoryHint: 'Dining & Cafes',
    rawSnippet: 'New wood-fired sourdough and Bedouin feteer, olive oil from St. Catherine orchards. Located behind Eel Garden alley. Open 07:30.',
    rawJson: {
      post_id: 'TH-9021',
      community_upvotes: 42,
      location_tag: 'Eel Garden, Dahab'
    },
    confidence: 76,
    verification_status: 'Staged for Review',
    provenanceSignature: '9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b',
    triageNotes: 'New artisanal bakery opened this month. Potential addition to Food Now & Morning Companion.'
  }
];

// ============================================================================
// 4. NORMALIZATION LAYER (Preserving Original Currency, FX, and Price Drift)
// ============================================================================
export const initialNormalizedEntities: NormalizedEntity[] = [
  {
    id: 'NRM-101',
    observationId: 'OBS-4401',
    canonicalName: 'Sinai Nomad Freediving Academy',
    canonicalNameAr: 'أكاديمية سيناء نوماد للغوص الحر',
    vertical: 'Diving & Watersports',
    area: 'Eel Garden',
    coordinates: { lat: 28.5085, lng: 34.5218 },
    observedPrice: {
      original_amount: 65,
      original_currency: 'USD',
      normalized_amount: 3159,
      normalized_currency: 'EGP',
      exchange_rate: 48.60,
      exchange_rate_timestamp: '2026-08-25T14:00:00Z',
      source_timestamp: '2026-08-25T14:48:12Z',
      movement_type: 'Organic Price Adjustment',
      fx_drift_flag: false,
      unit: 'per AIDA 2 certification',
      originalString: '$65 USD (equiv. 3,159 EGP)'
    },
    contact: { phone: '+20 120 449 8812', whatsapp: '+20 120 449 8812', website: 'https://sinainomad-freedive.example' },
    operatingHours: '08:00 - 19:00 Daily',
    amenities: ['AIDA Certified Instructors', 'Equipment Rental', 'Classroom with AC', 'GoPro Footage Included'],
    confidenceScore: 94,
    extractionEngine: 'LLM-NER-Dahab-v2.1'
  },
  {
    id: 'NRM-102',
    observationId: 'OBS-4402',
    canonicalName: 'Wadi Qnai Bedouin Candlelit Feast & Stargazing',
    canonicalNameAr: 'سهرة وعشاء وادي قني البدوي الفاخر',
    vertical: 'Desert Safari & Trekking',
    area: 'Wadi Qnai',
    coordinates: { lat: 28.4721, lng: 34.4812 },
    observedPrice: {
      original_amount: 850,
      original_currency: 'EGP',
      normalized_amount: 850,
      normalized_currency: 'EGP',
      exchange_rate: 1.0,
      exchange_rate_timestamp: '2026-08-25T14:00:00Z',
      source_timestamp: '2026-08-25T14:30:00Z',
      movement_type: 'Organic Price Adjustment',
      fx_drift_flag: false,
      unit: 'per person',
      originalString: '850 EGP incl. 4x4 Jeep transfer'
    },
    contact: { whatsapp: '+20 100 882 1190', phone: '+20 100 882 1190' },
    operatingHours: '18:30 - 23:00 (Sunset / Night)',
    amenities: ['Traditional Mandi Cooking', 'Bedouin Herb Tea', 'Telescope Stargazing', 'Roundtrip 4x4 Transfer'],
    confidenceScore: 91,
    extractionEngine: 'LLM-NER-Dahab-v2.1'
  },
  {
    id: 'NRM-103',
    observationId: 'OBS-4404',
    canonicalName: 'Zeytouna Artisan Bedouin Bakery',
    canonicalNameAr: 'مخبز زيتونة الحرفي',
    vertical: 'Dining & Cafes',
    area: 'Eel Garden',
    coordinates: { lat: 28.5092, lng: 34.5204 },
    observedPrice: {
      original_amount: 95,
      original_currency: 'EGP',
      normalized_amount: 95,
      normalized_currency: 'EGP',
      exchange_rate: 1.0,
      exchange_rate_timestamp: '2026-08-25T14:00:00Z',
      source_timestamp: '2026-08-25T13:50:00Z',
      movement_type: 'Organic Price Adjustment',
      fx_drift_flag: false,
      unit: 'average breakfast item',
      originalString: '75 - 140 EGP'
    },
    contact: { instagram: '@zeytouna_dahab' },
    operatingHours: '07:30 - 15:30 (Closed Tuesdays)',
    amenities: ['Outdoor Garden Seating', 'Specialty Coffee', 'Vegan Options', 'Cash & Instapay'],
    confidenceScore: 82,
    extractionEngine: 'LLM-NER-Dahab-v2.1'
  }
];

// ============================================================================
// 5. ENTITY RESOLUTION & TEST VALIDATION SUITE (Deterministic First, No Auto-Merge)
// ============================================================================
export const initialEntityResolutionMatches: EntityResolutionMatch[] = [
  {
    id: 'RES-301',
    normalizedEntityId: 'NRM-101',
    incomingName: 'Sinai Nomad Freediving Academy',
    matchScore: 32,
    matchReason: 'Deterministic checks (phone, tax ID, GPS < 15m) found NO match. Probabilistic similarity < 40%.',
    resolutionType: 'Probabilistic AI Suggestion',
    resolutionStatus: 'Potential New Supplier Candidate',
    requiresHumanReview: false,
    verifiedProductionLink: false,
    testScenarioCategory: 'similar_names'
  },
  {
    id: 'RES-302',
    normalizedEntityId: 'NRM-102',
    incomingName: 'Wadi Qnai Bedouin Candlelit Feast & Stargazing',
    matchedSupplierId: 'SUP-408',
    matchedSupplierName: 'Sheikh Salem Bedouin Safaris Guild',
    matchScore: 98,
    matchReason: 'Deterministic Phone Match (+20 100 882 1190) and coordinate proximity (< 10m) to verified SUP-408.',
    resolutionType: 'Deterministic Phone/Tax Match',
    resolutionStatus: 'Matched to Existing',
    requiresHumanReview: false,
    verifiedProductionLink: true,
    testScenarioCategory: 'obvious_duplicate'
  },
  {
    id: 'RES-303',
    normalizedEntityId: 'NRM-103',
    incomingName: 'Zeytouna Artisan Bedouin Bakery',
    matchScore: 24,
    matchReason: 'Distinct new food venue candidate. Coordinates 40m from Eel Garden beachfront. No existing record.',
    resolutionType: 'Deterministic Exact Match',
    resolutionStatus: 'Potential New Supplier Candidate',
    requiresHumanReview: false,
    verifiedProductionLink: false,
    testScenarioCategory: 'same_location_diff_supplier'
  },
  // Edge Case Test Suite Scenarios:
  {
    id: 'RES-TEST-01',
    normalizedEntityId: 'NRM-TEST-01',
    incomingName: 'Red Rock Divers Lighthouse Center',
    matchedSupplierId: 'SUP-102',
    matchedSupplierName: 'Red Rock Diving Dahab',
    matchScore: 95,
    matchReason: 'Deterministic match on CDWS #1842 and exact physical address in Lighthouse.',
    resolutionType: 'Deterministic Exact Match',
    resolutionStatus: 'Matched to Existing',
    requiresHumanReview: false,
    verifiedProductionLink: true,
    testScenarioCategory: 'obvious_duplicate'
  },
  {
    id: 'RES-TEST-02',
    normalizedEntityId: 'NRM-TEST-02',
    incomingName: 'Sinai Stars Camp (Mashraba)',
    matchedSupplierId: 'SUP-204',
    matchedSupplierName: 'Sinai Star Safari & Desert Treks',
    matchScore: 68,
    matchReason: 'Probabilistic AI string similarity (68%) triggered review. Distinct licenses: SUP-204 is Safari, incoming is Camp.',
    resolutionType: 'Probabilistic AI Suggestion',
    resolutionStatus: 'Unresolved Ambiguity',
    requiresHumanReview: true,
    verifiedProductionLink: false,
    testScenarioCategory: 'similar_names'
  },
  {
    id: 'RES-TEST-03',
    normalizedEntityId: 'NRM-TEST-03',
    incomingName: 'Lighthouse Station B Water Gear',
    matchedSupplierId: 'SUP-109',
    matchedSupplierName: 'Lighthouse Shore Station A',
    matchScore: 54,
    matchReason: 'Same GPS compound (Lighthouse Jetty) but separate operational owners. AI rejected merge.',
    resolutionType: 'Manual Ambiguity Review',
    resolutionStatus: 'Potential New Supplier Candidate',
    requiresHumanReview: true,
    verifiedProductionLink: false,
    testScenarioCategory: 'same_location_diff_supplier'
  },
  {
    id: 'RES-TEST-04',
    normalizedEntityId: 'NRM-TEST-04',
    incomingName: 'Blue Ocean PADI Open Water Course',
    matchedSupplierId: 'SUP-301',
    matchedSupplierName: 'Blue Ocean Dive & Snorkel Center',
    matchScore: 92,
    matchReason: 'Deterministic match to parent supplier SUP-301. Linked as new child Product Offering rather than new Supplier.',
    resolutionType: 'Deterministic Exact Match',
    resolutionStatus: 'Matched to Existing',
    requiresHumanReview: false,
    verifiedProductionLink: true,
    testScenarioCategory: 'same_supplier_diff_products'
  },
  {
    id: 'RES-TEST-05',
    normalizedEntityId: 'NRM-TEST-05',
    incomingName: 'El Mashraba Divers Camp',
    matchedSupplierId: 'SUP-115',
    matchedSupplierName: 'Al Mashrabah Diving Center',
    matchScore: 94,
    matchReason: 'Arabic-English transliteration phonetic dictionary match (El Mashraba == Al Mashrabah) with matching CDWS #901.',
    resolutionType: 'Deterministic Phone/Tax Match',
    resolutionStatus: 'Matched to Existing',
    requiresHumanReview: false,
    verifiedProductionLink: true,
    testScenarioCategory: 'transliteration_variants'
  },
  {
    id: 'RES-TEST-06',
    normalizedEntityId: 'NRM-TEST-06',
    incomingName: 'مجموعة بدو الجبل لرحلات السفاري',
    matchedSupplierId: 'SUP-408',
    matchedSupplierName: 'Sinai Bedouin Mountain Safaris',
    matchScore: 97,
    matchReason: 'Bilingual canonical index match between Arabic commercial name and English trade registry title.',
    resolutionType: 'Deterministic Exact Match',
    resolutionStatus: 'Matched to Existing',
    requiresHumanReview: false,
    verifiedProductionLink: true,
    testScenarioCategory: 'ar_en_variants'
  }
];

// ============================================================================
// 6. SUPPLIER DISCOVERY & 7-STEP PROMOTION PIPELINE
// (Discovered → Reviewed → Candidate → Contacted → Verified → Approved → Onboarded)
// ============================================================================
export const initialDiscoveredSuppliers: DiscoveredSupplierCandidate[] = [
  {
    id: 'DSC-501',
    businessName: 'Sinai Nomad Freediving Academy',
    businessNameAr: 'أكاديمية سيناء نوماد للغوص الحر',
    category: 'Diving & Watersports',
    area: 'Eel Garden',
    sourceReferences: [
      { source: 'Google Maps', url: 'https://places.googleapis.com/v1/places/ChIJX9a_dahab_01', observedAt: '12 mins ago', parserVersion: 'v2.4.1' },
      { source: 'CDWS Registry Check', url: 'https://cdws.travel/registry/dahab', observedAt: '2 hours ago', parserVersion: 'v1.0.0' }
    ],
    licenseStatusDetected: 'CDWS Registered',
    leadContact: 'Capt. Youssef Nabil (+20 120 449 8812)',
    offeringsCount: 5,
    estimatedRating: 4.9,
    reviewsObservedCount: 128,
    vettingStage: 'Reviewed',
    explicitVerificationConfirmed: false,
    verificationEvidence: ['CDWS License #4912 verified on portal', 'Physical inspection pending by Ops Lead'],
    stageHistory: [
      { stage: 'Discovered', timestamp: '2026-08-25 14:48:12', actorRole: 'Automated Crawler', actorEmail: 'system@dahab.ops', notes: 'Discovered via Google Maps Places API scan.' },
      { stage: 'Reviewed', timestamp: '2026-08-25 15:10:00', actorRole: 'Ops Analyst', actorEmail: 'kareem.ops@dahab.live', notes: 'Verified Eel Garden location and AIDA certification credentials.' }
    ],
    suggestedTier: 'Tier 2 Certified'
  },
  {
    id: 'DSC-502',
    businessName: 'Ras Abu Galum Bedouin Boat Guild (Assalah Section)',
    businessNameAr: 'رابطة مراكب رأس أبو جالوم البدوي (قطاع العصلة)',
    category: 'Transfers & Logistics',
    area: 'Blue Hole & Ras Abu Galum',
    sourceReferences: [
      { source: 'Dahab Community Travelers', url: 'https://community.dahab.live/boats', observedAt: '3 hours ago', parserVersion: 'v2.1.0' }
    ],
    licenseStatusDetected: 'Informal / Local Bedouin Guild',
    leadContact: 'Suleiman Abu Musa (+20 106 771 9023)',
    offeringsCount: 3,
    estimatedRating: 4.7,
    reviewsObservedCount: 240,
    vettingStage: 'Candidate',
    explicitVerificationConfirmed: false,
    verificationEvidence: ['Bedouin elder endorsement by Sheikh Salem', 'Life jacket safety gear check required before Contact stage'],
    stageHistory: [
      { stage: 'Discovered', timestamp: '2026-08-24 10:00:00', actorRole: 'Automated Crawler', actorEmail: 'system@dahab.ops', notes: 'Discovered via community travel logs.' },
      { stage: 'Reviewed', timestamp: '2026-08-24 16:30:00', actorRole: 'Ops Analyst', actorEmail: 'kareem.ops@dahab.live', notes: 'Confirmed boat fleet capacity: 6 motorized dhows.' },
      { stage: 'Candidate', timestamp: '2026-08-25 09:00:00', actorRole: 'Ops Analyst', actorEmail: 'kareem.ops@dahab.live', notes: 'Staged for partner liaison outreach.' }
    ],
    suggestedTier: 'Tier 1 Standard'
  },
  {
    id: 'DSC-503',
    businessName: 'Laguna Wind & Foil Pro Center',
    businessNameAr: 'مركز لاجونا للرياح والفويل سيرف',
    category: 'Diving & Watersports',
    area: 'Lagoona',
    sourceReferences: [
      { source: 'TripAdvisor Listing', url: 'https://tripadvisor.com/laguna-foil', observedAt: '2 days ago', parserVersion: 'v1.2.0' }
    ],
    licenseStatusDetected: 'Ministry of Tourism Listed',
    leadContact: 'Tarek Zaki (+20 114 990 1234)',
    offeringsCount: 8,
    estimatedRating: 4.8,
    reviewsObservedCount: 95,
    vettingStage: 'Verified',
    explicitVerificationConfirmed: true,
    verificationEvidence: ['Ministry of Tourism License #MOT-SINAI-8839 attached', 'Public liability insurance verified', 'Direct on-site inspection completed by Ops Manager on Aug 24'],
    stageHistory: [
      { stage: 'Discovered', timestamp: '2026-08-20 08:00:00', actorRole: 'Automated Crawler', actorEmail: 'system@dahab.ops', notes: 'Ingested from tourism directory.' },
      { stage: 'Reviewed', timestamp: '2026-08-21 11:00:00', actorRole: 'Ops Analyst', actorEmail: 'kareem.ops@dahab.live', notes: 'Valid water sports center with equipment fleet.' },
      { stage: 'Candidate', timestamp: '2026-08-22 14:00:00', actorRole: 'Supplier Manager', actorEmail: 'layla.partners@dahab.live', notes: 'Outreach packet prepared.' },
      { stage: 'Contacted', timestamp: '2026-08-23 10:00:00', actorRole: 'Supplier Manager', actorEmail: 'layla.partners@dahab.live', notes: 'Meeting held with founder Tarek Zaki.' },
      { stage: 'Verified', timestamp: '2026-08-24 17:00:00', actorRole: 'Supplier Manager', actorEmail: 'layla.partners@dahab.live', notes: 'Safety audit passed 100%. Ready for Ops Lead Final Approval.' }
    ],
    suggestedTier: 'Tier 3 Premium Sinai Partner'
  }
];

// ============================================================================
// 7. COMPETITIVE RADAR
// ============================================================================
export const initialCompetitorOfferings: CompetitorOffering[] = [
  {
    id: 'CMP-001',
    competitorName: 'Sinai Horizon Excursions (OTA)',
    serviceTitle: 'Blue Hole & Canyon Guided Snorkel with Lunch',
    vertical: 'Diving & Watersports',
    observedPriceEGP: 900,
    dahabPlatformPriceEGP: 820,
    priceDifferencePct: 9.8,
    inclusionsObserved: ['4x4 Jeep Transfer', 'Snorkel Mask & Fins', 'Bedouin Lunch at Blue Hole', 'National Park Ticket'],
    cancellationTerms: 'Free cancellation up to 24h before departure',
    pickupLocations: ['All Dahab Hotels'],
    lastPriceCheck: '28 mins ago',
    fulfillmentSpeed: 'Manual confirmation (2-4 hours)',
    priceMovementOrigin: 'Direct Local Tariff Change',
    notes: 'Competitor increased price from 750 to 900 EGP this week. Dahab Platform maintains 820 EGP with instant confirmation.'
  },
  {
    id: 'CMP-002',
    competitorName: 'Red Sea Wheels & Shuttle',
    serviceTitle: 'Private Sharm Airport (SSH) ↔ Dahab Hotel Transfer',
    vertical: 'Transfers & Logistics',
    observedPriceEGP: 1650,
    dahabPlatformPriceEGP: 1450,
    priceDifferencePct: 13.8,
    inclusionsObserved: ['Private Sedan / Minivan', 'AC', 'Meet & Greet at Terminal', 'Luggage Assistance'],
    cancellationTerms: 'Non-refundable if cancelled under 12h',
    pickupLocations: ['SSH Terminal 1 & 2'],
    lastPriceCheck: '1 hour ago',
    fulfillmentSpeed: 'Instant WhatsApp dispatch',
    priceMovementOrigin: 'Direct Local Tariff Change',
    notes: 'Our platform fleet price is 1,450 EGP with guaranteed flight tracker adjustment.'
  },
  {
    id: 'CMP-003',
    competitorName: 'Sinai Peak Treks',
    serviceTitle: 'Mount Sinai Sunrise & St. Catherine Monastery Tour',
    vertical: 'Desert Safari & Trekking',
    observedPriceEGP: 1450,
    dahabPlatformPriceEGP: 1300,
    priceDifferencePct: 11.5,
    inclusionsObserved: ['Shared HiAce Bus', 'Bedouin Mountain Guide', 'Monastery Entry', 'Flashlight & Blanket'],
    cancellationTerms: '50% refund up to 48h',
    pickupLocations: ['Lighthouse / Mashraba Meeting Point'],
    lastPriceCheck: '40 mins ago',
    fulfillmentSpeed: 'Same-day voucher issuance',
    priceMovementOrigin: 'Seasonal Promotion',
    notes: 'Competitor added flashlight rental fee (+50 EGP). We include all winter gear in our 1,300 EGP bundle.'
  },
  {
    id: 'CMP-004',
    competitorName: 'Aquanauts Red Sea',
    serviceTitle: '2-Tank Guided Boat Dive (Ras Abu Galum & Gabr El Bint)',
    vertical: 'Diving & Watersports',
    observedPriceEGP: 2400,
    dahabPlatformPriceEGP: 2250,
    priceDifferencePct: 6.7,
    inclusionsObserved: ['2 Guided Dives', 'Tanks & Weights', 'Boat Trip & Buffet Lunch', 'Marine Park Fees'],
    cancellationTerms: 'Free cancellation up to 48h',
    pickupLocations: ['Dahab Marina / Lighthouse Dive Centers'],
    lastPriceCheck: '2 hours ago',
    fulfillmentSpeed: 'Requires medical sign-off in advance',
    priceMovementOrigin: 'Direct Local Tariff Change',
    notes: 'Consistent pricing across premium dive centers. Dahab OS provides digital medical clearance in advance.'
  }
];

// ============================================================================
// 8. PRICE INTELLIGENCE & 7-DAY SPREAD (With Evidence Threshold & FX Drift)
// ============================================================================
export const initialPriceIndex: PriceMarketIndex[] = [
  {
    id: 'PRC-01',
    serviceKey: 'transfer_ssh_dahab_private',
    serviceName: 'Sharm Airport ↔ Dahab Private Transfer',
    serviceNameAr: 'توصيلة مطار شرم الشيخ ↔ دهب (خاصة)',
    marketMinEGP: 1300,
    marketMedianEGP: 1550,
    marketMaxEGP: 1850,
    dahabPlatformRateEGP: 1450,
    currencyVolatility: 'Stable',
    sampleCount: 42,
    dateRange: 'Aug 19 - Aug 25, 2026',
    freshness: 'Fresh (<1h)',
    confidenceScore: 96,
    hasSufficientEvidence: true,
    movementReason: 'Fuel/Inflation Tariff',
    trend: 'up',
    actionRecommendation: 'Competitive advantage: 6.5% below median with higher SLA flight tracking guarantee.',
    historical7DaySpread: [
      { date: 'Aug 19', median: 1480, dahabRate: 1450, fxRateUSD: 48.55 },
      { date: 'Aug 20', median: 1500, dahabRate: 1450, fxRateUSD: 48.58 },
      { date: 'Aug 21', median: 1520, dahabRate: 1450, fxRateUSD: 48.60 },
      { date: 'Aug 22', median: 1550, dahabRate: 1450, fxRateUSD: 48.60 },
      { date: 'Aug 23', median: 1550, dahabRate: 1450, fxRateUSD: 48.62 },
      { date: 'Aug 24', median: 1570, dahabRate: 1450, fxRateUSD: 48.60 },
      { date: 'Aug 25', median: 1550, dahabRate: 1450, fxRateUSD: 48.60 }
    ]
  },
  {
    id: 'PRC-02',
    serviceKey: 'dive_blue_hole_guided',
    serviceName: 'Blue Hole & Canyon Guided 2-Dive Pack',
    serviceNameAr: 'غوصتان إرشاديتان بالبلو هول والكانيون',
    marketMinEGP: 1900,
    marketMedianEGP: 2200,
    marketMaxEGP: 2600,
    dahabPlatformRateEGP: 2100,
    currencyVolatility: 'Stable',
    sampleCount: 68,
    dateRange: 'Aug 19 - Aug 25, 2026',
    freshness: 'Fresh (<30m)',
    confidenceScore: 98,
    hasSufficientEvidence: true,
    movementReason: 'Local Supply Demand',
    trend: 'flat',
    actionRecommendation: 'Optimal pricing: Perfectly balanced within the quality CDWS safety corridor.',
    historical7DaySpread: [
      { date: 'Aug 19', median: 2150, dahabRate: 2100, fxRateUSD: 48.55 },
      { date: 'Aug 20', median: 2180, dahabRate: 2100, fxRateUSD: 48.58 },
      { date: 'Aug 21', median: 2200, dahabRate: 2100, fxRateUSD: 48.60 },
      { date: 'Aug 22', median: 2200, dahabRate: 2100, fxRateUSD: 48.60 },
      { date: 'Aug 23', median: 2200, dahabRate: 2100, fxRateUSD: 48.62 },
      { date: 'Aug 24', median: 2220, dahabRate: 2100, fxRateUSD: 48.60 },
      { date: 'Aug 25', median: 2200, dahabRate: 2100, fxRateUSD: 48.60 }
    ]
  },
  {
    id: 'PRC-03',
    serviceKey: 'safari_st_catherine_sunrise',
    serviceName: 'Mount Sinai Sunrise Guided Trek',
    serviceNameAr: 'رحلة شروق جبل موسى وسانت كاترين',
    marketMinEGP: 1100,
    marketMedianEGP: 1400,
    marketMaxEGP: 1700,
    dahabPlatformRateEGP: 1300,
    currencyVolatility: 'Rising (+8%)',
    sampleCount: 35,
    dateRange: 'Aug 19 - Aug 25, 2026',
    freshness: 'Fresh (<2h)',
    confidenceScore: 92,
    hasSufficientEvidence: true,
    movementReason: 'Local Supply Demand',
    trend: 'up',
    actionRecommendation: 'Market prices rising due to seasonal winter trekking demand. Maintain current rate to capture market share.',
    historical7DaySpread: [
      { date: 'Aug 19', median: 1300, dahabRate: 1300, fxRateUSD: 48.55 },
      { date: 'Aug 20', median: 1320, dahabRate: 1300, fxRateUSD: 48.58 },
      { date: 'Aug 21', median: 1350, dahabRate: 1300, fxRateUSD: 48.60 },
      { date: 'Aug 22', median: 1380, dahabRate: 1300, fxRateUSD: 48.60 },
      { date: 'Aug 23', median: 1400, dahabRate: 1300, fxRateUSD: 48.62 },
      { date: 'Aug 24', median: 1420, dahabRate: 1300, fxRateUSD: 48.60 },
      { date: 'Aug 25', median: 1400, dahabRate: 1300, fxRateUSD: 48.60 }
    ]
  },
  {
    id: 'PRC-04',
    serviceKey: 'safari_ras_abu_galum_boat',
    serviceName: 'Ras Abu Galum Speedboat + Blue Lagoon Transfer',
    serviceNameAr: 'لانش رأس أبو جالوم + التوصيل للبلولاجون',
    marketMinEGP: 600,
    marketMedianEGP: 750,
    marketMaxEGP: 950,
    dahabPlatformRateEGP: 700,
    currencyVolatility: 'Volatile (+18%)',
    sampleCount: 52,
    dateRange: 'Aug 19 - Aug 25, 2026',
    freshness: 'Fresh (<1h)',
    confidenceScore: 90,
    hasSufficientEvidence: true,
    movementReason: 'Fuel/Inflation Tariff',
    trend: 'up',
    actionRecommendation: 'Sea condition volatility affects spot rates. Our locked 700 EGP agreement shields travelers.',
    historical7DaySpread: [
      { date: 'Aug 19', median: 680, dahabRate: 700, fxRateUSD: 48.55 },
      { date: 'Aug 20', median: 700, dahabRate: 700, fxRateUSD: 48.58 },
      { date: 'Aug 21', median: 720, dahabRate: 700, fxRateUSD: 48.60 },
      { date: 'Aug 22', median: 750, dahabRate: 700, fxRateUSD: 48.60 },
      { date: 'Aug 23', median: 780, dahabRate: 700, fxRateUSD: 48.62 },
      { date: 'Aug 24', median: 760, dahabRate: 700, fxRateUSD: 48.60 },
      { date: 'Aug 25', median: 750, dahabRate: 700, fxRateUSD: 48.60 }
    ]
  },
  {
    id: 'PRC-05',
    serviceKey: 'freediving_aida_2_cert',
    serviceName: 'AIDA 2 Freediver Certification Course (3 Days)',
    serviceNameAr: 'دورة الغوص الحر AIDA 2 (٣ أيام)',
    marketMinEGP: 3100,
    marketMedianEGP: 3400,
    marketMaxEGP: 4100,
    dahabPlatformRateEGP: 3200,
    currencyVolatility: 'Stable',
    sampleCount: 2, // Low sample count trigger
    dateRange: 'Aug 24 - Aug 25, 2026',
    freshness: 'Fresh (<4h)',
    confidenceScore: 62,
    hasSufficientEvidence: false, // Triggers Insufficient Evidence state
    movementReason: 'Insufficient Data',
    trend: 'flat',
    actionRecommendation: 'Insufficient observations (N=2 < 5 threshold). Awaiting additional verified supplier rate cards before setting market median.',
    historical7DaySpread: [
      { date: 'Aug 24', median: 3400, dahabRate: 3200, fxRateUSD: 48.60 },
      { date: 'Aug 25', median: 3400, dahabRate: 3200, fxRateUSD: 48.60 }
    ]
  }
];

// ============================================================================
// 9. REVIEW & REPUTATION INTELLIGENCE (Signals Only, Not Authoritative Sanctions)
// ============================================================================
export const initialReviewSignals: ReviewSentimentSignal[] = [
  {
    id: 'REV-701',
    entityName: 'Ras Abu Galum Boat Association',
    source: 'Google Places Reviews (External Signal)',
    sourceUrl: 'https://places.googleapis.com/v1/places/ChIJ_ras_abu_galum_boats',
    sentiment: 'Urgent Complaint',
    rating: 2.5,
    category: 'Equipment Safety',
    excerpt: 'Boat ride was very bumpy and driver had only 2 life jackets for 8 passengers. When waves picked up near the reef, it felt unsafe.',
    extractedKeywords: ['life jackets', 'rough waves', 'overcrowded boat'],
    date: '2026-08-24',
    isAuthoritativeFact: false,
    triggeredAction: 'Ops Partner Review Dispatched',
    actionableInsight: 'Signal dispatched to Dahab Ops Desk: Schedule equipment and life jacket safety check on partner fleet before sanctioning or status change.'
  },
  {
    id: 'REV-702',
    entityName: 'Sheikh Salem Bedouin Gatherings (Wadi Qnai)',
    source: 'TripAdvisor (External Signal)',
    sourceUrl: 'https://tripadvisor.com/dahab/sheikh-salem',
    sentiment: 'Positive',
    rating: 5.0,
    category: 'Guide Quality',
    excerpt: 'The most authentic night of our Egypt trip. Sheikh Salem told us Bedouin star stories and the slow-cooked chicken under the sand was unforgettable.',
    extractedKeywords: ['stargazing', 'Bedouin hospitality', 'authentic food', 'Mandi'],
    date: '2026-08-23',
    isAuthoritativeFact: false,
    triggeredAction: 'Knowledge Base Note',
    actionableInsight: 'High sentiment indicator for Stargazing & Bedouin Dinner. Validates promotion in AI Director Evening Itinerary suggestions.'
  },
  {
    id: 'REV-703',
    entityName: 'Sharm-Dahab Local Taxi Independent Drivers',
    source: 'Dahab Community Forum (External Signal)',
    sourceUrl: 'https://community.dahab.live/threads/taxi-airport-982',
    sentiment: 'Negative',
    rating: 2.0,
    category: 'Value for Money',
    excerpt: 'Arrived at Sharm airport at 1 AM and drivers quoted 2,500 EGP cash with no AC. Felt like price gouging.',
    extractedKeywords: ['airport price gouging', 'broken AC', 'night arrival'],
    date: '2026-08-25',
    isAuthoritativeFact: false,
    triggeredAction: 'Knowledge Base Note',
    actionableInsight: 'Market pain point detected: High street airport taxi quotes (2,500 EGP) versus our platform pre-booked 1,450 EGP guaranteed rate.'
  },
  {
    id: 'REV-704',
    entityName: 'Lighthouse Free-Dive & Coral Watch',
    source: 'Google Places Reviews (External Signal)',
    sourceUrl: 'https://places.googleapis.com/v1/places/ChIJ_coral_watch_lh',
    sentiment: 'Positive',
    rating: 4.9,
    category: 'Environmental Practice',
    excerpt: 'Loved that our dive guide spent 10 minutes briefing us on not touching corals and collected plastic debris during our safety stop.',
    extractedKeywords: ['eco-friendly', 'reef protection', 'plastic clean-up', 'coral conservation'],
    date: '2026-08-22',
    isAuthoritativeFact: false,
    triggeredAction: 'Safety Audit Scheduled',
    actionableInsight: 'Environmental excellence signal: Flag for potential "Green Sinai Partner" badge in Supplier OS.'
  }
];

// ============================================================================
// 10. CONTENT INTELLIGENCE & TRAVELER SEARCH RADAR
// ============================================================================
export const initialContentTrends: TravelerContentTrend[] = [
  {
    id: 'CNT-901',
    queryTopic: 'Is Dahab safe for solo female travelers in 2026?',
    queryTopicAr: 'هل دهب آمنة للمسافرات المنفردات في 2026؟',
    searchVolumeScore: 94,
    growthVelocity: '+42% this week',
    sentimentContext: 'Safety Concern',
    coverageInDahabPlatform: 'Covered in AI Director',
    actionSuggested: 'Publish a dedicated "Solo Traveler & Night Walk" safety guide highlighting Lighthouse promenade and verified Bedouin hosts.'
  },
  {
    id: 'CNT-902',
    queryTopic: 'Best wind months for kitesurfing in Dahab Laguna',
    queryTopicAr: 'أفضل شهور الرياح للكايت سيرف في لاجونا دهب',
    searchVolumeScore: 86,
    growthVelocity: '+18% this month',
    sentimentContext: 'Booking Intent',
    coverageInDahabPlatform: 'Partially Covered',
    actionSuggested: 'Add monthly wind velocity chart (Knots / Beaufort) to the Laguna Activity Detail Modal in Explorer.'
  },
  {
    id: 'CNT-903',
    queryTopic: 'How to get from Sharm Airport to Dahab without getting scammed?',
    queryTopicAr: 'إزاي أسافر من مطار شرم لدهب بأمان وبدون استغلال؟',
    searchVolumeScore: 91,
    growthVelocity: '+85% breakout',
    sentimentContext: 'Logistics Question',
    coverageInDahabPlatform: 'Missing Guide Page',
    actionSuggested: 'Create a pre-arrival landing briefing module comparing private transfer, public bus, and shared taxi costs with transparent advice.'
  },
  {
    id: 'CNT-904',
    queryTopic: 'Working remotely from Dahab: High-speed Wi-Fi cafes in Lighthouse & Eel Garden',
    queryTopicAr: 'العمل عن بعد من دهب: كافيهات إنترنت سريع في اللايتهاوس والجيل جاردن',
    searchVolumeScore: 78,
    growthVelocity: '+25% this month',
    sentimentContext: 'Inquiry',
    coverageInDahabPlatform: 'Partially Covered',
    actionSuggested: 'Update cafe tag filters in Explorer to include "Fiber Optic 50Mbps+" and "Power Outlets Available".'
  }
];

// ============================================================================
// 11. CHANGE RADAR (Live Market Mutations with 5-Stage State Machine)
// (new → reviewed → confirmed → dismissed → actioned)
// ============================================================================
export const initialChangeRadarEvents: ChangeRadarEvent[] = [
  {
    id: 'CHG-101',
    timestamp: '2026-08-25 14:32:00',
    entityName: 'Mount Sinai & St. Catherine Package',
    changeType: 'PRICE_MUTATION',
    severity: 'Action Required',
    description: 'Competitor "Red Sea Tours" increased sunrise hike rate from 1,200 EGP to 1,450 EGP (+20.8%).',
    descriptionAr: 'المنافس قام برفع سعر رحلة شروق سانت كاترين من ١٢٠٠ إلى ١٤٥٠ جنيه (+٢٠.٨٪).',
    oldValue: '1,200 EGP',
    newValue: '1,450 EGP',
    source_id: 'SRC-006',
    sourceUrl: 'https://pricing.redsea-excursions.demo/dahab-st-catherine-sunrise',
    confidence: 96,
    reviewer: 'kareem.ops@dahab.live',
    resolution_state: 'reviewed',
    isProductTruth: false,
    requiresAuthoritativeApproval: true
  },
  {
    id: 'CHG-102',
    timestamp: '2026-08-25 13:45:10',
    entityName: 'Blue Hole & Ras Abu Galum Coastal Track',
    changeType: 'ROAD_ACCESS',
    severity: 'Notice',
    description: 'Northern swell (18 knots) reported at Blue Hole jetty. Speedboat transfers operating with 15-min weather delay buffer.',
    descriptionAr: 'ارتفاع في الأمواج الشمالية (١٨ عقدة) عند مرسى البلو هول. اللانشات تعمل مع تأخير وقائي ١٥ دقيقة.',
    oldValue: 'Normal Sea State (Calm)',
    newValue: 'Moderate Swell (18 kts)',
    source_id: 'SRC-002',
    sourceUrl: 'https://cdws.travel/weather/south-sinai',
    confidence: 99,
    reviewer: 'tariq.marine@dahab.live',
    resolution_state: 'confirmed',
    isProductTruth: false,
    requiresAuthoritativeApproval: true
  },
  {
    id: 'CHG-103',
    timestamp: '2026-08-25 11:20:00',
    entityName: 'Zeytouna Organic Bedouin Bakery',
    changeType: 'NEW_OFFERING',
    severity: 'Info',
    description: 'New artisan wood-fired bakery opened behind Eel Garden beachfront with organic St. Catherine produce.',
    descriptionAr: 'افتتاح مخبز بدوي عضوي جديد في منطقة الجيل جاردن يقدم منتجات طازجة من سانت كاترين.',
    newValue: 'New Business Observed',
    source_id: 'SRC-004',
    sourceUrl: 'https://community.dahab.live/threads/eel-garden-organics-391',
    confidence: 76,
    resolution_state: 'new',
    isProductTruth: false,
    requiresAuthoritativeApproval: true
  },
  {
    id: 'CHG-104',
    timestamp: '2026-08-25 09:10:00',
    entityName: 'Canyon Dive Site Entry Point',
    changeType: 'POLICY_CHANGE',
    severity: 'Notice',
    description: 'South Sinai Environmental Directorate updated reef protection buoys at the Canyon entrance.',
    descriptionAr: 'جهاز حماية البيئة بجنوب سيناء يجدد عوامات الحماية البيئية للشعاب المرجانية عند مدخل الكانيون.',
    oldValue: 'Previous Buoy Zone',
    newValue: 'Expanded Ecological Buffer (150m)',
    source_id: 'SRC-002',
    sourceUrl: 'https://cdws.travel/news/dahab-canyon-buoys-update',
    confidence: 100,
    reviewer: 'layla.environment@dahab.live',
    resolution_state: 'actioned',
    isProductTruth: true,
    requiresAuthoritativeApproval: true
  }
];

// ============================================================================
// 12. REGULATORY & ROAD CONDITIONS OBSERVATIONS (Explicit Non-Commercial Intel)
// ============================================================================
export const initialRegulatoryConditions: RegulatoryRoadCondition[] = [
  {
    id: 'REG-001',
    sector: 'Road Access & Checkpoints',
    title: 'Wadi Feiran & St. Catherine Mountain Pass',
    titleAr: 'طريق وادي فيران وممر جبل سانت كاترين',
    statusObserved: 'Normal Open',
    source: 'Sinai Security & Highway Operations',
    sourceUrl: 'https://traffic.southsinai.gov.eg/feiran-pass',
    observedAt: '2026-08-25T12:00:00Z',
    fetchedAt: '2026-08-25T12:05:00Z',
    freshness: 'Fresh (<3h)',
    confidence: 98,
    verificationStatus: 'Verified by Sinai Ops',
    impactOnBookings: 'None',
    notes: 'All tourist minivans and safari 4x4s cleared for regular checkpoint passage with standard travel manifests.'
  },
  {
    id: 'REG-002',
    sector: 'Marine & Reef Protected Zones',
    title: 'Ras Abu Galum Speedboat Corridor Swell Advisory',
    titleAr: 'تنبيه حركة لانشات رأس أبو جالوم في بحر الشمال',
    statusObserved: 'Delays / Swell Warning',
    source: 'CDWS Marine Safety & Weather Feed',
    sourceUrl: 'https://cdws.travel/safety/sea-state-southsinai',
    observedAt: '2026-08-25T13:30:00Z',
    fetchedAt: '2026-08-25T13:35:00Z',
    freshness: 'Fresh (<2h)',
    confidence: 95,
    verificationStatus: 'Actioned in Traveler Advisories',
    impactOnBookings: 'Manual Traveler Advisory',
    notes: 'Wind speed 16-18 knots. Speedboats operating normally; passengers advised of spray. Camel coastal track recommended as alternative.'
  },
  {
    id: 'REG-003',
    sector: 'Mountain & Desert Trekking Permits',
    title: 'Mount Moses Summit Bedouin Guide Escort Requirement',
    titleAr: 'إلزامية المرافق البدوي لصعود قمة جبل موسى',
    statusObserved: 'Permit Check Required',
    source: 'St. Catherine National Park Authority',
    sourceUrl: 'https://parks.southsinai.gov.eg/st-catherine-regulations',
    observedAt: '2026-08-24T18:00:00Z',
    fetchedAt: '2026-08-24T18:10:00Z',
    freshness: 'Fresh (<24h)',
    confidence: 100,
    verificationStatus: 'Verified by Sinai Ops',
    impactOnBookings: 'None',
    notes: 'Mandatory licensed local Bedouin guide per group of max 8 travelers strictly enforced at Monastery gate check.'
  }
];

// ============================================================================
// 13. AUTHORITATIVE SUPPLIERS (Authoritative Supplier OS Partner Registry)
// (Created ONLY after full Ops review and verification from Candidate pipeline)
// ============================================================================
export const initialAuthoritativeSuppliers: AuthoritativeSupplier[] = [
  {
    id: 'SUP-SHUTTLE-01',
    businessName: 'Sinai Shuttle Fleet',
    businessNameAr: 'أسطول سيناء للنقل السياحي',
    category: 'Transfers & Logistics',
    area: 'Sharm Airport & Dahab',
    leadContact: 'Captain Hany (+20 100 234 5678)',
    licenseNumber: 'MOT-TRANSPORT-#9921',
    tier: 'Tier 3 Premium Sinai Partner',
    status: 'Active',
    rating: 4.96,
    reviewCount: 184,
    onboardedAt: '2026-06-15',
    approvedBy: 'Sinai Operations Lead',
    provenanceSignature: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    linkedCandidateId: 'DSC-000-HISTORIC',
    activeRequestsCount: 1,
    capacitySummary: '6 Vehicles · 36 Seats Daily Capacity',
    initialSlots: [
      { time: '09:00 AM', title: 'Morning Airport Transfer Slot', booked: 4, total: 6, notes: '2 Seats Available' },
      { time: '14:00 PM', title: 'Afternoon Transfer Slot', booked: 2, total: 6, notes: '4 Seats Available' },
      { time: '17:30 PM', title: 'Sunset Transfer Slot', booked: 6, total: 6, notes: 'Capacity Locked (Full)' }
    ],
    roster: [
      { name: 'Captain Hany', role: 'Fleet Lead Driver', status: 'Assigned (HiAce #892)', license: 'Commercial Class 1 #4892' },
      { name: 'Captain Tarek', role: 'Airport Shuttle Driver', status: 'Available (H1 #401)', license: 'Commercial Class 1 #5190' }
    ],
    auditLog: [
      { timestamp: '2026-06-15 10:00:00', actor: 'Operations Lead (ahmed.ops@dahab.live)', action: 'SUPPLIER_ONBOARDED', notes: 'Ministry of Tourism certificate validated. Onboarding credentials issued.' }
    ]
  },
  {
    id: 'SUP-DIVE-02',
    businessName: 'Sinai Divers Center',
    businessNameAr: 'مركز سيناء للغوص',
    category: 'Diving & Watersports',
    area: 'Lighthouse & Canyon',
    leadContact: 'Dive Master Omar Soliman (+20 114 555 8899)',
    licenseNumber: 'CDWS-#1842',
    tier: 'Tier 3 Premium Sinai Partner',
    status: 'Active',
    rating: 4.94,
    reviewCount: 210,
    onboardedAt: '2026-07-01',
    approvedBy: 'Sinai Operations Lead',
    provenanceSignature: '7d793037a0760186574b0282f2f435e70d73a4e04d3eef552a0a224f488402f0',
    linkedCandidateId: 'DSC-001-HISTORIC',
    activeRequestsCount: 1,
    capacitySummary: '4 Daily Guided Dive Boats / Shore Excursions',
    initialSlots: [
      { time: '08:30 AM', title: 'Blue Hole & Bells 2-Tank Dive', booked: 8, total: 10, notes: '2 Spots Available' },
      { time: '13:30 PM', title: 'Canyon Guided Reef Dive', booked: 6, total: 8, notes: '2 Spots Available' }
    ],
    roster: [
      { name: 'Omar Soliman', role: 'Master Scuba Diver Trainer', status: 'Assigned to Canyon Dive', license: 'PADI MSDT #39102' },
      { name: 'Nour El-Din', role: 'Divemaster & Rescue Lead', status: 'Available', license: 'PADI DM #88291' }
    ],
    auditLog: [
      { timestamp: '2026-07-01 12:00:00', actor: 'Operations Lead (ahmed.ops@dahab.live)', action: 'SUPPLIER_ONBOARDED', notes: 'CDWS license and oxygen equipment inspection approved.' }
    ]
  },
  {
    id: 'SUP-CAMP-03',
    businessName: 'Wadi Qnai Bedouin Camp',
    businessNameAr: 'مخيم وادي قني البدوي',
    category: 'Desert Safari & Trekking',
    area: 'Wadi Qnai',
    leadContact: 'Sheikh Salem Abu Faraj (+20 102 990 4433)',
    licenseNumber: 'BEDOUIN-GUILD-SINAI-#019',
    tier: 'Tier 2 Certified',
    status: 'Active',
    rating: 4.98,
    reviewCount: 96,
    onboardedAt: '2026-07-20',
    approvedBy: 'Sinai Operations Lead',
    provenanceSignature: '1b852f1e6efd8ff2a02bf929d012ec3d126fc8f0814b7e8055621fb88f8d6d84',
    linkedCandidateId: 'DSC-002-HISTORIC',
    activeRequestsCount: 0,
    capacitySummary: '40 Pax Bedouin Dinner & Stargazing majlis',
    initialSlots: [
      { time: '18:30 PM', title: 'Sunset Tea & Traditional Bedouin Dinner', booked: 18, total: 30, notes: '12 Seats Available' }
    ],
    roster: [
      { name: 'Sheikh Salem', role: 'Cultural Host & Storyteller', status: 'Host Active', license: 'Sinai Cultural Heritage Roster #12' },
      { name: 'Mousa Salem', role: 'Desert Safari Guide', status: 'Standby 4x4', license: 'Desert Navigation Permit #88' }
    ],
    auditLog: [
      { timestamp: '2026-07-20 15:30:00', actor: 'Operations Lead (ahmed.ops@dahab.live)', action: 'SUPPLIER_ONBOARDED', notes: 'Bedouin tribal elder agreement signed. Traditional dinner experience verified.' }
    ]
  }
];

// ============================================================================
// 14. PRICING & MERCHANDISING DECISIONS (Intelligence Proposes → Human Approves)
// ============================================================================
export const initialPricingDecisions: PricingDecisionAction[] = [
  {
    id: 'PRC-DEC-001',
    observationId: 'CMP-001',
    competitorName: 'Sinai Horizon Excursions (OTA)',
    serviceTitle: 'Blue Hole & Canyon Guided Snorkel with Lunch',
    observedPriceEGP: 900,
    currentPlatformPriceEGP: 820,
    recommendedAction: 'MERCHANDISING_HIGHLIGHT',
    rationale: 'Competitor increased tariff from 750 to 900 EGP. Platform rate of 820 EGP offers superior value with instant booking. Recommending "Guaranteed Fair Price" badge on booking screens.',
    status: 'PROPOSED',
    merchandisingBadge: 'Best Local Value (820 EGP Guaranteed)'
  },
  {
    id: 'PRC-DEC-002',
    observationId: 'CMP-002',
    competitorName: 'Red Sea Wheels & Shuttle',
    serviceTitle: 'Private Sharm Airport (SSH) ↔ Dahab Hotel Transfer',
    observedPriceEGP: 1650,
    currentPlatformPriceEGP: 1450,
    recommendedAction: 'MAINTAIN_CURRENT',
    rationale: 'Our direct partner fleet contract provides 1,450 EGP with flight delay adjustment. Maintain tariff and emphasize flight tracking guarantee in pre-arrival cards.',
    authorizedBy: 'Ops Pricing Desk (sarah.pricing@dahab.live)',
    authorizedAt: '2026-08-25 14:00:00',
    status: 'APPROVED',
    merchandisingBadge: 'Flight-Delay Shield Included'
  }
];

// ============================================================================
// 15. CONTENT-TO-PRODUCT BRIDGES (Traveler Intent → Product Surface)
// ============================================================================
export const initialContentBridges: ContentProductBridge[] = [
  {
    id: 'CPB-001',
    queryId: 'CNT-903',
    questionTopic: 'How to get from Sharm Airport to Dahab without getting scammed?',
    travelerIntent: 'Arrival Friction',
    confidenceScore: 91,
    contentOpportunity: 'Airport Arrival Cost Breakdown & Transparency Guide',
    productOpportunity: 'Pre-Arrival Briefing & One-Click Flight-Synced Transfer Booking',
    targetSurfaces: ['PreArrivalBriefing', 'EarlyArrivalView', 'AIDirector'],
    status: 'ADOPTED',
    adoptedBy: 'Product Lead (hassan.product@dahab.live)',
    adoptedAt: '2026-08-25 12:30:00',
    customerFacingOutcome: 'PreArrivalBriefing component features guaranteed 1,450 EGP Airport Transfer card with driver flight tracking.'
  },
  {
    id: 'CPB-002',
    queryId: 'CNT-901',
    questionTopic: 'Is Dahab safe for solo female travelers in 2026?',
    travelerIntent: 'Safety Anxiety',
    confidenceScore: 94,
    contentOpportunity: 'Verified Solo Female Guide & Well-Lit Evening Walking Routes',
    productOpportunity: 'AI Director Safety Curations & Verified Bedouin Host Badges',
    targetSurfaces: ['AIDirector', 'Explorer'],
    status: 'PROPOSED',
    customerFacingOutcome: 'Proposal to add "Solo-Friendly & Verified Host" filter tag across Explorer activities.'
  }
];

// ============================================================================
// 16. REGULATORY & CHECKPOINT GOVERNANCE AUDIT MATRIX
// ============================================================================
export const initialRegulatoryAudits: RegulatoryGovernanceAudit[] = [
  {
    signalId: 'REG-001',
    corridorOrArea: 'Wadi Feiran & St. Catherine Mountain Pass',
    authoritativeSource: 'Sinai Security & Highway Operations Department',
    freshnessSLA: '3 Hours (< 180 min)',
    verificationStatus: 'Verified by Sinai Ops',
    escalationPolicy: 'Level 1 Notice: Standard tourist minivans cleared. Ops monitor checkpoint queue length.',
    allowedDownstreamConsumers: ['Ops Console Dispatch', 'Trip Overview Timeline', 'AI Director Road Guidance'],
    preventedAutomatedActions: ['Automatic St. Catherine trip cancellation', 'Unverified refund dispatch'],
    customerFacingWording: 'Roads to St. Catherine are fully open. Minivans moving on regular schedules with security checkpoints.',
    fallbackWhenStale: 'Display "Highway status verified at [Timestamp]; check with Ops Desk for real-time mountain passes."'
  },
  {
    signalId: 'REG-002',
    corridorOrArea: 'Ras Abu Galum Speedboat Corridor',
    authoritativeSource: 'CDWS Marine Safety & South Sinai Weather Feed',
    freshnessSLA: '2 Hours (< 120 min)',
    verificationStatus: 'Actioned in Traveler Advisories',
    escalationPolicy: 'Level 2 Advisory: 16-18kt northern swell. Trigger customer-facing sea spray advisory and recommend camel alternative.',
    allowedDownstreamConsumers: ['Companion Day 2 View', 'WhatShouldIDoNow Recommendation Engine', 'Ops Exceptions Queue'],
    preventedAutomatedActions: ['Direct boat booking cancellation without partner captain confirmation', 'Automatic chargeback'],
    customerFacingWording: 'Moderate swell today on the northern sea corridor. Speedboats operating normally; camel coastal trail available if preferred.',
    fallbackWhenStale: 'Fallback to official CDWS morning marine broadcast table.'
  },
  {
    signalId: 'REG-003',
    corridorOrArea: 'Mount Moses Summit Trail',
    authoritativeSource: 'St. Catherine Protected Area Authority',
    freshnessSLA: '24 Hours',
    verificationStatus: 'Verified by Sinai Ops',
    escalationPolicy: 'Level 1 Regulatory Compliance: Mandatory Bedouin escort per group enforced at gate.',
    allowedDownstreamConsumers: ['Booking Flow Inclusions', 'Pre-Trip Briefing Packing List'],
    preventedAutomatedActions: ['Independent unescorted ticket sales'],
    customerFacingWording: 'All summit ascents include an official licensed Bedouin mountain guide from the local Jebeliya tribe.',
    fallbackWhenStale: 'Maintain strict Bedouin guide inclusion policy by default.'
  }
];

// ============================================================================
// 17. EXISTING DAHAB FEATURE REGISTER (Platform Catalog for Opportunity Linking)
// ============================================================================
export const initialFeatureRegister: FeatureRegisterItem[] = [
  {
    id: 'FEAT-ARRIVE-RESCUE',
    title: 'Early Arrival & Luggage Storage Hub',
    titleAr: 'منظومة الوصول المبكر وحفظ الأمتعة',
    category: 'Arrival Experience',
    currentStatus: 'In Production',
    componentRoute: '/arrive',
    description: 'Provides travelers arriving on overnight Cairo/SSH buses with secure luggage check, cafe passes, shower access, and first 2-hour morning plans.',
    descriptionAr: 'توفر للمسافرين الواصلين فجراً عبر حافلات القاهرة وشرم الشيخ إمكانية حفظ الأمتعة وقسائم الإفطار وخطة الساعتين الأولى.',
    keyMetricsTracked: ['Day 1 Arrival CSAT', 'Luggage Pass Redemptions', 'Early Cafe Ancillary Spend'],
    ownerTeam: 'Sinai Experience & Hospitality Squad'
  },
  {
    id: 'FEAT-WIND-SWELL',
    title: 'Real-Time Marine Swell & Kite-Wind Forecaster',
    titleAr: 'راصد الأمواج والرياح البحرية اللحظي',
    category: 'Diving & Safety',
    currentStatus: 'In Production',
    componentRoute: '/live',
    description: 'Live sensor telemetry and CDWS wind warning alerts for Blue Hole, Lighthouse, and Lagoona kitesurfing.',
    descriptionAr: 'رصد فوري لبيانات الأمواج وسرعة الرياح بالبلو هول واللايتهاوس وبحيرة اللاجونا لركوب الأمواج.',
    keyMetricsTracked: ['Marine Incident Zero-Rate', 'Alternative Booking Acceptance Rate', 'Safety Advisory Views'],
    ownerTeam: 'Diving Operations & Safety Bureau'
  },
  {
    id: 'FEAT-SAFETY-BRIEF',
    title: 'Pre-Arrival Sea & Checkpoint Safety Briefing',
    titleAr: 'إحاطة الأمان والسلامة البحرية والكمائن قبل الوصول',
    category: 'Diving & Safety',
    currentStatus: 'In Production',
    componentRoute: '/prepare',
    description: 'Pre-trip digital briefing covering Dahab checkpoint passport regulations, reef-safe sunscreen, taxi fare guidelines, and emergency contacts.',
    descriptionAr: 'إحاطة إلكترونية قبل الرحلة حول إجراءات كمائن سيناء، إرشادات حماية الشعاب، وتسعيرة التاكسي.',
    keyMetricsTracked: ['Briefing Completion %', 'Checkpoint Incident Rate', 'Traveler Confidence Score'],
    ownerTeam: 'Compliance & Safety Desk'
  },
  {
    id: 'FEAT-SUPPLIER-ONBOARD',
    title: 'Supplier OS Self-Service Verification Desk',
    titleAr: 'بوابة توثيق واعتماد الموردين في نظام الموردين',
    category: 'Logistics & Transfers',
    currentStatus: 'In Production',
    componentRoute: '/supplier-portal',
    description: 'Multi-stage compliance portal allowing Sinai dive centers, desert guides, and drivers to submit CDWS and MOT credentials.',
    descriptionAr: 'منظومة متعددة المراحل تتيح لمراكز الغوص وأدلة الصحراء وسائقي النقل رفع رخص غرفة الغوص ووزارة السياحة.',
    keyMetricsTracked: ['Supplier Onboarding Cycle Time', 'Compliance Verification Accuracy', 'Active Partner Retention'],
    ownerTeam: 'Supplier Network Operations'
  },
  {
    id: 'FEAT-PRICING-DESK',
    title: 'Competitive Market Pricing & Merchandising Desk',
    titleAr: 'مكتب تسعير وترويج السوق التنافسي',
    category: 'Pricing & Merchandising',
    currentStatus: 'In Production',
    componentRoute: '/market-intelligence',
    description: 'Enables Ops leads to review competitor tariffs, verify FX drift, and authorize market transparency badges without automated price changes.',
    descriptionAr: 'يتيح لمديري العمليات مراجعة تسعيرات المنافسين، ومراجعة تقلبات العملة، واعتماد شارات الشفافية السعرية.',
    keyMetricsTracked: ['Direct Booking Conversion', 'Price Perception Index', 'Market Competitiveness Score'],
    ownerTeam: 'Revenue & Merchandising Desk'
  },
  {
    id: 'FEAT-COMPANION-DAY2',
    title: 'Dynamic Journey Companion & Day Planner',
    titleAr: 'الرفيق الرقمي الذكي للرحلة وخطة اليوم',
    category: 'Dahab Companion AI',
    currentStatus: 'In Production',
    componentRoute: '/my-trip',
    description: 'Real-time timeline companion adapting to traveler pace, meal timings, dive surface intervals, and sunset hours.',
    descriptionAr: 'رفيق رقمي يواكب رحلة المسافر خطوة بخطوة ويتكيف مع فترات الراحة بين الغطسات ومواعيد الغروب.',
    keyMetricsTracked: ['Daily Companion Active Users (DAU)', 'Itinerary Adherence %', 'In-Trip Spontaneous Additions'],
    ownerTeam: 'Core Product & AI Squad'
  },
  {
    id: 'FEAT-CHANGE-RECOVERY',
    title: 'Disruption Recovery & Weather Mutation Engine',
    titleAr: 'محرك التعافي الفوري وإعادة الجدولة عند الطوارئ',
    category: 'Logistics & Transfers',
    currentStatus: 'In Production',
    componentRoute: '/change-recovery',
    description: 'One-click smart alternative dispatch when sea swells or road closures impact scheduled activities.',
    descriptionAr: 'إعادة توجيه واقتراح بدائل فورية بنقرة واحدة عند تأثر الأنشطة بتقلبات الطقس أو حالة الطرق.',
    keyMetricsTracked: ['Recovery Resolution Time (<5m)', 'Traveler Retention on Disruption', 'Refund Avoidance %'],
    ownerTeam: 'Sinai Dispatch & Operations'
  },
  {
    id: 'FEAT-BEDOUIN-STAR',
    title: 'Bedouin Mountain Dinner & Stargazing Experience',
    titleAr: 'سهرة العشاء البدوي ورصد النجوم في جبال دهب',
    category: 'Desert Safari & Culture',
    currentStatus: 'In Production',
    componentRoute: '/explore',
    description: 'Authentic candlelit mountain dining in Wadi Qnai with local Bedouin hosts, telescope astronomy, and herbal Bedouin tea.',
    descriptionAr: 'عشاء جبلي أصيل على ضوء الشموع في وادي قني مع ضيافة بدوية وشاي المرمية ورصد فلكي للنجوم.',
    keyMetricsTracked: ['Bedouin Partner Revenue Share', 'Cultural NPS Score', 'Night Booking Growth %'],
    ownerTeam: 'Sinai Heritage & Community Guild'
  }
];

// ============================================================================
// 18. INITIAL PRODUCT OPPORTUNITIES (Connecting Intelligence → Product Action)
// ============================================================================
export const initialOpportunities: ProductOpportunity[] = [
  {
    id: 'OPP-001',
    title: 'Early Arrival Luggage Storage & Morning Rescue Pass',
    titleAr: 'منظومة حفظ الأمتعة وباقة الوصول المبكر للمسافرين',
    summary: 'Travelers arriving on 06:00-09:00 AM Cairo/Sharm night buses experience 4-5 hours of unguided dead time before hotel check-in (14:00/15:00) with heavy baggage.',
    summaryAr: 'المسافرون القادمون بحافلات الليل بين ٦ و٩ صباحاً يعانون من ٤-٥ ساعات انتظار حتى موعد تسليم الفندق (٢ ظهراً) مع حقائب ثقيلة.',
    productArea: 'Arrival Experience',
    suggestedAction: 'Enhance Pre-Arrival Briefing & Early Arrival Rescue Hub to offer instant QR luggage storage passes at Lighthouse seaside cafes with complimentary breakfast options.',
    suggestedActionAr: 'تعزيز إحاطة ما قبل الوصول وبوابة الوصول المبكر ببطاقة فورية لحفظ الحقائب في مقاهي اللايتهاوس مع خيارات الإفطار.',
    confidenceScore: 0.91,
    freshness: '3 days ago',
    evidenceCount: 27,
    linkedSignalIds: ['TRND-001', 'REV-003', 'OBS-008'],
    linkedSignalSources: ['Google Maps Search & Reviews', 'Traveler Search Intelligence', 'TripAdvisor Reviews'],
    status: 'Proposed',
    statusHistory: [
      {
        status: 'Detected',
        timestamp: '2026-08-20 09:14:00',
        actor: 'Intelligence Ingestion Stream',
        notes: '27 recurring search and review friction points detected regarding luggage check-in gap.'
      },
      {
        status: 'Qualified',
        timestamp: '2026-08-21 11:30:00',
        actor: 'AI Product Classifier (Gemini)',
        notes: 'Confidence score 0.91 validated with no existing unresolved duplicate opportunity.'
      },
      {
        status: 'Proposed',
        timestamp: '2026-08-22 14:00:00',
        actor: 'AI Opportunity Synthesizer',
        notes: 'Drafted hypothesis and identified FEAT-ARRIVE-RESCUE in existing Feature Register.'
      }
    ],
    hypothesis: {
      targetUser: 'Travelers arriving on overnight buses or early morning transfers before 11:00 AM',
      intervention: 'Push Early Arrival Rescue Pass with Blue Beach Club / Everyday Cafe luggage drop in Pre-Arrival Briefing.',
      primaryMetric: 'Day 1 Traveler Arrival Satisfaction (CSAT)',
      secondaryMetric: 'Early Morning Cafe Ancillary Revenue per Traveler',
      baselineValue: '82% CSAT · 0 EGP ancillary spend',
      targetValue: '≥ 94% CSAT · 180 EGP average ancillary breakfast spend',
      evaluationWindowDays: 14,
      successCriteria: 'Achieve ≥92% arrival satisfaction and >65% pass activation rate among morning bus arrivals.',
      outcomeStatus: 'Pending Measurement'
    },
    aiDrafted: true,
    provenanceHash: 'SHA256:8f4c29a8e932b1049c81e9f1938a427189b2ce71934981ad'
  },
  {
    id: 'OPP-002',
    title: 'Fast-Track Vetting for Discovered Eco Sinai Freedivers Candidate',
    titleAr: 'تسريع توثيق واعتماد مركز إيكو سيناء للغوص الحر المكتشف',
    summary: 'Discovered candidate Eco Sinai Free Divers has 18 verified positive reviews and 4.9 rating on Lighthouse reef with CDWS registration detected.',
    summaryAr: 'مرشح جديد مكتشف (إيكو سيناء للغوص الحر) يمتلك ١٨ تقييماً إيجابياً وتصنيف ٤.٩ في اللايتهاوس مع رخصة معتمدة من غرفة الغوص.',
    productArea: 'Diving & Safety',
    suggestedAction: 'Route discovered candidate DISC-SUP-002 through Supplier OS compliance verification desk for authoritative partner activation.',
    suggestedActionAr: 'تمرير المرشح المكتشف عبر مكتب توثيق نظام الموردين لاعتماده رسمياً كشريك موثوق.',
    confidenceScore: 0.88,
    freshness: '1 day ago',
    evidenceCount: 18,
    linkedSignalIds: ['DISC-SUP-002', 'OBS-002', 'REV-004'],
    linkedSignalSources: ['Google Maps Places', 'CDWS Registry Feed', 'Local Dive Directory'],
    status: 'Qualified',
    statusHistory: [
      {
        status: 'Detected',
        timestamp: '2026-08-23 08:30:00',
        actor: 'Crawler Job CRW-8902',
        notes: 'Discovered high-performing freediving candidate in Lighthouse corridor.'
      },
      {
        status: 'Qualified',
        timestamp: '2026-08-24 10:15:00',
        actor: 'Entity Resolution Engine',
        notes: 'Confidence score 0.88, CDWS license detected, ready for Ops Lead review.'
      }
    ],
    hypothesis: {
      targetUser: 'Adventure travelers and freediving enthusiasts looking for certified depth training',
      intervention: 'Onboard Eco Sinai Free Divers into Supplier OS to offer direct verified freediving slot bookings.',
      primaryMetric: 'Freediving Booking Conversion Rate',
      secondaryMetric: 'Supplier Response Time SLA',
      baselineValue: '12% conversion · N/A',
      targetValue: '≥ 22% conversion · < 15 min confirmation time',
      evaluationWindowDays: 30,
      successCriteria: 'Zero safety incidents and ≥ 4.8 customer rating over first 20 guided freedive sessions.',
      outcomeStatus: 'Pending Measurement'
    },
    aiDrafted: true,
    provenanceHash: 'SHA256:91b8a74e237cb1049281a8c9e018a427189b2ce71934981ce'
  },
  {
    id: 'OPP-003',
    title: 'Ras Abu Galum Camel Coastal Alternative Smart Swell Prompt',
    titleAr: 'تنبيه ذكي لاقتراح مسار الجمال الساحلي عند ارتفاع أمواج أبو جالوم',
    summary: 'Marine swell conditions (16-18kt northern winds) cause periodic speedboat transit delays between Blue Hole and Ras Abu Galum.',
    summaryAr: 'الأمواج الشمالية (١٦-١٨ عقدة) تتسبب في تأخير القوارب السريعة بين البلو هول ورأس أبو جالوم.',
    productArea: 'Logistics & Transfers',
    suggestedAction: 'Link real-time swell radar to Companion Day 2 & Change Recovery to proactively propose Bedouin camel coastal trail before travelers reach the jetty.',
    suggestedActionAr: 'ربط راصد الأمواج بالرفيق الذكي ومحرك التعافي لاقتراح مسار الجمال البديل استباقياً قبل وصول المسافر للمرسى.',
    confidenceScore: 0.94,
    freshness: '2 hours ago',
    evidenceCount: 14,
    linkedSignalIds: ['REG-002', 'REV-001', 'EXC-104'],
    linkedSignalSources: ['CDWS Marine Safety Feed', 'TripAdvisor Reviews', 'Live Operations Exceptions Queue'],
    status: 'Accepted',
    statusHistory: [
      {
        status: 'Detected',
        timestamp: '2026-08-24 07:00:00',
        actor: 'Sinai Marine Safety Feed',
        notes: '18kt swell advisory logged for northern gulf corridor.'
      },
      {
        status: 'Proposed',
        timestamp: '2026-08-24 08:30:00',
        actor: 'AI Product Classifier',
        notes: 'Drafted proactive alternative routing opportunity.'
      },
      {
        status: 'Accepted',
        timestamp: '2026-08-24 09:15:00',
        actor: 'Ops Console (Agent #04)',
        notes: 'Accepted and linked to FEAT-CHANGE-RECOVERY.'
      }
    ],
    decision: {
      decision: 'Accepted',
      decidedByRole: 'Ops Manager',
      decidedByEmail: 'ops.manager@dahab.travel',
      decidedAt: '2026-08-24 09:15:00',
      rationale: 'Proactive camel alternative avoids traveler frustration and supports local Bedouin camel guides.',
      linkedSystem: 'Feature Register',
      linkedFeatureId: 'FEAT-CHANGE-RECOVERY'
    },
    hypothesis: {
      targetUser: 'Day 2 travelers scheduled for Ras Abu Galum during >15kt swell forecasts',
      intervention: 'Trigger automated notification with 1-click camel alternative and scenic coastal photo preview.',
      primaryMetric: 'Disruption Customer Dissatisfaction Rate',
      secondaryMetric: 'Bedouin Camel Guild Revenue Distribution',
      baselineValue: '18% dissatisfaction · 4,200 EGP guild volume',
      targetValue: '< 3% dissatisfaction · ≥ 9,800 EGP guild volume',
      evaluationWindowDays: 14,
      successCriteria: 'Over 80% alternative acceptance rate with zero negative reviews regarding sea transit delays.',
      outcomeStatus: 'Validated',
      measuredPrimaryValue: '1.8% dissatisfaction (Target: < 3%)',
      measuredSecondaryValue: '11,400 EGP guild volume (Target: ≥ 9,800 EGP)',
      outcomeNotes: 'Validated during windy weekend; travelers praised the authentic Bedouin coastal trail.',
      outcomeRecordedAt: '2026-08-25 14:30:00',
      outcomeRecordedBy: 'Sinai Product Lead'
    },
    aiDrafted: true,
    provenanceHash: 'SHA256:71a0e84b237cb1049281a8c9e018a427189b2ce71934981fa'
  },
  {
    id: 'OPP-004',
    title: 'Lighthouse Guided Shore Dive Tariff Transparency Badge',
    titleAr: 'شارة الشفافية السعرية لغوص الشاطئ باللايتهاوس',
    summary: 'Market price index PRC-001 reveals competitor off-platform quotes ranging 1,200 - 1,600 EGP for guided shore dives, while Dahab platform direct rate is 1,350 EGP with full equipment included.',
    summaryAr: 'مؤشر أسعار السوق يوضح أن الأسعار الخارجية تتراوح بين ١٢٠٠-١٦٠٠ جنيه بينما سعر المنصة المباشر ١٣٥٠ شامل المعدات.',
    productArea: 'Pricing & Merchandising',
    suggestedAction: 'Display "All-Inclusive Certified Dive Tariff" badge on Lighthouse dive cards in Explore & Trip Planner.',
    suggestedActionAr: 'عرض شارة "سعر غوص شامل المعدات والتأمين" على بطاقات غوص اللايتهاوس في المستكشف ومخطط الرحلة.',
    confidenceScore: 0.86,
    freshness: '4 hours ago',
    evidenceCount: 32,
    linkedSignalIds: ['PRC-001', 'COMP-001', 'OBS-001'],
    linkedSignalSources: ['Competitor Price Monitor', 'Local Dive Centers Rate Sheet', 'Google Maps'],
    status: 'Implemented',
    statusHistory: [
      {
        status: 'Detected',
        timestamp: '2026-08-22 10:00:00',
        actor: 'Price Intelligence Scanner',
        notes: 'Price disparity and hidden equipment fee patterns identified.'
      },
      {
        status: 'Accepted',
        timestamp: '2026-08-23 11:00:00',
        actor: 'Revenue & Merchandising Desk',
        notes: 'Approved badge placement without mutating base platform price.'
      },
      {
        status: 'Implemented',
        timestamp: '2026-08-23 15:30:00',
        actor: 'Sinai Product Lead',
        notes: 'Badge enabled across dive cards via FEAT-PRICING-DESK.'
      }
    ],
    decision: {
      decision: 'Accepted',
      decidedByRole: 'Head of Growth',
      decidedByEmail: 'growth@dahab.travel',
      decidedAt: '2026-08-23 11:00:00',
      rationale: 'Transparency badge highlights equipment inclusions without entering a destructive race to the bottom.',
      linkedSystem: 'Pricing Desk',
      linkedFeatureId: 'FEAT-PRICING-DESK'
    },
    hypothesis: {
      targetUser: 'Travelers comparing dive rates across external OTAs vs Dahab direct booking',
      intervention: 'Add transparency badge showing "No Hidden Gear Fees · CDWS Certified Guide Included".',
      primaryMetric: 'Lighthouse Shore Dive Booking Conversion',
      secondaryMetric: 'Price Inquiry Support Tickets',
      baselineValue: '14.2% conversion · 18 tickets/week',
      targetValue: '≥ 20.0% conversion · ≤ 5 tickets/week',
      evaluationWindowDays: 21,
      successCriteria: 'Conversion exceeds 18% with zero traveler complaints regarding unexpected on-site equipment rental costs.',
      outcomeStatus: 'Pending Measurement'
    },
    aiDrafted: true,
    provenanceHash: 'SHA256:44b1c83d997cb1049281a8c9e018a427189b2ce71934981aa'
  },
  {
    id: 'OPP-005',
    title: 'Wadi Qnai Bedouin Night Dinner & Telescope Stargazing Package',
    titleAr: 'باقة العشاء البدوي الجبلي ورصد النجوم التلسكوبي بوادي قني',
    summary: 'Traveler search trend TRND-003 shows +62% search volume for unpolluted desert stargazing and candlelit mountain dining in Dahab.',
    summaryAr: 'اتجاهات بحث المسافرين تظهر زيادة ٦٢٪ في البحث عن سهرات رصد النجوم والعشاء البدوي الخالي من التلوث الضوئي.',
    productArea: 'Desert Safari & Culture',
    suggestedAction: 'Link search interest to FEAT-BEDOUIN-STAR with high-definition astronomy photos and official Jebeliya Bedouin storyteller hosts in Explore.',
    suggestedActionAr: 'ربط الاهتمام بالبحث بميزة العشاء البدوي مع صور فلكية عالية الدقة واستضافة أدلة قبيلة الجبلية.',
    confidenceScore: 0.84,
    freshness: '2 days ago',
    evidenceCount: 19,
    linkedSignalIds: ['TRND-003', 'OBS-007', 'REV-005'],
    linkedSignalSources: ['Traveler Search Trends', 'Instagram Location Aggregations', 'Google Reviews'],
    status: 'Proposed',
    statusHistory: [
      {
        status: 'Detected',
        timestamp: '2026-08-21 16:00:00',
        actor: 'Search Trend Ingestion',
        notes: 'Spike in night sky and desert campfire queries.'
      },
      {
        status: 'Proposed',
        timestamp: '2026-08-22 10:00:00',
        actor: 'AI Product Classifier',
        notes: 'Connected to existing feature FEAT-BEDOUIN-STAR in Feature Register.'
      }
    ],
    hypothesis: {
      targetUser: 'Couples and cultural travelers looking for authentic evening experiences outside the main promenade',
      intervention: 'Feature Wadi Qnai Stargazing in AI Director evening recommendations and Trip Planner Day 2 dinner slot.',
      primaryMetric: 'Evening Desert Activity Bookings',
      secondaryMetric: 'Bedouin Host Community Earnings',
      baselineValue: '8 bookings/week · 11,200 EGP weekly',
      targetValue: '≥ 24 bookings/week · ≥ 33,600 EGP weekly',
      evaluationWindowDays: 30,
      successCriteria: 'Generate >20 weekly bookings with an average cultural appreciation review score ≥ 4.9/5.0.',
      outcomeStatus: 'Pending Measurement'
    },
    aiDrafted: true,
    provenanceHash: 'SHA256:19c2f74a887cb1049281a8c9e018a427189b2ce71934981ee'
  }
];



