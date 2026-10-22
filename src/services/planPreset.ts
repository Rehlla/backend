import type { DestinationId } from '../design/destinations';
import type { PlanVibe } from './planMatcher';

/** Session key the guided planner (components/plan/PlanView) persists to. */
export const PLAN_STORAGE_KEY = 'rehla_plan_v1';

/**
 * Open the planner already knowing what the traveler tapped: a "Canyons"
 * door in Nuweiba starts the plan in Nuweiba with "Hiking & nature" picked,
 * on the second question. Anything they answered before is replaced; the
 * door is the newer intent.
 */
export function presetPlan(destination: DestinationId, vibes: PlanVibe[] = []): void {
  try {
    sessionStorage.setItem(
      PLAN_STORAGE_KEY,
      JSON.stringify({
        answers: { destination, nights: null, party: null, vibes, pace: null, budget: null },
        step: 1,
        phase: 'compose',
        answered: ['destination', ...(vibes.length ? ['vibes'] : [])],
      }),
    );
  } catch {
    // Storage blocked: the planner simply starts from the first question.
  }
}
