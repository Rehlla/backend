import { fetchWithTimeout } from './api';

/**
 * Unified remote config (GET /api/config).
 *
 * The one document every client fetches on boot: maintenance state, kill
 * switches, feature flags, client-safe settings, app gates and the
 * announcement banner. The desk changes any of them and every client picks
 * it up without a release.
 */

export interface BilingualText {
  en: string;
  ar: string;
}

export interface AppGate {
  minVersion: string;
  latestVersion: string;
  storeUrl: string;
  updateRequired: boolean;
  updateAvailable: boolean;
}

export interface RemoteConfig {
  version: string;
  issuedAt: string;
  maintenance: { active: boolean; message: BilingualText };
  killswitches: Record<string, boolean>;
  flags: Record<string, boolean>;
  settings: { supportHours: string; supportSlaMinutes: number; currency: string };
  apps: { android: AppGate; ios: AppGate };
  announcement: { tone: 'info' | 'warn'; text: BilingualText } | null;
}

const STORAGE_KEY = 'dahab_remote_config';
const ETAG_KEY = 'dahab_remote_config_etag';

/** Last known config, if any — so gates work before the first fetch lands. */
export function getCachedRemoteConfig(): RemoteConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RemoteConfig;
    if (!parsed || typeof parsed.version !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(config: RemoteConfig, etag: string | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    if (etag) localStorage.setItem(ETAG_KEY, etag);
    else localStorage.removeItem(ETAG_KEY);
  } catch {
    // Private windows and full disks: the app works without the cache.
  }
}

/**
 * Fetches the current config. Sends the cached version as If-None-Match and
 * returns `{ notModified: true }` on a 304, keeping the cache. Never throws
 * for an unchanged or unreachable backend — callers fall back to the cache.
 */
export async function fetchRemoteConfig(): Promise<{ config: RemoteConfig | null; notModified: boolean }> {
  const etag = (() => {
    try {
      return localStorage.getItem(ETAG_KEY);
    } catch {
      return null;
    }
  })();
  const res = await fetchWithTimeout('/api/config?platform=web', {
    headers: etag ? { 'If-None-Match': etag } : {},
  });
  if (res.status === 304) return { config: getCachedRemoteConfig(), notModified: true };
  if (!res.ok) return { config: getCachedRemoteConfig(), notModified: false };
  const config = (await res.json()) as RemoteConfig;
  writeCache(config, res.headers.get('etag'));
  return { config, notModified: false };
}

/** True when the desk has switched payments off — hide dead ends before the server 503s them. */
export function paymentsOff(config: RemoteConfig | null): boolean {
  return config?.killswitches?.payments === true;
}

/** True when holds and new bookings are frozen. */
export function bookingsOff(config: RemoteConfig | null): boolean {
  return config?.killswitches?.bookings === true;
}
