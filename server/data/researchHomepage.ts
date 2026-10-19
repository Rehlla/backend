/**
 * Research-grounded homepage content.
 *
 * Source of truth for the public homepage's "handbook" layer — seasonality,
 * real-priced experiences, landmarks, and safety resources. Every string is
 * transcribed from the verified corpus in `docs/research/` (last audited
 * August 2026). Bilingual EN/AR so the server remains the single source of
 * truth for the research text and the client just renders the current locale.
 *
 * Honesty rules honoured here (see `docs/research/DAHAB_TRUST_CLAIM_REGISTRY.md`):
 * - No self-declared VERIFIED / ECO_CERTIFIED badges presented as independent
 *   audits — there are no CDWS license numbers on file to prove them.
 * - No "250+ interviews" methodology claim (fabricated in TRAVELER_PERSONAS).
 * - No invented UV / visibility numbers; live sensor readings come only from
 *   the weather service, not from these static facts.
 * - No product-marketing copy ("Dynamic Disruption Radar", etc.) as facts.
 */

export interface Bilingual {
  en: string;
  ar: string;
}

export interface SeasonRow {
  month: number;
  airC: Bilingual;
  seaC: Bilingual;
  wind: Bilingual;
  description: Bilingual;
  recommended: Bilingual[];
  urgency?: Bilingual;
}

export interface Experience {
  id: string;
  /** The catalogue activity this outing is, which is what its card opens and books. */
  activityId?: string;
  name: Bilingual;
  duration: Bilingual;
  priceEgp: string;
  skill: Bilingual;
  modality: Bilingual;
  walk?: Bilingual;
}

export interface Landmark {
  id: string;
  name: Bilingual;
  fact: Bilingual;
  access: Bilingual;
  connectivity: Bilingual;
  tier: Bilingual;
}

export interface SafetyContact {
  label: Bilingual;
  number: string;
}

export interface SafetyRule {
  en: string;
  ar: string;
}

export interface ResearchOverview {
  seasonal: SeasonRow[];
  experiences: Experience[];
  landmarks: Landmark[];
  safety: {
    contacts: SafetyContact[];
    note: Bilingual;
    rules: SafetyRule[];
  };
  provenance: string;
}

