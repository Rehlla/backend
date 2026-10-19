import { describe, it, expect } from 'vitest';
import { daygiReasoningService } from '../../server/services/daygiReasoningService';
import { daygiMemoryService } from '../../server/services/daygiMemoryService';

/**
 * A signed-out ask used to 401, and the page then showed a canned shoreline
 * sentence. The query itself must answer without a session and must not
 * write the demo traveler's memory — a missing userId used to land there.
 */
describe('DayGI guest query', () => {
  it('answers a trip-dependent question without inventing a trip or writing memory', async () => {
    const before = [...daygiMemoryService.getMemory('USR-AHMED-01').recentIntents];

    const result = await daygiReasoningService.query({
      prompt: 'I want somewhere calm after diving',
      language: 'en'
    });

    expect(result.replyText).toContain('This needs your trip first');
    expect(result.replyText).not.toMatch(/Ahmed|Ralphs|Canyon Morning/i);
    expect(daygiMemoryService.getMemory('USR-AHMED-01').recentIntents).toEqual(before);
  });
});
