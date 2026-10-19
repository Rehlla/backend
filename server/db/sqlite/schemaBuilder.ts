import { TABLE_SPECS, TableSpec, ColumnSpec } from './tableSpecs';

/**
 * Turns the table specs into DDL and into the row<->entity mapping.
 *
 * Both directions are generated from the same spec, so a column can never
 * exist in the schema without a mapping or vice versa.
 */

function columnDdl(c: ColumnSpec): string {
  const parts = [`  ${c.name} ${c.type}`];
  if (c.notNull) parts.push('NOT NULL');
  if (c.unique) parts.push('UNIQUE');
  if (c.references) {
    parts.push(`REFERENCES ${c.references.table}(id) ON DELETE ${c.references.onDelete}`);
  }
  return parts.join(' ');
}

export function tableDdl(spec: TableSpec): string {
  const lines: string[] = [
    // The entity key is the primary key. Declared TEXT NOT NULL rather than
    // INTEGER, because every id in this system is a meaningful string
    // ('DHB-TRF-2026-042'), and rowid aliasing would invite a second identity.
    '  id TEXT PRIMARY KEY NOT NULL',
    // Position of the row in the in-memory collection.
    //
    // A SELECT without ORDER BY has no defined order, and this application
    // depends on the order of several collections: the ledger's hash chain
    // links each entry to the one before it *by array position*, and
    // notifications, marketAlerts, knowledgeSnapshots and auditEvents are all
    // built with unshift(), so newest-first is the meaning of the array. Losing
    // that on reload would silently break the chain and reverse those lists.
    '  seq INTEGER NOT NULL',
    ...spec.columns.map(columnDdl),
    // The complete entity. Reads hydrate from here, so nothing is ever lost to
    // a column that the spec has not promoted yet.
    '  data TEXT NOT NULL'
  ];
  return `CREATE TABLE IF NOT EXISTS ${spec.table} (\n${lines.join(',\n')}\n);`;
}

