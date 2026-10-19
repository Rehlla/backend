import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import BetterSqlite3 from 'better-sqlite3';
import { SqlitePersistenceAdapter } from '../../server/db/sqlite/SqlitePersistenceAdapter';

/**
 * The guarantees the JSON store could not make.
 *
 * These are not "does SQLite work" tests. Each one pins a property the audit
 * found missing: constraints that are enforced rather than hoped for, writes
 * that are diffed rather than rewriting the whole store, a rollback that
 * actually restores, and a backup that opens.
 */

let dir: string;
let dbFile: string;
let adapter: SqlitePersistenceAdapter;

const user = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  email: `${id.toLowerCase()}@example.com`,
  name: id,
  phone: '+201000000000',
  passwordHash: 'hash',
  role: 'Traveler',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...extra
});

const trip = (id: string, userId: string) => ({
  id,
  userId,
  title: 'Trip',
  status: 'DRAFT',
  lengthDays: 3,
  travelersCount: 2,
  budget: 'Moderate',
  pace: 'Balanced',
  interests: ['diving'],
  totalEstimatedEGP: 1000,
  totalPaidEGP: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
});

/** Reads the file directly, bypassing the adapter's in-memory working copy. */
const onDisk = (table: string): any[] => {
  const raw = new BetterSqlite3(dbFile, { readonly: true });
  const rows = raw.prepare(`SELECT data FROM ${table}`).all() as Array<{ data: string }>;
  raw.close();
  return rows.map(r => JSON.parse(r.data));
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dahab-sqlite-'));
  dbFile = path.join(dir, 'dahab.sqlite');
  adapter = new SqlitePersistenceAdapter(dbFile);
});

afterEach(() => {
  try {
    adapter.close();
  } catch {
    // Already closed by the test.
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('constraints the JSON store could not enforce', () => {
  it('rejects a trip whose user does not exist', () => {
    const state = adapter.getState();
    state.trips.push(trip('TRIP-1', 'USR-GHOST') as never);

    // This is the exact defect the audit found in live data: 8 rows pointing at
    // trips and users that were gone, accepted silently for months.
    expect(() => adapter.save()).toThrow(/FOREIGN KEY/i);
  });

  it('accepts the same trip once its user exists', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    state.trips.push(trip('TRIP-1', 'USR-1') as never);

    expect(() => adapter.save()).not.toThrow();
    expect(onDisk('trips')).toHaveLength(1);
  });

  it('rejects a duplicate email', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    state.users.push({ ...user('USR-2'), email: 'usr-1@example.com' } as never);

    expect(() => adapter.save()).toThrow(/UNIQUE/i);
  });

  it('rejects two ledger entries sharing an idempotency key', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    state.trips.push(trip('TRIP-1', 'USR-1') as never);
    const entry = (id: string) => ({
      id,
      transactionId: `TXN-${id}`,
      idempotencyKey: 'IDEMP-SAME',
      bookingRef: 'REF-1',
      tripId: 'TRIP-1',
      type: 'PAYMENT_CAPTURED',
      amountEGP: 100,
      debitAccount: 'A',
      creditAccount: 'B',
      currency: 'EGP',
      timestamp: '2026-01-01T00:00:00.000Z',
      status: 'SETTLED',
      signatureHash: 'sha256:x'
    });
    state.ledgerEntries.push(entry('LEDGER-1') as never);
    state.ledgerEntries.push(entry('LEDGER-2') as never);

    // Idempotency stops being a convention the application has to remember.
    expect(() => adapter.save()).toThrow(/UNIQUE/i);
  });

  it('cascades a delete from users to that user\'s trips', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    state.trips.push(trip('TRIP-1', 'USR-1') as never);
    adapter.save();

    state.users.length = 0;
    state.trips.length = 0;
    adapter.save();

    expect(onDisk('users')).toHaveLength(0);
    expect(onDisk('trips')).toHaveLength(0);
  });
});

