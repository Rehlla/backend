import {
  ActivityDetailEntity,
  DiningVenueEntity,
  EmergencyResourceEntity,
  RegulatoryDecreeEntity,
  TemporalFactEntity
} from '../db/schema';
import { QuestionKnowledgeItem } from '../domain/knowledgeTypes';

// ---------------------------------------------------------------------------
// 4. Expanded Dining Venues (Covering local cuisines, seafood, cafes, bakeries)
// ---------------------------------------------------------------------------
export const EXPANDED_DINING_VENUES: DiningVenueEntity[] = [
  {
    id: 'dining_ali_baba_seafood',
    nameEn: 'Ali Baba Waterfront Seafood',
    nameAr: 'علي بابا للأسماك والمأكولات البحرية',
    areaId: 'lighthouse',
    coordinates: { lat: 28.5020, lng: 34.5192 },
    cuisine: ['Seafood', 'Mediterranean', 'Egyptian'],
    priceBand: 'Moderate ($$)',
    averageMealPriceEGP: 480,
    seatingStyle: 'Bedouin Carpet Waterfront',
    dietaryOptions: {
      vegan: true,
      vegetarian: true,
      halal: true,
      freshSeafoodCatch: true
    },
    wifiNomadFriendly: true,
    openingHours: '08:00 - 00:00 Daily',
    bookingEligibility: 'WALK_IN'
    // supplierId is intentionally NOT set here. This corpus used to name
    // 'SUP-ALIBABA', which does not exist, so joining a venue to its supplier
    // returned nothing. It is assigned by the menu seed (importDahabMenus),
    // which creates the matching supplier — and it must not be restated here:
    // bootstrapValidatedCorpus runs AFTER runMigrationsAndSeed() and its
    // seedInto merge lets seed fields win, so a value written here would
    // silently revert the real supplier on every boot.
  },
  {
    id: 'dining_shark_restaurant',
    nameEn: 'Shark Waterfront Grill & Seafood',
    nameAr: 'مطعم شارك للمأكولات البحرية',
    areaId: 'lighthouse',
    coordinates: { lat: 28.5030, lng: 34.5198 },
    cuisine: ['Seafood', 'Bedouin Grill'],
    priceBand: 'Moderate ($$)',
    averageMealPriceEGP: 520,
    seatingStyle: 'Bedouin Carpet Waterfront',
    dietaryOptions: {
      vegan: true,
      vegetarian: true,
      halal: true,
      freshSeafoodCatch: true
    },
    wifiNomadFriendly: true,
    openingHours: '09:00 - 01:00 Daily',
    bookingEligibility: 'WALK_IN'
  },
  {
    id: 'dining_yum_yum_falafel',
    nameEn: 'Yum Yum Authentic Egyptian Kitchen',
    nameAr: 'مطعم يم يم للمأكولات الشعبية المصرية',
    areaId: 'assalah',
    coordinates: { lat: 28.5138, lng: 34.5162 },
    cuisine: ['Falafel & Foul', 'Koshary', 'Street Food'],
    priceBand: 'Budget ($)',
    averageMealPriceEGP: 80,
    seatingStyle: 'Street Counter',
    dietaryOptions: {
      vegan: true,
      vegetarian: true,
      halal: true,
      freshSeafoodCatch: false
    },
    wifiNomadFriendly: false,
    openingHours: '06:00 - 01:00 Daily',
    bookingEligibility: 'WALK_IN'
  },
  {
    id: 'dining_red_cat_italian',
    nameEn: 'Red Cat Artisan Trattoria & Pizzeria',
    nameAr: 'مطعم ريد كات الإيطالي',
    areaId: 'eel_garden',
    coordinates: { lat: 28.5085, lng: 34.5235 },
    cuisine: ['Italian', 'Artisan Pizza', 'Homemade Pasta'],
    priceBand: 'Moderate ($$)',
    averageMealPriceEGP: 380,
    seatingStyle: 'Courtyard Garden',
    dietaryOptions: {
      vegan: true,
      vegetarian: true,
      halal: true,
      freshSeafoodCatch: true
    },
    wifiNomadFriendly: true,
    openingHours: '13:00 - 23:00 Daily',
    bookingEligibility: 'WALK_IN'
  }
];

