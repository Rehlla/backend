import { NEAR_ME_DATA } from '../components/explore/ExploreView';
import type { DahabActivity, DahabPlace, DahabDiningVenue, ResolvedBookability } from '../shared/types/knowledge';
import { photoForActivity, experienceSlugForActivity } from '../data/activityPhotos';
import { IMG_P1507525428034b723cf961d3e_CARD, IMG_P1507525428034b723cf961d3e_HERO, IMG_P1511671782779c97d3d27a1d4_HERO, IMG_P15172481354674c7edcad34c4_CARD, IMG_P15172481354674c7edcad34c4_HERO, IMG_P154455176346a013bb70d5_CARD, IMG_P154455176346a013bb70d5_HERO, IMG_P15541188111e0d58224f24_CARD, IMG_P15541188111e0d58224f24_HERO, IMG_P16826872200634742bd7fd538_CARD, IMG_P16826872200634742bd7fd538_HERO } from '../shared/placeholderImagery';

export interface ExperienceDetailData {
  id: string;
  slug: string;
  /**
   * The corpus activity this editorial entry describes, when one exists.
   *
   * Curated entries are written by hand and keyed by slug ('blue-hole') while
   * the catalogue keys by activity id ('act_blue_hole_safari_dive'), so the
   * link has to be stated rather than derived from the strings.
   */
  activityId?: string;
  /**
   * What it takes to sell this experience, resolved by the server from the
   * commerce catalogue — null when it cannot be booked online.
   *
   * Until this existed there was no route at all from an experience to a
   * booking: Explore sold slugs, checkout accepted only SKUs, and nothing
   * mapped between them. Prefer `bookable.basePriceEGP` over the editorial
   * `basePriceEGP` below wherever a price leads to a checkout, because the
   * bookable one is what gets charged.
   */
  bookable?: ResolvedBookability | null;
  titleEn: string;
  titleAr: string;
  taglineEn: string;
  taglineAr: string;
  descriptionEn: string;
  descriptionAr: string;
  category: 'diving' | 'safari' | 'beach' | 'food' | 'coffee' | 'nightlife' | 'wellness' | 'culture' | 'water_sport';
  categoryLabelEn: string;
  categoryLabelAr: string;
  heroImage: string;
  galleryImages: string[];
  locationEn: string;
  locationAr: string;
  coordinates?: { lat: number; lng: number };
  durationEn: string;
  durationAr: string;
  durationMinutes: number;
  difficultyEn: string;
  difficultyAr: string;
  intensityScore: number; // 1-5
  accessMethodEn: string;
  accessMethodAr: string;
  openHoursEn: string;
  openHoursAr: string;
  basePriceEGP: number;
  priceLevel: '$' | '$$' | '$$$';
  verifiedBadgeEn: string;
  verifiedBadgeAr: string;
  localGuideInsightEn: string;
  localGuideInsightAr: string;
  highlightsEn: string[];
  highlightsAr: string[];
  includedEn: string[];
  includedAr: string[];
  notIncludedEn: string[];
  notIncludedAr: string[];
  preparationTipsEn: string[];
  preparationTipsAr: string[];
  environmentalSignals: {
    waterTemp: string;
    visibility: string;
    windCondition: string;
    bestTide: string;
  };
  /**
   * The conditions the operator runs this in, from the catalogue's own limits.
   * When present they replace `environmentalSignals`, which on a catalogue
   * activity would be the same made-up readings on every page.
   */
  conditionsEn?: string[];
  conditionsAr?: string[];
}

