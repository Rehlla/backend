import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from '@/lib/cn';

/** Dahab Switch — Radix switch tinted with the theme's gold accent. */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      'peer inline-flex h-7 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-canvas)] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent-primary data-[state=checked]:shadow-[0_1px_2px_rgba(0,0,0,0.15)] data-[state=checked]:ring-1 data-[state=checked]:ring-white/20  /* Apple HIG: material depth for selected state */ data-[state=unchecked]:bg-surface-container'  /* Apple HIG: h-7 (28px) = touch-friendly exception for compact switch */,
      className,
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none block h-5 w-5 rounded-full bg-[var(--bg-canvas)] shadow ring-0 transition-transform motion-reduce:transition-none data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'  /* Apple HIG: reduced-motion disables thumb slide */,
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = 'Switch';

export { Switch };
