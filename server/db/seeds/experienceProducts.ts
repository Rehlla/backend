import type { ProductSkuEntity, SupplierEntity } from '../schema';

/**
 * Bookable products for the catalogue activities that had none.
 *
 * Each SKU is the activity it is mapped to in EXPERIENCE_SKU_BY_ACTIVITY: same
 * site, same access, same shape of day, run by a supplier who works that site.
 * Price, duration and party size are the activity's own, so what the
 * experience page describes is what checkout sells and the supplier runs.
 *
 * `timeSlots` are the departures each operator actually runs — a sunset
 * snorkel is not offered at 08:30, and a Mount Moses ascent leaves at night.
 */

/** Only inserted when missing: an existing record (e.g. from the Instagram import) is kept as-is. */
export const EXPERIENCE_SUPPLIERS: SupplierEntity[] = [
  {
    id: 'SUP-SINAI-CLIMBING',
    businessName: 'Sinai Rock Climbing & Bouldering Guild',
    businessNameAr: 'نقابة سيناء لتسلق الصخور والبولدرينج',
    category: 'safari',
    tier: 'Vetted Local Partner',
    status: 'Active',
    leadContact: 'Sinai Rock Climbing & Bouldering Guild',
    area: 'Wadi Gnai',
    onboardedAt: '2026-09-12',
    approvedBy: 'Catalogue import'
  }
];

