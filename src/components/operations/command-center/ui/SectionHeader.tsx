import React from 'react';

interface SectionHeaderProps {
  icon: React.ElementType;
  iconColor?: string;
  title: string;
  subtitle?: string;
  badge?: { count: number; color?: string };
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ icon: Icon, iconColor = 'text-[var(--accent-primary)]', title, subtitle, badge, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between flex-wrap gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Icon className={`w-4 h-4 ${iconColor}`} />
          {title}
        </h3>
        {badge && badge.count > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
            badge.color || 'bg-amber-500/15 text-amber-400 border-amber-500/25'
          }`}>
            {badge.count}
          </span>
        )}
        {subtitle && (
          <span className="text-[11px] text-[var(--text-muted)] hidden sm:inline">{subtitle}</span>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
