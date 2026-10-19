/**
 * Content-integrity guard against literal escape sequences.
 *
 * Editors sometimes paste copy out of JSON payloads, API responses or
 * translation files, producing text that *looks* right in the dashboard
 * input but renders to travelers as literal characters: `We\u2019ll`,
 * `\u00e9`, `\n` shown as backslash-n, and so on. The dashboard must refuse
 * such values at write time with a message that names the offender —
 * silent rendering corruption is worse than a rejected save.
 *
 * Only ASCII backslash sequences are flagged. Real Unicode text (Arabic,
 * emoji, typographic quotes) passes untouched.
 */

const LITERAL_ESCAPE_RE = /\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|n|r|t|["\\/bf])/;

/** First literal escape sequence found in `value`, or null when clean. */
export function findLiteralEscape(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const m = value.match(LITERAL_ESCAPE_RE);
  return m ? m[0] : null;
}

export class LiteralEscapeError extends Error {
  public readonly status = 400;
  constructor(field: string, sequence: string) {
    super(
      `"${field}" contains the literal text "${sequence}" — it would render ` +
        `exactly like that to travelers. Paste the real character instead ` +
        `(e.g. ’ not \\u2019).`
    );
    this.name = 'LiteralEscapeError';
  }
}

/**
 * Reject any listed field whose value carries a literal escape sequence.
 * Pass the registry-allowed field names; unknown keys are ignored so this
 * stays a pure content check, not a schema validator.
 */
export function assertNoLiteralEscapes(
  fields: Record<string, unknown>,
  allowed: readonly string[]
): void {
  const allowedSet = new Set(allowed);
  for (const [field, value] of Object.entries(fields)) {
    if (!allowedSet.has(field) || typeof value !== 'string' || value === '') continue;
    const hit = findLiteralEscape(value);
    if (hit) throw new LiteralEscapeError(field, hit);
  }
}