const SKUS: ProductSkuEntity[] = [
  {
    id: 'SKU-EXP-EELSNORKEL-01',
    supplierId: 'SUP-BLUEDIVERS-01',
    serviceType: 'diving',
    title: 'Eel Garden Sunset Guided Snorkel',
    titleAr: 'سنوركلينج إرشادي وقت الغروب في إيل جاردن',
    description: 'A calm guided snorkel over the Eel Garden sand slope as the garden eels rise at golden hour. Shore entry, eight minutes on foot from the Lighthouse.',
    routeFrom: 'Dahab Blue Divers Hub, Lighthouse',
    routeTo: 'Eel Garden Reef',
    durationMinutes: 75,
    basePriceEGP: 450,
    currency: 'EGP',
    maxCapacityPerSlot: 10,
    active: true,
    includedItems: ['Snorkel guide', 'Mask, snorkel, fins and a buoyancy vest', 'Reef-safe briefing on the beach'],
    cancellationPolicyHours: 6,
    timeSlots: ['03:30 PM', '04:30 PM']
  },
  {
    id: 'SKU-EXP-3POOLS-01',
    supplierId: 'SUP-BLUEDIVERS-01',
    serviceType: 'diving',
    title: 'Three Pools Family Coral Garden Snorkel',
    titleAr: 'سنوركلينج عائلي في حدائق المرجان بالثلاث بحيرات',
    description: 'Three sheltered lagoons south of town with shallow coral gardens — the easiest water in Dahab for children and first-time snorkellers.',
    routeFrom: 'Your Dahab hotel',
    routeTo: 'Three Pools',
    durationMinutes: 180,
    basePriceEGP: 500,
    currency: 'EGP',
    maxCapacityPerSlot: 12,
    active: true,
    includedItems: ['Return 4x4 transfer', 'Snorkel guide', 'Full snorkel gear in child and adult sizes', 'Bedouin tea in the shade'],
    cancellationPolicyHours: 12,
    timeSlots: ['09:00 AM', '01:00 PM']
  },
  {
    id: 'SKU-EXP-RAGBOAT-01',
    supplierId: 'SUP-REDSEAMASTERS-01',
    serviceType: 'safari',
    title: 'Ras Abu Galum Marine Safari by Boat',
    titleAr: 'سفاري بحرية إلى محمية رأس أبو جالوم بالمركب',
    description: 'A boat up the protected coast to Ras Abu Galum with two snorkel stops and a fish lunch at the Bedouin village on the beach.',
    routeFrom: 'Lighthouse jetty',
    routeTo: 'Ras Abu Galum Protectorate',
    durationMinutes: 360,
    basePriceEGP: 1800,
    currency: 'EGP',
    maxCapacityPerSlot: 12,
    active: true,
    includedItems: ['Boat and skipper', 'Two guided snorkel stops', 'Fish lunch in the Bedouin village', 'Protectorate entry fee'],
    cancellationPolicyHours: 24,
    timeSlots: ['08:30 AM']
  },
  {
    id: 'SKU-EXP-CLIMB-01',
    supplierId: 'SUP-SINAI-CLIMBING',
    serviceType: 'safari',
    title: 'Wadi Gnai Granite Climbing & Bouldering',
    titleAr: 'تسلق وبولدرينج على جرانيت وادي قني',
    description: 'Single-pitch sport routes and boulders on Wadi Gnai granite with a certified instructor. Ropes, harness, shoes and helmet provided.',
    routeFrom: 'Your Dahab hotel',
    routeTo: 'Wadi Gnai crag',
    durationMinutes: 240,
    basePriceEGP: 1600,
    currency: 'EGP',
    maxCapacityPerSlot: 6,
    active: true,
    includedItems: ['Certified climbing instructor', 'Harness, helmet, shoes and ropes', 'Return transfer', 'Water and dates'],
    cancellationPolicyHours: 24,
    timeSlots: ['07:30 AM', '03:00 PM']
  },
  {
    id: 'SKU-EXP-TWILAT-01',
    supplierId: 'SUP-SHEIKHSALEM-01',
    serviceType: 'safari',
    title: 'Mount Twilat Sunset, Bedouin Dinner & Stargazing',
    titleAr: 'غروب جبل الطويلات وعشاء بدوي ومشاهدة النجوم',
    description: 'A short climb to the Twilat ridge for sunset over the Gulf, then zarb cooked under the sand and an hour of stargazing away from town lights.',
    routeFrom: 'Your Dahab hotel',
    routeTo: 'Mount Twilat',
    durationMinutes: 210,
    basePriceEGP: 850,
    currency: 'EGP',
    maxCapacityPerSlot: 16,
    active: true,
    includedItems: ['Return 4x4 transfer', 'Bedouin host', 'Zarb dinner and tea', 'Stargazing session'],
    cancellationPolicyHours: 12,
    timeSlots: ['04:00 PM']
  },
  {
    id: 'SKU-EXP-BHSAFARI-01',
    supplierId: 'SUP-BEDOUINDRIVERS-01',
    serviceType: 'safari',
    title: 'Blue Hole & Abu Galum Protected Area Safari',
    titleAr: 'سفاري البلو هول ومحمية أبو جالوم',
    description: 'Jeep to the Blue Hole for a snorkel, then on foot or by camel along the coast trail into the Abu Galum protectorate.',
    routeFrom: 'Your Dahab hotel',
    routeTo: 'Blue Hole & Abu Galum',
    durationMinutes: 420,
    basePriceEGP: 550,
    currency: 'EGP',
    maxCapacityPerSlot: 7,
    active: true,
    includedItems: ['Return jeep transfer', 'Bedouin guide', 'Lunch in Abu Galum'],
    cancellationPolicyHours: 12,
    timeSlots: ['09:00 AM']
  },
  {
    id: 'SKU-EXP-QUADTWILAT-01',
    supplierId: 'SUP-MOTORSAFARI-01',
    serviceType: 'safari',
    title: 'Quad Bike Sunset Safari to Jabal Al-Tawilat',
    titleAr: 'سفاري الكواد وقت الغروب إلى جبل الطويلات',
    description: 'A guided quad convoy across the desert to Jabal Al-Tawilat for sunset, with tea at a Bedouin camp before riding back in the dusk.',
    routeFrom: 'Sinai Desert Motor Safari base',
    routeTo: 'Jabal Al-Tawilat',
    durationMinutes: 180,
    basePriceEGP: 350,
    currency: 'EGP',
    maxCapacityPerSlot: 10,
    active: true,
    includedItems: ['Quad bike and helmet', 'Lead rider', 'Tea at the Bedouin camp'],
    cancellationPolicyHours: 6,
    timeSlots: ['02:30 PM', '03:30 PM']
  },
  {
    id: 'SKU-EXP-WISHWASHI-01',
    supplierId: 'SUP-BEDOUINDRIVERS-01',
    serviceType: 'safari',
    title: 'Ras Shitan & Wadi El-Wishwashi Canyon Pool',
    titleAr: 'رأس شيطان ووادي الوشواشي والبركة الطبيعية',
    description: 'Drive north to Ras Shitan, then hike and scramble into the Wishwashi canyon to a rain-fed pool between granite walls.',
    routeFrom: 'Your Dahab hotel',
    routeTo: 'Wadi El-Wishwashi',
    durationMinutes: 480,
    basePriceEGP: 750,
    currency: 'EGP',
    maxCapacityPerSlot: 7,
    active: true,
    includedItems: ['Return 4x4 transfer', 'Bedouin guide', 'Lunch and water'],
    cancellationPolicyHours: 24,
    timeSlots: ['08:00 AM']
  },
  {
    id: 'SKU-EXP-3POOLSAFARI-01',
    supplierId: 'SUP-BEDOUINDRIVERS-01',
    serviceType: 'safari',
    title: 'Three Pools Snorkel & Southern Oasis Safari',
    titleAr: 'سنوركلينج الثلاث بحيرات وسفاري الواحة الجنوبية',
    description: 'A morning snorkelling the Three Pools, then inland by jeep to a palm oasis for a Bedouin lunch.',
    routeFrom: 'Your Dahab hotel',
    routeTo: 'Three Pools & southern oasis',
    durationMinutes: 360,
    basePriceEGP: 400,
    currency: 'EGP',
    maxCapacityPerSlot: 7,
    active: true,
    includedItems: ['Return jeep transfer', 'Snorkel gear', 'Bedouin lunch'],
    cancellationPolicyHours: 12,
    timeSlots: ['09:00 AM']
  },
  {
    id: 'SKU-EXP-WHITECANYON-01',
    supplierId: 'SUP-BEDOUINDRIVERS-01',
    serviceType: 'safari',
    title: 'White Canyon & Ain Khodra Oasis 4x4 Crossing',
    titleAr: 'عبور الكانيون الأبيض وواحة عين خضرة بالدفع الرباعي',
    description: 'A full desert day: walk the narrow White Canyon, climb out above it, and descend to the palms of Ain Khodra oasis.',
    routeFrom: 'Your Dahab hotel',
    routeTo: 'White Canyon & Ain Khodra',
    durationMinutes: 540,
    basePriceEGP: 1200,
    currency: 'EGP',
    maxCapacityPerSlot: 7,
    active: true,
    includedItems: ['Return 4x4 transfer', 'Bedouin guide', 'Lunch at the oasis', 'Water'],
    cancellationPolicyHours: 24,
    timeSlots: ['07:00 AM']
  },
  {
    id: 'SKU-EXP-DSD-01',
    supplierId: 'SUP-BLUEDIVERS-01',
    serviceType: 'diving',
    title: 'Discover Scuba Diving — First Shore Dive',
    titleAr: 'تجربة الغطس لأول مرة — غطسة شاطئية',
    description: 'A first breath underwater with an instructor beside you the whole time: pool-style skills in the shallows, then a gentle shore dive to 6–8 m.',
    routeFrom: 'Dahab Blue Divers Hub, Lighthouse',
    routeTo: 'Lighthouse Reef',
    durationMinutes: 120,
    basePriceEGP: 1450,
    currency: 'EGP',
    maxCapacityPerSlot: 4,
    active: true,
    includedItems: ['PADI instructor, one to two divers each', 'Full scuba equipment', 'Skills session in the shallows', 'Shore dive to 6–8 m'],
    cancellationPolicyHours: 24,
    timeSlots: ['09:00 AM', '11:30 AM', '02:30 PM']
  },
  {
    id: 'SKU-EXP-BELLSDIVE-01',
    supplierId: 'SUP-REDSEAMASTERS-01',
    serviceType: 'diving',
    title: 'Certified Guided Dive — The Bells to the Blue Hole Saddle',
    titleAr: 'غطسة إرشادية للمعتمدين — من البلز إلى سرج البلو هول',
    description: 'For certified divers: drop through the Bells chimney to 26 m and drift the wall to the Blue Hole saddle.',
    routeFrom: 'Sinai Red Sea Dive Masters, Lighthouse',
    routeTo: 'The Bells & Blue Hole',
    durationMinutes: 150,
    basePriceEGP: 1100,
    currency: 'EGP',
    maxCapacityPerSlot: 6,
    active: true,
    includedItems: ['Divemaster guide', 'Tank and weights', 'Transfer to the Bells'],
    cancellationPolicyHours: 24,
    timeSlots: ['08:00 AM', '11:00 AM']
  },
  {
    id: 'SKU-EXP-CAMELDIVE-01',
    supplierId: 'SUP-DIVE-02',
    serviceType: 'diving',
    title: 'Eco Camel Diving Safari to Ras Abu Galum (2 Dives)',
    titleAr: 'سفاري غطس بالجمال إلى رأس أبو جالوم (غطستان)',
    description: 'Your kit goes on camels, you walk the coast trail, and you dive two reefs inside the Ras Abu Galum protectorate that boats rarely reach.',
    routeFrom: 'Ras Abu Galum trailhead',
    routeTo: 'Ras Abu Galum Protectorate',
    durationMinutes: 480,
    basePriceEGP: 2400,
    currency: 'EGP',
    maxCapacityPerSlot: 6,
    active: true,
    includedItems: ['Two guided dives', 'Camels for the equipment', 'Full scuba equipment', 'Bedouin lunch'],
    cancellationPolicyHours: 48,
    timeSlots: ['07:30 AM']
  },
  {
    id: 'SKU-EXP-KITEPRIVATE-01',
    supplierId: 'SUP-LAGUNAKITE-01',
    serviceType: 'diving',
    title: 'Private 2-Hour Kitesurf Coaching on the Laguna',
    titleAr: 'تدريب كايت سيرف خاص لمدة ساعتين في اللاجونا',
    description: 'One-to-one IKO coaching on the Laguna flat water, from kite control on the beach to first rides, with radio helmet and rescue boat.',
    routeFrom: 'Laguna Wind & Kite Center',
    routeTo: 'Laguna flatwater',
    durationMinutes: 120,
    basePriceEGP: 2200,
    currency: 'EGP',
    maxCapacityPerSlot: 2,
    active: true,
    includedItems: ['IKO-certified instructor', 'Kite, board, harness and wetsuit', 'Radio helmet', 'Rescue boat cover'],
    cancellationPolicyHours: 24,
    timeSlots: ['10:00 AM', '01:00 PM', '03:30 PM']
  },
  {
    id: 'SKU-EXP-GLASSBOAT-01',
    supplierId: 'SUP-REDSEAMASTERS-01',
    serviceType: 'safari',
    title: 'Glass Bottom Boat Cruise over Napoleon Reef',
    titleAr: 'جولة القارب الزجاجي فوق شعاب نابليون',
    description: 'Ninety minutes over the Lighthouse and Napoleon reefs through a glass hull — the reef without getting wet, good for every age.',
    routeFrom: 'Lighthouse jetty',
    routeTo: 'Napoleon Reef',
    durationMinutes: 90,
    basePriceEGP: 350,
    currency: 'EGP',
    maxCapacityPerSlot: 20,
    active: true,
    includedItems: ['Boat and skipper', 'Reef commentary', 'Soft drinks'],
    cancellationPolicyHours: 6,
    timeSlots: ['10:00 AM', '12:30 PM', '03:00 PM']
  }
];

