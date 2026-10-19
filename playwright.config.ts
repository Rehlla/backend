import path from 'path';
import { defineConfig, devices } from 'playwright/test';

/**
 * E2E suite (playwright) — boots its own isolated dev server.
 *
 * Safety: each run gets a fresh throwaway data dir
 * (`tests/e2e/.data/run-<pid>-<ts>`) on a throwaway port (3100) with a fixed
 * ≥16-char SEED_USER_PASSWORD, so seeds (Admin/Ops/Traveler demo accounts +
 * Ahmed's trip) exist on every boot and the real `data/` store is never
 * touched. `.env` is still read from the repo (dotenv does not override vars
 * already present in the process env). Playwright boots the web server before
 * globalSetup, so a stable dir would always be held open by the running
 * server while setup tries to wipe it — a unique dir avoids the race entirely.
 */
// 127.0.0.1, not localhost: Windows hosts files often resolve localhost to
// ::1 only while the server binds IPv4 — see tests/e2e/helpers/config.ts.
const BASE_URL = 'http://127.0.0.1:3100';
const SEED_USER_PASSWORD = 'PlaywrightQA2026!Secure';

// Unique per-run state dir, shared with globalSetup via the process env.
const RUN_DATA_DIR = path.resolve(process.cwd(), 'tests/e2e/.data', `run-${process.pid}-${Date.now()}`);
process.env.E2E_DATA_DIR = RUN_DATA_DIR;

/**
 * The command that boots the isolated server.
 *
 * `npm` is correct for CI (linux: npm is a real executable). On Windows dev
 * boxes Node's spawn refuses .cmd shims since the 18.20/20.12 security change
 * (CVE-2024-27980), so "npm run dev" dies with "'npm' is not recognized" even
 * though cmd.exe finds it fine. Overriding with `npx tsx server.ts` — which
 * spawns node directly — is the documented workaround, set from the shell:
 *
 *   E2E_WEB_SERVER_CMD="npx tsx server.ts" npx playwright test
 */
const WEB_SERVER_COMMAND = process.env.E2E_WEB_SERVER_CMD || 'npm run dev';

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: WEB_SERVER_COMMAND,
    // Without this, Node spawns the command directly and Windows refuses .cmd
    // shims (npm, npx) since the 18.20/20.12 security change — "'npm' is not
    // recognized" from a PATH that plainly has it. With it, the command runs
    // through the platform shell (cmd.exe / sh), which is also what makes the
    // E2E_WEB_SERVER_CMD override above usable. No effect on linux CI beyond
    // an extra /bin/sh -c wrapper.
    shell: true,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      ...process.env,
      // Windows env keys are case-insensitive to the OS but NOT to the JS
      // object spread. Playwright writes its own `PATH` (it prepends
      // node_modules/.bin), while this process's key is `Path` — the spread
      // produced BOTH, and cmd resolved the one without nodejs, which is why
      // 'npm'/'npx' were "not recognized" by the spawned web server. Writing
      // the resolved value under one canonical key removes the ambiguity; on
      // linux, where the key is already PATH, this is a no-op.
      PATH: process.env.PATH || process.env.Path || '',
      PORT: '3100',
      DAHAB_DATA_DIR: RUN_DATA_DIR,
      SEED_USER_PASSWORD,
      // The E2E suite does not use HMR; disabling it avoids Vite binding the
      // default HMR port (24678) which other processes on this machine occupy.
      DISABLE_HMR: 'true',
    },
  },
  projects: [
    {
      name: 'en',
      use: { ...devices['Desktop Chrome'], locale: 'en-US' },
      testIgnore: [],
    },
    {
      name: 'ar',
      use: { ...devices['Desktop Chrome'], locale: 'ar-EG' },
      testIgnore: [],
    },
    // Mobile-first gate (Phase 5): the same journeys on a 375px phone.
    // Tests that are desktop-only assert skip via test.skip(() => ...)
    // against viewport checks; everything else must survive a phone.
    {
      name: 'mobile-375',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 375, height: 812 },
        locale: 'en-US',
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});