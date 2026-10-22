import React, { createContext, useContext, useMemo, useCallback } from 'react';
import type { RouteParams } from '../lib/routeUrl';
import {
  deriveTravelerLifecycle,
  type TravelerLifecycleSnapshot
} from '../services/travelerLifecycleResolver';
import {
  AppRoute,
  JourneyStage,
  TravelerProfile,
  TimelineDay,
  ConfirmedBookingItem,
  FoodOrderItem,
  TimelineActivity,
  LedgerEntry,
  TransferTrackingRecord
} from '../types';
import {
  TripBrief,
  TripFitResult,
  TradeOffOption,
  DayIntelligence,
  TripHealthSummary,
  TripReadinessSummary,
  BudgetBreakdown,
  PlanVariant,
  ImprovementActionType
} from '../types/tripOs';
import {
  SingleTravelerContext,
  NextBestAction,
  GoldenJourneyScenario
} from '../types/travelerContext';
import {
  AuthoritativeSupplier,
  PricingDecisionAction,
  ContentProductBridge,
  DiscoveredSupplierCandidate,
  ProductOpportunity,
  OpportunityDecision,
  OpportunityHypothesis,
  FeatureRegisterItem
} from '../types/intelligence';
import type { TripEntity, TripItemWithSupplier } from '../shared/types/trip';
import type { User } from 'firebase/auth';
import { AuthRole, SessionUser } from './AuthContext';
import {
  buildSingleTravelerContext,
  GOLDEN_JOURNEYS_SUITE
} from '../services/travelerJourneyEngine';
import { analytics } from '../services/analytics';
import { DEMO_AHMED_PROFILE, ANONYMOUS_PROFILE } from '../data/dahabContent';
import { AHMED_TRIP_DAYS, AHMED_BOOKINGS } from '../components/mytrip/myTripData';
import {
  DEMO_LEDGER_ENTRIES,
  DEFAULT_ANONYMOUS_TRANSFER,
  DEMO_AHMED_TRANSFER
} from './CommerceContext';

// Re-export constants for backward compatibility
export {
  DEMO_LEDGER_ENTRIES,
  DEFAULT_ANONYMOUS_TRANSFER,
  DEMO_AHMED_TRANSFER
};
export const INITIAL_TRANSFER_TRACKING: TransferTrackingRecord = DEFAULT_ANONYMOUS_TRANSFER;

// Sub-domain hook imports
import { useUI, type UiToast } from './UIContext';
import { useAuth } from './AuthContext';
import { useCommerce } from './CommerceContext';
import { useIntelligence } from './IntelligenceContext';
import { useTripOs } from './TripOsContext';
import { useItinerary } from './ItineraryContext';

export interface TripContextType {
  // Navigation & UI State
  currentRoute: AppRoute;
  setCurrentRoute: (route: AppRoute) => void;
  selectedDayId: number | null;
  setSelectedDayId: (dayId: number | null) => void;
  selectedActivityId: string | null;
  setSelectedActivityId: (activityId: string | null) => void;
  selectedBookingId: string | null;
  setSelectedBookingId: (bookingId: string | null) => void;
  selectedProgramSlug: string | null;
  setSelectedProgramSlug: (slug: string | null) => void;
  selectedExperienceSlug: string | null;
  selectedHotelSlug: string | null;
  selectedRentalSlug: string | null;
  /** The restaurant open on /restaurants, from the address bar. */
  selectedVenueSlug: string | null;
  setSelectedVenueSlug: (slug: string | null) => void;
  /** The product a checkout page should open on, from the address bar. */
  selectedSkuId: string | null;
  /**
   * The URL param block for the route on screen - a stay checkout carries a
   * window and a party at once, so a view reads them together rather than
   * through a dedicated field per value.
   */
  currentParams: RouteParams;
  /**
   * Where this traveler is, and what that implies — one snapshot, shared.
   *
   * This was computed inside homepageCompositionResolver and therefore existed
   * only on the homepage. Every other surface had to guess from the route,
   * which is why the pre-arrival briefing, the arrival flow, the daily
   * companion, departure and post-trip were reachable only by typing their
   * URL: nothing else in the app knew the traveler had reached them.
   */
  lifecycle: TravelerLifecycleSnapshot;
  setSelectedExperienceSlug: (slug: string | null) => void;
  journeyStage: JourneyStage;
  setJourneyStage: (stage: JourneyStage) => void;
  isEasyMode: boolean;
  setIsEasyMode: (val: boolean) => void;
  toggleEasyMode: () => void;
  toasts: UiToast[];
  showToast: (msg: string) => void;
  navigateTo: (route: AppRoute, params?: RouteParams) => void;
  /** Returns to the previous page, or home on a cold entry. See UIContext. */
  goBack: () => void;
  canGoBack: boolean;
  activeDayGiPrompt: string | null;
  setActiveDayGiPrompt: (prompt: string | null) => void;
  openDayGiWithPrompt: (prompt: string) => void;
  activePersonaMode: 'PRE_TRIP' | 'IN_DAHAB';
  setActivePersonaMode: (mode: 'PRE_TRIP' | 'IN_DAHAB') => void;

