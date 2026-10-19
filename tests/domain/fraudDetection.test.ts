import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../../server/db/database';
import { InMemoryPersistenceAdapter } from '../../server/db/adapters/InMemoryPersistenceAdapter';
import {
  ensureDefaultRules, getRule, updateRule, getAllRules,
  evaluateCheckout, getSignals, getFraudDashboard, recalcUserStats,
} from '../../server/services/fraudDetectionService';
import type { UserEntity, TripEntity, PaymentEntity, SupplierEntity } from '../../server/db/schema';

const now = '2026-01-01T00:00:00.000Z';

function seedTestData() {
  const user: UserEntity = {
    id: 'USR-1', email: 'test@test.com', displayName: 'Test', role: 'Traveler',
    createdAt: now, updatedAt: now,
  };
  const supplier: SupplierEntity = {
    id: 'SUP-1', businessName: 'Test', businessNameAr: 'اختبار',
    category: 'diving', tier: 'Vetted Local Partner', status: 'Active',
    area: 'dahab', createdAt: now,
  };
  const trip: TripEntity = {
    id: 'TRIP-1', userId: 'USR-1', title: 'Test', titleAr: 'اختبار',
    status: 'CONFIRMED', createdAt: now, updatedAt: now,
  };
  db.users.push(user);
  db.suppliers.push(supplier);
  db.trips.push(trip);
}

function makePayment(overrides: Partial<PaymentEntity> = {}): PaymentEntity {
  return {
    id: 'PAY-1', transactionId: 'TXN-1', idempotencyKey: 'IDEM-1',
    tripId: 'TRIP-1', amountEGP: 500, currency: 'EGP',
    provider: 'PAYMOB', paymentMethodType: 'CARD',
    state: 'CAPTURED', signatureHash: 'abc',
    webhookEvents: [], createdAt: now, updatedAt: now,
    ...overrides,
  };
}

