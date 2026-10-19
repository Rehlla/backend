import fs from 'fs';
import path from 'path';
import { IPersistenceAdapter } from './IPersistenceAdapter';
import { DatabaseState } from '../database';
import { DATA_DIR } from '../paths';

export class JsonFilePersistenceAdapter implements IPersistenceAdapter {
  private dbDir: string;
  private dbFile: string;
  private state: DatabaseState;
  private isTransactionActive = false;
  private transactionBackup: string | null = null;
  private transactionDepth = 0;

  constructor(customDbDir?: string, initialState?: DatabaseState) {
    this.dbDir = customDbDir || DATA_DIR;
    this.dbFile = path.join(this.dbDir, 'dahab_db.json');
    this.ensureDirectoryExists();
    this.state = initialState ? JSON.parse(JSON.stringify(initialState)) : this.loadFromDisk();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(this.dbDir)) {
      fs.mkdirSync(this.dbDir, { recursive: true });
    }
  }

  /**
   * Loads the store, or starts a new one — but never destroys an existing file.
   *
   * This used to catch a parse or read failure, log it, and fall through to
   * saveDirect(defaultState): a single corrupt byte silently replaced every
   * user, session and ledger entry with an empty database, with nothing to
   * recover from. data/daygi_tasks.json is already corrupt in this repo, so
   * this was not hypothetical.
   *
   * An unreadable file is now preserved beside the original before anything is
   * written, and the failure is loud.
   */
  private loadFromDisk(): DatabaseState {
    if (fs.existsSync(this.dbFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.dbFile, 'utf-8'));
      } catch (err) {
        const quarantine = `${this.dbFile}.corrupt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
        try {
          fs.copyFileSync(this.dbFile, quarantine);
        } catch (copyErr) {
          // Preserving it is the whole point; if that cannot be done, refuse
          // rather than overwrite what we failed to copy.
          throw new Error(
            `[JsonPersistence] ${this.dbFile} is unreadable and could not be preserved. Refusing to overwrite it.`,
            { cause: copyErr }
          );
        }
        console.error(
          `[JsonPersistence] ${this.dbFile} could not be parsed and was preserved as ${quarantine}. ` +
          'Starting from an empty database. Inspect the preserved copy before discarding it.',
          err
        );
      }
    }
    const defaultState: DatabaseState = {
      version: 1,
      users: [],
      sessions: [],
      trips: [],
      tripItems: [],
      tripMembers: [],
      tripItemVotes: [],
      tripSplits: [],
      suppliers: [],
      productSkus: [],
      hotels: [],
      accommodations: [],
      propertySources: [],
      inventorySlots: [],
      holds: [],
      payments: [],
      bookings: [],
      ledgerEntries: [],
      transferTelemetry: [],
      notifications: [],
      ambientNudges: [],
      pushSubscriptions: [],
      supplierMetrics: [],
      supplierAvailabilityBlocks: [],
      payoutSchedule: [],
      reviews: [],
      supportMessages: [],
      auditEvents: [],
      opportunities: [],
      roomTypes: [],
      roomRateNights: [],
      hotelBookings: [],
      locks: [],
      fencingSequence: 1000,
      rawSupplierSources: [],
      rawOfferSources: [],
      supplierOffers: [],
      marketPriceStats: [],
      socialAccounts: [],
      sourceRecords: [],
      priceObservations: [],
      marketChangeEvents: [],
      marketSnapshots: [],
      sourceFreshnessRecords: [],
      contactHistory: [],
      researchSources: [],
      temporalFacts: [],
      evidenceNodes: [],
      conflictSets: [],
      areaProfiles: [],
      places: [],
      activities: [],
      diningVenues: [],
      diningMenuItems: [],
      diningOrders: [],
      emergencyResources: [],
      regulatoryDecrees: [],
      knowledgeSnapshots: [],
      placeDiscoveries: [],
      resolutionCandidates: [],
      reefPositiveLogs: [],
      bundles: [],
      tripJournalEntries: [],
      tripPlacesVisited: [],
      fraudSignals: [],
      fraudRules: [],
      fraudUserStats: [],
      roles: [],
      userPermissionOverrides: [],
      settings: [],
      settingsHistory: [],
      featureFlags: [],
      approvals: [],
      idempotencyKeys: [],
      deviceSessions: [],
      refreshTokens: [],
      pushDevices: [],
      integrationConfigs: [],
      tripPackages: [],
      catalogMeta: [],
      lastCheckpoint: new Date().toISOString()
    };
    this.saveDirect(defaultState);
    return defaultState;
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public reloadFromDisk(): DatabaseState {
    if (fs.existsSync(this.dbFile)) {
      try {
        const raw = fs.readFileSync(this.dbFile, 'utf-8');
        const parsed = JSON.parse(raw);
        this.state = parsed;
        return this.state;
      } catch (err) {
        console.error('[JsonPersistence] Error reloading from disk:', err);
      }
    }
    return this.state;
  }

  /**
   * Errors that mean "try again in a moment", not "this write is wrong".
   *
   * On Windows a rename over an existing file fails with EPERM/EBUSY/EACCES
   * while another process holds the target open — a dev server and a CLI task
   * touching the same file is enough. That transient case is what the old
   * non-atomic fallback was really working around.
   */
  private static readonly TRANSIENT_CODES = new Set(['EPERM', 'EBUSY', 'EACCES', 'EMFILE', 'ENFILE']);
  private static readonly WRITE_ATTEMPTS = 5;
  private static readonly RETRY_BASE_MS = 20;

  private static isTransient(err: unknown): boolean {
    const code = (err as NodeJS.ErrnoException | null)?.code;
    return !!code && JsonFilePersistenceAdapter.TRANSIENT_CODES.has(code);
  }

  /** Everything on this path is synchronous, so the backoff must be too. */
  private sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
  }

  /**
   * Writes the whole state to disk, atomically or not at all.
   *
   * The previous implementation caught a failed atomic write and fell back to
   * writing dahab_db.json IN PLACE. That turns a recoverable failure into an
   * unrecoverable one: the temp file is gone, the real file is being truncated
   * and rewritten, and a failure part-way through leaves a half-written
   * database with no copy of what it replaced. This file holds the user
   * records, live sessions and the ledger.
   *
   * So: temp file -> fsync -> rename, and nothing else. fsync matters because
   * rename is only atomic with respect to the bytes the filesystem has actually
   * committed; publishing an unflushed temp file can survive as a truncated
   * database after a crash. Transient failures are retried; anything else
   * throws with the original cause attached, leaving the last good file intact.
   */
  private saveDirect(stateToSave: DatabaseState) {
    stateToSave.lastCheckpoint = new Date().toISOString();
    const serialized = JSON.stringify(stateToSave, null, 2);
    let lastError: unknown;

    for (let attempt = 1; attempt <= JsonFilePersistenceAdapter.WRITE_ATTEMPTS; attempt++) {
      const tempFile = `${this.dbFile}.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 6)}.tmp`;
      try {
        const fd = fs.openSync(tempFile, 'w');
        try {
          fs.writeFileSync(fd, serialized, 'utf-8');
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
        fs.renameSync(tempFile, this.dbFile);
        return;
      } catch (err) {
        lastError = err;
        try {
          if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        } catch {
          // The temp file is orphaned, not the database. Nothing to recover.
        }

        if (!JsonFilePersistenceAdapter.isTransient(err)) break;
        if (attempt < JsonFilePersistenceAdapter.WRITE_ATTEMPTS) {
          this.sleepSync(JsonFilePersistenceAdapter.RETRY_BASE_MS * attempt);
        }
      }
    }

    throw new Error(
      `[JsonPersistence] Failed to persist ${this.dbFile}; the previous contents are unchanged. ` +
      `Cause: ${(lastError as Error)?.message ?? String(lastError)}`,
      { cause: lastError }
    );
  }

  /**
   * Not `async`.
   *
   * The interface declares Promise<void>, but all 54 call sites invoke this
   * without awaiting. Under `async`, every write failure became an unhandled
   * rejection: the database could silently fail to persist and nothing
   * reported it. Doing the work synchronously and returning an already-resolved
   * promise keeps the interface, and makes a failed write throw into the caller
   * that asked for it — which the mounted errorHandler turns into a 500 instead
   * of a lie.
   */
  public save(): Promise<void> {
    if (this.isTransactionActive) return Promise.resolve();
    this.saveDirect(this.state);
    return Promise.resolve();
  }

  public beginTransaction(): void {
    if (this.transactionDepth === 0) {
      this.isTransactionActive = true;
      this.transactionBackup = JSON.stringify(this.state);
    }
    this.transactionDepth++;
  }

  public commit(): void {
    if (this.transactionDepth === 0) {
      throw new Error('No active transaction to commit.');
    }
    this.transactionDepth--;
    if (this.transactionDepth > 0) return;

    this.isTransactionActive = false;
    try {
      this.saveDirect(this.state);
    } catch (err) {
      // The backup is deliberately NOT cleared here. saveDirect can now throw,
      // and discarding the backup first meant rollback() had nothing to restore:
      // the in-memory state kept a mutation that never reached disk, so memory
      // and disk disagreed while the caller was told the write failed.
      this.transactionDepth = 0;
      throw err;
    }
    this.transactionBackup = null;
  }

  public rollback(): void {
    if (this.transactionBackup) {
      this.state = JSON.parse(this.transactionBackup);
    }
    this.isTransactionActive = false;
    this.transactionBackup = null;
    this.transactionDepth = 0;
  }

  public runInTransaction<R>(work: () => R): R {
    this.beginTransaction();
    try {
      const result = work();
      this.commit();
      return result;
    } catch (err) {
      this.rollback();
      throw err;
    }
  }

  public async isHealthy(): Promise<boolean> {
    try {
      this.ensureDirectoryExists();
      return true;
    } catch {
      return false;
    }
  }
}