const ARABIC: Record<string, Pick<ProductSkuEntity, 'descriptionAr' | 'includedItemsAr'>> = {
  'SKU-EXP-EELSNORKEL-01': {
    descriptionAr: 'سنوركلينج هادئ مع مرشد فوق المنحدر الرملي في إيل جاردن، وقت الغروب حين تخرج ثعابين البحر من جحورها. النزول من الشاطئ، على بُعد ٨ دقائق سيرًا من اللايتهاوس.',
    includedItemsAr: ['مرشد سنوركلينج', 'نظارة وسنوركل وزعانف وسترة طفو', 'شرح قصير على الشاطئ عن حماية الشعاب']
  },
  'SKU-EXP-3POOLS-01': {
    descriptionAr: 'ثلاث بحيرات محمية جنوب دهب، فيها حدائق مرجانية قريبة من السطح. مياهها هادئة جدًا، ومناسبة للأطفال ولمن يجرّب السنوركلينج لأول مرة.',
    includedItemsAr: ['انتقال ذهاب وعودة بسيارة دفع رباعي', 'مرشد سنوركلينج', 'معدات سنوركلينج بمقاسات للكبار والأطفال', 'شاي بدوي في الظل']
  },
  'SKU-EXP-RAGBOAT-01': {
    descriptionAr: 'رحلة بالمركب على الساحل المحمي حتى رأس أبو جالوم، مع وقفتين للسنوركلينج وغداء سمك في القرية البدوية على الشاطئ.',
    includedItemsAr: ['المركب وقائده', 'وقفتان للسنوركلينج مع مرشد', 'غداء سمك في القرية البدوية', 'رسوم دخول المحمية']
  },
  'SKU-EXP-CLIMB-01': {
    descriptionAr: 'مسارات تسلق وبولدرينج على صخور الجرانيت في وادي قني، مع مدرب معتمد. كل المعدات متوفرة: الحبال والحزام والحذاء والخوذة.',
    includedItemsAr: ['مدرب تسلق معتمد', 'حزام وخوذة وحذاء تسلق وحبال', 'انتقال ذهاب وعودة', 'مياه وتمر']
  },
  'SKU-EXP-TWILAT-01': {
    descriptionAr: 'صعود قصير إلى قمة الطويلات لمشاهدة الغروب فوق الخليج، ثم عشاء زرب مطهو تحت الرمل، وساعة لمشاهدة النجوم بعيدًا عن أضواء المدينة.',
    includedItemsAr: ['انتقال ذهاب وعودة بسيارة دفع رباعي', 'مضيف بدوي', 'عشاء زرب وشاي', 'جلسة مشاهدة نجوم']
  },
  'SKU-EXP-BHSAFARI-01': {
    descriptionAr: 'انتقال بالجيب إلى البلو هول للسنوركلينج، ثم سير على الأقدام أو ركوب جمل على طريق الساحل إلى داخل محمية أبو جالوم.',
    includedItemsAr: ['انتقال ذهاب وعودة بالجيب', 'مرشد بدوي', 'غداء في أبو جالوم']
  },
  'SKU-EXP-QUADTWILAT-01': {
    descriptionAr: 'جولة كواد مع مرشد في الصحراء حتى جبل الطويلات وقت الغروب، ثم شاي في مخيم بدوي قبل العودة مع آخر ضوء النهار.',
    includedItemsAr: ['دراجة كواد وخوذة', 'مرشد يقود المجموعة', 'شاي في المخيم البدوي']
  },
  'SKU-EXP-WISHWASHI-01': {
    descriptionAr: 'انتقال شمالًا إلى رأس شيطان، ثم مشي وتسلق خفيف داخل وادي الوشواشي حتى بركة مياه الأمطار بين جدران الجرانيت.',
    includedItemsAr: ['انتقال ذهاب وعودة بسيارة دفع رباعي', 'مرشد بدوي', 'غداء ومياه']
  },
  'SKU-EXP-3POOLSAFARI-01': {
    descriptionAr: 'صباح للسنوركلينج في البحيرات الثلاث، ثم رحلة بالجيب إلى واحة نخيل وغداء بدوي.',
    includedItemsAr: ['انتقال ذهاب وعودة بالجيب', 'معدات سنوركلينج', 'غداء بدوي']
  },
  'SKU-EXP-WHITECANYON-01': {
    descriptionAr: 'يوم كامل في الصحراء: مشي داخل الكانيون الأبيض الضيق، ثم صعود إلى أعلاه، ونزول إلى نخيل واحة عين خضرة.',
    includedItemsAr: ['انتقال ذهاب وعودة بسيارة دفع رباعي', 'مرشد بدوي', 'غداء في الواحة', 'مياه']
  },
  'SKU-EXP-DSD-01': {
    descriptionAr: 'أول تجربة تنفس تحت الماء، والمدرب بجانبك طوال الوقت: تدريب على المهارات في المياه الضحلة، ثم غطسة هادئة من الشاطئ لعمق ٦–٨ أمتار.',
    includedItemsAr: ['مدرب PADI لكل غطاس أو اثنين', 'معدات غطس كاملة', 'تدريب على المهارات في المياه الضحلة', 'غطسة من الشاطئ لعمق ٦–٨ أمتار']
  },
  'SKU-EXP-BELLSDIVE-01': {
    descriptionAr: 'للغطاسين الحاصلين على شهادة: نزول من فتحة البلز لعمق ٢٦ مترًا، ثم انجراف بجانب الجدار المرجاني حتى سرج البلو هول.',
    includedItemsAr: ['مرشد غطس (دايف ماستر)', 'أسطوانة وأوزان', 'انتقال إلى البلز']
  },
  'SKU-EXP-CAMELDIVE-01': {
    descriptionAr: 'تُحمَل معداتك على الجمال وأنت تسير على طريق الساحل، ثم تغطس في شعبتين داخل محمية رأس أبو جالوم، نادرًا ما تصل إليهما المراكب.',
    includedItemsAr: ['غطستان مع مرشد', 'جمال لنقل المعدات', 'معدات غطس كاملة', 'غداء بدوي']
  },
  'SKU-EXP-KITEPRIVATE-01': {
    descriptionAr: 'درس كايت خاص مع مدرب IKO في مياه اللاجونا الهادئة: من التحكم في الطائرة على الشاطئ حتى أول وقوف على اللوح، مع خوذة لاسلكية وقارب إنقاذ.',
    includedItemsAr: ['مدرب معتمد من IKO', 'طائرة ولوح وحزام وبدلة', 'خوذة لاسلكية', 'قارب إنقاذ طوال الدرس']
  },
  'SKU-EXP-GLASSBOAT-01': {
    descriptionAr: 'تسعون دقيقة فوق شعاب اللايتهاوس ونابليون في قارب بقاع زجاجي. ترى الشعاب بوضوح دون أن تنزل إلى الماء، ومناسبة لكل الأعمار.',
    includedItemsAr: ['القارب وقائده', 'شرح عن الشعاب', 'مشروبات']
  }
};

