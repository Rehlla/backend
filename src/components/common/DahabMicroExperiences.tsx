import React from 'react';
import { MapPin, Clock, User, Repeat, ArrowRight, Compass } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import type { ResearchOverview } from '../../hooks/useResearchOverview';
import { pick } from '../../hooks/useResearchOverview';
import type { CmsHomepageSection } from '../../services/api';

interface DahabMicroExperiencesProps {
  overview?: ResearchOverview | null;
  onPlanClick?: () => void;
  cmsSection?: CmsHomepageSection | null;
}

const EXPERIENCE_PHOTOS: Record<string, string> = {
  'act-laguna-kitesurf': '/images/hero/blue-lagoon-kitesurf.jpg',
  'act-promenade-bike': '/images/hero/camels-beach.jpg',
  'act-canyon-dive': '/images/attractions/underwater-elephant.jpg',
  'act-twilat-sunset': '/images/attractions/bouldering-wadi-gnai.jpg',
};

export const DahabMicroExperiences: React.FC<DahabMicroExperiencesProps> = ({
  overview,
  onPlanClick,
  cmsSection,
}) => {
  const { language, isRTL } = useLanguage();
  const { isDark } = useTheme();
  const isAr = language === 'ar';

  // CMS visibility flag: hide this rail from the dashboard (Homepage tab).
  if (cmsSection && cmsSection.visible === 0) return null;

  if (!overview || overview.experiences.length === 0) return null;

  return (
    <section
      id="dahab-micro-experiences"
      aria-label={isAr ? 'تجارب حقيقية بأسعارها' : 'Real-priced experiences'}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
    >
      <div className="relative rounded-3xl overflow-hidden border border-[var(--border-subtle)] chart-card shadow-2xl">
        {/* Ambient Dahab desert/mountain backdrop */}
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
          <img
            src="/images/attractions/sinai-desert-safari.jpg"
            alt="Sinai Backdrop"
            loading="lazy"
            className="w-full h-full object-cover object-center scale-105 opacity-15 dark:opacity-10 transition-transform duration-1000"
          />
          <div
            className={`absolute inset-0 ${
              isDark
                ? 'bg-gradient-to-r from-[var(--bg-canvas)]/96 via-[var(--bg-canvas)]/92 to-[var(--bg-canvas)]/80 backdrop-blur-[1.5px]'
                : 'bg-gradient-to-r from-[var(--bg-canvas)]/96 via-[var(--bg-canvas)]/90 to-[var(--bg-canvas)]/78 backdrop-blur-[1.5px]'
            }`}
          />
        </div>

        <div className="absolute inset-x-0 top-0 h-px chart-shimmer z-10" aria-hidden="true" />
        <div className="relative z-10 p-6 sm:p-8 text-[var(--text-primary)]">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[var(--border-subtle)] pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Compass className="w-4 h-4 text-[var(--accent-secondary)]" aria-hidden="true" />
                <span className="chart-badge chart-badge-ember text-[11px] font-semibold">
                  {isAr ? 'بأسعار محلية حقيقية' : 'Real local pricing'}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">{overview.provenance}</span>
              </div>
              <h2 className="chart-heading text-2xl sm:text-3xl font-bold tracking-tight">
                {isAr ? 'تجارب حقيقية' : 'Experiences'}
                <span className="chart-heading-accent"> {isAr ? 'بأسعارها الفعلية' : '· Priced in EGP'}</span>
              </h2>
            </div>
            <p className="text-sm text-[var(--text-secondary)] max-w-sm leading-relaxed md:text-end">
              {isAr
                ? 'أوقات وأسعار تقريبية من السوق المحلي — راجع المشغّل عند الحجز.'
                : 'Typical durations and price ranges from the local market — confirm direct at booking.'}
            </p>
          </div>

          {/* Horizontal activity rail — distinct from the featured-story
              layout above and the bento grid below, so three sections in a
              row don't read as the same repeated card wall. Snaps per-card
              so touch scrolling feels intentional, not accidental. */}
          <div
            className="flex gap-5 mt-6 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory no-scrollbar"
            style={{ scrollbarWidth: 'none' }}
          >
            {overview.experiences.map((exp) => {
              const photo = EXPERIENCE_PHOTOS[exp.id] || '/images/hero/golden-beach.jpg';
              return (
                <div
                  key={exp.id}
                  className="group relative shrink-0 snap-start w-[78%] xs:w-[65%] sm:w-[45%] lg:w-[26%] rounded-3xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--accent-primary)]/50 transition-[border-color,box-shadow] duration-300 shadow-md hover:shadow-xl flex flex-col justify-between"
                >
                  {/* Photo header */}
                  <div className="relative h-44 w-full overflow-hidden bg-stone-900">
                    <img
                      src={photo}
                      alt={pick(exp.name, language)}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
                    
                    {/* Floating Price Pill Badge */}
                    <div className="absolute top-3 end-3 z-10">
                      <span className="text-xs font-bold text-white bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 shadow-sm">
                        {isAr ? `${exp.priceEgp} ج.م` : `EGP ${exp.priceEgp}`}
                      </span>
                    </div>

                    {/* Location/Walk pill on bottom-start */}
                    {exp.walk && (
                      <div className="absolute bottom-2.5 start-3 z-10 flex items-center gap-1.5 text-xs text-white/90 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-[var(--accent-secondary)] shrink-0" aria-hidden="true" />
                        <span className="line-clamp-1">{pick(exp.walk, language)}</span>
                      </div>
                    )}
                  </div>

                  {/* Card details */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-[var(--text-primary)] text-base group-hover:text-[var(--accent-primary)] transition-colors line-clamp-1">
                        {pick(exp.name, language)}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--text-secondary)]">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" aria-hidden="true" />
                          {pick(exp.duration, language)}
                        </span>
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-[var(--brand-coral)]" aria-hidden="true" />
                          {pick(exp.skill, language)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
                          {pick(exp.modality, language)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={onPlanClick}
                      className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-[var(--surface-container)] group-hover:bg-[var(--accent-primary)] group-hover:text-[var(--accent-primary-ink)] text-[var(--text-primary)] text-xs font-bold transition-[background-color,color,transform] duration-300 cursor-pointer shadow-xs active:scale-95"
                    >
                      <span>{isAr ? 'خطط لها في رحلتك' : 'Plan into Itinerary'}</span>
                      <ArrowRight className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-1 ${isRTL ? 'rotate-180 group-hover:-translate-x-1' : ''}`} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
