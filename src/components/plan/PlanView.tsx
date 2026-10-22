import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLanguage } from '../../i18n/LanguageContext';
import { useDestination } from '../../context/DestinationContext';
import { useReadyProgrammes } from '../../hooks/useReadyProgrammes';
import { DESTINATIONS } from '../../design/destinations';
import { answersForDestination, rankProgrammes, type PlanAnswers } from '../../services/planMatcher';
import { Button } from '../ui/button';
import { JourneyProgress } from './JourneyProgress';
import { PLAN_STEPS, StepBody, type PlanStepId } from './PlanSteps';
import { PlanResults } from './PlanResults';
import { haptic } from '../../design/feedback';
import { PLAN_STORAGE_KEY } from '../../services/planPreset';

/**
 * The guided planner (/plan). Not a chatbot (brand decision): six short
 * questions, one per screen, then plans ranked by src/services/planMatcher
 * with the reasons each one fits — or every plan at once.
 *
 * Motion follows the destination's tempo (src/design/destinations.ts): steps
 * slide in the reading direction, the journey line draws as answers land,
 * and results arrive in one staggered reveal. Answers survive navigation for
 * the session, so "Change my answers" and Back never start over.
 */

const STORAGE_KEY = PLAN_STORAGE_KEY;
type Phase = 'compose' | 'building' | 'results';

interface Saved {
  answers: PlanAnswers;
  step: number;
  phase: Phase;
  /** Steps the traveler has answered; "not sure yet" is an answer, an untouched step is not. */
  answered: PlanStepId[];
}

function load(destination: PlanAnswers['destination']): Saved {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      if (s?.answers?.destination) {
        return {
          ...s,
          answers: answersForDestination(s.answers, destination),
          answered: s.answered ?? [],
          phase: s.phase === 'building' ? 'results' : s.phase,
        };
      }
    }
  } catch {
    // fresh start
  }
  return {
    answers: { destination, nights: null, party: null, vibes: [], pace: null, budget: null },
    step: 0,
    phase: 'compose',
    answered: [],
  };
}

const QUESTION_KEY: Record<PlanStepId, string> = {
  destination: 'plan.q.destination',
  when: 'plan.q.when',
  party: 'plan.q.party',
  vibes: 'plan.q.vibes',
  pace: 'plan.q.pace',
  budget: 'plan.q.budget',
};

const HINT_KEY: Partial<Record<PlanStepId, string>> = {
  when: 'plan.q.whenHint',
  vibes: 'plan.q.vibesHint',
};

