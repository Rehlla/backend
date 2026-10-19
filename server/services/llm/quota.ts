/**
 * Keeps an exhausted provider quota from costing time on every request.
 *
 * This was `geminiQuota`, and the problem it solved is not Gemini's: a rate
 * limiter or a spent credit block refuses a call, and the caller should not
 * keep paying the round trip to be told so. When OpenAI answers HTTP 429 with
 * `Rate limit reached for gpt-4o-mini ... Please try again in 850ms`, every AI
 * request in the app would otherwise wait out the refusal before falling back
 * to the deterministic answer it already had.
 *
 * This records the exhaustion and stops calling until the window the API itself
 * named has passed. Nothing is guessed: the wait comes from the error's own
 * retry hint, and falls back to a conservative hour only when the message does
 * not carry one.
 */

/** A per-minute limit names a short retry; a per-day/credit limit names none. */
const DEFAULT_COOLDOWN_MS = 60 * 60 * 1000;

interface QuotaState {
  /** When calls may be attempted again. Null means the quota is believed fine. */
  blockedUntil: number | null;
  /** The API's own wording, kept for /api/health and the logs. */
  reason: string | null;
}

const state: QuotaState = { blockedUntil: null, reason: null };

/**
 * True when the error is the API refusing on quota/rate rather than anything
 * else — a 429, a spent balance, or a burst cap.
 */
export function isQuotaExhaustedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (!message) return false;
  return (
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('"code":429') ||
    message.includes('"code": 429') ||
    message.includes('429 Too Many Requests') ||
    message.includes('Rate limit') ||
    message.includes('rate_limit') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current quota') ||
    message.includes('exceeded your current rate limit')
  );
}

/**
 * Reads a retry delay out of the API's message.
 *
 * Gemini wrote `Please retry in 22.010119056s`; OpenAI writes
 * `Please try again in 850ms` or `Retry after 20 seconds`. Both are read; the
 * result is milliseconds.
 */
function retryDelayMsFrom(message: string): number | null {
  const seconds = /retry in ([\d.]+)s\b/i.exec(message);
  if (seconds) {
    const value = Number(seconds[1]);
    if (Number.isFinite(value) && value > 0) return Math.ceil(value * 1000);
  }

  const millis = /in ([\d.]+)ms\b/i.exec(message);
  if (millis) {
    const value = Number(millis[1]);
    if (Number.isFinite(value) && value > 0) return Math.ceil(value);
  }

  const retryAfter = /retry[-_ ]?after[:\s]+([\d.]+)\s*(ms|milliseconds?|s|sec|seconds?|m|min|minutes?)?/i.exec(message);
  if (retryAfter) {
    const value = Number(retryAfter[1]);
    const unit = (retryAfter[2] || 's').toLowerCase();
    if (Number.isFinite(value) && value > 0) {
      if (unit.startsWith('m') && unit !== 'ms' && unit !== 'milli') return Math.ceil(value * 60_000);
      return Math.ceil(value * 1000);
    }
  }

  return null;
}

/**
 * Records that the quota is spent. Called from the catch of every model call
 * site, so one exhausted request spares all the others.
 */
export function recordQuotaExhausted(error: unknown): void {
  if (!isQuotaExhaustedError(error)) return;

  const message = error instanceof Error ? error.message : String(error ?? '');
  // A per-minute limit names a short retry; a per-day or credit limit does not
  // name one at all, or names a short one that will simply fail again.
  // Whichever is longer is the safe wait.
  const named = retryDelayMsFrom(message);
  const waitMs = Math.max(named ?? 0, DEFAULT_COOLDOWN_MS);

  state.blockedUntil = Date.now() + waitMs;
  state.reason = /insufficient_quota|billing|credit balance/i.test(message)
    ? 'AI provider quota exhausted (insufficient credit).'
    : 'AI provider rate limit reached.';

  console.warn(
    `[AI] ${state.reason} Skipping model calls for ${Math.round(waitMs / 60000)} minute(s); ` +
      'deterministic answers are being served in the meantime.'
  );
}

/** True while calls are known to be pointless. */
export function isQuotaExhausted(): boolean {
  if (state.blockedUntil === null) return false;
  if (Date.now() >= state.blockedUntil) {
    // The window has passed; allow one attempt to find out.
    state.blockedUntil = null;
    state.reason = null;
    return false;
  }
  return true;
}

/** Cleared when a call succeeds, so a topped-up key is picked up immediately. */
export function recordQuotaAvailable(): void {
  state.blockedUntil = null;
  state.reason = null;
}

/** What /api/health reports, so the status is observable rather than guessed at. */
export function quotaStatus(): { exhausted: boolean; reason: string | null; retryAt: string | null } {
  const exhausted = isQuotaExhausted();
  return {
    exhausted,
    reason: exhausted ? state.reason : null,
    retryAt: exhausted && state.blockedUntil ? new Date(state.blockedUntil).toISOString() : null
  };
}
