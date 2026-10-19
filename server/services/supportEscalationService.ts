import { db } from '../db/database';
import { SupportMessageEntity } from '../db/schema';

/**
 * Human-Agent Escalation Service
 *
 * Manages the lifecycle of support messages from OPEN → ESCALATED → IN_PROGRESS → ANSWERED → CLOSED.
 * Provides auto-assignment, priority queue, and escalation logic.
 *
 * Status flow:
 *   OPEN (traveler sends) → ESCALATED (auto or manual) → IN_PROGRESS (agent picks up)
 *   → ANSWERED (agent replies) → CLOSED (traveler or ops closes)
 *
 * Priority rules:
 *   - urgent=true → 'urgent' priority, auto-escalate immediately
 *   - Contains keywords ('late', 'cancel', 'refund', 'emergency') → 'high'
 *   - Has a bookingRef → 'normal' (likely actionable)
 *   - Default → 'normal'
 */

export type EscalationPriority = 'low' | 'normal' | 'high' | 'urgent';

const ESCALATION_KEYWORDS = ['late', 'cancel', 'refund', 'emergency', 'stuck', 'lost', 'broken', 'complaint', 'manager'];

/**
 * Determine the priority of a support message based on its content.
 */
export function assessPriority(message: SupportMessageEntity): EscalationPriority {
  if (message.urgent) return 'urgent';

  const lowerMsg = message.message.toLowerCase();
  if (ESCALATION_KEYWORDS.some(kw => lowerMsg.includes(kw))) return 'high';
  if (message.bookingRef) return 'normal';
  return 'normal';
}

/**
 * Escalate an OPEN support message to the agent queue.
 * Sets status=ESCALATED, priority, and escalatedAt.
 */
export function escalateMessage(
  messageId: string,
  operatorUserId: string
): SupportMessageEntity {
  const message = db.supportMessages.find(m => m.id === messageId);
  if (!message) throw new Error(`Support message ${messageId} not found.`);
  if (message.status !== 'OPEN') {
    throw new Error(`Only OPEN messages can be escalated. Current status: ${message.status}`);
  }

  const priority = assessPriority(message);
  const now = new Date().toISOString();

  message.status = 'ESCALATED';
  message.priority = priority;
  message.escalatedAt = now;
  message.updatedAt = now;

  db.saveToDisk();
  return message;
}

/**
 * Auto-assign an escalated message to an available operator.
 * In a real system this would query a presence/availability API; here we
 * simply assign to the operator who triggered the assignment.
 */
export function assignMessage(
  messageId: string,
  operatorUserId: string
): SupportMessageEntity {
  const message = db.supportMessages.find(m => m.id === messageId);
  if (!message) throw new Error(`Support message ${messageId} not found.`);
  if (message.status !== 'ESCALATED' && message.status !== 'OPEN') {
    throw new Error(`Message cannot be assigned in status ${message.status}.`);
  }

  const now = new Date().toISOString();
  message.status = 'IN_PROGRESS';
  message.assignedTo = operatorUserId;
  message.updatedAt = now;

  db.saveToDisk();
  return message;
}

/**
 * Resolve an assigned message — operator replies, setting status to ANSWERED.
 */
export function resolveMessage(
  messageId: string,
  operatorUserId: string,
  replyText: string
): SupportMessageEntity {
  const message = db.supportMessages.find(m => m.id === messageId);
  if (!message) throw new Error(`Support message ${messageId} not found.`);
  if (!['IN_PROGRESS', 'ESCALATED', 'OPEN'].includes(message.status)) {
    throw new Error(`Cannot reply to a message in status ${message.status}.`);
  }

  const now = new Date().toISOString();
  message.status = 'ANSWERED';
  message.reply = replyText;
  message.repliedBy = operatorUserId;
  message.repliedAt = now;
  message.assignedTo = operatorUserId;
  message.updatedAt = now;

  db.saveToDisk();
  return message;
}

/**
 * Close a message (either traveler or operator can close).
 */
export function closeMessage(
  messageId: string,
  closerUserId: string
): SupportMessageEntity {
  const message = db.supportMessages.find(m => m.id === messageId);
  if (!message) throw new Error(`Support message ${messageId} not found.`);
  if (message.status === 'CLOSED') return message;

  const now = new Date().toISOString();
  message.status = 'CLOSED';
  message.updatedAt = now;

  db.saveToDisk();
  return message;
}

/**
 * Get the escalation queue — all ESCALATED or IN_PROGRESS messages, sorted by priority then age.
 */
export function getEscalationQueue(): SupportMessageEntity[] {
  const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

  return db.supportMessages
    .filter(m => m.status === 'ESCALATED' || m.status === 'IN_PROGRESS')
    .sort((a, b) => {
      const pa = priorityOrder[a.priority || 'normal'];
      const pb = priorityOrder[b.priority || 'normal'];
      if (pa !== pb) return pa - pb;
      return Date.parse(a.createdAt) - Date.parse(b.createdAt); // oldest first
    });
}

/**
 * Get all messages assigned to a specific operator.
 */
export function getMessagesForOperator(operatorUserId: string): SupportMessageEntity[] {
  return db.supportMessages
    .filter(m => m.assignedTo === operatorUserId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

/**
 * Get open/unassigned messages count (for operator dashboard).
 */
export function getOpenCount(): { open: number; escalated: number; inProgress: number; answered: number } {
  const msgs = db.supportMessages;
  return {
    open: msgs.filter(m => m.status === 'OPEN').length,
    escalated: msgs.filter(m => m.status === 'ESCALATED').length,
    inProgress: msgs.filter(m => m.status === 'IN_PROGRESS').length,
    answered: msgs.filter(m => m.status === 'ANSWERED').length,
  };
}

/**
 * Bulk auto-escalate all OPEN messages (e.g. run on a schedule or boot).
 */
export function autoEscalateOpenMessages(): number {
  const openMessages = db.supportMessages.filter(m => m.status === 'OPEN');
  let count = 0;
  for (const msg of openMessages) {
    const priority = assessPriority(msg);
    const now = new Date().toISOString();
    msg.status = 'ESCALATED';
    msg.priority = priority;
    msg.escalatedAt = now;
    msg.updatedAt = now;
    count++;
  }
  if (count > 0) db.saveToDisk();
  return count;
}
