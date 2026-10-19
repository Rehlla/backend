/**
 * Shared vitest setup: seed the i18n registry views for test environments.
 *
 * The client resolves t() through the per-language registry
 * (src/i18n/translator.ts), which is normally installed by the generated
 * dictionary chunks at boot (main.tsx). No test environment runs that boot:
 *
 * - the node project (vitest.config.ts) has no DOM and imports UI modules
 *   like src/lib/authErrorMessages.ts directly;
 * - the jsdom project (vitest.ui.config.ts) renders LanguageProvider, whose
 *   t() reads the registry through LanguageContext.
 *
 * Both get the same seed: the compiled catalog's precomputed per-language
 * views (EN_VIEW / AR_VIEW — the exact data the generated dictionaries carry,
 * by construction of the drift gate). This keeps dictionary loading out of
 * test scope entirely while resolving identical strings.
 */
import { EN_VIEW, AR_VIEW } from '../src/i18n/translations';
import { setDictionary } from '../src/i18n/translator';

// The registry (LanguageContext's t() surface AND src/lib/authErrorMessages)
// gets BOTH language views, so any module resolves in either language
// without a browser boot.
setDictionary('en', EN_VIEW);
setDictionary('ar', AR_VIEW);
