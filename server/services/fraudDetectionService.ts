import crypto from 'crypto';
import { db } from '../db/database';
import { FraudSignalEntity, FraudRuleEntity, FraudUserStatsEntity } from '../db/schema';

/**
 * Fraud Detection Service
 *
 * Evaluates checkout attempts against a set of configurable rules and
 * produces risk signals. Each rule can be toggled, and thresholds are
 * configurable via FraudRuleEntity rows.
 *
 * Signal types:
 *   velocity_hourly  — too many checkout attempts in the last 60 min
 *   velocity_daily   — too many checkout attempts in the last 24 hours
 *   refund_rate      — high refund-to-capture ratio over 30 days
 *   amount_anomaly   — single payment much larger than the user's average
 *   duplicate_payment — same idempotency key re-submitted (already handled by paymentService, but we log it)
 *
 * Composite risk score = max(signal scores). Actions:
 *   score < 40  → 'allow'
 *   40–74       → 'review' (held for manual ops review)
 *   ≥ 75        → 'block'  (transaction rejected)
 */

const nowIso = () => new Date().toISOString();
const genId = (prefix: string) => `${prefix}-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

// ---------------------------------------------------------------------------
// Default rules
// ---------------------------------------------------------------------------

const DEFAULT_RULES: Omit<FraudRuleEntity, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { ruleName: 'velocity_hourly', enabled: true, riskScore: 50, threshold: 5, action: 'review', description: 'More than 5 checkout attempts in the last hour' },
  { ruleName: 'velocity_daily', enabled: true, riskScore: 70, threshold: 15, action: 'review', description: 'More than 15 checkout attempts in the last 24 hours' },
  { ruleName: 'refund_rate', enabled: true, riskScore: 60, threshold: 40, action: 'review', description: 'Refund rate exceeds 40% over the last 30 days' },
  { ruleName: 'amount_anomaly', enabled: true, riskScore: 55, threshold: 3, action: 'review', description: 'Payment amount is more than 3× the user\'s rolling average' },
  { ruleName: 'duplicate_payment', enabled: true, riskScore: 80, threshold: 1, action: 'block', description: 'Duplicate idempotency key detected' },
];

/**
 * Seed default fraud rules if none exist.
 */
export function ensureDefaultRules(): void {
  if (db.fraudRules.length > 0) return;
  const now = nowIso();
  for (const rule of DEFAULT_RULES) {
    db.fraudRules.push({
      ...rule,
      id: genId('FRULE'),
      createdAt: now,
      updatedAt: now,
    });
  }
  db.saveToDisk();
}

/**
 * Get a rule by name.
 */
export function getRule(ruleName: string): FraudRuleEntity | undefined {
  return db.fraudRules.find(r => r.ruleName === ruleName);
}

/**
 * Update a rule's threshold or enabled state.
 */
export function updateRule(ruleName: string, patch: Partial<Pick<FraudRuleEntity, 'enabled' | 'threshold' | 'riskScore' | 'action'>>): FraudRuleEntity {
  const rule = db.fraudRules.find(r => r.ruleName === ruleName);
  if (!rule) throw new Error(`Rule ${ruleName} not found.`);
  Object.assign(rule, patch, { updatedAt: nowIso() });
  db.saveToDisk();
  return rule;
}

/**
 * Get all rules.
 */
export function getAllRules(): FraudRuleEntity[] {
  return [...db.fraudRules];
}

// ---------------------------------------------------------------------------
// User stats
// ---------------------------------------------------------------------------

/**
 * Get or create fraud stats for a user.
 */
function getOrCreateUserStats(userId: string): FraudUserStatsEntity {
  let stats = db.fraudUserStats.find(s => s.userId === userId);
  if (!stats) {
    const now = nowIso();
    stats = {
      userId,
      attemptsLastHour: 0,
      attemptsLastDay: 0,
      refundsLast30Days: 0,
      capturesLast30Days: 0,
      refundRate: 0,
      maxAmountLast30Days: 0,
      avgAmountRecent: 0,
      cumulativeRiskScore: 0,
      blocked: false,
      updatedAt: now,
    };
    db.fraudUserStats.push(stats);
  }
  return stats;
}

/**
 * Recalculate a user's fraud stats from actual payment data.
 */
export function recalcUserStats(userId: string): FraudUserStatsEntity {
  const stats = getOrCreateUserStats(userId);
  const now = Date.now();
  const hourAgo = now - 60 * 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const days30Ago = now - 30 * 24 * 60 * 60 * 1000;

  const userPayments = db.payments.filter(p => {
    // Match by trip ownership.
    const trip = db.trips.find(t => t.id === p.tripId);
    return trip?.userId === userId;
  });

  stats.attemptsLastHour = userPayments.filter(p => Date.parse(p.createdAt) >= hourAgo).length;
  stats.attemptsLastDay = userPayments.filter(p => Date.parse(p.createdAt) >= dayAgo).length;
  stats.refundsLast30Days = userPayments.filter(p => p.state === 'REFUNDED' && Date.parse(p.createdAt) >= days30Ago).length;
  stats.capturesLast30Days = userPayments.filter(p => p.state === 'CAPTURED' && Date.parse(p.createdAt) >= days30Ago).length;
  stats.refundRate = stats.capturesLast30Days > 0
    ? Math.round((stats.refundsLast30Days / stats.capturesLast30Days) * 100)
    : 0;

  const recentPayments = userPayments
    .filter(p => p.state === 'CAPTURED')
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  stats.maxAmountLast30Days = recentPayments
    .filter(p => Date.parse(p.createdAt) >= days30Ago)
    .reduce((max, p) => Math.max(max, p.amountEGP), 0);

  const last10 = recentPayments.slice(0, 10);
  stats.avgAmountRecent = last10.length > 0
    ? Math.round(last10.reduce((sum, p) => sum + p.amountEGP, 0) / last10.length)
    : 0;

  stats.updatedAt = nowIso();
  db.saveToDisk();
  return stats;
}

// ---------------------------------------------------------------------------
// Signal evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a checkout attempt and return fraud signals.
 * Call this before processing payment to decide allow/review/block.
 */
export function evaluateCheckout(input: {
  userId: string;
  transactionId: string;
  amountEGP: number;
  bookingId?: string;
}): { signals: FraudSignalEntity[]; compositeScore: number; action: 'allow' | 'review' | 'block' } {
  ensureDefaultRules();
  const stats = recalcUserStats(input.userId);
  const signals: FraudSignalEntity[] = [];

  // 1. Velocity hourly
  const velocityHourlyRule = getRule('velocity_hourly');
  if (velocityHourlyRule?.enabled && stats.attemptsLastHour >= velocityHourlyRule.threshold) {
    signals.push(createSignal(input, 'velocity_hourly', velocityHourlyRule.riskScore,
      `${stats.attemptsLastHour} attempts in the last hour (threshold: ${velocityHourlyRule.threshold})`,
      { attempts: stats.attemptsLastHour, windowMinutes: 60 }, velocityHourlyRule.action));
  }

  // 2. Velocity daily
  const velocityDailyRule = getRule('velocity_daily');
  if (velocityDailyRule?.enabled && stats.attemptsLastDay >= velocityDailyRule.threshold) {
    signals.push(createSignal(input, 'velocity_daily', velocityDailyRule.riskScore,
      `${stats.attemptsLastDay} attempts in the last 24 hours (threshold: ${velocityDailyRule.threshold})`,
      { attempts: stats.attemptsLastDay, windowHours: 24 }, velocityDailyRule.action));
  }

  // 3. Refund rate
  const refundRateRule = getRule('refund_rate');
  if (refundRateRule?.enabled && stats.refundRate >= refundRateRule.threshold) {
    signals.push(createSignal(input, 'refund_rate', refundRateRule.riskScore,
      `Refund rate ${stats.refundRate}% exceeds threshold ${refundRateRule.threshold}%`,
      { refundRate: stats.refundRate, refunds: stats.refundsLast30Days, captures: stats.capturesLast30Days }, refundRateRule.action));
  }

  // 4. Amount anomaly
  const amountRule = getRule('amount_anomaly');
  if (amountRule?.enabled && stats.avgAmountRecent > 0 && input.amountEGP > stats.avgAmountRecent * amountRule.threshold) {
    signals.push(createSignal(input, 'amount_anomaly', amountRule.riskScore,
      `Amount ${input.amountEGP} EGP is ${Math.round(input.amountEGP / stats.avgAmountRecent)}× the user's average ${stats.avgAmountRecent} EGP`,
      { amount: input.amountEGP, avgAmount: stats.avgAmountRecent, multiplier: Math.round(input.amountEGP / stats.avgAmountRecent) }, amountRule.action));
  }

  // 5. Duplicate payment
  const existingPayment = db.payments.find(p =>
    p.idempotencyKey === input.transactionId ||
    p.transactionId === input.transactionId
  );
  if (existingPayment) {
    const dupRule = getRule('duplicate_payment');
    if (dupRule?.enabled) {
      signals.push(createSignal(input, 'duplicate_payment', dupRule.riskScore,
        `Transaction ${input.transactionId} already exists as payment ${existingPayment.id}`,
        { existingPaymentId: existingPayment.id, existingState: existingPayment.state }, dupRule.action));
    }
  }

  // 6. User is blocked
  if (stats.blocked) {
    signals.push(createSignal(input, 'velocity_daily', 100,
      `User is blocked: ${stats.blockedReason || 'flagged by fraud system'}`,
      {}, 'block'));
  }

  // Compute composite score and action.
  const compositeScore = signals.length > 0 ? Math.max(...signals.map(s => s.riskScore)) : 0;
  let action: 'allow' | 'review' | 'block' = 'allow';
  if (compositeScore >= 75) action = 'block';
  else if (compositeScore >= 40) action = 'review';

  // Persist signals.
  for (const signal of signals) {
    signal.action = action === 'block' ? 'block' : signal.action;
    db.fraudSignals.push(signal);
  }

  // Update user stats.
  stats.attemptsLastHour++;
  stats.attemptsLastDay++;
  stats.lastAttemptAt = nowIso();
  if (compositeScore > 0) {
    stats.cumulativeRiskScore = Math.min(100, stats.cumulativeRiskScore + Math.round(compositeScore / 10));
  }
  if (action === 'block') {
    stats.blocked = true;
    stats.blockedReason = signals.find(s => s.action === 'block')?.description || 'High fraud risk';
  }
  stats.updatedAt = nowIso();
  db.saveToDisk();

  return { signals, compositeScore, action };
}

