import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Compass,
  Sun,
  Waves,
  Sparkles,
  ArrowRight,
  X,
  Pause,
  Play
} from 'lucide-react';
import { TravelerProfile } from '../../types';
import { CinematicVideo } from './CinematicVideo';
import { LivingChartHeroCanvas } from './LivingChartHeroCanvas';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { clampScrimOpacity } from '../../utils/heroOverlay';
import { useDahabTime } from '../../context/DahabTimeContext';import { api } from '../../services/api';

export interface CinematicScene {
  id: string;
  label: string;
  labelAr: string;
  subLabel: string;
  subLabelAr: string;
  location: string;
  locationAr: string;
  videoUrl: string;
  posterUrl: string;
  youtubeId: string;
  ambientTag: string;
  ambientTagAr: string;
  scheduledActivity: string;
  scheduledActivityAr: string;
  activityTime: string;
  activityTimeAr: string;
  activityLead: string;
  activityLeadAr: string;
  conditions: string;
  conditionsAr: string;
  shortTag: string;
  shortTagAr: string;
}

const CINEMATIC_SCENES: CinematicScene[] = [
  {
    id: 'reef',
    label: 'Coral Reef & Blue Hole',
    labelAr: 'شعاب المرجان والبلو هول',
    subLabel: 'World-famous vertical sinkhole and submarine wall',
    subLabelAr: 'الحفرة الزرقاء الأيقونية ومدخنة البيلز للغوص الحر',
    location: 'The Blue Hole & The Bells',
    locationAr: 'الثقب الأزرق (البلو هول) والبيلز',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-underwater-view-of-a-coral-reef-41544-large.mp4',
    posterUrl: '/images/hero/coral-reef-split.jpg',
    youtubeId: 'qjP4QdZKlns',
    ambientTag: '25m Coral Visibility · Peak Light',
    ambientTagAr: 'رؤية مرجانية نقية ٢٥م+ · ذروة الضوء',
    scheduledActivity: 'The Canyon & Blue Hole Guided Dive',
    scheduledActivityAr: 'غطسة استكشاف الكانيون والبلو هول (تانكين)',
    activityTime: '08:45 AM Briefing',
    activityTimeAr: '٠٨:٤٥ ص التوجيه والمعدات',
    activityLead: 'Master Diver Youssef',
    activityLeadAr: 'كابتن يوسف · غطاس محترف',
    conditions: 'Calm water · 24°C Sea · 0.3m Swell',
    shortTag: 'Reef',
    shortTagAr: 'ريف',
    conditionsAr: 'مياه هادئة · حرارة ٢٤°م · موج ٠.٣م',
  },
  {
    id: 'desert',
    label: 'Sinai Desert & Canyons',
    labelAr: 'صحراء سيناء ووادي قني',
    subLabel: 'Granite climbing cliffs and Bedouin Zarb dinners',
    subLabelAr: 'جبال الجرانيت الوردي وعشاء الزرب والسمر البدوي',
    location: 'Wadi Gnai Canyon',
    locationAr: 'واحة كانيون وادي قني',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-desert-dunes-under-a-blue-sky-40432-large.mp4',
    posterUrl: '/images/hero/camels-beach.jpg',
    youtubeId: '8y1g4q9hUe0',
    ambientTag: 'Wadi Gnai Granite Formations · Stargazing',
    ambientTagAr: 'جرانيت وادي قني · رصد مجرة درب التبانة',
    scheduledActivity: 'Sunset Rock Bouldering & Bedouin Feast',
    scheduledActivityAr: 'تسلق صخور الغروب وعشاء الزرب البدوي',
    activityTime: '04:30 PM Departure',
    activityTimeAr: '٠٤:٣٠ م الانطلاق بسيارة 4x4',
    activityLead: 'Guide Salem Al-Bedouin',
    activityLeadAr: 'المرشد سالم البدوي',
    conditions: 'Clear Night Sky · Zero Light Pollution',
    shortTag: 'Safari',
    shortTagAr: 'سفاري',
    conditionsAr: 'سماء صافية · انعدام تام للتلوث الضوئي',
  },
  {
    id: 'lagoon',
    label: 'Lagoon & Turquoise Coast',
    labelAr: 'اللاجونا والبحيرة الفيروزية',
    subLabel: 'Flat turquoise bay with world-class thermal winds',
    subLabelAr: 'مياه مسطحة دافئة ورياح حرارية مثالية للتزلج الشراعي',
    location: 'Dahab South Laguna & Blue Lagoon',
    locationAr: 'شاطئ اللاجونا الجنوبي والبلو لاجون',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-coming-to-the-beach-5016-large.mp4',
    posterUrl: '/images/hero/blue-lagoon-kitesurf.jpg',
    youtubeId: '9M7oV07_6mI',
    ambientTag: '18-Knot Thermal Wind · Flat Turquoise Waters',
    ambientTagAr: 'رياح حرارية ١٨ عقدة · مياه فيروزية مسطحة',
    scheduledActivity: 'Afternoon Kitesurfing & Wind Session',
    scheduledActivityAr: 'جلسة كايت سيرف وركوب أمواج اللاجونا',
    activityTime: '01:30 PM Wind Peak',
    activityTimeAr: '٠١:٣٠ م ذروة قوة الرياح',
    activityLead: 'Kite Master Karim',
    activityLeadAr: 'كريم · مدرب شراع دولي',
    conditions: '18 Knots Steady NNE · Shallow Sand Spit',
    shortTag: 'Lagoon',
    shortTagAr: 'لاجونا',
    conditionsAr: '١٨ عقدة رياح شمالية شرقية · لسان رملي ضحل',
  },
  {
    id: 'sunset',
    label: 'Lighthouse Sunset & Promenade',
    labelAr: 'غروب اللايتهاوس والممشى',
    subLabel: 'Bohemian seaside cushions, habak tea & acoustic music',
    subLabelAr: 'وسائد الجلوس الشاطئية، شاي الحبق، وألوان الشفق',
    location: 'Lighthouse Promenade Bay',
    locationAr: 'ممشى وخليج اللايتهاوس',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-waves-coming-to-the-beach-5016-large.mp4',
    posterUrl: '/images/hero/boho-cafe-dreams.jpg',
    youtubeId: 'WkR_C7W248Y',
    ambientTag: 'Golden Twilight · Habak Tea · Arabian Gulf View',
    ambientTagAr: 'شفق ذهبي ساحر · شاي حبق · إطلالة خليج العقبة',
    scheduledActivity: 'Seaside Sunset Relax & Fresh Fish Dinner',
    scheduledActivityAr: 'استرخاء الغروب وعشاء المأكولات البحرية الطازجة',
    activityTime: '05:15 PM Sunset Glow',
    activityTimeAr: '٠٥:١٥ م توقيت الشفق الذهبي',
    activityLead: 'Chef Youssef Seafood House',
    activityLeadAr: 'مطعم أسماك اللايتهاوس الطازجة',
    conditions: 'Mild 25°C Evening Breeze',
    shortTag: 'Sunset',
    shortTagAr: 'غروب',
    conditionsAr: 'نسيم مسائي عليل ٢٥°م',
  },
  {
    id: 'summit',
    label: 'Mount Sinai & St. Catherine',
    labelAr: 'قمة جبل موسى وسانت كاترين',
    subLabel: 'Spiritual dawn summit at 2,285m and 6th-century monastery',
    subLabelAr: 'شروق الشمس الأسطوري من قمة سيناء ودير سانت كاترين',
    location: 'Mount Sinai Summit (2,285m)',
    locationAr: 'قمة جبل موسى (٢٢٨٥م)',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-desert-dunes-under-a-blue-sky-40432-large.mp4',
    posterUrl: '/images/hero/gulf-sunset.jpg',
    youtubeId: 'L_LUpnjgPso',
    ambientTag: '2,285m Altitude · Historic UNESCO Site',
    ambientTagAr: 'ارتفاع ٢٢٨٥م · موقع تراث عالمي لليونسكو',
    scheduledActivity: 'Overnight Trek & Summit Dawn Pilgrimage',
    scheduledActivityAr: 'صعود جبل موسى فجراً وزيارة دير سانت كاترين',
    activityTime: '02:00 AM Night Ascent',
    activityTimeAr: '٠٢:٠٠ ص بدء مسار الصعود الليلي',
    activityLead: 'Bedouin Mountain Tribe Guides',
    activityLeadAr: 'أدلاء قبيلة الجبل البدوية',
    conditions: 'Crisp 12°C Peak · Endless Horizon',
    shortTag: 'Summit',
    shortTagAr: 'قمة',
    conditionsAr: 'أجواء جبلية منعشة ١٢°م · أفق لا نهائي',
  },
];

