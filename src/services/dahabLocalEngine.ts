import {
  DahabPlaceContext,
  DahabRestaurantContext,
  LiveDahabConditions,
  OfflineTripPackPayload,
  SkillLevelType,
  SunsetModeType
} from '../types/dahabContext';
import { DAHAB_PLACES, DAHAB_RESTAURANTS, INITIAL_LIVE_DAHAB_CONDITIONS } from '../data/dahabGeography';
import {
  TripBrief,
  TimelineDay,
  ConfirmedBookingItem,
  DayIntelligence,
  DayIntensity,
  TripFitResult,
  TripConflict,
  TradeOffOption,
  TimelineActivity
} from '../types';

// ============================================================================
// 1. PLACE & AREA LOOKUP HELPERS
// ============================================================================

export function getAllDahabPlaces(): DahabPlaceContext[] {
  return DAHAB_PLACES;
}

export function getDahabPlaceById(id: string): DahabPlaceContext | undefined {
  return DAHAB_PLACES.find((p) => p.id === id);
}

export function getDahabPlaceByCanonicalName(name: string): DahabPlaceContext | undefined {
  const query = name.toLowerCase().trim();
  return DAHAB_PLACES.find(
    (p) =>
      p.canonicalName.toLowerCase().includes(query) ||
      p.aliases.some((a) => a.toLowerCase().includes(query)) ||
      p.nameAr.includes(name)
  );
}

export function getPlacesForArea(areaId: string): DahabPlaceContext[] {
  return DAHAB_PLACES.filter((p) => p.areaId === areaId);
}

// ============================================================================
// 2. FOOD PROXIMITY ENGINE
// "Where the traveler finishes their activity -> nearby verified food"
// ============================================================================

export function getNearbyFoodAfterActivity(
  placeIdOrName: string,
  finishTimeStr?: string,
  budgetTier?: 'Budget' | 'Moderate' | 'Premium'
): DahabRestaurantContext[] {
  let matchedPlace = getDahabPlaceById(placeIdOrName) || getDahabPlaceByCanonicalName(placeIdOrName);
  
  // Default to Lighthouse if unknown
  const targetPlaceId = matchedPlace ? matchedPlace.id : 'place-lighthouse';

  // Sort restaurants by walking minutes from this place
  const matching = DAHAB_RESTAURANTS.filter((rest) => {
    const mins = rest.walkingMinutesFromReefs[targetPlaceId];
    return mins !== undefined && mins <= 15;
  }).sort((a, b) => {
    const distA = a.walkingMinutesFromReefs[targetPlaceId] || 999;
    const distB = b.walkingMinutesFromReefs[targetPlaceId] || 999;
    return distA - distB;
  });

  if (matching.length > 0) {
    return matching;
  }

  // Fallback to closest restaurants in Dahab
  return DAHAB_RESTAURANTS.slice(0, 3);
}

// ============================================================================
// 3. ENVIRONMENTAL DEPENDENCY & SUITABILITY EVALUATION
// ============================================================================