// Curated high-res curated experiences database
export const CURATED_EXPERIENCES: ExperienceDetailData[] = [
  {
    id: 'near-blue-hole',
    slug: 'blue-hole',
    activityId: 'act_blue_hole_safari_dive',
    titleEn: 'Blue Hole & Bells Marine Sanctuary',
    titleAr: 'محمية البلو هول والبلز للغطس الحر',
    taglineEn: 'World-renowned 120m submarine sinkhole with vertical coral drop-offs.',
    taglineAr: 'الثقب الأزرق الأسطوري بعمق ١٢٠ متراً وجدران مرجانية عمودية تبهر الغطاسين من كل أنحاء العالم.',
    descriptionEn: 'The Blue Hole is Dahab’s most famous marine landmark — a submarine sinkhole dropping 120 meters directly into the deep azure Gulf of Aqaba. The dive starts at "The Bells", a chimney-like opening in the reef wall where you drop down to 26 meters, followed by a gentle drift along a breathtaking vertical coral wall teeming with clownfish, sea turtles, and anthias.',
    descriptionAr: 'البلو هول هو أشهر معلم بحري في دهب والعالم — حفرة غائرة في الشعاب المرجانية بعمق يصل إلى ١٢٠ متراً وسط زرقة خليج العقبة الخلابة. تبدأ المغامرة من منطقة "البلز" (The Bells)، وهي فتحة عمودية في جدار الشعب تنزل فيها حتى عمق ٢٦ متراً، ثم تنجرف بلطف مع التيار بمحاذاة جدار مرجاني ساحر غني بالسلاحف وسمك نيمو والشعب النادرة.',
    category: 'diving',
    categoryLabelEn: 'World Heritage Marine Sanctuary',
    categoryLabelAr: 'محمية بحرية عالمية',
    heroImage: '/images/hero/blue-hole-signature.jpg',
    galleryImages: [
      IMG_P154455176346a013bb70d5_CARD,
      IMG_P1507525428034b723cf961d3e_CARD
    ],
    locationEn: 'North Dahab Coastal Protected Zone (15 min 4x4 from Lighthouse)',
    locationAr: 'شمال دهب (منطقة المحميات الساحلية · ١٥ دقيقة بالسيارة من اللايتهاوس)',
    coordinates: { lat: 28.5724, lng: 34.5369 },
    durationEn: '3 hours',
    durationAr: '٣ ساعات',
    durationMinutes: 180,
    difficultyEn: 'Intermediate to Advanced (Snorkeling: All Levels)',
    difficultyAr: 'متوسط إلى متقدم (السنوركلينج متاح للجميع)',
    intensityScore: 4,
    accessMethodEn: 'Shore Entry via The Bells / Bedouin 4x4 Transfer',
    accessMethodAr: 'نزول شاطئي من منطقة البلز · سيارة دفع رباعي بدوية',
    openHoursEn: '08:00 AM – 05:00 PM (Best in morning sunlight)',
    openHoursAr: '٠٨:٠٠ ص – ٠٥:٠٠ م (أفضل وقت صباحاً مع سطوع الشمس)',
    basePriceEGP: 850,
    priceLevel: '$$$',
    verifiedBadgeEn: 'Vetted Master Divemaster & Bedouin Host',
    verifiedBadgeAr: 'دليل غطس معتمد ومضيف بدوي محلي',
    localGuideInsightEn: 'Arrive before 10:00 AM to beat the day-trip crowds from Sharm. The light beams slicing through The Bells chimney in the morning create unbeatable underwater photography conditions.',
    localGuideInsightAr: 'تعال قبل الساعة ١٠ الصبح عشان تتفادى زحمة الرحلات اليومية من شرم الشيخ. أشعة الشمس اللي بتخترق ممر البلز الصبح بتعمل إضاءة خرافية للتصوير تحت المية.',
    highlightsEn: [
      'The dramatic 26m vertical drop down The Bells chimney',
      'Pristine coral wall drift along the outer barrier reef',
      'Snorkeling the protected inner Blue Hole saddle',
      'Bedouin seafront tea and shade lounges at the water’s edge'
    ],
    highlightsAr: [
      'النزول العمودي المثير في ممر البلز حتى عمق ٢٦ متراً',
      'الانجراف السلس بمحاذاة جدار المرجان الخارجي الشاهق',
      'سنوركلينج ممتع في سرج البلو هول المحمي وهادئ الأمواج',
      'شاي بدوي على البحر وقعدات خشبية مريحة بعد النزلة'
    ],
    includedEn: [
      'Certified PADI/SSI Divemaster or Snorkel Guide',
      'Full Snorkeling gear (mask, snorkel, fins, safety float)',
      '4x4 Jeep transfer round-trip from your Dahab hotel',
      'Bedouin tea & shaded seafront seat reservation'
    ],
    includedAr: [
      'مرشد غطس وسنوركلينج محترف ومعتمد',
      'طقم سنوركلينج كامل (نظارة، قصبة، زعانف وسترة أمان)',
      'انتقالات ذهاب وعودة بسيارة جيب 4x4 من مكان إقامتك في دهب',
      'شاي أعشاب بدوي وقعدة مريحة على البحر'
    ],
    notIncludedEn: [
      'Protected Area National Park Entry Ticket (approx. 100-200 EGP)',
      'Scuba tanks & BCD weights (available as dive add-on)',
      'Seafood lunch (optional at partner seaside tables)'
    ],
    notIncludedAr: [
      'تذكرة دخول المحمية الطبيعية (حوالي ١٠٠ - ٢٠٠ ج.م)',
      'معدات الغوص الاسكوبا (متاحة كإضافة للغواصين المرخصين)',
      'وجبة الغداء (اختيارية في مطاعم الشاطئ الشريكة)'
    ],
    preparationTipsEn: [
      'Bring reef-safe mineral sunscreen, dry bag, and swimwear',
      'Water shoes/booties are recommended for walking on pebble entries',
      'Ensure at least 18-24 hours surface interval before flying if diving'
    ],
    preparationTipsAr: [
      'احرص على إحضار واقي شمس صديق للبيئة، شنطة ضد المية، ومايوه',
      'يُفضل ارتداء حذاء بحر مريح للنزول من الشاطئ الصخري',
      'اترك فاصل زمني ١٨ إلى ٢٤ ساعة على الأقل بين الغوص وموعد طيرانك'
    ],
    environmentalSignals: {
      waterTemp: '24°C – 27°C',
      visibility: '30+ meters',
      windCondition: 'Calm & Sheltered in Bay',
      bestTide: 'High to Mid Tide'
    }
  },
  {
    id: 'near-lighthouse-reef',
    slug: 'lighthouse-reef',
    activityId: 'act_lighthouse_guided_dive',
    titleEn: 'Lighthouse Reef Shore Entry',
    titleAr: 'شاطئ ورصيف اللايتهاوس للغطس والسنوركلينج',
    taglineEn: 'The beating heart of Dahab shore diving, right on the lively promenade.',
    taglineAr: 'أسهل نزلة بحر شاطئية في دهب؛ مياه هادية، شعب مرجانية ملونة وخطوات من الممشى.',
    descriptionEn: 'Lighthouse Bay is Dahab’s most accessible and beloved reef. Sloping gently from shallow sandy entries into vibrant coral gardens, it offers effortless snorkeling, world-class freediving lines, and nocturnal night dives where Spanish dancers, octopus, and moray eels emerge under dive torch beams.',
    descriptionAr: 'خليج اللايتهاوس هو الرئة الحيوية لدهب وأسهل شاطئ لنزول البحر. ينحدر القاع الرملي برفق نحو حدائق مرجانية مبهجة، مما يجعله مثالياً للسباحة، السنوركلينج، تدريبات الغوص الحر، وأروع الغطسات الليلية لرؤية الأخطبوط والرقاصة الإسبانية تحت كشافات الغطس.',
    category: 'beach',
    categoryLabelEn: 'Promenade Shore Reef',
    categoryLabelAr: 'شاطئ وشعاب الممشى السياحي',
    heroImage: '/images/attractions/lighthouse-reef.jpg',
    galleryImages: [
      IMG_P1507525428034b723cf961d3e_CARD,
      IMG_P15541188111e0d58224f24_CARD
    ],
    locationEn: 'Lighthouse Bay Promenade, Central Dahab',
    locationAr: 'ممشى خليج اللايتهاوس، وسط دهب',
    coordinates: { lat: 28.5028, lng: 34.5204 },
    durationEn: '1.5 - 2 hours',
    durationAr: 'ساعة ونصف إلى ساعتين',
    durationMinutes: 100,
    difficultyEn: 'All Levels (Beginner Friendly)',
    difficultyAr: 'جميع المستويات (مناسب جداً للمبتدئين)',
    intensityScore: 2,
    accessMethodEn: 'Direct Shore Walk-In from Sandy Steps',
    accessMethodAr: 'نزول مباشر من الشاطئ الرملي بخطوات بسيطة',
    openHoursEn: 'Open 24/7 (Daylight for coral, Night for nocturnal life)',
    openHoursAr: 'مفتوح دائماً (النهار لرؤية الشعب والليل للكائنات الليلية)',
    basePriceEGP: 250,
    priceLevel: '$',
    verifiedBadgeEn: 'Verified Public Shore Entry & Dive Center Hub',
    verifiedBadgeAr: 'شاطئ عام موثق ومحيط بمراكز الغطس المعتمدة',
    localGuideInsightEn: 'The south corner near the sandy slope is where sea turtles often feed on seagrass around 3:00 PM. Slip in quietly without splashing to swim beside them.',
    localGuideInsightAr: 'الركن الجنوبي جنب المنحدر الرملي بتيجي فيه سلاحف البحر تتغذى ع الأعشاب حوالي الساعة ٣ العصر. انزل بهدوء من غير طرطشة وهتعوم جنبها على بعد متر.',
    highlightsEn: [
      'Effortless sandy walk-in entry with zero current friction',
      'Vibrant table corals, lionfish, and curious sea turtles',
      'Direct adjacency to Lighthouse cafes for post-swim coffee',
      'Ideal training ground for first-time snorkelers and freedivers'
    ],
    highlightsAr: [
      'نزول سهل وسلس من الرمل بدون أي تيارات متعبة',
      'شعب مرجانية متفرقة، سمك الفراشة وسلاحف بحرية لطيفة',
      'على بعد خطوات من كافيهات الممشى عشان تشرب قهوتك بعد العومة',
      'المكان المثالي لتجربة السنوركلينج الأولى والغوص الحر'
    ],
    includedEn: [
      'Orientation map & marine safety briefing',
      'Full snorkel gear & buoyancy vest',
      'Reserved beachfront sun lounger at partner cafe'
    ],
    includedAr: [
      'خريطة إرشادية وتعليمات السلامة وحماية الشعب',
      'طقم سنوركلينج كامل مع سترة طفو',
      'حجز شلتة ومظلة مريحة على البحر في الكافيه الشريك'
    ],
    notIncludedEn: [
      'Underwater GoPro photo package (optional)',
      'Food & beverage orders from cafe menu'
    ],
    notIncludedAr: [
      'جلسة تصوير احترافية بكاميرا جوبرو تحت المية (اختيارية)',
      'الطلبات الإضافية من منيو الكافيه'
    ],
    preparationTipsEn: [
      'Never stand on the living coral reefs',
      'Keep your belongings safe at partner locker stations'
    ],
    preparationTipsAr: [
      'ممنوع منعاً باتاً الوقوف على الشعاب المرجانية الحية',
      'استخدم خزائن الأمانات المتوفرة لحفظ متعلقاتك وموبايلك'
    ],
    environmentalSignals: {
      waterTemp: '25°C',
      visibility: '25 meters',
      windCondition: 'Mild Coastal Breeze',
      bestTide: 'Any Tide (High Tide Optimal)'
    }
  },
  {
    id: 'near-ralphs',
    slug: 'ralphs-german-bakery',
    titleEn: "Ralph's German Bakery & Courtyard",
    titleAr: 'مخبز رالف الألماني والحديقة الهادئة',
    taglineEn: 'Artisan sourdough, apple strudels, pretzels, and fresh Sinai organic infusions.',
    taglineAr: 'أشهر مخبز في دهب للعيش الساوردو الفريش، فطيرة التفاح (أبل شترودل)، وشاي الأعشاب السيناوية.',
    descriptionEn: 'A Dahab institution since the early days of coastal travel, Ralph’s German Bakery is the undisputed breakfast destination of the town. Nestled in a shaded, plant-filled courtyard, master bakers craft authentic German rye breads, butter pretzels, flaky croissants, and homemade seasonal jams every morning.',
    descriptionAr: 'أحد معالم دهب الأصيلة ومحطة الفطار الأولى لكل زوار المدينة. وسط حديقة مظللة بالأشجار والنباتات، يُخبز العيش الألماني الطبيعي، البريتزل الطازج، الكرواسون الهش، وتُقدم مربى الفواكه الطبيعية مع القهوة الفريش وعصائر الصباح.',
    category: 'coffee',
    categoryLabelEn: 'Artisan Bakery & Cafe',
    categoryLabelAr: 'مخبز يدوي وكافيه روقان',
    heroImage: IMG_P15541188111e0d58224f24_HERO,
    galleryImages: [
      IMG_P15172481354674c7edcad34c4_CARD
    ],
    locationEn: 'Lighthouse Area, 2 min walk from shore',
    locationAr: 'منطقة اللايتهاوس، دقيقتان مشي من الشاطئ',
    coordinates: { lat: 28.5034, lng: 34.5192 },
    durationEn: '45 - 60 min',
    durationAr: '٤٥ - ٦٠ دقيقة',
    durationMinutes: 60,
    difficultyEn: 'All Levels (Relaxed Dining)',
    difficultyAr: 'للجميع (فطار وقهوة بروقان)',
    intensityScore: 1,
    accessMethodEn: 'Easy Promenade Walk',
    accessMethodAr: 'تمشية خفيفة على الممشى',
    openHoursEn: '07:00 AM – 10:00 PM',
    openHoursAr: '٠٧:٠٠ ص – ١٠:٠٠ م',
    basePriceEGP: 220,
    priceLevel: '$$',
    verifiedBadgeEn: 'Verified Dahab Culinary Landmark',
    verifiedBadgeAr: 'معلم طعام معتمد وأصيل في دهب',
    localGuideInsightEn: 'The warm apple strudel straight out of the morning oven with a scoop of vanilla ice cream is legendary. Go early around 8:30 AM for the freshest bread selection.',
    localGuideInsightAr: 'فطيرة التفاح السخنة من الفرن مع بولة آيس كريم فانيليا متتفوتش. تعال بدري حوالي ٨:٣٠ الصبح عشان تلحق تشكيلة العيش الساوردو السخنة.',
    highlightsEn: [
      'Fresh daily baked German sourdough loaves and baguettes',
      'Warm apple strudel and Bavarian salted pretzels',
      'Quiet shaded inner garden away from coastal wind',
      'Specialty coffee and organic herbal tea blends'
    ],
    highlightsAr: [
      'عيش ساوردو ألماني وباجيت فريش يومياً من الفرن',
      'فطيرة تفاح ساخنة وبريتزل بافاري بالزبدة والملح الخشن',
      'قعدة جنينة داخلية هادية ومظللة بعيد عن هواء البحر',
      'قهوة اسبريسو وشاي أعشاب سيناوية طبيعية'
    ],
    includedEn: [
      'Table seating in garden terrace',
      'High-speed WiFi for digital nomads'
    ],
    includedAr: [
      'قعدة في الحديقة الخارجية المظللة',
      'إنترنت واي فاي سريع للمسافرين وأصحاب العمل عن بعد'
    ],
    notIncludedEn: [
      'Food and drink items ordered from menu',
      'Takeaway bakery loaves'
    ],
    notIncludedAr: [
      'الطلبات والمشروبات حسب اختيارك من المنيو',
      'شراء العيش والمخبوزات تيك أواي'
    ],
    preparationTipsEn: [
      'Cash and local debit/credit cards accepted',
      'Arrive early on weekend mornings to secure outdoor garden tables'
    ],
    preparationTipsAr: [
      'يقبل الدفع كاش أو بالفيزا والماستركارد',
      'في الويك إند يفضل الحضور قبل ٩ الصبح لتلاقي طاولة في الحديقة'
    ],
    environmentalSignals: {
      waterTemp: 'N/A',
      visibility: 'N/A',
      windCondition: 'Sheltered Garden Court',
      bestTide: 'Anytime (Morning Peak)'
    }
  },
  {
    id: 'near-ali-baba',
    slug: 'ali-baba-seafood',
    titleEn: 'Ali Baba Waterfront Restaurant & Bedouin Grill',
    titleAr: 'مطعم علي بابا ع الممشى والمشاوي البدوية',
    taglineEn: 'Pick your fresh Red Sea catch from the ice counter, grilled over open charcoal by the waves.',
    taglineAr: 'اختار سمكتك الطازة من التلج مباشرة، وتتشوي ع الفحم وتجيلك على طاولة ممتدة ع البحر.',
    descriptionEn: 'Overlooking the gentle night waves of Dahab bay, Ali Baba offers the quintessential Sinai seafood ritual. Guests choose their fish, squid, and shrimp directly from a crushed-ice display freshly caught by local Bedouin fishermen, paired with rich seafood soup, sesame tahini, hot flatbreads, and fragrant spiced rice.',
    descriptionAr: 'مباشرة أمام أمواج خليج دهب الهادئة، يقدم علي بابا طقوس عشاء السمك السيناوي الأصيل. يختار الضيوف سمكهم والجمبري والكاليماري الطازج من فرش الثلج صيد اليوم بواسطة الصيادين المحليين، ليُشوى على الفحم ويُقدم مع شوربة السي فود الغنية، الطحينة، والخبز الساخن.',
    category: 'food',
    categoryLabelEn: 'Seafood & Bedouin Waterfront Grill',
    categoryLabelAr: 'سي فود ومشاوي ع البحر',
    heroImage: IMG_P15172481354674c7edcad34c4_HERO,
    galleryImages: [
      IMG_P15541188111e0d58224f24_CARD
    ],
    locationEn: 'Lighthouse Promenade, Beachfront',
    locationAr: 'ممشى اللايتهاوس السياحي، على البحر مباشرة',
    coordinates: { lat: 28.5041, lng: 34.5211 },
    durationEn: '1.5 - 2 hours',
    durationAr: 'ساعة ونصف إلى ساعتين',
    durationMinutes: 100,
    difficultyEn: 'All Levels (Dining Experience)',
    difficultyAr: 'للجميع (عشاء بحري مميز)',
    intensityScore: 1,
    accessMethodEn: 'Beachfront Promenade Stroll',
    accessMethodAr: 'تمشية على ممشى الشاطئ',
    openHoursEn: '12:00 PM – 12:00 AM (Dinner by torchlight)',
    openHoursAr: '١٢:٠٠ ظ – ١٢:٠٠ منتصف الليل (عشاء على ضوء المشاعل)',
    basePriceEGP: 480,
    priceLevel: '$$',
    verifiedBadgeEn: 'Verified Daily Fresh Catch & Fair Pricing',
    verifiedBadgeAr: 'صيد يومي طازج وأسعار وزن عادلة وموثقة',
    localGuideInsightEn: 'Ask for the grilled Sea Bass (Qarous) "Singary" style with lemon, garlic, and fresh Sinai herbs. Sit at the low carpeted cushions right above the waterline for sunset.',
    localGuideInsightAr: 'اطلب سمك القاروص المشوي "سنجاري" بالليمون والثوم وأعشاب سيناء. اختار القعدة العربي المنخفضة ع البحر مباشرة وقت الغروب لمنظر ساحر.',
    highlightsEn: [
      'Choice of fresh Red Sea fish weighed and priced transparently in front of you',
      'Charcoal grill cooking infused with olive wood and Bedouin spices',
      'Waterfront low-cushion seating lit by lanterns and candlelight',
      'Includes complimentary hot seafood bisque and salad mezzes'
    ],
    highlightsAr: [
      'اختيار السمك الطازة والوزن بشفافية قدامك بالجرام',
      'شواء على الفحم الطبيعي وخشب الزيتون ببهارات بدوية',
      'طاولات وشلتات ممتدة ع البحر مضاءة بالفوانيس والشموع',
      'شوربة سي فود ومقبلات طحينة وسلطة بلدي مع الوجبة'
    ],
    includedEn: [
      'Reserved beachfront table by the waves',
      'Seafood soup and fresh bread appetizer',
      'Dedicated local table service'
    ],
    includedAr: [
      'حجز طاولة بحرية مميزة على الممشى مباشرة',
      'شوربة سي فود ومقبلات وعيش ساخن',
      'خدمة وضيافة محلية ممتازة'
    ],
    notIncludedEn: [
      'Fish weighed by kilo (priced transparently by weight)',
      'Specialty mocktails and desserts'
    ],
    notIncludedAr: [
      'سعر السمك حسب الوزن المختار بالجرام',
      'العصائر والمشروبات الخاصة والحلويات'
    ],
    preparationTipsEn: [
      'Reservations recommended for prime waterfront front-row tables at sunset',
      'Vegetarian and chicken grill options available for non-seafood eaters'
    ],
    preparationTipsAr: [
      'يُفضل الحجز المسبق لطاولات الصف الأول ع البحر وقت الغروب',
      'تتوفر خيارات مشاوي دجاج وخضار للأشخاص النباتيين'
    ],
    environmentalSignals: {
      waterTemp: 'N/A',
      visibility: 'N/A',
      windCondition: 'Pleasant Waterfront Breeze',
      bestTide: 'Sunset & Evening'
    }
  },
  {
    id: 'near-everyday-cafe',
    slug: 'everyday-cafe',
    titleEn: 'Everyday Cafe & Acoustic Starlight Lounge',
    titleAr: 'إيفري داي كافيه وسهرات العود على البحر',
    taglineEn: 'Iconic seafront terrace with over-water swings, live acoustic melodies, and Bedouin habaq tea.',
    taglineAr: 'قعدة مريحة على البحر ومراجيح خشبية فوق المية، وعزف عود وجيتار هادئ مع شاي المرمية والشيشة.',
    descriptionEn: 'Perched directly above the tidal waters of Mashraba, Everyday Cafe is where Dahab slows to its most tranquil cadence. With hanging wooden swings over the tide, colorful Sinai carpets, live acoustic oud performances, and herbal Bedouin infusions, it is the ultimate evening retreat.',
    descriptionAr: 'مباشرة فوق مياه المشربة، يقدم إيفري داي كافيه روقان دهب الحقيقي في أبهى صوره. مراجيح خشبية فوق مياه المد، شلتات وسجاد سيناوي مريح، عزف حي لآلة العود والجيتار تحت النجوم، وألذ شاي بالحبق والمرمية والليمون بالنعناع.',
    category: 'nightlife',
    categoryLabelEn: 'Acoustic Music & Sea Terrace',
    categoryLabelAr: 'تراس بحري وموسيقى لايف',
    heroImage: IMG_P1511671782779c97d3d27a1d4_HERO,
    galleryImages: [
      IMG_P15541188111e0d58224f24_CARD
    ],
    locationEn: 'Mashraba Promenade, South Dahab Shore',
    locationAr: 'ممشى المشربة، جنوب شاطئ دهب',
    coordinates: { lat: 28.4982, lng: 34.5165 },
    durationEn: '1 - 3 hours',
    durationAr: 'ساعة إلى ٣ ساعات',
    durationMinutes: 120,
    difficultyEn: 'All Levels (Evening Chill)',
    difficultyAr: 'للجميع (سهرة وروقان)',
    intensityScore: 1,
    accessMethodEn: 'Promenade Walkway',
    accessMethodAr: 'تمشية على الممشى',
    openHoursEn: '08:00 AM – 01:30 AM (Live music starts 08:30 PM)',
    openHoursAr: '٠٨:٠٠ ص – ٠١:٣٠ ص (المزيكا اللايف تبدأ ٠٨:٣٠ م)',
    basePriceEGP: 150,
    priceLevel: '$$',
    verifiedBadgeEn: 'Verified Local Cultural Venue',
    verifiedBadgeAr: 'مكان فني وثقافي محلي معتمد',
    localGuideInsightEn: 'Grab the over-water swing seats at around 05:30 PM to watch the sunset paint the Saudi Arabian mountain ridges pink across the Gulf.',
    localGuideInsightAr: 'اقعد في المراجيح الخشبية فوق المية حوالي ٥:٣٠ المغرب عشان تشوف جبال السعودية بتتلون باللون الوردي والذهبي عبر الخليج.',
    highlightsEn: [
      'Over-water wooden swings suspended over gentle sea waves',
      'Daily acoustic oud and guitar performances under the stars',
      'Authentic Bedouin tea brewed with fresh habaq and marmareya herbs',
      'Fresh fruit smoothies and organic cinnamon Turkish coffees'
    ],
    highlightsAr: [
      'مراجيح خشبية معلقة فوق أمواج البحر مباشرة',
      'عزف عود وجيتار هادئ يومياً تحت النجوم بدون صخب',
      'شاي بدوي أصيل بأعشاب الحبق والمرمية الطبيعية',
      'عصائر فواكه طبيعية فريش وقهوة تركي بالقرفة'
    ],
    includedEn: [
      'Sea terrace admission & live acoustic musical session',
      'Reserved beachfront swing or cushioned floor lounge'
    ],
    includedAr: [
      'دخول التراس والاستمتاع بفقرة المزيكا اللايف',
      'حجز مرجيحة أو شلتة مريحة ع البحر'
    ],
    notIncludedEn: [
      'Beverages, desserts, and snacks ordered from counter'
    ],
    notIncludedAr: [
      'المشروبات والحلويات حسب اختيارك من الكاونتر'
    ],
    preparationTipsEn: [
      'Bring a light sweater or shawl during winter evenings as coastal breezes can be cool',
      'Card and cash payments both accepted'
    ],
    preparationTipsAr: [
      'هات جاكيت خفيف في سهرات الشتاء لأن نسيم البحر بيكون بارد بالليل',
      'يقبل الدفع كاش أو بالبطاقات البنكية'
    ],
    environmentalSignals: {
      waterTemp: 'N/A',
      visibility: 'N/A',
      windCondition: 'Gentle Evening Sea Breeze',
      bestTide: 'Evening High Tide'
    }
  },
  {
    id: 'near-eel-garden',
    slug: 'eel-garden',
    activityId: 'act_eel_garden_sunset_snorkel',
    titleEn: 'Eel Garden Marine Reserve & Sandy Slope',
    titleAr: 'شاطئ وحديقة ثعابين البحر (إيل جاردن)',
    taglineEn: 'Natural marine phenomenon with hundreds of garden eels swaying gracefully with sea currents.',
    taglineAr: 'قاع رملي ساحر يضم مئات من ثعابين البحر الرملية المسالمة اللي بتتراقص مع تيار المية اللطيف.',
    descriptionEn: 'Located just north of the lighthouse, Eel Garden is named for the vast colony of slender garden eels that live in burrows in the sandy slope. As divers and snorkelers hover quietly overhead, hundreds of eels rise up to feed on passing plankton, resembling a meadow of tall grass swaying in the gentle Red Sea currents.',
    descriptionAr: 'يقع شمال اللايتهاوس مباشرة، وسُمي بهذا الاسم نسبة إلى مستعمرة ضخمة من ثعابين البحر الرملية المسالمة التي تعيش في جحور القاع الرملي. عندما تسبح بهدوء فوقها، تخرج مئات الثعابين من جحورها لتتغذى ع العوالق، لتبدو كحقل من العشب الأخضر المتمايل مع التيار.',
    category: 'beach',
    categoryLabelEn: 'Natural Marine Reserve',
    categoryLabelAr: 'محمية بحرية طبيعية',
    heroImage: '/images/attractions/attr-eel-garden.webp',
    galleryImages: [
      IMG_P16826872200634742bd7fd538_CARD
    ],
    locationEn: 'Eel Garden Bay, North Central Dahab',
    locationAr: 'خليج إيل جاردن، شمال وسط دهب',
    coordinates: { lat: 28.5089, lng: 34.5245 },
    durationEn: '1.5 - 2 hours',
    durationAr: 'ساعة ونصف إلى ساعتين',
    durationMinutes: 90,
    difficultyEn: 'Beginner to Intermediate',
    difficultyAr: 'مبتدئ إلى متوسط',
    intensityScore: 2,
    accessMethodEn: 'Shore Entry through Coral Lagoon Canyon',
    accessMethodAr: 'نزول شاطئي عبر ممر مرجاني هادئ',
    openHoursEn: 'Open 24/7 (Morning sunlight & High Tide optimal)',
    openHoursAr: 'مفتوح دائماً (أفضل وقت صباحاً مع المد وضوء الشمس)',
    basePriceEGP: 350,
    priceLevel: '$',
    verifiedBadgeEn: 'Protected Marine Sanctuary',
    verifiedBadgeAr: 'محمية بيئية وبحرية خاضعة للحماية',
    localGuideInsightEn: 'Hover motionless a few feet off the sandy bottom. If you remain still, the shy garden eels will emerge one by one to their full height.',
    localGuideInsightAr: 'اثبت في مكانك فوق القاع الرملي من غير حركة زعانف سريعة.. الثعابين خجولة وهتطلع بالكامل من جحورها أول ما تحس بالهدوء.',
    highlightsEn: [
      'Unique garden eel colony undulating in sandy channels',
      'Pristine coral walls with anemonefish and blue-spotted stingrays',
      'Crystal-clear morning visibility reaching 30+ meters',
      'Quiet seaside palapas for relaxation away from main promenade crowds'
    ],
    highlightsAr: [
      'مستعمرة فريدة لثعابين البحر الرملية في قنوات رملية بيضاء',
      'شعب مرجانية بكر تضم سمك نيمو وشعاع الراي المنقط بالأزرق',
      'رؤية مائية فائقة النقاء في ساعات الصباح الباكر (+٣٠ متر)',
      'شاطئ هادئ وقعدات مريحة بعيد عن زحمة الممشى الرئيسية'
    ],
    includedEn: [
      'Guided marine life orientation',
      'Snorkel mask, fins, and safety float rental',
      'Bedouin tea & shaded beach hut access'
    ],
    includedAr: [
      'شرح لمعالم المكان وكائنات الشعب مع دليل محلي',
      'تأجير طقم سنوركلينج كامل وزعانف وسترة طفو',
      'شاي بدوي وقعدة مظللة على الشاطئ'
    ],
    notIncludedEn: [
      'Private underwater photography equipment'
    ],
    notIncludedAr: [
      'كاميرا تصوير تحت المية (يمكن طلبها بشكل منفصل)'
    ],
    preparationTipsEn: [
      'Best visited during high tide when crossing the reef table is effortless',
      'Do not touch or kick the sandy bottom to avoid stirring sediment'
    ],
    preparationTipsAr: [
      'أفضل وقت للزيارة وقت المد العالي لتعدي حاجز الشعب بسهولة',
      'تجنب لمس أو تعكير القاع الرملي بالزعانف لتستمتع بأفضل رؤية'
    ],
    environmentalSignals: {
      waterTemp: '24°C – 26°C',
      visibility: '30 meters',
      windCondition: 'Moderate Morning Breeze',
      bestTide: 'High Tide Essential'
    }
  }
];

