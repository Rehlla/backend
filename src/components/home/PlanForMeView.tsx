import React, { useEffect, useMemo, useRef, useState, memo } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { useTheme } from '../../context/ThemeContext';
import { analytics } from '../../services/analytics';
import {
  ArrowRight,
  ArrowLeft,
  Calendar,
  Users,
  Wallet,
  Compass,
  Gauge,
  Sparkles,
  Check,
  ShieldCheck,
  Waves,
  Sun,
  Home,
  Loader2,
  PenLine
} from 'lucide-react';

/**
 * "Plan It For Me" as a route rather than a dialog.
 *
 * It used to be PlanItForMeModal: five questions stacked inside a 576px box
 * that scrolled internally, over a dimmed page. That shape cost the flow the
 * things a planning step actually needs — it could not be linked or shared, the
 * browser Back button left the site instead of stepping back a question, a
 * refresh dropped the traveler on the homepage having lost every answer, and on
 * a phone the five questions plus the footer never fit, so the primary action
 * sat below a scroll the traveler had no reason to expect.
 *
 * It was also painted in fixed light-mode hex (#FFFFFF, #FDFBF7, #1A1A1A) while
 * the rest of the app runs on six themes, so in any dark theme it survived only
 * on the legacy overrides in index.css — which is why its body text washed out
 * to grey-on-grey. Everything here is drawn from the theme tokens instead, so
 * it is correct in all six themes without an override.
 */

type BudgetBand = 'Budget' | 'Moderate' | 'Premium';
type PaceBand = 'Relaxed' | 'Balanced' | 'Active';

interface StepDef {
  id: 'duration' | 'party' | 'budget' | 'interests' | 'pace';
  icon: React.ElementType;
  labelEn: string;
  labelAr: string;
  questionEn: string;
  questionAr: string;
  helpEn: string;
  helpAr: string;
}

const STEPS: StepDef[] = [
  {
    id: 'duration',
    icon: Calendar,
    labelEn: 'Length',
    labelAr: 'المدة',
    questionEn: 'How long are you in Dahab?',
    questionAr: 'هتقعد في دهب قد إيه؟',
    helpEn: 'This sets how many days we schedule, and how far out of town we can take you.',
    helpAr: 'ده بيحدد عدد الأيام اللي هنرتبها، وقد إيه نقدر نبعد بيك عن البلد.'
  },
  {
    id: 'party',
    icon: Users,
    labelEn: 'Who',
    labelAr: 'مع مين',
    questionEn: 'Who is travelling with you?',
    questionAr: 'مسافر مع مين؟',
    helpEn: 'Group size changes transport, table sizes, and which camps make sense.',
    helpAr: 'عدد الأفراد بيغيّر المواصلات، حجم الطاولات، والكامبات المناسبة.'
  },
  {
    id: 'budget',
    icon: Wallet,
    labelEn: 'Budget',
    labelAr: 'الميزانية',
    questionEn: 'What feels right to spend?',
    questionAr: 'الميزانية المريحة ليك إيه؟',
    helpEn: 'Every supplier in your plan is verified — this picks the tier, not the quality.',
    helpAr: 'كل المزودين في خطتك موثقين — الاختيار ده بيحدد الفئة، مش الجودة.'
  },
  {
    id: 'interests',
    icon: Compass,
    labelEn: 'Experiences',
    labelAr: 'التجارب',
    questionEn: 'What do you actually want to do?',
    questionAr: 'أهم التجارب اللي حابب تعيشها؟',
    helpEn: 'Pick as many as you like. We weight the schedule towards them.',
    helpAr: 'اختار اللي يعجبك — إحنا هنميل بالجدول ناحيتهم.'
  },
  {
    id: 'pace',
    icon: Gauge,
    labelEn: 'Pace',
    labelAr: 'الإيقاع',
    questionEn: 'How full should each day be?',
    questionAr: 'اليوم يبقى مليان قد إيه؟',
    helpEn: 'Dahab rewards slowness. Be honest about how early you will really get up.',
    helpAr: 'دهب بتحب الهدوء. كن صادق مع نفسك: هتصحى بدري فعلاً؟'
  }
];

const DURATIONS = [3, 4, 5, 7];

