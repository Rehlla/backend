/**
 * The multi-city registry seed (report 10 §4.1 / gap C-1 of report 11).
 *
 * `CitySeed` grew from a display stub (name + counters + chrome) into the
 * target `CityRecord` shape: every field the city screens and the planner
 * previously hardcoded now lives on the row — `kind` replaces the semantic
 * branch, `blurb` replaces the single-language `vibe` at display time,
 * `services` is the honest map of what the city actually serves today, and
 * `planner`/`transfer` replace screens.js / transfer constants.
 *
 * The database mirror lives in `cities` (schema.ts CityEntity); this seed is
 * the single authoring source and migrations reconcile it into SQLite at boot.
 */

export type CityKind = 'sea' | 'oasis' | 'desert' | 'river';
export type CityService =
  | 'exp'
  | 'stay'
  | 'sights'
  | 'food'
  | 'bike'
  | 'transfer'
  | 'night';

export interface CitySeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  featureCount: number;
  tourismCount: number;
  catalogue: 'live' | 'early';
  /** Legacy single-language tagline. Kept for compat; prefer `blurb`. */
  vibe: string;
  chrome: { abyss: string; salt: string };
  heroImage: string;
  swatch: [string, string];
  wikidata?: string | null;
  population?: number | null;
  bounds?: { latMin: number; latMax: number; lngMin: number; lngMax: number };
  /* ------------------------------------------------------------------
   * Report-11 growth (CityRecord, 10 §4.1)
   * ------------------------------------------------------------------ */
  /** Governorate / region pair. */
  region?: { ar: string; en: string };
  /** Bilingual one-liner shown on the city sheet and the greeter chip. */
  blurb?: { ar: string; en: string };
  /** English twin of `vibe` (transition shim while screens migrate). */
  vibeEn?: string;
  /** Semantic lineage that replaces every hardcoded `cid === ...` branch. */
  kind?: CityKind;
  /** Surfaces the city serves TODAY (funnels UI affordances: no dead tabs). */
  services?: CityService[];
  /** Planner behavior: pool source + heat avoidance (siwa/luxor/aswan). */
  planner?: { pool: 'experiences' | 'areas'; heatAvoid: boolean };
  /** Intercity drive numbers feeding the transfer surface (10 §4.1). */
  transfer?: { to: string; km: number; minutes?: number }[];
}

