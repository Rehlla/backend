import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { haptic } from '../../design/feedback';

/**
 * The one way into DayGi from anywhere: a small orb in the destination's
 * colours that turns very slowly, with "Ask DayGi" beside it once the header has room (xl).
 * Quiet on purpose — a single moving element in the header, no glow, no
 * badge — so it reads as a companion that is there, not an ad for itself.
 * Over the home hero it sits on white glass like the other media controls.
 */
export const DaygiOrb: React.FC<{ className?: string }> = ({ className }) => {
  const reduce = useReducedMotion();
  return (
    <span aria-hidden="true" className={cn('relative block h-[22px] w-[22px] shrink-0', className)}>
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'conic-gradient(from 200deg, var(--dg-action), color-mix(in oklab, var(--dg-action) 40%, white), var(--dg-highlight), var(--dg-action))',
        }}
        animate={reduce ? undefined : { rotate: 360 }}
        transition={reduce ? undefined : { duration: 14, ease: 'linear', repeat: Infinity }}
      />
      {/* Soft highlight that stays put while the colours turn: reads as a sphere. */}
      <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,0.85)_0,rgba(255,255,255,0)_45%)]" />
    </span>
  );
};

export const AskDaygiButton: React.FC<{ overlay: boolean }> = ({ overlay }) => {
  const { t } = useLanguage();
  const { navigateTo, currentRoute } = useTrip();
  const active = currentRoute === '/daygi' || currentRoute === '/ai-director';

  return (
    <button
      type="button"
      onClick={() => {
        haptic('tap');
        navigateTo('/daygi');
      }}
      aria-label={t('shell.askDaygiLabel')}
      aria-current={active ? 'page' : undefined}
      className={cn(
        // Orb only until there is real room (xl); then a compact pill. Never wraps.
        'group inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full ps-1.5 pe-1.5 xl:pe-3 text-[0.8125rem] font-semibold',
        'transition-[background-color,border-color,transform] duration-200 ease-dg-out active:scale-[0.97]',
        overlay
          ? 'border border-white/30 bg-white/15 text-white backdrop-blur-md hover:bg-white/25'
          : active
            ? 'border border-dg-action bg-dg-action-wash text-dg-ink'
            : 'border border-dg-line-strong bg-dg-surface text-dg-ink hover:border-dg-action hover:bg-dg-action-wash',
      )}
    >
      <DaygiOrb className="transition-transform duration-300 group-hover:scale-110" />
      <span className="hidden xl:inline">{t('shell.askDaygi')}</span>
    </button>
  );
};