const PARTIES: { count: number; labelEn: string; labelAr: string; hintEn: string; hintAr: string }[] = [
  { count: 1, labelEn: 'Solo', labelAr: 'لوحدي', hintEn: 'Social camps & shared dives', hintAr: 'كامبات اجتماعية وغطس جماعي' },
  { count: 2, labelEn: 'Couple', labelAr: 'زوجين', hintEn: 'Quiet corners & sunset tables', hintAr: 'أماكن هادية وطاولات غروب' },
  { count: 3, labelEn: 'Friends', labelAr: 'أصحاب', hintEn: 'Safari jeeps & long nights', hintAr: 'سفاري وسهرات طويلة' },
  { count: 4, labelEn: 'Family', labelAr: 'عيلة', hintEn: 'Shallow reefs & short drives', hintAr: 'شعاب ضحلة ومشاوير قصيرة' }
];

const BUDGETS: { id: BudgetBand; labelEn: string; labelAr: string; hintEn: string; hintAr: string }[] = [
  {
    id: 'Budget',
    labelEn: 'Easy',
    labelAr: 'اقتصادي',
    hintEn: 'Beach camps, local kitchens, shared transport',
    hintAr: 'كامبات على البحر، مطاعم بلدي، مواصلات مشتركة'
  },
  {
    id: 'Moderate',
    labelEn: 'Balanced',
    labelAr: 'متوسط',
    hintEn: 'Boutique stays, known dive centres, private pickups',
    hintAr: 'إقامة مميزة، مراكز غوص معروفة، توصيل خاص'
  },
  {
    id: 'Premium',
    labelEn: 'Premium',
    labelAr: 'فاخر',
    hintEn: 'Seafront resorts, private guides, chartered 4x4',
    hintAr: 'منتجعات على البحر، مرشدين خاصين، سيارات مخصصة'
  }
];

const INTERESTS: { id: string; labelEn: string; labelAr: string; icon: React.ElementType }[] = [
  { id: 'Diving', labelEn: 'Diving & reefs', labelAr: 'غطس وشعاب مرجانية', icon: Waves },
  { id: 'Adventure', labelEn: 'Desert & canyons', labelAr: 'صحراء وكانيونات', icon: Compass },
  { id: 'Beach', labelEn: 'Beach & Blue Lagoon', labelAr: 'شواطئ وبلو لاجون', icon: Sun },
  { id: 'Food', labelEn: 'Seafood & cafés', labelAr: 'مطاعم وكافيهات', icon: Sparkles },
  { id: 'Local Life', labelEn: 'Bedouin culture', labelAr: 'قعدات وثقافة بدوية', icon: Home },
  { id: 'Wellness', labelEn: 'Yoga & recovery', labelAr: 'يوجا واسترخاء', icon: ShieldCheck }
];

const PACES: { id: PaceBand; labelEn: string; labelAr: string; hintEn: string; hintAr: string }[] = [
  { id: 'Relaxed', labelEn: 'Slow', labelAr: 'رايق', hintEn: 'One anchor a day, the rest is yours', hintAr: 'نشاط واحد في اليوم والباقي على راحتك' },
  { id: 'Balanced', labelEn: 'Balanced', labelAr: 'متوازن', hintEn: 'Two anchors, a real break in between', hintAr: 'نشاطين وبينهم راحة حقيقية' },
  { id: 'Active', labelEn: 'Full', labelAr: 'نشيط', hintEn: 'Early starts, three anchors, long days', hintAr: 'صحيان بدري، ٣ أنشطة، أيام طويلة' }
];

/** Steps 0–2 are single-choice, so answering one is also the intent to move on. */
const AUTO_ADVANCE_STEPS = new Set([0, 1, 2]);