/** The fraud gate refused a checkout. 403, before any money moved. */
export class FraudBlockedError extends Error {
  public readonly status = 403;
  public readonly code = 'FRAUD_BLOCKED';
  public readonly details: { riskScore: number; signals: Array<{ type: string; description: string }> };

  constructor(result: ReturnType<typeof evaluateCheckout>) {
    super('Transaction blocked by fraud detection.');
    this.name = 'FraudBlockedError';
    this.details = {
      riskScore: result.compositeScore,
      signals: result.signals.map(s => ({ type: s.signalType, description: s.description })),
    };
  }
}

/**
 * The one fraud gate every checkout path runs — multi-service, the single
 * hold-settling checkout and rental checkout — right before payment. Only the
 * multi route used to evaluate fraud, so a blocked user could still pay
 * through the other two. 'review' proceeds (the ops console sees the signal);
 * 'block' throws FraudBlockedError.
 *
 * Callers run it AFTER their idempotent-replay check: evaluated before it, a
 * client retry with the same key matched duplicate_payment (risk 80 → block)
 * and permanently blocked an honest traveller.
 */
export function assertCheckoutAllowed(input: {
  userId: string;
  transactionId: string;
  amountEGP: number;
  bookingId?: string;
}): ReturnType<typeof evaluateCheckout> {
  const result = evaluateCheckout(input);
  if (result.action === 'block') throw new FraudBlockedError(result);
  return result;
}

