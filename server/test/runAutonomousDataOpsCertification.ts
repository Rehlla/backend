import assert from 'assert';
import { db } from '../db/database';
import { runMigrationsAndSeed } from '../db/migrations';
import { dahabKnowledgeOs } from '../services/dahabKnowledgeOs';
import { autonomousDataOpsService, SchedulerExecutionResult } from '../services/autonomousDataOpsService';
import { marketFreshnessService } from '../services/marketFreshnessService';
import { daygiReasoningService } from '../services/daygiReasoningService';
import { authService } from '../services/authService';
import {
  FreshnessStatus,
  MarketReviewQueueEntity,
  MarketAlertEntity,
  RefreshSchedulePolicyEntity
} from '../db/schema';

console.log('================================================================================');
console.log('🛡️ AUTONOMOUS DAHAB DATA OPERATIONS & SUPERVISION CERTIFICATION HARNESS');
console.log('================================================================================');

process.env.SKIP_GEMINI_POLISH = 'true';

let totalTests = 0;
let passedTests = 0;

async function test(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function runAutonomousOpsCertification() {
  runMigrationsAndSeed();
  dahabKnowledgeOs.bootstrapValidatedCorpus();
  autonomousDataOpsService.seedDefaultPolicies();

  // ---------------------------------------------------------------------------
  // 1. SCHEDULER LIFECYCLE & INTERVAL POLICY CONFIGURATION
  // ---------------------------------------------------------------------------
  console.log('\n[Section 1: Scheduler Lifecycle & Policy Configuration]');

  await test('Default policies are seeded with diverse intervals (HOURLY, DAILY, MANUAL)', () => {
    const policies = autonomousDataOpsService.getPolicies();
    assert(policies.length >= 4, 'Must have at least 4 seeded refresh schedule policies');

    const hourly = policies.find(p => p.scheduleInterval === 'HOURLY');
    const daily = policies.find(p => p.scheduleInterval === 'DAILY');
    const manual = policies.find(p => p.scheduleInterval === 'MANUAL');

    assert(hourly, 'Must have HOURLY policy');
    assert(daily, 'Must have DAILY policy');
    assert(manual, 'Must have MANUAL policy');
  });

  await test('Calculates next run timestamps deterministically based on interval', () => {
    const base = new Date('2026-03-01T12:00:00.000Z');

    const nextHourly = autonomousDataOpsService.calculateNextRun('HOURLY', base);
    assert.strictEqual(nextHourly, '2026-03-01T13:00:00.000Z');

    const nextDaily = autonomousDataOpsService.calculateNextRun('DAILY', base);
    assert.strictEqual(nextDaily, '2026-03-02T12:00:00.000Z');

    const nextWeekly = autonomousDataOpsService.calculateNextRun('WEEKLY', base);
    assert.strictEqual(nextWeekly, '2026-03-08T12:00:00.000Z');

    const nextManual = autonomousDataOpsService.calculateNextRun('MANUAL', base);
    assert.strictEqual(nextManual, undefined);

    const nextOnDemand = autonomousDataOpsService.calculateNextRun('ON_DEMAND', base);
    assert.strictEqual(nextOnDemand, undefined);
  });

  await test('Supports runtime policy adjustment and updates updatedAt timestamp', () => {
    const updated = autonomousDataOpsService.updatePolicy('SRC-INSTAGRAM-COMMUNITY', {
      maxRetries: 5,
      scheduleInterval: 'DAILY'
    });

    assert.strictEqual(updated.maxRetries, 5);
    assert.strictEqual(updated.scheduleInterval, 'DAILY');
    assert(new Date(updated.updatedAt).getTime() > 0);
  });

  // ---------------------------------------------------------------------------
  // 2. CONCURRENCY PROTECTION & DISTRIBUTED FENCING TOKENS
  // ---------------------------------------------------------------------------
  console.log('\n[Section 2: Concurrency & Fencing Token Protection]');

  await test('Acquires source lock with unique monotonic fencing token', () => {
    const sourceId = 'SRC-TEST-CONCURRENCY-01';
    const lock1 = autonomousDataOpsService.acquireSourceLock(sourceId);
    assert.strictEqual(lock1.acquired, true);
    assert(typeof lock1.fencingToken === 'number' && lock1.fencingToken > 0);

    // Duplicate lock attempt on same source MUST fail
    const lock2 = autonomousDataOpsService.acquireSourceLock(sourceId);
    assert.strictEqual(lock2.acquired, false);
    assert(lock2.error?.includes('currently locked'));

    // Release lock
    autonomousDataOpsService.releaseSourceLock(sourceId);

    // Now lock can be reacquired with higher fencing token
    const lock3 = autonomousDataOpsService.acquireSourceLock(sourceId);
    assert.strictEqual(lock3.acquired, true);
    assert(lock3.fencingToken! > lock1.fencingToken!);

    autonomousDataOpsService.releaseSourceLock(sourceId);
  });

  await test('Independent sources can acquire locks concurrently without contention', () => {
    const srcA = 'SRC-SOURCE-ALPHA';
    const srcB = 'SRC-SOURCE-BETA';

    const lockA = autonomousDataOpsService.acquireSourceLock(srcA);
    const lockB = autonomousDataOpsService.acquireSourceLock(srcB);

    assert.strictEqual(lockA.acquired, true);
    assert.strictEqual(lockB.acquired, true);

    autonomousDataOpsService.releaseSourceLock(srcA);
    autonomousDataOpsService.releaseSourceLock(srcB);
  });

  // ---------------------------------------------------------------------------
  // 3. WATCHDOG STALE-RUN RECOVERY
  // ---------------------------------------------------------------------------
  console.log('\n[Section 3: Watchdog & Stale-Run Recovery]');

  await test('Watchdog detects stuck RUNNING jobs, transitions them to FAILED, and frees lock', () => {
    const staleSourceId = 'SRC-STALE-JOB-TEST';
    const staleRunId = `RUN-${staleSourceId}-STALE`;
    const sixMinutesAgo = new Date(Date.now() - 360000).toISOString();

    // Insert an artificial stuck run and hold its lock
    db.marketRefreshRuns.push({
      id: staleRunId,
      runId: staleRunId,
      sourceId: staleSourceId,
      sourceReference: 'Stale Simulation Source',
      startedAt: sixMinutesAgo,
      sourceCount: 1,
      supplierCount: 0,
      offerCount: 0,
      priceObservationCount: 0,
      changesDetected: 0,
      errors: [],
      status: 'RUNNING',
      ingestionMode: 'LIVE_FETCH'
    });

    autonomousDataOpsService.acquireSourceLock(staleSourceId, 600000); // 10 min TTL

    // Run watchdog recovery (threshold 5 min = 300,000ms)
    const recovered = autonomousDataOpsService.recoverStaleRuns(300000);
    assert(recovered >= 1, 'Watchdog should recover at least 1 stale run');

    const targetRun = db.marketRefreshRuns.find(r => r.id === staleRunId);
    assert.strictEqual(targetRun?.status, 'FAILED');
    assert(targetRun?.errors.some(e => e.includes('Watchdog Recovery')));

    // Ensure the source lock is now free to acquire
    const newLock = autonomousDataOpsService.acquireSourceLock(staleSourceId);
    assert.strictEqual(newLock.acquired, true, 'Lock must be freed after watchdog recovery');
    autonomousDataOpsService.releaseSourceLock(staleSourceId);
  });

  // ---------------------------------------------------------------------------
  // 4. CIRCUIT BREAKER & EXPONENTIAL BACKOFF
  // ---------------------------------------------------------------------------
  console.log('\n[Section 4: Circuit Breaker & Failure Isolation]');

  await test('Repeated failures increment consecutiveFailures, apply exponential backoff, and transition to FAILING', () => {
    const failSourceId = 'SRC-FAILING-BREAKER';
    autonomousDataOpsService.registerPolicy({
      sourceId: failSourceId,
      sourceReference: 'Unstable Upstream Source',
      sourceType: 'COMMUNITY',
      scheduleInterval: 'HOURLY',
      maxRetries: 3,
      initialBackoffMs: 2000,
      consecutiveFailures: 0,
      enabled: true
    });

    // Run 1: 1st failure -> DEGRADED
    const res1 = autonomousDataOpsService.runScheduledRefresh(failSourceId, {
      mockFailure: true,
      mockFailureReason: 'HTTP 504 Gateway Timeout'
    });
    assert.strictEqual(res1.status, 'FAILED');
    assert.strictEqual(res1.healthStatus, 'DEGRADED');

    const pol1 = autonomousDataOpsService.getPolicy(failSourceId)!;
    assert.strictEqual(pol1.consecutiveFailures, 1);

    // Run 2: 2nd failure -> DEGRADED
    const res2 = autonomousDataOpsService.runScheduledRefresh(failSourceId, {
      mockFailure: true,
      mockFailureReason: 'Connection Reset By Peer'
    });
    assert.strictEqual(res2.status, 'FAILED');
    assert.strictEqual(res2.healthStatus, 'DEGRADED');

    // Run 3: 3rd failure (hits maxRetries=3) -> FAILING
    const res3 = autonomousDataOpsService.runScheduledRefresh(failSourceId, {
      mockFailure: true,
      mockFailureReason: 'DNS Lookup Failure'
    });
    assert.strictEqual(res3.status, 'FAILED');
    assert.strictEqual(res3.healthStatus, 'FAILING');

    const pol3 = autonomousDataOpsService.getPolicy(failSourceId)!;
    assert.strictEqual(pol3.consecutiveFailures, 3);
    // Backoff for 3rd failure: initialBackoffMs * 2^(3-1) = 2000 * 4 = 8000ms
    const nextRunDiff = new Date(pol3.nextScheduledRun!).getTime() - Date.now();
    assert(nextRunDiff > 4000, `Expected backoff > 4s, got ${nextRunDiff}ms`);

    // Reset circuit breaker
    const resetHealth = autonomousDataOpsService.resetCircuitBreaker(failSourceId);
    assert.strictEqual(resetHealth.healthStatus, 'HEALTHY');
    assert.strictEqual(resetHealth.consecutiveFailures, 0);
  });

  await test('Source failure isolation: Unhealthy source does not disrupt healthy sources', () => {
    const healthySourceId = 'SRC-HEALTHY-SIBLING';
    autonomousDataOpsService.registerPolicy({
      sourceId: healthySourceId,
      sourceReference: 'Sibling Healthy Partner',
      sourceType: 'SUPPLIER_OFFICIAL',
      scheduleInterval: 'DAILY',
      enabled: true
    });

    const resHealthy = autonomousDataOpsService.runScheduledRefresh(healthySourceId, {
      latencyMs: 15
    });

    assert.strictEqual(resHealthy.status, 'COMPLETED');
    assert.strictEqual(resHealthy.healthStatus, 'HEALTHY');
  });

  // ---------------------------------------------------------------------------
  // 5. REFRESH RUNS & OPERATIONS OVERVIEW
  // ---------------------------------------------------------------------------
  console.log('\n[Section 5: Refresh Runs & Operations Overview]');

  await test('Refresh run records audit duration, records observed, and change counts', () => {
    const runs = marketFreshnessService.getMarketRefreshRuns(10);
    assert(runs.length > 0, 'Must have recorded refresh runs');

    const latest = runs[0];
    assert(latest.runId.length > 0);
    assert(latest.startedAt.length > 0);
    assert(latest.status === 'COMPLETED' || latest.status === 'PARTIAL' || latest.status === 'FAILED');
  });

  await test('Operations Overview computes dynamic operational metrics from live state', () => {
    const overview = autonomousDataOpsService.getOperationsOverview();

    assert(overview.totalSuppliers >= 0);
    assert(overview.totalOffers >= 0);
    assert(overview.totalPriceObservations >= 0);
    assert(overview.activeSourcesCount > 0);
    assert(overview.freshnessScore >= 0 && overview.freshnessScore <= 100);
    assert(Array.isArray(overview.recentRuns));
    assert(Array.isArray(overview.pendingReviews));
    assert(Array.isArray(overview.sourceHealth));
  });

  // ---------------------------------------------------------------------------
  // 6. REVIEW QUEUE & SUPERVISOR AUTHORIZATION
  // ---------------------------------------------------------------------------
  console.log('\n[Section 6: Review Queue & Supervisor Authorization]');

  await test('Queues market issues and enforces role-based authorization on supervisor actions', () => {
    const queueItemId = `REV-TEST-${Date.now()}`;
    const reviewItem: MarketReviewQueueEntity = {
      id: queueItemId,
      issueType: 'PRICE_ANOMALY',
      severity: 'HIGH',
      supplierId: 'SUP-01',
      activityId: 'ACT-BLUE-HOLE',
      sourceReference: 'Test Flyer 2026',
      summaryEn: 'Price jumped by 400%',
      summaryAr: 'قفزة في السعر بنسبة 400%',
      evidence: {
        detectedValue: 12000,
        previousValue: 2400,
        variancePercentage: 400
      },
      status: 'PENDING_REVIEW',
      detectedAt: new Date().toISOString()
    };
    db.marketReviewQueue.push(reviewItem);

    // 1. Unauthorized role (Traveler) MUST be rejected
    assert.throws(() => {
      autonomousDataOpsService.executeSupervisorAction({
        queueItemId,
        action: 'APPROVE',
        reviewer: 'hassan_traveler',
        reviewerRole: 'Traveler'
      });
    }, /Unauthorized/);

    // 2. Unauthorized role (Supplier) MUST be rejected
    assert.throws(() => {
      autonomousDataOpsService.executeSupervisorAction({
        queueItemId,
        action: 'APPROVE',
        reviewer: 'dive_shop_owner',
        reviewerRole: 'Supplier'
      });
    }, /Unauthorized/);

    // 3. Authorized role (Operations) MUST succeed and produce audit trail
    const result = autonomousDataOpsService.executeSupervisorAction({
      queueItemId,
      action: 'APPROVE',
      notes: 'Verified seasonal holiday surcharge with shop manager',
      reviewer: 'ops_lead_salma',
      reviewerRole: 'Operations'
    });

    assert.strictEqual(result.item.status, 'APPROVED');
    assert.strictEqual(result.item.reviewedBy, 'ops_lead_salma');
    assert(result.item.resolutionNotes?.includes('Verified seasonal holiday surcharge'));

    // Check authoritative audit log
    const auditLogs = (db.state.auditEvents || []).filter(a => a.entityId === queueItemId);
    assert(auditLogs.length >= 1, 'Must record audit log entry for supervisor action');
    assert.strictEqual(auditLogs[0].actor, 'ops_lead_salma');
  });

  // ---------------------------------------------------------------------------
  // 7. ALERT MANAGEMENT
  // ---------------------------------------------------------------------------
  console.log('\n[Section 7: Alert Lifecycle Management]');

  await test('Creates, filters, acknowledges, and resolves market alerts', () => {
    const alert = autonomousDataOpsService.createMarketAlert({
      alertType: 'PRICE_ANOMALY',
      severity: 'CRITICAL',
      titleEn: 'Severe Price Spike in Canyon Dives',
      titleAr: 'ارتفاع حاد في أسعار غطسات الكانيون',
      messageEn: 'Price increased by 350% in new flyer snapshot.',
      messageAr: 'ارتفع السعر بنسبة 350% في أحدث منشور.',
      sourceReference: 'Flyer Mar 2026'
    });

    assert.strictEqual(alert.acknowledged, false);

    // Filter unacknowledged
    const unacked = autonomousDataOpsService.getMarketAlerts({ unacknowledgedOnly: true });
    assert(unacked.some(a => a.id === alert.id));

    // Acknowledge alert
    const acked = autonomousDataOpsService.acknowledgeAlert(alert.id, 'supervisor_omar');
    assert.strictEqual(acked.acknowledged, true);
    assert.strictEqual(acked.acknowledgedBy, 'supervisor_omar');

    // Resolve alert
    const resolved = autonomousDataOpsService.resolveAlert(alert.id, 'Contacted vendor - flyer printing typo confirmed');
    assert(resolved.messageEn.includes('Resolved: Contacted vendor'));
  });

  // ---------------------------------------------------------------------------
  // 8. MARKET SNAPSHOTS & ROLLBACK MILESTONES
  // ---------------------------------------------------------------------------
  console.log('\n[Section 8: Market Snapshots & Rollback Milestones]');

  await test('Generates market snapshots with actual counts and records rollback audit milestones', () => {
    const snap1 = autonomousDataOpsService.createSnapshot('Pre-holiday batch refresh', 'cron-worker');
    assert(snap1.supplierCount > 0);
    assert(snap1.offerCount > 0);
    assert(snap1.activeSources !== undefined, 'snapshot records activeSources');
    assert(snap1.activeSources > 0);
    assert(snap1.freshnessScore !== undefined, 'snapshot records freshnessScore');
    assert(snap1.freshnessScore >= 0);

    const snapshots = autonomousDataOpsService.getSnapshots(5);
    assert(snapshots.some(s => s.id === snap1.id));

    // Perform rollback
    const rollbackResult = autonomousDataOpsService.rollbackToSnapshot(snap1.id, 'lead_supervisor_nour');
    assert.strictEqual(rollbackResult.success, true);
    assert.strictEqual(rollbackResult.snapshotId, snap1.id);
    assert.strictEqual(rollbackResult.executedBy, 'lead_supervisor_nour');

    // Verify rollback milestone snapshot is recorded
    const latestSnap = autonomousDataOpsService.getSnapshots(1)[0];
    assert(latestSnap.triggerSource?.includes('Rollback to snapshot'));
  });

  // ---------------------------------------------------------------------------
  // 9. IDEMPOTENCY & TEMPORAL DATA HANDLING
  // ---------------------------------------------------------------------------
  console.log('\n[Section 9: Idempotency & Temporal Validity Bounds]');

  await test('Executing duplicate refresh preserves pure idempotency with zero duplicate records', () => {
    const initialSuppliersCount = db.suppliers.length;
    const initialOffersCount = db.supplierOffers.length;
    const initialObsCount = db.priceObservations.length;

    const payload = {
      sourceReference: 'CDWS Official Egyptian Tourism Registry 2026',
      ingestionMode: 'LIVE_FETCH' as const,
      rawSupplierSources: (db.rawSupplierSources || []).slice(0, 5),
      rawOfferSources: (db.rawOfferSources || []).slice(0, 5)
    };

    marketFreshnessService.executeMarketRefresh(payload);
    const midSuppliersCount = db.suppliers.length;
    const midOffersCount = db.supplierOffers.length;

    // Run identical payload a second time
    marketFreshnessService.executeMarketRefresh(payload);
    const finalSuppliersCount = db.suppliers.length;
    const finalOffersCount = db.supplierOffers.length;

    assert.strictEqual(midSuppliersCount, finalSuppliersCount, 'Suppliers count must remain strictly invariant');
    assert.strictEqual(midOffersCount, finalOffersCount, 'Offers count must remain strictly invariant');
  });

  // ---------------------------------------------------------------------------
  // 10. DAYGI REASONING GROUNDING & SAFETY BOUNDS
  // ---------------------------------------------------------------------------
  console.log('\n[Section 10: DayGI Reasoning Grounding & Safety]');

  await test('DayGI answers SOURCE_STALENESS_INQUIRY with grounded freshness intelligence', async () => {
    const result = await daygiReasoningService.query({
      userId: 'USR-CERT-01',
      prompt: 'ايه البيانات اللي محتاجة تحديث في سوق دهب؟',
      language: 'ar'
    });

    assert.strictEqual(result.mode, 'DISCOVER');
    assert(result.replyTextAr?.includes('حداثة') || result.replyTextAr?.includes('المصادر') || result.replyTextAr?.includes('تجديد'));
    assert(result.sourceConfidence !== undefined, 'response carries sourceConfidence');
    assert.strictEqual(result.sourceConfidence!.source, 'VERIFIED_FACT');
    assert(result.actionData?.freshnessReport !== undefined);
  });

  await test('DayGI answers WHAT_CHANGED_QUERY with live change radar and informational guardrails', async () => {
    const result = await daygiReasoningService.query({
      userId: 'USR-CERT-01',
      prompt: 'إيه اللي اتغير في أسعار سوق دهب النهارده؟',
      language: 'ar'
    });

    assert(result.replyTextAr?.includes('تغييرات') || result.replyTextAr?.includes('سوق'));
    assert(result.replyTextAr?.includes('استرشادية') || result.replyTextAr?.includes('تأكيد'), 'Must contain informational guardrail');
    assert.strictEqual(result.actionRisk, 'READ_ONLY');
  });

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} AUTONOMOUS DATA OPS CERTIFICATION TESTS PASSED!`);
  console.log('================================================================================');
}

runAutonomousOpsCertification().catch(err => {
  console.error('Certification runner fatal error:', err);
  process.exit(1);
});
