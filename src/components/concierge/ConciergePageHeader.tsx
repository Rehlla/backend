import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

interface ConciergePageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  /** Photographic backdrop — must be a shipped public/images asset. */
  image: string;
  imageAlt?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  compact?: boolean;
  /**
   * Imagery-forward pages (Explore, Stays) pass bright to soften the scrims
   * so the photography carries the page. Text stays white-on-photo — the
   * remaining scrim still guarantees contrast.
   */
  bright?: boolean;
}

/**
 * Shared internal-page header — the concierge photographic band.
 *
 * One pattern for every internal page: full-bleed photograph, calm
 * theme-aware scrim, uppercase gold eyebrow, serif display title, quiet
 * subtitle, optional actions/meta row. Replaces the three copies of the
 * gradient-wash hero (Explore/Hotels/Restaurants) and the flat strips
 * elsewhere, so all pages read as one product.
 *
 * Text is always white-on-photo (the scrim guarantees contrast in every
 * theme); page body returns to theme tokens below the band.
 */
export const ConciergePageHeader: React.FC<ConciergePageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  image,
  imageAlt = '',
  actions,
  meta,
  compact = false,
  bright = false,
}) => {
  const { isRTL } = useLanguage();
  const scrimStrength = bright ? 0.62 : 1;

  return (
    <section
      dir={isRTL ? 'rtl' : 'ltr'}
      className="relative w-full overflow-hidden bg-[var(--bg-canvas)] text-white"
    >
      <div className="absolute inset-0" aria-hidden="true">
        <img
          src={image}
          alt=""
          role="presentation"
          loading="eager"
          decoding="async"
          className="h-full w-full object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: isRTL
              ? 'linear-gradient(to left, color-mix(in oklab, var(--bg-canvas) 88%, transparent) 0%, color-mix(in oklab, var(--bg-canvas) 55%, transparent) 45%, color-mix(in oklab, var(--bg-canvas) 12%, transparent) 78%, transparent 100%)'
              : 'linear-gradient(to right, color-mix(in oklab, var(--bg-canvas) 88%, transparent) 0%, color-mix(in oklab, var(--bg-canvas) 55%, transparent) 45%, color-mix(in oklab, var(--bg-canvas) 12%, transparent) 78%, transparent 100%)',
            opacity: scrimStrength,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(to top, color-mix(in oklab, var(--bg-canvas) 92%, transparent) 0%, transparent 45%, color-mix(in oklab, var(--bg-canvas) 30%, transparent) 100%)',
            opacity: scrimStrength,
          }}
        />
      </div>

      <div
        className={`relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-end px-4 sm:px-6 lg:px-8 ${
          compact ? 'min-h-[300px] pb-10 pt-24 sm:min-h-[340px]' : 'min-h-[380px] pb-12 pt-28 sm:min-h-[420px]'
        }`}
      >
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-secondary)]">
            <span className="me-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)] align-middle" aria-hidden="true" />
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-white sm:text-5xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              {subtitle}
            </p>
          )}
          {actions && <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>}
          {meta && <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/60">{meta}</div>}
        </div>
      </div>
      {imageAlt ? <span className="sr-only">{imageAlt}</span> : null}
    </section>
  );
};
