import { describe, it, expect, beforeEach } from 'vitest';
import { planFlush } from '../../server/db/postgres/pgFlush';
import { PostgresPersistenceAdapter } from '../../server/db/adapters/PostgresPersistenceAdapter';
import { TABLE_SPECS } from '../../server/db/sqlite/tableSpecs';

/**
 * Postgres save() port (blueprint P0 #3, §N "spec pattern ported").
 *
 * The planner is pure; the adapter executes its plan through a pool. These
 * tests exercise both: statement shape/order/diffing without a live database,
 * and the adapter's save() transaction flow through a fake pool.
 */

const emptyShadow = () => new Map<string, Map<string, { data: string; seq: number }>>();

const userEntity = (id: string, email: string) => ({
  id,
  email,
  name: 'Test User',
  phone: '+201000000000',
  passwordHash: 'h'.repeat(64),
  passwordSalt: 's'.repeat(16),
  passwordAlgorithm: 'scrypt',
  role: 'Traveler',
  createdAt: '2026-09-09T00:00:00.000Z',
  updatedAt: '2026-09-09T00:00:00.000Z',
});

describe('planFlush', () => {
  it('emits a single upsert for a new row with promoted columns + JSON data, in spec order', () => {
    const state: any = { version: 1, fencingSequence: 1000, users: [userEntity('U-1', 'a@b.c')] };
    const plan = planFlush(state, emptyShadow(), '2026-09-09T00:00:00.000Z');

    const upserts = plan.statements.filter(s => s.kind === 'upsert');
    expect(upserts.length).toBe(1);
    expect(upserts[0].table).toBe('users');
    expect(upserts[0].sql).toContain('INSERT INTO users (id, seq, email, firebase_uid');
    expect(upserts[0].sql).toContain('ON CONFLICT (id) DO UPDATE SET');
    // [id, seq, ...promoted columns..., data]
    const params = upserts[0].params;
    expect(params[0]).toBe('U-1');
    expect(params[1]).toBe(0);
    expect(params[2]).toBe('a@b.c'); // promoted email column
    const data = params[params.length - 1] as string;
    expect(JSON.parse(data)).toMatchObject({ id: 'U-1', email: 'a@b.c' });
  });

  it('skips unchanged rows entirely', () => {
    const state: any = { version: 1, fencingSequence: 1000, users: [userEntity('U-1', 'a@b.c')] };
    const first = planFlush(state, emptyShadow(), 't1');
    const second = planFlush(state, first.nextShadow, 't2');
    expect(second.statements.filter(s => s.kind !== 'meta').length).toBe(0);
  });

  it('rewrites only the changed row when one of several changes', () => {
    const state: any = {
      version: 1,
      fencingSequence: 1000,
      users: [userEntity('U-1', 'a@b.c'), userEntity('U-2', 'x@y.z')],
    };
    const first = planFlush(state, emptyShadow(), 't1');
    state.users[1] = userEntity('U-2', 'changed@y.z');
    const second = planFlush(state, first.nextShadow, 't2');
    const upserts = second.statements.filter(s => s.kind === 'upsert');
    expect(upserts.length).toBe(1);
    expect((upserts[0].params[2] as string)).toBe('changed@y.z');
  });

  it('turns a pure reorder into cheap reseq updates, not rewrites', () => {
    const state: any = {
      version: 1,
      fencingSequence: 1000,
      users: [userEntity('U-1', 'a@b.c'), userEntity('U-2', 'x@y.z')],
    };
    const first = planFlush(state, emptyShadow(), 't1');
    state.users.reverse();
    const second = planFlush(state, first.nextShadow, 't2');
    expect(second.statements.filter(s => s.kind === 'upsert').length).toBe(0);
    const reseqs = second.statements.filter(s => s.kind === 'reseq');
    expect(reseqs.length).toBe(2);
    expect(reseqs.every(s => s.sql.includes('SET seq = $1'))).toBe(true);
  });

  it('deletes removed rows child-first, before any upsert, and writes meta last', () => {
    const state: any = { version: 1, fencingSequence: 1000, users: [userEntity('U-1', 'a@b.c')] };
    const first = planFlush(state, emptyShadow(), 't1');
    state.users.pop();
    state.users.push(userEntity('U-2', 'new@b.c'));
    const second = planFlush(state, first.nextShadow, 't2');

    const kinds = second.statements.map(s => s.kind);
    const firstDelete = kinds.indexOf('delete');
    const firstUpsert = kinds.indexOf('upsert');
    const lastMeta = kinds.lastIndexOf('meta');
    expect(firstDelete).toBeGreaterThanOrEqual(0);
    // All deletes precede all upserts (children go before parents).
    expect(firstDelete).toBeLessThan(firstUpsert);
    // Meta is the final group (version, fencingSequence, lastCheckpoint).
    expect(lastMeta).toBe(kinds.length - 1);
    const del = second.statements[firstDelete];
    expect(del.sql).toBe('DELETE FROM users WHERE id = $1');
    expect(del.params).toEqual(['U-1']);
  });

  it('emits delete order in reverse TABLE_SPECS order (children first)', () => {
    const state: any = { version: 1, fencingSequence: 1000 };
    // One row in the last two specs; remove both.
    const last = TABLE_SPECS[TABLE_SPECS.length - 1];
    const penult = TABLE_SPECS[TABLE_SPECS.length - 2];
    (state as any)[last.collection as string] = [{ [last.key as string]: 'A-1' }];
    (state as any)[penult.collection as string] = [{ [penult.key as string]: 'B-1' }];
    const first = planFlush(state, emptyShadow(), 't1');
    (state as any)[last.collection as string] = [];
    (state as any)[penult.collection as string] = [];
    const second = planFlush(state, first.nextShadow, 't2');
    const deletes = second.statements.filter(s => s.kind === 'delete');
    expect(deletes.length).toBe(2);
    // The later spec in TABLE_SPECS (the FK child) is deleted first.
    expect(deletes[0].table).toBe(last.table);
    expect(deletes[1].table).toBe(penult.table);
  });
});

