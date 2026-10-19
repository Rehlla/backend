import { Router } from 'express';
import { db } from '../db/database';
import { requirePermission } from '../middleware/rbacMiddleware';
import { AuthenticatedRequest } from '../middleware/correlationMiddleware';
import { liveSession, type ViewAsRequest } from '../middleware/viewAs';
import { settingsService } from '../services/settingsService';
import { flagService } from '../services/flagService';
import { integrationHealthService } from '../services/integrationHealthService';
import { approvalService } from '../services/approvalService';
import { auditService } from '../services/auditService';
import { hasPermission } from '../services/permissionService';
import { applyList, listFromQuery, parseListParams } from '../lib/listQuery';
import { sendProblem } from '../lib/problem';
import { adminHandle as handle } from './adminAccessRoutes';
import {
  parseBody,
  PutSettingBody,
  RollbackBody,
  PutFlagBody,
  PatchIntegrationBody,
  DecideBody,
  ViewAsBody,
} from '../contracts/opsContract';
import type { AuditEventEntity } from '../db/schema';

/**
 * /api/admin — platform control (docs/OPS_API_CONTRACT.md, "Admin: control"):
 * settings (+ history, rollback), flags and kill switches, integrations,
 * approvals, the audit log (+ CSV export) and read-only view-as. Every write
 * is audited with the caller's reason.
 *
 * Mounted at /api/admin BEFORE adminSiteRouter (see adminAccessRoutes.ts).
 */
export const adminControlRouter = Router();

const actorOf = (req: AuthenticatedRequest) => ({ userId: req.user!.userId, role: req.user!.role });

// ─── Settings ───────────────────────────────────────────────────────────────

adminControlRouter.get('/settings', requirePermission('admin.settings.view'), (_req, res) => {
  res.json({ items: settingsService.list() });
});

/** Settings whose change needs a second admin. */
const APPROVAL_SETTINGS = new Set(['commerce.commissionRate']);

adminControlRouter.put('/settings/:key', requirePermission('admin.settings.manage'), handle((req, res) => {
  const { value, reason } = parseBody(PutSettingBody, req.body);
  const key = req.params.key;
  settingsService.validateValue(key, value);
  if (APPROVAL_SETTINGS.has(key)) {
    const approval = approvalService.request('setting.update', `Change ${key} to ${JSON.stringify(value)}`, { key, value, reason }, actorOf(req), req.correlationId);
    return sendProblem(req, res, 403, 'approval-required', 'Approval Required',
      `Changing ${key} needs a second admin. The request was queued.`, { approvalId: approval.id });
  }
  res.json(settingsService.set(key, value, actorOf(req), reason, req.correlationId));
}));

adminControlRouter.get('/settings/:key/history', requirePermission('admin.settings.view'), handle((req, res) => {
  if (!settingsService.settingDef(req.params.key)) throw Object.assign(new Error('Unknown setting.'), { status: 404 });
  const rows = settingsService.history(req.params.key).map(h => ({ version: h.version, value: h.value, updatedBy: h.updatedBy, updatedAt: h.updatedAt, reason: h.reason }));
  res.json(listFromQuery(rows, req.query as Record<string, unknown>, { sortable: ['version', 'updatedAt'] }));
}));

adminControlRouter.post('/settings/:key/rollback', requirePermission('admin.settings.manage'), handle((req, res) => {
  const { version, reason } = parseBody(RollbackBody, req.body);
  const key = req.params.key;
  if (APPROVAL_SETTINGS.has(key)) {
    const target = settingsService.history(key).find(h => h.version === version);
    if (!target) throw Object.assign(new Error(`Version ${version} of ${key} not found.`), { status: 404 });
    const approval = approvalService.request('setting.update', `Roll ${key} back to v${version}`, { key, value: target.value, reason: `Rollback to v${version}: ${reason}` }, actorOf(req), req.correlationId);
    return sendProblem(req, res, 403, 'approval-required', 'Approval Required',
      `Changing ${key} needs a second admin. The request was queued.`, { approvalId: approval.id });
  }
  res.json(settingsService.rollback(key, version, actorOf(req), reason, req.correlationId));
}));

// ─── Flags ──────────────────────────────────────────────────────────────────

adminControlRouter.get('/flags', requirePermission('ops.flags.view'), (_req, res) => {
  res.json({ items: flagService.list() });
});

adminControlRouter.put('/flags/:key', requirePermission('admin.flags.manage'), handle((req, res) => {
  const { reason, ...patch } = parseBody(PutFlagBody, req.body);
  res.json(flagService.update(req.params.key, patch, actorOf(req), reason, req.correlationId));
}));

// ─── Integrations ───────────────────────────────────────────────────────────

adminControlRouter.get('/integrations', requirePermission('admin.integrations.view'), handle(async (_req, res) => {
  res.json({ items: await integrationHealthService.list() });
}));

adminControlRouter.post('/integrations/:id/check', requirePermission('admin.integrations.view'), handle(async (req, res) => {
  res.json(await integrationHealthService.check(req.params.id));
}));

adminControlRouter.patch('/integrations/:id', requirePermission('admin.integrations.manage'), handle(async (req, res) => {
  const { reason, ...patch } = parseBody(PatchIntegrationBody, req.body);
  integrationHealthService.update(req.params.id, patch, actorOf(req), reason, req.correlationId);
  res.json(await integrationHealthService.check(req.params.id));
}));

