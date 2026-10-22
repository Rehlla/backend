import React, { useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { Check, CalendarDays, Gauge, Clock, Sparkles, PencilLine, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { useUI } from '../../context/UIContext';
import { api } from '../../services/api';
import { DESTINATIONS } from '../../design/destinations';
import { DestinationScene } from '../brand/DestinationScene';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Chip, ChipRow } from '../ui/chip';
import { PriceTag } from '../ui/price-tag';
import { Sheet } from '../ui/sheet';
import type { ReadyTripProgram } from '../../data/readyTripsData';
import { sortMatches, type MatchReason, type PlanAnswers, type PlanMatch, type PlanSort } from '../../services/planMatcher';
import { haptic } from '../../design/feedback';

type T = (key: string, vars?: Record<string, string | number>) => string;

function reasonText(r: MatchReason, t: T): string {
  switch (r.kind) {
    case 'vibes':
      return t('plan.reason.vibes', { matched: r.matched, asked: r.asked });
    case 'length':
      return t('plan.reason.length', { days: r.days });
    default:
      return t(`plan.reason.${r.kind}`);
  }
}

const Hero: React.FC<{ p: ReadyTripProgram; className?: string }> = ({ p, className }) =>
  p.heroImage ? (
    <img src={p.heroImage} alt="" loading="lazy" decoding="async" className={cn('h-full w-full object-cover', className)} />
  ) : (
    <DestinationScene id={p.destination ?? 'dahab'} className={cn('h-full w-full', className)} />
  );

const PaceMeter: React.FC<{ score: number }> = ({ score }) => (
  <span className="inline-flex items-center gap-0.5" aria-hidden="true">
    {[1, 2, 3, 4, 5].map((i) => (
      <span key={i} className={cn('h-1.5 w-3 rounded-full', i <= score ? 'bg-dg-action' : 'bg-dg-line-strong')} />
    ))}
  </span>
);

interface CardProps {
  match: PlanMatch;
  rank: number;
  emphasise: boolean;
  onOpen: () => void;
  onPrimary: () => void;
  primaryLabel: string;
  primaryBusy: boolean;
}

const PlanCard: React.FC<CardProps> = ({ match, rank, emphasise, onOpen, onPrimary, primaryLabel, primaryBusy }) => {
  const { t, language } = useLanguage();
  const { programme: p, score, reasons } = match;
  const title = language === 'ar' ? p.titleAr : p.title;
  const tagline = language === 'ar' ? p.taglineAr : p.tagline;

  return (
    <article
      className={cn(
        'group flex min-w-0 flex-col overflow-hidden rounded-dg-xl border bg-dg-surface transition-shadow duration-300',
        emphasise ? 'border-dg-action shadow-dg-card' : 'border-dg-line hover:shadow-dg-card',
      )}
    >
      <button type="button" onClick={onOpen} className="relative block aspect-[16/9] overflow-hidden text-start" aria-label={t('plan.card.viewDays')}>
        <motion.div layoutId={`plan-hero-${p.id}`} className="absolute inset-0">
          <Hero p={p} className="transition-transform duration-700 ease-dg-out group-hover:scale-[1.03]" />
        </motion.div>
        <span className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" aria-hidden="true" />
        <span className="absolute top-3 start-3 flex flex-wrap gap-1.5">
          {emphasise && rank === 0 ? (
            <Badge tone="onMedia" icon={<Sparkles className="h-3 w-3" />}>{t('plan.results.best', { score })}</Badge>
          ) : (
            <Badge tone="onMedia">{t('plan.results.match', { score })}</Badge>
          )}
        </span>
        <span className="absolute bottom-3 start-3 end-3 flex items-end justify-between gap-2 text-white">
          <span className="font-dg-display text-xl font-semibold leading-tight text-balance">{title}</span>
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-sm text-dg-ink-2">{tagline}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-dg-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-dg-action" aria-hidden="true" />
            {t('plan.card.days', { n: p.durationDays })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Gauge className="h-4 w-4 text-dg-action" aria-hidden="true" />
            <span className="sr-only">{t('plan.card.pace')}</span>
            <PaceMeter score={p.intensityScore} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-dg-action" aria-hidden="true" />
            {t('plan.card.freeTime', { n: p.freeTimeScore })}
          </span>
        </div>

        {reasons.length > 0 && (
          <ul className="grid gap-1.5">
            {reasons.slice(0, 3).map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.8125rem] text-dg-ink">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-dg-positive" strokeWidth={3} aria-hidden="true" />
                {reasonText(r, t)}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-dg-line pt-3">
          <div className="min-w-0">
            {p.priceIsEstimate && <span className="mb-0.5 block text-[0.75rem] font-medium text-dg-warning">{t('plan.card.estimate')}</span>}
            <PriceTag amountEGP={p.startingPriceEGP} from unit="perPerson" size="md" />
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onOpen}>
              {t('plan.card.viewDays')}
            </Button>
            <Button variant={emphasise ? 'primary' : 'secondary'} size="sm" onClick={onPrimary} loading={primaryBusy}>
              {primaryLabel}
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
};

export const PlanResults: React.FC<{
  matches: PlanMatch[];
  answers: PlanAnswers;
  onEdit: () => void;
}> = ({ matches, answers, onEdit }) => {
  const { t, language } = useLanguage();
  const { navigateTo, isSignedIn } = useTrip();
  const { showToast } = useUI();
  const reduce = useReducedMotion();
  const destination = DESTINATIONS[answers.destination];
  const [view, setView] = useState<'matches' | 'all'>('matches');
  const [sort, setSort] = useState<PlanSort>('best');
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const top = useMemo(() => matches.slice(0, 3), [matches]);
  const list = useMemo(() => (view === 'matches' ? top : sortMatches(matches, sort)), [view, top, matches, sort]);
  const open = matches.find((m) => m.programme.id === openId) ?? null;
  const early = destination.catalogue === 'early';

  const primaryLabel = early ? t('plan.card.request') : t('plan.card.book');

  const primary = async (p: ReadyTripProgram) => {
    haptic('tap');
    if (!early) {
      navigateTo('/programs', { programSlug: p.id });
      return;
    }
    if (!isSignedIn) {
      showToast(t('plan.request.signIn'));
      navigateTo('/auth/sign-in');
      return;
    }
    setBusyId(p.id);
    try {
      // A real request into the support queue; operations confirm it with
      // local hosts while the destination's catalogue is still early.
      await api.sendSupportMessage({
        category: 'plan_request',
        message: [
          `Plan request: ${p.title} (${p.id})`,
          `Destination: ${destination.name.en}`,
          `Nights: ${answers.nights ?? 'flexible'} · Party: ${answers.party ?? '-'} · Pace: ${answers.pace ?? '-'} · Budget: ${answers.budget ?? '-'}`,
          `Wants: ${answers.vibes.join(', ') || '-'}`,
        ].join('\n'),
      });
      haptic('success');
      showToast(t('plan.request.sent'));
    } catch {
      showToast(t('plan.request.failed'));
    } finally {
      setBusyId(null);
    }
  };

  const stagger = (i: number) => (reduce ? 0 : i * 0.08 * destination.motion.stagger);
  const heading =
    view === 'all'
      ? t('plan.results.allTitle', { place: destination.name[language] })
      : top.length === 1
        ? t('plan.results.titleOne')
        : t('plan.results.title', { count: top.length });

  return (
    <section aria-labelledby="plan-results-title" className="grid gap-5">
      <h1 className="text-3xl font-display font-semibold text-[var(--text-primary)] mb-2">Build your Dahab trip in 2 minutes</h1>
      <div className="flex gap-4 text-xs font-medium text-[var(--text-secondary)] mb-2">
        <span>1. Discover</span>
        <span>2. Build</span>
        <span>3. Book</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <motion.h2
            id="plan-results-title"
            key={heading}
            initial={reduce ? false : { y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={destination.motion.spring}
            className="font-dg-display text-[1.75rem] sm:text-[2.25rem] font-semibold leading-tight text-dg-ink text-balance"
          >
            {heading}
          </motion.h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" leadingIcon={<PencilLine className="h-4 w-4" />} onClick={onEdit}>
            {t('plan.results.edit')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={<ArrowRight className="h-4 w-4 rtl:rotate-180" />}
            onClick={() => setView((v) => (v === 'all' ? 'matches' : 'all'))}
          >
            {view === 'all' ? t('plan.results.showMatches') : t('plan.results.showAll')}
          </Button>
        </div>
      </div>

      {early && (
        <p className="rounded-dg-md bg-dg-warning-wash px-4 py-3 text-sm text-dg-ink">
          {t('plan.early.note', { place: destination.name[language] })}
        </p>
      )}

      <AnimatePresence initial={false}>
        {view === 'all' && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={destination.motion.layout}
            className="overflow-hidden"
          >
            <ChipRow aria-label={t('plan.results.sort')}>
              {(['best', 'price', 'short', 'calm'] as PlanSort[]).map((s) => (
                <Chip key={s} selected={sort === s} onClick={() => setSort(s)}>
                  {t(`plan.sort.${s}`)}
                </Chip>
              ))}
            </ChipRow>
          </motion.div>
        )}
      </AnimatePresence>

      {list.length === 0 ? (
        <p className="py-10 text-center text-dg-ink-2">{t('plan.noMatches')}</p>
      ) : (
        <LayoutGroup>
          <motion.ul layout className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {list.map((m, i) => (
                <motion.li
                  key={m.programme.id}
                  layout
                  initial={reduce ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ ...destination.motion.layout, delay: stagger(i) }}
                  className={cn(view === 'matches' && i === 0 && 'sm:col-span-2 xl:col-span-1')}
                >
                  <PlanCard
                    match={m}
                    rank={i}
                    emphasise={view === 'matches' && i === 0}
                    onOpen={() => setOpenId(m.programme.id)}
                    onPrimary={() => void primary(m.programme)}
                    primaryLabel={primaryLabel}
                    primaryBusy={busyId === m.programme.id}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </LayoutGroup>
      )}

      <Sheet
        open={open !== null}
        onClose={() => setOpenId(null)}
        title={open ? (language === 'ar' ? open.programme.titleAr : open.programme.title) : ''}
        description={open ? t('plan.card.days', { n: open.programme.durationDays }) : undefined}
        closeLabel={t('shell.close')}
        size="lg"
        footer={
          open && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <PriceTag amountEGP={open.programme.startingPriceEGP} from unit="perPerson" />
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigateTo('/daygi')}>
                  {t('plan.card.tweak')}
                </Button>
                <Button size="sm" onClick={() => void primary(open.programme)} loading={busyId === open.programme.id}>
                  {primaryLabel}
                </Button>
              </div>
            </div>
          )
        }
      >
        {open && (
          <div className="grid gap-5">
            <motion.div layoutId={`plan-hero-${open.programme.id}`} className="relative aspect-[21/9] overflow-hidden rounded-dg-lg">
              <Hero p={open.programme} />
            </motion.div>
            <ol className="relative grid gap-4 ps-6 before:absolute before:inset-y-1 before:start-[0.6875rem] before:w-px before:bg-dg-line-strong">
              {open.programme.dayByDay.map((d, i) => {
                const title = language === 'ar' && d.titleAr ? d.titleAr : d.title;
                const sub = language === 'ar' && d.subtitleAr ? d.subtitleAr : d.subtitle;
                const highlights = language === 'ar' && d.highlightsAr ? d.highlightsAr : d.highlights;
                return (
                  <motion.li
                    key={d.day}
                    initial={reduce ? false : { opacity: 0, x: language === 'ar' ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ ...destination.motion.spring, delay: stagger(i) + 0.1 }}
                    className="relative"
                  >
                    <span className="absolute -start-6 top-0.5 grid h-6 w-6 place-items-center rounded-full bg-dg-action text-[0.75rem] font-semibold text-dg-action-ink tabular-nums">
                      {d.day}
                    </span>
                    <p className="font-semibold text-dg-ink">{title}</p>
                    <p className="mt-0.5 text-sm text-dg-ink-2">{sub}</p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {highlights.map((h) => (
                        <li key={h} className="rounded-full bg-dg-sunken px-2.5 py-1 text-[0.75rem] text-dg-ink-2">
                          {h}
                        </li>
                      ))}
                    </ul>
                  </motion.li>
                );
              })}
            </ol>
            <div>
              <h3 className="mb-2 font-semibold text-dg-ink">{t('plan.card.included')}</h3>
              <ul className="grid gap-1.5">
                {(language === 'ar' ? open.programme.includedItemsAr : open.programme.includedItems).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-dg-ink-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-dg-positive" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
};
