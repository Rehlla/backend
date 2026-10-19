import crypto from 'crypto';
import {
  TABLE_SPECS,
  SCALAR_STATE_KEYS,
  type TableSpec,
  type ColumnSpec,
} from '../sqlite/tableSpecs';

/**
 * PostgreSQL DDL generated from the same TableSpec[] that drives SQLite.
 *
 * The two dialects share one source of truth so a spec edit can never reach
 * one store and silently miss the other. Deliberate differences from the
 * SQLite shape (see sqlite/schemaBuilder.ts):
 *
 * - `data` is JSONB, not TEXT: reads still hydrate from it, but Postgres can
 *   index into it later without a migration.
 * - booleans stay INTEGER 0/1 (matching promote() semantics) rather than
 *   PG BOOLEAN, so row-building code needs no dialect branch.
 * - TEXT/INTEGER map directly; REAL becomes DOUBLE PRECISION.
 * - PRIMARY KEY / UNIQUE / NOT NULL / REFERENCES … ON DELETE are preserved
 *   verbatim, including the money-tables-are-indexed-not-FK rule that
 *   protects the audit trail from cascading deletes.
 * - `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` are valid
 *   Postgres, so the baseline migration is re-runnable.
 *
 * What this does NOT cover (explicit non-goals, see blueprint §N):
 * CMS tables (contentService is hardcoded to the SQLite adapter), row<->entity
 * mapping for PG reads/writes, and the save() path itself.
 */

function pgType(c: ColumnSpec): string {
  if (c.type === 'INTEGER') return 'INTEGER';
  if (c.type === 'REAL') return 'DOUBLE PRECISION';
  return 'TEXT';
}

function pgColumnDdl(c: ColumnSpec): string {
  const parts = [`  ${c.name} ${pgType(c)}`];
  if (c.notNull) parts.push('NOT NULL');
  if (c.unique) parts.push('UNIQUE');
  if (c.references) {
    parts.push(`REFERENCES ${c.references.table}(id) ON DELETE ${c.references.onDelete}`);
  }
  return parts.join(' ');
}

export function pgTableDdl(spec: TableSpec): string {
  const lines = [
    // Same identity contract as SQLite: meaningful string ids, never SERIAL.
    '  id TEXT PRIMARY KEY NOT NULL',
    // Collection position (ORDER BY seq hydration, ledger hash-chain order).
    '  seq INTEGER NOT NULL',
    ...spec.columns.map(pgColumnDdl),
    // Complete entity as JSONB; reads hydrate from here.
    '  data JSONB NOT NULL',
  ];
  return `CREATE TABLE IF NOT EXISTS ${spec.table} (\n${lines.join(',\n')}\n);`;
}

export function pgIndexDdl(spec: TableSpec): string[] {
  const out = [`CREATE INDEX IF NOT EXISTS idx_${spec.table}_seq ON ${spec.table}(seq);`];
  for (const c of spec.columns) {
    if (c.index && !c.unique) {
      out.push(`CREATE INDEX IF NOT EXISTS idx_${spec.table}_${c.name} ON ${spec.table}(${c.name});`);
    }
  }
  for (const cols of spec.compositeIndexes || []) {
    out.push(
      `CREATE INDEX IF NOT EXISTS idx_${spec.table}_${cols.join('_')} ON ${spec.table}(${cols.join(', ')});`
    );
  }
  return out;
}

/** CREATE TABLE plus its indexes, in dependency-safe order. */
export function pgTableStatements(spec: TableSpec): string[] {
  return [pgTableDdl(spec), ...pgIndexDdl(spec)];
}

export function pgMetaDdl(): string[] {
  return [
    'CREATE TABLE IF NOT EXISTS store_meta (\n  key TEXT PRIMARY KEY NOT NULL,\n  value TEXT NOT NULL\n);',
    'CREATE TABLE IF NOT EXISTS schema_migrations (\n' +
      '  version INTEGER PRIMARY KEY NOT NULL,\n' +
      '  name TEXT NOT NULL,\n' +
      '  checksum TEXT NOT NULL,\n' +
      '  applied_at TEXT NOT NULL\n' +
      ');',
  ];
}

