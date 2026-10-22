import * as React from 'react';
import { cn } from '@/lib/cn';

/**
 * Chip — filters, date shortcuts ("Today / Tomorrow / My trip dates"),
 * quick requests. `selected` renders the ink-filled state; chips are the only
 * fully rounded controls in the system.
 */
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  /** Small count or trailing hint, e.g. number of results. */
  trailing?: React.ReactNode;
}

export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ selected = false, icon, trailing, className, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 h-10 sm:h-9 px-3.5 rounded-full border text-[0.8125rem] font-medium whitespace-nowrap',
        'transition-[background-color,color,border-color,transform] duration-200 ease-dg-out active:scale-[0.96]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-focus)]',
        selected
          ? 'bg-dg-ink text-dg-bg border-dg-ink'
          : 'bg-transparent text-dg-ink border-dg-line-strong hover:bg-dg-action-wash',
        className,
      )}
      {...props}
    >
      {icon}
      {children}
      {trailing !== undefined && <span className={cn('tabular-nums', selected ? 'opacity-70' : 'text-dg-ink-3')}>{trailing}</span>}
    </button>
  ),
);
Chip.displayName = 'Chip';

/** Horizontally scrolling chip row with snap; no visible scrollbar. */
export const ChipRow: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => (
  <div
    role="group"
    className={cn('flex gap-2 overflow-x-auto no-scrollbar snap-x snap-mandatory [&>*]:snap-start', className)}
    {...props}
  >
    {children}
  </div>
);
