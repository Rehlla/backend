import React from 'react';

/**
 * ThumbBar — reusable bottom action bar for mobile key journeys (blueprint row #17).
 *
 * A fixed bottom bar that sits above the mobile dock. On desktop it renders
 * as a floating pill at the bottom-right. Each action button has a minimum
 * 48px touch target and `active:scale-95` feedback.
 *
 * Usage:
 * <ThumbBar
 *   visible={scrollY > 200}
 *   actions={[
 *     { label: 'Book Now', onClick: handleBook, primary: true },
 *     { label: 'Share', onClick: handleShare, icon: <ShareIcon /> },
 *   ]}
 * />
 */

interface ThumbAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  primary?: boolean;
  /** Badge count shown on the icon. */
  badge?: number;
  /** Disable this action. */
  disabled?: boolean;
}

interface ThumbBarProps {
  actions: ThumbAction[];
  visible?: boolean;
  /** Extra class on the outer container. */
  className?: string;
}

export function ThumbBar({ actions, visible = true, className = '' }: ThumbAction[] extends ThumbBarProps['actions'] ? ThumbBarProps : never) {
  if (!visible || actions.length === 0) return null;

  return (
    <div
      className={[
        'fixed bottom-[72px] md:bottom-4 inset-x-0 z-40 pointer-events-none',
        'flex justify-center px-4',
        className,
      ].join(' ')}
    >
      <div className="pointer-events-auto flex items-center gap-2 bg-[var(--surface-card)]/95 backdrop-blur-xl border border-[var(--border-subtle)] rounded-full shadow-2xl px-2 py-1.5">
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={action.onClick}
            disabled={action.disabled}
            className={[
              'relative flex items-center gap-2 min-h-[44px] px-4 rounded-full',
              'font-medium text-sm transition-all active:scale-95',
              'disabled:opacity-50 disabled:pointer-events-none',
              action.primary
                ? 'bg-[var(--accent)] text-white hover:brightness-110'
                : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]',
            ].join(' ')}
          >
            {action.icon && (
              <span className="relative flex-shrink-0">
                {action.icon}
                {action.badge != null && action.badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full leading-none">
                    {action.badge > 9 ? '9+' : action.badge}
                  </span>
                )}
              </span>
            )}
            <span className="hidden sm:inline">{action.label}</span>
            {/* Mobile: show label only for primary actions */}
            {action.primary && <span className="sm:hidden">{action.label}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