// ---------------------------------------------------------------------------
// 5. Expanded Activities & Experience Inventory (All Booking Modes)
// ---------------------------------------------------------------------------
export const EXPANDED_ACTIVITIES: ActivityDetailEntity[] = [
  {
    id: 'act_lighthouse_guided_dive',
    skuId: 'SKU-DIVE-LH-01',
    titleEn: 'Lighthouse Guided Reef Shore Dive',
    titleAr: 'غطسة استكشافية إرشادية في مرجان اللايتهاوس',
    category: 'diving',
    placeId: 'place_lighthouse_reef',
    areaId: 'lighthouse',
    durationMinutes: 50,
    accessMethod: 'SHORE',
    difficulty: 'All Levels',
    experienceLevelRequired: 'Open Water or Discover Scuba',
    basePriceEGP: 950,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {
      maxWindKnots: 25,
      minVisibilityMeters: 15,
      requiresDaylight: true
    },
    dependencies: ['CDWS Medical Declaration', 'Dive Certification / Instructor Briefing'],
    preparationTips: ['Bring towel and swimwear', 'Avoid heavy food 1h before dive'],
    preparationTipsAr: ['احضر منشفة وملابس بحر', 'تجنب الوجبات الثقيلة قبل الغطس بساعة'],
    travelerFitPersonas: ['Beginners', 'Nomads', 'Relaxed Travelers', 'Underwater Photographers']
  },
  {
    id: 'act_blue_hole_safari_dive',
    skuId: 'SKU-DIVE-BH-01',
    titleEn: 'Blue Hole & Bells Guided Expedition',
    titleAr: 'رحلة غطس إرشادية للبلو هول وبيلز مع الغداء البدوي',
    category: 'diving',
    placeId: 'place_blue_hole_sanctuary',
    areaId: 'blue_hole',
    durationMinutes: 240,
    accessMethod: '4X4',
    difficulty: 'Intermediate',
    experienceLevelRequired: 'Advanced Open Water / 20+ Logged Dives',
    basePriceEGP: 2200,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {
      maxWindKnots: 20,
      minVisibilityMeters: 20,
      requiresDaylight: true
    },
    dependencies: ['EEAA National Park Ticket ($10 or EGP equivalent)', 'Advanced Scuba Certification'],
    preparationTips: ['Passport copy required for checkpoint', 'Reef-safe sunscreen only'],
    preparationTipsAr: ['إحضار صورة جواز السفر أو بطاقة الرقم القومي لكمين البلو هول', 'واقي شمس صديق للبيئة البحرية فقط'],
    travelerFitPersonas: ['Certified Divers', 'Active Explorers']
  },
  {
    id: 'act_eel_garden_sunset_snorkel',
    skuId: 'SKU-SNORK-EG-01',
    titleEn: 'Eel Garden Sunset Guided Snorkel',
    titleAr: 'سنوركلينج إرشادي هادئ وقت الغروب في إيل جاردن',
    category: 'water_sport',
    placeId: 'place_eel_garden_reef',
    areaId: 'eel_garden',
    durationMinutes: 45,
    accessMethod: 'WALK',
    difficulty: 'Beginner',
    experienceLevelRequired: 'Basic Swimming Ability',
    basePriceEGP: 450,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {
      maxWindKnots: 18,
      minVisibilityMeters: 10,
      requiresDaylight: true
    },
    dependencies: ['Mask & Fins'],
    preparationTips: ['Step only on marked sandy corridors to protect corals'],
    preparationTipsAr: ['المشي فقط في الممرات الرملية المحددة لحماية المرجان'],
    travelerFitPersonas: ['Relaxed Travelers', 'Couples', 'Beginners']
  },
  {
    id: 'act_ras_abu_galum_boat_safari',
    skuId: 'SKU-SAFARI-RAG-01',
    titleEn: 'Ras Abu Galum Remote Marine Safari by Boat',
    titleAr: 'رحلة بحرية بالقارب لمحمية رأس أبو جالوم والبحيرة الزرقاء',
    category: 'safari',
    // This safari sails to Ras Abu Galum; it used to point at the Blue Hole
    // sanctuary place, so the Explore card showed the Blue Hole's description
    // and neighborhood for a trip that goes elsewhere.
    placeId: 'place_ras_abu_galum',
    areaId: 'ras_abu_galum',
    durationMinutes: 360,
    accessMethod: 'BOAT',
    difficulty: 'All Levels',
    experienceLevelRequired: 'None',
    basePriceEGP: 1800,
    bookingMode: 'REQUEST_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    environmentalSensitivities: {
      maxWindKnots: 15,
      minVisibilityMeters: 20,
      requiresDaylight: true
    },
    dependencies: ['EEAA Protectorates Permit', 'Wind below 16 knots'],
    preparationTips: ['Pack power bank and cash for Bedouin tea huts'],
    preparationTipsAr: ['احضر شاحن متنقل ومبلغ نقدي للشاي البدوي'],
    travelerFitPersonas: ['Adventurers', 'Nature Lovers']
  },
  {
    id: 'act_the_canyon_scuba_adventure',
    skuId: 'SKU-DIVE-CAN-01',
    titleEn: 'The Canyon Submarine Chasm Guided Scuba Dive',
    titleAr: 'غطسة استكشافية احترافية في شق الكانيون المرجاني',
    category: 'diving',
    placeId: 'place_canyon_reef',
    areaId: 'canyon',
    durationMinutes: 60,
    accessMethod: 'SHORE',
    difficulty: 'Intermediate',
    experienceLevelRequired: 'Advanced Open Water (30m rating)',
    basePriceEGP: 1200,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {
      maxWindKnots: 22,
      minVisibilityMeters: 20,
      requiresDaylight: true
    },
    dependencies: ['CDWS Certification', 'Good Buoyancy Control'],
    preparationTips: ['Ensure torch for cavern illumination'],
    preparationTipsAr: ['احرص على إحضار كشاف غوص لرؤية تفاصيل الكانيون'],
    travelerFitPersonas: ['Certified Divers', 'Underwater Photographers']
  },
  {
    id: 'act_laguna_windsurf_session',
    skuId: 'SKU-SURF-LAG-01',
    titleEn: 'Laguna Flatwater Windsurf / Kitesurf Session & Gear',
    titleAr: 'جلسة تدريب وتأجير معدات ركوب الشراع في لاجونا دهب',
    category: 'water_sport',
    placeId: 'place_laguna_sandspit',
    areaId: 'laguna',
    durationMinutes: 120,
    accessMethod: 'SHORE',
    difficulty: 'All Levels',
    experienceLevelRequired: 'Beginner to Expert',
    basePriceEGP: 1400,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [3, 4, 5, 6, 7, 8, 9, 10, 11],
    environmentalSensitivities: {
      maxWindKnots: 35,
      requiresDaylight: true
    },
    dependencies: ['Basic Swimming'],
    preparationTips: ['Apply high-SPF water-resistant sunscreen'],
    preparationTipsAr: ['استخدم واقي شمس قوي ومقاوم للماء'],
    travelerFitPersonas: ['Kitesurfers', 'Active Explorers', 'Athletes']
  },
  {
    id: 'act_three_pools_guided_snorkel',
    skuId: 'SKU-SNORK-3P-01',
    titleEn: 'Three Pools Family Coral Garden Snorkel Tour',
    titleAr: 'جولة سنوركلينج عائلية سهلة في أحواض الثري بولز',
    category: 'water_sport',
    placeId: 'place_three_pools',
    areaId: 'three_pools',
    durationMinutes: 90,
    accessMethod: 'SHORE',
    difficulty: 'Beginner',
    experienceLevelRequired: 'None (Lifejackets provided)',
    basePriceEGP: 500,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {
      maxWindKnots: 20,
      requiresDaylight: true
    },
    dependencies: ['Mask & Snorkel'],
    preparationTips: ['Great for kids and non-swimmers with buoyant life jackets'],
    preparationTipsAr: ['ممتاز للأطفال وغير السباحين مع سترات النجاة المتاحة'],
    travelerFitPersonas: ['Families', 'Beginners', 'Relaxed Travelers']
  },
  {
    id: 'act_wadi_gnai_rock_climbing',
    skuId: 'SKU-CLIMB-WG-01',
    titleEn: 'Wadi Gnai Granite Rock Climbing & Bouldering Masterclass',
    titleAr: 'كورس وتجربة تسلق الصخور الجرانيتية في وادي قني مع مرشد بدوي',
    category: 'culture',
    placeId: 'place_wadi_gnai_crags',
    areaId: 'wadi_gnai',
    durationMinutes: 180,
    accessMethod: '4X4',
    difficulty: 'Beginner',
    experienceLevelRequired: 'Basic Fitness (Harness & shoes provided)',
    basePriceEGP: 1600,
    bookingMode: 'REQUEST_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [10, 11, 12, 1, 2, 3, 4, 5],
    environmentalSensitivities: {
      requiresDaylight: true
    },
    dependencies: ['Sinai Climber Registration', 'Closed-toe hiking shoes'],
    preparationTips: ['Bring 2L drinking water and loose comfortable clothing'],
    preparationTipsAr: ['إحضار ٢ لتر ماء شرب وملابس رياضية مريحة'],
    travelerFitPersonas: ['Athletes', 'Hikers', 'Adventurers']
  },
  {
    id: 'act_mount_twilat_bedouin_stargazing',
    skuId: 'SKU-STARS-MT-01',
    titleEn: 'Mount Twilat Sunset Vista, Bedouin Zarbed Feast & Stargazing',
    titleAr: 'سهرة جبل الطويلات: غروب الشمس، عشاء الزرب البدوي، ورصد النجوم',
    category: 'culture',
    placeId: 'place_mount_twilat',
    areaId: 'mount_twilat',
    durationMinutes: 240,
    accessMethod: 'VEHICLE',
    difficulty: 'All Levels',
    experienceLevelRequired: 'None',
    basePriceEGP: 850,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-BEDOUIN-DIVE',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {},
    dependencies: [],
    preparationTips: ['Bring light jacket for cool desert night air'],
    preparationTipsAr: ['إحضار سترة خفيفة نظراً لاعتدال برودة الجو ليلاً بالجبل'],
    travelerFitPersonas: ['Couples', 'Foodies', 'Stargazers', 'Families']
  },
  {
    id: 'act_ssh_airport_private_transfer',
    skuId: 'SKU-TRANS-SSH-01',
    titleEn: 'Sharm El Sheikh Airport (SSH) Direct Private Transfer to Dahab',
    titleAr: 'توصيلة خاصة مباشرة ومكيفة من مطار شرم الشيخ إلى دهب',
    category: 'culture',
    placeId: 'place_ssh_dahab_highway',
    // Same terminus grouping as the checkpoint place above: the retired
    // ssh_corridor is not a valid areaId (mandatory FK). The reconciler
    // repoints skuId at SKU-TRF-001 at boot; that mapping is untouched.
    areaId: 'masbat',
    durationMinutes: 65,
    accessMethod: 'VEHICLE',
    difficulty: 'All Levels',
    experienceLevelRequired: 'None',
    basePriceEGP: 1750,
    bookingMode: 'BOOK_NOW',
    supplierId: 'SUP-BEDOUIN-TRANS',
    seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    environmentalSensitivities: {},
    dependencies: ['Flight Number for Live Tracking'],
    preparationTips: ['Driver greets outside terminal with name board'],
    preparationTipsAr: ['السائق يستقبلك خارج صالة الوصول بلافتة تحمل اسمك'],
    travelerFitPersonas: ['All Travelers', 'Families', 'Nomads']
  }
];

