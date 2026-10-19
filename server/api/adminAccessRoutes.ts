import { Router, Response, NextFunction } from 'express';
import { requirePermission } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { PERMISSION_CATALOG } from '../auth/permissionCatalog';
import { listRoles, resolve as resolvePermissions, setOverrides, overridesFor } from '../services/permissionService';
import { userAdminService } from '../services/userAdminService';
import { approvalService } from '../services/approvalService';
import { listFromQuery } from '../lib/listQuery';
import { sendProblem } from '../lib/problem';
import {
  parseBody,
  InviteUserBody,
  PatchUserBody,
  PutOverridesBody,
  ReasonBody,
  CreateRoleBody,
  PatchRoleBody,
} from '../contracts/opsContract';

/**
 * /api/admin — staff access administration (docs/OPS_API_CONTRACT.md,
 * "Admin: access"). Users, roles, per-user overrides, session revocation and
 * the permission catalogue. Every write is audited with the caller's reason;
 * identity always comes from the session.
 *
 * Mounted at /api/admin BEFORE adminSiteRouter, whose router-level
 * requireRole('Operations','Admin') would otherwise swallow these paths.
 */
export const adminAccessRouter = Router();

const actorOf = (req: AuthenticatedRequest) => ({ userId: req.user!.userId, role: req.user!.role });

/** Wraps a handler so thrown { status } errors become RFC7807 problems. */
const handle = (fn: (req: AuthenticatedRequest, res: Response) => unknown) =>
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (err: any) {
      if (res.headersSent) return next(err);
      const status = typeof err?.status === 'number' ? err.status : 500;
      if (status >= 500) return next(err);
      const slug = status === 404 ? 'not-found' : status === 403 ? 'forbidden' : status === 409 ? 'conflict' : 'bad-request';
      sendProblem(req, res, status, slug, status === 404 ? 'Not Found' : status === 403 ? 'Forbidden' : status === 409 ? 'Conflict' : 'Bad Request', err.message);
    }
  };

export { handle as adminHandle };

// ─── Users ──────────────────────────────────────────────────────────────────

adminAccessRouter.get('/users', requirePermission('admin.users.view'), handle((req, res) => {
  const q = req.query as Record<string, unknown>;
  const rows = userAdminService.listUserRows({
    role: typeof q.role === 'string' ? q.role : undefined,
    status: typeof q.status === 'string' ? q.status : undefined,
  });
  res.json(listFromQuery(rows, q, { sortable: ['createdAt', 'email', 'name', 'role', 'lastSeenAt'], searchFields: ['email', 'name', 'phone', 'id'] }));
}));

adminAccessRouter.get('/users/:id', requirePermission('admin.users.view'), handle((req, res) => {
  res.json(userAdminService.userDetail(req.params.id));
}));

adminAccessRouter.post('/users', requirePermission('admin.users.manage'), handle((req, res) => {
  const body = parseBody(InviteUserBody, req.body);
  res.status(201).json(userAdminService.inviteUser(body, actorOf(req), req.correlationId));
}));

adminAccessRouter.patch('/users/:id', requirePermission('admin.users.manage'), handle((req, res) => {
  const { reason, ...patch } = parseBody(PatchUserBody, req.body);
  const target = userAdminService.getUser(req.params.id);
  // A delegated user manager must not be able to demote or suspend an Admin.
  if (target.role === 'Admin' && req.user!.role !== 'Admin') {
    throw Object.assign(new Error('Only an Admin can change an Admin account.'), { status: 403 });
  }
  if (userAdminService.grantsAdmin(req.params.id, patch)) {
    const approval = approvalService.request(
      'user.update',
      `Grant Admin to ${req.params.id}`,
      { userId: req.params.id, patch, reason },
      actorOf(req),
      req.correlationId
    );
    return sendProblem(req, res, 403, 'approval-required', 'Approval Required',
      'Granting Admin needs a second admin. The request was queued.', { approvalId: approval.id });
  }
  const user = userAdminService.applyUserUpdate(req.params.id, patch, actorOf(req), reason, req.correlationId);
  res.json({ user });
}));

adminAccessRouter.put('/users/:id/overrides', requirePermission('admin.users.manage'), handle((req, res) => {
  const body = parseBody(PutOverridesBody, req.body);
  const user = userAdminService.getUser(req.params.id);
  if (user.id === req.user!.userId) {
    throw Object.assign(new Error('You cannot change your own permission overrides.'), { status: 403 });
  }
  if (body.overrides.some(o => o.effect === 'grant' && o.permission === '*')) {
    throw Object.assign(new Error('Admin (*) is granted through the Admin role, which needs an approval.'), { status: 400 });
  }
  setOverrides(user.id, body.overrides, actorOf(req), body.reason, req.correlationId);
  res.json({
    overrides: overridesFor(user.id).map(o => ({ permission: o.permission, effect: o.effect, createdBy: o.createdBy, createdAt: o.createdAt })),
    effectivePermissions: resolvePermissions({ userId: user.id, role: user.role }),
  });
}));

adminAccessRouter.post('/users/:id/revoke-sessions', requirePermission('admin.users.manage'), handle((req, res) => {
  const { reason } = parseBody(ReasonBody, req.body);
  res.json({ revokedCount: userAdminService.revokeSessions(req.params.id, actorOf(req), reason, req.correlationId) });
}));

// ─── Permissions & roles ────────────────────────────────────────────────────

adminAccessRouter.get('/permissions', requirePermission('admin.users.view'), (_req, res) => {
  res.json({ items: PERMISSION_CATALOG.map(p => ({ ...p })) });
});

adminAccessRouter.get('/roles', requirePermission('admin.users.view'), (_req, res) => {
  res.json({ items: listRoles().map(userAdminService.roleView) });
});

adminAccessRouter.post('/roles', requirePermission('admin.roles.manage'), handle((req, res) => {
  const body = parseBody(CreateRoleBody, req.body);
  res.status(201).json(userAdminService.createRole(body, actorOf(req), req.correlationId));
}));

adminAccessRouter.patch('/roles/:id', requirePermission('admin.roles.manage'), handle((req, res) => {
  const { reason, ...patch } = parseBody(PatchRoleBody, req.body);
  res.json(userAdminService.updateRole(req.params.id, patch, actorOf(req), reason, req.correlationId));
}));

adminAccessRouter.delete('/roles/:id', requirePermission('admin.roles.manage'), handle((req, res) => {
  const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;
  userAdminService.deleteRole(req.params.id, actorOf(req), reason, req.correlationId);
  res.json({ success: true });
}));