/**
 * Attaches the commerce facts for an editorial experience.
 *
 * Curated entries and NearMe items are hand-written content with no commerce
 * identity of their own; the catalogue is where bookability lives. This is the
 * one place the two are joined, so a surface can ask `exp.bookable` instead of
 * guessing from a price or a category.
 */
function withBookability(
  experience: ExperienceDetailData,
  corpusActivities: DahabActivity[]
): ExperienceDetailData {
  const activity = experience.activityId
    ? corpusActivities.find(a => a.id === experience.activityId)
    : undefined;
  return { ...experience, bookable: activity?.bookable ?? null };
}

// ---------------------------------------------------------------------------
// Catalogue activity → experience page
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<DahabActivity['category'], [string, string]> = {
  diving: ['Scuba diving', 'غوص'],
  water_sport: ['On the water', 'رياضات مائية'],
  safari: ['Desert & mountains', 'صحراء وجبال'],
  culture: ['Bedouin Sinai', 'سيناء البدوية'],
  wellness: ['Wellness', 'استرخاء'],
  food: ['Food', 'طعام'],
};

const DIFFICULTY_LABEL: Record<DahabActivity['difficulty'], [string, string]> = {
  Beginner: ['Beginner', 'مبتدئ'],
  Intermediate: ['Intermediate', 'متوسط'],
  Advanced: ['Advanced', 'متقدم'],
  'All Levels': ['All levels', 'كل المستويات'],
};