// ---------------------------------------------------------------------------
// 6. Expanded Emergency Resources (24/7 Decompression, Hospitals, Police, Pharmacies)
// ---------------------------------------------------------------------------
export const EXPANDED_EMERGENCIES: EmergencyResourceEntity[] = [
  {
    id: 'EMERG-HYPER-DAHAB-01',
    nameEn: 'Dahab Hyperbaric Medical & Decompression Chamber',
    nameAr: 'مركز ووحدة العلاج بالأكسجين وضغط الغوص بدهب',
    category: 'Hyperbaric Chamber',
    address: 'Peace Road, Dahab Medical Complex',
    coordinates: { lat: 28.5080, lng: 34.5120 },
    hotlineNumbers: ['+20 69 3640530', '+20 122 212 4840', '137'],
    authority: 'CDWS / South Sinai Health Directorate',
    operatingHours: '24/7 On-Call Emergency Protocol',
    responseCapabilitiesEn: 'Multiplace decompression chamber, hyperbaric dive medicine physicians, emergency triage.',
    responseCapabilitiesAr: 'غرفة ضغط متعددة المقاعد، أطباء متخصصون في طب الأعماق وحوادث الغوص، طوارئ على مدار الساعة.',
    verifiedAt: '2026-08-20T00:00:00Z',
    revalidationDays: 30
  },
  {
    id: 'EMERG-HOSP-DAHAB-01',
    nameEn: 'Dahab Specialized Central Hospital ER',
    nameAr: 'مستشفى دهب المركزي التخصصي (طوارئ)',
    category: 'Hospital ER',
    address: 'Al-Madina Street, Dahab',
    coordinates: { lat: 28.5135, lng: 34.5110 },
    hotlineNumbers: ['+20 69 3640212', '123'],
    authority: 'Ministry of Health and Population',
    operatingHours: '24/7 Continuous Emergency Room',
    responseCapabilitiesEn: 'Full trauma care, emergency ultrasound, surgical suite, ambulance dispatch.',
    responseCapabilitiesAr: 'عناية مركزة، طوارئ جراحية، إشراف طبي متكامل، سيارات إسعاف مجهزة.',
    verifiedAt: '2026-08-20T00:00:00Z',
    revalidationDays: 30
  },
  {
    id: 'EMERG-POLICE-DAHAB-01',
    nameEn: 'Dahab Tourism & Coastal Police Operations',
    nameAr: 'شرطة السياحة والعمليات الأمنية بدهب',
    category: 'Tourism Police',
    address: 'Lighthouse Seafront Command Post, Dahab',
    coordinates: { lat: 28.5022, lng: 34.5185 },
    hotlineNumbers: ['+20 69 3640103', '126'],
    authority: 'Egyptian Ministry of Interior',
    operatingHours: '24/7 Security & Traveler Assistance',
    responseCapabilitiesEn: 'Traveler safety oversight, checkpoint coordination, tourist dispute resolution.',
    responseCapabilitiesAr: 'أمن السائحين، تصاريح الكمائن الجبلية، حل النزاعات والمساعدة الأمنية الفورية.',
    verifiedAt: '2026-08-20T00:00:00Z',
    revalidationDays: 45
  },
  {
    id: 'EMERG-PHARM-ASSALAH-01',
    nameEn: 'Assalah 24/7 International Emergency Pharmacy',
    nameAr: 'صيدلية العسلة الدولية (طوارئ ٢٤ ساعة)',
    category: '24h Pharmacy',
    address: 'Assalah Main Market Square, Dahab',
    coordinates: { lat: 28.5142, lng: 34.5158 },
    hotlineNumbers: ['+20 69 3641200', '+20 100 555 4321'],
    authority: 'Egyptian Pharmacists Syndicate',
    operatingHours: '24/7 Open Nonstop',
    responseCapabilitiesEn: 'Full international travel medicines, dive ear drops, rehydration, emergency prescriptions.',
    responseCapabilitiesAr: 'أدوية دولية، قطرات علاج آلام الأذن للغواصين، محاليل جفاف، أدوية طوارئ.',
    verifiedAt: '2026-08-20T00:00:00Z',
    revalidationDays: 30
  },
  {
    id: 'EMERG-CLINIC-MASHRABA-01',
    nameEn: 'Dahab Urgent Care & Marine First Aid Clinic',
    nameAr: 'عيادة المشربة للطوارئ والإسعافات الأولية',
    category: 'Urgent Clinic',
    address: 'Mashraba Street near Seafront',
    coordinates: { lat: 28.4950, lng: 34.5135 },
    hotlineNumbers: ['+20 69 3640888'],
    authority: 'South Sinai Health Directorate',
    operatingHours: '08:00 - 00:00 Daily',
    responseCapabilitiesEn: 'Wound dressing, coral scrape treatment, IV therapy, general medicine consultation.',
    responseCapabilitiesAr: 'علاج جروح وسحجات المرجان، محاليل وريدية، استشارات طبية فورية.',
    verifiedAt: '2026-08-20T00:00:00Z',
    revalidationDays: 30
  }
];

