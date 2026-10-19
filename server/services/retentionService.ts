import { db } from '../db/database';

/**
 * Removes what the store has never removed.
 *
 * Two collections grew without any bound:
 *
 *   - Sessions were deleted only on an explicit logout or revoke. Validation
 *     rejects an expired token, but the row stayed forever — 201 rows for 56
 *     users, each holding a bearer token. An expired session is not just dead
 *     weight, it is a credential sitting in the database with nothing left to
 *     authorise.
 *
 *   - Audit events were never trimmed. At 400 rows and climbing it was already
 *     the largest table in the store.
 *
 * Audit events are ARCHIVED, not deleted: the tail is written to
 * data/audit-archive-<date>.jsonl before it leaves the table, because an audit
 * trail that silently forgets is not an audit trail. Sessions are deleted
 * outright — an expired credential has no evidentiary value.
 */
import fs from 'fs';
import { dataPath } from '../db/paths';

/** Audit events kept in the live table. Older ones are archived to disk. */
const AUDIT_RETENTION = Number(process.env.AUDIT_RETENTION_ROWS || 2000);

export interface SweepResult {
  expiredSessionsRemoved: number;
  auditEventsArchived: number;
  archiveFile: string | null;
}

export class RetentionService {
  /**
   * Deletes sessions whose expiry has passed.
   *
   * Only expired ones: a live session belongs to somebody who is signed in, and
   * this must never be the reason a traveller is logged out mid-booking.
   */
  public sweepExpiredSessions(now = new Date()): number {
    const cutoff = now.toISOString();
    let removed = 0;

    db.runInTransaction(() => {
      for (let i = db.sessions.length - 1; i >= 0; i--) {
        if (db.sessions[i].expiresAt < cutoff) {
          db.sessions.splice(i, 1);
          removed++;
        }
      }
    });

    return removed;
  }

  /**
   * Trims the audit log to its retention limit, writing the removed tail to a
   * newline-delimited JSON file first.
   *
   * The array is newest-first (logAudit unshifts), so the tail is the oldest.
   * The archive is appended to, never truncated, and the trim only happens once
   * the write has succeeded — a failed archive leaves the table untouched
   * rather than dropping the rows it could not preserve.
   */
  public archiveOldAuditEvents(limit = AUDIT_RETENTION): { archived: number; file: string | null } {
    const total = db.auditEvents.length;
    if (total <= limit) return { archived: 0, file: null };

    const overflow = db.auditEvents.slice(limit);
    const file = dataPath(`audit-archive-${new Date().toISOString().slice(0, 10)}.jsonl`);
    const payload = overflow.map(e => JSON.stringify(e)).join('\n') + '\n';

    fs.appendFileSync(file, payload, 'utf-8');

    db.runInTransaction(() => {
      db.auditEvents.length = limit;
    });

    return { archived: overflow.length, file };
  }

  public sweep(): SweepResult {
    const expiredSessionsRemoved = this.sweepExpiredSessions();
    const { archived, file } = this.archiveOldAuditEvents();
    return { expiredSessionsRemoved, auditEventsArchived: archived, archiveFile: file };
  }

  /**
   * Runs the sweep on an interval.
   *
   * `unref()` so a pending timer never holds the process open — without it the
   * server would refuse to exit for up to an hour after SIGTERM, and the
   * container would be killed rather than shut down.
   */
  public startScheduledSweep(intervalMs = 60 * 60 * 1000): NodeJS.Timeout {
    const timer = setInterval(() => {
      try {
        const result = this.sweep();
        if (result.expiredSessionsRemoved || result.auditEventsArchived) {
          console.log(
            `[Retention] removed ${result.expiredSessionsRemoved} expired session(s), ` +
              `archived ${result.auditEventsArchived} audit event(s)` +
              (result.archiveFile ? ` to ${result.archiveFile}` : '')
          );
        }
      } catch (err) {
        // A failed sweep must never take the server down with it.
        console.error('[Retention] sweep failed:', (err as Error).message);
      }
    }, intervalMs);

    timer.unref();
    return timer;
  }
}

export const retentionService = new RetentionService();
