import React from 'react';

type SkeletonVariant = 'card' | 'table' | 'table-row' | 'list' | 'text' | 'kpi' | 'tab';

interface SkeletonProps {
  variant?: SkeletonVariant;
  count?: number;
  className?: string;
  /** Explicit pulse height (px) — honoured by the text/table-row variants. */
  height?: number;
}

const shimmer = 'animate-pulse bg-[var(--btn-util-bg)] rounded';

function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`${shimmer} ${className}`} />;
}

export function Skeleton({ variant = 'text', count = 1, className = '', height }: SkeletonProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  const renderVariant = (key: number) => {
    switch (variant) {
      case 'kpi':
        return (
          <div key={key} className={`p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3 ${className}`}>
            <SkeletonPulse className="w-8 h-8 rounded-lg" />
            <SkeletonPulse className="w-20 h-7 rounded" />
            <SkeletonPulse className="w-16 h-3 rounded" />
          </div>
        );
      case 'card':
        return (
          <div key={key} className={`p-5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3 ${className}`}>
            <div className="flex items-center justify-between">
              <SkeletonPulse className="w-24 h-4 rounded" />
              <SkeletonPulse className="w-16 h-5 rounded-full" />
            </div>
            <SkeletonPulse className="w-full h-3 rounded" />
            <SkeletonPulse className="w-3/4 h-3 rounded" />
            <div className="flex gap-2 pt-2">
              <SkeletonPulse className="w-14 h-5 rounded" />
              <SkeletonPulse className="w-20 h-5 rounded" />
            </div>
          </div>
        );
      case 'table':
        return (
          <div key={key} className={`rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] overflow-hidden ${className}`}>
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex gap-4">
              {Array.from({ length: 5 }, (_, i) => (
                <SkeletonPulse key={i} className="h-3 flex-1 rounded" />
              ))}
            </div>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="px-4 py-3 border-b border-[var(--border-subtle)] last:border-0 flex gap-4">
                {Array.from({ length: 5 }, (_, j) => (
                  <SkeletonPulse key={j} className="h-3 flex-1 rounded" />
                ))}
              </div>
            ))}
          </div>
        );
      case 'list':
        return (
          <div key={key} className={`p-4 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center gap-3 ${className}`}>
            <SkeletonPulse className="w-8 h-8 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonPulse className="w-1/3 h-3 rounded" />
              <SkeletonPulse className="w-2/3 h-2 rounded" />
            </div>
            <SkeletonPulse className="w-12 h-5 rounded" />
          </div>
        );
      case 'table-row':
        return (
          <SkeletonPulse
            key={key}
            className={`w-full rounded ${className}`}
            {...(height !== undefined ? { style: { height } } : {})}
          />
        );
      case 'tab':
        return (
          <div key={key} className={`flex gap-2 ${className}`}>
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonPulse key={i} className="h-8 w-20 rounded-lg" />
            ))}
          </div>
        );
      default: // text
        return (
          <div key={key} className={`space-y-2 ${className}`}>
            <SkeletonPulse className="w-full h-3 rounded" />
            <SkeletonPulse className="w-5/6 h-3 rounded" />
            <SkeletonPulse className="w-4/6 h-3 rounded" />
          </div>
        );
    }
  };

  return <>{items.map(renderVariant)}</>;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return <Skeleton variant="card" className={className} />;
}

export function SkeletonKpi({ className = '' }: { className?: string }) {
  return <Skeleton variant="kpi" className={className} />;
}

export function SkeletonTable({ className = '' }: { className?: string }) {
  return <Skeleton variant="table" className={className} />;
}

export function SkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
  return <Skeleton variant="list" count={count} className={className} />;
}