/** 12-month seasonality matrix, abridged to what the homepage surfaces. */
export const SEASONAL_MATRIX: SeasonRow[] = [
  {
    month: 1,
    airC: { en: '21°C day / 10°C night', ar: '21°م نهاراً / 10°م ليلاً' },
    seaC: { en: '22°C', ar: '22°م' },
    wind: { en: 'Moderate winter breeze · 10–18 kn', ar: 'نسيم شتوي معتدل · 10–18 عقدة' },
    description: {
      en: 'Quiet winter saver. Deep tech diving in water warm relative to the air, St. Catherine treks and Wadi Qnai bouldering come into their own.',
      ar: 'موسم شتوي هادئ بأسعار مخفّضة. الغوص التقني العميق في مياه دافئة نسبياً للهواء، ورحلات سانت كاترين وتسلق وادي قني.'
    },
    recommended: [
      { en: 'St. Catherine treks', ar: 'رحلات سانت كاترين' },
      { en: 'Deep tech diving', ar: 'الغوص التقني العميق' }
    ],
    urgency: {
      en: '5–7mm wetsuits mandatory; summit nights near 0°C.',
      ar: 'بدلات غوص 5–7 مم إلزامية؛ ليالي القمم قارسة قرب 0°م.'
    }
  },
  {
    month: 2,
    airC: { en: '22°C day / 11°C night', ar: '22°م نهاراً / 11°م ليلاً' },
    seaC: { en: '21°C', ar: '21°م' },
    wind: { en: 'Occasional northern storms', ar: 'عواصف شمالية متفرقة' },
    description: {
      en: 'The coldest sea of the year. A low, value-tuned month for rock climbing, desert exploration and quiet promenade work.',
      ar: 'أبرد بحر في العام. شهر منخفض بأسعار مناسبة لتسلق الجبال واستكشاف الصحراء والعمل الهادئ على الممشى.'
    },
    recommended: [
      { en: 'Rock climbing', ar: 'تسلق الجبال' },
      { en: 'Mountain exploration', ar: 'استكشاف الجبال' }
    ],
    urgency: {
      en: 'Hooded vests recommended at the coldest sea temperature.',
      ar: 'يُنصح بقمصان بقلنسوة في أبرد درجة حرارة للبحر.'
    }
  },
  {
    month: 3,
    airC: { en: '25°C day / 14°C night', ar: '25°م نهاراً / 14°م ليلاً' },
    seaC: { en: '22°C', ar: '22°م' },
    wind: { en: 'Steady thermal wind · 15–22 kn', ar: 'رياح حرارية ثابتة · 15–22 عقدة' },
    description: {
      en: 'Spring starts the season. Kitesurfing on the Laguna and reef diving balance into an excellent active-sports window.',
      ar: 'الربيع يفتتح الموسم. يتوازن الكايت سيرف على اللاجونا مع الغوص على الشعب في نافذة رياضية ممتازة.'
    },
    recommended: [
      { en: 'Kitesurfing at the Laguna', ar: 'الكايت سيرف في اللاجونا' },
      { en: 'Scuba reef dives', ar: 'غوصات الشعاب' }
    ]
  },
  {
    month: 4,
    airC: { en: '28°C day / 17°C night', ar: '28°م نهاراً / 17°م ليلاً' },
    seaC: { en: '23°C', ar: '23°م' },
    wind: { en: 'Warm spring breeze · 16–24 kn', ar: 'نسيم ربيعي دافئ · 16–24 عقدة' },
    description: {
      en: 'Windsurfing, freediving and a boat safari to Gabr El Bint — a high-leisure spring window.',
      ar: 'ويند سيرف وفريدايفينج وسفاري بالقارب إلى جبر البنت — نافذة ربيعية عالية الترفيه.'
    },
    recommended: [
      { en: 'Windsurfing', ar: 'ويند سيرف' },
      { en: 'Boat safari to Gabr El Bint', ar: 'سفاري بالقارب إلى جبر البنت' }
    ],
    urgency: {
      en: 'Sham El-Nessim & Easter surge — book hotels and transfers in advance.',
      ar: 'ذروة شم النسيم وأعياد القيامة — احجز الفنادق والانتقالات مسبقاً.'
    }
  },
  {
    month: 5,
    airC: { en: '32°C day / 21°C night', ar: '32°م نهاراً / 21°م ليلاً' },
    seaC: { en: '24°C', ar: '24°م' },
    wind: { en: 'Strong consistent thermal winds', ar: 'رياح حرارية قوية ثابتة' },
    description: {
      en: 'Prime watersports. Kitesurfing, snorkeling, night dives and sunset dinners.',
      ar: 'موسم الرياضات المائية الأفضل. كايت سيرف، سنوركلينج، غوص ليلي وعشاء وقت الغروب.'
    },
    recommended: [
      { en: 'Kitesurfing', ar: 'كايت سيرف' },
      { en: 'Sunset dinners', ar: 'عشاء وقت الغروب' }
    ],
    urgency: {
      en: 'High UV — seek midday shade.',
      ar: 'أشعة فوق بنفسجية عالية — ابتعد عن الشمس وقت الظهيرة.'
    }
  },
  {
    month: 6,
    airC: { en: '35°C day / 25°C night', ar: '35°م نهاراً / 25°م ليلاً' },
    seaC: { en: '26°C', ar: '26°م' },
    wind: { en: 'High wind corridor · 18–28 kn', ar: 'ممر رياح عالية · 18–28 عقدة' },
    description: {
      en: 'Summer digital-nomad month. Early-morning diving and late-afternoon Laguna kitesurfing beat the midday heat.',
      ar: 'شهر المستقلين الرقميين الصيفي. الغوص صباحاً الباكر وكايت سيرف اللاجونا بعد الظهر لتجنب حرارة منتصف النهار.'
    },
    recommended: [
      { en: 'Early morning diving', ar: 'الغوص الصباحي الباكر' },
      { en: 'Afternoon Laguna kitesurf', ar: 'كايت سيرف اللاجونا مساءً' }
    ],
    urgency: {
      en: 'Leave early for dives before peak midday heat.',
      ar: 'غادر مبكراً للغوص قبل ذروة حرارة الظهيرة.'
    }
  },
  {
    month: 7,
    airC: { en: '37°C day / 27°C night', ar: '37°م نهاراً / 27°م ليلاً' },
    seaC: { en: '27°C', ar: '27°م' },
    wind: { en: 'High wind & desert heat', ar: 'رياح عالية وحرارة صحراوية' },
    description: {
      en: 'Keep to short 1–2 hour water sessions and slow desert evenings under the mountain camps.',
      ar: 'اكتفِ بجلسات مائية قصيرة من ساعة لساعتين وأمسيات صحراوية هادئة في مخيمات الجبال.'
    },
    recommended: [
      { en: 'Short water sessions', ar: 'جلسات مائية قصيرة' },
      { en: 'Evening mountain camps', ar: 'أمسيات مخيمات الجبال' }
    ],
    urgency: {
      en: 'Hydration mandatory; no midday mountain treks.',
      ar: 'الترطيب إلزامي؛ لا رحلات جبلية وقت الظهيرة.'
    }
  },
  {
    month: 8,
    airC: { en: '38°C day / 28°C night', ar: '38°م نهاراً / 28°م ليلاً' },
    seaC: { en: '28°C', ar: '28°م' },
    wind: { en: 'Steady thermal afternoon wind', ar: 'رياح حرارية ثابتة بعد الظهر' },
    description: {
      en: 'The warmest sea of the year and Egypt\'s peak domestic season — snorkeling at Lighthouse, freediving and night boat trips.',
      ar: 'أحر بحر في العام وذروة الموسم السياحي المصري — سنوركلينج في اللايتهاوس وفريدايفينج ورحلات ليلية بالقارب.'
    },
    recommended: [
      { en: 'Snorkeling at Lighthouse', ar: 'سنوركلينج في اللايتهاوس' },
      { en: 'Night boat trips', ar: 'رحلات ليلية بالقارب' }
    ],
    urgency: {
      en: 'Peak domestic demand — expect busy beaches and high seafood turnover.',
      ar: 'ذروة الطلب المحلي — توقع شواطئ مزدحمة وإقبالاً كبيراً على المأكولات البحرية.'
    }
  },
  {
    month: 9,
    airC: { en: '34°C day / 24°C night', ar: '34°م نهاراً / 24°م ليلاً' },
    seaC: { en: '27°C', ar: '27°م' },
    wind: { en: 'Moderate wind, calm outer seas', ar: 'رياح معتدلة وبحار خارجية هادئة' },
    description: {
      en: 'The golden diving season — ideal underwater visibility of 30m+. Canyon chasm, Blue Hole and Abu Galum boat safaris.',
      ar: 'موسم الغوص الذهبي — رؤية تحت الماء مثالية تتجاوز 30م. وادي الكانيون والبلو هول وسفاريات أبو جالوم.'
    },
    recommended: [
      { en: 'The Canyon chasm', ar: 'وادي الكانيون' },
      { en: 'Abu Galum boat safari', ar: 'سفاري أبو جالوم بالقارب' }
    ]
  },
  {
    month: 10,
    airC: { en: '30°C day / 20°C night', ar: '30°م نهاراً / 20°م ليلاً' },
    seaC: { en: '26°C', ar: '26°م' },
    wind: { en: 'Gentle to moderate breeze · 12–18 kn', ar: 'نسيم خفيف إلى معتدل · 12–18 عقدة' },
    description: {
      en: 'The peak international season — perfect climate across sea and desert. Every activity opens up.',
      ar: 'ذروة الموسم الدولي — طقس مثالي بين البحر والصحراء. كل الأنشطة متاحة.'
    },
    recommended: [
      { en: 'All activities', ar: 'جميع الأنشطة' },
      { en: 'Peak season diving', ar: 'غوص ذروة الموسم' }
    ]
  },
  {
    month: 11,
    airC: { en: '26°C day / 15°C night', ar: '26°م نهاراً / 15°م ليلاً' },
    seaC: { en: '25°C', ar: '25°م' },
    wind: { en: 'Mild sea breeze', ar: 'نسيم بحري لطيف' },
    description: {
      en: 'High-leisure autumn for diving and trekking — White Canyon, Blue Hole and Mount Twilat stargazing, with strong outdoor climbing.',
      ar: 'خريف ممتاز للغوص والمشي — الكانيون الأبيض والبلو هول ومشاهدة النجوم من جبل الطويلات مع تسلق خارجي ممتاز.'
    },
    recommended: [
      { en: 'White Canyon', ar: 'الكانيون الأبيض' },
      { en: 'Mount Twilat stargazing', ar: 'مشاهدة النجوم من جبل الطويلات' }
    ]
  },
  {
    month: 12,
    airC: { en: '22°C day / 12°C night', ar: '22°م نهاراً / 12°م ليلاً' },
    seaC: { en: '23°C', ar: '23°م' },
    wind: { en: 'Crisp sunny days, cool evenings', ar: 'أيام مشمسة صافية وأمسيات باردة' },
    description: {
      en: 'New Year holiday peaks — festive dive packages and St. Catherine sunrise hikes.',
      ar: 'ذروة أعياد رأس السنة — باقات غوص احتفالية ومشي فجراً في سانت كاترين.'
    },
    recommended: [
      { en: 'Holiday dive packages', ar: 'باقات غوص الأعياد' },
      { en: 'St. Catherine sunrise hikes', ar: 'مشي سانت كاترين عند الفجر' }
    ],
    urgency: {
      en: 'Peak holiday pricing — book two weeks ahead.',
      ar: 'أسعار الذروة في الأعياد — احجز قبل أسبوعين.'
    }
  }
];