const SelectedDot: React.FC<{ on: boolean }> = memo(({ on }) => (
  <span
    aria-hidden="true"
    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
      on
        ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
        : 'border-[var(--text-secondary)]/40 group-hover:border-[var(--accent-primary)]/60'
    }`}
  >
    {on && <Check className="w-3 h-3 text-[var(--accent-primary-ink)]" strokeWidth={3.5} />}
  </span>
));
SelectedDot.displayName = 'SelectedDot';

export const PlanForMeView: React.FC = () => {
  const { language, t, isRTL } = useLanguage();
  const { reducedMotion } = useTheme();
  const { profile, updateProfile, navigateTo } = useTrip();

  const [stepIndex, setStepIndex] = useState<number>(0);
  const [furthestStep, setFurthestStep] = useState<number>(0);
  const [days, setDays] = useState<number>(profile.lengthDays || 5);
  const [travelers, setTravelers] = useState<number>(profile.travelersCount || 2);
  const [budget, setBudget] = useState<BudgetBand>(profile.budget || 'Moderate');
  const [pace, setPace] = useState<PaceBand>(profile.pace || 'Balanced');
  const [interests, setInterests] = useState<string[]>(
    profile.interests?.length ? profile.interests : ['Diving', 'Adventure']
  );

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [synthesisStep, setSynthesisStep] = useState<number>(0);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const lastFocusedStep = useRef<number | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const synthesisTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const progressPercent = ((stepIndex + 1) / STEPS.length) * 100;

  useEffect(() => {
    analytics.track('plan_it_for_me_selected');
  }, []);

  // Every pending timer is owned here. As a modal this flow could not be left
  // mid-answer; as a route it can, and a stray auto-advance or a setState after
  // unmount is the first thing that becomes reachable.
  useEffect(() => {
    return () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      synthesisTimers.current.forEach(clearTimeout);
    };
  }, []);

  /**
   * Moves focus to the new question.
   *
   * Without this, a keyboard or screen-reader user answers question 2 and is
   * left focused on a button that no longer exists, with nothing announced.
   */
  useEffect(() => {
    if (isGenerating) return;

    // Not on arrival: the global :focus-visible rule paints a 3px outline, and
    // on first paint that reads as a rendering fault rather than a focus ring.
    // From the second question on it is exactly the cue a keyboard user needs.
    //
    // Tracked as "which step was last focused" rather than a first-render flag,
    // because StrictMode runs this effect twice on mount and a boolean flag is
    // already spent by the second run — which is what put a focus ring on the
    // first question.
    if (lastFocusedStep.current === stepIndex) return;
    const isMount = lastFocusedStep.current === null;
    lastFocusedStep.current = stepIndex;
    if (isMount) return;

    headingRef.current?.focus();
  }, [stepIndex, isGenerating]);

  const goToStep = (next: number) => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
    setStepIndex(clamped);
    setFurthestStep((prev) => Math.max(prev, clamped));
  };

  const answerAndAdvance = (apply: () => void) => {
    apply();
    if (!AUTO_ADVANCE_STEPS.has(stepIndex)) return;
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    // Long enough to see the choice register, short enough to keep the
    // "60 seconds" promise honest. Immediate when motion is reduced.
    advanceTimer.current = setTimeout(() => goToStep(stepIndex + 1), reducedMotion ? 0 : 260);
  };

  const toggleInterest = (id: string) => {
    setInterests((prev) => {
      if (prev.includes(id)) {
        // One has to survive, or there is nothing left to weight the plan by.
        return prev.length > 1 ? prev.filter((i) => i !== id) : prev;
      }
      return [...prev, id];
    });
  };

  const handleGenerate = () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setSynthesisStep(0);

    analytics.track('plan_it_for_me_selected', {
      durationDays: days,
      travelersCount: travelers,
      budget,
      pace,
      interests
    });

    const beat = reducedMotion ? 120 : 600;
    synthesisTimers.current = [
      setTimeout(() => setSynthesisStep(1), beat),
      setTimeout(() => setSynthesisStep(2), beat * 2),
      setTimeout(() => {
        updateProfile({
          lengthDays: days,
          travelersCount: travelers,
          budget,
          pace,
          interests
        });

        analytics.track('ai_plan_generated', {
          durationDays: days,
          travelersCount: travelers,
          budget
        });
        analytics.track('trip_created', { metadata: { source: 'ai_director' } });

        navigateTo('/trip-preview');
      }, beat * 3)
    ];
  };

  const partyLabel = useMemo(() => {
    const match = PARTIES.find((p) => p.count === travelers);
    if (!match) return String(travelers);
    return language === 'ar' ? match.labelAr : match.labelEn;
  }, [travelers, language]);

  const budgetLabel = useMemo(() => {
    const match = BUDGETS.find((b) => b.id === budget);
    return (language === 'ar' ? match?.labelAr : match?.labelEn) || budget;
  }, [budget, language]);

  const paceLabel = useMemo(() => {
    const match = PACES.find((p) => p.id === pace);
    return (language === 'ar' ? match?.labelAr : match?.labelEn) || pace;
  }, [pace, language]);

  const optionBase =
    'group relative text-start rounded-2xl border p-4 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]';
  const optionIdle =
    'bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50';
  const optionActive =
    'bg-[var(--accent-primary)]/12 border-[var(--accent-primary)] shadow-lg ring-1 ring-[var(--accent-primary)]/30';

  /* ------------------------------------------------------------------ */
  /* Synthesis                                                          */
  /* ------------------------------------------------------------------ */
  if (isGenerating) {
    const lines = [
      { en: 'Reading live sea, wind and dive windows…', ar: 'بنقرا حالة البحر والرياح ومواعيد الغطس…' },
      { en: 'Matching verified stays, guides and Bedouin hosts…', ar: 'بنطابق أماكن الإقامة والمرشدين المعتمدين…' },
      { en: 'Laying out your day-by-day Dahab schedule…', ar: 'بنرتب جدولك اليومي في دهب…' }
    ];

    return (
      <div
        id="plan-for-me-synthesis"
        dir={isRTL ? 'rtl' : 'ltr'}
        className="min-h-[70vh] flex items-center justify-center px-4 py-16 bg-[var(--bg-canvas)] text-[var(--text-primary)]"
      >
        <div
          role="status"
          aria-live="polite"
          className="w-full max-w-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-3xl p-8 sm:p-10 text-center shadow-2xl space-y-6"
        >
          <div className="w-16 h-16 mx-auto rounded-3xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-primary)]">
            <Waves className={`w-8 h-8 ${reducedMotion ? '' : 'animate-pulse'}`} aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl chart-heading font-bold leading-snug">
              {language === 'ar' ? lines[synthesisStep].ar : lines[synthesisStep].en}
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              {t('home.days', { days, partyLabel, budgetLabel, paceLabel })}
            </p>
          </div>

          <div className="h-1.5 rounded-full bg-[var(--surface-container)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-500"
              style={{ width: `${((synthesisStep + 1) / lines.length) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
            <Loader2
              className={`w-4 h-4 text-[var(--accent-primary)] ${reducedMotion ? '' : 'animate-spin'}`}
              aria-hidden="true"
            />
            <span>{t('home.yourItineraryIsSeconds')}</span>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Questions                                                          */
  /* ------------------------------------------------------------------ */
  const StepIcon = step.icon;

  return (
    <div
      id="plan-for-me-page"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-28 md:pb-16"
    >
      {/* ================================================================= */}
      {/* 1. HERO                                                           */}
      {/* ================================================================= */}
      <header className="relative overflow-hidden border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div
          aria-hidden="true"
          className="absolute -top-40 -end-32 w-[28rem] h-[28rem] rounded-full bg-[var(--accent-primary)]/10 blur-3xl pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-40 -start-32 w-[28rem] h-[28rem] rounded-full bg-[var(--accent-secondary)]/10 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-9">
          <nav aria-label="Breadcrumb" className="mb-5">
            <button
              type="button"
              onClick={() => navigateTo('/home')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer rounded-lg py-2 -my-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
              <span>{t('home.backToHome')}</span>
            </button>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                <Sparkles className="w-3.5 h-3.5 inline-block me-1.5 -mt-0.5" aria-hidden="true" />
                <span>{t('home.dahabTravelDirector')}</span>
              </p>

              <h1 className="font-display text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-balance">
                {t('tripEntry.modeC.title')}
              </h1>

              <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                {t('home.fiveQuickQuestionsAnd')}
              </p>
            </div>

            <ul className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-2 lg:min-w-[16rem] shrink-0">
              {[
                { icon: Sparkles, en: 'A full plan in about a minute', ar: 'جدول كامل في حوالي دقيقة' },
                { icon: ShieldCheck, en: 'Verified suppliers only', ar: 'مزودين موثقين بس' },
                { icon: PenLine, en: 'Editable afterwards, always', ar: 'تقدر تعدّل كل حاجة بعدين' }
              ].map((chip) => {
                const ChipIcon = chip.icon;
                return (
                  <li
                    key={chip.en}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]"
                  >
                    <ChipIcon className="w-4 h-4 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />
                    <span>{language === 'ar' ? chip.ar : chip.en}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. PROGRESS RAIL                                                  */}
      {/* ================================================================= */}
      <div className="sticky top-16 sm:top-20 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-canvas)]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 space-y-2.5">
          <ol
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar"
            aria-label={t('home.planningSteps')}
          >
            {STEPS.map((s, idx) => {
              const isCurrent = idx === stepIndex;
              const isVisited = idx <= furthestStep;
              const RailIcon = s.icon;
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => isVisited && goToStep(idx)}
                    disabled={!isVisited}
                    aria-current={isCurrent ? 'step' : undefined}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                      isCurrent
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-md'
                        : isVisited
                        ? 'bg-[var(--surface-container)] text-[var(--text-primary)] hover:bg-[var(--surface-card)] cursor-pointer'
                        : 'bg-transparent text-[var(--text-secondary)]/50 cursor-not-allowed'
                    }`}
                  >
                    <RailIcon className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{language === 'ar' ? s.labelAr : s.labelEn}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          <div
            className="h-1 rounded-full bg-[var(--surface-container)] overflow-hidden"
            role="progressbar"
            aria-valuenow={stepIndex + 1}
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-label={t('home.planningProgress')}
          >
            <div
              className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. QUESTION + RUNNING BRIEF                                       */}
      {/* ================================================================= */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        <section className="lg:col-span-8 bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-3xl p-5 sm:p-8 shadow-xl">
          <div className="flex items-start gap-3.5 mb-6">
            <span className="w-11 h-11 rounded-2xl bg-[var(--accent-primary)]/12 border border-[var(--accent-primary)]/25 text-[var(--accent-primary)] flex items-center justify-center shrink-0">
              <StepIcon className="w-5 h-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-[var(--text-secondary)]">
                {t('home.questionOf', { idx: stepIndex + 1, length: STEPS.length })}
              </p>
              <h2
                ref={headingRef}
                tabIndex={-1}
                className="text-xl sm:text-2xl chart-heading font-bold leading-snug mt-0.5 focus:outline-none"
              >
                {language === 'ar' ? step.questionAr : step.questionEn}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                {language === 'ar' ? step.helpAr : step.helpEn}
              </p>
            </div>
          </div>

          {step.id === 'duration' && (
            <div
              role="radiogroup"
              aria-label={language === 'ar' ? step.questionAr : step.questionEn}
              className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            >
              {DURATIONS.map((num) => {
                const on = days === num;
                return (
                  <button
                    key={num}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => answerAndAdvance(() => setDays(num))}
                    className={`${optionBase} ${on ? optionActive : optionIdle} flex flex-col items-center justify-center gap-1 py-6`}
                  >
                    <span className="text-3xl font-bold font-mono tabular-nums">{num}</span>
                    <span className="text-xs font-bold text-[var(--text-secondary)]">
                      {num === 1 ? t('home.daySingle') : t('home.dayPlural')}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step.id === 'party' && (
            <div
              role="radiogroup"
              aria-label={language === 'ar' ? step.questionAr : step.questionEn}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {PARTIES.map((item) => {
                const on = travelers === item.count;
                return (
                  <button
                    key={item.count}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => answerAndAdvance(() => setTravelers(item.count))}
                    className={`${optionBase} ${on ? optionActive : optionIdle} flex items-start gap-3`}
                  >
                    <SelectedDot on={on} />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">
                        {language === 'ar' ? item.labelAr : item.labelEn}
                      </span>
                      <span className="block text-xs text-[var(--text-secondary)] mt-0.5">
                        {language === 'ar' ? item.hintAr : item.hintEn}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step.id === 'budget' && (
            <div
              role="radiogroup"
              aria-label={language === 'ar' ? step.questionAr : step.questionEn}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {BUDGETS.map((item) => {
                const on = budget === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => answerAndAdvance(() => setBudget(item.id))}
                    className={`${optionBase} ${on ? optionActive : optionIdle} flex flex-col gap-2`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">
                        {language === 'ar' ? item.labelAr : item.labelEn}
                      </span>
                      <SelectedDot on={on} />
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {language === 'ar' ? item.hintAr : item.hintEn}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {step.id === 'interests' && (
            <div
              role="group"
              aria-label={language === 'ar' ? step.questionAr : step.questionEn}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3"
            >
              {INTERESTS.map((item) => {
                const on = interests.includes(item.id);
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleInterest(item.id)}
                    className={`${optionBase} ${on ? optionActive : optionIdle} flex items-center gap-3`}
                  >
                    <span
                      aria-hidden="true"
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        on
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)]'
                          : 'bg-[var(--surface-card)] text-[var(--accent-primary)]'
                      }`}
                    >
                      <ItemIcon className="w-4 h-4" />
                    </span>
                    <span className="text-sm font-bold min-w-0 flex-1">
                      {language === 'ar' ? item.labelAr : item.labelEn}
                    </span>
                    {on && <Check className="w-4 h-4 text-[var(--accent-primary)] shrink-0" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}

          {step.id === 'pace' && (
            <div
              role="radiogroup"
              aria-label={language === 'ar' ? step.questionAr : step.questionEn}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {PACES.map((item) => {
                const on = pace === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPace(item.id)}
                    className={`${optionBase} ${on ? optionActive : optionIdle} flex flex-col gap-2`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold">
                        {language === 'ar' ? item.labelAr : item.labelEn}
                      </span>
                      <SelectedDot on={on} />
                    </span>
                    <span className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {language === 'ar' ? item.hintAr : item.hintEn}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Step controls */}
          <div className="mt-7 pt-5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => (stepIndex === 0 ? navigateTo('/home') : goToStep(stepIndex - 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden="true" />
              <span>
                {stepIndex === 0
                  ? t('explore.cancel')
                  : t('home.back')}
              </span>
            </button>

            <button
              type="button"
              id={isLastStep ? 'generate-plan-btn' : 'plan-next-step-btn'}
              onClick={() => (isLastStep ? handleGenerate() : goToStep(stepIndex + 1))}
              className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 rounded-2xl bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)] text-xs font-extrabold shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-card)]"
            >
              {isLastStep && <Sparkles className="w-4 h-4" aria-hidden="true" />}
              <span>{isLastStep ? t('tripEntry.modeC.cta') : t('home.next')}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            </button>
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* Running brief                                                  */}
        {/* ------------------------------------------------------------- */}
        <aside className="lg:col-span-4 lg:sticky lg:top-44 space-y-4">
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-3xl p-5 shadow-lg">
            <h2 className="text-xs font-extrabold text-[var(--text-secondary)] mb-4">
              {t('home.yourBriefSoFar')}
            </h2>

            <dl className="space-y-3">
              {[
                {
                  stepIdx: 0,
                  labelEn: 'Length',
                  labelAr: 'المدة',
                  value: t('home.days-2', { days }),
                  icon: Calendar
                },
                { stepIdx: 1, labelEn: 'Party', labelAr: 'المسافرين', value: partyLabel, icon: Users },
                { stepIdx: 2, labelEn: 'Budget', labelAr: 'الميزانية', value: budgetLabel, icon: Wallet },
                { stepIdx: 4, labelEn: 'Pace', labelAr: 'الإيقاع', value: paceLabel, icon: Gauge }
              ].map((row) => {
                const RowIcon = row.icon;
                // Dimmed until the traveler has actually reached that question:
                // the seeded default is a suggestion, not their answer.
                const answered = furthestStep >= row.stepIdx;
                return (
                  <div key={row.labelEn} className="flex items-center justify-between gap-3">
                    <dt className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                      <RowIcon className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                      <span>{language === 'ar' ? row.labelAr : row.labelEn}</span>
                    </dt>
                    <dd
                      className={`text-sm font-bold ${
                        answered ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]/50'
                      }`}
                    >
                      {row.value}
                    </dd>
                  </div>
                );
              })}
            </dl>

            <div className="mt-4 pt-4 border-t border-[var(--border-subtle)]">
              <span className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] mb-2">
                <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{t('home.experiences')}</span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {interests.map((id) => {
                  const item = INTERESTS.find((i) => i.id === id);
                  if (!item) return null;
                  return (
                    <span
                      key={id}
                      className="px-2.5 py-1 rounded-full bg-[var(--accent-primary)]/12 border border-[var(--accent-primary)]/25 text-[var(--accent-primary)] text-xs font-bold"
                    >
                      {language === 'ar' ? item.labelAr : item.labelEn}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="bg-[var(--surface-container)] border border-[var(--border-subtle)] rounded-2xl p-4 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)] shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {t('home.nothingIsChargedHere')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};
