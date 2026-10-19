import { TABLE_SPECS, type TableSpec } from '../sqlite/tableSpecs';
import { entityToRow } from '../sqlite/schemaBuilder';

/**
 * PostgreSQL flush planner — the save() half of the spec-pattern port.
 *
 * Mirrors SqlitePersistenceAdapter's shadow-diff semantics exactly, so a
 * collection reorder, an unshift of an audit log, or a one-field edit costs
 * the same here as it does on SQLite: deletes child-first, upserts
 * parent-first, one transaction. `data` stays the JSONB source of truth and
 * promoted columns exist for constraints/indexes — identical to the SQLite
 * row contract (see schemaBuilder.entityToRow).
 *
 * The planner is pure (no pg dependency): PostgresPersistenceAdapter executes
 * the plan through a pool, and the tests exercise the plan itself.
 */

export type FlushKind = 'upsert' | 'delete' | 'reseq' | 'meta';

export interface FlushStatement {
  sql: string;
  params: unknown[];
  table: string;
  kind: FlushKind;
}

export interface FlushPlan {
  statements: FlushStatement[];
  /**
   * Shadow to install after a successful flush — mirrors the adapter's
   * in-memory shadow so the next save() diffs against what was written.
   */
  nextShadow: Map<string, Map<string, { data: string; seq: number }>>;
}

/** PostgreSQL upsert over every column the spec defines (id, seq, promoted, data). */
export function pgUpsertSql(spec: TableSpec): string {
  const cols = ['id', 'seq', ...spec.columns.map(c => c.name), 'data'];
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const updates = cols.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`);
  return (
    `INSERT INTO ${spec.table} (${cols.join(', ')}) VALUES (${placeholders.join(', ')}) ` +
    `ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`
  );
}

export function pgDeleteSql(table: string): string {
  return `DELETE FROM ${table} WHERE id = $1`;
}

export function pgReseqSql(table: string): string {
  return `UPDATE ${table} SET seq = $1 WHERE id = $2`;
}

export function pgMetaSql(): string {
  return 'INSERT INTO store_meta (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
}

/**
 * Builds the ordered statement list for one flush.
 *
 * Ordering rules (same as SqlitePersistenceAdapter.flushAll):
 *  - deletes run child-first (reverse TABLE_SPECS order) so a removed parent
 *    never trips a child's FK mid-flush;
 *  - upserts run parent-first (TABLE_SPECS order) so a new parent exists
 *    before its children reference it;
 *  - store_meta (version/fencingSequence/lastCheckpoint) is written last.
 *
 * Diffing: a row is written only when its serialised `data` changed, or (for
 * a position move) via a cheap one-integer reseq UPDATE — the same contract
 * that keeps SQLite logins from rewriting the knowledge base.
 */
export function planFlush(
  state: Record<string, any>,
  shadow: Map<string, Map<string, { data: string; seq: number }>>,
  checkpoint: string
): FlushPlan {
  const statements: FlushStatement[] = [];
  const nextShadow = new Map<string, Map<string, { data: string; seq: number }>>();

  // Children before parents on the way out.
  for (let idx = TABLE_SPECS.length - 1; idx >= 0; idx--) {
    const spec = TABLE_SPECS[idx];
    const collection = state[spec.collection as string];
    const previous = shadow.get(spec.table);
    if (!Array.isArray(collection) || !previous || previous.size === 0) continue;
    const live = new Set(collection.map(e => String(e[spec.key])));
    for (const id of previous.keys()) {
      if (!live.has(id)) {
        statements.push({ sql: pgDeleteSql(spec.table), params: [id], table: spec.table, kind: 'delete' });
      }
    }
  }

  // Parents before children on the way in.
  for (const spec of TABLE_SPECS) {
    const collection = state[spec.collection as string];
    if (!Array.isArray(collection)) continue;
    const previous = shadow.get(spec.table) ?? new Map<string, { data: string; seq: number }>();
    const next = new Map<string, { data: string; seq: number }>();
    const upsertSql = pgUpsertSql(spec);
    const cols = ['id', 'seq', ...spec.columns.map(c => c.name), 'data'];
    for (let index = 0; index < collection.length; index++) {
      const row = entityToRow(spec, collection[index], index);
      next.set(row.id, { data: row.data, seq: index });
      const before = previous.get(row.id);
      if (!before || before.data !== row.data) {
        statements.push({
          sql: upsertSql,
          params: cols.map(c => row[c]),
          table: spec.table,
          kind: 'upsert',
        });
      } else if (before.seq !== index) {
        statements.push({ sql: pgReseqSql(spec.table), params: [index, row.id], table: spec.table, kind: 'reseq' });
      }
    }
    nextShadow.set(spec.table, next);
  }

  const meta: ReadonlyArray<readonly [string, string]> = [
    ['version', String(state.version ?? 1)],
    ['fencingSequence', String(state.fencingSequence ?? 1000)],
    ['lastCheckpoint', checkpoint],
  ];
  for (const [key, value] of meta) {
    statements.push({ sql: pgMetaSql(), params: [key, value], table: 'store_meta', kind: 'meta' });
  }

  return { statements, nextShadow };
}