// ---------------------------------------------------------------------------
// 7. Regulatory & Safety Decrees
// ---------------------------------------------------------------------------
export const EXPANDED_REGULATORY_DECREES: RegulatoryDecreeEntity[] = [
  {
    id: 'DECREE-EEAA-PROTECTORATES-2026',
    titleEn: 'South Sinai Marine Protected Areas Environmental Code (Ras Abu Galum & Blue Hole)',
    titleAr: 'لائحة حماية المحميات الطبيعية بجنوب سيناء (رأس أبو جالوم والبلو هول)',
    category: 'REGULATORY',
    authority: 'Egyptian Environmental Affairs Agency (EEAA)',
    sourceDocRef: 'EEAA-DECREE-2026-104',
    effectiveDate: '2026-01-01',
    summaryEn: 'Strict prohibition of touching or standing on coral reefs, single-use plastic ban across marine reserves, entry ticket required.',
    summaryAr: 'حظر تام للمس أو الوقوف على الشعاب المرجانية، حظر البلاستيك أحادي الاستخدام، وإلزامية تذكرة المحميات.',
    enforcementAction: 'Immediate fine and suspension of diving privileges for non-compliant guides and centers.',
    revalidationPolicy: 'Quarterly review by EEAA inspection officers.',
    verifiedAt: '2026-08-20T00:00:00Z'
  },
  {
    id: 'DECREE-CDWS-SAFETY-2026',
    titleEn: 'CDWS Operational Safety Mandate for Guided Scuba and Freediving',
    titleAr: 'دليل السلامة المعتمد من غرفة الغوص والأنشطة البحرية للغطس الحر والسكوبا',
    category: 'SAFETY_CRITICAL',
    authority: 'Chamber of Diving and Water Sports (CDWS)',
    sourceDocRef: 'CDWS-STAN-2026-SEC4',
    effectiveDate: '2026-03-01',
    summaryEn: 'Mandatory dive computer or depth timing device for all divers, maximum guide-to-diver ratio 1:6, 24h surface interval before flight.',
    summaryAr: 'إلزامية كمبيوتر الغوص، الحد الأقصى ٦ غواصين لكل مرشد، وفترة انتظار ٢٤ ساعة قبل الطيران.',
    enforcementAction: 'Cancellation of operational license for violators.',
    revalidationPolicy: 'Annual audit by CDWS technical committee.',
    verifiedAt: '2026-08-20T00:00:00Z'
  },
  {
    id: 'DECREE-POLICE-TOURIST-CHECKPOINTS-2026',
    titleEn: 'Ministry of Interior Tourist Security & Movement Directive',
    titleAr: 'تعليمات وإجراءات تأمين الأفواج السياحية والكمائن بجنوب سيناء',
    category: 'REGULATORY',
    authority: 'Ministry of Interior / Tourism Police',
    sourceDocRef: 'MOI-SS-TRANSIT-2026',
    effectiveDate: '2026-01-15',
    summaryEn: 'Mandatory valid identification for all passengers at checkpoints, licensed tourist transport vehicles required for desert excursions.',
    summaryAr: 'إلزامية حمل بطاقات الهوية وجوازات السفر، واشتراط سيارات سياحية مرخصة لرحلات السفاري.',
    enforcementAction: 'Denial of passage through security checkpoints for non-compliant transport.',
    revalidationPolicy: 'Ongoing oversight by South Sinai Traffic Control.',
    verifiedAt: '2026-08-20T00:00:00Z'
  }
];

