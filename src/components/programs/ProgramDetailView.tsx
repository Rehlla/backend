import React, { useState, useEffect } from 'react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useReadyProgrammes } from '../../hooks/useReadyProgrammes';
import { READY_TRIP_PROGRAMS, ReadyTripProgram } from '../../data/readyTripsData';
import { api } from '../../services/api';
import { analytics } from '../../services/analytics';
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
  Check
} from 'lucide-react';

export const ProgramDetailView: React.FC = () => {
  const {
    selectedProgramSlug,
    navigateTo,
    profile,
    updateProfile,
    isSignedIn,
    setIntendedRoute,
    showToast,
    openTrip
  } = useTrip();

  const { language, t, isRTL } = useLanguage();
  const { isDark } = useTheme();

  // Served programmes from API with offline fallback
  const programmes = useReadyProgrammes();

  // Resolve current active program based on URL slug or fallback
  const activeProgram: ReadyTripProgram =
    programmes.find((p) => p.id === selectedProgramSlug) ||
    READY_TRIP_PROGRAMS.find((p) => p.id === selectedProgramSlug) ||
    programmes[0] ||
    READY_TRIP_PROGRAMS[0];

  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(0);
  const [isStartingTrip, setIsStartingTrip] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Scroll to top when active program changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSelectedDayIdx(0);
    setActionError(null);

    analytics.track('ready_trip_previewed', {
      templateId: activeProgram.id,
      durationDays: activeProgram.durationDays,
      budget: activeProgram.defaultBudget
    });
  }, [activeProgram.id]);

  const activeDay = activeProgram.dayByDay[selectedDayIdx] || activeProgram.dayByDay[0];

  // Handle "Start This Trip" action
  const handleStartTrip = async () => {
    analytics.track('ready_trip_started', {
      templateId: activeProgram.id,
      durationDays: activeProgram.durationDays,
      budget: activeProgram.defaultBudget
    });

    if (!isSignedIn) {
      setIntendedRoute(`/programs/${activeProgram.id}`);
      showToast(
        t('programs.signInSoWe')
      );
      navigateTo('/auth/sign-in');
      return;
    }

    setActionError(null);
    setIsStartingTrip(true);
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() + 1);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + activeProgram.durationDays - 1);
      const iso = (d: Date) => d.toISOString().split('T')[0];

      const { trip } = await api.saveTrip({
        id: `TRIP-${activeProgram.id.toUpperCase()}-${Date.now()}`,
        title: language === 'ar' ? activeProgram.titleAr : activeProgram.title,
        status: 'PLANNED',
        lengthDays: activeProgram.durationDays,
        travelersCount: profile.travelersCount || 2,
        budget: activeProgram.defaultBudget,
        pace: activeProgram.pace,
        interests: activeProgram.defaultInterests,
        startDate: iso(startDate),
        endDate: iso(endDate),
        totalEstimatedEGP: activeProgram.startingPriceEGP,
        totalPaidEGP: 0
      });

      openTrip(trip.id);
      showToast(
        t('programs.addedToTrips', { title: language === 'ar' ? activeProgram.titleAr : trip.title })
      );
      navigateTo('/my-trip');
    } catch (err: any) {
      setActionError(
        t('programs.couldNotBeAdded', { message: err?.message || '' })
      );
    } finally {
      setIsStartingTrip(false);
    }
  };

  // Handle "Customize" action
  const handleCustomizeTrip = () => {
    analytics.track('ready_trip_customized', {
      templateId: activeProgram.id,
      durationDays: activeProgram.durationDays,
      budget: activeProgram.defaultBudget
    });

    updateProfile({
      lengthDays: activeProgram.durationDays,
      budget: activeProgram.defaultBudget,
      interests: activeProgram.defaultInterests,
      pace: activeProgram.pace
    });

    navigateTo('/trip-preview');
  };

  // Other programs excluding current
  const otherPrograms = programmes.filter((p) => p.id !== activeProgram.id);

  return (
    <div
      id="program-detail-page"
      className={`min-h-screen pb-28 transition-colors duration-300 ${
        'bg-[var(--surface-card)] text-[var(--text-primary)]'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* 1. TOP BREADCRUMB & WAYFINDING BAR */}
      <nav
        aria-label="Breadcrumb navigation"
        className={`border-b sticky top-16 sm:top-20 z-30 backdrop-blur-xl transition-colors bg-[var(--surface-card)]/85 border-[var(--border-subtle)] text-[var(--text-secondary)]`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4 text-xs font-semibold">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="back-to-home-link"
              onClick={() => navigateTo('/home')}
              className={`inline-flex items-center gap-1.5 transition-colors hover:underline cursor-pointer py-2 -my-2 ${
                'hover:text-[var(--text-primary)]'
              }`}
            >
              {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              <span>{t('programPage.breadcrumbHome')}</span>
            </button>

            <span className="opacity-40">/</span>

            <button
              type="button"
              id="back-to-ready-trips-link"
              onClick={() => {
                navigateTo('/home');
                setTimeout(() => {
                  const el = document.getElementById('ready-made-trips-subdeck');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className={`transition-colors hover:underline cursor-pointer py-2 -my-2 ${
                'hover:text-[var(--text-primary)]'
              }`}
            >
              {t('programPage.breadcrumbReady')}
            </button>

            <span className="opacity-40">/</span>

            <span className={`font-bold truncate max-w-[200px] sm:max-w-xs text-[var(--accent-primary)]`}>
              {language === 'ar' ? activeProgram.titleAr : activeProgram.title}
            </span>
          </div>

          {/* Quick Share / Back CTA */}
          <button
            type="button"
            id="back-to-discovery-top-btn"
            onClick={() => navigateTo('/home')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
              isDark
                ? 'bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] border-[var(--border-subtle)]'
                : 'bg-[var(--surface-card)] hover:bg-stone-100 text-[var(--text-primary)] border-[var(--text-primary)]/15 shadow-xs'
            }`}
          >
            {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            <span>{t('programPage.backToDiscovery')}</span>
          </button>
        </div>
      </nav>

      {/* 2. FULL-WIDTH EDITORIAL HERO */}
      <section
        id="program-editorial-hero"
        aria-label={language === 'ar' ? activeProgram.titleAr : activeProgram.title}
        className="relative w-full overflow-hidden bg-stone-950 text-white min-h-[480px] md:min-h-[560px] lg:min-h-[620px] flex flex-col justify-end"
      >
        {/* Large Imagery Background */}
        <div className="absolute inset-0 z-0">
          <img
            src={activeProgram.heroImage}
            alt={activeProgram.title}
            className="w-full h-full object-cover object-center opacity-70 filter saturate-[1.15] brightness-[0.85] transform scale-100 hover:scale-102 transition-transform duration-1000 ease-out"
            referrerPolicy="no-referrer"
          />
          {/* Subtle multi-stop gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/20" />
          <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-stone-950/40" />
        </div>

        {/* Hero Content Overlay */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-12 sm:pb-16 w-full">
          <div className="max-w-3xl space-y-4 sm:space-y-6">
            
            {/* Badges & Trust Strip */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold bg-[var(--accent-secondary)] text-[var(--surface-card)] shadow-md">
                <Star className="w-3.5 h-3.5 fill-[var(--surface-card)] text-[var(--surface-card)]" />
                <span>{language === 'ar' ? activeProgram.badgeAr : activeProgram.badge}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-[var(--btn-util-bg)] backdrop-blur-md text-white border border-[var(--border-subtle)]">
                <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>
                  {activeProgram.durationDays} {t('programs.days')} · {language === 'ar' ? activeProgram.paceAr : activeProgram.pace}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 backdrop-blur-md border border-emerald-400/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('programPage.verifiedGuides')}</span>
              </span>
            </div>

            {/* Program Title — pinned white: fixed dark photo plate */}
            <h1
              id="program-title"
              className="font-display text-4xl sm:text-5xl md:text-6xl font-semibold tracking-tight text-white leading-[1.05] text-balance"
            >
              {language === 'ar' ? activeProgram.titleAr : activeProgram.title}
            </h1>

            {/* Tagline / Subtitle */}
            <p className="text-base sm:text-xl text-white/75 font-normal leading-relaxed max-w-2xl">
              {language === 'ar' ? activeProgram.taglineAr : activeProgram.tagline}
            </p>

            {/* Price & Primary Call to Action Strip */}
            <div className="pt-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              
              {/* Pricing Box */}
              <div className="bg-black/50 backdrop-blur-md px-5 py-3 rounded-2xl border border-[var(--border-subtle)] inline-block self-start">
                <span className="text-[11px] font-bold text-[var(--text-secondary)]/80 block">
                  {t('programPage.startingFrom')}
                </span>
                <div className="text-2xl sm:text-3xl font-bold chart-heading text-[var(--accent-secondary)]">
                  {activeProgram.startingPriceEGP.toLocaleString()}{' '}
                  <span className="text-xs font-sans font-normal text-[var(--text-muted)]">
                    EGP / {t('programs.person')}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Primary CTA: Start This Trip */}
                <button
                  type="button"
                  id="program-hero-start-trip-btn"
                  onClick={handleStartTrip}
                  disabled={isStartingTrip}
                  className="px-8 py-4 rounded-2xl bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] active:scale-[0.98] text-[var(--surface-card)] text-sm font-extrabold flex items-center justify-center gap-2.5 shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer group/btn"
                >
                  <span>{isStartingTrip ? (t('programs.starting')) : t('programPage.startThisTrip')}</span>
                  <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform rtl:rotate-180 text-[var(--surface-card)]" />
                </button>

                {/* Secondary CTA: Customize */}
                <button
                  type="button"
                  id="program-hero-customize-btn"
                  onClick={handleCustomizeTrip}
                  className="px-6 py-4 rounded-2xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] active:scale-[0.98] backdrop-blur-md text-[var(--text-primary)] text-sm font-bold border border-[var(--border-subtle)] flex items-center justify-center gap-2 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                >
                  <Sliders className="w-4 h-4 text-[var(--accent-primary)]" />
                  <span>{t('programPage.customizeThisTrip')}</span>
                </button>
              </div>

            </div>

            {actionError && (
              <div role="alert" className="mt-4 p-4 rounded-2xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-sm">
                {actionError}
              </div>
            )}

          </div>
        </div>
      </section>

      {/* 3. MAIN PAGE CONTENT CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 space-y-16">

        {/* SECTION A: PROGRAM FIT, PACING & INTENSITY GAUGES */}
        <section aria-labelledby="program-fit-heading" className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />
            <h2
              id="program-fit-heading"
              className={`text-xs font-extrabold text-[var(--accent-primary)]`}
            >
              {t('programPage.overviewTitle')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Ideal For Card */}
            <div className={`p-6 sm:p-7 rounded-3xl border shadow-md flex flex-col justify-between ${
              'bg-[var(--surface-card)] border-[var(--border-subtle)]'
            }`}>
              <div>
                <span className={`text-[11px] font-bold block mb-2 ${'text-[var(--text-secondary)]'}`}>
                  {t('programPage.whoIsThisFor')}
                </span>
                <h3 className={`text-xl chart-heading font-bold leading-snug mb-3 text-[var(--text-primary)]`}>
                  {language === 'ar' ? activeProgram.idealForAr : activeProgram.idealFor}
                </h3>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium text-[var(--accent-primary)] pt-4 border-t border-current/10">
                <Users className="w-4 h-4" />
                <span>{t('programs.designedForOptimalGroup')}</span>
              </div>
            </div>

            {/* Pacing & Intensity Gauges */}
            <div className={`p-6 sm:p-7 rounded-3xl border shadow-md space-y-5 ${
              'bg-[var(--surface-card)] border-[var(--border-subtle)]'
            }`}>
              <span className={`text-[11px] font-bold block ${'text-[var(--text-secondary)]'}`}>
                {t('programs.pacingIntensityBalance')}
              </span>

              {/* Activity Intensity */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[var(--brand-coral)]" />
                    <span>{t('readyTrip.intensity')}</span>
                  </span>
                  <span className={'text-[var(--text-primary)]'}>
                    Level {activeProgram.intensityScore} / 5
                  </span>
                </div>
                <div className="h-2 rounded-full bg-black/10 dark:bg-[var(--btn-util-bg)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--brand-coral)] transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500"
                    style={{ width: `${(activeProgram.intensityScore / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Free Relaxation Time */}
              <div>
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Coffee className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>{t('readyTrip.freeTime')}</span>
                  </span>
                  <span className="text-[var(--accent-primary)]">{activeProgram.freeTimeScore}% Open Relax</span>
                </div>
                <div className="h-2 rounded-full bg-black/10 dark:bg-[var(--btn-util-bg)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-500"
                    style={{ width: `${activeProgram.freeTimeScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Sinai Verified Guarantee Card */}
            <div className={`p-6 sm:p-7 rounded-3xl border shadow-md flex flex-col justify-between ${
              isDark ? 'bg-[var(--surface-container)] border-emerald-500/20 text-[var(--text-primary)]' : 'bg-emerald-50/70 border-emerald-900/15 text-[var(--text-primary)]'
            }`}>
              <div>
                <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                  <span className="text-xs font-extrabold">
                    {t('programs.sinaiLocalGuarantee')}
                  </span>
                </div>
                <p className="text-xs leading-relaxed font-medium mt-2">
                  {t('programPage.lockRates')}
                </p>
              </div>

              <div className="pt-4 border-t border-current/10 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {t('programPage.instantStart')}
              </div>
            </div>

          </div>
        </section>

        {/* SECTION B: DAY-BY-DAY ITINERARY PRESENTATION */}
        <section aria-labelledby="day-by-day-heading" className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-current/10">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Calendar className="w-4 h-4 text-[var(--accent-primary)]" />
                <span className={`text-xs font-extrabold text-[var(--accent-primary)]`}>
                  {t('programPage.daysScheduled')}
                </span>
              </div>
              <h2
                id="day-by-day-heading"
                className={`text-2xl sm:text-4xl chart-heading font-bold text-[var(--text-primary)]`}
              >
                {t('programPage.dayByDayTitle')}
              </h2>
            </div>

            <div className={`text-xs font-medium ${'text-[var(--text-secondary)]'}`}>
              {t('programs.dayOf', { idx: selectedDayIdx + 1, length: activeProgram.dayByDay.length })}
            </div>
          </div>

          {/* Day Selection Tabs */}
          <div className="flex items-center gap-3 overflow-x-auto pb-3 scrollbar-none">
            {activeProgram.dayByDay.map((day, idx) => {
              const isSelected = selectedDayIdx === idx;
              return (
                <button
                  key={day.day}
                  type="button"
                  id={`program-day-tab-${day.day}`}
                  onClick={() => setSelectedDayIdx(idx)}
                  className={`px-5 py-3 rounded-2xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer whitespace-nowrap flex items-center gap-2.5 shadow-sm ${
                    isSelected
                      ? 'bg-[var(--accent-primary)] text-[var(--surface-card)] ring-2 ring-[var(--accent-primary)]/30 scale-[1.02]'
                      : isDark
                      ? 'bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)] border border-[var(--border-subtle)]'
                      : 'bg-[var(--surface-card)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)] border border-[var(--text-primary)]/10'
                  }`}
                >
                  <span className="text-sm font-extrabold chart-heading">
                    {t('programs.dayZero', { day: day.day })}
                  </span>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-[var(--surface-card)]/20 text-[var(--surface-card)]'
                        : isDark
                        ? 'bg-[var(--surface-container)] text-[var(--text-secondary)]'
                        : 'bg-[var(--surface-container)] text-[var(--text-muted)]'
                    }`}
                  >
                    {day.tag}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Day Detail Editorial Showcase Card */}
          <div
            id={`program-active-day-card-${activeDay.day}`}
            className={`p-6 sm:p-10 rounded-3xl border shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 ${
              'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
          >
            {/* Active Day Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-current/10 gap-4">
              <div>
                <span className={`text-xs font-extrabold text-[var(--accent-primary)]`}>
                  {t('programs.dayFocusRhythm', { day: activeDay.day })}
                </span>
                <h3 className={`text-2xl sm:text-3xl chart-heading font-bold mt-1 text-[var(--text-primary)]`}>
                  {activeDay.title}
                </h3>
              </div>

              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold self-start sm:self-auto ${
                isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--accent-primary)]' : 'bg-[var(--surface-container)] border-[var(--text-primary)]/10 text-[var(--accent-primary)]'
              }`}>
                <Clock className="w-4 h-4" />
                <span>{activeDay.timeEstimate}</span>
              </div>
            </div>

            {/* Narrative Subtitle */}
            <p className={`text-sm sm:text-base leading-relaxed mb-8 max-w-3xl font-normal ${
              'text-[var(--text-secondary)]'
            }`}>
              {activeDay.subtitle}
            </p>

            {/* Highlights Grid */}
            <div>
              <h4 className={`text-xs font-extrabold mb-4 ${
                'text-[var(--text-secondary)]'
              }`}>
                {t('programs.curatedDayHighlights')}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {activeDay.highlights.map((highlight, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-3 p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] bg-[var(--surface-container)]/70 border-[var(--border-subtle)] hover:border-[var(--border-subtle)]`}
                  >
                    <div className="w-6 h-6 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium leading-snug">{highlight}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>

        {/* SECTION C: INCLUSIONS VS CUSTOMIZABILITY */}
        <section aria-labelledby="inclusions-heading" className="space-y-6">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-secondary)]" />
            <h2
              id="inclusions-heading"
              className={`text-xs font-extrabold ${'text-[var(--accent-secondary)]'}`}
            >
              {t('programs.transparentInclusionsCustomization')}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* What's Included Card */}
            <div className={`p-7 sm:p-8 rounded-3xl border shadow-xl ${
              'bg-[var(--surface-card)] border-[var(--accent-primary)]/20'
            }`}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-current/10">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-lg chart-heading font-bold text-[var(--text-primary)]`}>
                    {t('programPage.includedTitle')}
                  </h3>
                  <span className={`text-xs ${'text-[var(--text-secondary)]'}`}>
                    {t('programs.standardInThisCurated')}
                  </span>
                </div>
              </div>

              <ul className="space-y-3.5">
                {(language === 'ar' ? activeProgram.includedItemsAr : activeProgram.includedItems).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span className={'text-[var(--text-primary)]'}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What You Can Customize Card */}
            <div className={`p-7 sm:p-8 rounded-3xl border shadow-xl ${
              'bg-[var(--surface-card)] border-[var(--border-subtle)]'
            }`}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-current/10">
                <div className="w-10 h-10 rounded-2xl bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center shadow-sm">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`text-lg chart-heading font-bold text-[var(--text-primary)]`}>
                    {t('programPage.customizableTitle')}
                  </h3>
                  <span className={`text-xs ${'text-[var(--text-secondary)]'}`}>
                    {t('programs.adjustFreelyToMatch')}
                  </span>
                </div>
              </div>

              <ul className="space-y-3.5">
                {(language === 'ar' ? activeProgram.customizableItemsAr : activeProgram.customizableItems).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-xs sm:text-sm font-medium">
                    <div className="w-5 h-5 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className={'text-[var(--text-primary)]'}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </section>

        {/* SECTION D: OTHER CURATED READY-MADE TRIPS RAIL */}
        <section aria-labelledby="other-programs-heading" className={`pt-12 border-t ${
          'border-[var(--border-subtle)]'
        }`}>
          <div className="flex items-center justify-between gap-4 mb-8">
            <div>
              <span className={`text-xs font-extrabold text-[var(--accent-primary)]`}>
                {t('programPage.allFivePrograms')}
              </span>
              <h2
                id="other-programs-heading"
                className={`text-2xl sm:text-3xl chart-heading font-bold mt-1 text-[var(--text-primary)]`}
              >
                {t('programPage.exploreOtherPrograms')}
              </h2>
            </div>

            <button
              type="button"
              id="view-all-ready-trips-btn"
              onClick={() => {
                navigateTo('/home');
                setTimeout(() => {
                  const el = document.getElementById('ready-made-trips-subdeck');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }, 100);
              }}
              className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                'bg-[var(--surface-container)] text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              <span>{t('experiences.viewAll')}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {otherPrograms.map((prog) => (
              <button
                key={prog.id}
                type="button"
                id={`other-program-card-${prog.id}`}
                onClick={() => navigateTo('/programs', { programSlug: prog.id })}
                className={`group text-start rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 flex flex-col justify-between overflow-hidden shadow-md hover:shadow-2xl cursor-pointer ${
                  isDark
                    ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)] text-[var(--text-primary)]'
                    : 'bg-[var(--surface-card)] border-[var(--text-primary)]/10 hover:border-[var(--text-primary)]/25 text-[var(--text-primary)]'
                }`}
              >
                <div className="relative h-40 bg-stone-900 overflow-hidden w-full">
                  <img
                    src={prog.heroImage}
                    alt={prog.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="text-[11px] font-semibold text-[var(--accent-primary)]">
                      {prog.durationDays} {t('home.days-3')} · {language === 'ar' ? prog.paceAr : prog.pace}
                    </span>
                    <h4 className="text-sm chart-heading font-bold text-white leading-tight truncate mt-0.5">
                      {language === 'ar' ? prog.titleAr : prog.title}
                    </h4>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <p className={`text-xs line-clamp-2 leading-relaxed text-[var(--text-secondary)]`}>
                    {language === 'ar' ? prog.taglineAr : prog.tagline}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-current/10">
                    <div>
                      <span className={`text-[10px] font-bold block ${'text-[var(--text-secondary)]'}`}>
                        {t('programPage.startingFrom')}
                      </span>
                      <span className={`text-xs font-bold chart-heading text-[var(--accent-secondary)]`}>
                        {prog.startingPriceEGP.toLocaleString()} EGP
                      </span>
                    </div>

                    <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform rtl:rotate-180">
                      <span>{t('programPage.viewOtherProgram')}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

      </main>

      {/* 4. PERSISTENT STICKY BOTTOM CONVERSION BAR */}
      <div
        id="program-bottom-sticky-bar"
        className="fixed bottom-0 inset-x-0 z-40 p-3 sm:p-4 bg-black/80 backdrop-blur-xl border-t border-[var(--border-subtle)] text-white transition-transform"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Price & Summary Info */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <span className="text-[11px] text-[var(--text-muted)] block">
                {language === 'ar' ? activeProgram.titleAr : activeProgram.title}
              </span>
              <div className="text-lg font-bold chart-heading text-[var(--accent-secondary)]">
                {activeProgram.startingPriceEGP.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)]">EGP / {t('programs.person-2')}</span>
              </div>
            </div>
            <div className="sm:hidden">
              <div className="text-base font-bold chart-heading text-[var(--accent-secondary)]">
                {activeProgram.startingPriceEGP.toLocaleString()} <span className="text-[11px] font-normal text-[var(--text-muted)]">EGP</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] block">
                {activeProgram.durationDays} {t('home.days-3')} · {language === 'ar' ? activeProgram.paceAr : activeProgram.pace}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              id="sticky-customize-btn"
              onClick={handleCustomizeTrip}
              className="px-4 py-2.5 rounded-xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border border-[var(--border-subtle)]"
            >
              <span className="hidden sm:inline">{t('programPage.customizeThisTrip')}</span>
              <span className="sm:hidden">{t('readyTrip.customize')}</span>
            </button>

            <button
              type="button"
              id="sticky-start-trip-btn"
              onClick={handleStartTrip}
              disabled={isStartingTrip}
              className="px-6 py-2.5 rounded-xl bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--surface-card)] text-xs font-extrabold flex items-center gap-1.5 shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer active:scale-95"
            >
              <span>{isStartingTrip ? '...' : t('programPage.startThisTrip')}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </button>
          </div>

        </div>
      </div>

    </div>
  );
};
