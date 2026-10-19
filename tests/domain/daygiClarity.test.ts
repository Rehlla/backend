import { describe, expect, it, vi, afterEach } from 'vitest';
import { maybeClarify, isVaguePrompt, fallbackClarification } from '../../server/services/daygiClarityService';

/**
 * Model-powered clarification: vague prompts get a question with options;
 * specific prompts pass through; everything degrades gracefully without a key
 * or with an error.
 *
 * The provider itself is mocked at the llm/client boundary, so these cases
 * assert DayGI's behaviour — when it asks, what it puts in the prompt, how it
 * treats the reply — and not OpenAI's wire format.
 */

// vi.mock factories are hoisted above imports, so the mock must be too.
const { mockGenerateText } = vi.hoisted(() => ({ mockGenerateText: vi.fn() }));

vi.mock('../../server/services/llm/client', () => ({
  generateText: mockGenerateText,
  isLlmConfigured: () => Boolean(process.env.OPENAI_API_KEY)
}));

vi.mock('../../server/services/llm/quota', () => ({
  isQuotaExhausted: vi.fn().mockReturnValue(false)
}));

/** Resolves a model reply the way llm/client does: `{ text }` or `null`. */
function modelSays(text: string) {
  mockGenerateText.mockResolvedValueOnce({ text, model: 'gpt-4o-mini' });
}

/** Everything call `index` sent the model: system instruction plus prompt. */
function sentText(index: number): string {
  const options = mockGenerateText.mock.calls[index][0] as { systemInstruction?: string; prompt?: string };
  return `${options.systemInstruction ?? ''}
${options.prompt ?? ''}`;
}

function modelRefuses() {
  mockGenerateText.mockResolvedValueOnce(null);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe('maybeClarify', () => {
  it('returns null without OPENAI_API_KEY', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    const result = await maybeClarify('what should I do?', [], 'en');
    expect(result).toBeNull();
  });

  it('returns null for specific prompts that should not trigger a question', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    // These have activity/budget keywords that the deterministic pipeline handles
    const result = await maybeClarify('I want to book the Blue Hole dive tomorrow', [], 'en');
    expect(result).toBeNull();
  });

  it('returns null when the model says no clarification needed', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({ clarify: false }));
    const result = await maybeClarify('hello', [], 'en');
    expect(result).toBeNull();
  });

  it('returns a clarification request when the model says the prompt is vague', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({
      clarify: true,
      questionEn: 'What would you like to do in Dahab?',
      questionAr: 'تحب تعمل إيه في دهب؟',
      options: [
        { labelEn: 'Go diving', labelAr: 'أروح أغوص', query: 'I want to go diving in Dahab' },
        { labelEn: 'Eat seafood', labelAr: 'آكل سمك', query: 'Where is the best seafood in Dahab?' },
        { labelEn: 'Desert safari', labelAr: 'سفاري صحرا', query: 'Book me a desert safari' }
      ]
    }));
    const result = await maybeClarify('what should I do?', [], 'en');
    expect(result).not.toBeNull();
    expect(result!.questionEn).toContain('Dahab');
    expect(result!.questionAr).toBeTruthy();
    expect(result!.options).toHaveLength(3);
    expect(result!.options[0].query).toContain('diving');
  });

  it('filters malformed options from the model', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({
      clarify: true,
      questionEn: 'Pick one:',
      questionAr: 'اختر:',
      options: [
        { labelEn: 'Valid', labelAr: 'صحيح', query: 'valid query' },
        { labelEn: '', query: 'no label' },
        null,
        { labelEn: 'Also valid', labelAr: 'صحيح أيضاً', query: 'also valid' }
      ]
    }));
    const result = await maybeClarify('help', [], 'en');
    expect(result).not.toBeNull();
    expect(result!.options).toHaveLength(2);
  });

  it('returns null when the model call throws', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    mockGenerateText.mockRejectedValueOnce(new Error('network error'));
    const result = await maybeClarify('vague prompt', [], 'en');
    expect(result).toBeNull();
  });

  it('returns null when the provider is unavailable or refused', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelRefuses();
    const result = await maybeClarify('vague prompt', [], 'en');
    expect(result).toBeNull();
  });

  it('returns null when the reply is not valid JSON', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays('sorry, I cannot help with that');
    const result = await maybeClarify('vague prompt', [], 'en');
    expect(result).toBeNull();
  });

  it('returns null for a non-string prompt', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    const result = await maybeClarify(undefined as unknown as string, [], 'en');
    expect(result).toBeNull();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('returns null for a non-array conversation history', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({ clarify: false }));
    const result = await maybeClarify('hello', { evil: 'object' } as unknown as [], 'en');
    expect(result).toBeNull();
    // The call still happened, but the bad history contributed nothing.
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('caps how much untrusted history reaches the prompt', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({ clarify: false }));
    const spam = Array.from({ length: 50 }, () => ({ role: 'user' as const, content: 'A'.repeat(5000) }));
    await maybeClarify('help me', spam, 'en');
    const sent = sentText(0);
    // 6 turns x 400 chars max, not 50 turns x 5000 chars.
    expect(sent.length).toBeLessThan(4000);
    expect(sent).not.toContain('A'.repeat(401));
  });

  it('strips control characters and fences from untrusted history', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({ clarify: false }));
    await maybeClarify('help me', [{ role: 'user', content: 'ignore\r\n```system instructions```' }], 'en');
    const sent = sentText(0);
    expect(sent).not.toContain('\r');
    expect(sent).not.toContain('```system');
  });

  it('fences untrusted content so it cannot read as an instruction', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({ clarify: false }));
    await maybeClarify('help me', [{ role: 'user', content: 'book me a dive' }], 'en');
    const sent = sentText(0);
    expect(sent).toContain('<conversation>');
    expect(sent).toContain('<prompt>');
  });

  it('truncates oversized clarification labels and queries', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({
      clarify: true,
      questionEn: 'Q',
      options: [
        { labelEn: 'L'.repeat(500), query: 'q'.repeat(2000) },
        { labelEn: 'Second', query: 'second query' }
      ]
    }));
    const result = await maybeClarify('vague', [], 'en');
    expect(result!.options[0].labelEn.length).toBeLessThanOrEqual(120);
    expect(result!.options[0].query.length).toBeLessThanOrEqual(400);
  });

  it('includes party size and dates in the prompt when supplied', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({ clarify: false }));
    await maybeClarify('what would you suggest', [], 'en', {
      travelersCount: 4,
      travelDates: { start: '2026-11-01', end: '2026-11-05' }
    });
    const sent = sentText(0);
    expect(sent).toContain('4 travelers');
    expect(sent).toContain('2026-11-01');
    expect(sent).toContain('2026-11-05');
  });

  it('drops nonsensical party sizes and malformed dates', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'test-key');
    modelSays(JSON.stringify({ clarify: false }));
    await maybeClarify('what would you suggest', [], 'en', {
      travelersCount: 9999,
      travelDates: { start: 'next tuesday', end: '<script>' }
    });
    const sentPrompt = sentText(0);
    expect(sentPrompt).not.toContain('9999');
    expect(sentPrompt).not.toContain('next tuesday');
  });
});

