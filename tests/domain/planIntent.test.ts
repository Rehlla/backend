import { describe, expect, it } from 'vitest';
import {
  extractPlanIntent,
  detectQuickQuestion,
  PLAN_PROMPT_EXAMPLES
} from '../../src/lib/planIntent';

/**
 * The homepage "Plan with AI" widget is only as honest as its parsing: a
 * traveler's sentence is turned into the structured request the public
 * /api/trip/generate endpoint takes, so a mis-parse means a plan for the wrong
 * length, wrong party or wrong pace. These pin the mapping down in both
 * languages, and the fallback defaults that keep an underspecified prompt
 * from erroring.
 */

describe('extractPlanIntent', () => {
  it('reads the duration from an English prompt', () => {
    expect(extractPlanIntent('Plan me 4 days in Dahab with diving').durationDays).toBe(4);
  });

  it('reads nights and Arabic-Indic digits', () => {
    expect(extractPlanIntent('٥ ليالي في دهب').durationDays).toBe(5);
  });

  it('detects a couple and romantic keywords', () => {
    const intent = extractPlanIntent('Romantic 5-day couple escape');
    expect(intent.dynamic).toBe('Couple');
    expect(intent.durationDays).toBe(5);
  });

  it('detects family from children keywords', () => {
    const intent = extractPlanIntent('a week with the kids');
    expect(intent.dynamic).toBe('Family');
    expect(intent.durationDays).toBe(7);
  });

  it('counts adults and children when stated', () => {
    const intent = extractPlanIntent('4 adults and 2 kids, 6 days');
    expect(intent.adultsCount).toBe(4);
    expect(intent.childrenCount).toBe(2);
  });

  it('maps budget bands in both languages', () => {
    expect(extractPlanIntent('cheap backpacker trip').budget).toBe('budget');
    expect(extractPlanIntent('اقتصادي').budget).toBe('budget');
    expect(extractPlanIntent('luxury 5 star resort').budget).toBe('premium');
    expect(extractPlanIntent('فاخر').budget).toBe('premium');
    expect(extractPlanIntent('nothing about money here').budget).toBe('moderate');
  });

  it('maps pace bands in both languages', () => {
    expect(extractPlanIntent('a slow relaxed trip').pace).toBe('relaxed');
    expect(extractPlanIntent('رايق').pace).toBe('relaxed');
    expect(extractPlanIntent('active packed schedule').pace).toBe('active');
    expect(extractPlanIntent('نشيط').pace).toBe('active');
    expect(extractPlanIntent('nothing about pace').pace).toBe('balanced');
  });

  it('collects interests and never returns an empty list', () => {
    const intent = extractPlanIntent('diving and desert safari');
    expect(intent.interests).toContain('Diving & Red Sea reefs');
    expect(intent.interests).toContain('Desert & canyons');

    const bare = extractPlanIntent('just plan something');
    expect(bare.interests.length).toBeGreaterThan(0);
  });

  it('defaults when the prompt is underspecified', () => {
    const intent = extractPlanIntent('help me plan!');
    expect(intent.durationDays).toBe(5);
    expect(intent.adultsCount).toBe(2);
    expect(intent.dynamic).toBe('Friends');
    expect(intent.budget).toBe('moderate');
    expect(intent.pace).toBe('balanced');
  });

  it('clamps absurd durations and party sizes', () => {
    expect(extractPlanIntent('60 days alone').durationDays).toBe(14);
    expect(extractPlanIntent('99 people').adultsCount).toBe(20);
  });
});

describe('detectQuickQuestion', () => {
  it('answers when-to-visit in both languages', () => {
    expect(detectQuickQuestion('When should I visit Dahab?')?.key).toBe('best-time');
    expect(detectQuickQuestion('أحسن وقت لزيارة دهب؟')?.key).toBe('best-time');
  });

  it('answers how-to-get-there with a transfers deep link', () => {
    const answer = detectQuickQuestion('how do I get from the airport to Dahab?');
    expect(answer?.key).toBe('getting-there');
    expect(answer?.ctaRoute).toBe('/transfers');
  });

  it('answers where-to-stay with a hotels deep link', () => {
    const answer = detectQuickQuestion('where should I stay in Dahab?');
    expect(answer?.key).toBe('where-stay');
    expect(answer?.ctaRoute).toBe('/hotels');
  });

  it('answers safety and sea-condition questions', () => {
    expect(detectQuickQuestion('is Dahab safe for solo travellers?')?.key).toBe('safety');
    expect(detectQuickQuestion('حالة البحر النهارده')?.key).toBe('sea-state');
  });

  it('leaves planning intent alone (no canned answer)', () => {
    expect(detectQuickQuestion('plan 4 days of diving and a desert sunset')).toBeNull();
    expect(detectQuickQuestion('خمس أيام غطس وصحراء مع العيلة')).toBeNull();
  });
});

describe('PLAN_PROMPT_EXAMPLES', () => {
  it('offers bilingual one-tap example prompts', () => {
    expect(PLAN_PROMPT_EXAMPLES.length).toBeGreaterThanOrEqual(4);
    for (const ex of PLAN_PROMPT_EXAMPLES) {
      expect(ex.en.length).toBeGreaterThan(0);
      expect(ex.ar.length).toBeGreaterThan(0);
    }
  });

  it('every example parses to a real duration', () => {
    for (const ex of PLAN_PROMPT_EXAMPLES) {
      const intent = extractPlanIntent(ex.en);
      expect(intent.durationDays).toBeGreaterThanOrEqual(1);
      expect(intent.durationDays).toBeLessThanOrEqual(14);
    }
  });
});
