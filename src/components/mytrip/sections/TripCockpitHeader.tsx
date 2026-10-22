import React from 'react';
import { ArrowLeft, ArrowRight, Download, Siren, Utensils } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';

interface TripCockpitHeaderProps {
  onBackToHome?: () => void;
  onOpenSos: () => void;
  onOpenFood: () => void;
  onOpenOfflinePack: () => void;
}

export const TripCockpitHeader: React.FC<TripCockpitHeaderProps> = ({
  onBackToHome,
  onOpenSos,
  onOpenFood,
  onOpenOfflinePack,
}) => {
  const { language, isRTL, t } = useLanguage();
  const { isDark } = useTheme();

  return (
    <header className={`border-b sticky top-16 sm:top-20 z-30 backdrop-blur-xl transition-colors ${
      isDark ? 'bg-[var(--surface-container)]/85 border-[var(--border-subtle)] text-[var(--text-secondary)]' : 'bg-[var(--surface-card)]/90 border-[var(--border-subtle)] text-[var(--text-secondary)]'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
        
        {/* Back & Breadcrumb */}
        <div className="flex items-center gap-2.5 text-xs font-semibold">
          <button
            type="button"
            id="mytrip-back-home-btn"
            onClick={onBackToHome}
            className={`hover:underline flex items-center gap-1.5 cursor-pointer py-2 -my-2 ${
              isDark ? 'hover:text-[var(--text-primary)]' : 'hover:text-[var(--text-primary)]'
            }`}
          >
            {isRTL ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
            <span>{t('daygi.home')}</span>
          </button>
          <span className="opacity-40">/</span>
          <span className="font-bold text-[var(--accent-primary)]">
            {t('myTrip.title')}
          </span>
        </div>

        {/* Quick Concierge Shortcut Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="cockpit-sos-btn"
            onClick={onOpenSos}
            className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1.5"
          >
            <Siren className="w-3 h-3" aria-hidden="true" />
            <span>{t('myTrip.247SOSHelp')}</span>
          </button>

          <button
            type="button"
            id="cockpit-food-btn"
            onClick={onOpenFood}
            className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)]/30 border border-[var(--accent-secondary)]/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1.5"
          >
            <Utensils className="w-3 h-3" />
            <span>{t('myTrip.foodNowCta')}</span>
          </button>

          <button
            type="button"
            id="cockpit-offline-btn"
            onClick={onOpenOfflinePack}
            className={`px-3 py-1 rounded-full text-xs font-bold border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1.5 ${
              isDark ? 'bg-[var(--surface-container)] text-[var(--text-secondary)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)]' : 'bg-[var(--surface-card)] text-[var(--text-primary)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)]'
            }`}
          >
            <Download className="w-3 h-3 text-[var(--accent-primary)]" />
            <span>{t('myTrip.offlinePack')}</span>
          </button>
        </div>

      </div>
    </header>
  );
};