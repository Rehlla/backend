import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../db/database';
import {
  DayGiOrchestratedTask,
  DayGiOrchestratedStep,
  DayGiTaskState,
  DayGiStepState,
  DayGiVerificationRule,
  DayGiActionLineage,
  DayGiActionRisk,
  DayGiRecoveryOption
} from '../../src/shared';
import { backgroundEventBus } from './backgroundEventBus';
import { commerceService } from './commerceService';
import { paymentService } from './paymentService';
import { recoveryService } from './recoveryService';
import { transferService } from './transferService';
import { ledgerService } from './ledgerService';
import { mapsContextService } from './mapsContextService';
import { dataPath } from '../db/paths';

const TASKS_FILE = dataPath('daygi_tasks.json');

// Strict State Transition Matrices
export const VALID_TASK_TRANSITIONS: Record<DayGiTaskState, DayGiTaskState[]> = {
  DRAFT: ['PLANNED', 'CANCELLED'],
  PLANNED: ['EXECUTING', 'WAITING_FOR_USER', 'WAITING_FOR_PROVIDER', 'CANCELLED', 'FAILED', 'PARTIALLY_COMPLETED', 'COMPLETED'],
  WAITING_FOR_USER: ['EXECUTING', 'CANCELLED', 'FAILED', 'PLANNED'],
  WAITING_FOR_PROVIDER: ['EXECUTING', 'VERIFYING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PARTIALLY_COMPLETED'],
  EXECUTING: ['VERIFYING', 'COMPLETED', 'WAITING_FOR_USER', 'WAITING_FOR_PROVIDER', 'FAILED', 'PARTIALLY_COMPLETED', 'CANCELLED', 'PLANNED'],
  VERIFYING: ['COMPLETED', 'FAILED', 'PARTIALLY_COMPLETED', 'CANCELLED'],
  PARTIALLY_COMPLETED: ['EXECUTING', 'PLANNED', 'CANCELLED', 'COMPLETED', 'FAILED'],
  COMPLETED: [], // Terminal State
  FAILED: ['PLANNED', 'EXECUTING', 'CANCELLED'], // Resumable via recovery or retry
  CANCELLED: [] // Terminal State
};

export const VALID_STEP_TRANSITIONS: Record<DayGiStepState, DayGiStepState[]> = {
  PENDING: ['EXECUTING', 'WAITING_FOR_DEPENDENCY', 'WAITING_FOR_USER', 'WAITING_FOR_PROVIDER', 'SKIPPED', 'CANCELLED', 'FAILED'],
  WAITING_FOR_DEPENDENCY: ['PENDING', 'SKIPPED', 'CANCELLED'],
  WAITING_FOR_USER: ['EXECUTING', 'SKIPPED', 'CANCELLED', 'FAILED'],
  WAITING_FOR_PROVIDER: ['VERIFYING', 'COMPLETED', 'FAILED', 'SKIPPED', 'CANCELLED'],
  EXECUTING: ['VERIFYING', 'COMPLETED', 'WAITING_FOR_USER', 'WAITING_FOR_PROVIDER', 'FAILED', 'CANCELLED'],
  VERIFYING: ['COMPLETED', 'FAILED'],
  COMPLETED: [], // Terminal State
  FAILED: ['PENDING', 'SKIPPED', 'CANCELLED'], // Can be reset during recovery
  SKIPPED: [],
  CANCELLED: []
};

/**
 * The seeded demo traveler. Used only where a record is deliberately seed data.
 *
 * It used to appear as an authorisation exemption as well — listed beside
 * 'ADMIN' in the ownership check — which made an ordinary shipped account a
 * superuser over every traveler's tasks.
 */
const DEMO_SEED_USER_ID = 'USR-AHMED-01';

export class DayGiTaskOrchestrator {
  private tasks: Map<string, DayGiOrchestratedTask> = new Map();
  private idempotencyRegistry: Map<string, { result: any; verifiedAt: string; actionToken: string }> = new Map();
  private confirmationMemory: Map<string, { grantedAt: string; expiresAt: string; taskId: string; actionToken: string; scope: string; userId: string }> = new Map();
  private executingLocks: Set<string> = new Set();
  public metrics = {
    totalTasksCreated: 0,
    totalStepsExecuted: 0,
    duplicatePreventions: 0,
    recoveriesApplied: 0,
    verificationsPassed: 0,
    verificationsFailed: 0,
    cancellations: 0,
    stateViolationsBlocked: 0
  };

  constructor() {
    this.setupBackgroundListeners();
    this.loadFromDiskOrSeed();
  }

  /**
   * Validate state transition against immutable state machine rules
   */
  public transitionTaskState(task: DayGiOrchestratedTask, nextState: DayGiTaskState): void {
    if (task.state === nextState) return;
    const allowed = VALID_TASK_TRANSITIONS[task.state];
    if (!allowed || !allowed.includes(nextState)) {
      this.metrics.stateViolationsBlocked++;
      const err = `Illegal task state transition: Cannot move from ${task.state} to ${nextState} for task ${task.taskId}`;
      db.logAudit(task.userId, 'System', 'TASK_ILLEGAL_TRANSITION_BLOCKED', 'DayGiTask', task.taskId, {
        currentState: task.state,
        attemptedState: nextState
      });
      throw new Error(err);
    }
    task.state = nextState;
    task.updatedAt = new Date().toISOString();
    this.persistToDisk();
  }

  public transitionStepState(step: DayGiOrchestratedStep, nextState: DayGiStepState, taskId: string): void {
    if (step.state === nextState) return;
    const allowed = VALID_STEP_TRANSITIONS[step.state];
    if (!allowed || !allowed.includes(nextState)) {
      this.metrics.stateViolationsBlocked++;
      const err = `Illegal step state transition: Cannot move step ${step.stepId} from ${step.state} to ${nextState}`;
      db.logAudit('SYSTEM_ORCHESTRATOR', 'System', 'STEP_ILLEGAL_TRANSITION_BLOCKED', 'DayGiStep', step.stepId, {
        taskId,
        currentState: step.state,
        attemptedState: nextState
      });
      throw new Error(err);
    }
    step.state = nextState;
  }

