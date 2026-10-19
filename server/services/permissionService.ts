import crypto from 'crypto';
import { db } from '../db/database';
import type { RoleEntity, UserEntity, UserPermissionOverrideEntity } from '../db/schema';
import {
  BaseRole,
  LATER_ROLE_DEFAULTS,
  PERMISSION_CATALOG,
  SYSTEM_ROLE_DEFAULTS,
  SYSTEM_ROLE_IDS,
  grantCovers,
  isValidGrantKey,
} from '../auth/permissionCatalog';
import { auditService } from './auditService';

/**
 * Effective permissions = role grants + grant overrides − deny overrides.
 * Admin (`*`) gets everything, and a deny override still beats `*`: an
 * override exists precisely to take one thing away from one account.
 *
 * Resolution is cached per user and invalidated by a global generation
 * counter that every write here bumps. The cache is also keyed on the
 * Database state object, so a test that swaps the adapter never sees a stale
 * entry.
 */

export interface PermissionSubject {
  userId: string;
  role: BaseRole;
}

interface CacheEntry {
  generation: number;
  state: unknown;
  grants: string[];
  denies: string[];
}

let generation = 0;
const cache = new Map<string, CacheEntry>();

export function invalidatePermissionCache(): void {
  generation++;
  cache.clear();
}

const nowIso = () => new Date().toISOString();

/** Creates the five system roles if they are missing. Idempotent; never overwrites edits. */
export function ensureSystemRoles(): void {
  backfillLaterDefaults();
  const missing = SYSTEM_ROLE_IDS.filter(id => !db.roles.some(r => r.id === id));
  if (missing.length === 0) return;
  const now = nowIso();
  for (const id of missing) {
    db.roles.push({
      id,
      name: id,
      description: SYSTEM_ROLE_DEFAULTS[id].description,
      isSystem: true,
      permissions: [...SYSTEM_ROLE_DEFAULTS[id].permissions],
      baseRole: id,
      appliedDefaults: LATER_ROLE_DEFAULTS[id] ? ['catalog-v1'] : undefined,
      createdAt: now,
      updatedAt: now,
    });
  }
  invalidatePermissionCache();
}

/**
 * Merges default grants that shipped after a system role was persisted
 * (LATER_ROLE_DEFAULTS, the catalogue keys) into stored system roles, once
 * per role. The marker means an admin who later removes the keys keeps them
 * removed.
 */
function backfillLaterDefaults(): void {
  let changed = false;
  for (const role of db.roles) {
    if (!role.isSystem) continue;
    const later = LATER_ROLE_DEFAULTS[role.id as BaseRole];
    if (!later || role.appliedDefaults?.includes('catalog-v1')) continue;
    for (const key of later.permissions) if (!role.permissions.includes(key)) role.permissions.push(key);
    role.appliedDefaults = [...(role.appliedDefaults || []), 'catalog-v1'];
    changed = true;
  }
  if (changed) invalidatePermissionCache();
}

export function listRoles(): RoleEntity[] {
  ensureSystemRoles();
  return db.roles;
}

export function getRole(id: string): RoleEntity | undefined {
  ensureSystemRoles();
  return db.roles.find(r => r.id === id);
}

/** The role an account's permissions come from. */
export function roleIdFor(user: { role: string; roleId?: string }): string {
  return user.roleId || user.role;
}

function computeFor(subject: PermissionSubject): { grants: string[]; denies: string[] } {
  const stored = db.users.find(u => u.id === subject.userId) as UserEntity | undefined;
  // The session's role is authoritative for the base role; roleId only ever
  // narrows/extends it through an admin-assigned custom role.
  const roleId = stored?.roleId || subject.role;
  const role = getRole(roleId) || getRole(subject.role);
  // A role row that disappeared falls back to the base role's defaults, never to nothing-or-everything guesses.
  const roleGrants = role ? role.permissions : SYSTEM_ROLE_DEFAULTS[subject.role]?.permissions || [];
  const overrides = db.userPermissionOverrides.filter(o => o.userId === subject.userId);
  const grants = [...roleGrants, ...overrides.filter(o => o.effect === 'grant').map(o => o.permission)];
  const denies = overrides.filter(o => o.effect === 'deny').map(o => o.permission);
  return { grants, denies };
}

function entryFor(subject: PermissionSubject): CacheEntry {
  const state = db.state;
  const key = `${subject.userId}|${subject.role}`;
  const hit = cache.get(key);
  if (hit && hit.generation === generation && hit.state === state) return hit;
  const { grants, denies } = computeFor(subject);
  const entry = { generation, state, grants, denies };
  cache.set(key, entry);
  return entry;
}

export function hasPermission(subject: PermissionSubject | undefined | null, key: string): boolean {
  if (!subject) return false;
  const { grants, denies } = entryFor(subject);
  if (denies.some(d => grantCovers(d, key))) return false;
  return grants.some(g => grantCovers(g, key));
}

export function hasAnyPermission(subject: PermissionSubject | undefined | null, keys: string[]): boolean {
  return keys.some(k => hasPermission(subject, k));
}

/** Expanded effective keys. Admin is reported as ['*'] plus nothing denied. */
export function resolve(subject: PermissionSubject): string[] {
  const { grants } = entryFor(subject);
  if (grants.includes('*') && PERMISSION_CATALOG.every(d => hasPermission(subject, d.key))) return ['*'];
  return PERMISSION_CATALOG.filter(d => hasPermission(subject, d.key)).map(d => d.key);
}

export function overridesFor(userId: string): UserPermissionOverrideEntity[] {
  return db.userPermissionOverrides.filter(o => o.userId === userId);
}

export function setOverrides(
  userId: string,
  overrides: { permission: string; effect: 'grant' | 'deny' }[],
  actor: { userId: string; role: string },
  reason: string,
  correlationId?: string
): UserPermissionOverrideEntity[] {
  for (const o of overrides) {
    if (!isValidGrantKey(o.permission)) throw Object.assign(new Error(`Unknown permission: ${o.permission}`), { status: 400 });
    if (o.effect !== 'grant' && o.effect !== 'deny') throw Object.assign(new Error('effect must be grant or deny.'), { status: 400 });
  }
  const before = overridesFor(userId).map(o => ({ permission: o.permission, effect: o.effect }));
  const now = nowIso();
  db.runInTransaction(() => {
    for (let i = db.userPermissionOverrides.length - 1; i >= 0; i--) {
      if (db.userPermissionOverrides[i].userId === userId) db.userPermissionOverrides.splice(i, 1);
    }
    const seen = new Set<string>();
    for (const o of overrides) {
      if (seen.has(o.permission)) continue;
      seen.add(o.permission);
      db.userPermissionOverrides.push({
        id: `OVR-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
        userId,
        permission: o.permission,
        effect: o.effect,
        createdBy: actor.userId,
        createdAt: now,
      });
    }
  });
  invalidatePermissionCache();
  auditService.record({
    actor: actor.userId, actorRole: actor.role, action: 'USER_OVERRIDES_SET', entityType: 'User', entityId: userId,
    before, after: overrides, reason, correlationId,
  });
  return overridesFor(userId);
}

export const permissionService = {
  ensureSystemRoles,
  listRoles,
  getRole,
  roleIdFor,
  hasPermission,
  hasAnyPermission,
  resolve,
  overridesFor,
  setOverrides,
  invalidate: invalidatePermissionCache,
};
