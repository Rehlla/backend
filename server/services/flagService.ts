import crypto from 'crypto';
import { db } from '../db/database';
import type { FeatureFlagEntity } from '../db/schema';
import { auditService } from './auditService';

/**
 * Feature flags, kill switches and the maintenance flag.
 *
 * For kind 'killswitch' and 'maintenance', enabled:true means the switch is
 * thrown: the capability is OFF / maintenance is ON. Rows are seeded lazily
 * from FLAG_DEFS, so a fresh store reads every switch as not thrown.
 */

export const KILL_SWITCHES = [
  'killswitch.payments',
  'killswitch.bookings',
  'killswitch.ai',
  'killswitch.sms',
  'killswitch.supplierSignup',
] as const;
export type KillSwitchKey = (typeof KILL_SWITCHES)[number];

export const MAINTENANCE_FLAG = 'system.maintenance';

interface FlagDef {
  key: string;
  kind: FeatureFlagEntity['kind'];
  description: string;
}

export const FLAG_DEFS: readonly FlagDef[] = [
  { key: 'killswitch.payments', kind: 'killswitch', description: 'Stops checkout and payment capture.' },
  { key: 'killswitch.bookings', kind: 'killswitch', description: 'Stops new holds, bookings and orders.' },
  { key: 'killswitch.ai', kind: 'killswitch', description: 'Stops AI-backed endpoints (DayGI, trip generation, intelligence core).' },
  { key: 'killswitch.sms', kind: 'killswitch', description: 'Stops outbound SMS.' },
  { key: 'killswitch.supplierSignup', kind: 'killswitch', description: 'Stops supplier self-signup.' },
  { key: MAINTENANCE_FLAG, kind: 'maintenance', description: 'Maintenance mode: non-staff API calls get 503.' },
];

export function ensureSeeded(): void {
  const now = new Date().toISOString();
  for (const def of FLAG_DEFS) {
    if (db.featureFlags.some(f => f.id === def.key)) continue;
    db.featureFlags.push({
      id: def.key, kind: def.kind, enabled: false, rolloutPercent: 100, roles: [],
      description: def.description, updatedBy: 'SYSTEM', updatedAt: now,
    });
  }
}

export interface FlagView {
  key: string;
  kind: FeatureFlagEntity['kind'];
  enabled: boolean;
  rolloutPercent: number;
  roles: string[];
  description: string;
  updatedBy: string;
  updatedAt: string;
}

const toView = (f: FeatureFlagEntity): FlagView => ({
  key: f.id, kind: f.kind, enabled: f.enabled, rolloutPercent: f.rolloutPercent,
  roles: f.roles, description: f.description, updatedBy: f.updatedBy, updatedAt: f.updatedAt,
});

export function list(): FlagView[] {
  ensureSeeded();
  return db.featureFlags.map(toView);
}

function find(key: string): FeatureFlagEntity | undefined {
  return db.featureFlags.find(f => f.id === key);
}

/** True when the kill switch / maintenance flag is thrown. No row means not thrown. */
export function isThrown(key: string): boolean {
  return find(key)?.enabled === true;
}

/** Per-user evaluation of a 'flag': enabled, role-targeted, and inside the rollout bucket. */
export function isEnabledFor(key: string, user?: { userId: string; role: string } | null): boolean {
  const f = find(key);
  if (!f || !f.enabled) return false;
  if (f.kind !== 'flag') return true;
  if (f.roles.length > 0 && (!user || !f.roles.includes(user.role))) return false;
  if (f.rolloutPercent >= 100) return true;
  if (f.rolloutPercent <= 0 || !user) return false;
  const bucket = parseInt(crypto.createHash('sha256').update(`${key}:${user.userId}`).digest('hex').slice(0, 8), 16) % 100;
  return bucket < f.rolloutPercent;
}

/** Map for /api/auth/me and login: every flag evaluated for this user. */
export function evaluateAll(user?: { userId: string; role: string } | null): Record<string, boolean> {
  ensureSeeded();
  const out: Record<string, boolean> = {};
  for (const f of db.featureFlags) out[f.id] = f.kind === 'flag' ? isEnabledFor(f.id, user) : f.enabled;
  return out;
}

export function update(
  key: string,
  patch: { enabled: boolean; rolloutPercent?: number; roles?: string[] },
  actor: { userId: string; role: string },
  reason: string,
  correlationId?: string
): FlagView {
  ensureSeeded();
  let f = find(key);
  if (!f) {
    // Unknown keys become plain feature flags; kill switches are a fixed set.
    if (key.startsWith('killswitch.') || key.startsWith('system.')) {
      throw Object.assign(new Error(`Unknown flag: ${key}`), { status: 404 });
    }
    if (!/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(key)) throw Object.assign(new Error('Invalid flag key.'), { status: 400 });
    f = { id: key, kind: 'flag', enabled: false, rolloutPercent: 100, roles: [], description: '', updatedBy: actor.userId, updatedAt: new Date().toISOString() };
    db.featureFlags.push(f);
  }
  if (patch.rolloutPercent !== undefined && !(Number.isFinite(patch.rolloutPercent) && patch.rolloutPercent >= 0 && patch.rolloutPercent <= 100)) {
    throw Object.assign(new Error('rolloutPercent must be 0..100.'), { status: 400 });
  }
  const before = toView(f);
  db.runInTransaction(() => {
    f!.enabled = patch.enabled;
    if (patch.rolloutPercent !== undefined) f!.rolloutPercent = patch.rolloutPercent;
    if (patch.roles !== undefined) f!.roles = patch.roles;
    f!.updatedBy = actor.userId;
    f!.updatedAt = new Date().toISOString();
  });
  const after = toView(f);
  auditService.record({
    actor: actor.userId, actorRole: actor.role, action: 'FLAG_UPDATED', entityType: 'Flag', entityId: key,
    before, after, reason, correlationId,
  });
  return after;
}

export const flagService = { KILL_SWITCHES, MAINTENANCE_FLAG, ensureSeeded, list, isThrown, isEnabledFor, evaluateAll, update };
