import fs from 'fs';
import path from 'path';
import pg, { Pool, PoolClient } from 'pg';
import { IPersistenceAdapter } from './IPersistenceAdapter';
import { DatabaseState } from '../database';
import { planFlush } from '../postgres/pgFlush';

/** Structural surface save() needs from a pool — satisfied by pg.Pool and by test fakes. */
export interface MinimalPool {
  connect(): Promise<MinimalClient>;
  end(): Promise<void>;
  on(event: string, cb: (...args: any[]) => void): void;
}

export interface MinimalClient {
  query(text: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>;
  release(): void;
}

export interface PostgresConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  ssl?: boolean | { rejectUnauthorized: boolean };
  maxConnections?: number;
  idleTimeoutMillis?: number;
}

export class PostgresPersistenceAdapter implements IPersistenceAdapter {
  private pool: Pool | null = null;
  private state: DatabaseState;
  private isConnected = false;
  private config: PostgresConfig;
  private activeTransactionClient: PoolClient | null = null;
  private isTransactionActive = false;
  private transactionDepth = 0;

  /**
   * Last-written row state per table, keyed by id — the diff baseline for
   * save(). Mirrors SqlitePersistenceAdapter.shadow so an unchanged row is
   * never rewritten and a collection reorder costs one integer per row.
   */
  private shadow = new Map<string, Map<string, { data: string; seq: number }>>();

  /** Lazy one-time spec-schema application, guarded for concurrent saves. */
  private schemaReady = false;
  private schemaApplying: Promise<void> | null = null;

  /** Serializes fire-and-forget save() calls into one transaction at a time. */
  private saveChain: Promise<void> = Promise.resolve();

  /** Last flush failure, surfaced by /api/health rather than lost. */
  public lastSaveError: string | null = null;

  constructor(config?: PostgresConfig, initialState?: DatabaseState, poolOverride?: MinimalPool) {
    this.config = config || {
      connectionString: process.env.DATABASE_URL
    };
    this.state = initialState ? JSON.parse(JSON.stringify(initialState)) : this.createEmptyState();
    if (poolOverride) {
      this.pool = poolOverride as unknown as Pool;
    } else {
      this.initPool();
    }
  }

  private createEmptyState(): DatabaseState {
    return {
      version: 1,
      users: [],
      sessions: [],
      trips: [],
      tripItems: [],
      tripMembers: [],
      tripItemVotes: [],
      tripSplits: [],
      suppliers: [],
      productSkus: [],
      hotels: [],
      accommodations: [],
      propertySources: [],
      inventorySlots: [],
      holds: [],
      payments: [],
      bookings: [],
      ledgerEntries: [],
      transferTelemetry: [],
      notifications: [],
      ambientNudges: [],
      pushSubscriptions: [],
      supplierMetrics: [],
      supplierAvailabilityBlocks: [],
      payoutSchedule: [],
      reviews: [],
      supportMessages: [],
      auditEvents: [],
      opportunities: [],
      roomTypes: [],
      roomRateNights: [],
      hotelBookings: [],
      locks: [],
      fencingSequence: 1000,
      researchSources: [],
      temporalFacts: [],
      evidenceNodes: [],
      conflictSets: [],
      areaProfiles: [],
      places: [],
      activities: [],
      diningVenues: [],
      diningMenuItems: [],
      diningOrders: [],
      emergencyResources: [],
      regulatoryDecrees: [],
      knowledgeSnapshots: [],
      placeDiscoveries: [],
      resolutionCandidates: [],
      reefPositiveLogs: [],
      bundles: [],
      tripJournalEntries: [],
      tripPlacesVisited: [],
      fraudSignals: [],
      fraudRules: [],
      fraudUserStats: [],
      roles: [],
      userPermissionOverrides: [],
      settings: [],
      settingsHistory: [],
      featureFlags: [],
      approvals: [],
      idempotencyKeys: [],
      deviceSessions: [],
      refreshTokens: [],
      pushDevices: [],
      integrationConfigs: [],
      tripPackages: [],
      catalogMeta: [],
      lastCheckpoint: new Date().toISOString()
    };
  }

  private initPool() {
    const connStr = this.config.connectionString || process.env.DATABASE_URL;
    if (!connStr && !this.config.host) {
      // Standby / unconfigured mode
      return;
    }

    try {
      this.pool = new pg.Pool({
        connectionString: connStr,
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        ssl: this.config.ssl || (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined),
        max: this.config.maxConnections || 20,
        idleTimeoutMillis: this.config.idleTimeoutMillis || 30000,
        connectionTimeoutMillis: 5000
      });

      this.pool.on('error', (err) => {
        console.error('[PostgresPersistenceAdapter] Unexpected client error in pool:', err.message);
      });
    } catch (err: any) {
      console.error('[PostgresPersistenceAdapter] Failed to initialize pg.Pool:', err.message);
    }
  }

