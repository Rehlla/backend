import React, { useState, useEffect, useMemo } from 'react';
import { formatPrice } from '../../lib/format';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { analytics } from '../../services/analytics';
import { useApiResource } from '../../hooks/useApiResource';
import {
  resolveExperience,
  relatedActivityExperiences,
  CURATED_EXPERIENCES,
  ExperienceDetailData
} from '../../services/experienceService';
import { ExperienceBookingSheet, readBookingDraft, type ExperienceBookingDraft } from './ExperienceBookingSheet';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Zap,
  Coffee,
  Calendar,
  Clock,
  CheckCircle2,
  Sliders,
  Sparkles,
  MapPin,
  Compass,
  Star,
  Layers,
  ChevronRight,
  ChevronLeft,
  Users,
  Check,
  Heart,
  Share2,
  Navigation,
  Wind,
  Droplets,
  Eye,
  Plus,
  Search,
  ExternalLink
} from 'lucide-react';

const fetchCorpus = (signal: AbortSignal) =>
  Promise.all([
    api.getDahabActivities(signal).catch(() => ({ activities: [] })),
    api.getDahabPlaces(signal).catch(() => ({ places: [] }))
  ]).then(([activities, places]) => ({
    activities: activities.activities,
    places: places.places
  }));

export const ExperienceDetailView: React.FC = () => {
  const {
    selectedExperienceSlug,
    navigateTo,
    addActivityToDay,
    showToast,
    isSignedIn
  } = useTrip();

  const { language, t, isRTL } = useLanguage();
  const { isDark } = useTheme();

  const corpus = useApiResource(fetchCorpus);

  // Resolve current active experience or return null for not found
  const activeExperience: ExperienceDetailData | null = useMemo(() => {
    return resolveExperience(
      selectedExperienceSlug,
      corpus.data?.activities || [],
      corpus.data?.places || []
    );
  }, [selectedExperienceSlug, corpus.data]);

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [selectedDayNumber, setSelectedDayNumber] = useState<number>(2);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<'morning' | 'afternoon' | 'sunset' | 'evening'>('morning');
  const [isSavedFavorite, setIsSavedFavorite] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [bookingOpen, setBookingOpen] = useState<boolean>(false);
  const [bookingDraft, setBookingDraft] = useState<ExperienceBookingDraft | null>(null);

  // Back from signing in mid-booking: reopen the sheet with what was chosen.
  useEffect(() => {
    if (!activeExperience?.bookable || !isSignedIn) return;
    const draft = readBookingDraft(activeExperience.slug);
    if (draft) {
      setBookingDraft(draft);
      setBookingOpen(true);
    }
  }, [activeExperience?.slug, Boolean(activeExperience?.bookable), isSignedIn]);

  // Scroll to top on slug change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (activeExperience) {
      analytics.track('trip_entry_viewed', {
        sourceMode: `experience_detail:${activeExperience.slug}`
      } as any);
    }
  }, [activeExperience?.id]);

  /**
   * The commerce product behind this experience, or null when it cannot be sold
   * online.
   *
   * The price here is the SKU's, which is the amount checkout charges — it is
   * not always `basePriceEGP` from the editorial record. The Blue Hole day is
   * written up at 2,200 EGP in the corpus and sells for 3,400.
   */
  const bookable = activeExperience?.bookable ?? null;

  const displayPriceEGP = bookable?.basePriceEGP ?? activeExperience?.basePriceEGP ?? 0;

  const scheduledTime =
    selectedTimeSlot === 'morning'
      ? '09:00 AM'
      : selectedTimeSlot === 'afternoon'
      ? '02:00 PM'
      : selectedTimeSlot === 'sunset'
      ? '05:00 PM'
      : '08:00 PM';

  // Handle Add to Itinerary
  const handleAddToItinerary = async () => {
    if (!activeExperience || isAdding) return;

    setIsAdding(true);
    try {
      // addActivityToDay owns the outcome message now — it is the only caller
      // that knows whether the write actually reached the server. This used to
      // announce success here as well, so a failed save produced two toasts
      // both claiming it had worked.
      await addActivityToDay(selectedDayNumber, {
        id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: language === 'ar' ? activeExperience.titleAr : activeExperience.titleEn,
        time: scheduledTime,
        type:
          activeExperience.category === 'diving'
            ? 'Activity'
            : activeExperience.category === 'food' || activeExperience.category === 'coffee'
            ? 'Dining'
            : 'Exploration',
        status: bookable ? 'Suggested' : 'Added ✓',
        // Carried so this line can be booked later from the trip timeline.
        skuId: bookable?.skuId,
        serviceType: bookable?.serviceType,
        priceEGP: displayPriceEGP,
        location: language === 'ar' ? activeExperience.locationAr : activeExperience.locationEn,
        notes: `${activeExperience.durationEn} · ${displayPriceEGP} EGP`
      });
    } finally {
      setIsAdding(false);
    }
  };

  /**
   * Books this experience in place: day, departure, party and contact in one
   * sheet, settled through the same held checkout as Book Now. It used to hand
   * off to Book Now, which only sells for today and forgot the product across
   * a sign-in.
   */
  const handleBookNow = () => {
    if (!activeExperience || !bookable) return;
    setBookingDraft(null);
    setBookingOpen(true);
  };

  // Handle Share URL
  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      showToast(t('experiences.linkCopiedToClipboard'));
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  // Handle Favorite toggle
  const handleToggleFavorite = () => {
    setIsSavedFavorite((prev) => !prev);
    showToast(
      !isSavedFavorite
        ? (t('experiences.addedToFavorites'))
        : (t('experiences.removedFromFavorites'))
    );
  };

  // Related experiences: bookable ones from the live catalogue, falling back
  // to the editorial picks while it loads or if it is unavailable.
  const relatedExperiences = useMemo(() => {
    if (!activeExperience) return [];
    const fromCatalogue = relatedActivityExperiences(
      activeExperience,
      corpus.data?.activities || [],
      corpus.data?.places || []
    );
    if (fromCatalogue.length > 0) return fromCatalogue;
    return CURATED_EXPERIENCES.filter((exp) => exp.id !== activeExperience.id).slice(0, 3);
  }, [activeExperience, corpus.data]);

  if (!activeExperience && (corpus.status === 'loading' || corpus.status === 'idle')) {
    return (
      <div className="min-h-screen bg-[var(--surface-card)]" aria-busy="true">
        <div className="h-[460px] sm:h-[520px] w-full animate-pulse bg-stone-900" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 space-y-4">
          <div className="h-6 w-1/3 animate-pulse rounded-full bg-[var(--surface-container)]" />
          <div className="h-24 w-full animate-pulse rounded-3xl bg-[var(--surface-container)]" />
        </div>
      </div>
    );
  }

  // =========================================================================
  // NOT FOUND STATE (Never silently load random items)
  // =========================================================================
  if (!activeExperience) {
    return (
      <div
        id="experience-not-found-screen"
        className={`min-h-screen py-24 px-4 flex flex-col items-center justify-center text-center transition-colors ${
          'bg-[var(--surface-card)] text-[var(--text-primary)]'
        }`}
        dir={isRTL ? 'rtl' : 'ltr'}
      >
        <div className="max-w-md w-full p-8 rounded-3xl border shadow-xl space-y-6 bg-[var(--btn-util-bg)] backdrop-blur-md">
          <div className="w-16 h-16 rounded-3xl bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] flex items-center justify-center mx-auto shadow-inner">
            <Compass className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-3xl sm:text-4xl font-semibold text-balance">
              {t('experienceDetail.notFoundTitle')}
            </h1>
            <p className={`text-xs sm:text-sm leading-relaxed ${'text-[var(--text-secondary)]/70'}`}>
              {t('experienceDetail.notFoundDesc')}
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              id="not-found-back-to-explore-btn"
              onClick={() => navigateTo('/explore')}
              className="w-full py-3.5 px-6 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              <span>{t('experienceDetail.browseAll')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`experience-detail-${activeExperience.slug}`}
      className={`min-h-screen pb-32 transition-colors duration-300 ${
        'bg-[var(--surface-card)] text-[var(--text-primary)]'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. TOP BREADCRUMB & WAYFINDING NAVIGATION */}
      <nav
        aria-label="Breadcrumb navigation"
        className="border-b sticky top-16 sm:top-20 z-30 backdrop-blur-xl transition-colors bg-[var(--surface-card)]/85 border-[var(--border-subtle)] text-[var(--text-secondary)]"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <button
              type="button"
              id="breadcrumb-home-btn"
              onClick={() => navigateTo('/home')}
              className={`hover:underline cursor-pointer transition-colors py-2 -my-2 ${
                'hover:text-[var(--text-primary)]'
              }`}
            >
              {t('experienceDetail.breadcrumbHome')}
            </button>

            <span className="opacity-40">/</span>

            <button
              type="button"
              id="breadcrumb-explore-btn"
              onClick={() => navigateTo('/explore')}
              className={`hover:underline cursor-pointer transition-colors py-2 -my-2 ${
                'hover:text-[var(--text-primary)]'
              }`}
            >
              {t('experienceDetail.breadcrumbExplore')}
            </button>

            <span className="opacity-40">/</span>

            <span className={`font-bold truncate max-w-[200px] sm:max-w-sm ${'text-[var(--accent-primary)]'}`}>
              {language === 'ar' ? activeExperience.titleAr : activeExperience.titleEn}
            </span>
          </div>

          {/* Actions: Share, Favorite, Back */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="share-experience-btn"
              onClick={handleShare}
              aria-label="Share experience"
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                isDark ? 'bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-secondary)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] hover:bg-stone-100 text-[var(--text-primary)] border-[var(--text-primary)]/10 shadow-xs'
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              id="favorite-experience-btn"
              onClick={handleToggleFavorite}
              aria-label="Save to favorites"
              className={`w-8 h-8 rounded-full border flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                isSavedFavorite
                  ? 'bg-rose-500 text-white border-rose-500'
                  : isDark
                  ? 'bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                  : 'bg-[var(--surface-card)] hover:bg-stone-100 text-[var(--text-primary)] border-[var(--text-primary)]/10 shadow-xs'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isSavedFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              id="back-to-explore-nav-btn"
              onClick={() => navigateTo('/explore')}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                isDark
                  ? 'bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                  : 'bg-[var(--surface-card)] hover:bg-stone-100 text-[var(--text-primary)] border-[var(--text-primary)]/15 shadow-xs'
              }`}
            >
              {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
              <span>{t('experienceDetail.backToExplore')}</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. FULL-WIDTH IMMERSIVE EDITORIAL HERO */}
      <section
        id="experience-hero"
        aria-label={language === 'ar' ? activeExperience.titleAr : activeExperience.titleEn}
        className="relative w-full overflow-hidden bg-stone-950 text-white min-h-[460px] sm:min-h-[520px] md:min-h-[580px] flex flex-col justify-end"
      >
        {/* Large Imagery Background */}
        <div className="absolute inset-0 z-0">
          <img
            src={activeExperience.heroImage}
            alt=""
            className="w-full h-full object-cover object-center opacity-75 filter saturate-[1.15] brightness-[0.85]"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/50 to-stone-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-stone-950/40" />
        </div>

        {/* Hero Content Overlay */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 sm:pb-16 w-full">
          <div className="max-w-3xl space-y-4 sm:space-y-5">
            
            {/* Badges & Trust Strip */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold bg-[var(--accent-secondary)] text-[var(--surface-card)] shadow-md">
                <Sparkles className="w-3.5 h-3.5 fill-[var(--surface-card)] text-[var(--surface-card)]" />
                <span>{language === 'ar' ? activeExperience.categoryLabelAr : activeExperience.categoryLabelEn}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[var(--btn-util-bg)] backdrop-blur-md text-white border border-[var(--border-subtle)]">
                <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{language === 'ar' ? activeExperience.durationAr : activeExperience.durationEn}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 backdrop-blur-md border border-emerald-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{language === 'ar' ? activeExperience.verifiedBadgeAr : activeExperience.verifiedBadgeEn}</span>
              </span>
            </div>

            {/* Title — always white: this hero is a fixed dark photo plate
                (bg-stone-950 + dark gradients) regardless of the site's active
                theme, so text-[var(--text-primary)] would turn near-black and
                vanish in light themes. Same bug class fixed on the homepage
                hero earlier — pin the hero's own text to white instead. */}
            <h1
              id="experience-title"
              className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white leading-[1.05] text-balance"
            >
              {language === 'ar' ? activeExperience.titleAr : activeExperience.titleEn}
            </h1>

            {/* Tagline */}
            <p className="text-base sm:text-lg md:text-xl text-white/75 font-normal leading-relaxed max-w-2xl">
              {language === 'ar' ? activeExperience.taglineAr : activeExperience.taglineEn}
            </p>

            {/* Location Pill */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-[var(--accent-primary)] font-medium pt-1">
              <MapPin className="w-4 h-4 flex-shrink-0 text-[var(--accent-primary)]" />
              <span className="text-white/90">{language === 'ar' ? activeExperience.locationAr : activeExperience.locationEn}</span>
            </div>

            {/* Price & Action Strip */}
            <div className="pt-3 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              
              {/* Pricing Box */}
              <div className="bg-black/50 backdrop-blur-md px-5 py-3 rounded-2xl border border-[var(--border-subtle)] inline-block self-start">
                <span className="text-[11px] font-bold text-white/70 block">
                  {!bookable
                    ? t('experienceDetail.startingPrice')
                    : (bookable.pricingBasis ?? 'per_person') === 'per_person'
                    ? t('experienceDetail.pricePerPerson')
                    : t('experienceDetail.pricePerGroup')}
                </span>
                <div className="text-2xl sm:text-3xl font-bold chart-heading text-[var(--accent-secondary)]">
                  {displayPriceEGP.toLocaleString()}{' '}
                  <span className="text-xs font-sans font-normal text-[var(--text-muted)]">EGP</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {bookable && (
                  <button
                    type="button"
                    id="hero-book-now-btn"
                    onClick={handleBookNow}
                    className="px-8 py-4 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] active:scale-[0.98] text-[var(--surface-card)] text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-[var(--surface-card)]" />
                    <span>{t('experienceDetail.bookNow')}</span>
                  </button>
                )}

                <button
                  type="button"
                  id="hero-add-to-trip-btn"
                  onClick={handleAddToItinerary}
                  disabled={isAdding}
                  className={`px-8 py-4 rounded-2xl active:scale-[0.98] text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer group/btn disabled:opacity-60 ${
                    bookable
                      ? 'bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white border border-[var(--border-subtle)] backdrop-blur-md'
                      : 'bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)]'
                  }`}
                >
                  <Plus className={`w-4 h-4 ${bookable ? 'text-white' : 'text-[var(--surface-card)]'}`} />
                  <span>{isAdding ? t('experienceDetail.adding') : t('experienceDetail.addToItinerary')}</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      </section>

      {/* 3. MAIN PAGE CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 space-y-16">
        
        {/* SECTION A: QUICK SPECIFICATIONS & SIGNALS GRID */}
        <section aria-labelledby="quick-facts-heading" className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />
            <h2
              id="quick-facts-heading"
              className={`text-xs font-extrabold ${'text-[var(--accent-primary)]'}`}
            >
              {t('experienceDetail.quickFactsTitle')}
            </h2>
          </div>

          {/* One unified strip with hairline dividers instead of four
              separately-bordered cards saying the same "I am a fact" thing
              four times in a row. */}
          <div className="grid grid-cols-1 lg:grid-cols-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] overflow-hidden divide-y lg:divide-y-0 lg:divide-x divide-[var(--border-subtle)]">
            {[
              { icon: Clock, color: 'text-[var(--accent-primary)]', label: t('experienceDetail.duration'), value: language === 'ar' ? activeExperience.durationAr : activeExperience.durationEn },
              { icon: Zap, color: 'text-[var(--brand-coral)]', label: t('experienceDetail.difficulty'), value: language === 'ar' ? activeExperience.difficultyAr : activeExperience.difficultyEn },
              { icon: Navigation, color: 'text-[var(--accent-primary)]', label: t('experienceDetail.accessMethod'), value: language === 'ar' ? activeExperience.accessMethodAr : activeExperience.accessMethodEn },
              { icon: Sparkles, color: 'text-[var(--accent-secondary)]', label: t('experienceDetail.optimalTime'), value: language === 'ar' ? activeExperience.openHoursAr : activeExperience.openHoursEn },
            ].map((fact) => (
              <div key={fact.label} className="flex items-center justify-between gap-3 p-5 sm:p-6">
                <div className={`flex items-center gap-2 ${fact.color}`}>
                  <fact.icon className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-bold text-[var(--text-secondary)]">{fact.label}</span>
                </div>
                <div className="text-base sm:text-lg font-bold text-[var(--text-primary)] truncate text-end">
                  {fact.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION B: OVERVIEW & LOCAL STORYTELLING */}
        <section aria-labelledby="story-heading" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Story (2 cols) */}
          <div className={`lg:col-span-2 p-8 sm:p-10 rounded-3xl border shadow-xl space-y-6 ${
            'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]'
          }`}>
            <div>
              <span className={`text-xs font-extrabold ${'text-[var(--accent-primary)]'}`}>
                {t('experienceDetail.overviewTitle')}
              </span>
              <h2 id="story-heading" className="text-2xl sm:text-3xl chart-heading font-bold mt-1">
                {t('experienceDetail.whyItFitsTitle')}
              </h2>
            </div>

            <p className={`text-sm sm:text-base leading-relaxed font-normal ${'text-[var(--text-secondary)]'}`}>
              {language === 'ar' ? activeExperience.descriptionAr : activeExperience.descriptionEn}
            </p>

            {/* Highlights Grid */}
            <div className="pt-4 border-t border-current/10 space-y-4">
              <h3 className="text-xs font-extrabold text-[var(--accent-secondary)]">
                {t('experienceDetail.highlightsTitle')}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(language === 'ar' ? activeExperience.highlightsAr : activeExperience.highlightsEn).map((h, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-2xl border text-xs sm:text-sm font-medium bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]"
                  >
                    <div className="w-5 h-5 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Local Guide Advice & Live Conditions (1 col) */}
          <div className="space-y-6">
            
            {/* Guide Note Card — the light-theme branch used to paint the
                background with var(--text-primary) (a near-black tone) while
                the text used the same variable, making the note invisible
                against its own background. Both themes now use the same
                surface-container treatment as every other card on the page. */}
            <div className="p-6 sm:p-7 rounded-3xl border shadow-md space-y-4 bg-[var(--surface-container)] border-[var(--accent-secondary)]/30 text-[var(--text-primary)]">
              <div className="flex items-center gap-2 text-[var(--accent-secondary)]">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-xs font-extrabold">
                  {t('experienceDetail.localGuideNote')}
                </h3>
              </div>
              <p className="text-xs sm:text-sm leading-relaxed font-medium">
                "{language === 'ar' ? activeExperience.localGuideInsightAr : activeExperience.localGuideInsightEn}"
              </p>
            </div>

            {activeExperience.conditionsEn && (
              <div className="p-6 sm:p-7 rounded-3xl border shadow-md space-y-4 bg-[var(--surface-card)] border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                  <Wind className="w-4 h-4" />
                  <h3 className="text-xs font-extrabold">{t('experienceDetail.conditionsTitle')}</h3>
                </div>
                <ul className="space-y-2.5 text-xs sm:text-sm">
                  {(language === 'ar' ? activeExperience.conditionsAr ?? [] : activeExperience.conditionsEn).map((line) => (
                    <li key={line} className="flex items-start gap-2.5 text-[var(--text-secondary)]">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-primary)]" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Environmental Signals Card */}
            {!activeExperience.conditionsEn && (
            <div className={`p-6 sm:p-7 rounded-3xl border shadow-md space-y-4 ${
              'bg-[var(--surface-card)] border-[var(--border-subtle)]'
            }`}>
              <div className="flex items-center gap-2 text-[var(--accent-primary)]">
                <Wind className="w-4 h-4" />
                <h3 className="text-xs font-extrabold">
                  {t('experienceDetail.environmentalSignals')}
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className={`p-3 rounded-2xl border ${'bg-[var(--surface-container)] border-[var(--border-subtle)]'}`}>
                  <span className={`block text-[10px] font-bold mb-0.5 ${'text-[var(--text-secondary)]'}`}>
                    {t('experienceDetail.waterTemp')}
                  </span>
                  <span className="font-bold text-[var(--accent-primary)]">{activeExperience.environmentalSignals.waterTemp}</span>
                </div>

                <div className={`p-3 rounded-2xl border ${'bg-[var(--surface-container)] border-[var(--border-subtle)]'}`}>
                  <span className={`block text-[10px] font-bold mb-0.5 ${'text-[var(--text-secondary)]'}`}>
                    {t('experienceDetail.visibility')}
                  </span>
                  <span className="font-bold text-[var(--accent-primary)]">{activeExperience.environmentalSignals.visibility}</span>
                </div>

                <div className={`p-3 rounded-2xl border col-span-2 ${'bg-[var(--surface-container)] border-[var(--border-subtle)]'}`}>
                  <span className={`block text-[10px] font-bold mb-0.5 ${'text-[var(--text-secondary)]'}`}>
                    {t('experienceDetail.windCondition')}
                  </span>
                  <span className="font-bold">{activeExperience.environmentalSignals.windCondition}</span>
                </div>
              </div>
            </div>
            )}

          </div>

        </section>

        {/* SECTION C: DAY SELECTOR & SCHEDULING INTERACTION */}
        <section aria-labelledby="schedule-heading" className={`p-8 sm:p-10 rounded-3xl border shadow-xl ${
          'bg-[var(--surface-card)] border-[var(--border-subtle)]'
        }`}>
          <div className="max-w-2xl space-y-6">
            <div>
              <div className="flex items-center gap-2 text-[var(--accent-primary)] mb-1">
                <Calendar className="w-4 h-4" />
                <span className={`text-xs font-extrabold ${'text-[var(--accent-primary)]'}`}>
                  {t('experienceDetail.selectDay')}
                </span>
              </div>
              <h2 id="schedule-heading" className="text-2xl sm:text-3xl chart-heading font-bold">
                {t('experiences.chooseWhichDayTo')}
              </h2>
            </div>

            {/* Day Selector Buttons */}
            <div className="space-y-2">
              <span className={`text-xs font-bold block ${'text-[var(--text-secondary)]'}`}>
                {t('experienceDetail.day')}:
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {[1, 2, 3, 4, 5].map((d) => (
                  <button
                    key={d}
                    type="button"
                    id={`day-select-btn-${d}`}
                    onClick={() => setSelectedDayNumber(d)}
                    className={`px-5 py-3 rounded-2xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer whitespace-nowrap shadow-xs ${
                      selectedDayNumber === d
                        ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] ring-2 ring-[var(--accent-secondary)]/30 scale-105'
                        : isDark
                        ? 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)]'
                        : 'bg-[var(--surface-container)] text-[var(--text-primary)] hover:bg-[var(--surface-container)] border border-[var(--text-primary)]/10'
                    }`}
                  >
                    {t('experiences.day0', { d })}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Slot Selector */}
            <div className="space-y-2">
              <span className={`text-xs font-bold block ${'text-[var(--text-secondary)]'}`}>
                {t('experienceDetail.timeSlot')}:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'morning', label: t('experienceDetail.morning') },
                  { id: 'afternoon', label: t('experienceDetail.afternoon') },
                  { id: 'sunset', label: t('experienceDetail.sunset') },
                  { id: 'evening', label: t('experienceDetail.evening') }
                ].map((slot) => (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setSelectedTimeSlot(slot.id as any)}
                    className={`p-3 rounded-2xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border text-center ${
                      selectedTimeSlot === slot.id
                        ? 'bg-[var(--accent-primary)] text-[var(--surface-card)] border-[var(--accent-primary)] shadow-sm'
                        : 'bg-[var(--surface-container)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:bg-[var(--surface-card)]'
                    }`}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add to Day CTA */}
            <div className="pt-4 space-y-3">
              <button
                type="button"
                id="schedule-confirm-add-btn"
                onClick={handleAddToItinerary}
                disabled={isAdding}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer active:scale-95 disabled:opacity-60"
              >
                <Plus className="w-4 h-4 text-[var(--surface-card)]" />
                <span>
                  {isAdding
                    ? t('experienceDetail.adding')
                    : t('experiences.addToDayIn', { selectedDayNumber })}
                </span>
              </button>

              {bookable && (
                <p className={`text-xs leading-relaxed ${'text-[var(--text-secondary)]/70'}`}>
                  {t('experienceDetail.addThenBookHint')}
                </p>
              )}
            </div>

          </div>
        </section>

        {/* SECTION C2: WHY THERE IS NO BOOK BUTTON */}
        {/*
          The alternative was a Book button that goes nowhere. Every id this
          catalogue used to carry as a `skuId` referenced inventory that does
          not exist (see server/services/bookabilityReconciler), so a page like
          this one either offers a real product or says it has none — the same
          rule the Book Now catalogue already applies to its own cards.
        */}
        {!bookable && (
          <section
            aria-labelledby="not-bookable-heading"
            className={`p-7 sm:p-8 rounded-3xl border shadow-md flex flex-col sm:flex-row sm:items-start gap-5 ${
              'bg-[var(--surface-container)] border-[var(--border-subtle)]'
            }`}
          >
            <div className="w-11 h-11 rounded-2xl bg-[var(--brand-coral)]/20 text-[var(--brand-coral)] flex items-center justify-center shrink-0">
              <Coffee className="w-5 h-5" />
            </div>

            <div className="space-y-2 flex-1 min-w-0">
              <h2
                id="not-bookable-heading"
                className={`text-base sm:text-lg chart-heading font-bold ${'text-[var(--text-primary)]'}`}
              >
                {t('experienceDetail.notBookableTitle')}
              </h2>
              <p className={`text-xs sm:text-sm leading-relaxed ${'text-[var(--text-secondary)]/70'}`}>
                {t('experienceDetail.notBookableBody')}
              </p>

              <button
                type="button"
                id="not-bookable-browse-bookable-btn"
                onClick={() => navigateTo('/book-now')}
                className="inline-flex items-center gap-1.5 pt-1 text-xs font-extrabold text-[var(--accent-primary)] hover:underline cursor-pointer"
              >
                <span>{t('experiences.seeWhatCanBe')}</span>
                <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>
          </section>
        )}

        {/* SECTION D: INCLUSIONS VS EXCLUSIONS */}
        <section aria-labelledby="inclusions-heading" className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-secondary)]" />
            <h2
              id="inclusions-heading"
              className={`text-xs font-extrabold ${'text-[var(--accent-secondary)]'}`}
            >
              {t('experiences.transparencyInclusions')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* What's Included */}
            <div className={`p-7 sm:p-8 rounded-3xl border shadow-xl ${
              isDark ? 'bg-[var(--surface-card)] border-emerald-500/20' : 'bg-[var(--surface-card)] border-emerald-900/15'
            }`}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-current/10">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-lg chart-heading font-bold ${'text-[var(--text-primary)]'}`}>
                    {t('experienceDetail.includedTitle')}
                  </h3>
                </div>
              </div>

              <ul className="space-y-3.5">
                {(language === 'ar' ? activeExperience.includedAr : activeExperience.includedEn).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className={'text-[var(--text-secondary)]'}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What's Not Included & Preparation Tips */}
            <div className={`p-7 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
              'bg-[var(--surface-card)] border-[var(--border-subtle)]'
            }`}>
              <div>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-current/10">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--brand-coral)]/20 text-[var(--brand-coral)] flex items-center justify-center shadow-sm">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-lg chart-heading font-bold ${'text-[var(--text-primary)]'}`}>
                      {t('experienceDetail.notIncludedTitle')}
                    </h3>
                  </div>
                </div>

                <ul className="space-y-3">
                  {(language === 'ar' ? activeExperience.notIncludedAr : activeExperience.notIncludedEn).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm font-medium opacity-85">
                      <div className="w-2 h-2 rounded-full bg-[var(--brand-coral)] mt-1.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Preparation Tips */}
              <div className="pt-4 border-t border-current/10">
                <h4 className="text-xs font-extrabold mb-2 text-[var(--accent-primary)]">
                  {t('experienceDetail.preparationTitle')}:
                </h4>
                <ul className="space-y-2 text-xs">
                  {(language === 'ar' ? activeExperience.preparationTipsAr : activeExperience.preparationTipsEn).map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[var(--accent-primary)] font-bold">•</span>
                      <span className={'text-[var(--text-secondary)]/70'}>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>

            </div>

          </div>
        </section>

        {/* SECTION E: RELATED EXPERIENCES RAIL */}
        {relatedExperiences.length > 0 && (
          <section aria-labelledby="related-heading" className={`pt-12 border-t ${'border-[var(--border-subtle)]'}`}>
            <div className="flex items-center justify-between gap-4 mb-8">
              <div>
                <span className={`text-xs font-extrabold ${'text-[var(--accent-primary)]'}`}>
                  {t('experienceDetail.breadcrumbExplore')}
                </span>
                <h2 id="related-heading" className="text-2xl sm:text-3xl chart-heading font-bold mt-1">
                  {t('experienceDetail.relatedTitle')}
                </h2>
              </div>

              <button
                type="button"
                id="related-browse-all-btn"
                onClick={() => navigateTo('/explore')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                  isDark ? 'bg-[var(--surface-container)] text-[var(--text-primary)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--text-primary)]/10'
                }`}
              >
                <span>{t('experiences.viewAll')}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedExperiences.map((rel) => (
                <button
                  key={rel.id}
                  type="button"
                  id={`related-exp-card-${rel.slug}`}
                  onClick={() => navigateTo('/experiences', { experienceSlug: rel.slug })}
                  className={`group text-start rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 flex flex-col justify-between overflow-hidden shadow-md hover:shadow-2xl cursor-pointer ${
                    isDark
                      ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)] text-[var(--text-primary)]'
                      : 'bg-[var(--surface-card)] border-[var(--text-primary)]/10 hover:border-[var(--text-primary)]/25 text-[var(--text-primary)]'
                  }`}
                >
                  <div className="relative h-44 bg-stone-900 overflow-hidden w-full">
                    <img
                      src={rel.heroImage}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-106 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                        {language === 'ar' ? rel.durationAr : rel.durationEn}
                      </span>
                      <h4 className="text-base chart-heading font-bold text-white leading-tight truncate mt-0.5">
                        {language === 'ar' ? rel.titleAr : rel.titleEn}
                      </h4>
                    </div>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <p className={`text-xs line-clamp-2 leading-relaxed ${'text-[var(--text-secondary)]'}`}>
                      {language === 'ar' ? rel.taglineAr : rel.taglineEn}
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-current/10">
                      <div>
                        <span className={`text-[10px] font-bold block ${'text-[var(--text-secondary)]'}`}>
                          {t('experienceDetail.startingPrice')}
                        </span>
                        <span className="text-sm font-bold chart-heading text-[var(--accent-secondary)]">
                          {(rel.bookable?.basePriceEGP ?? rel.basePriceEGP) ? formatPrice(rel.bookable?.basePriceEGP ?? rel.basePriceEGP, language === 'ar' ? 'ar' : 'en') : ''}
                        </span>
                      </div>

                      <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform rtl:rotate-180">
                        <span>{t('experiences.view')}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* 4. PERSISTENT STICKY BOTTOM CONVERSION BAR */}
      {/* P1-19: on <480px the bar is two rows — name+price, then two equal
          CTAs — instead of one row so squeezed that "reviews / hours /
          Beginner friendly" wrapped one word per line and overflowed. */}
      <div
        id="experience-sticky-bottom-bar"
        className="fixed bottom-0 inset-x-0 z-40 bg-black/85 backdrop-blur-xl border-t border-[var(--border-subtle)] text-white transition-transform"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="max-w-7xl mx-auto px-3 py-3 sm:px-4">
          {/* Row 1: identity only. The rating/duration meta stays in the page —
              cramming it here is what overflowed 375px. */}
          <div className="flex items-center justify-between gap-4 min-w-0">
            <span className="min-w-0 truncate text-[13px] font-medium text-[var(--text-muted)]">
              {language === 'ar' ? activeExperience.titleAr : activeExperience.titleEn}
            </span>
            <span dir="ltr" className="shrink-0 text-base sm:text-lg font-bold tabular-nums chart-heading text-[var(--accent-secondary)]">
              {language === 'ar'
                ? `${displayPriceEGP.toLocaleString('en-US')} ج.م`
                : `EGP ${displayPriceEGP.toLocaleString('en-US')}`}
            </span>
          </div>

          {/* Row 2: the two CTAs share the width equally on phones. */}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3 sm:flex sm:items-center sm:justify-end sm:gap-2.5">
            <button
              type="button"
              id="sticky-bar-add-btn"
              onClick={handleAddToItinerary}
              disabled={isAdding}
              className={`h-11 px-4 sm:px-6 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer active:scale-95 disabled:opacity-60 ${
                bookable
                  ? 'bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white border border-[var(--border-subtle)]'
                  : 'bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--dg-on-accent)]'
              }`}
            >
              <Plus className={`w-3.5 h-3.5 ${bookable ? 'text-white' : 'text-[var(--dg-on-accent)]'}`} />
              <span className="truncate">
                {t('experiences.addToDay', { selectedDayNumber })}
              </span>
            </button>

            {bookable && (
              <button
                type="button"
                id="sticky-bar-book-btn"
                onClick={handleBookNow}
                className="h-11 px-4 sm:px-8 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--dg-on-accent)] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer active:scale-95"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--dg-on-accent)]" />
                <span>{t('experienceDetail.bookNowShort')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {bookable && (
        <ExperienceBookingSheet
          key={`${activeExperience.slug}:${bookingDraft ? 'draft' : 'fresh'}`}
          experience={activeExperience}
          open={bookingOpen}
          onClose={() => {
            setBookingOpen(false);
            setBookingDraft(null);
          }}
          initialDraft={bookingDraft}
        />
      )}
    </div>
  );
};
