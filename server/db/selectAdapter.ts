import fs from 'fs';
import path from 'path';
import { IPersistenceAdapter } from './adapters/IPersistenceAdapter';
import { JsonFilePersistenceAdapter } from './adapters/JsonFilePersistenceAdapter';
import { PostgresPersistenceAdapter } from './adapters/PostgresPersistenceAdapter';
import { SqlitePersistenceAdapter } from './sqlite/SqlitePersistenceAdapter';
import { SQLITE_FILE, JSON_STORE_FILE } from './paths';

export type AdapterName = 'sqlite' | 'json' | 'postgres';

/**
 * Chooses the persistence adapter, and refuses rather than guess when the
 * choice would lose data.
 *
 * SQLite is the default. `PERSISTENCE_ADAPTER=json` still selects the old
 * single-file store, which remains supported for tests and for a rollback.
 */
export function selectAdapter(env: NodeJS.ProcessEnv = process.env): IPersistenceAdapter {
  const requested = (env.PERSISTENCE_ADAPTER || 'sqlite').toLowerCase() as AdapterName;

  if (requested === 'json') {
    return new JsonFilePersistenceAdapter();
  }

  if (requested === 'postgres') {
    // Real persistence since the save() port: diffed shadow-write flushes to
    // the spec-generated schema. Refuses to boot when no connection is
    // configured (see assertUsable).
    PostgresPersistenceAdapter.assertUsable();
    return new PostgresPersistenceAdapter();
  }

  if (requested !== 'sqlite') {
    throw new Error(
      `[DB] Unknown PERSISTENCE_ADAPTER='${requested}'. Valid values: sqlite (default), json, postgres.`
    );
  }

  const sqliteFile = SQLITE_FILE();
  const jsonFile = JSON_STORE_FILE();

  // The one genuinely dangerous case: a populated JSON store sits next to a
  // database that has never been created. Starting SQLite here would come up
  // with an empty schema, seed a fresh admin, and look completely healthy while
  // every existing user, booking and ledger entry sat unread in the file next
  // to it. That is the same class of silent loss the Postgres adapter caused.
  if (!fs.existsSync(sqliteFile) && fs.existsSync(jsonFile)) {
    throw new Error(
      `[DB] ${jsonFile} exists but ${sqliteFile} does not.\n` +
        'Starting on an empty SQLite database would hide the existing store rather than use it.\n' +
        'Migrate first:\n' +
        '    npm run db:migrate\n' +
        'or set PERSISTENCE_ADAPTER=json to keep using the old file store.'
    );
  }

  return new SqlitePersistenceAdapter(sqliteFile);
}
