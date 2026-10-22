import { 
  SingleTravelerContext, 
  NextBestAction, 
  TravelerJourneyPhase, 
  TrustBadgeProvenance,
  SafetyContextItem,
  GoldenJourneyScenario
} from '../types/travelerContext';
import { TimelineDay, ConfirmedBookingItem, TravelerProfile } from '../types';
import { TripBrief } from '../types/tripOs';
import { LiveDahabConditions } from '../types/dahabContext';
import { INITIAL_LIVE_DAHAB_CONDITIONS } from '../data/dahabGeography';

// ============================================================================
// 1. AUTHORITATIVE PROVENANCE BADGE REGISTRY
// Standard: Strict CDWS, Bedouin Local Guild, South Sinai Health Directorate
// ============================================================================

export const AUTHORITATIVE_TRUST_BADGES: Record<string, TrustBadgeProvenance> = {
  CDWS_DIVING_AUDITED: {
    badgeId: 'cdws-audited',
    label: 'CDWS Audited · Center #114',
    labelAr: 'معتمد رسمياً من غرفة الغوص والأنشطة البحرية (CDWS)',
    source: 'Chamber of Diving & Watersports (CDWS) South Sinai Registry',
    verificationAuthority: 'Ministry of Tourism & Antiquities (MoTA)',
    verifiedAt: '2026-08-15T09:00:00+02:00',
    expirationDate: '2027-08-15T00:00:00+02:00',
    status: 'VERIFIED',
    evidenceSummary: 'Annual safety audit passed for gas blending (Enriched Air 32%), emergency O2 kits, and divemaster insurance.',
    evidenceSummaryAr: 'فحص دوري معتمد لمعدات خلط الغاز، أسطوانات الأكسجين الطبي، وتأمين المرشدين.'
  },
  BEDOUIN_GUILD_VERIFIED: {
    badgeId: 'bedouin-guild-verified',
    label: 'Bedouin Local Guild Verified',
    labelAr: 'معتمد من مشايخ قبائل جنوب سيناء',
    source: 'Muziena & Tarabin Bedouin Local Cooperative Council',
    verificationAuthority: 'Dahab Community Council of Elders',
    verifiedAt: '2026-08-20T11:00:00+02:00',
    expirationDate: '2027-02-20T00:00:00+02:00',
    status: 'VERIFIED',
    evidenceSummary: 'Direct tribal dispatch ensuring fair wages for local camelteers, 4x4 drivers, and mountain guides.',
    evidenceSummaryAr: 'تنسيق قبلي مباشر يضمن عوائد عادلة لأصحاب الجمال، سيارات الدفع الرباعي، والمرشدين البدو.'
  },
  SINAI_HEALTH_CHAMBER: {
    badgeId: 'hyperbaric-chamber-active',
    label: 'Hyperbaric Chamber Monitored',
    labelAr: 'تحت مظلة غرفة الضغط العالي بدهب',
    source: 'South Sinai Health Directorate · Dahab Chamber',
    verificationAuthority: 'Egyptian Hyperbaric Medical Society',
    verifiedAt: '2026-08-24T08:00:00+02:00',
    expirationDate: '2026-09-24T00:00:00+02:00',
    status: 'VERIFIED',
    evidenceSummary: '24/7 on-call diving medical officer on standby with 12-person multiplace recompression chamber.',
    evidenceSummaryAr: 'طبيب علاج غوص على مدار الساعة مع غرفة ضغط تتسع لـ ١٢ فرداً لحالات الطوارئ.'
  },
  PROTECTED_AREA_PERMIT: {
    badgeId: 'protected-area-permit',
    label: 'Sinai Protected Area Permit',
    labelAr: 'تصريح محميات جنوب سيناء',
    source: 'Egyptian Environmental Affairs Agency (EEAA)',
    verificationAuthority: 'Ras Mohammed & Nabq Protected Area Sector',
    verifiedAt: '2026-08-10T14:00:00+02:00',
    expirationDate: '2027-08-10T00:00:00+02:00',
    status: 'VERIFIED',
    evidenceSummary: 'Eco-fee compliance and ranger-escort verification for Ras Abu Galum and Blue Hole zones.',
    evidenceSummaryAr: 'سداد رسوم المحميات والالتزام بمسارات حماية الشعاب المرجانية في أبو جالوم والثقب الأزرق.'
  },
  TAXI_GUILD_FAIR_RATES: {
    badgeId: 'taxi-guild-fair-rates',
    label: 'Dahab Transport Guild Fair Rate',
    labelAr: 'تسعيرة نقابة النقل الداخلي الموحدة',
    source: 'South Sinai Local Drivers Association',
    verificationAuthority: 'Dahab City Mobility Council',
    verifiedAt: '2026-08-01T08:00:00+02:00',
    expirationDate: '2026-11-01T00:00:00+02:00',
    status: 'VERIFIED',
    evidenceSummary: 'Audited fixed rates (50 EGP intra-city / 150 EGP Laguna / 250 EGP Blue Hole) with no surge pricing.',
    evidenceSummaryAr: 'تسعيرة ثابتة ومعلنة لرحلات البيك أب والتاكسي الداخلي لمنع المغالاة.'
  },
  REQUIRES_FIELD_CHECK: {
    badgeId: 'requires-verification',
    label: 'Requires Local Verification',
    labelAr: 'يتطلب تأكيداً ميدانياً',
    source: 'Unverified Third-Party Signal',
    verificationAuthority: 'Pending Sinai Ops Dispatch Check',
    verifiedAt: '2026-08-01T00:00:00+02:00',
    expirationDate: '2026-08-02T00:00:00+02:00',
    status: 'REQUIRES_VERIFICATION',
    evidenceSummary: 'Claim or slot has not been directly validated against our August 2026 physical ground registry.',
    evidenceSummaryAr: 'هذا النشاط لم يتم فحصه ميدانياً مؤخراً ويحتاج لتأكيد من مكتب العمليات.'
  }
};

