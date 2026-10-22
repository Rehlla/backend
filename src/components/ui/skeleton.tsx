import React from 'react';
import { cn } from '@/lib/cn';

/**
 * Minimal skeleton loader — uses the design token palette so it works in
 * both light/dark and high-contrast modes without extra CSS.
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Context label for assistive tech, e.g. 'Loading trip details'. Required by Apple HIG loading patterns. */
  label?: string;
  /** Base shape variant */
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  /** Number of text lines when variant='text' */
  lines?: number;
  /** Whether to show pulse animation (default: true) */
  animated?: boolean;
}

/**
 * Reusable skeleton primitives.
 * All colours derive from design tokens — no hardcoded hex values.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  label,
  variant = 'text',
  lines = 1,
  animated = true,
  className,
  style,
  ...props
}) => {
  const base = `
    bg-[var(--surface-container)]
    ${animated ? 'animate-[pulse_520ms_ease-in-out_infinite] motion-reduce:hidden' : ''  /* Apple HIG: align to --dg-dur-slow (520ms); reduced-motion hides pulse */}
    rounded-dg-sm
    overflow-hidden
  `;

  const variants: Record<string, string> = {
    text: 'h-4 w-full',
    circular: 'rounded-full',
    rectangular: 'rounded-dg-md',
    card: 'rounded-dg-lg',
  };

  if (variant === 'text' && lines > 1) {
    const items = Array.from({ length: lines }, (_, i) => (
      <div
        key={i}
        className={cn(base, variants.text, i === lines - 1 && 'w-3/4')}
        style={{ marginBottom: i === lines - 1 ? 0 : 8 }}
      />
    ));
    return <div aria-live="polite" aria-label={label || "Loading content"} aria-busy="true" aria-hidden="false" className={cn('space-y-3', className)} style={style} {...props}>{items}</div>;
  }

  return (
    <div aria-live="polite" aria-label={label || "Loading content"} aria-busy="true" aria-hidden="false" className={cn(base, variants[variant], className)} style={style} {...props} />
  );
};

/* Convenience composites for common page sections */

export const HotelCardSkeleton = () => (
  <article className="group flex flex-col h-full bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] overflow-hidden animate-pulse">
    <div className="aspect-video w-full bg-[var(--surface-container)]" />
    <div className="flex-1 p-4 space-y-3">
      <Skeleton variant="text" lines={1} className="w-1/3" />
      <Skeleton variant="text" lines={2} />
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" className="h-5 w-5" />
        <Skeleton variant="text" className="w-20" />
      </div>
      <Skeleton variant="text" className="w-1/2" />
    </div>
  </article>
);

export const RestaurantCardSkeleton = () => (
  <div className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] overflow-hidden animate-pulse">
    <div className="aspect-[4/3] w-full bg-[var(--surface-container)]" />
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton variant="text" className="w-1/4" />
        <Skeleton variant="circular" className="h-5 w-5" />
        <Skeleton variant="text" className="w-24" />
      </div>
      <Skeleton variant="text" lines={2} />
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-5 w-5" />
        <Skeleton variant="text" className="w-1/2" />
      </div>
    </div>
  </div>
);

export const TransferOptionSkeleton = () => (
  <button className="w-full text-start rounded-dg-xl border border-[var(--border-subtle)] px-4 py-3 animate-pulse">
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" className="h-10 w-10" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="text" className="w-1/4" />
      </div>
    </div>
    <Skeleton variant="text" className="w-1/4 mt-2" />
  </button>
);

export const BookingCardSkeleton = () => (
  <div className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] p-6 animate-pulse space-y-4">
    <div className="flex items-start gap-3">
      <Skeleton variant="circular" className="h-12 w-12 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/4" />
        <Skeleton variant="text" lines={2} />
      </div>
      <Skeleton variant="text" className="w-24" />
    </div>
    <div className="space-y-2">
      <Skeleton variant="text" />
      <Skeleton variant="text" />
      <Skeleton variant="text" />
    </div>
    <div className="flex items-center justify-end gap-2 pt-4 border-t border-[var(--border-subtle)]">
      <Skeleton variant="rectangular" className="h-10 w-24" />
      <Skeleton variant="rectangular" className="h-10 w-28" />
    </div>
  </div>
);

export const ExperienceCardSkeleton = () => (
  <div className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] overflow-hidden animate-pulse">
    <div className="aspect-video w-full bg-[var(--surface-container)]" />
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" className="h-5 w-5" />
        <Skeleton variant="text" className="w-1/3" />
      </div>
      <Skeleton variant="text" lines={2} />
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-5 w-5" />
        <Skeleton variant="text" className="w-1/2" />
        <Skeleton variant="text" className="w-20" />
      </div>
    </div>
  </div>
);

export const HotelDetailSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="aspect-video w-full rounded-dg-xl bg-[var(--surface-container)]" />
    <div className="space-y-3">
      <Skeleton variant="text" lines={1} className="w-1/4" />
      <Skeleton variant="text" lines={2} />
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-5 w-5" />
        <Skeleton variant="text" className="w-1/4" />
      </div>
      <Skeleton variant="text" lines={3} />
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-5 w-5" />
        <Skeleton variant="text" className="w-1/3" />
      </div>
    </div>
    <div className="grid gap-4 md:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] p-4 space-y-3">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" lines={2} />
          <Skeleton variant="text" className="w-1/2" />
        </div>
      ))}
    </div>
  </div>
);

export const RestaurantDetailSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="aspect-video w-full rounded-dg-xl bg-[var(--surface-container)]" />
    <div className="space-y-3">
      <Skeleton variant="text" lines={1} className="w-1/3" />
      <Skeleton variant="text" lines={2} />
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="h-5 w-5" />
        <Skeleton variant="text" className="w-1/4" />
      </div>
    </div>
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] p-4 space-y-2">
          <Skeleton variant="text" className="w-1/4 mb-2" />
          {[...Array(4)].map((_, j) => (
            <div key={j} className="flex items-center gap-3 py-2 border-b border-[var(--border-subtle)] last:border-0">
              <Skeleton variant="text" className="flex-1" />
              <Skeleton variant="text" className="w-20 text-end" />
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);

export const BookingDetailSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] p-6 space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton variant="circular" className="h-12 w-12 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="w-1/3" />
          <Skeleton variant="text" lines={2} />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
      </div>
    </div>
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton variant="text" className="w-1/3" />
            <Skeleton variant="rectangular" className="h-8 w-24" />
          </div>
          <Skeleton variant="text" />
        </div>
      ))}
    </div>
  </div>
);

export const TripDaySkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" className="h-12 w-12" />
      <div className="space-y-1">
        <Skeleton variant="text" className="w-1/4" />
        <Skeleton variant="text" className="w-1/3" />
      </div>
    </div>
    <div className="space-y-3 ml-14 border-l border-[var(--border-subtle)] pl-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 relative">
          <div className="absolute start-0 top-1 h-3 w-3 rounded-full bg-[var(--accent-primary)]" />
          <div className="bg-[var(--surface-card)] rounded-dg-lg border border-[var(--border-subtle)] p-4 flex-1 space-y-1">
            <Skeleton variant="text" className="w-1/3" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const ProfileSkeleton = () => (
  <div className="space-y-6 animate-pulse">
    <div className="flex items-center gap-4">
      <Skeleton variant="circular" className="h-20 w-20" />
      <div className="space-y-2">
        <Skeleton variant="text" className="w-1/3" />
        <Skeleton variant="text" className="w-1/4" />
      </div>
    </div>
    <div className="space-y-4">
      <div className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] p-6 space-y-4">
        <Skeleton variant="text" className="w-1/4" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton variant="text" lines={2} />
          <Skeleton variant="text" lines={2} />
          <Skeleton variant="text" lines={2} />
          <Skeleton variant="text" lines={2} />
        </div>
      </div>
      <div className="bg-[var(--surface-card)] rounded-dg-xl border border-[var(--border-subtle)] p-6 space-y-4">
        <Skeleton variant="text" className="w-1/4" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton variant="text" lines={2} />
          <Skeleton variant="text" lines={2} />
        </div>
      </div>
    </div>
  </div>
);

export const TripTimelineSkeleton = () => (
  <div className="space-y-4 animate-pulse">
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" className="h-12 w-12" />
      <div className="space-y-1">
        <Skeleton variant="text" className="w-1/4" />
        <Skeleton variant="text" className="w-1/3" />
      </div>
    </div>
    <div className="space-y-4 ml-14 border-l border-[var(--border-subtle)] pl-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 relative">
          <div className="absolute start-0 top-1 h-3 w-3 rounded-full bg-[var(--accent-primary)]" />
          <div className="bg-[var(--surface-card)] rounded-dg-lg border border-[var(--border-subtle)] p-4 flex-1 space-y-1">
            <Skeleton variant="text" className="w-1/3" />
            <Skeleton variant="text" className="w-1/2" />
          </div>
        </div>
      ))}
    </div>
  </div>
);