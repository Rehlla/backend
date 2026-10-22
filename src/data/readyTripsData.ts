import { DayPlanItem } from '../types';
import { DESTINATION_PROGRAMMES } from './destinationProgrammes';

export interface ReadyTripProgram {
  id: string;
  /** Which destination the programme belongs to; absent means Dahab. */
  destination?: 'dahab' | 'nuweiba' | 'siwa';
  /** True while no supplier quotes it yet: the price is an editorial estimate. */
  priceIsEstimate?: boolean;
  title: string;
  titleAr: string;
  tagline: string;
  taglineAr: string;
  durationDays: number;
  idealFor: string;
  idealForAr: string;
  pace: 'Relaxed' | 'Balanced' | 'Active';
  paceAr: string;
  intensityScore: number; // 1 to 5
  freeTimeScore: number; // percentage, e.g. 40
  startingPriceEGP: number;
  heroImage: string;
  badge: string;
  badgeAr: string;
  highlights: string[];
  highlightsAr: string[];
  includedItems: string[];
  includedItemsAr: string[];
  customizableItems: string[];
  customizableItemsAr: string[];
  defaultInterests: string[];
  defaultBudget: 'Budget' | 'Moderate' | 'Premium';
  dayByDay: DayPlanItem[];
}

/**
 * The offline fallback.
 *
 * These programmes are served from GET /api/dahab/content/programmes
 * (server/db/seeds/editorialContent.ts) and reached through
 * `useReadyProgrammes`. Three components used to import this array directly,
 * so a price change meant a rebuild and a deploy. Kept here so a failed request
 * degrades the page rather than emptying it.
 */
