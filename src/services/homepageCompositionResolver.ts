import {
  JourneyStage,
  TravelerProfile,
  TimelineDay,
  ConfirmedBookingItem,
  TransferTrackingRecord
} from '../types';
import { SingleTravelerContext, NextBestAction } from '../types/travelerContext';
import {
  TravelerLifecyclePhase,
  TravelerLifecycleSnapshot,
  deriveTravelerLifecycle
} from './travelerLifecycleResolver';

export type TravelerAccessContext =
  | 'PUBLIC_ANONYMOUS'
  | 'AUTHENTICATED_NO_TRIP'
  | 'AUTHENTICATED_DRAFT'
  | 'AUTHENTICATED_BOOKED'
  | 'AUTHENTICATED_ACTIVE_TRIP'
  | 'AUTHENTICATED_COMPLETED_TRIP';

export function deriveTravelerAccessContext(params: {
  isAuthenticated: boolean;
  bookingsCount: number;
  tripDaysCount: number;
  lifecyclePhase: TravelerLifecyclePhase;
}): TravelerAccessContext {
  const { isAuthenticated, bookingsCount, tripDaysCount, lifecyclePhase } = params;

  if (!isAuthenticated) {
    return 'PUBLIC_ANONYMOUS';
  }
  if (lifecyclePhase === 'POST_TRIP') {
    return 'AUTHENTICATED_COMPLETED_TRIP';
  }
  if (
    lifecyclePhase === 'IN_TRANSIT' ||
    lifecyclePhase === 'ARRIVAL' ||
    lifecyclePhase === 'IN_DAHAB' ||
    lifecyclePhase === 'ACTIVE_TRIP' ||
    lifecyclePhase === 'DISRUPTED' ||
    lifecyclePhase === 'DEPARTURE'
  ) {
    return 'AUTHENTICATED_ACTIVE_TRIP';
  }
  if (bookingsCount > 0) {
    return 'AUTHENTICATED_BOOKED';
  }
  if (tripDaysCount > 0) {
    return 'AUTHENTICATED_DRAFT';
  }
  return 'AUTHENTICATED_NO_TRIP';
}

export type HomepageMode =
  | 'PRE_BOOKING'
  | 'PRE_TRIP'
  | 'IN_TRANSIT'
  | 'ARRIVAL'
  | 'IN_DAHAB'
  | 'ACTIVE_ACTIVITY'
  | 'POST_ACTIVITY'
  | 'DISRUPTED'
  | 'DEPARTURE'
  | 'POST_TRIP'
  // Legacy aliases supported for backwards compatibility
  | 'DISCOVERY'
  | 'PLANNING'
  | 'PREVIEW'
  | 'PREPARING'
  | 'IN_DESTINATION'
  | 'SPONTANEOUS'
  | 'FOOD'
  | 'RECOVERY'
  | 'HELP';

export interface SectionEligibility {
  id: string;
  title: string;
  titleAr: string;
  priority: number; // Higher is earlier
  renderState: 'VISIBLE' | 'CONDITIONAL' | 'DEFERRED' | 'HIDDEN';
  hideReason?: string;
  isPrimary: boolean;
  isSecondary: boolean;
  isOptional: boolean;
  dataDependencies: string[];
}

export interface HomepageCompositionResult {
  mode: HomepageMode;
  modeLabel: string;
  modeLabelAr: string;
  accessContext: TravelerAccessContext;
  lifecycle: TravelerLifecycleSnapshot;
  primarySectionId: string;
  visibleSectionIds: string[];
  budgetApplied: {
    maxPrimary: number;
    maxSecondary: number;
    renderedCount: number;
  };
  flags: {
    showHero: boolean;
    showTripEntry: boolean;
    showRadar: boolean;
    showWhatNow: boolean;
    showCompanionDeck: boolean;
    showStories: boolean;
    showGallery: boolean;
    showSpatialMap: boolean;
    showAiAssistant: boolean;
    showQuickServices: boolean;
    showPreArrivalPrep: boolean;
    showEarlyArrivalHub: boolean;
    showRecoverySpotlight: boolean;
    showDepartureHub: boolean;
    showPostTripHub: boolean;
    showActiveActivityCockpit: boolean;
    showTransitTracker: boolean;
  };
  sectionMatrix: SectionEligibility[];
}