export const CITIES_SEED: CitySeed[] = [
  {
    slug: 'dahab',
    nameAr: 'دهب',
    nameEn: 'Dahab',
    featureCount: 851,
    tourismCount: 123,
    catalogue: 'live',
    vibe: 'نشاط ومغامرة',
    vibeEn: 'Activity and adventure',
    chrome: { abyss: '#0B151C', salt: '#F5F4F0' },
    heroImage: '/images/hero/coral-reef-split.jpg',
    swatch: ['#1F9D97', '#9A5642'],
    bounds: { latMin: 28.4, latMax: 28.6, lngMin: 34.45, lngMax: 34.58 },
    wikidata: 'Q1234',
    population: 15000,
    region: { ar: 'جنوب سيناء', en: 'South Sinai' },
    blurb: {
      ar: 'مرجان من الشاطئ، وديان ملوّنة، وليالي هادئة — مدينة البحر الأقرب لقلب سيناء.',
      en: "Shoreline coral, colored canyons and quiet nights — Sinai's own sea town.",
    },
    kind: 'sea',
    services: ['exp', 'stay', 'sights', 'food', 'bike', 'transfer', 'night'],
    planner: { pool: 'experiences', heatAvoid: false },
    transfer: [
      { to: 'nuweiba', km: 88, minutes: 75 },
      { to: 'sharm', km: 170, minutes: 135 },
    ],
  },
  {
    slug: 'sharm',
    nameAr: 'شرم الشيخ',
    nameEn: 'Sharm El Sheikh',
    featureCount: 2778,
    tourismCount: 158,
    catalogue: 'early',
    vibe: 'غوص وحياة ليلية',
    vibeEn: 'Diving and nightlife',
    chrome: { abyss: '#0A1A2A', salt: '#FEF3C7' },
    heroImage: '/images/cities/sharm.webp',
    swatch: ['#0EA5E9', '#60A5FA'],
    bounds: { latMin: 27.7, latMax: 28.08, lngMin: 34.22, lngMax: 34.47 },
    wikidata: 'Q5678',
    population: 73000,
    region: { ar: 'جنوب سيناء', en: 'South Sinai' },
    blurb: {
      ar: 'شعاب عالمية ومدارس غوص أسطورية — عاصمة البحر الأحمر للغوص والحياة الليلية.',
      en: 'World-class reefs and legendary dive schools — the Red Sea dive capital.',
    },
    kind: 'sea',
    services: ['sights', 'stay', 'food', 'night', 'transfer'],
    planner: { pool: 'areas', heatAvoid: false },
    transfer: [
      { to: 'dahab', km: 170, minutes: 135 },
      { to: 'nuweiba', km: 118, minutes: 90 },
    ],
  },
  {
    slug: 'hurghada',
    nameAr: 'الغردقة',
    nameEn: 'Hurghada',
    featureCount: 3135,
    tourismCount: 126,
    catalogue: 'early',
    vibe: 'حياة بحرية',
    vibeEn: 'Marine life',
    chrome: { abyss: '#1A1A0A', salt: '#FEF9E7' },
    heroImage: '/images/cities/hurghada.webp',
    swatch: ['#F59E0B', '#FDE68A'],
    bounds: { latMin: 27.16, latMax: 27.46, lngMin: 33.62, lngMax: 33.9 },
    wikidata: 'Q9017',
    population: 120000,
    region: { ar: 'البحر الأحمر', en: 'Red Sea' },
    blurb: {
      ar: 'جزر قبالة الشاطئ وأسواق ليلية — عاصمة رحلات اليوم الكامل والغوص.',
      en: 'Offshore islands and night souqs — the day-boat and diving capital.',
    },
    kind: 'sea',
    services: ['sights', 'stay', 'food', 'transfer'],
    planner: { pool: 'areas', heatAvoid: false },
    transfer: [{ to: 'marsa_alam', km: 270, minutes: 210 }],
  },
  {
    slug: 'marsa_alam',
    nameAr: 'مرسى علم',
    nameEn: 'Marsa Alam',
    featureCount: 1529,
    tourismCount: 51,
    catalogue: 'early',
    vibe: 'غوص ومغامرة',
    vibeEn: 'Diving and adventure',
    chrome: { abyss: '#1A2A0A', salt: '#ECFDF5' },
    heroImage: '/images/cities/marsa_alam.webp',
    swatch: ['#10B981', '#6EE7B7'],
    bounds: { latMin: 25.0, latMax: 25.6, lngMin: 34.58, lngMax: 34.95 },
    wikidata: 'Q3456',
    population: 30000,
    region: { ar: 'البحر الأحمر', en: 'Red Sea' },
    blurb: {
      ar: 'شعاب لم تُمسّ بعد ومواطن البقرة البحرية — الحافة الهادئة للبحر الأحمر.',
      en: "Untouched reefs and dugong country — the Red Sea's quiet edge.",
    },
    kind: 'sea',
    services: ['sights', 'stay', 'food', 'transfer'],
    planner: { pool: 'areas', heatAvoid: false },
    transfer: [{ to: 'hurghada', km: 270, minutes: 210 }],
  },
  {
    slug: 'siwa',
    nameAr: 'سيوة',
    nameEn: 'Siwa',
    featureCount: 136,
    tourismCount: 35,
    catalogue: 'early',
    vibe: 'استشفاء وتأمل',
    vibeEn: 'Wellness and slow travel',
    chrome: { abyss: '#16130F', salt: '#F6F2EA' },
    heroImage: '/images/hero/splash-desert-golden.webp',
    swatch: ['#A3E635', '#D9B583'],
    bounds: { latMin: 29.15, latMax: 29.25, lngMin: 25.45, lngMax: 25.55 },
    wikidata: 'Q2345',
    population: 25000,
    region: { ar: 'مطروح', en: 'Matrouh' },
    blurb: {
      ar: 'عُيون ملوّحة بين نخيل، وغروب يُشاهد من قمم رملية — واحة تعيش على مهلها.',
      en: 'Salt springs, palm groves and desert sunset climbs — an oasis, unhurried.',
    },
    kind: 'oasis',
    services: ['sights', 'food', 'transfer'],
    planner: { pool: 'areas', heatAvoid: true },
    transfer: [],
  },
  {
    slug: 'alexandria',
    nameAr: 'الإسكندرية',
    nameEn: 'Alexandria',
    featureCount: 667,
    tourismCount: 120,
    catalogue: 'live',
    vibe: 'تاريخ وحضارة',
    vibeEn: 'History and heritage',
    chrome: { abyss: '#0F172A', salt: '#DBEAFE' },
    heroImage: '/images/cities/alexandria.webp',
    swatch: ['#3B82F6', '#60A5FA'],
    bounds: { latMin: 31.0, latMax: 31.35, lngMin: 29.8, lngMax: 30.1 },
    wikidata: 'Q87',
    population: 5500000,
    region: { ar: 'الإسكندرية', en: 'Alexandria' },
    blurb: {
      ar: 'كورنيش المتوسط وشرفات حجرية عريقة — مدينة التاريخ والمكتبة والميناء.',
      en: 'Mediterranean corniche, stately balconies — the harbor legacy city.',
    },
    kind: 'sea',
    services: ['sights', 'food', 'transfer'],
    planner: { pool: 'areas', heatAvoid: false },
    transfer: [],
  },
  {
    slug: 'giza',
    nameAr: 'الجيزة',
    nameEn: 'Giza',
    featureCount: 1411,
    tourismCount: 330,
    catalogue: 'live',
    vibe: 'أهرامات وتاريخ',
    vibeEn: 'Pyramids and history',
    chrome: { abyss: '#1F1A0A', salt: '#FEF3C7' },
    heroImage: '/images/cities/giza.webp',
    swatch: ['#F59E0B', '#FDE68A'],
    bounds: { latMin: 29.8, latMax: 30.2, lngMin: 31.0, lngMax: 31.3 },
    wikidata: 'Q9859',
    population: 4200000,
    region: { ar: 'الجيزة', en: 'Giza' },
    blurb: {
      ar: 'هضبة الأهرامات وأقدم عجائب الدنيا — البطاقة التعريفية لمصر.',
      en: "The pyramids plateau and the iconic view — Egypt's intro card.",
    },
    kind: 'desert',
    services: ['sights', 'food', 'transfer'],
    planner: { pool: 'areas', heatAvoid: true },
    transfer: [],
  },
  {
    slug: 'nuweiba',
    nameAr: 'نويبع',
    nameEn: 'Nuweiba',
    featureCount: 16,
    tourismCount: 11,
    catalogue: 'early',
    vibe: 'هدوء وبحر',
    vibeEn: 'Quiet and seaside',
    chrome: { abyss: '#0A1F2A', salt: '#CFFAFE' },
    heroImage: '/images/cities/nuweiba.webp',
    swatch: ['#06B6D4', '#67E8F9'],
    bounds: { latMin: 28.9, latMax: 29.1, lngMin: 34.6, lngMax: 34.7 },
    wikidata: 'Q1960458',
    population: 1200,
    region: { ar: 'جنوب سيناء', en: 'South Sinai' },
    blurb: {
      ar: 'جدران غوص عميقة وخليج فيروزي هادئ — أصغر مدن البحر وأهدأها.',
      en: 'Deep gulf views and dive-wall peace — the smallest sea town.',
    },
    kind: 'sea',
    services: ['sights', 'transfer'],
    planner: { pool: 'areas', heatAvoid: false },
    transfer: [
      { to: 'dahab', km: 88, minutes: 75 },
      { to: 'sharm', km: 118, minutes: 90 },
    ],
  },
  {
    slug: 'luxor',
    nameAr: 'الأقصر',
    nameEn: 'Luxor',
    featureCount: 957,
    tourismCount: 206,
    catalogue: 'live',
    vibe: 'معابد وتاريخ',
    vibeEn: 'Temples and tombs',
    chrome: { abyss: '#3F1D0A', salt: '#FEF3C7' },
    heroImage: '/images/cities/luxor.webp',
    swatch: ['#F59E0B', '#FEF3C7'],
    bounds: { latMin: 25.50, latMax: 25.90, lngMin: 32.40, lngMax: 32.80 },
    wikidata: 'Q1328',
    population: 506588,
    region: { ar: 'الأقصر', en: 'Luxor' },
    blurb: {
      ar: 'أعمدة معابد ومقابر وادي الملوك — متحف مفتوح على ضفاف النيل.',
      en: 'Temple columns and valley tombs — the open-air museum.',
    },
    kind: 'river',
    services: ['sights', 'food', 'transfer'],
    planner: { pool: 'areas', heatAvoid: true },
    transfer: [{ to: 'aswan', km: 220, minutes: 180 }],
  },
  {
    slug: 'aswan',
    nameAr: 'أسوان',
    nameEn: 'Aswan',
    featureCount: 373,
    tourismCount: 135,
    catalogue: 'live',
    vibe: 'نيل وتاريخ',
    vibeEn: 'Nile and heritage',
    chrome: { abyss: '#0A2A36', salt: '#CFFAFE' },
    heroImage: '/images/cities/aswan.webp',
    swatch: ['#06B6D4', '#CFFAFE'],
    bounds: { latMin: 23.80, latMax: 24.30, lngMin: 32.70, lngMax: 33.10 },
    wikidata: 'Q37196',
    population: 351332,
    region: { ar: 'أسوان', en: 'Aswan' },
    blurb: {
      ar: 'أمسيات فلوكة وجزر خضراء — الوجه الجنوبي اللطيف للنهر.',
      en: "Felucca evenings and island gardens — the river's gentle south.",
    },
    kind: 'river',
    services: ['sights', 'food', 'transfer'],
    planner: { pool: 'areas', heatAvoid: true },
    transfer: [{ to: 'luxor', km: 220, minutes: 180 }],
  },
  {
    slug: 'saint_catherine',
    nameAr: 'سانت كاترين',
    nameEn: 'Saint Catherine',
    featureCount: 126,
    tourismCount: 28,
    catalogue: 'early',
    vibe: 'ديني وجبال',
    vibeEn: 'Sacred mountains',
    chrome: { abyss: '#1E1B2E', salt: '#EDE9FE' },
    heroImage: '/images/cities/saint_catherine.webp',
    swatch: ['#7C3AED', '#EDE9FE'],
    bounds: { latMin: 28.30, latMax: 28.80, lngMin: 33.70, lngMax: 34.20 },
    wikidata: 'Q185362',
    population: 4603,
    region: { ar: 'جنوب سيناء', en: 'South Sinai' },
    blurb: {
      ar: 'شروق من جبل موسى ودير سانت كاترين الأثري — القمم المقدسة لمصر.',
      en: "Sunrise climbs and the ancient monastery — Egypt's high holy ground.",
    },
    kind: 'desert',
    services: ['sights', 'transfer'],
    planner: { pool: 'areas', heatAvoid: false },
    transfer: [],
  },
  {
    slug: 'taba',
    nameAr: 'طابا',
    nameEn: 'Taba',
    featureCount: 86,
    tourismCount: 25,
    catalogue: 'early',
    vibe: 'بحر وحدود',
    vibeEn: 'Sea and border',
    chrome: { abyss: '#0A1F2E', salt: '#CFFAFE' },
    heroImage: '/images/cities/taba.webp',
    swatch: ['#0E7490', '#CFFAFE'],
    bounds: { latMin: 29.20, latMax: 29.65, lngMin: 34.60, lngMax: 35.00 },
    wikidata: 'Q114647',
    population: 7097,
    region: { ar: 'جنوب سيناء', en: 'South Sinai' },
    blurb: {
      ar: 'مياه خليج صافية وجزيرة فرعون عند الشاطئ — ساحل الحدود الهادئ.',
      en: "Gulf water and Pharaoh's Island — the quiet border coast.",
    },
    kind: 'sea',
    services: ['sights', 'transfer'],
    planner: { pool: 'areas', heatAvoid: false },
    transfer: [],
  },
];

// Verification: console.log(CITIES_SEED.length) prints 12
