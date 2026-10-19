import { describe, it, expect } from 'vitest';
import {
  pgTableDdl,
  pgIndexDdl,
  buildPostgresSchemaDdl,
  buildBaselineMigrations,
  applyPendingMigrations,
  checksum,
  type MigrationClient,
} from '../../server/db/postgres/pgDdl';
import { TABLE_SPECS, SPEC_BY_TABLE } from '../../server/db/sqlite/tableSpecs';

/** In-memory stand-in for pg.PoolClient: records statements, tracks applied. */
function fakeClient(seedApplied: { version: number; checksum: string }[] = []) {
  const log: string[] = [];
  const applied = new Map(seedApplied.map(a => [a.version, a.checksum]));
  const client: MigrationClient = {
    async query(text: string, params: unknown[] = []) {
      log.push(text.split('\n')[0].slice(0, 60));
      const t = text.trim().toUpperCase();
      if (t.startsWith('CREATE TABLE')) return { rows: [], rowCount: 0 };
      if (t.startsWith('SELECT VERSION')) {
        return {
          rows: [...applied.entries()].map(([version, checksum]) => ({ version, checksum })),
          rowCount: applied.size,
        };
      }
      if (t.startsWith('INSERT INTO SCHEMA_MIGRATIONS')) {
        applied.set(params[0] as number, params[2] as string);
        return { rows: [], rowCount: 1 };
      }
      if (t === 'BEGIN' || t === 'COMMIT' || t === 'ROLLBACK') return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 0 };
    },
  };
  return { client, log, applied };
}

describe('postgres DDL generation', () => {
  it('covers every spec table', () => {
    const ddl = buildPostgresSchemaDdl();
    for (const spec of TABLE_SPECS) {
      expect(ddl).toContain(`CREATE TABLE IF NOT EXISTS ${spec.table} (`);
    }
    expect(TABLE_SPECS.length).toBeGreaterThanOrEqual(46);
  });

  it('keeps the sqlite identity contract (string ids, seq ordering, data document)', () => {
    const users = SPEC_BY_TABLE.get('users')!;
    const ddl = pgTableDdl(users);
    expect(ddl).toContain('id TEXT PRIMARY KEY NOT NULL');
    expect(ddl).toContain('seq INTEGER NOT NULL');
    expect(ddl).toContain('data JSONB NOT NULL');
    expect(ddl).not.toContain('SERIAL');
  });

  it('maps promoted column types to Postgres', () => {
    // accommodations carries TEXT, INTEGER, REAL and boolean-as-INTEGER.
    const acc = SPEC_BY_TABLE.get('accommodations')!;
    const ddl = pgTableDdl(acc);
    expect(ddl).toContain('rating DOUBLE PRECISION');
    expect(ddl).toContain('review_count INTEGER');
    expect(ddl).toContain('active INTEGER');
  });

  it('preserves mandatory-owned foreign keys and their delete rules', () => {
    const trips = SPEC_BY_TABLE.get('trips')!;
    expect(pgTableDdl(trips)).toContain('REFERENCES users(id) ON DELETE CASCADE');
    const acc = SPEC_BY_TABLE.get('accommodations')!;
    // Commerce-linked rows must not cascade away paid inventory.
    expect(pgTableDdl(acc)).toContain('REFERENCES area_profiles(id) ON DELETE RESTRICT');
  });

  it('does not constrain advisory references', () => {
    // Market tables reference suppliers the crawler may observe before the
    // supplier row exists — index, never FK (see tableSpecs docblock).
    const offers = SPEC_BY_TABLE.get('supplier_offers');
    if (offers) {
      expect(pgTableDdl(offers)).not.toContain('REFERENCES suppliers');
    }
  });

  it('emits the per-table seq index and skips duplicates on unique columns', () => {
    const users = SPEC_BY_TABLE.get('users')!;
    const idx = pgIndexDdl(users);
    expect(idx[0]).toBe('CREATE INDEX IF NOT EXISTS idx_users_seq ON users(seq);');
    // email is UNIQUE (implicit index) but role is indexed.
    expect(idx.some(s => s.includes('(email)'))).toBe(false);
    expect(idx.some(s => s.includes('idx_users_role'))).toBe(true);
  });

  it('emits composite indexes', () => {
    const acc = SPEC_BY_TABLE.get('accommodations')!;
    const idx = pgIndexDdl(acc).join('\n');
    expect(idx).toContain('idx_accommodations_property_type_area_id');
  });
});

describe('migration runner', () => {
  const v1 = { version: 1, name: 'baseline', statements: ['CREATE TABLE t1 (id TEXT);'] };
  const v2 = { version: 2, name: 'add-x', statements: ['ALTER TABLE t1 ADD COLUMN x TEXT;'] };

  it('applies pending migrations in order inside transactions', async () => {
    const { client, log } = fakeClient();
    const result = await applyPendingMigrations(client, [v2, v1]);
    expect(result).toEqual({ applied: [1, 2] });
    expect(log[0]).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
    expect(log).toContain('BEGIN');
    expect(log).toContain('COMMIT');
    expect(log).toContain('CREATE TABLE t1 (id TEXT);');
  });

  it('skips already-applied migrations with matching checksums', async () => {
    const { client, log } = fakeClient([{ version: 1, checksum: checksum(v1.statements) }]);
    const result = await applyPendingMigrations(client, [v1, v2]);
    expect(result).toEqual({ applied: [2] });
    expect(log).not.toContain('CREATE TABLE t1 (id TEXT);');
  });

  it('refuses to continue on checksum drift (edited history)', async () => {
    const { client } = fakeClient([{ version: 1, checksum: 'deadbeef' }]);
    await expect(applyPendingMigrations(client, [v1])).rejects.toThrow(/checksum mismatch/);
  });

  it('refuses gapped chains', async () => {
    const { client } = fakeClient();
    const v3 = { version: 3, name: 'skip', statements: ['SELECT 1;'] };
    await expect(applyPendingMigrations(client, [v1, v3])).rejects.toThrow(/gap/);
  });

  it('builds the v1 baseline from every spec table', () => {
    const [baseline] = buildBaselineMigrations();
    expect(baseline.version).toBe(1);
    const joined = baseline.statements.join('\n');
    for (const spec of TABLE_SPECS) {
      expect(joined).toContain(`CREATE TABLE IF NOT EXISTS ${spec.table} (`);
    }
  });
});