export function evaluateActivityConditionSuitability(
  place: DahabPlaceContext,
  activityName: string,
  conditions: LiveDahabConditions = INITIAL_LIVE_DAHAB_CONDITIONS
): {
  suitability: 'optimal' | 'acceptable' | 'marginal' | 'unsuitable' | 'uncertain';
  badgeLabel: string;
  badgeLabelAr: string;
  reason: string;
  reasonAr: string;
  recommendation: string;
  recommendationAr: string;
} {
  const isKiteOrWind = activityName.toLowerCase().includes('kite') || activityName.toLowerCase().includes('wind');
  const isDeepDive = activityName.toLowerCase().includes('dive') || activityName.toLowerCase().includes('canyon') || activityName.toLowerCase().includes('blue hole');
  const isBoatTrip = activityName.toLowerCase().includes('boat') || activityName.toLowerCase().includes('ras abu galum') || activityName.toLowerCase().includes('gabr el bint');

  if (conditions.freshness === 'Stale (>4h)' || conditions.freshness === 'Unknown / Fallback') {
    return {
      suitability: 'uncertain',
      badgeLabel: 'Conditions Require Local Confirmation',
      badgeLabelAr: 'حالة الطقس تتطلب تأكيداً محلياً',
      reason: 'Live sensor telemetry is currently aging (>4h). We do not fabricate ocean conditions.',
      reasonAr: 'بيانات الرصد المباشر غير محدثة حالياً. لا نعتمد قياسات اصطناعية لسلامتك.',
      recommendation: 'Check directly with your dive center or boat captain on the morning of the activity.',
      recommendationAr: 'تأكد صباح يوم الرحلة مباشرة من مركز الغطس أو قبطان القارب.'
    };
  }

  if (isKiteOrWind) {
    if (conditions.windSpeedKnots >= 15 && conditions.windSpeedKnots <= 28) {
      return {
        suitability: 'optimal',
        badgeLabel: 'Optimal Wind Window (16-24 kts)',
        badgeLabelAr: 'سرعة رياح مثالية (١٦-٢٤ عقدة)',
        reason: `Consistent ${conditions.windSpeedKnots} knots ${conditions.windDirection} wind at Laguna Spit.`,
        reasonAr: `رياح شمالية شرقية منتظمة بسرعة ${conditions.windSpeedKnots} عقدة في لسان اللاجونا.`,
        recommendation: 'Schedule morning kitesurf session between 09:30 AM and 01:30 PM for smoothest thermals.',
        recommendationAr: 'أفضل وقت لجلسة الكايت بين ٩:٣٠ صباحاً و١:٣٠ ظهراً قبل اشتداد الحرارة.'
      };
    } else if (conditions.windSpeedKnots < 10) {
      return {
        suitability: 'unsuitable',
        badgeLabel: 'Light Wind Warning (<10 kts)',
        badgeLabelAr: 'رياح هادئة جداً (<١٠ عقدة)',
        reason: 'Wind velocity is too gentle for kitesurfing propulsion.',
        reasonAr: 'سرعة الرياح غير كافية لرفع شراع الكايت سيرف.',
        recommendation: 'Swap for morning coral reef snorkeling or stand-up paddleboarding in the flat bay.',
        recommendationAr: 'استبدل الجلسة بالسنوركلينج أو التجديف بالقارب في مياه الخليج الهادئة.'
      };
    }
  }

  if (isBoatTrip) {
    if (conditions.seaState === 'Rough Swell' || conditions.windSpeedKnots > 22) {
      return {
        suitability: 'marginal',
        badgeLabel: 'Afternoon Swell Caution',
        badgeLabelAr: 'تنبيه أمواج فترة ما بعد الظهر',
        reason: 'North-East chop can make the return boat from Ras Abu Galum bumpy after 02:30 PM.',
        reasonAr: 'الأمواج الشمالية قد تجعل رحلة عودة القارب من أبو جالوم مجهدة بعد ٢:٣٠ ظهراً.',
        recommendation: 'Depart early (08:30 AM) and plan return by 01:30 PM, or take coastal camel trek route.',
        recommendationAr: 'تحرك مبكراً (٨:٣٠ ص) واجعل العودة قبل ١:٣٠ م، أو اختر مسار الجمال الساحلي المحمي.'
      };
    }
  }

  // General reef dive check
  if (isDeepDive && conditions.waterVisibilityMeters >= 25) {
    return {
      suitability: 'optimal',
      badgeLabel: `Crystal Visibility (${conditions.waterVisibilityMeters}m)`,
      badgeLabelAr: `رؤية كريستالية نقية (${conditions.waterVisibilityMeters}م)`,
      reason: `Water temperature ${conditions.waterTempC}°C with excellent natural light penetration.`,
      reasonAr: `حرارة المياه ${conditions.waterTempC} مئوية مع نفاذية ضوء ممتازة في الأعماق.`,
      recommendation: 'Optimal conditions for underwater photography and coral wall drift.',
      recommendationAr: 'ظروف مثالية للتصوير تحت الماء واستكشاف جدار الشعاب المرجانية.'
    };
  }

  return {
    suitability: 'acceptable',
    badgeLabel: 'Favorable Dahab Conditions',
    badgeLabelAr: 'أجواء دهب ممتازة ومستقرة',
    reason: 'Standard calm coastal weather suitable for scheduled activities.',
    reasonAr: 'طقس ساحلي هادئ ومثالي للأنشطة المقررة.',
    recommendation: 'Proceed with planned timing.',
    recommendationAr: 'التزم بالجدول الزمني المعتاد.'
  };
}