/** Full schema text for review/diffing (see db:schema:pg). */
export function buildPostgresSchemaDdl(): string {
  const chunks: string[] = [
    '-- GENERATED from server/db/sqlite/tableSpecs.ts. Do not edit by hand.',
    '-- Regenerate with: npm run db:schema:pg',
    '',
  ];
  for (const spec of TABLE_SPECS) {
    chunks.push(`-- ${spec.label} (DatabaseState.${String(spec.collection)})`);
    chunks.push(...pgTableStatements(spec));
    chunks.push('');
  }
  chunks.push('-- Store-level scalars + migration ledger');
  chunks.push(...pgMetaDdl());
  chunks.push('');
  return chunks.join('\n') + '\n';
}

export function pgScalarKeys(): readonly string[] {
  return SCALAR_STATE_KEYS;
}

// ---------------------------------------------------------------------------
// Versioned migration runner (no live database required to test)
// ---------------------------------------------------------------------------

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

/** Minimal client surface: satisfied by pg.PoolClient and by test fakes. */
export interface MigrationClient {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
}

export function checksum(statements: string[]): string {
  return crypto.createHash('sha256').update(statements.join('\n')).digest('hex');
}

/** The v1 baseline: every spec table, in FK-parent-first spec order. */
export function buildBaselineMigrations(): Migration[] {
  const statements: string[] = [];
  for (const spec of TABLE_SPECS) {
    statements.push(...pgTableStatements(spec));
  }
  statements.push(...pgMetaDdl());
  return [{ version: 1, name: 'baseline-spec-tables', statements }];
}

export async function ensureMigrationsTable(client: MigrationClient): Promise<void> {
  await client.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (\n' +
      '  version INTEGER PRIMARY KEY NOT NULL,\n' +
      '  name TEXT NOT NULL,\n' +
      '  checksum TEXT NOT NULL,\n' +
      '  applied_at TEXT NOT NULL\n' +
      ');'
  );
}

/** version -> checksum for everything previously applied. */
export async function appliedMigrations(client: MigrationClient): Promise<Map<number, string>> {
  await ensureMigrationsTable(client);
  const res = await client.query('SELECT version, checksum FROM schema_migrations ORDER BY version');
  const out = new Map<number, string>();
  for (const row of res.rows || []) {
    out.set(Number(row.version), String(row.checksum));
  }
  return out;
}

/**
 * Apply every pending migration in version order, one transaction each.
 * Throws (applying nothing further) when:
 * - a previously applied migration's checksum differs (source drift —
 *   editing history is how two databases silently diverge), or
 * - the list skips a version below its own maximum (a gap means a migration
 *   exists somewhere that this process cannot see).
 */
export async function applyPendingMigrations(
  client: MigrationClient,
  migrations: Migration[]
): Promise<{ applied: number[] }> {
  const ordered = [...migrations].sort((a, b) => a.version - b.version);
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i].version !== ordered[i - 1].version + 1) {
      throw new Error(
        `Migration gap: have v${ordered[i - 1].version} then v${ordered[i].version}. ` +
          'Refusing to apply an incomplete chain.'
      );
    }
  }
  const applied = await appliedMigrations(client);
  const done: number[] = [];
  for (const m of ordered) {
    const want = checksum(m.statements);
    const have = applied.get(m.version);
    if (have !== undefined) {
      if (have !== want) {
        throw new Error(
          `Migration v${m.version} (${m.name}) checksum mismatch: the applied migration ` +
            'differs from this source. Refusing to continue.'
        );
      }
      continue;
    }
    await client.query('BEGIN');
    try {
      for (const stmt of m.statements) {
        await client.query(stmt);
      }
      await client.query(
        'INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES ($1, $2, $3, $4)',
        [m.version, m.name, want, new Date().toISOString()]
      );
      await client.query('COMMIT');
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch { /* already failed */ }
      throw err;
    }
    done.push(m.version);
  }
  return { applied: done };
}
