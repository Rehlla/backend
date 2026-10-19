import { readdirSync, rmSync } from 'fs';
import { fileURLToPath } from 'url';

const E2E_DATA_ROOT = fileURLToPath(new URL('./.data', import.meta.url));

/**
 * The web server boots against a fresh per-run data dir (RUN_DATA_DIR, set in
 * playwright.config.ts) whose seeds (Admin/Ops/Traveler + Ahmed's trip) only
 * fire when the user table is empty. Each run therefore needs no wiping of its
 * own dir; this setup only garbage-collects dirs from older runs that are no
 * longer held open by a server. It never touches the real data/ store.
 */
export default async function globalSetup(): Promise<void> {
  const current = process.env.E2E_DATA_DIR;
  let stale: string[] = [];
  try {
    stale = readdirSync(E2E_DATA_ROOT);
  } catch {
    return; // no runs yet
  }
  for (const entry of stale) {
    const full = fileURLToPath(new URL(`./.data/${entry}`, import.meta.url));
    if (full.toLowerCase() === current?.toLowerCase()) continue;
    try {
      rmSync(full, { recursive: true, force: true });
    } catch {
      // held by a lingering process from a previous run — leave for next run
    }
  }
}