/**
 * Shared string-resolution primitives for the i18n dictionary.
 *
 * This module exists because the dictionary data itself cannot be shared the
 * same way. `translations.ts` is the authoring catalog (both languages in one
 * object); the client loads its data as two per-language generated chunks via
 * `translator.ts`, and `translations.ts` must never be imported by client code
 * at all — an importer would pin the entire bilingual object into its chunk
 * (see the import-ban gate in tests/domain/i18nDictionarySync.test.ts), which
 * is exactly the pre-split behavior this split removes.
 *
 * So both consumers call THESE functions, each pointing them at its own data
 * source, and the resolution contract lives in exactly one place:
 *
 * - `translations.ts` (compiled, both languages) precomputes per-language
 *   views and calls `resolveString` with `(view, language, fallbackLanguage)`.
 * - `translator.ts` (client registry, one language loaded) calls
 *   `resolveString` with `(registryEntry, language, undefined)` — the entry
 *   already belongs to the active language.
 *
 * `translate()`'s optional 5th parameter is how `tests/i18nSeed.ts` and
 * `tests/ui/setup.ts` hand the test registry to the catalog without a
 * module-scope global.
 */

/**
 * Canonical UI-language and interpolation-var types. They live HERE (not in
 * translations.ts) so client modules can import them without touching the
 * authoring catalog — the import ban on translations.ts (see
 * tests/domain/i18nDictionarySync.test.ts) is absolute, type imports
 * included, which keeps the rule trivial to enforce and impossible to
 * accidentally bypass. translations.ts re-exports both for compatibility.
 */
export type Language = 'en' | 'ar';

export type TVars = Record<string, string | number>;

export interface DictEntry {
  en: string;
  ar: string;
}

/** One language's view of the dictionary: key → cooked template string. */
export type DictView = Record<string, string>;

/**
 * Resolve one key from the active language's view.
 *
 * Contract (identical for both consumers):
 * 1. `view[key]` exists → interpolate vars (if any) and return it.
 * 2. `view[key]` is missing but `fallbackView[key]` exists (the compiled
 *    catalog's cross-language fallback: a missing entry in one language
 *    renders the other rather than the raw key) → interpolate and return it.
 * 3. Missing everywhere → in DEV log once per call the same warning the
 *    original translate() emitted, and return `fallback ?? key`.
 */
export function resolveString(
  view: DictView | undefined,
  fallbackView: DictView | undefined,
  key: string,
  language: Language,
  vars?: TVars,
  fallback?: string,
  opts?: { dev?: boolean }
): string {
  const interpolateIfVars = (text: string) =>
    vars ? interpolateText(text, vars) : text;

  const own = view?.[key];
  if (own !== undefined) return interpolateIfVars(own);

  const other = fallbackView?.[key];
  if (other !== undefined) return interpolateIfVars(other);

  if (opts?.dev) console.warn(`[i18n] missing translation key: ${key}`);
  return fallback ?? key;
}

/**
 * Variable interpolation — {name}, {count}, … replaced for every occurrence.
 * Kept as a local copy of src/i18n/interpolate.ts semantics so that the
 * resolve layer has zero imports: translations.ts (which the server imports)
 * and translator.ts (which ships to the client) both end up dependency-free.
 */
export function interpolateText(
  template: string,
  vars: TVars
): string {
  return Object.entries(vars).reduce(
    (acc, [k, v]) => acc.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    template
  );
}
