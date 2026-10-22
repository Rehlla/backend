import React, { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useDestination } from '../../../context/DestinationContext';
import { DESTINATIONS, type DestinationId } from '../../../design/destinations';
import { HERO_VEIL_DEFAULT } from '../../../shared/homeSections';
import type { HeroContent } from './homeLayout';

/**
 * Home hero — one photograph per destination, one thesis, two actions.
 *
 * Switching destination is the moment the place "arrives" (brand board §03):
 *   1. DestinationContext crossfades the page palette (View Transitions).
 *   2. Once that settles (`settledDestinationId`), the new photograph comes
 *      into focus — opacity, a blur that clears and a slight pull back, at
 *      the destination's own tempo — while the old one drifts out behind it.
 *   3. The headline lines rise in one after another.
 * Keying on the settled destination keeps the photo out of the crossfade
 * snapshot, so the two motions run in sequence instead of fighting.
 *
 * At rest the photo breathes with a very slow Ken Burns drift. Reduced
 * motion: a short crossfade, no drift, no blur.
 *
 * Copy: Dahab keeps the CMS-editable headline (`hero` in homeLayout.ts);
 * Nuweiba and Siwa use their translated lines until the CMS is destination
 * aware. The scrim is built from the canvas token, so text contrast follows
 * the theme and the destination palette automatically.
 */

interface HeroCopy {
  eyebrow: string;
  titleA: string;
  titleB?: string;
  subtitle: string;
}