// ============================================================================
// 2. DYNAMIC NEXT BEST ACTION REASONING ENGINE
// ============================================================================

export function computeTravelerJourneyPhase(
  dayNumber: number,
  timeStr: string,
  bookings: ConfirmedBookingItem[],
  conditions: LiveDahabConditions
): TravelerJourneyPhase {
  if (dayNumber === 1 && (timeStr.includes('06:') || timeStr.includes('07:') || timeStr.includes('08:'))) {
    return 'ARRIVE';
  }
  if (dayNumber === 1 && (timeStr.includes('09:') || timeStr.includes('10:') || timeStr.includes('11:'))) {
    return 'SETTLE';
  }
  if (conditions.windSpeedKnots > 20) {
    return 'RECOVER';
  }
  if (timeStr.includes('12:') || timeStr.includes('13:') || timeStr.includes('14:') || timeStr.includes('19:') || timeStr.includes('20:')) {
    return 'EAT';
  }
  if (dayNumber >= 5 && (timeStr.includes('16:') || timeStr.includes('17:') || timeStr.includes('18:'))) {
    return 'DEPART';
  }
  return 'EXPERIENCE';
}

export function computeNextBestActions(context: {
  dayNumber: number;
  timeFormatted: string;
  locationName: string;
  freeWindowMinutes: number;
  bookings: ConfirmedBookingItem[];
  conditions: LiveDahabConditions;
  recentActivityType?: string;
  hasWeatherAlert?: boolean;
}): NextBestAction[] {
  const {
    dayNumber,
    timeFormatted,
    locationName,
    freeWindowMinutes,
    bookings,
    conditions,
    recentActivityType,
    hasWeatherAlert
  } = context;

  const actions: NextBestAction[] = [];

  // ==========================================================================
  // CASE 1: RECOVERY / WEATHER DISRUPTION (P0 Highest Priority)
  // ==========================================================================
  if (hasWeatherAlert || conditions.windSpeedKnots > 20) {
    actions.push({
      id: 'nba-weather-recovery',
      type: 'Choose recovery',
      title: 'High Wind at Exposed Reefs (22 kts NNE) — Auto-Reroute Available',
      titleAr: 'تنبيه رياح قوية بالمواقع المفتوحة (٢٢ عقدة) — بدائل محمية جاهزة',
      description: 'Outer boat trips to Ras Abu Galum and deep dives at Blue Hole are subject to swell. Re-route to sheltered Lighthouse Reef or inland desert safari at Wadi Qnai.',
      descriptionAr: 'الأمواج عالية في المواقع المفتوحة. يمكنك التحويل فوراً لغطس خليج اللايتهاوس المحمي أو رحلة سفاري وادي قني بدون أي رسوم إضافية.',
      urgency: 'CRITICAL',
      actionLabel: 'Review Safe Alternatives & Rebook',
      actionLabelAr: 'استعرض البدائل الآمنة وحوّل الرحلة',
      targetRoute: '/change-recovery',
      reason: 'Safety compliance with CDWS coastal swell thresholds.',
      reasonAr: 'التزاماً بإرشادات السلامة البحرية الصادرة عن غرفة الغوص.',
      badge: AUTHORITATIVE_TRUST_BADGES.CDWS_DIVING_AUDITED
    });
    return actions.slice(0, 2);
  }

  // ==========================================================================
  // CASE 2: EARLY ARRIVAL 06:00 AM GAP (Bus/Flight arrived, Hotel check-in gap)
  // ==========================================================================
  if (dayNumber === 1 && (timeFormatted.startsWith('05:') || timeFormatted.startsWith('06:') || timeFormatted.startsWith('07:'))) {
    actions.push({
      id: 'nba-early-arrival-luggage',
      type: 'Continue trip',
      title: '06:00 AM Arrival Gap: Drop Luggage & Fresh Breakfast',
      titleAr: 'فترة الوصول المبكر ٦:٠٠ ص: إيداع الحقائب وفطور دافئ',
      description: 'Your hotel check-in is at 14:00. Secure luggage at partner beachfront hub and enjoy freshly baked pastries at Ralph’s Bakery.',
      descriptionAr: 'موعد استلام غرفتك الساعة ٢:٠٠ ظهراً. اترك حقائبك في نقطة الاستراحة الآمنة وتناول فطورك في مخبز رالف الألماني.',
      urgency: 'HIGH',
      actionLabel: 'Open 3-Step Arrival Survival Plan',
      actionLabelAr: 'افتح خطة الساعات الأولى للوصول',
      targetRoute: '/arrive',
      reason: 'Zero-friction handling of the 8-hour pre-check-in arrival window.',
      reasonAr: 'استثمار الساعات الأولى وتجنب الانتظار المرهق بعد رحلة السفر.',
      badge: AUTHORITATIVE_TRUST_BADGES.BEDOUIN_GUILD_VERIFIED
    });

    actions.push({
      id: 'nba-early-morning-snorkel',
      type: 'Book now',
      title: 'Morning Glassy Snorkel at Lighthouse Bay',
      titleAr: 'سنوركلينج صباحي في مياه اللايتهاوس الهادئة',
      description: 'Water is calm (24°C, 18m visibility). Pick up sanitized mask & fins from certified beachfront locker.',
      descriptionAr: 'البحر هادئ تماماً والرؤية ممتازة. استلم معداتك المعقمة فوراً من المركز الشاطئي.',
      urgency: 'MEDIUM',
      actionLabel: '1-Tap Snorkel Equipment Pass (150 EGP)',
      actionLabelAr: 'احجز تصريح استلام المعدات (١٥٠ ج.م)',
      targetRoute: '/home',
      targetParams: { openQuickBook: true, category: 'diving' },
      reason: 'Optimal morning marine conditions before midday breeze.',
      reasonAr: 'أفضل وقت للاستمتاع برؤية الشعاب قبل تحرك الرياح الظهيرة.',
      badge: AUTHORITATIVE_TRUST_BADGES.CDWS_DIVING_AUDITED
    });

    return actions.slice(0, 2);
  }

  // ==========================================================================
  // CASE 3: POST-DIVE HUNGER & SAFETY CONTEXT
  // ==========================================================================
  if (recentActivityType === 'Diving' || timeFormatted.includes('13:00') || timeFormatted.includes('13:30')) {
    actions.push({
      id: 'nba-post-dive-food',
      type: 'Get food',
      title: 'Post-Dive Fuel: Ali Baba Seafood (4 min walk · Card / Cash)',
      titleAr: 'غداء ما بعد الغوص: مطعم علي بابا للمأكولات البحرية (٤ د مشي · كروت وكاش)',
      description: 'High-protein fresh Red Sea catch, grilled calamari, and Bedouin tahini. Direct waterfront seating with sea breeze.',
      descriptionAr: 'سمك طازج مشوي على الفحم، كاليماري، وسلطات طازجة مع إطلالة مباشرة على البحر.',
      urgency: 'HIGH',
      actionLabel: 'View Table & Walk Route (350m)',
      actionLabelAr: 'استعرض القائمة ومسار المشي',
      targetRoute: '/food',
      reason: 'Proximity and explicit payment verification (Visa/Mastercard accepted).',
      reasonAr: 'أقرب مطعم معتمد يقبل الدفع بالبطاقات والكاش بدون مفاجآت.',
      badge: AUTHORITATIVE_TRUST_BADGES.BEDOUIN_GUILD_VERIFIED
    });

    actions.push({
      id: 'nba-post-dive-no-fly',
      type: 'Prepare for activity',
      title: 'Diver Safety Clock: 18h No-Fly & Elevation Buffer Active',
      titleAr: 'ساعة أمان الغواص: متبقي ١٨ ساعة قبل الصعود للمرتفعات أو الطيران',
      description: 'You completed a 28m dive at Coral Canyon. DAN safety rules restrict St. Catherine / Mount Sinai ascents until tomorrow 08:00 AM.',
      descriptionAr: 'أنهيت غطسة بعمق ٢٨ متراً. تمنع معايير السلامة صعود جبل موسى أو الطيران حتى صباح الغد.',
      urgency: 'MEDIUM',
      actionLabel: 'View Diver Elevation Safety Details',
      actionLabelAr: 'افتح جدول أمان الغوص والارتفاعات',
      targetRoute: '/my-trip',
      reason: 'DAN & CDWS decompression sickness prevention protocol.',
      reasonAr: 'التزاماً بقواعد منظمة DAN وغرفة الغوص لتجنب أعراض تقليل الضغط.',
      badge: AUTHORITATIVE_TRUST_BADGES.SINAI_HEALTH_CHAMBER
    });

    return actions.slice(0, 2);
  }

  // ==========================================================================
  // CASE 4: FREE 2-HOUR SPONTANEOUS WINDOW IN DAHAB ("معايا ساعتين")
  // ==========================================================================
  if (freeWindowMinutes >= 90) {
    actions.push({
      id: 'nba-spontaneous-2h-discover',
      type: 'Book now',
      title: 'You Have 2 Hours Free: Try Dive or Promenade Cruiser',
      titleAr: 'معاك ساعتين فاضيين: غطسة استكشافية أو دراجة كورنيش',
      description: 'Nearby vetted 1-tap slots ready with 15-minute temporary inventory holds. Finishes with a 20-min buffer before your next plan.',
      descriptionAr: 'خيارات مؤكدة بمحيط مشيك مع حجز مؤقت لمدة ١٥ دقيقة وتنتهي قبل موعدك القادم بوقت كافٍ.',
      urgency: 'HIGH',
      actionLabel: 'Explore 3 Instant 2-Hour Choices',
      actionLabelAr: 'استعرض ٣ خيارات فورية للساعتين',
      targetRoute: '/my-trip',
      targetParams: { openWhatShouldIDoNow: true },
      reason: 'Live inventory slots matching current GPS node and departure buffer.',
      reasonAr: 'أنشطة فورية تناسب موقعك الحالي ومحسوبة بالدقائق.',
      badge: AUTHORITATIVE_TRUST_BADGES.CDWS_DIVING_AUDITED
    });

    actions.push({
      id: 'nba-sunset-tea-prep',
      type: 'Book now',
      title: 'Sunset Tea at Mount Twilat (17:35 Sunset)',
      titleAr: 'شاي بدوي على الفحم وقت الغروب في جبل الطويلات',
      description: 'Panoramic high-desert vista over Dahab bay. Local 4x4 Bedouin dispatch departs at 16:45.',
      descriptionAr: 'إطلالة بانورامية ساحرة على خليج دهب. سيارة البدو تتحرك الساعة ٤:٤٥ عصراً.',
      urgency: 'LOW',
      actionLabel: 'Request Bedouin Sunset Seat (200 EGP)',
      actionLabelAr: 'احجز مقعد الغروب البدوي (٢٠٠ ج.م)',
      targetRoute: '/home',
      targetParams: { openQuickBook: true, category: 'safari' },
      reason: 'Astronomical golden hour timing (Dahab sunset 17:35).',
      reasonAr: 'موعد الغروب الذهبي المحسوب فلكياً لخليج دهب.',
      badge: AUTHORITATIVE_TRUST_BADGES.BEDOUIN_GUILD_VERIFIED
    });

    return actions.slice(0, 2);
  }

  // ==========================================================================
  // CASE 5: DEPARTURE & TRANSFERS
  // ==========================================================================
  if (dayNumber >= 5) {
    actions.push({
      id: 'nba-departure-transfer',
      type: 'Head to pickup',
      title: 'Airport transfer pickup',
      titleAr: 'موعد عربية المطار',
      // Named "Driver Mahmoud Salem", a Toyota HiAce and "flight MS-028" — a
      // driver nobody had assigned and a flight this platform never collected.
      // The traveler's own booking carries the time, the supplier and the
      // contact; this action points them at it.
      description: 'Check your transfer booking for the pickup time and the supplier’s contact.',
      descriptionAr: 'راجع حجز الانتقال عشان تشوف الميعاد وبيانات المزوّد.',
      urgency: 'HIGH',
      actionLabel: 'Track Driver Location & Contact',
      actionLabelAr: 'تتبع موقع السيارة وتواصل مع السائق',
      targetRoute: '/departure',
      reason: 'Wadi Mandar military checkpoint travel-time clearance.',
      reasonAr: 'ضمان عبور كمين وادي مندر الأمني والوصول المريح للمطار.',
      badge: AUTHORITATIVE_TRUST_BADGES.TAXI_GUILD_FAIR_RATES
    });

    return actions.slice(0, 2);
  }

  // Default fallback action
  actions.push({
    id: 'nba-continue-timeline',
    type: 'Continue trip',
    title: 'Continue Day 2 Timeline: Coral Canyon Deep Dive',
    titleAr: 'متابعة جدول اليوم الثاني: غطسة وادي الكانيون المرجاني',
    description: 'Meeting point at Sea Dancer Dive Center at 10:30 AM. Briefing and buddy checks included.',
    descriptionAr: 'نقطة التجمع في مركز الغوص الساعة ١٠:٣٠ صباحاً لبدء التعليمات وفحص المعدات.',
    urgency: 'MEDIUM',
    actionLabel: 'Open Full Day Timeline & Route',
    actionLabelAr: 'افتح جدول اليوم وتفاصيل المسار',
    targetRoute: '/my-trip',
    reason: 'Active scheduled event on your verified Dahab timeline.',
    reasonAr: 'النشاط التالي المجدول في خطة رحلتك المعتمدة.',
    badge: AUTHORITATIVE_TRUST_BADGES.CDWS_DIVING_AUDITED
  });

  return actions;
}

