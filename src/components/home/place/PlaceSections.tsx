import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Clock, CalendarDays, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTrip } from '../../../context/TripContext';
import { useDestination } from '../../../context/DestinationContext';
import { useResearchOverview, pick } from '../../../hooks/useResearchOverview';
import { useReadyProgrammes } from '../../../hooks/useReadyProgrammes';
import { EDITORIAL_PICKS, STORY_FRAMES_BY_DESTINATION } from '../../../data/destinationEditorial';
import { photoForActivity, experienceSlugForActivity } from '../../../data/activityPhotos';
import { STORY_FRAMES } from '../concierge/conciergeData';
import { presetPlan } from '../../../services/planPreset';
import { DestinationScene } from '../../brand/DestinationScene';
import { SectionHeader } from '../../ui/feedback';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { PriceTag } from '../../ui/price-tag';
import type { DestinationId } from '../../../design/destinations';

/**
 * Destination-aware home sections (plan §08): picks, the planner prompt,
 * ready-made trips and stories. Each reads the destination being explored,
 * so switching place swaps the whole page, not just its colours. Shared
 * pattern: a section header, then a horizontally swiping row on phones that
 * becomes a grid from `sm` (thumb-friendly, no hidden overflow), with items
 * rising in at the destination's tempo.
 */

/** `id` is the section's CMS anchor (src/shared/homeSections.ts); `labelId` names its heading. */
const Shell: React.FC<{ id: string; labelId: string; children: React.ReactNode; className?: string }> = ({ id, labelId, children, className }) => (
  <section id={id} aria-labelledby={labelId} className={cn('mx-auto w-full max-w-[var(--dg-content-max)] px-[var(--dg-gutter)] py-10 sm:py-14 scroll-mt-[calc(var(--dg-topbar-h)+var(--dg-safe-top)+12px)]', className)}>
    {children}
  </section>
);

/** Swipe row on phones (bleeds to the screen edge), grid from sm. */
const Rail: React.FC<{ children: React.ReactNode; cols?: string }> = ({ children, cols = 'sm:grid-cols-3' }) => (
  <ul
    className={cn(
      'mt-6 -mx-[var(--dg-gutter)] flex snap-x snap-mandatory gap-3 overflow-x-auto px-[var(--dg-gutter)] pb-2 no-scrollbar',
      'sm:mx-0 sm:grid sm:overflow-visible sm:px-0 sm:pb-0',
      cols,
    )}
  >
    {children}
  </ul>
);

const useRise = () => {
  const reduce = useReducedMotion();
  const { destination } = useDestination();
  return (i: number) => ({
    initial: reduce ? false : ({ opacity: 0, y: 18 } as const),
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { ...destination.motion.spring, delay: reduce ? 0 : i * 0.07 * destination.motion.stagger },
  });
};

const Media: React.FC<{ src?: string; destination: DestinationId; alt?: string }> = ({ src, destination, alt = '' }) =>
  src ? (
    <img src={src} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-700 ease-dg-out group-hover:scale-[1.04]" />
  ) : (
    <DestinationScene id={destination} className="h-full w-full" />
  );

// --------------------------------------------------------------------- picks