// ---------------------------------------------------------------------------
// 8. Question-Driven Research Corpus (High-demand practical traveler queries)
// ---------------------------------------------------------------------------
export const EXPANDED_QUESTION_KNOWLEDGE: QuestionKnowledgeItem[] = [
  {
    id: 'Q-DIVE-NO-FLY-INTERVAL',
    questionEn: 'How long must I wait before flying after scuba diving in Dahab?',
    questionAr: 'كم يجب أن أنتظر قبل ركوب الطائرة بعد الغوص في دهب؟',
    category: 'Safety',
    governingFactIds: ['FACT-CDWS-NO-FLY-01'],
    authoritativeSourceId: 'CDWS_DESTINATION_ATLAS_2026',
    answerEn: 'Per CDWS safety regulations, divers must observe a minimum 18-hour surface interval after multiple no-decompression dives, and 24 hours after repetitive or decompression dives before ascending above 300m or boarding commercial flights.',
    answerAr: 'وفقاً لتعليمات غرفة الغوص (CDWS)، يجب الانتظار ١٨ ساعة على الأقل بعد غطسات متعددة بدون توقف تخفيف الضغط، و٢٤ ساعة بعد غطسات متكررة أو تخفيف الضغط قبل ركوب الطائرة.',
    verifiedAt: '2026-08-20T00:00:00Z'
  },
  {
    id: 'Q-PAYMENT-CASH-VS-CARD',
    questionEn: 'Can I pay by credit card in Dahab or do I need Egyptian pounds cash?',
    questionAr: 'هل يمكنني الدفع بالبطاقة الائتمانية في دهب أم أحتاج نقوداً كاش بالجنيه؟',
    category: 'Payment',
    governingFactIds: ['FACT-MKT-CASH-RATIO-01'],
    authoritativeSourceId: 'DAHAB_FIELD_AUDIT_Q3_2026',
    answerEn: 'Major dive centers, large hotels, and select modern restaurants accept Visa/Mastercard, but local souks, taxis, Bedouin tea huts, and street food operate strictly on cash (EGP). ATMs are concentrated in Medina and Masbat.',
    answerAr: 'تقبل مراكز الغوص والفنادق الكبرى البطاقات الائتمانية، بينما تعتمد الأسواق الشعبية والتاكسي والاستراحات البدوية على النقد (الجنيه المصري). ماكينات الصراف الآلي متوفرة بالمدينة والمسبط.',
    verifiedAt: '2026-08-20T00:00:00Z'
  },
  {
    id: 'Q-BLUE-HOLE-TICKET',
    questionEn: 'Do I need an entry ticket for the Blue Hole and Ras Abu Galum?',
    questionAr: 'هل أحتاج تذكرة دخول لمحمية البلو هول ورأس أبو جالوم؟',
    category: 'Logistics',
    governingFactIds: ['FACT-PROT-RABG-01'],
    authoritativeSourceId: 'EEAA_SOUTH_SINAI_PROTECTORATES_2026',
    answerEn: 'Yes, EEAA environmental tickets are required at the Blue Hole gate ($10 USD for foreigners, 50 EGP for Egyptians). Payment can be made at the checkpoint.',
    answerAr: 'نعم، تذكرة وزارة البيئة (EEAA) إلزامية عند بوابة البلو هول (١٠ دولارات للأجانب أو ٥٠ جنيهاً للمصريين) ويتم تحصيلها عند الكمين.',
    verifiedAt: '2026-08-20T00:00:00Z'
  },
  {
    id: 'Q-BLUE-LAGOON-ACCESS',
    questionEn: 'How do I get to the Blue Lagoon from Dahab?',
    questionAr: 'كيف أصل إلى البحيرة الزرقاء (بلو لاجون) من دهب؟',
    category: 'Mobility',
    governingFactIds: ['FACT-TRANS-BLUELAGOON-01'],
    authoritativeSourceId: 'BEDOUIN_TRIBAL_LOGISTICS_2026',
    answerEn: 'Take a 20-minute taxi from Dahab to the Blue Hole, followed by a 20-minute speedboat or 1.5-hour camel ride to Ras Abu Galum, then a 15-minute open-bed truck to the Blue Lagoon.',
    answerAr: 'استقل تاكسي لمدة ٢٠ دقيقة من دهب إلى البلو هول، ثم قارب سريع لمدة ٢٠ دقيقة أو جمال لمدة ساعة ونصف إلى رأس أبو جالوم، ثم سيارة نصف نقل بدوية لمدة ١٥ دقيقة إلى البلو لاجون.',
    verifiedAt: '2026-08-20T00:00:00Z'
  }
];