const MEETING_POINT_AR: Readonly<Record<string, string>> = {
  'Dahab Blue Divers Hub, Lighthouse': 'مركز دهب بلو دايفرز، اللايتهاوس',
  'Sinai Red Sea Dive Masters, Lighthouse': 'مركز سيناء رد سي دايف ماسترز، اللايتهاوس',
  'Your Dahab hotel': 'فندقك في دهب',
  'Lighthouse jetty': 'رصيف اللايتهاوس',
  'Sinai Desert Motor Safari base': 'مقر سيناء ديزرت موتور سفاري',
  'Ras Abu Galum trailhead': 'بداية مدق رأس أبو جالوم',
  'Laguna Wind & Kite Center': 'مركز لاجونا للرياح والكايت',
  'Sinai Divers Dive Center': 'مركز سيناء دايفرز',
  'Dahab Pick-up Point': 'نقطة التجمع في دهب',
  'Sharm El Sheikh Intl Airport (SSH)': 'مطار شرم الشيخ الدولي'
};

/** Arabic meeting point for an SKU's English `routeFrom`, when one is known. */
export const meetingPointArOf = (routeFrom?: string): string | undefined =>
  routeFrom ? MEETING_POINT_AR[routeFrom] : undefined;

export const EXPERIENCE_SKUS: ProductSkuEntity[] = SKUS.map(sku => ({
  ...sku,
  ...ARABIC[sku.id],
  ...(meetingPointArOf(sku.routeFrom) ? { routeFromAr: meetingPointArOf(sku.routeFrom) } : {})
}));