function copyFor(id: DestinationId, hero: HeroContent | undefined, t: (k: string) => string): HeroCopy {
  if (id === 'dahab') {
    // When a CMS hero is provided, use only titleA — the hardcoded "meets the sea"
    // titleB must not render alongside it to avoid the visual glitch (orphaned orange italic).
    // When there is no CMS hero, fall back to the default titleB.
    return {
      eyebrow: t('concierge.hero.eyebrow'),
      titleA: hero?.titleA ?? t('concierge.hero.titleA'),
      titleB: !hero ? t('concierge.hero.titleB') : undefined,
      subtitle: hero?.subtitle ?? t('concierge.hero.subtitle'),
    };
  }
  return {
    eyebrow: t(`hero.${id}.eyebrow`),
    titleA: t(`hero.${id}.titleA`),
    titleB: t(`hero.${id}.titleB`),
    subtitle: t(`hero.${id}.subtitle`),
  };
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const ConciergeHero: React.FC<{
  hero?: HeroContent;
  onPlan: () => void;
  onExplore: () => void;
}> = ({ hero, onPlan, onExplore }) => {
  const { t, isRTL, language } = useLanguage();
  const { settledDestinationId } = useDestination();
  const reduce = useReducedMotion();
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const id = settledDestinationId;
  const d = DESTINATIONS[id];
  // The CMS hero photo is Dahab's; other places use their own photograph.
  const cmsImage = id === 'dahab' && hero?.imageUrl && !failed[hero.imageUrl] ? hero.imageUrl : null;
  const image = cmsImage ?? d.heroImage;
  const copy = copyFor(id, hero, t);
  // Slower places arrive more slowly: Dahab ~1.2s, Nuweiba ~1.5s, Siwa ~1.8s.
  const arrive = reduce ? 0.2 : 1.2 * (1 + (d.motion.stagger - 1) * 0.4);

  const k = (hero?.veil ?? HERO_VEIL_DEFAULT) / HERO_VEIL_DEFAULT;
  const stop = (base: number) => `${Math.round(base * k * 100) / 100}%`;
  const side = isRTL ? 'to left' : 'to right';

  const line = (i: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 28, filter: 'blur(8px)' },
    animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    exit: reduce ? { opacity: 0 } : { opacity: 0, y: -14, filter: 'blur(4px)', transition: { duration: 0.35, ease: EASE_OUT } },
    transition: { duration: reduce ? 0.2 : 0.9, ease: EASE_OUT, delay: reduce ? 0 : 0.25 + i * 0.12 * d.motion.stagger },
  });

  return (
    <section
      data-home-section="hero"
      aria-label={t('hero.region', { place: d.name[language] })}
      className="relative isolate w-full overflow-hidden bg-dg-bg text-dg-ink"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <AnimatePresence initial={false}>
          <motion.div
            key={image}
            className="absolute inset-0"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.12, filter: 'blur(14px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
            transition={{ duration: arrive, ease: EASE_OUT }}
          >
            <motion.img
              src={image}
              alt=""
              fetchPriority="high"
              decoding="async"
              onError={() => cmsImage && setFailed((f) => ({ ...f, [cmsImage]: true }))}
              className="h-full w-full object-cover"
              style={{ objectPosition: d.heroFocus ?? '50% 50%' }}
              animate={reduce ? undefined : { scale: [1, 1.07], x: ['0%', isRTL ? '1.2%' : '-1.2%'] }}
              transition={reduce ? undefined : { duration: 26, ease: 'linear', repeat: Infinity, repeatType: 'mirror' }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Reading scrim, made of the canvas colour so it follows theme and place. */}
        <div
          className="absolute inset-0 transition-[background-image] duration-700"
          style={{
            backgroundImage: `linear-gradient(${side}, color-mix(in oklab, var(--dg-bg) ${stop(86)}, transparent) 0%, color-mix(in oklab, var(--dg-bg) ${stop(64)}, transparent) 42%, color-mix(in oklab, var(--dg-bg) ${stop(14)}, transparent) 78%, transparent 100%)`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(to top, var(--dg-bg) 0%, color-mix(in oklab, var(--dg-bg) ${stop(55)}, transparent) 22%, transparent 46%, color-mix(in oklab, var(--dg-bg) ${stop(40)}, transparent) 100%)`,
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex min-h-[88svh] w-full max-w-[var(--dg-content-max)] flex-col justify-end px-[var(--dg-gutter)] pb-14 pt-32 sm:pb-20">
        <div className="max-w-2xl lg:max-w-3xl">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={id}>
              <motion.p
                {...line(0)}
                className="inline-flex items-center gap-2 rounded-full border border-dg-line bg-dg-chrome px-3.5 py-1.5 text-[0.8125rem] font-medium text-dg-ink-2 backdrop-blur-md"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-dg-action" aria-hidden="true" />
                {copy.eyebrow}
              </motion.p>

              <h1 className="mt-5 font-dg-display text-[2.75rem] font-semibold leading-[1.04] text-balance sm:text-6xl lg:text-[5rem] [font-variation-settings:'SOFT'_100]">
                <motion.span {...line(1)} className="block">
                  {copy.titleA}
                </motion.span>
                <motion.span {...line(2)} className="block italic text-dg-highlight rtl:not-italic">
                  {copy.titleB}
                </motion.span>
              </h1>

              <motion.p {...line(3)} className="mt-5 max-w-xl text-base leading-relaxed text-dg-ink-2 sm:text-lg">
                {copy.subtitle}
              </motion.p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onPlan}
              className="group inline-flex h-[52px] items-center justify-between gap-5 rounded-full bg-dg-action ps-7 pe-2 text-[0.9375rem] font-semibold text-dg-action-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.22)] transition-[transform,background-color] duration-300 ease-out hover:bg-dg-action-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-dg-action active:scale-[0.985] sm:justify-center"
            >
              {t('concierge.hero.plan')}
              <span
                className="grid h-9 w-9 place-items-center rounded-full bg-dg-action-ink/10 transition-transform duration-300 ease-out group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              >
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </span>
            </button>
            <button
              type="button"
              onClick={onExplore}
              className="inline-flex h-[52px] items-center justify-center rounded-full border border-dg-ink/25 bg-dg-bg/20 px-7 text-[0.9375rem] font-medium text-dg-ink backdrop-blur-md transition-[border-color,background-color] duration-300 ease-out hover:border-dg-ink/50 hover:bg-dg-bg/35 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-dg-ink active:scale-[0.985]"
            >
              {t('hero.explore', { place: d.name[language] })}
            </button>
          </div>

          <p className="mt-6 text-[0.8125rem] text-dg-ink-3">{t('concierge.hero.note')}</p>
        </div>
      </div>
    </section>
  );
};