const AUTO_SLIDE_INTERVAL = 7000; // 7 seconds — slower, more cinematic

interface CinematicVideoHeroProps {
  profile: TravelerProfile;
  onOpenMyTrip: () => void;
  onOpenExplore: () => void;
  onOpenFood: () => void;
  onOpenPlanner: () => void;
  /**
   * Hero heading/subtitle from the CMS homepage section (the dashboard's
   * Homepage tab edits it). When absent or when the CMS is unreachable, the
   * compiled translations below render — the page must not depend on the CMS
   * to show its thesis.
   */
  cmsHero?: { title_en: string; title_ar: string; config: Record<string, any> } | null;
  /**
   * Background scrim strength, 0–1 (default 1). The dashboard's Homepage tab
   * edits it as `overlay_opacity` (0–100) on the hero section config;
   * V2HomeCockpit converts via scrimOpacityFromConfig. Applied only to the
   * two gradient scrims — never the starfield.
   */
  scrimOpacity?: number;
}

export const CinematicVideoHero: React.FC<CinematicVideoHeroProps> = ({
  profile,
  onOpenMyTrip,
  onOpenExplore,
  onOpenFood,
  onOpenPlanner,
  cmsHero,
  scrimOpacity = 1,
}) => {
  const { language, isRTL , t} = useLanguage();
  const { theme, isDark } = useTheme();
  const { accentColor } = useDahabTime();
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [slideProgress, setSlideProgress] = useState(0);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Scroll scrub progress for the Living Chart layer (spec §5): how far the
  // hero has left the viewport, 0..1. The shader's sea shifts up to 20% of
  // the viewport as the traveler descends — the only pinned section.
  const heroRef = useRef<HTMLElement | null>(null);
  const [heroScroll, setHeroScroll] = useState(0);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = heroRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight;
      if (total <= 0) return;
      // 0 while the hero fills the viewport, 1 once it has fully scrolled past.
      const progress = Math.min(1, Math.max(0, (window.innerHeight - rect.top) / total));
      setHeroScroll(progress);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const [liveConditions, setLiveConditions] = useState<{
    available?: boolean;
    airTemperatureC?: number;
    waterTemperatureC?: number | null;
    condition?: string;
    conditionAr?: string;
    astronomy?: { sunrise: string | null; sunset: string | null };
  } | null>(null);

  const autoSlideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.getWeatherTelemetry().then((data) => {
      if (isMounted && data) setLiveConditions(data);
    }).catch(() => { /* graceful fallback to nothing */ });
    return () => { isMounted = false; };
  }, []);

  const currentScene = CINEMATIC_SCENES[activeSceneIndex];

  // Defensive: the CMS value is clamped server-side and converted by
  // scrimOpacityFromConfig, but a stray NaN must never blank the scrims.
  const scrim = clampScrimOpacity(scrimOpacity);

  // CMS-authored heading wins when published; the compiled copy is the
  // fallback. Subtitle keys are 'subtitle_en'/'subtitle_ar' in the section
  // config when editors provide them, matching the dashboard's field names.
  const cmsTitle = language === 'ar'
    ? (cmsHero?.title_ar || '').trim()
    : (cmsHero?.title_en || '').trim();
  const cmsSubtitle = language === 'ar'
    ? (cmsHero?.config?.subtitle_ar || '').trim()
    : (cmsHero?.config?.subtitle_en || '').trim();

  const handleNextSlide = useCallback(() => {
    setActiveSceneIndex((prev) => (prev + 1) % CINEMATIC_SCENES.length);
    setSlideProgress(0);
  }, []);

  useEffect(() => {
    if (!isAutoPlaying) {
      setSlideProgress(0);
      return;
    }

    // No auto-advance for travelers who prefer reduced motion — the scenes
    // remain manually navigable, they just never move on their own.
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setSlideProgress(0);
      return;
    }

    const stepMs = 40;
    const increment = (stepMs / AUTO_SLIDE_INTERVAL) * 100;

    progressTimerRef.current = setInterval(() => {
      setSlideProgress((prev) => {
        if (prev >= 100) {
          handleNextSlide();
          return 0;
        }
        return prev + increment;
      });
    }, stepMs);

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isAutoPlaying, handleNextSlide]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (language === 'ar') {
      if (hour < 12) return 'صباح الخير والهدوء';
      if (hour < 18) return 'مساء الروقان والسكينة';
      return 'مساء النور والنجوم';
    }
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  // Chart scrims: LTR starts with night ink on the left; RTL flips
  const shoreDirection = isRTL ? 'bg-gradient-to-l' : 'bg-gradient-to-r';
  return (
    <section
      id="cinematic-hero-cockpit"
      ref={heroRef}
      aria-label="Dahab Cinematic Travel Cockpit & Slider"
      className="relative w-full min-h-[92vh] sm:min-h-[95vh] flex flex-col justify-between overflow-hidden select-none transition-colors duration-300 bg-[var(--bg-canvas)] text-[var(--text-primary)]"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ========================================================================= */}
      {/* 1. CINEMATIC BACKGROUND SCENE — the chart plate                          */}
      {/*    Video sits inside night scrims with a pinprick starfield: the sky    */}
      {/*    reads over every scene, and the 2,285m summit night is the home truth.  */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 z-0">
        {/* Living Chart layer (spec §5): GLSL dune/sea when WebGL exists,
            static gradient + starfield otherwise. The video stays mounted
            beneath it as the low-end fallback — when the shader is active
            the opaque canvas paints over the video (the Living Chart is the
            hero); without WebGL the canvas renders nothing and the approved
            cinematic hero shows instead. */}
        <CinematicVideo
          key={currentScene.id}
          poster={currentScene.posterUrl}
          alt={`Dahab scenery: ${language === 'ar' ? currentScene.labelAr : currentScene.label}`}
          isPlaying={isVideoPlaying}
          muted={isMuted}
          loop={true}
          autoPlay={true}
          playsInline={true}
          className="absolute inset-0 object-cover transition-opacity duration-1000"
          overlayClassName={
            isDark
              ? 'absolute inset-0 opacity-0'
              : 'absolute inset-0 opacity-0'
          }
          showOverlay={false}
        />
        <LivingChartHeroCanvas scrollProgress={heroScroll} className="absolute inset-0 w-full h-full opacity-[0.35]" />

        {/* Chart-plate scrims — tinted with the active theme's canvas color
            (dark navy ink in dark themes, warm sand/lagoon tone in light
            themes) so the overlaid text always keeps its intended contrast
            instead of assuming a permanently dark backdrop. */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${isRTL ? 'to left' : 'to right'}, color-mix(in oklab, var(--bg-canvas) 42%, transparent), color-mix(in oklab, var(--bg-canvas) 20%, transparent), color-mix(in oklab, var(--bg-canvas) 8%, transparent))`,
            opacity: scrim,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(to top, color-mix(in oklab, var(--bg-canvas) 42%, transparent), transparent, color-mix(in oklab, var(--bg-canvas) 18%, transparent))',
            opacity: scrim,
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 chart-starfield opacity-70 pointer-events-none" aria-hidden="true" />
        {/* Aurora UI mesh gradient overlay */}
        <div className="hero-aurora-overlay" aria-hidden="true" />
      </div>

      {/* ========================================================================= */}
      {/* 2. HERO CONTENT — one focal point: eyebrow, headline, subtitle, CTA.       */}
      {/*    The old top bar (greeting + time-phase chip + scene tabs) and the      */}
      {/*    right-side destinations panel are gone — scenes still cycle as an     */}
      {/*    ambient backdrop (handleNextSlide keeps firing on its timer), they    */}
      {/*    just no longer compete with the headline for attention. The same     */}
      {/*    destinations are one scroll away in the Landmarks section.           */}
      {/* ========================================================================= */}
      {/* Contour strata behind the headline plate — the chart's dune
          hairlines, drawn from the active theme (spec §2.1). */}
      <div className="absolute inset-0 z-[5] pointer-events-none contour-strata" aria-hidden="true" />

      <div className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-0 pb-44 sm:pb-0 my-auto flex flex-col items-start">
        {/* Tier-5 cinema glass — the one cinematic moment per viewport
            (spec §4.1, rarity budget). High Contrast Pro renders this as a
            solid plate via --glass-mode: solid. */}
        <div className="max-w-2xl w-full space-y-7 glass-cinema rounded-[28px] p-6 sm:p-8 -m-2 sm:-m-3">
          <div className="space-y-5">
            <div className="chart-rise-item inline-flex items-center gap-2 chart-glass px-3.5 py-1.5 rounded-full text-xs font-semibold text-[var(--text-primary)]">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accentColor }} aria-hidden="true" />
              <span>
                {profile.name
                  ? `${getGreeting()}, ${profile.name}`
                  : t('common.welcomeToDahab')}
              </span>
            </div>
            <h1 className="chart-rise-item text-5xl sm:text-6xl lg:text-7xl font-chart font-semibold tracking-tight leading-[1.03] text-[var(--text-primary)] text-balance" style={{ animationDelay: '90ms' }}>
              {cmsTitle || t('common.whereTheDesertMeets')}{' '}
              <span className="chart-heading-accent">{cmsTitle ? '' : t('common.theSea')}</span>
            </h1>
            <p className="chart-rise-item text-base sm:text-lg font-normal leading-relaxed max-w-xl text-[var(--text-secondary)]" style={{ animationDelay: '180ms' }}>
              {cmsSubtitle || (
                <>
                  {t('common.discoverAndBookYour')}{' '}
                  <strong className="font-semibold text-[var(--text-primary)]">{t('common.dahabSinaiJourney')}</strong>{' '}
                  {t('common.discoverAndBookYourPost')}
                </>
              )}
            </p>
          </div>

          {/* CTAs */}
          <div className="chart-rise-item pt-1 flex flex-wrap items-center gap-4" style={{ animationDelay: '260ms' }}>
            <button
              type="button"
              id="hero-start-trip-cta"
              onClick={onOpenPlanner}
                aria-label={t('common.planYourDahabTrip')}
              className="chart-cta-primary inline-flex items-center gap-3 text-sm active:scale-95 cursor-pointer group"
            >
              <Sparkles className="w-4 h-4 text-current" aria-hidden="true" />
              <span>{t('common.planYourDahabTrip')}</span>
              <ArrowRight className="w-4 h-4 text-current group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform rtl:rotate-180" />
            </button>

            <button
              type="button"
              id="hero-browse-experiences-cta"
              onClick={onOpenExplore}
                aria-label={t('common.browseExperiences')}
              className="chart-cta-secondary inline-flex items-center gap-2 text-sm cursor-pointer group"
            >
              <Compass className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
              <span>{t('common.browseExperiences')}</span>
            </button>
          </div>

          <div className="chart-rise-item flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-[var(--text-secondary)]" style={{ animationDelay: '340ms' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)]" />
              <span>{t('common.directVerifiedBookings')}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-secondary)]" />
              <span>{t('common.flexibleCancellation')}</span>
            </span>
            {liveConditions?.waterTemperatureC != null && (
              <span className="flex items-center gap-1.5">
                <Waves className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{Math.round(liveConditions.waterTemperatureC)}°C {t('common.waterTemp')}</span>
              </span>
            )}
            {liveConditions?.astronomy?.sunset && (
              <span className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
                <span>
                  {t('common.sunset')}{' '}
                  {new Date(liveConditions.astronomy.sunset).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Auto-slide pause/resume — the reduced-motion escape hatch made visible */}
      <button
        type="button"
        onClick={() => setIsAutoPlaying((v) => !v)}
        aria-label={t(isAutoPlaying ? 'a11y.pauseAutoplay' : 'a11y.resumeAutoplay')}
        aria-pressed={!isAutoPlaying}
        className="absolute bottom-5 end-5 z-20 w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 text-white hover:bg-black/70 flex items-center justify-center cursor-pointer transition-colors"
      >
        {isAutoPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
      </button>

      {/* ========================================================================= */}
      {/* 5. HERO VIDEO MODAL PLAYER                                                */}
      {/* ========================================================================= */}
      {isVideoModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('a11y.heroVideoPlayer')}
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-3 sm:p-6"
          onClick={() => setIsVideoModalOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full bg-[#0E171A] text-stone-100 rounded-3xl overflow-hidden border border-white/20 shadow-2xl flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-black/50">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">
                    {language === 'ar' ? currentScene.labelAr : currentScene.label} · 4K Ultra HD
                  </h4>
                  <p className="text-[12px] text-stone-400">
                    {language === 'ar' ? currentScene.locationAr : currentScene.location}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsVideoModalOpen(false)}
                className="min-w-[44px] min-h-[44px] rounded-full bg-[var(--surface-card)]/10 hover:bg-[var(--surface-card)]/20 text-white flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border border-[var(--border-subtle)]"
                aria-label={t('common.close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full aspect-video bg-black flex items-center justify-center">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${currentScene.youtubeId}?autoplay=1&rel=0&modestbranding=1&controls=1&iv_load_policy=3&fs=1`}
                title={language === 'ar' ? currentScene.labelAr : currentScene.label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
            {/*
              Video modal close via the X button only — clicking the backdrop
              also works. The film-scene call to open it lives inside the
              CinematicVideo control surface which we suppress in this layout;
              left intact for a11y/API compatibility.
            */}
          </div>
        </div>
      )}
    </section>
  );
};
