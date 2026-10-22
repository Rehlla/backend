import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Loading and empty states. Skeletons take the shape of the content they
 * stand in for, so the page does not jump when data lands; there are no
 * full-page spinners on traveler screens.
 */
export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div
    aria-live="polite" aria-label="Loading content" aria-busy="true"
    aria-hidden="true"
    className={cn(
      'relative overflow-hidden rounded-dg-md bg-dg-sunken',
      'after:absolute after:inset-0 after:-translate-x-full after:animate-[dg-shimmer_520ms_ease-in-out_infinite]  /* Apple HIG: align to design token --dg-dur-slow (520ms) */',
      'after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_oklab,var(--dg-ink)_6%,transparent)] after:to-transparent',
      'motion-reduce:after:hidden',
      className,
    )}
    {...props}
  />
);

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** Says what will appear here and how to make it appear. Never just "No data". */
export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, body, action, className }) => (
  <div className={cn('flex flex-col items-center text-center gap-3 px-6 py-10', className)}>
    {icon && <div className="grid h-14 w-14 place-items-center rounded-full bg-dg-action-wash text-dg-action">{icon}</div>}
    <h3 className="font-dg-display text-xl font-semibold text-dg-ink text-balance  /* Apple HIG: stronger hierarchy */">{title}</h3>
    {body && <p className="max-w-[38ch] text-sm text-dg-ink-2">{body}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export interface SectionHeaderProps {
  title: React.ReactNode;
  eyebrow?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
}

/** Section title with an optional "See all" style action on the end side. */
export const SectionHeader: React.FC<SectionHeaderProps> = ({ title, eyebrow, action, className, as: H = 'h2' }) => (
  <div className={cn('flex items-end justify-between gap-4', className)}>
    <div className="min-w-0">
      {eyebrow && <p className="mb-1 text-[0.8125rem] font-medium text-dg-ink-3">{eyebrow}</p>}
      <H className="font-dg-display text-[1.375rem] sm:text-[1.75rem] font-semibold leading-tight text-dg-ink text-balance">{title}</H>
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);
