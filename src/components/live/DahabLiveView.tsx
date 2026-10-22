import React, { useState, useEffect } from 'react';
import {
  Waves,
  Sun,
  Wind,
  Eye,
  Compass,
  Clock,
  Sparkles,
  Fish,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  Share2,
  Calendar,
  Thermometer,
  ShieldCheck,
  Video,
  Play,
  Pause,
  Maximize2,
  Camera,
  Radio,
  RefreshCw
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { InternalPageHeader } from '../common/InternalPageHeader';
import { MarineConditions } from './MarineConditions';
import { api } from '../../services/api';
import { IMG_P1507525428034b723cf961d3e_HERO, IMG_P15103123056538ed496efae75_HERO, IMG_P154455176346a013bb70d5_HERO, IMG_P16826872200634742bd7fd538_HERO } from '../../shared/placeholderImagery';

interface LiveCameraFeed {
  id: string;
  spotId: string;
  name: string;
  nameAr: string;
  /**
   * Short label for the camera selector tabs. The tabs used to render
   * name.split(' ')[0], which turned "The Blue Hole Marine Sanctuary" and
   * "The Canyon & Bells Coast" both into "The" — two identical, meaningless
   * tabs the viewer could not tell apart.
   */
  shortName?: string;
  shortNameAr?: string;
  orientation: string;
  imageUrl: string;
  highlights: string;
  /**
   * The current reading, shared across the four spots because that is what the
   * source publishes — they are within a few kilometres of each other. Null
   * when the weather service could not be read.
   *
   * Removed with the camera network: `status: 'LIVE_STREAMING'`,
   * `resolution: '1080p 60fps'`, `streamType: 'HLS / Ultra-Low Latency'` and a
   * `currentViewers` count (42, 68, 55, 31) that never changed. Nothing here
   * streams video; every image is a stock photograph.
   */
  conditions: {
    windKnots: number;
    windDirection: string;
    waterTempC: number | null;
    airTempC: number;
  } | null;
}

export const DahabLiveView: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const isRtl = isRTL;
  const { navigateTo, showToast, profile, bookings, activeTrip } = useTrip();
  const [activeSpotTab, setActiveSpotTab] = useState<'all' | 'canyon' | 'bluehole' | 'lagoon' | 'lighthouse'>('all');
  const [selectedCameraId, setSelectedCameraId] = useState<string>('cam-lighthouse');
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [currentTimecode, setCurrentTimecode] = useState<string>('');
  /** When the reading on screen was actually taken, from the server. */
  const [observedAt, setObservedAt] = useState<string | null>(null);
  const [conditionLabel, setConditionLabel] = useState<string | null>(null);
  const [sunset, setSunset] = useState<string | null>(null);

  /**
   * The four spots, with no reading until the server supplies one.
   *
   * This was DEFAULT_CAMERAS: four entries each carrying `LIVE_STREAMING`,
   * `1080p 60fps`, an `HLS / Ultra-Low Latency` stream type, a viewer count and
   * its own wind and water temperature. All of it was written here, none of it
   * measured, and it rendered before — and instead of — anything the server
   * said. The names, orientations and images are what the page can show while
   * the reading is in flight; the conditions stay null until they are real.
   */
  const SPOTS_AWAITING_READING: LiveCameraFeed[] = [
    {
      id: 'cam-lighthouse',
      spotId: 'lighthouse',
      name: 'Lighthouse Promenade & Bay',
      nameAr: 'ممشى وخليج اللايتهاوس',
      shortName: 'Lighthouse',
      shortNameAr: 'اللايتهاوس',
      orientation: 'South-East (Gulf of Aqaba)',
      imageUrl: IMG_P154455176346a013bb70d5_HERO,
      highlights: 'Crystal reef shallows with gentle mountain sunset backlight',
      conditions: null
    },
    {
      id: 'cam-bluehole',
      spotId: 'bluehole',
      name: 'The Blue Hole Marine Sanctuary',
      nameAr: 'محمية البلو هول البحرية',
      shortName: 'Blue Hole',
      shortNameAr: 'البلو هول',
      orientation: 'East (Deep blue submarine sinkhole)',
      imageUrl: IMG_P16826872200634742bd7fd538_HERO,
      highlights: 'The legendary sinkhole rim and the Saddle crossing',
      conditions: null
    },
    {
      id: 'cam-lagoon',
      spotId: 'lagoon',
      name: 'Dahab Wind Lagoon',
      nameAr: 'لاجونا دهب للرياح',
      shortName: 'Lagoon',
      shortNameAr: 'اللاجونا',
      orientation: 'North-West flatwater basin',
      imageUrl: IMG_P1507525428034b723cf961d3e_HERO,
      highlights: 'Turquoise shallow sandbar with vibrant foil & kite glides',
      conditions: null
    },
    {
      id: 'cam-canyon',
      spotId: 'canyon',
      name: 'The Canyon & Bells Coast',
      nameAr: 'ساحل الكانيون والبيلز',
      shortName: 'Canyon',
      shortNameAr: 'الكانيون',
      orientation: 'North Reef Shelf',
      imageUrl: IMG_P15103123056538ed496efae75_HERO,
      highlights: 'Dramatic Sinai granite cliffs meeting deep azure drop-offs',
      conditions: null
    }
  ];

  const [cameras, setCameras] = useState<LiveCameraFeed[]>(SPOTS_AWAITING_READING);

  useEffect(() => {
    // Fetch live camera telemetry
    api.getCameraFeeds().then((data) => {
      if (data?.spots?.length) setCameras(data.spots);
      if (data?.observedAt) setObservedAt(data.observedAt);
    });

    // The described condition and the sunset come from the weather reading, not
    // from the spot list.
    api.getWeatherTelemetry().then((w) => {
      if (!w?.available) return;
      setConditionLabel(language === 'ar' ? w.conditionAr : w.condition);
      setSunset(w.astronomy?.sunset ?? null);
    }).catch(() => {});

    // Update real-time timecode
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTimecode(now.toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  /**
   * Compact, distinguishable label for the camera selector tabs.
   *
   * These rendered name.split(' ')[0], which produced "The" for BOTH
   * "The Blue Hole Marine Sanctuary" and "The Canyon & Bells Coast" — two
   * identical tabs with no way to tell which camera you were choosing.
   */
  const cameraTabLabel = (cam: LiveCameraFeed): string => {
    const explicit = language === 'ar' ? cam.shortNameAr : cam.shortName;
    if (explicit) return explicit;

    const full = language === 'ar' ? cam.nameAr : cam.name;
    const stopWords = t('live.theAAn');
    const words = full
      .split(/\s+/)
      .filter(w => w && !stopWords.includes(w.toLowerCase()));
    return words.slice(0, 2).join(' ') || full;
  };

  const selectedCam = cameras.find((c) => c.id === selectedCameraId) || cameras[0];

  // The time of the reading, not of the page. The badge used to show a running
  // clock beside "REC · LIVE", which read as a stream's timecode.
  /** The single reading the server published; the sites share it. */
  const reading = cameras.find(c => c.conditions)?.conditions ?? null;

  // The published sunset for today, not a fixed '06:24 PM'.
  const sunsetLabel = sunset
    ? new Date(sunset).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  /**
   * Built from what is known: the traveler's name, the real reading, and their
   * next booking. Lines with no source are simply absent.
   */
  const firstName = (profile.name || '').trim().split(/\s+/)[0] || '';
  const nextBooking = bookings.find(b => b.status === 'Confirmed ✓') || bookings[0];
  const morningPreview = [
    t('live.goodMorning', {
      name: firstName ? t('live.goodMorningName', { name: firstName }) : '',
    }),
    reading
      ? t('live.weather', {
          air: reading.airTempC,
          sea: reading.waterTempC != null ? t('live.seaReading', { water: reading.waterTempC }) : '',
        })
      : null,
    nextBooking
      ? language === 'ar'
        ? `${nextBooking.subtitle} · ${nextBooking.datesOrTime}`
        : `${nextBooking.subtitle} · ${nextBooking.datesOrTime}`
      : t('live.noConfirmedBookingsOn'),
    activeTrip ? activeTrip.title : null
  ]
    .filter(Boolean)
    .join(String.fromCharCode(10));

  const observedAtLabel = observedAt
    ? new Date(observedAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      })
    : null;

  const handleRefreshFeed = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast(t('live.cameraStreamTelemetryRefreshed'));
    }, 600);
  };

  const handleTakeSnapshot = () => {
    showToast(t('live.snapshotSavedFrom', { name: language === 'ar' ? selectedCam.nameAr : selectedCam.name }));
  };

  /**
   * The named dive sites and what is genuinely known about each: its character,
   * the window when the light and thermal wind suit it, and why.
   *
   * Every entry used to also carry `status: 'Prime & Crystal'`, `rating:
   * '10/10'`, `waterTemp: '24°C'`, `visibility: '28m'` and `current: 'Gentle
   * Current'` — five measurements per site, twenty in total, none of them
   * observed by anything and none of them ever different. Visibility and
   * current in particular are what a diver reads before entering the water.
   *
   * Water temperature and wind now come from the real reading, which is one
   * reading for all four sites because that is what the source publishes.
   */
  const spotsConditionList = [
    {
      id: 'canyon',
      name: t('live.theCanyonTheBells'),
      type: t('live.deepReefWallDiving'),
      bestWindow: '09:00 AM — 12:30 PM',
      bestWindowAr: '٠٩:٠٠ ص — ١٢:٣٠ م',
      insight: t('live.morningSunAnglesPierce'),
    },
    {
      id: 'bluehole',
      name: t('live.theBlueHoleThe'),
      type: t('live.freedivingWallSnorkeling'),
      bestWindow: '10:00 AM — 02:00 PM',
      bestWindowAr: '١٠:٠٠ ص — ٠٢:٠٠ م',
      insight: t('live.waterInsideTheBlue'),
    },
    {
      id: 'lagoon',
      name: t('live.dahabLagunaBabyBay'),
      type: t('live.kitesurfingWindsurfing'),
      bestWindow: '01:30 PM — 05:00 PM',
      bestWindowAr: '٠١:٣٠ م — ٠٥:٠٠ م',
      insight: t('live.thermalAfternoonBreezeBuilds'),
    },
    {
      id: 'lighthouse',
      name: t('live.lighthousePromenadeReef'),
      type: t('live.snorkelingSunsetCafes'),
      bestWindow: '04:30 PM — 06:45 PM',
      bestWindowAr: '٠٤:٣٠ م — ٠٦:٤٥ م',
      insight: t('live.pastelSunsetReflectionOver'),
    },
  ];

  const filteredSpots = activeSpotTab === 'all' 
    ? spotsConditionList 
    : spotsConditionList.filter(s => s.id === activeSpotTab);

  return (
    <div className="w-full bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-28 md:pb-20" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* 1. Internal Page Header */}
      <InternalPageHeader
        variant="trip"
        eyebrow={t('live.lIVEREDSEAENVIRONMENTAL')}
        eyebrowIcon={<span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />}
        title={t('live.title')}
        subtitle={t('live.subtitle')}
        breadcrumbs={[
          { label: t('daygi.home'), to: '/home' },
          { label: t('live.myTrip'), to: '/my-trip' },
          { label: t('live.liveRadar') }
        ]}
        badges={[
          { text: t('live.liveSync'), icon: <Waves className="w-3 h-3 text-[var(--accent-primary)]" /> }
        ]}
        actions={
          <button
            type="button"
            onClick={() => navigateTo('/my-trip')}
            className="px-5 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:opacity-90 text-[var(--accent-secondary-ink)] font-bold text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-xs cursor-pointer flex items-center gap-2"
          >
            <span>{t('live.syncWithMyItinerary')}</span>
          </button>
        }
      >
        {/*
          The conditions strip.

          Six tiles, all six hardcoded: 28°C air, 24°C water, "28m+" visibility,
          14 kn wind, "0.3m" swell and a 06:24 PM sunset — none of them
          measured, none of them ever different, under a header that calls this
          a live environmental radar. Measured against the real source on the
          day this was rewritten, the air was 33.4°C and the wind 9.4 kn.

          Four of the six have a source now. Visibility and swell do not: there
          is no buoy and no dive-centre feed, and underwater visibility is what
          a diver reads before entering the water, so it is not shown at all
          rather than guessed.
        */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
          <div className="chart-card p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-secondary)]">
              <Sun className="w-4 h-4" aria-hidden="true" />
              <span>{t('live.airTemp')}</span>
            </div>
            <div className="dg-num tabular-nums text-2xl font-bold text-[var(--text-primary)]">
              {reading ? `${reading.airTempC}°C` : '—'}
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              {conditionLabel || (t('live.readingUnavailable'))}
            </div>
          </div>

          <div className="chart-card p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-primary)]">
              <Thermometer className="w-4 h-4" aria-hidden="true" />
              <span>{t('live.waterTemp')}</span>
            </div>
            <div className="dg-num tabular-nums text-2xl font-bold text-[var(--text-primary)]">
              {reading?.waterTempC != null ? `${reading.waterTempC}°C` : '—'}
            </div>
            <div className="text-[12px] text-[var(--accent-primary)]">
              {reading?.waterTempC != null
                ? t('live.seaSurface')
                : t('live.notPublishedNow')}
            </div>
          </div>

          <div className="chart-card p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-secondary)]">
              <Wind className="w-4 h-4" aria-hidden="true" />
              <span>{t('live.wind')}</span>
            </div>
            <div className="dg-num tabular-nums text-2xl font-bold text-[var(--text-primary)]">
              {reading ? `${reading.windKnots} kn` : '—'}
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]">
              {reading ? reading.windDirection : '—'}
            </div>
          </div>

          <div className="chart-card p-3.5 rounded-2xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[var(--accent-secondary)]">
              <Clock className="w-4 h-4" aria-hidden="true" />
              <span>{t('live.sunset')}</span>
            </div>
            <div className="dg-num tabular-nums text-2xl font-bold text-[var(--text-primary)]">
              {sunsetLabel || '—'}
            </div>
            <div className="text-[12px] text-[var(--accent-secondary)]">
              {observedAtLabel
                ? t('live.reading', { observedAtLabel })
                : ''}
            </div>
          </div>
        </div>
      </InternalPageHeader>

      {/* 2. Main Live Analysis Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* LIVE STREAMING BEACH CAMERAS PLAYER (100% PRODUCTION HARNESS) */}
        <section aria-label="Live Dahab Beach Cameras" className="rounded-3xl bg-[var(--surface-card)] text-[var(--text-primary)] border border-[#1B9A8B]/30 shadow-2xl overflow-hidden">
          <div className="p-6 sm:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
              <div className="space-y-1">
                {/* Was a pulsing red dot, "LIVE BEACHFRONT CAMERAS" and a
                    "1080p 60fps" badge, over four stock photographs. */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                    {t('live.dAHABSPOTSCURRENTCONDITIONS')}
                  </span>
                </div>
                <p className="chart-heading text-2xl font-bold text-[var(--text-primary)]">
                  {language === 'ar' ? selectedCam.nameAr : selectedCam.name}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {selectedCam.highlights}
                </p>
              </div>

              {/* Camera Switcher Tabs */}
              <div className="flex flex-wrap items-center gap-1.5 bg-black/50 p-1.5 rounded-2xl border border-[var(--border-subtle)]">
                {cameras.map((cam) => {
                  const isCurrent = cam.id === selectedCameraId;
                  return (
                    <button
                      key={cam.id}
                      type="button"
                      onClick={() => setSelectedCameraId(cam.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1.5 ${
                        isCurrent
                          ? 'bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-md border border-[var(--accent-primary)]/50'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)]'
                      }`}
                    >
                      <Video className="w-3 h-3" />
                      <span>{cameraTabLabel(cam)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Video Player Display Canvas */}
            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-black shadow-inner">
              <img
                src={selectedCam.imageUrl}
                alt={selectedCam.name}
                className={`w-full h-full object-cover object-center transition-transform duration-700 ${
                  isPlaying ? 'scale-100' : 'scale-105 filter brightness-75'
                }`}
              />

              {/* Live Streaming Overlay Elements */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

              {/* Top Stream Status Badge */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
                {/* Was "REC · LIVE" beside a running timecode, and a viewer
                    count — 42, 68, 55, 31 — that was written into the file and
                    never moved. Nothing here streams; this is a photograph. */}
                <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-[var(--border-subtle)] text-xs text-white">
                  <span className="font-bold text-[12px] text-white/85">
                    {t('live.sPOTPHOTO')}
                  </span>
                  {observedAtLabel && (
                    <>
                      <span className="text-white/40">|</span>
                      <span className="dg-num font-mono text-xs text-white/70">
                        {t('live.reading', { observedAtLabel })}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRefreshFeed}
                    className="p-2 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 text-white border border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                    title="Refresh stream buffer"
                    aria-label={t('live.refreshStreamBuffer')}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={handleTakeSnapshot}
                    className="p-2 rounded-full bg-black/60 backdrop-blur-md hover:bg-black/80 text-white border border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                    title="Capture HD snapshot"
                    aria-label={t('live.captureHDSnapshot')}
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Bottom Stream Telemetry Bar */}
              <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pointer-events-auto bg-black/70 backdrop-blur-md p-3.5 rounded-xl border border-[var(--border-subtle)]">
                <div className="flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    aria-label={isPlaying
                      ? (t('live.pauseTheLiveStream'))
                      : (t('live.playTheLiveStream'))}
                    aria-pressed={isPlaying}
                    /* Was squeezed to 21px wide by the flex row, and carried no
                       accessible name at all — an icon-only stream control. */
                    className="w-9 h-9 flex-shrink-0 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-white flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer shadow-sm"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>
                  <div>
                    <span className="text-[11px] text-[var(--surface-container)]/70 block font-mono">LOCATION ORIENTATION</span>
                    <span className="font-bold text-white text-xs">{selectedCam.orientation}</span>
                  </div>
                </div>

                {/* Real readings, or nothing. The third chip was a crowd
                    level ("Moderate & Relaxed", "Active Kites in Air") that
                    nothing observes, so it is gone rather than guessed. */}
                {selectedCam.conditions ? (
                  <div className="flex items-center gap-3 text-xs text-[var(--text-primary)]">
                    <span className="px-2.5 py-1 rounded-md bg-[var(--btn-util-bg)] text-white font-mono">
                      <Wind className="w-3 h-3" /> {selectedCam.conditions.windKnots} kn {selectedCam.conditions.windDirection}
                    </span>
                    {selectedCam.conditions.waterTempC !== null && (
                      <span className="px-2.5 py-1 rounded-md bg-[var(--btn-util-bg)] text-[var(--accent-primary)] font-mono">
                        <Waves className="w-3 h-3" /> {selectedCam.conditions.waterTempC}°C
                      </span>
                    )}
                    <span className="px-2.5 py-1 rounded-md bg-[var(--btn-util-bg)] text-[var(--accent-secondary)] font-mono">
                      <Sun className="w-3 h-3" /> {selectedCam.conditions.airTempC}°C
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-[var(--text-secondary)]/60">
                    {t('live.conditionsUnavailableRightNow')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Modeled sea state + water-activity suitability (self-contained;
            renders an honest unavailable note when the model is unreachable). */}
        <MarineConditions />

        {/* Recommended Action Cards for Right Now */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Best Time to Dive Canyon */}
          <div className="chart-card p-6 rounded-3xl space-y-4 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--surface-container)]/5 px-3 py-1 rounded-full border border-[var(--accent-primary)]/20">
                  {t('live.bestTimeCanyon')}
                </span>
                <h2 className="chart-heading text-xl font-bold text-[var(--text-primary)]">
                  {t('live.canyonTime')}
                </h2>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)]/5 text-[var(--accent-primary)] flex items-center justify-center font-bold">
                <Fish className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              {t('live.canyonReason')}
            </p>
            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
              <span>{t('live.locationTheCanyonDahab')}</span>
              <button
                type="button"
                onClick={() => navigateTo('/my-trip', { dayId: 2 })}
                className="text-[var(--accent-primary)] hover:text-[var(--text-primary)] font-bold flex items-center gap-1 cursor-pointer py-2 -my-2"
              >
                <span>{t('live.bookDive')}</span>
              </button>
            </div>
          </div>

          {/* Best Kite Window Lagoon */}
          <div className="chart-card p-6 rounded-3xl space-y-4 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[var(--accent-primary)] bg-[var(--surface-container)]/5 px-3 py-1 rounded-full border border-[var(--accent-primary)]/20">
                  {t('live.bestTimeKite')}
                </span>
                <h2 className="chart-heading text-xl font-bold text-[var(--text-primary)]">
                  {t('live.kiteTime')}
                </h2>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)]/5 text-[var(--accent-primary)] flex items-center justify-center font-bold">
                <Wind className="w-5 h-5" aria-hidden="true" />
              </div>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              {t('live.kiteReason')}
            </p>
            <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs font-semibold text-[var(--text-primary)]">
              <span>{t('live.locationDahabLaguna')}</span>
              <button
                type="button"
                onClick={() => navigateTo('/explore')}
                className="text-[var(--accent-primary)] hover:text-[var(--text-primary)] font-bold flex items-center gap-1 cursor-pointer py-2 -my-2"
              >
                <span>{t('live.viewOnMap')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Spot-by-Spot Live Status */}
        <section
          aria-label={t('live.liveConditionsBySpot')}
          className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-xs space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
            <div>
              <h2 className="chart-heading text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                {t('live.liveConditionsByDahab')}
              </h2>
              <p className="text-xs sm:text-sm text-[var(--text-primary)]/60 font-normal">
                {t('live.updated5MinsAgo')}
              </p>
            </div>

            {/* Filter Tabs — wrap on narrow screens so the row never overflows */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[var(--surface-container)]/5 p-1 rounded-2xl">
              {(['all', 'canyon', 'bluehole', 'lagoon', 'lighthouse'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveSpotTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                    activeSpotTab === tab ? 'bg-[var(--surface-container)] text-[var(--text-primary)] shadow-xs' : 'text-[var(--text-primary)]/70 hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab === 'all'
                    ? t('common.viewAll')
                    : tab === 'canyon'
                    ? (t('live.canyon'))
                    : tab === 'bluehole'
                    ? (t('live.blueHole'))
                    : tab === 'lagoon'
                    ? (t('daygi.laguna'))
                    : (t('daygi.lighthouse'))}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSpots.map((spot) => (
              <div
                key={spot.id}
                className="chart-card p-5 rounded-2xl space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      {spot.name}
                    </h3>
                    <p className="text-xs text-[var(--text-primary)]/60 font-medium">
                      {spot.type}
                    </p>
                  </div>
                  {/* Was a green "Prime & Crystal · 10/10" badge on all four
                      sites, always. Nothing scores a dive site here. */}
                </div>

                {reading ? (
                  <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--text-primary)]/8 text-xs">
                    <div>
                      <span className="text-[11px] text-[var(--text-primary)]/60 block">{t('live.waterTemp')}</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {reading.waterTempC !== null ? `${reading.waterTempC}°C` : '—'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-primary)]/60 block">{t('live.windLabel')}</span>
                      <span className="font-bold text-[var(--text-primary)]">
                        {reading.windKnots} kn {reading.windDirection}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--text-primary)]/60 block">{t('live.air')}</span>
                      <span className="font-bold text-[var(--text-primary)]">{reading.airTempC}°C</span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 border-y border-[var(--text-primary)]/8 text-xs text-[var(--text-primary)]/60">
                    {t('live.conditionsUnavailableRightNow')}
                  </div>
                )}

                <p className="text-xs text-[var(--text-primary)]/75 leading-relaxed font-normal">
                  {spot.insight}
                </p>

                <div className="pt-2 flex items-center justify-between text-xs font-semibold text-[var(--accent-primary)]">
                  <span className="flex items-center gap-1 text-[var(--text-primary)]/70">
                    <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                    <span>{language === 'ar' ? spot.bestWindowAr : spot.bestWindow}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      showToast(t('live.addedToDayPlan', { name: spot.name }));
                    }}
                    className="px-3.5 py-1.5 rounded-xl bg-[var(--surface-container)] hover:bg-[var(--surface-container)] text-[var(--text-primary)] text-xs font-bold transition-colors cursor-pointer"
                  >
                    {t('live.addToDay')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. WhatsApp Companion Morning Briefing Preview */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[var(--surface-card)] text-[var(--text-primary)] border border-cyan-500/20 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-[var(--accent-primary)]">
                  {t('live.aUTOMATEDWHATSAPPMORNINGSYNC')}
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                  {t('whatsapp.title')}
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => showToast(t('live.whatsAppMorningBriefingEnabled'))}
              className="px-4 py-2 rounded-xl bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] text-[var(--accent-secondary-ink)] font-bold text-xs transition-colors cursor-pointer self-start sm:self-center"
            >
              {t('live.enable0730AMSync')}
            </button>
          </div>

          {/*
            A preview of the morning message, built from this traveler's own
            data.

            It was a fixed string in translations.ts: "Good morning Ahmed! 28°C
            Dahab · Calm sea · Canyon dive scheduled at 09:00 AM · Driver
            Mahmoud arrives at 08:30 AM" — a name, a temperature, a dive and a
            driver, none of them the reader's, shown to everyone.
          */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] font-mono text-xs text-[var(--text-primary)] whitespace-pre-line leading-relaxed">
            {morningPreview}
          </div>
        </div>

      </main>
    </div>
  );
};

