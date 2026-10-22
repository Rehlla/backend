import React from 'react';

/**
 * TouchTarget — consistent minimum touch target wrapper (blueprint row #17).
 *
 * Wraps any interactive element to guarantee a minimum 44x44px touch area
 * (Apple HIG / WCAG 2.5.8). The wrapper is transparent and passes through
 * all events. Useful for icon buttons, links with small text, etc.
 *
 * Usage:
 * <TouchTarget>
 *   <button className="w-6 h-6 ..."><Icon /></button>
 * </TouchTarget>
 */

interface TouchTargetProps {
  children: React.ReactNode;
  /** Extra class on the wrapper. */
  className?: string;
  /** Override minimum size (default 44px). */
  minSize?: number;
}

export function TouchTarget({ children, className = '', minSize = 44 }: TouchTargetProps) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center',
        className,
      ].join(' ')}
      style={{ minWidth: minSize, minHeight: minSize }}
    >
      {children}
    </span>
  );
}
