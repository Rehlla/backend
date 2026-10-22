import React from 'react';

/**
 * SafeArea — wrapper that adds safe-area-inset padding for modern phones
 * (blueprint row #17).
 *
 * iPhones with notch/Dynamic Island and Android gesture nav require padding
 * to avoid content being hidden behind the system UI. This component
 * applies `padding-bottom: env(safe-area-inset-bottom)` and optionally
 * padding for top/left/right insets.
 *
 * Usage:
 * <SafeArea bottom>
 *   <Footer />
 * </SafeArea>
 */

interface SafeAreaProps {
  children: React.ReactNode;
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  /** Extra class on the wrapper. */
  className?: string;
}

export function SafeArea({ children, top = false, bottom = true, left = false, right = false, className = '' }: SafeAreaProps) {
  return (
    <div
      className={className}
      style={{
        paddingTop: top ? 'env(safe-area-inset-top)' : undefined,
        paddingBottom: bottom ? 'env(safe-area-inset-bottom)' : undefined,
        paddingLeft: left ? 'env(safe-area-inset-left)' : undefined,
        paddingRight: right ? 'env(safe-area-inset-right)' : undefined,
      }}
    >
      {children}
    </div>
  );
}
