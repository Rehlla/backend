import React from 'react';
import { Sparkles } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
/**
 * The way into DayGI.
 *
 * It used to be a fourth tab in the global navbar, beside Discover, My Trip and
 * Dahab Live — which put a thing you reach for when you are stuck at the same
 * weight as the places you live in, and spent a quarter of the top-level
 * navigation on it.
 *
 * It sits on the opposite side from SinaiFloatingQuickDock deliberately: that
 * corner already holds the tools pill and the SOS button, and a third circle in
 * the same stack is a corner nobody can aim at.
 */
export const DayGiFloatingButton: React.FC = () => {
  const { currentRoute, navigateTo } = useTrip();
  const { language, isRTL , t} = useLanguage();
  // Nothing to offer from the page it opens.
  if (currentRoute === '/daygi' || currentRoute === '/ai-director') return null;

  const label = t('daygi.askDayGI');

  return (
    <button
      type="button"
      id="daygi-floating-button"
      onClick={() => navigateTo('/daygi')}
      aria-label={label}
      dir={isRTL ? 'rtl' : 'ltr'}
      /*
       * Clears the mobile tab bar (~64px) with a small safety margin. This
       * used to sit at 148px to also clear StickyBookingBottomBar — that bar
       * is gone now, and leaving the old offset meant this button floated
       * mid-content, covering card text/CTAs as the page scrolled underneath.
       */
      className={`group fixed bottom-[76px] md:bottom-6 start-4 sm:start-6 z-40 h-12 rounded-full
        flex items-center gap-2 ps-3.5 pe-3.5
        shadow-[0_6px_20px_-4px_rgba(8,23,20,0.45)]
        transition-[background-color,transform,box-shadow] duration-200
        hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-4px_rgba(8,23,20,0.5)]
        active:translate-y-0 active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        bg-[var(--surface-container)] text-[var(--text-primary)] border border-[var(--accent-primary)]/35 hover:bg-[var(--surface-card)] focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-[var(--bg-canvas)]
        `}
    >
      <Sparkles className="w-5 h-5 shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />

      {/*
       * The label is present for a pointer and gone on a phone, where the
       * corner is scarce and the icon has to carry it. aria-label above means
       * the control is named either way.
       */}
      <span className="hidden lg:inline text-xs font-bold whitespace-nowrap" aria-hidden="true">
        {label}
      </span>
    </button>
  );
};
