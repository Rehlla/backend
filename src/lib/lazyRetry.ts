import { lazy } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';

/**
 * Wraps a `React.lazy` factory so a failed dynamic import recovers by reloading
 * the page once instead of dead-ending on the error boundary.
 *
 * Why this exists: Vite serves each lazy chunk under a content hash
 * (`AttractionsView-<hash>.js`). If the bundle is rebuilt or the dep graph is
 * re-optimized while a tab is open — dev server restart, `npm run dev:fresh`,
 * or a deploy landing between two navigations — the URL baked into the
 * already-loaded entry chunk 404s. Nothing in the app can recover from that on
 * its own: the import promise rejects, React throws during render, and the user
 * is stuck on an error page with no way forward except a manual reload.
 *
 * A single reload re-fetches the entry chunk from the current server state,
 * which carries the current hashes, and the route then resolves normally.
 *
 * Guard rails:
 * - At most ONE reload per page load, tracked in sessionStorage, so a genuinely
 *   broken build cannot loop the tab forever.
 * - The flag is cleared as soon as any lazy import succeeds, so the next
 *   unrelated failure in the same browsing session gets a fresh retry.
 * - sessionStorage (not localStorage) so the retry budget is per-tab.
 */
const RETRY_FLAG = 'dg:lazy-chunk-retry';
const MAX_RETRIES = 1;

function readRetryCount(): number {
  try {
    return Number(sessionStorage.getItem(RETRY_FLAG) || '0') || 0;
  } catch {
    // Private mode / storage disabled — treat as "no retries used", the
    // worst case is one extra reload, never an infinite loop.
    return 0;
  }
}

function writeRetryCount(count: number): void {
  try {
    if (count <= 0) sessionStorage.removeItem(RETRY_FLAG);
    else sessionStorage.setItem(RETRY_FLAG, String(count));
  } catch {
    /* storage unavailable: retry budget is best-effort only */
  }
}

export function lazyRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((error: unknown) => {
      if (readRetryCount() < MAX_RETRIES) {
        writeRetryCount(readRetryCount() + 1);
        // Reload rather than throw: the failure is a stale chunk URL, and a
        // fresh entry chunk resolves it without the user doing anything.
        window.location.reload();
        // Suspend forever so React does not also render the error boundary on
        // the way out — the reload is already in flight.
        return new Promise<never>(() => {});
      }
      // Retry budget spent: surface the real failure to the error boundary.
      throw error;
    }),
  );
}

/**
 * Clears the reload budget once the app is alive and rendering again. Called
 * from the root so a successful load after a reload does not leave the tab
 * permanently unable to retry.
 */
export function clearLazyRetryBudget(): void {
  if (readRetryCount() > 0) writeRetryCount(0);
}