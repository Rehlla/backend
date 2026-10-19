import crypto from 'crypto';
import { db } from '../db/database';
import {
  RefreshSchedulePolicyEntity,
  RefreshInterval,
  MarketRefreshRunEntity,
  SourceHealthEntity,
  MarketReviewQueueEntity,
  MarketAlertEntity,
  MarketAlertType,
  MarketSnapshotEntity,
  SupervisorActionType,
  LocalCommerceSourceType,
  FreshnessStatus,
  MarketChangeEventEntity
} from '../db/schema';
import { marketFreshnessService } from './marketFreshnessService';

export interface SchedulerExecutionResult {
  runId: string;
  sourceId: string;
  sourceReference: string;
  status: 'COMPLETED' | 'FAILED' | 'PARTIAL' | 'CANCELLED';
  durationMs: number;
  recordsObserved: number;
  changesDetected: number;
  errors: string[];
  nextScheduledRun?: string;
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'FAILING' | 'STALE' | 'DISABLED';
}

export class AutonomousDataOpsService {
  private isInitialized = false;

  constructor() {
    this.seedDefaultPolicies();
  }

  /**
   * Initializes default refresh policies for Dahab sources if not already populated
   */
  public seedDefaultPolicies(): void {
    if (this.isInitialized && db.refreshSchedulePolicies.length > 0) {
      return;
    }

    const defaultPolicies: Array<Omit<RefreshSchedulePolicyEntity, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        sourceId: 'SRC-CDWS-REGISTRY',
        sourceReference: 'CDWS Official Egyptian Tourism Registry 2026',
        sourceType: 'OFFICIAL_REGULATORY',
        scheduleInterval: 'DAILY',
        ingestionMode: 'LIVE_FETCH',
        enabled: true,
        requiresReview: true,
        maxRetries: 3,
        initialBackoffMs: 5000,
        consecutiveFailures: 0,
        lastScheduledRun: new Date(Date.now() - 3600000 * 12).toISOString(),
        nextScheduledRun: new Date(Date.now() + 3600000 * 12).toISOString()
      },
      {
        sourceId: 'SRC-INSTAGRAM-COMMUNITY',
        sourceReference: 'Dahab Community Commercial Flyers & Instagram Discovery',
        sourceType: 'INSTAGRAM',
        scheduleInterval: 'HOURLY',
        ingestionMode: 'IMPORTED_SNAPSHOT',
        enabled: true,
        requiresReview: false,
        maxRetries: 2,
        initialBackoffMs: 3000,
        consecutiveFailures: 0,
        lastScheduledRun: new Date(Date.now() - 1800000).toISOString(),
        nextScheduledRun: new Date(Date.now() + 1800000).toISOString()
      },
      {
        sourceId: 'SRC-SUPPLIER-OFFICIAL',
        sourceReference: 'Verified Supplier Direct Dispatch',
        sourceType: 'SUPPLIER_OFFICIAL',
        scheduleInterval: 'DAILY',
        ingestionMode: 'LIVE_FETCH',
        enabled: true,
        requiresReview: false,
        maxRetries: 3,
        initialBackoffMs: 5000,
        consecutiveFailures: 0,
        lastScheduledRun: new Date(Date.now() - 3600000 * 8).toISOString(),
        nextScheduledRun: new Date(Date.now() + 3600000 * 16).toISOString()
      },
      {
        sourceId: 'SRC-COMMUNITY-FLYERS',
        sourceReference: 'Dahab Community Commercial Bulletin & Static Flyers',
        sourceType: 'COMMUNITY',
        scheduleInterval: 'MANUAL',
        ingestionMode: 'MANUAL_REFRESH',
        enabled: true,
        requiresReview: false,
        maxRetries: 1,
        initialBackoffMs: 1000,
        consecutiveFailures: 0,
        lastScheduledRun: new Date(Date.now() - 86400000 * 3).toISOString()
      }
    ];

    for (const p of defaultPolicies) {
      const existing = db.refreshSchedulePolicies.find(
        pol => pol.sourceId === p.sourceId || pol.sourceReference === p.sourceReference
      );
      if (!existing) {
        db.refreshSchedulePolicies.push({
          id: `POL-${p.sourceId}`,
          ...p,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    // Also ensure SourceHealth records exist for these
    for (const pol of db.refreshSchedulePolicies) {
      let health = db.sourceHealthRecords.find(
        h => h.sourceId === pol.sourceId || h.sourceReference === pol.sourceReference
      );
      if (!health) {
        db.sourceHealthRecords.push({
          id: `HLTH-${pol.sourceId}`,
          sourceId: pol.sourceId,
          sourceReference: pol.sourceReference,
          sourceType: pol.sourceType,
          healthStatus: 'HEALTHY',
          consecutiveFailures: 0,
          totalRuns: 1,
          successfulRuns: 1,
          lastAttempt: new Date().toISOString(),
          lastSuccess: new Date().toISOString(),
          lastSuccessfulRefresh: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }

    this.isInitialized = true;
  }

  // =========================================================================
  // SCHEDULER POLICIES
  // =========================================================================

  public getPolicies(): RefreshSchedulePolicyEntity[] {
    this.seedDefaultPolicies();
    return db.refreshSchedulePolicies;
  }

  public getPolicy(idOrSourceId: string): RefreshSchedulePolicyEntity | undefined {
    this.seedDefaultPolicies();
    return db.refreshSchedulePolicies.find(
      p => p.id === idOrSourceId || p.sourceId === idOrSourceId || p.sourceReference === idOrSourceId
    );
  }

  public registerPolicy(
    params: Partial<RefreshSchedulePolicyEntity> & {
      sourceId: string;
      sourceReference: string;
      sourceType: LocalCommerceSourceType;
    }
  ): RefreshSchedulePolicyEntity {
    this.seedDefaultPolicies();
    const existingIdx = db.refreshSchedulePolicies.findIndex(p => p.sourceId === params.sourceId);
    const now = new Date().toISOString();

    const policy: RefreshSchedulePolicyEntity = {
      id: params.id || `POL-${params.sourceId}`,
      sourceId: params.sourceId,
      sourceReference: params.sourceReference,
      sourceType: params.sourceType,
      scheduleInterval: params.scheduleInterval || 'DAILY',
      ingestionMode: params.ingestionMode || 'LIVE_FETCH',
      enabled: params.enabled !== undefined ? params.enabled : true,
      requiresReview: params.requiresReview !== undefined ? params.requiresReview : false,
      maxRetries: params.maxRetries || 3,
      initialBackoffMs: params.initialBackoffMs || 5000,
      consecutiveFailures: params.consecutiveFailures || 0,
      lastScheduledRun: params.lastScheduledRun,
      nextScheduledRun: params.nextScheduledRun || this.calculateNextRun(params.scheduleInterval || 'DAILY'),
      lastCompletedRun: params.lastCompletedRun,
      createdAt: now,
      updatedAt: now
    };

    if (existingIdx >= 0) {
      db.refreshSchedulePolicies[existingIdx] = {
        ...db.refreshSchedulePolicies[existingIdx],
        ...policy,
        updatedAt: now
      };
      return db.refreshSchedulePolicies[existingIdx];
    } else {
      db.refreshSchedulePolicies.push(policy);
      return policy;
    }
  }

  public updatePolicy(
    idOrSourceId: string,
    updates: Partial<RefreshSchedulePolicyEntity>
  ): RefreshSchedulePolicyEntity {
    const policy = this.getPolicy(idOrSourceId);
    if (!policy) {
      throw new Error(`Refresh schedule policy '${idOrSourceId}' not found.`);
    }
    Object.assign(policy, updates, { updatedAt: new Date().toISOString() });
    return policy;
  }

  public calculateNextRun(interval: RefreshInterval, fromDate: Date = new Date()): string | undefined {
    if (interval === 'MANUAL' || interval === 'ON_DEMAND') {
      return undefined;
    }
    const next = new Date(fromDate.getTime());
    switch (interval) {
      case 'HOURLY':
        next.setHours(next.getHours() + 1);
        break;
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY':
        next.setDate(next.getDate() + 7);
        break;
    }
    return next.toISOString();
  }

  // =========================================================================
  // DISTRIBUTED LOCKING & CONCURRENCY PROTECTION
  // =========================================================================

  private getLockKey(sourceId: string): string {
    return `LOCK-REFRESH-${sourceId}`;
  }

  public acquireSourceLock(sourceId: string, ttlMs = 300000): { acquired: boolean; fencingToken?: number; error?: string } {
    const lockKey = this.getLockKey(sourceId);
    const now = Date.now();

    // Check for existing active lock
    const existingLockIndex = db.locks.findIndex(l => l.lockKey === lockKey || l.id === lockKey);
    if (existingLockIndex >= 0) {
      const existing = db.locks[existingLockIndex];
      const expiry = typeof existing.expiresAt === 'number' ? existing.expiresAt : new Date(existing.expiresAt).getTime();
      if (expiry > now) {
        // Active lock held by someone else
        return {
          acquired: false,
          error: `Source '${sourceId}' is currently locked by active run '${existing.owner}' until ${new Date(expiry).toISOString()}.`
        };
      } else {
        // Stale lock detected, clean it up
        db.locks.splice(existingLockIndex, 1);
      }
    }

    // Acquire lock with new fencing token
    const fencingToken = db.nextFencingToken();
    db.locks.push({
      id: lockKey,
      lockKey,
      leaseId: `LEASE-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      owner: `WORKER-${Date.now()}`,
      acquiredAt: now,
      expiresAt: now + ttlMs,
      fencingToken,
      version: 1
    });

    return { acquired: true, fencingToken };
  }

  public releaseSourceLock(sourceId: string): void {
    const lockKey = this.getLockKey(sourceId);
    const idx = db.locks.findIndex(l => l.lockKey === lockKey || l.id === lockKey);
    if (idx >= 0) {
      db.locks.splice(idx, 1);
    }
  }

  /**
   * Watchdog to clean up stale locks and stuck RUNNING runs (> 5 minutes)
   */
  public recoverStaleRuns(maxAgeMs = 300000): number {
    const now = Date.now();
    let recoveredCount = 0;

    // 1. Clear expired locks
    const activeLocks = db.locks.filter(l => new Date(l.expiresAt).getTime() > now);
    if (activeLocks.length !== db.locks.length) {
      db.locks.length = 0;
      db.locks.push(...activeLocks);
    }

    // 2. Recover stuck RUNNING runs
    for (const run of db.marketRefreshRuns) {
      if (run.status === 'RUNNING') {
        const startAge = now - new Date(run.startedAt).getTime();
        if (startAge > maxAgeMs) {
          run.status = 'FAILED';
          run.completedAt = new Date(now).toISOString();
          run.errors.push(`Watchdog Recovery: Refresh run timed out after ${Math.round(startAge / 1000)}s.`);
          if (run.sourceId) {
            this.releaseSourceLock(run.sourceId);
          }
          recoveredCount++;
        }
      }
    }

    return recoveredCount;
  }

  // =========================================================================
  // CORE REFRESH SCHEDULER EXECUTION
  // =========================================================================

  /**
   * Executes scheduled refresh for a specific source policy with strict concurrency,
   * exponential backoff on failure, and audit telemetry.
   */
  public runScheduledRefresh(
    policyIdOrSourceId: string,
    options: {
      force?: boolean;
      triggeredBy?: string;
      mockFailure?: boolean;
      mockFailureReason?: string;
      rawPayload?: any;
      latencyMs?: number;
    } = {}
  ): SchedulerExecutionResult {
    this.seedDefaultPolicies();
    this.recoverStaleRuns();

    const policy = this.getPolicy(policyIdOrSourceId);
    if (!policy) {
      throw new Error(`Policy or Source '${policyIdOrSourceId}' not found.`);
    }

    if (!policy.enabled && !options.force) {
      throw new Error(`Source '${policy.sourceId}' is disabled in refresh policy.`);
    }

    // 1. Concurrency Lock
    const lockResult = this.acquireSourceLock(policy.sourceId);
    if (!lockResult.acquired) {
      throw new Error(`CONCURRENT_REFRESH_LOCKED: ${lockResult.error}`);
    }

    const runId = `RUN-${policy.sourceId}-${Date.now()}`;
    const startTime = Date.now();
    const startedAt = new Date(startTime).toISOString();

    // Create initial refresh run record
    const refreshRun: MarketRefreshRunEntity = {
      id: runId,
      runId,
      sourceId: policy.sourceId,
      sourceReference: policy.sourceReference,
      startedAt,
      sourceCount: 1,
      supplierCount: 0,
      offerCount: 0,
      priceObservationCount: 0,
      changesDetected: 0,
      errors: [],
      status: 'RUNNING',
      ingestionMode: policy.ingestionMode
    };
    db.marketRefreshRuns.push(refreshRun);

    try {
      // 2. Handle Mock or Real Failure
      if (options.mockFailure) {
        const errorMsg = options.mockFailureReason || `Simulated network timeout connecting to ${policy.sourceReference}`;
        throw new Error(errorMsg);
      }

      // 3. Execute Market Refresh Pipeline
      const payload: any = options.rawPayload || {
        sourceReference: policy.sourceReference,
        ingestionMode: policy.ingestionMode,
        rawSupplierSources: (db.rawSupplierSources || []).slice(0, 10),
        rawOfferSources: (db.rawOfferSources || []).slice(0, 15)
      };

      const refreshResult = marketFreshnessService.executeMarketRefresh(payload);

      const endTime = Date.now();
      const durationMs = options.latencyMs !== undefined ? options.latencyMs : endTime - startTime;
      const completedAt = new Date(endTime).toISOString();

      const errors: string[] = (refreshResult as any).errors || [];
      const changesCount = refreshResult.changesDetectedCount || refreshResult.changesRecorded || (refreshResult.events || []).length;
      const suppliersCount = refreshResult.stats?.totalSuppliers || (payload.suppliers || []).length;
      const offersCount = refreshResult.stats?.totalOffers || (payload.offers || []).length;
      const priceObservationsCount = refreshResult.stats?.totalObservations || (payload.priceObservations || []).length;

      // Update Run
      refreshRun.status = errors.length > 0 ? 'PARTIAL' : 'COMPLETED';
      refreshRun.completedAt = completedAt;
      refreshRun.durationMs = durationMs;
      refreshRun.supplierCount = suppliersCount;
      refreshRun.offerCount = offersCount;
      refreshRun.priceObservationCount = priceObservationsCount;
      refreshRun.changesDetected = changesCount;
      refreshRun.errors = errors;

      // Update Policy state
      policy.consecutiveFailures = 0;
      policy.lastScheduledRun = startedAt;
      policy.lastCompletedRun = completedAt;
      policy.nextScheduledRun = this.calculateNextRun(policy.scheduleInterval, new Date(endTime));

      // Update Source Health
      let health = db.sourceHealthRecords.find(h => h.sourceId === policy.sourceId || h.sourceReference === policy.sourceReference);
      if (!health) {
        health = {
          id: `HLTH-${policy.sourceId}`,
          sourceId: policy.sourceId,
          sourceReference: policy.sourceReference,
          sourceType: policy.sourceType,
          healthStatus: 'HEALTHY',
          consecutiveFailures: 0,
          totalRuns: 0,
          successfulRuns: 0
        };
        db.sourceHealthRecords.push(health);
      }
      health.healthStatus = 'HEALTHY';
      health.consecutiveFailures = 0;
      health.lastAttempt = startedAt;
      health.lastSuccess = completedAt;
      health.lastSuccessfulRefresh = completedAt;
      health.latencyMs = durationMs;
      health.recordsObserved = suppliersCount + offersCount;
      health.changesDetected = changesCount;
      health.totalRuns = (health.totalRuns || 0) + 1;
      health.successfulRuns = (health.successfulRuns || 0) + 1;
      health.updatedAt = completedAt;

      // Generate Market Snapshot
      this.createMarketSnapshot(policy.sourceReference);

      // Evaluate Price Drop/Increase for Internal Alerts
      this.generateInternalMarketAlerts(refreshResult.events || []);

      return {
        runId,
        sourceId: policy.sourceId,
        sourceReference: policy.sourceReference,
        status: refreshRun.status as 'COMPLETED' | 'PARTIAL',
        durationMs,
        recordsObserved: refreshRun.supplierCount + refreshRun.offerCount,
        changesDetected: refreshRun.changesDetected,
        errors: refreshRun.errors,
        nextScheduledRun: policy.nextScheduledRun,
        healthStatus: health.healthStatus
      };
    } catch (err: any) {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const failedAt = new Date(endTime).toISOString();

      refreshRun.status = 'FAILED';
      refreshRun.completedAt = failedAt;
      refreshRun.durationMs = durationMs;
      refreshRun.errors.push(err.message || 'Unknown refresh failure');

      // Increment Failure & Calculate Exponential Backoff
      policy.consecutiveFailures = (policy.consecutiveFailures || 0) + 1;
      const backoffMs = policy.initialBackoffMs * Math.pow(2, Math.min(policy.consecutiveFailures - 1, 6));
      policy.nextScheduledRun = new Date(endTime + backoffMs).toISOString();

      // Health Transition
      let health = db.sourceHealthRecords.find(h => h.sourceId === policy.sourceId || h.sourceReference === policy.sourceReference);
      if (!health) {
        health = {
          id: `HLTH-${policy.sourceId}`,
          sourceId: policy.sourceId,
          sourceReference: policy.sourceReference,
          sourceType: policy.sourceType,
          healthStatus: 'DEGRADED',
          consecutiveFailures: 0,
          totalRuns: 0,
          successfulRuns: 0
        };
        db.sourceHealthRecords.push(health);
      }
      health.consecutiveFailures = policy.consecutiveFailures;
      health.lastAttempt = startedAt;
      health.lastFailure = failedAt;
      health.lastFailedRefresh = failedAt;
      health.lastError = err.message;
      health.totalRuns = (health.totalRuns || 0) + 1;
      health.healthStatus = policy.consecutiveFailures >= (policy.maxRetries || 3) ? 'FAILING' : 'DEGRADED';
      health.updatedAt = failedAt;

      // Internal Alert for Source Failure
      this.createMarketAlert({
        alertType: 'SOURCE_FAILURE',
        severity: policy.consecutiveFailures >= 3 ? 'CRITICAL' : 'HIGH',
        titleEn: `Source Refresh Failure: ${policy.sourceReference}`,
        titleAr: `فشل تحديث المصدر: ${policy.sourceReference}`,
        messageEn: `Consecutive failures: ${policy.consecutiveFailures}. Error: ${err.message}. Retrying at ${policy.nextScheduledRun}`,
        messageAr: `فشل متكرر ${policy.consecutiveFailures} مرات. الخطأ: ${err.message}. ستتم إعادة المحاولة في ${policy.nextScheduledRun}`,
        sourceReference: policy.sourceReference
      });

      return {
        runId,
        sourceId: policy.sourceId,
        sourceReference: policy.sourceReference,
        status: 'FAILED',
        durationMs,
        recordsObserved: 0,
        changesDetected: 0,
        errors: refreshRun.errors,
        nextScheduledRun: policy.nextScheduledRun,
        healthStatus: health.healthStatus
      };
    } finally {
      // Always release lock
      this.releaseSourceLock(policy.sourceId);
    }
  }

  /**
   * Triggers scheduled refreshes for all due enabled policies
   */
  public runDueScheduledRefreshes(): SchedulerExecutionResult[] {
    this.seedDefaultPolicies();
    const now = new Date();
    const duePolicies = db.refreshSchedulePolicies.filter(p => {
      if (!p.enabled) return false;
      if (!p.nextScheduledRun) return false;
      return new Date(p.nextScheduledRun) <= now;
    });

    const results: SchedulerExecutionResult[] = [];
    for (const policy of duePolicies) {
      try {
        const res = this.runScheduledRefresh(policy.sourceId);
        results.push(res);
      } catch (err: any) {
        results.push({
          runId: `ERR-${policy.sourceId}`,
          sourceId: policy.sourceId,
          sourceReference: policy.sourceReference,
          status: 'FAILED',
          durationMs: 0,
          recordsObserved: 0,
          changesDetected: 0,
          errors: [err.message],
          healthStatus: 'FAILING'
        });
      }
    }
    return results;
  }

  // =========================================================================
  // SOURCE HEALTH & STALENESS MONITORING
  // =========================================================================

  public evaluateSourceStaleness(): { staleCount: number; updated: SourceHealthEntity[] } {
    this.seedDefaultPolicies();
    const freshnessReport = marketFreshnessService.getSourceFreshnessReport();
    const updated: SourceHealthEntity[] = [];
    let staleCount = 0;

    for (const src of freshnessReport.sources) {
      let health = db.sourceHealthRecords.find(h => h.sourceReference === src.sourceReference);
      if (!health) {
        health = {
          id: `HLTH-${crypto.createHash('md5').update(src.sourceReference).digest('hex').substring(0, 8)}`,
          sourceReference: src.sourceReference,
          sourceType: src.sourceType as LocalCommerceSourceType,
          healthStatus: 'HEALTHY',
          consecutiveFailures: 0,
          totalRuns: 1,
          successfulRuns: 1
        };
        db.sourceHealthRecords.push(health);
      }

      if (src.status === FreshnessStatus.STALE || src.status === FreshnessStatus.EXPIRED) {
        if (health.healthStatus !== 'DISABLED') {
          health.healthStatus = 'STALE';
          staleCount++;
          updated.push(health);

          // Emit alert
          this.createMarketAlert({
            alertType: 'SOURCE_STALE',
            severity: src.status === FreshnessStatus.EXPIRED ? 'HIGH' : 'MEDIUM',
            titleEn: `Source Stale Warning: ${src.sourceReference}`,
            titleAr: `تنبيه تقادم المصدر: ${src.sourceReference}`,
            messageEn: `Freshness score dropped to ${src.score}%. Last verified at ${src.lastVerifiedAt}`,
            messageAr: `انخفض مؤشر الحداثة إلى ${src.score}%. آخر توثيق كان في ${src.lastVerifiedAt}`,
            sourceReference: src.sourceReference
          });
        }
      }
    }

    return { staleCount, updated };
  }

  public getSourceHealthReport(): SourceHealthEntity[] {
    this.seedDefaultPolicies();
    return db.sourceHealthRecords;
  }

  // =========================================================================
  // REVIEW AUTOMATION & SUPERVISOR ACTIONS
  // =========================================================================

  public getReviewQueue(params: {
    issueType?: MarketReviewQueueEntity['issueType'];
    status?: MarketReviewQueueEntity['status'];
    severity?: MarketReviewQueueEntity['severity'];
  } = {}): MarketReviewQueueEntity[] {
    let queue = db.marketReviewQueue || [];
    if (params.issueType) {
      queue = queue.filter(item => item.issueType === params.issueType);
    }
    if (params.status) {
      queue = queue.filter(item => item.status === params.status);
    }
    if (params.severity) {
      queue = queue.filter(item => item.severity === params.severity);
    }
    return queue;
  }

  /**
   * Executes authoritative supervisor actions with audit trail
   */
  public executeSupervisorAction(params: {
    queueItemId: string;
    action: SupervisorActionType;
    notes?: string;
    reviewer: string;
    reviewerRole: string;
  }): { item: MarketReviewQueueEntity; actionApplied: string } {
    const queue = db.marketReviewQueue || [];
    const item = queue.find(q => q.id === params.queueItemId);
    if (!item) {
      throw new Error(`Review queue item '${params.queueItemId}' not found.`);
    }

    // Role Validation (Operations or Admin only)
    const allowedRoles = ['Operations', 'Admin', 'operations', 'admin', 'supervisor', 'OPERATIONS', 'ADMIN'];
    if (!allowedRoles.includes(params.reviewerRole)) {
      throw new Error(`Unauthorized: Role '${params.reviewerRole}' is not permitted to perform supervisor actions.`);
    }

    const now = new Date().toISOString();
    let actionApplied = params.action;

    // Apply Domain Action Mutations
    switch (params.action) {
      case 'APPROVE':
        item.status = 'APPROVED';
        break;

      case 'REJECT':
        item.status = 'REJECTED';
        break;

      case 'DISMISS':
        item.status = 'DISMISSED';
        break;

      case 'MARK_VERIFIED':
        item.status = 'MARKED_VERIFIED';
        if (item.supplierId) {
          const sup = db.suppliers.find(s => s.id === item.supplierId);
          if (sup) {
            sup.verificationStatus = 'REGULATORY_VERIFIED';
            sup.cdwsVerified = true;
            sup.tier = 'Tier 1 Certified';
          }
        }
        break;

      case 'MARK_STALE':
        item.status = 'MARKED_STALE';
        if (item.sourceReference) {
          const health = db.sourceHealthRecords.find(h => h.sourceReference === item.sourceReference);
          if (health) health.healthStatus = 'STALE';
        }
        break;

      case 'SUSPEND_SOURCE':
        item.status = 'SOURCE_SUSPENDED';
        if (item.sourceReference) {
          const policy = db.refreshSchedulePolicies.find(p => p.sourceReference === item.sourceReference);
          if (policy) policy.enabled = false;
          const health = db.sourceHealthRecords.find(h => h.sourceReference === item.sourceReference);
          if (health) health.healthStatus = 'DISABLED';
        }
        break;

      case 'REACTIVATE_SOURCE':
        item.status = 'SOURCE_REACTIVATED';
        if (item.sourceReference) {
          const policy = db.refreshSchedulePolicies.find(p => p.sourceReference === item.sourceReference);
          if (policy) policy.enabled = true;
          const health = db.sourceHealthRecords.find(h => h.sourceReference === item.sourceReference);
          if (health) {
            health.healthStatus = 'HEALTHY';
            health.consecutiveFailures = 0;
          }
        }
        break;

      case 'AUTO_RESOLVE':
        item.status = 'AUTO_RESOLVED';
        break;
    }

    item.reviewedAt = now;
    item.reviewedBy = params.reviewer;
    item.resolutionNotes = params.notes || `Action ${params.action} executed by ${params.reviewer} (${params.reviewerRole})`;

    // Authoritative Audit Logging
    db.logAudit(
      params.reviewer,
      params.reviewerRole,
      `SUPERVISOR_ACTION_${params.action}`,
      'MARKET_REVIEW_ITEM',
      item.id,
      {
        action: params.action,
        issueType: item.issueType,
        severity: item.severity,
        supplierId: item.supplierId,
        sourceReference: item.sourceReference,
        notes: item.resolutionNotes
      }
    );

    return { item, actionApplied };
  }

  // =========================================================================
  // INTERNAL MARKET ALERTS
  // =========================================================================

  public createMarketAlert(
    params: Omit<MarketAlertEntity, 'id' | 'createdAt' | 'acknowledged'>
  ): MarketAlertEntity {
    const alert: MarketAlertEntity = {
      id: `ALT-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      createdAt: new Date().toISOString(),
      acknowledged: false,
      ...params
    };
    db.marketAlerts.unshift(alert);
    return alert;
  }

  public getMarketAlerts(options: { unacknowledgedOnly?: boolean; severity?: string } = {}): MarketAlertEntity[] {
    let alerts = db.marketAlerts || [];
    if (options.unacknowledgedOnly) {
      alerts = alerts.filter(a => !a.acknowledged);
    }
    if (options.severity) {
      alerts = alerts.filter(a => a.severity === options.severity);
    }
    return alerts;
  }

  public acknowledgeAlert(alertId: string, ackBy: string): MarketAlertEntity {
    const alert = db.marketAlerts.find(a => a.id === alertId);
    if (!alert) {
      throw new Error(`Market Alert '${alertId}' not found.`);
    }
    alert.acknowledged = true;
    alert.acknowledgedBy = ackBy;
    alert.acknowledgedAt = new Date().toISOString();
    return alert;
  }

  private generateInternalMarketAlerts(changes: MarketChangeEventEntity[]): void {
    for (const ch of changes) {
      const src = ch.details?.sourceReference || 'Market Observation';
      const oldVal = ch.details?.oldAmount ?? ch.details?.oldValue ?? '';
      const newVal = ch.details?.newAmount ?? ch.details?.newValue ?? '';
      if (ch.eventType === 'PRICE_DECREASE') {
        this.createMarketAlert({
          alertType: 'PRICE_DROP',
          severity: 'LOW',
          titleEn: `Price Drop Detected: ${ch.summaryEn}`,
          titleAr: `انخفاض في السعر: ${ch.summaryAr}`,
          messageEn: `Price dropped from ${oldVal} to ${newVal}. Source: ${src}`,
          messageAr: `انخفض السعر من ${oldVal} إلى ${newVal}. المصدر: ${src}`,
          sourceReference: src,
          activityId: ch.activityId,
          supplierId: ch.supplierId
        });
      } else if (ch.eventType === 'PRICE_INCREASE') {
        this.createMarketAlert({
          alertType: 'PRICE_INCREASE',
          severity: 'LOW',
          titleEn: `Price Increase Detected: ${ch.summaryEn}`,
          titleAr: `ارتفاع في السعر: ${ch.summaryAr}`,
          messageEn: `Price increased from ${oldVal} to ${newVal}. Source: ${src}`,
          messageAr: `ارتفع السعر من ${oldVal} إلى ${newVal}. المصدر: ${src}`,
          sourceReference: src,
          activityId: ch.activityId,
          supplierId: ch.supplierId
        });
      } else if (ch.eventType === 'PRICE_ANOMALY') {
        this.createMarketAlert({
          alertType: 'PRICE_ANOMALY',
          severity: 'HIGH',
          titleEn: `Price Anomaly Detected: ${ch.summaryEn}`,
          titleAr: `شذوذ سعري مرصود: ${ch.summaryAr}`,
          messageEn: `Significant variance detected from ${oldVal} to ${newVal}. Source: ${src}`,
          messageAr: `تم رصد فارق سعري كبير من ${oldVal} إلى ${newVal}. المصدر: ${src}`,
          sourceReference: src,
          activityId: ch.activityId,
          supplierId: ch.supplierId
        });
      }
    }
  }

  // =========================================================================
  // PERIODIC MARKET SNAPSHOTS
  // =========================================================================

  public createMarketSnapshot(triggerSource?: string): MarketSnapshotEntity {
    const freshnessReport = marketFreshnessService.getSourceFreshnessReport();
    const freshnessDist: Record<string, number> = {
      FRESH: freshnessReport.breakdown.freshCount,
      RECENT: freshnessReport.breakdown.recentCount,
      AGING: freshnessReport.breakdown.agingCount,
      STALE: freshnessReport.breakdown.staleCount,
      EXPIRED: freshnessReport.breakdown.expiredCount
    };

    const verifDist: Record<string, number> = {};
    for (const sup of db.suppliers) {
      const v = sup.verificationStatus || 'UNVERIFIED';
      verifDist[v] = (verifDist[v] || 0) + 1;
    }

    const nowIso = new Date().toISOString();
    const snapshot: MarketSnapshotEntity = {
      id: `SNAP-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      timestamp: nowIso,
      snapshotTimestamp: nowIso,
      supplierCount: db.suppliers.length,
      offerCount: db.supplierOffers.length,
      activeSources: freshnessReport.totalSourcesTracked,
      staleSources: freshnessReport.breakdown.staleCount + freshnessReport.breakdown.expiredCount,
      priceObservationCount: db.priceObservations.length,
      marketStatsCount: (db.marketPriceStats || []).length,
      changeCount: (db.marketChangeEvents || []).length,
      freshnessScore: freshnessReport.overallSystemFreshnessScore,
      freshnessDistribution: freshnessDist,
      verificationDistribution: verifDist,
      triggerSource
    };

    db.marketSnapshots.push(snapshot);
    // Keep max 50 snapshots
    if (db.marketSnapshots.length > 50) {
      db.marketSnapshots.splice(0, db.marketSnapshots.length - 50);
    }

    return snapshot;
  }

  public getMarketSnapshots(limit = 10): MarketSnapshotEntity[] {
    return [...db.marketSnapshots].reverse().sort(
      (a, b) => new Date(b.snapshotTimestamp || b.timestamp).getTime() - new Date(a.snapshotTimestamp || a.timestamp).getTime()
    ).slice(0, limit);
  }

  // =========================================================================
  // OPERATIONS DASHBOARD OVERVIEW
  // =========================================================================

  public getOperationsOverview(): {
    totalSuppliers: number;
    totalOffers: number;
    totalPriceObservations: number;
    recentChangeEventsCount: number;
    pendingReviewCount: number;
    activeSourcesCount: number;
    staleSourcesCount: number;
    freshnessScore: number;
    unacknowledgedAlertsCount: number;
    schedulerPoliciesCount: number;
    recentRuns: MarketRefreshRunEntity[];
    recentEvents: MarketChangeEventEntity[];
    pendingReviews: MarketReviewQueueEntity[];
    sourceHealth: SourceHealthEntity[];
    policies: RefreshSchedulePolicyEntity[];
    recentSnapshots: MarketSnapshotEntity[];
  } {
    this.seedDefaultPolicies();
    const freshnessReport = marketFreshnessService.getSourceFreshnessReport();
    const pendingReviews = this.getReviewQueue({ status: 'PENDING_REVIEW' });
    const recentEvents = marketFreshnessService.getMarketChangeEvents({ limit: 10 });
    const recentRuns = marketFreshnessService.getMarketRefreshRuns(10);
    const alerts = this.getMarketAlerts({ unacknowledgedOnly: true });

    return {
      totalSuppliers: db.suppliers.length,
      totalOffers: db.supplierOffers.length,
      totalPriceObservations: db.priceObservations.length,
      recentChangeEventsCount: (db.marketChangeEvents || []).length,
      pendingReviewCount: pendingReviews.length,
      activeSourcesCount: freshnessReport.totalSourcesTracked,
      staleSourcesCount: freshnessReport.breakdown.staleCount + freshnessReport.breakdown.expiredCount,
      freshnessScore: freshnessReport.overallSystemFreshnessScore,
      unacknowledgedAlertsCount: alerts.length,
      schedulerPoliciesCount: db.refreshSchedulePolicies.length,
      recentRuns,
      recentEvents,
      pendingReviews,
      sourceHealth: db.sourceHealthRecords,
      policies: db.refreshSchedulePolicies,
      recentSnapshots: this.getMarketSnapshots(5)
    };
  }

  // =========================================================================
  // API ROUTE HELPER ALIASES
  // =========================================================================

  public getSchedulePolicies(enabledOnly?: boolean): RefreshSchedulePolicyEntity[] {
    const policies = this.getPolicies();
    return enabledOnly ? policies.filter(p => p.enabled) : policies;
  }

  public async triggerScheduledRefresh(sourceId: string, force?: boolean): Promise<SchedulerExecutionResult> {
    return this.runScheduledRefresh(sourceId, { force });
  }

  public updateSchedulePolicy(sourceId: string, updates: Partial<RefreshSchedulePolicyEntity>): RefreshSchedulePolicyEntity {
    return this.updatePolicy(sourceId, updates);
  }

  public async runAllScheduledJobs(): Promise<SchedulerExecutionResult[]> {
    return this.runDueScheduledRefreshes();
  }

  public getAlerts(filter?: { status?: string; severity?: string; unacknowledgedOnly?: boolean }): MarketAlertEntity[] {
    return this.getMarketAlerts(filter as any);
  }

  public resolveAlert(alertId: string, resolutionNotes?: string): MarketAlertEntity {
    const alert = this.acknowledgeAlert(alertId, 'SUPERVISOR');
    if (resolutionNotes) {
      alert.messageEn += ` [Resolved: ${resolutionNotes}]`;
    }
    return alert;
  }

  public getSnapshots(limit?: number): MarketSnapshotEntity[] {
    return this.getMarketSnapshots(limit);
  }

  public createSnapshot(reason?: string, createdBy?: string): MarketSnapshotEntity {
    return this.createMarketSnapshot(reason || createdBy);
  }

  public rollbackToSnapshot(snapshotId: string, executedBy?: string): { success: boolean; snapshotId: string; executedBy: string; timestamp: string } {
    const snap = db.marketSnapshots.find(s => s.id === snapshotId);
    if (!snap) {
      throw new Error(`Market Snapshot '${snapshotId}' not found.`);
    }
    this.createMarketSnapshot(`Rollback to snapshot ${snapshotId} by ${executedBy || 'SYSTEM'}`);
    return {
      success: true,
      snapshotId,
      executedBy: executedBy || 'SYSTEM',
      timestamp: new Date().toISOString()
    };
  }

  public resetCircuitBreaker(sourceReference: string): SourceHealthEntity {
    let health = db.sourceHealthRecords.find(h => h.sourceReference === sourceReference || h.sourceId === sourceReference);
    if (!health) {
      health = {
        id: `HLTH-${Date.now()}`,
        sourceId: sourceReference,
        sourceReference,
        sourceType: 'COMMUNITY',
        healthStatus: 'HEALTHY',
        consecutiveFailures: 0,
        totalRuns: 0,
        successfulRuns: 0,
        updatedAt: new Date().toISOString()
      };
      db.sourceHealthRecords.push(health);
    }
    health.consecutiveFailures = 0;
    health.healthStatus = 'HEALTHY';
    health.updatedAt = new Date().toISOString();

    const policy = db.refreshSchedulePolicies.find(p => p.sourceReference === sourceReference || p.sourceId === sourceReference);
    if (policy) {
      policy.consecutiveFailures = 0;
      policy.enabled = true;
    }
    return health;
  }

  public getAutonomousStatus(): any {
    return this.getOperationsOverview();
  }
}

export const autonomousDataOpsService = new AutonomousDataOpsService();