const ACCESS_LABEL: Record<string, [string, string]> = {
  WALK: ['On foot from town', 'سيرًا من المدينة'],
  SHORE: ['Shore entry', 'النزول من الشاطئ'],
  BOAT: ['By boat', 'بالقارب'],
  VEHICLE: ['By car', 'بالسيارة'],
  '4X4': ['By 4x4', 'بسيارة دفع رباعي'],
  CAMEL: ['By camel', 'على الجمال'],
  HIKE: ['On foot, uphill', 'مشي جبلي'],
  MIXED: ['Car, then on foot', 'بالسيارة ثم سيرًا'],
};

const PERSONA_AR: Record<string, string> = {
  Beginners: 'المبتدئين',
  Nomads: 'الرحالة',
  'Relaxed Travelers': 'محبي الهدوء',
  'Underwater Photographers': 'مصوري ما تحت الماء',
  'Certified Divers': 'الغطاسين المعتمدين',
  'Active Explorers': 'محبي الحركة',
  Couples: 'الأزواج',
  Adventurers: 'محبي المغامرة',
  'Nature Lovers': 'محبي الطبيعة',
  Kitesurfers: 'راكبي الكايت',
  Athletes: 'الرياضيين',
  Families: 'العائلات',
  Hikers: 'محبي المشي الجبلي',
  Foodies: 'محبي الأكل',
  Stargazers: 'محبي النجوم',
  'All Travelers': 'كل المسافرين',
  'Adventure Seeker': 'محبي المغامرة',
  'Cultural Explorer': 'محبي الثقافة',
};

