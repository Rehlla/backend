import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { Transition } from 'motion/react';

/**
 * Planner progress as the REHLA journey line (desert floor → mountain → wave)
 * drawing itself as the traveler answers, with the sun rising at the end.
 * The brand mark becomes the progress bar, so the flow reads as one trip
 * being sketched rather than a form being filled.
 */
const PATH =
  'M4 34h40l26-20c3-2.3 7-2.3 10 0l26 20c4 3 9 3.4 13 .6 7.4-5.2 16-5.2 23.4 0 4 2.8 9 2.4 13-.6 7.4-5.2 16-5.2 23.4 0 4 2.8 9 3.4 13 1.4H316';

export const JourneyProgress: React.FC<{ progress: number; transition: Transition; label: string }> = ({
  progress,
  transition,
  label,
}) => {
  const reduce = useReducedMotion();
  const p = Math.max(0, Math.min(1, progress));
  return (
    <div className="w-full" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} aria-label={label}>
      <svg viewBox="0 0 320 48" className="h-10 w-full overflow-visible rtl:-scale-x-100" preserveAspectRatio="none" aria-hidden="true">
        <path d={PATH} fill="none" stroke="var(--dg-line-strong)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        <motion.path
          d={PATH}
          fill="none"
          stroke="var(--dg-action)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={false}
          animate={{ pathLength: Math.max(0.001, p) }}
          transition={reduce ? { duration: 0 } : transition}
        />
        <motion.circle
          cx="292"
          r="6"
          fill="var(--dg-highlight)"
          initial={false}
          animate={{ cy: p >= 1 ? 10 : 30, opacity: p >= 1 ? 1 : 0.25 }}
          transition={reduce ? { duration: 0 } : transition}
        />
      </svg>
    </div>
  );
};
