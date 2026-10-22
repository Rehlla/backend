import React from 'react';
import { Calendar, Hourglass, MapPin, Pencil, Plus, Share2, ShieldCheck, SlidersHorizontal, Sun, Users } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { IMG_P154455176346a013bb70d5_HERO } from '../../../shared/placeholderImagery';

interface TripHeroCardProps {
  travelerDisplayName: string;
  durationDays: number;
  travelersCount: number;
  dateRange: string | null;
  /** The trip's own title. Falls back to the duration phrasing when unset. */
  tripTitle?: string | null;
  /** Drives the status pill. Undefined renders no pill rather than a wrong one. */
  tripStatus?: string | null;
  /** Bookings still waiting on their supplier; a CONFIRMED trip with any is not yet confirmed to the traveller. */
  pendingBookings?: number;
  /** Live conditions, or null when the weather service could not be read. */
  weather?: { airTemperatureC: number; condition: string; conditionAr: string } | null;
  onShare: () => void;
  onManageTrip: () => void;
  onAddActivity: () => void;
  onEditDetails: () => void;
}

const metaButton =
  'group -mx-1.5 flex items-center gap-1.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/70 cursor-pointer';

/**
 * The status pill, in the trip's real vocabulary.
 *
 * This pill was a constant: `t('myTrip.confirmedBadge')` — "Trip Confirmed &
 * Synchronized" — rendered on every trip regardless of state. The seeded trip
 * it shipped on is PLANNED, with zero bookings and totalPaidEGP 0, and it still
 * told the traveller the trip was confirmed and synchronised.
 */
const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  DRAFT: { en: 'Draft itinerary', ar: 'مسودة رحلة' },
  PLANNED: { en: 'Planned — not booked yet', ar: 'مخططة — لم تُحجز بعد' },
  CONFIRMED: { en: 'Trip confirmed ✓', ar: 'الرحلة مؤكدة ✓' },
  IN_DESTINATION: { en: 'In Dahab now', ar: 'في دهب الآن' },
  COMPLETED: { en: 'Trip completed', ar: 'رحلة منتهية' },
  CANCELLED: { en: 'Trip cancelled', ar: 'رحلة ملغاة' },
};

const AWAITING_LABEL = { en: 'Awaiting confirmations', ar: 'بانتظار تأكيد الحجوزات' };

