import type { AppRoute } from '../types';

/**
 * planIntent.ts
 *
 * Deterministic, testable parsing for the homepage "Plan with AI" widget.
 *
 * Nothing here calls a model. The server endpoint that builds the actual
 * itinerary (`POST /api/trip/generate`) takes a small structured request
 * (duration, party, budget, pace, interests) rather than a paragraph, so a
 * free-text prompt must be turned into that shape before it goes over the
 * wire. Doing that on a rule table instead of an LLM keeps the widget honest
 * when Gemini is out of quota — the deterministic fallback itinerary still
 * gets the traveler's real duration and party — and it is unit-testable.
 *
 * Everything matches in both English and Egyptian-Arabic keywords. Numbers in
 * Arabic-Indic digits (٠-٩) are normalised first.
 */

export type PartyDynamic = 'Solo' | 'Couple' | 'Friends' | 'Family';

export interface PlanIntent {
  durationDays: number;
  adultsCount: number;
  childrenCount: number;
  dynamic: PartyDynamic;
  budget: 'budget' | 'moderate' | 'premium';
  pace: 'relaxed' | 'balanced' | 'active';
  /** Free-form interest labels, consumed by the trip generator prompt. */
  interests: string[];
}

const INTEREST_MAP: { label: string; keywords: RegExp }[] = [
  { label: 'Diving & Red Sea reefs', keywords: /\b(dive|diving|snorkel|snorkeling|reef|reefs|blue hole|scuba|freediv)/i },
  { label: 'Desert & canyons', keywords: /\b(desert|canyon|safari|jeep|quad|moses|catherine|mountain|camel|wadi|trek|hike)/i },
  { label: 'Seafood & local food', keywords: /\b(food|seafood|fish|restaurant|eat|eating|grill|dinner|cuisine)/i },
  { label: 'Beach & wellness', keywords: /\b(beach|lagoon|yoga|wellness|massage|relax|sunset|swim|kite)/i },
  { label: 'Bedouin culture & heritage', keywords: /\b(bedouin|culture|heritage|local|tea|camp)/i },
  { label: 'Diving & Red Sea reefs', keywords: /(غطس|سنوركل|شعاب|غوص|بلو هول|فريدايف)/ },
  { label: 'Desert & canyons', keywords: /(صحراء|كانيون|سفاري|جبل|موسى|سانت كاترين|جمل|وادي|مغامرة|مشي)/ },
  { label: 'Seafood & local food', keywords: /(أكل|مطاعم|سمك|سي فود|غداء|عشاء|مشويات|أكل بلدي)/ },
  { label: 'Beach & wellness', keywords: /(شاطئ|لاجون|يوجا|استرخاء|مساج|بحر|غروب|سباحة|كايت)/ },
  { label: 'Bedouin culture & heritage', keywords: /(بدوي|ثقافة|تراث|قعدة|شاي)/ }
];

const DEFAULT_INTERESTS = ['Diving & Red Sea reefs', 'Desert & canyons'];

/** Fallback defaults when the prompt does not say — the endpoint needs numbers. */
const DEFAULT_DURATION = 5;
const DEFAULT_ADULTS = 2;