const LEVEL_AR: Record<string, string> = {
  'Open Water or Discover Scuba': 'رخصة Open Water أو تجربة غطس',
  'Advanced Open Water / 20+ Logged Dives': 'رخصة Advanced Open Water أو أكثر من ٢٠ غطسة',
  'Basic Swimming Ability': 'إجادة السباحة',
  None: 'لا تحتاج إلى خبرة',
  'Advanced Open Water (30m rating)': 'رخصة Advanced Open Water (لعمق ٣٠ مترًا)',
  'Beginner to Expert': 'من المبتدئ إلى المحترف',
  'None (Lifejackets provided)': 'لا تحتاج إلى خبرة (سترات النجاة متوفرة)',
  'Basic Fitness (Harness & shoes provided)': 'لياقة بسيطة (الحزام والحذاء متوفران)',
  'All Levels': 'كل المستويات',
  Beginner: 'مبتدئ',
  Intermediate: 'متوسط',
  Advanced: 'متقدم',
};

const REQUIREMENT_AR: Record<string, string> = {
  'CDWS Medical Declaration': 'إقرار طبي (CDWS)',
  'Dive Certification / Instructor Briefing': 'رخصة غطس أو شرح من المدرب',
  'EEAA National Park Ticket ($10 or EGP equivalent)': 'تذكرة المحمية الطبيعية (١٠ دولار أو ما يعادلها بالجنيه)',
  'Advanced Scuba Certification': 'رخصة غطس متقدمة',
  'Mask & Fins': 'نظارة وزعانف',
  'EEAA Protectorates Permit': 'تصريح دخول المحمية',
  'Wind below 16 knots': 'رياح أقل من ١٦ عقدة',
  'CDWS Certification': 'رخصة CDWS',
  'Good Buoyancy Control': 'تحكم جيد في الطفو',
  'Basic Swimming': 'إجادة السباحة',
  'Mask & Snorkel': 'نظارة وسنوركل',
  'Sinai Climber Registration': 'تسجيل متسلق في سيناء',
  'Closed-toe hiking shoes': 'حذاء مشي مغلق',
  'Flight Number for Live Tracking': 'رقم الرحلة لمتابعتها',
};

