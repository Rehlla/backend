import React from 'react';
import { Sparkles, Sun, Waves, Wind, CalendarDays } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import type { ResearchOverview, SeasonRow } from '../../hooks/useResearchOverview';
import { pick, currentMonthNumber } from '../../hooks/useResearchOverview';
import type { CmsHomepageSection } from '../../services/api';

interface ChartSeasonStripProps {
  overview?: ResearchOverview | null;
  cmsSection?: CmsHomepageSection | null;
}

export const ChartSeasonStrip: React.FC<ChartSeasonStripProps> = ({ overview, cmsSection }) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  // CMS visibility flag: hide the strip from the dashboard (Homepage tab).
  if (cmsSection && cmsSection.visible === 0) return null;

  if (!overview || overview.seasonal.length === 0) return null;

  const monthNum = currentMonthNumber();
  const season: SeasonRow | undefined =
    overview.seasonal.find((s) => s.month === monthNum) ?? overview.seasonal[0];

  if (!season) return null;

  const monthNamesEn = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthNamesAr = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthLabel = isAr ? monthNamesAr[monthNum - 1] : monthNamesEn[monthNum - 1];

  return (
    <section
      id="this-month-in-dahab"
      aria-label={isAr ? 'دهب هذا الشهر' : 'This month in Dahab'}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
    >
      <div className="relative rounded-3xl overflow-hidden border border-[var(--border-subtle)] chart-card shadow-2xl">
        {/* Ambient Dahab seasonal photo backdrop */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src="/images/hero/golden-beach.jpg"
            alt="Dahab Season"
            loading="lazy"
            className="w-full h-full object-cover object-center scale-105 opacity-20 dark:opacity-15 transition-transform duration-1000"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-[var(--bg-canvas)]/96 via-[var(--bg-canvas)]/90 to-[var(--bg-canvas)]/75 backdrop-blur-[1.5px]"
          />
        </div>

        <div className="absolute inset-x-0 top-0 h-px chart-shimmer z-10" aria-hidden="true" />
        <div className="relative z-10 p-6 sm:p-8 text-[var(--text-primary)]">
          {/* Header: the heading owns the section */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CalendarDays className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                <span className="chart-badge chart-badge-live text-[11px] font-semibold">
                  {isAr ? `شهر ${monthLabel}` : `Season · ${monthLabel}`}
                </span>
              </div>
              <h2 className="chart-heading text-2xl sm:text-3xl font-bold tracking-tight">
                {isAr ? `دهب في ${monthLabel}` : `This Month in ${monthLabel}`}
                <span className="chart-heading-accent"> {isAr ? 'دلوقتي' : '· Right Now'}</span>
              </h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] max-w-md md:text-end leading-relaxed">
              {pick(season.description, language)}
            </p>
          </div>

          {/* Metric row */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="chart-glass rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                <Sun className="w-3.5 h-3.5 text-[var(--accent-secondary)]" aria-hidden="true" />
                {isAr ? 'الجو' : 'Air'}
              </div>
              <span className="text-xl sm:text-2xl font-bold">{pick(season.airC, language)}</span>
            </div>
            <div className="chart-glass rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                <Waves className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                {isAr ? 'البحر' : 'Sea'}
              </div>
              <span className="text-xl sm:text-2xl font-bold">{pick(season.seaC, language)}</span>
            </div>
            <div className="chart-glass rounded-2xl p-4 border border-[var(--border-subtle)] flex flex-col gap-1 col-span-2 md:col-span-1">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)]">
                <Wind className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                {isAr ? 'الرياح' : 'Wind'}
              </div>
              <span className="text-lg sm:text-xl font-bold leading-tight">{pick(season.wind, language)}</span>
            </div>
          </div>

          {/* Recommended + urgency */}
          <div className="mt-5 flex flex-col lg:flex-row lg:items-center gap-4 justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                {isAr ? 'الأفضل هذا الشهر:' : 'Best this month:'}
              </span>
              {season.recommended.map((rec, i) => (
                <span
                  key={i}
                  className="text-xs font-semibold bg-[var(--surface-container)] border border-[var(--border-subtle)] rounded-full px-3 py-1 text-[var(--text-primary)]"
                >
                  {pick(rec, language)}
                </span>
              ))}
            </div>
            {season.urgency && (
              <span className="text-xs text-[var(--accent-secondary)] font-semibold bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/25 rounded-full px-3 py-1.5">
                {pick(season.urgency, language)}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
