import React, { useCallback, useMemo, useState } from 'react';
import { 
  Compass, 
  Clock, 
  MapPin, 
  Sparkles, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  ChevronDown, 
  ThumbsUp, 
  ThumbsDown, 
  ShieldCheck, 
  Utensils, 
  Info, 
  X,
  Plus,
  Wallet,
  Target,
  Scale
} from 'lucide-react';
import { TravelerNav } from '../mytrip/TravelerNav';
import { useTrip } from '../../context/TripContext';
import { CategoryIcon, type CategoryKind } from '../common/CategoryIcon';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { mapFitWindowOptions } from '../../services/spontaneousMapper';

// These moved to src/shared/types/spontaneous.ts. The mapper above is a
// service, and importing a component from a service is a cycle: Vite's module
// graph broke and the whole app fell into its ErrorBoundary. Re-exported here
// so existing importers are unaffected.
export type { RecommendationMood, SpontaneousOption } from '../../shared/types/spontaneous';
import type { SpontaneousOption } from '../../shared/types/spontaneous';

interface WhatShouldIDoNowViewProps {
  onBackToMyTrip: () => void;
  onBackToCompanion?: () => void;
  onNavigateToFoodNow?: () => void;
  onExploreClick?: () => void;
  onOpenHelp?: () => void;
  onActivityAddedToTrip?: (activity: {
    id: string;
    title: string;
    time: string;
    duration: string;
    tag: string;
  }) => void;
  /**
   * Minutes until the next scheduled activity, computed by the parent
   * (MyTripView owns the "next up" activity). Defaults to the 2h window the
   * backend assumes when no boundary is known.
   */
  availableMinutes?: number;
}