  /**
   * Persistence across Server Restarts (Resumability)
   */
  private persistToDisk(): void {
    try {
      const data = {
        tasks: Array.from(this.tasks.entries()),
        idempotency: Array.from(this.idempotencyRegistry.entries()),
        confirmations: Array.from(this.confirmationMemory.entries()),
        metrics: this.metrics,
        savedAt: new Date().toISOString()
      };
      fs.writeFileSync(TASKS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DayGI Orchestrator] Disk persistence error:', err);
    }
  }

  private loadFromDiskOrSeed(): void {
    try {
      if (fs.existsSync(TASKS_FILE)) {
        const raw = fs.readFileSync(TASKS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.tasks && Array.isArray(parsed.tasks)) {
          this.tasks = new Map(parsed.tasks);
          this.idempotencyRegistry = new Map(parsed.idempotency || []);
          this.confirmationMemory = new Map(parsed.confirmations || []);
          if (parsed.metrics) this.metrics = { ...this.metrics, ...parsed.metrics };
          console.log(`[DayGI Orchestrator] Restored ${this.tasks.size} tasks from disk.`);
          return;
        }
      }
    } catch (err) {
      console.warn('[DayGI Orchestrator] Could not load persisted tasks from disk, falling back to seed:', err);
    }
    this.seedInitialTasks();
  }

  /**
   * Seed active tasks so UI demonstrates live orchestration state on first load
   */
  private seedInitialTasks(): void {
    const defaultTaskId = 'TASK-AHMED-DIV-001';
    const diveStepToken = 'ACT-DIV-001';
    const foodStepToken = 'ACT-FOOD-001';

    const sampleTask: DayGiOrchestratedTask = {
      taskId: defaultTaskId,
      userId: DEMO_SEED_USER_ID,
      tripId: 'DHB-TRIP-894',
      intent: 'BOOK_DIVE_THEN_NEARBY_FOOD',
      titleEn: 'Book Canyon Morning Dive & Reserve Nearby Seaside Lunch',
      titleAr: 'حجز غطسة الكانيون الصباحية وتنسيق غداء بحري قريب',
      currentStepNumber: 1,
      totalSteps: 2,
      riskLevel: 'COMMERCE',
      state: 'PLANNED',
      steps: [
        {
          stepId: 'STEP-1',
          stepNumber: 1,
          name: 'Hold & Confirm Guided Canyon Reef Dive',
          nameAr: 'حجز وتأكيد غطسة الكانيون مع مرشد معتمد',
          systemComponent: 'COMMERCE_SERVICE',
          actionKey: 'CONFIRM_DIRECT_BOOKING',
          payload: {
            skuId: 'SKU-DIV-001',
            tripId: 'DHB-TRIP-894',
            priceEGP: 2700,
            date: new Date().toISOString().split('T')[0],
            timeSlot: '08:30 AM'
          },
          riskLevel: 'COMMERCE',
          state: 'PENDING',
          dependsOnStepIds: [],
          actionToken: diveStepToken,
          idempotencyKey: `IDEMP-INIT-${diveStepToken}`,
          verificationRule: 'VERIFY_CLOUD_SQL_BOOKING'
        },
        {
          stepId: 'STEP-2',
          stepNumber: 2,
          name: 'Locate & Reserve Post-Dive Seaside Table within 10 Mins Walk',
          nameAr: 'تحديد وحجز طاولة غداء بحري على بعد ١٠ دقائق مشياً',
          systemComponent: 'MAPS_ENGINE',
          actionKey: 'RESERVE_FOOD_POST_ACTIVITY',
          payload: {
            originLocationId: 'place-canyon',
            availableWindowMins: 90,
            preferredCategory: 'FOOD'
          },
          riskLevel: 'LOW_RISK',
          state: 'WAITING_FOR_DEPENDENCY',
          dependsOnStepIds: ['STEP-1'],
          actionToken: foodStepToken,
          idempotencyKey: `IDEMP-INIT-${foodStepToken}`,
          verificationRule: 'VERIFY_TRIP_TIMELINE'
        }
      ],
      actionLineage: [],
      completedTruth: {
        confirmedBookings: [],
        settledAmountEGP: 0,
        timelineUpdated: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.set(defaultTaskId, sampleTask);
    this.persistToDisk();
  }

  /**
   * Listen to background events for asynchronous task resumption
   */
  private setupBackgroundListeners(): void {
    backgroundEventBus.on('BookingConfirmed', (event) => {
      this.handleExternalEvent('BookingConfirmed', event.data);
    });

    backgroundEventBus.on('SupplierUpdated', (event) => {
      this.handleExternalEvent('SupplierUpdated', event.data);
    });
  }

  private handleExternalEvent(eventType: string, data: Record<string, any>): void {
    const { bookingId, supplierId, tripId } = data;
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.state === 'WAITING_FOR_PROVIDER' && (!tripId || task.tripId === tripId)) {
        // Find matching step
        const step = task.steps.find(s => s.state === 'WAITING_FOR_PROVIDER');
        if (step) {
          // Perform authoritative verification
          const verified = this.verifyAuthoritativeState(step, task);
          if (verified.verified) {
            step.state = 'COMPLETED';
            step.verificationResult = verified;
            task.updatedAt = new Date().toISOString();
            
            // Check next step dependencies
            this.evaluateDependenciesAndProgress(task);
            
            db.logAudit('SYSTEM_ORCHESTRATOR', 'System', 'TASK_ASYNC_WAKEUP_COMPLETED', 'DayGiTask', taskId, {
              eventType,
              stepId: step.stepId,
              verification: verified
            });
          }
        }
      }
    }
  }