// ─── Approvals ──────────────────────────────────────────────────────────────

adminControlRouter.get('/approvals', requirePermission('admin.approvals.decide'), (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  res.json(applyList(approvalService.list(status), parseListParams(req.query as Record<string, unknown>, ['requestedAt', 'action', 'status']), {
    searchFields: ['summary', 'action', 'requestedBy'],
  }));
});

adminControlRouter.post('/approvals/:id/decide', requirePermission('admin.approvals.decide'), handle((req, res) => {
  const { decision, note } = parseBody(DecideBody, req.body);
  res.json(approvalService.decide(req.params.id, decision, actorOf(req), note, req.correlationId));
}));

// ─── Audit ──────────────────────────────────────────────────────────────────

function filteredAudit(q: Record<string, unknown>): AuditEventEntity[] {
  const eq = (field: keyof AuditEventEntity) => (typeof q[field] === 'string' && q[field] ? String(q[field]) : undefined);
  const actor = eq('actor');
  const action = eq('action');
  const entityType = eq('entityType');
  const entityId = eq('entityId');
  const from = typeof q.from === 'string' ? Date.parse(q.from) : NaN;
  const to = typeof q.to === 'string' ? Date.parse(q.to) : NaN;
  return db.auditEvents.filter(e => {
    if (actor && e.actor !== actor) return false;
    if (action && e.action !== action) return false;
    if (entityType && e.entityType !== entityType) return false;
    if (entityId && e.entityId !== entityId) return false;
    const t = Date.parse(e.timestamp);
    if (Number.isFinite(from) && t < from) return false;
    if (Number.isFinite(to) && t > to) return false;
    return true;
  });
}

adminControlRouter.get('/audit', requirePermission('ops.audit.view'), (req, res) => {
  const result = listFromQuery(filteredAudit(req.query as Record<string, unknown>), req.query as Record<string, unknown>, {
    sortable: ['timestamp', 'actor', 'action', 'entityType'],
    searchFields: ['action', 'actor', 'entityType', 'entityId'],
  });
  res.json({ ...result, items: result.items.map(auditService.toView) });
});

const CSV_COLUMNS = ['id', 'timestamp', 'actor', 'actorRole', 'action', 'entityType', 'entityId', 'reason', 'correlationId', 'before', 'after'] as const;

function csvCell(v: unknown): string {
  if (v === undefined || v === null) return '';
  let s = typeof v === 'string' ? v : JSON.stringify(v);
  // Spreadsheet formula injection: a cell starting with = + - @ is executed by Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

adminControlRouter.get('/audit/export', requirePermission('admin.audit.export'), (req: AuthenticatedRequest, res) => {
  const rows = filteredAudit(req.query as Record<string, unknown>).slice(0, 50_000).map(auditService.toView);
  const lines = [CSV_COLUMNS.join(','), ...rows.map(r => CSV_COLUMNS.map(c => csvCell((r as any)[c])).join(','))];
  auditService.record({
    actor: req.user!.userId, actorRole: req.user!.role, action: 'AUDIT_EXPORTED', entityType: 'Audit', entityId: 'export',
    after: { rows: rows.length, filters: req.query }, correlationId: req.correlationId,
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="dahab-audit-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(lines.join('\n') + '\n');
});

// ─── View-as ────────────────────────────────────────────────────────────────

adminControlRouter.post('/view-as', requirePermission('admin.viewas'), handle((req, res) => {
  const { userId, reason } = parseBody(ViewAsBody, req.body);
  const session = liveSession(req);
  if (!session) throw Object.assign(new Error('View-as needs a server session.'), { status: 400 });
  if (userId === req.user!.userId) throw Object.assign(new Error('You cannot view as yourself.'), { status: 400 });
  const target = db.users.find(u => u.id === userId);
  if (!target) throw Object.assign(new Error('User not found.'), { status: 404 });
  if (target.role === 'Admin') throw Object.assign(new Error('Viewing as another Admin is not allowed.'), { status: 403 });
  const startedAt = new Date().toISOString();
  db.runInTransaction(() => {
    session.viewAs = { userId, startedAt, reason };
  });
  auditService.record({
    actor: req.user!.userId, actorRole: req.user!.role, action: 'VIEW_AS_STARTED', entityType: 'User', entityId: userId,
    after: { sessionId: session.id }, reason, correlationId: req.correlationId,
  });
  res.json({ viewAs: { userId, email: target.email, startedAt } });
}));

/**
 * Ends the view-as. The viewAs middleware lets this one non-GET through and
 * leaves req.user as the real admin.
 */
adminControlRouter.delete('/view-as', handle((req: ViewAsRequest, res) => {
  const session = liveSession(req);
  if (!session?.viewAs) return res.json({ success: false });
  if (!req.user || !hasPermission({ userId: req.user.userId, role: req.user.role }, 'admin.viewas')) {
    // Even without the permission any more, the holder of the session may end it.
    if (!req.user || session.userId !== req.user.userId) throw Object.assign(new Error('Forbidden.'), { status: 403 });
  }
  const ended = session.viewAs;
  db.runInTransaction(() => {
    delete session.viewAs;
  });
  auditService.record({
    actor: req.user!.userId, actorRole: req.user!.role, action: 'VIEW_AS_ENDED', entityType: 'User', entityId: ended.userId,
    after: { sessionId: session.id, startedAt: ended.startedAt }, correlationId: req.correlationId,
  });
  res.json({ success: true });
}));