function formatDuration(minutes: number): [string, string] {
  if (minutes < 60) return [`${minutes} min`, `${minutes} دقيقة`];
  const hours = Math.round((minutes / 60) * 2) / 2;
  const en = hours === 1 ? '1 hour' : `${hours} hours`;
  const ar = hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : hours <= 10 && Number.isInteger(hours) ? `${hours} ساعات` : `${hours} ساعة`;
  return [en, ar];
}

/** The catalogue's own operating limits, in words. */
function conditionsOf(activity: DahabActivity): [string[], string[]] {
  const limits = activity.environmentalSensitivities ?? {};
  const en: string[] = [];
  const ar: string[] = [];
  if (limits.maxWindKnots !== undefined) {
    en.push(`Runs when the wind is below ${limits.maxWindKnots} knots`);
    ar.push(`تُقام عندما تكون الرياح أقل من ${limits.maxWindKnots} عقدة`);
  }
  if (limits.minWindKnots !== undefined) {
    en.push(`Needs at least ${limits.minWindKnots} knots of wind`);
    ar.push(`تحتاج إلى رياح لا تقل عن ${limits.minWindKnots} عقدة`);
  }
  if (limits.minVisibilityMeters !== undefined) {
    en.push(`Needs ${limits.minVisibilityMeters} m of visibility or more`);
    ar.push(`تحتاج إلى رؤية تحت الماء لا تقل عن ${limits.minVisibilityMeters} مترًا`);
  }
  if (limits.requiresDaylight) {
    en.push('Daylight only');
    ar.push('في ضوء النهار فقط');
  }
  if (en.length === 0) {
    en.push('Runs in most weather — the operator confirms the day before');
    ar.push('تُقام في أغلب الأحوال الجوية، ويؤكد المنظم الموعد قبلها بيوم');
  }
  return [en, ar];
}

