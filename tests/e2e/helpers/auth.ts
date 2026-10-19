import type { BrowserContext, APIRequestContext, Page } from 'playwright/test';
import { BASE_URL, SEED_USER_PASSWORD } from './config';

/**
 * Register a brand-new Traveler via the API and inject the resulting session
 * cookie into the browser context. The server always creates a Traveler
 * regardless of any requested role, so this is only for traveler surfaces.
 */
export async function registerBasicTraveler(
  context: BrowserContext,
  name: string,
): Promise<string> {
  const email = `e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@dahab.travel`;
  await injectSessionCookieFrom(context, context.request, async (req) => {
    const res = await req.post(`${BASE_URL}/api/auth/register`, {
      data: { name, email, password: 'QA2026!', role: 'Traveler' },
    });
    return res;
  });
  return email;
}

/**
 * Sign in as one of the seeded demo accounts (created by runMigrationsAndSeed
 * against the isolated data dir, password = SEED_USER_PASSWORD) and inject the
 * session cookie. Used for the Operations/Admin surfaces that self-service
 * registration cannot reach.
 */
export async function signInAsSeed(
  context: BrowserContext,
  email: string,
): Promise<void> {
  await injectSessionCookieFrom(context, context.request, async (req) => {
    return req.post(`${BASE_URL}/api/auth/login`, {
      data: { email, password: SEED_USER_PASSWORD },
    });
  });
}

async function injectSessionCookieFrom(
  context: BrowserContext,
  request: APIRequestContext,
  call: (req: APIRequestContext) => Promise<{ headers(): Record<string, string> }>,
): Promise<void> {
  const res = await call(request);
  const raw = res.headers()['set-cookie'] ?? '';
  const m = raw.match(/dahab_auth_token=([^;]+)/);
  if (!m) {
    throw new Error(`E2E auth failed: no session cookie in response (${raw.split('=')[0]})`);
  }
  await context.addCookies([
    // Domain must match BASE_URL's host (127.0.0.1) — see helpers/config.ts.
    { name: 'dahab_auth_token', value: m[1], domain: '127.0.0.1', path: '/' },
  ]);
}

/**
 * Once a session cookie is injected, reload the page so the browser sends it
 * on the initial document request. Must be called with a page already on the
 * target origin (any URL).
 */
export async function reloadAsAuthed(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' });
}