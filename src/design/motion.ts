import type { Transition } from 'motion/react';

/**
 * Motion system (plan §07). One orchestrated moment per screen; everything
 * else is fast feedback. CSS durations live in src/styles/tokens.css
 * (--dg-dur-*); these are the springs and tweens for `motion/react`.
 *
 * Reduced motion: components read `useReducedMotion()` and swap any of these
 * for `fadeOnly`.
 */
export const spring = {
  /** Press feedback, toggles, chips. */
  press: { type: 'spring', stiffness: 520, damping: 34, mass: 0.6 } satisfies Transition,
  /** Layout changes: a card growing into its page, a tab pill moving. */
  layout: { type: 'spring', stiffness: 380, damping: 32 } satisfies Transition,
  /** Sheets settling on a detent. */
  sheet: { type: 'spring', stiffness: 300, damping: 34, mass: 0.9 } satisfies Transition,
  /** Celebratory moments: a confirmed booking. */
  bounce: { type: 'spring', stiffness: 260, damping: 18 } satisfies Transition,
} as const;

export const tween = {
  quick: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
  base: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } satisfies Transition,
} as const;

export const fadeOnly: Transition = { duration: 0.15, ease: 'linear' };

/** Scale applied while a pressable surface is held down. */
export const PRESS_SCALE = 0.97;
