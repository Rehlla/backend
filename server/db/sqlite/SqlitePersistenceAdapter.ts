import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import type { Database as SqliteDb, Statement } from 'better-sqlite3';
import { IPersistenceAdapter } from '../adapters/IPersistenceAdapter';
import { DatabaseState } from '../database';
import { TABLE_SPECS, TableSpec } from './tableSpecs';
import { buildSchemaDdl, ensureSchemaColumns, entityToRow, rowToEntity, upsertSql } from './schemaBuilder';
import { SQLITE_FILE } from '../paths';

/**
 * A real local database behind the existing synchronous persistence contract.
 *
 * Why SQLite and not PostgreSQL: IPersistenceAdapter is synchronous
 * (`commit(): void`, `runInTransaction<R>(work: () => R): R`), and the
 * application makes 562 synchronous collection operations and calls `save()`
 * at 54 sites without awaiting it. `pg` is async-only, which is the actual
 * reason PostgresPersistenceAdapter.save() was never implemented — it is not
 * possible to satisfy this interface with an async driver without rewriting
 * every caller. better-sqlite3 is synchronous, so it fits without that rewrite
 * and still provides real transactions, foreign keys and indexes.
 *
 * ---------------------------------------------------------------------------
 * One source of truth
 * ---------------------------------------------------------------------------
 * SQLite is authoritative. The in-memory DatabaseState is a working copy that
 * is loaded once at boot and re-synchronised at every `save()` — the same
 * checkpoint the application already used. It is NOT a second store: nothing
 * reads from it that has not been written through, and `save()` reconciles it
 * to the database rather than the other way round.
 *
 * Writes are diffed, so a login no longer rewrites the knowledge base. The
 * JSON adapter had to re-serialise and fsync all 0.71 MB on every mutation;
 * here only rows whose serialisation actually changed are written, inside one
 * transaction.
 */
export class SqlitePersistenceAdapter implements IPersistenceAdapter {
  private readonly dbFile: string;
  private readonly sqlite: SqliteDb;
  private state: DatabaseState;

  /**
   * Last-known state per row, keyed by table then primary key.
   *
   * `seq` is tracked alongside `data` so a reorder can be written as a one
   * integer update rather than a full row rewrite — which matters because
   * unshift() on a 387-row audit log shifts every position at once.
   */
  private shadow = new Map<string, Map<string, { data: string; seq: number }>>();

  private upsertStatements = new Map<string, Statement>();
  private deleteStatements = new Map<string, Statement>();
  private reseqStatements = new Map<string, Statement>();
  /** Columns this boot ALTERed into existing tables (empty on a fresh file). */
  private appliedColumnMigrations: string[] = [];

  private transactionDepth = 0;
  private transactionBackup: string | null = null;

