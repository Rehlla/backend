/**
 * Integrity report for the SQLite store.
 *
 *   npm run db:check
 *
 * The JSON store could not answer any of these questions, which is how it
 * accumulated a paid booking pointing at a trip that did not exist. Here they
 * are all answerable, and most are answered by the engine itself.
 */
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { TABLE_SPECS } from './tableSpecs';
import { SQLITE_FILE } from '../paths';

const SQLITE_PATH = process.argv[2] || SQLITE_FILE();

function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`No database at ${SQLITE_PATH}. Run: npm run db:migrate`);
    process.exit(1);
  }

  const sqlite = new Database(SQLITE_PATH, { readonly: true });
  sqlite.pragma('foreign_keys = ON');
  let failures = 0;

  console.log(`Database: ${SQLITE_PATH} (${(fs.statSync(SQLITE_PATH).size / 1048576).toFixed(2)} MB)`);
  console.log('');

  // 1. Structural integrity of the file itself.
  const integrity = sqlite.pragma('integrity_check', { simple: true });
  console.log(`integrity_check      : ${integrity}`);
  if (integrity !== 'ok') failures++;

  // 2. Every declared foreign key, checked by SQLite rather than by a script
  //    that might not know about a relationship.
  const fkViolations = sqlite.pragma('foreign_key_check') as Array<{
    table: string;
    rowid: number;
    parent: string;
    fkid: number;
  }>;
  console.log(`foreign_key_check    : ${fkViolations.length === 0 ? 'ok' : `${fkViolations.length} violation(s)`}`);
  for (const v of fkViolations.slice(0, 20)) {
    console.log(`   ${v.table} row ${v.rowid} -> ${v.parent}`);
  }
  if (fkViolations.length) failures++;

  // 3. Row counts, and confirmation that `data` still parses everywhere. A
  //    column can be right while the document it mirrors is corrupt.
  let total = 0;
  let unparseable = 0;
  const perTable: Array<[string, number]> = [];
  for (const spec of TABLE_SPECS) {
    const rows = sqlite.prepare(`SELECT id, data FROM ${spec.table}`).all() as Array<{ id: string; data: string }>;
    total += rows.length;
    for (const r of rows) {
      try {
        JSON.parse(r.data);
      } catch {
        unparseable++;
        console.log(`   unparseable data: ${spec.table}/${r.id}`);
      }
    }
    if (rows.length) perTable.push([spec.label, rows.length]);
  }
  console.log(`json documents       : ${unparseable === 0 ? 'ok' : `${unparseable} unparseable`}`);
  if (unparseable) failures++;

  // 4. Double-entry balance. Every ledger entry moves value between two
  //    accounts, so the sum across all accounts must be exactly zero.
  const ledger = sqlite.prepare('SELECT debit_account, credit_account, amount_egp FROM ledger_entries').all() as Array<{
    debit_account: string;
    credit_account: string;
    amount_egp: number;
  }>;
  const balances = new Map<string, number>();
  for (const e of ledger) {
    balances.set(e.debit_account, (balances.get(e.debit_account) || 0) - e.amount_egp);
    balances.set(e.credit_account, (balances.get(e.credit_account) || 0) + e.amount_egp);
  }
  const net = [...balances.values()].reduce((a, b) => a + b, 0);
  console.log(`ledger nets to zero  : ${net === 0 ? 'ok' : `OFF BY ${net}`}  (${ledger.length} entries)`);
  if (net !== 0) failures++;

  // 5. Sessions past their expiry are dead weight; the store has no sweeper.
  const staleSessions = (
    sqlite.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at < ?').get(new Date().toISOString()) as {
      n: number;
    }
  ).n;
  console.log(`expired sessions     : ${staleSessions}`);

  // 6. Holds still marked ACTIVE past their TTL.
  const staleHolds = (
    sqlite
      .prepare("SELECT COUNT(*) AS n FROM holds WHERE status = 'ACTIVE' AND expires_at < ?")
      .get(new Date().toISOString()) as { n: number }
  ).n;
  console.log(`expired active holds : ${staleHolds}`);

  // 7. References that are indexed but deliberately not constrained.
  //
  //    The money tables carry trip_id without a foreign key, so that a deleted
  //    trip can never cascade away a payment or a ledger entry. That choice
  //    means a gap can exist, so it has to be reported rather than assumed
  //    away — this is the check that keeps "no FK" from meaning "unwatched".
  const advisory: Array<[string, string]> = [
    ['bookings', 'trip_id'],
    ['payments', 'trip_id'],
    ['ledger_entries', 'trip_id'],
    ['activities', 'supplier_id'],
    ['notifications', 'user_id']
  ];
  console.log('');
  console.log('unconstrained references (indexed, reported not enforced):');
  for (const [table, column] of advisory) {
    const parent = column === 'trip_id' ? 'trips' : column === 'supplier_id' ? 'suppliers' : 'users';
    const dangling = sqlite
      .prepare(
        `SELECT ${table}.id AS id, ${table}.${column} AS ref FROM ${table} ` +
          `LEFT JOIN ${parent} ON ${parent}.id = ${table}.${column} ` +
          `WHERE ${table}.${column} IS NOT NULL AND ${parent}.id IS NULL`
      )
      .all() as Array<{ id: string; ref: string }>;
    // 'ALL' on notifications is a broadcast selector, not a user id.
    const real = dangling.filter(d => !(table === 'notifications' && d.ref === 'ALL'));
    console.log(`  ${`${table}.${column}`.padEnd(26)} ${real.length === 0 ? 'ok' : `${real.length} dangling`}`);
    for (const d of real.slice(0, 5)) {
      console.log(`     ${d.id} -> ${parent}/${d.ref} (missing)`);
    }
  }
  console.log('');

  // 8. Anything the migration could not admit.
  const quarantined = sqlite
    .prepare('SELECT source_table, id, reason FROM _quarantine ORDER BY source_table, id')
    .all() as Array<{ source_table: string; id: string; reason: string }>;
  console.log(`quarantined rows     : ${quarantined.length}`);
  for (const q of quarantined) {
    console.log(`   ${q.source_table.padEnd(20)} ${q.id.padEnd(34)} ${q.reason}`);
  }

  console.log('');
  console.log(`${total} rows across ${perTable.length} non-empty tables.`);
  console.log('');
  console.log(failures === 0 ? 'PASS — no integrity failures.' : `FAIL — ${failures} check(s) failed.`);
  sqlite.close();
  process.exit(failures === 0 ? 0 : 1);
}

main();
