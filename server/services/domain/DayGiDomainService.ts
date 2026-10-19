import { daygiMemoryService } from '../daygiMemoryService';
import { daygiTaskOrchestrator } from '../daygiTaskOrchestrator';
import { pickAllowedKeys, DAYGI_PREFERENCE_KEYS } from '../../middleware/bodyParams';

/** Who is acting, taken from the session by the transport layer. */
export type DayGiActor = {
  userId: string;
  role: string;
};

/**
 * Transport-agnostic DayGI operations (structured memory + agentic tasks).
 *
 * The REST routes in server.ts are thin adapters over these methods; a future
 * gRPC or GraphQL surface calls the same ones, so ownership rules and payload
 * validation stay identical across protocols. Identity always arrives as the
 * actor — never parsed from a payload.
 */
export class DayGiDomainService {
  // --- Structured memory ---

  static getMemory(userId: string) {
    return daygiMemoryService.getMemory(userId);
  }

  /**
   * Preference updates pass through pickAllowedKeys: before that, an invented
   * key was stored forever, and a nested object could land where a string was
   * read.
   */
  static updateMemory(userId: string, body: unknown) {
    return daygiMemoryService.updatePreferences(
      userId,
      pickAllowedKeys(body, DAYGI_PREFERENCE_KEYS, 'preferences')
    );
  }

  // --- Agentic task orchestrator ---

  static getTasks(userId: string, tripId: string | undefined) {
    if (!tripId) {
      throw badRequest('tripId query parameter is required');
    }
    return daygiTaskOrchestrator.getTasksForUser(userId, tripId);
  }

  /**
   * A task can carry trip ids, money payloads and action tokens. Only its
   * owner (or Operations/Admin) may read it. Both a missing task and a foreign
   * task resolve to null so the route can answer a flat 404 — confirming a
   * task exists would itself be a leak.
   */
  static getTaskForActor(taskId: string, actor: DayGiActor) {
    const task = daygiTaskOrchestrator.getTask(taskId);
    if (!task) return null;
    const isStaff = actor.role === 'Operations' || actor.role === 'Admin';
    if (!(task.userId === actor.userId || isStaff)) return null;
    return task;
  }

  static executeStep(taskId: string, stepId: string, actionToken: string | undefined, actor: DayGiActor) {
    if (!this.getTaskForActor(taskId, actor)) {
      throw taskNotFound();
    }
    if (actionToken) {
      daygiTaskOrchestrator.grantUserConfirmation({
        userId: actor.userId,
        taskId,
        actionToken,
        scope: 'USER_ACTION_EXECUTE'
      });
    }
    return daygiTaskOrchestrator.executeStep({
      taskId,
      stepId,
      userId: actor.userId,
      userRole: actor.role,
      bypassConfirmation: Boolean(actionToken)
    });
  }

  /**
   * applyRecovery can trigger a refund on the task's trip (the REFUND branch
   * calls paymentService.processRefund), so only the owner may invoke it.
   */
  static applyRecovery(taskId: string, recoveryOptionId: string, actor: DayGiActor) {
    if (!this.getTaskForActor(taskId, actor)) {
      throw taskNotFound();
    }
    return daygiTaskOrchestrator.applyRecovery({
      taskId,
      recoveryOptionId,
      userId: actor.userId,
      userRole: actor.role
    });
  }

  static cancelTask(taskId: string, reason: string | undefined, actor: DayGiActor) {
    if (!this.getTaskForActor(taskId, actor)) {
      throw taskNotFound();
    }
    return daygiTaskOrchestrator.cancelTask(taskId, reason || 'User requested cancellation');
  }
}

function taskNotFound(): Error & { status: number } {
  const err = new Error('Task not found') as Error & { status: number };
  err.status = 404;
  return err;
}

function badRequest(message: string): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = 400;
  return err;
}