  constructor(customDbPath?: string) {
    this.dbFile = customDbPath || SQLITE_FILE();
    const dir = path.dirname(this.dbFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    this.sqlite = new Database(this.dbFile);
    this.applyPragmas();
    this.sqlite.exec(buildSchemaDdl());
    // Before the upserts are prepared: a spec that grew a promoted column must
    // ALTER the existing table into shape, or prepare() names a column the
    // table predates and every boot dies on it.
    this.appliedColumnMigrations = ensureSchemaColumns(this.sqlite);
    this.prepareStatements();
    this.state = this.hydrate();
  }

  private applyPragmas() {
    // WAL: readers never block the writer, and a crash cannot leave a
    // half-written page in the main database file.
    this.sqlite.pragma('journal_mode = WAL');
    // The constraint the JSON store could not express. This is what turns the
    // 8 dangling rows the audit found from an invisible defect into a rejected
    // write.
    this.sqlite.pragma('foreign_keys = ON');
    // NORMAL is the documented-safe pairing with WAL: durable across process
    // crashes, and only at risk from an OS-level power loss, which the JSON
    // adapter's single fsync did not protect against either.
    this.sqlite.pragma('synchronous = NORMAL');
    // Another process holding the write lock is a wait, not an error.
    this.sqlite.pragma('busy_timeout = 5000');

    // Verified, not assumed. A build of SQLite compiled without foreign key
    // support would accept the pragma silently and enforce nothing, which is
    // exactly the kind of guarantee-that-isn't this migration exists to remove.
    const fkOn = this.sqlite.pragma('foreign_keys', { simple: true });
    if (fkOn !== 1) {
      throw new Error(
        '[sqlite] foreign_keys pragma did not take effect; this build cannot enforce ' +
          'referential integrity. Refusing to run, because the whole point of moving off ' +
          'the JSON store was that constraints are enforced rather than hoped for.'
      );
    }
  }

  private prepareStatements() {
    for (const spec of TABLE_SPECS) {
      this.upsertStatements.set(spec.table, this.sqlite.prepare(upsertSql(spec)));
      this.deleteStatements.set(spec.table, this.sqlite.prepare(`DELETE FROM ${spec.table} WHERE id = ?`));
      this.reseqStatements.set(spec.table, this.sqlite.prepare(`UPDATE ${spec.table} SET seq = ? WHERE id = ?`));
    }
  }

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------

  private hydrate(): DatabaseState {
    const state = {} as Record<string, any>;

    for (const spec of TABLE_SPECS) {
      // ORDER BY seq, always. Without it the collection order is whatever the
      // query planner happens to produce, and several collections carry meaning
      // in their order.
      const rows = this.sqlite
        .prepare(`SELECT id, seq, data FROM ${spec.table} ORDER BY seq`)
        .all() as Array<{ id: string; seq: number; data: string }>;

      state[spec.collection as string] = rows.map(r => rowToEntity(r));

      const shadowForTable = new Map<string, { data: string; seq: number }>();
      rows.forEach((r, index) => shadowForTable.set(r.id, { data: r.data, seq: index }));
      this.shadow.set(spec.table, shadowForTable);
    }

    const meta = this.readMeta();
    state.version = meta.version;
    state.fencingSequence = meta.fencingSequence;
    state.lastCheckpoint = meta.lastCheckpoint;

    return state as DatabaseState;
  }

  private readMeta(): { version: number; fencingSequence: number; lastCheckpoint: string } {
    const rows = this.sqlite.prepare('SELECT key, value FROM store_meta').all() as Array<{
      key: string;
      value: string;
    }>;
    const map = new Map(rows.map(r => [r.key, r.value]));
    return {
      version: Number(map.get('version') ?? 1),
      fencingSequence: Number(map.get('fencingSequence') ?? 1000),
      lastCheckpoint: map.get('lastCheckpoint') ?? new Date().toISOString()
    };
  }

  public getState(): DatabaseState {
    return this.state;
  }

  /**
   * Discards the working copy and re-reads from the database.
   *
   * distributedLockService calls this to see writes made by another process.
   * With SQLite that is now a real cross-process read rather than a re-parse of
   * a file that another process may have been midway through replacing.
   */
  public reloadFromDisk(): DatabaseState {
    this.shadow.clear();
    this.state = this.hydrate();
    return this.state;
  }

  // -------------------------------------------------------------------------
  // Write
  // -------------------------------------------------------------------------

  /**
   * Upserts one collection's changed rows and rebuilds its shadow.
   *
   * Deletes are NOT done here: they have to run child-first across all tables
   * before any upsert runs, so they get their own pass in flushAll(). Rebuilding
   * the shadow from `next` is what records those deletions here.
   */
  private upsertTable(spec: TableSpec): number {
    const collection = (this.state as any)[spec.collection as string] as any[] | undefined;
    if (!Array.isArray(collection)) return 0;

    const previous = this.shadow.get(spec.table) ?? new Map<string, { data: string; seq: number }>();
    const next = new Map<string, { data: string; seq: number }>();
    const upsert = this.upsertStatements.get(spec.table)!;
    const reseq = this.reseqStatements.get(spec.table)!;
    let written = 0;

    for (let index = 0; index < collection.length; index++) {
      const row = entityToRow(spec, collection[index], index);
      next.set(row.id, { data: row.data, seq: index });

      const before = previous.get(row.id);
      if (!before || before.data !== row.data) {
        // Content changed (or the row is new): write the whole row.
        upsert.run(row);
        written++;
      } else if (before.seq !== index) {
        // Only the position moved. An unshift shifts every row in the
        // collection, so this path has to stay cheap: one integer per row
        // instead of re-serialising and rewriting the document.
        reseq.run(index, row.id);
        written++;
      }
    }

    this.shadow.set(spec.table, next);
    return written;
  }

  /** Removes rows that are no longer in the in-memory collection. */
  private deleteMissing(spec: TableSpec): number {
    const collection = (this.state as any)[spec.collection as string] as any[] | undefined;
    const previous = this.shadow.get(spec.table);
    if (!Array.isArray(collection) || !previous || previous.size === 0) return 0;

    const live = new Set(collection.map(e => String(e[spec.key])));
    const del = this.deleteStatements.get(spec.table)!;
    let deleted = 0;
    for (const id of previous.keys()) {
      if (!live.has(id)) {
        del.run(id);
        deleted++;
      }
    }
    return deleted;
  }

  private writeMeta(checkpoint: string) {
    const stmt = this.sqlite.prepare(
      'INSERT INTO store_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    stmt.run('version', String(this.state.version ?? 1));
    stmt.run('fencingSequence', String(this.state.fencingSequence ?? 1000));
    stmt.run('lastCheckpoint', checkpoint);
  }

  /**
   * Writes every pending change in one transaction.
   *
   * Deletes run child-first and upserts parent-first, so a reordering of the
   * collections can never trip a foreign key mid-flush.
   */
  private flushAll(): void {
    const checkpoint = new Date().toISOString();

    const run = this.sqlite.transaction(() => {
      // Children before parents on the way out...
      for (let idx = TABLE_SPECS.length - 1; idx >= 0; idx--) {
        this.deleteMissing(TABLE_SPECS[idx]);
      }
      // ...and parents before children on the way in.
      for (const spec of TABLE_SPECS) {
        this.upsertTable(spec);
      }
      this.writeMeta(checkpoint);
    });

    run();
    this.state.lastCheckpoint = checkpoint;
  }

  /**
   * Not `async`, for the same reason the JSON adapter is not: all 54 call sites
   * invoke this without awaiting, so an async body turned every write failure
   * into a silent unhandled rejection. Doing the work synchronously makes a
   * failed write throw into the caller that asked for it.
   */
  public save(): Promise<void> {
    if (this.transactionDepth > 0) return Promise.resolve();
    this.flushAll();
    return Promise.resolve();
  }

  // -------------------------------------------------------------------------
  // Transactions
  // -------------------------------------------------------------------------

  public beginTransaction(): void {
    if (this.transactionDepth === 0) {
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

    try {
      this.flushAll();
    } catch (err) {
      // The backup is deliberately not cleared: flushAll can throw (a foreign
      // key violation now genuinely can stop a write), and dropping the backup
      // here would leave rollback() with nothing to restore while the in-memory
      // copy still held a mutation the database rejected.
      this.transactionDepth = 0;
      throw err;
    }
    this.transactionBackup = null;
  }

  public rollback(): void {
    if (this.transactionBackup) {
      this.state = JSON.parse(this.transactionBackup);
    }
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

  // -------------------------------------------------------------------------
  // Fencing counter
  // -------------------------------------------------------------------------

  /**
   * Hands out a strictly increasing fencing token.
   *
   * The file-based version this replaces read data/fencing_sequence.seq,
   * incremented in JavaScript, then wrote it back. Two processes could read the
   * same value and both write it, so the counter whose entire purpose is to be
   * unique under concurrency had a race in exactly the case it existed for.
   *
   * BEGIN IMMEDIATE takes the write lock before the read, so the
   * read-modify-write is atomic across processes rather than merely fast.
   */
  public nextFencingToken(): number {
    const bump = this.sqlite.transaction(() => {
      const row = this.sqlite
        .prepare("SELECT value FROM store_meta WHERE key = 'fencingSequence'")
        .get() as { value: string } | undefined;
      const current = Number(row?.value ?? 1000);
      const next = (Number.isFinite(current) ? Math.max(current, 1000) : 1000) + 1;
      this.sqlite
        .prepare(
          "INSERT INTO store_meta (key, value) VALUES ('fencingSequence', ?) " +
            'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
        )
        .run(String(next));
      return next;
    });

    const next = bump.immediate();
    this.state.fencingSequence = next;
    return next;
  }

  // -------------------------------------------------------------------------
  // Diagnostics & lifecycle
  // -------------------------------------------------------------------------

  public async isHealthy(): Promise<boolean> {
    try {
      const row = this.sqlite.prepare('SELECT 1 AS alive').get() as { alive: number } | undefined;
      return row?.alive === 1;
    } catch {
      return false;
    }
  }

  /** Direct handle, for the query layer and for integrity checks. */
  public get connection(): SqliteDb {
    return this.sqlite;
  }

  /**
   * True while a transaction is open, i.e. while the in-memory working copy
   * holds mutations that have not been flushed. The query layer checks this
   * before reading through to SQL, so a caller mid-transaction never sees a
   * row that its own uncommitted change has already superseded.
   */
  public get hasPendingWrites(): boolean {
    return this.transactionDepth > 0;
  }

  public get filePath(): string {
    return this.dbFile;
  }

  /**
   * A consistent copy of the whole database, taken without stopping writers.
   * This is the backup the store has never had — `VACUUM INTO` is transactional,
   * so unlike copying the file it cannot capture a torn page.
   */
  public backupTo(destination: string): string {
    const dir = path.dirname(destination);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(destination)) {
      throw new Error(`[sqlite] Backup target already exists: ${destination}`);
    }
    this.sqlite.prepare('VACUUM INTO ?').run(destination);
    return destination;
  }

  public close(): void {
    this.sqlite.close();
  }
}
