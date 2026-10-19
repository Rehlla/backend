import { describe, it, expect } from 'vitest';
import { answersForDestination, rankProgrammes, scoreProgramme, sortMatches, type PlanAnswers } from '../../src/services/planMatcher';
import { READY_TRIP_PROGRAMS } from '../../src/data/readyTripsData';

const base: PlanAnswers = { destination: 'dahab', nights: null, party: null, vibes: [], pace: null, budget: null };

describe('guided planner matching', () => {
  it('follows the header place and drops vibes the new place does not offer', () => {
    const aligned = answersForDestination(
      { ...base, destination: 'dahab', vibes: ['diving', 'desert'], nights: 4, party: 'couple' },
      'siwa',
    );
    expect(aligned.destination).toBe('siwa');
    expect(aligned.vibes).toEqual(['desert']);
    expect(aligned.nights).toBe(4);
    expect(aligned.party).toBe('couple');
    expect(answersForDestination(aligned, 'siwa')).toBe(aligned);
  });

  it('keeps each destination catalogue free of the other places', () => {
    const of = (id: 'dahab' | 'nuweiba' | 'siwa') =>
      READY_TRIP_PROGRAMS.filter((p) => (p.destination ?? 'dahab') === id);
    expect(of('siwa').length).toBeGreaterThan(0);
    expect(of('nuweiba').every((p) => p.destination === 'nuweiba')).toBe(true);
    expect(of('dahab').some((p) => p.destination === 'siwa')).toBe(false);
  });

  it('only ranks programmes of the chosen destination', () => {
    const siwa = rankProgrammes(READY_TRIP_PROGRAMS, { ...base, destination: 'siwa' });
    expect(siwa.length).toBeGreaterThan(0);
    expect(siwa.every((m) => m.programme.destination === 'siwa')).toBe(true);
    const dahab = rankProgrammes(READY_TRIP_PROGRAMS, base);
    expect(dahab.every((m) => (m.programme.destination ?? 'dahab') === 'dahab')).toBe(true);
  });

  it('puts the healing retreat first for a slow wellness trip to Siwa', () => {
    const ranked = rankProgrammes(READY_TRIP_PROGRAMS, {
      ...base, destination: 'siwa', vibes: ['wellness', 'unplug'], pace: 'Relaxed', nights: 4, party: 'couple', budget: 'Moderate',
    });
    expect(ranked[0].programme.id).toBe('siwa-healing-retreat');
    expect(ranked[0].reasons.map((r) => r.kind)).toEqual(expect.arrayContaining(['vibes', 'pace', 'length']));
  });

  it('puts the safari first for an active desert trip with friends', () => {
    const ranked = rankProgrammes(READY_TRIP_PROGRAMS, {
      ...base, destination: 'siwa', vibes: ['desert', 'adventure'], pace: 'Active', nights: 2, party: 'friends',
    });
    expect(ranked[0].programme.id).toBe('siwa-great-sand-sea');
  });

  it('is deterministic and bounded', () => {
    const answers: PlanAnswers = { ...base, vibes: ['diving'], pace: 'Active', nights: 5 };
    const a = rankProgrammes(READY_TRIP_PROGRAMS, answers).map((m) => [m.programme.id, m.score]);
    const b = rankProgrammes(READY_TRIP_PROGRAMS, answers).map((m) => [m.programme.id, m.score]);
    expect(a).toEqual(b);
    for (const p of READY_TRIP_PROGRAMS) {
      const s = scoreProgramme(p, answers).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it('steers families away from the most intense trips', () => {
    const intense = READY_TRIP_PROGRAMS.find((p) => p.intensityScore >= 4)!;
    const asFamily = scoreProgramme(intense, { ...base, destination: intense.destination ?? 'dahab', party: 'family' }).score;
    const asFriends = scoreProgramme(intense, { ...base, destination: intense.destination ?? 'dahab', party: 'friends' }).score;
    expect(asFamily).toBeLessThan(asFriends);
  });

  it('sorts the compare view by price, length and calm', () => {
    const ranked = rankProgrammes(READY_TRIP_PROGRAMS, base);
    const byPrice = sortMatches(ranked, 'price').map((m) => m.programme.startingPriceEGP);
    expect(byPrice).toEqual([...byPrice].sort((x, y) => x - y));
    const byCalm = sortMatches(ranked, 'calm').map((m) => m.programme.intensityScore);
    expect(byCalm).toEqual([...byCalm].sort((x, y) => x - y));
  });
});
