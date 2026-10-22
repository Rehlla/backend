import type { ReadyTripProgram } from '../data/readyTripsData';
import type { DestinationId } from '../design/destinations';

/**
 * The guided planner's matching rule (plan §05, "not a chatbot").
 *
 * Deterministic on purpose: the traveler's answers are scored against each
 * programme's own attributes, and every score comes with the reasons that
 * produced it, so the UI can say why a plan fits instead of asking to be
 * trusted. Same answers in, same ranking out.
 */

export type PlanParty = 'solo' | 'couple' | 'friends' | 'family';
export type PlanPace = ReadyTripProgram['pace'];
export type PlanBudget = ReadyTripProgram['defaultBudget'];
export type PlanVibe = 'sea' | 'diving' | 'adventure' | 'desert' | 'wellness' | 'culture' | 'food' | 'unplug' | 'stars' | 'nature';

export interface PlanAnswers {
  destination: DestinationId;
  /** Nights the traveler intends to stay; null when not decided yet. */
  nights: number | null;
  party: PlanParty | null;
  vibes: PlanVibe[];
  pace: PlanPace | null;
  budget: PlanBudget | null;
}

/** Which vibes make sense to offer per place: no diving question in Siwa. */
export const VIBES_BY_DESTINATION: Record<DestinationId, PlanVibe[]> = {
  dahab: ['diving', 'sea', 'adventure', 'desert', 'food', 'wellness', 'culture', 'stars'],
  nuweiba: ['sea', 'unplug', 'nature', 'stars', 'desert', 'adventure'],
  sharm: ['sea', 'diving', 'food', 'culture', 'stars', 'nature'],
  hurghada: ['sea', 'food', 'nature', 'wellness', 'stars', 'culture'],
  marsa_alam: ['sea', 'diving', 'nature', 'adventure', 'unplug', 'stars'],
  siwa: ['wellness', 'culture', 'desert', 'stars', 'nature', 'unplug', 'adventure'],
  alexandria: ['culture', 'food', 'sea', 'stars', 'nature'],
  giza: ['culture', 'desert', 'stars', 'adventure', 'unplug'],
  luxor: ['culture', 'desert', 'stars', 'adventure', 'food'],
  aswan: ['culture', 'sea', 'desert', 'stars', 'unplug', 'wellness'],
  saint_catherine: ['culture', 'desert', 'adventure', 'wellness', 'stars'],
  taba: ['sea', 'nature', 'unplug', 'stars', 'adventure', 'culture'],
};

/** Vibe → the interest tags programmes already carry (defaultInterests). */
const VIBE_TAGS: Record<PlanVibe, string[]> = {
  sea: ['Beach', 'Snorkeling'],
  diving: ['Diving'],
  adventure: ['Adventure'],
  desert: ['Desert'],
  wellness: ['Wellness'],
  culture: ['Culture', 'Local Life'],
  food: ['Food'],
  unplug: ['Unplug'],
  stars: ['Stargazing'],
  nature: ['Nature'],
};

const PACE_ORDER: PlanPace[] = ['Relaxed', 'Balanced', 'Active'];
const BUDGET_ORDER: PlanBudget[] = ['Budget', 'Moderate', 'Premium'];

export type MatchReason =
  | { kind: 'vibes'; matched: number; asked: number }
  | { kind: 'pace' }
  | { kind: 'budget' }
  | { kind: 'length'; days: number }
  | { kind: 'family' }
  | { kind: 'couple' };

export interface PlanMatch {
  programme: ReadyTripProgram;
  /** 0–100 */
  score: number;
  reasons: MatchReason[];
}

const step = <T,>(order: T[], a: T, b: T) => Math.abs(order.indexOf(a) - order.indexOf(b));

export function scoreProgramme(p: ReadyTripProgram, a: PlanAnswers): PlanMatch {
  const reasons: MatchReason[] = [];
  const tags = new Set(p.defaultInterests);
  let score = 0;

  // Vibes — 45
  if (a.vibes.length > 0) {
    const matched = a.vibes.filter((v) => VIBE_TAGS[v].some((t) => tags.has(t))).length;
    score += 45 * (matched / a.vibes.length);
    if (matched > 0) reasons.push({ kind: 'vibes', matched, asked: a.vibes.length });
  } else {
    score += 27;
  }

  // Pace — 25
  if (a.pace) {
    const d = step(PACE_ORDER, a.pace, p.pace);
    score += d === 0 ? 25 : d === 1 ? 12 : 0;
    if (d === 0) reasons.push({ kind: 'pace' });
  } else {
    score += 15;
  }

  // Budget — 15
  if (a.budget) {
    const d = step(BUDGET_ORDER, a.budget, p.defaultBudget);
    // Spending less than planned is still a fit; stretching the budget is not.
    const under = BUDGET_ORDER.indexOf(p.defaultBudget) <= BUDGET_ORDER.indexOf(a.budget);
    score += d === 0 ? 15 : under ? 11 : d === 1 ? 5 : 0;
    if (d === 0 || under) reasons.push({ kind: 'budget' });
  } else {
    score += 10;
  }

  // Length — 15 (a stay of N nights is N + 1 days)
  if (a.nights !== null) {
    const off = Math.abs(p.durationDays - (a.nights + 1));
    score += 15 * Math.max(0, 1 - off / 4);
    if (off <= 1) reasons.push({ kind: 'length', days: p.durationDays });
  } else {
    score += 12;
  }

  // Party nudges
  if (a.party === 'family') {
    if (p.intensityScore >= 4) score -= 12;
    else if (p.intensityScore <= 2) {
      score += 4;
      reasons.push({ kind: 'family' });
    }
  }
  if (a.party === 'couple' && /couple/i.test(p.idealFor) ) {
    score += 6;
    reasons.push({ kind: 'couple' });
  }
  if (a.party === 'friends' && p.pace === 'Active') score += 4;

  return { programme: p, score: Math.round(Math.max(0, Math.min(100, score))), reasons };
}

/**
 * The header place wins over a plan saved earlier. Vibes that do not exist
 * in the new place are dropped; the other answers stay.
 */
export function answersForDestination(answers: PlanAnswers, destination: DestinationId): PlanAnswers {
  if (answers.destination === destination) return answers;
  return {
    ...answers,
    destination,
    vibes: answers.vibes.filter((v) => VIBES_BY_DESTINATION[destination].includes(v)),
  };
}

/** Programmes of the chosen destination, best first; ties go to the shorter trip. */
export function rankProgrammes(programmes: ReadyTripProgram[], a: PlanAnswers): PlanMatch[] {
  return programmes
    .filter((p) => (p.destination ?? 'dahab') === a.destination)
    .map((p) => scoreProgramme(p, a))
    .sort((x, y) => y.score - x.score || x.programme.durationDays - y.programme.durationDays);
}

export type PlanSort = 'best' | 'price' | 'short' | 'calm';

export function sortMatches(matches: PlanMatch[], by: PlanSort): PlanMatch[] {
  const list = [...matches];
  switch (by) {
    case 'price':
      return list.sort((a, b) => a.programme.startingPriceEGP - b.programme.startingPriceEGP);
    case 'short':
      return list.sort((a, b) => a.programme.durationDays - b.programme.durationDays);
    case 'calm':
      return list.sort((a, b) => a.programme.intensityScore - b.programme.intensityScore);
    default:
      return list.sort((a, b) => b.score - a.score);
  }
}