function createSignal(
  input: { userId: string; transactionId: string; amountEGP: number; bookingId?: string },
  signalType: FraudSignalEntity['signalType'],
  riskScore: number,
  description: string,
  metadata: Record<string, any>,
  action: 'allow' | 'review' | 'block',
): FraudSignalEntity {
  return {
    id: genId('FSIG'),
    transactionId: input.transactionId,
    bookingId: input.bookingId,
    userId: input.userId,
    signalType,
    riskScore,
    description,
    metadata,
    action,
    createdAt: nowIso(),
  };
}

/**
 * Get all fraud signals (admin audit trail).
 */
export function getSignals(filters?: { userId?: string; action?: string; limit?: number }): FraudSignalEntity[] {
  let signals = [...db.fraudSignals];
  if (filters?.userId) signals = signals.filter(s => s.userId === filters.userId);
  if (filters?.action) signals = signals.filter(s => s.action === filters.action);
  signals.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (filters?.limit) signals = signals.slice(0, filters.limit);
  return signals;
}

/**
 * Get fraud stats summary for admin dashboard.
 */
export function getFraudDashboard(): {
  totalSignalsLast24h: number;
  blockedCount: number;
  reviewCount: number;
  topSignalTypes: Array<{ type: string; count: number }>;
  blockedUsers: number;
} {
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const recent = db.fraudSignals.filter(s => Date.parse(s.createdAt) >= dayAgo);
  const typeCounts = new Map<string, number>();
  for (const s of recent) {
    typeCounts.set(s.signalType, (typeCounts.get(s.signalType) || 0) + 1);
  }
  return {
    totalSignalsLast24h: recent.length,
    blockedCount: recent.filter(s => s.action === 'block').length,
    reviewCount: recent.filter(s => s.action === 'review').length,
    topSignalTypes: [...typeCounts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count),
    blockedUsers: db.fraudUserStats.filter(s => s.blocked).length,
  };
}
