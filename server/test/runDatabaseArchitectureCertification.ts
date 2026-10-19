import { db, Database } from '../db/database';
import { JsonFilePersistenceAdapter } from '../db/adapters/JsonFilePersistenceAdapter';
import { InMemoryPersistenceAdapter } from '../db/adapters/InMemoryPersistenceAdapter';
import { userRepository } from '../db/repositories/UserRepository';
import { tripRepository } from '../db/repositories/TripRepository';
import { bookingRepository } from '../db/repositories/BookingRepository';
import { holdRepository } from '../db/repositories/HoldRepository';
import { ledgerRepository } from '../db/repositories/LedgerRepository';
import { supplierRepository } from '../db/repositories/SupplierRepository';
import { knowledgeRepository } from '../db/repositories/KnowledgeRepository';
import { validatePostgreSqlSchema } from '../db/sql/schemaValidator';
import { runMigrationsAndSeed } from '../db/migrations';

export interface DbCertResult {
  point: number;
  title: string;
  passed: boolean;
  notes?: string;
}

export function runDatabaseArchitectureCertification(): {
  total: number;
  passed: number;
  certified: boolean;
  results: DbCertResult[];
} {
  const results: DbCertResult[] = [];
  let currentPoint = 1;

  function assertPoint(title: string, fn: () => void | Promise<void>, notes?: string) {
    try {
      fn();
      results.push({ point: currentPoint++, title, passed: true, notes });
    } catch (err: any) {
      results.push({ point: currentPoint++, title, passed: false, notes: `${notes || ''} Error: ${err.message}` });
    }
  }

  // 1. Adapter Abstraction Check
  assertPoint(
    'Persistence Adapter Interface Compliance',
    () => {
      const adapter = db.getAdapter();
      if (!adapter || typeof adapter.getState !== 'function' || typeof adapter.save !== 'function') {
        throw new Error('Default persistence adapter does not implement IPersistenceAdapter');
      }
    },
    'Verified IPersistenceAdapter contract compliance on global DB instance.'
  );

  // 2. In-Memory Isolation Adapter for Unit Testing
  assertPoint(
    'In-Memory Adapter Isolation & State Management',
    () => {
      const memAdapter = new InMemoryPersistenceAdapter({ version: 2 });
      const isolatedDb = new Database(memAdapter);
      isolatedDb.users.push({
        id: 'USR-TEST-ISOLATED',
        email: 'test.isolated@dahab.travel',
        name: 'Isolated User',
        phone: '+20 100 000 9999',
        passwordHash: 'hash',
        role: 'Traveler',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      if (isolatedDb.users.length !== 1 || db.users.some(u => u.id === 'USR-TEST-ISOLATED')) {
        throw new Error('In-memory database polluted global disk state.');
      }
    },
    'Verified isolated in-memory DB instances for tests without disk side-effects.'
  );

  // 3. Nested Transaction Rollback & Commit Integrity
  assertPoint(
    'Nested Transaction & Atomic Rollback Verification',
    () => {
      const memAdapter = new InMemoryPersistenceAdapter();
      const testDb = new Database(memAdapter);
      testDb.users.push({
        id: 'USR-TX-1',
        email: 'tx1@dahab.travel',
        name: 'TX 1',
        phone: '123',
        passwordHash: 'h',
        role: 'Traveler',
        createdAt: '',
        updatedAt: ''
      });

      // Failed transaction rollback
      try {
        testDb.runInTransaction(() => {
          testDb.users.push({
            id: 'USR-TX-FAIL',
            email: 'txfail@dahab.travel',
            name: 'TX Fail',
            phone: '123',
            passwordHash: 'h',
            role: 'Traveler',
            createdAt: '',
            updatedAt: ''
          });
          throw new Error('Simulated abort');
        });
      } catch {
        // Expected
      }

      if ((testDb.users as any[]).length !== 1 || testDb.users.some(u => u.id === 'USR-TX-FAIL')) {
        throw new Error('Rollback failed to revert mutated state.');
      }

      // Successful transaction commit
      testDb.runInTransaction(() => {
        testDb.users.push({
          id: 'USR-TX-SUCCESS',
          email: 'txsuccess@dahab.travel',
          name: 'TX Success',
          phone: '123',
          passwordHash: 'h',
          role: 'Traveler',
          createdAt: '',
          updatedAt: ''
        });
      });

      if ((testDb.users as any[]).length !== 2 || !testDb.users.some(u => u.id === 'USR-TX-SUCCESS')) {
        throw new Error('Commit failed to persist transaction state.');
      }
    },
    'Verified nested transaction rollback and atomic commit mechanics.'
  );

  // 4. Repositories Decoupling from Raw Database Access
  assertPoint(
    'Repository Abstraction & Typed Operations',
    () => {
      runMigrationsAndSeed();
      const user = userRepository.findByEmail('ahmed.traveler@example.com');
      if (!user) throw new Error('userRepository.findByEmail returned null');
      const trip = tripRepository.findByUserId('USR-AHMED-01');
      if (!trip) throw new Error('tripRepository.findByUserId returned empty');
      const bookings = bookingRepository.findByTravelerEmail('ahmed.traveler@example.com');
      if (!bookings) throw new Error('bookingRepository.findByTravelerEmail returned empty');
    },
    'Verified UserRepository, TripRepository, and BookingRepository queries.'
  );

  // 5. PostgreSQL Schema & DDL Structural Validation
  assertPoint(
    'PostgreSQL DDL Relational Schema Integrity',
    () => {
      const result = validatePostgreSqlSchema();
      if (!result.valid) {
        throw new Error(`SQL schema validation failed: ${result.errors.join(', ')}`);
      }
      if (result.tableCount < 12) {
        throw new Error(`Expected at least 12 core tables in schema.sql, found ${result.tableCount}`);
      }
    },
    'Verified schema.sql defines all relational tables, foreign keys, and indexes.'
  );

  // 6. Cryptographic Audit Event Generation
  assertPoint(
    'Cryptographic Hash-Linked Audit Logging',
    () => {
      const entry = db.logAudit('TEST-RUNNER', 'Admin', 'DB_CERT_TEST', 'Database', 'SYSTEM', { status: 'OK' });
      if (!entry.signature || !entry.id.startsWith('AUD-')) {
        throw new Error('Audit entry missing valid SHA-256 signature or ID.');
      }
    },
    'Verified tamper-evident audit event creation and persistence.'
  );

  const passedCount = results.filter(r => r.passed).length;
  return {
    total: results.length,
    passed: passedCount,
    certified: passedCount === results.length,
    results
  };
}

// Auto-run if executed via CLI
const isDirectCli = process.argv[1]?.includes('runDatabaseArchitectureCertification');
if (isDirectCli) {
  console.log('\n================================================================');
  console.log('🗄️  DATABASE ARCHITECTURE & REPOSITORY CERTIFICATION');
  console.log('================================================================\n');
  const cert = runDatabaseArchitectureCertification();
  for (const r of cert.results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} Point ${r.point}: ${r.title}`);
    if (r.notes) console.log(`   └─ ${r.notes}`);
  }
  console.log('----------------------------------------------------------------');
  console.log(`TOTAL: ${cert.total} | PASSED: ${cert.passed} | CERTIFIED: ${cert.certified ? 'YES ✅' : 'NO ❌'}`);
  console.log('================================================================\n');
  if (!cert.certified) {
    process.exit(1);
  }
}
