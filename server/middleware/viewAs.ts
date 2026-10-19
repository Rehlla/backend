import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './correlationMiddleware';
import { authService } from '../services/authService';
import { hasPermission } from '../services/permissionService';
import { findOneBy } from '../db/sqlite/query';
import { db } from '../db/database';
import type { SessionEntity } from '../db/schema';
import { sendProblem } from '../lib/problem';

/**
 * Read-only view-as (POST /api/admin/view-as, docs/OPS_API_CONTRACT.md).
 *
 * Mount right after optionalAuth. While the caller's session carries a
 * viewAs, GET requests run as the target user (so every permission and
 * ownership filter applies exactly as it would for them), and every non-GET
 * answers 403 `.../view-as-readonly` — except ending the view-as and
 * signing out, which run as the real admin.
 *
 * The admin's `admin.viewas` is re-checked on every request: revoking it
 * ends every view-as that admin has open.
 */

export interface ViewAsRequest extends AuthenticatedRequest {
  /** The real signed-in admin while a view-as is active. */
  viewAsBy?: AuthenticatedRequest['user'];
}

const EXEMPT: { method: string; path: string }[] = [
  { method: 'DELETE', path: '/api/admin/view-as' },
  { method: 'POST', path: '/api/auth/logout' },
];

/**
 * The caller's session row, READ-ONLY. On the SQLite adapter findOneBy
 * returns a hydrated copy (server/db/sqlite/query.ts), so mutating the result
 * silently persists nothing — use liveSession() for read-modify-write.
 */
export function currentSession(req: AuthenticatedRequest): SessionEntity | null {
  const token = authService.extractTokenFromRequest(req.headers.authorization, req.headers.cookie);
  if (!token) return null;
  return findOneBy<SessionEntity>('sessions', 'token', token);
}

/** The caller's session as the live db.sessions element, safe to mutate inside db.runInTransaction. */
export function liveSession(req: AuthenticatedRequest): SessionEntity | null {
  const token = authService.extractTokenFromRequest(req.headers.authorization, req.headers.cookie);
  if (!token) return null;
  return db.sessions.find(s => s.token === token) || null;
}

export function viewAsMiddleware(req: ViewAsRequest, res: Response, next: NextFunction) {
  if (!req.user) return next();
  const session = currentSession(req);
  if (!session?.viewAs) return next();
  if (!hasPermission({ userId: req.user.userId, role: req.user.role }, 'admin.viewas')) return next();
  const target = db.users.find(u => u.id === session.viewAs!.userId);
  if (!target) return next();

  const method = req.method.toUpperCase();
  const path = req.path.replace(/\/+$/, '');
  if (EXEMPT.some(e => e.method === method && e.path === path)) return next();
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    return sendProblem(req, res, 403, 'view-as-readonly', 'View-As Is Read-Only',
      `You are viewing as ${target.email}. End the view-as (DELETE /api/admin/view-as) to make changes.`);
  }
  req.viewAsBy = req.user;
  req.user = {
    userId: target.id,
    email: target.email,
    name: target.name,
    role: target.role,
    supplierId: target.supplierId,
  };
  next();
}