export function indexDdl(spec: TableSpec): string[] {
  // Every hydrate is `ORDER BY seq`, so this is the one index every table needs.
  const out: string[] = [`CREATE INDEX IF NOT EXISTS idx_${spec.table}_seq ON ${spec.table}(seq);`];
  for (const c of spec.columns) {
    // A UNIQUE column already has an implicit index; a second one is dead weight.
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

/**
 * Brings an existing table up to its spec, column by column.
 *
 * `CREATE TABLE IF NOT EXISTS` only ever creates; it is a no-op for a table
 * that predates the spec's newest column, and the very next thing the adapter
 * does — prepare the upsert — names every column, so a spec that grows a
 * promoted column used to make every boot (and every test run) die on
 * "has no column named". Adding a column to a live table must be a routine,
 * self-healing step rather than a hand-run script.
 *
 * SQLite's ALTER TABLE can append a column but not attach UNIQUE to it, so a
 * unique column gets a unique index instead — same enforcement, one statement
 * later. NOT NULL is dropped on the ALTER path: reads hydrate from `data`, so
 * a NULL in a promoted column of a pre-existing row is harmless, and refusing
 * the boot over it would be the opposite of a migration.
 */
export function ensureSchemaColumns(sqlite: {
  prepare(sql: string): { all(): unknown[] };
  exec(sql: string): void;
}): string[] {
  const applied: string[] = [];
  for (const spec of TABLE_SPECS) {
    const existing = new Set(
      (sqlite.prepare(`PRAGMA table_info(${spec.table})`).all() as Array<{ name: string }>).map(
        c => c.name
      )
    );
    if (existing.size === 0) continue; // table does not exist yet; CREATE handles it

    for (const c of spec.columns) {
      if (existing.has(c.name)) continue;
      sqlite.exec(`ALTER TABLE ${spec.table} ADD COLUMN ${c.name} ${c.type};`);
      applied.push(`${spec.table}.${c.name}`);
      if (c.unique) {
        sqlite.exec(
          `CREATE UNIQUE INDEX IF NOT EXISTS idx_${spec.table}_${c.name}_uniq ON ${spec.table}(${c.name});`
        );
      }
      if (c.index && !c.unique) {
        sqlite.exec(
          `CREATE INDEX IF NOT EXISTS idx_${spec.table}_${c.name} ON ${spec.table}(${c.name});`
        );
      }
    }

    for (const cols of spec.compositeIndexes || []) {
      // Recreate composite indexes whose columns only arrived with this pass.
      if (!cols.every(name => existing.has(name))) {
        sqlite.exec(
          `CREATE INDEX IF NOT EXISTS idx_${spec.table}_${cols.join('_')} ON ${spec.table}(${cols.join(', ')});`
        );
      }
    }
  }
  return applied;
}

export function buildSchemaDdl(): string {
  const chunks: string[] = [
    '-- GENERATED from server/db/sqlite/tableSpecs.ts. Do not edit by hand.',
    '-- Regenerate with: npm run db:schema',
    ''
  ];
  for (const spec of TABLE_SPECS) {
    chunks.push(`-- ${spec.label} (DatabaseState.${String(spec.collection)})`);
    chunks.push(tableDdl(spec));
    const idx = indexDdl(spec);
    if (idx.length) chunks.push(idx.join('\n'));
    chunks.push('');
  }

  // Scalars that belong to the store as a whole rather than to any collection:
  // schema version, the monotonic fencing counter, and the last checkpoint.
  chunks.push('-- Store-level scalars (version, fencingSequence, lastCheckpoint)');
  chunks.push(
    'CREATE TABLE IF NOT EXISTS store_meta (\n' +
      '  key TEXT PRIMARY KEY NOT NULL,\n' +
      '  value TEXT NOT NULL\n' +
      ');'
  );
  chunks.push('');

  // Rows that cannot satisfy a foreign key are moved here rather than dropped.
  // The audit found 8 of them already in the JSON store; a migration that
  // silently discarded a paid booking would be worse than the problem.
  chunks.push('-- Rows that failed a constraint during migration. Never written by the app.');
  chunks.push(
    'CREATE TABLE IF NOT EXISTS _quarantine (\n' +
      '  id TEXT NOT NULL,\n' +
      '  source_table TEXT NOT NULL,\n' +
      '  reason TEXT NOT NULL,\n' +
      '  quarantined_at TEXT NOT NULL,\n' +
      '  data TEXT NOT NULL,\n' +
      '  PRIMARY KEY (source_table, id)\n' +
      ');'
  );

  return chunks.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Row <-> entity mapping
// ---------------------------------------------------------------------------

export interface SqlRow {
  id: string;
  seq: number;
  data: string;
  [column: string]: unknown;
}

function promote(value: unknown, c: ColumnSpec): unknown {
  if (value === undefined || value === null) return null;
  if (c.boolean) return value ? 1 : 0;
  if (c.type === 'INTEGER') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  if (c.type === 'REAL') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }
  // TEXT. Objects would stringify to '[object Object]' and quietly poison an
  // indexed column, so anything non-primitive is refused rather than coerced.
  if (typeof value === 'object') return null;
  return String(value);
}

/**
 * Builds the SQL row for an entity: the promoted columns plus the whole entity
 * as JSON. `data` is the source of truth on read; the columns exist so SQLite
 * can enforce and index.
 */
export function entityToRow(spec: TableSpec, entity: Record<string, any>, seq: number): SqlRow {
  const key = entity[spec.key];
  if (key === undefined || key === null || key === '') {
    throw new Error(
      `[sqlite] ${spec.table}: entity is missing its key field '${spec.key}'. ` +
        `Keys: ${Object.keys(entity).slice(0, 12).join(', ')}`
    );
  }
  const row: SqlRow = { id: String(key), seq, data: JSON.stringify(entity) };
  for (const c of spec.columns) {
    row[c.name] = promote(entity[c.field], c);
  }
  return row;
}

/** Reads the entity back. Always from `data` — never reassembled from columns. */
export function rowToEntity<T = Record<string, any>>(row: { data: string }): T {
  return JSON.parse(row.data) as T;
}

export function columnNames(spec: TableSpec): string[] {
  return ['id', 'seq', ...spec.columns.map(c => c.name), 'data'];
}

/** `INSERT ... ON CONFLICT(id) DO UPDATE` over every column the spec defines. */
export function upsertSql(spec: TableSpec): string {
  const cols = columnNames(spec);
  const placeholders = cols.map(c => `@${c}`);
  const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`);
  return (
    `INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
    `ON CONFLICT(id) DO UPDATE SET ${updates.join(', ')}`
  );
}
