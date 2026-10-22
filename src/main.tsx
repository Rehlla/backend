import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import { loadInitialDictionary, loadDictionary } from './i18n/boot';

/**
 * i18n boot gate.
 *
 * The dictionary for the INITIAL language is installed before React renders:
 * the first painted frame always resolves strings from a fully installed
 * registry, so t() can never render a raw key on first paint (same guarantee
 * the static-import era gave, now paid as ONE language's dictionary instead
 * of both — the split that cut ~50% of pre-paint dictionary bytes).
 *
 * Latency care (Sinai RTT): boot/translator are statically imported above
 * (they are ~1 kB — a dynamic import here would add a sequential roundtrip
 * before anything else can start), and App's chunk is FETCHED IN PARALLEL
 * with the dictionary. Render waits for both; the network doesn't.
 *
 * The opposite language preloads at idle — that is what keeps language
 * SWITCHES synchronous without shipping it up front.
 *
 * boot.getBootLanguage() is the same decision LanguageContext makes, so the
 * provider initializes in the language whose dictionary this installs.
 * SSR/non-browser safety: loadInitialDictionary is a no-op there.
 */
async function boot(): Promise<void> {
  // Start BOTH fetches now: App's chunk (and its static deps, preloaded with
  // it) races the initial dictionary instead of queueing behind it.
  const appPromise = import('./App');
  const { language } = await loadInitialDictionary();
  const { default: App } = await appPromise;

  // Idle preload of the opposite language: switch stays synchronous, and if
  // a user toggles before the idle callback fires, the switch still works —
  // LanguageContext degrades to fallback resolution and this load's
  // setDictionary side effect lands the full view before the next paint.
  const preload = language === 'ar' ? 'en' : 'ar';
  const idle: (cb: () => void) => void =
    typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (cb) =>
          (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(
            cb
          )
      : (cb) => window.setTimeout(cb, 1);
  idle(() => {
    void loadDictionary(preload).catch(() => {
      // Offline chunk failure must never break the session; the current
      // language is already installed and a failed preload only costs the
      // sync-switch optimization for the other language.
    });
  });

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

// Safely suppress benign Vite HMR websocket disconnection notices in AI Studio container environment
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    const message = event?.reason?.message || String(event?.reason || '');
    if (message.includes('WebSocket closed without opened') || message.includes('failed to connect to websocket')) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  });

  window.addEventListener('error', (event) => {
    const message = event?.message || '';
    if (message.includes('WebSocket closed without opened') || message.includes('failed to connect to websocket')) {
      event.preventDefault();
      event.stopImmediatePropagation?.();
    }
  });
}

void boot();