export const PlacePicks: React.FC = () => {
  const { t, language } = useLanguage();
  const { navigateTo } = useTrip();
  const { destinationId, destination } = useDestination();
  const overview = useResearchOverview();
  const rise = useRise();

  const live = destination.catalogue === 'live';
  const items = useMemo(() => {
    if (live) {
      return (overview?.experiences ?? []).slice(0, 6).map((e) => ({
        id: e.id,
        title: pick(e.name, language),
        meta: pick(e.duration, language),
        // The price checkout charges when the outing is bookable; the local
        // market range otherwise.
        price: e.fromPriceEGP != null ? e.fromPriceEGP.toLocaleString('en-US') : e.priceEgp,
        image: photoForActivity(pick(e.name, 'en')),
        onOpen: () =>
          e.activityId
            ? navigateTo('/experiences', { experienceSlug: experienceSlugForActivity(e.activityId) })
            : navigateTo('/rentals'),
      }));
    }
    return (EDITORIAL_PICKS[destinationId] ?? []).map((p) => ({
      id: p.id,
      title: p.title[language],
      meta: p.meta[language],
      price: null as string | null,
      image: p.image,
      onOpen: () => {
        presetPlan(destinationId, p.vibes);
        navigateTo('/plan');
      },
    }));
  }, [live, overview, destinationId, language, navigateTo]);

  if (items.length === 0) return null;

  return (
    <Shell labelId="place-picks-title" id="concierge-experiences">
      <SectionHeader
        title={<span id="place-picks-title">{t('home.place.picks.title', { place: destination.name[language] })}</span>}
        eyebrow={live ? undefined : <Badge tone="neutral">{t('shell.destination.early')}</Badge>}
      />
      <p className="mt-2 max-w-[56ch] text-dg-ink-2">{live ? t('home.place.picks.live') : t('home.place.picks.early')}</p>
      <Rail key={destinationId}>
        {items.map((item, i) => (
          <motion.li key={item.id} {...rise(i)} className="w-[78%] shrink-0 snap-start sm:w-auto">
            <article className="group h-full overflow-hidden rounded-dg-xl border border-dg-line bg-dg-surface">
              <button type="button" onClick={item.onOpen} className="block w-full text-start">
                <span className="relative block aspect-[4/3] overflow-hidden">
                  <Media src={item.image} destination={destinationId} />
                  <span className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent" aria-hidden="true" />
                  <span className="absolute bottom-3 start-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[0.75rem] font-medium text-white backdrop-blur-sm">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    {item.meta}
                  </span>
                </span>
                <span className="flex items-end justify-between gap-3 p-4">
                  <span className="font-semibold leading-snug text-dg-ink">{item.title}</span>
                  {item.price ? (
                    <span className="shrink-0 text-[0.8125rem] font-semibold tabular-nums text-dg-ink-2" dir="ltr">
                      EGP {item.price}
                    </span>
                  ) : (
                    <span className="shrink-0 text-[0.8125rem] font-semibold text-dg-action">{t('home.place.picks.plan')}</span>
                  )}
                </span>
              </button>
            </article>
          </motion.li>
        ))}
      </Rail>
    </Shell>
  );
};

// ----------------------------------------------------------- planner prompt

