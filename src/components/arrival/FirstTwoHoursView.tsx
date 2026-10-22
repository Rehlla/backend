import React, { useCallback, useMemo, useState } from 'react';
import { 
  Clock, 
  Sparkles, 
  MapPin, 
  Building, 
  Luggage, 
  Coffee, 
  Waves, 
  Footprints, 
  Check, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  ShieldCheck, 
  Compass, 
  HelpCircle, 
  Calendar,
  AlertCircle,
  Navigation,
  Info,
  RotateCcw,
  SlidersHorizontal,
  X,
  ChevronRight,
  ChevronLeft,
  Sun,
  Flame,
  CupSoda,
  ThumbsUp
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { CategoryIcon, type CategoryKind } from '../common/CategoryIcon';
import { useTrip } from '../../context/TripContext';
import { useArrivalClock } from '../../hooks/useArrivalClock';
import { addMinutes, formatClock, formatDuration, minutesBetween } from '../../utils/arrivalTime';
import { LuggageStorageModal } from './LuggageStorageModal';
import { ActivityOptionModal } from './ActivityOptionModal';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { mapFitWindowOptions } from '../../services/spontaneousMapper';
import type { SpontaneousOption } from '../../shared/types/spontaneous';

interface FirstTwoHoursViewProps {
  onBackToMyTrip: () => void;
  onBackToEarlyArrival: () => void;
  onExploreClick?: () => void;
  onOpenHelp?: () => void;
}

interface TimelineStep {
  id: string;
  /** Minutes after the traveler's arrival that this step begins. */
  offsetMinutes: number;
  time: string;
  title: string;
  desc: string;
  duration: string;
  category: string;
  icon: CategoryKind;
  ctaText: string;
  ctaAction: 'luggage' | 'breakfast' | 'walk' | 'beach' | 'hotel';
  isCompleted: boolean;
}

export const FirstTwoHoursView: React.FC<FirstTwoHoursViewProps> = ({
  onBackToMyTrip,
  onBackToEarlyArrival,
  onExploreClick,
  onOpenHelp,
}) => {
  const { language, isRTL, t } = useLanguage();

  // These times used to start at a hardcoded 10:00 AM. They now run from the
  // moment this traveler actually reached the arrival flow.
  const clock = useArrivalClock();
  const lang = language === 'ar' ? 'ar' : 'en';
  const { navigateTo } = useTrip();

  /**
   * Live fit-window options for the "extra time" card, sized to the minutes
   * actually left before check-in. The three fixed suggestions below stay as
   * the fallback while this loads and on a failed request.
   */
  const fetchFitWindowOptions = useCallback(
    (signal: AbortSignal) =>
      api.getFitWindowOptions({ originArea: 'lighthouse', availableMinutes: clock.minutesUntilCheckIn }, signal),
    [clock.minutesUntilCheckIn]
  );
  const fitWindow = useApiResource(fetchFitWindowOptions);
  const liveEarlyOptions = useMemo(
    () => (fitWindow.data ? mapFitWindowOptions(fitWindow.data.options, clock.minutesUntilCheckIn) : []),
    [fitWindow.data, clock.minutesUntilCheckIn]
  );

  /**
   * The "Head toward your hotel" step used a hardcoded '30–40 min'. The real
   * travel estimate is fetched from /api/context/travel-time; the curated copy
   * shows until (or unless) it lands.
   */
  const fetchTravelEstimate = useCallback(
    (signal: AbortSignal) => api.getTravelEstimate('Dahab Lighthouse', 'hotel', signal),
    []
  );
  const travelEstimate = useApiResource(fetchTravelEstimate);
  const hotelTravelLabel = travelEstimate.data
    ? lang === 'ar'
      ? travelEstimate.data.displayEstimateAr
      : travelEstimate.data.displayEstimateEn
    : null;

  // Plan variants: 'standard' (with breakfast) vs 'coffee-beach' (skip breakfast)
  const [planVariant, setPlanVariant] = useState<'standard' | 'coffee-beach'>('standard');

  /**
   * Was a `useState` driven by three buttons in the header labelled
   * "10:00 AM (2h 20m) / Early (+35m) / Late (25m left)", with toasts that said
   * "Simulated Early Finish" — an internal QA control shipped to travelers,
   * which existed only because the clock on this page was frozen. Both signals
   * behind it are real, so it is derived now.
   */
  const RUNNING_LATE_THRESHOLD_MINUTES = 30;

  // Modal states
  const [isLuggageModalOpen, setIsLuggageModalOpen] = useState<boolean>(false);
  const [activityModalType, setActivityModalType] = useState<'breakfast' | 'beach' | 'walk' | null>(null);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState<boolean>(false);

  // Completed steps tracker
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Base Timeline Items based on variant
  const standardSteps: TimelineStep[] = [
    {
      id: 'step-1-luggage',
      offsetMinutes: 0,
      time: formatClock(addMinutes(clock.arrivedAt, 0), lang),
      title: t('arrival.leaveYourBags'),
      desc: t('arrival.dropYourLuggageAt'),
      duration: t('arrival.15Min'),
      category: t('arrival.recommended'),
      icon: 'luggage',
      ctaText: t('arrival.viewOption'),
      ctaAction: 'luggage',
      isCompleted: completedStepIds.includes('step-1-luggage'),
    },
    {
      id: 'step-2-breakfast',
      offsetMinutes: 20,
      time: formatClock(addMinutes(clock.arrivedAt, 20), lang),
      title: t('arrival.breakfast'),
      desc: t('arrival.grabARelaxedBreakfast'),
      duration: t('arrival.40Min'),
      category: t('arrival.food'),
      icon: 'coffee',
      ctaText: t('arrival.seeRecommendation'),
      ctaAction: 'breakfast',
      isCompleted: completedStepIds.includes('step-2-breakfast'),
    },
    {
      id: 'step-3-walk',
      offsetMinutes: 60,
      time: formatClock(addMinutes(clock.arrivedAt, 60), lang),
      title: t('arrival.coffeeWalk-2'),
      desc: t('arrival.takeAShortWalk'),
      duration: t('arrival.45Min'),
      category: t('arrival.explore'),
      icon: 'walk',
      ctaText: t('arrival.explore-2'),
      ctaAction: 'walk',
      isCompleted: completedStepIds.includes('step-3-walk'),
    },
    {
      id: 'step-4-beach',
      offsetMinutes: 105,
      time: formatClock(addMinutes(clock.arrivedAt, 105), lang),
      title: t('arrival.beachTime'),
      desc: t('arrival.relaxByTheSea'),
      duration: t('arrival.30Min'),
      category: t('arrival.relax'),
      icon: 'reef',
      ctaText: t('arrival.viewSpot'),
      ctaAction: 'beach',
      isCompleted: completedStepIds.includes('step-4-beach'),
    },
    {
      id: 'step-5-hotel',
      offsetMinutes: 135,
      time: formatClock(addMinutes(clock.arrivedAt, 135), lang),
      title: t('arrival.headTowardYourHotel'),
      desc: t('arrival.leaveEnoughTimeTo'),
      duration: hotelTravelLabel || (t('arrival.3040Min')),
      category: t('arrival.recommended'),
      icon: 'stay',
      ctaText: t('arrival.hotelDetails'),
      ctaAction: 'hotel',
      isCompleted: completedStepIds.includes('step-5-hotel'),
    },
  ];

  const coffeeBeachSteps: TimelineStep[] = [
    {
      id: 'step-1-luggage',
      offsetMinutes: 0,
      time: formatClock(addMinutes(clock.arrivedAt, 0), lang),
      title: t('arrival.leaveYourBags'),
      desc: t('arrival.dropYourLuggageAt'),
      duration: t('arrival.15Min'),
      category: t('arrival.recommended'),
      icon: 'luggage',
      ctaText: t('arrival.viewOption'),
      ctaAction: 'luggage',
      isCompleted: completedStepIds.includes('step-1-luggage'),
    },
    {
      id: 'step-2-coffee',
      offsetMinutes: 20,
      time: formatClock(addMinutes(clock.arrivedAt, 20), lang),
      title: t('arrival.artisanalCoffeeFreshJuice'),
      desc: t('arrival.sipFreshBedouinSpiced'),
      duration: t('arrival.25Min'),
      category: t('arrival.food-2'),
      icon: 'coffee',
      ctaText: t('arrival.seeSpot'),
      ctaAction: 'breakfast',
      isCompleted: completedStepIds.includes('step-2-coffee'),
    },
    {
      id: 'step-3-beach-long',
      offsetMinutes: 50,
      time: formatClock(addMinutes(clock.arrivedAt, 50), lang),
      title: t('arrival.extendedBeachRelaxationSwim'),
      desc: t('arrival.unwindOnCushionedSunbeds'),
      duration: t('arrival.55Min'),
      category: t('arrival.relax'),
      icon: 'reef',
      ctaText: t('arrival.viewSpot-2'),
      ctaAction: 'beach',
      isCompleted: completedStepIds.includes('step-3-beach-long'),
    },
    {
      id: 'step-4-walk-coastal',
      offsetMinutes: 105,
      time: formatClock(addMinutes(clock.arrivedAt, 105), lang),
      title: t('arrival.scenicLighthousePromenadeWalk'),
      desc: t('arrival.browseLocalArtisanHandicraft'),
      duration: t('arrival.30Min'),
      category: t('arrival.explore'),
      icon: 'walk',
      ctaText: t('arrival.explore-2'),
      ctaAction: 'walk',
      isCompleted: completedStepIds.includes('step-4-walk-coastal'),
    },
    {
      id: 'step-5-hotel',
      offsetMinutes: 135,
      time: formatClock(addMinutes(clock.arrivedAt, 135), lang),
      title: t('arrival.headTowardYourHotel'),
      desc: t('arrival.leaveEnoughTimeTo'),
      duration: hotelTravelLabel || (t('arrival.3040Min')),
      category: t('arrival.recommended'),
      icon: 'stay',
      ctaText: t('arrival.hotelDetails'),
      ctaAction: 'hotel',
      isCompleted: completedStepIds.includes('step-5-hotel'),
    },
  ];

  const steps = planVariant === 'standard' ? standardSteps : coffeeBeachSteps;

  const totalSteps = steps.length;
  const completedCount = steps.filter(s => s.isCompleted).length;
  const currentStepNumber = Math.min(completedCount + 1, totalSteps);

  /**
   * The three states the removed simulator used to let a visitor pick. Both
   * signals behind them are real:
   *  - running late: little time left before check-in and the plan unfinished.
   *  - ahead of plan: the next step is not due for a while yet, so there is
   *    genuine surplus to offer something extra.
   */
  const AHEAD_OF_PLAN_THRESHOLD_MINUTES = 20;
  const minutesSinceArrival = minutesBetween(clock.arrivedAt, clock.now);
  const nextStep = steps.find(step => !step.isCompleted);
  const minutesAheadOfPlan = nextStep ? nextStep.offsetMinutes - minutesSinceArrival : 0;

  // The plan's own window: it ends 30 minutes after the last step begins, which
  // is where the fixed "10:00 AM -> 12:45 PM" label came from.
  const planEndsAt = addMinutes(clock.arrivedAt, (steps[steps.length - 1]?.offsetMinutes ?? 0) + 30);

  const timeMode: 'normal' | 'early_done' | 'running_late' =
    !clock.checkInReached && clock.minutesUntilCheckIn <= RUNNING_LATE_THRESHOLD_MINUTES
      ? 'running_late'
      : minutesAheadOfPlan >= AHEAD_OF_PLAN_THRESHOLD_MINUTES
        ? 'early_done'
        : 'normal';
  const isAllPlanCompleted = completedCount === totalSteps;

  const handleToggleStepCompletion = (stepId: string) => {
    if (completedStepIds.includes(stepId)) {
      setCompletedStepIds(prev => prev.filter(id => id !== stepId));
      showToast(t('arrival.stepUnmarked'));
    } else {
      setCompletedStepIds(prev => [...prev, stepId]);
      showToast(t('arrival.activityMarkedAsDone'));
    }
  };

  const handleStepCTA = (action: 'luggage' | 'breakfast' | 'walk' | 'beach' | 'hotel') => {
    if (action === 'luggage') setIsLuggageModalOpen(true);
    else if (action === 'breakfast') setActivityModalType('breakfast');
    else if (action === 'walk') setActivityModalType('walk');
    else if (action === 'beach') setActivityModalType('beach');
    else if (action === 'hotel') onBackToMyTrip();
  };

  /**
   * A live fit-window option routes wherever the backend sent it; the fixed
   * suggestion modal only serves the fallback choices, which have no route.
   */
  const handleLiveOptionAction = (option: SpontaneousOption) => {
    if (option.actionRoute === '/explore') {
      onExploreClick?.();
      return;
    }
    if (option.actionRoute === '/book-now') {
      navigateTo('/book-now');
      return;
    }
    setActivityModalType('breakfast');
  };

  return (
    <div className={`min-h-screen bg-[var(--surface-card)] text-[var(--text-primary)] flex flex-col pb-28 md:pb-16 selection:bg-[var(--accent-secondary)]/30 ${isRTL ? 'rtl' : 'ltr'}`}>
      
      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow">
        
        {/* Top Breadcrumb & Live Simulation Tools */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="back-to-early-arrival-btn"
              onClick={onBackToEarlyArrival}
              className="inline-flex items-center gap-1.5 py-3.5 -my-2 text-xs font-semibold text-[var(--text-secondary)]/70 hover:text-[var(--accent-secondary)] transition-colors cursor-pointer"
            >
              {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{t('arrival.backToEarlyArrival')}</span>
            </button>
            <span className="text-[var(--text-muted)]">•</span>
            <button
              type="button"
              id="back-to-my-trip-root-btn"
              onClick={onBackToMyTrip}
              className="text-xs font-medium text-[var(--text-secondary)]/60 hover:text-[var(--accent-secondary)] transition-colors cursor-pointer py-2 -my-2"
            >
              {t('arrival.myTrip')}
            </button>
          </div>

          {/* Persistent Hotel Reminder Badge & Quick Switcher */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)] shadow-2xs">
              <Building className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>{`${t('arrival.hotelCheckin')} · ${formatClock(clock.checkInAt, lang)}`}</span>
            </div>

          </div>
        </div>

        {/* 2. MAIN HEADER */}
        <div className="space-y-4 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30 text-xs font-bold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('arrival.personalizedMiniItineraryEarly')}</span>
            </div>

            {/* Time Visual Pill */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--surface-container)] text-[var(--text-primary)] text-xs font-bold border border-[var(--border-subtle)] shadow-xs">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>{formatClock(clock.now, lang)}</span>
              <span className="text-[var(--text-muted)]">•</span>
              <span className="text-[var(--accent-secondary)] font-extrabold">
                {clock.checkInReached
                  ? (t('arrival.checkinIsOpen'))
                  : `${formatDuration(clock.minutesUntilCheckIn, lang)} ${t('arrival.available')}`}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
              {t('arrival.yourFirst2Hours-2')}
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-secondary)]/80 max-w-2xl font-medium">
              {t('arrival.wePlannedARelaxed')}
            </p>
          </div>

          {/* Compact Context Bar */}
          <div className="p-3.5 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-2xs grid grid-cols-3 gap-2 text-xs max-w-2xl">
            <div className="border-r rtl:border-r-0 rtl:border-l border-[var(--border-subtle)] pr-2 rtl:pr-0 rtl:pl-2">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">{t('arrival.hotelCheckin-2')}</span>
              <span className="font-bold text-[var(--text-primary)]">{formatClock(clock.checkInAt, lang)}</span>
            </div>
            <div className="border-r rtl:border-r-0 rtl:border-l border-[var(--border-subtle)] px-2">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">{t('arrival.currentLocation')}</span>
              <span className="font-bold text-[var(--text-primary)]">{t('arrival.dahabLighthouse')}</span>
            </div>
            <div className="pl-2 rtl:pl-0 rtl:pr-2">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">{t('arrival.travelers')}</span>
              <span className="font-bold text-[var(--text-primary)]">{t('arrival.2Adults')}</span>
            </div>
          </div>
        </div>

        {/* 3. RESPONSIVE GRID LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* MAIN AREA (7/12 on Desktop) - TIMELINE */}
          <div className="lg:col-span-7 space-y-6">

            {/* A. RUNNING LATE ADAPTATION STATE */}
            {timeMode === 'running_late' ? (
              <section 
                id="running-late-adaptive-card"
              aria-label={t('arrival.runningLate')}
                className="bg-amber-950/30 border-2 border-amber-500/40 rounded-3xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <AlertCircle className="w-5 h-5 text-amber-400" />
                    <span>{t('arrival.beforeCheckInRunningLate', { duration: formatDuration(clock.minutesUntilCheckIn, lang) })}</span>
                  </div>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {t('arrival.autoSimplified')}
                  </span>
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">
                    {t('arrival.letsKeepItSimple')}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
                    {t('arrival.weveTrimmedTheSchedule')}
                  </p>
                </div>

                <div className="space-y-2.5">
                  <div className="p-4 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--surface-container)] text-[var(--accent-secondary)] flex items-center justify-center border border-[var(--accent-secondary)]/30">
                        <Building className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[var(--text-primary)]">
                          {t('arrival.headTowardYourHotel')}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)]/60">
                          {t('arrival.dahabBayHotel120m')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onBackToMyTrip}
                      className="px-4 py-2 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-bold cursor-pointer hover:bg-[var(--accent-secondary)] transition-colors"
                    >
                      {t('arrival.goToCheckin')}
                    </button>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[var(--surface-container)]/70 border border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <CupSoda className="w-4 h-4" />
                      <span>{t('arrival.optionalGrabAFresh')}</span>
                    </span>
                    <span className="font-semibold text-[var(--accent-secondary)]">{t('arrival.2MinStop')}</span>
                  </div>
                </div>
              </section>
            ) : null}

            {/* B. ALL FINISHED / COMPLETION STATE */}
            {isAllPlanCompleted ? (
              <section 
                id="mini-plan-all-completed-card"
              aria-label={t('arrival.planCompleted')}
                className="bg-[var(--surface-card)] rounded-3xl p-7 border-2 border-emerald-500/40 shadow-xl space-y-4 text-center animate-in zoom-in-95 duration-200"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-xs">
                  <ThumbsUp className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    {t('arrival.niceStart')}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]/80 font-medium">
                    {t('arrival.youreReadyForCheckin')}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] max-w-sm mx-auto space-y-1 text-xs">
                  <span className="text-[11px] font-bold text-[var(--accent-secondary)] block">
                    {t('arrival.next')}
                  </span>
                  <p className="font-bold text-[var(--text-primary)] text-sm">
                    {`${formatClock(clock.checkInAt, lang)} · ${t('arrival.hotelCheckin-3')}`}
                  </p>
                  <p className="text-[var(--text-secondary)]/60">
                    {t('arrival.dahabBayHotelSea')}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    id="continue-to-my-trip-btn"
                    onClick={onBackToMyTrip}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-sm shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{t('arrival.continueToMyTrip')}</span>
                    {isRTL ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </section>
            ) : null}

            {/* C. EARLY COMPLETION STATE */}
            {timeMode === 'early_done' && !isAllPlanCompleted ? (
              <section 
                id="early-completion-bonus-card"
              aria-label={t('arrival.extraTime')}
                className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--accent-secondary)]/30 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex items-center gap-2 text-[var(--accent-secondary)] font-bold text-sm">
                    <Sparkles className="w-4 h-4" />
                    <span>{t('arrival.beforeCheckIn', { duration: formatDuration(clock.minutesUntilCheckIn, lang) })}</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                    {t('arrival.extraFreeTime')}
                  </span>
                </div>

                <p className="text-xs text-[var(--text-secondary)]/80">
                  {t('arrival.youMovedAtA')}
                </p>

                {liveEarlyOptions.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {liveEarlyOptions.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleLiveOptionAction(option)}
                        className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/50 text-start space-y-1 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer group"
                      >
                        <CategoryIcon kind={option.icon as CategoryKind} className="w-5 h-5" />
                        <h5 className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]">
                          {language === 'ar' ? option.titleAr : option.title}
                        </h5>
                        <p className="text-[12px] text-[var(--text-secondary)]/60">
                          {language === 'ar' ? option.descriptionAr : option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setActivityModalType('breakfast')}
                      className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/50 text-start space-y-1 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer group"
                    >
                      <CategoryIcon kind="coffee" className="w-5 h-5" />
                      <h5 className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]">
                        {t('arrival.coffee')}
                      </h5>
                      <p className="text-[12px] text-[var(--text-secondary)]/60">
                        {t('arrival.slowBedouinSpicedBrew')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivityModalType('beach')}
                      className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/50 text-start space-y-1 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer group"
                    >
                      <Sun className="w-5 h-5" />
                      <h5 className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]">
                        {t('arrival.beach-2')}
                      </h5>
                      <p className="text-[12px] text-[var(--text-secondary)]/60">
                        {t('arrival.shadedSunbedDipAt')}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActivityModalType('walk')}
                      className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/50 text-start space-y-1 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer group"
                    >
                      <Footprints className="w-5 h-5" />
                      <h5 className="font-bold text-xs text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)]">
                        {t('arrival.shortWalk')}
                      </h5>
                      <p className="text-[12px] text-[var(--text-secondary)]/60">
                        {t('arrival.scenicViewpointAroundThe')}
                      </p>
                    </button>
                  </div>
                )}
              </section>
            ) : null}

            {/* D. PERSONALIZED RECOMMENDATION HEADER & CONTROLS */}
            <section
              aria-label={t('arrival.suggestedPlan')}
              className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xl space-y-5"
            >
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
                <div>
                  <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                    {t('arrival.personalizedRecommendation')}
                  </span>
                  <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                    {t('arrival.heresWhatWedDo')}
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]/70 mt-0.5 font-medium">
                    {t('arrival.keepItCloseGrab')}
                  </p>
                </div>

                {/* Edit Plan quick trigger */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    id="change-plan-top-btn"
                    onClick={() => setIsEditPlanModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-container)]/80 text-[var(--text-secondary)] border border-[var(--border-subtle)] text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                    <span>{t('arrival.changeThisPlan')}</span>
                  </button>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[var(--accent-secondary)]">
                    {t('arrival.activityOf', { currentStepNumber, totalSteps })}
                  </span>
                  <span className="text-[var(--text-muted)]">•</span>
                  <span className="text-[var(--text-secondary)]/70">
                    {completedCount === totalSteps 
                      ? (t('arrival.allFinished'))
                      : (t('arrival.remainingCount', { count: totalSteps - completedCount }))}
                  </span>
                </div>

                {/* Progress Dots */}
                <div className="flex items-center gap-1.5">
                  {steps.map((step, idx) => (
                    <div 
                      key={idx}
                      className={`h-2 rounded-full transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                        step.isCompleted 
                          ? 'w-4 bg-emerald-500' 
                          : idx === completedCount 
                            ? 'w-6 bg-[var(--accent-secondary)]' 
                            : 'w-2 bg-[var(--btn-util-bg)]'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Alternative Quick Recommendation Pill */}
              {planVariant === 'standard' ? (
                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                    <span className="font-semibold text-[var(--text-primary)]">{t('arrival.skipBreakfast')}</span>
                    <span className="text-[var(--text-secondary)]/60 hidden sm:inline">{t('arrival.weCanSwitchTo')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanVariant('coffee-beach');
                      showToast(t('arrival.switchedToCoffeeBeach'));
                    }}
                    className="px-3.5 py-2 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-[12px] hover:bg-[var(--accent-secondary)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t('arrival.coffeeBeach')}
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/30 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-[var(--text-primary)]">
                    <span className="font-semibold text-[var(--accent-secondary)]">{t('arrival.showingCoffeeBeachPlan')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanVariant('standard');
                      showToast(t('arrival.restoredStandardBreakfastPlan'));
                    }}
                    className="px-3 py-1 rounded-full bg-[var(--surface-card)] border border-[var(--accent-secondary)]/40 text-[var(--accent-secondary)] font-bold text-[12px] hover:bg-[var(--surface-container)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t('arrival.restoreStandardPlan')}
                  </button>
                </div>
              )}

              {/* TIMELINE ACTIVITIES LIST */}
              <div className={`space-y-4 relative ${isRTL ? 'pr-3 sm:pr-4 before:absolute before:right-7 sm:before:right-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--btn-util-bg)]' : 'pl-3 sm:pl-4 before:absolute before:left-7 sm:before:left-8 before:top-4 before:bottom-4 before:w-0.5 before:bg-[var(--btn-util-bg)]'}`}>
                {steps.map((step, idx) => {
                  const isCurrentActive = idx === completedCount && !step.isCompleted;

                  return (
                    <div 
                      key={step.id}
                      id={`timeline-card-${step.id}`}
                      className={`relative flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                        step.isCompleted
                          ? 'bg-[var(--surface-container)]/40 border-emerald-500/40 opacity-90'
                          : isCurrentActive
                            ? 'bg-[var(--surface-container)] border-2 border-[var(--accent-secondary)] shadow-[0_0_20px_rgba(244,195,108,0.15)] ring-1 ring-[var(--accent-secondary)]/30'
                            : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                      }`}
                    >
                      {/* Timeline Icon / Status Bullet */}
                      <button
                        type="button"
                        onClick={() => handleToggleStepCompletion(step.id)}
                        title={step.isCompleted ? (t('arrival.markAsIncomplete')) : (t('arrival.markAsDone'))}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl flex items-center justify-center flex-shrink-0 z-10 text-base sm:text-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer shadow-2xs ${
                          step.isCompleted
                            ? 'bg-emerald-600 text-white'
                            : isCurrentActive
                              ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold ring-4 ring-[var(--accent-secondary)]/20'
                              : 'bg-[var(--surface-container)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                        }`}
                      >
                        {step.isCompleted ? (
                          <Check className="w-5 h-5 stroke-[2.5]" />
                        ) : (
                          <CategoryIcon kind={step.icon} className="w-5 h-5" />
                        )}
                      </button>

                      {/* Card Content */}
                      <div className="flex-1 space-y-2">
                        {/* Time & Category Header */}
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-mono font-bold ${
                              step.isCompleted ? 'text-emerald-400' : isCurrentActive ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-secondary)]/60'
                            }`}>
                              {step.time}
                            </span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--btn-util-bg)] text-[var(--text-secondary)]/70">
                              {step.duration}
                            </span>
                            {step.isCompleted && (
                              <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                {t('arrival.completed')}
                              </span>
                            )}
                            {isCurrentActive && (
                              <span className="text-[11px] font-bold text-[var(--accent-secondary)] bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-secondary)] animate-pulse"></span>
                                <span>{t('arrival.upNext')}</span>
                              </span>
                            )}
                          </div>

                          <span className="text-[12px] font-bold text-[var(--accent-secondary)]/80">
                            {step.category}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className={`text-base font-bold ${
                            step.isCompleted ? 'text-[var(--text-secondary)]/60 line-through decoration-[var(--text-secondary)]/40' : 'text-[var(--text-primary)]'
                          }`}>
                            {step.title}
                          </h3>
                          <p className="text-xs text-[var(--text-secondary)]/75 leading-relaxed mt-0.5">
                            {step.desc}
                          </p>
                        </div>

                        {/* Card Actions */}
                        <div className="pt-1.5 flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleStepCTA(step.ctaAction)}
                            className="px-3.5 py-1.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <span>{step.ctaText}</span>
                            {isRTL ? <ArrowLeft className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleStepCompletion(step.id)}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                              step.isCompleted
                                ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950'
                                : 'bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{step.isCompleted ? (t('arrival.completed-2')) : (t('arrival.markAsDone-2'))}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* TIME SAFETY REASSURANCE */}
              <div className="p-4 rounded-2xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] flex items-center gap-3 text-xs text-[var(--text-secondary)]">
                <ShieldCheck className="w-5 h-5 text-[var(--accent-secondary)] flex-shrink-0" />
                <p className="leading-relaxed">
                  <strong className="text-[var(--text-primary)]">{t('arrival.weveLeftSomeExtra')}</strong>{' '}
                  {t('arrival.theScheduleIncludesAn')}
                </p>
              </div>

            </section>

          </div>

          {/* SECONDARY AREA (5/12 on Desktop) */}
          <aside
            className="lg:col-span-5 space-y-6"
            aria-label={t('arrival.tripContextAndHotel')}
          >

            {/* 1. HOTEL REMINDER & STAY CARD */}
            <div 
              id="first2h-hotel-stay-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--surface-container)] text-[var(--accent-secondary)] flex items-center justify-center font-bold">
                    <Building className="w-3.5 h-3.5" />
                  </div>
                  <h2 className=" font-bold text-base text-[var(--text-primary)]">
                    {t('arrival.dahabBayHotel-2')}
                  </h2>
                </div>

                <span className="text-[12px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                  {`${t('arrival.checkin-2')} ${formatClock(clock.checkInAt, lang)}`}
                </span>
              </div>

              <div className="space-y-2 text-xs text-[var(--text-secondary)]/80">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]/50">{t('arrival.status')}</span>
                  <span className="font-bold text-amber-300">{t('arrival.roomCleaningInProgress')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]/50">{t('arrival.reservedRoom') + ':'}</span>
                  <span className="font-bold text-[var(--text-primary)]">{t('arrival.seaViewDeluxe2')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]/50">{t('arrival.frontDesk')}</span>
                  <span className="font-semibold text-emerald-300">{t('arrival.open247LuggageHeld')}</span>
                </div>
              </div>

              <button
                type="button"
                id="drop-luggage-sidebar-btn"
                onClick={() => setIsLuggageModalOpen(true)}
                className="w-full py-2.5 px-4 rounded-full bg-[var(--surface-container)] hover:bg-[var(--accent-secondary)]/10 text-xs font-bold text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Luggage className="w-3.5 h-3.5" />
                <span>{t('arrival.luggageStorageDirections120m')}</span>
              </button>
            </div>

            {/* 2. LIVE TIME BUDGET BREAKDOWN */}
            <div 
              id="first2h-time-budget-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                <h2 className=" font-bold text-base text-[var(--text-primary)]">
                  {t('arrival.morningBreakdown')}
                </h2>
                <span className="text-xs font-mono font-bold text-[var(--accent-secondary)]">
                  {`${formatClock(clock.arrivedAt, lang)} ${language === 'ar' ? '←' : '→'} ${formatClock(planEndsAt, lang)}`}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><CategoryIcon kind="luggage" className="w-3.5 h-3.5" /> {t('arrival.luggageDropSetup')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{t('arrival.15Min')}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><CategoryIcon kind="coffee" className="w-3.5 h-3.5" /> {t('arrival.breakfastCoastalCoffee')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{t('arrival.40Min')}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-container)] text-[var(--text-secondary)]">
                  <span className="inline-flex items-center gap-1.5"><CategoryIcon kind="reef" className="w-3.5 h-3.5" /> {t('arrival.shorelineWalkSeaLounge')}</span>
                  <span className="font-bold text-[var(--text-primary)]">{t('arrival.45Min')}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-950/50 text-emerald-300 border border-emerald-500/30">
                  <span className="font-bold inline-flex items-center gap-1.5"><CategoryIcon kind="sparkles" className="w-3.5 h-3.5" /> {t('arrival.timeBufferBeforeCheckin')}</span>
                  <span className="font-bold">{t('arrival.40MinSafe')}</span>
                </div>
              </div>
            </div>

            {/* 3. COMING UP ON CONFIRMED TRIP */}
            <div 
              id="first2h-itinerary-integration-card"
              className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-3.5"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                  {t('arrival.upcomingTripMilestone')}
                </span>
                <span className="text-[12px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {t('arrival.confirmed')}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
                <span className="text-[11px] font-bold text-[var(--accent-secondary)]">
                  {t('arrival.tomorrow0900AM')}
                </span>
                <h3 className="font-bold text-sm text-[var(--text-primary)]">
                  {t('arrival.guidedDivingExperience')}
                </h3>
                <p className="text-[var(--text-secondary)]/65 text-[12px]">
                  {t('arrival.canyonBlueHoleReefs')}
                </p>
              </div>

              <button
                type="button"
                onClick={onBackToMyTrip}
                className="w-full py-2 px-3 rounded-full text-xs font-semibold text-[var(--text-secondary)]/70 hover:text-[var(--accent-secondary)] hover:bg-[var(--surface-container)] transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>{t('arrival.view5DayDahabItinerary')}</span>
                {isRTL ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* 4. LOCAL CONCIERGE HELP */}
            <div className="bg-[var(--surface-card)] rounded-3xl p-5 border border-[var(--border-subtle)] text-xs space-y-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[var(--accent-secondary)]" />
                <span className="font-bold text-[var(--text-primary)]">{t('arrival.needAnythingAdjusted')}</span>
              </div>
              <p className="text-[var(--text-secondary)]/70 leading-relaxed text-[12px]">
                {t('arrival.ourLocalDahabTeam')}
              </p>
              <button
                type="button"
                onClick={onOpenHelp}
                className="w-full py-2 rounded-full bg-[var(--surface-container)] hover:bg-rose-950/40 border border-rose-500/40 text-rose-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>{t('arrival.helpMeNow')}</span>
              </button>
            </div>

          </aside>

        </div>

      </main>

      {/* MOBILE STICKY BOTTOM ACTION */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface-card)]/95 backdrop-blur-lg border-t border-[var(--border-subtle)] p-3 shadow-xl flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
          <Building className="w-4 h-4 text-[var(--accent-secondary)]" />
          <span className="font-bold">{`${t('arrival.checkin-2')} ${formatClock(clock.checkInAt, lang)}`}</span>
        </div>

        <button
          type="button"
          id="mobile-change-plan-btn"
          onClick={() => setIsEditPlanModalOpen(true)}
          className="py-2.5 px-4 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold text-xs shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 cursor-pointer hover:bg-[var(--accent-secondary)]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{t('arrival.changePlan')}</span>
        </button>
      </div>

      {/* LIGHTWEIGHT EDIT PLAN MODAL */}
      {isEditPlanModalOpen && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200 ${isRTL ? 'rtl' : 'ltr'}`}>
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="first2h-edit-plan-title"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[var(--accent-secondary)]" />
                <h2 id="first2h-edit-plan-title" className="text-lg font-bold text-[var(--text-primary)]">
                  {t('arrival.changeThisPlan-2')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditPlanModalOpen(false)}
                aria-label={t('arrival.close')}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed">
              {t('arrival.selectAnAlternativeMorning')}
            </p>

            <div className="space-y-2.5">
              {/* Option 1: Standard Breakfast & Walk */}
              <button
                type="button"
                aria-pressed={planVariant === 'standard'}
                onClick={() => {
                  setPlanVariant('standard');
                  setIsEditPlanModalOpen(false);
                  showToast(t('arrival.updatedToStandardBreakfast'));
                }}
                className={`w-full text-start p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-1 ${
                  planVariant === 'standard' ? 'border-[var(--accent-secondary)] bg-[var(--surface-container)] shadow-[0_0_15px_rgba(244,195,108,0.15)]' : 'border-[var(--border-subtle)] bg-[var(--surface-container)]/50 hover:border-[var(--accent-secondary)]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className=" font-bold text-sm text-[var(--text-primary)]">
                    {t('arrival.standardBreakfastCoastalWalk')}
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-secondary)]/10 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30">
                    {t('arrival.balanced')}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]/70">
                  {t('arrival.fullEgyptianBreakfastAt')}
                </p>
              </button>

              {/* Option 2: Coffee + Beach */}
              <button
                type="button"
                aria-pressed={planVariant === 'coffee-beach'}
                onClick={() => {
                  setPlanVariant('coffee-beach');
                  setIsEditPlanModalOpen(false);
                  showToast(t('arrival.updatedToCoffeeBeach'));
                }}
                className={`w-full text-start p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-1 ${
                  planVariant === 'coffee-beach' ? 'border-[var(--accent-secondary)] bg-[var(--surface-container)] shadow-[0_0_15px_rgba(244,195,108,0.15)]' : 'border-[var(--border-subtle)] bg-[var(--surface-container)]/50 hover:border-[var(--accent-secondary)]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className=" font-bold text-sm text-[var(--text-primary)]">
                    {t('arrival.skipBreakfastCoffeeBeach')}
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {t('arrival.relaxed')}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]/70">
                  {t('arrival.quickSpicedCoffeeBy')}
                </p>
              </button>

              {/* Option 3: Direct Hotel Lounge */}
              <button
                type="button"
                onClick={() => {
                  setIsLuggageModalOpen(true);
                  setIsEditPlanModalOpen(false);
                  showToast(t('arrival.hotelDropoffSelected'));
                }}
                className="w-full text-start p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)]/50 hover:border-[var(--accent-secondary)]/40 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h3 className=" font-bold text-sm text-[var(--text-primary)]">
                    {t('arrival.minimalDropBagsHotel')}
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--btn-util-bg)] text-[var(--text-secondary)]/70">
                    {t('arrival.rest')}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]/70">
                  {t('arrival.dropLuggageImmediatelyAt')}
                </p>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsEditPlanModalOpen(false)}
                className="w-full py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--btn-util-bg)] text-xs font-bold text-[var(--text-secondary)] border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                {t('arrival.keepCurrentPlan')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-bold shadow-2xl border border-[var(--accent-secondary)]/40 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* MODALS */}
      <LuggageStorageModal
        isOpen={isLuggageModalOpen}
        onClose={() => setIsLuggageModalOpen(false)}
        onConfirmStorage={(storageName) => {
          showToast(t('arrival.luggageDropConfirmedAt-2', { storageName }));
          if (!completedStepIds.includes('step-1-luggage')) {
            setCompletedStepIds(prev => [...prev, 'step-1-luggage']);
          }
        }}
      />

      <ActivityOptionModal
        type={activityModalType}
        onClose={() => setActivityModalType(null)}
        onSelectAction={(actionTitle) => {
          showToast(t('arrival.selected-2', { actionTitle }));
        }}
      />

    </div>
  );
};

