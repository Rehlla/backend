import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isQuotaExhausted,
  isQuotaExhaustedError,
  quotaStatus,
  recordQuotaAvailable,
  recordQuotaExhausted
} from '../../server/services/llm/quota';

/**
 * The measurements this guard exists for: /api/daygi/query returned after 10.3s
 * on one occasion and 38.5s on another, which was read as a slow model. A
 * direct call showed HTTP 429 RESOURCE_EXHAUSTED with `Please retry in
 * 22.010119056s` — the free tier's 20-requests-per-day limit — and the SDK was
 * honouring that retry-after inside the request.
 */
const QUOTA_ERROR = new Error(
  '{"error":{"code":429,"message":"You exceeded your current quota, please check your plan and ' +
    'billing details. * Quota exceeded for metric: generativelanguage.googleapis.com/' +
    'generate_content_free_tier_requests, limit: 20, model: gemini-3.6-flash\\nPlease retry in ' +
    '22.010119056s.","status":"RESOURCE_EXHAUSTED"}}'
);

describe('isQuotaExhaustedError', () => {
  it('recognises the API refusing on quota', () => {
    expect(isQuotaExhaustedError(QUOTA_ERROR)).toBe(true);
  });

  it('does not treat an ordinary failure as a spent quota', () => {
    // A timeout or a bad prompt must not silence the model for an hour.
    expect(isQuotaExhaustedError(new Error('socket hang up'))).toBe(false);
    expect(isQuotaExhaustedError(new Error('{"error":{"code":400}}'))).toBe(false);
  });

  it('does not throw on a non-Error', () => {
    expect(isQuotaExhaustedError('429')).toBe(false);
    expect(isQuotaExhaustedError(undefined)).toBe(false);
  });
});

describe('the quota circuit', () => {
  beforeEach(() => {
    recordQuotaAvailable();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    recordQuotaAvailable();
  });

  it('starts closed', () => {
    expect(isQuotaExhausted()).toBe(false);
    expect(quotaStatus().exhausted).toBe(false);
  });

  it('opens on a quota error and stays open', () => {
    recordQuotaExhausted(QUOTA_ERROR);
    expect(isQuotaExhausted()).toBe(true);
  });

  it('ignores errors that are not about quota', () => {
    recordQuotaExhausted(new Error('socket hang up'));
    expect(isQuotaExhausted()).toBe(false);
  });

  it('waits longer than the retry-after the API named', () => {
    // The message says 22s, but that is the per-minute window; a spent *daily*
    // quota will simply refuse again, so 22s is a floor and not the answer.
    recordQuotaExhausted(QUOTA_ERROR);
    vi.advanceTimersByTime(60_000);
    expect(isQuotaExhausted()).toBe(true);
  });

  it('closes again once the cooldown has passed, so a topped-up key is picked up', () => {
    recordQuotaExhausted(QUOTA_ERROR);
    vi.advanceTimersByTime(61 * 60 * 1000);
    expect(isQuotaExhausted()).toBe(false);
  });

  it('closes immediately when a call succeeds', () => {
    recordQuotaExhausted(QUOTA_ERROR);
    expect(isQuotaExhausted()).toBe(true);
    recordQuotaAvailable();
    expect(isQuotaExhausted()).toBe(false);
  });

  it('reports the reason and the retry time for /api/health', () => {
    recordQuotaExhausted(QUOTA_ERROR);
    const status = quotaStatus();
    expect(status.exhausted).toBe(true);
    expect(status.reason).toContain('quota exhausted');
    expect(status.retryAt).toBeTruthy();
    expect(Number.isNaN(Date.parse(status.retryAt as string))).toBe(false);
  });

  it('reports nothing while the quota is believed fine', () => {
    expect(quotaStatus()).toEqual({ exhausted: false, reason: null, retryAt: null });
  });
});