  // Itinerary & Traveler Profile State
  profile: TravelerProfile;
  setProfile: React.Dispatch<React.SetStateAction<TravelerProfile>>;
  updateProfile: (updates: Partial<TravelerProfile>) => void;
  tripDays: TimelineDay[];
  setTripDays: React.Dispatch<React.SetStateAction<TimelineDay[]>>;
  /** Resolves once the item is stored, so a caller can await it. See ItineraryContext. */
  addActivityToDay: (dayNumber: number, activity: TimelineActivity) => Promise<void>;
  removeActivityFromDay: (dayNumber: number, activityId: string) => Promise<void>;
  updateActivityInDay: (dayNumber: number, activityId: string, updates: Partial<TimelineActivity>) => void;
  shiftActivityBetweenDays: (activityId: string, fromDay: number, toDay: number, newTimeSlot?: string) => void;
  activeFoodOrder: FoodOrderItem | null;
  setActiveFoodOrder: React.Dispatch<React.SetStateAction<FoodOrderItem | null>>;
  savedItems: string[];
  setSavedItems: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSaveItem: (itemId: string) => void;

  // Commerce & Ledger State
  bookings: ConfirmedBookingItem[];
  setBookings: React.Dispatch<React.SetStateAction<ConfirmedBookingItem[]>>;
  /** The signed-in traveler's real trip, or null when they have none. */
  activeTrip: TripEntity | null;
  activeTripItems: TripItemWithSupplier[];
  /** Every trip this traveler has. The profile page reads the finished ones. */
  allTrips: TripEntity[];
  isTripLoading: boolean;
  tripLoadError: string | null;
  reloadTrip: () => void;
  /** Opens the app on a specific trip of the traveler's. */
  openTrip: (tripId: string) => void;
  recordBooking: (booking: ConfirmedBookingItem) => void;
  ledgerEntries: LedgerEntry[];
  recordLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'timestamp' | 'signatureHash'>) => LedgerEntry;
  transferTracking: TransferTrackingRecord;
  setTransferTracking: React.Dispatch<React.SetStateAction<TransferTrackingRecord>>;

  // Intelligence & Actions State
  authoritativeSuppliers: AuthoritativeSupplier[];
  setAuthoritativeSuppliers: React.Dispatch<React.SetStateAction<AuthoritativeSupplier[]>>;
  activeSupplierId: string;
  setActiveSupplierId: (id: string) => void;
  pricingDecisions: PricingDecisionAction[];
  setPricingDecisions: React.Dispatch<React.SetStateAction<PricingDecisionAction[]>>;
  contentBridges: ContentProductBridge[];
  setContentBridges: React.Dispatch<React.SetStateAction<ContentProductBridge[]>>;
  opportunities: ProductOpportunity[];
  setOpportunities: React.Dispatch<React.SetStateAction<ProductOpportunity[]>>;
  featureRegister: FeatureRegisterItem[];
  setFeatureRegister: React.Dispatch<React.SetStateAction<FeatureRegisterItem[]>>;

  // Action Handlers
  promoteCandidateToSupplierOS: (
    candidate: DiscoveredSupplierCandidate,
    reviewerRole: string,
    reviewerEmail: string,
    notes?: string
  ) => AuthoritativeSupplier;
  approvePricingDecision: (decisionId: string, reviewer: string) => void;
  adoptContentBridge: (bridgeId: string, adopter: string) => void;
  decideOpportunity: (
    oppId: string,
    decision: OpportunityDecision['decision'],
    role: OpportunityDecision['decidedByRole'],
    email: string,
    rationale: string,
    linkedSystem?: OpportunityDecision['linkedSystem'],
    linkedFeatureId?: string
  ) => void;
  updateOpportunityHypothesis: (oppId: string, hypothesis: Partial<OpportunityHypothesis>) => void;
  recordOpportunityOutcome: (
    oppId: string,
    outcomeStatus: 'Validated' | 'Failed' | 'Inconclusive',
    primaryVal: string,
    secondaryVal: string,
    notes: string,
    recordedBy: string
  ) => void;
  addOpportunity: (opp: ProductOpportunity) => void;

  // Cloud & Identity State
  user: User | null;
  /** The backend session — what every /api call is actually authorised by. */
  sessionUser: SessionUser | null;
  isSignedIn: boolean;
  isFederatedSignInAvailable: boolean;
  /** No gateway is integrated; settlement is simulated. */
  arePaymentsSimulated: boolean;
  authRole: AuthRole;
  isAuthLoading: boolean;
  intendedRoute: string;
  setIntendedRoute: (route: string) => void;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmail: (email: string, pass: string) => Promise<boolean>;
  signInWithPassword: (email: string, pass: string) => Promise<boolean>;
  registerWithPassword: (name: string, email: string, phone: string, pass: string) => Promise<boolean>;
  registerWithEmail: (name: string, email: string, phone: string, pass: string, role?: string) => Promise<boolean>;
  sendResetPasswordEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  isCloudSynced: boolean;

  // Trip OS State & Methods
  tripBrief: TripBrief;
  setTripBrief: React.Dispatch<React.SetStateAction<TripBrief>>;
  updateTripBrief: (updates: Partial<TripBrief>) => void;
  tripFit: TripFitResult;
  setTripFit: React.Dispatch<React.SetStateAction<TripFitResult>>;
  tradeOffOptions: TradeOffOption[];
  setTradeOffOptions: React.Dispatch<React.SetStateAction<TradeOffOption[]>>;
  selectTradeOffOption: (tradeOffId: string) => void;
  dayIntelligence: DayIntelligence[];
  setDayIntelligence: React.Dispatch<React.SetStateAction<DayIntelligence[]>>;
  tripHealth: TripHealthSummary;
  setTripHealth: React.Dispatch<React.SetStateAction<TripHealthSummary>>;
  resolveTripConflict: (conflictId: string) => void;
  tripReadiness: TripReadinessSummary;
  setTripReadiness: React.Dispatch<React.SetStateAction<TripReadinessSummary>>;
  toggleReadinessItem: (itemId: string) => void;
  budgetBreakdown: BudgetBreakdown;
  setBudgetBreakdown: React.Dispatch<React.SetStateAction<BudgetBreakdown>>;
  applyBudgetOptimization: (optId: string) => void;
  planVariants: PlanVariant[];
  selectedPlanVariantId: string;
  selectPlanVariant: (variantId: 'plan-a' | 'plan-b' | 'plan-c') => void;
  applyImprovementAction: (actionType: ImprovementActionType) => void;

  // Single Unified Traveler Context & Next Best Action
  travelerContext: SingleTravelerContext;
  nextBestActions: NextBestAction[];
  goldenJourneys: GoldenJourneyScenario[];
  trackJourneyEvent: (eventName: any, meta?: Record<string, any>) => void;
  loadDemoSimulation: (scenarioId?: string) => void;
  resetToAnonymousState: () => void;
}

