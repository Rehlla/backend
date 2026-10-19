import { db } from '../db/database';
import type { AuditEventEntity } from '../db/schema';

/**
 * Structured audit writer for the staff control plane.
 *
 * Every row still goes through db.logAudit, so it carries the same sha256
 * signature as every other audit event (actor:action:entityId:timestamp) and
 * lands at the head of db.auditEvents. The structured fields the ops contract
 * exposes (before/after/reason/device/correlationId) travel in `payload`, so
 * no audit table migration is needed.
 */
export interface AuditRecordInput {
  actor: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  device?: string;
  correlationId?: string;
  /** Extra detail kept beside the structured fields. */
  extra?: Record<string, unknown>;
}

/** The contract shape of an audit event (docs/OPS_API_CONTRACT.md). */
export interface AuditEventView {
  id: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  device?: string;
  correlationId?: string;
  timestamp: string;
}

export function record(input: AuditRecordInput): AuditEventEntity {
  const payload: Record<string, unknown> = { ...(input.extra || {}) };
  if (input.before !== undefined) payload.before = input.before;
  if (input.after !== undefined) payload.after = input.after;
  if (input.reason !== undefined) payload.reason = input.reason;
  if (input.device !== undefined) payload.device = input.device;
  if (input.correlationId !== undefined) payload.correlationId = input.correlationId;
  return db.logAudit(input.actor, input.actorRole, input.action, input.entityType, input.entityId, payload);
}

/** Projects a stored row onto the contract shape. Legacy rows keep their payload in `after`. */
export function toView(e: AuditEventEntity): AuditEventView {
  const payload = (e.payload || {}) as Record<string, unknown>;
  const structured = 'before' in payload || 'after' in payload || 'reason' in payload;
  const view: AuditEventView = {
    id: e.id,
    actor: e.actor,
    actorRole: e.actorRole,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    timestamp: e.timestamp,
  };
  if (structured) {
    if (payload.before !== undefined) view.before = payload.before;
    if (payload.after !== undefined) view.after = payload.after;
    if (typeof payload.reason === 'string') view.reason = payload.reason;
  } else if (Object.keys(payload).length > 0) {
    view.after = payload;
  }
  if (typeof payload.device === 'string') view.device = payload.device;
  if (typeof payload.correlationId === 'string') view.correlationId = payload.correlationId;
  return view;
}

export const auditService = { record, toView };
