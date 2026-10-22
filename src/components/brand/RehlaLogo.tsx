import React from 'react';
import { cn } from '@/lib/cn';

/**
 * REHLA mark (docs/premium-plan/brand/rehla-brand.html): one continuous
 * journey line — desert floor, mountain or dune, wave — under the sun.
 * It inherits `currentColor`, so it takes the destination's action colour
 * wherever it sits; the sun can be tinted separately with `sunColor`.
 */
export const RehlaMark: React.FC<{ className?: string; sunColor?: string; title?: string }> = ({
  className,
  sunColor,
  title,
}) => (
  <svg
    viewBox="0 0 64 64"
    className={cn('shrink-0', className)}
    role={title ? 'img' : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    <path
      d="M7 45h7l10-15.5c1.2-1.8 3.8-1.8 5 0L36 40c1.6 2.4 4.6 2.6 6.4.4 2.9-3.6 7-3.6 9.9 0 1.2 1.5 2.9 2.2 4.7 2.2"
      fill="none"
      stroke="currentColor"
      strokeWidth={5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="43" cy="19" r="5.5" fill={sunColor ?? 'currentColor'} />
  </svg>
);

/** Mark + wordmark. The Latin wordmark stays LTR in both languages. */
export const RehlaLogo: React.FC<{ className?: string; showArabic?: boolean; markClassName?: string }> = ({
  className,
  showArabic = false,
  markClassName,
}) => (
  <span className={cn('inline-flex items-center gap-2 text-dg-ink', className)} dir="ltr">
    <RehlaMark className={cn('h-8 w-8 text-dg-action', markClassName)} sunColor="var(--dg-highlight)" />
    <span className="font-dg-display text-[1.25rem] font-medium tracking-[0.14em] leading-none [font-variation-settings:'SOFT'_100]">
      REHLA
    </span>
    {showArabic && (
      <span className="font-['SF_Arabic'] text-[1rem] font-semibold text-dg-ink-2 border-s border-dg-line-strong ps-2 leading-none">
        رحلة
      </span>
    )}
  </span>
);
