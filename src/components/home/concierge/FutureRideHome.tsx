import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Bus, Car, CalendarDays } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTrip } from '../../../context/TripContext';
import { useDestination } from '../../../context/DestinationContext';
import { api } from '../../../services/api';
import { PriceTag } from '../../ui/price-tag';
import { SectionHeader, Skeleton } from '../../ui/feedback';
import type { AppRoute } from '../../../types';
import type { DestinationId } from '../../../design/destinations';

/**
 * Homepage entry to the future-ride hub. Prices come from the public quote,
 * so a matrix edit in the ops console shows up here without a redeploy.
 */

type RidePrices = { local?: number; private?: number; bus?: number };

function isoTomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function dropFor(id: DestinationId): string {
  if (id === 'nuweiba') return 'nuweiba';
  if (id === 'siwa') return 'siwa';
  return 'masbat';
}

const quoteBase = (date: string) => ({
  tripType: 'one' as const,
  stops: [] as string[],
  date,
  time: '09:30',
  passengers: 1,
  luggage: 'small' as const,
  addonIds: [] as string[],
});

export const FutureRideHome: React.FC = () => {
  const { t, language } = useLanguage();
  const { navigateTo } = useTrip();
  const { destinationId, destination } = useDestination();
  const reduce = useReducedMotion();
  const [prices, setPrices] = useState<RidePrices | null>(null);
  const place = destination.name[language];
  const drop = dropFor(destinationId);

  useEffect(() => {
    let cancelled = false;
    setPrices(null);
    const date = isoTomorrow();
    const base = quoteBase(date);
    const jobs: Array<Promise<number | undefined>> = [
      destinationId === 'dahab'
        ? api.quoteTransferHub({ ...base, originId: 'ZONE-MASBAT', destinationId: 'masbat', tierId: 'shared', mode: 'private' })
          .then(res => res.quote.comparison.sharedEGP)
        : Promise.resolve(undefined),
      api.quoteTransferHub({ ...base, originId: 'cairo', destinationId: drop, tierId: 'private', mode: 'private' })
        .then(res => res.quote.sellEGP),
      api.quoteTransferHub({ ...base, originId: 'cairo', destinationId: drop, tierId: 'private', mode: 'bus' })
        .then(res => res.quote.sellEGP),
    ];
    Promise.allSettled(jobs).then(results => {
      if (cancelled) return;
      const value = (index: number) => {
        const row = results[index];
        if (!row || row.status !== 'fulfilled' || !row.value) return undefined;
        return row.value;
      };
      setPrices({ local: value(0), private: value(1), bus: value(2) });
    });
    return () => { cancelled = true; };
  }, [destinationId, drop]);

  const open = (route: AppRoute, rideTab: 'private' | 'bus' | 'fleet', rideFrom: string, rideTo: string, rideTier: 'shared' | 'private' = 'private') => {
    navigateTo(route, { rideTab, rideFrom, rideTo, rideTier });
  };

  const cards = [
    destinationId === 'dahab' ? {
      id: 'local',
      icon: Car,
      title: t('home.rides.local'),
      meta: t('home.rides.localMeta'),
      amount: prices?.local,
      unit: 'perPerson' as const,
      go: () => open('/transfers/local', 'private', 'ZONE-MASBAT', 'masbat', 'shared'),
    } : null,
    {
      id: 'private',
      icon: Car,
      title: t('home.rides.private'),
      meta: t('home.rides.privateMeta', { place }),
      amount: prices?.private,
      unit: 'total' as const,
      go: () => open('/transfers/intercity', 'private', 'cairo', drop, 'private'),
    },
    {
      id: 'bus',
      icon: Bus,
      title: t('home.rides.bus'),
      meta: t('home.rides.busMeta'),
      amount: prices?.bus,
      unit: 'total' as const,
      go: () => open('/transfers/intercity', 'bus', 'cairo', drop, 'private'),
    },
  ].filter((card): card is NonNullable<typeof card> => card !== null);

  return (
    <section id="home-future-rides" aria-labelledby="home-future-rides-title" className="relative z-10 mx-auto w-full max-w-[var(--dg-content-max)] px-[var(--dg-gutter)] pb-4 pt-2">
      <div className="rounded-dg-xl border border-dg-line bg-dg-surface p-4 shadow-dg-card sm:p-6">
        <SectionHeader
          title={<span id="home-future-rides-title">{t('home.rides.title')}</span>}
          action={(
            <button
              type="button"
              onClick={() => open('/transfers/intercity', 'fleet', 'cairo', drop)}
              className="inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-dg-action"
            >
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {t('home.rides.fleet')}
            </button>
          )}
        />
        <p className="mt-2 max-w-xl text-sm text-dg-ink-2">{t('home.rides.subtitle')}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {cards.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.li
                key={card.id}
                initial={reduce ? false : { opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-20px' }}
                transition={{ duration: 0.45, delay: reduce ? 0 : index * 0.06 }}
              >
                <button
                  type="button"
                  onClick={card.go}
                  className="flex h-full w-full flex-col items-start rounded-dg-lg border border-dg-line bg-dg-bg px-4 py-4 text-start transition-[border-color,transform] duration-200 hover:border-dg-line-strong active:scale-[0.985]"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-dg-md bg-dg-action-wash text-dg-action">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="mt-3 text-[0.9375rem] font-semibold text-dg-ink">{card.title}</span>
                  <span className="mt-1 text-[0.8125rem] leading-snug text-dg-ink-2">{card.meta}</span>
                  <span className="mt-4">
                    {prices === null ? (
                      <Skeleton className="h-6 w-24" />
                    ) : card.amount ? (
                      <PriceTag amountEGP={card.amount} from unit={card.unit} size="sm" egpOnly />
                    ) : null}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