function experienceFromActivity(activity: DahabActivity, corpusPlaces: DahabPlace[]): ExperienceDetailData {
  const place = corpusPlaces.find((p) => p.id === activity.placeId);
  const bookable = activity.bookable ?? null;
  const minutes = bookable?.durationMinutes ?? activity.durationMinutes;
  const [durationEn, durationAr] = formatDuration(minutes);
  const [categoryEn, categoryAr] = CATEGORY_LABEL[activity.category] ?? ['Experience', 'تجربة'];
  const [difficultyEn, difficultyAr] = DIFFICULTY_LABEL[activity.difficulty] ?? [activity.difficulty, activity.difficulty];
  const [accessEn, accessAr] = ACCESS_LABEL[activity.accessMethod] ?? ['Arranged by the operator', 'يرتّب المنظم طريقة الوصول'];
  const [conditionsEn, conditionsAr] = conditionsOf(activity);
  const personas = activity.travelerFitPersonas ?? [];
  const requirements = activity.dependencies ?? [];
  const price = bookable?.basePriceEGP ?? activity.basePriceEGP;
  const departures = bookable?.timeSlots ?? [];

  return {
    id: activity.id,
    slug: experienceSlugForActivity(activity.id),
    activityId: activity.id,
    bookable,
    titleEn: activity.titleEn,
    titleAr: activity.titleAr,
    taglineEn: bookable?.description || place?.descriptionEn || '',
    taglineAr: bookable?.descriptionAr || place?.descriptionAr || '',
    descriptionEn: place?.descriptionEn || bookable?.description || '',
    descriptionAr: place?.descriptionAr || bookable?.descriptionAr || '',
    category: activity.category,
    categoryLabelEn: categoryEn,
    categoryLabelAr: categoryAr,
    heroImage: photoForActivity(activity.titleEn),
    galleryImages: [],
    locationEn: place?.nameEn || activity.areaId.replace(/_/g, ' '),
    locationAr: place?.nameAr || activity.areaId.replace(/_/g, ' '),
    durationEn,
    durationAr,
    durationMinutes: minutes,
    difficultyEn,
    difficultyAr,
    intensityScore: activity.difficulty === 'Advanced' ? 5 : activity.difficulty === 'Intermediate' ? 3 : 2,
    accessMethodEn: accessEn,
    accessMethodAr: accessAr,
    openHoursEn: departures.length ? departures.join(', ') : 'Set with the operator',
    openHoursAr: departures.length ? departures.join('، ') : 'بالاتفاق مع المنظم',
    basePriceEGP: price,
    priceLevel: price > 1500 ? '$$$' : price > 500 ? '$$' : '$',
    verifiedBadgeEn: bookable?.supplierName ? `Run by ${bookable.supplierName}` : 'Local operator',
    verifiedBadgeAr: bookable?.supplierNameAr ? `تنظيم ${bookable.supplierNameAr}` : 'منظم محلي',
    localGuideInsightEn: activity.preparationTips[0] ?? '',
    localGuideInsightAr: activity.preparationTipsAr[0] ?? '',
    highlightsEn: [
      ...(personas.length ? [`Good for ${personas.join(', ').toLowerCase()}`] : []),
      `Experience needed: ${activity.experienceLevelRequired}`,
      ...(bookable?.meetingPoint ? [`Meet at ${bookable.meetingPoint}`] : []),
    ],
    highlightsAr: [
      ...(personas.length ? [`مناسبة لـ${personas.map((p) => PERSONA_AR[p] ?? p).join('، ')}`] : []),
      `الخبرة المطلوبة: ${LEVEL_AR[activity.experienceLevelRequired] ?? activity.experienceLevelRequired}`,
      ...(bookable?.meetingPoint ? [`نقطة التجمع: ${bookable.meetingPointAr || bookable.meetingPoint}`] : []),
    ],
    includedEn: bookable?.includedItems?.length ? bookable.includedItems : ['A licensed local guide'],
    includedAr: bookable?.includedItemsAr?.length
      ? bookable.includedItemsAr
      : bookable?.includedItems?.length
      ? bookable.includedItems
      : ['مرشد محلي مرخص'],
    notIncludedEn: requirements.length ? requirements : ['Personal spending'],
    notIncludedAr: requirements.length ? requirements.map((r) => REQUIREMENT_AR[r] ?? r) : ['المصاريف الشخصية'],
    preparationTipsEn: activity.preparationTips,
    preparationTipsAr: activity.preparationTipsAr,
    environmentalSignals: { waterTemp: '', visibility: '', windCondition: '', bestTide: '' },
    conditionsEn,
    conditionsAr,
  };
}

/**
 * Other things to do, from the live catalogue: bookable ones first, the same
 * kind of outing first among those, never the one on screen.
 */
export function relatedActivityExperiences(
  current: ExperienceDetailData,
  corpusActivities: DahabActivity[],
  corpusPlaces: DahabPlace[],
  limit = 3
): ExperienceDetailData[] {
  // Two catalogue entries can be the same product; show each product once.
  const seenSkus = new Set<string>(current.bookable ? [current.bookable.skuId] : []);
  return corpusActivities
    .filter((a) => a.id !== current.activityId && a.id !== current.id && a.bookable)
    .sort((a, b) => Number(b.category === current.category) - Number(a.category === current.category))
    .filter((a) => {
      if (seenSkus.has(a.bookable!.skuId)) return false;
      seenSkus.add(a.bookable!.skuId);
      return true;
    })
    .slice(0, limit)
    .map((a) => resolveExperience(a.id, corpusActivities, corpusPlaces) ?? experienceFromActivity(a, corpusPlaces));
}

/**
 * Resolves an experience by slug or ID across both curated experiences,
 * NearMe items, and backend activities/places corpus.
 */
