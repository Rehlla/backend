import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';

import { cn } from '@/lib/cn';

/** Dahab Label — Radix label using the theme text tokens. */
const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, 'aria-required': ariaRequired, 'aria-invalid': ariaInvalid, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-sm font-semibold leading-tight text-text-primary peer-disabled:cursor-not-allowed peer-disabled:opacity-70',  /* Apple HIG: leading-tight (1.3); verify 4.5:1 contrast vs bg-canvas on salt/abyss themes */
      className,
    )}
    {...props}
  />
));
Label.displayName = 'Label';

export { Label };

