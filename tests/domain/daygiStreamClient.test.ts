import { describe, expect, it, vi, afterEach } from 'vitest';
import { api, DayGiStreamUnavailable } from '../../src/services/api';
import type { DayGiResponse } from '../../src/shared';

/**
 * The SSE client must:
 * - accumulate server-sent `full` text and call onText per frame,
 * - resolve with the terminal payload event,
 * - throw DayGiStreamUnavailable when the stream never opens (so the view
 *   falls back to the plain query without showing partial text twice),
 * - reject when the stream ends without a payload.
 */

const payload: DayGiResponse = {
  replyText: 'The reef is calm today.',
  replyTextAr: 'الشعاب هادية النهاردة.',
  whyThis: 'Marine feed.',
  whyThisAr: 'تقرير بحري.',
  actionType: 'RECOMMENDATION',
  actionRisk: 'READ_ONLY'
};

function sseResponse(frames: Array<{ event: string; data: unknown }>): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`event: ${frame.event}\ndata: ${JSON.stringify(frame.data)}\n\n`));
      }
      controller.close();
    }
  });
  return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

function mockFetchWith(response: Response) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('api.queryDayGiStream', () => {
  it('accumulates streamed text and resolves with the terminal payload', async () => {
    mockFetchWith(sseResponse([
      { event: 'text', data: { chunk: 'The reef', full: 'The reef' } },
      { event: 'text', data: { chunk: ' is calm', full: 'The reef is calm' } },
      { event: 'text', data: { chunk: ' today.', full: 'The reef is calm today.' } },
      { event: 'payload', data: { ...payload, chatId: 'CHAT-S1' } }
    ]));

    const onText = vi.fn();
    const result = await api.queryDayGiStream({ prompt: 'hi', language: 'en' }, { onText });

    expect(result.chatId).toBe('CHAT-S1');
    expect(result.replyText).toBe('The reef is calm today.');
    // The last onText carries the complete text — the view commits it verbatim.
    expect(onText).toHaveBeenCalledTimes(3);
    expect(onText.mock.calls[onText.mock.calls.length - 1][0]).toBe('The reef is calm today.');
  });

  it('handles frames split across chunk boundaries', async () => {
    const raw = `event: text\ndata: {"chunk":"half","full":"half"}\n\nevent: text\ndata: {"chunk":" rest","full":"half rest"}\n\nevent: payload\ndata: ${JSON.stringify(payload)}\n\n`;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        // Split mid-frame: first enqueue ends inside the first data line.
        controller.enqueue(encoder.encode(raw.slice(0, 30)));
        controller.enqueue(encoder.encode(raw.slice(30)));
        controller.close();
      }
    });
    mockFetchWith(new Response(body, { status: 200 }));

    const onText = vi.fn();
    const result = await api.queryDayGiStream({ prompt: 'hi' }, { onText });
    expect(result.actionType).toBe('RECOMMENDATION');
    expect(onText.mock.calls[0][0]).toBe('half');
    expect(onText.mock.calls[1][0]).toBe('half rest');
  });

  it('throws DayGiStreamUnavailable when the request fails at headers time', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network down'));

    await expect(api.queryDayGiStream({ prompt: 'hi' })).rejects.toBeInstanceOf(DayGiStreamUnavailable);
  });

  it('lets a deliberate abort through as AbortError, never as unavailable', async () => {
    // A hanging stream that the traveler cancels must reject with the abort
    // itself: the view commits partial text on AbortError, but would retry
    // plainly on DayGiStreamUnavailable and show the answer twice. The mock
    // honors abort like a real fetch; an ignore-the-signal mock would leave
    // the reader pending and hang this test instead of rejecting.
    vi.spyOn(globalThis, 'fetch').mockImplementation((_url: unknown, init: any) => {
      return new Promise((_resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal?.aborted) {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
          return;
        }
        signal?.addEventListener('abort', () => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        }, { once: true });
      });
    });

    const controller = new AbortController();
    const pending = api.queryDayGiStream({ prompt: 'hi' }, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('throws DayGiStreamUnavailable when the stream has no readable body', async () => {
    mockFetchWith(new Response(null, { status: 200 }));

    await expect(api.queryDayGiStream({ prompt: 'hi' })).rejects.toBeInstanceOf(DayGiStreamUnavailable);
  });

  it('rejects with the server error when the stream reports one', async () => {
    mockFetchWith(sseResponse([{ event: 'error', data: { error: 'DayGI reasoning engine error' } }]));

    await expect(api.queryDayGiStream({ prompt: 'hi' })).rejects.toThrow('DayGI reasoning engine error');
  });

  it('rejects when the stream closes without a payload', async () => {
    mockFetchWith(sseResponse([{ event: 'text', data: { chunk: 'lost', full: 'lost' } }]));

    await expect(api.queryDayGiStream({ prompt: 'hi' })).rejects.toThrow('without a payload');
  });

  it('aborts a stalled mid-stream connection instead of hanging', async () => {
    vi.useFakeTimers();
    try {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('event: text\ndata: {"chunk":"a","full":"a"}\n\n'));
          // Then silence forever: a dead socket that never closes.
        }
      });
      mockFetchWith(new Response(body, { status: 200 }));

      const onText = vi.fn();
      const pending = api.queryDayGiStream({ prompt: 'hi' }, { onText });
      // Attach before advancing: otherwise the rejection lands with no
      // handler yet and vitest reports it as unhandled.
      const assertion = expect(pending).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(11000);
      await assertion;
      // The frame that did arrive was still delivered before the abort.
      expect(onText).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
