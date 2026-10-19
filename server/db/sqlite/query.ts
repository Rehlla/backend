import type { Database as SqliteDb, Statement } from 'better-sqlite3';
import { db } from '../database';
import { SqlitePersistenceAdapter } from './SqlitePersistenceAdapter';
import { SPEC_BY_COLLECTION, TableSpec } from './tableSpecs';
import { rowToEntity } from './schemaBuilder';

/**
 * Indexed reads, for the paths that were doing full array scans.
 *
 * The audit counted 264 `db.<collection>.find(...)` lookups and 562 collection
 * operations in total, every one of them a linear walk. At 1,147 rows that is
 * survivable; the point of promoting columns and declaring indexes was to stop
 * it being the only option.
 *
 * This layer is deliberately *narrow*. It does not replace the in-memory
 * collections wholesale — that would mean touching all 562 sites at once. It
 * gives the hot lookups a real indexed path, and each migrated call site is an
 * independent, verifiable change.
 *
 * Correctness note: the in-memory working copy and SQLite are reconciled at
 * every `save()`, which is the same checkpoint the application already used.
 * Reads here therefore see everything committed. Inside an open transaction,
 * pending changes have not been flushed yet, so these helpers fall back to the
 * in-memory collection to avoid reading a stale row.
 *
 * ---------------------------------------------------------------------------
 * THESE RETURN COPIES. DO NOT MUTATE THE RESULT.
 * ---------------------------------------------------------------------------
 * Every entity here is hydrated with `JSON.parse` from the `data` column, so it
 * is a fresh object, not the element inside `db.<collection>`. The existing code
 * routinely mutates what `db.bookings.find(...)` returns and relies on that
 * landing in the store — for example authService's legacy-password upgrade does
 * `user.passwordSalt = newSalt` on the found record and expects the next
 * `save()` to persist it.
 *
 * Doing that to a value from this module writes to a throwaway object: no
 * error, no persistence, and a password that silently never upgrades. Only
 * migrate a call site to these helpers after checking that it reads.
 *
 * For a read-modify-write, keep using `db.<collection>.find(...)`, which
 * returns the live object the adapter will diff and persist.
 */

function adapter(): SqlitePersistenceAdapter | null {
  const a = db.getAdapter();
  return a instanceof SqlitePersistenceAdapter ? a : null;
}

/**
 * Per-connection statement cache. Keyed by the connection object (WeakMap),
 * NOT by SQL text alone: tests and tooling swap adapters at runtime, and a
 * text-keyed cache kept preparing statements on a closed connection ("The
 * database connection is not open"). A fresh adapter gets a fresh cache;
 * a closed connection's entries die with it.
 */
const statementCache = new WeakMap<SqliteDb, Map<string, Statement>>();
// WeakMap cannot be cleared, so remember every map we hand out to let the test
// hook drop them all when the adapter is swapped.
const liveCaches = new Set<{ conn: SqliteDb; bySql: Map<string, Statement> }>();

function prepared(conn: SqliteDb, sql: string): Statement {
  let byConn = statementCache.get(conn);
  if (!byConn) {
    byConn = new Map();
    statementCache.set(conn, byConn);
    liveCaches.add({ conn, bySql: byConn });
  }
  let stmt = byConn.get(sql);
  if (!stmt) {
    stmt = conn.prepare(sql);
    byConn.set(sql, stmt);
  }
  return stmt;
}

function specFor(collection: string): TableSpec {
  const spec = SPEC_BY_COLLECTION.get(collection);
  if (!spec) throw new Error(`[sqlite] No table spec for collection '${collection}'`);
  return spec;
}

function memory<T>(collection: string): T[] {
  return ((db.state as any)[collection] as T[]) || [];
}

/**
 * True when a SQL read is safe: the adapter is SQLite and no transaction is
 * open with unflushed writes.
 */
function canQuery(a: SqlitePersistenceAdapter | null): a is SqlitePersistenceAdapter {
  return a !== null && !a.hasPendingWrites;
}