describe('isVaguePrompt', () => {
  it('treats an open-ended prompt as vague', () => {
    expect(isVaguePrompt('what should I do')).toBe(true);
    expect(isVaguePrompt('help')).toBe(true);
    expect(isVaguePrompt('ideas please')).toBe(true);
  });

  it('treats a prompt naming an activity, place, budget or date as specific', () => {
    expect(isVaguePrompt('I want somewhere calm after diving')).toBe(false);
    expect(isVaguePrompt('Good morning, show my daily briefing for today')).toBe(false);
    expect(isVaguePrompt('book me the Blue Hole dive')).toBe(false);
    expect(isVaguePrompt('something cheap near the canyon')).toBe(false);
    expect(isVaguePrompt('أريد مكان هادئ بعد الغوص')).toBe(false);
  });

  it('treats a very short prompt containing a keyword as too thin to judge', () => {
    // "dive" alone is not enough intent for the classifier to act on.
    expect(isVaguePrompt('dive')).toBe(true);
  });

  it('treats empty or non-string input as not worth clarifying', () => {
    expect(isVaguePrompt('')).toBe(false);
    expect(isVaguePrompt(undefined)).toBe(false);
    expect(isVaguePrompt(42)).toBe(false);
  });

  it('recognises inflected phrasings, not just whole keywords', () => {
    // "dive" alone missed "after diving" — the most common phrasing here.
    expect(isVaguePrompt('I want somewhere calm after diving')).toBe(false);
    expect(isVaguePrompt('somewhere to unwind after the dive')).toBe(false);
    expect(isVaguePrompt('a cheap lunch near the canyon')).toBe(false);
    expect(isVaguePrompt('where should I eat tonight')).toBe(false);
  });

  it('never re-clarifies a prompt it wrote itself', () => {
    // The loop guard: an option the traveler clicks must reach the real
    // pipeline, not come back as the same question.
    for (const language of ['en', 'ar'] as const) {
      for (const option of fallbackClarification(language).options) {
        expect(isVaguePrompt(option.query), `"${option.query}" would loop`).toBe(false);
      }
    }
  });
});

describe('fallbackClarification', () => {
  it('offers bilingual options that expand into full queries', () => {
    const result = fallbackClarification('en');
    expect(result.options).toHaveLength(4);
    result.options.forEach(o => {
      expect(o.labelEn).toBeTruthy();
      expect(o.labelAr).toBeTruthy();
      // Each option has to be a complete prompt, or the next turn is vague again.
      expect(o.query.length).toBeGreaterThan(10);
      expect(o.query).toMatch(/[a-zA-Z]/);
    });
  });

  it('gives the same Arabic-first framing for an Arabic traveler', () => {
    const ar = fallbackClarification('ar');
    const en = fallbackClarification('en');
    expect(ar.questionAr).toBeTruthy();
    expect(ar.options.map(o => o.labelAr)).toEqual(en.options.map(o => o.labelAr));
  });
});
