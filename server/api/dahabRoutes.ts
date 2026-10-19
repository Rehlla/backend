import {
  CURATED_STORIES,
  GALLERY_PHOTOS
} from '../db/seeds/editorialContent';
import { contentProgrammes } from '../services/contentProgrammesService';
import { Router, Response } from 'express';
import { priceBandMatches } from '../../src/shared/priceBand';
import { normalizeDiningVenue } from '../../src/shared/diningVenue';
import {
  stringParam,
  enumParam,
  InvalidQueryParameterError,
  VERIFICATION_LEVELS,
  PRICING_BASES,
  REVIEW_ISSUE_TYPES,
  REVIEW_STATUSES,
  SEVERITIES
} from '../middleware/queryParams';
import { dahabKnowledgeOs } from '../services/dahabKnowledgeOs';
import { buildAttractionCatalogue, filterAttractions, AttractionSort } from '../services/attractionsCatalogue';
import { unifiedSearchEngine, toSearchResultItems } from '../services/unifiedSearchEngine';
import { geointelligenceService } from '../services/geointelligenceService';
import { rankingEngine } from '../services/rankingEngine';
import { commerceIntelligenceService } from '../services/commerceIntelligenceService';
import { marketFreshnessService } from '../services/marketFreshnessService';
import { autonomousDataOpsService } from '../services/autonomousDataOpsService';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { db } from '../db/database';
import { resolveBookability } from '../services/bookabilityReconciler';
import { loadPlaceBrowse } from '../services/placeBrowseService';
import { BROWSE_DESTINATIONS, type BrowseKind } from '../../src/shared/placeBrowse';

import { MediaAssetService } from '../services/mediaAssetService';
import {
  getPublishedOverlays,
  applyPlaceOverlay,
  applyActivityOverlay,
  applyAreaOverlay,
  applyDiningOverlay,
  applyAttractionOverlays,
  type PublishedOverlay,
} from '../services/catalogContentService';

export const dahabRouter = Router();

/**
 * GET /api/dahab/media/sync
 * Sync and organize Dahab photography into public/images
 */
dahabRouter.get('/media/sync', (_req: AuthenticatedRequest, res: Response) => {
  const result = MediaAssetService.syncDahabMediaAssets();
  res.json({ status: 'success', ...result });
});

/**
 * Attaches what it takes to actually sell an activity.
 *
 * The catalogue used to hand out `skuId` and `bookingMode` and leave every
 * consumer to work out on its own whether either could be trusted — none could,
 * see bookabilityReconciler. `bookable` is the single answer: a resolved
 * product when one exists, null when the activity cannot be transacted online.
 *
 * `basePriceEGP` inside it is the SKU's, not the activity's, because that is
 * the amount checkout charges. The two disagree today: the Blue Hole activity
 * is priced 2,200 EGP in the corpus and SKU-DIV-002 sells it for 3,400.
 */
const withBookability = <T extends { skuId?: string }>(activity: T) => ({
  ...activity,
  bookable: resolveBookability(activity.skuId)
});

/**
 * Published CMS copy/imagery overlays for DKOS reads. Each helper batches one
 * indexed query per entity kind and returns views UNCHANGED when nothing is
 * published, so responses are identical until an editor publishes.
 */
function overlayById<T extends { id: string }>(
  kind: 'place' | 'activity' | 'area' | 'dining_venue',
  views: T[],
  apply: (view: T, overlay: PublishedOverlay | null) => T
): T[] {
  if (!views || views.length === 0) return views;
  try {
    const map = getPublishedOverlays(kind, views.map(v => v?.id).filter(Boolean));
    let touched = false;
    const next = views.map(v => {
      const overlay = v?.id ? map[v.id] ?? null : null;
      if (overlay) touched = true;
      return overlay ? apply(v, overlay) : v;
    });
    return touched ? next : views;
  } catch {
    return views;
  }
}

const withPlaceOverlays = <T extends { id: string }>(views: T[]): T[] =>
  overlayById('place', views, applyPlaceOverlay);
const withActivityOverlays = <T extends { id: string }>(views: T[]): T[] =>
  overlayById('activity', views, applyActivityOverlay);
const withAreaOverlays = <T extends { id: string }>(views: T[]): T[] =>
  overlayById('area', views, applyAreaOverlay);
const withDiningOverlays = <T extends { id: string }>(views: T[]): T[] =>
  overlayById('dining_venue', views, applyDiningOverlay);

/**
 * GET /api/dahab/context
 * Primary overview of Dahab conditions, areas, and top highlights
 */
