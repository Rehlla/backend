import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/cn';

/**
 * Button — Granite & Lagoon (src/styles/tokens.css).
 *
 * One action colour: `primary` is the lagoon fill and should appear once per
 * view. Every size clears the 44px touch target on phones (sm only on
 * pointer-fine screens), presses scale down slightly, and colours come from
 * the theme tokens so all three themes recolour it for free.
 */
const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2 whitespace-nowrap select-none',
    'font-ui font-semibold rounded-dg-md',
    'transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-dg-out',
    'active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-focus)]',
    'disabled:pointer-events-none disabled:opacity-45',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: 'bg-dg-action text-dg-action-ink hover:bg-dg-action-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.22)] active:bg-[color-mix(in_oklab,var(--dg-action)_85%,#032220)]',  /* Apple HIG press state: darker action tint */
        secondary: 'bg-dg-sunken text-dg-ink hover:bg-[color-mix(in_oklab,var(--dg-surface-sunken)_80%,var(--dg-ink)_8%)]',
        outline: 'border border-dg-line-strong bg-transparent text-dg-ink hover:bg-dg-action-wash',
        ghost: 'bg-transparent text-dg-ink-2 hover:bg-dg-action-wash hover:text-dg-ink',
        highlight: 'bg-dg-highlight text-dg-highlight-ink hover:brightness-105',
        danger: 'bg-dg-critical-wash text-dg-critical hover:bg-[color-mix(in_oklab,var(--dg-critical-wash)_70%,var(--dg-critical)_14%)]',
        glass: 'bg-[rgba(255_255_255_0.08)] text-[var(--dg-ink)] hover:bg-[rgba(255_255_255_0.14)] backdrop-blur-md border border-[rgba(255_255_255_0.12)] shadow-[0_8px_24px_-4px_rgba(0_0_0_0.35),inset_0_1px_1px_rgba(255_255_255_0.2)] transition-all',  /* Apple HIG Liquid Glass thin material */
        onMedia: 'bg-white/92 text-[#0B151C] hover:bg-white backdrop-blur-md',
      },
      size: {
        sm: 'h-11 touch:h-11 pointer:h-9 px-3.5 text-[0.8125rem]',  /* Apple HIG min 44pt */
        md: 'h-12 sm:h-11 px-5 text-[0.9375rem]',
        lg: 'h-14 px-6 text-base rounded-dg-lg',
        icon: 'h-11 w-11 p-0 rounded-full',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'primary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Shows a spinner, keeps the width, blocks repeat taps. */
  loading?: boolean;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, type = 'button', loading = false, leadingIcon, trailingIcon, children, disabled, ...props }, ref) => (
    <button
      type={type}
      ref={ref}
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : leadingIcon}
      {children}
      {!loading && trailingIcon}
    </button>
  ),
);
Button.displayName = 'Button';

export { Button, buttonVariants };


