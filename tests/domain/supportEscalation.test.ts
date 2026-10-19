import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import {
  escalateMessage, assignMessage, resolveMessage, closeMessage,
  getEscalationQueue, getMessagesForOperator, getOpenCount, autoEscalateOpenMessages,
  assessPriority,
} from '../../server/services/supportEscalationService';
import type { SupportMessageEntity } from '../../server/db/schema';

const now = '2026-01-01T00:00:00.000Z';

function makeSupportMessage(overrides: Partial<SupportMessageEntity> = {}): SupportMessageEntity {
  return {
    id: 'SUP-MSG-1',
    userId: 'USR-1',
    travelerName: 'Test Traveler',
    message: 'My driver is late',
    urgent: false,
    status: 'OPEN',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('supportEscalationService', () => {
  beforeEach(() => {
    const adapter = new InMemoryPersistenceAdapter();
    db.setAdapter(adapter);
  });

  describe('assessPriority', () => {
    it('returns urgent when urgent flag is set', () => {
      const msg = makeSupportMessage({ urgent: true });
      expect(assessPriority(msg)).toBe('urgent');
    });

    it('returns high for messages with escalation keywords', () => {
      const msg = makeSupportMessage({ message: 'My driver is late and I need a refund' });
      expect(assessPriority(msg)).toBe('high');
    });

    it('returns normal for messages with booking ref but no keywords', () => {
      const msg = makeSupportMessage({ message: 'Where is my booking?', bookingRef: 'BK-123' });
      expect(assessPriority(msg)).toBe('normal');
    });

    it('returns normal for default messages', () => {
      const msg = makeSupportMessage({ message: 'Hello, I have a question' });
      expect(assessPriority(msg)).toBe('normal');
    });
  });

  describe('escalateMessage', () => {
    it('escalates an OPEN message to ESCALATED', () => {
      db.supportMessages.push(makeSupportMessage());
      const result = escalateMessage('SUP-MSG-1', 'OPS-1');
      expect(result.status).toBe('ESCALATED');
      expect(result.priority).toBeDefined();
      expect(result.escalatedAt).toBeDefined();
    });

    it('throws for non-existent message', () => {
      expect(() => escalateMessage('SUP-MSG-999', 'OPS-1')).toThrow('not found');
    });

    it('throws for non-OPEN message', () => {
      db.supportMessages.push(makeSupportMessage({ status: 'ANSWERED' }));
      expect(() => escalateMessage('SUP-MSG-1', 'OPS-1')).toThrow('Only OPEN');
    });
  });

  describe('assignMessage', () => {
    it('assigns an escalated message to an operator', () => {
      db.supportMessages.push(makeSupportMessage({ status: 'ESCALATED' }));
      const result = assignMessage('SUP-MSG-1', 'OPS-1');
      expect(result.status).toBe('IN_PROGRESS');
      expect(result.assignedTo).toBe('OPS-1');
    });

    it('throws for non-assignable status', () => {
      db.supportMessages.push(makeSupportMessage({ status: 'CLOSED' }));
      expect(() => assignMessage('SUP-MSG-1', 'OPS-1')).toThrow('cannot be assigned');
    });
  });

  describe('resolveMessage', () => {
    it('resolves an in-progress message with a reply', () => {
      db.supportMessages.push(makeSupportMessage({ status: 'IN_PROGRESS' }));
      const result = resolveMessage('SUP-MSG-1', 'OPS-1', 'We are looking into it.');
      expect(result.status).toBe('ANSWERED');
      expect(result.reply).toBe('We are looking into it.');
      expect(result.repliedBy).toBe('OPS-1');
    });

    it('throws for already-answered message', () => {
      db.supportMessages.push(makeSupportMessage({ status: 'ANSWERED' }));
      expect(() => resolveMessage('SUP-MSG-1', 'OPS-1', 'reply')).toThrow('Cannot reply');
    });
  });

  describe('closeMessage', () => {
    it('closes an open message', () => {
      db.supportMessages.push(makeSupportMessage({ status: 'OPEN' }));
      const result = closeMessage('SUP-MSG-1', 'USR-1');
      expect(result.status).toBe('CLOSED');
    });

    it('is idempotent for already-closed messages', () => {
      db.supportMessages.push(makeSupportMessage({ status: 'CLOSED' }));
      const result = closeMessage('SUP-MSG-1', 'USR-1');
      expect(result.status).toBe('CLOSED');
    });
  });

  describe('getEscalationQueue', () => {
    it('returns ESCALATED and IN_PROGRESS messages sorted by priority', () => {
      db.supportMessages.push(makeSupportMessage({ id: 'M1', status: 'ESCALATED', priority: 'normal' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M2', status: 'ESCALATED', priority: 'urgent' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M3', status: 'IN_PROGRESS', priority: 'high' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M4', status: 'OPEN', priority: 'normal' }));
      const queue = getEscalationQueue();
      expect(queue).toHaveLength(3);
      expect(queue[0].priority).toBe('urgent');
      expect(queue[1].priority).toBe('high');
    });
  });

  describe('getOpenCount', () => {
    it('counts messages by status', () => {
      db.supportMessages.push(makeSupportMessage({ id: 'M1', status: 'OPEN' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M2', status: 'OPEN' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M3', status: 'ESCALATED' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M4', status: 'IN_PROGRESS' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M5', status: 'ANSWERED' }));
      const counts = getOpenCount();
      expect(counts.open).toBe(2);
      expect(counts.escalated).toBe(1);
      expect(counts.inProgress).toBe(1);
      expect(counts.answered).toBe(1);
    });
  });

  describe('autoEscalateOpenMessages', () => {
    it('escalates all OPEN messages', () => {
      db.supportMessages.push(makeSupportMessage({ id: 'M1', status: 'OPEN' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M2', status: 'OPEN' }));
      db.supportMessages.push(makeSupportMessage({ id: 'M3', status: 'CLOSED' }));
      const count = autoEscalateOpenMessages();
      expect(count).toBe(2);
      expect(db.supportMessages.filter(m => m.status === 'ESCALATED')).toHaveLength(2);
    });

    it('returns 0 when no OPEN messages', () => {
      expect(autoEscalateOpenMessages()).toBe(0);
    });
  });
});