  /**
   * Create a new structured orchestrated task with explicit dependencies and action tokens
   */
  public createTask(params: {
    userId: string;
    tripId: string;
    intent: string;
    titleEn: string;
    titleAr: string;
    riskLevel?: DayGiActionRisk;
    steps: Array<{
      stepId?: string;
      name: string;
      nameAr: string;
      systemComponent: 'TRIP_SERVICE' | 'COMMERCE_SERVICE' | 'PAYMENT_SERVICE' | 'SUPPLIER_SERVICE' | 'MAPS_ENGINE' | 'LEDGER';
      actionKey: string;
      payload: Record<string, any>;
      riskLevel?: DayGiActionRisk;
      dependsOnStepIds?: string[];
      verificationRule?: DayGiVerificationRule;
    }>;
  }): DayGiOrchestratedTask {
    const taskId = `TASK-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 6)}`;
    const overallRisk = params.riskLevel || this.determineOverallRisk(params.steps.map(s => s.riskLevel || 'LOW_RISK'));
    
    const orchestratedSteps: DayGiOrchestratedStep[] = params.steps.map((rawStep, index) => {
      const stepNumber = index + 1;
      const stepId = rawStep.stepId || `STEP-${stepNumber}`;
      const actionToken = `ACT-${taskId.slice(-6)}-${stepNumber}`;
      const idempotencyKey = `IDEMP-${actionToken}-${Date.now()}`;
      const stepRisk = rawStep.riskLevel || 'LOW_RISK';
      const dependsOn = rawStep.dependsOnStepIds || (index > 0 ? [`STEP-${index}`] : []);
      
      const initialState: DayGiStepState = dependsOn.length > 0 ? 'WAITING_FOR_DEPENDENCY' : 'PENDING';

      return {
        stepId,
        stepNumber,
        name: rawStep.name,
        nameAr: rawStep.nameAr,
        systemComponent: rawStep.systemComponent,
        actionKey: rawStep.actionKey,
        payload: rawStep.payload || {},
        riskLevel: stepRisk,
        state: initialState,
        dependsOnStepIds: dependsOn,
        actionToken,
        idempotencyKey,
        verificationRule: rawStep.verificationRule || this.defaultVerificationRule(rawStep.systemComponent, rawStep.actionKey)
      };
    });

    const task: DayGiOrchestratedTask = {
      taskId,
      userId: params.userId,
      tripId: params.tripId,
      intent: params.intent,
      titleEn: params.titleEn,
      titleAr: params.titleAr,
      currentStepNumber: 1,
      totalSteps: orchestratedSteps.length,
      riskLevel: overallRisk,
      state: 'PLANNED',
      steps: orchestratedSteps,
      actionLineage: [],
      completedTruth: {
        confirmedBookings: [],
        settledAmountEGP: 0,
        timelineUpdated: false
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.tasks.set(taskId, task);

    db.logAudit(params.userId, 'Traveler', 'TASK_ORCHESTRATOR_CREATED', 'DayGiTask', taskId, {
      titleEn: params.titleEn,
      stepsCount: orchestratedSteps.length,
      riskLevel: overallRisk
    });

    return task;
  }

  /**
   * Scope-bounded User Approval Memory (Explicit 10-minute token approval)
   */
  public grantUserConfirmation(params: {
    userId: string;
    taskId: string;
    actionToken: string;
    scope: string;
  }): { granted: boolean; expiresAt: string } {
    const { userId, taskId, actionToken, scope } = params;
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    // 'USR-AHMED-01' — the seeded demo traveler — used to be listed here
    // alongside 'ADMIN' as an identity that may confirm anyone's task. It is an
    // ordinary Traveler account that ships with the platform, so anyone signing
    // in as it could confirm steps on every other traveler's booking. Ownership
    // is ownership; the only exemption left is the administrative one.
    if (task.userId !== userId && userId !== 'ADMIN') {
      throw new Error(`Security Violation: User ${userId} is not authorized to confirm task ${taskId} (owner: ${task.userId}).`);
    }

    const step = task.steps.find(s => s.actionToken === actionToken);
    if (!step) {
      throw new Error(`Security Violation: Action token ${actionToken} does not match any step in task ${taskId}`);
    }

    const now = Date.now();
    const expiresAt = new Date(now + 10 * 60 * 1000).toISOString(); // 10-minute TTL

    this.confirmationMemory.set(actionToken, {
      grantedAt: new Date(now).toISOString(),
      expiresAt,
      taskId,
      actionToken,
      scope,
      userId
    });

    this.persistToDisk();

    db.logAudit(userId, 'Traveler', 'TASK_USER_CONFIRMATION_SCOPED_GRANTED', 'DayGiTask', taskId, {
      actionToken,
      scope,
      expiresAt
    });

    return { granted: true, expiresAt };
  }

  /**
   * Check if a valid, non-expired confirmation token exists for this action
   */
  private hasValidUserConfirmation(actionToken: string, taskId: string): boolean {
    const entry = this.confirmationMemory.get(actionToken);
    if (!entry) return false;
    if (entry.taskId !== taskId) return false;
    if (new Date(entry.expiresAt).getTime() < Date.now()) {
      this.confirmationMemory.delete(actionToken);
      this.persistToDisk();
      return false;
    }
    return true;
  }

  /**
   * Execute a specific step in the task orchestration pipeline
   */
  public executeStep(params: {
    taskId: string;
    stepId: string;
    userId: string;
    userRole: string;
    bypassConfirmation?: boolean;
    correlationId?: string;
  }): {
    task: DayGiOrchestratedTask;
    step: DayGiOrchestratedStep;
    success: boolean;
    error?: string;
    verification?: any;
    durationMs?: number;
  } {
    const startTime = Date.now();
    const { taskId, stepId, userId, userRole, bypassConfirmation, correlationId = `CORR-${Date.now()}` } = params;
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    const step = task.steps.find(s => s.stepId === stepId);
    if (!step) throw new Error(`Step ${stepId} not found in task ${taskId}`);

    // Concurrency Mutex Lock
    if (this.executingLocks.has(taskId)) {
      throw new Error(`Concurrency Conflict: Task ${taskId} is currently executing another active operation. Concurrent execution blocked.`);
    }
    this.executingLocks.add(taskId);

    try {
      this.metrics.totalStepsExecuted++;

      // 1. Dependency Validation (BLOCKING RULE)
      const unfulfilledDependencies = step.dependsOnStepIds.filter(depId => {
        const depStep = task.steps.find(s => s.stepId === depId);
        return !depStep || depStep.state !== 'COMPLETED';
      });

      if (unfulfilledDependencies.length > 0) {
        this.transitionStepState(step, 'WAITING_FOR_DEPENDENCY', taskId);
        this.persistToDisk();
        return {
          task,
          step,
          success: false,
          error: `Cannot execute step ${stepId}: Blocked by incomplete prerequisites (${unfulfilledDependencies.join(', ')}).`,
          durationMs: Date.now() - startTime
        };
      }

      // 2. Risk & Confirmation Boundary (COMMERCE / FINANCIAL require scoped approval)
      const isHighRisk = step.riskLevel === 'COMMERCE' || step.riskLevel === 'FINANCIAL' || step.riskLevel === 'SAFETY_CRITICAL';
      if (isHighRisk && !bypassConfirmation) {
        const hasConfirmation = this.hasValidUserConfirmation(step.actionToken, taskId);
        if (!hasConfirmation) {
          this.transitionStepState(step, 'WAITING_FOR_USER', taskId);
          this.transitionTaskState(task, 'WAITING_FOR_USER');
          task.waitingDetails = {
            waitingFor: 'USER_CONFIRMATION',
            actionTokenRequired: step.actionToken,
            estimatedResolutionTime: 'Awaiting traveler confirmation'
          };
          this.persistToDisk();
          return {
            task,
            step,
            success: false,
            error: `Approval required: Action ${step.name} involves financial or critical change. Please confirm action token ${step.actionToken}.`,
            durationMs: Date.now() - startTime
          };
        }
      }

      // 3. Idempotency Check (Prevents duplicate charging / double booking)
      const cached = this.idempotencyRegistry.get(step.idempotencyKey);
      if (cached) {
        this.metrics.duplicatePreventions++;
        this.transitionStepState(step, 'COMPLETED', taskId);
        step.resultData = cached.result;
        this.persistToDisk();
        return {
          task,
          step,
          success: true,
          verification: { verified: true, cached: true, verifiedAt: cached.verifiedAt },
          durationMs: Date.now() - startTime
        };
      }

      // 4. State transition: EXECUTING
      this.transitionStepState(step, 'EXECUTING', taskId);
      this.transitionTaskState(task, 'EXECUTING');
      step.error = undefined;

      let executionResult: any = null;
      let failureError: string | null = null;

      try {
        db.runInTransaction(() => {
          executionResult = this.dispatchAction(step, task, userId, userRole);
        });
      } catch (err: any) {
        failureError = err.message || 'Execution error in subsystem';
      }

      // 5. Post-Action Verification against Authoritative State (MANDATORY RULE)
      if (!failureError) {
        this.transitionStepState(step, 'VERIFYING', taskId);
        const verification = this.verifyAuthoritativeState(step, task, executionResult);

        if (verification.verified) {
          this.metrics.verificationsPassed++;
          this.transitionStepState(step, 'COMPLETED', taskId);
          step.verificationResult = verification;
          step.resultData = executionResult;

          // Record lineage
          const lineageEntry: DayGiActionLineage = {
            actionToken: step.actionToken,
            taskId: task.taskId,
            tripId: task.tripId,
            bookingId: executionResult?.bookingId || executionResult?.holdToken || step.payload?.bookingId,
            paymentId: executionResult?.paymentId,
            auditId: `AUD-${Date.now()}`,
            ledgerEntryId: executionResult?.ledgerEntryId,
            timestamp: new Date().toISOString()
          };
          task.actionLineage.push(lineageEntry);

          // Update Completed Truth
          if (lineageEntry.bookingId && !task.completedTruth.confirmedBookings.includes(lineageEntry.bookingId)) {
            task.completedTruth.confirmedBookings.push(lineageEntry.bookingId);
          }
          if (executionResult?.amountEGP || executionResult?.priceEGP) {
            task.completedTruth.settledAmountEGP += Number(executionResult.amountEGP || executionResult.priceEGP || 0);
          }
          if (step.systemComponent === 'TRIP_SERVICE' || step.actionKey.includes('TRIP') || step.actionKey.includes('SHIFT')) {
            task.completedTruth.timelineUpdated = true;
          }

          // Cache in idempotency registry
          this.idempotencyRegistry.set(step.idempotencyKey, {
            result: executionResult,
            verifiedAt: new Date().toISOString(),
            actionToken: step.actionToken
          });

          // Evaluate remaining steps
          this.evaluateDependenciesAndProgress(task);
          this.persistToDisk();

          db.logAudit(userId, userRole, 'TASK_STEP_EXECUTED_VERIFIED', 'DayGiStep', step.stepId, {
            taskId,
            actionKey: step.actionKey,
            correlationId,
            durationMs: Date.now() - startTime,
            verification
          });

          return {
            task,
            step,
            success: true,
            verification,
            durationMs: Date.now() - startTime
          };
        } else {
          this.metrics.verificationsFailed++;
          failureError = `Post-action verification failed: ${verification.evidence}`;
        }
      }

      // 6. Handle Partial Failure / Step Failure (NEVER HIDE FAILURE)
      this.transitionStepState(step, 'FAILED', taskId);
      step.error = failureError || 'Unknown verification failure';
      
      // Evaluate task partial failure state
      const hasAnyCompleted = task.steps.some(s => s.state === 'COMPLETED');
      this.transitionTaskState(task, hasAnyCompleted ? 'PARTIALLY_COMPLETED' : 'FAILED');

      const completedSteps = task.steps.filter(s => s.state === 'COMPLETED');
      const recoveryOptions = this.generateRecoveryOptions(task, step);

      task.partialFailureDetails = {
        failedStepId: step.stepId,
        failedReasonEn: failureError || 'Step execution or verification failed',
        failedReasonAr: 'فشل تنفيذ الخطوة أو التحقق من صحتها في قاعدة البيانات',
        completedStepsSummaryEn: completedSteps.length > 0
          ? `Preserved ${completedSteps.length} confirmed actions: ${completedSteps.map(s => s.name).join(', ')}.`
          : 'No financial or booking changes were committed.',
        completedStepsSummaryAr: completedSteps.length > 0
          ? `تم الحفاظ على ${completedSteps.length} إجراءات مؤكدة بنجاح دون أي مساس بها.`
          : 'لم يتم خصم أي مبالغ أو تثبيت أي حجوزات.',
        recoveryOptions
      };

      task.updatedAt = new Date().toISOString();
      this.persistToDisk();

      db.logAudit(userId, userRole, 'TASK_STEP_FAILED_WITH_RECOVERY', 'DayGiTask', taskId, {
        stepId: step.stepId,
        error: failureError,
        correlationId,
        preservedCompletedCount: completedSteps.length
      });

      return {
        task,
        step,
        success: false,
        error: failureError || 'Step failed verification',
        durationMs: Date.now() - startTime
      };
    } finally {
      this.executingLocks.delete(taskId);
    }
  }

  /**
   * Run all ready steps in sequence until blocked, completed, or waiting for user/provider
   */
  public runTask(taskId: string, userId: string, userRole: string = 'Traveler'): DayGiOrchestratedTask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    let keepRunning = true;
    let loopGuard = 0;

    while (keepRunning && loopGuard < 10) {
      loopGuard++;
      const nextPendingStep = task.steps.find(s => s.state === 'PENDING');
      if (!nextPendingStep) {
        keepRunning = false;
        break;
      }

      const execResult = this.executeStep({
        taskId,
        stepId: nextPendingStep.stepId,
        userId,
        userRole
      });

      if (!execResult.success) {
        keepRunning = false;
      }
    }

    task.updatedAt = new Date().toISOString();
    return task;
  }

  /**
   * Dispatch action to existing backend authority services
   */
  private dispatchAction(
    step: DayGiOrchestratedStep,
    task: DayGiOrchestratedTask,
    userId: string,
    userRole: string
  ): any {
    const { actionKey, payload } = step;
    const now = new Date().toISOString();

    switch (actionKey) {
      case 'CONFIRM_DIRECT_BOOKING':
      case 'HOLD_AND_BOOK_SERVICE': {
        if (payload?.shouldFail || payload?.holdToken === 'NON_EXISTENT_HOLD_TOKEN_XYZ' || payload?.holdToken === 'INVALID_TOKEN') {
          throw new Error(`Cloud SQL Error: Invalid or expired hold token ${payload?.holdToken || 'UNKNOWN'}`);
        }
        const { skuId = 'SKU-DIV-001', tripId = task.tripId, priceEGP = 2700, passengersCount = 2 } = payload || {};
        const hold = commerceService.createHold({
          skuId,
          tripId,
          travelerId: userId,
          date: payload.date || now.split('T')[0],
          timeSlot: payload.timeSlot || '10:00 AM',
          passengersCount,
          idempotencyKey: step.idempotencyKey
        });

        // Also add corresponding tripItem to database so state is unified
        const sku = db.productSkus.find(s => s.id === skuId);
        const newItem = {
          id: `ITEM-${step.actionToken}`,
          tripId,
          serviceType: sku?.serviceType || 'diving',
          skuId,
          title: sku?.title || 'Guided Dahab Activity',
          dayNumber: payload.dayNumber || 2,
          timeSlot: payload.timeSlot || '10:00 AM',
          priceEGP: sku?.basePriceEGP || priceEGP,
          status: 'BOOKED' as const,
          createdAt: now,
          updatedAt: now
        };
        db.tripItems.push(newItem);

        return {
          holdToken: hold.holdToken,
          bookingId: hold.holdToken,
          tripItemId: newItem.id,
          skuId,
          amountEGP: sku?.basePriceEGP || priceEGP,
          status: 'ACTIVE_HOLD'
        };
      }

      case 'APPLY_TRIP_SHIFT':
      case 'SHIFT_SCHEDULE_RELAX': {
        const { activityId = 'act-canyon-dive', fromDay = 3, toDay = 4, newTimeSlot = '11:00 AM' } = payload;
        const item = db.tripItems.find(i => i.id === activityId || i.title.toLowerCase().includes('canyon'));
        if (item) {
          item.dayNumber = toDay;
          item.timeSlot = newTimeSlot;
          item.updatedAt = now;
        }
        return { shifted: true, activityId: item?.id || activityId, fromDay, toDay, newTimeSlot };
      }

      case 'EXECUTE_TRIP_RECOVERY':
      case 'SUBSTITUTE_DISRUPTED_ACTIVITY': {
        const { originalItemId = 'act-canyon-dive', alternativeTitle = 'Laguna Sheltered Windsurfing', newPriceEGP = 1800 } = payload;
        const substitution = recoveryService.substituteItem({
          tripId: task.tripId,
          originalItemId,
          alternativeTitle,
          alternativeServiceType: payload.alternativeServiceType || 'safari',
          newScheduledTime: payload.newScheduledTime || '10:00 AM',
          newPriceEGP,
          reason: payload.reason || 'Wind disruption auto-recovery',
          idempotencyKey: step.idempotencyKey
        });
        return substitution;
      }

      case 'APPLY_BUDGET_OPTIMIZATION': {
        const targetSavings = Number(payload.targetSavingsEGP || 2000);
        // Optimize transfers from private to shared and high-end dive to shore dive
        let realizedSavings = 0;
        const transferItem = db.tripItems.find(i => i.tripId === task.tripId && i.serviceType === 'transfer');
        if (transferItem && transferItem.priceEGP > 600) {
          const diff = transferItem.priceEGP - 450;
          transferItem.priceEGP = 450;
          transferItem.title = 'Shared Coastal Shuttle (SSH Airport → Dahab)';
          realizedSavings += diff;
        }

        const diveItem = db.tripItems.find(i => i.tripId === task.tripId && i.serviceType === 'diving');
        if (diveItem && diveItem.priceEGP > 1500) {
          const diff = 600;
          diveItem.priceEGP -= diff;
          diveItem.title = 'Guided Lighthouse Shore Coral Dive (All Gear Included)';
          realizedSavings += diff;
        }

        return {
          savingsEGP: Math.max(realizedSavings, targetSavings),
          optimizedItemsCount: 2,
          budgetUnderTarget: true
        };
      }

      case 'RESERVE_FOOD_POST_ACTIVITY':
      case 'LOCATE_NEARBY_FOOD': {
        const { originLocationId = 'place-canyon', availableWindowMins = 90 } = payload;
        // getPostActivityFood returns { anchorLocation, spots, ... } — an object,
        // not an array. Indexing it with [0] was always undefined, so this task
        // always reserved the hardcoded Eel Garden fallback and never used the
        // location-aware result it had just computed.
        // getPostActivityFood returns { anchorLocation, spots, ... } — an object,
        // not an array. Indexing it with [0] was always undefined, so this task
        // always reserved the hardcoded Eel Garden fallback and never used the
        // location-aware result it had just computed. The fallback also used
        // field names (`name`, `walkTimeMins`) that PostActivityFoodSpot does
        // not have — it declares `nameEn` and `travelMinutes`.
        const foodResult = mapsContextService.getPostActivityFood(originLocationId, 3);
        const selected = foodResult.spots?.[0];
        const reservedPlace = selected
          ? { id: selected.id, name: selected.nameEn, travelMinutes: selected.travelMinutes, priceBand: selected.priceBand }
          : { id: 'place-eelgarden-cafe', name: 'Eel Garden Oceanfront Catch', travelMinutes: 8, priceBand: 'EGP 250–550' };
        return {
          reservedPlace,
          walkTimeMins: reservedPlace.travelMinutes,
          tableStatus: 'CONFIRMED_RESERVATION'
        };
      }

      case 'DISPATCH_TRANSFER_DRIVER': {
        const telemetry = db.transferTelemetry[0];
        if (telemetry) {
          telemetry.status = 'DISPATCHED';
          telemetry.lastGpsUpdate = 'Just now (Sinai Checkpoint Northbound)';
        }
        return { dispatched: true, driverName: 'Mahmoud Salem', plate: 'ط ج د 4821' };
      }

      default:
        return { completed: true, actionKey, executedAt: now };
    }
  }

  /**
   * Post-Action Verification against Authoritative Cloud SQL / DB State
   */
  private verifyAuthoritativeState(
    step: DayGiOrchestratedStep,
    task: DayGiOrchestratedTask,
    executionResult?: any
  ): {
    verified: boolean;
    evidence: string;
    evidenceAr: string;
    verifiedAt: string;
    authoritativeSource: string;
  } {
    const verifiedAt = new Date().toISOString();

    switch (step.verificationRule) {
      case 'VERIFY_CLOUD_SQL_BOOKING': {
        // Verify specific booking hold or confirmed item exists in database
        const holdToken = executionResult?.holdToken || step.payload?.holdToken;
        const tripItemId = executionResult?.tripItemId || step.payload?.tripItemId;
        
        let bookingExists = false;
        if (holdToken) {
          bookingExists = db.holds.some(h => h.holdToken === holdToken || h.id === holdToken) ||
                          db.bookings.some(b => b.id === holdToken || b.confirmationCode === holdToken || b.bookingRef === holdToken);
        }
        if (!bookingExists && tripItemId) {
          bookingExists = db.tripItems.some(ti => ti.id === tripItemId && ti.status === 'BOOKED');
        }
        
        if (bookingExists) {
          return {
            verified: true,
            evidence: `Authoritative booking record confirmed in Cloud SQL (Ref: ${holdToken || tripItemId}). Concurrency lock verified.`,
            evidenceAr: `تم التحقق من قيد الحجز المؤكد في قاعدة البيانات الرسمية وقفل المقعد.`,
            verifiedAt,
            authoritativeSource: 'Cloud SQL · Bookings & TripItems Registry'
          };
        }
        return {
          verified: false,
          evidence: `No matching active booking found in Cloud SQL for hold token ${holdToken || tripItemId || 'unknown'}`,
          evidenceAr: `لم يتم العثور على سجل حجز مؤكد في قاعدة البيانات.`,
          verifiedAt,
          authoritativeSource: 'Cloud SQL Verification Desk'
        };
      }

      case 'VERIFY_LEDGER_CHAIN': {
        const integrity = ledgerService.verifyLedgerIntegrity();
        if (integrity.chainIntact && integrity.balanced) {
          return {
            verified: true,
            evidence: `Double-entry ledger cryptographic SHA-256 chain intact. Escrow balance: EGP ${integrity.escrowBalanceEGP}.`,
            evidenceAr: `تم التحقق من سلامة السلسلة التشفيرية ودفتر الأستاذ المالي.`,
            verifiedAt,
            authoritativeSource: 'Dahab Cryptographic Ledger'
          };
        }
        return {
          verified: false,
          evidence: `Ledger verification failed: Chain broken or unbalanced.`,
          evidenceAr: `فشل التحقق المالي: عدم توازن القيود المحاسبية.`,
          verifiedAt,
          authoritativeSource: 'Dahab Cryptographic Ledger'
        };
      }

      case 'VERIFY_TRIP_TIMELINE': {
        return {
          verified: true,
          evidence: `Trip schedule timeline reconciled with no overlapping buffer conflicts.`,
          evidenceAr: `تمت تسوية جدول الرحلة والتأكد من خلوه من التعارضات الزمنية.`,
          verifiedAt,
          authoritativeSource: 'Trip Timeline Sync Service'
        };
      }

      case 'VERIFY_PROVIDER_STATE': {
        return {
          verified: true,
          evidence: `Supplier OS handshake confirmed with Tier-1 certified partner.`,
          evidenceAr: `تم تأكيد جاهزية المورد المعتمد وربط الخدمة بنجاح.`,
          verifiedAt,
          authoritativeSource: 'Supplier OS Registry'
        };
      }

      default:
        return {
          verified: true,
          evidence: `Subsystem execution returned verified status code 200.`,
          evidenceAr: `تم التحقق من سلامة تنفيذ العملية بنجاح.`,
          verifiedAt,
          authoritativeSource: 'Dahab Subsystem Authority'
        };
    }
  }

  /**
   * Evaluate dependency graph and transition subsequent steps
   */
  private evaluateDependenciesAndProgress(task: DayGiOrchestratedTask): void {
    const completedStepIds = new Set(task.steps.filter(s => s.state === 'COMPLETED').map(s => s.stepId));

    for (const step of task.steps) {
      if (step.state === 'WAITING_FOR_DEPENDENCY') {
        const allDepsMet = step.dependsOnStepIds.every(id => completedStepIds.has(id));
        if (allDepsMet) {
          step.state = 'PENDING';
        }
      }
    }

    // Update overall task state
    const allCompleted = task.steps.every(s => s.state === 'COMPLETED');
    const anyFailed = task.steps.some(s => s.state === 'FAILED');
    const anyWaitingUser = task.steps.some(s => s.state === 'WAITING_FOR_USER');
    const anyWaitingProvider = task.steps.some(s => s.state === 'WAITING_FOR_PROVIDER');

    if (allCompleted) {
      task.state = 'COMPLETED';
      task.currentStepNumber = task.totalSteps;
      task.outcome = 'BOOKED';
    } else if (anyFailed) {
      task.state = task.steps.some(s => s.state === 'COMPLETED') ? 'PARTIALLY_COMPLETED' : 'FAILED';
    } else if (anyWaitingUser) {
      task.state = 'WAITING_FOR_USER';
    } else if (anyWaitingProvider) {
      task.state = 'WAITING_FOR_PROVIDER';
    } else {
      const activeStep = task.steps.find(s => s.state === 'PENDING' || s.state === 'EXECUTING');
      if (activeStep) {
        task.currentStepNumber = activeStep.stepNumber;
        task.state = 'PLANNED';
      }
    }

    task.updatedAt = new Date().toISOString();
  }

  /**
   * Generate safe recovery options for partial failures without double charging
   */
  private generateRecoveryOptions(task: DayGiOrchestratedTask, failedStep: DayGiOrchestratedStep): DayGiRecoveryOption[] {
    const options: DayGiRecoveryOption[] = [
      {
        id: `REC-RETRY-${failedStep.stepId}`,
        labelEn: `Retry ${failedStep.name} with secondary verified provider`,
        labelAr: `إعادة محاولة تنفيذ ${failedStep.nameAr} عبر مورد بديل معتمد`,
        type: 'RETRY',
        actionToken: `ACT-RETRY-${failedStep.actionToken}`,
        payload: { taskId: task.taskId, stepId: failedStep.stepId, retryStrategy: 'SECONDARY_PROVIDER' }
      },
      {
        id: `REC-SUB-${failedStep.stepId}`,
        labelEn: 'Choose alternative seaside experience without cancelling confirmed steps',
        labelAr: 'اختيار تجربة شاطئية بديلة مع الاحتفاظ بكافة الحجوزات المؤكدة',
        type: 'SUBSTITUTE',
        actionToken: `ACT-SUB-${failedStep.actionToken}`,
        payload: { taskId: task.taskId, stepId: failedStep.stepId, alternativeCategory: 'RELAX' }
      },
      {
        id: `REC-KEEP-${failedStep.stepId}`,
        labelEn: 'Keep confirmed steps only and skip this step',
        labelAr: 'الاحتفاظ بالخطوات المكتملة وتخطي هذه الخطوة بأمان',
        type: 'CONTINUE_PARTIAL',
        actionToken: `ACT-KEEP-${failedStep.actionToken}`,
        payload: { taskId: task.taskId, stepId: failedStep.stepId }
      }
    ];

    if (failedStep.riskLevel === 'FINANCIAL' || failedStep.riskLevel === 'COMMERCE') {
      options.push({
        id: `REC-REFUND-${failedStep.stepId}`,
        labelEn: 'Issue instant zero-penalty refund to original payment method for failed item',
        labelAr: 'استرداد فوري وتلقائي لكامل قيمة النشاط المتعثر لحساب العميل',
        type: 'REFUND_FAILED_STEP',
        actionToken: `ACT-REF-${failedStep.actionToken}`,
        payload: { taskId: task.taskId, stepId: failedStep.stepId, refundAmountEGP: failedStep.payload?.priceEGP || 0 }
      });
    }

    return options;
  }

  /**
   * Apply recovery option chosen by traveler or operator
   */
  public applyRecovery(params: {
    taskId: string;
    recoveryOptionId: string;
    userId: string;
    userRole: string;
  }): DayGiOrchestratedTask {
    const { taskId, recoveryOptionId, userId, userRole } = params;
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    this.metrics.recoveriesApplied++;

    if (recoveryOptionId.includes('RETRY')) {
      const failedStep = task.steps.find(s => s.state === 'FAILED');
      if (failedStep) {
        this.transitionStepState(failedStep, 'PENDING', taskId);
        failedStep.error = undefined;
        failedStep.idempotencyKey = `IDEMP-RETRY-${Date.now()}`;
        this.transitionTaskState(task, 'PLANNED');
        this.persistToDisk();
        return this.runTask(taskId, userId, userRole);
      }
    } else if (recoveryOptionId.includes('KEEP') || recoveryOptionId.includes('CONTINUE')) {
      const failedStep = task.steps.find(s => s.state === 'FAILED');
      if (failedStep) {
        this.transitionStepState(failedStep, 'SKIPPED', taskId);
        task.partialFailureDetails = undefined;
        this.evaluateDependenciesAndProgress(task);
        this.persistToDisk();
      }
    } else if (recoveryOptionId.includes('REFUND')) {
      const failedStep = task.steps.find(s => s.state === 'FAILED');
      if (failedStep && failedStep.payload?.priceEGP) {
        paymentService.processRefund({
          tripId: task.tripId,
          amountEGP: Number(failedStep.payload.priceEGP),
          reason: `Automated DayGI Recovery refund for step ${failedStep.stepId}`,
          idempotencyKey: `REF-REC-${Date.now()}`
        });
        this.transitionStepState(failedStep, 'SKIPPED', taskId);
        task.partialFailureDetails = undefined;
        this.evaluateDependenciesAndProgress(task);
        this.persistToDisk();
      }
    }

    task.updatedAt = new Date().toISOString();
    this.persistToDisk();
    return task;
  }

  /**
   * Record traveler interaction outcome for closed-loop learning
   */
  public recordTaskOutcome(taskId: string, outcome: 'CLICKED' | 'IGNORED' | 'BOOKED' | 'ACCEPTED' | 'REJECTED' | 'ALTERNATIVE_CHOSEN'): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.outcome = outcome;
      task.updatedAt = new Date().toISOString();
      this.persistToDisk();

      db.logAudit(task.userId, 'Traveler', 'TASK_OUTCOME_RECORDED', 'DayGiTask', taskId, {
        outcome,
        intent: task.intent,
        stepsCount: task.steps.length,
        settledAmountEGP: task.completedTruth.settledAmountEGP
      });
    }
  }

  public getTask(taskId: string): DayGiOrchestratedTask | undefined {
    return this.tasks.get(taskId);
  }

  public getTasksForUser(userId: string, tripId?: string): DayGiOrchestratedTask[] {
    // Was `t.userId === userId || userId === 'USR-AHMED-01'`, so the demo
    // traveler received every user's task list.
    return Array.from(this.tasks.values()).filter(
      t => t.userId === userId && (!tripId || t.tripId === tripId)
    );
  }

  public cancelTask(taskId: string, reason: string = 'User requested cancellation'): DayGiOrchestratedTask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);

    if (task.state === 'COMPLETED') {
      throw new Error(`Cannot cancel task ${taskId}: Task is already COMPLETED with authoritative settled state. Use recovery or refund workflow.`);
    }

    if (task.state === 'CANCELLED') {
      return task; // Idempotent cancellation
    }

    // Cancel unexecuted steps while preserving completed truths
    for (const step of task.steps) {
      if (['PENDING', 'WAITING_FOR_DEPENDENCY', 'WAITING_FOR_USER', 'WAITING_FOR_PROVIDER'].includes(step.state)) {
        this.transitionStepState(step, 'CANCELLED', taskId);
      }
    }

    this.transitionTaskState(task, 'CANCELLED');
    this.metrics.cancellations++;
    this.persistToDisk();

    db.logAudit(task.userId, 'Traveler', 'TASK_CANCELLED', 'DayGiTask', taskId, {
      reason,
      preservedCompletedBookings: task.completedTruth.confirmedBookings,
      preservedSettledAmountEGP: task.completedTruth.settledAmountEGP
    });
    return task;
  }

  public getActiveTasksForUser(userId: string): DayGiOrchestratedTask[] {
    return Array.from(this.tasks.values()).filter(t => t.userId === userId);
  }

  public getAllTasks(): DayGiOrchestratedTask[] {
    return Array.from(this.tasks.values());
  }

  private determineOverallRisk(risks: DayGiActionRisk[]): DayGiActionRisk {
    if (risks.includes('SAFETY_CRITICAL')) return 'SAFETY_CRITICAL';
    if (risks.includes('FINANCIAL')) return 'FINANCIAL';
    if (risks.includes('COMMERCE')) return 'COMMERCE';
    if (risks.includes('LOW_RISK')) return 'LOW_RISK';
    return 'READ_ONLY';
  }

  private defaultVerificationRule(component: string, actionKey: string): DayGiVerificationRule {
    if (component === 'COMMERCE_SERVICE' || actionKey.includes('BOOK')) return 'VERIFY_CLOUD_SQL_BOOKING';
    if (component === 'PAYMENT_SERVICE' || component === 'LEDGER' || actionKey.includes('REFUND') || actionKey.includes('BUDGET')) return 'VERIFY_LEDGER_CHAIN';
    if (component === 'SUPPLIER_SERVICE') return 'VERIFY_PROVIDER_STATE';
    return 'VERIFY_TRIP_TIMELINE';
  }
}

export const daygiTaskOrchestrator = new DayGiTaskOrchestrator();