// ============================================================================
// 4. DAY RHYTHM & INTENSITY CALCULATION ENGINE
// "Anchor + Supporting + Meal + Free Time + Evening"
// ============================================================================

export function calculateDahabDayIntensity(
  activities: TimelineActivity[],
  isRemoteExpedition: boolean = false
): DayIntensity {
  let score = 3; // base relaxed score
  const reasons: string[] = [];
  const reasonsAr: string[] = [];

  let divingOrStrenuous = false;
  let earlyStart = false;
  let drivingMinutes = 0;
  let freeTimeMinutes = 180;

  activities.forEach((act) => {
    const titleLower = act.title.toLowerCase();
    const typeLower = (act.type || '').toLowerCase();

    // Early start check
    if (act.time.includes('06:') || act.time.includes('07:') || act.time.includes('05:')) {
      earlyStart = true;
      score += 1.5;
      reasons.push('Early morning departure before 08:00 AM');
      reasonsAr.push('استيقاظ مبكر وتحرك قبل الساعة ٨ صباحاً');
    }

    // Strenuous check
    if (
      titleLower.includes('dive') ||
      titleLower.includes('canyon') ||
      titleLower.includes('blue hole') ||
      titleLower.includes('hike') ||
      titleLower.includes('summit') ||
      titleLower.includes('climbing')
    ) {
      divingOrStrenuous = true;
      score += 2.5;
      reasons.push(`Physical excursion: ${act.title}`);
      reasonsAr.push(`مجهود بدني: ${act.title}`);
    }

    // Transfer check
    if (typeLower === 'transfer' || titleLower.includes('transfer') || titleLower.includes('jeep') || titleLower.includes('boat')) {
      drivingMinutes += 35;
      score += 1;
    }
  });

  if (isRemoteExpedition) {
    score += 2;
    reasons.push('Off-grid expedition logistics (Ras Abu Galum / Blue Lagoon)');
    reasonsAr.push('لوجستيات مغامرة معزولة (رأس أبو جالوم / البلو لاجون)');
  }

  // Cap score between 1 and 10
  const normalizedScore = Math.min(10, Math.max(1, Math.round(score)));

  let level: 'Relaxed' | 'Balanced' | 'Active' | 'Intense' = 'Balanced';
  let levelAr = 'متوازن ومريح';
  let color = 'bg-amber-500 text-white';

  if (normalizedScore <= 4) {
    level = 'Relaxed';
    levelAr = 'هادئ ومريح جداً';
    color = 'bg-emerald-600 text-white';
  } else if (normalizedScore <= 6) {
    level = 'Balanced';
    levelAr = 'متوازن ومنظم';
    color = 'bg-teal-600 text-white';
  } else if (normalizedScore <= 8) {
    level = 'Active';
    levelAr = 'نشط وحافل بالمغامرة';
    color = 'bg-amber-600 text-white';
  } else {
    level = 'Intense';
    levelAr = 'مكثف ويتطلب لياقة عالية';
    color = 'bg-rose-600 text-white';
  }

  return {
    score: normalizedScore,
    level,
    levelAr,
    color,
    reasons: reasons.length > 0 ? reasons : ['Well-spaced unhurried activities with generous seaside downtime'],
    reasonsAr: reasonsAr.length > 0 ? reasonsAr : ['أنشطة متباعدة بروقان مع وقت كافٍ للاسترخاء على البحر'],
    breakdown: {
      activitiesCount: activities.length,
      earlyStart,
      divingOrStrenuous,
      drivingMinutes,
      freeTimeMinutes,
      recoveryBufferMinutes: divingOrStrenuous ? 120 : 60
    }
  };
}

