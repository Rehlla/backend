import { describe, it, expect, afterEach } from 'vitest';
import { db } from '../server/db/database';
import { JsonFilePersistenceAdapter } from '../server/db/adapters/JsonFilePersistenceAdapter';
import { InMemoryPersistenceAdapter } from '../server/db/adapters/InMemoryPersistenceAdapter';

/**
 * Guards the guard.
 *
 * tests/setup.ts swaps in the in-memory adapter and installs an fs tripwire so
 * the suite can never touch data/dahab_db.json — which holds real user records,
 * live session tokens and the ledger. A tripwire that has never been observed
 * to fire is indistinguishable from no tripwire at all, which is precisely the
 * self-certification pattern this codebase was audited for. So: prove it fires.
 */
describe('test isolation', () => {
  afterEach(() => db.setAdapter(new InMemoryPersistenceAdapter()));

  it('runs the suite against the in-memory adapter, never the JSON file', () => {
    expect(db.getAdapter().constructor.name).toBe('InMemoryPersistenceAdapter');
  });

  it('blocks a write to the real database file if the adapter is ever restored', () => {
    // An explicit initialState short-circuits loadFromDisk(), so the assertion
    // targets save() itself and does not depend on whether this particular
    // machine happens to have a data/dahab_db.json. Without it, the breach
    // depended on loadFromDisk falling through to a write — true only when the
    // file is absent, so the guard passed in CI and failed on every developer
    // machine that had actually run the server, which is where it matters most.
    const adapter = new JsonFilePersistenceAdapter(undefined, db.state);

    expect(() => adapter.save()).toThrow(/Test isolation breach/);

    // Nothing was written, and the live adapter was never swapped out.
    expect(db.getAdapter().constructor.name).toBe('InMemoryPersistenceAdapter');
  });
});