  public getPool(): Pool | null {
    return this.pool;
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public async isHealthy(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }
    try {
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT 1 as alive');
        this.isConnected = result.rows.length > 0;
        return this.isConnected;
      } finally {
        client.release();
      }
    } catch (err) {
      this.isConnected = false;
      return false;
    }
  }

  public async initializeSchema(): Promise<boolean> {
    if (!this.pool) {
      throw new Error('Cannot initialize schema: PostgreSQL pool not connected.');
    }
    const schemaPath = path.join(process.cwd(), 'server/db/sql/schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at ${schemaPath}`);
    }
    const ddl = fs.readFileSync(schemaPath, 'utf-8');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(ddl);
      await client.query('COMMIT');
      return true;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Applies the spec-generated baseline once (checksum-guarded), so save() can
   * run against a fresh database without a separate provisioning step.
   */
  private async ensureSchemaOnce(): Promise<void> {
    if (this.schemaReady) return;
    if (this.schemaApplying) {
      await this.schemaApplying;
      return;
    }
    this.schemaApplying = this.initializeSchemaFromSpecs().then(() => {
      this.schemaReady = true;
      this.schemaApplying = null;
    });
    await this.schemaApplying;
  }

  /**
   * One diffed flush: deletes child-first, upserts parent-first, meta last,
   * inside a single transaction (see planFlush).
   */
  private async flushOnce(): Promise<void> {
    // Same contract as the SQLite adapter: a save inside an open synchronous
    // transaction is a no-op — the transaction's own commit() flushes.
    if (this.transactionDepth > 0) return;
    if (!this.pool) {
      throw new Error('[PostgresPersistenceAdapter] save() called with no pool — nothing to persist to.');
    }

    await this.ensureSchemaOnce();

    const checkpoint = new Date().toISOString();
    const plan = planFlush(this.state as unknown as Record<string, any>, this.shadow, checkpoint);
    if (plan.statements.length === 0) return;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const stmt of plan.statements) {
        await client.query(stmt.sql, stmt.params);
      }
      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Connection-level failure; the original error is the one to surface.
      }
      throw err;
    } finally {
      client.release();
    }

    this.shadow = plan.nextShadow;
    this.state.lastCheckpoint = checkpoint;
  }

  /**
   * Diffed persistence, same contract as the JSON/SQLite adapters.
   *
   * The synchronous IPersistenceAdapter contract means callers fire-and-forget
   * at 54 sites, so save() serializes its async work: overlapping calls queue
   * behind each other instead of interleaving transactions, and a failed flush
   * is logged + recorded on lastSaveError (/api/health) rather than becoming a
   * silent unhandled rejection.
   */
  public save(): Promise<void> {
    const run = this.saveChain.then(() => this.flushOnce());
    // Keep the chain alive and surface failures loudly; callers never await.
    this.saveChain = run.catch((err: any) => {
      this.lastSaveError = err instanceof Error ? err.message : String(err);
      console.error('[PostgresPersistenceAdapter] save() failed:', this.lastSaveError);
    });
    return run;
  }

  /**
   * Throws unless a PostgreSQL connection is configured. Unlike the old stub
   * era this is about reachability, not honesty: save() now writes for real,
   * and booting without a pool would make every write fail at first save.
   */
  public static assertUsable(): void {
    const connStr = process.env.DATABASE_URL;
    const host = process.env.PGHOST || process.env.PG_HOST;
    if (!connStr && !host) {
      throw new Error(
        'PERSISTENCE_ADAPTER=postgres was requested, but no PostgreSQL connection is configured. ' +
        'Set DATABASE_URL (or PGHOST/PGUSER/PGPASSWORD/PGDATABASE) so save() has somewhere to write.'
      );
    }
  }

  public async beginTransactionAsync(): Promise<PoolClient | null> {
    if (!this.pool) return null;
    const client = await this.pool.connect();
    await client.query('BEGIN');
    this.activeTransactionClient = client;
    this.isTransactionActive = true;
    return client;
  }

  public async commitAsync(): Promise<void> {
    if (this.activeTransactionClient) {
      try {
        await this.activeTransactionClient.query('COMMIT');
      } finally {
        this.activeTransactionClient.release();
        this.activeTransactionClient = null;
        this.isTransactionActive = false;
      }
    }
  }

  public async rollbackAsync(): Promise<void> {
    if (this.activeTransactionClient) {
      try {
        await this.activeTransactionClient.query('ROLLBACK');
      } finally {
        this.activeTransactionClient.release();
        this.activeTransactionClient = null;
        this.isTransactionActive = false;
      }
    }
  }

  // Synchronous contract required by IPersistenceAdapter
  public beginTransaction(): void {
    this.transactionDepth++;
    this.isTransactionActive = true;
  }

  public commit(): void {
    if (this.transactionDepth > 0) {
      this.transactionDepth--;
      if (this.transactionDepth === 0) {
        this.isTransactionActive = false;
      }
    }
  }

  public rollback(): void {
    this.transactionDepth = 0;
    this.isTransactionActive = false;
  }

  public runInTransaction<R>(work: () => R): R {
    this.beginTransaction();
    try {
      const result = work();
      this.commit();
      return result;
    } catch (error) {
      this.rollback();
      throw error;
    }
  }

  public async runInPostgresTransaction<R>(work: (client: PoolClient) => Promise<R>): Promise<R> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not available for relational transaction.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async migrateFromJson(sourceState: DatabaseState): Promise<{
    users: number;
    trips: number;
    bookings: number;
    ledgerEntries: number;
    temporalFacts: number;
  }> {
    if (!this.pool) {
      throw new Error('Cannot migrate data: PostgreSQL pool not connected.');
    }

    const counts = {
      users: 0,
      trips: 0,
      bookings: 0,
      ledgerEntries: 0,
      temporalFacts: 0
    };

    await this.runInPostgresTransaction(async (client) => {
      // 1. Users
      for (const u of sourceState.users) {
        await client.query(
          `INSERT INTO users (id, email, name, phone, password_hash, password_salt, password_algorithm, role, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()`,
          [u.id, u.email, u.name, u.phone, u.passwordHash, u.passwordSalt || null, u.passwordAlgorithm || 'scrypt', u.role, u.createdAt, u.updatedAt]
        );
        counts.users++;
      }

      // 2. Trips
      for (const t of sourceState.trips) {
        await client.query(
          `INSERT INTO trips (id, user_id, title, status, length_days, travelers_count, budget, pace, interests, total_estimated_egp, total_paid_egp, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [t.id, t.userId, t.title, t.status, t.lengthDays, t.travelersCount, t.budget, t.pace, t.interests || [], t.totalEstimatedEGP, t.totalPaidEGP, t.createdAt, t.updatedAt]
        );
        counts.trips++;
      }

      // 3. Bookings
      for (const b of sourceState.bookings) {
        await client.query(
          `INSERT INTO bookings (id, booking_ref, trip_id, supplier_id, sku_id, service_type, amount_egp, payment_state, supplier_state, traveler_name, traveler_phone, traveler_email, passengers_count, pickup_location, dropoff_location, scheduled_date, scheduled_time, flight_number, special_requests, confirmation_code, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
           ON CONFLICT (id) DO NOTHING`,
          [
            b.id, b.bookingRef, b.tripId, b.supplierId, b.skuId, b.serviceType, b.amountEGP,
            b.paymentState, b.supplierState, b.travelerName, b.travelerPhone, b.travelerEmail,
            b.passengersCount, b.pickupLocation, b.dropoffLocation, b.scheduledDate, b.scheduledTime,
            b.flightNumber || null, b.specialRequests || null, b.confirmationCode, b.createdAt, b.updatedAt
          ]
        );
        counts.bookings++;
      }

      // 4. Ledger Entries
      for (const l of sourceState.ledgerEntries) {
        await client.query(
          `INSERT INTO ledger_entries (id, transaction_id, idempotency_key, booking_ref, trip_id, type, amount_egp, debit_account, credit_account, currency, timestamp, status, signature_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [l.id, l.transactionId, l.idempotencyKey, l.bookingRef, l.tripId, l.type, l.amountEGP, l.debitAccount, l.creditAccount, l.currency || 'EGP', l.timestamp, l.status, l.signatureHash]
        );
        counts.ledgerEntries++;
      }

      // 5. Temporal Facts
      for (const f of sourceState.temporalFacts || []) {
        await client.query(
          `INSERT INTO temporal_facts (id, subject_id, fact_type, claim_en, claim_ar, confidence_tier, source, valid_from, valid_until, last_verified)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            f.id,
            f.subjectId,
            f.predicate || 'fact',
            typeof f.value === 'string' ? f.value : JSON.stringify(f.value || ''),
            '',
            f.confidenceTier || 'VERY_HIGH',
            f.primarySourceId || 'SRC-MANUAL',
            f.validFrom || new Date().toISOString(),
            f.validUntil || null,
            f.verifiedAt || new Date().toISOString()
          ]
        );
        counts.temporalFacts++;
      }
    });

    // Populate memory mirror
    Object.assign(this.state, JSON.parse(JSON.stringify(sourceState)));
    return counts;
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.isConnected = false;
    }
  }

  /**
   * Spec-driven schema setup (Phase 0, Postgres-primary groundwork).
   *
   * initializeSchema() above applies the hand-written server/db/sql/schema.sql,
   * which covers a fraction of the collections. This method instead applies
   * the versioned baseline generated from TableSpec[] — the same source of
   * truth as SQLite — through the migration runner, so every collection the
   * app writes exists with identical constraints. Recorded in
   * schema_migrations; re-runnable and checksum-guarded.
   *
   * Deliberately separate from initializeSchema(): nothing calls this yet in
   * production boot. It becomes the primary path once save() is implemented
   * and certified against a provisioned instance (see blueprint §N).
   */
  public async initializeSchemaFromSpecs(): Promise<{ applied: number[] }> {
    if (!this.pool) {
      throw new Error('Cannot initialize schema: PostgreSQL pool not connected.');
    }
    const { buildBaselineMigrations, applyPendingMigrations } = await import(
      '../postgres/pgDdl'
    );
    const client = await this.pool.connect();
    try {
      return await applyPendingMigrations(client, buildBaselineMigrations());
    } finally {
      client.release();
    }
  }
}
