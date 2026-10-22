import React from 'react';
import { AlertTriangle, Compass, Download, FileText, Sparkles, Utensils } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import { useTrip } from '../../../context/TripContext';

interface TripToolsTabProps {
  onOpenSos: () => void;
  onOpenFood: () => void;
  onOpenSpontaneous: () => void;
  onOpenBriefing: () => void;
  onOpenOfflinePack: () => void;
}

export const TripToolsTab: React.FC<TripToolsTabProps> = ({
  onOpenSos,
  onOpenFood,
  onOpenSpontaneous,
  onOpenBriefing,
  onOpenOfflinePack,
}) => {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const { navigateTo } = useTrip();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      
      {/* 1. Food Now */}
      <button
        type="button"
        id="tool-card-food"
        onClick={onOpenFood}
        className={`p-6 rounded-3xl border text-start shadow-md hover:shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-4 ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/40 text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-secondary)] text-[var(--text-primary)]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] flex items-center justify-center font-bold">
          <Utensils className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg chart-heading font-bold">{t('myTrip.foodNow')}</h3>
          <p className={`text-xs leading-relaxed mt-1 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
            {t('myTrip.freshBreakfastSeafoodAnd')}
          </p>
        </div>
      </button>

      {/* 2. What Should I Do Now */}
      <button
        type="button"
        id="tool-card-spontaneous"
        onClick={onOpenSpontaneous}
        className={`p-6 rounded-3xl border text-start shadow-md hover:shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-4 ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center font-bold">
          <Compass className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg chart-heading font-bold">{t('myTrip.whatShouldIDo')}</h3>
          <p className={`text-xs leading-relaxed mt-1 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
            {t('myTrip.realtimeSmartRecommendationsMatched')}
          </p>
        </div>
      </button>

      {/* 3. Pre-Arrival Briefing */}
      <button
        type="button"
        id="tool-card-briefing"
        onClick={onOpenBriefing}
        className={`p-6 rounded-3xl border text-start shadow-md hover:shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-4 ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center font-bold">
          <FileText className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg chart-heading font-bold">{t('myTrip.briefing')}</h3>
          <p className={`text-xs leading-relaxed mt-1 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
            {t('myTrip.pretripChecklistDiveGear')}
          </p>
        </div>
      </button>

      {/* 4. SOS 24/7 Emergency */}
      <button
        type="button"
        id="tool-card-sos"
        onClick={onOpenSos}
        className={`p-6 rounded-3xl border text-start shadow-md hover:shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-4 ${
          isDark ? 'bg-[var(--surface-card)] border-rose-500/30 hover:border-rose-500 text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-rose-300 hover:border-rose-500 text-[var(--text-primary)]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg chart-heading font-bold">{t('myTrip.sosEmergency')}</h3>
          <p className={`text-xs leading-relaxed mt-1 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
            {t('myTrip.dahabHyperbaricChamberTourist')}
          </p>
        </div>
      </button>

      {/* 5. Offline Companion Pack */}
      <button
        type="button"
        id="tool-card-offline-pack"
        onClick={onOpenOfflinePack}
        className={`p-6 rounded-3xl border text-start shadow-md hover:shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-4 ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/40 text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-secondary)] text-[var(--text-primary)]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] flex items-center justify-center font-bold">
          <Download className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg chart-heading font-bold">{t('myTrip.offlinePack')}</h3>
          <p className={`text-xs leading-relaxed mt-1 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
            {t('myTrip.downloadVouchersTaxiContacts')}
          </p>
        </div>
      </button>

      {/* 6. Explore All Dahab */}
      <button
        type="button"
        id="tool-card-explore"
        onClick={() => navigateTo('/explore')}
        className={`p-6 rounded-3xl border text-start shadow-md hover:shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer space-y-4 ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/40 text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)] text-[var(--text-primary)]'
        }`}
      >
        <div className="w-12 h-12 rounded-2xl bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] flex items-center justify-center font-bold">
          <Sparkles className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-lg chart-heading font-bold">{t('myTrip.exploreSpots')}</h3>
          <p className={`text-xs leading-relaxed mt-1 ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
            {t('myTrip.browseAllNaturalReefs')}
          </p>
        </div>
      </button>

    </div>
  );
};