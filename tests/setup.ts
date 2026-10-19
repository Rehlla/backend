import fs from 'fs';
import path from 'path';
import { db } from '../server/db/database';
import { InMemoryPersistenceAdapter } from '../server/db/adapters/InMemoryPersistenceAdapter';

/**
 * Test isolation.
 *
 * The Database singleton defaults to JsonFilePersistenceAdapter, which reads and
 * WRITES data/dahab_db.json — the real store holding user records, live session
 * tokens and the ledger. Without this, running the suite mutates production
 * data: the first draft of the ledger tests truncated the live ledger table.
 *
 * This runs at MODULE level, not inside beforeAll. Vitest imports setup files
 * before test files, but a `beforeAll` hook only fires after every test module
 * has been imported — and those imports pull in services that write on load.
 * Swapping the adapter here closes that window.
 */
db.setAdapter(new InMemoryPersistenceAdapter());

if (db.getAdapter().constructor.name !== 'InMemoryPersistenceAdapter') {
  throw new Error(
    `Test isolation failed: database adapter is ${db.getAdapter().constructor.name}. ` +
    'Tests must never run against the JSON file store.'
  );
}

/**
 * Tripwire.
 *
 * The adapter swap above is the isolation; this proves it. Comparing the file's
 * checksum before and after a run does NOT prove it — a dev server on port 3000
 * rewrites data/dahab_db.json every few seconds, so that check reports a false
 * failure whenever one is running, and would report a false pass if the write
 * happened to land between samples.
 *
 * Any write to the real store from inside the test process now fails loudly and
 * names the test that did it, instead of silently corrupting the file.
 */
const REAL_DB = path.join(process.cwd(), 'data', 'dahab_db.json');

/**
 * Matches the real store and its sibling temp files (REAL_DB + '.<pid>...tmp'),
 * and nothing else — so a test may point a JsonFilePersistenceAdapter at its own
 * throwaway directory, which is how the persistence tests exercise real writes.
 */
const isRealStore = (target: unknown): target is string =>
  typeof target === 'string' && path.resolve(target).startsWith(REAL_DB);

const breach = (api: string, target: string): never => {
  throw new Error(
    `Test isolation breach: fs.${api} targeted the real database (${target}). ` +
    'Tests must use InMemoryPersistenceAdapter, or their own temp directory.'
  );
};

const realOpenSync = fs.openSync.bind(fs);
const realWriteFileSync = fs.writeFileSync.bind(fs);
const realRenameSync = fs.renameSync.bind(fs);

fs.openSync = ((file: never, flags: never, ...rest: never[]) => {
  // Guard writes only; loading the real state is harmless and some modules do it.
  if (isRealStore(file) && String(flags) !== 'r') breach('openSync', file);
  return realOpenSync(file, flags, ...rest);
}) as typeof fs.openSync;

fs.writeFileSync = ((file: never, ...rest: never[]) => {
  if (isRealStore(file)) breach('writeFileSync', file);
  return realWriteFileSync(file, ...rest);
}) as typeof fs.writeFileSync;

fs.renameSync = ((from: never, to: never) => {
  if (isRealStore(from)) breach('renameSync', from);
  if (isRealStore(to)) breach('renameSync', to);
  return realRenameSync(from, to);
}) as typeof fs.renameSync;
