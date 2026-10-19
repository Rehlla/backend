/**
 * Reply-text chunking for the DayGI SSE stream.
 *
 * The deterministic (and polished) answer is already complete before the
 * first byte goes out — chunking is *pacing*, not latency, so the budget is
 * ~1.2s end to end: few, word-boundary chunks with a short delay between
 * them.
 *
 * Every chunk is an exact slice of the original text and `end` marks where
 * it finishes, so the server's accumulated `full` is always a true prefix of
 * the final reply — no trimming, no whitespace drift, Arabic and English
 * alike.
 */

export const CHUNK_DELAY_MS = 80;
export const MIN_CHUNKS = 5;
export const MAX_CHUNKS = 16;
export const WORDS_PER_CHUNK = 12;

export interface ReplyChunk {
  /** The exact slice of the original text this chunk adds. */
  text: string;
  /** Exclusive end index into the original text after this chunk. */
  end: number;
}

export function chunkReplyText(text: string): ReplyChunk[] {
  if (!text.trim()) return [];

  const words: Array<{ start: number; end: number }> = [];
  const wordRegex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(text)) !== null) {
    words.push({ start: match.index, end: match.index + match[0].length });
  }

  // A short reply is delivered as a single chunk — pacing five one-word
  // fragments over 400ms would read as stuttering, not streaming.
  if (words.length <= WORDS_PER_CHUNK) {
    return [{ text, end: text.length }];
  }

  const targetChunks = Math.min(MAX_CHUNKS, Math.max(MIN_CHUNKS, Math.ceil(words.length / WORDS_PER_CHUNK)));
  const wordsPerChunk = Math.ceil(words.length / targetChunks);

  const chunks: ReplyChunk[] = [];
  let cut = 0;
  let wordsInChunk = 0;
  for (const [index, word] of words.entries()) {
    wordsInChunk += 1;
    const isLast = index === words.length - 1;
    const chunkFull = wordsInChunk >= wordsPerChunk || isLast;
    if (chunkFull) {
      chunks.push({ text: text.slice(cut, word.end), end: word.end });
      cut = word.end;
      wordsInChunk = 0;
    }
  }
  return chunks;
}