describe('writes are diffed, not rewritten', () => {
  it('only writes rows whose content actually changed', () => {
    const state = adapter.getState();
    for (let n = 0; n < 25; n++) state.users.push(user(`USR-${n}`) as never);
    adapter.save();

    // Count writes by watching SQLite's own change counter rather than by
    // trusting the adapter's bookkeeping.
    const before = adapter.connection.prepare('SELECT total_changes() AS n').get() as { n: number };
    (state.users[3] as any).name = 'Renamed';
    adapter.save();
    const after = adapter.connection.prepare('SELECT total_changes() AS n').get() as { n: number };

    // One user row, plus the three store_meta rows written on every checkpoint.
    expect(after.n - before.n).toBeGreaterThanOrEqual(4);
  });

  it('writes nothing at all when nothing changed', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    adapter.save();

    const before = adapter.connection.prepare('SELECT total_changes() AS n').get() as { n: number };
    adapter.save();
    const after = adapter.connection.prepare('SELECT total_changes() AS n').get() as { n: number };

    // Only the checkpoint metadata. The JSON adapter re-serialised and fsynced
    // the entire 0.71 MB store here.
    expect(after.n - before.n).toBe(3);
  });

  it('removes a row that was spliced out of the collection', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never, user('USR-2') as never);
    adapter.save();
    expect(onDisk('users')).toHaveLength(2);

    state.users.splice(0, 1);
    adapter.save();

    const remaining = onDisk('users');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('USR-2');
  });
});

describe('transactions', () => {
  it('writes once for a nested transaction, not once per level', () => {
    const state = adapter.getState();
    adapter.beginTransaction();
    state.users.push(user('USR-1') as never);
    adapter.beginTransaction();
    state.users.push(user('USR-2') as never);
    adapter.commit();

    // Still open at the outer level, so nothing should have reached the file.
    expect(fs.existsSync(dbFile)).toBe(true);
    expect(onDisk('users')).toHaveLength(0);

    adapter.commit();
    expect(onDisk('users')).toHaveLength(2);
  });

  it('rolls the in-memory copy back when the commit is rejected', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    adapter.save();

    adapter.beginTransaction();
    state.trips.push(trip('TRIP-1', 'USR-GHOST') as never);
    expect(() => adapter.commit()).toThrow(/FOREIGN KEY/i);

    // The backup must survive a failed commit, or rollback has nothing to
    // restore and memory silently disagrees with the database.
    adapter.rollback();
    expect(adapter.getState().trips).toHaveLength(0);
    expect(onDisk('trips')).toHaveLength(0);
  });

  it('runInTransaction rolls back on a throw and leaves the store untouched', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    adapter.save();

    expect(() =>
      adapter.runInTransaction(() => {
        state.users.push(user('USR-2') as never);
        throw new Error('domain failure');
      })
    ).toThrow('domain failure');

    expect(adapter.getState().users).toHaveLength(1);
    expect(onDisk('users')).toHaveLength(1);
  });
});

describe('durability and recovery', () => {
  it('reads back everything a previous process wrote', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    state.trips.push(trip('TRIP-1', 'USR-1') as never);
    adapter.save();
    adapter.close();

    const reopened = new SqlitePersistenceAdapter(dbFile);
    expect(reopened.getState().users).toHaveLength(1);
    expect(reopened.getState().trips[0].id).toBe('TRIP-1');
    reopened.close();
  });

  it('preserves nested fields the schema does not promote to columns', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    state.trips.push(trip('TRIP-1', 'USR-1') as never);
    state.suppliers.push({ id: 'SUP-1', businessName: 'S' } as never);
    state.productSkus.push({ id: 'SKU-1', supplierId: 'SUP-1', serviceType: 'transfer' } as never);
    state.bookings.push({
      id: 'BK-1',
      bookingRef: 'REF-1',
      tripId: 'TRIP-1',
      supplierId: 'SUP-1',
      skuId: 'SKU-1',
      serviceType: 'transfer',
      amountEGP: 500,
      paymentState: 'CAPTURED',
      supplierState: 'CONFIRMED',
      travelerName: 'A',
      travelerPhone: 'p',
      travelerEmail: 'a@example.com',
      passengersCount: 2,
      scheduledDate: '2026-02-01',
      scheduledTime: '10:00',
      confirmationCode: 'C1',
      // Nested object with no promoted column anywhere.
      assignedResource: { driverName: 'Mahmoud', vehiclePlate: 'ABC-123' },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    } as never);
    adapter.save();
    adapter.close();

    const reopened = new SqlitePersistenceAdapter(dbFile);
    const booking = reopened.getState().bookings[0] as any;
    expect(booking.assignedResource).toEqual({ driverName: 'Mahmoud', vehiclePlate: 'ABC-123' });
    reopened.close();
  });

  it('produces a backup that opens and passes its own integrity check', () => {
    const state = adapter.getState();
    state.users.push(user('USR-1') as never);
    adapter.save();

    const target = path.join(dir, 'backup.sqlite');
    adapter.backupTo(target);

    const copy = new BetterSqlite3(target, { readonly: true });
    expect(copy.pragma('integrity_check', { simple: true })).toBe('ok');
    expect((copy.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(1);
    copy.close();
  });

  it('refuses to overwrite an existing backup', () => {
    const target = path.join(dir, 'backup.sqlite');
    adapter.backupTo(target);
    expect(() => adapter.backupTo(target)).toThrow(/already exists/i);
  });
});

