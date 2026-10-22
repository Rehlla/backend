import { apiErrorFrom, readJson } from './apiError';
import type { CommerceServiceType, TripBookingRecord, ProductSkuEntity } from '../shared/types/commerce';
import type { DahabCuratedStory, DahabGalleryPhoto, DahabActivity, DahabAttraction, DahabDiningVenue, DahabPlace, AttractionCategory } from '../shared/types/knowledge';
import type { SupportMessage } from '../shared/types/user';
import type { TripEntity, TripItemEntity, TripItemWithSupplier } from '../shared/types/trip';
import type { TripDetailsPatch } from '../shared/tripDetailsPolicy';
import type { TransferResolveGeoResponse } from '../shared/types/transfers';
import type { FitWindowResponse, ParsedSearchIntent, PostActivityFoodResponse, RouteEstimate } from '../shared/types/context';
import type { GroundedIntelligenceQueryResponse, ProductOpportunity } from '../types/intelligence';
import type {
  DeliveryLocationDraft,
  DiningCartLineInput,
  DiningDeliveryZonesResponse,
  DiningOrder,
  DiningOrderFulfillment,
  DiningOrderStatus,
  DiningQuote,
  DiningVenueMenuResponse,
  DiningVenueSummary
} from '../types/dining';
import type { Language } from '../i18n/resolve';
import type { DayGiResponse } from '../shared/types/daygi';
import type {
  PartyBookIntentResponse,
  PartyListResponse,
  PartyTonightResponse,
  PartyView,
  PartyWritePayload,
  PartyZonesResponse
} from '../shared/dahabParties';
import type { BrowseRestaurant, BrowseStay } from '../shared/placeBrowse';
import type {
  WhatsAppMessage,
  WhatsAppMessageStatus,
  WhatsAppPurpose,
  WhatsAppSession,
  WhatsAppSessionsResponse
} from '../shared/types/whatsapp';
import type {
  CatalogBulkBody,
  CatalogBulkResult,
  CatalogDetailResponse,
  CatalogEnvelope,
  CatalogListQuery,
  CatalogListResponse,
  CatalogRateNight,
  CatalogRatesPutBody,
  CatalogRatesPutResult,
  CatalogRatesQuery,
  CatalogSchemaResponse,
  CatalogScope,
  CatalogSummaryResponse,
  CatalogSlot,
  CatalogSlotsPutBody,
  CatalogWriteBody
} from '../types/catalog';

// ---------------------------------------------------------------------------

/**
 * Thrown when the streaming endpoint can't be opened at all (offline, a
 * proxy buffering SSE, a non-OK headers response). The concierge view catches
 * exactly this and retries once with the plain query — a fallback only taken
 * before any streamed text has been shown.
 */
export class DayGiStreamUnavailable extends Error {
  constructor() {
    super('DayGI stream unavailable');
    this.name = 'DayGiStreamUnavailable';
  }
}

// ---------------------------------------------------------------------------
// P4 booking-trust shapes — alternatives on sold-out and the price explainer.
// Mirrors server/services/commerceService.ts exactly.
// ---------------------------------------------------------------------------

export interface CommerceAlternative {
  skuId: string;
  title: string;
  titleAr: string;
  serviceType: string;
  supplierId: string;
  basePriceEGP: number;
  currency: 'EGP';
  timeSlot: string;
  available: number;
  status: 'AVAILABLE' | 'ALMOST_FULL' | 'SOLD_OUT';
  reason: string;
  reasonAr: string;
}

/**
 * An inventory hold (POST /api/commerce/hold). `amountEGP` is the catalogue
 * price for the held party — the amount checkout will charge.
 */
export interface CommerceHold {
  holdToken: string;
  skuId: string;
  tripId: string;
  slotId: string;
  serviceType: CommerceServiceType;
  passengersCount: number;
  amountEGP: number;
  expiresAt: string;
  status: 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'RELEASED';
}

/** What /api/commerce/checkout/multi returns on success. */
export interface MultiCheckoutResult {
  bookings: Array<{ id: string; bookingRef: string; confirmationCode: string; amountEGP: number; skuId: string }>;
  totalAmountEGP: number;
  paymentState: string;
  transactionId: string;
}

/**
 * Transfer telemetry. Until a supplier assigns a driver the server says so —
 * `assigned: false`, status NOT_ASSIGNED and null driver/vehicle fields —
 * rather than naming one.
 */
export interface TransferTelemetry {
  bookingId: string;
  referenceCode: string;
  assigned: boolean;
  status: 'NOT_ASSIGNED' | 'ASSIGNED' | 'DISPATCHED' | 'AT_AIRPORT' | 'PASSENGER_PICKED_UP' | 'COMPLETED';
  driverName: string | null;
  driverNameAr?: string;
  driverPhone: string | null;
  vehicleModel: string | null;
  vehiclePlate: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  scheduledTime: string | null;
  flightNumber?: string;
  flightStatus: 'ON_TIME' | 'DELAYED' | 'LANDED' | null;
  lastGpsUpdate: string | null;
}

export interface PriceExplanation {
  currency: 'EGP';
  lines: Array<{
    skuId: string;
    title: string;
    titleAr: string;
    serviceType: string;
    basis: 'per_person' | 'per_stay' | 'per_vehicle';
    passengersCount: number;
    nights: number | null;
    unitPriceEGP: number;
    amountEGP: number;
    supplierId: string;
    cancellationPolicyHours: number;
  }>;
  totalEGP: number;
}

export interface SupplierRevenueAnalytics {
  supplierId: string;
  windowDays: number;
  currency: 'EGP';
  totals: {
    grossBookingsEGP: number;
    payoutEGP: number;
    escrowPendingEGP: number;
    payoutScheduledEGP: number;
    bookingsCount: number;
    completedCount: number;
    cancelledCount: number;
    rejectedCount: number;
    completionRate: number | null;
    avgBookingEGP: number | null;
  };
  byServiceType: Array<{ serviceType: string; bookingsCount: number; grossEGP: number; payoutEGP: number }>;
  daily: Array<{ date: string; bookingsCount: number; grossEGP: number; payoutEGP: number }>;
  topBookings: Array<{ bookingRef: string; serviceType: string; amountEGP: number; payoutEGP: number; supplierState: string; scheduledDate: string }>;
}

// ---------------------------------------------------------------------------
// CMS public content — wire shapes served by the /api/content endpoints.
// The CMS hooks reshape these into view models; the shapes live here so api.ts
// is the single source of truth and the hooks never declare them a second time.
// ---------------------------------------------------------------------------

/**
 * The traveller-facing booking detail served by /api/bookings/:id (see
 * server/services/bookingService.ts). The server is the source of truth for
 * status; these shapes only describe what it returns so the client never
 * re-implements lifecycle rules from locally-guessed state.
 */
