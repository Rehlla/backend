import React from 'react';
import { useTrip } from '../../../context/TripContext';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useHomepageContent } from '../../../hooks/useCMSContent';
import type { HomeSectionId } from '../../../shared/homeSections';
import { resolveHomeLayout, resolveHeroContent } from './homeLayout';
import { ConciergeHero } from './ConciergeHero';
import { FutureRideHome } from './FutureRideHome';
import { ConciergeNextStep } from './ConciergeNextStep';
import { PlaceCategories } from '../place/PlaceCategories';
import { PlacePicks, PlanPrompt, PlacePlans, PlaceStories } from '../place/PlaceSections';
import { useDestination } from '../../../context/DestinationContext';
import { presetPlan } from '../../../services/planPreset';
import { FinalCTA } from '../../FinalCTA';
import { DahabFooter } from '../DahabFooter';

/**
 * Concierge homepage composition — one continuous experience.
 *
 * The order below is the product decision (HERO → NEXT STEP → SERVICES →
 * EXPERIENCES → PLAN → ITINERARIES → STORIES → CLOSING), and each section
 * owns a distinct layout so the page reads art-directed instead of a repeated
 * card grid. Since this pass the list is also the CMS's vocabulary: an
 * operator's `visible`/`sort_order` rows reorder or drop these same sections
 * (see homeLayout.ts), and the shipped order is what a database with no rows
 * renders — the CMS is an override, never a prerequisite.
 *
 * `sections` is a `Record<HomeSectionId, …>`, so adding a section to the
 * shared list without rendering it is a type error rather than a silently
 * missing block.
 */
export const ConciergeHome: React.FC = () => {
  const { navigateTo, lifecycle } = useTrip();
  const { destinationId } = useDestination();
  const planTrip = () => {
    presetPlan(destinationId);
    navigateTo('/plan');
  };
  const { language, isRTL, t } = useLanguage();
  const { data } = useHomepageContent();

  const layout = resolveHomeLayout(data?.sections);
  const hero = resolveHeroContent(data?.hero ?? null, language);

  // Empty-state guard when CMS returns zero visible sections
  if (!layout || layout.length === 0) {
    return (
      <div className="min-h-screen bg-dg-bg flex flex-col items-center justify-center text-center px-4 space-y-6">
        <h2 className="text-3xl font-display font-semibold text-[var(--text-primary)]">
          {t('home.empty.title', 'لسه مفيش رحلات')}
        </h2>
        <p className="text-[var(--text-secondary)]">
          {t('home.empty.body', 'رحلات جاهزة جاية قريب — اكتشف دهب دلوقتي.')}
        </p>
        <button
          onClick={() => navigateTo('/explore')}
          className="px-6 py-3 rounded-xl bg-[var(--accent-primary)] text-[var(--dg-on-accent)] font-bold"
        >
          {t('home.empty.cta', 'اكتشف دهب')}
        </button>
      </div>
    );
  }

  const sections: Record<HomeSectionId, React.ReactNode> = {
    hero: (
      <>
        <ConciergeHero
          hero={hero}
          onPlan={planTrip}
          onExplore={() => navigateTo('/explore')}
        />
        {/* P0-06: this proof line was hardcoded English inside the Arabic hero.
            Every fragment is now catalog copy. */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[13px] mt-2 text-[var(--text-secondary)]">
          <span aria-hidden="true">★★★★★</span>
          <span>{t('home.socialProof.rating', '4.8/5')}</span>
          <span>{t('home.socialProof.travelers', 'من 2,341 مسافر')}</span>
          <span>{t('home.socialProof.verifiedStays', '+50 إقامة موثّقة')}</span>
          <span>{t('home.socialProof.freeCancel', 'إلغاء مجاني')}</span>
        </div>
        <FutureRideHome />
      </>
    ),
    // While someone is still discovering, the hero already asks the one
    // question this card would; it earns its place once a trip exists.
    next_step: lifecycle?.lifecyclePhase && lifecycle.lifecyclePhase !== 'DISCOVERY' ? <ConciergeNextStep /> : null,
    // Destination-aware sections (components/home/place): the section ids
    // stay the CMS vocabulary, so operator ordering keeps working.
    services: <PlaceCategories />,
    experiences: <PlacePicks />,
    intent: <PlanPrompt />,
    itineraries: <PlacePlans />,
    stories: <PlaceStories />,
    final_cta: (
      <FinalCTA
        onPlanTripClick={planTrip}
        onExploreClick={() => navigateTo('/explore')}
      />
    ),
    footer: <DahabFooter navigateTo={navigateTo} />
  };

  return (
    /* One wrapper, ordered children. Still a div, not a <main>: App already
       renders the page's <main> (id="main-app-content") and HTML forbids
       nesting one inside another — the two landmarks landed on top of each
       other in the accessibility tree. The id stays because the splash-gate
       e2e specs locate the homepage by `#concierge-main`, and it now spans the
       whole composed page so a reordered section is still inside it. */
    <div
      id="concierge-main"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="w-full bg-dg-bg text-dg-ink"
    >
      {layout.map(id => (
        <React.Fragment key={id}>{sections[id]}</React.Fragment>
      ))}
    </div>
  );
};
