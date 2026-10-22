import React from 'react';

type StatusLevel = 'healthy' | 'degraded' | 'down' | 'unknown'
  | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  | 'active' | 'acknowledged' | 'resolved'
  | 'OPEN' | 'ANSWERED' | 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED'
  | 'CONFIRMED' | 'REJECTED' | 'PENDING_CONFIRMATION' | 'PENDING_ACTION'
  | 'ACCEPTED' | 'DEFERRED' | 'REJECTED'
  | 'PLANNED' | 'IN_DESTINATION' | 'COMPLETED' | 'CANCELLED'
  | 'CAPTURED' | 'REFUNDED'
  | string;

interface StatusBadgeProps {
  status: StatusLevel;
  size?: 'sm' | 'md';
  pulse?: boolean;
  dot?: boolean;
  className?: string;
}

const STATUS_STYLES: Record<string, string> = {
  healthy: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  degraded: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  down: 'bg-red-500/15 text-red-400 border-red-500/25',
  ok: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  unknown: 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  CRITICAL: 'bg-red-500/15 text-red-400 border-red-500/25',
  HIGH: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  MEDIUM: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  LOW: 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  active: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  acknowledged: 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  resolved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  OPEN: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  ANSWERED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  SENT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  DELIVERED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  FAILED: 'bg-red-500/15 text-red-400 border-red-500/25',
  PENDING: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  PENDING_ACTION: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  PENDING_CONFIRMATION: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  CONFIRMED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  REJECTED: 'bg-red-500/15 text-red-400 border-red-500/25',
  ACCEPTED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  DEFERRED: 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  PLANNED: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  IN_DESTINATION: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  COMPLETED: 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  CANCELLED: 'bg-red-500/15 text-red-400 border-red-500/25',
  CAPTURED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  REFUNDED: 'bg-red-500/15 text-red-400 border-red-500/25',
  HELD: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  BOOKED: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  URGENT: 'bg-red-500/15 text-red-400 border-red-500/25',
  HEALTHY: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  DEGRADED: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  FAILING: 'bg-red-500/15 text-red-400 border-red-500/25',
  ACTIVE: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
};

const DOT_COLORS: Record<string, string> = {
  healthy: 'bg-emerald-400',
  degraded: 'bg-amber-400',
  down: 'bg-red-400',
  active: 'bg-amber-400',
  CRITICAL: 'bg-red-400',
  HIGH: 'bg-amber-400',
  MEDIUM: 'bg-sky-400',
  OPEN: 'bg-amber-400',
  FAILED: 'bg-red-400',
  PENDING_ACTION: 'bg-amber-400',
  PENDING: 'bg-amber-400',
  IN_DESTINATION: 'bg-emerald-400',
  URGENT: 'bg-red-400',
};

export function StatusBadge({ status, size = 'sm', pulse = false, dot = false, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.unknown;
  const dotColor = DOT_COLORS[status];
  const shouldPulse = pulse || ['CRITICAL', 'URGENT', 'down', 'FAILED', 'PENDING_ACTION'].includes(status);

  return (
    <span className={`inline-flex items-center gap-1.5 border font-bold rounded-full whitespace-nowrap ${style} ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]'
    } ${className}`}>
      {(dot || shouldPulse) && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor || 'bg-current'} ${shouldPulse ? 'animate-pulse' : ''}`} />
      )}
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function HealthDot({ status }: { status: 'healthy' | 'degraded' | 'down' | 'unknown' }) {
  const color = status === 'healthy' ? 'bg-emerald-400' : status === 'degraded' ? 'bg-amber-400' : status === 'down' ? 'bg-red-400' : 'bg-[var(--text-muted)]';
  return <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color} ${status === 'down' ? 'animate-pulse' : ''}`} />;
}