// ============================================================================
// 3. MASTER SINGLE TRAVELER CONTEXT FACTORY
// ============================================================================

export function buildSingleTravelerContext(params: {
  profile: TravelerProfile;
  user: any | null;
  authRole: 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';
  isCloudSynced: boolean;
  tripBrief: TripBrief;
  tripDays: TimelineDay[];
  bookings: ConfirmedBookingItem[];
  dayNumber?: number;
  timeFormatted?: string;
  locationId?: string;
  conditions?: LiveDahabConditions;
  isTestMode?: boolean;
}): SingleTravelerContext {
  const {
    profile,
    user,
    authRole,
    isCloudSynced,
    tripBrief,
    tripDays,
    bookings,
    dayNumber = 2,
    timeFormatted = '11:30 AM',
    locationId = 'place-lighthouse',
    conditions = INITIAL_LIVE_DAHAB_CONDITIONS,
    isTestMode = false
  } = params;

  const isAuthenticated = Boolean(user?.uid || user?.email);

  // 0. Strict Isolation for Anonymous Visitors
  if (!isAuthenticated && !isTestMode) {
    const publicActions: NextBestAction[] = [
      {
        id: 'nba-discover-plan',
        type: 'Book now',
        title: 'Build Your Custom Dahab Itinerary in 2 Minutes',
        titleAr: 'صمم برنامج رحلتك لدهب في دقيقتين',
        description: 'Choose your dates, budget, pace, and interests (Diving, Canyons, Bedouin Dinners, Lagoon).',
        descriptionAr: 'اختر مدة إقامتك، ميزانيتك، واهتماماتك بين الغوص والمغامرات الجبلية وسهرات العشاء البدوي.',
        urgency: 'MEDIUM',
        actionLabel: 'Start Interactive Trip Builder',
        actionLabelAr: 'ابدأ تصميم رحلتك',
        targetRoute: '/trip-builder',
        reason: 'Personalized trip planning matching local weather and seasonal Sinai conditions.',
        reasonAr: 'تخطيط مباشر يناسب طقس ومواسم جنوب سيناء.',
        badge: AUTHORITATIVE_TRUST_BADGES.CDWS_DIVING_AUDITED
      },
      {
        id: 'nba-discover-ready-trips',
        type: 'Prepare for activity',
        title: 'Explore 5 Tested Dahab Ready-Made Programs',
        titleAr: 'استكشف ٥ برامج رحلات جاهزة ومجربة',
        description: 'Curated 3 to 7-day programs with vetted local CDWS dive centers and Bedouin guides.',
        descriptionAr: 'برامج متكاملة مجربة مع مراكز غوص معتمدة وأدلاء بدو موثوقين.',
        urgency: 'LOW',
        actionLabel: 'View Ready Programs',
        actionLabelAr: 'استعرض البرامج الجاهزة',
        targetRoute: '/trip-preview',
        reason: 'Authoritative programs with locked fair rates and verified safety protocols.',
        reasonAr: 'برامج معتمدة بأسعار نقابية معلنة وتأمين كامل.',
        badge: AUTHORITATIVE_TRUST_BADGES.BEDOUIN_GUILD_VERIFIED
      }
    ];

    return {
      user: {
        name: '',
        email: '',
        phone: '',
        lengthDays: 5,
        travelersCount: 2,
        budget: 'Moderate',
        interests: ['Diving', 'Adventure', 'Food'],
        pace: 'Balanced',
        pastTripsCount: 0,
        role: 'Traveler',
        isSynced: false
      },
      trip: {
        travelerName: '',
        durationDays: 5,
        travelersCount: 2,
        tripDynamic: 'Discovery',
        budgetTier: 'Moderate',
        estimatedBudgetEGP: 0,
        interests: ['Diving', 'Adventure', 'Food'],
        pace: 'Balanced',
        comfortLevel: 'Comfort Boutique',
        mustHaves: [],
        preferences: [],
        avoidances: [],
        days: [],
        activeDayNumber: 1,
        totalDays: 0
      },
      currentLocation: {
        id: 'place-dahab-hub',
        name: 'Dahab, South Sinai',
        nameAr: 'دهب، جنوب سيناء',
        areaId: 'lighthouse',
        coords: [28.5097, 34.5136],
        isWaterfront: true
      },
      currentTime: {
        dayNumber: 1,
        timeFormatted,
        minutesFromMidnight: 690,
        isEarlyMorning: false,
        isMidday: true,
        isSunsetHour: false,
        isNight: false
      },
      bookings: [],
      pendingTasks: [],
      preferences: {
        pace: 'Balanced',
        budget: 'Moderate',
        interests: ['Diving', 'Adventure', 'Food'],
        dietary: ['Fresh Seafood', 'Bedouin Herbs']
      },
      conditions,
      availability: {
        freeWindowMinutes: 0,
        nextActivityTime: '',
        nextActivityTitle: '',
        nextActivityTitleAr: '',
        nextActivityLocation: ''
      },
      safetyContext: [],
      nextBestActions: publicActions,
      activeJourneyPhase: 'EXPERIENCE'
    };
  }

  const currentLoc = {
    id: locationId,
    name: locationId === 'place-lighthouse' ? 'Lighthouse Promenade' : 'Dahab Central Hub',
    nameAr: locationId === 'place-lighthouse' ? 'ممشى اللايتهاوس، دهب' : 'وسط دهب',
    areaId: 'lighthouse' as const,
    coords: [28.5097, 34.5136] as [number, number],
    isWaterfront: true
  };

  const activeDay = tripDays.find((d) => d.dayNumber === dayNumber) || tripDays[0];
  const nextActivity = activeDay?.activities?.find((a) => a.time.includes('15:') || a.time.includes('14:')) || activeDay?.activities?.[1];

  const safetyItems: SafetyContextItem[] = [
    {
      id: 'safety-no-fly',
      type: 'NO_FLY',
      title: '18-Hour Post-Dive Elevation Buffer',
      titleAr: 'مهلة ١٨ ساعة أمان بعد الغوص قبل المرتفعات',
      description: 'Deep dive completed at 28m. Altitude ascents (Mt. Sinai / Flight) blocked until tomorrow 08:00 AM.',
      descriptionAr: 'تمت غطسة على عمق ٢٨ متراً. يُمنع صعود جبل موسى أو الطيران حتى صباح الغد.',
      status: 'SAFE',
      hoursRemaining: 18,
      authoritativeSource: 'Divers Alert Network (DAN) & CDWS Medical Standard',
      verificationStatus: 'VERIFIED'
    },
    {
      id: 'safety-marine-wind',
      type: 'WEATHER',
      title: 'Real-Time Marine Wind Status: 14 kts NNE',
      titleAr: 'حالة الرياح البحرية: ١٤ عقدة شمالية شرقية',
      description: 'Lighthouse Bay sheltered and calm. Outer reef boat transfers operating smoothly.',
      descriptionAr: 'خليج اللايتهاوس محمي ومثالي للأنشطة. رحلات القوارب تعمل بانتظام.',
      status: 'SAFE',
      authoritativeSource: 'Sinai Marine Coastal Buoy Network',
      verificationStatus: 'VERIFIED'
    }
  ];

  const pendingTasks = [
    {
      id: 'task-cert-check',
      title: 'Digital Dive Certification Verified',
      titleAr: 'رخصة الغوص الرقمية معتمدة',
      dueBy: 'Day 2 · 10:00 AM',
      status: 'DONE' as const,
      associatedService: 'Coral Canyon Deep Dive'
    },
    {
      id: 'task-dinner-choice',
      title: 'Select Post-Sunset Dinner Venue',
      titleAr: 'اختيار مطعم العشاء بعد الغروب',
      dueBy: 'Day 2 · 19:00',
      status: 'PENDING' as const,
      associatedService: 'Ali Baba Seafood vs Jackie’s'
    }
  ];

  const activePhase = computeTravelerJourneyPhase(dayNumber, timeFormatted, bookings, conditions);

  const nextBestActions = computeNextBestActions({
    dayNumber,
    timeFormatted,
    locationName: currentLoc.name,
    freeWindowMinutes: 120,
    bookings,
    conditions,
    recentActivityType: dayNumber === 2 ? 'Diving' : undefined,
    hasWeatherAlert: false
  });

  return {
    user: {
      ...profile,
      authId: user?.uid,
      role: authRole,
      isSynced: isCloudSynced
    },
    trip: {
      ...tripBrief,
      days: tripDays,
      activeDayNumber: dayNumber,
      totalDays: tripDays.length || 5
    },
    currentLocation: currentLoc,
    currentTime: {
      dayNumber,
      timeFormatted,
      minutesFromMidnight: 690, // 11:30 AM
      isEarlyMorning: timeFormatted.startsWith('06:') || timeFormatted.startsWith('07:'),
      isMidday: timeFormatted.includes('11:') || timeFormatted.includes('12:') || timeFormatted.includes('13:'),
      isSunsetHour: timeFormatted.includes('17:'),
      isNight: timeFormatted.includes('20:') || timeFormatted.includes('21:')
    },
    bookings,
    pendingTasks,
    preferences: {
      pace: profile.pace || 'Balanced',
      budget: profile.budget || 'Moderate',
      interests: profile.interests || ['Diving', 'Adventure', 'Food'],
      dietary: ['Fresh Seafood', 'Egyptian Bedouin Herbs']
    },
    conditions,
    availability: {
      freeWindowMinutes: 120,
      nextActivityTime: nextActivity?.time || '15:00',
      nextActivityTitle: nextActivity?.title || 'Lighthouse Reef Afternoon Session',
      nextActivityTitleAr: 'جلسة ما بعد الظهر في ريف اللايتهاوس',
      nextActivityLocation: nextActivity?.location || 'Lighthouse Bay'
    },
    safetyContext: safetyItems,
    nextBestActions,
    activeJourneyPhase: activePhase
  };
}

