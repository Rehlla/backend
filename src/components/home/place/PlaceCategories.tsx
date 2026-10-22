import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Wind, Droplets, Sunset, Thermometer } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTrip } from '../../../context/TripContext';
import { useDestination } from '../../../context/DestinationContext';
import { api, type DestinationConditionsWire } from '../../../services/api';
import { CATEGORY_DOORS, type CategoryDoor } from '../../../data/destinationEditorial';
import { presetPlan } from '../../../services/planPreset';
import { Pictogram } from '../../brand/Pictogram';
import { SectionHeader } from '../../ui/feedback';
import { haptic } from '../../../design/feedback';

/**
 * "What brings you to {place}?" — live conditions, then six doors into the
 * place, each a dimensional pictogram that answers a tap with a one-shot
 * spring (plan §06). Live destinations open their catalogue page; early
 * ones open the planner already set to that place and that wish.
 */

/**
 * HH:mm. An instant (`…Z` / with an offset, like observedAt) is shown on the
 * reader's clock; a bare wall time (sunset, already local to the place) as written.
 */
const hhmm = (iso: string | null | undefined) => {
  if (!iso || iso.length < 16) return null;
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(iso.slice(16))) return iso.slice(11, 16);
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const Conditions: React.FC = () => {
  const { t, language } = useLanguage();
  const { destinationId, destination } = useDestination();
  const [c, setC] = useState<DestinationConditionsWire | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setC(null);
    api.getDestinationConditions(destinationId, ctrl.signal).then(setC).catch(() => setC(null));
    return () => ctrl.abort();
  }, [destinationId]);

  // No reading → no strip. Never a number nobody measured.
  if (!c) return null;

  const chip = 'inline-flex items-center gap-2 rounded-dg-md border border-dg-line bg-dg-surface px-3 py-2 text-[0.8125rem] text-dg-ink-2';
  const value = 'font-semibold text-dg-ink tabular-nums [unicode-bidi:isolate]';
  return (
    <div className="grid gap-2">
      <p className="text-[0.8125rem] font-medium text-dg-ink-3">{t('home.place.live', { place: destination.name[language] })}</p>
      <div className="flex flex-wrap gap-2">
        <span className={chip}>
          <Thermometer className="h-4 w-4 text-dg-highlight" aria-hidden="true" />
          {t('home.place.air')} <b className={value} dir="ltr">{Math.round(c.airTemperatureC)}°</b>
        </span>
        <span className={chip}>
          <Wind className="h-4 w-4 text-dg-action" aria-hidden="true" />
          {t('home.place.wind')} <b className={value} dir="ltr">{Math.round(c.windKnots)} kn {c.windDirection}</b>
        </span>
        {c.waterTemperatureC !== null && (
          <span className={chip}>
            <Droplets className="h-4 w-4 text-dg-action" aria-hidden="true" />
            {t('home.place.water')} <b className={value} dir="ltr">{Math.round(c.waterTemperatureC)}°</b>
          </span>
        )}
        {hhmm(c.sunset) && (
          <span className={chip}>
            <Sunset className="h-4 w-4 text-dg-highlight" aria-hidden="true" />
            {t('home.place.sunset')} <b className={value} dir="ltr">{hhmm(c.sunset)}</b>
          </span>
        )}
      </div>
      <p className="text-[0.75rem] text-dg-ink-3">
        {t('home.place.source', { source: c.source, time: hhmm(c.observedAt) ?? '' })}
      </p>
    </div>
  );
};

const Door: React.FC<{ door: CategoryDoor; index: number }> = ({ door, index }) => {
  const { language } = useLanguage();
  const { navigateTo } = useTrip();
  const { destinationId, destination } = useDestination();
  const reduce = useReducedMotion();
  const [pulse, setPulse] = useState(0);

  const open = () => {
    haptic('tap');
    setPulse((p) => p + 1);
    window.setTimeout(
      () => {
        if (door.route) navigateTo(door.route);
        else {
          presetPlan(destinationId, door.planVibes ?? []);
          navigateTo('/plan');
        }
      },
      reduce ? 0 : 320,
    );
  };

  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ ...destination.motion.spring, delay: reduce ? 0 : index * 0.05 * destination.motion.stagger }}
    >
      <button
        type="button"
        onClick={open}
        className={cn(
          'group flex w-full flex-col items-center gap-2 rounded-dg-lg border border-dg-line bg-dg-surface px-2 pb-3 pt-4',
          'transition-[transform,border-color,box-shadow] duration-200 ease-dg-out hover:border-dg-line-strong hover:shadow-dg-card active:scale-[0.97]',
        )}
      >
        <motion.span
          key={pulse}
          className="block h-11 w-11 sm:h-14 sm:w-14"
          animate={pulse && !reduce ? { scale: [1, 0.82, 1.12, 1], rotate: [0, -6, 3, 0] } : undefined}
          transition={{ duration: 0.6, ease: [0.34, 1.3, 0.64, 1] }}
        >
          <Pictogram id={door.pictogram} className="h-full w-full transition-transform duration-300 group-hover:-translate-y-0.5" />
        </motion.span>
        <span className="text-center text-[0.8125rem] font-medium leading-tight text-dg-ink">{door.label[language]}</span>
      </button>
    </motion.li>
  );
};

export const PlaceCategories: React.FC = () => {
  const { t, language } = useLanguage();
  const { destinationId, destination } = useDestination();
  const doors = CATEGORY_DOORS[destinationId];

  return (
    <section id="concierge-services" aria-labelledby="place-categories-title" className="mx-auto w-full max-w-[var(--dg-content-max)] px-[var(--dg-gutter)] py-10 sm:py-14">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:items-end">
        <SectionHeader
          as="h2"
          title={<span id="place-categories-title">{t('home.place.categories.title', { place: destination.name[language] })}</span>}
        />
        <Conditions />
      </div>
      <ul
        key={destinationId}
        className={cn('mt-6 grid gap-2.5 sm:gap-3', doors.length > 6 ? 'grid-cols-4 sm:grid-cols-8' : 'grid-cols-3 sm:grid-cols-6')}
      >
        {doors.map((door, i) => (
          <Door key={door.id} door={door} index={i} />
        ))}
      </ul>
    </section>
  );
};