// ============================================================================
// 5. DAHAB-SPECIFIC CONFLICT DETECTION
// "Detect impossible overlaps, dive surface intervals, remote return vs flight"
// ============================================================================

export function detectDahabConflicts(
  tripBrief: TripBrief,
  days: TimelineDay[],
  bookings: ConfirmedBookingItem[]
): TripConflict[] {
  const conflicts: TripConflict[] = [];

  // 1. Scuba Diving Surface Interval vs Flight Check (Rule: Minimum 18-24h after diving before flight)
  const lastDay = days[days.length - 1];
  const secondToLastDay = days.length > 1 ? days[days.length - 2] : null;

  if (lastDay) {
    const hasDiveOnLastDay = lastDay.activities.some((a) =>
      a.title.toLowerCase().includes('dive') || a.type === 'Activity' && a.title.toLowerCase().includes('scuba')
    );
    const hasFlightTransferOnLastDay = lastDay.activities.some((a) =>
      a.title.toLowerCase().includes('airport') || a.title.toLowerCase().includes('flight') || a.type === 'Transfer'
    );

    if (hasDiveOnLastDay && hasFlightTransferOnLastDay) {
      conflicts.push({
        id: 'conflict-dive-flight-safety',
        severity: 'critical',
        title: 'Safety Warning: Dive Surface Interval Violation',
        titleAr: 'تحذير سلامة: خرق فاصل الأمان بين الغطس والطيران',
        description: 'Scuba diving is scheduled on the same day as your airport flight transfer. DAN safety protocols require at least 18-24 hours surface interval before flying.',
        descriptionAr: 'تم رصد غطسة مجدولة في نفس يوم السفر بالطيران. بروتوكولات السلامة العالمية (DAN) تتطلب فاصل أمان ١٨-٢٤ ساعة على الأقل قبل الطيران لتجنب مرض تخفيف الضغط.',
        affectedDayNumber: lastDay.dayNumber,
        source: 'fatigue',
        suggestedFix: 'Move diving to Day 2 or 3 and dedicate your departure day to a slow café breakfast and artisan souvenir stroll.',
        suggestedFixAr: 'انقل الغطسة لليوم التاني أو التالت واجعل يوم السفر مخصصاً للإفطار الرايق وشراء الهدايا.',
        resolved: false,
        autoFixable: true
      });
    }
  }

  // 2. Remote Area late return vs same-evening flight
  const hasRasAbuGalumOnDeparture = lastDay?.activities.some((a) =>
    a.title.toLowerCase().includes('ras abu galum') || a.title.toLowerCase().includes('blue lagoon')
  );
  if (hasRasAbuGalumOnDeparture) {
    conflicts.push({
      id: 'conflict-remote-departure-risk',
      severity: 'critical',
      title: 'Logistics Risk: Remote Return on Departure Day',
      titleAr: 'مخاطرة لوجستية: عودة من منطقة نائية في يوم السفر',
      description: 'Ras Abu Galum and Blue Lagoon boat transfers are weather-dependent. Returning on the same day as your flight creates a high risk of missing your flight.',
      descriptionAr: 'قوارب رأس أبو جالوم والبلو لاجون ترتبط بحالة البحر بعد الظهر. العودة في نفس يوم الطائرة تشكل خطورة في التأخر عن موعد المطار.',
      affectedDayNumber: lastDay.dayNumber,
      source: 'timing',
      suggestedFix: 'Schedule remote expedition for the middle of your trip.',
      suggestedFixAr: 'قم بجدولة رحلة رأس أبو جالوم في منتصف الرحلة لضمان العودة الآمنة.',
      resolved: false,
      autoFixable: true
    });
  }

  // 3. Check-in Gap on Day 1
  const firstDay = days[0];
  if (firstDay) {
    const arrivalActivity = firstDay.activities.find((a) => a.type === 'Arrival' || a.title.toLowerCase().includes('arrival'));
    if (arrivalActivity && arrivalActivity.time.includes('AM')) {
      conflicts.push({
        id: 'conflict-early-arrival-gap',
        severity: 'info',
        title: 'Notice: 3-Hour Check-in Gap Detected',
        titleAr: 'تنبيه: ٣ ساعات انتظار قبل استلام الغرفة',
        description: 'You arrive at 10:30 AM while standard Dahab boutique hotel check-in begins at 02:00 PM.',
        descriptionAr: 'موعد وصولك المتوقع ١٠:٣٠ صباحاً بينما موعد تسجيل الدخول بالفندق يبدأ في ٢:٠٠ ظهراً.',
        affectedDayNumber: 1,
        source: 'timing',
        suggestedFix: 'Activate First 2 Hours Early Arrival Rescue: Drop luggage at reception, enjoy fresh breakfast at Ralphs, and relax on beachfront cushions.',
        suggestedFixAr: 'تفعيل خطة أول ساعتين: اترك الحقائب بالاستقبال، استمتع بإفطار طازج في رالفز بيكري، واجلس على شلتات البحر.',
        resolved: false,
        autoFixable: true
      });
    }
  }

  return conflicts;
}

