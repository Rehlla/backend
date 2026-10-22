import React from 'react';

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`py-12 text-center rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] ${className}`}>
      <Icon className="w-10 h-10 text-[var(--text-muted)]/50 mx-auto mb-3" />
      <div className="text-sm font-bold text-[var(--text-muted)]">{title}</div>
      {description && <div className="text-[11px] text-[var(--text-muted)] mt-1">{description}</div>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-3 px-4 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-xs font-bold transition-colors cursor-pointer"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
