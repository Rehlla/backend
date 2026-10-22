import React, { forwardRef } from 'react';

/**
 * Accessible wrapper for any clickable div.
 *
 * Renders as <div> with:
 *  - role="button"
 *  - tabIndex={0}
 *  - keyboard handler (Enter / Space → onClick)
 *  - cursor: pointer via CSS class
 *
 * Pass `disabled` to make it non-interactive.
 */

interface ClickableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** When true, removes role/tabIndex/keyboard and sets aria-disabled. */
  disabled?: boolean;
}

export const ClickableCard = forwardRef<HTMLDivElement, ClickableCardProps>(
  function ClickableCard(
    {
      disabled = false,
      className = '',
      children,
      onClick,
      onKeyDown,
      ...rest
    },
    ref,
  ) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
      }
      onKeyDown?.(e);
    };

    return (
      <div
        ref={ref}
        role={disabled ? undefined : 'button'}
        tabIndex={disabled ? undefined : 0}
        aria-disabled={disabled || undefined}
        className={`cursor-pointer${className ? ` ${className}` : ''}`}
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