/** Real-priced micro-catalogue from the Activities Atlas, abridged to six. */
export const MICRO_EXPERIENCES: Experience[] = [
  {
    id: 'act-try-dive',
    activityId: 'ACT-INTRO-DISCOVER-DIVE',
    name: { en: 'Guided Try Scuba Dive', ar: 'تجربة غطس للمبتدئين' },
    duration: { en: '1.5–2 hr', ar: '1.5–2 ساعة' },
    priceEgp: '1,200–1,600',
    skill: { en: 'No experience needed', ar: 'لا تتطلب خبرة' },
    modality: { en: 'Book now', ar: 'احجز الآن' },
    walk: { en: 'Lighthouse Bay', ar: 'خليج اللايتهاوس' }
  },
  {
    id: 'act-eel-snorkel',
    activityId: 'act_eel_garden_sunset_snorkel',
    name: { en: 'Sunset Eel Garden Snorkel', ar: 'سنوركلينج حديقة ثعابين البحر' },
    duration: { en: '1–1.5 hr', ar: '1–1.5 ساعة' },
    priceEgp: '250–450',
    skill: { en: 'Beginner', ar: 'مبتدئ' },
    modality: { en: 'Walk-in', ar: 'دخول مباشر' },
    walk: { en: '8-min walk from Lighthouse', ar: '٨ دقائق مشياً من اللايتهاوس' }
  },
  {
    id: 'act-laguna-kitesurf',
    activityId: 'ACT-LAGUNA-KITESURF',
    name: { en: 'Intro Kitesurf Lesson', ar: 'درس كايت سيرف تمهيدي' },
    duration: { en: '2 hr', ar: 'ساعتان' },
    priceEgp: '1,800–2,800',
    skill: { en: 'Beginner to advanced', ar: 'مبتدئ إلى متقدم' },
    modality: { en: 'Advance booking', ar: 'حجز مسبق' },
    walk: { en: 'Laguna Sand Spit', ar: 'اللسان الرملي باللاجونا' }
  },
  {
    id: 'act-promenade-bike',
    name: { en: 'Seafront Cruiser Bike', ar: 'دراجة الممشى' },
    duration: { en: '1–2 hr', ar: '1–2 ساعة' },
    priceEgp: '150–250',
    skill: { en: 'All / leisure', ar: 'للجميع / ترفيهي' },
    modality: { en: 'Walk-in', ar: 'دخول مباشر' },
    walk: { en: 'Masbat to Mashraba', ar: 'من المصبط إلى المشربة' }
  },
  {
    id: 'act-canyon-dive',
    activityId: 'act_the_canyon_scuba_adventure',
    name: { en: 'Guided Dive at The Canyon', ar: 'غطسة الكانيون الاستكشافية' },
    duration: { en: '2.5 hr', ar: '2.5 ساعة' },
    priceEgp: '1,400–1,800',
    skill: { en: 'Advanced Open Water', ar: 'متقدم مياه مفتوحة' },
    modality: { en: 'Book now', ar: 'احجز الآن' },
    walk: { en: 'The Canyon Reef', ar: 'شعاب الكانيون' }
  },
  {
    id: 'act-twilat-sunset',
    activityId: 'act_mount_twilat_bedouin_stargazing',
    name: { en: 'Mount Twilat Sunset & Stargazing', ar: 'غروب وشاي بدوي في جبل الطويلات' },
    duration: { en: '2.5–3 hr', ar: '2.5–3 ساعات' },
    priceEgp: '350–650',
    skill: { en: 'All / leisure', ar: 'للجميع / ترفيهي' },
    modality: { en: '1-hr notice', ar: 'إشعار قبل ساعة' },
    walk: { en: '15-min drive', ar: '١٥ دقيقة بالسيارة' }
  }
];