export function resolveHomepageComposition(params: {
  journeyStage: JourneyStage;
  profile?: TravelerProfile;
  tripDays?: TimelineDay[];
  bookings?: ConfirmedBookingItem[];
  transferTracking?: TransferTrackingRecord;
  travelerContext?: SingleTravelerContext;
  nextBestActions?: NextBestAction[];
  hasDisruption?: boolean;
  isAuthenticated?: boolean;
}): HomepageCompositionResult {
  const {
    journeyStage,
    profile,
    tripDays = [],
    bookings = [],
    transferTracking,
    travelerContext,
    nextBestActions = [],
    hasDisruption = false,
    isAuthenticated = false
  } = params;

  // 1. Derive authoritative lifecycle snapshot
  const lifecycle = deriveTravelerLifecycle({
    journeyStage,
    profile,
    tripDays,
    bookings,
    transferTracking,
    travelerContext,
    hasDisruption,
    isAuthenticated
  });

  // 2. Derive Authoritative Access Context
  const accessContext = deriveTravelerAccessContext({
    isAuthenticated,
    bookingsCount: bookings.length,
    tripDaysCount: tripDays.length,
    lifecyclePhase: lifecycle.lifecyclePhase
  });

  // 3. Map Lifecycle Phase + JourneyStage to Composition Mode
  let mode: HomepageMode = 'PRE_BOOKING';

  if (accessContext === 'PUBLIC_ANONYMOUS') {
    mode = 'PRE_BOOKING';
  } else if (lifecycle.isDisrupted || journeyStage === 'recovery') {
    mode = 'DISRUPTED';
  } else if (lifecycle.lifecyclePhase === 'POST_TRIP' || journeyStage === 'post_trip') {
    mode = 'POST_TRIP';
  } else if (lifecycle.lifecyclePhase === 'DEPARTURE' || journeyStage === 'departure') {
    mode = 'DEPARTURE';
  } else if (lifecycle.lifecyclePhase === 'IN_TRANSIT') {
    mode = 'IN_TRANSIT';
  } else if (lifecycle.lifecyclePhase === 'ARRIVAL' || journeyStage === 'arrive') {
    mode = 'ARRIVAL';
  } else if (lifecycle.hasActiveActivity || lifecycle.lifecyclePhase === 'ACTIVE_TRIP') {
    mode = 'ACTIVE_ACTIVITY';
  } else if (lifecycle.hasRecentFinishedActivity || journeyStage === 'spontaneous') {
    mode = 'POST_ACTIVITY';
  } else if (lifecycle.lifecyclePhase === 'IN_DAHAB' || journeyStage === 'experience' || journeyStage === 'food' || journeyStage === 'help') {
    mode = 'IN_DAHAB';
  } else if (lifecycle.lifecyclePhase === 'PRE_TRIP' || journeyStage === 'prepare') {
    mode = 'PRE_TRIP';
  } else {
    mode = 'PRE_BOOKING';
  }

  // 3. Define all candidate sections with initial rules
  const allSections: SectionEligibility[] = [
    {
      id: 'cinematic-hero',
      title: 'Cinematic Story Hero',
      titleAr: 'الواجهة السينمائية الرئيسية',
      priority: 100,
      renderState: mode === 'PRE_BOOKING' && journeyStage === 'discover' ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'PRE_BOOKING' ? 'Suppressed post-booking to prioritize operational trip readiness.' : undefined,
      isPrimary: mode === 'PRE_BOOKING' && journeyStage === 'discover',
      isSecondary: false,
      isOptional: false,
      dataDependencies: ['hero_video', 'curated_tracks']
    },
    {
      id: 'trip-entry',
      title: 'Trip Entry & Track Selector',
      titleAr: 'بوابة اختيار المسار وبناء الرحلة',
      priority: 95,
      renderState: mode === 'PRE_BOOKING' ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'PRE_BOOKING' ? 'Trip already booked or active; replaced by trip cockpit.' : undefined,
      isPrimary: mode === 'PRE_BOOKING' && journeyStage !== 'discover',
      isSecondary: mode === 'PRE_BOOKING' && journeyStage === 'discover',
      isOptional: false,
      dataDependencies: ['ready_trips', 'custom_tracks']
    },
    {
      id: 'pre-arrival-prep',
      title: 'Pre-Arrival Preparation & Packing',
      titleAr: 'تجهيزات ما قبل الوصول والحقائب',
      priority: 90,
      renderState: mode === 'PRE_TRIP' ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'PRE_TRIP' ? 'Relevant only prior to departure.' : undefined,
      isPrimary: mode === 'PRE_TRIP',
      isSecondary: false,
      isOptional: false,
      dataDependencies: ['packing_list', 'transfer_details', 'checkin_time']
    },
    {
      id: 'early-arrival-hub',
      title: 'Arrival & First 2 Hours Hub',
      titleAr: 'مركز الوصول وأول ساعتين بدهب',
      priority: 90,
      renderState: mode === 'ARRIVAL' ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'ARRIVAL' ? 'Only active during arrival window.' : undefined,
      isPrimary: mode === 'ARRIVAL',
      isSecondary: false,
      isOptional: false,
      dataDependencies: ['luggage_drop', 'first_meal', 'hotel_checkin']
    },
    {
      id: 'what-now',
      title: 'What Should I Do Now (Time-Context Recs)',
      titleAr: 'اقتراحات اللحظة الحالية حسب الوقت',
      priority: 85,
      renderState: (mode === 'IN_DAHAB' || mode === 'POST_ACTIVITY' || mode === 'ARRIVAL') ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode === 'PRE_BOOKING' || mode === 'PRE_TRIP' ? 'Requires traveler to be physically in destination.' : undefined,
      isPrimary: mode === 'IN_DAHAB' || mode === 'POST_ACTIVITY',
      isSecondary: mode === 'ARRIVAL',
      isOptional: false,
      dataDependencies: ['current_time', 'local_spots', 'free_window']
    },
    {
      id: 'week-companion',
      title: 'Dahab 7-Day Week Companion & Itinerary',
      titleAr: 'المرافق اليومي وجدول الـ ٧ أيام',
      priority: 80,
      renderState: (mode === 'IN_DAHAB' || mode === 'PRE_TRIP' || mode === 'ACTIVE_ACTIVITY') ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode === 'PRE_BOOKING' ? 'No active trip itinerary confirmed.' : undefined,
      isPrimary: false,
      isSecondary: true,
      isOptional: false,
      dataDependencies: ['trip_days', 'confirmed_bookings']
    },
    {
      id: 'sinai-radar',
      title: 'Sinai Marine & Weather Radar',
      titleAr: 'رادار الطقس والبحر والرياح بسيناء',
      priority: 75,
      renderState: mode === 'POST_TRIP' ? 'HIDDEN' : 'VISIBLE',
      hideReason: mode === 'POST_TRIP' ? 'Trip finished, marine radar no longer needed.' : undefined,
      isPrimary: false,
      isSecondary: true,
      isOptional: true,
      dataDependencies: ['wind_speed', 'tide_state', 'visibility']
    },
    {
      id: 'spatial-map',
      title: 'Dahab Spatial Context Map',
      titleAr: 'خريطة مناطق وتضاريس دهب التفاعلية',
      priority: 70,
      renderState: (mode === 'PRE_BOOKING' || mode === 'IN_DAHAB' || mode === 'POST_ACTIVITY') ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode === 'DISRUPTED' || mode === 'POST_TRIP' ? 'Suppressed to prioritize resolution actions.' : undefined,
      isPrimary: false,
      isSecondary: true,
      isOptional: true,
      dataDependencies: ['dahab_zones', 'poi_coords']
    },
    {
      id: 'curated-stories',
      title: 'Curated Stories & Local Culture',
      titleAr: 'قصص وتجارب أهل دهب الملهمة',
      priority: 65,
      renderState: mode === 'PRE_BOOKING' ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'PRE_BOOKING' ? 'Suppressed to avoid distraction during live travel.' : undefined,
      isPrimary: false,
      isSecondary: true,
      isOptional: true,
      dataDependencies: ['editorial_articles', 'bedouin_guides']
    },
    {
      id: 'gallery',
      title: 'Scenic Photography Archive & Memories',
      titleAr: 'معرض الصور الطبيعية وألبوم الذكريات',
      priority: 60,
      renderState: (mode === 'PRE_BOOKING' || mode === 'POST_TRIP') ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'PRE_BOOKING' && mode !== 'POST_TRIP' ? 'Suppressed during active travel operations.' : undefined,
      isPrimary: false,
      isSecondary: true,
      isOptional: true,
      dataDependencies: ['photo_archive', 'trip_badges']
    },
    {
      id: 'ai-assistant',
      title: 'Embedded Sinai Travel Assistant',
      titleAr: 'المساعد الذكي لرحلات سيناء',
      priority: 55,
      renderState: (mode === 'PRE_BOOKING' || mode === 'IN_DAHAB' || mode === 'POST_TRIP' || journeyStage === 'help') ? 'VISIBLE' : 'HIDDEN',
      hideReason: undefined,
      isPrimary: false,
      isSecondary: true,
      isOptional: true,
      dataDependencies: ['rag_knowledge', 'traveler_profile']
    },
    {
      id: 'recovery-spotlight',
      title: 'Trip Disruption & Re-plan Spotlight',
      titleAr: 'مركز تعديل الرحلة وتغيير المواعيد',
      priority: 100,
      renderState: mode === 'DISRUPTED' ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'DISRUPTED' ? 'No operational disruption detected.' : undefined,
      isPrimary: mode === 'DISRUPTED',
      isSecondary: false,
      isOptional: false,
      dataDependencies: ['disruption_reason', 'alternative_slots', 'price_delta']
    },
    {
      id: 'departure-hub',
      title: 'Departure Day & Transfer Hub',
      titleAr: 'مركز يوم المغادرة وتنسيق الانتقالات',
      priority: 100,
      renderState: mode === 'DEPARTURE' ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'DEPARTURE' ? 'Active only on departure day.' : undefined,
      isPrimary: mode === 'DEPARTURE',
      isSecondary: false,
      isOptional: false,
      dataDependencies: ['checkout_time', 'airport_transfer', 'boarding_pass']
    },
    {
      id: 'post-trip-hub',
      title: 'Post-Trip Memories & Review Hub',
      titleAr: 'مركز ذكريات وتقييم الرحلة',
      priority: 100,
      renderState: mode === 'POST_TRIP' ? 'VISIBLE' : 'HIDDEN',
      hideReason: mode !== 'POST_TRIP' ? 'Active only after trip completion.' : undefined,
      isPrimary: mode === 'POST_TRIP',
      isSecondary: false,
      isOptional: false,
      dataDependencies: ['traveler_badges', 'invoice_receipt', 'trip_summary']
    },
    {
      id: 'quick-services',
      title: 'Quick Actions & Emergency Concierge',
      titleAr: 'الخدمات السريعة وخطوط الطوارئ',
      priority: 50,
      renderState: mode === 'POST_TRIP' ? 'HIDDEN' : 'VISIBLE',
      hideReason: mode === 'POST_TRIP' ? 'Not needed post-trip.' : undefined,
      isPrimary: false,
      isSecondary: true,
      isOptional: true,
      dataDependencies: ['emergency_contacts', 'concierge_tools']
    }
  ];

  // 4. Compute Content Budget (1 Primary, 2-4 Secondary, 1 Next Best Action)
  const visibleSections = allSections
    .filter(s => s.renderState === 'VISIBLE')
    .sort((a, b) => b.priority - a.priority);

  const primarySection = visibleSections.find(s => s.isPrimary) || visibleSections[0];
  const primarySectionId = primarySection ? primarySection.id : 'trip-entry';

  // Extract secondary sections up to budget limit (max 4)
  const maxSecondary = (mode === 'DISRUPTED' || mode === 'DEPARTURE') ? 2 : 4;
  const secondarySections = visibleSections
    .filter(s => s.id !== primarySectionId)
    .slice(0, maxSecondary);

  const finalVisibleIds = [primarySectionId, ...secondarySections.map(s => s.id)];

  // Deduplication check: NextBestAction Banner holds the canonical urgent action;
  // Secondary cards do not duplicate the exact same prompt.

  // 5. Build Boolean Rendering Flags
  const flags = {
    showHero: finalVisibleIds.includes('cinematic-hero'),
    showTripEntry: finalVisibleIds.includes('trip-entry'),
    showPreArrivalPrep: finalVisibleIds.includes('pre-arrival-prep'),
    showEarlyArrivalHub: finalVisibleIds.includes('early-arrival-hub'),
    showWhatNow: finalVisibleIds.includes('what-now'),
    showCompanionDeck: finalVisibleIds.includes('week-companion'),
    showRadar: finalVisibleIds.includes('sinai-radar'),
    showSpatialMap: finalVisibleIds.includes('spatial-map'),
    showStories: finalVisibleIds.includes('curated-stories'),
    showGallery: finalVisibleIds.includes('gallery'),
    showAiAssistant: finalVisibleIds.includes('ai-assistant'),
    showRecoverySpotlight: finalVisibleIds.includes('recovery-spotlight'),
    showDepartureHub: finalVisibleIds.includes('departure-hub'),
    showPostTripHub: finalVisibleIds.includes('post-trip-hub'),
    showQuickServices: finalVisibleIds.includes('quick-services'),
    showActiveActivityCockpit: mode === 'ACTIVE_ACTIVITY',
    showTransitTracker: mode === 'IN_TRANSIT'
  };

  const modeLabels: Record<HomepageMode, { en: string; ar: string }> = {
    PRE_BOOKING: { en: 'Plan Your Dahab', ar: 'خطط رحلتك إلى دهب' },
    PRE_TRIP: { en: 'Trip Preparation', ar: 'تجهيزات قبل السفر' },
    IN_TRANSIT: { en: "You're On Your Way", ar: 'أنت في الطريق لدهب' },
    ARRIVAL: { en: 'Welcome to Dahab', ar: 'أهلاً بك في دهب' },
    IN_DAHAB: { en: 'Dahab Live OS', ar: 'المرافق المباشر في دهب' },
    ACTIVE_ACTIVITY: { en: 'Live Activity Cockpit', ar: 'أثناء النشاط الحالي' },
    POST_ACTIVITY: { en: 'Next 2 Hours', ar: 'ساعتين روقان وفضا' },
    DISRUPTED: { en: 'Trip Disruption Resolution', ar: 'تعديل وحل طارئ للرحلة' },
    DEPARTURE: { en: 'Departure Day Hub', ar: 'يوم السفر والمغادرة' },
    POST_TRIP: { en: 'Memories & Review', ar: 'ذكريات وتقييم الرحلة' },
    // Aliases
    DISCOVERY: { en: 'Discover Dahab', ar: 'استكشاف دهب' },
    PLANNING: { en: 'Trip Planning', ar: 'تخطيط الرحلة' },
    PREVIEW: { en: 'Itinerary Preview', ar: 'معاينة البرنامج' },
    PREPARING: { en: 'Pre-Arrival Briefing', ar: 'تجهيزات قبل السفر' },
    IN_DESTINATION: { en: 'Dahab Live Companion', ar: 'المرافق المباشر في دهب' },
    SPONTANEOUS: { en: 'Spontaneous 2 Hours', ar: 'ساعتين روقان وفضا' },
    FOOD: { en: 'Food & Beachside Dining', ar: 'أكل وقعدات البحر' },
    RECOVERY: { en: 'Change & Recovery', ar: 'إعادة جدولة وتعديل' },
    HELP: { en: '24/7 Support & Safety', ar: 'مساعدة وطوارئ ٢٤ ساعة' }
  };

  return {
    mode,
    modeLabel: modeLabels[mode]?.en || 'Dahab Travel OS',
    modeLabelAr: modeLabels[mode]?.ar || 'نظام دهب للرحلات',
    accessContext,
    lifecycle,
    primarySectionId,
    visibleSectionIds: finalVisibleIds,
    budgetApplied: {
      maxPrimary: 1,
      maxSecondary,
      renderedCount: finalVisibleIds.length
    },
    flags,
    sectionMatrix: allSections
  };
}