// ---------------------------------------------------------------------------
// Adapter-level save() through a fake pool
// ---------------------------------------------------------------------------

class FakeClient {
  statements: { sql: string; params: unknown[] }[] = [];
  constructor(private failOn: string[] = []) {}
  async query(text: string, params: unknown[] = []) {
    this.statements.push({ sql: text, params });
    if (this.failOn.includes(text)) {
      throw new Error(`fake failure on: ${text.slice(0, 40)}`);
    }
    if (text.trim().startsWith('SELECT version, checksum')) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [], rowCount: 0 };
  }
  release() {}
}

class FakePool {
  constructor(public client: FakeClient) {}
  async connect() {
    return this.client;
  }
  async end() {}
  on() {}
}

const blankState = () => undefined; // createEmptyState

describe('PostgresPersistenceAdapter.save()', () => {
  it('persists new rows inside one transaction and diffs the second save away', async () => {
    const client = new FakeClient();
    const adapter = new PostgresPersistenceAdapter(undefined, blankState(), new FakePool(client));
    adapter.getState().users.push(userEntity('U-1', 'a@b.c'));

    await adapter.save();
    const all = client.statements.map(s => s.sql);
    // Lazy schema init runs first (its own transaction, ending with the
    // schema_migrations record); the save's transaction comes after it.
    // The migration runner commits immediately after its schema_migrations
    // record; the save's own transaction begins on the next statement.
    const saveStart = all.lastIndexOf('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES ($1, $2, $3, $4)') + 2;
    const first = all.slice(saveStart);
    expect(first[0]).toBe('BEGIN');
    expect(first.some(s => s.startsWith('INSERT INTO users'))).toBe(true);
    expect(first[first.length - 1]).toBe('COMMIT');

    const beforeSecond = client.statements.length;
    // No mutation: the diff writes nothing but the always-emitted store_meta
    // row + its transaction wrappers (same contract as the SQLite adapter).
    await adapter.save();
    const metaOnly = client.statements.slice(beforeSecond);
    expect(metaOnly.filter(s => !s.sql.startsWith('INSERT INTO store_meta') && !['BEGIN', 'COMMIT'].includes(s.sql)).length).toBe(0);

    // One mutation: exactly one upsert (plus its transaction wrappers).
    adapter.getState().users[0].email = 'new@b.c';
    await adapter.save();
    const added = client.statements.slice(beforeSecond);
    const upserts = added.filter(s => s.sql.startsWith('INSERT INTO users'));
    expect(upserts.length).toBe(1);
    expect(JSON.parse(upserts[0].params[upserts[0].params.length - 1] as string).email).toBe('new@b.c');

    // Removal issues a DELETE.
    adapter.getState().users.splice(0, 1);
    await adapter.save();
    const tail = client.statements.slice(beforeSecond + added.length);
    expect(tail.some(s => s.sql === 'DELETE FROM users WHERE id = $1')).toBe(true);

    await adapter.close();
  });

  it('records a failed flush on lastSaveError and keeps the chain alive', async () => {
    const client = new FakeClient(['COMMIT']);
    const adapter = new PostgresPersistenceAdapter(undefined, blankState(), new FakePool(client));
    adapter.getState().users.push(userEntity('U-1', 'a@b.c'));

    await expect(adapter.save()).rejects.toThrow();
    expect(adapter.lastSaveError).toContain('fake failure');

    // A subsequent save against a healthy pool still works (chain not wedged).
    const healthy = new FakeClient();
    const adapter2 = new PostgresPersistenceAdapter(undefined, blankState(), new FakePool(healthy));
    adapter2.getState().users.push(userEntity('U-2', 'c@d.e'));
    await adapter2.save();
    expect(healthy.statements.some(s => s.sql.startsWith('INSERT INTO users'))).toBe(true);

    await adapter.close();
    await adapter2.close();
  });
});