import React from 'react';

interface MetricItem {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ElementType;
  onClick?: () => void;
}

interface MetricGridProps {
  metrics: MetricItem[];
  columns?: 2 | 3 | 4;
  loading?: boolean;
  className?: string;
}

export function MetricGrid({ metrics, columns = 4, loading = false, className = '' }: MetricGridProps) {
  const gridCols = columns === 2 ? 'grid-cols-2' : columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className={`grid ${gridCols} gap-3 ${className}`}>
      {metrics.map((metric, i) => {
        const Icon = metric.icon;
        const hasValue = metric.value !== undefined && metric.value !== null && metric.value !== '—';
        return (
          <div
            key={i}
            onClick={metric.onClick}
            className={`p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] transition-all ${
              metric.onClick ? 'hover:border-[var(--accent-primary)]/30 cursor-pointer' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              {Icon && <Icon className={`w-4 h-4 ${metric.color || 'text-[var(--text-muted)]'}`} />}
              {metric.onClick && <span className="text-[10px] text-[var(--text-muted)] font-mono opacity-0 group-hover:opacity-100">→</span>}
            </div>
            <div className={`text-2xl font-bold font-mono ${hasValue ? (metric.color || 'text-[var(--text-primary)]') : 'text-[var(--text-muted)]'}`}>
              {loading ? '—' : metric.value}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{metric.label}</div>
          </div>
        );
      })}
    </div>
  );
}