const DAHAB_PROGRAMS: ReadyTripProgram[] = [
  {
    id: 'dahab-first-timer',
    title: 'Dahab First Timer',
    titleAr: 'أول مرة في دهب',
    tagline: 'Iconic reefs, Lighthouse promenade, sunset Bedouin tea, and essential Dahab magic.',
    taglineAr: 'الشعاب الأسطورية، ممشى اللايتهاوس، شاي الغروب البدوي، وروح دهب الأصلية.',
    durationDays: 5,
    idealFor: 'First-time visitors, curious travelers, couples',
    idealForAr: 'للي بيزور دهب أول مرة، والأصحاب اللي عايزين يكتشفوا كل حاجة بروقان',
    pace: 'Balanced',
    paceAr: 'متوازن ورايق',
    intensityScore: 3,
    freeTimeScore: 45,
    startingPriceEGP: 9800,
    heroImage: '/images/hero/coral-reef-split.jpg',
    badge: 'Most Popular',
    badgeAr: 'الأكثر طلباً',
    highlights: [
      'Guided shore dive or snorkel at The Canyon & Lighthouse',
      'Wadi Gnai 4x4 desert valley sunset & campfire Bedouin dinner',
      'Ras Abu Galum boat cruise & Blue Lagoon turquoise swimming',
      'Assalah market local crafts, seafood feast & authentic bakery breakfasts'
    ],
    highlightsAr: [
      'غطس أو سنوركلنج في الكانيون وحيود اللايتهاوس',
      'سفاري وادي قني بالدفع الرباعي وعشاء بدوي ع الحطب',
      'رحلة يخت إلى رأس أبو جالوم وعوم في مياه البلو لاجون الفيروزية',
      'سوق العصلة التراثي وأشهى أكلات سمك البحر الأحمر'
    ],
    includedItems: [
      '4 Nights boutique seafront hotel with terrace breakfast',
      'Private Sharm El Sheikh / Tabah airport roundtrip transfer',
      '2 Guided marine reef sessions (Snorkel or Dive)',
      '1 Full-day 4x4 desert valley safari & Bedouin dinner',
      'Full Dahab Travel OS digital companion pass'
    ],
    includedItemsAr: [
      'إقامة ٤ ليالي في فندق بوتيك ع البحر مع فطار طازة',
      'توصيل خاص ذهاب وعودة من مطار شرم الشيخ أو طابا',
      'جلستان غطس أو سنوركلنج مع مرشد محترف معتمد',
      'رحلة سفاري دفع رباعي لوادي قني وعشاء بدوي تحت النجوم',
      'اشتراك كامل في مرشد دهب الذكي والخرائط بدون نت'
    ],
    customizableItems: [
      'Extend or shorten trip length (3 to 7 days)',
      'Upgrade hotel category to Luxury Eco-Suite',
      'Swap diving for wellness & kitesurfing lessons',
      'Add private photographer for desert sunset'
    ],
    customizableItemsAr: [
      'تعديل مدة الرحلة (من ٣ إلى ٧ أيام)',
      'ترقية الفندق لجناح إيكو بانوراما ع البحر',
      'استبدال الغطس بدروس كايت سيرف أو يوجا صباحية',
      'إضافة مصور فوتوغرافي خاص لجلسة الغروب الصحراوية'
    ],
    defaultInterests: ['Diving', 'Adventure', 'Food', 'Beach'],
    defaultBudget: 'Moderate',
    dayByDay: [
      {
        day: 1,
        title: 'Arrival · Settle In · Sunset Stroll',
        subtitle: 'Scenic Sinai private transfer, check into boutique seafront hotel, promenade golden hour walk, and fresh seafood dinner by torchlight.',
        highlights: [
          'Direct airport transfer via scenic coastal highway',
          'Welcome iced Bedouin habak tea & hotel check-in',
          'Lighthouse bay promenade orientation stroll',
          'Catch-of-the-day grilled seafood dinner right by the water'
        ],
        tag: 'Arrival & Welcome',
        timeEstimate: 'Afternoon & Evening'
      },
      {
        day: 2,
        title: 'The Canyon & Lighthouse Reef',
        subtitle: 'Morning shore dive/snorkel along vibrant coral walls, authentic local lunch, and relaxed afternoon café hopping.',
        highlights: [
          'Briefing and guided dive at The Canyon coral labyrinth',
          'Fresh Sinai herb falafel & iced hibiscus juice',
          'Afternoon swim at Eel Garden pebble beach',
          'Sunset chill at acoustic seaside café'
        ],
        tag: 'Marine Wonder',
        timeEstimate: 'Full Morning + Open Afternoon'
      },
      {
        day: 3,
        title: 'Wadi Gnai Canyon & Desert Stargazing',
        subtitle: '4x4 desert adventure through granite rock canyons, sunset tea on towering cliffs, and candlelit Bedouin feast with live oud.',
        highlights: [
          '4x4 jeep trek into Wadi Gnai granite oasis',
          'Gentle bouldering & natural spring walk',
          'Sunset Bedouin tea ritual on high ridge',
          'Fresh fire-baked flatbread & grilled dinner under Sinai stars'
        ],
        tag: 'Desert Magic',
        timeEstimate: 'Afternoon to Night'
      },
      {
        day: 4,
        title: 'Blue Lagoon & Ras Abu Galum Escape',
        subtitle: 'Boat expedition along sheer Sinai cliffs to the crystal turquoise shallow lagoon and remote Bedouin fishing community.',
        highlights: [
          'Coastal boat ride past dramatic desert-meets-sea cliffs',
          'Swimming in calm shallow turquoise lagoon waters',
          'Relaxing on shaded palapa hammocks with sea breeze',
          'Freshly caught fried fish lunch on the beach'
        ],
        tag: 'Lagoon Sanctuary',
        timeEstimate: 'Full Day Expedition'
      },
      {
        day: 5,
        title: 'Slow Breakfast · Local Crafts · Departure',
        subtitle: 'Unrushed morning coffee overlooking the Gulf of Aqaba, picking up authentic Sinai honey, herbs, and silver jewelry before transfer.',
        highlights: [
          'Sunrise swim or sea-view yoga stretch',
          'Artisan bakery breakfast with specialty cold brew',
          'Assalah artisan souq shopping for Sinai herbs and crafts',
          'Comfortable scheduled transfer back to airport'
        ],
        tag: 'Peaceful Farewell',
        timeEstimate: 'Morning Departure'
      }
    ]
  },
  {
    id: 'dahab-adventure',
    title: 'Dahab Adventure',
    titleAr: 'مغامرة دهب وسيناء',
    tagline: 'Sinai granite peaks, deep canyons, desert quad trails, and night dive adrenaline.',
    taglineAr: 'جبال سيناء، تسلق الكانيونز، دروب البيتش باجي في الصحراء، وغطس ليلي مثير.',
    durationDays: 6,
    idealFor: 'Thrill seekers, hikers, active friends, photography lovers',
    idealForAr: 'لعشاق المغامرة والأكشن، والطلعات الجبلية والتصوير بين وديان سيناء',
    pace: 'Active',
    paceAr: 'نشيط ومغامرة',
    intensityScore: 5,
    freeTimeScore: 25,
    startingPriceEGP: 14200,
    heroImage: '/images/attractions/bouldering-wadi-gnai.jpg',
    badge: 'High Energy',
    badgeAr: 'طاقة ومغامرة',
    highlights: [
      'Mount Sinai sunrise summit trek & St. Catherine Monastery',
      'Colored Canyon deep sandstone traverse & Wadi Arada safari',
      'Desert quad bike expedition into secret mountain passes',
      'The Bells to Blue Hole world-class deep shore dive'
    ],
    highlightsAr: [
      'صعود قمة جبل موسى لشروق الشمس وزيارة دير سانت كاترين',
      'عبور الكانيون الملون وأودية سيناء الصخرية العميقة',
      'سفاري بيتش باجي في دروب الجبال والوديان المخفية',
      'غطسة البيلز وصولاً إلى البلو هول الأسطوري'
    ],
    includedItems: [
      '5 Nights eco-adventure lodge accommodation',
      'Private 4x4 rugged safari vehicle with licensed Bedouin guide',
      'St. Catherine summit expedition, permits & certified mountain guide',
      'All specialized gear rentals (Quad bikes, climbing ropes, dive kit)',
      'Daily energizing breakfast and high-protein expedition lunches'
    ],
    includedItemsAr: [
      'إقامة ٥ ليالي في لودج بيئي مجهز للمغامرين',
      'عربية دفع رباعي مخصصة مع دليل بدوي خبير بالدروب',
      'رحلة قمة سانت كاترين وتصاريح المحميات ومرشد جبل معتمد',
      'جميع معدات المغامرة (بيتش باجي، معدات تسلق، عدة غطس كاملة)',
      'وجبات فطار وسناكس طاقة يومية مخصصة للرحلات الطويلة'
    ],
    customizableItems: [
      'Add rock climbing instruction in Wadi Gnai',
      'Upgrade to private camp tent at Mount Sinai',
      'Extend with a 2-day camel desert crossing',
      'Include GoPro 4K action cam rental'
    ],
    customizableItemsAr: [
      'إضافة دورة تدريبية لتسلق الصخور بوادي قني',
      'ترقية إلى تخييم فاخر خاص عند سفح جبل موسى',
      'مد الرحلة يومين إضافيين لعبور الصحراء بالجمال',
      'إضافة كاميرا جوبرو 4K لتوثيق المغامرات'
    ],
    defaultInterests: ['Adventure', 'Diving', 'Local Life'],
    defaultBudget: 'Moderate',
    dayByDay: [
      {
        day: 1,
        title: 'Arrival & High-Octane Orientation',
        subtitle: 'Sinai arrival, gear fitting at the dive center, and sunset quad trial run.',
        highlights: ['Airport pickup & check-in', 'Equipment fit & safety briefing', 'Sunset quad ride over coastal dunes'],
        tag: 'Gear & Prep',
        timeEstimate: 'Afternoon'
      },
      {
        day: 2,
        title: 'The Bells & Blue Hole Extreme Dive',
        subtitle: 'Dropping down the sheer vertical chimney of The Bells into the deep Blue Hole dropoff.',
        highlights: ['Vertical chimney dive at The Bells', 'Drift along saddle coral gardens', 'Blue Hole exploration with master guide'],
        tag: 'Deep Reef',
        timeEstimate: 'Full Day'
      },
      {
        day: 3,
        title: 'Colored Canyon & Wadi Arada Trek',
        subtitle: 'Navigating narrow sandstone gorges with swirls of violet, gold, and crimson mineral veins.',
        highlights: ['Hiking through narrow canyon passages', 'Bedouin wilderness lunch', 'Panoramic viewpoint overlooking the Gulf'],
        tag: 'Canyon Expedition',
        timeEstimate: 'Full Day'
      },
      {
        day: 4,
        title: 'Mount Sinai Dawn Summit Challenge',
        subtitle: 'Nighttime ascent up the historic mountain path to witness sunrise across the Sinai peninsula.',
        highlights: ['Midnight trek up Mount Sinai steps', 'Sunrise panorama from 2,285m summit', 'Tour of UNESCO St. Catherine Monastery'],
        tag: 'Summit Epic',
        timeEstimate: 'Midnight to Afternoon'
      },
      {
        day: 5,
        title: 'Wadi Gnai Bouldering & Night Reef Dive',
        subtitle: 'Morning granite boulder climbing followed by an exhilarating fluorescent night coral dive.',
        highlights: ['Guided granite rock climbing', 'Afternoon recovery smoothie lounge', 'Bioluminescent night dive at Lighthouse'],
        tag: 'Rock & Night Ocean',
        timeEstimate: 'Morning & Night'
      },
      {
        day: 6,
        title: 'Farewell Adrenaline Ride & Departure',
        subtitle: 'Morning windsurf or coastal run before comfortable transfer.',
        highlights: ['Laguna speed session or recovery swim', 'Hearty farewell brunch', 'Transfer to airport'],
        tag: 'Departure',
        timeEstimate: 'Morning'
      }
    ]
  },
  {
    id: 'slow-dahab',
    title: 'Slow Dahab',
    titleAr: 'روقان وفصلان في دهب',
    tagline: 'Unhurried seaside mornings, lagoon hammocks, artisan bakeries, and habak tea.',
    taglineAr: 'صباح رايق ع البحر، شلتات اللاجونا، مخابز كرواسون طازة، وشاي بالحبق ع الشط.',
    durationDays: 4,
    idealFor: 'Digital nomads, solo travelers, wellness seekers, couples looking to decompress',
    idealForAr: 'للي عايز يفصل من زحمة المدينة، يقعد يقرأ كتاب أو يشتغل بروقان ع البحر',
    pace: 'Relaxed',
    paceAr: 'روقان وهدوء تام',
    intensityScore: 1,
    freeTimeScore: 75,
    startingPriceEGP: 7400,
    heroImage: '/images/hero/boho-cafe-dreams.jpg',
    badge: 'Pure Relaxation',
    badgeAr: 'فصلان وراحة بال',
    highlights: [
      'Full day lounging in shade hammocks at the serene Blue Lagoon',
      'Daily morning seaside yoga and mindfulness breathwork',
      'Artisan sourdough courtyards, specialty cold brews & smoothie bowls',
      'Acoustic sunset circles and tranquil barefoot promenade strolls'
    ],
    highlightsAr: [
      'يوم كامل للاسترخاء في شلتات البلو لاجون الهادية',
      'جلسات يوجا وتنفس صباحية يومية أمام شروق الشمس',
      'أحلى مخابز وكافيهات سبشيلتي كوفي وأطباق سموذي فريش',
      'قعدات عود هادية وقت الغروب وتمشية حافية ع الممشى'
    ],
    includedItems: [
      '3 Nights boutique coastal guest house with hammock balcony',
      'Private Sharm El Sheikh roundtrip transfer with calm music',
      'Full-day private lagoon boat & shaded palapa reservation',
      'Unlimited artisan coffee & fresh herbal tea daily pass',
      'Complimentary yoga mat & daily studio pass'
    ],
    includedItemsAr: [
      'إقامة ٣ ليالي في بيت ضيافة ساحلي مع بلكونة وشلتات مريحة',
      'توصيل خاص ذهاب وعودة بسيارة مريحة ومكيفة',
      'حجز شلتة خاصة مظللة في البلو لاجون طوال اليوم',
      'اشتراك مشروبات القهوة المختصة وشاي الأعشاب يومياً',
      'سجادة يوجا خاصة واشتراك مفتوح في استوديو اليوجا'
    ],
    customizableItems: [
      'Extend stay up to 14 days with nomad high-speed Wi-Fi desk',
      'Add daily 60-min beachfront aromatherapy massage',
      'Include private pottery or silver crafting workshop',
      'Upgrade to beachfront eco-villa with private pool'
    ],
    customizableItemsAr: [
      'تمديد الإقامة حتى ١٤ يوماً مع مكتب عمل وإنترنت فائق السرعة',
      'إضافة جلسة مساج يومية ٦٠ دقيقة بالزيوت الطبيعية ع الشاطئ',
      'ورشة عمل خاصة لصناعة الفخار أو صياغة الفضة البدوية',
      'ترقية لفيلا شاطئية بيئية خاصة'
    ],
    defaultInterests: ['Beach', 'Food', 'Local Life'],
    defaultBudget: 'Budget',
    dayByDay: [
      {
        day: 1,
        title: 'Arrive · Unplug · Settle by the Waves',
        subtitle: 'Smooth check-in, barefoot walk on the quiet pebble shore, and sunset habak tea.',
        highlights: ['Calm scenic drive into Dahab', 'Check-in to sea-facing balcony room', 'Sunset tea circle by the water'],
        tag: 'Decompress',
        timeEstimate: 'Afternoon'
      },
      {
        day: 2,
        title: 'Artisan Bakery & Blue Lagoon Stillness',
        subtitle: 'Slow courtyard brunch followed by boat to the serene shallow turquoise lagoon.',
        highlights: ['Fresh baked cardamom pastry & coffee', 'Boat to Blue Lagoon', 'Afternoon reading on beach palapa'],
        tag: 'Still Waters',
        timeEstimate: 'Full Day'
      },
      {
        day: 3,
        title: 'Sunrise Flow · Assalah Market & Local Cafés',
        subtitle: 'Gentle sunrise yoga, discovering local herb sellers, and open-air seaside dinner.',
        highlights: ['Gentle oceanfront yoga session', 'Wander Assalah spice & craft souq', 'Casual grilled mezze by torchlight'],
        tag: 'Sinai Soul',
        timeEstimate: 'Morning & Evening'
      },
      {
        day: 4,
        title: 'Lazy Breakfast · Ocean Farewell',
        subtitle: 'Unhurried morning swim and smooth journey home.',
        highlights: ['Final morning swim in crystal bay', 'Slow breakfast with fresh figs and honey', 'Transfer to airport'],
        tag: 'Recharged',
        timeEstimate: 'Morning Departure'
      }
    ]
  },
  {
    id: 'diving-week',
    title: 'Diving Week',
    titleAr: 'أسبوع الغطس في دهب',
    tagline: '10 world-class guided reef dives: The Bells, Blue Hole, Canyon, and Gabr El Bint.',
    taglineAr: '١٠ غطسات عالمية: البيلز، البلو هول، الكانيون، وجبر البنت باليخت.',
    durationDays: 6,
    idealFor: 'Certified divers, underwater photographers, freedivers, marine enthusiasts',
    idealForAr: 'للغواصين المعتمدين، وعشاق التصوير تحت المية والبحث عن أندر الكائنات البحرية',
    pace: 'Active',
    paceAr: 'تركيز كامل ع الغطس',
    intensityScore: 5,
    freeTimeScore: 30,
    startingPriceEGP: 16500,
    heroImage: '/images/attractions/blue-hole.jpg',
    badge: 'Pro Diver Choice',
    badgeAr: 'اختيار الغواصين',
    highlights: [
      '10 Guided shore & boat dives at world-famous dive sites',
      'The Arch & Blue Hole saddle drift dive with 30m+ visibility',
      'Full-day Gabr El Bint dive safari with pristine untouched coral reefs',
      'Bioluminescent night dive at Lighthouse reef with master PADI guide'
    ],
    highlightsAr: [
      '١٠ غطسات شاطئية وباليخت في أشهر مواقع الغطس في العالم',
      'غطسة البلو هول والكانيون برؤية فائقة النقاء تفوق ٣٠ متراً',
      'سفاري يخت كامل إلى محمية جبر البنت والشعاب البكر النادرة',
      'غطسة ليلية ساحرة مع كائنات الفسفور المضيئة باللايتهاوس'
    ],
    includedItems: [
      '5 Nights diver-friendly hotel with secure gear lockers & rinse tanks',
      '10 Tanks, weights, certified PADI master dive guide & CDWS marine park fees',
      'Full-day Gabr El Bint boat safari with onboard lunch buffet',
      'Roundtrip Sharm airport transfers with heavy gear assistance',
      'Nitrox tank upgrades available for all deep dives'
    ],
    includedItemsAr: [
      'إقامة ٥ ليالي في فندق مجهز للغواصين ومخازن معدات مؤمنة',
      '١٠ أسطوانات وأوزان ومرشد غطس محترف ورسوم محميات سيناء',
      'رحلة يخت كاملة لجبر البنت شاملة بوفيه الغداء ع ظهر المركب',
      'توصيل من وإلى المطار مع مساعدة في نقل شنط الغطس الثقيلة',
      'إمكانية استخدام غاز النيتروكس للغطسات العميقة'
    ],
    customizableItems: [
      'Add PADI Advanced Open Water or Nitrox certification',
      'Add underwater housing & camera rental package',
      'Upgrade to private 1-on-1 private divemaster guide',
      'Add morning freediving depth training session'
    ],
    customizableItemsAr: [
      'إضافة كورس PADI متقدم أو دورة النيتروكس التخصصية',
      'إضافة باقة إيجار كاميرا احترافية للتصوير تحت الماء',
      'ترقية لمرشد غطس خاص مرافق لك وحدك',
      'إضافة تدريب غوص حر (Free Diving) على حبل الأعماق'
    ],
    defaultInterests: ['Diving', 'Beach'],
    defaultBudget: 'Moderate',
    dayByDay: [
      {
        day: 1,
        title: 'Check-in & Check Dive',
        subtitle: 'Settle in, gear setup, buoyancy check dive at Lighthouse Reef, and diver debrief.',
        highlights: ['Hotel check-in & gear locker setup', 'Afternoon check dive at Lighthouse', 'Logbook review & dive plan discussion'],
        tag: 'Buoyancy & Setup',
        timeEstimate: 'Afternoon'
      },
      {
        day: 2,
        title: 'The Canyon & Coral Garden',
        subtitle: '2-tank morning dive exploring the breathtaking underwater fissure of The Canyon.',
        highlights: ['Dive 1: The Canyon cavern drop (30m)', 'Dive 2: Coral Garden coral pinnacle drift', 'Fish-curry lunch by the reef'],
        tag: 'Cavern & Wall',
        timeEstimate: 'Morning & Noon'
      },
      {
        day: 3,
        title: 'The Bells to Blue Hole Epic',
        subtitle: 'Dropping down the sheer chimney into open blue, cruising across the saddle.',
        highlights: ['Dive 3: The Bells vertical entry & wall drift', 'Dive 4: Blue Hole outer reef & saddle', 'Bedouin tea & loggerhead turtle spotting'],
        tag: 'Iconic Dropoff',
        timeEstimate: 'Full Day'
      },
      {
        day: 4,
        title: 'Gabr El Bint Boat Safari',
        subtitle: 'Full-day cruise south to pristine untouched reefs only accessible by sea.',
        highlights: ['Dive 5 & 6: Gorgonian sea-fan forests & ray encounters', 'Fresh grilled buffet on boat deck', 'Sunset cruise back to Dahab harbor'],
        tag: 'Boat Expedition',
        timeEstimate: 'Full Day Cruise'
      },
      {
        day: 5,
        title: 'Eel Garden & Night Bioluminescence',
        subtitle: 'Morning garden-eel colony dive followed by exciting starlight night dive.',
        highlights: ['Dive 7: Eel Garden gentle sand slope', 'Dive 8: Lighthouse night dive with Spanish dancers & fluorescent corals', 'Diver celebration dinner'],
        tag: 'Night Wonders',
        timeEstimate: 'Morning & 8:00 PM'
      },
      {
        day: 6,
        title: 'No-Fly Surface Interval & Departure',
        subtitle: 'Safe 24-hr surface interval, souvenir shopping, and airport transfer.',
        highlights: ['Relaxed seaside coffee overlooking Aqaba', 'Picking up local dates and spices', 'Private transfer to Sharm airport'],
        tag: 'Safe Interval & Fly',
        timeEstimate: 'Day Departure'
      }
    ]
  },
  {
    id: 'couples-escape',
    title: 'Couples Escape',
    titleAr: 'دهب للعشاق والأزواج',
    tagline: 'Private lagoon palapas, candlelit seaside seafood, stargazing, and boutique romance.',
    taglineAr: 'شلتات خاصة في اللاجونا، عشاء رومانسي بالشموع ع البحر، وسهرات النجوم.',
    durationDays: 5,
    idealFor: 'Couples, honeymooners, anniversaries, romantic getaways',
    idealForAr: 'شهر العسل، احتفالات الذكرى السنوية، والرحلات الرومانسية الهادية',
    pace: 'Balanced',
    paceAr: 'رومانسي ومتوازن',
    intensityScore: 2,
    freeTimeScore: 60,
    startingPriceEGP: 18900,
    heroImage: '/images/hero/gulf-sunset.jpg',
    badge: 'Romantic Suite',
    badgeAr: 'رومانسية وخصوصية',
    highlights: [
      'Deluxe seafront terrace suite with panoramic Red Sea sunrise views',
      'Private sunset boat cruise with artisanal appetizers & fresh juice',
      'Candlelit torchlight seafood dinner with private beachfront table',
      'Intimate desert canyon starlit campfire with Bedouin hospitality'
    ],
    highlightsAr: [
      'جناح ديلوكس بإطلالة بانورامية ع البحر وشروق الشمس',
      'رحلة يخت غروب خاصة مع مقبلات وعصائر طازة',
      'عشاء بحري بالشموع والمشاعل على طاولة خاصة ع الشاطئ',
      'سهرة عشاء هادية وخاصة في وادي جبلي تحت أضواء النجوم'
    ],
    includedItems: [
      '4 Nights deluxe sea-view boutique hotel suite with private jacuzzi/terrace',
      'Private VIP airport transfers in premium luxury vehicle',
      '1 Private sunset boat excursion for two with captain & refreshments',
      '1 Romantic beachfront seafood dinner with private server',
      '1 Couple wellness & relaxation massage session (60 mins)'
    ],
    includedItemsAr: [
      'إقامة ٤ ليالي في جناح بوتيك فاخر بإطلالة بحرية مباشرة وجاكوزي',
      'توصيل VIP خاص بسيارة فارهة من وإلى المطار',
      'رحلة يخت خاصة لشخصين مع القبطان ومشروبات منعشة',
      'عشاء رومانسي متكامل على شاطئ البحر بمشاعل الشموع',
      'جلسة مساج واسترخاء مزدوجة للأزواج لمدة ٦٠ دقيقة'
    ],
    customizableItems: [
      'Add romantic bed decoration & celebratory flowers on arrival',
      'Upgrade to secluded private eco-villa with private pool',
      'Add private photographer for golden hour couples shoot',
      'Include private horse riding along Laguna shoreline at sunrise'
    ],
    customizableItemsAr: [
      'إضافة ورود وترتيبات ترحيبية خاصة عند الوصول',
      'ترقية لفيلا بيئية معزولة مع حمام سباحة خاص',
      'جلسة تصوير احترافية خاصة للزوجين في وقت الغروب الذهبي',
      'ركوب خيل خاص لشخصين ع شاطئ اللاجونا وقت الشروق'
    ],
    defaultInterests: ['Beach', 'Food', 'Adventure'],
    defaultBudget: 'Premium',
    dayByDay: [
      {
        day: 1,
        title: 'VIP Arrival & Romantic Welcome',
        subtitle: 'Smooth luxury transfer, check-in to sea-view suite, welcome fresh fruit & sunset drinks.',
        highlights: ['Private airport greeting & transfer', 'Check-in to deluxe terrace suite', 'Sunset cocktails overlooking Saudi mountains'],
        tag: 'Welcome Romance',
        timeEstimate: 'Afternoon'
      },
      {
        day: 2,
        title: 'Couples Spa & Secret Cove Stroll',
        subtitle: 'Relaxing 60-min beachfront massage followed by peaceful swimming in turquoise waters.',
        highlights: ['Dual relaxation aromatherapy massage', 'Quiet seaside lunch at secluded cove', 'Evening dinner under lanterns'],
        tag: 'Wellness & Calm',
        timeEstimate: 'Full Day'
      },
      {
        day: 3,
        title: 'Private Sunset Boat & Candlelit Seafood',
        subtitle: 'Private boat along the coast followed by torchlit 3-course seafood dinner on the sand.',
        highlights: ['Private coastal cruise with swim stops', 'Golden hour sunset over mountains', 'Beachfront table dinner by torchlight'],
        tag: 'Golden Twilight',
        timeEstimate: 'Afternoon & Night'
      },
      {
        day: 4,
        title: 'Desert Canyon Oasis & Starlight Tea',
        subtitle: 'Private 4x4 drive into quiet canyon for secluded stargazing and gourmet Bedouin campfire meal.',
        highlights: ['Romantic desert valley drive', 'Private cliffside sunset tea', 'Stargazing by crackling campfire'],
        tag: 'Sinai Stars',
        timeEstimate: 'Afternoon to Night'
      },
      {
        day: 5,
        title: 'Sunrise Terrace Breakfast & Farewell',
        subtitle: 'Gourmet breakfast served on your private balcony before VIP airport transfer.',
        highlights: ['Sunrise over the Gulf of Aqaba', 'Balcony breakfast with fresh pastries & espresso', 'VIP transfer to airport'],
        tag: 'Cherished Memories',
        timeEstimate: 'Morning Departure'
      }
    ]
  }
];

export const READY_TRIP_PROGRAMS: ReadyTripProgram[] = [...DAHAB_PROGRAMS, ...DESTINATION_PROGRAMMES];