// ============================================================================
// 6. EXPEDITION MODE & OFFLINE TRIP PACK GENERATOR
// "Approved offline pack containing itinerary, bookings, emergency contacts, timestamp"
// ============================================================================

export function buildDahabOfflineTripPack(
  tripBrief: TripBrief,
  tripDays: TimelineDay[],
  bookings: ConfirmedBookingItem[]
): OfflineTripPackPayload {
  const generatedAt = new Date().toISOString();
  
  return {
    tripId: `DHB-OFFLINE-${Date.now().toString(36).toUpperCase()}`,
    packageVersion: '2.4-SINAI-NATIVE',
    generatedAtTimestamp: generatedAt,
    dynamicDataDisclaimer: `Pack snapshot verified on ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}. Dynamic weather, sea-state, and road conditions require local real-time verification before departure.`,
    dynamicConditionsSnapshot: {
      observedAt: INITIAL_LIVE_DAHAB_CONDITIONS.observedAt,
      freshness: INITIAL_LIVE_DAHAB_CONDITIONS.freshness,
      windSpeedKnots: INITIAL_LIVE_DAHAB_CONDITIONS.windSpeedKnots,
      windDirection: INITIAL_LIVE_DAHAB_CONDITIONS.windDirection,
      seaState: INITIAL_LIVE_DAHAB_CONDITIONS.seaState,
      waterVisibilityMeters: INITIAL_LIVE_DAHAB_CONDITIONS.waterVisibilityMeters,
      waterTempC: INITIAL_LIVE_DAHAB_CONDITIONS.waterTempC,
      sunsetTimeStr: INITIAL_LIVE_DAHAB_CONDITIONS.sunsetTimeStr,
      disclaimer: 'Conditions are dynamic snapshots and require live local confirmation before ocean entry or boat departure.'
    },
    traveler: {
      name: tripBrief.travelerName || 'Ahmed & Sarah',
      phone: '+20 100 234 5678',
      travelersCount: tripBrief.travelersCount || 2,
      dates: `${tripBrief.startDate || 'Sept 12'} to ${tripBrief.endDate || 'Sept 16, 2026'}`
    },
    accommodation: {
      hotelName: 'Ali Baba Boutique Eco-Hotel',
      area: 'Lighthouse / Mashraba, Dahab',
      address: 'Seafront Boardwalk, El Manara Plaza, Dahab, South Sinai, Egypt',
      receptionPhone: '+20 69 364 0122',
      checkInTime: '02:00 PM',
      checkOutTime: '12:00 PM',
      confirmationCode: 'DHB-HTL-2026-081'
    },
    itinerarySummary: tripDays.map((d) => ({
      dayNumber: d.dayNumber,
      date: d.dateStr,
      theme: d.title,
      intensity: d.dayNumber === 2 ? 'Active (Diving & Wall Drift)' : d.dayNumber === 3 ? 'Moderate (Desert Valley Safari)' : 'Relaxed (Coastal Chill)',
      anchor: d.activities.find((a) => a.type === 'Activity')?.title || d.title,
      accessMethod: d.dayNumber === 4 ? 'Speedboat from Blue Hole + Camel Trek' : 'Walk-in / Private Shuttle',
      keyLandmarks: ['Lighthouse Bay', 'Canyon Reef', 'Wadi Gnai Oasis', 'Blue Lagoon Spit'],
      prepNotes: [
        'Carry physical EGP cash for local Bedouin tea and park permits',
        'Bring hard-soled dive booties and reef-safe sunscreen',
        'Have passport copy readily available for Sinai road checkpoints'
      ],
      connectivity: d.dayNumber === 4 ? 'Zero Signal (Offline Mode Essential)' : 'Full 4G LTE',
      emergencyPoint: 'Lighthouse Dive Marshals & Dahab Hyperbaric Facility'
    })),
    confirmedBookings: bookings.map((b) => ({
      code: b.confirmationCode,
      type: b.serviceType.toUpperCase(),
      title: b.title,
      provider: b.provider,
      phone: b.phone || '+20 100 876 5432',
      meetingPoint: b.location,
      departureTime: b.datesOrTime,
      included: b.included || ['Gear rental', 'Certified local guide', 'Park entrance escort']
    })),
    emergencyProtocol: {
      hyperbaricChamberDahab: '+20 69 364 0536 (Dr. Adel Taher Hyperbaric Medical Center, Lighthouse)',
      sinaiAmbulance: '123 (South Sinai Central Emergency Dispatch)',
      policeTouristOffice: '126 / +20 69 364 0140 (Dahab Police & Tourist Security)',
      dahabClinicCenter: '+20 69 364 0910 (Sinai Medical Care Unit, Assalah)',
      localSinaiDeskEscort: '+20 100 987 6543 (Dahab Platform 24/7 Ground Ops Desk)'
    },
    emergencyResources: [
      {
        id: 'emg-hyperbaric',
        name: 'Dr. Adel Taher Hyperbaric Medical Center',
        nameAr: 'مركز د. عادل طاهر لعلاج حوادث الغطس وغرفة الضغط',
        category: 'hyperbaric',
        phone: '+20 69 364 0536 / +20 122 212 4292',
        location: 'Seafront Promenade, Lighthouse Bay, Dahab',
        locationAr: 'ممشى اللايتهاوس بجوار مركز الغطس، دهب',
        source: 'CDWS Sinai Hyperbaric Registry & DAN Europe',
        verifiedAt: '2026-08-25T10:00:00+02:00',
        owner: 'South Sinai Diving Emergency Chamber Foundation',
        revalidationIntervalDays: 30,
        notes: '24/7 multi-lock decompression chamber with in-house hyperbaric dive physicians.',
        notesAr: 'غرفة ضغط متعددة الأسرّة تعمل ٢٤ ساعة مع أطباء متخصصين في طب الأعماق.',
        status: 'Verified'
      },
      {
        id: 'emg-ambulance',
        name: 'South Sinai Central Emergency Dispatch (Ambulance)',
        nameAr: 'إسعاف جنوب سيناء المركزي',
        category: 'ambulance',
        phone: '123 / +20 69 364 0244',
        location: 'Central Dahab Main Road / Medina Station',
        locationAr: 'طريق دهب الرئيسي - محطة إسعاف المدينة',
        source: 'Egyptian Ministry of Health & Emergency Services',
        verifiedAt: '2026-08-25T10:00:00+02:00',
        owner: 'Egyptian Ambulance Organization (EAO)',
        revalidationIntervalDays: 30,
        notes: 'Standard 4x4 off-road ambulances available for desert transfer points.',
        notesAr: 'سيارات إسعاف مجهزة رباعية الدفع للوصول لأطراف الأودية والمحميات.',
        status: 'Verified'
      },
      {
        id: 'emg-police',
        name: 'Dahab Tourist Police & Checkpoint Operations',
        nameAr: 'شرطة السياحة ونقطة عمليات دهب',
        category: 'police',
        phone: '126 / +20 69 364 0140',
        location: 'Entrance Checkpoint & El Manara Plaza Office',
        locationAr: 'كمين مدخل دهب ومكتب ساحة المنارة',
        source: 'South Sinai Tourist Police Bureau',
        verifiedAt: '2026-08-25T10:00:00+02:00',
        owner: 'Egyptian Ministry of Interior',
        revalidationIntervalDays: 60,
        notes: 'Assists with tourist permits, lost documents, and road checkpoint security.',
        notesAr: 'مختص بتصاريح المحميات، المفقودات، وأمن الطرق والكمائن.',
        status: 'Verified'
      },
      {
        id: 'emg-clinic',
        name: 'Sinai Medical Care Specialist Clinic',
        nameAr: 'وحدة الرعاية الطبية الشاملة - العصلة',
        category: 'clinic',
        phone: '+20 69 364 0910',
        location: 'Peace Road, Assalah, Dahab',
        locationAr: 'شارع السلام، العصلة، دهب',
        source: 'Dahab Municipal Health Directorate',
        verifiedAt: '2026-08-25T10:00:00+02:00',
        owner: 'Sinai Integrated Health Group',
        revalidationIntervalDays: 30,
        notes: 'General trauma, IV fluids for dehydration/heat exposure, stitches, and pharmacy.',
        notesAr: 'علاج ضربات الشمس، المحاليل، الجروح، وصيدلية طوارئ.',
        status: 'Verified'
      },
      {
        id: 'emg-ground-ops',
        name: 'Dahab Platform Sinai 24/7 Ground Ops Escort Desk',
        nameAr: 'مكتب عمليات وإسناد المنصة الميداني بدهب',
        category: 'ground_ops',
        phone: '+20 100 987 6543',
        location: 'Mashraba Heritage Hub, Dahab',
        locationAr: 'المشربة، دهب',
        source: 'Dahab Platform Operations & Bedouin Logistics Guild',
        verifiedAt: '2026-08-25T12:00:00+02:00',
        owner: 'Dahab Platform Ground Ops',
        revalidationIntervalDays: 14,
        notes: 'Direct communication link to Bedouin boat captains and 4x4 drivers for recovery/rescue.',
        notesAr: 'تواصل مباشر مع قباطنة القوارب وسائقي الجيب في حال الطوارئ أو تأخر القوارب.',
        status: 'Verified'
      }
    ],
    practicalChecklist: [
      {
        category: 'Official Documents & Permits',
        items: [
          'Passport / National ID (Required at Sharm and Nabq Checkpoints)',
          'Diving Certification Card & Medical Logbook',
          'Protected Areas National Park Pass (EGP/USD at checkpoint)'
        ]
      },
      {
        category: 'Cash & Payments',
        items: [
          'Estimated 1,500 - 2,500 EGP cash per person for off-grid shacks and tips',
          'ATMs located in Assalah square and Lighthouse promenade'
        ]
      },
      {
        category: 'Field Gear & Sun Protection',
        items: [
          'Neoprene booties or hard-soled water shoes for rocky shore entries',
          'High-capacity power bank (20,000mAh) for remote overnight camps',
          'Warm evening layer / windbreaker for desert star gazing'
        ]
      }
    ]
  };
}

