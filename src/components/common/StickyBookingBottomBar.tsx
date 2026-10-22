import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Zap, Compass } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';

interface StickyBookingBottomBarProps {
  onStartCustomPlanner: () => void;
  onOpenItinerary: () => void;
}

export const StickyBookingBottomBar: React.FC<StickyBookingBottomBarProps> = React.memo(({
  onStartCustomPlanner,
  onOpenItinerary,
}) => {
  const { currentRoute, tripDays, profile, navigateTo } = useTrip();
  const { language , t} = useLanguage();
  const { isDark } = useTheme();
  const barRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (barRef.current) {
        const show = window.scrollY > 280;
        barRef.current.style.display = show ? '' : 'none';
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Only show on the home page.
  //
  // This used to read `currentView`, which the context has never exposed. The
  // comparison `undefined !== 'home'` was always true, so this component
  // returned null on every render and the sticky booking bar never appeared at
  // all. The route-based equivalent is below.
  const isHomeRoute = currentRoute === '/home' || currentRoute === '/discover' || currentRoute === '/';
  if (!isHomeRoute) {
    return null;
  }

  // Dynamic estimate calculation based on profile or standard 5-day flow
  const days = profile.lengthDays || 5;
  const travelers = profile.travelersCount || 2;
  const estimatedPriceEGP = (days * 1850 * travelers);

  return (
    /*
      Mobile has a 55px bottom navigation bar. At bottom-4 this estimate bar sat
      on top of it and covered the tab labels, so it now stacks above the nav on
      mobile and keeps the original offset from md upward, where there is no
      bottom nav.
    */
    <aside
      ref={barRef}
      id="sticky-booking-bottom-bar"
      aria-label="Trip booking floating status bar"
      className="fixed bottom-[68px] md:bottom-4 inset-x-0 z-40 max-w-4xl mx-auto px-4 pointer-events-none transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 transform translate-y-0"
      style={{ display: 'none' }}
    >
      <div className="pointer-events-auto backdrop-blur-xl border border-[var(--border-subtle)] rounded-3xl p-3.5 sm:p-4 shadow-2xl flex items-center justify-between gap-4 transition-colors bg-[var(--surface-card)] text-[var(--text-primary)]">
        
        {/* Left: Live Estimator & Real-Time Sinai Status */}
        <div className="flex items-center gap-3.5 min-w-0 pl-1">
          <div className="w-10 h-10 rounded-2xl border border-[var(--border-subtle)] flex items-center justify-center shadow-inner shrink-0 bg-[var(--surface-container)] text-[var(--accent-primary)]">
            <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-extrabold text-[var(--accent-secondary)]">
                {t('common.liveEstimate')}
              </span>
              <span className="hidden sm:inline-block text-[12px] text-[var(--text-secondary)]">
                · {days} {t('common.days')} ({travelers} {t('common.guests')})
              </span>
            </div>
            
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-bold chart-heading text-[var(--text-primary)]">
                {estimatedPriceEGP.toLocaleString()} <span className="text-xs font-sans font-extrabold text-[var(--accent-secondary)]">EGP</span>
              </span>
              <span className="text-[11px] hidden md:inline text-[var(--text-secondary)]">
                ({t('common.inclStaysTransfersReef')})
              </span>
            </div>
          </div>
        </div>

        {/* Right: Primary Single CTA */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            id="sticky-bar-view-map-btn"
            onClick={() => {
              const el = document.getElementById('dahab-spatial-context-map-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              } else {
                // The map lives in a section on the home page
                // (DahabSpatialContextMap). There is no '/map' route and never
                // has been, so this fallback previously did nothing.
                navigateTo('/home');
              }
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer shadow-xs"
          >
            <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
            <span>{t('common.mapRadar')}</span>
          </button>

          <button
            type="button"
            id="sticky-bar-build-itinerary-cta"
            onClick={onStartCustomPlanner}
            className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 rounded-2xl text-xs font-extrabold shadow-lg hover:shadow-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer active:scale-95 whitespace-nowrap bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)]"
          >
            <span>{t('common.buildCustomItinerary')}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>

      </div>
    </aside>
  );
});