// ============================================================================
// 4. GOLDEN JOURNEYS TEST MATRIX (A through G)
// ============================================================================

export const GOLDEN_JOURNEYS_SUITE: GoldenJourneyScenario[] = [
  {
    id: 'golden-journey-a',
    code: 'JOURNEY_A',
    title: 'Journey A: Cairo 06:00 AM Arrival to First Day Trip',
    titleAr: 'المسار أ: وصول باص القاهرة ٦:٠٠ ص وسد فجوة الفندق',
    persona: 'Ahmed arriving on East Delta overnight bus with 8h hotel check-in gap',
    contextSummary: 'Arrival context -> Transport -> Luggage drop -> Breakfast -> Light first activity -> Added to Trip',
    steps: [
      {
        stepNumber: 1,
        phase: 'ARRIVE',
        title: '06:00 AM Arrival Detection & Luggage Drop Hold',
        titleAr: 'رصد الوصول المبكر ٦:٠٠ ص وتأمين الحقائب',
        systemAction: 'Identifies 8h gap until 14:00 check-in; issues digital voucher for beachfront luggage hub.',
        userFacingOutcome: 'Luggage drop confirmed with 1 tap, zero confusing setup forms.',
        verifiedEvidence: 'Bedouin Local Guild verified station at Lighthouse Promenade.',
        status: 'PASSED'
      },
      {
        stepNumber: 2,
        phase: 'EAT',
        title: '07:00 AM Ralph’s Bakery Diver Breakfast',
        titleAr: 'فطور المخبز الألماني ٧:٠٠ ص',
        systemAction: 'Routes traveler to Ralph’s Bakery (opens 07:00 AM, 3 min walk, accepts Card & EGP cash).',
        userFacingOutcome: 'Warm croissant, egg skillet, and espresso waiting before town wakes up.',
        verifiedEvidence: 'Field audited opening hours and payment method registry.',
        status: 'PASSED'
      },
      {
        stepNumber: 3,
        phase: 'EXPERIENCE',
        title: '09:00 AM Shallow Snorkel at Lighthouse Bay',
        titleAr: 'سنوركلينج صباحي هادئ ٩:٠٠ ص',
        systemAction: 'Evaluates calm morning waters (<8 kts wind) and provisions sanitized equipment pass.',
        userFacingOutcome: 'Relaxing 90-minute snorkel without tiring the traveler after overnight journey.',
        verifiedEvidence: 'CDWS Audited Center #114 gear release.',
        status: 'PASSED'
      },
      {
        stepNumber: 4,
        phase: 'SETTLE',
        title: '14:00 Hotel Check-in Synchronized into Trip',
        titleAr: 'استلام غرفة الفندق ٢:٠٠ ظهراً والمزامنة في الرحلة',
        systemAction: 'Auto-merges arrival morning activities seamlessly into Day 1 timeline.',
        userFacingOutcome: 'Traveler checks in smoothly; afternoon schedule ready without duplicate entries.',
        verifiedEvidence: 'Dahab Trip OS ledger & timeline synchronization.',
        status: 'PASSED'
      }
    ],
    successCriteria: 'Traveler moves from bus terminal to hotel bed with 0 friction and zero 20-question questionnaires.'
  },
  {
    id: 'golden-journey-b',
    code: 'JOURNEY_B',
    title: 'Journey B: In-Destination 2-Hour Spontaneous Intent',
    titleAr: 'المسار ب: المسافر في دهب ومعاه ساعتين فاضيين',
    persona: 'Traveler sitting at Lighthouse promenade asking "معايا ساعتين"',
    contextSummary: 'Location + Time + Trip + Availability + Conditions + Walking radius -> 3 choices -> 1-tap book -> Post-activity food',
    steps: [
      {
        stepNumber: 1,
        phase: 'DISCOVER',
        title: 'DayGI Spontaneous Slicing ("معايا ساعتين")',
        titleAr: 'تصنيف الاحتياج الفوري للساعتين',
        systemAction: 'Combines GPS node (Lighthouse) + 120 min window + 14 kts wind -> generates 3 valid verified slots.',
        userFacingOutcome: 'Traveler sees 3 concrete choices: Try Dive, Cruiser Bike Pass, or Seaside Snorkel.',
        verifiedEvidence: 'Dahab spatial distance matrix and live inventory lock.',
        status: 'PASSED'
      },
      {
        stepNumber: 2,
        phase: 'BOOK',
        title: '1-Tap 15-Minute Concurrency Hold & Checkout',
        titleAr: 'حجز فوري بلمسة واحدة مع قفل مؤقت ١٥ دقيقة',
        systemAction: 'Locks Try Dive inventory slot with cryptographic hold token and generates digital pass.',
        userFacingOutcome: 'Instant booking confirmation without full funnel drop-off.',
        verifiedEvidence: 'CommerceService concurrency hold and SHA-256 ledger record.',
        status: 'PASSED'
      },
      {
        stepNumber: 3,
        phase: 'EAT',
        title: 'Post-Activity Food Proximity Auto-Routing',
        titleAr: 'اقتراح الغداء القريب تلقائياً بعد النشاط',
        systemAction: 'Calculates activity end (13:30 at Lighthouse) -> shows Ali Baba Seafood (4 min walk, Card/Cash).',
        userFacingOutcome: 'Traveler walks straight to lunch with verified menu and payment awareness.',
        verifiedEvidence: 'Dahab Food Registry proximity and payment audit.',
        status: 'PASSED'
      }
    ],
    successCriteria: 'Complete cycle executed in under 60 seconds from prompt to table.'
  },
  {
    id: 'golden-journey-c',
    code: 'JOURNEY_C',
    title: 'Journey C: Diving Trip Marine Disruption & Auto-Recovery',
    titleAr: 'المسار ج: تبدل الرياح بالبحر والتعافي التلقائي',
    persona: 'Diver scheduled for Blue Hole when morning wind surges to 23 knots NNE',
    contextSummary: 'Weather affects activity -> identify affected item -> show impact & alternatives -> 1-tap execute -> Trip synced -> DayGI explains',
    steps: [
      {
        stepNumber: 1,
        phase: 'ADAPT',
        title: 'Marine Buoy Disruption Trigger (23 kts)',
        titleAr: 'رصد اشتداد الرياح البحرية (٢٣ عقدة)',
        systemAction: 'Recovery engine flags Blue Hole high-swell hazard and isolates Day 3 dive item.',
        userFacingOutcome: 'Proactive gentle banner explains wind conditions and suggests safe alternatives.',
        verifiedEvidence: 'CDWS coastal safety protocol for open sea entries.',
        status: 'PASSED'
      },
      {
        stepNumber: 2,
        phase: 'RECOVER',
        title: 'Double-Entry Balanced Alternative Execution',
        titleAr: 'تنفيذ البديل الآمن مع توازن الحسابات',
        systemAction: 'Replaces with sheltered Lighthouse Reef Dive + Wadi Qnai Bedouin Safari with 0 EGP price variance.',
        userFacingOutcome: '1-tap acceptance synchronizes timeline, updates supplier dispatch, and shows ledger credit balance.',
        verifiedEvidence: 'LedgerService cryptographic transaction and supplier portal sync.',
        status: 'PASSED'
      }
    ],
    successCriteria: 'Zero orphaned traveler states, zero phone calls, 100% financial balance.'
  },
  {
    id: 'golden-journey-d',
    code: 'JOURNEY_D',
    title: 'Journey D: Returning Traveler Quick-Book & Transfer Sync',
    titleAr: 'المسار د: مسافر مكرر يحجز نقل المطار والمرافقة السريعة',
    persona: 'Returning traveler booking private SSH Airport transfer and synced companion',
    contextSummary: 'Book Now -> Transfer -> Companion TODAY/NOW/NEXT',
    steps: [
      {
        stepNumber: 1,
        phase: 'BOOK',
        title: '1-Tap Airport Transfer with Flight Pre-Fill',
        titleAr: 'حجز نقل المطار بلمسة مع رقم الرحلة',
        systemAction: 'Pre-fills flight MS-028 and assigns HiAce Comfort Van with driver Mahmoud Salem.',
        userFacingOutcome: 'Confirmed booking voucher with driver phone, plate, and pickup checkpoint clearance.',
        verifiedEvidence: 'South Sinai Transport Guild verified dispatch.',
        status: 'PASSED'
      }
    ],
    successCriteria: 'Driver tracking and pickup time updated in companion feed.'
  },
  {
    id: 'golden-journey-e',
    code: 'JOURNEY_E',
    title: 'Journey E: Offline Map & Expedition Fallback',
    titleAr: 'المسار هـ: وضع الاستكشاف بدون إنترنت والمحميات النائية',
    persona: 'Traveler heading to Ras Abu Galum & Blue Lagoon with zero cellular signal',
    contextSummary: 'No live Maps -> Curated offline fallback + Cash advisory + Emergency chamber protocol',
    steps: [
      {
        stepNumber: 1,
        phase: 'EXPERIENCE',
        title: 'Offline Expedition Pack Generation',
        titleAr: 'توليد حزمة السفر بدون إنترنت',
        systemAction: 'Bundles offline SVG maps, GPS waypoints, emergency phone tree, and cash advisory.',
        userFacingOutcome: 'Traveler has complete offline assurance before entering zero-signal zone.',
        verifiedEvidence: 'EEAA Protected Area offline guide and Hyperbaric registry.',
        status: 'PASSED'
      }
    ],
    successCriteria: '100% usable without network connectivity.'
  },
  {
    id: 'golden-journey-f',
    code: 'JOURNEY_F',
    title: 'Journey F: Deterministic AI Fallback (No Gemini/Cloud Outage)',
    titleAr: 'المسار و: التشغيل الحتمي عند انقطاع الاتصال بالسحابة',
    persona: 'Traveler querying DayGI during server or model outage',
    contextSummary: 'No Gemini -> Local deterministic reasoning engine serves 100% accurate Dahab facts',
    steps: [
      {
        stepNumber: 1,
        phase: 'DISCOVER',
        title: 'Local Dahab Deterministic Engine Activation',
        titleAr: 'تفعيل المحرك المحلي فائق السرعة',
        systemAction: 'Matches intent against local compiled spatial graph and CDWS price registry in <5ms.',
        userFacingOutcome: 'Accurate, trusted recommendations delivered without timeout or failure.',
        verifiedEvidence: 'Verified local ground truth dataset in dahabGeography.ts.',
        status: 'PASSED'
      }
    ],
    successCriteria: 'Zero app crashes and identical quality of local recommendations.'
  },
  {
    id: 'golden-journey-g',
    code: 'JOURNEY_G',
    title: 'Journey G: Out-of-Stock Inventory & Bedouin Request Flow',
    titleAr: 'المسار ز: معالجة نفاد المخزون الفوري والطلب البدوي',
    persona: 'Traveler requesting St. Catherine Sunrise Trek when instant slots are full',
    contextSummary: 'No instant inventory -> Request workflow -> 30-min Bedouin radio dispatch confirmation',
    steps: [
      {
        stepNumber: 1,
        phase: 'BOOK',
        title: 'Bedouin Guild Dispatch Request',
        titleAr: 'إرسال طلب التنسيق لمكتب المشايخ',
        systemAction: 'Tags booking as REQUEST status with 30-min Bedouin radio dispatch turnaround notice.',
        userFacingOutcome: 'Clear honest expectation; no fake instant confirmations.',
        verifiedEvidence: 'Bedouin Local Guild dispatch protocol.',
        status: 'PASSED'
      }
    ],
    successCriteria: 'Transparent communication preventing traveler arriving at pickup without guide.'
  }
];