const TripContext = createContext<TripContextType | undefined>(undefined);

/**
 * Composite Facade Provider that unifies sub-domain stores into the single
 * useTrip() interface while eliminating monolithic state duplication.
 */
export const TripProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ui = useUI();
  const auth = useAuth();
  const commerce = useCommerce();
  const intelligence = useIntelligence();
  const tripOs = useTripOs();
  const itinerary = useItinerary();

  // Dynamic derivation of the single unified traveler context
  const travelerContext = useMemo(() => {
    return buildSingleTravelerContext({
      profile: itinerary.profile,
      user: auth.user,
      authRole: auth.authRole,
      isCloudSynced: auth.isCloudSynced,
      tripBrief: tripOs.tripBrief,
      tripDays: itinerary.tripDays,
      bookings: commerce.bookings,
      dayNumber: ui.activePersonaMode === 'IN_DAHAB' ? 2 : 1,
      timeFormatted: ui.activePersonaMode === 'IN_DAHAB' ? '11:30 AM' : '06:15 AM',
      locationId: 'place-lighthouse'
    });
  }, [
    itinerary.profile,
    auth.user,
    auth.sessionUser,
    auth.isSignedIn,
    auth.isFederatedSignInAvailable,
    auth.authRole,
    auth.isCloudSynced,
    tripOs.tripBrief,
    itinerary.tripDays,
    commerce.bookings,
    ui.activePersonaMode
  ]);

  const nextBestActions = travelerContext.nextBestActions;

  const trackJourneyEvent = useCallback(
    (eventName: any, meta?: Record<string, any>) => {
      analytics.track(eventName, {
        travelersCount: itinerary.profile.travelersCount,
        budget: itinerary.profile.budget,
        pace: itinerary.profile.pace,
        interests: itinerary.profile.interests,
        metadata: {
          ...meta,
          personaMode: ui.activePersonaMode,
          phase: travelerContext.activeJourneyPhase,
          location: travelerContext.currentLocation.name
        }
      });
    },
    [
      itinerary.profile.travelersCount,
      itinerary.profile.budget,
      itinerary.profile.pace,
      itinerary.profile.interests,
      ui.activePersonaMode,
      travelerContext.activeJourneyPhase,
      travelerContext.currentLocation.name
    ]
  );

  const loadDemoSimulation = useCallback(
    (_scenarioId?: string) => {
      itinerary.setProfile(DEMO_AHMED_PROFILE);
      itinerary.setTripDays(AHMED_TRIP_DAYS);
      commerce.setBookings(AHMED_BOOKINGS);
      commerce.setLedgerEntries(DEMO_LEDGER_ENTRIES);
      commerce.setTransferTracking(DEMO_AHMED_TRANSFER);
      ui.setActivePersonaMode('IN_DAHAB');
      ui.setJourneyStage('experience');
      itinerary.setActiveFoodOrder({
        id: 'ord-8832',
        restaurantName: 'Al Fanar Local Kitchen',
        items: [
          { name: 'Egyptian Breakfast (Ful & Falafel)', qty: 1, price: 180 },
          { name: 'Fresh Pressed Mango Juice', qty: 2, price: 90 }
        ],
        subtotal: 360,
        deliveryFee: 30,
        total: 390,
        status: 'picked_up',
        placedTime: '01:05 PM',
        estimatedDelivery: '01:38 PM',
        deliveryAddress: 'Lighthouse Sea View Palapa #4, Dahab'
      });
      itinerary.setSavedItems(['rec-blue-hole', 'rec-ali-baba', 'near-ralphs']);
      ui.showToast('Demo simulation activated for testing');
    },
    []
  );

  const resetToAnonymousState = useCallback(() => {
    auth.signOut().catch(() => {});
    itinerary.setProfile(ANONYMOUS_PROFILE);
    itinerary.setTripDays(AHMED_TRIP_DAYS);
    commerce.setBookings([]);
    commerce.setLedgerEntries([]);
    commerce.setTransferTracking(DEFAULT_ANONYMOUS_TRANSFER);
    itinerary.setActiveFoodOrder(null);
    itinerary.setSavedItems([]);
    ui.setJourneyStage('discover');
    ui.setActivePersonaMode('PRE_TRIP');
    ui.showToast('تمت إعادة الضبط للوضع العام المجهول.');
  }, []);

  /**
   * Derived once, here, from the traveler's real trip and bookings. The
   * homepage keeps its own composition logic on top of this, but no longer
   * owns the only copy of it.
   */
  const lifecycle = useMemo<TravelerLifecycleSnapshot>(
    () =>
      deriveTravelerLifecycle({
        journeyStage: ui.journeyStage,
        profile: itinerary.profile,
        tripDays: itinerary.tripDays,
        bookings: commerce.bookings,
        transferTracking: commerce.transferTracking,
        travelerContext,
        isAuthenticated: auth.isSignedIn
      }),
    [
      ui.journeyStage,
      itinerary.profile,
      itinerary.tripDays,
      commerce.bookings,
      commerce.transferTracking,
      travelerContext,
      auth.isSignedIn
    ]
  );

  const value: TripContextType = useMemo(
    () => ({
      // UI & Navigation
      currentRoute: ui.currentRoute,
      setCurrentRoute: ui.setCurrentRoute,
      selectedDayId: ui.selectedDayId,
      setSelectedDayId: ui.setSelectedDayId,
      selectedActivityId: ui.selectedActivityId,
      setSelectedActivityId: ui.setSelectedActivityId,
      selectedBookingId: ui.selectedBookingId,
      setSelectedBookingId: ui.setSelectedBookingId,
      selectedProgramSlug: ui.selectedProgramSlug,
      setSelectedProgramSlug: ui.setSelectedProgramSlug,
      selectedExperienceSlug: ui.selectedExperienceSlug,
      selectedHotelSlug: ui.selectedHotelSlug,
      selectedRentalSlug: ui.selectedRentalSlug,
      selectedVenueSlug: ui.selectedVenueSlug,
      setSelectedVenueSlug: ui.setSelectedVenueSlug,
      selectedSkuId: ui.selectedSkuId,
      currentParams: ui.currentParams,
      goBack: ui.goBack,
      canGoBack: ui.canGoBack,
      lifecycle,
      setSelectedExperienceSlug: ui.setSelectedExperienceSlug,
      journeyStage: ui.journeyStage,
      setJourneyStage: ui.setJourneyStage,
      isEasyMode: ui.isEasyMode,
      setIsEasyMode: ui.setIsEasyMode,
      toggleEasyMode: ui.toggleEasyMode,
      toasts: ui.toasts,
      showToast: ui.showToast,
      navigateTo: ui.navigateTo,
      activeDayGiPrompt: ui.activeDayGiPrompt,
      setActiveDayGiPrompt: ui.setActiveDayGiPrompt,
      openDayGiWithPrompt: ui.openDayGiWithPrompt,
      activePersonaMode: ui.activePersonaMode,
      setActivePersonaMode: ui.setActivePersonaMode,

      // Itinerary & Profile
      profile: itinerary.profile,
      setProfile: itinerary.setProfile,
      updateProfile: itinerary.updateProfile,
      tripDays: itinerary.tripDays,
      setTripDays: itinerary.setTripDays,
      addActivityToDay: itinerary.addActivityToDay,
      removeActivityFromDay: itinerary.removeActivityFromDay,
      updateActivityInDay: itinerary.updateActivityInDay,
      shiftActivityBetweenDays: itinerary.shiftActivityBetweenDays,
      activeFoodOrder: itinerary.activeFoodOrder,
      setActiveFoodOrder: itinerary.setActiveFoodOrder,
      savedItems: itinerary.savedItems,
      setSavedItems: itinerary.setSavedItems,
      toggleSaveItem: itinerary.toggleSaveItem,

      // Commerce
      bookings: commerce.bookings,
      setBookings: commerce.setBookings,
      activeTrip: commerce.activeTrip,
      activeTripItems: commerce.activeTripItems,
      allTrips: commerce.allTrips,
      isTripLoading: commerce.isTripLoading,
      tripLoadError: commerce.tripLoadError,
      reloadTrip: commerce.reloadTrip,
      openTrip: commerce.openTrip,
      recordBooking: commerce.recordBooking,
      ledgerEntries: commerce.ledgerEntries,
      recordLedgerEntry: commerce.recordLedgerEntry,
      transferTracking: commerce.transferTracking,
      setTransferTracking: commerce.setTransferTracking,

      // Intelligence & Catalog
      authoritativeSuppliers: intelligence.authoritativeSuppliers,
      setAuthoritativeSuppliers: intelligence.setAuthoritativeSuppliers,
      activeSupplierId: intelligence.activeSupplierId,
      setActiveSupplierId: intelligence.setActiveSupplierId,
      pricingDecisions: intelligence.pricingDecisions,
      setPricingDecisions: intelligence.setPricingDecisions,
      contentBridges: intelligence.contentBridges,
      setContentBridges: intelligence.setContentBridges,
      opportunities: intelligence.opportunities,
      setOpportunities: intelligence.setOpportunities,
      featureRegister: intelligence.featureRegister,
      setFeatureRegister: intelligence.setFeatureRegister,
      promoteCandidateToSupplierOS: intelligence.promoteCandidateToSupplierOS,
      approvePricingDecision: intelligence.approvePricingDecision,
      adoptContentBridge: intelligence.adoptContentBridge,
      decideOpportunity: intelligence.decideOpportunity,
      updateOpportunityHypothesis: intelligence.updateOpportunityHypothesis,
      recordOpportunityOutcome: intelligence.recordOpportunityOutcome,
      addOpportunity: intelligence.addOpportunity,

      // Auth & Identity
      user: auth.user,
      sessionUser: auth.sessionUser,
      isSignedIn: auth.isSignedIn,
      isFederatedSignInAvailable: auth.isFederatedSignInAvailable,
      arePaymentsSimulated: auth.arePaymentsSimulated,
      authRole: auth.authRole,
      isAuthLoading: auth.isAuthLoading,
      intendedRoute: auth.intendedRoute,
      setIntendedRoute: auth.setIntendedRoute,
      signInWithGoogle: auth.signInWithGoogle,
      signInWithEmail: auth.signInWithEmail,
      signInWithPassword: auth.signInWithPassword,
      registerWithPassword: auth.registerWithPassword,
      registerWithEmail: auth.registerWithEmail,
      sendResetPasswordEmail: auth.sendResetPasswordEmail,
      signOut: auth.signOut,
      isCloudSynced: auth.isCloudSynced,

      // Trip OS
      tripBrief: tripOs.tripBrief,
      setTripBrief: tripOs.setTripBrief,
      updateTripBrief: tripOs.updateTripBrief,
      tripFit: tripOs.tripFit,
      setTripFit: tripOs.setTripFit,
      tradeOffOptions: tripOs.tradeOffOptions,
      setTradeOffOptions: tripOs.setTradeOffOptions,
      selectTradeOffOption: tripOs.selectTradeOffOption,
      dayIntelligence: tripOs.dayIntelligence,
      setDayIntelligence: tripOs.setDayIntelligence,
      tripHealth: tripOs.tripHealth,
      setTripHealth: tripOs.setTripHealth,
      resolveTripConflict: tripOs.resolveTripConflict,
      tripReadiness: tripOs.tripReadiness,
      setTripReadiness: tripOs.setTripReadiness,
      toggleReadinessItem: tripOs.toggleReadinessItem,
      budgetBreakdown: tripOs.budgetBreakdown,
      setBudgetBreakdown: tripOs.setBudgetBreakdown,
      applyBudgetOptimization: tripOs.applyBudgetOptimization,
      planVariants: tripOs.planVariants,
      selectedPlanVariantId: tripOs.selectedPlanVariantId,
      selectPlanVariant: tripOs.selectPlanVariant,
      applyImprovementAction: tripOs.applyImprovementAction,

      // Single Unified Traveler & Actions
      travelerContext,
      nextBestActions,
      goldenJourneys: GOLDEN_JOURNEYS_SUITE,
      trackJourneyEvent,
      loadDemoSimulation,
      resetToAnonymousState
    }),
    [
      ui,
      auth,
      commerce,
      intelligence,
      tripOs,
      itinerary,
      travelerContext,
      nextBestActions,
      lifecycle,
      trackJourneyEvent,
      loadDemoSimulation,
      resetToAnonymousState
    ]
  );

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
};

export const useTrip = () => {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip must be used within a TripProvider (nested in AppStateProvider)');
  }
  return context;
};
