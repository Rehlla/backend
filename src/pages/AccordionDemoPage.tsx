import * as React from 'react';

import { InteractiveImageAccordion } from '@/components/ui/interactive-image-accordion';
import { CONCIERGE_SERVICES } from '@/components/home/concierge/conciergeData';
import { useLanguage } from '@/i18n/LanguageContext';
// Relative on purpose: vite.config.ts aliases '@/components|lib|i18n|pages' but
// maps bare '@' to the repo root, so '@/context/...' resolves to <root>/context
// and the dev server 404s the module.
import { useTrip } from '../context/TripContext';

/**
 * Design-system demo for the interactive image accordion. Reachable at
 * /design/accordion, next to the scheduler demo at /design.
 *
 * It is driven by the six real concierge doors — real routes, real shipped
 * assets, real translation keys — so the component is exercised with
 * production content in both languages rather than placeholder slides, and
 * carries no copy of its own to translate.
 */
export const AccordionDemoPage: React.FC = () => {
  const { isRTL, t } = useLanguage();
  const { navigateTo } = useTrip();
  const [active, setActive] = React.useState(0);

  const items = CONCIERGE_SERVICES.map((service) => ({
    id: service.id,
    title: t(service.labelKey),
    imageUrl: service.image,
  }));

  const openService = CONCIERGE_SERVICES[active];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="min-h-screen bg-[var(--bg-canvas)] px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
          {t('concierge.services.eyebrow')}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-[var(--text-primary)] text-balance sm:text-5xl">
          {t('concierge.services.title')}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--text-secondary)]">
          {t('concierge.services.subtitle')}
        </p>

        <InteractiveImageAccordion
          items={items}
          label={t('concierge.services.title')}
          activeIndex={active}
          onActiveChange={setActive}
          onSelect={(item) => {
            const service = CONCIERGE_SERVICES.find((s) => s.id === item.id);
            if (service) navigateTo(service.route);
          }}
          className="mt-10"
        />

        {/* Live readout of the open panel: the accordion's own state, in the
            service's own words — no demo copy to translate. */}
        <p className="mt-5 min-h-[1.5rem] text-sm text-[var(--text-secondary)]">
          {openService ? t(openService.lineKey) : null}
        </p>
      </div>
    </div>
  );
};
