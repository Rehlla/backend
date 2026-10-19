import { describe, expect, it } from 'vitest';
import {
  chunkReplyText,
  CHUNK_DELAY_MS,
  MAX_CHUNKS,
  MIN_CHUNKS
} from '../../server/services/daygiStream';

/**
 * Chunks must be exact slices of the original text: concatenating them (or
 * accumulating `full`) must reproduce the final reply byte-for-byte, in
 * both Latin and Arabic scripts.
 */

describe('chunkReplyText', () => {
  it('returns no chunks for empty or whitespace-only text', () => {
    expect(chunkReplyText('')).toEqual([]);
    expect(chunkReplyText('   \n\t ')).toEqual([]);
  });

  it('reconstructs the original text from chunk slices and ends', () => {
    const text = 'Here is your calm three-day Dahab plan with two snorkel days and one flexible day.';
    const chunks = chunkReplyText(text);

    let rebuilt = '';
    let previousEnd = 0;
    for (const chunk of chunks) {
      expect(chunk.end).toBeGreaterThan(previousEnd);
      rebuilt += chunk.text;
      previousEnd = chunk.end;
    }
    expect(rebuilt).toBe(text);
  });

  it('keeps Arabic text intact across chunks', () => {
    const text = 'إليك خطتك الهادئة لثلاثة أيام في دهب مع يومين سنوركلينج ويوم مرن تختاره بنفسك';
    const chunks = chunkReplyText(text);
    expect(chunks.length).toBeGreaterThan(0);
    let rebuilt = '';
    for (const chunk of chunks) rebuilt += chunk.text;
    expect(rebuilt).toBe(text);
  });

  it('respects the minimum chunk count for medium replies', () => {
    const text = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
    expect(chunkReplyText(text).length).toBe(MIN_CHUNKS);
  });

  it('never exceeds the maximum chunk count for very long replies', () => {
    const text = Array.from({ length: 600 }, (_, i) => `word${i}`).join(' ');
    expect(chunkReplyText(text).length).toBe(MAX_CHUNKS);
  });

  it('returns one chunk for a short reply', () => {
    const chunks = chunkReplyText('The reef is calm today.');
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe('The reef is calm today.');
    expect(chunks[0].end).toBe('The reef is calm today.'.length);
  });

  it('chunk count scales between min and max with reply length', () => {
    const short = chunkReplyText(Array.from({ length: 40 }, (_, i) => `w${i}`).join(' '));
    const long = chunkReplyText(Array.from({ length: 400 }, (_, i) => `w${i}`).join(' '));
    expect(short.length).toBeGreaterThanOrEqual(MIN_CHUNKS);
    expect(long.length).toBeGreaterThanOrEqual(short.length);
    expect(long.length).toBeLessThanOrEqual(MAX_CHUNKS);
  });

  it('total pacing budget stays near a second regardless of reply length', () => {
    // ~1.2s of typing feel: chunk count × delay, bounded by MAX_CHUNKS.
    const budget = MAX_CHUNKS * CHUNK_DELAY_MS;
    expect(budget).toBeLessThanOrEqual(1600);
  });
});
