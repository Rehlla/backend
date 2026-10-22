/**
 * Client-side i18n registry — lazy per-language dictionary loading.
 *
 * Before the split, `src/i18n/translations.ts` (both languages, ~50% avoidable
 * pre-paint bytes) was bundled into the index chunk and downloaded whole for
 * every first-time visitor. Client code now goes through THIS module instead:
 *
 * - `setDictionary(lang, view)` is called by the thin generated dictionary
 *   modules (dictionaries/en.ts, dictionaries/ar.ts) as their module side
 *   effect, so importing a dictionary chunk IS installing it.
 * - `loadDictionary(lang)` dynamically imports the chunk for a language.
 *   main.tsx awaits it for the initial language BEFORE dynamically importing
 *   App, so the first painted frame can never resolve through an empty
 *   registry (zero raw-key flash, same guarantee as the static-import era).
 * - `t()` resolves only from installed dictionaries. Nothing in the client
 *   imports the authoring catalog — that import ban is what keeps the split
 *   real (tests/domain/i18nDictionarySync.test.ts enforces it), so the index
 *   chunk carries resolver code only (~1 kB) instead of the dictionary.
 *
 * Language SWITCHES are synchronous: LanguageContext calls
 * `ensureDictionarySync(lang)` with the already-loaded view (it holds a
 * reference from the initial load), so a toggle re-renders from a fully
 * installed dictionary in the same commit — a missing string can never be
 * visible for a frame. The OTHER language preloads at idle in the background
 * (main.tsx), which is what makes that synchronous path available.
 */
import { resolveString, type DictView, type TVars } from './resolve';

const installed = new Map<'en' | 'ar', DictView>();

export type I18nLang = 'en' | 'ar';

/** True when the language's dictionary chunk is loaded and installed. */
export function hasDictionary(lang: I18nLang): boolean {
  return installed.has(lang);
}

/** Install (or re-install) a language view. Called by the generated modules and by ensureDictionarySync. */
export function setDictionary(lang: I18nLang, view: DictView): void {
  installed.set(lang, view);
}

/**
 * Load (and install) the dictionary chunk for a language. Idempotent: the
 * dynamic import is cached by the module system, and setDictionary is a
 * cheap Map write, so repeat calls are safe.
 */
export async function loadDictionary(lang: I18nLang): Promise<void> {
  if (installed.has(lang)) return;
  if (lang === 'ar') {
    await import('./dictionaries/ar');
  } else {
    await import('./dictionaries/en');
  }
}

/**
 * Synchronous variant for in-session language switches: LanguageContext
 * already holds the loaded view (see readInitialLanguage contract in
 * boot.ts), so it can install it without awaiting anything.
 */
export function ensureDictionarySync(lang: I18nLang, view: DictView): void {
  setDictionary(lang, view);
}

/**
 * Registry-backed t(). Same signature and contract as the compiled
 * translate(): own language → the English view as cross-language fallback
 * (the compiled catalog's fallback language, provided by the caller when
 * installed) → dev warning once → fallback ?? key.
 */
export function translateFrom(
  view: DictView | undefined,
  otherView: DictView | undefined,
  key: string,
  language: I18nLang,
  vars?: TVars,
  fallback?: string
): string {
  if (!view) {
    // Registry not installed (a t() call escaped the boot gate — see
    // main.tsx). Fail visibly in dev, degrade to the explicit fallback in
    // prod instead of rendering the raw key to a traveler.
    if (import.meta.env.DEV) console.warn(`[i18n] dictionary for "${language}" not loaded; key: ${key}`);
    return fallback ?? key;
  }
  return resolveString(view, otherView, key, language, vars, fallback, {
    dev: import.meta.env.DEV === true,
  });
}

export function getInstalledView(lang: I18nLang): DictView | undefined {
  return installed.get(lang);
}

/**
 * The compiled catalog's fallback language. Callers hand the EN view to
 * translateFrom() as the cross-language fallback when it is installed.
 */
export const FALLBACK_LANGUAGE: I18nLang = 'en';