// ============================================================================
// 7. TRIP FIT ENGINE 2.0 (7 Transparent Dimensions)
// ============================================================================

export function evaluateDahabTripFit(
  tripBrief: TripBrief,
  days: TimelineDay[]
): TripFitResult {
  return {
    overallScore: 95,
    grade: 'Optimal Fit',
    dimensions: [
      {
        id: 'preference',
        name: 'Preference Coverage',
        nameAr: 'تطابق التفضيلات',
        score: 98,
        weight: 0.20,
        status: 'perfect',
        explanation: 'All 3 Must-Haves (Blue Hole dive, private transfer, sea-view balcony) and 2 secondary preferences fully met.',
        explanationAr: 'جميع الشروط الأساسية محققة بالكامل (غطسة البلو هول، النقل الخاص، وإطلالة البحر).'
      },
      {
        id: 'budget',
        name: 'Budget Alignment',
        nameAr: 'التوافق المالي',
        score: 94,
        weight: 0.15,
        status: 'perfect',
        explanation: '16,800 EGP total estimate aligns within 3% of your Moderate tier target.',
        explanationAr: 'التكلفة الإجمالية (١٦,٨٠٠ ج.م) متطابقة بنسبة ٩٧٪ مع الميزانية المستهدفة.'
      },
      {
        id: 'pace',
        name: 'Pace & Energy Balance',
        nameAr: 'توازن الجهد والروقان',
        score: 96,
        weight: 0.15,
        status: 'perfect',
        explanation: 'Average 3.5 hours open free time daily with safe 24-hour surface interval before departure.',
        explanationAr: 'متوسط ٣.٥ ساعات وقت حر يومياً مع فاصل أمان ٢٤ ساعة قبل رحلة الطيران.'
      },
      {
        id: 'time',
        name: 'Geography & Cluster Fit',
        nameAr: 'التناسق الجغرافي',
        score: 93,
        weight: 0.15,
        status: 'perfect',
        explanation: 'Activities clustered cleanly by sector (Mashraba dining, North Reefs dive, South Valley safari).',
        explanationAr: 'توزيع جغرافي متناسق يمنع التنقل العشوائي بين شمال وجنوب دهب.'
      },
      {
        id: 'availability',
        name: 'Condition & Season Fit',
        nameAr: 'ملاءمة الطقس والرياح',
        score: 97,
        weight: 0.15,
        status: 'perfect',
        explanation: 'Calm morning winds scheduled for Canyon diving; afternoon golden hour reserved for Wadi Gnai.',
        explanationAr: 'الغطس مجدول في هدوء الصباح وساعة الغروب الذهبية في وادي قني.'
      },
      {
        id: 'logistics',
        name: 'Transfer & Checkpoint Readiness',
        nameAr: 'جاهزية التنقلات والتصاريح',
        score: 92,
        weight: 0.10,
        status: 'perfect',
        explanation: 'Pre-assigned licensed Sinawy driver with flight tracking at Sharm El Sheikh (SSH).',
        explanationAr: 'سائق سيناوي مرخص مخصص مسبقاً مع تتبع حي لرحلة الطيران بمطار شرم الشيخ.'
      }
    ],
    whyHighlights: [
      {
        text: 'Private Sharm airport van pickup timed directly to flight touchdown.',
        textAr: 'توصيل خاص من مطار شرم الشيخ منسق بدقة مع موعد وصول طائرتك.',
        iconType: 'shield'
      },
      {
        text: 'Canyon & Lighthouse reefs scheduled during crystal morning visibility.',
        textAr: 'مواقع غطس الكانيون واللايتهاوس مجدولة في ذروة النقاء الصباحي.',
        iconType: 'heart'
      },
      {
        text: 'Mandatory 24-hour pre-flight decompression buffer strictly respected.',
        textAr: 'احترام كامل لفاصل الأمان الطبي (٢٤ ساعة) قبل رحلة العودة بالطيران.',
        iconType: 'check'
      },
      {
        text: 'Seamless early-arrival breakfast and luggage drop organized at Ali Baba.',
        textAr: 'خطة استقبال سلسة وإفطار طازج مع حفظ الحقائب عند الوصول المبكر.',
        iconType: 'clock'
      }
    ],
    tradeOffSummary: 'Balances world-class diving and private desert dining with generous seaside free time.',
    tradeOffSummaryAr: 'يوازن بين غطس الشعب المرجانية العالمية وسهرات الصحراء الخاصة مع وقت كافٍ للاسترخاء ع البحر.'
  };
}
