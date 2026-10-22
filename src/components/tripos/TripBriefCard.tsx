import React from 'react';
import {
  CheckCircle2,
  Lock,
  Heart,
  Ban,
  Users,
  Calendar,
  Wallet,
  Compass,
  Sparkles,
  Edit3
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';

interface TripBriefCardProps {
  onOpenEditModal: () => void;
  /**
   * The traveler's chosen day count, when the plan on screen was shaped by
   * the wizard's duration choice (no saved trip exists yet, so the context's
   * tripBrief still carries the compiled default). Falls back to tripBrief.
   */
  durationDaysOverride?: number;
  /** Traveler count from the wizard, for the same reason. */
  travelersCountOverride?: number;
}

export const TripBriefCard: React.FC<TripBriefCardProps> = ({ onOpenEditModal, durationDaysOverride, travelersCountOverride }) => {
  const { language, isRTL , t} = useLanguage();
  const { tripBrief, profile, user } = useTrip();

  return (
    <section
      id="trip-brief-summary-card"
      className="w-full bg-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl p-6 sm:p-8 border border-[var(--border-subtle)] shadow-2xl space-y-6"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-secondary)]" />
            <span className="text-[12px] font-black text-[var(--accent-secondary)]">
              {t('tripos.aUTHORITATIVETRIPBRIEF')}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[var(--text-primary)]">
            {/* Falls back to the traveler's own name, then to a neutral title.
                The default used to be the literal 'Sarah & Karim'. */}
            {(() => {
              const who = tripBrief.travelerName || profile.name || user?.displayName || '';
              if (!who) return t('tripos.yourDahabOperatingBrief');
              return t('tripos.sDahabOperatingBrief', { who });
            })()}
          </h2>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)]/70">
            {t('tripos.theCoreConstraintsAnd')}
          </p>
        </div>

        <button
          id="btn-edit-trip-brief"
          type="button"
          onClick={onOpenEditModal}
          className="px-4 py-2.5 rounded-2xl bg-[var(--surface-container)] hover:bg-[var(--surface-container)]/80 text-[var(--text-primary)] font-bold text-xs border border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-center"
        >
          <Edit3 className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
          <span>{t('tripos.editBriefGoals')}</span>
        </button>
      </div>

      {/* Meta Specs Pill Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]/60 text-[12px]">
            <Calendar className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>{t('tripos.duration')}</span>
          </div>
          <div className="text-sm font-extrabold text-[var(--text-primary)]">
            {t('tripos.days4Nights', { durationDays: durationDaysOverride ?? tripBrief.durationDays })}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]/60 text-[12px]">
            <Users className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>{t('tripos.travelers')}</span>
          </div>
          <div className="text-sm font-extrabold text-[var(--text-primary)]">
            {t('tripos.travelersWithDynamic', {
              travelersCount: travelersCountOverride ?? tripBrief.travelersCount,
              tripDynamic: tripBrief.tripDynamic,
            })}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]/60 text-[12px]">
            <Compass className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>{t('tripos.paceEnergy')}</span>
          </div>
          <div className="text-sm font-extrabold text-[var(--text-primary)]">
            {language === 'ar'
              ? (tripBrief.pace === 'Relaxed' ? t('tripos.paceRelaxed') : tripBrief.pace === 'Balanced' ? t('tripos.paceBalanced') : t('tripos.paceAdventurous'))
              : t('tripos.paceLabel', { pace: tripBrief.pace })}
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]/60 text-[12px]">
            <Wallet className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>{t('tripos.targetBudget')}</span>
          </div>
          <div className="text-sm font-extrabold text-[var(--text-primary)]">
            {tripBrief.estimatedBudgetEGP.toLocaleString()} {t('tripos.eGP')}
          </div>
        </div>
      </div>

      {/* Constraints Triple Column Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Must-Haves */}
        <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-black text-emerald-300">
                {t('tripos.mUSTHAVES')}
              </h3>
            </div>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              {tripBrief.mustHaves.length} {t('tripos.locked')}
            </span>
          </div>

          <ul className="space-y-2 text-xs">
            {tripBrief.mustHaves.map((mh) => (
              <li key={mh.id} className="p-2.5 rounded-xl bg-[var(--surface-card)] border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between font-bold text-[var(--text-primary)]">
                  <span>{language === 'ar' ? mh.labelAr : mh.label}</span>
                  {mh.isLocked && <Lock className="w-3 h-3 text-[var(--text-secondary)]/40" />}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]/60">
                  {language === 'ar' ? mh.descriptionAr || mh.description : mh.description}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Preferences */}
        <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-4 h-4 text-[var(--accent-secondary)]" />
              <h3 className="text-xs font-black text-[var(--accent-secondary)]">
                {t('tripos.pREFERENCES')}
              </h3>
            </div>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/30">
              {tripBrief.preferences.length} {t('tripos.prioritized')}
            </span>
          </div>

          <ul className="space-y-2 text-xs">
            {tripBrief.preferences.map((pref) => (
              <li key={pref.id} className="p-2.5 rounded-xl bg-[var(--surface-card)] border border-[var(--accent-secondary)]/20 space-y-1">
                <div className="font-bold text-[var(--text-primary)]">
                  {language === 'ar' ? pref.labelAr : pref.label}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]/60">
                  {language === 'ar' ? pref.descriptionAr || pref.description : pref.description}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* Avoidances */}
        <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-rose-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-400" />
              <h3 className="text-xs font-black text-rose-300">
                {t('tripos.aVOIDANCES')}
              </h3>
            </div>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {tripBrief.avoidances.length} {t('tripos.excluded')}
            </span>
          </div>

          <ul className="space-y-2 text-xs">
            {tripBrief.avoidances.map((av) => (
              <li key={av.id} className="p-2.5 rounded-xl bg-[var(--surface-card)] border border-rose-500/20 space-y-1">
                <div className="font-bold text-[var(--text-primary)]">
                  {language === 'ar' ? av.labelAr : av.label}
                </div>
                <p className="text-[12px] text-[var(--text-secondary)]/60">
                  {language === 'ar' ? av.descriptionAr || av.description : av.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
