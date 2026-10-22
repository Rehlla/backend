import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  User, Heart, Users, Baby, Waves, Fish, Mountain, Tent, Flower2, Landmark, UtensilsCrossed, WifiOff, Sparkles, Footprints, Check,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { DESTINATIONS, DESTINATION_IDS, type DestinationId } from '../../design/destinations';
import { DestinationScene } from '../brand/DestinationScene';
import {
  VIBES_BY_DESTINATION, type PlanAnswers, type PlanBudget, type PlanParty, type PlanPace, type PlanVibe,
} from '../../services/planMatcher';

/**
 * One question per screen (PlanView). Options are large tap targets with an
 * icon and a short "what this means" line; single-choice steps advance on
 * their own, the multi-choice step waits for "Next".
 */

export type PlanStepId = 'destination' | 'when' | 'party' | 'vibes' | 'pace' | 'budget';
export const PLAN_STEPS: PlanStepId[] = ['destination', 'when', 'party', 'vibes', 'pace', 'budget'];

interface OptionProps {
  selected: boolean;
  onSelect: () => void;
  icon?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  role?: 'radio' | 'checkbox';
  className?: string;
  children?: React.ReactNode;
}

export const OptionCard: React.FC<OptionProps> = ({ selected, onSelect, icon, title, sub, role = 'radio', className, children }) => (
  <button
    type="button"
    role={role}
    aria-checked={selected}
    onClick={onSelect}
    className={cn(
      'group relative flex w-full min-w-0 items-center gap-3.5 rounded-dg-lg border p-4 text-start',
      'transition-[background-color,border-color,transform,box-shadow] duration-[var(--dg-dur-quick)] ease-dg-out active:scale-[0.98]',
      selected
        ? 'border-dg-action bg-dg-action-wash shadow-[0_0_0_1px_var(--dg-action)]'
        : 'border-dg-line bg-dg-surface hover:border-dg-line-strong hover:shadow-dg-card',
      className,
    )}
  >
    {icon && (
      <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full transition-colors', selected ? 'bg-dg-action text-dg-action-ink' : 'bg-dg-sunken text-dg-ink-2')}>
        {icon}
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className="block font-semibold text-dg-ink">{title}</span>
      {sub && <span className="mt-0.5 block text-[0.8125rem] text-dg-ink-3">{sub}</span>}
      {children}
    </span>
    <span
      aria-hidden="true"
      className={cn(
        'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-all',
        selected ? 'border-dg-action bg-dg-action text-dg-action-ink scale-100' : 'border-dg-line-strong scale-90',
      )}
    >
      {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  </button>
);

const VIBE_ICON: Record<PlanVibe, React.ReactNode> = {
  sea: <Waves className="h-5 w-5" />,
  diving: <Fish className="h-5 w-5" />,
  adventure: <Mountain className="h-5 w-5" />,
  desert: <Tent className="h-5 w-5" />,
  wellness: <Flower2 className="h-5 w-5" />,
  culture: <Landmark className="h-5 w-5" />,
  food: <UtensilsCrossed className="h-5 w-5" />,
  unplug: <WifiOff className="h-5 w-5" />,
  stars: <Sparkles className="h-5 w-5" />,
  nature: <Footprints className="h-5 w-5" />,
};

/** A tiny tempo animation so "slow / balanced / full" is felt, not just read. */
const TempoDots: React.FC<{ pace: PlanPace }> = ({ pace }) => {
  const reduce = useReducedMotion();
  const dur = pace === 'Relaxed' ? 2.4 : pace === 'Balanced' ? 1.4 : 0.7;
  return (
    <span className="mt-2 flex gap-1.5" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-dg-action"
          animate={reduce ? undefined : { opacity: [0.25, 1, 0.25] }}
          transition={{ duration: dur, repeat: Infinity, delay: (i * dur) / 4, ease: 'easeInOut' }}
        />
      ))}
    </span>
  );
};

/** Indicative per-person-per-day bands; real totals come from the programme or the catalogue. */
const BUDGET_DAILY_EGP: Record<PlanBudget, [number, number]> = {
  Budget: [1200, 2500],
  Moderate: [2500, 5000],
  Premium: [5000, 12000],
};

const NIGHT_CHOICES = [2, 3, 4, 5, 7];

export interface StepProps {
  answers: PlanAnswers;
  set: (patch: Partial<PlanAnswers>, advance?: boolean) => void;
  /** Whether the traveler has answered this step (null answers are valid choices). */
  answered: boolean;
}

