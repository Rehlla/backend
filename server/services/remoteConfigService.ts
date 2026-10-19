import crypto from 'crypto';
import { flagService } from './flagService';
import { settingsService } from './settingsService';

/**
 * Unified remote config (GET /api/config, docs/OPS_API_CONTRACT.md).
 *
 * One document the web app and both Flutter apps fetch on boot, so a single
 * desk action — throw a kill switch, enter maintenance, publish a banner,
 * raise a minimum app version — reaches every client without a release:
 *
 * - maintenance: the gate clients show a full-screen notice for.
 * - killswitches: capabilities the clients must not offer (checkout, holds,
 *   AI, SMS, supplier signup). The server enforces the same switches on the
 *   API (controlGates.ts); this copy only lets clients hide dead ends early.
 * - flags: plain feature flags evaluated for the caller (role + rollout
 *   bucket), so experiments target consistently across web and mobile.
 * - settings: the client-safe subset of typed settings (support hours/SLA,
 *   settlement currency). Internal values (SMS templates, commission rate)
 *   are never exposed here.
 * - apps: per-platform minimum/latest versions plus store URLs, so clients
 *   can force-update or nudge without a release.
 * - announcement: one optional banner ({en, ar}) for platform-wide notices.
 *
 * `version` is a content hash: clients send it back as If-None-Match and get
 * a 304 while nothing changed (same ETag convention as /api/operations/overview).
 */

export type ConfigPlatform = 'web' | 'android' | 'ios';
export const CONFIG_PLATFORMS = ['web', 'android', 'ios'] as const;

export interface RemoteConfigCaller {
  userId: string;
  role: string;
}

export interface RemoteConfigInput {
  user?: RemoteConfigCaller | null;
  platform?: ConfigPlatform;
  appVersion?: string;
}

export interface AppGate {
  minVersion: string;
  latestVersion: string;
  storeUrl: string;
  /** True only when the caller sent a valid appVersion below the minimum. */
  updateRequired: boolean;
  /** True only when the caller sent a valid appVersion below the latest. */
  updateAvailable: boolean;
}

export interface RemoteConfig {
  version: string;
  issuedAt: string;
  maintenance: { active: boolean; message: { en: string; ar: string } };
  killswitches: Record<string, boolean>;
  flags: Record<string, boolean>;
  settings: { supportHours: string; supportSlaMinutes: number; currency: string };
  apps: { android: AppGate; ios: AppGate };
  announcement: { tone: 'info' | 'warn'; text: { en: string; ar: string } } | null;
}

/** Numeric dotted-version comparison: 1.10.0 > 1.9.0. Non-conforming input sorts below everything. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => {
    const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
  };
  const pa = parts(a);
  const pb = parts(b);
  if (!pa && !pb) return 0;
  if (!pa) return -1;
  if (!pb) return 1;
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const asText = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

function appGate(platform: 'android' | 'ios', appVersion: string | undefined, forPlatform: ConfigPlatform): AppGate {
  const minVersion = asText(settingsService.get(`apps.${platform}MinVersion`), '1.0.0');
  const latestVersion = asText(settingsService.get(`apps.${platform}LatestVersion`), '1.0.0');
  const storeUrl = asText(settingsService.get(`apps.${platform}StoreUrl`));
  const isCaller = forPlatform === platform && !!appVersion && /^\d+\.\d+\.\d+$/.test(appVersion);
  return {
    minVersion,
    latestVersion,
    storeUrl,
    updateRequired: isCaller ? compareVersions(appVersion as string, minVersion) < 0 : false,
    updateAvailable: isCaller ? compareVersions(appVersion as string, latestVersion) < 0 : false,
  };
}

export function buildRemoteConfig(input: RemoteConfigInput = {}): RemoteConfig {
  const user = input.user ?? null;
  const platform = input.platform ?? 'web';

  const evaluated = flagService.evaluateAll(user);
  const killswitches: Record<string, boolean> = {};
  const flags: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(evaluated)) {
    if (key.startsWith('killswitch.')) killswitches[key.slice('killswitch.'.length)] = value;
    else if (key === flagService.MAINTENANCE_FLAG) continue;
    else flags[key] = value;
  }

  const rawMessage = asRecord(settingsService.get('system.maintenanceMessage'));
  const banner = asRecord(settingsService.get('announce.banner'));

  const payload = {
    maintenance: {
      active: flagService.isThrown(flagService.MAINTENANCE_FLAG),
      message: {
        en: asText(rawMessage.en, 'Dahab is down for scheduled maintenance.'),
        ar: asText(rawMessage.ar, 'دهب متوقف للصيانة.'),
      },
    },
    killswitches,
    flags,
    settings: {
      supportHours: asText(settingsService.get('support.hours'), '09:00-23:00'),
      supportSlaMinutes:
        typeof settingsService.get('support.slaMinutes') === 'number'
          ? (settingsService.get('support.slaMinutes') as number)
          : 30,
      currency: asText(settingsService.get('commerce.currency'), 'EGP'),
    },
    apps: {
      android: appGate('android', input.appVersion, platform),
      ios: appGate('ios', input.appVersion, platform),
    },
    announcement:
      banner.enabled === true
        ? {
            tone: (banner.tone === 'warn' ? 'warn' : 'info') as 'info' | 'warn',
            text: { en: asText(banner.en), ar: asText(banner.ar) },
          }
        : null,
  };

  const version = `cfg-${crypto.createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 12)}`;
  return { version, issuedAt: new Date().toISOString(), ...payload };
}

export const remoteConfigService = { CONFIG_PLATFORMS, buildRemoteConfig, compareVersions };
