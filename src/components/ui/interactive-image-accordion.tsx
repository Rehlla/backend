// src/components/ui/interactive-image-accordion.tsx
//
// Interactive image accordion, adapted from a 21st.dev shadcn component.
// Re-skinned like the other primitives here: every colour routes through the
// theme-reactive tokens, the panel label sits on the same over-photo pill the
// rest of the app uses, and both directions are real — the closed labels turn
// with the writing direction and the arrow keys follow it.
//
// Deliberate departures from the source it came from:
//   * `items` is the API — no hardcoded marketing copy, no remote CDN images.
//   * activation is a callback, not an <a href>: this app navigates in-router.
//   * phones get a vertical stack; a 3rem sliver is not a phone experience.
//   * hover, focus and the arrow keys all open a panel, and the open panel
//     fires `onSelect` — so the whole thing is operable without a mouse.
"use client";

import * as React from 'react';

import { cn } from '@/lib/cn';

export interface AccordionImageItem {
  /** Stable key for the panel. */
  id: string;
  /** Panel label. Always rendered; it is also the panel's accessible name. */
  title: string;
  /** Image source. Prefer an already-shipped `/images/...` asset. */
  imageUrl: string;
  /** Description for assistive tech, when the photograph carries meaning. */
  alt?: string;
}

export interface InteractiveImageAccordionProps {
  items: AccordionImageItem[];
  /** Panel open on first render when uncontrolled. */
  defaultActiveIndex?: number;
  /** Panel open when controlled; pair with `onActiveChange`. */
  activeIndex?: number;
  /** Fires whenever the open panel changes — hover, focus, tap or arrow key. */
  onActiveChange?: (index: number) => void;
  /** Fires when the already-open panel is activated: the accordion's one action. */
  onSelect?: (item: AccordionImageItem, index: number) => void;
  /** Accessible name for the group of panels. */
  label?: string;
  className?: string;
}

/**
 * One open panel at a time. A narrow panel is a labelled sliver; the open one
 * carries the photograph. Width (desktop) and height (mobile) animate, and the
 * transition is disabled under `prefers-reduced-motion`.
 */
export function InteractiveImageAccordion({
  items,
  defaultActiveIndex = 0,
  activeIndex,
  onActiveChange,
  onSelect,
  label,
  className,
}: InteractiveImageAccordionProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultActiveIndex);

  const open = (index: number) => {
    if (activeIndex === undefined) setUncontrolled(index);
    onActiveChange?.(index);
  };

  // Arrow keys follow the reading direction, so RTL swaps left and right.
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const rtl = typeof window !== 'undefined'
      && window.getComputedStyle(event.currentTarget).direction === 'rtl';
    const step =
      event.key === 'ArrowRight' ? (rtl ? -1 : 1)
        : event.key === 'ArrowLeft' ? (rtl ? 1 : -1)
          : event.key === 'ArrowDown' ? 1
            : event.key === 'ArrowUp' ? -1
              : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = (active + step + items.length) % items.length;
    open(next);
    event.currentTarget
      .querySelectorAll<HTMLButtonElement>('[data-accordion-panel]')
      [next]?.focus();
  };

  if (items.length === 0) return null;

  const active = Math.min(Math.max(activeIndex ?? uncontrolled, 0), items.length - 1);

  return (
    <div
      role="group"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-stretch', className)}
    >
      {items.map((item, index) => {
        const isActive = index === active;
        return (
          <button
            key={item.id}
            data-accordion-panel=""
            type="button"
            aria-expanded={isActive}
            onMouseEnter={() => open(index)}
            onFocus={() => open(index)}
            onClick={() => (isActive ? onSelect?.(item, index) : open(index))}
            className={cn(
              'group relative cursor-pointer overflow-hidden rounded-2xl border border-[var(--border-subtle)]',
              'bg-[var(--surface-container)] transition-[width,height] duration-[520ms]  /* Apple HIG: align to --dg-dur-slow (520ms) design token */ ease-[var(--ease-out)]',
              'motion-reduce:transition-none',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-canvas)]',
              // Phone: slim strips stacked, the open one grows.
              isActive ? 'h-[16rem] w-full bg-[rgba(255_255_255_0.08)] backdrop-blur-sm border-white/20' : 'h-14 w-full',
              // Tablet and up: upright slivers in a row, the open one opens out.
              // Five closed 3rem slivers plus five 0.75rem gaps is 18.75rem, so
              // the open panel takes exactly the rest: the row always fills its
              // container and never overflows, and a definite width is what
              // lets the open/close transition animate at all.
              isActive ? 'sm:h-[28rem] sm:w-[calc(100%-18.75rem)]' : 'sm:h-[28rem] sm:w-12',
            )}
          >
            <img
              src={item.imageUrl}
              alt={item.alt || item.title}  /* Apple HIG accessibility: meaningful alt; decorative only if explicitly empty */ aria-describedby={item.id + "-label"}
              loading="lazy"
              decoding="async"
              onError={(event) => {
                // A missing file leaves the token-coloured panel and its
                // label rather than a broken-image glyph.
                event.currentTarget.style.visibility = 'hidden';
              }}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
            />
            <span
              className={cn(
                'absolute rounded-full bg-black/60 px-3 py-1 font-semibold text-white backdrop-blur-sm',
                'transition-all duration-300 ease-out motion-reduce:transition-none',
                isActive
                  ? 'bottom-4 start-4 text-base sm:bottom-6 sm:start-6 sm:text-lg'
                  : 'bottom-4 start-4 text-sm sm:bottom-24 sm:left-1/2 sm:-translate-x-1/2 sm:rotate-90 sm:whitespace-nowrap sm:rtl:-rotate-90',
              )}
            >
              {item.title}
            </span>
          </button>
        );
      })}
    </div>
  );
}