/** Landmark showcase from the Geography Atlas + Master Synthesis. */
export const LANDMARKS: Landmark[] = [
  {
    id: 'landmark-blue-hole',
    name: { en: 'The Blue Hole', ar: 'البلو هول' },
    fact: {
      en: 'An iconic 100m+ sinkhole with the Bells reef wall and a notorious underwater arch — a protected marine sanctuary.',
      ar: 'حفرة هبوط شهيرة تتجاوز 100م بسور شعاب البيلز وقوس شهير تحت الماء — محمية بحرية.'
    },
    access: { en: '22-min drive · paved road', ar: '٢٢ دقيقة بالسيارة · طريق ممهد' },
    connectivity: { en: '3G edge', ar: 'اتصال ضعيف 3G' },
    tier: { en: 'Outer Marine Protected', ar: 'محمية بحرية خارجية' }
  },
  {
    id: 'landmark-abu-galum',
    name: { en: 'Ras Abu Galum Reserve', ar: 'محمية رأس أبو جالوم' },
    fact: {
      en: 'A 500 sq km protected coastal wilderness with endemic Sinai flora, ibex and virgin coral — reachable only on foot or by boat.',
      ar: 'برية ساحلية محمية بمساحة 500 كيلومتر مربع بنباتات سيناء النادرة والوعول والشعاب البكر — لا تُزار إلا مشياً أو بالقارب.'
    },
    access: { en: '1.5-hr hike or 20-min boat', ar: 'ساعة ونصف مشياً أو ٢٠ دقيقة بالقارب' },
    connectivity: { en: 'Zero cell coverage', ar: 'لا تغطية جوّالة' },
    tier: { en: 'True Expedition', ar: 'رحلة استكشافية حقيقية' }
  },
  {
    id: 'landmark-st-catherine',
    name: { en: 'St. Catherine\'s Monastery', ar: 'دير سانت كاترين' },
    fact: {
      en: 'A 6th-century UNESCO World Heritage fortress monastery holding the Burning Bush and ancient biblical manuscripts.',
      ar: 'دير حصين مدرج على قائمة التراث العالمي من القرن السادس يضم العليقة المشتعلة ومخطوطات كتابية قديمة.'
    },
    access: { en: 'High Sinai', ar: 'جنوب سيناء المرتفعة' },
    connectivity: { en: 'Mountain trek', ar: 'مشي جبلي' },
    tier: { en: 'Cultural Heritage', ar: 'تراث ثقافي' }
  },
  {
    id: 'landmark-canyon',
    name: { en: 'The Canyon', ar: 'الكانيون' },
    fact: {
      en: 'An underwater limestone canyon at 30–52m, lit by cathedral light beams at 20m — advanced divers only.',
      ar: 'وادٍ من الحجر الجيري تحت الماء على عمق 30–52م، تضيئه أشعة ضوء كاتدرائية على عمق 20م — للغواصين المتقدمين فقط.'
    },
    access: { en: '15-min drive · unpaved coast road', ar: '١٥ دقيقة بالسيارة · طريق ساحلي غير ممهد' },
    connectivity: { en: 'Weak 3G/4G', ar: 'اتصال ضعيف' },
    tier: { en: 'Outer Marine', ar: 'خارجي بحري' }
  },
  {
    id: 'landmark-three-pools',
    name: { en: 'Three Pools', ar: 'البرك الثلاث' },
    fact: {
      en: 'Triplet sandy-bottom coral lagoons teeming with parrotfish and stingrays — the south\'s easy shore-entry gem.',
      ar: 'ثلاث بحيرات مرجانية برمل في القاع مفعمة بأسماك الببغاء وسمك الراي — جوهرة الجنوب السهلة الوصول.'
    },
    access: { en: 'South Dahab', ar: 'جنوب دهب' },
    connectivity: { en: 'Ride or taxi', ar: 'دراجة أو تاكسي' },
    tier: { en: 'Marine Reserve', ar: 'محمية بحرية' }
  }
];