export function resolveExperience(
  slugOrId: string | null | undefined,
  corpusActivities: DahabActivity[] = [],
  corpusPlaces: DahabPlace[] = []
): ExperienceDetailData | null {
  if (!slugOrId) return null;

  const clean = slugOrId.toLowerCase().trim();

  // 1. Check curated database first — including by the activity it describes,
  // so a link to the activity opens the richer editorial page.
  const curated = CURATED_EXPERIENCES.find(
    (exp) =>
      exp.id.toLowerCase() === clean ||
      exp.slug.toLowerCase() === clean ||
      exp.id.toLowerCase().replace(/^near-/, '') === clean ||
      exp.slug.toLowerCase().replace(/-/g, '_') === clean ||
      (exp.activityId !== undefined && experienceSlugForActivity(exp.activityId) === clean.replace(/_/g, '-'))
  );
  if (curated) return withBookability(curated, corpusActivities);

  // 2. Check NEAR_ME_DATA fallback
  const nearMe = NEAR_ME_DATA.find(
    (item) =>
      item.id.toLowerCase() === clean ||
      item.id.toLowerCase().replace(/^near-/, '') === clean ||
      item.name.toLowerCase().replace(/[^a-z0-9]/g, '-') === clean
  );
  if (nearMe) {
    return {
      id: nearMe.id,
      slug: nearMe.id.replace(/^near-/, ''),
      titleEn: nearMe.name || '',
      titleAr: nearMe.nameAr || '',
      taglineEn: nearMe.tag || '',
      taglineAr: nearMe.tagAr || '',
      descriptionEn: nearMe.description || '',
      descriptionAr: nearMe.descriptionAr || '',
      category: (nearMe.category as any) || 'beach',
      categoryLabelEn: nearMe.tag || '',
      categoryLabelAr: nearMe.tagAr || '',
      heroImage: nearMe.image || IMG_P154455176346a013bb70d5_HERO,
      galleryImages: [nearMe.image || IMG_P154455176346a013bb70d5_CARD],
      locationEn: nearMe.location || '',
      locationAr: nearMe.locationAr || '',
      durationEn: nearMe.openHours || '1 - 2 hours',
      durationAr: nearMe.openHoursAr || 'ساعة إلى ساعتين',
      durationMinutes: 90,
      difficultyEn: nearMe.bestFor || 'All Levels',
      difficultyAr: nearMe.bestForAr || 'جميع المستويات',
      intensityScore: 2,
      accessMethodEn: 'Direct Shore Walk-In',
      accessMethodAr: 'نزول مباشر من الشاطئ',
      openHoursEn: nearMe.openHours || '',
      openHoursAr: nearMe.openHoursAr || '',
      basePriceEGP: nearMe.priceLevel === '$$$' ? 650 : nearMe.priceLevel === '$$' ? 350 : 150,
      priceLevel: nearMe.priceLevel,
      verifiedBadgeEn: 'Verified Sinai Destination Spot',
      verifiedBadgeAr: 'مكان سياحي معتمد وموثق في دهب',
      localGuideInsightEn: 'Visit early in the day or during sunset for the most atmospheric experience.',
      localGuideInsightAr: 'زر المكان في الصباح الباكر أو وقت الغروب للاستمتاع بأجمل أجواء وروقان.',
      highlightsEn: [nearMe.bestFor || 'All Levels', 'Vibrant atmosphere and authentic local hosting', 'Scenic views of the Red Sea and Sinai mountains'],
      highlightsAr: [nearMe.bestForAr || 'جميع المستويات', 'أجواء حيوية وضيافة محلية أصيلة', 'إطلالات ساحرة على مياه البحر الأحمر وجبال سيناء'],
      includedEn: ['Location admission & access', 'Standard service & hospitality'],
      includedAr: ['دخول المكان والاستمتاع بالموقع', 'الخدمة والضيافة الأساسية'],
      notIncludedEn: ['Personal food, beverages, and extra gear purchases'],
      notIncludedAr: ['الطلبات والمشتريات الشخصية الإضافية'],
      preparationTipsEn: ['Bring comfortable walking shoes and camera'],
      preparationTipsAr: ['احرص على ارتداء حذاء مريح وإحضار كاميرا أو موبايل مشحون'],
      environmentalSignals: {
        waterTemp: '25°C',
        visibility: '25+ meters',
        windCondition: 'Gentle Sea Breeze',
        bestTide: 'Optimal at Daylight'
      }
    };
  }

  // 3. Check API Corpus Activities
  const activity = corpusActivities.find(
    (a) =>
      a.id.toLowerCase() === clean ||
      a.id.toLowerCase().replace(/_/g, '-') === clean ||
      a.titleEn.toLowerCase().replace(/[^a-z0-9]/g, '-') === clean
  );
  if (activity) return experienceFromActivity(activity, corpusPlaces);

  // 4. Check API Corpus Places
  const placeMatch = corpusPlaces.find(
    (p) =>
      p.id.toLowerCase() === clean ||
      p.id.toLowerCase().replace(/_/g, '-') === clean ||
      p.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '-') === clean
  );
  if (placeMatch) {
    return {
      id: placeMatch.id,
      slug: placeMatch.id.replace(/_/g, '-'),
      titleEn: placeMatch.nameEn,
      titleAr: placeMatch.nameAr,
      taglineEn: placeMatch.category,
      taglineAr: placeMatch.category,
      descriptionEn: placeMatch.descriptionEn,
      descriptionAr: placeMatch.descriptionAr,
      category: 'beach',
      categoryLabelEn: placeMatch.category,
      categoryLabelAr: placeMatch.category,
      heroImage: IMG_P1507525428034b723cf961d3e_HERO,
      galleryImages: [IMG_P154455176346a013bb70d5_CARD],
      locationEn: placeMatch.areaId.replace(/_/g, ' '),
      locationAr: placeMatch.areaId.replace(/_/g, ' '),
      durationEn: '1 - 2 hours',
      durationAr: 'ساعة إلى ساعتين',
      durationMinutes: 90,
      difficultyEn: 'All Levels',
      difficultyAr: 'للجميع',
      intensityScore: 1,
      accessMethodEn: 'Shore Entry / Walk',
      accessMethodAr: 'نزول شاطئي / مشي',
      openHoursEn: 'Open 24/7',
      openHoursAr: 'مفتوح دائماً',
      basePriceEGP: 200,
      priceLevel: '$',
      verifiedBadgeEn: 'Verified Dahab Place',
      verifiedBadgeAr: 'موقع سياحي موثق في دهب',
      localGuideInsightEn: 'A wonderful spot to relax, take photos, and experience the authentic Dahab spirit.',
      localGuideInsightAr: 'مكان رائع للاسترخاء والتصوير والتمتع بروح دهب الحقيقية.',
      highlightsEn: ['Natural scenery', 'Calm seaside atmosphere', 'Easy walkability'],
      highlightsAr: ['مناظر طبيعية خلابة', 'أجواء بحرية هادئة', 'سهولة الوصول والمشي'],
      includedEn: ['Public access & scenic views'],
      includedAr: ['دخول وإطلالة طبيعية'],
      notIncludedEn: ['Commercial rentals & purchases'],
      notIncludedAr: ['المشتريات والخدمات التجارية'],
      preparationTipsEn: ['Bring sunscreen and water'],
      preparationTipsAr: ['احرص على إحضار مياه وواقي شمس'],
      environmentalSignals: {
        waterTemp: '25°C',
        visibility: '25 meters',
        windCondition: 'Calm',
        bestTide: 'Anytime'
      }
    };
  }

  // Not found
  return null;
}