export const PlanPrompt: React.FC = () => {
  const { t } = useLanguage();
  const { navigateTo } = useTrip();
  const { destinationId } = useDestination();
  const reduce = useReducedMotion();

  return (
    <Shell labelId="plan-prompt-title" id="concierge-intent" className="py-6 sm:py-8">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.98 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-dg-xl border border-dg-line bg-dg-surface p-6 sm:p-8"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-16 h-56 w-56 rounded-full opacity-60 blur-2xl"
          style={{ background: 'conic-gradient(from 200deg, var(--dg-action), var(--dg-highlight), var(--dg-action))' }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 id="plan-prompt-title" className="font-dg-display text-[1.5rem] sm:text-[2rem] font-semibold leading-tight text-dg-ink text-balance">
              {t('home.place.prompt.title')}
            </h2>
            <p className="mt-1.5 text-dg-ink-2">{t('home.place.prompt.body')}</p>
          </div>
          <Button
            size="lg"
            leadingIcon={<Sparkles className="h-4 w-4" />}
            onClick={() => {
              presetPlan(destinationId);
              navigateTo('/plan');
            }}
          >
            {t('home.place.prompt.cta')}
          </Button>
        </div>
      </motion.div>
    </Shell>
  );
};

// -------------------------------------------------------------------- plans

export const PlacePlans: React.FC = () => {
  const { t, language } = useLanguage();
  const { navigateTo } = useTrip();
  const { destinationId, destination } = useDestination();
  const programmes = useReadyProgrammes();
  const rise = useRise();

  if (programmes.length === 0) return null;

  // Programmes without a hero image borrow a real photo of the same place
  // (the gallery frames) instead of the flat illustration; and two trips fill
  // two wide columns rather than leaving a third of the row empty.
  const shown = programmes.slice(0, 3);
  const photos =
    destinationId === 'dahab'
      ? STORY_FRAMES.map((f) => f.src)
      : (STORY_FRAMES_BY_DESTINATION[destinationId] ?? []).map((f) => f.src);
  const photoFor = (i: number) => (photos.length ? photos[(i + 1) % photos.length] : undefined);
  const cols = shown.length === 1 ? 'sm:grid-cols-1' : shown.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3';
  const shape = shown.length < 3 ? 'sm:aspect-[16/10]' : 'sm:aspect-[3/4]';

  return (
    <Shell labelId="place-plans-title" id="concierge-itineraries">
      <SectionHeader
        title={<span id="place-plans-title">{t('home.place.plans.title', { place: destination.name[language] })}</span>}
        action={
          <Button
            variant="ghost"
            size="sm"
            trailingIcon={<ArrowRight className="h-4 w-4 rtl:rotate-180" />}
            onClick={() => {
              presetPlan(destinationId);
              navigateTo('/plan');
            }}
          >
            {t('home.place.plans.all')}
          </Button>
        }
      />
      <Rail key={destinationId} cols={cols}>
        {shown.map((p, i) => (
          <motion.li key={p.id} {...rise(i)} className="w-[82%] shrink-0 snap-start sm:w-auto">
            <button
              type="button"
              onClick={() => (destination.catalogue === 'live' ? navigateTo('/programs', { programSlug: p.id }) : (presetPlan(destinationId), navigateTo('/plan')))}
              className={cn('group relative block aspect-[4/5] w-full overflow-hidden rounded-dg-xl text-start', shape)}
            >
              <span className="absolute inset-0">
                <Media src={p.heroImage || photoFor(i)} destination={destinationId} />
              </span>
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden="true" />
              <span className="absolute top-3 start-3">
                <Badge tone="onMedia" icon={<CalendarDays className="h-3 w-3" />}>
                  {t('plan.card.days', { n: p.durationDays })}
                </Badge>
              </span>
              <span className="absolute inset-x-0 bottom-0 grid gap-1.5 p-4 text-white">
                <span className="font-dg-display text-xl font-semibold leading-tight">{language === 'ar' ? p.titleAr : p.title}</span>
                <span className="line-clamp-2 text-[0.8125rem] text-white/85">{language === 'ar' ? p.taglineAr : p.tagline}</span>
                <span className="mt-1 [&_*]:!text-white [&_span:last-child]:!text-white/75">
                  <PriceTag amountEGP={p.startingPriceEGP} from unit="perPerson" size="sm" layout="inline" />
                </span>
              </span>
            </button>
          </motion.li>
        ))}
      </Rail>
    </Shell>
  );
};

// ------------------------------------------------------------------ stories

export const PlaceStories: React.FC = () => {
  const { t, language } = useLanguage();
  const { destinationId, destination } = useDestination();
  const rise = useRise();

  const frames =
    destinationId === 'dahab'
      ? STORY_FRAMES.slice(0, 5).map((f) => ({ src: f.src, caption: language === 'ar' ? f.captionAr : f.captionEn }))
      : (STORY_FRAMES_BY_DESTINATION[destinationId] ?? []).map((f) => ({ src: f.src, caption: f.caption[language] }));
  if (frames.length === 0) return null;

  return (
    <Shell labelId="place-stories-title" id="concierge-stories">
      <SectionHeader title={<span id="place-stories-title">{t('home.place.stories.title', { place: destination.name[language] })}</span>} />
      {destination.catalogue === 'early' && (
        <p className="mt-2 text-[0.8125rem] text-dg-ink-3">{t('home.place.stories.note', { place: destination.name[language] })}</p>
      )}
      <ul key={destinationId} className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {frames.map((f, i) => (
          <motion.li
            key={f.src}
            {...rise(i)}
            className={cn('group relative overflow-hidden rounded-dg-lg', i === 0 ? 'col-span-2 row-span-2 aspect-square sm:aspect-auto' : 'aspect-[4/5]')}
          >
            <img src={f.src} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-dg-out group-hover:scale-[1.05]" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3 text-[0.8125rem] font-medium text-white">
              {f.caption}
            </span>
          </motion.li>
        ))}
      </ul>
    </Shell>
  );
};
