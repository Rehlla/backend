import React from 'react';

interface Tab {
  id: string;
  label: string;
  count?: number;
  icon?: React.ElementType;
  disabled?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pill' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
}

export function TabBar({ tabs, activeTab, onChange, variant = 'pill', size = 'sm', className = '' }: TabBarProps) {
  if (variant === 'underline') {
    return (
      <div className={`flex gap-0 border-b border-[var(--border-subtle)] overflow-x-auto ${className}`}>
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => !tab.disabled && onChange(tab.id)}
              disabled={tab.disabled}
              className={`relative flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                size === 'sm' ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-xs'
              } font-bold ${
                isActive
                  ? 'text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {tab.label}
              {tab.count != null && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)]'
                }`}>
                  {tab.count}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent-primary)] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`flex gap-1.5 flex-wrap ${className}`}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            className={`flex items-center gap-1.5 rounded-lg font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${
              isActive
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast,#fff)] shadow-sm'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)]'
            }`}
          >
            {Icon && <Icon className="w-3 h-3" />}
            {tab.label}
            {tab.count != null && (
              <span className={`font-mono ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
