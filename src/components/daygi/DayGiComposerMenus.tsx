import React from 'react';
import { MapPin } from 'lucide-react';

/**
 * The two composer suggestion menus — "/" quick actions and "@" place
 * mentions, TripAdvisor-style. Pure views over option lists built by the
 * concierge view; selecting always routes through a callback, never mutates
 * composer state itself.
 */

export interface DayGiMenuOption {
  id: string;
  /** Mono badge (used by slash commands, e.g. "/brief"). */
  badge?: string;
  /** Leading icon (used by place mentions). */
  icon?: React.ReactNode;
  label: string;
}

export interface DayGiOptionMenuProps {
  options: DayGiMenuOption[];
  label: string;
  testId: string;
  onSelect: (id: string) => void;
}

export function DayGiOptionMenu({ options, label, testId, onSelect }: DayGiOptionMenuProps) {
  return (
    <div
      role="listbox"
      aria-label={label}
      data-testid={testId}
      className="rounded-2xl border border-[var(--dg-line)] bg-[var(--dg-panel)] shadow-lg overflow-hidden"
    >
      {options.map(option => (
        <button
          key={option.id}
          type="button"
          role="option"
          aria-selected={false}
          onClick={() => onSelect(option.id)}
          className="dg-focus w-full flex items-center gap-2.5 px-4 py-2.5 text-start hover:bg-[var(--dg-tint)] transition-colors"
        >
          {option.badge && (
            <span className="dg-num font-mono text-xs font-bold text-[var(--dg-teal)] shrink-0">{option.badge}</span>
          )}
          {option.icon}
          <span className="text-xs text-[var(--dg-text-2)] min-w-0 truncate">{option.label}</span>
        </button>
      ))}
    </div>
  );
}

export function mentionOption(label: string, insert: string): DayGiMenuOption {
  return {
    id: insert,
    icon: <MapPin className="w-3.5 h-3.5 text-[var(--dg-teal)] shrink-0" aria-hidden="true" />,
    label
  };
}