export const StepBody: React.FC<StepProps & { step: PlanStepId }> = ({ step, answers, set, answered }) => {
  const { t, language } = useLanguage();
  const { formatEGP } = useCurrency();

  if (step === 'destination') {
    return (
      <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
        {DESTINATION_IDS.map((id: DestinationId) => {
          const d = DESTINATIONS[id];
          const selected = answers.destination === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => set({ destination: id, vibes: answers.vibes.filter((v) => VIBES_BY_DESTINATION[id].includes(v)) }, true)}
              className={cn(
                'group overflow-hidden rounded-dg-lg border text-start transition-[transform,border-color,box-shadow] duration-[var(--dg-dur-base)] ease-dg-out active:scale-[0.98]',
                selected ? 'border-dg-action shadow-[0_0_0_2px_var(--dg-action)]' : 'border-dg-line hover:border-dg-line-strong hover:shadow-dg-card',
              )}
            >
              <span className="relative block aspect-[21/9] sm:aspect-[4/3]">
                <DestinationScene id={id} className="absolute inset-0 h-full w-full transition-transform duration-700 ease-dg-out group-hover:scale-[1.04]" />
              </span>
              <span className="block bg-dg-surface p-3.5">
                <span className="block font-dg-display text-lg font-semibold text-dg-ink">{d.name[language]}</span>
                <span className="block text-[0.8125rem] text-dg-ink-3">{d.tagline[language]}</span>
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (step === 'when') {
    return (
      <div className="grid gap-3">
        <div role="radiogroup" className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {NIGHT_CHOICES.map((n) => {
            const selected = answers.nights === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set({ nights: n }, true)}
                className={cn(
                  'flex flex-col items-center justify-center gap-0.5 rounded-dg-lg border py-4 transition-[background-color,border-color,transform] duration-[var(--dg-dur-quick)] active:scale-[0.97]',
                  selected ? 'border-dg-action bg-dg-action-wash' : 'border-dg-line bg-dg-surface hover:border-dg-line-strong',
                )}
              >
                <span className="font-dg-display text-2xl font-semibold tabular-nums text-dg-ink">{n}</span>
                <span className="text-[0.8125rem] text-dg-ink-3">{t('plan.when.nightsUnit')}</span>
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={answered && answers.nights === null}
            onClick={() => set({ nights: null }, true)}
            className={cn(
              'col-span-3 sm:col-span-1 rounded-dg-lg border px-3 py-4 text-sm font-semibold transition-colors',
              answered && answers.nights === null ? 'border-dg-action bg-dg-action-wash text-dg-ink' : 'border-dg-line bg-dg-surface text-dg-ink-2 hover:border-dg-line-strong',
            )}
          >
            {t('plan.when.flexible')}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'party') {
    const opts: { id: PlanParty; icon: React.ReactNode }[] = [
      { id: 'solo', icon: <User className="h-5 w-5" /> },
      { id: 'couple', icon: <Heart className="h-5 w-5" /> },
      { id: 'friends', icon: <Users className="h-5 w-5" /> },
      { id: 'family', icon: <Baby className="h-5 w-5" /> },
    ];
    return (
      <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
        {opts.map((o) => (
          <OptionCard
            key={o.id}
            selected={answers.party === o.id}
            onSelect={() => set({ party: o.id }, true)}
            icon={o.icon}
            title={t(`plan.party.${o.id}`)}
            sub={t(`plan.party.${o.id}Sub`)}
          />
        ))}
      </div>
    );
  }

  if (step === 'vibes') {
    const vibes = VIBES_BY_DESTINATION[answers.destination];
    const toggle = (v: PlanVibe) =>
      set({ vibes: answers.vibes.includes(v) ? answers.vibes.filter((x) => x !== v) : [...answers.vibes, v] });
    return (
      <div role="group" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {vibes.map((v) => {
          const selected = answers.vibes.includes(v);
          return (
            <button
              key={v}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => toggle(v)}
              className={cn(
                'flex min-h-[5.5rem] flex-col items-start justify-between gap-3 rounded-dg-lg border p-3.5 text-start transition-[background-color,border-color,transform] duration-[var(--dg-dur-quick)] ease-dg-out active:scale-[0.97]',
                selected ? 'border-dg-action bg-dg-action-wash' : 'border-dg-line bg-dg-surface hover:border-dg-line-strong',
              )}
            >
              <span className={cn('grid h-9 w-9 place-items-center rounded-full transition-colors', selected ? 'bg-dg-action text-dg-action-ink' : 'bg-dg-sunken text-dg-ink-2')}>
                {VIBE_ICON[v]}
              </span>
              <span className="text-sm font-semibold text-dg-ink">{t(`plan.vibe.${v}`)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  if (step === 'pace') {
    const paces: PlanPace[] = ['Relaxed', 'Balanced', 'Active'];
    return (
      <div role="radiogroup" className="grid gap-3">
        {paces.map((p) => (
          <OptionCard key={p} selected={answers.pace === p} onSelect={() => set({ pace: p }, true)} title={t(`plan.pace.${p}`)} sub={t(`plan.pace.${p}Sub`)}>
            <TempoDots pace={p} />
          </OptionCard>
        ))}
      </div>
    );
  }

  // budget
  const budgets: PlanBudget[] = ['Budget', 'Moderate', 'Premium'];
  return (
    <div role="radiogroup" className="grid gap-3">
      {budgets.map((b) => {
        const [lo, hi] = BUDGET_DAILY_EGP[b];
        return (
          <OptionCard
            key={b}
            selected={answers.budget === b}
            onSelect={() => set({ budget: b }, true)}
            title={t(`plan.budget.${b}`)}
            sub={
              <span dir="ltr" className="tabular-nums [unicode-bidi:isolate]">
                {formatEGP(lo)} – {formatEGP(hi)} {t('plan.budget.perDay')}
              </span>
            }
          />
        );
      })}
    </div>
  );
};
