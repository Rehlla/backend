/**
 * i18n boot contract — deciding the initial language and installing its
 * dictionary SYNCHRONOUSLY during app bootstrap (main.tsx), before App is
 * dynamically imported.
 *
 * Why this module exists (boot-order care):
 *
 * - LanguageContext reads `localStorage` + `navigator.language` when it
 *   initializes. main.tsx must make the SAME decision to know WHICH
 *   dictionary chunk to load before first render — two decision sites that
 *   can disagree means a flash of the wrong language's copy (or raw keys if
 *   the registry is empty). So the decision lives HERE, exported once, and
 *   both call it. LanguageContext remains the single source of truth for the
 *   SESSION decision (it writes state, persists, applies attributes); this
 *   repeats the READING only, exactly like the pre-hydration script in
 *   index.html already does for lang/dir.
 *
 * - The dictionary is installed SYNCHRONOUSLY at bootstrap: main.tsx awaits
 *   `loadInitialDictionary()` before dynamically importing App, so the first
 *   painted frame always resolves from a fully installed registry — zero raw
 *   keys, same guarantee the static-import era had. `getBootLanguage()` then
 *   hands the decided language to LanguageProvider so it initializes in the
 *   same language without re-reading storage.
 *
 * SSR-safety: every access is guarded — this module is imported by test
 * environments (jsdom) and could be imported by server-side code paths; the
 * guards keep it inert there.
 */

import {
  loadDictionary,
  setDictionary,
  getInstalledView,
  type I18nLang,
} from './translator';
import type { DictView } from './resolve';

// main.tsx bootstraps through this module alone; re-export so it doesn't need
// to know where loadDictionary lives.
export { loadDictionary };

function readStoredLanguage(): I18nLang | null {
  try {
    const saved = localStorage.getItem('dahab_os_lang');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // private-mode storage can throw; fall through to the browser language
  }
  return null;
}

function readBrowserLanguage(): I18nLang {
  try {
    const browserLang =
      typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : '';
    return browserLang.startsWith('ar') ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

/**
 * The initial language, by the exact contract LanguageContext uses:
 * stored choice → Arabic browser → English. Exported for main.tsx (which
 * loads the matching dictionary) and for LanguageProvider's useState
 * initializer (so both agree by construction, not by coincidence).
 */
export function getBootLanguage(): I18nLang {
  return readStoredLanguage() ?? readBrowserLanguage();
}

/**
 * Install the INITIAL language's dictionary synchronously (from main.tsx's
 * perspective: awaited before App is imported) and return the view plus the
 * decided language. Returns a null view in non-browser environments, where
 * nothing renders.
 */
export async function loadInitialDictionary(): Promise<{
  language: I18nLang;
  view: DictView | null;
}> {
  const language = getBootLanguage();
  if (typeof window === 'undefined') {
    return { language, view: null };
  }
  try {
    await loadDictionary(language);
  } catch {
    // Transient failure (offline, deployd chunk not yet reachable): render
    // anyway with a null view. t() then degrades to per-call fallbacks + the
    // registry warning instead of hanging the app on a blank page; a later
    // loadDictionary (idle preload / next boot) heals the copy.
  }
  return { language, view: getInstalledView(language) ?? null };
}

/**
 * Re-install a dictionary synchronously — the language-SWITCH path.
 * LanguageContext calls this inside its setLanguage/toggleLanguage state
 * updater: it already holds the loaded view (kept from the initial load and
 * from the idle preload), so the switch commit never renders through a
 * missing dictionary. If the view is somehow not loaded (preload cancelled
 * before a rapid toggle), the updater still updates language state —
 * t() degrades to the explicit fallback rather than raw keys, and the
 * preload's setDictionary lands before the next paint triggers a re-render
 * via the context value change.
 */
export function installSync(lang: I18nLang, view: DictView): void {
  setDictionary(lang, view);
}
