import React from 'react';

interface DashCardProps {
  children: React.ReactNode;
  glow?: 'accent' | 'green' | 'amber' | 'red' | 'none';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  onClick?: () => void;
}

const GLOW_STYLES = {
  accent: 'border-[var(--accent-primary)]/20 hover:border-[var(--accent-primary)]/40 hover:shadow-[0_0_20px_var(--accent-primary)]/5',
  green: 'border-emerald-500/20 hover:border-emerald-500/40 hover:shadow-[0_0_20px_rgba(16,185,129,0.05)]',
  amber: 'border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.05)]',
  red: 'border-red-500/20 hover:border-red-500/40 hover:shadow-[0_0_20px_rgba(239,68,68,0.05)]',
  none: 'border-[var(--border-subtle)]',
};

const PADDING_STYLES = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6 lg:p-8',
};

export function DashCard({ children, glow = 'none', hover = false, padding = 'md', className = '', onClick }: DashCardProps) {
  return (
    <div onClick={onClick} className={`rounded-2xl bg-[var(--surface-container)] border transition-all ${
      GLOW_STYLES[glow]
    } ${hover ? 'hover:bg-[var(--surface-container)]/80 cursor-pointer' : ''} ${
      PADDING_STYLES[padding]
    } ${className}`}>
      {children}
    </div>
  );
}