/**
 * Departures for SKUs seeded elsewhere that catalogue activities now sell.
 * Without them availability falls back to the service type's generic times,
 * which labels a kite session "Morning Dive".
 */
export const EXISTING_SKU_TIME_SLOTS: Readonly<Record<string, string[]>> = {
  'SKU-NOW-KITE-01': ['10:00 AM', '01:00 PM', '03:30 PM'],
  'SKU-DIV-001': ['08:30 AM', '01:30 PM'],
  'SKU-DIV-002': ['08:00 AM'],
  'SKU-SAF-001': ['11:00 PM']
};

/**
 * Catalogue activity → the product that sells it. Activities that are the
 * same product share a SKU (the two Wadi Gnai climbing entries, the two
 * Laguna kite sessions).
 */
export const EXPERIENCE_SKU_BY_ACTIVITY: Readonly<Record<string, string>> = {
  act_eel_garden_sunset_snorkel: 'SKU-EXP-EELSNORKEL-01',
  act_three_pools_guided_snorkel: 'SKU-EXP-3POOLS-01',
  act_ras_abu_galum_boat_safari: 'SKU-EXP-RAGBOAT-01',
  act_wadi_gnai_rock_climbing: 'SKU-EXP-CLIMB-01',
  'ACT-WADI-GNAI-CLIMBING': 'SKU-EXP-CLIMB-01',
  act_mount_twilat_bedouin_stargazing: 'SKU-EXP-TWILAT-01',
  // SKU-NOW-KITE-01 is the Book Now card for exactly this: a Laguna session with gear.
  act_laguna_windsurf_session: 'SKU-NOW-KITE-01',
  'ACT-LAGUNA-KITESURF': 'SKU-EXP-KITEPRIVATE-01',
  'ACT-BLUE-HOLE-SAFARI': 'SKU-EXP-BHSAFARI-01',
  'ACT-QUAD-TWILAT': 'SKU-EXP-QUADTWILAT-01',
  'ACT-WISHWASHI-EXPEDITION': 'SKU-EXP-WISHWASHI-01',
  'ACT-THREE-POOLS-SAFARI': 'SKU-EXP-3POOLSAFARI-01',
  // SKU-SAF-001 is the same Mount Moses sunrise ascent and monastery visit.
  'ACT-MOUNT-MOSES-TREK': 'SKU-SAF-001',
  'ACT-WHITE-CANYON-SAFARI': 'SKU-EXP-WHITECANYON-01',
  'ACT-INTRO-DISCOVER-DIVE': 'SKU-EXP-DSD-01',
  'ACT-BLUE-HOLE-BELLS-DIVE': 'SKU-EXP-BELLSDIVE-01',
  'ACT-CAMEL-DIVING-SAFARI': 'SKU-EXP-CAMELDIVE-01',
  'ACT-GLASS-BOTTOM-BOAT': 'SKU-EXP-GLASSBOAT-01'
};
