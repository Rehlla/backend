import crypto from 'crypto';
import { db } from '../db/database';
import type { RoleEntity, UserEntity } from '../db/schema';
import { authService } from './authService';
import { auditService } from './auditService';
import {
  ensureSystemRoles,
  getRole,
  invalidatePermissionCache,
  overridesFor,
  resolve,
} from './permissionService';
import { isValidGrantKey, type BaseRole } from '../auth/permissionCatalog';

/**
 * Staff access administration behind /api/admin/users and /api/admin/roles.
 * Every write is audited with the caller's reason. Granting Admin is NOT
 * gated here — the route queues it through approvalService and the approval
 * executor calls applyUserUpdate once a second admin agrees.
 */

export interface Actor {
  userId: string;
  role: string;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: UserEntity['role'];
  supplierId?: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

const httpError = (status: number, message: string) => Object.assign(new Error(message), { status });

export function toPublicUser(u: Omit<UserEntity, 'passwordHash' | 'passwordSalt'> | UserEntity): PublicUser {
  const out: PublicUser = {
    id: u.id, email: u.email, name: u.name, phone: u.phone || '', role: u.role,
    status: u.status === 'suspended' ? 'suspended' : 'active', createdAt: u.createdAt,
  };
  if (u.supplierId) out.supplierId = u.supplierId;
  return out;
}

export function devicesFor(userId: string) {
  return db.deviceSessions
    .filter(d => d.userId === userId && !d.revokedAt)
    .map(d => ({ id: d.id, name: d.name, platform: d.platform, lastSeenAt: d.lastSeenAt, createdAt: d.createdAt }));
}

export function listUserRows(filters: { role?: string; status?: string }) {
  return db.users
    .filter(u => !filters.role || u.role === filters.role || u.roleId === filters.role)
    .filter(u => !filters.status || (u.status || 'active') === filters.status)
    .map(u => {
      const devices = devicesFor(u.id);
      const lastSeenAt = devices.map(d => d.lastSeenAt).sort().pop();
      return { ...toPublicUser(u), ...(lastSeenAt ? { lastSeenAt } : {}), deviceCount: devices.length };
    });
}

export function getUser(id: string): UserEntity {
  const u = db.users.find(x => x.id === id);
  if (!u) throw httpError(404, 'User not found.');
  return u;
}

export function userDetail(id: string) {
  const u = getUser(id);
  return {
    user: toPublicUser(u),
    roleId: u.roleId || u.role,
    overrides: overridesFor(id).map(o => ({ permission: o.permission, effect: o.effect, createdBy: o.createdBy, createdAt: o.createdAt })),
    effectivePermissions: resolve({ userId: u.id, role: u.role }),
    devices: devicesFor(id),
  };
}

function roleOrThrow(roleId: string): RoleEntity {
  const role = getRole(roleId);
  if (!role) throw httpError(400, `Unknown role: ${roleId}`);
  return role;
}

/** True when this change would give the account Admin. */
export function grantsAdmin(userId: string, patch: { roleId?: string }): boolean {
  if (!patch.roleId) return false;
  const role = roleOrThrow(patch.roleId);
  const current = db.users.find(u => u.id === userId);
  return role.baseRole === 'Admin' && current?.role !== 'Admin';
}

export function inviteUser(
  input: { email: string; name: string; phone?: string; roleId: string; supplierId?: string },
  actor: Actor,
  correlationId?: string
): { user: PublicUser; tempPassword: string } {
  const role = roleOrThrow(input.roleId);
  if (role.baseRole === 'Admin') throw httpError(403, 'Admins cannot be invited directly; invite with another role and request Admin through an approval.');
  if (role.baseRole === 'Traveler') throw httpError(400, 'Invite is for staff and supplier accounts.');
  if (role.baseRole === 'Supplier' && !input.supplierId) throw httpError(400, 'supplierId is required for a Supplier role.');
  const email = input.email.trim().toLowerCase();
  if (db.users.some(u => u.email.toLowerCase() === email)) throw httpError(409, 'A user with this email already exists.');
  const tempPassword = crypto.randomBytes(12).toString('base64url');
  const salt = authService.generateSalt();
  const now = new Date().toISOString();
  const user: UserEntity = {
    id: `USR-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    email,
    name: input.name,
    phone: input.phone || '',
    passwordHash: authService.hashPasswordScrypt(tempPassword, salt),
    passwordSalt: salt,
    passwordAlgorithm: 'scrypt',
    role: role.baseRole,
    ...(role.isSystem ? {} : { roleId: role.id }),
    ...(input.supplierId ? { supplierId: input.supplierId } : {}),
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  db.runInTransaction(() => {
    db.users.push(user);
  });
  invalidatePermissionCache();
  auditService.record({
    actor: actor.userId, actorRole: actor.role, action: 'USER_INVITED', entityType: 'User', entityId: user.id,
    after: toPublicUser(user), reason: 'Staff invite', correlationId,
  });
  return { user: toPublicUser(user), tempPassword };
}

export interface UserPatch {
  roleId?: string;
  status?: 'active' | 'suspended';
  supplierId?: string;
  name?: string;
}

export function applyUserUpdate(userId: string, patch: UserPatch, actor: Actor, reason: string, correlationId?: string): PublicUser {
  const user = getUser(userId);
  const before = { ...toPublicUser(user), roleId: user.roleId || user.role };
  let role: RoleEntity | undefined;
  if (patch.roleId) role = roleOrThrow(patch.roleId);
  if (patch.status && patch.status !== 'active' && patch.status !== 'suspended') throw httpError(400, 'status must be active or suspended.');
  if (userId === actor.userId && patch.status === 'suspended') throw httpError(400, 'You cannot suspend your own account.');
  db.runInTransaction(() => {
    if (role) {
      user.role = role.baseRole as BaseRole;
      if (role.isSystem) delete user.roleId;
      else user.roleId = role.id;
      // The session row carries the role too; keep live sessions honest.
      for (const s of db.sessions) if (s.userId === userId) s.role = role.baseRole;
    }
    if (patch.status) user.status = patch.status;
    if (patch.supplierId !== undefined) user.supplierId = patch.supplierId || undefined;
    if (patch.name) user.name = patch.name;
    user.updatedAt = new Date().toISOString();
  });
  if (patch.status === 'suspended') revokeSessions(userId, actor, `Suspended: ${reason}`, correlationId, false);
  invalidatePermissionCache();
  const after = { ...toPublicUser(user), roleId: user.roleId || user.role };
  auditService.record({ actor: actor.userId, actorRole: actor.role, action: 'USER_UPDATED', entityType: 'User', entityId: userId, before, after, reason, correlationId });
  return toPublicUser(user);
}

/** Deletes every session (cookie, legacy native, access) and revokes every device session + refresh token. */
export function revokeSessions(userId: string, actor: Actor, reason: string, correlationId?: string, audit = true): number {
  getUser(userId);
  let count = 0;
  const now = new Date().toISOString();
  db.runInTransaction(() => {
    for (let i = db.sessions.length - 1; i >= 0; i--) {
      if (db.sessions[i].userId === userId) {
        db.sessions.splice(i, 1);
        count++;
      }
    }
    for (const d of db.deviceSessions) {
      if (d.userId === userId && !d.revokedAt) {
        d.revokedAt = now;
        d.revokedReason = reason;
      }
    }
    for (const r of db.refreshTokens) if (r.userId === userId && !r.revokedAt) r.revokedAt = now;
  });
  if (audit) {
    auditService.record({ actor: actor.userId, actorRole: actor.role, action: 'USER_SESSIONS_REVOKED', entityType: 'User', entityId: userId, after: { revokedCount: count }, reason, correlationId });
  }
  return count;
}

// ─── Roles ──────────────────────────────────────────────────────────────────

export function roleView(r: RoleEntity) {
  return {
    id: r.id, name: r.name, description: r.description, isSystem: r.isSystem, permissions: r.permissions,
    baseRole: r.baseRole,
    userCount: db.users.filter(u => (u.roleId || u.role) === r.id).length,
  };
}

function validatePermissions(perms: unknown): string[] {
  if (!Array.isArray(perms)) throw httpError(400, 'permissions must be an array.');
  for (const p of perms) {
    if (typeof p !== 'string' || !isValidGrantKey(p)) throw httpError(400, `Unknown permission: ${String(p)}`);
  }
  return [...new Set(perms as string[])];
}

const BASE_ROLES: BaseRole[] = ['Traveler', 'Supplier', 'Operations', 'Product', 'Admin'];

export function createRole(input: { name: string; description?: string; permissions: unknown; baseRole?: string }, actor: Actor, correlationId?: string) {
  ensureSystemRoles();
  const name = input.name.trim();
  if (db.roles.some(r => r.name.toLowerCase() === name.toLowerCase())) throw httpError(409, 'A role with this name already exists.');
  const baseRole = (input.baseRole || 'Operations') as BaseRole;
  if (!BASE_ROLES.includes(baseRole) || baseRole === 'Admin' || baseRole === 'Traveler') {
    throw httpError(400, 'baseRole must be Operations, Product or Supplier.');
  }
  const permissions = validatePermissions(input.permissions);
  if (permissions.includes('*')) throw httpError(400, 'Only the system Admin role may hold *.');
  const now = new Date().toISOString();
  const role: RoleEntity = {
    id: `ROLE-${crypto.randomBytes(4).toString('hex')}`, name, description: input.description || '', isSystem: false,
    permissions, baseRole, createdAt: now, updatedAt: now, updatedBy: actor.userId,
  };
  db.runInTransaction(() => { db.roles.push(role); });
  invalidatePermissionCache();
  auditService.record({ actor: actor.userId, actorRole: actor.role, action: 'ROLE_CREATED', entityType: 'Role', entityId: role.id, after: roleView(role), correlationId });
  return roleView(role);
}

export function updateRole(id: string, patch: { name?: string; description?: string; permissions?: unknown }, actor: Actor, reason: string, correlationId?: string) {
  const role = getRole(id);
  if (!role) throw httpError(404, 'Role not found.');
  if (role.isSystem && patch.name !== undefined && patch.name !== role.name) throw httpError(400, 'System roles cannot be renamed.');
  if (role.id === 'Admin' && patch.permissions !== undefined) throw httpError(400, 'The Admin role always holds *.');
  const before = roleView(role);
  const permissions = patch.permissions !== undefined ? validatePermissions(patch.permissions) : undefined;
  if (permissions?.includes('*')) throw httpError(400, 'Only the system Admin role may hold *.');
  db.runInTransaction(() => {
    if (patch.name !== undefined && !role.isSystem) role.name = patch.name.trim();
    if (patch.description !== undefined) role.description = patch.description;
    if (permissions) role.permissions = permissions;
    role.updatedAt = new Date().toISOString();
    role.updatedBy = actor.userId;
  });
  invalidatePermissionCache();
  auditService.record({ actor: actor.userId, actorRole: actor.role, action: 'ROLE_UPDATED', entityType: 'Role', entityId: id, before, after: roleView(role), reason, correlationId });
  return roleView(role);
}

export function deleteRole(id: string, actor: Actor, reason: string | undefined, correlationId?: string) {
  const role = getRole(id);
  if (!role) throw httpError(404, 'Role not found.');
  if (role.isSystem) throw httpError(400, 'System roles cannot be deleted.');
  const view = roleView(role);
  if (view.userCount > 0) throw httpError(409, 'Role is still assigned to users.');
  db.runInTransaction(() => {
    const idx = db.roles.findIndex(r => r.id === id);
    if (idx >= 0) db.roles.splice(idx, 1);
  });
  invalidatePermissionCache();
  auditService.record({ actor: actor.userId, actorRole: actor.role, action: 'ROLE_DELETED', entityType: 'Role', entityId: id, before: view, reason, correlationId });
}

export const userAdminService = {
  toPublicUser, devicesFor, listUserRows, getUser, userDetail, grantsAdmin, inviteUser, applyUserUpdate, revokeSessions,
  roleView, createRole, updateRole, deleteRole,
};
