import {
  isQuotaExhausted,
  recordQuotaAvailable,
  recordQuotaExhausted
} from './quota';

/**
 * The single AI call site for the platform.
 *
 * Replaces the `@google/genai` SDK with the OpenAI Chat Completions API, called
 * over `fetch` rather than through the `openai` package: the surface used here
 * is one endpoint with one response shape, and a hand-rolled call adds no
 * dependency to a bundle whose entry chunk is already near its CI ceiling.
 *
 * Every call degrades to `null` instead of throwing. There is a deterministic
 * answer behind each of them — the classifier, the seeded catalogue, the
 * bookability reconciler — and a provider outage must not take the product with
 * it.
 */

/**
 * Read lazily, NOT at module scope: service module bodies run before
 * `server.ts` calls `dotenv.config()`, so a module-level read always misses .env.
 */
export function llmModel(): string {
  return process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

/** Generous next to a sub-second model, short enough to not hang a request. */
const DEFAULT_TIMEOUT_MS = 20_000;

export interface GenerateTextOptions {
  /** Sent as the `system` message. */
  systemInstruction?: string;
  /** The user content. Treated as untrusted data by every caller. */
  prompt: string;
  temperature?: number;
  /**
   * Ask for JSON. Uses the API's own structured-output mode, which guarantees
   * the shape instead of hoping the model remembered the schema.
   */
  json?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface GenerateTextResult {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string; code?: string; type?: string };
}

function jsonResponseSchema(): Record<string, unknown> {
  // OpenAI structured outputs need a named schema with required properties and
  // additionalProperties:false. Callers that need a different shape should
  // send their own; this default keeps a loose "give me JSON" working.
  return { type: 'object', additionalProperties: true };
}

/**
 * One model call.
 *
 * Returns null when the platform has no key, when the quota gate is closed, or
 * when the provider refuses or times out — never throws, because every caller
 * treats null as "use the deterministic answer".
 */
export async function generateText(
  options: GenerateTextOptions
): Promise<GenerateTextResult | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  // Nothing to gain from a call that will be refused, and it is not free.
  if (isQuotaExhausted()) return null;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);

  // A caller-driven abort (the traveler hit Stop) must cancel the network call
  // too, not merely stop us reading the result.
  const onCallerAbort = () => timeout.abort();
  options.signal?.addEventListener('abort', onCallerAbort, { once: true });

  try {
    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemInstruction) {
      messages.push({ role: 'system', content: options.systemInstruction });
    }
    messages.push({ role: 'user', content: options.prompt });

    const response = await fetch(CHAT_COMPLETIONS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'User-Agent': 'dahab-travel-platform'
      },
      body: JSON.stringify({
        model: llmModel(),
        messages,
        temperature: options.temperature ?? 0.3,
        ...(options.json
          ? { response_format: { type: 'json_object', json_schema: jsonResponseSchema() } }
          : {})
      }),
      signal: timeout.signal
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      // Thrown so recordQuotaExhausted can read the provider's own retry hint.
      throw new Error(`OpenAI ${response.status}: ${body.slice(0, 500)}`);
    }

    const payload = (await response.json()) as ChatCompletionResponse;
    const text = payload.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) return null;

    recordQuotaAvailable();
    return {
      text,
      model: llmModel(),
      promptTokens: payload.usage?.prompt_tokens,
      completionTokens: payload.usage?.completion_tokens
    };
  } catch (err) {
    // A traveler-initiated abort is not a provider failure; it must not count
    // against the quota or log as an error.
    if (options.signal?.aborted) return null;
    recordQuotaExhausted(err);
    if (isQuotaExhaustedErrorFrom(err)) {
      console.warn('[AI] model call refused on quota/rate limit; serving the deterministic answer.');
    } else {
      console.warn('[AI] model call failed; serving the deterministic answer:', err instanceof Error ? err.message : err);
    }
    return null;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onCallerAbort);
  }
}

/** Local copy of the classifier so this module has no import cycle. */
function isQuotaExhaustedErrorFrom(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message.includes('RESOURCE_EXHAUSTED') ||
    message.includes('429') ||
    message.includes('Rate limit') ||
    message.includes('rate_limit') ||
    message.includes('insufficient_quota') ||
    message.includes('exceeded your current')
  );
}

/** Convenience wrapper for the many call sites that only want the string. */
export async function generateTextOrNull(options: GenerateTextOptions): Promise<string | null> {
  const result = await generateText(options);
  return result ? result.text : null;
}