export const PlanView: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const { destinationId, setDestination } = useDestination();
  const reduce = useReducedMotion();
  const programmes = useReadyProgrammes();

  const [state, setState] = useState<Saved>(() => load(destinationId));
  const [direction, setDirection] = useState<1 | -1>(1);
  const { answers, step, phase } = state;
  const stepId = PLAN_STEPS[step];
  const tempo = DESTINATIONS[answers.destination].motion;

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // per-view only
    }
  }, [state]);

  // The header place and the plan are the same choice. A switcher change
  // rewrites the saved destination; picking a place inside the questions
  // updates the header from `set` below. One direction each, so they cannot
  // fight and put the header back on the previous town.
  useEffect(() => {
    setState((s) => {
      const next = answersForDestination(s.answers, destinationId);
      return next === s.answers ? s : { ...s, answers: next };
    });
  }, [destinationId]);

  const matches = useMemo(() => rankProgrammes(programmes, answers), [programmes, answers]);

  const go = (next: number) => {
    setDirection(next > step ? 1 : -1);
    setState((s) => ({ ...s, step: Math.max(0, Math.min(PLAN_STEPS.length - 1, next)) }));
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  };

  const finish = () => {
    haptic('success');
    setState((s) => ({ ...s, phase: reduce ? 'results' : 'building' }));
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // The short "shaping" beat is choreography, not a fake wait: the ranking is
  // already computed; this gives the line time to finish drawing.
  useEffect(() => {
    if (phase !== 'building') return;
    const id = window.setTimeout(() => setState((s) => ({ ...s, phase: 'results' })), 900);
    return () => window.clearTimeout(id);
  }, [phase]);

  const set = (patch: Partial<PlanAnswers>, advance = false) => {
    if (patch.destination && patch.destination !== destinationId) setDestination(patch.destination);
    setState((s) => ({
      ...s,
      answers: { ...s.answers, ...patch },
      answered: s.answered.includes(stepId) ? s.answered : [...s.answered, stepId],
    }));
    if (advance) {
      haptic('tap');
      window.setTimeout(() => {
        if (step === PLAN_STEPS.length - 1) finish();
        else go(step + 1);
      }, reduce ? 0 : 260);
    }
  };

  const progress = phase === 'compose' ? step / PLAN_STEPS.length : 1;
  const slide = (isRTL ? -1 : 1) * direction * 36;
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const summary = [
    DESTINATIONS[answers.destination].name[language],
    answers.nights !== null ? t('plan.when.nights', { n: answers.nights }) : state.answered.includes('when') ? t('plan.when.flexible') : null,
    answers.party ? t(`plan.party.${answers.party}`) : null,
    ...answers.vibes.map((v) => t(`plan.vibe.${v}`)),
    answers.pace ? t(`plan.pace.${answers.pace}`) : null,
    answers.budget ? t(`plan.budget.${answers.budget}`) : null,
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto w-full max-w-[var(--dg-content-max)] px-[var(--dg-gutter)] pt-6 pb-12 sm:pt-10">
      <h1 className="font-display text-3xl font-bold text-[var(--text-primary)] mb-2">Build your Dahab trip in 2 minutes</h1>
      <div className="flex gap-4 text-xs font-medium text-[var(--text-secondary)] mb-4"><span>1. Discover</span><span>2. Build</span><span>3. Book</span></div>
      <header className="mb-6 grid gap-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-dg-display text-[1.75rem] sm:text-[2.5rem] font-semibold leading-tight text-dg-ink text-balance">
              {t('plan.title')}
            </h1>
            {phase === 'compose' && <p className="mt-1 max-w-[52ch] text-dg-ink-2">{t('plan.subtitle')}</p>}
          </div>
          {phase === 'compose' && (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" onClick={finish}>
              {t('plan.skipToAll')}
            </Button>
          )}
        </div>
        <JourneyProgress
          progress={progress}
          transition={phase === 'building' ? { duration: 0.85, ease: [0.22, 1, 0.36, 1] } : tempo.spring}
          label={t('plan.step', { n: Math.min(step + 1, PLAN_STEPS.length), total: PLAN_STEPS.length })}
        />
      </header>

      <AnimatePresence mode="wait" initial={false}>
        {phase === 'compose' && (
          <motion.div
            key="compose"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]"
          >
            <div className="min-w-0 overflow-x-clip">
              <p className="mb-2 text-[0.8125rem] font-medium text-dg-ink-3 tabular-nums">
                {t('plan.step', { n: step + 1, total: PLAN_STEPS.length })}
              </p>
              <AnimatePresence mode="wait" initial={false} custom={slide}>
                <motion.section
                  key={stepId}
                  aria-labelledby={`plan-q-${stepId}`}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: slide }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: -slide }}
                  transition={tempo.spring}
                >
                  <h2 id={`plan-q-${stepId}`} className="font-dg-display text-[1.5rem] sm:text-[2rem] font-semibold leading-snug text-dg-ink text-balance">
                    {t(QUESTION_KEY[stepId])}
                  </h2>
                  {HINT_KEY[stepId] && <p className="mt-1 text-dg-ink-2">{t(HINT_KEY[stepId]!)}</p>}
                  <div className="mt-5">
                    <StepBody step={stepId} answers={answers} set={set} answered={state.answered.includes(stepId)} />
                  </div>
                </motion.section>
              </AnimatePresence>

              <div className="mt-6 flex items-center justify-between gap-3">
                <Button variant="ghost" size="md" leadingIcon={<BackIcon className="h-4 w-4" />} onClick={() => go(step - 1)} disabled={step === 0}>
                  {t('plan.back')}
                </Button>
                {step === PLAN_STEPS.length - 1 ? (
                  <Button size="md" onClick={finish}>
                    {t('plan.showPlans')}
                  </Button>
                ) : (
                  <Button variant={stepId === 'vibes' ? 'primary' : 'secondary'} size="md" onClick={() => go(step + 1)}>
                    {t('plan.next')}
                  </Button>
                )}
              </div>
              <button type="button" onClick={finish} className="mt-4 w-full text-center text-sm font-medium text-dg-action sm:hidden">
                {t('plan.skipToAll')}
              </button>
            </div>

            <aside className="hidden lg:block" aria-label={t('plan.summary.title')}>
              <div className="sticky top-[calc(var(--dg-topbar-h)+var(--dg-safe-top)+24px)] rounded-dg-xl border border-dg-line bg-dg-surface p-5">
                <h2 className="font-semibold text-dg-ink">{t('plan.summary.title')}</h2>
                {summary.length === 0 ? (
                  <p className="mt-2 text-sm text-dg-ink-3">{t('plan.summary.empty')}</p>
                ) : (
                  <motion.ul layout className="mt-3 flex flex-wrap gap-2">
                    <AnimatePresence initial={false}>
                      {summary.map((s) => (
                        <motion.li
                          key={s}
                          layout
                          initial={reduce ? false : { opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={tempo.spring}
                          className="rounded-full bg-dg-action-wash px-3 py-1.5 text-sm font-medium text-dg-action"
                        >
                          {s}
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </motion.ul>
                )}
              </div>
            </aside>
          </motion.div>
        )}

        {phase === 'building' && (
          <motion.p
            key="building"
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="py-16 text-center font-dg-display text-xl text-dg-ink-2"
          >
            {t('plan.building')}
          </motion.p>
        )}

        {phase === 'results' && (
          <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <PlanResults
              matches={matches}
              answers={answers}
              onEdit={() => {
                setDirection(-1);
                setState((s) => ({ ...s, phase: 'compose', step: 1 }));
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <p className={cn('sr-only')} aria-live="polite">
        {phase === 'results' ? t('plan.results.title', { count: Math.min(3, matches.length) }) : ''}
      </p>
    </div>
  );
};
