import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MiniSparkline } from './MiniSparkline';

interface KpiCardProps {
  icon: React.ElementType;
  iconColor?: string;
  label: string;
  value: number | string;
  subtitle?: string;
  trend?: { value: number; label?: string };
  sparkline?: number[];
  sparklineColor?: string;
  onClick?: () => void;
  className?: string;
}

export function KpiCard({
  icon: Icon,
  iconColor = 'text-[var(--accent-primary)]',
  label,
  value,
  subtitle,
  trend,
  sparkline,
  sparklineColor,
  onClick,
  className = '',
}: KpiCardProps) {
  const displayValue = typeof value === 'number' ? value.toLocaleString() : value;
  const isPositive = trend && trend.value > 0;
  const isNegative = trend && trend.value < 0;
  const isNeutral = trend && trend.value === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 transition-all text-left cursor-pointer group ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className={`w-8 h-8 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center ${iconColor} group-hover:scale-110 transition-transform`}>
          <Icon className="w-4 h-4" />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[11px] font-bold ${
            isPositive ? 'text-emerald-400' : isNegative ? 'text-red-400' : 'text-[var(--text-muted)]'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {trend.value !== 0 && `${isPositive ? '+' : ''}${trend.value}%`}
          </div>
        )}
      </div>

      <div className={`text-2xl font-bold font-mono ${
        displayValue !== '0' && displayValue !== '—' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
      }`}>
        {displayValue}
      </div>

      <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex items-center justify-between gap-2">
        <span>{label}</span>
        {subtitle && <span className="text-[var(--text-muted)]/60">{subtitle}</span>}
      </div>

      {sparkline && sparkline.length > 1 && (
        <div className="mt-2 -mx-1">
          <MiniSparkline data={sparkline} color={sparklineColor || 'var(--accent-primary)'} height={28} />
        </div>
      )}
    </button>
  );
}