export interface BookingDetail {
  id: string;
  bookingRef: string;
  tripId: string;
  serviceType: CommerceServiceType;
  skuId: string;
  supplierId: string;
  amountEGP: number;
  paymentState: string;
  supplierState: string;
  travelerName: string;
  travelerPhone: string;
  travelerEmail: string;
  passengersCount: number;
  pickupLocation?: string;
  dropoffLocation?: string;
  scheduledDate: string;
  scheduledTime: string;
  confirmationCode: string;
  /**
   * ISO instant until which cancelling refunds in full (service start in
   * Africa/Cairo minus the SKU's policy hours); null when the booking has no
   * usable date.
   */
  freeCancellationUntil?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Verified-stay review shapes (blueprint row #14). The public list carries
 * display names only — never emails or phones.
 */
export interface ReviewSummary {
  id: string;
  bookingRef?: string;
  rating: number;
  title?: string;
  body: string;
  bodyAr?: string;
  supplierResponse?: string;
  supplierResponseAt?: string;
  createdAt: string;
  authorName?: string;
  verified?: boolean;
}

export interface BookingReviewState {
  review: ReviewSummary | null;
  /** True when the booking is complete and no review has been written yet. */
  invitation: boolean;
}

export interface SupplierReviewsResponse {
  reviews: ReviewSummary[];
  average: number;
  count: number;
}

export interface RichAvailabilityResponse {
  available: boolean;
  skus: Array<{
    id: string;
    supplierId: string;
    serviceType: CommerceServiceType;
    title: string;
    titleAr?: string;
    basePriceEGP: number;
    currency: string;
    maxCapacityPerSlot: number;
    cancellationPolicyHours?: number;
  }>;
  slots: Array<{
    id: string;
    date: string;
    timeSlot: string;
    totalCapacity: number;
    availableCapacity: number;
    priceEGP: number;
    status: string;
  }>;
  priceEGP: number;
}

export interface CmsContentPage {
  id: string;
  slug: string;
  type: string;
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  description_en: string;
  description_ar: string;
  body_en: string;
  body_ar: string;
  hero_image_url: string;
  hero_image_alt_en: string;
  hero_image_alt_ar: string;
  status: string;
  sort_order: number;
  featured: number;
}

export interface CmsHomepageSection {
  id: string;
  section_key: string;
  title_en: string;
  title_ar: string;
  visible: number;
  sort_order: number;
  config: Record<string, any>;
  updated_at: string;
}

export interface HomepageContent {
  hero: {
    title_en: string;
    title_ar: string;
    config: Record<string, any>;
  } | null;
  sections: CmsHomepageSection[];
  featuredPrograms: CmsContentPage[];
  featuredGallery: CmsContentPage[];
  featuredStories: CmsContentPage[];
}

export interface CmsPageBlockWire {
  id: string;
  type: string;
  sort_order: number;
  visible: number;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  config?: string | Record<string, any>;
}

export interface CmsPageWithBlocks {
  page: CmsContentPage | null;
  blocks: CmsPageBlockWire[];
}

/** Wire shape of a cms_seo row (see server/db/sqlite/cmsSchema.ts). */
export interface CmsSeo {
  id: string;
  page_type: string;
  page_id: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  og_title_en: string;
  og_title_ar: string;
  og_description_en: string;
  og_description_ar: string;
  og_image_url: string;
  canonical_url: string;
  noindex: number;
  updated_at: string;
}

/** Wire shape of a cms_revisions row (see server/db/sqlite/cmsSchema.ts). */
export interface CmsRevision {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  actor_name: string;
  payload: string | Record<string, unknown>;
  created_at: string;
}

/** Generic async collection state for ops dashboard sections. */
export interface DashboardSectionState<T> {
  source: 'live' | 'initial';
  loading: boolean;
  data: T;
  lastUpdated?: string;
  error?: string;
}

export interface NavigationItemWire {
  id: string;
  menu_key: string;
  item_order: number;
  label_en: string;
  label_ar: string;
  route: string;
  external_url: string;
  visible: number;
  open_in_new: number;
  group_label_en: string;
  group_label_ar: string;
}

export interface SiteInfoSlot {
  value: string;
  valueAr: string;
  updatedAt: string;
}

export type SiteInfoBundle = Record<string, Record<string, SiteInfoSlot>>;

export interface ExploreCategoryWire {
  id: string;
  slug: string;
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  description_en: string;
  description_ar: string;
  hero_image_url: string;
  sort_order: number;
  config?: string | Record<string, any>;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
}

/**
 * Real contracts served by the /api/market/* and /api/events/* endpoints.
 * These mirror the server-side entities (server/db/schema.ts) so callers stop
 * guessing at `unknown[]` and casting malformed shapes onto local models.
 * See `refreshMarketIntelligence` / `getMarketSourceHealth` / `getMarketAlerts`.
 */
export interface MarketSchedulePolicy {
  id: string;
  sourceId: string;
  sourceReference: string;
  sourceType: string;
  scheduleInterval: string;
  ingestionMode: 'LIVE_FETCH' | 'IMPORTED_SNAPSHOT' | 'MANUAL_REFRESH';
  enabled: boolean;
  requiresReview: boolean;
  maxRetries: number;
  consecutiveFailures: number;
  lastScheduledRun?: string;
  nextScheduledRun?: string;
  lastCompletedRun?: string;
}

export type SourceHealthReadiness = 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'STALE' | 'DISABLED';

export interface SourceHealth {
  id: string;
  sourceId?: string;
  sourceReference: string;
  sourceType: string;
  healthStatus: SourceHealthReadiness;
  consecutiveFailures: number;
  lastAttempt?: string;
  lastSuccess?: string;
  lastFailure?: string;
  lastSuccessfulRefresh?: string;
  lastFailedRefresh?: string;
  lastError?: string;
  latencyMs?: number;
  recordsObserved?: number;
  changesDetected?: number;
  totalRuns: number;
  successfulRuns: number;
  updatedAt?: string;
}

export type MarketAlertType =
  | 'SOURCE_FAILURE'
  | 'SOURCE_STALE'
  | 'PRICE_ANOMALY'
  | 'REGULATORY_CHANGE'
  | 'IMPORT_FAILURE'
  | 'REFRESH_BACKLOG'
  | 'PRICE_DROP'
  | 'PRICE_INCREASE';

export interface MarketAlert {
  id: string;
  alertType: MarketAlertType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  titleEn: string;
  titleAr: string;
  messageEn: string;
  messageAr: string;
  sourceReference?: string;
  supplierId?: string;
  activityId?: string;
  createdAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export type MarketReviewStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'DISMISSED'
  | 'MARKED_VERIFIED'
  | 'MARKED_STALE'
  | 'SOURCE_SUSPENDED'
  | 'SOURCE_REACTIVATED'
  | 'AUTO_RESOLVED';

export interface MarketReviewItem {
  id: string;
  issueType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: MarketReviewStatus;
  detectedAt: string;
  summaryEn?: string;
  summaryAr?: string;
}

export interface MarketOpsOverview {
  totalSuppliers: number;
  totalOffers: number;
  totalPriceObservations: number;
  recentChangeEventsCount: number;
  pendingReviewCount: number;
  activeSourcesCount: number;
  freshnessScore: number;
  recentRuns: unknown[];
  recentEvents: unknown[];
  pendingReviews: MarketReviewItem[];
}

export interface BackgroundEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  actorId?: string;
  correlationId?: string;
  data: Record<string, any>;
}

/**
 * Default request timeout, chosen for spotty Sinai connectivity.
 *
 * Anything that waits on a language model needs more: /api/daygi/query was
 * measured at 10.35s against real Gemini and returned a correct answer at HTTP
 * 200, while this abort fired at 8s — so every AI request in the app was
 * cancelled 2.3 seconds before its answer arrived, and the user saw a canned
 * local reply instead. Those call sites pass AI_TIMEOUT_MS.
 */
export const DEFAULT_TIMEOUT_MS = 8000;
export const AI_TIMEOUT_MS = 30000;

/**
 * Robust network fetch with an AbortController timeout to handle spotty
 * Sinai / desert connectivity gracefully.
 * Automatically transmits HttpOnly SameSite session cookies via credentials: 'include'.
 */
export interface DestinationConditionsWire {
  destination: string;
  available: boolean;
  observedAt: string;
  source: string;
  airTemperatureC: number;
  waterTemperatureC: number | null;
  windKnots: number;
  windDirection: string;
  condition: { en: string; ar: string };
  sunset: string | null;
}

export interface FxRatesWire {
  base: 'EGP';
  egpPerUnit: Record<string, number>;
  asOf: string;
  indicative: boolean;
}

export async function fetchWithTimeout(
  resource: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<Response> {
  const { timeout = DEFAULT_TIMEOUT_MS, signal: callerSignal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // A caller's own signal (a component unmounting, a superseded request) is
  // composed with the timeout rather than replacing it, so cancelling on
  // unmount does not also remove the connectivity guard — and so a timeout
  // still fires for a caller that passed a signal it never aborts.
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  try {
    const response = await fetch(resource, {
      credentials: 'include',
      ...fetchOptions,
      signal: controller.signal
    });
    return response;
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      // Deliberate cancellation is not a network failure: rethrow it as an
      // AbortError so the caller can drop the result silently instead of
      // showing the traveler a connectivity message they did not cause.
      if (callerSignal?.aborted) throw error;
      throw new Error(
        `انتهت مهلة الاتصال بالشبكة (${Math.round(timeout / 1000)} ثانية). يرجى التحقق من جودة الاتصال في سيناء.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  }
}

const defaultHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json'
  };
};

/**
 * The destination the public catalogue endpoints are scoped to.
 *
 * Resolved per request (not per module load): `?d=` first, then the saved
 * `rehla_destination`, then Dahab — the same precedence the destination
 * picker uses, so the API layer and the UI never disagree about which city
 * is open. Interpolated straight into the request URLs as `${destinationId}`.
 */
function resolveDestinationId(): string {
  try {
    if (typeof window !== 'undefined') {
      const fromUrl = new URLSearchParams(window.location.search).get('d');
      if (fromUrl) return fromUrl;
      const saved = window.localStorage.getItem('rehla_destination');
      if (saved) return saved;
    }
  } catch { /* private mode / storage blocked */ }
  return 'dahab';
}

const destinationId = { toString: () => resolveDestinationId() };

export const api = {
  // 0. Traveler support
  //
  // The Help panel had no backend: a scripted "Dahab Expert" claimed to be
  // contacting the traveler's boat captain and whatever they typed went
  // nowhere.

  async sendSupportMessage(
    payload: {
      message: string;
      travelerName?: string;
      travelerPhone?: string;
      travelerEmail?: string;
      tripId?: string;
      category?: string;
      bookingRef?: string;
      urgent?: boolean;
    },
    signal?: AbortSignal
  ): Promise<{ message: SupportMessage }> {
    const res = await fetchWithTimeout('/api/support/messages', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Your message could not be sent.');
    return await readJson<{ message: SupportMessage }>(res, 'Your message could not be sent.');
  },

  /** The traveler's own thread; Operations and Admin get the whole queue. */
  async getSupportMessages(signal?: AbortSignal): Promise<{ messages: SupportMessage[]; openCount: number }> {
    const res = await fetchWithTimeout('/api/support/messages', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your support messages.');
    return await readJson<{ messages: SupportMessage[]; openCount: number }>(
      res,
      'Could not load your support messages.'
    );
  },

  // 0b. Editorial content
  //
  // Gallery photographs, curated stories and the ready-made programmes used to
  // be compiled into the components that rendered them, so a copy change meant
  // a rebuild and a deploy.

  async getCuratedStories(signal?: AbortSignal): Promise<{ stories: DahabCuratedStory[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/content/stories`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the Dahab stories.');
    return await readJson<{ stories: DahabCuratedStory[] }>(res, 'Could not load the Dahab stories.');
  },

  async getReadyProgrammes(signal?: AbortSignal, destination?: string): Promise<{ programmes: unknown[] }> {
    const query = destination ? `?d=${encodeURIComponent(destination)}` : '';
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/content/programmes${query}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the ready-made trips.');
    return await readJson<{ programmes: unknown[] }>(res, 'Could not load the ready-made trips.');
  },

  async getPlaceBrowse(
    destination: string,
    kind: 'stay' | 'restaurant',
    signal?: AbortSignal,
  ): Promise<{ places: BrowseStay[] | BrowseRestaurant[] }> {
    const params = new URLSearchParams({ d: destination, kind });
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/content/places?${params}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load this list.');
    return await readJson(res, 'Could not load this list.');
  },

  // 0a. Destination knowledge
  //
  // /api/cities/${destinationId}/* is public, already populated (17 places, 22 activities, the
  // dining venues) and was called by nothing: Explore and Food each shipped
  // their own hardcoded copy of a handful of venues instead.

  async searchDahab(query: string, signal?: AbortSignal): Promise<{ matched?: boolean; results: Array<{ type: string; id: string; name: string; nameAr?: string; description?: string; area?: string; category?: string; score?: number; whyEn?: string; whyAr?: string; bookable?: boolean; priceEGP?: number }>; suggestions: string[] }> {
    const params = new URLSearchParams({ q: query });
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/search?${params}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Search failed.');
    return await readJson(res, 'Search failed.');
  },

  async getDahabPlaces(signal?: AbortSignal): Promise<{ places: DahabPlace[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/places`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load places in Dahab.');
    return await readJson<{ places: DahabPlace[] }>(res, 'Could not load places in Dahab.');
  },

  async getDahabActivities(signal?: AbortSignal): Promise<{ activities: DahabActivity[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/activities`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load things to do in Dahab.');
    return await readJson<{ activities: DahabActivity[] }>(res, 'Could not load things to do in Dahab.');
  },

  async getDahabAttractions(
    filters?: {
      category?: string;
      q?: string;
      area?: string;
      sort?: 'top' | 'rating' | 'popular' | 'name' | 'price';
      order?: 'asc' | 'desc';
    },
    signal?: AbortSignal
  ): Promise<{ attractions: DahabAttraction[]; categories: AttractionCategory[]; count: number }> {
    const params = new URLSearchParams();
    if (filters?.category) params.set('category', filters.category);
    if (filters?.q) params.set('q', filters.q);
    if (filters?.area) params.set('area', filters.area);
    if (filters?.sort && filters.sort !== 'top') params.set('sort', filters.sort);
    if (filters?.order) params.set('order', filters.order);
    const qs = params.toString();
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/attractions${qs ? `?${qs}` : ''}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load things to do in Dahab.');
    return await readJson<{ attractions: DahabAttraction[]; categories: AttractionCategory[]; count: number }>(
      res,
      'Could not load things to do in Dahab.'
    );
  },

  async getDahabDining(
    filters?: { area?: string; cuisine?: string[]; price?: string[]; q?: string; sort?: 'rating' | 'popular' | 'name' | 'price' | 'default'; order?: 'asc' | 'desc' },
    signal?: AbortSignal
  ): Promise<{ venues: DahabDiningVenue[] }> {
    const params = new URLSearchParams();
    if (filters?.area) params.set('area', filters.area);
    if (filters?.cuisine?.length) params.set('cuisine', filters.cuisine.join(','));
    if (filters?.price?.length) params.set('price', filters.price.join(','));
    if (filters?.q) params.set('q', filters.q);
    if (filters?.sort && filters.sort !== 'default') params.set('sort', filters.sort);
    if (filters?.order) params.set('order', filters.order);
    const qs = params.toString();
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/food${qs ? `?${qs}` : ''}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load places to eat in Dahab.');
    return await readJson<{ venues: DahabDiningVenue[] }>(res, 'Could not load places to eat in Dahab.');
  },

  async getEmergencyResources(signal?: AbortSignal): Promise<{ emergencyHotlines: Array<{ service: string; number: string }>; resources: unknown[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/emergency`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load emergency resources.');
    return await readJson<{ emergencyHotlines: Array<{ service: string; number: string }>; resources: unknown[] }>(res, 'Could not load emergency resources.');
  },

  async getRegulations(signal?: AbortSignal): Promise<{ regulations: unknown[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/regulations`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load regulations.');
    return await readJson<{ regulations: unknown[] }>(res, 'Could not load regulations.');
  },

  async getDahabAreas(signal?: AbortSignal): Promise<{ areas: unknown[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/areas`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load areas.');
    return await readJson<{ areas: unknown[] }>(res, 'Could not load areas.');
  },

  // ────────────────────────────────────────────────────────────────────────
  // Admin DKOS Endpoints (require Operations / Admin / Product role)
  // ────────────────────────────────────────────────────────────────────────

  async getAdminDkosHealth(signal?: AbortSignal): Promise<{ health: unknown }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/health`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load DKOS health.');
    return await readJson<{ health: unknown }>(res, 'Could not load DKOS health.');
  },

  async getAdminKnowledgeGaps(signal?: AbortSignal): Promise<{ gaps: unknown[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/gaps`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load knowledge gaps.');
    return await readJson<{ gaps: unknown[] }>(res, 'Could not load knowledge gaps.');
  },

  async getAdminStaleFacts(signal?: AbortSignal): Promise<{ staleFacts: unknown[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/stale-facts`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load stale facts.');
    return await readJson<{ staleFacts: unknown[] }>(res, 'Could not load stale facts.');
  },

  async getAdminConflicts(signal?: AbortSignal): Promise<{ conflicts: unknown[]; openCount: number }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/conflicts`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load conflicts.');
    return await readJson<{ conflicts: unknown[]; openCount: number }>(res, 'Could not load conflicts.');
  },

  async getAdminReviewQueue(signal?: AbortSignal): Promise<{ queue: unknown[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/review-queue`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load review queue.');
    return await readJson<{ queue: unknown[] }>(res, 'Could not load review queue.');
  },

  async getAdminExpansionMetrics(signal?: AbortSignal): Promise<{ metrics: unknown }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/expansion-metrics`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load expansion metrics.');
    return await readJson<{ metrics: unknown }>(res, 'Could not load expansion metrics.');
  },

  // ────────────────────────────────────────────────────────────────────────
  // Trip Status Transitions
  // ────────────────────────────────────────────────────────────────────────

  async transitionTripStatus(tripId: string, status: string, signal?: AbortSignal): Promise<{ trip: unknown }> {
    const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}/status`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify({ status }),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, `Cannot transition trip to ${status}.`);
    return await readJson<{ trip: unknown }>(res, `Cannot transition trip to ${status}.`);
  },

  // 0. Trips
  //
  // The backend has held real trips and trip items all along; no component
  // ever asked for them, so every page rendered a hardcoded itinerary instead.

  /**
   * Reads one trip and its items. Throws ApiError so a caller can tell a
   * missing session (401) from a trip that is not theirs or not there (404).
   */
  async getTrip(tripId: string, signal?: AbortSignal): Promise<{ trip: TripEntity; items: TripItemEntity[] }> {
    const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load this trip.');
    return await readJson<{ trip: TripEntity; items: TripItemEntity[] }>(res, 'Could not load this trip.');
  },

  /**
   * The bookings behind a trip's items, each with the supplier it is with.
   * This is what the bookings view needs to show a real provider and
   * confirmation code instead of a hardcoded reference.
   */
  async getTripBookings(
    tripId: string,
    signal?: AbortSignal
  ): Promise<{ tripId: string; bookings: TripBookingRecord[]; items: TripItemWithSupplier[] }> {
    const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}/bookings`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the bookings for this trip.');
    return await readJson<{ tripId: string; bookings: TripBookingRecord[]; items: TripItemWithSupplier[] }>(
      res,
      'Could not load the bookings for this trip.'
    );
  },

  /**
   * DELETE /api/trips/:tripId — removes a planned trip and its unbooked
   * items. Blocked with 409 while anything on it is BOOKED/CONFIRMED.
   */
  /**
   * The traveler's own edits to their trip. A refusal throws an ApiError whose
   * `code` is a TripDetailsErrorCode and whose `details` carry its values.
   */
  async updateTripDetails(tripId: string, patch: TripDetailsPatch): Promise<{ trip: TripEntity }> {
    const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not save the trip details.');
    return await readJson<{ trip: TripEntity }>(res, 'Could not save the trip details.');
  },

  async deleteTrip(tripId: string): Promise<{ deleted: boolean; itemsRemoved: number }> {
    const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}`, {
      method: 'DELETE',
      headers: defaultHeaders()
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not delete this trip.');
    return await readJson<{ deleted: boolean; itemsRemoved: number }>(res, 'Trip deletion');
  },

  /**
   * Creates or updates a trip. The server takes the owner from the session and
   * refuses a userId that is not the caller's, so none is sent.
   */
  async saveTrip(
    trip: Partial<TripEntity> & { id: string },
    signal?: AbortSignal
  ): Promise<{ trip: TripEntity }> {
    const res = await fetchWithTimeout('/api/trips', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(trip),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not save this trip.');
    return await readJson<{ trip: TripEntity }>(res, 'Could not save this trip.');
  },

  /** Every trip belonging to a user. The server refuses ids that are not theirs. */
  async getTripsForUser(userId: string, signal?: AbortSignal): Promise<{ trips: TripEntity[] }> {
    const res = await fetchWithTimeout(`/api/trips/user/${encodeURIComponent(userId)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your trips.');
    return await readJson<{ trips: TripEntity[] }>(res, 'Could not load your trips.');
  },

  /**
   * Add a trip item to a trip (activity, booking, etc.).
   * P0 fix: Experience → Trip now persists to backend, not just client state.
   */
  async addTripItem(
    tripId: string,
    item: {
      title: string;
      dayNumber: number;
      timeSlot: string;
      serviceType?: string;
      skuId?: string;
      priceEGP?: number;
    },
    signal?: AbortSignal
  ): Promise<{ item: TripItemEntity; trip: TripEntity }> {
    const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}/items`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(item),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not add item to trip.');
    return await readJson<{ item: TripItemEntity; trip: TripEntity }>(res, 'Could not add item to trip.');
  },

  /** Remove a trip item. Recalculates trip total on the backend. */
  async removeTripItem(
    tripId: string,
    itemId: string,
    signal?: AbortSignal
  ): Promise<{ removed: boolean; trip: TripEntity }> {
    const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}/items/${encodeURIComponent(itemId)}`, {
      method: 'DELETE',
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not remove item from trip.');
    return await readJson<{ removed: boolean; trip: TripEntity }>(res, 'Could not remove item from trip.');
  },

  // 1. Auth & Session (HttpOnly SameSite Cookie Transport)
  async register(name: string, email: string, phone: string, password: string, role: string = 'Traveler') {
    const res = await fetchWithTimeout('/api/auth/register', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ name, email, phone, password, role })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration failed' }));
      throw new Error(err.error || 'Registration failed');
    }
    return await res.json();
  },

  async login(email: string, password: string) {
    const res = await fetchWithTimeout('/api/auth/login', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Invalid credentials' }));
      throw new Error(err.error || 'Invalid credentials');
    }
    return await res.json();
  },

  /**
   * Exchanges a Firebase ID token for a server session cookie.
   *
   * The token is the only thing sent: the server derives uid, email and role
   * itself. Passing an identity or a role from here would be meaningless — and
   * the fact that it used to be accepted was a full authentication bypass.
   */
  async syncFirebaseSession(idToken: string) {
    const res = await fetchWithTimeout('/api/auth/firebase-session', {
      method: 'POST',
      headers: { ...defaultHeaders(), Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({})
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Firebase session sync failed' }));
      throw new Error(err.error || 'Firebase session sync failed');
    }
    return await res.json();
  },

  async getMe() {
    const res = await fetchWithTimeout('/api/auth/me', { headers: defaultHeaders() });
    if (!res.ok) return null;
    return await res.json();
  },

  /**
   * PUT /api/auth/profile — persist profile edits to the signed-in account.
   *
   * The profile page used to write to a React context only and still show a
   * "saved" toast, so the server record (and every flow that reads phone for
   * booking contact details) kept the stale value. This call makes the save
   * real; the returned user is the fresh server record, not an echo.
   */
  async updateProfile(updates: { name?: string; phone?: string }) {
    const res = await fetchWithTimeout('/api/auth/profile', {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(updates)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Could not save the changes' }));
      throw new Error(err.error || 'Could not save the changes');
    }
    return await res.json();
  },

  async logout() {
    try {
      await fetchWithTimeout('/api/auth/logout', {
        method: 'POST',
        headers: defaultHeaders()
      });
    } catch {
      // Graceful offline fallback
    }
  },

  // 2. Multi-Vertical Commerce & Inventory
  /**
   * The sellable products of one vertical.
   *
   * Book Now sold from IN_DESTINATION_SERVICES, a hardcoded array in the
   * frontend that Explore never showed — so the catalogue a traveler browsed
   * and the catalogue they could buy from had nothing in common. This is how
   * the checkout page reaches a product that came from somewhere else in the
   * app.
   */
  async getInventory(
    serviceType: string,
    signal?: AbortSignal
  ): Promise<{ serviceType: string; skus: ProductSkuEntity[] }> {
    const res = await fetchWithTimeout(`/api/inventory/${encodeURIComponent(serviceType)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load what is available to book.');
    return await readJson<{ serviceType: string; skus: ProductSkuEntity[] }>(
      res,
      'Could not load what is available to book.'
    );
  },

  async getHotels(
    params?: { category?: string; priceBand?: string; area?: string },
    signal?: AbortSignal
  ): Promise<import('../shared/types/commerce').HotelCatalogueResponse> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.priceBand) query.set('priceBand', params.priceBand);
    if (params?.area) query.set('area', params.area);
    const res = await fetchWithTimeout(`/api/hotels${query.size ? `?${query.toString()}` : ''}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load Dahab hotels.');
    return await readJson<import('../shared/types/commerce').HotelCatalogueResponse>(
      res,
      'Could not load Dahab hotels.'
    );
  },

  async getHotelBySlug(
    slug: string,
    signal?: AbortSignal
  ): Promise<import('../shared/types/commerce').HotelDetailResponse> {
    const res = await fetchWithTimeout(`/api/hotels/${encodeURIComponent(slug)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load that hotel.');
    return await readJson<import('../shared/types/commerce').HotelDetailResponse>(
      res,
      'Could not load that hotel.'
    );
  },

  async checkHotelAvailability(skuId: string, date: string, rooms = 1) {
    const res = await fetchWithTimeout('/api/commerce/availability', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ serviceType: 'hotel', skuId, date, timeSlot: 'Standard Check-in 14:00', passengers: rooms })
    });
    if (!res.ok) throw new Error('Failed to check hotel availability');
    return await res.json();
  },

  async getAccommodations(
    params?: {
      q?: string;
      propertyType?: string[];
      category?: string[];
      priceBand?: string[];
      areaId?: string[];
      guests?: number;
      maxPerNightEGP?: number;
      minRating?: number;
      mustHaveAmenities?: string[];
      sort?: string;
      /** 'card': the slim listing shape (no gallery / provenance / SKU). */
      view?: 'card';
    },
    signal?: AbortSignal
  ): Promise<import('../shared/types/commerce').AccommodationCatalogueResponse> {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.propertyType?.length) query.set('propertyType', params.propertyType.join(','));
    if (params?.category?.length) query.set('category', params.category.join(','));
    if (params?.priceBand?.length) query.set('priceBand', params.priceBand.join(','));
    if (params?.areaId?.length) query.set('areaId', params.areaId.join(','));
    if (params?.guests) query.set('guests', String(params.guests));
    if (params?.maxPerNightEGP) query.set('maxPerNightEGP', String(params.maxPerNightEGP));
    if (params?.minRating) query.set('minRating', String(params.minRating));
    if (params?.mustHaveAmenities?.length) query.set('mustHaveAmenities', params.mustHaveAmenities.join(','));
    if (params?.sort) query.set('sort', params.sort);
    if (params?.view) query.set('view', params.view);
    const res = await fetchWithTimeout(`/api/accommodations${query.size ? `?${query.toString()}` : ''}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load Dahab accommodations.');
    return await readJson<import('../shared/types/commerce').AccommodationCatalogueResponse>(
      res,
      'Could not load Dahab accommodations.'
    );
  },

  async getAccommodationBySlug(
    slug: string,
    signal?: AbortSignal
  ): Promise<import('../shared/types/commerce').AccommodationDetailResponse> {
    const res = await fetchWithTimeout(`/api/accommodations/${encodeURIComponent(slug)}`, {
      headers: defaultHeaders(),
      signal
    });
    // A real 404 is an answer ("no such stay"), not a failure: the view shows
    // not-found for it, and a retry only for timeouts and network errors.
    if (res.status === 404) {
      return { accommodation: null } as unknown as import('../shared/types/commerce').AccommodationDetailResponse;
    }
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load that stay.');
    return await readJson<import('../shared/types/commerce').AccommodationDetailResponse>(
      res,
      'Could not load that stay.'
    );
  },

  async adminListAccommodations(params?: { q?: string; active?: boolean }) {
    const query = new URLSearchParams();
    if (params?.q) query.set('q', params.q);
    if (params?.active !== undefined) query.set('active', String(params.active));
    const res = await fetchWithTimeout(`/api/admin/accommodations${query.size ? `?${query.toString()}` : ''}`, {
      headers: defaultHeaders()
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load accommodations.');
    return await readJson<{ accommodations: import('../shared/types/commerce').AccommodationEntity[] }>(res, 'Could not load accommodations.');
  },

  async adminSetAccommodationActive(id: string, active: boolean) {
    const res = await fetchWithTimeout(`/api/admin/accommodations/${encodeURIComponent(id)}/active`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify({ active })
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not update that accommodation.');
    return await readJson<{ accommodation: import('../shared/types/commerce').AccommodationEntity }>(res, 'Could not update that accommodation.');
  },

  async adminListPropertySources(accommodationId: string) {
    const res = await fetchWithTimeout(`/api/admin/accommodations/${encodeURIComponent(accommodationId)}/sources`, {
      headers: defaultHeaders()
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load source links.');
    return await readJson<{ sources: import('../shared/types/commerce').PropertySourceEntity[] }>(res, 'Could not load source links.');
  },

  async adminAddPropertySource(accommodationId: string, input: { sourceType: string; url: string; label?: string; displayOrder?: number }) {
    const res = await fetchWithTimeout(`/api/admin/accommodations/${encodeURIComponent(accommodationId)}/sources`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(input)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not add that source link.');
    return await readJson<{ source: import('../shared/types/commerce').PropertySourceEntity }>(res, 'Could not add that source link.');
  },

  async adminUpdatePropertySource(accommodationId: string, sourceId: string, patch: Record<string, unknown>) {
    const res = await fetchWithTimeout(`/api/admin/accommodations/${encodeURIComponent(accommodationId)}/sources/${encodeURIComponent(sourceId)}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not update that source link.');
    return await readJson<{ source: import('../shared/types/commerce').PropertySourceEntity }>(res, 'Could not update that source link.');
  },

  async adminDeletePropertySource(accommodationId: string, sourceId: string) {
    const res = await fetchWithTimeout(`/api/admin/accommodations/${encodeURIComponent(accommodationId)}/sources/${encodeURIComponent(sourceId)}`, {
      method: 'DELETE',
      headers: defaultHeaders()
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not remove that source link.');
    return await readJson<{ removed: boolean }>(res, 'Could not remove that source link.');
  },

  async parseAccommodationSearchIntent(
    query: string,
    language: 'en' | 'ar' = 'en'
  ): Promise<import('../shared/types/commerce').AccommodationSearchIntentResult> {
    const res = await fetchWithTimeout('/api/accommodations/search-intent', {
      timeout: AI_TIMEOUT_MS,
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ query, language })
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not understand that search.');
    return await readJson<import('../shared/types/commerce').AccommodationSearchIntentResult>(
      res,
      'Could not understand that search.'
    );
  },

  // ---------------------------------------------------------------------------
  // Rentals (bikes MVP — generic rental domain)
  // ---------------------------------------------------------------------------

  async getRentals(
    params?: {
      category?: string;
      subcategory?: string;
      zone?: string;
      q?: string;
      sort?: string;
      startDate?: string;
      endDate?: string;
      quantity?: number;
    },
    signal?: AbortSignal
  ): Promise<import('../shared/types/commerce').RentalCatalogueResponse> {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.subcategory) query.set('subcategory', params.subcategory);
    if (params?.zone) query.set('zone', params.zone);
    if (params?.q) query.set('q', params.q);
    if (params?.sort) query.set('sort', params.sort);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.quantity) query.set('quantity', String(params.quantity));
    // No trailing slash: the API policy matches `/rentals` exactly, and
    // `/rentals/` falls through to deny-by-default.
    const res = await fetchWithTimeout(`/api/rentals${query.size ? `?${query.toString()}` : ''}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load Dahab rentals.');
    return await readJson<import('../shared/types/commerce').RentalCatalogueResponse>(
      res,
      'Could not load Dahab rentals.'
    );
  },

  async getRentalBySlug(
    slug: string,
    signal?: AbortSignal
  ): Promise<import('../shared/types/commerce').RentalDetailResponse> {
    const res = await fetchWithTimeout(`/api/rentals/${encodeURIComponent(slug)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load that rental.');
    return await readJson<import('../shared/types/commerce').RentalDetailResponse>(
      res,
      'Could not load that rental.'
    );
  },

  async checkRentalAvailability(params: {
    listingId: string;
    startDate: string;
    endDate: string;
    quantity: number;
  }): Promise<import('../shared/types/commerce').RentalAvailabilityResult> {
    const res = await fetchWithTimeout('/api/rentals/check-availability', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Availability check failed.');
    return await readJson<import('../shared/types/commerce').RentalAvailabilityResult>(
      res,
      'Availability check failed.'
    );
  },

  async quoteRental(params: {
    listingId: string;
    startDate: string;
    endDate: string;
    quantity: number;
    extraIds?: string[];
    deliveryMode?: 'PICKUP' | 'DELIVERY';
    deliveryZoneId?: string;
  }): Promise<import('../shared/types/commerce').RentalQuoteResult> {
    const res = await fetchWithTimeout('/api/rentals/quote', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Quote failed.');
    return await readJson<import('../shared/types/commerce').RentalQuoteResult>(
      res,
      'Quote failed.'
    );
  },

  async createRentalBooking(params: {
    listingId: string;
    tripId: string;
    travelerPhone?: string;
    startDate: string;
    endDate: string;
    quantity: number;
    deliveryMode?: 'PICKUP' | 'DELIVERY';
    deliveryZoneId?: string;
    deliveryAddress?: string;
    pickupTime?: string;
    extraIds?: string[];
    notes?: string;
    idempotencyKey?: string;
  }): Promise<{ booking: import('../shared/types/commerce').RentalBookingView; replayed?: boolean }> {
    const res = await fetchWithTimeout('/api/rental-bookings', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not create the rental booking.');
    return await readJson<{ booking: import('../shared/types/commerce').RentalBookingView; replayed?: boolean }>(
      res,
      'Could not create the rental booking.'
    );
  },

  async checkoutRentalBooking(params: {
    rentalBookingId: string;
    tripId: string;
    travelerPhone?: string;
    idempotencyKey: string;
    provider?: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
    cardLast4?: string;
    cardBrand?: string;
    cardHolderName?: string;
  }): Promise<{ success: boolean; bookingRef: string; totalAmountEGP: number; replayed?: boolean }> {
    const res = await fetchWithTimeout(`/api/rental-bookings/${encodeURIComponent(params.rentalBookingId)}/checkout`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Checkout failed.');
    return await readJson<{ success: boolean; bookingRef: string; totalAmountEGP: number; replayed?: boolean }>(
      res,
      'Checkout failed.'
    );
  },

  async cancelRentalBooking(
    bookingId: string,
    reason?: string
  ): Promise<{ booking: import('../shared/types/commerce').RentalBookingView }> {
    const res = await fetchWithTimeout(`/api/rental-bookings/${encodeURIComponent(bookingId)}/cancel`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not cancel the rental booking.');
    return await readJson<{ booking: import('../shared/types/commerce').RentalBookingView }>(
      res,
      'Could not cancel the rental booking.'
    );
  },

  async getMyRentalBookings(signal?: AbortSignal): Promise<{
    bookings: import('../shared/types/commerce').RentalBookingView[];
  }> {
    const res = await fetchWithTimeout('/api/rental-bookings', {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your rental bookings.');
    return await readJson<{ bookings: import('../shared/types/commerce').RentalBookingView[] }>(
      res,
      'Could not load your rental bookings.'
    );
  },

  // -- provider surfaces ------------------------------------------------------

  async getProviderRentals(signal?: AbortSignal): Promise<{
    rentals: import('../shared/types/commerce').RentalListingView[];
  }> {
    const res = await fetchWithTimeout('/api/rentals/provider', {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your rental listings.');
    return await readJson<{ rentals: import('../shared/types/commerce').RentalListingView[] }>(
      res,
      'Could not load your rental listings.'
    );
  },

  async getProviderRentalBookings(
    params?: { status?: string; from?: string; to?: string },
    signal?: AbortSignal
  ): Promise<{ bookings: import('../shared/types/commerce').RentalBookingView[] }> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);
    const res = await fetchWithTimeout(`/api/rental-bookings/provider${query.size ? `?${query.toString()}` : ''}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your rental bookings.');
    return await readJson<{ bookings: import('../shared/types/commerce').RentalBookingView[] }>(
      res,
      'Could not load your rental bookings.'
    );
  },

  async acceptRentalBooking(
    bookingId: string
  ): Promise<{ booking: import('../shared/types/commerce').RentalBookingView }> {
    const res = await fetchWithTimeout(`/api/rental-bookings/${encodeURIComponent(bookingId)}/accept`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({})
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not accept the rental booking.');
    return await readJson<{ booking: import('../shared/types/commerce').RentalBookingView }>(
      res,
      'Could not accept the rental booking.'
    );
  },

  async rejectRentalBooking(
    bookingId: string,
    reason?: string
  ): Promise<{ booking: import('../shared/types/commerce').RentalBookingView }> {
    const res = await fetchWithTimeout(`/api/rental-bookings/${encodeURIComponent(bookingId)}/reject`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not reject the rental booking.');
    return await readJson<{ booking: import('../shared/types/commerce').RentalBookingView }>(
      res,
      'Could not reject the rental booking.'
    );
  },

  async markRentalReturned(
    bookingId: string,
    opts: { damageReport?: string; depositDeductionEGP?: number; lateFeeEGP?: number } = {}
  ): Promise<{ booking: import('../shared/types/commerce').RentalBookingView }> {
    const res = await fetchWithTimeout(`/api/rental-bookings/${encodeURIComponent(bookingId)}/mark-returned`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(opts)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not mark the rental returned.');
    return await readJson<{ booking: import('../shared/types/commerce').RentalBookingView }>(
      res,
      'Could not mark the rental returned.'
    );
  },

  async addRentalMaintenanceBlock(
    listingId: string,
    opts: { startDate: string; endDate: string; quantityBlocked: number; reason?: string }
  ): Promise<{ block: import('../shared/types/commerce').RentalMaintenanceBlock }> {
    const res = await fetchWithTimeout(`/api/rentals/${encodeURIComponent(listingId)}/maintenance-blocks`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(opts)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not add the maintenance block.');
    return await readJson<{ block: import('../shared/types/commerce').RentalMaintenanceBlock }>(
      res,
      'Could not add the maintenance block.'
    );
  },

  async removeRentalMaintenanceBlock(listingId: string, blockId: string): Promise<{ removed: boolean }> {
    const res = await fetchWithTimeout(
      `/api/rentals/${encodeURIComponent(listingId)}/maintenance-blocks/${encodeURIComponent(blockId)}`,
      {
        method: 'DELETE',
        headers: defaultHeaders()
      }
    );
    if (!res.ok) throw await apiErrorFrom(res, 'Could not remove the maintenance block.');
    return await res.json();
  },

  async getTransferOrigins(transferType?: 'within_dahab' | 'anywhere', query?: string) {
    const params = new URLSearchParams();
    if (transferType) params.set('transferType', transferType);
    if (query) params.set('query', query);
    const res = await fetchWithTimeout(`/api/transfers/origins?${params.toString()}`, {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to load transfer origins');
    return await res.json();
  },

  async getTransferHub() {
    const res = await fetchWithTimeout('/api/transfers/hub', { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to load the ride hub');
    return await res.json() as {
      origins: Array<{ id: string; labelEn: string; labelAr: string; subEn: string; subAr: string; distanceKm: number; durationEn: string; durationAr: string; haul: 'short' | 'long' }>;
      destinations: Array<{ id: string; labelEn: string; labelAr: string; subEn: string; subAr: string; priceAddEGP: number; kind: 'zone' | 'area' }>;
      addons: Array<{ id: string; priceEGP: number }>;
    };
  },

  async getTransferBuses(originId: string) {
    const res = await fetchWithTimeout(`/api/transfers/buses?originId=${encodeURIComponent(originId)}`, { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to load buses');
    return await res.json() as { buses: Array<{ id: string; operatorName: string; operatorNameAr: string; departLabel: string; arriveLabel: string; durationLabel: string; priceEGP: number; seats: number; fromLabel: string; toLabel: string }> };
  },

  async getTransferFleet(originId: string, destinationId: string, tierId: string) {
    const params = new URLSearchParams({ originId, destinationId, tierId });
    const res = await fetchWithTimeout(`/api/transfers/fleet?${params.toString()}`, { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to load fleet');
    return await res.json() as { days: Array<{ date: string; demand: number; tone: 'cheap' | 'moderate' | 'busy'; displayEGP: number }> };
  },

  async getTransferDriverPreview() {
    const res = await fetchWithTimeout('/api/transfers/drivers/preview', { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to load drivers');
    return await res.json() as { drivers: Array<{ id: string; nameEn: string; nameAr: string; rating: number; trips: number; langs: string[]; carEn: string; carAr: string; initials: string; verified: boolean }> };
  },

  async quoteTransferHub(body: Record<string, unknown>, ops = false) {
    const res = await fetchWithTimeout(ops ? '/api/operations/transfers/quote' : '/api/transfers/quote', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not price this ride.');
    return await readJson<{ quote: {
      sellEGP: number;
      earlyDiscountEGP: number;
      vehicleEGP: number;
      returnEGP: number;
      busLastMileEGP: number;
      longHaul: boolean;
      distanceKm: number;
      durationEn: string;
      durationAr: string;
      freeCancelUntil: string | null;
      comparison: { privateEGP: number; sharedEGP: number; busLastMileEGP: number };
      tiers: Array<{ id: 'shared' | 'private' | 'premium'; totalEGP: number }>;
      supplierCostEGP?: number;
      marginEGP?: number;
    } }>(res, 'Could not price this ride.');
  },

  async lockTransferHub(body: Record<string, unknown>) {
    const res = await fetchWithTimeout('/api/transfers/lock', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not lock this ride.');
    return await readJson<{ booking: { id: string; bookingRef: string; amountEGP: number; paymentState: string; freeCancelUntil: string | null } }>(res, 'Could not lock this ride.');
  },

  async getOpsTransferCatalog() {
    const res = await fetchWithTimeout('/api/operations/transfers/catalog', { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to load the transfer catalog');
    return await res.json() as {
      zones: Array<Record<string, string | number | boolean>>;
      buses: Array<Record<string, string | number | boolean>>;
      drivers: Array<Record<string, string | number | boolean | string[]>>;
    };
  },

  async updateOpsTransferZone(id: string, patch: Record<string, number>) {
    const res = await fetchWithTimeout(`/api/operations/transfers/zones/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error('Failed to save the zone price');
    return await res.json();
  },

  async updateOpsTransferBus(id: string, patch: Record<string, string | number>) {
    const res = await fetchWithTimeout(`/api/operations/transfers/buses/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error('Failed to save the bus');
    return await res.json();
  },

  async addOpsTransferBus(originId: string) {
    const res = await fetchWithTimeout('/api/operations/transfers/buses', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ originId })
    });
    if (!res.ok) throw new Error('Failed to add a bus');
    return await res.json();
  },

  async updateOpsTransferDriver(id: string, patch: Record<string, string | number | boolean>) {
    const res = await fetchWithTimeout(`/api/operations/transfers/drivers/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(patch)
    });
    if (!res.ok) throw new Error('Failed to save the driver');
    return await res.json();
  },

  async assignOpsTransferDriver(bookingId: string, driverId: string) {
    const res = await fetchWithTimeout('/api/operations/transfers/assign', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ bookingId, driverId })
    });
    if (!res.ok) throw new Error('Failed to assign the driver');
    return await res.json();
  },

  // ---------------------------------------------------------------- WhatsApp
  // The transport's operations surface: linked numbers (one OpenWA session
  // each), purpose routing, and the delivery outbox. A message row is only
  // ever SENT when a provider accepted it - the console must show SIMULATED
  // as "not sent", never as delivered.

  async getOpsWhatsAppSessions() {
    const res = await fetchWithTimeout('/api/operations/whatsapp/sessions', { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to read WhatsApp sessions');
    return await readJson<WhatsAppSessionsResponse>(res, 'WhatsApp sessions');
  },

  async linkOpsWhatsAppSession(input: {
    label: string;
    phone: string;
    purpose: WhatsAppPurpose;
    isDefault?: boolean;
    note?: string;
  }) {
    const res = await fetchWithTimeout('/api/operations/whatsapp/sessions', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(input)
    });
    const data = await readJson<{ session: WhatsAppSession }>(res, 'WhatsApp session').catch(() => null);
    if (!res.ok) throw new Error(data && (data as unknown as { error?: string }).error || 'Failed to link the number');
    return data!;
  },

  async updateOpsWhatsAppSession(id: string, patch: Partial<WhatsAppSession>) {
    const res = await fetchWithTimeout(`/api/operations/whatsapp/sessions/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(patch)
    });
    const data = await readJson<{ session: WhatsAppSession }>(res, 'WhatsApp session').catch(() => null);
    if (!res.ok) throw new Error(data && (data as unknown as { error?: string }).error || 'Failed to update the session');
    return data!;
  },

  async refreshOpsWhatsAppSession(id: string) {
    const res = await fetchWithTimeout(`/api/operations/whatsapp/sessions/${encodeURIComponent(id)}/refresh`, {
      method: 'POST',
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to read the live session state');
    return await readJson<{ session: WhatsAppSession }>(res, 'WhatsApp session');
  },

  async getOpsWhatsAppMessages(params?: { status?: WhatsAppMessageStatus; purpose?: WhatsAppPurpose; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.purpose) query.set('purpose', params.purpose);
    if (params?.limit) query.set('limit', String(params.limit));
    const res = await fetchWithTimeout(`/api/operations/whatsapp/messages${query.toString() ? `?${query.toString()}` : ''}`, { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to read the WhatsApp outbox');
    return await readJson<{ messages: WhatsAppMessage[] }>(res, 'WhatsApp outbox');
  },

  /** One operator-supplied message through the real transport. */
  async sendOpsWhatsAppTest(input: { phone: string; purpose: WhatsAppPurpose; body: string }) {
    const res = await fetchWithTimeout('/api/operations/whatsapp/test', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(input)
    });
    const data = await readJson<{ message: WhatsAppMessage }>(res, 'WhatsApp test message').catch(() => null);
    if (!res.ok) throw new Error(data && (data as unknown as { error?: string }).error || 'Failed to send the test message');
    return data!;
  },

  async dispatchOpsWhatsApp() {
    const res = await fetchWithTimeout('/api/operations/whatsapp/dispatch', {
      method: 'POST',
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to drain the outbox');
    return await readJson<{ dispatched: number }>(res, 'WhatsApp outbox dispatch');
  },

  async getTransferRoute(originId: string, tierId?: 'private' | 'shared' | 'premium') {
    const params = new URLSearchParams({ origin: originId });
    if (tierId) params.set('tier', tierId);
    const res = await fetchWithTimeout(`/api/transfers/route?${params.toString()}`, {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to quote transfer route');
    return await res.json();
  },

  async resolveTransferGeo(latitude: number, longitude: number): Promise<TransferResolveGeoResponse> {
    const res = await fetchWithTimeout(`/api/transfers/resolve-geo?lat=${latitude}&lng=${longitude}`, {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to resolve location');
    return await res.json();
  },

  async prepareTransferBooking(params: {
    tripId: string;
    originId: string;
    tierId: 'private' | 'shared' | 'premium';
    date: string;
    timeSlot: string;
    passengersCount: number;
    idempotencyKey: string;
  }) {
    const res = await fetchWithTimeout('/api/transfers/prepare-booking', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not hold this transfer.');
    return await readJson<{
      skuId: string;
      originId: string;
      tierId: 'private' | 'shared' | 'premium';
      quote: { priceEGP: number; route?: string; destination?: string };
      hold: CommerceHold;
    }>(res, 'Could not hold this transfer.');
  },

  async completeTransferBooking(params: {
    holdToken: string;
    tripId: string;
    travelerName: string;
    travelerPhone: string;
    travelerEmail: string;
    pickupLocation: string;
    dropoffLocation: string;
    flightNumber?: string;
    specialRequests?: string;
    scheduledDate: string;
    scheduledTime: string;
    idempotencyKey: string;
    cardLast4?: string;
    cardBrand?: string;
    cardHolderName?: string;
    provider?: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
  }) {
    const res = await fetchWithTimeout('/api/commerce/checkout', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'The transfer could not be booked.');
    return await readJson<{
      status: 'CONFIRMED';
      booking: { id: string; bookingRef: string; confirmationCode: string; amountEGP: number };
      telemetry: TransferTelemetry | null;
      ledgerVerified: boolean;
    }>(res, 'The transfer could not be booked.');
  },

  /**
   * Reserves a slot for the party. Every checkout settles holds, so this runs
   * first. The holder is the session user — the server never takes it from
   * the body — and the key makes a double submit return the same hold.
   */
  async createHold(params: {
    skuId: string;
    tripId: string;
    date: string;
    timeSlot: string;
    passengersCount: number;
    idempotencyKey: string;
  }): Promise<CommerceHold> {
    const res = await fetchWithTimeout('/api/commerce/hold', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    // ApiError carries the server's status, code and details (skuId,
    // supplierId/date, reason) — the blocked-date 409 renders its own honest
    // state from these instead of regex-parsing the message.
    if (!res.ok) throw await apiErrorFrom(res, 'Could not hold your spot.');
    return await readJson<CommerceHold>(res, 'Could not hold your spot.');
  },

  /** P4 trust: honest alternatives when a hold fails (409 sold out). */
  async findAlternatives(params: {
    tripId: string;
    skuId: string;
    date: string;
    timeSlot?: string;
    passengersCount: number;
    limit?: number;
  }): Promise<{ alternatives: CommerceAlternative[] }> {
    const res = await fetchWithTimeout('/api/commerce/alternatives', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not look for alternatives.');
    return await readJson<{ alternatives: CommerceAlternative[] }>(res, 'Could not look for alternatives.');
  },

  /** P4 trust: backend-authoritative price explainer (basis + totals). */
  async explainPrice(params: {
    tripId: string;
    items: Array<{ skuId: string; passengersCount?: number; nights?: number }>;
  }): Promise<PriceExplanation> {
    const res = await fetchWithTimeout('/api/commerce/explain-price', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to explain price');
    }
    return await res.json();
  },

  async completeMultiCheckout(params: {
    tripId: string;
    travelerName: string;
    travelerPhone: string;
    travelerEmail: string;
    items: Array<{
      serviceType: CommerceServiceType;
      skuId: string;
      /** Required: every line settles an ACTIVE hold the caller owns. */
      holdToken: string;
      scheduledDate: string;
      scheduledTime: string;
      /**
       * The price the traveller was shown. The server charges the catalogue
       * price and answers 409 PRICE_CHANGED when they differ.
       */
      amountEGP: number;
      /** Must equal the hold's party size (else 400 HOLD_MISMATCH). */
      passengersCount?: number;
      pickupLocation?: string;
      dropoffLocation?: string;
      specialRequests?: string;
    }>;
    paymentParams: {
      idempotencyKey: string;
      provider?: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
      /**
       * Last four digits only. Never send a full card number, expiry or CVV:
       * doing so puts this API and everything behind it in PCI-DSS scope. A
       * real integration collects card data in a hosted gateway field and
       * sends a token instead.
       */
      cardLast4?: string;
      cardBrand?: string;
      cardHolderName?: string;
    };
  }) {
    const res = await fetchWithTimeout('/api/commerce/checkout/multi', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    // { error, code, details } — PRICE_CHANGED, HOLD_EXPIRED, … — arrives on
    // the ApiError; see src/services/checkoutError.ts for what each means.
    if (!res.ok) throw await apiErrorFrom(res, 'The booking could not be completed.');
    return await readJson<MultiCheckoutResult>(res, 'The booking could not be completed.');
  },

  async processRefund(params: {
    bookingId?: string;
    tripId: string;
    amountEGP: number;
    reason: string;
    idempotencyKey: string;
    initiatedBy?: string;
  }) {
    const res = await fetchWithTimeout('/api/commerce/refund', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Refund failed');
    }
    return await res.json();
  },

  async completeCheckout(params: {
    holdToken?: string;
    tripId: string;
    travelerName?: string;
    travelerPhone?: string;
    travelerEmail?: string;
    pickupLocation?: string;
    dropoffLocation?: string;
    flightNumber?: string;
    specialRequests?: string;
    scheduledDate?: string;
    scheduledTime?: string;
    idempotencyKey: string;
    /** Last four digits only. See the note on completeMultiCheckout. */
    cardLast4?: string;
    cardBrand?: string;
    cardHolderName?: string;
    provider?: 'PAYMOB' | 'STRIPE' | 'CASH_ON_ARRIVAL';
  }) {
    const res = await fetchWithTimeout('/api/commerce/checkout', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'The payment could not be completed.');
    return await res.json();
  },

  async getLedger() {
    const res = await fetchWithTimeout('/api/commerce/ledger', { headers: defaultHeaders() });
    return await res.json();
  },

  async verifyLedger() {
    const res = await fetchWithTimeout('/api/commerce/ledger/verify', { headers: defaultHeaders() });
    return await res.json();
  },

  async checkAvailability(params: {
    serviceType: string;
    skuId?: string;
    date?: string;
    timeSlot?: string;
    passengers?: number;
  }) {
    const res = await fetchWithTimeout('/api/commerce/availability', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Availability check failed');
    }
    return await res.json();
  },

  async cancelBooking(params: {
    bookingId: string;
    tripId: string;
    reason: string;
    cancellationKey: string;
  }): Promise<{
    success: boolean;
    booking: BookingDetail;
    refunded: boolean;
    refundAmountEGP?: number;
  }> {
    const res = await fetchWithTimeout('/api/commerce/cancel', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Cancellation failed.');
    return await readJson<{ success: boolean; booking: BookingDetail; refunded: boolean; refundAmountEGP?: number }>(
      res,
      'Cancellation failed.'
    );
  },

  async getBookingDetails(bookingId: string): Promise<BookingDetail> {
    const res = await fetchWithTimeout(`/api/bookings/${encodeURIComponent(bookingId)}`, { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Failed to load the booking.');
    return await readJson<BookingDetail>(res, 'Failed to load the booking.');
  },

  async getTripBookingsDetailed(tripId: string): Promise<{ bookings: BookingDetail[] }> {
    const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}/bookings/detailed`, { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Failed to load the trip\'s bookings.');
    return await readJson<{ bookings: BookingDetail[] }>(res, 'Failed to load the trip\'s bookings.');
  },

  async rescheduleBooking(bookingId: string, params: {
    tripId: string;
    newDate: string;
    newTime: string;
    idempotencyKey: string;
  }): Promise<{ success: boolean; booking: BookingDetail }> {
    const res = await fetchWithTimeout(`/api/bookings/${encodeURIComponent(bookingId)}/reschedule`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Rescheduling failed.');
    return await readJson<{ success: boolean; booking: BookingDetail }>(res, 'Rescheduling failed.');
  },

  async checkRichAvailability(params: {
    serviceType?: string;
    skuId?: string;
    date?: string;
    timeSlot?: string;
    passengers?: number;
  }): Promise<RichAvailabilityResponse> {
    const res = await fetchWithTimeout('/api/commerce/availability/rich', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Availability check failed.');
    return await readJson<RichAvailabilityResponse>(res, 'Availability check failed.');
  },

  // ------------------------------------------------------------------------
  // Verified-stay reviews (blueprint row #14)
  // ------------------------------------------------------------------------

  /** The session's review for a booking, plus whether the CTA should show. */
  async getBookingReview(bookingRef: string): Promise<BookingReviewState> {
    const res = await fetchWithTimeout(`/api/bookings/${encodeURIComponent(bookingRef)}/review`, { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Failed to load the review state.');
    return await readJson<BookingReviewState>(res, 'Failed to load the review state.');
  },

  /** Submit (or replace) the verified review for a completed booking. */
  async submitBookingReview(bookingRef: string, params: {
    rating: number;
    body: string;
    title?: string;
    bodyAr?: string;
  }): Promise<ReviewSummary> {
    const res = await fetchWithTimeout(`/api/bookings/${encodeURIComponent(bookingRef)}/review`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Submitting the review failed.');
    return await readJson<ReviewSummary>(res, 'Submitting the review failed.');
  },

  /** Public approved reviews + aggregate for a supplier. */
  async getSupplierReviews(supplierId: string): Promise<SupplierReviewsResponse> {
    const res = await fetchWithTimeout(`/api/reviews/supplier/${encodeURIComponent(supplierId)}`, { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Failed to load reviews.');
    return await readJson<SupplierReviewsResponse>(res, 'Failed to load reviews.');
  },

  /** Supplier reef-positive conservation score (0-100). */
  async getSupplierReefScore(supplierId: string): Promise<number | null> {
    try {
      const res = await fetchWithTimeout(`/api/suppliers/${encodeURIComponent(supplierId)}/reef-score`, { headers: defaultHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.reefScore === 'number' ? data.reefScore : null;
    } catch {
      return null;
    }
  },

  /**
   * The signed-in traveler's own reef-action logs + total conservation points
   * (GET /api/reef-actions/mine). Returns null when the record is unreachable
   * so callers never render an invented zero.
   */
  async getMyReefLogs(): Promise<{
    logs: Array<{
      id: string;
      bookingId: string;
      tripId: string;
      supplierId: string;
      actionType: string;
      description: string;
      pointsAwarded: number;
      loggedBy: string;
      createdAt: string;
    }>;
    totalPoints: number;
  } | null> {
    try {
      const res = await fetchWithTimeout('/api/reef-actions/mine', { headers: defaultHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        logs: Array.isArray(data.logs) ? data.logs : [],
        totalPoints: typeof data.totalPoints === 'number' ? data.totalPoints : 0,
      };
    } catch {
      return null;
    }
  },

  /** Trip members (group planning). */
  async getTripMembers(tripId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}/members`, { headers: defaultHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.members) ? data.members : [];
    } catch {
      return [];
    }
  },

  /** Split state for a trip (who owes what). */
  async getTripSplits(tripId: string): Promise<Array<Record<string, unknown>>> {
    try {
      const res = await fetchWithTimeout(`/api/trips/${encodeURIComponent(tripId)}/splits`, { headers: defaultHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.splits) ? data.splits : [];
    } catch {
      return [];
    }
  },

  /** Long-stay (nomad) pricing for an accommodation at a given night count. */
  async getLongStayPrice(accommodationId: string, nights: number): Promise<{
    breakdown: { totalEGP: number; monthlyBlocks: number; weeklyBlocks: number; remainderNights: number; perNightEGP: number; parts: string[] } | null;
    savings: { dailyTotalEGP: number; longStayTotalEGP: number; savingsEGP: number; savingsPercent: number } | null;
    hasLongStayPricing: boolean;
  } | null> {
    try {
      const res = await fetchWithTimeout(`/api/accommodations/${encodeURIComponent(accommodationId)}/long-stay-price?nights=${nights}`, { headers: defaultHeaders() });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  /** Accommodations offering long-stay pricing, optionally filtered by area. */
  async getLongStayAccommodations(areaId?: string): Promise<Array<Record<string, unknown>>> {
    try {
      const qs = areaId ? `?areaId=${encodeURIComponent(areaId)}` : '';
      const res = await fetchWithTimeout(`/api/accommodations/long-stay${qs}`, { headers: defaultHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.accommodations) ? data.accommodations : [];
    } catch {
      return [];
    }
  },

  // -------------------------------------------------------------------------
  // Stays: room types, availability, quotes, reservations
  // -------------------------------------------------------------------------

  /** The room types a property sells, sellable only. */
  async getRoomTypes(slug: string, signal?: AbortSignal): Promise<{
    accommodationId: string;
    heldBack: boolean;
    roomTypes: Array<{
      id: string;
      name: string;
      nameAr: string;
      maxGuestsPerUnit: number;
      baseNightlyEGP: number;
      totalUnits: number;
      inventorySource: string;
    }>;
  }> {
    const res = await fetchWithTimeout(`/api/accommodations/${encodeURIComponent(slug)}/room-types`, {
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the room types.');
    return await readJson(res, 'Could not load the room types.');
  },

  /** Per-night availability across a window, per room type. */
  async getStayAvailability(
    slug: string,
    params: { checkIn: string; checkOut: string; rooms: number; adults: number; children?: number },
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams({
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      rooms: String(params.rooms),
      adults: String(params.adults),
    });
    if (params.children !== undefined) qs.set('children', String(params.children));
    const res = await fetchWithTimeout(`/api/accommodations/${encodeURIComponent(slug)}/availability?${qs}`, {
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not check availability.');
    return await readJson(res, 'Could not check availability.');
  },

  /** What a stay costs. Stateless — the reservation re-prices at hold time. */
  async quoteStay(
    slug: string,
    params: {
      roomTypeId: string;
      checkIn: string;
      checkOut: string;
      rooms: number;
      adults: number;
      children?: number;
      signal?: AbortSignal;
    }
  ): Promise<{ quote: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/accommodations/${encodeURIComponent(slug)}/quote`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({
        roomTypeId: params.roomTypeId,
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        rooms: params.rooms,
        adults: params.adults,
        children: params.children ?? 0,
      }),
      signal: params.signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not price that stay.');
    return await readJson<{ quote: Record<string, unknown> }>(res, 'Could not price that stay.');
  },

  /** Reserve rooms and open a reservation awaiting its deposit. */
  async reserveStay(params: {
    accommodationId: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    rooms: number;
    adults: number;
    children?: number;
    guestDetails?: Array<{ fullName: string; isChild?: boolean; age?: number }>;
    specialRequests?: string;
    arrivalTime?: string;
    paymentMethod: string;
    idempotencyKey: string;
    tripId?: string;
  }, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const res = await fetchWithTimeout('/api/hotel-bookings', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not reserve that stay.');
    return await readJson(res, 'Could not reserve that stay.');
  },

  async getStay(ref: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const res = await fetchWithTimeout(`/api/hotel-bookings/${encodeURIComponent(ref)}`, {
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load that reservation.');
    const data = await readJson<{ booking?: Record<string, unknown> }>(res, 'Could not load that reservation.');
    // The route wraps the row ({ booking }); the confirmation view wants the row.
    return (data.booking ?? data) as Record<string, unknown>;
  },

  /** Upload a photo of the deposit receipt (image data URL, 3MB max). */
  async uploadStayReceipt(ref: string, dataUrl: string): Promise<{ booking: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/hotel-bookings/${encodeURIComponent(ref)}/payment-receipt`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ dataUrl }),
      // A few MB on a slow Sinai link can outlast the default 8s.
      timeout: 60_000,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not upload the receipt.');
    return await readJson(res, 'Could not upload the receipt.');
  },

  /** "I've sent it": the wallet number and/or transaction id the deposit came from. */
  async claimStayPayment(
    ref: string,
    body: { payerNumber?: string; payerReference?: string },
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const res = await fetchWithTimeout(`/api/hotel-bookings/${encodeURIComponent(ref)}/payment-claim`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not record the payment.');
    return await readJson(res, 'Could not record the payment.');
  },

  async submitStayPaymentProof(
    ref: string,
    body: { proofUrl: string; method?: string; reference?: string },
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const res = await fetchWithTimeout(`/api/hotel-bookings/${encodeURIComponent(ref)}/payment-proof`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not attach that proof.');
    return await readJson(res, 'Could not attach that proof.');
  },

  async cancelStay(ref: string, reason?: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const res = await fetchWithTimeout(`/api/hotel-bookings/${encodeURIComponent(ref)}/cancel`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ reason: reason ?? '' }),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not cancel that reservation.');
    return await readJson(res, 'Could not cancel that reservation.');
  },

  async rescheduleStay(
    ref: string,
    body: { checkIn: string; checkOut: string },
    signal?: AbortSignal
  ): Promise<Record<string, unknown>> {
    const res = await fetchWithTimeout(`/api/hotel-bookings/${encodeURIComponent(ref)}/reschedule`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not move that reservation.');
    return await readJson(res, 'Could not move that reservation.');
  },

  /** Every stay the signed-in traveller booked, with or without a trip. */
  async getMyStays(signal?: AbortSignal): Promise<Array<Record<string, unknown>>> {
    const res = await fetchWithTimeout('/api/hotel-bookings', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your stays.');
    const data = await readJson<{ stays?: Array<Record<string, unknown>> }>(res, 'Could not load your stays.');
    return Array.isArray(data.stays) ? data.stays : [];
  },

  async getTripStays(tripId: string, signal?: AbortSignal): Promise<Array<Record<string, unknown>>> {
    const res = await fetchWithTimeout(`/api/hotel-bookings/trips/${encodeURIComponent(tripId)}/stays`, {
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your stays.');
    const data = await readJson<{ stays?: Array<Record<string, unknown>> }>(res, 'Could not load your stays.');
    return Array.isArray(data.stays) ? data.stays : [];
  },

  /**
   * Which of these properties are free for a whole window.
   *
   * Belongs here rather than being fetched inline: every API call in this app
   * goes through one client (tests/contract/apiContract.test.ts enforces that),
   * and an inline fetch in a view would bypass it.
   */
  async getStaysAvailability(params: {
    accommodationIds: string[];
    checkIn: string;
    checkOut: string;
    rooms: number;
    guests: number;
  }, signal?: AbortSignal): Promise<Record<string, { available: boolean; minUnitsLeft: number; fromNightlyEGP?: number }>> {
    const qs = new URLSearchParams({
      accommodationIds: params.accommodationIds.join(','),
      checkIn: params.checkIn,
      checkOut: params.checkOut,
      rooms: String(params.rooms),
      guests: String(params.guests),
    });
    const res = await fetchWithTimeout(`/api/availability/stays?${qs.toString()}`, {
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not check that window.');
    return await readJson(res, 'Could not check that window.');
  },

  // -------------------------------------------------------------------------
  // Stay admin: room types, rate calendar, booking queue
  // -------------------------------------------------------------------------

  /** The work queue: active properties still without a known room count. */
  async adminGetInventoryQueue(): Promise<{
    total: number;
    queue: Array<{ accommodationId: string; slug: string; name: string; nameAr: string; propertyType: string; catalogueRooms: number; roomTypeIds: string[] }>;
  }> {
    const res = await fetchWithTimeout('/api/admin/hotel/room-types/needs-inventory', { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the inventory queue.');
    return await readJson(res, 'Could not load the inventory queue.');
  },

  async adminListRoomTypes(accommodationId?: string): Promise<{ roomTypes: Array<Record<string, unknown>> }> {
    const qs = accommodationId ? `?accommodationId=${encodeURIComponent(accommodationId)}` : '';
    const res = await fetchWithTimeout(`/api/admin/hotel/room-types${qs}`, { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the room types.');
    return await readJson(res, 'Could not load the room types.');
  },

  async adminCreateRoomType(body: Record<string, unknown>): Promise<{ roomType: Record<string, unknown> }> {
    const res = await fetchWithTimeout('/api/admin/hotel/room-types', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not create that room type.');
    return await readJson(res, 'Could not create that room type.');
  },

  async adminUpdateRoomType(id: string, body: Record<string, unknown>): Promise<{ roomType: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/room-types/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not update that room type.');
    return await readJson(res, 'Could not update that room type.');
  },

  async adminRetireRoomType(id: string): Promise<{ roomType: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/room-types/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: defaultHeaders(),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not retire that room type.');
    return await readJson(res, 'Could not retire that room type.');
  },

  /** Bookings queue, newest first, optionally filtered by status. */
  async adminListStayBookings(status?: string, limit = 100): Promise<{ bookings: Array<Record<string, unknown>>; total: number }> {
    const qs = new URLSearchParams();
    if (status) qs.set('status', status);
    qs.set('limit', String(limit));
    const res = await fetchWithTimeout(`/api/admin/hotel/bookings?${qs.toString()}`, { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the booking queue.');
    return await readJson(res, 'Could not load the booking queue.');
  },

  async adminMarkStayPaid(ref: string, body: { method?: string; reference?: string }): Promise<{ booking: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/bookings/${encodeURIComponent(ref)}/mark-paid`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not record the deposit.');
    return await readJson(res, 'Could not record the deposit.');
  },

  async adminRespondToStay(ref: string, body: { approve: boolean; reason?: string }): Promise<{ booking: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/bookings/${encodeURIComponent(ref)}/respond`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not respond to that stay.');
    return await readJson(res, 'Could not respond to that stay.');
  },

  async adminSettleStayBalance(ref: string, body: { amountEGP?: number }): Promise<{ booking: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/bookings/${encodeURIComponent(ref)}/settle-balance`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not settle that balance.');
    return await readJson(res, 'Could not settle that balance.');
  },

  async adminStayCheckIn(ref: string): Promise<{ booking: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/bookings/${encodeURIComponent(ref)}/check-in`, {
      method: 'POST',
      headers: defaultHeaders(),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not check that stay in.');
    return await readJson(res, 'Could not check that stay in.');
  },

  async adminCancelStay(ref: string, reason?: string): Promise<{ booking: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/bookings/${encodeURIComponent(ref)}/cancel`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(reason ? { reason } : {}),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not cancel that stay.');
    return await readJson(res, 'Could not cancel that stay.');
  },

  async adminMarkStayNoShow(ref: string): Promise<{ booking: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/bookings/${encodeURIComponent(ref)}/no-show`, {
      method: 'POST',
      headers: defaultHeaders(),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not record the no-show.');
    return await readJson(res, 'Could not record the no-show.');
  },

  async adminCompleteStay(ref: string): Promise<{ booking: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/bookings/${encodeURIComponent(ref)}/complete`, {
      method: 'POST',
      headers: defaultHeaders(),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not complete that stay.');
    return await readJson(res, 'Could not complete that stay.');
  },

  /** Set or clear one night's price/closure for a room type. */
  // ── The property owner's portal (/api/property-stays) ────────────────────
  async getPropertyStays(): Promise<{ stays: Array<Record<string, unknown>> }> {
    const res = await fetchWithTimeout('/api/property-stays', { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your stays.');
    return await readJson(res, 'Could not load your stays.');
  },

  async respondPropertyStay(ref: string, approve: boolean, reason?: string): Promise<{ stay: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/property-stays/${encodeURIComponent(ref)}/respond`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(reason ? { approve, reason } : { approve }),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not answer that stay.');
    return await readJson(res, 'Could not answer that stay.');
  },

  async getPropertyRoomTypes(): Promise<{ roomTypes: Array<{ id: string; name: string; nameAr: string; totalUnits: number; baseNightlyEGP: number; active: boolean }> }> {
    const res = await fetchWithTimeout('/api/property-stays/room-types', { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your rooms.');
    return await readJson(res, 'Could not load your rooms.');
  },

  async getPropertyCalendar(roomTypeId: string, from: string, to: string): Promise<{
    totalUnits: number;
    nights: Array<{ date: string; nightlyEGP: number; closed: boolean; closedReason?: string; booked: number }>;
  }> {
    const qs = new URLSearchParams({ from, to });
    const res = await fetchWithTimeout(`/api/property-stays/room-types/${encodeURIComponent(roomTypeId)}/calendar?${qs}`, { headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the calendar.');
    return await readJson(res, 'Could not load the calendar.');
  },

  async setPropertyNightsClosed(roomTypeId: string, body: { from: string; to: string; closed: boolean; reason?: string }): Promise<{ changed: number }> {
    const res = await fetchWithTimeout(`/api/property-stays/room-types/${encodeURIComponent(roomTypeId)}/availability`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not update those nights.');
    return await readJson(res, 'Could not update those nights.');
  },

  async adminRoomTypeCalendar(roomTypeId: string, from: string, to: string): Promise<{
    roomTypeId: string;
    totalUnits: number;
    baseNightlyEGP: number;
    nights: Array<{ date: string; nightlyEGP: number; overridden: boolean; minNights?: number; closed: boolean; closedReason?: string; booked: number }>;
  }> {
    const qs = new URLSearchParams({ from, to });
    const res = await fetchWithTimeout(`/api/admin/hotel/room-types/${encodeURIComponent(roomTypeId)}/calendar?${qs}`, {
      headers: defaultHeaders(),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the rate calendar.');
    return await readJson(res, 'Could not load the rate calendar.');
  },

  async adminUpsertRateNight(
    roomTypeId: string,
    body: { date: string; nightlyEGP?: number; minNights?: number; closed?: boolean; closedReason?: string }
  ): Promise<{ rateNight: Record<string, unknown> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/room-types/${encodeURIComponent(roomTypeId)}/rate-nights`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not set that night.');
    return await readJson(res, 'Could not set that night.');
  },

  async adminBulkRateNights(
    roomTypeId: string,
    body: { from: string; to: string; nightlyEGP?: number; minNights?: number; closed?: boolean; closedReason?: string }
  ): Promise<{ applied: number; rateNights: Array<Record<string, unknown>> }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/room-types/${encodeURIComponent(roomTypeId)}/rate-nights/bulk`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not apply that range.');
    return await readJson(res, 'Could not apply that range.');
  },

  async adminDeleteRateNight(roomTypeId: string, date: string): Promise<{ removed: boolean }> {
    const res = await fetchWithTimeout(`/api/admin/hotel/room-types/${encodeURIComponent(roomTypeId)}/rate-nights/${date}`, {
      method: 'DELETE',
      headers: defaultHeaders(),
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not clear that night.');
    return await readJson(res, 'Could not clear that night.');
  },

  /** Reviews for a property, from guests whose stays actually completed. */
  async getAccommodationReviews(
    slug: string,
    params?: { page?: number; limit?: number },
    signal?: AbortSignal
  ): Promise<{
    reviews: Array<{
      id: string;
      rating: number;
      title?: string;
      body: string;
      bodyAr?: string;
      supplierResponse?: string;
      supplierResponseAt?: string;
      authorFirstName: string;
      authorInitial?: string;
      createdAt: string;
    }>;
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
    platformAverage: number | null;
    platformCount: number;
  }> {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const res = await fetchWithTimeout(`/api/accommodations/${encodeURIComponent(slug)}/reviews?${qs.toString()}`, {
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the reviews.');
    return await readJson(res, 'Could not load the reviews.');
  },
  /** Public list of reef-positive suppliers, sorted by score descending. */
  async getReefPositiveSuppliers(): Promise<Array<{ supplierId: string; businessName: string; reefScore: number }>> {
    try {
      const res = await fetchWithTimeout('/api/reef-positive-suppliers', { headers: defaultHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  },

  /** Supplier calendar: 30-day availability view (blocked dates + reasons). Public by design — planners render it without sign-in. */
  async getSupplierAvailability(supplierId: string, month?: string): Promise<Record<string, { blocked: boolean; reason?: string }>> {
    try {
      const qs = month ? `?month=${encodeURIComponent(month)}` : '';
      const res = await fetchWithTimeout(`/api/suppliers/${encodeURIComponent(supplierId)}/availability${qs}`, { headers: defaultHeaders() });
      if (!res.ok) return {};
      const data = await res.json();
      return data?.availability ?? {};
    } catch {
      return {};
    }
  },

  /** Supplier: own availability blocks (authenticated, own calendar only). */
  async getSupplierBlocks(supplierId: string): Promise<Array<{ id: string; startDate: string; endDate: string; reason: string }>> {
    try {
      const res = await fetchWithTimeout(`/api/suppliers/${encodeURIComponent(supplierId)}/blocks`, { headers: defaultHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.blocks) ? data.blocks : [];
    } catch {
      return [];
    }
  },

  /** Supplier: create an availability block on own calendar. */
  async createSupplierBlock(supplierId: string, input: { startDate: string; endDate: string; reason: string }): Promise<{ id: string; startDate: string; endDate: string; reason: string } | null> {
    try {
      const res = await fetchWithTimeout(`/api/suppliers/${encodeURIComponent(supplierId)}/blocks`, {
        method: 'POST',
        headers: { ...defaultHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  /** Supplier reliability score — server-computed acceptance/response/cancellation aggregates. */
  async getSupplierReliabilityScore(supplierId: string): Promise<{ overall: number; sampleSize: number; acceptanceRate: number; responseSpeed: number; cancellationRate: number } | null> {
    try {
      const res = await fetchWithTimeout(`/api/suppliers/${encodeURIComponent(supplierId)}/reliability`, { headers: defaultHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      const score = data?.score;
      if (!score || typeof score.overall !== 'number') return null;
      return {
        overall: score.overall,
        sampleSize: score.sampleSize ?? 0,
        acceptanceRate: score.acceptanceRate ?? 0,
        responseSpeed: score.responseSpeed ?? 0,
        cancellationRate: score.cancellationRate ?? 0,
      };
    } catch {
      return null;
    }
  },

  // 4. Suppliers & Operations
  async getSuppliers() {
    const res = await fetchWithTimeout('/api/suppliers', { headers: defaultHeaders() });
    return await res.json();
  },

  async getSupplierDashboard(supplierId: string) {
    const res = await fetchWithTimeout(`/api/suppliers/${supplierId}/dashboard`, { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to fetch supplier dashboard');
    return await res.json();
  },

  /** P6: server-computed revenue analytics for the supplier's Revenue tab. */
  async getSupplierRevenueAnalytics(supplierId: string, days = 30): Promise<SupplierRevenueAnalytics> {
    const res = await fetchWithTimeout(`/api/suppliers/${supplierId}/revenue-analytics?days=${days}`, { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to fetch revenue analytics');
    return await res.json();
  },

  async respondSupplierBooking(bookingId: string, params: {
    supplierId: string;
    action: 'ACCEPT' | 'REJECT' | 'DISPATCH' | 'COMPLETE';
    assignedResource?: any;
    reason?: string;
  }) {
    const res = await fetchWithTimeout(`/api/suppliers/bookings/${bookingId}/respond`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update booking');
    }
    return await res.json();
  },

  async getSupplierBookings(supplierId: string) {
    const res = await fetchWithTimeout(`/api/suppliers/${supplierId}/bookings`, { headers: defaultHeaders() });
    return await res.json();
  },

  /** Log a reef-positive eco-action against a completed booking (traveler,
   *  booking's supplier, or operator). Points credit the trip owner. */
  async logReefAction(input: {
    bookingId: string;
    tripId: string;
    supplierId: string;
    actionType: 'reef_safe_sunscreen' | 'coral_planting' | 'beach_cleanup' | 'dive_against_debris' | 'marine_education' | 'plastic_free_day' | 'other';
    description: string;
    descriptionAr?: string;
    photoUrl?: string;
  }): Promise<{ log: { id: string; pointsAwarded: number; loggedBy: string } }> {
    const res = await fetchWithTimeout('/api/reef-actions', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Failed to log reef action');
    }
    return await res.json();
  },

  async getOperationsOverview() {
    const res = await fetchWithTimeout('/api/operations/overview', { headers: defaultHeaders() });
    return await res.json();
  },

  // ─── Dahab Intelligence Core (admin control plane) ──────────────────────
  async intelligenceCoreQuery(payload: {
    text: string;
    language?: Language;
    context?: Record<string, unknown>;
  }, signal?: AbortSignal) {
    const res = await fetchWithTimeout('/api/intelligence-core/query', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null) as { error?: string } | null)?.error || 'Intelligence Core query failed');
    return await readJson<{
      reply: string;
      language: string;
      toolCalls: { tool: string; ok: boolean; summary?: string; rowCount?: number; error?: string }[];
      results: Record<string, unknown>;
      generatedAt: string;
    }>(res, 'Intelligence Core query failed');
  },

  async intelligenceCoreAttention(signal?: AbortSignal) {
    const res = await fetchWithTimeout('/api/intelligence-core/attention', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Attention queue unavailable');
    return await readJson<{ items: unknown[]; total: number; summary: string }>(res, 'Attention queue unavailable');
  },

  async intelligenceCoreAction(payload: { tool: string; params?: Record<string, unknown>; bulkIds?: string[] }) {
    const res = await fetchWithTimeout('/api/intelligence-core/action', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => null) as { error?: string } | null;
    if (!res.ok) throw Object.assign(new Error(body?.error || 'Action request failed'), { status: res.status });
    return body as unknown as {
      executed: boolean;
      confirmation?: { token: string; tool: string; impact: string; affectedCount: number; risk: string; expiresAt: string };
      result?: unknown;
      impact?: string;
    };
  },

  async intelligenceCoreConfirm(token: string) {
    const res = await fetchWithTimeout('/api/intelligence-core/confirm', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ token }),
    });
    const body = await res.json().catch(() => null) as { error?: string } | null;
    if (!res.ok) throw Object.assign(new Error(body?.error || 'Confirmation failed'), { status: res.status });
    return body as unknown as { ok: boolean; tool: string; result?: unknown; bulk?: { ok: number; failed: number; failures: { id: string; error: string }[] } };
  },

  async getHealthData() {
    const res = await fetchWithTimeout('/api/health', { headers: defaultHeaders() });
    return await res.json();
  },

  /** Liveness ping for the app boot path. Resolves `null` when the server
   *  answers without health data (r.ok false); rejects on a network failure so
   *  the caller's catch can reset the federated-sign-in flag. */
  async pingHealth(): Promise<{ firebaseAdminConfigured?: boolean; paymentsSimulated?: boolean } | null> {
    const res = await fetchWithTimeout('/api/health', { headers: defaultHeaders() });
    if (!res.ok) return null;
    return await readJson<{ firebaseAdminConfigured?: boolean; paymentsSimulated?: boolean }>(res, 'health');
  },

  async askIntelligence(
    payload: { query: string; language: Language },
    signal?: AbortSignal
  ): Promise<GroundedIntelligenceQueryResponse> {
    const res = await fetchWithTimeout('/api/intelligence/ask', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload),
      signal
    });
    if (!res.ok) throw new Error('API query failed');
    return await readJson<GroundedIntelligenceQueryResponse>(res, 'API query failed');
  },

  async draftOpportunity(
    payload: { signalIds: string[]; contextNotes: string }
  ): Promise<{ opportunity?: ProductOpportunity } | null> {
    const res = await fetchWithTimeout('/api/intelligence/draft-opportunity', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) return null;
    return await readJson<{ opportunity?: ProductOpportunity }>(res, '');
  },

  async listAdminContentMedia(signal?: AbortSignal): Promise<{ media?: any[] }> {
    const res = await fetchWithTimeout('/api/admin/content/media', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Not authorized to view media' : 'Failed to load media');
    return await readJson<{ media?: any[] }>(res, 'Could not load media.');
  },

  // ── Pages ──────────────────────────────────────────────────────────────────

  async getCmsAdminPage(id: string, signal?: AbortSignal): Promise<{ page?: any; blocks?: any[]; seo?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/pages/${id}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error(res.status === 404 ? 'Page not found' : 'Failed to load page');
    return await readJson<{ page?: any; blocks?: any[]; seo?: any }>(res, 'Could not load page.');
  },

  async listCmsPages(status?: string, signal?: AbortSignal): Promise<{ pages?: any[] }> {
    const qs = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetchWithTimeout(`/api/admin/content/pages${qs}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? 'Not authorized to view pages' : 'Failed to load pages');
    return await readJson<{ pages?: any[] }>(res, 'Could not load pages.');
  },

  async createCmsPage(data: Record<string, any>, signal?: AbortSignal): Promise<{ page?: any }> {
    const res = await fetchWithTimeout('/api/admin/content/pages', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to create page.');
      throw new Error(err.message || 'Failed to create page.');
    }
    return await readJson<{ page?: any }>(res, 'Failed to create page.');
  },

  async updateCmsPage(id: string, data: Record<string, any>, signal?: AbortSignal): Promise<{ page?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/pages/${id}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to update page.');
      throw new Error(err.message || 'Failed to update page.');
    }
    return await readJson<{ page?: any }>(res, 'Failed to update page.');
  },

  async deleteCmsPage(id: string, signal?: AbortSignal): Promise<{ message?: string }> {
    const res = await fetchWithTimeout(`/api/admin/content/pages/${id}`, {
      method: 'DELETE',
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to delete page.');
      throw new Error(err.message || 'Failed to delete page.');
    }
    return await readJson<{ message?: string }>(res, 'Failed to delete page.');
  },

  async publishCmsPage(id: string, signal?: AbortSignal): Promise<{ page?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/pages/${id}/publish`, {
      method: 'POST',
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to publish page.');
      throw new Error(err.message || 'Failed to publish page.');
    }
    return await readJson<{ page?: any }>(res, 'Failed to publish page.');
  },

  async archiveCmsPage(id: string, signal?: AbortSignal): Promise<{ page?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/pages/${id}/archive`, {
      method: 'POST',
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to archive page.');
      throw new Error(err.message || 'Failed to archive page.');
    }
    return await readJson<{ page?: any }>(res, 'Failed to archive page.');
  },

  // ── Blocks ────────────────────────────────────────────────────────────────

  async listCmsBlocks(pageId: string, signal?: AbortSignal): Promise<{ blocks?: any[] }> {
    const res = await fetchWithTimeout(`/api/admin/content/blocks/${pageId}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Failed to load blocks');
    return await readJson<{ blocks?: any[] }>(res, 'Could not load blocks.');
  },

  async createCmsBlock(data: Record<string, any>, signal?: AbortSignal): Promise<{ block?: any }> {
    const res = await fetchWithTimeout('/api/admin/content/blocks', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to create block.');
      throw new Error(err.message || 'Failed to create block.');
    }
    return await readJson<{ block?: any }>(res, 'Failed to create block.');
  },

  async updateCmsBlock(id: string, data: Record<string, any>, signal?: AbortSignal): Promise<{ block?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/blocks/${id}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to update block.');
      throw new Error(err.message || 'Failed to update block.');
    }
    return await readJson<{ block?: any }>(res, 'Failed to update block.');
  },

  async deleteCmsBlock(id: string, signal?: AbortSignal): Promise<{ message?: string }> {
    const res = await fetchWithTimeout(`/api/admin/content/blocks/${id}`, {
      method: 'DELETE',
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to delete block.');
      throw new Error(err.message || 'Failed to delete block.');
    }
    return await readJson<{ message?: string }>(res, 'Failed to delete block.');
  },

  // ── Homepage ───────────────────────────────────────────────────────────────

  async getCmsHomepageAdmin(signal?: AbortSignal): Promise<{ sections?: any[] }> {
    const res = await fetchWithTimeout('/api/admin/content/homepage', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Failed to load homepage sections');
    return await readJson<{ sections?: any[] }>(res, 'Could not load homepage sections.');
  },

  async updateCmsHomepage(sectionKey: string, data: Record<string, any>, signal?: AbortSignal): Promise<{ section?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/homepage/${encodeURIComponent(sectionKey)}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to update homepage section.');
      throw new Error(err.message || 'Failed to update homepage section.');
    }
    return await readJson<{ section?: any }>(res, 'Failed to update homepage section.');
  },

  // ── Navigation ─────────────────────────────────────────────────────────────

  async getCmsNavigationAdmin(menuKey: string, signal?: AbortSignal): Promise<{ items?: any[] }> {
    const res = await fetchWithTimeout(`/api/admin/content/navigation/${encodeURIComponent(menuKey)}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Failed to load navigation items');
    return await readJson<{ items?: any[] }>(res, 'Could not load navigation items.');
  },

  async createCmsNavigationItem(data: Record<string, any>, signal?: AbortSignal): Promise<{ item?: any }> {
    const res = await fetchWithTimeout('/api/admin/content/navigation', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to create navigation item.');
      throw new Error(err.message || 'Failed to create navigation item.');
    }
    return await readJson<{ item?: any }>(res, 'Failed to create navigation item.');
  },

  async updateCmsNavigationItem(id: string, data: Record<string, any>, signal?: AbortSignal): Promise<{ item?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/navigation/${id}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to update navigation item.');
      throw new Error(err.message || 'Failed to update navigation item.');
    }
    return await readJson<{ item?: any }>(res, 'Failed to update navigation item.');
  },

  async deleteCmsNavigationItem(id: string, signal?: AbortSignal): Promise<{ message?: string }> {
    const res = await fetchWithTimeout(`/api/admin/content/navigation/${id}`, {
      method: 'DELETE',
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to delete navigation item.');
      throw new Error(err.message || 'Failed to delete navigation item.');
    }
    return await readJson<{ message?: string }>(res, 'Failed to delete navigation item.');
  },

  // ── SEO ────────────────────────────────────────────────────────────────────

  async getCmsSeoAdmin(pageType: string, pageId: string, signal?: AbortSignal): Promise<{ seo?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/seo/${encodeURIComponent(pageType)}/${encodeURIComponent(pageId)}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Failed to load SEO data');
    return await readJson<{ seo?: any }>(res, 'Could not load SEO data.');
  },

  async updateCmsSeo(pageType: string, pageId: string, data: Record<string, any>, signal?: AbortSignal): Promise<{ seo?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/seo/${encodeURIComponent(pageType)}/${encodeURIComponent(pageId)}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to update SEO.');
      throw new Error(err.message || 'Failed to update SEO.');
    }
    return await readJson<{ seo?: any }>(res, 'Failed to update SEO.');
  },

  // ── Revisions ──────────────────────────────────────────────────────────────

  async listCmsRevisions(entityType?: string, entityId?: string, limit = 50, signal?: AbortSignal): Promise<{ revisions?: any[] }> {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    if (entityId) params.set('entityId', entityId);
    params.set('limit', String(limit));
    const res = await fetchWithTimeout(`/api/admin/content/revisions?${params}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Failed to load revisions');
    return await readJson<{ revisions?: any[] }>(res, 'Could not load revisions.');
  },

  // ── Media ──────────────────────────────────────────────────────────────────

  async uploadCmsMedia(data: Record<string, any>, signal?: AbortSignal): Promise<{ asset?: any }> {
    const res = await fetchWithTimeout('/api/admin/content/media/upload', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to upload media.');
      throw new Error(err.message || 'Failed to upload media.');
    }
    return await readJson<{ asset?: any }>(res, 'Failed to upload media.');
  },

  async updateCmsMedia(id: string, data: Record<string, any>, signal?: AbortSignal): Promise<{ asset?: any }> {
    const res = await fetchWithTimeout(`/api/admin/content/media/${id}`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify(data),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to update media.');
      throw new Error(err.message || 'Failed to update media.');
    }
    return await readJson<{ asset?: any }>(res, 'Failed to update media.');
  },

  async deleteCmsMedia(id: string, force = false, signal?: AbortSignal): Promise<{ message?: string }> {
    const params = new URLSearchParams();
    if (force) params.set('force', 'true');
    const res = await fetchWithTimeout(`/api/admin/content/media/${id}?${params}`, {
      method: 'DELETE',
      headers: defaultHeaders(),
      signal,
    });
    if (!res.ok) {
      const err = await readJson<{ message?: string }>(res, 'Failed to delete media.');
      throw new Error(err.message || 'Failed to delete media.');
    }
    return await readJson<{ message?: string }>(res, 'Failed to delete media.');
  },

  // ---------------------------------------------------------------------------
  // CMS public content (GET, read-only). The wire shapes below are the single
  // source of truth; src/hooks/useCMSContent reshapes them into view models.
  // ---------------------------------------------------------------------------

  async getCmsHomepage(signal?: AbortSignal): Promise<HomepageContent> {
    const res = await fetchWithTimeout('/api/content/homepage', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('CMS homepage unavailable');
    return await readJson<HomepageContent>(res, 'CMS homepage');
  },

  async getCmsGallery(signal?: AbortSignal): Promise<{ photos?: CmsContentPage[] }> {
    const res = await fetchWithTimeout('/api/content/gallery', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('CMS gallery unavailable');
    return await readJson<{ photos?: CmsContentPage[] }>(res, 'CMS gallery');
  },

  async getCmsProgrammes(signal?: AbortSignal): Promise<{ programmes?: CmsContentPage[] }> {
    const res = await fetchWithTimeout('/api/content/programmes', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('CMS programmes unavailable');
    return await readJson<{ programmes?: CmsContentPage[] }>(res, 'CMS programmes');
  },

  async getCmsStories(signal?: AbortSignal): Promise<{ stories?: CmsContentPage[] }> {
    const res = await fetchWithTimeout('/api/content/stories', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('CMS stories unavailable');
    return await readJson<{ stories?: CmsContentPage[] }>(res, 'CMS stories');
  },

  async getCmsPage(slug: string, signal?: AbortSignal): Promise<CmsPageWithBlocks> {
    // Blocks carry the actual content for pages like faq and travel-guides
    // (their page rows hold only title/description), so always request them.
    const res = await fetchWithTimeout(`/api/content/pages/${slug}?include_blocks=true`, { headers: defaultHeaders(), signal });
    if (!res.ok) return { page: null, blocks: [] };
    return await readJson<CmsPageWithBlocks>(res, 'CMS page');
  },

  async getCmsPreview(token: string, signal?: AbortSignal): Promise<CmsPageWithBlocks> {
    const res = await fetchWithTimeout(`/api/content/preview/${encodeURIComponent(token)}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error(res.status === 404 ? 'Preview expired' : 'CMS preview unavailable');
    return await readJson<CmsPageWithBlocks>(res, 'CMS preview');
  },

  async getCmsNavigation(menuKey: string, signal?: AbortSignal): Promise<{ items?: NavigationItemWire[] }> {
    const res = await fetchWithTimeout(`/api/content/navigation/${menuKey}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('CMS navigation unavailable');
    return await readJson<{ items?: NavigationItemWire[] }>(res, 'CMS navigation');
  },

  async getCmsExploreCategories(signal?: AbortSignal): Promise<{ categories?: ExploreCategoryWire[] }> {
    const res = await fetchWithTimeout('/api/content/explore-categories', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('CMS explore categories unavailable');
    return await readJson<{ categories?: ExploreCategoryWire[] }>(res, 'CMS explore categories');
  },

  async getCmsHowItWorks(signal?: AbortSignal): Promise<{ blocks?: CmsPageBlockWire[] }> {
    const res = await fetchWithTimeout('/api/content/pages/how-it-works?include_blocks=true', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('CMS how-it-works unavailable');
    return await readJson<{ blocks?: CmsPageBlockWire[] }>(res, 'CMS how-it-works');
  },

  async getSiteInfo(signal?: AbortSignal): Promise<{ info?: SiteInfoBundle }> {
    const res = await fetchWithTimeout('/api/content/site-info', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Site info unavailable');
    return await readJson<{ info?: SiteInfoBundle }>(res, 'Site info');
  },

  async getThemeBundle(signal?: AbortSignal): Promise<{ tokens?: Record<string, string> }> {
    const res = await fetchWithTimeout('/api/content/theme', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Theme bundle unavailable');
    return await readJson<{ tokens?: Record<string, string> }>(res, 'Theme bundle');
  },

  /**
   * Display-only currency rates (EGP per unit). Charges are always EGP; the
   * UI uses these for the "≈ €25" line under a price (server/services/fxService.ts).
   */
  async getFxRates(signal?: AbortSignal): Promise<FxRatesWire> {
    const res = await fetchWithTimeout('/api/fx/rates', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Currency rates unavailable');
    const body = await readJson<{ data: FxRatesWire }>(res, 'Currency rates');
    return body.data;
  },

  /** Live conditions for one destination (GET /api/telemetry/conditions); null when the source is down. */
  async getDestinationConditions(destination: string, signal?: AbortSignal): Promise<DestinationConditionsWire | null> {
    const res = await fetchWithTimeout(`/api/telemetry/conditions?d=${encodeURIComponent(destination)}`, { headers: defaultHeaders(), signal });
    if (!res.ok) return null;
    const body = await readJson<DestinationConditionsWire>(res, 'Conditions');
    return body.available ? body : null;
  },

  async getCmsTripPreview(signal?: AbortSignal): Promise<{ blocks?: CmsPageBlockWire[] }> {
    const res = await fetchWithTimeout('/api/content/pages/trip-preview?include_blocks=true', { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('CMS trip-preview unavailable');
    return await readJson<{ blocks?: CmsPageBlockWire[] }>(res, 'CMS trip-preview');
  },

  async getAuditEvents(limit = 50) {
    const res = await fetchWithTimeout(`/api/operations/audit-events?limit=${limit}`, { headers: defaultHeaders() });
    return await res.json();
  },

  async acknowledgeMarketAlert(alertId: string, acknowledgedBy?: string) {
    const res = await fetchWithTimeout(`/api/market/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ acknowledgedBy: acknowledgedBy || 'Operations' })
    });
    if (!res.ok) throw new Error('Failed to acknowledge alert');
    return await res.json();
  },

  async getRecentEvents(limit = 20): Promise<{ events: BackgroundEvent[] }> {
    const res = await fetchWithTimeout(`/api/events/recent?limit=${limit}`, { headers: defaultHeaders() });
    return await readJson<{ events: BackgroundEvent[] }>(res, 'Could not load recent events.');
  },

  async replyToSupportMessage(messageId: string, reply: string) {
    const res = await fetchWithTimeout(`/api/support/messages/${encodeURIComponent(messageId)}/reply`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ reply })
    });
    if (!res.ok) throw new Error('Failed to send reply');
    return await res.json();
  },

  async getMarketStatus() {
    const res = await fetchWithTimeout('/api/market/status', { headers: defaultHeaders() });
    return await res.json();
  },

  async getFitWindowOptions(
    params?: { originArea?: string; availableMinutes?: number; category?: string },
    signal?: AbortSignal
  ): Promise<FitWindowResponse> {
    const res = await fetchWithTimeout('/api/context/fit-window', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params || { originArea: 'lighthouse', availableMinutes: 120 }),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load what fits your available time right now.');
    return await readJson<FitWindowResponse>(res, 'Could not load what fits your available time right now.');
  },

  async getPostActivityFood(locationId: string = 'place-lighthouse', limit: number = 3, signal?: AbortSignal): Promise<PostActivityFoodResponse> {
    const res = await fetchWithTimeout(`/api/context/post-activity-food?locationId=${encodeURIComponent(locationId)}&limit=${limit}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load places to eat nearby.');
    return await readJson<PostActivityFoodResponse>(res, 'Could not load places to eat nearby.');
  },

  async getTravelEstimate(origin: string, destination: string, signal?: AbortSignal): Promise<RouteEstimate> {
    const res = await fetchWithTimeout(`/api/context/travel-time?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load travel time.');
    return await readJson<RouteEstimate>(res, 'Could not load travel time.');
  },

  async parseSearchIntent(query: string, signal?: AbortSignal): Promise<ParsedSearchIntent> {
    const res = await fetchWithTimeout('/api/context/parse-intent', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ query }),
      timeout: AI_TIMEOUT_MS,
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not parse search intent.');
    return await readJson<ParsedSearchIntent>(res, 'Could not parse search intent.');
  },

  async getBackgroundJobsStatus() {
    const res = await fetchWithTimeout('/api/jobs/status', { headers: defaultHeaders() });
    return await res.json();
  },

  async getWeatherTelemetry() {
    try {
      const res = await fetchWithTimeout('/api/telemetry/weather', { headers: defaultHeaders() });
      if (!res.ok) throw new Error('Weather fetch failed');
      return await res.json();
    } catch {
      return null;
    }
  },

  async getResearchOverview() {
    try {
      const res = await fetchWithTimeout('/api/research/dahab-overview', { headers: defaultHeaders() });
      if (!res.ok) throw new Error('Research overview fetch failed');
      return await res.json();
    } catch {
      return null;
    }
  },

  async getCameraFeeds() {
    try {
      const res = await fetchWithTimeout('/api/telemetry/cameras', { headers: defaultHeaders() });
      if (!res.ok) throw new Error('Camera fetch failed');
      return await res.json();
    } catch {
      return null;
    }
  },

  async getMarineTelemetry(signal?: AbortSignal) {
    try {
      const res = await fetchWithTimeout('/api/telemetry/marine', { headers: defaultHeaders(), signal });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  },

  async generateAiTrip(params: {
    durationDays?: number;
    adultsCount?: number;
    childrenCount?: number;
    dynamic?: string;
    budget?: string;
    interests?: string[];
    pace?: string;
    language?: string;
  }) {
    const res = await fetchWithTimeout('/api/trip/generate', {
      timeout: AI_TIMEOUT_MS,
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error('Failed to generate AI trip');
    return await res.json();
  },

  /**
   * POST /api/trip/apply-ai
   * Persists a generated "Plan with AI" itinerary as the signed-in traveler's
   * trip. Requires a session; identity is taken from it server-side.
   */
  async applyAiItinerary(
    payload: {
      itinerary: {
        tripTitle?: string;
        days: Array<{
          dayNumber?: number;
          activities: Array<{
            title: string;
            timeSlot?: string;
            /** Enriched (availability-joined) real price — DB-authoritative. */
            priceEGP?: number;
            /** Legacy/raw AI estimate, kept for non-bookable items. */
            estimatedPriceEGP?: number;
            /** Real SKU when the item is bookable — lets My Trip hold it. */
            skuId?: string;
            category?: string;
            location?: string;
            description?: string;
          }>;
        }>;
      };
      lengthDays?: number;
      travelersCount?: number;
      budget?: 'Budget' | 'Moderate' | 'Premium';
      pace?: 'Relaxed' | 'Balanced' | 'Active';
      interests?: string[];
    },
    signal?: AbortSignal
  ): Promise<{ trip: { id: string } }> {
    const res = await fetchWithTimeout('/api/trip/apply-ai', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not save your AI plan.');
    return await readJson<{ trip: { id: string } }>(res, 'Could not save your AI plan.');
  },

  async queryDayGi(context: {
    prompt: string;
    language?: 'en' | 'ar';
    currentLocation?: string;
    availableMinutes?: number;
    currentDayNumber?: number;
    userPace?: 'Relaxed' | 'Balanced' | 'Active';
    userBudget?: 'Budget' | 'Moderate' | 'Premium';
    interests?: string[];
    activeBookingsCount?: number;
    activeTripTitle?: string;
    chatId?: string;
    /** Party size the composer is holding, so answers can size a plan to it. */
    travelersCount?: number;
    /** ISO start/end dates picked in the composer. */
    travelDates?: { start: string; end: string };
    /**
     * The last few turns, so pronouns resolve ("book the first one") and the
     * server can decide a vague prompt needs one clarifying question.
     */
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }, opts: { signal?: AbortSignal } = {}) {
    const res = await fetchWithTimeout('/api/daygi/query', {
      timeout: AI_TIMEOUT_MS,
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(context),
      signal: opts.signal
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'DayGI service temporarily unavailable' }));
      throw new Error(err.error || 'DayGI query failed');
    }
    return await res.json();
  },

  // Saved conversations ("All chats"). Identity and ownership are the
  // session's: no chatId can address somebody else's history.
  async getDayGiChats() {
    const res = await fetchWithTimeout('/api/daygi/chats', {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch chat history');
    return await res.json();
  },

  async getDayGiChat(chatId: string) {
    const res = await fetchWithTimeout(`/api/daygi/chats/${encodeURIComponent(chatId)}`, {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch chat');
    return await res.json();
  },

  async deleteDayGiChat(chatId: string) {
    const res = await fetchWithTimeout(`/api/daygi/chats/${encodeURIComponent(chatId)}`, {
      method: 'DELETE',
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to delete chat');
    return await res.json();
  },

  /**
   * Freeze the chat into a public snapshot link. The link is unguessable and
   * immutable; deleting the chat deletes its snapshots server-side.
   */
  async shareDayGiChat(chatId: string): Promise<{ shareId: string }> {
    const res = await fetchWithTimeout('/api/daygi/share', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ chatId })
    });
    if (!res.ok) throw new Error('Failed to create share link');
    return await res.json();
  },

  /**
   * Server-driven streaming DayGI query (SSE).
   *
   * Resolves with the same final payload the plain query returns — and calls
   * onText with the server-accumulated full text as the reply is paced out.
   * Throws DayGiStreamUnavailable when the stream cannot be opened at all
   * (offline, proxy buffering, missing body), so the caller can fall back to
   * a plain queryDayGi without showing half an answer twice.
   */
  async queryDayGiStream(
    context: Parameters<typeof this.queryDayGi>[0],
    handlers: { onText?: (full: string) => void; signal?: AbortSignal } = {}
  ): Promise<DayGiResponse> {
    const response = await fetchWithTimeout('/api/daygi/query/stream', {
      timeout: AI_TIMEOUT_MS,
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(context),
      signal: handlers.signal
    }).catch((err) => {
      // A deliberate cancellation is the traveler pressing Stop: it must
      // propagate as an AbortError so the caller can commit partial text,
      // not masquerade as an unavailable stream and trigger a retry.
      if (err?.name === 'AbortError') throw err;
      throw new DayGiStreamUnavailable();
    });
    if (!response.ok || !response.body) {
      throw new DayGiStreamUnavailable();
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let final: DayGiResponse | null = null;
    let streamError: string | null = null;
    // A connection that dies mid-stream must fail loudly, not hang the
    // composer forever: any stall longer than the idle budget aborts the
    // reader. Chunks normally arrive ~80ms apart; ten idle seconds is either
    // a dead socket or a network the traveler has already left behind.
    const idleBudgetMs = 10000;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        reader.cancel('DayGI stream idle timeout').catch(() => undefined);
      }, idleBudgetMs);
    };
    const disarmIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = null;
    };

    try {
      armIdleTimer();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armIdleTimer();
        buffer += decoder.decode(value, { stream: true });
        for (let sep = buffer.indexOf('\n\n'); sep >= 0; sep = buffer.indexOf('\n\n')) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const dataLine = frame.split('\n').find(line => line.startsWith('data:'));
          if (!dataLine) continue;
          let data: any;
          try {
            data = JSON.parse(dataLine.slice('data:'.length).trim());
          } catch {
            continue;
          }
          if (data.full !== undefined && typeof data.full === 'string') {
            handlers.onText?.(data.full);
          }
          if (data.actionType !== undefined && data.replyText !== undefined) {
            final = data;
          } else if (data.error) {
            streamError = String(data.error);
          }
        }
      }
    } finally {
      disarmIdleTimer();
    }

    if (final) return final;
    throw new Error(streamError || 'DayGI stream ended without a payload');
  },

  async executeDayGiAction(params: {
    actionKey: string;
    payload?: Record<string, any>;
  }) {
    const res = await fetchWithTimeout('/api/daygi/action/execute', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'DayGI action execution failed' }));
      throw new Error(err.error || 'DayGI action failed');
    }
    return await res.json();
  },

  async trackDayGiEvent(eventType: string, payload: Record<string, any>) {
    try {
      await fetchWithTimeout('/api/analytics/daygi', {
        method: 'POST',
        headers: defaultHeaders(),
        body: JSON.stringify({ eventType, payload, timestamp: new Date().toISOString() })
      });
    } catch (e) {
      // Non-blocking analytics
      console.debug('DayGI telemetry event logged locally:', eventType, payload);
    }
  },

  /**
   * DayGI identity note: none of these methods take a userId any more.
   *
   * The caller is identified by the session cookie and the server resolves the
   * user itself. Previously the client passed `profile.id || 'USR-AHMED-01'` —
   * and `TravelerProfile` has no `id` field, so every request for every user
   * was made as the demo user 'USR-AHMED-01'. All travelers shared one DayGI
   * memory record, one task list and one telemetry stream.
   */
  async getDayGiProactive(tripId: string) {
    const res = await fetchWithTimeout(`/api/daygi/proactive?tripId=${encodeURIComponent(tripId)}`, {
      timeout: AI_TIMEOUT_MS,
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch proactive intelligence');
    return await res.json();
  },

  async getDayGiTripHealth(tripId: string) {
    const res = await fetchWithTimeout(`/api/daygi/health/${encodeURIComponent(tripId)}`, {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch trip health');
    return await res.json();
  },

  async getDayGiMemory() {
    // 'me' is a placeholder segment; the server resolves the caller's own id.
    const res = await fetchWithTimeout('/api/daygi/memory/me', {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch structured memory');
    return await res.json();
  },

  async updateDayGiMemory(preferences: Record<string, unknown>) {
    const res = await fetchWithTimeout('/api/daygi/memory/me', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(preferences)
    });
    if (!res.ok) throw new Error('Failed to update structured memory');
    return await res.json();
  },

  // DayGI 4.0 Task Orchestration Client Methods
  async getDayGiTasks(tripId: string) {
    const res = await fetchWithTimeout(`/api/daygi/tasks?tripId=${encodeURIComponent(tripId)}`, {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch orchestrated tasks');
    return await res.json();
  },

  async executeDayGiTaskStep(taskId: string, stepId: string, actionToken: string) {
    const res = await fetchWithTimeout(`/api/daygi/tasks/${encodeURIComponent(taskId)}/execute-step`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ stepId, actionToken })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Task step execution failed' }));
      throw new Error(err.error || 'Step execution failed');
    }
    return await res.json();
  },

  async applyDayGiTaskRecovery(taskId: string, recoveryOptionId: string) {
    const res = await fetchWithTimeout(`/api/daygi/tasks/${encodeURIComponent(taskId)}/apply-recovery`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ recoveryOptionId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Recovery execution failed' }));
      throw new Error(err.error || 'Recovery failed');
    }
    return await res.json();
  },

  async cancelDayGiTask(taskId: string, reason?: string) {
    const res = await fetchWithTimeout(`/api/daygi/tasks/${encodeURIComponent(taskId)}/cancel`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ reason })
    });
    if (!res.ok) throw new Error('Failed to cancel orchestrated task');
    return await res.json();
  },

  async trackDayGiFunnel(event: {
    sessionId: string;
    tripId: string;
    step: string;
    intentKey?: string;
    language: 'ar' | 'en';
    actionType?: string;
    cardType?: string;
    latencyMs?: number;
    confidenceScore?: number;
    whyThisInteracted?: boolean;
    metadata?: Record<string, any>;
  }) {
    const res = await fetchWithTimeout('/api/daygi/beta/track-funnel', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(event)
    });
    if (!res.ok) return null;
    return await res.json();
  },

  /**
   * Stable anonymous id for DayGI feedback (localStorage 'daygi:anonId',
   * `anon-` prefixed — the server rejects other shapes). Lets a logged-out
   * visitor rate answers without an account; regenerated only if the stored
   * id is missing or malformed.
   */
  _dayGiAnonId(): string {
    try {
      const KEY = 'daygi:anonId';
      const existing = localStorage.getItem(KEY);
      if (existing && /^anon-[A-Za-z0-9_-]{6,64}$/.test(existing)) return existing;
      const id = `anon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(KEY, id);
      return id;
    } catch {
      return '';
    }
  },

  async submitDayGiBetaFeedback(feedback: {
    messageId: string;
    tripId: string;
    rating: 'HELPFUL' | 'NOT_HELPFUL';
    reasonTag?: string;
    feedbackNotes?: string;
    intentKey: string;
    language: 'ar' | 'en';
  }) {
    const res = await fetchWithTimeout('/api/daygi/beta/feedback', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({
        ...feedback,
        // Anonymous visitors identify feedback with a local id; signed-in
        // sessions are attributed server-side and this field is ignored.
        anonymousId: this._dayGiAnonId()
      })
    });
    if (!res.ok) throw new Error('Failed to record feedback');
    return await res.json();
  },

  async getDayGiBetaExperiments() {
    const res = await fetchWithTimeout('/api/daygi/beta/experiments', {
      headers: defaultHeaders()
    });
    if (!res.ok) throw new Error('Failed to fetch experiment flags');
    return await res.json();
  },

  async updateDayGiBetaExperiments(flags: any) {
    const res = await fetchWithTimeout('/api/daygi/beta/experiments', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(flags)
    });
    if (!res.ok) throw new Error('Failed to update experiment flags');
    return await res.json();
  },

  async refreshMarketIntelligence() {
    const res = await fetchWithTimeout('/api/market/refresh', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ ingestionMode: 'MANUAL_REFRESH', triggerSource: 'ops-console' })
    });
    if (!res.ok) throw new Error('Market refresh failed');
    return await res.json();
  },

  async getMarketJobs(signal?: AbortSignal): Promise<{ policies: MarketSchedulePolicy[] }> {
    const res = await fetchWithTimeout('/api/market/jobs', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load market jobs.');
    return await readJson<{ policies: MarketSchedulePolicy[] }>(res, 'Could not load market jobs.');
  },

  async triggerMarketJob(payload: { sourceId: string }, signal?: AbortSignal): Promise<unknown> {
    const res = await fetchWithTimeout('/api/market/jobs/trigger', {
      method: 'POST', headers: defaultHeaders(), body: JSON.stringify(payload), signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Failed to trigger market job.');
    return await res.json();
  },

  async getMarketSourceHealth(signal?: AbortSignal): Promise<{ health: SourceHealth[] }> {
    const res = await fetchWithTimeout('/api/market/sources/health', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load source health.');
    return await readJson<{ health: SourceHealth[] }>(res, 'Could not load source health.');
  },

  async getMarketReviewQueue(signal?: AbortSignal): Promise<{ items: MarketReviewItem[] }> {
    const res = await fetchWithTimeout('/api/market/review-queue', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load review queue.');
    return await readJson<{ items: MarketReviewItem[] }>(res, 'Could not load review queue.');
  },

  async getMarketOpsOverview(signal?: AbortSignal): Promise<{ overview: MarketOpsOverview }> {
    const res = await fetchWithTimeout('/api/market/ops/overview', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load ops overview.');
    return await readJson<{ overview: MarketOpsOverview }>(res, 'Could not load ops overview.');
  },

  async getMarketAlerts(signal?: AbortSignal): Promise<{ alerts: MarketAlert[] }> {
    const res = await fetchWithTimeout('/api/market/alerts', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load market alerts.');
    return await readJson<{ alerts: MarketAlert[] }>(res, 'Could not load market alerts.');
  },  async getMarketStats(signal?: AbortSignal): Promise<{ stats: unknown[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/commerce/market-stats`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load market stats.');

    return await readJson<{ stats: unknown[] }>(res, 'Could not load market stats.');
  },

  async getCommerceSuppliers(signal?: AbortSignal): Promise<{ suppliers: import('../shared/types/commerce').SupplierEntity[] }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/commerce/suppliers`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load suppliers in Dahab.');
    return await readJson<{ suppliers: import('../shared/types/commerce').SupplierEntity[] }>(res, 'Could not load suppliers in Dahab.');
  },

  async getMarketPriceHistory() {
    const res = await fetchWithTimeout('/api/market/price-history', { headers: defaultHeaders() });
    return await res.json();
  },

  async getSmsLogs(limit: number = 30) {
    const res = await fetchWithTimeout(`/api/sms/logs?limit=${limit}`, {
      headers: defaultHeaders()
    });
    if (!res.ok) return { count: 0, logs: [] };
    return await res.json();
  },

  async getOperationsTrips(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetchWithTimeout(`/api/operations/trips${query ? `?${query}` : ''}`, { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to load operations trips');
    return await res.json();
  },

  async getOperationsBookings(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetchWithTimeout(`/api/operations/bookings${query ? `?${query}` : ''}`, { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to load operations bookings');
    return await res.json();
  },

  async getOperationsMessages(params: Record<string, string> = {}) {
    const query = new URLSearchParams(params).toString();
    const res = await fetchWithTimeout(`/api/support/messages${query ? `?${query}` : ''}`, { headers: defaultHeaders() });
    if (!res.ok) throw new Error('Failed to load operations messages');
    return await res.json();
  },

  async getOperationsPayments() {
    const res = await fetchWithTimeout('/api/operations/payments', { headers: defaultHeaders() });
    return await res.json();
  },

  async getOperationsTransfers() {
    const res = await fetchWithTimeout('/api/operations/transfers', { headers: defaultHeaders() });
    return await res.json();
  },

  async getSupplierReliability() {
    const res = await fetchWithTimeout('/api/operations/supplier-reliability', { headers: defaultHeaders() });
    return await res.json();
  },

  async processOpsRefund(params: { bookingRef: string; amountEGP: number; reason: string; operatorId?: string }) {
    const res = await fetchWithTimeout('/api/operations/refund', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to process refund');
    return await res.json();
  },

  async getOperationsNotifications() {
    const res = await fetchWithTimeout('/api/operations/notifications', { headers: defaultHeaders() });
    return await res.json();
  },

  async sendOpsSmsDispatch(params: { to: string; recipientName: string; recipientRole?: string; message: string; bookingRef?: string; channel?: string }) {
    const res = await fetchWithTimeout('/api/operations/sms-dispatch', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to send SMS');
    return await res.json();
  },

  async actOnOpportunity(id: string, action: 'accept' | 'reject' | 'defer', reason?: string) {
    const res = await fetchWithTimeout(`/api/intelligence/opportunities/${encodeURIComponent(id)}/action`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ action, reason }),
    });
    if (!res.ok) throw new Error('Failed to act on opportunity');
    return await res.json();
  },

  async getIntelligenceOpportunities() {
    const res = await fetchWithTimeout('/api/intelligence/opportunities', { headers: defaultHeaders() });
    return await res.json();
  },

  async getIntelligenceFeatures() {
    const res = await fetchWithTimeout('/api/intelligence/features', { headers: defaultHeaders() });
    return await res.json();
  },

  async getOperationsIntegrations() {
    const res = await fetchWithTimeout('/api/operations/integrations', { headers: defaultHeaders() });
    return await res.json();
  },

  async getLedgerAnomalies() {
    const res = await fetchWithTimeout('/api/commerce/ledger/anomalies', { headers: defaultHeaders() });
    return await res.json();
  },

  async reconcileLedger(bookingRef: string) {
    const res = await fetchWithTimeout(`/api/commerce/ledger/reconcile/${encodeURIComponent(bookingRef)}`, { headers: defaultHeaders() });
    return await res.json();
  },

  async getAdminLogs(limit = 50) {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/logs?limit=${limit}`, { headers: defaultHeaders() });
    return await res.json();
  },

  async resolveAdminConflict(conflictId: string, resolvedValue: string) {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/conflicts/resolve`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ conflictId, resolvedValue }),
    });
    if (!res.ok) throw new Error('Failed to resolve conflict');
    return await res.json();
  },

  async resolveAdminReviewQueue(reviewId: string, decision: string, notes?: string) {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/review-queue/resolve`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ reviewId, decision: decision.toUpperCase(), notes }),
    });
    if (!res.ok) throw new Error('Failed to resolve review item');
    return await res.json();
  },

  async mergeAdminEntities(params: { sourceId: string; targetId: string }) {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/entities/merge`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error('Failed to merge entities');
    return await res.json();
  },

  // ─── Pricing & Inventory ─────────────────────────────────────────────────

  async getAdminSkus(serviceType?: string, signal?: AbortSignal) {
    const qs = serviceType ? `?serviceType=${encodeURIComponent(serviceType)}` : '';
    const res = await fetchWithTimeout(`/api/admin/pricing/skus${qs}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Failed to load SKUs');
    return await res.json();
  },

  async updateAdminSku(skuId: string, patch: Record<string, any>, signal?: AbortSignal) {
    const res = await fetchWithTimeout(`/api/admin/pricing/sku/${encodeURIComponent(skuId)}`, {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(patch),
      signal,
    });
    if (!res.ok) throw new Error('Failed to update SKU');
    return await res.json();
  },

  async getAdminInventory(skuId: string, startDate?: string, endDate?: string, signal?: AbortSignal) {
    const params = new URLSearchParams({ skuId });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const res = await fetchWithTimeout(`/api/admin/pricing/inventory?${params}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw new Error('Failed to load inventory');
    return await res.json();
  },

  async updateAdminInventorySlot(slotId: string, patch: Record<string, any>, signal?: AbortSignal) {
    const res = await fetchWithTimeout(`/api/admin/pricing/inventory/${encodeURIComponent(slotId)}`, {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(patch),
      signal,
    });
    if (!res.ok) throw new Error('Failed to update inventory slot');
    return await res.json();
  },

  // ─── Visual Content ───────────────────────────────────────────────────────
  // Retired: the legacy hero/gallery editors wrote to site_settings, which no
  // public surface ever read. Hero and gallery are edited live in CMS Content
  // (Homepage tab + gallery pages); use getCmsHomepage / getCmsGallery.

  // ---------------------------------------------------------------------------
  // Dining orders & delivery
  // ---------------------------------------------------------------------------
  //
  // The price is NEVER computed here and no method accepts a total from the
  // caller. quoteDiningOrder and placeDiningOrder send only dish ids and
  // quantities; the server resolves prices from the menu rows. That is why
  // placeDiningOrder's payload type has no price field at all — a client that
  // could send one would eventually send a wrong one.
  //
  // Public: the four read/quote methods. Everything under /dining/orders needs
  // a session, and advancing an order's state needs Operations or Admin.

  async getDiningVenues(signal?: AbortSignal): Promise<{ venues: DiningVenueSummary[]; count: number }> {
    const res = await fetchWithTimeout('/api/dining/venues', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load restaurants.');
    return await readJson<{ venues: DiningVenueSummary[]; count: number }>(res, 'Could not load restaurants.');
  },

  async getDiningVenue(slug: string, signal?: AbortSignal): Promise<DiningVenueMenuResponse> {
    const res = await fetchWithTimeout(`/api/dining/venues/${encodeURIComponent(slug)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load this restaurant.');
    return await readJson<DiningVenueMenuResponse>(res, 'Could not load this restaurant.');
  },

  /**
   * Which zones this kitchen serves, and — when a coordinate is supplied —
   * whether they reach the customer and what the drop costs.
   */
  async getDiningDeliveryZones(
    venueId: string,
    coords?: { latitude: number; longitude: number },
    signal?: AbortSignal
  ): Promise<DiningDeliveryZonesResponse> {
    const params = new URLSearchParams({ venueId });
    if (coords) {
      params.set('lat', String(coords.latitude));
      params.set('lng', String(coords.longitude));
    }
    const res = await fetchWithTimeout(`/api/dining/delivery-zones?${params.toString()}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not check delivery to your area.');
    return await readJson<DiningDeliveryZonesResponse>(res, 'Could not check delivery to your area.');
  },

  /**
   * Server-computed price for a basket. Public: the traveler has to see what a
   * dinner costs before being asked to sign in.
   *
   * A refusal (no delivery / zone not served / below minimum) comes back as
   * `refusal` on a 200, not as an error, so the screen can explain itself
   * honestly instead of showing a failure.
   */
  async quoteDiningOrder(
    params: {
      venueId: string;
      items: DiningCartLineInput[];
      fulfillment: DiningOrderFulfillment;
      zoneId?: string;
      latitude?: number;
      longitude?: number;
      addressText?: string;
      locationSource?: DeliveryLocationDraft['source'];
    },
    signal?: AbortSignal
  ): Promise<DiningQuote> {
    const res = await fetchWithTimeout('/api/dining/quote', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not price this order.');
    return await readJson<DiningQuote>(res, 'Could not price this order.');
  },

  /**
   * Place the order. Requires a session (401 becomes a sign-in prompt).
   *
   * `idempotencyKey` is what makes a double-tap on a slow Sinai connection
   * safe: the server returns the original order instead of cooking twice. It
   * must be stable across retries of the SAME intent and new for a new one.
   */
  async placeDiningOrder(
    params: {
      venueId: string;
      items: DiningCartLineInput[];
      fulfillment: DiningOrderFulfillment;
      zoneId?: string;
      latitude?: number;
      longitude?: number;
      addressText?: string;
      locationSource?: DeliveryLocationDraft['source'];
      idempotencyKey: string;
      notes?: string;
      paymentMethod?: 'CASH_ON_ARRIVAL' | 'PAYMOB';
    },
    signal?: AbortSignal
  ): Promise<DiningOrder> {
    const res = await fetchWithTimeout('/api/dining/orders', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Your order could not be placed.');
    const payload = await readJson<{ order: DiningOrder }>(res, 'Your order could not be placed.');
    return payload.order;
  },

  async getDiningOrders(signal?: AbortSignal): Promise<{ orders: DiningOrder[]; count: number }> {
    const res = await fetchWithTimeout('/api/dining/orders', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load your orders.');
    return await readJson<{ orders: DiningOrder[]; count: number }>(res, 'Could not load your orders.');
  },

  async getDiningOrder(orderId: string, signal?: AbortSignal): Promise<DiningOrder> {
    const res = await fetchWithTimeout(`/api/dining/orders/${encodeURIComponent(orderId)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load this order.');
    const payload = await readJson<{ order: DiningOrder }>(res, 'Could not load this order.');
    return payload.order;
  },

  async cancelDiningOrder(orderId: string, reason?: string): Promise<DiningOrder> {
    const res = await fetchWithTimeout(`/api/dining/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ reason })
    });
    // 409 NOT_CANCELLABLE means the food already exists; the caller shows that
    // state rather than pretending the cancel worked.
    if (!res.ok) throw await apiErrorFrom(res, 'This order could not be cancelled.');
    const payload = await readJson<{ order: DiningOrder }>(res, 'This order could not be cancelled.');
    return payload.order;
  },

  /** Operations/Admin only: move an order to its next state. */
  async advanceDiningOrder(
    orderId: string,
    status: DiningOrderStatus,
    reason?: string
  ): Promise<DiningOrder> {
    const res = await fetchWithTimeout(`/api/dining/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify({ status, reason })
    });
    if (!res.ok) throw await apiErrorFrom(res, 'The order status could not be updated.');
    const payload = await readJson<{ order: DiningOrder }>(res, 'The order status could not be updated.');
    return payload.order;
  },

  // ---------------------------------------------------------------------------
  // Dahab parties & nightlife
  // ---------------------------------------------------------------------------
  //
  // All reads are public pre-signup: browsing tonight's parties is the
  // discovery surface, and WhatsApp — not a session — is the booking flow.
  // Every figure comes from the server (cached up to 6h; `cachedUntil` is the
  // honesty field the offline banner renders).

  async getDahabParties(
    filters: {
      zone?: string;
      category?: string;
      vibe?: string;
      date?: string;
      priceMaxEgp?: number;
      freeOnly?: boolean;
      featuredOnly?: boolean;
      tonight?: boolean;
      q?: string;
    } = {},
    signal?: AbortSignal
  ): Promise<PartyListResponse> {
    const params = new URLSearchParams();
    if (filters.zone) params.set('zone', filters.zone);
    if (filters.category) params.set('category', filters.category);
    if (filters.vibe) params.set('vibe', filters.vibe);
    if (filters.date) params.set('date', filters.date);
    if (filters.priceMaxEgp !== undefined) params.set('price_max_egp', String(filters.priceMaxEgp));
    if (filters.freeOnly) params.set('free_only', 'true');
    if (filters.featuredOnly) params.set('featured_only', 'true');
    if (filters.tonight) params.set('tonight', 'true');
    if (filters.q) params.set('q', filters.q);
    const qs = params.toString();
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/parties${qs ? `?${qs}` : ''}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load tonight’s parties.');
    return await readJson<PartyListResponse>(res, 'Could not load tonight’s parties.');
  },

  async getDahabPartyTonight(date?: string, signal?: AbortSignal): Promise<PartyTonightResponse> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/parties/tonight${qs}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load tonight’s parties.');
    return await readJson<PartyTonightResponse>(res, 'Could not load tonight’s parties.');
  },

  async getDahabPartyZones(signal?: AbortSignal): Promise<PartyZonesResponse> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/parties/zones`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load party zones.');
    return await readJson<PartyZonesResponse>(res, 'Could not load party zones.');
  },

  async getDahabParty(id: string, signal?: AbortSignal): Promise<{ party: PartyView }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/parties/${encodeURIComponent(id)}`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load this party.');
    return await readJson<{ party: PartyView }>(res, 'Could not load this party.');
  },

  /**
   * Logs the intent server-side and returns a server-rendered wa.me link.
   * The message text is produced from the party row — this method never sends
   * free-form text, so a tampered client cannot forge what the organizer sees.
   */
  async postDahabPartyBookIntent(
    partyId: string,
    params: { targetDate: string; persons: number; language: 'en' | 'ar' }
  ): Promise<PartyBookIntentResponse> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/parties/${encodeURIComponent(partyId)}/book-intent`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(params)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not start the WhatsApp booking.');
    return await readJson<PartyBookIntentResponse>(res, 'Could not start the WhatsApp booking.');
  },

  // Parties admin (Operations/Admin): catalogue CRUD + the licence gate.

  async getAdminDahabParties(signal?: AbortSignal): Promise<{ parties: PartyView[]; count: number }> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/parties`, {
      headers: defaultHeaders(),
      signal
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the parties catalogue.');
    return await readJson<{ parties: PartyView[]; count: number }>(res, 'Could not load the parties catalogue.');
  },

  async createDahabParty(payload: PartyWritePayload): Promise<PartyView> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/parties`, {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'The party could not be created.');
    const data = await readJson<{ party: PartyView }>(res, 'The party could not be created.');
    return data.party;
  },

  async updateDahabParty(id: string, payload: Partial<PartyWritePayload>): Promise<PartyView> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/parties/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: defaultHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw await apiErrorFrom(res, 'The party could not be updated.');
    const data = await readJson<{ party: PartyView }>(res, 'The party could not be updated.');
    return data.party;
  },

  async setDahabPartyLicenseVerified(id: string, verified: boolean): Promise<PartyView> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/parties/${encodeURIComponent(id)}/license-verified`, {
      method: 'PATCH',
      headers: defaultHeaders(),
      body: JSON.stringify({ verified })
    });
    if (!res.ok) throw await apiErrorFrom(res, 'The licence flag could not be updated.');
    const data = await readJson<{ party: PartyView }>(res, 'The licence flag could not be updated.');
    return data.party;
  },

  async deleteDahabParty(id: string): Promise<void> {
    const res = await fetchWithTimeout(`/api/cities/${destinationId}/admin/parties/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: defaultHeaders()
    });
    if (!res.ok) throw await apiErrorFrom(res, 'The party could not be deleted.');
  },

  // ── Staff control (docs/OPS_API_CONTRACT.md: "Admin: access", "Admin: control",
  //    /api/search). Every mutation carries the operator's `reason`; a 403
  //    approval-required / 503 kill-switch / 403 view-as-readonly arrives as an
  //    ApiError whose `type` names it (approvalId in `details`).

  async adminListUsers(params: AdminUsersQuery = {}, signal?: AbortSignal): Promise<ListResponse<AdminUserRow>> {
    const res = await fetchWithTimeout(`/api/admin/users${controlQuery(params)}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load users.');
    return await readJson<ListResponse<AdminUserRow>>(res, 'Could not load users.');
  },

  async adminGetUser(id: string, signal?: AbortSignal): Promise<AdminUserDetail> {
    const res = await fetchWithTimeout(`/api/admin/users/${encodeURIComponent(id)}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the user.');
    return await readJson<AdminUserDetail>(res, 'Could not load the user.');
  },

  async adminInviteUser(body: { email: string; name: string; phone?: string; roleId: string; supplierId?: string }): Promise<{ user: AdminUser; tempPassword: string }> {
    const res = await fetchWithTimeout('/api/admin/users', { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw await apiErrorFrom(res, 'The invitation could not be created.');
    return await readJson<{ user: AdminUser; tempPassword: string }>(res, 'The invitation could not be created.');
  },

  async adminUpdateUser(id: string, body: { roleId?: string; status?: 'active' | 'suspended'; supplierId?: string; name?: string; reason: string }): Promise<{ user: AdminUser }> {
    const res = await fetchWithTimeout(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', headers: defaultHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw await apiErrorFrom(res, 'The user could not be updated.');
    return await readJson<{ user: AdminUser }>(res, 'The user could not be updated.');
  },

  async adminSetUserOverrides(id: string, overrides: { permission: string; effect: 'grant' | 'deny' }[], reason: string): Promise<{ overrides: PermissionOverride[]; effectivePermissions: string[] }> {
    const res = await fetchWithTimeout(`/api/admin/users/${encodeURIComponent(id)}/overrides`, { method: 'PUT', headers: defaultHeaders(), body: JSON.stringify({ overrides, reason }) });
    if (!res.ok) throw await apiErrorFrom(res, 'The overrides could not be saved.');
    return await readJson<{ overrides: PermissionOverride[]; effectivePermissions: string[] }>(res, 'The overrides could not be saved.');
  },

  async adminRevokeUserSessions(id: string, reason: string): Promise<{ revokedCount: number }> {
    const res = await fetchWithTimeout(`/api/admin/users/${encodeURIComponent(id)}/revoke-sessions`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify({ reason }) });
    if (!res.ok) throw await apiErrorFrom(res, 'The sessions could not be revoked.');
    return await readJson<{ revokedCount: number }>(res, 'The sessions could not be revoked.');
  },

  async adminListPermissions(signal?: AbortSignal): Promise<{ items: PermissionCatalogItem[] }> {
    const res = await fetchWithTimeout('/api/admin/permissions', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the permission catalogue.');
    return await readJson<{ items: PermissionCatalogItem[] }>(res, 'Could not load the permission catalogue.');
  },

  async adminListRoles(signal?: AbortSignal): Promise<{ items: AdminRole[] }> {
    const res = await fetchWithTimeout('/api/admin/roles', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load roles.');
    return await readJson<{ items: AdminRole[] }>(res, 'Could not load roles.');
  },

  async adminCreateRole(body: { name: string; description?: string; permissions: string[]; baseRole?: 'Operations' | 'Product' | 'Supplier' }): Promise<AdminRole> {
    const res = await fetchWithTimeout('/api/admin/roles', { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw await apiErrorFrom(res, 'The role could not be created.');
    return await readJson<AdminRole>(res, 'The role could not be created.');
  },

  async adminUpdateRole(id: string, body: { name?: string; description?: string; permissions?: string[]; reason: string }): Promise<AdminRole> {
    const res = await fetchWithTimeout(`/api/admin/roles/${encodeURIComponent(id)}`, { method: 'PATCH', headers: defaultHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw await apiErrorFrom(res, 'The role could not be updated.');
    return await readJson<AdminRole>(res, 'The role could not be updated.');
  },

  async adminDeleteRole(id: string, reason: string): Promise<void> {
    const res = await fetchWithTimeout(`/api/admin/roles/${encodeURIComponent(id)}`, { method: 'DELETE', headers: defaultHeaders(), body: JSON.stringify({ reason }) });
    if (!res.ok) throw await apiErrorFrom(res, 'The role could not be deleted.');
  },

  async adminListSettings(signal?: AbortSignal): Promise<{ items: AdminSetting[] }> {
    const res = await fetchWithTimeout('/api/admin/settings', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load settings.');
    return await readJson<{ items: AdminSetting[] }>(res, 'Could not load settings.');
  },

  async adminUpdateSetting(key: string, value: unknown, reason: string): Promise<AdminSetting> {
    const res = await fetchWithTimeout(`/api/admin/settings/${encodeURIComponent(key)}`, { method: 'PUT', headers: defaultHeaders(), body: JSON.stringify({ value, reason }) });
    if (!res.ok) throw await apiErrorFrom(res, 'The setting could not be saved.');
    return await readJson<AdminSetting>(res, 'The setting could not be saved.');
  },

  async adminGetSettingHistory(key: string, signal?: AbortSignal): Promise<ListResponse<AdminSettingVersion>> {
    const res = await fetchWithTimeout(`/api/admin/settings/${encodeURIComponent(key)}/history?limit=100&sort=-version`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the setting history.');
    return await readJson<ListResponse<AdminSettingVersion>>(res, 'Could not load the setting history.');
  },

  async adminRollbackSetting(key: string, version: number, reason: string): Promise<AdminSetting> {
    const res = await fetchWithTimeout(`/api/admin/settings/${encodeURIComponent(key)}/rollback`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify({ version, reason }) });
    if (!res.ok) throw await apiErrorFrom(res, 'The setting could not be rolled back.');
    return await readJson<AdminSetting>(res, 'The setting could not be rolled back.');
  },

  async adminListFlags(signal?: AbortSignal): Promise<{ items: AdminFlag[] }> {
    const res = await fetchWithTimeout('/api/admin/flags', { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load flags.');
    return await readJson<{ items: AdminFlag[] }>(res, 'Could not load flags.');
  },

  async adminUpdateFlag(key: string, body: { enabled: boolean; rolloutPercent?: number; roles?: string[]; reason: string }): Promise<AdminFlag> {
    const res = await fetchWithTimeout(`/api/admin/flags/${encodeURIComponent(key)}`, { method: 'PUT', headers: defaultHeaders(), body: JSON.stringify(body) });
    if (!res.ok) throw await apiErrorFrom(res, 'The flag could not be updated.');
    return await readJson<AdminFlag>(res, 'The flag could not be updated.');
  },

  async adminListIntegrations(signal?: AbortSignal): Promise<{ items: AdminIntegration[] }> {
    const res = await fetchWithTimeout('/api/admin/integrations', { headers: defaultHeaders(), signal, timeout: 20000 });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load integrations.');
    return await readJson<{ items: AdminIntegration[] }>(res, 'Could not load integrations.');
  },

  async adminCheckIntegration(id: string): Promise<AdminIntegration> {
    const res = await fetchWithTimeout(`/api/admin/integrations/${encodeURIComponent(id)}/check`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify({}), timeout: 20000 });
    if (!res.ok) throw await apiErrorFrom(res, 'The integration check failed.');
    return await readJson<AdminIntegration>(res, 'The integration check failed.');
  },

  async adminUpdateIntegration(id: string, body: { enabled?: boolean; mode?: 'sandbox' | 'live'; reason: string }): Promise<AdminIntegration> {
    const res = await fetchWithTimeout(`/api/admin/integrations/${encodeURIComponent(id)}`, { method: 'PATCH', headers: defaultHeaders(), body: JSON.stringify(body), timeout: 20000 });
    if (!res.ok) throw await apiErrorFrom(res, 'The integration could not be updated.');
    return await readJson<AdminIntegration>(res, 'The integration could not be updated.');
  },

  async adminListApprovals(params: { status?: AdminApprovalStatus; cursor?: string; limit?: number } = {}, signal?: AbortSignal): Promise<ListResponse<AdminApproval>> {
    const res = await fetchWithTimeout(`/api/admin/approvals${controlQuery(params)}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load approvals.');
    return await readJson<ListResponse<AdminApproval>>(res, 'Could not load approvals.');
  },

  async adminDecideApproval(id: string, decision: 'approve' | 'reject', note?: string): Promise<AdminApproval> {
    const res = await fetchWithTimeout(`/api/admin/approvals/${encodeURIComponent(id)}/decide`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify({ decision, note }) });
    if (!res.ok) throw await apiErrorFrom(res, 'The decision could not be recorded.');
    return await readJson<AdminApproval>(res, 'The decision could not be recorded.');
  },

  async adminListAudit(params: AdminAuditQuery = {}, signal?: AbortSignal): Promise<ListResponse<AdminAuditEvent>> {
    const res = await fetchWithTimeout(`/api/admin/audit${controlQuery(params)}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not load the audit log.');
    return await readJson<ListResponse<AdminAuditEvent>>(res, 'Could not load the audit log.');
  },

  /** A same-origin link for the CSV export (cookie auth; the browser downloads it). */
  adminAuditExportUrl(params: AdminAuditQuery = {}): string {
    const { cursor: _cursor, limit: _limit, ...filters } = params;
    return `/api/admin/audit/export${controlQuery(filters)}`;
  },

  async adminStartViewAs(userId: string, reason: string): Promise<{ viewAs: { userId: string; email: string; startedAt: string } }> {
    const res = await fetchWithTimeout('/api/admin/view-as', { method: 'POST', headers: defaultHeaders(), body: JSON.stringify({ userId, reason }) });
    if (!res.ok) throw await apiErrorFrom(res, 'View-as could not be started.');
    return await readJson<{ viewAs: { userId: string; email: string; startedAt: string } }>(res, 'View-as could not be started.');
  },

  async adminEndViewAs(): Promise<{ success: boolean }> {
    const res = await fetchWithTimeout('/api/admin/view-as', { method: 'DELETE', headers: defaultHeaders() });
    if (!res.ok) throw await apiErrorFrom(res, 'View-as could not be ended.');
    return await readJson<{ success: boolean }>(res, 'View-as could not be ended.');
  },

  /** Permission-filtered staff search across bookings, users, suppliers and properties. */
  async staffSearch(q: string, types?: StaffSearchType[], signal?: AbortSignal): Promise<{ items: StaffSearchItem[] }> {
    const res = await fetchWithTimeout(`/api/search${controlQuery({ q, types: types?.join(',') })}`, { headers: defaultHeaders(), signal });
    if (!res.ok) throw await apiErrorFrom(res, 'Search failed.');
    return await readJson<{ items: StaffSearchItem[] }>(res, 'Search failed.');
  },

  // ── Catalogue CRUD (docs/CATALOG_API_CONTRACT.md). Every method takes the
  //    scope: `staff` → /api/admin/catalog, `supplier` → /api/supplier/catalog
  //    (scoped server-side to the caller's supplierId; a supplier "publish"
  //    becomes status `review`). Each URL is written out literally so the
  //    contract gate (tests/contract/apiContract.test.ts) can see both.
  //    Failures are ApiErrors: 409 stale/in-use, 422 incomplete with
  //    `details.missing`, 403 approval-required.

  async catalogSchema(scope: CatalogScope, signal?: AbortSignal): Promise<CatalogSchemaResponse> {
    const res = scope === 'supplier'
      ? await fetchWithTimeout('/api/supplier/catalog/schema', { headers: defaultHeaders(), signal })
      : await fetchWithTimeout('/api/admin/catalog/schema', { headers: defaultHeaders(), signal });
    return catalogRead<CatalogSchemaResponse>(res, 'Could not load the catalogue schema.');
  },

  /** Per-type counts in one call (replaces three `limit=1` list calls per type). */
  async catalogSummary(scope: CatalogScope, signal?: AbortSignal): Promise<CatalogSummaryResponse> {
    const res = scope === 'supplier'
      ? await fetchWithTimeout('/api/supplier/catalog/summary', { headers: defaultHeaders(), signal })
      : await fetchWithTimeout('/api/admin/catalog/summary', { headers: defaultHeaders(), signal });
    const data = await catalogRead<Partial<CatalogSummaryResponse>>(res, 'Could not load the catalogue summary.');
    return { types: Array.isArray(data.types) ? data.types : [] };
  },

  /**
   * A listing photo. Suppliers upload through their own route (asset tagged
   * `supplier:<id>`); staff keep the media library. Same body and response.
   */
  async catalogUploadMedia(scope: CatalogScope, data: { dataUrl: string; filename?: string; category?: string }): Promise<{ asset?: { original_url?: string; url?: string } }> {
    if (scope !== 'supplier') return this.uploadCmsMedia(data);
    const { category: _category, ...body } = data;
    const res = await fetchWithTimeout('/api/supplier/catalog/media/upload', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(body),
      timeout: 30000,
    });
    return catalogRead<{ asset?: { original_url?: string; url?: string } }>(res, 'Failed to upload media.');
  },

  async catalogList(scope: CatalogScope, type: string, query: CatalogListQuery = {}, signal?: AbortSignal): Promise<CatalogListResponse> {
    const t = encodeURIComponent(type);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}${controlQuery(query)}`, { headers: defaultHeaders(), signal })
      : await fetchWithTimeout(`/api/admin/catalog/${t}${controlQuery(query)}`, { headers: defaultHeaders(), signal });
    return catalogRead<CatalogListResponse>(res, 'Could not load the catalogue.');
  },

  async catalogGet(scope: CatalogScope, type: string, id: string, signal?: AbortSignal): Promise<CatalogDetailResponse> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}`, { headers: defaultHeaders(), signal })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}`, { headers: defaultHeaders(), signal });
    const data = await catalogRead<CatalogDetailResponse>(res, 'Could not load this listing.');
    return { item: data.item, children: data.children ?? {} };
  },

  /** New records are always drafts. */
  async catalogCreate(scope: CatalogScope, type: string, body: CatalogWriteBody): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(body) })
      : await fetchWithTimeout(`/api/admin/catalog/${t}`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(body) });
    return catalogEnvelope(await catalogRead(res, 'The listing could not be created.'));
  },

  /** `ifMatch` is the `updatedAt` the edit started from; a stale one is a 409. */
  async catalogPatch(scope: CatalogScope, type: string, id: string, body: CatalogWriteBody, ifMatch?: string): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const headers: Record<string, string> = ifMatch ? { ...defaultHeaders(), 'If-Match': ifMatch } : defaultHeaders();
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}`, { method: 'PATCH', headers, body: JSON.stringify(body) })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
    return catalogEnvelope(await catalogRead(res, 'The listing could not be saved.'));
  },

  /** Staff: publishes. Supplier: submits for review (status `review`). 422 when incomplete. */
  async catalogPublish(scope: CatalogScope, type: string, id: string): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/publish`, { method: 'POST', headers: defaultHeaders(), body: '{}' })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/publish`, { method: 'POST', headers: defaultHeaders(), body: '{}' });
    return catalogEnvelope(await catalogRead(res, 'The listing could not be published.'));
  },

  async catalogHide(scope: CatalogScope, type: string, id: string): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/hide`, { method: 'POST', headers: defaultHeaders(), body: '{}' })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/hide`, { method: 'POST', headers: defaultHeaders(), body: '{}' });
    return catalogEnvelope(await catalogRead(res, 'The listing could not be hidden.'));
  },

  async catalogArchive(scope: CatalogScope, type: string, id: string, reason: string): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/archive`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify({ reason }) })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/archive`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify({ reason }) });
    return catalogEnvelope(await catalogRead(res, 'The listing could not be archived.'));
  },

  async catalogRestore(scope: CatalogScope, type: string, id: string): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/restore`, { method: 'POST', headers: defaultHeaders(), body: '{}' })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/restore`, { method: 'POST', headers: defaultHeaders(), body: '{}' });
    return catalogEnvelope(await catalogRead(res, 'The listing could not be restored.'));
  },

  /** Hard-deletes a never-booked draft; anything else is a 409 in-use (archive it instead). */
  async catalogDelete(scope: CatalogScope, type: string, id: string, reason: string): Promise<void> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}`, { method: 'DELETE', headers: defaultHeaders(), body: JSON.stringify({ reason }) })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}`, { method: 'DELETE', headers: defaultHeaders(), body: JSON.stringify({ reason }) });
    if (!res.ok) throw await apiErrorFrom(res, 'The listing could not be deleted.');
  },

  async catalogDuplicate(scope: CatalogScope, type: string, id: string): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/duplicate`, { method: 'POST', headers: defaultHeaders(), body: '{}' })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/duplicate`, { method: 'POST', headers: defaultHeaders(), body: '{}' });
    return catalogEnvelope(await catalogRead(res, 'The listing could not be duplicated.'));
  },

  async catalogBulk(scope: CatalogScope, type: string, body: CatalogBulkBody): Promise<CatalogBulkResult> {
    const t = encodeURIComponent(type);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/bulk`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(body) })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/bulk`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(body) });
    return catalogRead<CatalogBulkResult>(res, 'The bulk action could not be applied.');
  },

  async catalogChildList(scope: CatalogScope, type: string, id: string, child: string, signal?: AbortSignal): Promise<CatalogEnvelope[]> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const c = encodeURIComponent(child);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/${c}`, { headers: defaultHeaders(), signal })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/${c}`, { headers: defaultHeaders(), signal });
    const data = await catalogRead<{ items?: CatalogEnvelope[] } | CatalogEnvelope[]>(res, 'Could not load these items.');
    return Array.isArray(data) ? data : data.items ?? [];
  },

  async catalogChildCreate(scope: CatalogScope, type: string, id: string, child: string, body: CatalogWriteBody): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const c = encodeURIComponent(child);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/${c}`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(body) })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/${c}`, { method: 'POST', headers: defaultHeaders(), body: JSON.stringify(body) });
    return catalogEnvelope(await catalogRead(res, 'The item could not be added.'));
  },

  async catalogChildPatch(scope: CatalogScope, type: string, id: string, child: string, childId: string, body: CatalogWriteBody): Promise<CatalogEnvelope> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const c = encodeURIComponent(child);
    const ci = encodeURIComponent(childId);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/${c}/${ci}`, { method: 'PATCH', headers: defaultHeaders(), body: JSON.stringify(body) })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/${c}/${ci}`, { method: 'PATCH', headers: defaultHeaders(), body: JSON.stringify(body) });
    return catalogEnvelope(await catalogRead(res, 'The item could not be saved.'));
  },

  async catalogChildDelete(scope: CatalogScope, type: string, id: string, child: string, childId: string, reason: string): Promise<void> {
    const t = encodeURIComponent(type);
    const i = encodeURIComponent(id);
    const c = encodeURIComponent(child);
    const ci = encodeURIComponent(childId);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/${t}/${i}/${c}/${ci}`, { method: 'DELETE', headers: defaultHeaders(), body: JSON.stringify({ reason }) })
      : await fetchWithTimeout(`/api/admin/catalog/${t}/${i}/${c}/${ci}`, { method: 'DELETE', headers: defaultHeaders(), body: JSON.stringify({ reason }) });
    if (!res.ok) throw await apiErrorFrom(res, 'The item could not be removed.');
  },

  async catalogGetRates(scope: CatalogScope, hotelId: string, query: CatalogRatesQuery, signal?: AbortSignal): Promise<{ nights: CatalogRateNight[] }> {
    const h = encodeURIComponent(hotelId);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/hotel/${h}/rates${controlQuery(query)}`, { headers: defaultHeaders(), signal })
      : await fetchWithTimeout(`/api/admin/catalog/hotel/${h}/rates${controlQuery(query)}`, { headers: defaultHeaders(), signal });
    const data = await catalogRead<{ nights?: CatalogRateNight[] }>(res, 'Could not load the rate calendar.');
    return { nights: data.nights ?? [] };
  },

  /** At most 366 days per call; `weekdays` limits the change to those days of the range. */
  async catalogPutRates(scope: CatalogScope, hotelId: string, body: CatalogRatesPutBody): Promise<CatalogRatesPutResult> {
    const h = encodeURIComponent(hotelId);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/hotel/${h}/rates`, { method: 'PUT', headers: defaultHeaders(), body: JSON.stringify(body) })
      : await fetchWithTimeout(`/api/admin/catalog/hotel/${h}/rates`, { method: 'PUT', headers: defaultHeaders(), body: JSON.stringify(body) });
    const data = await catalogRead<Partial<CatalogRatesPutResult>>(res, 'The rates could not be saved.');
    return {
      applied: typeof data.applied === 'number' ? data.applied : 0,
      queuedForApproval: data.queuedForApproval === true || res.status === 202,
      ...(typeof data.approvalId === 'string' ? { approvalId: data.approvalId } : {}),
    };
  },

  async catalogGetSlots(scope: CatalogScope, activityId: string, query: { from: string; to: string }, signal?: AbortSignal): Promise<{ slots: CatalogSlot[] }> {
    const a = encodeURIComponent(activityId);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/activity/${a}/slots${controlQuery(query)}`, { headers: defaultHeaders(), signal })
      : await fetchWithTimeout(`/api/admin/catalog/activity/${a}/slots${controlQuery(query)}`, { headers: defaultHeaders(), signal });
    const data = await catalogRead<{ slots?: unknown[]; items?: unknown[] }>(res, 'Could not load the slots.');
    return { slots: (data.slots ?? data.items ?? []).map(catalogSlot) };
  },

  async catalogPutSlots(scope: CatalogScope, activityId: string, body: CatalogSlotsPutBody): Promise<{ slots: CatalogSlot[] }> {
    const a = encodeURIComponent(activityId);
    const res = scope === 'supplier'
      ? await fetchWithTimeout(`/api/supplier/catalog/activity/${a}/slots`, { method: 'PUT', headers: defaultHeaders(), body: JSON.stringify(body) })
      : await fetchWithTimeout(`/api/admin/catalog/activity/${a}/slots`, { method: 'PUT', headers: defaultHeaders(), body: JSON.stringify(body) });
    const data = await catalogRead<{ slots?: unknown[]; items?: unknown[] }>(res, 'The slots could not be saved.');
    return { slots: (data.slots ?? data.items ?? []).map(catalogSlot) };
  },

  /** Fetch theme tokens — returns { version, tokens, unchanged? }. */
  async getThemeTokens(params: { v?: string } = {}, signal?: AbortSignal): Promise<{ version: string; tokens: Record<string, string>; unchanged?: boolean }> {
    const query = new URLSearchParams();
    if (params.v) query.set('v', params.v);
    const res = await fetchWithTimeout(`/api/content/theme?${query}`, { headers: defaultHeaders(), signal });
    return readJson(res, 'Could not load theme tokens.');
  },

  /** Fetch string overrides from the CMS — returns { version, strings, unchanged? }. */
  async getStrings(params: { v?: string } = {}, signal?: AbortSignal): Promise<{ version: string; strings: Record<string, { en: string; ar: string }>; unchanged?: boolean }> {
    const query = new URLSearchParams();
    if (params.v) query.set('v', params.v);
    const res = await fetchWithTimeout(`/api/content/strings?${query}`, { headers: defaultHeaders(), signal });
    return readJson(res, 'Could not load string overrides.');
  },

  /** Subscribe to newsletter — posts email + language to /api/newsletter. */
  async subscribeNewsletter(payload: { email: string; lang: string }, signal?: AbortSignal): Promise<void> {
    const res = await fetchWithTimeout('/api/newsletter', {
      method: 'POST',
      headers: defaultHeaders(),
      body: JSON.stringify(payload),
      signal,
    });
    if (!res.ok) throw await apiErrorFrom(res, 'Could not subscribe to the newsletter.');
  },
};

// ---------------------------------------------------------------------------
// Staff control shapes — docs/OPS_API_CONTRACT.md ("Admin: access", "Admin:
// control", "Realtime"); server/contracts/opsContract.ts is the zod source.
// ---------------------------------------------------------------------------

export interface ListResponse<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export type StaffRole = 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: StaffRole;
  supplierId?: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export interface AdminUserRow extends AdminUser {
  lastSeenAt?: string;
  deviceCount: number;
}

export interface AdminDevice {
  id: string;
  name: string;
  platform: 'ios' | 'android' | 'web' | 'unknown';
  lastSeenAt: string;
  createdAt: string;
}

export interface PermissionOverride {
  permission: string;
  effect: 'grant' | 'deny';
  createdBy: string;
  createdAt: string;
}

export interface AdminUserDetail {
  user: AdminUser;
  roleId: string;
  overrides: PermissionOverride[];
  effectivePermissions: string[];
  devices: AdminDevice[];
}

export interface AdminUsersQuery {
  q?: string;
  role?: string;
  status?: 'active' | 'suspended';
  cursor?: string;
  limit?: number;
  sort?: string;
}

export interface PermissionCatalogItem {
  key: string;
  group: string;
  labelEn: string;
  labelAr: string;
  dangerous: boolean;
}

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  isSystem: boolean;
  permissions: string[];
  userCount: number;
  baseRole?: StaffRole;
}

export interface AdminSetting {
  key: string;
  value: unknown;
  type: 'number' | 'string' | 'boolean' | 'json';
  group: string;
  labelEn: string;
  labelAr: string;
  version: number;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface AdminSettingVersion {
  version: number;
  value: unknown;
  updatedBy: string;
  updatedAt: string;
  reason: string;
}

export interface AdminFlag {
  key: string;
  kind: 'flag' | 'killswitch' | 'maintenance';
  /** For a killswitch or maintenance flag, true means the switch is ENGAGED (capability off). */
  enabled: boolean;
  rolloutPercent: number;
  roles: string[];
  description: string;
  updatedBy: string;
  updatedAt: string;
}

export interface AdminIntegration {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'disabled' | 'unconfigured';
  latencyMs: number | null;
  checkedAt: string;
  mode: 'sandbox' | 'live';
  enabled: boolean;
  keyHint: string | null;
  detail: string;
}

export type AdminApprovalStatus = 'pending' | 'approved' | 'rejected' | 'failed';

export interface AdminApproval {
  id: string;
  action: string;
  summary: string;
  payload: Record<string, unknown>;
  requestedBy: string;
  requestedAt: string;
  status: AdminApprovalStatus;
  decidedBy?: string;
  decidedAt?: string;
  decisionNote?: string;
  result?: unknown;
}

export interface AdminAuditEvent {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  device?: string;
  correlationId?: string;
  timestamp: string;
}

export interface AdminAuditQuery {
  q?: string;
  actor?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
}

export type StaffSearchType = 'booking' | 'user' | 'supplier' | 'property';

export interface StaffSearchItem {
  type: StaffSearchType;
  id: string;
  title: string;
  subtitle: string;
  route: string;
}

export type StaffStreamTopic = 'ops' | 'support' | 'exceptions' | 'approvals' | 'notifications';

export interface StaffStreamEvent {
  type: string;
  entityType: string;
  entityId: string;
  summary: string;
  at: string;
}

/** `?a=1&b=2` from the defined, non-empty params ('' when there are none). */
function controlQuery(params: object): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
    if (v === undefined || v === null || v === '') continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** Reads a catalogue response, or throws the server's problem as an ApiError. */
async function catalogRead<T>(res: Response, fallback: string): Promise<T> {
  if (!res.ok) throw await apiErrorFrom(res, fallback);
  return await readJson<T>(res, fallback);
}

/**
 * Write routes answer with the envelope itself or `{ item, queuedForApproval, approvalId? }`;
 * accept both. A 202 with `queuedForApproval: true` (a supplier publish, or a
 * supplier price change over 30%) queues the change for staff — the flag and
 * the id ride along on the returned envelope.
 */
function catalogEnvelope(data: unknown): CatalogEnvelope {
  const record = data as { item?: CatalogEnvelope; approvalId?: unknown; queuedForApproval?: unknown } | CatalogEnvelope;
  if (record && typeof record === 'object' && 'item' in record && record.item) {
    const approvalId = typeof record.approvalId === 'string' ? record.approvalId : undefined;
    const queued = record.queuedForApproval === true;
    return approvalId || queued
      ? { ...record.item, ...(approvalId ? { approvalId } : {}), queuedForApproval: queued || Boolean(approvalId) }
      : record.item;
  }
  return record as CatalogEnvelope;
}

/** Slots arrive as child envelopes (`fields.date/time/capacity`); flatten them. */
function catalogSlot(raw: unknown): CatalogSlot {
  const r = (raw ?? {}) as Partial<CatalogSlot> & { fields?: Record<string, unknown>; status?: string };
  const f = r.fields ?? {};
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return {
    id: r.id,
    date: String(r.date ?? f.date ?? ''),
    time: String(r.time ?? f.time ?? ''),
    capacity: num(r.capacity) ?? num(f.capacity) ?? 0,
    booked: num(r.booked) ?? num(f.reserved),
    closed: typeof r.closed === 'boolean' ? r.closed : r.status === 'hidden' || r.status === 'archived',
  };
}

/** The RFC7807 `type` slug of a failed call (`approval-required`, `kill-switch`, …), or null. */
export function problemSlug(err: unknown): string | null {
  const type = (err as { type?: unknown } | null)?.type;
  if (typeof type !== 'string') return null;
  return type.split('/').pop() || null;
}

/**
 * Subscribes to GET /api/stream (Server-Sent Events, cookie auth — browsers
 * cannot set headers on an EventSource). Reconnects with backoff when the
 * browser gives up (an HTTP error closes the source for good), resuming from
 * the last event id. Returns a function that closes the stream.
 */
export function openStaffStream(
  topics: readonly StaffStreamTopic[],
  onEvent: (topic: StaffStreamTopic, data: StaffStreamEvent, id: string | null) => void,
  options: { onStatus?: (status: 'open' | 'error' | 'closed') => void; maxBackoffMs?: number } = {}
): () => void {
  if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
    options.onStatus?.('closed');
    return () => {};
  }
  const maxBackoff = options.maxBackoffMs ?? 60_000;
  let source: EventSource | null = null;
  let lastEventId: string | null = null;
  let attempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const connect = () => {
    if (stopped) return;
    const params: Record<string, string> = { topics: topics.join(',') };
    if (lastEventId) params.lastEventId = lastEventId;
    const es = new EventSource(`/api/stream${controlQuery(params)}`, { withCredentials: true });
    source = es;
    es.onopen = () => {
      attempt = 0;
      options.onStatus?.('open');
    };
    es.onerror = () => {
      options.onStatus?.('error');
      // CONNECTING means the browser is already retrying on its own; CLOSED
      // (an HTTP error) means it gave up, so retry here with backoff.
      if (es.readyState === EventSource.CLOSED && !stopped) {
        source = null;
        const delay = Math.min(maxBackoff, 1000 * 2 ** Math.min(attempt, 6));
        attempt += 1;
        retryTimer = setTimeout(connect, delay);
      }
    };
    for (const topic of topics) {
      es.addEventListener(topic, (ev: MessageEvent) => {
        if (ev.lastEventId) lastEventId = ev.lastEventId;
        try {
          onEvent(topic, JSON.parse(ev.data) as StaffStreamEvent, ev.lastEventId || null);
        } catch {
          /* a malformed frame is skipped, never fatal */
        }
      });
    }
  };

  connect();
  return () => {
    stopped = true;
    if (retryTimer) clearTimeout(retryTimer);
    source?.close();
    source = null;
    options.onStatus?.('closed');
  };
}