/** Verified emergency + safety registry (Emergency Resource Register, Diving Research). */
export const SAFETY_RESOURCES = {
  contacts: [
    { label: { en: 'Medical emergency', ar: 'طوارئ طبية' }, number: '123' },
    { label: { en: 'Tourism police', ar: 'شرطة السياحة' }, number: '126' },
    { label: { en: 'Fire & rescue', ar: 'مطافئ وإنقاذ' }, number: '180' }
  ],
  note: {
    en: 'Dahab Hyperbaric Medical Center · +20 69 364 0535 · inside Dahab Central Hospital, 24/7 on-call.',
    ar: 'مركز دهب الطبي للطب الغواصي · ٢٠٦٩ ٣٦٤ ٠٥٣٥+ · داخل مستشفى دهب المركزي، على مدار الساعة.'
  },
  rules: [
    {
      en: 'The 24-hour no-fly rule — wait 18–24h after deep or multiple dives before flying from Sharm El-Sheikh.',
      ar: 'قاعدة عدم الطيران ٢٤ ساعة — انتظر 18–24 ساعة بعد الغوص العميق أو المتعدد قبل الطيران من شرم الشيخ.'
    },
    {
      en: 'No solo freediving — every depth session needs a certified buddy, lanyard and surface safety float.',
      ar: 'لا فريدايفينج منفرداً — كل جلسة عمق تتطلب رفيقاً معتمداً وحبل أمان وعوامة سلامة سطحية.'
    },
    {
      en: 'No gloves in the water and no reef walking — entry only through marked sandy channels.',
      ar: 'لا قفازات في الماء ولا مشي على الشعاب — الدخول فقط عبر قنوات رملية مميزة.'
    }
  ],
  provenance: 'docs/research · last audited August 2026'
};

export const RESEARCH_OVERVIEW: ResearchOverview = {
  seasonal: SEASONAL_MATRIX,
  experiences: MICRO_EXPERIENCES,
  landmarks: LANDMARKS,
  safety: SAFETY_RESOURCES,
  provenance: 'docs/research · last audited August 2026'
};