/** Looks a row up by primary key. Falls back to the in-memory copy mid-transaction. */
export function findByKey<T>(collection: string, key: string): T | null {
  const a = adapter();
  const spec = specFor(collection);
  if (!canQuery(a)) {
    return (memory<any>(collection).find(e => String(e[spec.key]) === String(key)) as T) ?? null;
  }
  const row = prepared(a.connection, `SELECT data FROM ${spec.table} WHERE id = ?`).get(String(key)) as
    | { data: string }
    | undefined;
  return row ? rowToEntity<T>(row) : null;
}

/**
 * Equality lookup on a promoted column, using its index.
 *
 * `field` is the entity field name, not the SQL column: callers stay in the
 * vocabulary of the domain and the spec does the translation.
 */
export function findAllBy<T>(collection: string, field: string, value: unknown): T[] {
  const a = adapter();
  const spec = specFor(collection);
  const column = spec.columns.find(c => c.field === field);

  if (!canQuery(a) || !column) {
    // No promoted column means no index to use; an in-memory scan is what this
    // would have been anyway, and it keeps the helper total.
    return memory<any>(collection).filter(e => e[field] === value) as T[];
  }

  const normalised = column.boolean ? (value ? 1 : 0) : (value as any);
  const rows = prepared(
    a.connection,
    `SELECT data FROM ${spec.table} WHERE ${column.name} = ?`
  ).all(normalised) as Array<{ data: string }>;
  return rows.map(r => rowToEntity<T>(r));
}

export function findOneBy<T>(collection: string, field: string, value: unknown): T | null {
  const a = adapter();
  const spec = specFor(collection);
  const column = spec.columns.find(c => c.field === field);

  if (!canQuery(a) || !column) {
    return (memory<any>(collection).find(e => e[field] === value) as T) ?? null;
  }

  const normalised = column.boolean ? (value ? 1 : 0) : (value as any);
  const row = prepared(
    a.connection,
    `SELECT data FROM ${spec.table} WHERE ${column.name} = ? LIMIT 1`
  ).get(normalised) as { data: string } | undefined;
  return row ? rowToEntity<T>(row) : null;
}

/** Row count without materialising anything. */
export function countBy(collection: string, field?: string, value?: unknown): number {
  const a = adapter();
  const spec = specFor(collection);

  if (!canQuery(a)) {
    const rows = memory<any>(collection);
    return field ? rows.filter(e => e[field] === value).length : rows.length;
  }
  if (!field) {
    return (prepared(a.connection, `SELECT COUNT(*) AS n FROM ${spec.table}`).get() as { n: number }).n;
  }
  const column = spec.columns.find(c => c.field === field);
  if (!column) return memory<any>(collection).filter(e => e[field] === value).length;

  const normalised = column.boolean ? (value ? 1 : 0) : (value as any);
  return (
    prepared(a.connection, `SELECT COUNT(*) AS n FROM ${spec.table} WHERE ${column.name} = ?`).get(
      normalised
    ) as { n: number }
  ).n;
}

/**
 * Escape hatch for reads this module does not model: joins, ranges, aggregates.
 * Returns hydrated entities, so callers never assemble one from columns.
 */
export function queryEntities<T>(collection: string, whereSql: string, params: unknown[] = []): T[] {
  const a = adapter();
  const spec = specFor(collection);
  if (!canQuery(a)) {
    throw new Error(
      `[sqlite] queryEntities('${collection}') is unavailable: ` +
        (a ? 'a transaction is open with unflushed writes.' : 'the active adapter is not SQLite.')
    );
  }
  const rows = prepared(a.connection, `SELECT data FROM ${spec.table} WHERE ${whereSql}`).all(
    ...(params as any[])
  ) as Array<{ data: string }>;
  return rows.map(r => rowToEntity<T>(r));
}

/** Clears prepared statements. Required when a test swaps the adapter. */
export function resetQueryCache(): void {
  for (const { conn, bySql } of liveCaches) {
    bySql.clear();
    statementCache.delete(conn);
  }
  liveCaches.clear();
}
