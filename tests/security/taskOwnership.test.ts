import { beforeEach, describe, expect, it } from 'vitest';
import { daygiTaskOrchestrator } from '../../server/services/daygiTaskOrchestrator';

/**
 * `USR-AHMED-01` is the seeded demo traveler — an ordinary Traveler account
 * that ships with the platform. It was listed in the task orchestrator's
 * ownership check beside `'ADMIN'`, and returned from the two task-listing
 * methods as though it owned everything:
 *
 *   if (task.userId !== userId && userId !== 'USR-AHMED-01' && userId !== 'ADMIN')
 *   filter(t => t.userId === userId || userId === 'USR-AHMED-01')
 *
 * So anyone signing in as that account could read and confirm steps on every
 * other traveler's booking tasks.
 */

const OWNER = 'USR-OWNER-1';
const DEMO = 'USR-AHMED-01';

const makeTask = (userId: string) =>
  daygiTaskOrchestrator.createTask({
    userId,
    tripId: `TRIP-${userId}`,
    intent: 'RESCHEDULE',
    titleEn: 'Move the dive',
    titleAr: 'تغيير موعد الغطسة',
    steps: [
      {
        name: 'Release the hold',
        nameAr: 'إلغاء الحجز المؤقت',
        systemComponent: 'COMMERCE_SERVICE',
        actionKey: 'RELEASE_HOLD',
        payload: {}
      }
    ]
  });

describe('task ownership', () => {
  let ownerTask: ReturnType<typeof makeTask>;

  beforeEach(() => {
    ownerTask = makeTask(OWNER);
  });

  it('lets the owner confirm their own task', () => {
    const token = ownerTask.steps[0].actionToken;
    expect(() =>
      daygiTaskOrchestrator.grantUserConfirmation({
        userId: OWNER,
        taskId: ownerTask.taskId,
        actionToken: token,
        scope: 'STEP'
      })
    ).not.toThrow();
  });

  it('refuses the seeded demo traveler on someone else’s task', () => {
    const token = ownerTask.steps[0].actionToken;
    expect(() =>
      daygiTaskOrchestrator.grantUserConfirmation({
        userId: DEMO,
        taskId: ownerTask.taskId,
        actionToken: token,
        scope: 'STEP'
      })
    ).toThrow(/not authorized/i);
  });

  it('refuses any other traveler on someone else’s task', () => {
    const token = ownerTask.steps[0].actionToken;
    expect(() =>
      daygiTaskOrchestrator.grantUserConfirmation({
        userId: 'USR-STRANGER',
        taskId: ownerTask.taskId,
        actionToken: token,
        scope: 'STEP'
      })
    ).toThrow(/not authorized/i);
  });

  it('does not hand the demo traveler everyone else’s task list', () => {
    const listed = daygiTaskOrchestrator.getTasksForUser(DEMO);
    expect(listed.every(task => task.userId === DEMO)).toBe(true);
    expect(listed.some(task => task.taskId === ownerTask.taskId)).toBe(false);
  });

  it('does not hand the demo traveler everyone else’s active tasks', () => {
    const listed = daygiTaskOrchestrator.getActiveTasksForUser(DEMO);
    expect(listed.every(task => task.userId === DEMO)).toBe(true);
  });

  it('still returns a traveler their own tasks', () => {
    const listed = daygiTaskOrchestrator.getTasksForUser(OWNER);
    expect(listed.some(task => task.taskId === ownerTask.taskId)).toBe(true);
  });

  it('scopes a listing to one trip when asked', () => {
    const other = makeTask(OWNER);
    other.tripId = 'TRIP-OTHER';
    const listed = daygiTaskOrchestrator.getTasksForUser(OWNER, `TRIP-${OWNER}`);
    expect(listed.every(task => task.tripId === `TRIP-${OWNER}`)).toBe(true);
  });
});
