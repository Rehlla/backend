/**
 * One-off migration: data/dahab_db.json -> data/dahab.sqlite
 *
 *   npx tsx server/db/sqlite/migrateJsonToSqlite.ts [--dry-run] [--quarantine] [--force]
 *
 * The JSON store could not express a foreign key, so it accumulated rows that
 * point at things which no longer exist — the audit found 8, including a paid
 * booking, a payment and two ledger entries whose trip is gone. A migration
 * that just inserted everything would either fail halfway or, worse, be run
 * with constraints off and carry the defect into the new database.
 *
 * So the default is to refuse and report. `--quarantine` proceeds, moving
 * every rejected row into the `_quarantine` table with the reason, because
 * discarding a paid booking to make a migration pass is not an option.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { TABLE_SPECS, TableSpec } from './tableSpecs';
import { buildSchemaDdl, entityToRow, upsertSql } from './schemaBuilder';
import { SQLITE_FILE, JSON_STORE_FILE } from '../paths';

interface Rejection {
  table: string;
  id: string;
  reason: string;
  /**
   * The offending row itself, not just its id.
   *
   * Identity matters for duplicates: rejecting by id would skip *every* copy of
   * a duplicated key and drop the row from the active table altogether. Keeping
   * the object reference lets the first occurrence through and quarantines only
   * the extras. It also collapses a row that fails two constraints at once into
   * a single quarantine entry.
   */
  entity: any;
}

const JSON_PATH = JSON_STORE_FILE();
const SQLITE_PATH = SQLITE_FILE();

function loadJsonStore(): Record<string, any> {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`No JSON store found at ${JSON_PATH}. Nothing to migrate.`);
  }
  return JSON.parse(fs.readFileSync(JSON_PATH, 'utf-8'));
}

/**
 * Finds every row that the schema will reject, before writing anything.
 *
 * Two classes: a duplicate primary key (the JSON store has one already, in
 * marketRefreshRuns) and a foreign key with no parent.
 */
function findRejections(store: Record<string, any>): Rejection[] {
  const rejections: Rejection[] = [];

  // Parent key sets, built from the same specs the FKs are declared against.
  const keysByTable = new Map<string, Set<string>>();
  for (const spec of TABLE_SPECS) {
    const rows: any[] = store[spec.collection as string] || [];
    keysByTable.set(spec.table, new Set(rows.map(e => String(e[spec.key]))));
  }

  for (const spec of TABLE_SPECS) {
    const rows: any[] = store[spec.collection as string] || [];
    const seen = new Set<string>();

    for (const entity of rows) {
      const rawKey = entity[spec.key];
      const id = String(rawKey);

      if (rawKey === undefined || rawKey === null || rawKey === '') {
        rejections.push({ table: spec.table, id: '(missing)', reason: `missing key field '${spec.key}'`, entity });
        continue;
      }
      if (seen.has(id)) {
        rejections.push({ table: spec.table, id, reason: `duplicate primary key '${id}'`, entity });
        continue;
      }
      seen.add(id);

      for (const col of spec.columns) {
        if (!col.references) continue;
        const value = entity[col.field];
        if (value === undefined || value === null || value === '') {
          if (col.notNull) {
            rejections.push({ table: spec.table, id, reason: `${col.field} is required but empty`, entity });
          }
          continue;
        }
        const parents = keysByTable.get(col.references.table);
        if (parents && !parents.has(String(value))) {
          rejections.push({
            table: spec.table,
            id,
            reason: `${col.field}='${value}' has no row in ${col.references.table}`,
            entity
          });
        }
      }
    }
  }

  return rejections;
}

