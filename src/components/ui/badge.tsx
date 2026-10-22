import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/cn';

/**
 * Badge — status and trust signals. Trust badges always appear in the same
 * order on every card (plan §09): free cancellation → instant confirmation →
 * reserve now, pay later → pickup included → verified local operator.
 * Semantic tones are separate from the brand accent.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap leading-none',
  {
    variants: {
      tone: {
        action: 'bg-dg-action-wash text-dg-action',
        positive: 'bg-dg-positive-wash text-dg-positive',
        warning: 'bg-dg-warning-wash text-dg-warning',
        critical: 'bg-dg-critical-wash text-dg-critical',
        highlight: 'bg-dg-highlight-wash text-dg-highlight',
        neutral: 'bg-dg-sunken text-dg-ink-2',
        onMedia: 'bg-[rgba(255_255_255_0.15)] text-[#0B151C] backdrop-blur-md border border-[rgba(255_255_255_0.2)]',  /* Apple HIG: Liquid Glass clear for media overlays */
      },
      size: {
        sm: 'text-[0.8125rem] px-2 py-1'  /* Apple HIG: min 13px (tokens.css --dg-text-xs) */,
        md: 'text-[0.8125rem] px-2.5 py-1.5',
      },
    },
    defaultVariants: { tone: 'action', size: 'sm' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ tone, size, icon, className, children, ...props }) => (
  <span role={tone !== "neutral" ? "status" : undefined} aria-label={tone !== "neutral" ? (tone === "positive" ? "Verified status" : tone === "critical" ? "Critical status" : tone === "warning" ? "Warning status" : tone === "highlight" ? "Highlighted status" : tone === "action" ? "Active status" : undefined) : undefined} className={cn(badgeVariants({ tone, size }), className)} {...props}>
    {icon}
    {children}
  </span>
);