export const WhatShouldIDoNowView: React.FC<WhatShouldIDoNowViewProps> = ({
  onBackToMyTrip,
  onBackToCompanion,
  onNavigateToFoodNow,
  onExploreClick,
  onOpenHelp,
  onActivityAddedToTrip,
  availableMinutes = 120,
}) => {
  const { language, isRTL , t} = useLanguage();
  const { profile, user, sessionUser } = useTrip();
  // First name only, from the session: a greeting is how someone is addressed,
  // not a record lookup. With no name the greeting is simply neutral.
  const travelerName = (profile.name || user?.displayName || sessionUser?.name || '').trim().split(/\s+/)[0] || '';
  const [activeTab, setActiveTab] = useState<'home' | 'mytrip' | 'explore' | 'bookings' | 'profile'>('mytrip');

  // Currently selected recommendation for focused detail view
  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt-chill');

  // Expanded "Why this?" accordion states
  const [expandedWhyThis, setExpandedWhyThis] = useState<Record<string, boolean>>({
    'opt-chill': true,
    'opt-explore': false,
    'opt-adventure': false,
  });

  // Time protection modal state for tight fits (like Adventure)
  const [tightFitModalOption, setTightFitModalOption] = useState<SpontaneousOption | null>(null);

  // Success state: added activity to trip
  const [addedActivity, setAddedActivity] = useState<SpontaneousOption | null>(null);

  // Preference feedback tracking (More like this / Not my style)
  const [preferenceFeedback, setPreferenceFeedback] = useState<Record<string, 'liked' | 'disliked'>>({});

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  /**
   * Live recommendations from /api/context/fit-window. Stable fetcher so
   * useApiResource does not re-request on every render. The three curated
   * fallback options below keep rendering until live data lands, and stay on a
   * failed request (useApiResource leaves `data` untouched on error).
   */
  const fetchFitWindowOptions = useCallback(
    (signal: AbortSignal) => api.getFitWindowOptions({ availableMinutes }, signal),
    [availableMinutes]
  );
  const fitWindow = useApiResource(fetchFitWindowOptions);

  // Fallback: three curated recommendations for the classic 2h, post-dive
  // morning. Served while live options load, and on a failed request.
  const fallbackOptions: SpontaneousOption[] = [
    {
      id: 'opt-chill',
      mood: 'chill',
      tag: 'Chill',
      tagAr: 'روقان',
      title: 'Lighthouse + Coffee',
      titleAr: 'قعدة قهوة وشاي ع ممشى اللايتهاوس',
      description: 'Take a relaxed walk around the Lighthouse area and stop for a coffee with a sea view.',
      descriptionAr: 'تمشية خفيفة على ممشى اللايتهاوس وقعدة شاي بالحبق أو قهوة مثلجة بإطلالة مباشرة ع البحر.',
      duration: '60–90 min (75 min)',
      durationAr: '٦٠–٩٠ دقيقة (٧٥ دقيقة)',
      durationMinutes: 75,
      priceLevel: 'Low',
      priceEstimate: 'EGP 250–400 for 2',
      priceEstimateAr: '٢٥٠–٤٠٠ ج لفردين',
      distance: 'Nearby (0.8 km)',
      distanceAr: 'قريب جداً (٨٠٠ متر)',
      distanceKm: '0.8 km',
      pace: 'Relaxed',
      paceAr: 'روقان وهدوء',
      icon: 'coffee',
      timeSlot: '12:00 PM – 01:15 PM',
      whyItFits: 'Perfect for your balanced pace.',
      whyItFitsAr: 'مناسب تماماً لنمط يومك الهادي بعد الغطس.',
      whyThisDetailed: "It's nearby, fits your remaining time, and won't make your day feel rushed.",
      whyThisDetailedAr: 'قريب من مكانك، يملأ الساعتين بالراحة التامة، وهيخليك جاهز لوجبة الغداء ١:٣٠ م بدون أي استعجال.',
      whyItWorks: "You'll still have enough time to reach lunch without rushing.",
      whyItWorksAr: 'هتخلص الساعة ١:١٥ م، ومعاك ١٥ دقيقة كاملة راحة قبل ميعاد الغداء المؤكد.',
      isTightFit: false,
      timeBufferMinutes: 30,
    },
    {
      id: 'opt-explore',
      mood: 'explore',
      tag: 'Explore',
      tagAr: 'استكشاف',
      title: 'Local Walk & Souk Artisans',
      titleAr: 'تمشية محلية واكتشاف حرفيي دهب',
      description: 'Explore a local area, discover small shops, and experience a different side of Dahab.',
      descriptionAr: 'لفة بين محلات الفضة البدوية، الأعشاب الجبلية، والزيوت الطبيعية في أزقة دهب الهادية.',
      duration: '60–90 min (75 min)',
      durationAr: '٦٠–٩٠ دقيقة (٧٥ دقيقة)',
      durationMinutes: 75,
      priceLevel: 'Low',
      priceEstimate: 'Free / EGP 50–150 for snacks',
      priceEstimateAr: 'مجاناً / ٥٠–١٥٠ ج للتسالي',
      distance: 'Nearby (0.5 km)',
      distanceAr: 'على بعد ٥٠٠ متر',
      distanceKm: '0.5 km',
      pace: 'Easy Stroll',
      paceAr: 'تمشية خفيفة',
      icon: 'walk',
      timeSlot: '12:00 PM – 01:15 PM',
      whyItFits: 'Easy to fit before lunch.',
      whyItFitsAr: 'مسار دائري ممتع يوصلك في النهاية لباب المطعم.',
      whyThisDetailed: "An easy-going stroll through artisan alleys that naturally loops back right next to your 1:30 PM lunch spot.",
      whyThisDetailedAr: 'مسار ممشى ومتاجر محلية لطيف بين بيوت دهب، بينتهي مباشرة عند مطعم علي بابا ع البحر.',
      whyItWorks: "You discover local hidden corners while staying within a 5-minute walk of the restaurant.",
      whyItWorksAr: 'بتستكشف طابع دهب الحقيقي وأنت على مسافة ٥ دقايق مشي بس من مكان غداك.',
      isTightFit: false,
      timeBufferMinutes: 25,
    },
    {
      id: 'opt-adventure',
      mood: 'adventure',
      tag: 'Adventure',
      tagAr: 'مغامرة',
      title: 'Snorkeling Reef Loop',
      titleAr: 'غطسة سنوركلينج سريعة في اللايتهاوس',
      description: 'Hop in for an easy shallow reef snorkel. Coral entry is right at the bay.',
      descriptionAr: 'نزلة سنوركلينج خفيفة عند طرف شعب اللايتهاوس مع رؤية ٣٠ متر وأسماك الببغاء والراي.',
      duration: '60–75 min',
      durationAr: '٦٠–٧٥ دقيقة',
      durationMinutes: 75,
      priceLevel: 'Low',
      priceEstimate: 'EGP 150 (Gear rental)',
      priceEstimateAr: '١٥٠ ج (إيجار الماسك والزعانف)',
      distance: 'On site (0.2 km)',
      distanceAr: 'في مكانك (٢٠٠ متر)',
      distanceKm: '0.2 km',
      pace: 'Active',
      paceAr: 'نشاط وحركة',
      icon: 'dive',
      timeSlot: '12:00 PM – 01:15 PM',
      whyItFits: 'High energy, close to water.',
      whyItFitsAr: 'استغلال للرؤية الممتازة ونقاء البحر النهارده.',
      whyThisDetailed: "A refreshing reef snorkel right off the shore. Finishes at 1:15 PM, leaving 15 min buffer to dry off before lunch.",
      whyThisDetailedAr: 'نزلة بحر منعشة من الشاطئ مباشرة. هتخلص ١:١٥ م، ومعاك ١٥ دقيقة للتنشيف وتغيير الهدوم قبل الغداء.',
      whyItWorks: "Takes advantage of current glassy water conditions while keeping lunch time protected.",
      whyItWorksAr: 'البحر رايق جداً وهادئ، والمطعم على بعد دقيقتين بس من الشاطئ.',
      isTightFit: true,
      timeBufferMinutes: 15,
    },
  ];

  const options: SpontaneousOption[] = useMemo(() => {
    if (fitWindow.data && fitWindow.data.options.length > 0) {
      return mapFitWindowOptions(fitWindow.data.options, availableMinutes);
    }
    return fallbackOptions;
  }, [fitWindow.data, availableMinutes, fallbackOptions]);

  const selectedOption = options.find(o => o.id === selectedOptionId) || options[0] || fallbackOptions[0];

  const toggleWhyThis = (optionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedWhyThis(prev => ({
      ...prev,
      [optionId]: !prev[optionId]
    }));
  };

  const handleSelectOption = (option: SpontaneousOption) => {
    setSelectedOptionId(option.id);
  };

  const handleTriggerAddToTrip = (option: SpontaneousOption) => {
    if (option.isTightFit) {
      setTightFitModalOption(option);
      return;
    }

    commitAddToTrip(option);
  };

  const commitAddToTrip = (option: SpontaneousOption) => {
    setAddedActivity(option);
    setTightFitModalOption(null);
    showToast(t('spontaneous.addToTrip', { title: language === 'ar' ? option.titleAr : option.title }));
    
    if (onActivityAddedToTrip) {
      onActivityAddedToTrip({
        id: option.id,
        title: language === 'ar' ? option.titleAr : option.title,
        time: option.timeSlot.split('–')[0].trim(),
        duration: option.duration,
        tag: option.tag,
      });
    }
  };

  const handleFeedback = (optionId: string, type: 'liked' | 'disliked', e: React.MouseEvent) => {
    e.stopPropagation();
    setPreferenceFeedback(prev => ({ ...prev, [optionId]: type }));
    if (type === 'liked') {
      showToast(t('spontaneous.savedWeWillSuggest'));
    } else {
      showToast(t('spontaneous.savedWeWillAdjust'));
    }
  };

  const handleNavigate = (tab: 'home' | 'mytrip' | 'explore' | 'bookings' | 'profile') => {
    setActiveTab(tab);
    if (tab === 'home' || tab === 'mytrip') {
      onBackToMyTrip();
    } else if (tab === 'explore' && onExploreClick) {
      onExploreClick();
    } else if (tab === 'bookings') {
      onBackToMyTrip();
    } else if (tab === 'profile') {
      showToast(
        sessionUser
          ? t('spontaneous.loggedInAs', { login: sessionUser.name || sessionUser.email })
          : t('food.notSignedIn')
      );
    }
  };

  return (
    <div 
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--surface-container)] text-[var(--text-primary)] flex flex-col pb-28 md:pb-16 selection:bg-[var(--accent-secondary)]/30"
    >
      
      {/* 1. TRAVELER TOP NAVIGATION (My Trip is active) */}
      <TravelerNav
        activeTab={activeTab}
        onNavigate={handleNavigate}
        onOpenHelp={onOpenHelp}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 w-full flex-grow">
        
        {/* Top Breadcrumb & Quick Nav */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="back-to-companion-btn"
              onClick={onBackToCompanion || onBackToMyTrip}
              className="inline-flex items-center gap-1.5 py-3.5 -my-2 text-xs font-semibold text-[var(--text-secondary)]/70 hover:text-[var(--accent-secondary)] transition-colors cursor-pointer"
            >
              <ArrowLeft className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
              <span>{t('spontaneous.backToDailyCompanion')}</span>
            </button>
            <span className="text-white/20">•</span>
            <button
              type="button"
              id="back-to-mytrip-overview-link"
              onClick={onBackToMyTrip}
              className="text-xs font-medium text-[var(--text-secondary)]/50 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {t('food.fullItinerary')}
            </button>
            {onNavigateToFoodNow && (
              <>
                <span className="text-white/20">•</span>
                <button
                  type="button"
                  id="go-to-food-now-btn"
                  onClick={onNavigateToFoodNow}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[var(--accent-secondary)] hover:underline cursor-pointer"
                >
                  <Utensils className="w-3 h-3" />
                  <span>{t('spontaneous.hungryFoodNow')}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 2. PAGE HEADER */}
        <div className="space-y-4 mb-8">
          
          {/* Header Badges */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--surface-container)] text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30 text-xs font-bold">
              <Compass className="w-3.5 h-3.5" />
              <span>{t('spontaneous.spontaneousDecisionSupport')}</span>
            </div>

            {/* Constraints Pills */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-primary)] shadow-xs">
                <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                <span>{t('spontaneous.minAvailable', { mins: language === 'ar' ? availableMinutes.toLocaleString('ar-EG') : String(availableMinutes) })}</span>
              </div>
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-2">
            <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
              {travelerName ? t('spontaneous.whatShouldYouDoNamed', { travelerName }) : t('spontaneous.whatShouldYouDoGeneric')}
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-secondary)]/80 max-w-3xl font-medium leading-relaxed">
              {t('spontaneous.youFinishedDivingEarly')}
            </p>
          </div>
        </div>

        {/* ============================================================ */}
        {/* VIEW BODY: LIVE OPTIONS vs HONEST EMPTY STATE                  */}
        {/* ============================================================ */}

        {options.length === 0 ? (
          /* ------------------------------------------------------------ */
          /* LOW OPPORTUNITY / SHORT WINDOW STATE (< 30 min)              */
          /* ------------------------------------------------------------ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-6">
              
              <div className="bg-[var(--surface-card)] rounded-3xl p-7 sm:p-9 border border-[var(--border-subtle)] shadow-xl space-y-6">
                <div className="w-12 h-12 rounded-2xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/30 text-[var(--accent-secondary)] flex items-center justify-center shadow-md">
                  <CategoryIcon kind="coffee" className="w-6 h-6" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl chart-heading font-bold text-[var(--text-primary)]">
                    {t('spontaneous.nothingWorthRushingFor')}
                  </h2>
                  <p className="text-sm sm:text-base text-[var(--text-secondary)]/80 leading-relaxed">
                    {t('spontaneous.youHaveAShort')}
                  </p>
                </div>

                {/* 3 Low-friction easy options */}
                <div className="space-y-3 pt-2">
                  <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                    {t('spontaneous.recommendedEasyMoves')}
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
                      <div className="flex items-center gap-2">
                        <CategoryIcon kind="coffee" className="w-5 h-5 text-[var(--text-secondary)]" />
                        <h4 className="font-bold text-sm text-[var(--text-primary)]">{t('spontaneous.coffeeNearby')}</h4>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]/70">
                        {t('spontaneous.grabAQuickMint')}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
                      <div className="flex items-center gap-2">
                        <CategoryIcon kind="reef" className="w-5 h-5 text-[var(--text-secondary)]" />
                        <h4 className="font-bold text-sm text-[var(--text-primary)]">{t('spontaneous.relaxByTheSea')}</h4>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]/70">
                        {t('spontaneous.unwindOnABedouin')}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
                      <div className="flex items-center gap-2">
                        <CategoryIcon kind="food" className="w-5 h-5 text-[var(--text-secondary)]" />
                        <h4 className="font-bold text-sm text-[var(--text-primary)]">{t('spontaneous.headTowardLunch')}</h4>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]/70">
                        {t('spontaneous.strollCasuallyToYour')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs text-[var(--text-secondary)]/50 font-medium">
                    {t('spontaneous.relevanceDiscoveryOverload')}
                  </span>
                </div>
              </div>

            </div>
          </div>

        ) : (

          /* ------------------------------------------------------------ */
          /* LIVE OPTIONS MODE (curated fallback until the API replies)   */
          /* ------------------------------------------------------------ */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* MAIN COLUMN: 3 CURATED CHOICES */}
            <div className="lg:col-span-7 space-y-6">

              {/* Added to trip confirmation banner if active */}
              {addedActivity && (
                <div 
                  id="added-activity-success-banner"
                  className="bg-[var(--surface-container)] border-2 border-emerald-500/80 rounded-3xl p-5 sm:p-6 shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-[var(--surface-container)] flex items-center justify-center text-xl font-bold shadow-md">
                        ✓
                      </div>
                      <div>
                        <span className="text-[11px] font-black text-emerald-300 block">
                          {t('spontaneous.tripUpdated')}
                        </span>
                        <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                          {t('spontaneous.addedToYourTrip')}
                        </h3>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAddedActivity(null)}
                      className="text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)] p-1 rounded-full hover:bg-[var(--surface-card)]/10 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed font-medium">
                    <strong>{language === 'ar' ? addedActivity.titleAr : addedActivity.title}</strong> {t('spontaneous.hasBeenAddedTo')}
                  </p>

                  <div className="pt-2 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={onBackToCompanion || onBackToMyTrip}
                      className="px-4 py-2 rounded-full bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer"
                    >
                      {t('spontaneous.viewInDailyCompanion')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddedActivity(null)}
                      className="text-xs font-semibold text-[var(--accent-secondary)] hover:underline cursor-pointer"
                    >
                      {t('spontaneous.pickAnotherOptionInstead')}
                    </button>
                  </div>
                </div>
              )}

              {/* 3 RECOMMENDATION CHOICES */}
              <section id="three-recommendations-section" className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                      {t('spontaneous.contextualDecisionSupport')}
                    </span>
                    <h2 className="text-xl sm:text-2xl chart-heading font-bold text-[var(--text-primary)]">
                      {t('spontaneous.3ChoicesForRight')}
                    </h2>
                  </div>

                  <span className="text-xs text-[var(--text-secondary)]/50 font-medium">
                    {t('spontaneous.rankedForYou')}
                  </span>
                </div>

                {/* The 3 Cards */}
                <div className="space-y-4">
                  {options.map((option, idx) => {
                    const isSelected = selectedOptionId === option.id;
                    const isWhyExpanded = !!expandedWhyThis[option.id];
                    const feedback = preferenceFeedback[option.id];
                    const isAdded = addedActivity?.id === option.id;

                    return (
                      <div
                        key={option.id}
                        id={`recommendation-card-${option.id}`}
                        onClick={() => handleSelectOption(option)}
                        className={`bg-[var(--surface-card)] rounded-3xl p-5 sm:p-6 border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer relative overflow-hidden ${
                          isSelected
                            ? 'border-2 border-[var(--accent-secondary)] shadow-[0_0_25px_rgba(244,195,108,0.15)] ring-1 ring-[var(--accent-secondary)]/30 bg-[var(--surface-container)]'
                            : 'border-[var(--border-subtle)] shadow-xl hover:border-white/20'
                        }`}
                      >
                        {/* Card Header & Tag Pill */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
                          <div className="flex items-center gap-2">
                            {/* Mood Tag */}
                            <span className={`text-[11px] font-extrabold px-3 py-1 rounded-full ${
                              option.mood === 'chill'
                                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                : option.mood === 'explore'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {t('spontaneous.optionTag', { idx: idx + 1, tag: language === 'ar' ? option.tagAr : option.tag })}
                            </span>

                            {idx === 0 && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent-secondary)] bg-[var(--surface-card)] border border-[var(--accent-secondary)]/30 px-2.5 py-0.5 rounded-full">
                                <Sparkles className="w-3 h-3 text-[var(--accent-secondary)]" />
                                <span>{t('spontaneous.topPick')}</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-[var(--accent-secondary)]">
                              {language === 'ar' ? option.durationAr : option.duration}
                            </span>
                            <span className="text-white/20 text-xs">•</span>
                            <span className="text-xs text-[var(--text-secondary)]/70 font-medium">
                              {language === 'ar' ? option.distanceAr : option.distance}
                            </span>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <div className="py-3.5 flex items-start gap-3.5">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl shadow-md ${
                            isSelected ? 'bg-[var(--accent-secondary)] text-[var(--surface-container)]' : 'bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                          }`}>
                            <CategoryIcon kind={option.icon as CategoryKind} className="w-5 h-5" />
                          </div>

                          <div className="space-y-1 flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="chart-heading font-bold text-lg sm:text-xl text-[var(--text-primary)]">
                                {language === 'ar' ? option.titleAr : option.title}
                              </h3>
                              <span className="text-xs font-bold text-[var(--accent-secondary)]">
                                {language === 'ar' ? option.priceEstimateAr : option.priceEstimate}
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 leading-relaxed">
                              {language === 'ar' ? option.descriptionAr : option.description}
                            </p>
                          </div>
                        </div>

                        {/* Why it fits pill */}
                        <div className="p-2.5 rounded-2xl bg-[var(--surface-container)]/60 border border-white/5 flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)]/80 font-medium">
                            <strong className="text-[var(--accent-secondary)]">{t('spontaneous.whyItFits')}</strong> {language === 'ar' ? option.whyItFitsAr : option.whyItFits}
                          </span>
                        </div>

                        {/* "Why This?" Expandable explanation */}
                        <div className="pt-3">
                          <button
                            type="button"
                            onClick={(e) => toggleWhyThis(option.id, e)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent-secondary)] hover:brightness-125 cursor-pointer"
                          >
                            <Info className="w-3.5 h-3.5" />
                            <span>{t('spontaneous.whyThis')}</span>
                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isWhyExpanded ? 'rotate-180' : ''}`} />
                          </button>

                          {isWhyExpanded && (
                            <div className="mt-2 p-3.5 rounded-2xl bg-[var(--surface-container)]/80 border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed animate-in fade-in duration-150 space-y-1">
                              <p>{language === 'ar' ? option.whyThisDetailedAr : option.whyThisDetailed}</p>
                              {option.isTightFit && (
                                <p className="text-amber-300 font-semibold pt-1">
                                  ⏱ {t('spontaneous.noteFinishesAt115')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action Bar & CTA */}
                        <div className="pt-4 border-t border-[var(--border-subtle)] mt-3 flex flex-wrap items-center justify-between gap-3">
                          {/* Basic Preference Feedback Buttons */}
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]/60">
                            <span className="text-[12px]">{t('spontaneous.feedback')}</span>
                            <button
                              type="button"
                              id={`feedback-more-${option.id}`}
                              onClick={(e) => handleFeedback(option.id, 'liked', e)}
                              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                                feedback === 'liked'
                                  ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                                  : 'hover:bg-[var(--surface-card)]/10 text-[var(--text-secondary)]/60'
                              }`}
                              title={t('spontaneous.moreLikeThis')}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              id={`feedback-less-${option.id}`}
                              onClick={(e) => handleFeedback(option.id, 'disliked', e)}
                              className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                                feedback === 'disliked'
                                  ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                                  : 'hover:bg-[var(--surface-card)]/10 text-[var(--text-secondary)]/60'
                              }`}
                              title={t('spontaneous.notMyStyle')}
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Primary CTA */}
                          <div className="flex items-center gap-2">
                            {isAdded ? (
                              <span className="px-4 py-2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{t('spontaneous.added')}</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                id={`choose-option-btn-${option.mood}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectOption(option);
                                  handleTriggerAddToTrip(option);
                                }}
                                className={`px-5 py-2.5 rounded-full text-xs font-bold shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 cursor-pointer ${
                                  isSelected
                                    ? 'bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)]'
                                    : 'bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30'
                                }`}
                              >
                                <span>{t('spontaneous.chooseTag', { tag: language === 'ar' ? option.tagAr : option.tag })}</span>
                                <ArrowRight className={`w-3.5 h-3.5 ${isRTL ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              </section>

              {/* FOCUSED ACTIVITY DETAIL VIEW */}
              <section 
                id="selected-activity-detail-card"
                className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xl space-y-5"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
                  <div>
                    <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                      {t('spontaneous.activityDetails')}
                    </span>
                    <h3 className="text-xl chart-heading font-bold text-[var(--text-primary)]">
                      {language === 'ar' ? selectedOption.titleAr : selectedOption.title}
                    </h3>
                  </div>

                  <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                    selectedOption.mood === 'chill'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      : selectedOption.mood === 'explore'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {t('spontaneous.tagMode', { tag: language === 'ar' ? selectedOption.tagAr : selectedOption.tag })}
                  </span>
                </div>

                {/* 5 Key Attribute Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs">
                  <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-white/5 space-y-1">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">{t('arrival.duration')}</span>
                    <span className="font-bold text-sm text-[var(--text-primary)]">{selectedOption.durationMinutes} min</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-white/5 space-y-1">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">{t('food.distance')}</span>
                    <span className="font-bold text-sm text-[var(--text-primary)]">{selectedOption.distanceKm}</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-white/5 space-y-1">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">{t('spontaneous.estCost')}</span>
                    <span className="font-bold text-xs text-[var(--accent-secondary)]">{language === 'ar' ? selectedOption.priceEstimateAr : selectedOption.priceEstimate}</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-white/5 space-y-1">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">{t('spontaneous.bestTime')}</span>
                    <span className="font-bold text-sm text-emerald-300">{t('spontaneous.now')}</span>
                  </div>

                  <div className="p-3 rounded-2xl bg-[var(--surface-container)] border border-white/5 space-y-1 col-span-2 sm:col-span-1">
                    <span className="text-[11px] font-bold text-[var(--text-secondary)]/50 block">{t('spontaneous.pace')}</span>
                    <span className="font-bold text-sm text-[var(--accent-secondary)]">{language === 'ar' ? selectedOption.paceAr : selectedOption.pace}</span>
                  </div>
                </div>

                {/* "Why it works" Block */}
                <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-emerald-500/30 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>{t('spontaneous.whyItWorks')}</span>
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed font-medium">
                    {language === 'ar' ? selectedOption.whyItWorksAr : selectedOption.whyItWorks}
                  </p>
                </div>

                {/* Proposed Schedule Preview */}
                <div className="space-y-2 text-xs">
                  <span className="text-[11px] font-black text-[var(--accent-secondary)] block">
                    {t('spontaneous.updatedScheduleFlow')}
                  </span>
                  
                  <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-[var(--text-secondary)]/60">
                      <span>11:30 AM</span>
                      <span className="font-semibold text-emerald-300 flex items-center gap-1">
                        {t('spontaneous.divingExperience')} <Check className="w-3.5 h-3.5" /> ({t('spontaneous.finishedEarly')})
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[var(--text-primary)] font-bold py-1 border-y border-[var(--border-subtle)]">
                      <span className="text-[var(--accent-secondary)]">12:00 PM</span>
                      <span className="text-[var(--accent-secondary)] flex items-center gap-1">
                        <CategoryIcon kind={selectedOption.icon as CategoryKind} className="w-4 h-4" />
                        <span>{language === 'ar' ? selectedOption.titleAr : selectedOption.title} ({t('spontaneous.proposed')})</span>
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[var(--text-secondary)]">
                      <span>01:30 PM</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        <CategoryIcon kind="food" className="w-4 h-4" /> {t('spontaneous.lunchByTheBay')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Primary & Secondary CTAs */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      showToast(t('spontaneous.selectionDismissed'));
                    }}
                    className="text-xs font-semibold text-[var(--text-secondary)]/60 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                  >
                    {t('spontaneous.notNow')}
                  </button>

                  <button
                    type="button"
                    id="add-to-my-trip-main-btn"
                    onClick={() => handleTriggerAddToTrip(selectedOption)}
                    className="px-6 py-3 rounded-full bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] text-xs font-bold shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-2 cursor-pointer active:scale-98"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('spontaneous.addToMyTrip')}</span>
                  </button>
                </div>
              </section>

            </div>

            {/* SECONDARY COLUMN (5/12): CONTEXT CARD + SCHEDULE + MAP */}
            <div className="lg:col-span-5 space-y-6">

              {/* 1. COMPACT "RIGHT NOW" CONTEXT CARD */}
              <div 
                id="current-context-card"
                className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <h3 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                      {t('spontaneous.rightNow')}
                    </h3>
                  </div>

                  <span className="text-xs font-mono font-bold text-[var(--accent-secondary)] bg-[var(--surface-container)] border border-[var(--accent-secondary)]/30 px-2.5 py-0.5 rounded-full">
                    11:30 AM
                  </span>
                </div>

                {/* 5 Context Rows */}
                <div className="space-y-2.5 text-xs text-[var(--text-secondary)]/80">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-container)] border border-white/5">
                    <span className="text-[var(--text-secondary)]/60 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                      <span>{t('spontaneous.location')}</span>
                    </span>
                    <span className="font-bold text-[var(--text-primary)]">{t('spontaneous.nearDahabLighthouse')}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-container)] border border-white/5">
                    <span className="text-[var(--text-secondary)]/60 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                      <span>{t('spontaneous.availableTime')}</span>
                    </span>
                    <span className="font-bold text-[var(--accent-secondary)]">{t('spontaneous.approx2Hours')}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-container)] border border-white/5">
                    <span className="text-[var(--text-secondary)]/60 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5" />{t('spontaneous.budget')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{t('spontaneous.moderate')}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-container)] border border-white/5">
                    <span className="text-[var(--text-secondary)]/60 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" />{t('spontaneous.interests')}</span>
                    <span className="font-bold text-[var(--text-primary)]">{t('spontaneous.divingAdventureFood')}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--surface-container)] border border-white/5">
                    <span className="text-[var(--text-secondary)]/60 flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" />{t('spontaneous.pace')}</span>
                    <span className="font-bold text-[var(--accent-secondary)]">{t('spontaneous.balancedPace')}</span>
                  </div>
                </div>

                {/* Reassurance text */}
                <p className="text-[12px] text-[var(--text-secondary)]/60 leading-relaxed italic text-center pt-1">
                  {t('spontaneous.recommendationsFilteredByYour')}
                </p>
              </div>

              {/* 2. TIME PROTECTION CARD */}
              <div 
                id="next-planned-activity-card"
                className="bg-[var(--surface-card)] rounded-3xl p-6 border-2 border-emerald-500/40 shadow-xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
                  <div className="flex items-center gap-2">
                    <Utensils className="w-4 h-4 text-emerald-400" />
                    <h3 className="chart-heading font-bold text-base text-[var(--text-primary)]">
                      {t('spontaneous.nextScheduledActivity')}
                    </h3>
                  </div>

                  <span className="text-xs font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    {t('spontaneous.protected')}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-emerald-500/30 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono font-bold text-emerald-300">
                      {t('spontaneous.0130PMIn2')}
                    </span>
                    <h4 className="font-bold text-sm text-[var(--text-primary)]">
                      {t('spontaneous.lunchByTheBay-2')}
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)]/70">
                      {t('spontaneous.aliBabaSeafoodBedouin')}
                    </p>
                  </div>
                  <CategoryIcon kind="food" className="w-6 h-6 text-[var(--text-secondary)]" />
                </div>

                <div className="p-3 rounded-2xl bg-[var(--surface-container)]/60 border border-white/5 space-y-1 text-xs text-[var(--text-secondary)]/80">
                  <div className="flex items-center gap-1.5 text-[var(--accent-secondary)] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                    <span>{t('spontaneous.timeProtectionActive')}</span>
                  </div>
                  <p>
                    {t('spontaneous.allRecommendationsAreCalculated')}
                  </p>
                </div>
              </div>

              {/* 3. LIGHTWEIGHT ORIENTATION MAP PREVIEW */}
              <div 
                id="orientation-map-preview-card"
                className="bg-[var(--surface-card)] rounded-3xl p-6 border border-[var(--border-subtle)] shadow-xl space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[var(--accent-secondary)]" />
                    <h4 className="chart-heading font-bold text-sm text-[var(--text-primary)]">
                      {t('spontaneous.nearYouOrientation')}
                    </h4>
                  </div>
                  <span className="text-[12px] text-[var(--text-secondary)]/50 font-medium">
                    {t('spontaneous.lighthouseBay')}
                  </span>
                </div>

                {/* Stylized lightweight schematic map */}
                <div className="h-44 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] relative overflow-hidden flex flex-col justify-between p-3">
                  {/* Sea background representation */}
                  <div className="absolute right-0 top-0 bottom-0 w-2/5 bg-[var(--surface-container)]/80 border-l border-teal-500/20 flex items-center justify-center">
                    <span className="text-[11px] font-extrabold text-teal-300/60 rotate-90">
                      {t('spontaneous.redSeaBay')}
                    </span>
                  </div>

                  {/* You are here marker */}
                  <div className="relative z-10 inline-flex items-center gap-1 bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--border-subtle)] px-2 py-1 rounded-full text-[11px] font-bold shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>{t('spontaneous.youAreHere1130')}</span>
                  </div>

                  {/* Landmarks representation */}
                  <div className="relative z-10 space-y-1 text-[11px]">
                    <div className="inline-flex items-center gap-1 bg-[var(--surface-card)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md font-bold text-[var(--text-primary)] shadow-sm">
                      <span className="inline-flex items-center gap-1"><CategoryIcon kind="coffee" className="w-3.5 h-3.5" /> {t('spontaneous.lighthouseCafe08km')}</span>
                    </div>
                    <br />
                    <div className="inline-flex items-center gap-1 bg-[var(--surface-card)] border border-[var(--border-subtle)] px-2 py-0.5 rounded-md font-bold text-[var(--text-primary)] shadow-sm">
                      <span className="inline-flex items-center gap-1"><CategoryIcon kind="food" className="w-3.5 h-3.5" /> {t('spontaneous.aliBabaLunch130')}</span>
                    </div>
                  </div>

                  <div className="relative z-10 text-[11px] text-[var(--text-secondary)]/60 bg-[var(--surface-card)]/80 backdrop-blur-xs px-2 py-0.5 rounded-md border border-white/5 self-start">
                    {t('spontaneous.allOptionsWithin510')}
                  </div>
                </div>
              </div>

            </div>

          </div>

        )}

      </main>

      {/* ============================================================ */}
      {/* TIME PROTECTION CONFIRMATION MODAL (For Adventure Option)    */}
      {/* ============================================================ */}
      {tightFitModalOption && (
        <div 
          dir={isRTL ? 'rtl' : 'ltr'}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div 
            className="bg-[var(--surface-card)] rounded-3xl max-w-md w-full p-6 sm:p-7 border border-[var(--border-subtle)] shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-[var(--text-primary)]"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3.5">
              <div className="flex items-center gap-2 text-amber-400">
                <AlertCircle className="w-5 h-5" />
                <h3 className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                  {t('spontaneous.thisFitsButItll')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTightFitModalOption(null)}
                className="w-8 h-8 rounded-full bg-[var(--surface-card)]/5 hover:bg-[var(--surface-card)]/10 flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[var(--text-secondary)]/80">
              <p className="leading-relaxed">
                {t('spontaneous.youSelectedTimeline', { title: language === 'ar' ? tightFitModalOption.titleAr : tightFitModalOption.title })}
              </p>

              <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
                <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                  <span className="inline-flex items-center gap-1.5"><CategoryIcon kind="dive" className="w-4 h-4" /> {t('spontaneous.snorkeling')}</span>
                  <span className="font-mono text-[var(--accent-secondary)]">12:00 PM – 01:15 PM</span>
                </div>
                <div className="flex items-center justify-between font-bold text-emerald-300 pt-1 border-t border-[var(--border-subtle)]">
                  <span className="inline-flex items-center gap-1.5"><CategoryIcon kind="food" className="w-4 h-4" /> {t('spontaneous.lunchByTheBay-3')}</span>
                  <span className="font-mono text-emerald-300">01:30 PM</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/30">
                <span className="font-bold block">⏱ {t('spontaneous.buffer15Minutes')}</span>
                <p className="text-[12px] leading-relaxed pt-0.5 text-amber-200/90">
                  {t('spontaneous.youllHaveAbout15')}
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
              <button
                type="button"
                id="add-anyway-btn"
                onClick={() => commitAddToTrip(tightFitModalOption)}
                className="w-full sm:flex-1 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                {t('spontaneous.addAnyway')}
              </button>

              <button
                type="button"
                id="choose-something-easier-btn"
                onClick={() => {
                  setTightFitModalOption(null);
                  setSelectedOptionId('opt-chill');
                }}
                className="w-full sm:flex-1 py-2.5 rounded-full bg-[var(--surface-container)] hover:bg-[var(--surface-card)]/10 text-[var(--text-primary)] font-bold text-xs border border-[var(--border-subtle)] transition-colors cursor-pointer"
              >
                {t('spontaneous.chooseSomethingEasier')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div 
          role="status" 
          aria-live="polite"
          className="fixed bottom-20 md:bottom-8 right-4 sm:right-8 bg-[var(--surface-card)] text-[var(--text-primary)] border border-[var(--border-subtle)] px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2.5 z-50 animate-in slide-in-from-bottom-2 duration-150 backdrop-blur-md"
        >
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)] flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
};