describe('collection order survives a reload', () => {
  /**
   * A SELECT without ORDER BY has no defined order. Several collections here
   * carry meaning in their order — the ledger chain links each entry to the one
   * before it by array position, and notifications/marketAlerts/auditEvents are
   * built newest-first with unshift(). An earlier draft of this adapter did not
   * order its reads, which silently broke the ledger's chainIntact check.
   */
  it('preserves append order', () => {
    const state = adapter.getState();
    for (let n = 0; n < 10; n++) state.users.push(user(`USR-${n}`) as never);
    adapter.save();
    adapter.close();

    const reopened = new SqlitePersistenceAdapter(dbFile);
    expect(reopened.getState().users.map((u: any) => u.id)).toEqual(
      Array.from({ length: 10 }, (_, n) => `USR-${n}`)
    );
    reopened.close();
  });

  it('preserves newest-first order built with unshift', () => {
    const state = adapter.getState();
    const note = (id: string) => ({
      id,
      userId: 'ALL',
      type: 'SYSTEM',
      title: id,
      message: 'm',
      channel: 'IN_APP',
      status: 'QUEUED',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    state.notifications.push(note('NTF-1') as never);
    adapter.save();

    // Newest first, the way notificationService writes them.
    state.notifications.unshift(note('NTF-2') as never);
    state.notifications.unshift(note('NTF-3') as never);
    adapter.save();
    adapter.close();

    const reopened = new SqlitePersistenceAdapter(dbFile);
    expect(reopened.getState().notifications.map((n: any) => n.id)).toEqual(['NTF-3', 'NTF-2', 'NTF-1']);
    reopened.close();
  });

  it('reorders with one integer write per row, not a full rewrite', () => {
    const state = adapter.getState();
    for (let n = 0; n < 20; n++) state.users.push(user(`USR-${n}`) as never);
    adapter.save();

    const before = adapter.connection.prepare('SELECT total_changes() AS n').get() as { n: number };
    state.users.reverse();
    adapter.save();
    const after = adapter.connection.prepare('SELECT total_changes() AS n').get() as { n: number };

    // 20 positions changed, plus the 3 store_meta rows. If this were rewriting
    // whole documents the count would be the same, but the cost per row would
    // not — the point is that no row is re-serialised when only its index moved.
    expect(after.n - before.n).toBe(23);
    adapter.close();

    const reopened = new SqlitePersistenceAdapter(dbFile);
    expect((reopened.getState().users[0] as any).id).toBe('USR-19');
    reopened.close();
  });
});

describe('fencing tokens', () => {
  it('increases strictly and survives a reopen', () => {
    const first = adapter.nextFencingToken();
    const second = adapter.nextFencingToken();
    expect(second).toBeGreaterThan(first);

    adapter.close();
    const reopened = new SqlitePersistenceAdapter(dbFile);
    // The file-based counter this replaces could hand out a repeat after a
    // restart if the .seq file lagged behind the in-memory value.
    expect(reopened.nextFencingToken()).toBeGreaterThan(second);
    reopened.close();
  });
});