export const TripHeroCard: React.FC<TripHeroCardProps> = ({
  travelerDisplayName,
  durationDays,
  travelersCount,
  dateRange,
  tripTitle,
  tripStatus,
  pendingBookings = 0,
  weather,
  onShare,
  onManageTrip,
  onAddActivity,
  onEditDetails,
}) => {
  const { language, t } = useLanguage();

  const awaiting = tripStatus === 'CONFIRMED' && pendingBookings > 0;
  const statusLabel = awaiting ? AWAITING_LABEL : tripStatus ? STATUS_LABELS[tripStatus] : undefined;
  const conditionText = weather
    ? `${Math.round(weather.airTemperatureC)}°C · ${language === 'ar' ? weather.conditionAr : weather.condition}`
    : null;

  return (
    <section
      aria-label="Trip overview header"
      className="relative rounded-3xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] bg-stone-950 text-[var(--text-primary)] min-h-[300px] flex flex-col justify-end p-6 sm:p-10 aurora-glass"
    >
      {/* Background Photography with deep gradient */}
      <div className="absolute inset-0 z-0">
        <img
          src={IMG_P154455176346a013bb70d5_HERO}
          alt=""
          className="w-full h-full object-cover opacity-60 filter saturate-110"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/60 to-stone-950/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/80 via-transparent to-stone-950/50" />
      </div>

      {/* Foreground details */}
      <div className="relative z-10 space-y-4 max-w-3xl">
        
        {/* Stage Pill & Weather ticker */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {statusLabel && (
            <span
              className={
                awaiting
                  ? 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold bg-amber-300/15 text-amber-200 border border-amber-300/30 backdrop-blur-md'
                  : 'inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-extrabold bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] shadow-md'
              }
            >
              {awaiting ? <Hourglass className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{language === 'ar' ? statusLabel.ar : statusLabel.en}</span>
            </span>
          )}

          {/*
            Was t('myTrip.weatherCalm') — the fixed string "28°C · Sunny · Calm
            Red Sea Swell", shown whatever the sea was doing, on the page a
            diver opens before heading out. The live reading is the one the
            /live page already renders; with no reading, this pill is absent
            rather than reassuring.
          */}
          {conditionText && (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-white/15 backdrop-blur-md text-white border border-white/20">
              <Sun className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>{conditionText}</span>
            </span>
          )}
        </div>

        {/* Greeting & Title */}
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-secondary)] mb-2">
            {t('myTrip.welcomeBack', { travelerDisplayName })}
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-semibold text-white leading-[1.05] text-balance">
            {/*
              The trip's own title wins. The duration phrasing below is a
              fallback for a trip that has none — it used to be the only thing
              rendered, so a trip called "Dahab First Timer" was displayed to
              its owner as "5 Days of Coral Diving & Sinai Desert Serenity".
            */}
            {tripTitle
              ? tripTitle
              : t('myTrip.daysInDahab', { durationDays })}
          </h1>
        </div>

        {/* Metadata pills — pinned white/70: fixed dark photo plate */}
        <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-white/70 font-medium pt-1">
          {/*
            No invented dates. This read `dateRange || '1 - 5 Sep 2026'`, so a
            trip with no start or end date was given a specific, plausible,
            wrong week — which is worse than showing no dates at all.
          */}
          {dateRange && (
            <>
              <button
                type="button"
                onClick={onEditDetails}
                aria-label={t('myTrip.editDetails')}
                className={metaButton}
              >
                <Calendar className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{dateRange}</span>
                <Pencil className="w-3 h-3 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" aria-hidden="true" />
              </button>
              <span className="opacity-40">•</span>
            </>
          )}
          <button
            type="button"
            onClick={onEditDetails}
            aria-label={t('myTrip.editDetails')}
            className={metaButton}
          >
            <Users className="w-4 h-4 text-[var(--accent-secondary)]" />
            <span>{t('myTrip.travelers-2', { travelersCount })}</span>
            <Pencil className="w-3 h-3 opacity-0 transition-opacity group-hover:opacity-70 group-focus-visible:opacity-70" aria-hidden="true" />
          </button>
          <span className="opacity-40">•</span>
          <span className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>{t('myTrip.dahabSouthSinai')}</span>
          </span>
        </div>

        {/* Action buttons */}
        <div className="pt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            id="hero-share-trip-btn"
            onClick={onShare}
            className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/25 active:scale-[0.98] text-white text-xs font-bold backdrop-blur-md border border-white/25 flex items-center gap-2 transition-all duration-200 shadow-lg shadow-black/10 cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[var(--accent-primary)]" />
            <span>{t('myTrip.shareItinerary')}</span>
          </button>

          <button
            type="button"
            id="hero-edit-details-btn"
            onClick={onEditDetails}
            className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/25 active:scale-[0.98] text-white text-xs font-bold backdrop-blur-md border border-white/25 flex items-center gap-2 transition-all duration-200 shadow-lg shadow-black/10 cursor-pointer"
          >
            <Pencil className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
            <span>{t('myTrip.editDetails')}</span>
          </button>

          <button
            type="button"
            id="hero-manage-trip-btn"
            onClick={onManageTrip}
            className="px-5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/25 active:scale-[0.98] text-white text-xs font-bold backdrop-blur-md border border-white/25 flex items-center gap-2 transition-all duration-200 shadow-lg shadow-black/10 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4 text-[var(--accent-secondary)]" />
            <span>{t('myTrip.manageTrip')}</span>
          </button>

          <button
            type="button"
            id="hero-add-exp-btn"
            onClick={onAddActivity}
            className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-[#e8a87c] to-[#d48a6a] hover:brightness-110 active:scale-[0.98] text-[#1a1210] text-xs font-extrabold flex items-center gap-2 shadow-xl shadow-black/20 transition-all duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{t('myTrip.addActivity')}</span>
          </button>
        </div>

      </div>
    </section>
  );
};