/** Arabic-Indic digits (٠-٩) used throughout Egyptian copy, normalised to ASCII. */
function normaliseDigits(input: string): string {
  return input.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function firstIntMatch(text: string, pattern: RegExp): number | null {
  const m = text.match(pattern);
  if (!m) return null;
  const n = Number.parseInt(m[1] ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Reads a free-text trip prompt into the structured shape the generator takes.
 * Unknown fields fall back to sensible defaults (5 days, 2 adults, Friends,
 * Moderate, Balanced) so an underspecified "help me plan!" still produces a
 * real itinerary rather than an error.
 */
export function extractPlanIntent(rawPrompt: string): PlanIntent {
  const text = normaliseDigits(rawPrompt.trim());

  let durationDays = firstIntMatch(text, /\b(\d{1,2})\s*(days?|d|nights?|n|ليالي?|أيام|ايام)\b/i);
  // Spelled-out spans people actually use instead of a number.
  if (durationDays === null) {
    if (/\b(weekend)\b/i.test(text) || /(ويكند)/.test(text)) durationDays = 3;
    else if (/\b(week)\b/i.test(text) || /(أسبوع|اسبوع)/.test(text)) durationDays = 7;
  }
  const resolvedDuration = durationDays ?? DEFAULT_DURATION;
  const adultsCount =
    firstIntMatch(text, /\b(\d{1,2})\s*(adults?|people|persons|travelers?|pax|بالغين?|نفر|أشخاص|اشخاص)\b/i) ??
    DEFAULT_ADULTS;
  const childrenCount = firstIntMatch(text, /\b(\d{1,2})\s*(kids?|children|child|عيال|أطفال|اطفال)\b/i) ?? 0;

  let dynamic: PartyDynamic = 'Friends';
  if (/\b(solo|alone|by myself|single)\b/i.test(text) || /(لوحدي|بمفردي|منفرد)/.test(text)) dynamic = 'Solo';
  else if (/\b(couple|honeymoon|romantic|anniversary)\b/i.test(text) || /(زوجين|رومانسي|شهر عسل|اتنين)/.test(text)) dynamic = 'Couple';
  else if (/\b(family|kids?|children|parents|grandparents)\b/i.test(text) || /(عيلة|أطفال|عيال|أسرة|اسرة)/.test(text)) dynamic = 'Family';

  let budget: PlanIntent['budget'] = 'moderate';
  if (/\b(budget|cheap|budget friendly|economy|backpacker)\b/i.test(text) || /(رخيص|اقتصادي|ميزانية صغيرة)/.test(text)) budget = 'budget';
  else if (/\b(premium|luxury|high.?end|pamper|5.?star)\b/i.test(text) || /(فاخر|لوكس|خمس نجوم)/.test(text)) budget = 'premium';

  let pace: PlanIntent['pace'] = 'balanced';
  if (/\b(relaxed|slow|chill|easy|leisurely|recover)\b/i.test(text) || /(رايق|هادئ|على مهلي|مريح|slow)/i.test(text)) pace = 'relaxed';
  else if (/\b(active|full.?on|packed|intense|adventurous|early)\b/i.test(text) || /(نشيط|مليان|مغامر|سريع)/.test(text)) pace = 'active';

  const matchedInterests = INTEREST_MAP.filter(({ keywords }) => keywords.test(text)).map(({ label }) => label);
  const interests = Array.from(new Set(matchedInterests.length > 0 ? matchedInterests : DEFAULT_INTERESTS));

  return {
    durationDays: Math.min(14, Math.max(1, resolvedDuration)),
    adultsCount: Math.min(20, Math.max(1, adultsCount)),
    childrenCount: Math.min(10, Math.max(0, childrenCount)),
    dynamic,
    budget,
    pace,
    interests
  };
}

// ---------------------------------------------------------------------------
// Quick answers for conversational prompts (the "chat" half of the hybrid).
// ---------------------------------------------------------------------------

export interface QuickAnswer {
  kind: 'answer';
  key: string;
  textEn: string;
  textAr: string;
  /** e.g. a route the answer should deep-link. */
  ctaRoute?: AppRoute;
  ctaLabelEn?: string;
  ctaLabelAr?: string;
}

/**
 * Curated, conservative answers for the handful of questions a destination
 * page actually gets, before it funnels someone into planning. Kept to real,
 * general Dahab guidance (not supplier claims) so the widget never fabricates.
 */
export function detectQuickQuestion(rawPrompt: string): QuickAnswer | null {
  const text = rawPrompt.trim();

  const rules: { key: string; test: RegExp; answerEn: string; answerAr: string; ctaRoute?: AppRoute; ctaLabelEn?: string; ctaLabelAr?: string }[] = [
    {
      key: 'best-time',
      test: /\b(best time|when should i (come|visit|go)|when to visit|what month)\b|(أحسن وقت|امتى أروح|متى أزور|متى أروح)/i,
      answerEn:
        'Dahab shines October to May: calm Red Sea conditions, 22–28°C water and golden light. July and August are hot and windier, which suits kitesurfers but not gentle dives. Whatever month you pick, mornings are the window for diving and the late afternoon belongs to the sea.',
      answerAr:
        'دهب أجمل ما يكون من أكتوبر لـ مايو: بحر هادي، مياه ٢٢–٢٨ درجة، وضوء ذهبي. يوليو وأغسطس حارين والرياح أقوى — مناسبين للكايت سيرف أكتر من الغطس الهادئ. في أي شهر، الصبح هو وقت الغطس والعصرية ملك البحر.'
    },
    {
      key: 'getting-there',
      test: /\b(how (do|can) i get|transfer|airport|fly|flight|sharm)\b/i,
      answerEn:
        'You fly into Sharm El-Sheikh (SSH) — about 90 minutes by road. Shared shuttles and private transfers run all day; the app books both in Transfers. Some travelers come overland from Cairo or Taba, but the airport route is the one most people take.',
      answerAr:
        'بتوصل مطار شرم الشيخ (SSH) — الرحلة بالعربية حوالي ٩٠ دقيقة. في نقل مشترك وخصوصي شغال طول اليوم، والتطبيق بيحجز الاثنين من صفحة النقل. بعض الناس بتيجي برّ من القاهرة أو طابا، لكن طريق المطار هو اللي أغلب الناس بتاخده.',
      ctaRoute: '/transfers',
      ctaLabelEn: 'See transfers',
      ctaLabelAr: 'شوف النقل'
    },
    {
      key: 'where-stay',
      test: /\b(where (should|do) i (stay|sleep)|hotel|accommodation|place to stay)\b/i,
      answerEn:
        'Stay on the Lighthouse stretch for first-timers — the reef, dive centres and restaurants are all at your door. Assalah is quieter and more local, and the Laguna suits wind sports and long beach days. Every option here shows its real nightly rate.',
      answerAr:
        'لأول مرة، الأقرب للايتهاوس — الشعاب ومراكز الغوص والمطاعم كلها على بابك. العسلة أهدى وأجواء بلدي أكتر، واللاجونة مناسبة لرياضات الرياح وأيام الشاطئ الطويلة. كل خيار هنا بعرض سعر الليلة الحقيقي.',
      ctaRoute: '/hotels',
      ctaLabelEn: 'Browse stays',
      ctaLabelAr: 'تصفح الإقامات'
    },
    {
      key: 'safety',
      test: /\b(safe|safety|is it safe|dangerous)\b/i,
      answerEn:
        'Dahab is one of Egypt’s most relaxed towns and is very safe for travelers. The sea deserves respect — dive with a certified centre, and remember the hyperbaric chamber is on standby here for the rare cases it is needed.',
      answerAr:
        'دهب من أهدى مدن مصر وآمنة جداً للمسافرين. البحر يستاهل الاحترام — اغطس مع مركز معتمد، وتذكر إن غرفة الضغط العالي شغالة هنا تحسباً لأي حالة نادرة.'
    },
    {
      key: 'dive-sites',
      test: /\b(best (dive|things|experiences)|must (see|do)|recommend.*(dive|do))\b/i,
      answerEn:
        'The Blue Hole and Canyon for famous wall and cavern diving, Eel Garden and the Lighthouse reef for easy shore snorkelling, and a jeep trip to the Coloured Canyon or St. Catherine for the desert side. Most people pair one dive day with one desert day and keep evenings free on the promenade.',
      answerAr:
        'البلو هول والكانيون للغوص الشهير، إيل جاردن وشعاب اللايتهاوس لسنوركل سهل من الشاطئ، ورحلة جيب للكانيون الملون أو سانت كاترين للجانب الصحراوي. أغلب الناس بيخلطوا يوم غطس بيوم صحراء ويسيبوا العشيات على الممشى.'
    },
    {
      key: 'sea-state',
      test: /\b(weather|wind|sea (state|conditions)|waves)\b|(طقس|رياح|حالة البحر)/i,
      answerEn:
        'Conditions change fast here, so we keep a live look at the sea, wind and dive windows on the homepage and in Dahab Live. As a rule: plan dives for the morning, expect an afternoon breeze, and let a certified centre decide if a site is open.',
      answerAr:
        'الحالة بتتغير بسرعة هنا، فبنحتفظ بنظرة حيّة للبحر والرياح ومواعيد الغطس في الرئيسية وفي دهب لايف. القاعدة: خطط للغطس صباحاً، وتوقع نسمة بعد الظهر، وخلي المركز المعتمد يقرر إذا كان الموقع مفتوح.'
    }
  ];

  const match = rules.find((r) => r.test.test(text));
  if (!match) return null;

  return {
    kind: 'answer',
    key: match.key,
    textEn: match.answerEn,
    textAr: match.answerAr,
    ctaRoute: match.ctaRoute,
    ctaLabelEn: match.ctaLabelEn,
    ctaLabelAr: match.ctaLabelAr
  };
}

// ---------------------------------------------------------------------------
// Example prompts shown as one-tap chips above the composer.
// ---------------------------------------------------------------------------

export const PLAN_PROMPT_EXAMPLES: { en: string; ar: string }[] = [
  {
    en: '4 days, first-timers — diving and a desert sunset',
    ar: '٤ أيام، أول مرة — غطس وغروب في الصحراء'
  },
  {
    en: 'Week with the kids, relaxed, Blue Hole + camel rides',
    ar: 'أسبوع مع العيال، رايقين، بلو هول وجمل'
  },
  {
    en: 'Couple escape, 5 days, romantic seafood dinners',
    ar: 'زوجين، ٥ أيام، عشيات سمك رومانسية'
  },
  {
    en: 'Active solo trip, 7 days, freediving and canyons',
    ar: 'لوحدي ونشيط، ٧ أيام، فريدايف وصحراء'
  }
];