function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const quarantine = argv.includes('--quarantine');
  const force = argv.includes('--force');

  const store = loadJsonStore();
  console.log(`Source : ${JSON_PATH}`);
  console.log(`Target : ${SQLITE_PATH}`);
  console.log('');

  const rejections = findRejections(store);

  // Keyed by object identity, so the surviving copy of a duplicated key is not
  // skipped along with the extra one, and a row failing two constraints is
  // quarantined once with both reasons.
  const rejectedRows = new Map<any, { table: string; id: string; reasons: string[] }>();
  for (const r of rejections) {
    const existing = rejectedRows.get(r.entity);
    if (existing) existing.reasons.push(r.reason);
    else rejectedRows.set(r.entity, { table: r.table, id: r.id, reasons: [r.reason] });
  }

  if (rejections.length) {
    console.log(`Rows the schema will reject: ${rejections.length}`);
    for (const r of rejections) {
      console.log(`  ${r.table.padEnd(22)} ${r.id.padEnd(34)} ${r.reason}`);
    }
    console.log('');
    if (!quarantine && !dryRun) {
      console.error(
        'Refusing to migrate. These rows cannot satisfy the new constraints.\n' +
          'Re-run with --quarantine to move them into the _quarantine table and\n' +
          'migrate everything else. They are preserved in full either way — nothing\n' +
          'is deleted.'
      );
      process.exit(1);
    }
  } else {
    console.log('No constraint violations found in the source data.');
    console.log('');
  }

  if (dryRun) {
    console.log('--dry-run: nothing written.');
    return;
  }

  if (fs.existsSync(SQLITE_PATH) && !force) {
    console.error(
      `${SQLITE_PATH} already exists. Re-run with --force to migrate into it anyway\n` +
        '(rows are upserted by primary key, so this is safe to repeat), or move the\n' +
        'existing file aside first.'
    );
    process.exit(1);
  }

  const sqlite = new Database(SQLITE_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(buildSchemaDdl());

  const counts: Array<{ label: string; table: string; inserted: number; skipped: number }> = [];
  const quarantineStmt = sqlite.prepare(
    'INSERT INTO _quarantine (id, source_table, reason, quarantined_at, data) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(source_table, id) DO UPDATE SET reason = excluded.reason, data = excluded.data'
  );
  const now = new Date().toISOString();

  const migrate = sqlite.transaction(() => {
    for (const spec of TABLE_SPECS) {
      const rows: any[] = store[spec.collection as string] || [];
      const stmt = sqlite.prepare(upsertSql(spec));
      let inserted = 0;
      let skipped = 0;

      for (const entity of rows) {
        if (rejectedRows.has(entity)) {
          skipped++;
          continue;
        }
        // seq is the position in the source array, so the collection order the
        // application depends on — the ledger chain, and the newest-first lists
        // built with unshift() — survives the migration intact.
        stmt.run(entityToRow(spec, entity, inserted));
        inserted++;
      }
      counts.push({ label: spec.label, table: spec.table, inserted, skipped });
    }

    for (const [entity, info] of rejectedRows) {
      quarantineStmt.run(info.id, info.table, info.reasons.join('; '), now, JSON.stringify(entity));
    }

    const meta = sqlite.prepare(
      'INSERT INTO store_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    meta.run('version', String(store.version ?? 1));
    meta.run('fencingSequence', String(store.fencingSequence ?? 1000));
    meta.run('lastCheckpoint', new Date().toISOString());
  });

  migrate();

  const totalIn = counts.reduce((a, c) => a + c.inserted, 0);
  const totalSkipped = counts.reduce((a, c) => a + c.skipped, 0);

  console.log('Migrated:');
  for (const c of counts.filter(c => c.inserted || c.skipped)) {
    const skip = c.skipped ? `  (${c.skipped} quarantined)` : '';
    console.log(`  ${String(c.inserted).padStart(5)}  ${c.label}${skip}`);
  }
  console.log('');
  console.log(`  ${totalIn} rows migrated, ${totalSkipped} quarantined.`);

  // Verify the row counts landed, rather than trusting the loop that wrote them.
  let verified = 0;
  for (const spec of TABLE_SPECS) {
    const n = sqlite.prepare(`SELECT COUNT(*) AS n FROM ${spec.table}`).get() as { n: number };
    verified += n.n;
  }
  const quarantined = (sqlite.prepare('SELECT COUNT(*) AS n FROM _quarantine').get() as { n: number }).n;
  console.log(`  Verified in database: ${verified} rows + ${quarantined} quarantined.`);

  if (verified !== totalIn) {
    console.error(`  MISMATCH: expected ${totalIn}, found ${verified}.`);
    process.exit(1);
  }

  const size = fs.statSync(SQLITE_PATH).size;
  console.log(`  ${SQLITE_PATH}  (${(size / 1048576).toFixed(2)} MB)`);
  sqlite.close();
}

main();
