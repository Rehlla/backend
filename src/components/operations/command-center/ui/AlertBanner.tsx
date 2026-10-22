import React from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

interface AlertBannerProps {
  status: 'healthy' | 'degraded' | 'action-required';
  title: string;
  subtitle?: string;
  freshness?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  className?: string;
}

const BANNER_STYLES = {
  healthy: {
    bg: 'bg-emerald-500/8 border-emerald-500/20',
    dot: 'bg-emerald-400',
    icon: CheckCircle2,
    iconColor: 'text-emerald-400',
  },
  degraded: {
    bg: 'bg-amber-500/8 border-amber-500/20',
    dot: 'bg-amber-400 animate-pulse',
    icon: AlertTriangle,
    iconColor: 'text-amber-400',
  },
  'action-required': {
    bg: 'bg-red-500/8 border-red-500/20',
    dot: 'bg-red-400 animate-pulse',
    icon: ShieldAlert,
    iconColor: 'text-red-400',
  },
};

export function AlertBanner({ status, title, subtitle, freshness, onRefresh, refreshing, className = '' }: AlertBannerProps) {
  const s = BANNER_STYLES[status];
  const Icon = s.icon;

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 ${s.bg} ${className}`}>
      <div className="flex items-center gap-3">
        <span className={`w-3 h-3 rounded-full flex-shrink-0 ${s.dot}`} />
        <Icon className={`w-5 h-5 flex-shrink-0 ${s.iconColor}`} />
        <div>
          <div className="text-sm font-bold text-[var(--text-primary)]">{title}</div>
          {subtitle && <div className="text-[11px] text-[var(--text-muted)]">{subtitle}</div>}
          {freshness && <div className="text-[11px] text-[var(--text-muted)]">{freshness}</div>}
        </div>
      </div>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      )}
    </div>
  );
}
