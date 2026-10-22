import React from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { SectionReveal } from './common/SectionReveal';
import { useDestination } from '../context/DestinationContext';
import type { CmsHomepageSection } from '../services/api';

interface FinalCTAProps {
  onPlanTripClick: () => void;
  onExploreClick: () => void;
  cmsSection?: CmsHomepageSection | null;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({ onPlanTripClick, onExploreClick, cmsSection }) => {
  // This section existed fully built but was never rendered anywhere, and was
  // English-only while the rest of the product is bilingual.
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';
  // The close follows the destination picker like every other home section;
  // it used to say "Dahab" while the page above it was about Nuweiba or Siwa.
  const { destination } = useDestination();
  const place = destination.name[language];

  // CMS-editable copy (Homepage tab → finalcta section), per-language fallback
  // to the compiled strings below. Layout stays compiled; only the words an
  // editor would change are data-driven.
  const pick = (path: string, fallbackEn: string, fallbackAr: string): string => {
    const node = path.split('.').reduce<any>(
      (acc, key) => (acc == null ? undefined : acc[key]),
      cmsSection?.config
    );
    const value = node && typeof node === 'object' ? (node as any)[language] : node;
    return value || (isAr ? fallbackAr : fallbackEn);
  };

  if (cmsSection && cmsSection.visible === 0) return null;

  return (
    <section
      id="final-cta-section"
      aria-label={isAr ? `ابدأ رحلتك في ${place}` : `Start your ${place} journey`}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="group relative py-16 sm:py-20 overflow-hidden chart-gradient-section scroll-mt-[calc(var(--dg-topbar-h)+var(--dg-safe-top)+12px)]"
    >
      {/* Chart depth overlay: night ground settling into abyss-night */}
      <div className="absolute inset-0 z-0 chart-gradient-hero opacity-60" />
      {/* Atmospheric Dahab Sunset Photography */}
      <div className="absolute inset-0 z-0">
        <img
          src="/images/hero/gulf-sunset.jpg"
          alt=""
          className="chart-kenburns w-full h-full object-cover object-center opacity-40 mix-blend-luminosity"
        />
        {/* `via` is the stop the headline and the supporting line sit on. At /80
            the supporting copy measured 4.15:1 on a 390px viewport (lagoon-
            breeze) where the wider text wraps onto the paler part of the
            frame; /88 holds the reading band without flattening the sunset. */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-canvas)] via-[var(--bg-canvas)]/88 to-transparent" />
      </div>
      {/* Shoreline glass divider at the top of the close */}
      <div className="absolute inset-x-0 -top-px h-px chart-gradient-hero opacity-80" />

      {/* Content — cascades badge → headline → supporting → CTAs → footnote
          as the close scrolls in; static under reduced motion. */}
      <SectionReveal stagger={90} offset={20} className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        
        {/* Ember wayfinder badge */}
        <div className="chart-badge chart-badge-ember mb-6">
          <Compass className="w-3.5 h-3.5" />
          <span>{pick('badge', 'Start your journey', 'ابدأ رحلتك')}</span>
        </div>

        {/* Headline: light display with a serif-italic turn on the second
            line. Same ink throughout — the italic carries the voice, not a
            contrasting color.

            Ink is `--text-primary`, not `text-white`: the backdrop is
            `chart-gradient-section` + a canvas-mixed gradient overlay, so on
            the light themes it resolves to near-white and white type measured
            1.04:1 at the headline (only a black photograph underneath could
            have saved it, at 4.06:1). The token is white on the dark themes
            and dark ink on the light ones. */}
        <h2
          id="final-cta-headline"
          className="chart-heading text-4xl sm:text-6xl md:text-7xl text-[var(--text-primary)] tracking-tight leading-[1.05] text-balance"
        >
          {pick('headline', `Ready to discover ${place}`, `جاهز تكتشف ${place}`)} <br className="hidden sm:inline" />
          <span className="chart-heading-accent">{pick('headlineAccent', 'your way?', 'على مزاجك؟')}</span>
        </h2>

        {/* Supporting text */}
        {/* `--text-secondary`, not `--text-muted`: this line sits on the
            photograph rather than on a solid canvas, and `--text-muted` is the
            one tier the veiled frame cannot carry (4.15:1 at 390px in the
            light themes). Same tier as the hero's subtitle on the same problem. */}
        <p
          id="final-cta-supporting-text"
          className="mt-6 text-base sm:text-xl text-[var(--text-secondary)] font-normal leading-relaxed max-w-xl mx-auto text-balance"
        >
          {pick('supporting', 'Start with a few simple questions and build your trip around you.', 'جاوب على كام سؤال بسيط، وإحنا نبنيلك الرحلة على مقاسك.')}
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-5">
          <button
            id="final-cta-plan-trip-btn"
            type="button"
            onClick={onPlanTripClick}
            className="chart-cta-primary w-full sm:w-auto inline-flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 group"
          >
            <span>{pick('ctaPrimary', 'Plan My Trip', 'خطط لرحلتي')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform rtl:rotate-180" />
          </button>

          {/* No ink class here on purpose: `.chart-cta-secondary` already sets
              `color: var(--text-primary)`, which is right in both modes
              (measured 16.16:1 dark / 14.45:1 light). The `text-white` that used
              to sit here never applied — same specificity, earlier source order
              — and would have been a 1.05:1 trap the day the cascade changed. */}
          <button
            id="final-cta-explore-btn"
            type="button"
            onClick={onExploreClick}
            className="chart-cta-secondary w-full sm:w-auto inline-flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
          >
            <span>{pick('ctaSecondary', `Explore ${place}`, `استكشف ${place}`)}</span>
          </button>
        </div>

        <p className="mt-8 text-sm font-normal text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
          {pick('footnote', `Explore without signing up. Picks come from ${place} locals.`, `الاستكشاف من غير تسجيل، والترشيحات من ناس ${place} نفسها.`)}
        </p>

      </SectionReveal>
    </section>
  );
};