dahabRouter.get('/context', (req: AuthenticatedRequest, res: Response) => {
  const conditions = dahabKnowledgeOs.getLiveConditions();
  const areas = withAreaOverlays(dahabKnowledgeOs.getAllAreas());
  const highlights = withActivityOverlays(db.activities.slice(0, 4).map(withBookability));

  res.json({
    status: 'success',
    destination: 'Dahab, South Sinai',
    conditions,
    areas,
    highlights,
    timestamp: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/search
 * Natural Language Unified Search Engine
 * e.g. /api/dahab/search?q=أنا في اللايتهاوس ومعايا ساعتين وعايز حاجة هادية وبعدها أكل
 */
dahabRouter.get('/search', (req: AuthenticatedRequest, res: Response) => {
  const query = (req.query.q as string) || (req.query.query as string) || '';
  const max = Number(req.query.max) || 3;

  const result = unifiedSearchEngine.search(query, max);
  res.json({
    status: 'success',
    query,
    ...result,
    // Flat wire items for the SearchDrawer (it reads `results`; the rich
    // `recommendations` stay for detail consumers). Suggestions echo the
    // parsed interests so follow-up searches stay in-vocabulary.
    results: toSearchResultItems(result.recommendations),
    suggestions: result.parsedIntent.interests,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/areas
 * List all validated Dahab Area Profiles
 */
dahabRouter.get('/areas', (req: AuthenticatedRequest, res: Response) => {
  const areas = withAreaOverlays(dahabKnowledgeOs.getAllAreas());
  res.json({
    status: 'success',
    count: areas.length,
    areas,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/areas/:id
 */
dahabRouter.get('/areas/:id', (req: AuthenticatedRequest, res: Response) => {
  const area = dahabKnowledgeOs.getAreaProfile(req.params.id);
  if (!area) {
    return res.status(404).json({
      status: 'error',
      message: `Area '${req.params.id}' not found.`,
      correlationId: req.correlationId
    });
  }

  const places = db.places.filter(p => p.areaId.toLowerCase() === area.id.toLowerCase());
  const activities = db.activities.filter(a => a.areaId.toLowerCase() === area.id.toLowerCase());
  const dining = db.diningVenues.filter(d => d.areaId.toLowerCase() === area.id.toLowerCase());

  res.json({
    status: 'success',
    area: withAreaOverlays([area])[0],
    places: withPlaceOverlays(places),
    activities: withActivityOverlays(activities.map(withBookability)),
    dining: withDiningOverlays(dining),
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/places
 */
dahabRouter.get('/places', (req: AuthenticatedRequest, res: Response) => {
  const area = req.query.area as string;
  let places = db.places;
  if (area) {
    places = places.filter(p => p.areaId.toLowerCase() === area.toLowerCase());
  }

  res.json({
    status: 'success',
    count: places.length,
    places: withPlaceOverlays(places),
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/places/:id
 */
dahabRouter.get('/places/:id', (req: AuthenticatedRequest, res: Response) => {
  const place = db.places.find(p => p.id === req.params.id);
  if (!place) {
    return res.status(404).json({
      status: 'error',
      message: `Place '${req.params.id}' not found.`,
      correlationId: req.correlationId
    });
  }

  const facts = db.temporalFacts.filter(f => f.subjectId === place.id && f.status === 'CURRENT');

  res.json({
    status: 'success',
    place: withPlaceOverlays([place])[0],
    facts,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/activities
 */
dahabRouter.get('/activities', (req: AuthenticatedRequest, res: Response) => {
  const category = req.query.category as string;
  const area = req.query.area as string;

  let activities = db.activities;
  if (category) {
    activities = activities.filter(a => a.category.toLowerCase() === category.toLowerCase());
  }
  if (area) {
    activities = activities.filter(a => a.areaId.toLowerCase() === area.toLowerCase());
  }

  res.json({
    status: 'success',
    count: activities.length,
    activities: withActivityOverlays(activities.map(withBookability)),
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/activities/:id
 */
dahabRouter.get('/activities/:id', (req: AuthenticatedRequest, res: Response) => {
  const activity = db.activities.find(a => a.id === req.params.id || a.skuId === req.params.id);
  if (!activity) {
    return res.status(404).json({
      status: 'error',
      message: `Activity '${req.params.id}' not found.`,
      correlationId: req.correlationId
    });
  }

  res.json({
    status: 'success',
    activity: withActivityOverlays([withBookability(activity)])[0],
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/attractions
 *
 * Tripadvisor-style "Things to Do" directory: places (sights) + activities +
 * diving/safari providers merged into one ranked, bucketable catalogue. The
 * category rail (`?category=nature-wildlife,diving-snorkeling`) mirrors the
 * reference site's category drill-down; `sort` accepts top / rating / popular
 * / name / price with `order` asc|desc. Only the whitelisted supplier fields
 * are exposed — payout IBANs never cross this surface.
 */
dahabRouter.get('/attractions', (req: AuthenticatedRequest, res: Response) => {
  const category = req.query.category as string | undefined;
  const q = (req.query.q as string) || (req.query.query as string) || undefined;
  const area = req.query.area as string | undefined;
  const rawSort = (req.query.sort as string) || 'top';
  const sort: AttractionSort = ['top', 'rating', 'popular', 'name', 'price'].includes(rawSort)
    ? (rawSort as AttractionSort)
    : 'top';
  const order = req.query.order === 'asc' ? 'asc' : 'desc';

  const catalogue = buildAttractionCatalogue({
    places: db.places,
    activities: db.activities,
    suppliers: db.suppliers,
    areas: dahabKnowledgeOs.getAllAreas(),
    galleryPhotos: GALLERY_PHOTOS
  });

  const attractions = applyAttractionOverlays(filterAttractions(catalogue.attractions, { category, q, area, sort, order }));

  res.json({
    status: 'success',
    count: attractions.length,
    attractions,
    categories: catalogue.categories.filter(c => c.count > 0),
    filters: { category: category || '', q: q || '', area: area || '', sort, order },
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/food
 *
 * The restaurants directory filters and sorts against this endpoint. Filters
 * compose (area + cuisine + price band + query), and `sort` accepts
 * rating / popular / name with `order` asc|desc (default desc).
 */
dahabRouter.get('/food', (req: AuthenticatedRequest, res: Response) => {
  const area = req.query.area as string;
  const seafoodOnly = req.query.seafood === 'true';
  const cuisine = (req.query.cuisine as string) || '';
  const price = (req.query.price as string) || '';
  const query = ((req.query.q as string) || (req.query.query as string) || '').toLowerCase().trim();
  const sort = (req.query.sort as string) || 'default';
  const order = (req.query.order as string) === 'asc' ? 1 : -1;

  let venues = db.diningVenues;
  if (area) {
    venues = venues.filter(v => v.areaId.toLowerCase() === area.toLowerCase());
  }
  if (seafoodOnly) {
    venues = venues.filter(v => v.dietaryOptions.freshSeafoodCatch);
  }
  if (cuisine) {
    const wanted = cuisine.split(',').map(c => c.toLowerCase().trim()).filter(Boolean);
    if (wanted.length > 0) {
      venues = venues.filter(v => v.cuisine.some(c => wanted.includes(c.toLowerCase())));
    }
  }
  if (price) {
    const wanted = price.split(',').map(p => p.trim()).filter(Boolean);
    if (wanted.length > 0) {
      // Compared through the canonical vocabulary so `price=Moderate ($$)`
      // also matches a row the research importer stored as 'MID'.
      venues = venues.filter(v => wanted.some(w => priceBandMatches(v.priceBand, w)));
    }
  }
  if (query) {
    venues = venues.filter(v =>
      v.nameEn.toLowerCase().includes(query) ||
      (v.nameAr || '').includes(query) ||
      v.cuisine.some(c => c.toLowerCase().includes(query))
    );
  }

  if (sort === 'rating') {
    venues = [...venues].sort((a, b) => order * (((b as any).rating ?? 0) - ((a as any).rating ?? 0)));
  } else if (sort === 'popular') {
    venues = [...venues].sort((a, b) => order * (((b as any).reviewCount ?? 0) - ((a as any).reviewCount ?? 0)));
  } else if (sort === 'name') {
    venues = [...venues].sort((a, b) => order * a.nameEn.localeCompare(b.nameEn));
  } else if (sort === 'price') {
    venues = [...venues].sort((a, b) => order * (((b.averageMealPriceEGP ?? 0) - (a.averageMealPriceEGP ?? 0))));
  }

  /**
   * The importer's malformed rows are repaired here rather than in each client.
   *
   * Four venues are stored with the importer's old 'MID' spelling. The
   * restaurants page filters by exact membership of the three display labels,
   * so those four were dropped from its grid with no filter that could bring
   * them back — and their `cuisine` is a string where the type says string[],
   * which crashed the card the moment they became visible. See
   * src/shared/diningVenue.ts.
   */
  const normalized = venues.map(normalizeDiningVenue);

  res.json({
    status: 'success',
    count: normalized.length,
    venues: withDiningOverlays(normalized),
    filters: { area, cuisine, price, query, sort, order: order === 1 ? 'asc' : 'desc' },
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/transport
 */
dahabRouter.get('/transport', (req: AuthenticatedRequest, res: Response) => {
  const from = (req.query.from as string) || 'lighthouse';
  const to = (req.query.to as string) || 'blue_hole';

  const routeEstimate = geointelligenceService.calculateRouteEstimate(from, to);

  res.json({
    status: 'success',
    routeEstimate,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/conditions
 */
dahabRouter.get('/conditions', (req: AuthenticatedRequest, res: Response) => {
  const conditions = dahabKnowledgeOs.getLiveConditions();
  res.json({
    status: 'success',
    ...conditions,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/emergency
 */
dahabRouter.get('/emergency', (req: AuthenticatedRequest, res: Response) => {
  const resources = db.emergencyResources;
  res.json({
    status: 'success',
    count: resources.length,
    emergencyHotlines: [
      { service: 'Hyperbaric Chamber Emergency', number: '+20 122 212 4840 / 137' },
      { service: 'Dahab Central Hospital ER', number: '123 / +20 69 3640212' },
      { service: 'Tourism Police Emergency', number: '126 / +20 69 3640103' }
    ],
    resources,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/regulations
 */
dahabRouter.get('/regulations', (req: AuthenticatedRequest, res: Response) => {
  const regulations = db.regulatoryDecrees;
  res.json({
    status: 'success',
    count: regulations.length,
    regulations,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/snapshot
 */
dahabRouter.get('/snapshot', (req: AuthenticatedRequest, res: Response) => {
  const latestSnapshot = db.knowledgeSnapshots[0] || null;
  res.json({
    status: 'success',
    snapshot: latestSnapshot,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/questions
 * Question-driven structured knowledge retrieval
 */
dahabRouter.get('/questions', (req: AuthenticatedRequest, res: Response) => {
  const query = req.query.q as string | undefined;
  const questions = dahabKnowledgeOs.getQuestionKnowledge ? dahabKnowledgeOs.getQuestionKnowledge(query) : [];
  res.json({
    status: 'success',
    count: questions.length,
    questions,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/badges/:entityId
 * Authoritative trust badges for an entity
 */
dahabRouter.get('/badges/:entityId', (req: AuthenticatedRequest, res: Response) => {
  const entityId = req.params.entityId;
  const badges = dahabKnowledgeOs.getTrustBadges ? dahabKnowledgeOs.getTrustBadges(entityId) : [];
  res.json({
    status: 'success',
    entityId,
    badges,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/suppliers
 * Real provenance-aware local suppliers
 */
dahabRouter.get('/commerce/suppliers', (req: AuthenticatedRequest, res: Response) => {
  const category = req.query.category as string | undefined;
  const verification = req.query.verification as string | undefined;

  let suppliers = db.suppliers;
  if (category) {
    suppliers = suppliers.filter(s => s.category.toLowerCase() === category.toLowerCase());
  }
  if (verification) {
    suppliers = suppliers.filter(s => (s.verificationStatus || '').toLowerCase() === verification.toLowerCase());
  }

  // payoutAccountNumber is an IBAN and must never reach the public /dahab surface.
  const canSeePayoutDetails = req.user?.role === 'Operations' || req.user?.role === 'Admin';
  const exposed = canSeePayoutDetails
    ? suppliers
    : suppliers.map(({ payoutAccountNumber, ...rest }) => rest);

  res.json({
    status: 'success',
    count: exposed.length,
    suppliers: exposed,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/offers
 * Canonical supplier offers with single/double pricing and provenance
 */
dahabRouter.get('/commerce/offers', (req: AuthenticatedRequest, res: Response) => {
  const activityId = req.query.activityId as string | undefined;
  const supplierId = req.query.supplierId as string | undefined;
  const category = req.query.category as string | undefined;

  let offers = db.supplierOffers;
  if (activityId) {
    offers = offers.filter(o => o.activityId.toLowerCase() === activityId.toLowerCase());
  }
  if (supplierId) {
    offers = offers.filter(o => o.supplierId.toLowerCase() === supplierId.toLowerCase());
  }
  if (category) {
    offers = offers.filter(o => o.canonicalCategory.toLowerCase() === category.toLowerCase());
  }

  res.json({
    status: 'success',
    count: offers.length,
    offers,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/market-stats
 * Aggregated market statistics and observed price ranges
 */
dahabRouter.get('/commerce/market-stats', (req: AuthenticatedRequest, res: Response) => {
  const stats = db.state.marketPriceStats || [];
  res.json({
    status: 'success',
    count: stats.length,
    stats,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/compare
 * Multi-dimensional weighted comparison of supplier offers
 */
dahabRouter.get('/commerce/compare', (req: AuthenticatedRequest, res: Response) => {
  const criteria = {
    activityId: req.query.activityId as string | undefined,
    category: req.query.category as string | undefined,
    serviceType: req.query.serviceType as string | undefined,
    destination: req.query.destination as string | undefined,
    maxBudgetEGP: req.query.maxBudgetEGP ? Number(req.query.maxBudgetEGP) : undefined,
    minVerificationLevel: enumParam(req.query.minVerificationLevel, VERIFICATION_LEVELS, 'minVerificationLevel'),
    pricingBasis: enumParam(req.query.pricingBasis, PRICING_BASES, 'pricingBasis'),
    passengersCount: req.query.passengersCount ? Number(req.query.passengersCount) : undefined
  };

  const result = commerceIntelligenceService.compareOffers(criteria);
  res.json({
    status: 'success',
    ...result,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/recommend
 * Smart recommendations (best match, best value, lowest price, most verified)
 */
dahabRouter.get('/commerce/recommend', (req: AuthenticatedRequest, res: Response) => {
  const criteria = {
    activityId: req.query.activityId as string | undefined,
    category: req.query.category as string | undefined,
    serviceType: req.query.serviceType as string | undefined,
    destination: req.query.destination as string | undefined
  };

  const result = commerceIntelligenceService.compareOffers(criteria);
  res.json({
    status: 'success',
    recommendations: result.recommendations,
    marketSummary: result.marketSummary,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/price-history
 * Observed price movement over time for specific offers or suppliers
 */
dahabRouter.get('/commerce/price-history', (req: AuthenticatedRequest, res: Response) => {
  const offerId = req.query.offerId as string | undefined;
  const supplierId = req.query.supplierId as string | undefined;
  const activityId = req.query.activityId as string | undefined;

  let observations = db.priceObservations || [];
  if (offerId) {
    observations = observations.filter(o => o.offerId === offerId);
  }
  if (supplierId) {
    observations = observations.filter(o => o.supplierId === supplierId);
  }
  if (activityId) {
    observations = observations.filter(o => o.activityId.toLowerCase() === activityId.toLowerCase());
  }

  observations.sort((a, b) => new Date(a.observedAt).getTime() - new Date(b.observedAt).getTime());

  const result = commerceIntelligenceService.getPriceHistory({ offerId, supplierId });
  res.json({
    status: 'success',
    totalCount: observations.length,
    observations,
    trend: result.trend,
    changePercentage: result.changePercentage,
    classification: 'OBSERVED_MARKET_DATA',
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/price-changes
 * Specific price increase, decrease, basis change, and expiration events
 */
dahabRouter.get('/commerce/price-changes', (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.query.supplierId as string | undefined;
  const activityId = req.query.activityId as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const events = (db.marketChangeEvents || []).filter(e =>
    e.entityType === 'PRICE' ||
    e.eventType.startsWith('PRICE_') ||
    e.eventType === 'PRICING_BASIS_CHANGED'
  ).filter(e => {
    if (supplierId && e.supplierId !== supplierId) return false;
    if (activityId && e.activityId?.toLowerCase() !== activityId.toLowerCase()) return false;
    return true;
  }).slice(-limit);

  res.json({
    status: 'success',
    count: events.length,
    events,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/supplier-changes
 * Recent supplier price, contact, Instagram, and regulatory change radar events
 */
dahabRouter.get('/commerce/supplier-changes', (req: AuthenticatedRequest, res: Response) => {
  const supplierId = req.query.supplierId as string | undefined;
  const limit = req.query.limit ? Number(req.query.limit) : 20;

  const events = marketFreshnessService.getMarketChangeEvents({
    supplierId,
    limit
  });

  const contactHistory = (db.contactHistory || []).filter(c => !supplierId || c.supplierId === supplierId).slice(-limit);
  const socialAccounts = (db.socialAccounts || []).filter(s => s.active && (!supplierId || s.supplierId === supplierId));

  res.json({
    status: 'success',
    eventsCount: events.length,
    events,
    contactHistoryCount: contactHistory.length,
    contactHistory,
    activeSocialAccountsCount: socialAccounts.length,
    activeSocialAccounts: socialAccounts,
    lastSynchronized: new Date().toISOString(),
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/source-freshness
 * 4-dimensional data freshness audit across supplier, offer, price, and regulatory sources
 */
dahabRouter.get('/commerce/source-freshness', (req: AuthenticatedRequest, res: Response) => {
  const sourceReference = req.query.sourceReference as string | undefined;
  const report = marketFreshnessService.getSourceFreshnessReport();

  let sources = report.sources;
  if (sourceReference) {
    sources = sources.filter(s => s.sourceReference.toLowerCase().includes(sourceReference.toLowerCase()));
  }

  res.json({
    status: 'success',
    ...report,
    sources,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/market-trends
 * Comprehensive temporal price trends, rates of change, and historical timelines
 */
dahabRouter.get('/commerce/market-trends', (req: AuthenticatedRequest, res: Response) => {
  const activityId = req.query.activityId as string | undefined;
  const category = req.query.category as string | undefined;

  const trends = marketFreshnessService.getMarketTrends({ activityId, category });
  res.json({
    status: 'success',
    ...trends,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/commerce/refresh
 * Automated, transactional market data ingestion and change detection trigger
 */
dahabRouter.post('/commerce/refresh', (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = marketFreshnessService.executeMarketRefresh(req.body || {});
    // See the note in server.ts: RefreshResult.status was overwriting the
    // envelope status via the spread.
    res.json({
      ...result,
      status: result.success ? 'success' : 'error',
      refreshStatus: result.status,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to execute market refresh.',
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/dahab/commerce/review-queue
 * Pending anomalies, price conflicts, and regulatory discrepancies
 */
dahabRouter.get('/commerce/review-queue', (req: AuthenticatedRequest, res: Response) => {
  const issueType = enumParam(req.query.issueType, REVIEW_ISSUE_TYPES, 'issueType');
  const status = enumParam(req.query.status, REVIEW_STATUSES, 'status');
  const severity = enumParam(req.query.severity, SEVERITIES, 'severity');

  const items = marketFreshnessService.getReviewQueue({ issueType, status, severity });
  res.json({
    status: 'success',
    count: items.length,
    items,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/commerce/review-queue/:id/resolve
 */
dahabRouter.post('/commerce/review-queue/:id/resolve', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { action, notes, reviewer } = req.body || {};
    const item = marketFreshnessService.resolveReviewQueueItem({
      id: req.params.id,
      action: action || 'APPROVED',
      notes,
      reviewer
    });
    res.json({
      status: 'success',
      item,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(400).json({
      status: 'error',
      message: err.message,
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/dahab/commerce/refresh-runs
 */
dahabRouter.get('/commerce/refresh-runs', (req: AuthenticatedRequest, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  const runs = marketFreshnessService.getMarketRefreshRuns(limit);
  res.json({
    status: 'success',
    count: runs.length,
    runs,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/source-health
 */
dahabRouter.get('/commerce/source-health', (req: AuthenticatedRequest, res: Response) => {
  const health = marketFreshnessService.getSourceHealthReport();
  res.json({
    status: 'success',
    count: health.length,
    health,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/operations-overview
 */
dahabRouter.get('/commerce/operations-overview', (req: AuthenticatedRequest, res: Response) => {
  const overview = marketFreshnessService.getOperationsMarketOverview();
  res.json({
    status: 'success',
    overview,
    correlationId: req.correlationId
  });
});

/**
 * GET /api/dahab/commerce/search
 * Bilingual search across suppliers, offers, and market intelligence
 */
dahabRouter.get('/commerce/search', (req: AuthenticatedRequest, res: Response) => {
  const query = (req.query.q as string) || (req.query.query as string) || '';
  const q = query.toLowerCase().trim();

  const matchedSuppliers = db.suppliers.filter(s => {
    return (s.businessName || '').toLowerCase().includes(q) ||
      (s.businessNameAr && s.businessNameAr.includes(q)) ||
      (s.aliases && s.aliases.some(a => a.toLowerCase().includes(q) || a.includes(q))) ||
      (s.serviceTypes && s.serviceTypes.some(t => t.toLowerCase().includes(q) || t.includes(q))) ||
      ((s.category || '').toLowerCase().includes(q));
  });

  const matchedOffers = db.supplierOffers.filter(o => {
    return o.titleEn.toLowerCase().includes(q) ||
      o.titleAr.includes(q) ||
      o.sourceActivityName.toLowerCase().includes(q) ||
      o.canonicalCategory.toLowerCase().includes(q) ||
      o.includes.some(inc => inc.toLowerCase().includes(q) || inc.includes(q));
  });

  const matchedStats = (db.state.marketPriceStats || []).filter(st => {
    return st.activityNameEn.toLowerCase().includes(q) ||
      st.activityNameAr.includes(q);
  });

  const canSeePayoutDetails = req.user?.role === 'Operations' || req.user?.role === 'Admin';
  const exposedSuppliers = canSeePayoutDetails
    ? matchedSuppliers
    : matchedSuppliers.map(({ payoutAccountNumber, ...rest }) => rest);

  res.json({
    status: 'success',
    query,
    results: {
      suppliers: exposedSuppliers,
      offers: matchedOffers,
      marketStats: matchedStats
    },
    correlationId: req.correlationId
  });
});

// ===========================================================================
// AUTONOMOUS DATA OPERATIONS & SUPERVISION ENDPOINTS
// ===========================================================================

/**
 * GET /api/dahab/commerce/jobs
 * List all scheduled refresh policies, intervals, and statuses
 */
dahabRouter.get('/commerce/jobs', (req: AuthenticatedRequest, res: Response) => {
  const policies = autonomousDataOpsService.getSchedulePolicies();
  res.json({
    status: 'success',
    count: policies.length,
    policies,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/commerce/jobs/trigger
 * Manually or autonomously trigger a specific source refresh
 */
dahabRouter.post('/commerce/jobs/trigger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceId, force } = req.body || {};
    if (!sourceId) {
      return res.status(400).json({
        status: 'error',
        message: 'sourceId is required',
        correlationId: req.correlationId
      });
    }

    const result = await autonomousDataOpsService.triggerScheduledRefresh(sourceId, force === true);
    res.json({
      status: 'success',
      result,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message || 'Failed to trigger refresh job',
      correlationId: req.correlationId
    });
  }
});

/**
 * POST /api/dahab/commerce/jobs/policy
 * Update schedule intervals or enable/disable a source
 */
dahabRouter.post('/commerce/jobs/policy', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceId, ...updates } = req.body || {};
    if (!sourceId) {
      return res.status(400).json({
        status: 'error',
        message: 'sourceId is required',
        correlationId: req.correlationId
      });
    }

    const updated = autonomousDataOpsService.updateSchedulePolicy(sourceId, updates);
    res.json({
      status: 'success',
      policy: updated,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(400).json({
      status: 'error',
      message: err.message,
      correlationId: req.correlationId
    });
  }
});

/**
 * POST /api/dahab/commerce/run-all-scheduled
 * Run all due schedule policies in one autonomous pass
 */
dahabRouter.post('/commerce/run-all-scheduled', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const results = await autonomousDataOpsService.runAllScheduledJobs();
    res.json({
      status: 'success',
      totalRuns: results.length,
      results,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/dahab/commerce/alerts
 * List operations alerts with filter
 */
dahabRouter.get('/commerce/alerts', (req: AuthenticatedRequest, res: Response) => {
  const status = stringParam(req.query.status, 'status');
  const severity = enumParam(req.query.severity, SEVERITIES, 'severity');
  const alerts = autonomousDataOpsService.getAlerts({ status, severity });
  res.json({
    status: 'success',
    count: alerts.length,
    alerts,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/commerce/alerts/:id/acknowledge
 */
dahabRouter.post('/commerce/alerts/:id/acknowledge', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { acknowledgedBy } = req.body || {};
    const alert = autonomousDataOpsService.acknowledgeAlert(req.params.id, acknowledgedBy);
    res.json({
      status: 'success',
      alert,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(400).json({
      status: 'error',
      message: err.message,
      correlationId: req.correlationId
    });
  }
});

/**
 * POST /api/dahab/commerce/alerts/:id/resolve
 */
dahabRouter.post('/commerce/alerts/:id/resolve', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { resolutionNotes } = req.body || {};
    const alert = autonomousDataOpsService.resolveAlert(req.params.id, resolutionNotes);
    res.json({
      status: 'success',
      alert,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(400).json({
      status: 'error',
      message: err.message,
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/dahab/commerce/snapshots
 */
dahabRouter.get('/commerce/snapshots', (req: AuthenticatedRequest, res: Response) => {
  const limit = Number(req.query.limit) || 10;
  const snapshots = autonomousDataOpsService.getSnapshots(limit);
  res.json({
    status: 'success',
    count: snapshots.length,
    snapshots,
    correlationId: req.correlationId
  });
});

/**
 * POST /api/dahab/commerce/snapshots/create
 */
dahabRouter.post('/commerce/snapshots/create', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reason, createdBy } = req.body || {};
    const snapshot = autonomousDataOpsService.createSnapshot(reason, createdBy);
    res.json({
      status: 'success',
      snapshot,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(500).json({
      status: 'error',
      message: err.message,
      correlationId: req.correlationId
    });
  }
});

/**
 * POST /api/dahab/commerce/snapshots/:id/rollback
 */
dahabRouter.post('/commerce/snapshots/:id/rollback', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { executedBy } = req.body || {};
    const result = autonomousDataOpsService.rollbackToSnapshot(req.params.id, executedBy);
    res.json({
      status: 'success',
      result,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(400).json({
      status: 'error',
      message: err.message,
      correlationId: req.correlationId
    });
  }
});

/**
 * POST /api/dahab/commerce/circuit-breakers/reset
 */
dahabRouter.post('/commerce/circuit-breakers/reset', (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceReference } = req.body || {};
    if (!sourceReference) {
      return res.status(400).json({
        status: 'error',
        message: 'sourceReference is required',
        correlationId: req.correlationId
      });
    }

    const health = autonomousDataOpsService.resetCircuitBreaker(sourceReference);
    res.json({
      status: 'success',
      health,
      correlationId: req.correlationId
    });
  } catch (err: any) {
    res.status(400).json({
      status: 'error',
      message: err.message,
      correlationId: req.correlationId
    });
  }
});

/**
 * GET /api/dahab/commerce/autonomous-status
 */
dahabRouter.get('/commerce/autonomous-status', (req: AuthenticatedRequest, res: Response) => {
  const status = autonomousDataOpsService.getAutonomousStatus();
  res.json({
    status: 'success',
    ...status,
    correlationId: req.correlationId
  });
});

// ---------------------------------------------------------------------------
// Editorial content
//
// The gallery, the curated stories and the ready-made programmes used to live
// inside the components that rendered them, so changing a photograph caption
// meant a rebuild and a deploy. They are the same records, served from
// server/db/seeds/editorialContent.ts.
//
// Public: this is marketing copy about Dahab, shown before anyone signs in.
// ---------------------------------------------------------------------------

dahabRouter.get('/content/gallery', (req: AuthenticatedRequest, res: Response) => {
  res.json({ status: 'success', count: GALLERY_PHOTOS.length, photos: GALLERY_PHOTOS, correlationId: req.correlationId });
});

dahabRouter.get('/content/stories', (req: AuthenticatedRequest, res: Response) => {
  res.json({ status: 'success', count: CURATED_STORIES.length, stories: CURATED_STORIES, correlationId: req.correlationId });
});

const PROGRAMME_DESTINATIONS = ['dahab', 'nuweiba', 'siwa'] as const;

dahabRouter.get('/content/programmes', (req: AuthenticatedRequest, res: Response) => {
  let destination: (typeof PROGRAMME_DESTINATIONS)[number] | undefined;
  try {
    destination = enumParam(req.query.d, PROGRAMME_DESTINATIONS, 'd');
  } catch (err) {
    if (err instanceof InvalidQueryParameterError) {
      return res.status(400).json({ error: err.message, code: 'VALIDATION' });
    }
    throw err;
  }
  const programmes = contentProgrammes.listPublic(destination);
  res.json({
    status: 'success',
    destination: destination ?? null,
    count: programmes.length,
    programmes,
    correlationId: req.correlationId
  });
});

const PLACE_KINDS = ['stay', 'restaurant'] as const;

dahabRouter.get('/content/places', (req: AuthenticatedRequest, res: Response) => {
  let destination: (typeof BROWSE_DESTINATIONS)[number] | undefined;
  let kind: BrowseKind | undefined;
  try {
    destination = enumParam(req.query.d, BROWSE_DESTINATIONS, 'd');
    kind = enumParam(req.query.kind, PLACE_KINDS, 'kind');
  } catch (err) {
    if (err instanceof InvalidQueryParameterError) {
      return res.status(400).json({ error: err.message, code: 'VALIDATION' });
    }
    throw err;
  }
  if (!destination || !kind) {
    return res.status(400).json({
      error: 'Query parameters "d" and "kind" are required.',
      code: 'VALIDATION',
    });
  }
  const places = loadPlaceBrowse(destination, kind);
  res.json({
    status: 'success',
    destination,
    kind,
    count: places.length,
    bookable: false,
    places,
    correlationId: req.correlationId,
  });
});