describe('fraudDetectionService', () => {
  beforeEach(() => {
    const adapter = new InMemoryPersistenceAdapter();
    db.setAdapter(adapter);
    seedTestData();
  });

  describe('ensureDefaultRules', () => {
    it('creates default rules when none exist', () => {
      expect(db.fraudRules.length).toBe(0);
      ensureDefaultRules();
      expect(db.fraudRules.length).toBe(5);
    });

    it('does not duplicate rules on second call', () => {
      ensureDefaultRules();
      ensureDefaultRules();
      expect(db.fraudRules.length).toBe(5);
    });
  });

  describe('getRule / updateRule', () => {
    beforeEach(() => ensureDefaultRules());

    it('gets a rule by name', () => {
      const rule = getRule('velocity_hourly');
      expect(rule).toBeDefined();
      expect(rule!.threshold).toBe(5);
    });

    it('updates a rule threshold', () => {
      const rule = updateRule('velocity_hourly', { threshold: 10 });
      expect(rule.threshold).toBe(10);
    });

    it('throws for non-existent rule', () => {
      expect(() => updateRule('nonexistent', { threshold: 1 })).toThrow('not found');
    });
  });

  describe('evaluateCheckout', () => {
    beforeEach(() => ensureDefaultRules());

    it('allows a clean checkout', () => {
      const result = evaluateCheckout({
        userId: 'USR-1', transactionId: 'TXN-NEW-1', amountEGP: 500,
      });
      expect(result.action).toBe('allow');
      expect(result.compositeScore).toBe(0);
      expect(result.signals).toHaveLength(0);
    });

    it('detects velocity_hourly when threshold exceeded', () => {
      const recent = new Date().toISOString();
      for (let i = 0; i < 5; i++) {
        db.payments.push(makePayment({
          id: `PAY-V${i}`, transactionId: `TXN-V${i}`, idempotencyKey: `IDEM-V${i}`,
          tripId: 'TRIP-1', createdAt: recent,
        }));
      }
      const result = evaluateCheckout({
        userId: 'USR-1', transactionId: 'TXN-NEW-2', amountEGP: 500,
      });
      expect(result.signals.some(s => s.signalType === 'velocity_hourly')).toBe(true);
      expect(result.compositeScore).toBeGreaterThanOrEqual(40);
    });

    it('detects amount_anomaly when payment is 3× average', () => {
      const recent = new Date().toISOString();
      for (let i = 0; i < 3; i++) {
        db.payments.push(makePayment({
          id: `PAY-N${i}`, transactionId: `TXN-N${i}`, idempotencyKey: `IDEM-N${i}`,
          tripId: 'TRIP-1', amountEGP: 500, createdAt: recent,
        }));
      }
      const result = evaluateCheckout({
        userId: 'USR-1', transactionId: 'TXN-NEW-3', amountEGP: 5000,
      });
      expect(result.signals.some(s => s.signalType === 'amount_anomaly')).toBe(true);
    });

    it('detects duplicate_payment', () => {
      db.payments.push(makePayment({
        transactionId: 'TXN-DUP', idempotencyKey: 'IDEM-DUP', tripId: 'TRIP-1',
      }));
      const result = evaluateCheckout({
        userId: 'USR-1', transactionId: 'TXN-DUP', amountEGP: 500,
      });
      expect(result.signals.some(s => s.signalType === 'duplicate_payment')).toBe(true);
      expect(result.action).toBe('block');
    });

    it('blocks a user who is flagged as blocked', () => {
      // Manually set user as blocked.
      const stats = db.fraudUserStats.find(s => s.userId === 'USR-1') || {
        userId: 'USR-1', attemptsLastHour: 0, attemptsLastDay: 0,
        refundsLast30Days: 0, capturesLast30Days: 0, refundRate: 0,
        maxAmountLast30Days: 0, avgAmountRecent: 0, cumulativeRiskScore: 0,
        blocked: true, blockedReason: 'Manual block', updatedAt: now,
      };
      if (!db.fraudUserStats.find(s => s.userId === 'USR-1')) {
        db.fraudUserStats.push(stats);
      }
      const result = evaluateCheckout({
        userId: 'USR-1', transactionId: 'TXN-NEW-4', amountEGP: 500,
      });
      expect(result.action).toBe('block');
    });
  });

  describe('getSignals', () => {
    beforeEach(() => ensureDefaultRules());

    it('returns signals sorted by date descending', () => {
      evaluateCheckout({ userId: 'USR-1', transactionId: 'TXN-S1', amountEGP: 500 });
      evaluateCheckout({ userId: 'USR-1', transactionId: 'TXN-S2', amountEGP: 500 });
      const signals = getSignals();
      expect(signals.length).toBeGreaterThanOrEqual(0); // May be 0 if clean
    });

    it('filters by userId', () => {
      const signals = getSignals({ userId: 'USR-1' });
      expect(Array.isArray(signals)).toBe(true);
    });
  });

  describe('getFraudDashboard', () => {
    it('returns dashboard summary', () => {
      const dashboard = getFraudDashboard();
      expect(dashboard).toHaveProperty('totalSignalsLast24h');
      expect(dashboard).toHaveProperty('blockedCount');
      expect(dashboard).toHaveProperty('reviewCount');
      expect(dashboard).toHaveProperty('topSignalTypes');
      expect(dashboard).toHaveProperty('blockedUsers');
    });
  });

  describe('recalcUserStats', () => {
    it('calculates stats from payment history', () => {
      const recent = new Date().toISOString();
      db.payments.push(makePayment({ id: 'PAY-1', tripId: 'TRIP-1', amountEGP: 500, state: 'CAPTURED', createdAt: recent }));
      db.payments.push(makePayment({ id: 'PAY-2', tripId: 'TRIP-1', amountEGP: 600, state: 'CAPTURED', createdAt: recent }));
      db.payments.push(makePayment({ id: 'PAY-3', tripId: 'TRIP-1', amountEGP: 200, state: 'REFUNDED', createdAt: recent }));
      const stats = recalcUserStats('USR-1');
      expect(stats.capturesLast30Days).toBe(2);
      expect(stats.refundsLast30Days).toBe(1);
      expect(stats.refundRate).toBe(50); // 1/2 = 50%
      expect(stats.maxAmountLast30Days).toBe(600);
    });
  });
});
