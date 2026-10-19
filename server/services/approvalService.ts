import crypto from 'crypto';
import { db } from '../db/database';
import type { ApprovalEntity } from '../db/schema';
import { auditService } from './auditService';
import { settingsService } from './settingsService';
import { paymentService } from './paymentService';
import { userAdminService } from './userAdminService';
import { publishStaffEvent } from './staffEventStream';

/**
 * Two-person rule for dangerous actions (docs/OPS_API_CONTRACT.md).
 *
 * The route that would perform the action calls request() instead and answers
 * 403 `.../approval-required` with { approvalId }. A second holder of
 * `admin.approvals.decide` decides; the requester never can. Approving runs
 * the queued action through the executor registered for it, with the
 * ORIGINAL requester recorded as the initiator and the decider as approver.
 */

/** `catalog.<type>.publish` / `catalog.<type>.price` come from the catalogue surface (registerApprovalExecutor). */
export type ApprovalAction = 'refund' | 'setting.update' | 'user.update' | `catalog.${string}`;

export interface Actor {
  userId: string;
  role: string;
}

type Executor = (payload: Record<string, any>, ctx: { requestedBy: string; decidedBy: Actor; approvalId: string }) => unknown;

const EXECUTORS: Record<string, Executor> = {
  refund: (p, ctx) => {
    const result = paymentService.processRefund({
      bookingId: p.bookingId,
      tripId: p.tripId,
      amountEGP: Number(p.amountEGP),
      reason: `${p.reason} (approved ${ctx.approvalId} by ${ctx.decidedBy.userId})`,
      idempotencyKey: p.idempotencyKey,
      initiatedBy: ctx.requestedBy,
    });
    publishStaffEvent('RefundIssued', {
      entityType: 'Refund', entityId: result.refundId, summary: `Refund ${result.amountEGP} EGP issued (approval ${ctx.approvalId})`,
      ...(typeof p.supplierId === 'string' ? { supplierId: p.supplierId } : {}),
    }, ctx.decidedBy.userId);
    return result;
  },
  'setting.update': (p, ctx) =>
    settingsService.set(p.key, p.value, ctx.decidedBy, `${p.reason} (approval ${ctx.approvalId}, requested by ${ctx.requestedBy})`),
  'user.update': (p, ctx) =>
    userAdminService.applyUserUpdate(p.userId, p.patch, ctx.decidedBy, `${p.reason} (approval ${ctx.approvalId}, requested by ${ctx.requestedBy})`),
};

/**
 * Registers the executor for an action owned by another module (the
 * catalogue registers catalog.<type>.publish|price), so this file does not
 * import every feature that can ask for a second pair of eyes.
 */
export function registerApprovalExecutor(action: ApprovalAction, executor: Executor): void {
  EXECUTORS[action] = executor;
}

const forbidden = (message: string) => Object.assign(new Error(message), { status: 403 });

export function request(
  action: ApprovalAction,
  summary: string,
  payload: Record<string, unknown>,
  requester: Actor,
  correlationId?: string
): ApprovalEntity {
  const approval: ApprovalEntity = {
    id: `APR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    action,
    summary,
    payload,
    requestedBy: requester.userId,
    requestedAt: new Date().toISOString(),
    status: 'pending',
  };
  db.runInTransaction(() => {
    db.approvals.push(approval);
  });
  auditService.record({
    actor: requester.userId, actorRole: requester.role, action: 'APPROVAL_REQUESTED', entityType: 'Approval',
    entityId: approval.id, after: { action, summary, payload }, reason: typeof payload.reason === 'string' ? payload.reason : undefined, correlationId,
  });
  publishStaffEvent('ApprovalRequested', { entityType: 'Approval', entityId: approval.id, summary }, requester.userId, correlationId);
  return approval;
}

export function list(status?: string): ApprovalEntity[] {
  const rows = status ? db.approvals.filter(a => a.status === status) : db.approvals;
  return [...rows].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export function get(id: string): ApprovalEntity | undefined {
  return db.approvals.find(a => a.id === id);
}

export function decide(
  id: string,
  decision: 'approve' | 'reject',
  decider: Actor,
  note?: string,
  correlationId?: string
): ApprovalEntity {
  const approval = get(id);
  if (!approval) throw Object.assign(new Error('Approval not found.'), { status: 404 });
  if (approval.status !== 'pending') throw Object.assign(new Error(`Approval is already ${approval.status}.`), { status: 409 });
  if (approval.requestedBy === decider.userId) throw forbidden('You cannot decide your own approval request.');

  const now = new Date().toISOString();
  if (decision === 'reject') {
    approval.status = 'rejected';
  } else {
    try {
      const executor = EXECUTORS[approval.action];
      if (!executor) throw new Error(`No executor is registered for ${approval.action}.`);
      approval.result = executor(approval.payload as Record<string, any>, {
        requestedBy: approval.requestedBy, decidedBy: decider, approvalId: approval.id,
      });
      approval.status = 'approved';
    } catch (err: any) {
      approval.status = 'failed';
      approval.result = { error: err?.message || String(err) };
    }
  }
  approval.decidedBy = decider.userId;
  approval.decidedAt = now;
  if (note) approval.decisionNote = note;
  db.saveToDisk();
  auditService.record({
    actor: decider.userId, actorRole: decider.role, action: `APPROVAL_${approval.status.toUpperCase()}`, entityType: 'Approval',
    entityId: approval.id, before: { status: 'pending' }, after: { status: approval.status, result: approval.result }, reason: note, correlationId,
  });
  publishStaffEvent('ApprovalDecided', { entityType: 'Approval', entityId: approval.id, summary: `${approval.summary}: ${approval.status}` }, decider.userId, correlationId);
  return approval;
}

export const approvalService = { request, list, get, decide };
