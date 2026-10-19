import crypto from 'crypto';
import { db, Database } from '../db/database';
import { DistributedLockService, LockLease } from '../services/distributedLockService';
import { lockRepository } from '../db/repositories/DistributedLockRepository';
import { InMemoryPersistenceAdapter } from '../db/adapters/InMemoryPersistenceAdapter';
import { validatePostgreSqlSchema } from '../db/sql/schemaValidator';

console.log('================================================================');
console.log('🔒  PHASE 2 DATABASE PERSISTENCE & DISTRIBUTED LOCK CERTIFICATION (6 POINTS)');
console.log('================================================================');

let passedPoints = 0;
const totalPoints = 6;

async function runTests() {
  try {
    // ---------------------------------------------------------------------------
    // Point 1: Atomic Lease Acquisition & Monotonic Fencing Tokens
    // ---------------------------------------------------------------------------
    console.log('Running Point 1: Atomic lease acquisition & monotonic fencing tokens...');
    const lockService = DistributedLockService.getInstance();
    const key1 = `lock:test:resource-1-${Date.now()}`;
    const key2 = `lock:test:resource-2-${Date.now()}`;

    const lease1 = lockService.tryAcquire(key1, 5000, 'worker-alpha');
    if (!lease1) {
      throw new Error('Point 1 Failed: Could not acquire initial lock lease');
    }
    if (!lease1.leaseId.startsWith('LEASE-') || lease1.owner !== 'worker-alpha' || !lease1.fencingToken) {
      throw new Error('Point 1 Failed: Lease missing required properties or fencing token');
    }

    const lease2 = lockService.tryAcquire(key2, 5000, 'worker-beta');
    if (!lease2) {
      throw new Error('Point 1 Failed: Could not acquire second lock lease');
    }
    if (lease2.fencingToken <= lease1.fencingToken) {
      throw new Error(`Point 1 Failed: Fencing tokens not monotonic: ${lease2.fencingToken} <= ${lease1.fencingToken}`);
    }

    // Verify stored in DB
    const dbLock1 = db.locks.find(l => l.lockKey === key1);
    if (!dbLock1 || dbLock1.leaseId !== lease1.leaseId) {
      throw new Error('Point 1 Failed: Lock lease was not persisted into db.locks');
    }

    lockService.release(lease1);
    lockService.release(lease2);

    console.log('✅ Point 1: Atomic Lease Acquisition & Monotonic Fencing Tokens');
    console.log('   └─ Verified atomic lease grant, db.locks persistence, and strictly increasing monotonic fencing tokens.');
    passedPoints++;

    // ---------------------------------------------------------------------------
    // Point 2: Massive Parallel Race Condition Rejection (50 Competing Coroutines)
    // ---------------------------------------------------------------------------
    console.log('Running Point 2: Massive parallel race condition rejection (50 concurrent acquires)...');
    const contentionKey = `lock:contention:slot-${Date.now()}`;
    const concurrencyLevel = 50;

    const results = await Promise.all(
      Array.from({ length: concurrencyLevel }).map(async (_, idx) => {
        return lockService.tryAcquire(contentionKey, 5000, `client-${idx}`);
      })
    );

    const successfulAcquires = results.filter((r): r is LockLease => r !== null);
    if (successfulAcquires.length !== 1) {
      throw new Error(`Point 2 Failed: Expected exactly 1 winner out of ${concurrencyLevel}, got ${successfulAcquires.length}`);
    }

    const winningLease = successfulAcquires[0];
    if (!lockService.isLocked(contentionKey)) {
      throw new Error('Point 2 Failed: isLocked returned false on active contended key');
    }

    // Release winner
    const releaseSuccess = lockService.release(winningLease);
    if (!releaseSuccess) {
      throw new Error('Point 2 Failed: Failed to release winning lease');
    }

    // After release, a new attempt must succeed
    const subsequentLease = lockService.tryAcquire(contentionKey, 2000, 'client-aftermath');
    if (!subsequentLease) {
      throw new Error('Point 2 Failed: Failed to acquire lock after release');
    }
    lockService.release(subsequentLease);

    console.log('✅ Point 2: Massive Parallel Race Condition Rejection');
    console.log(`   └─ 50 parallel competing workers: exactly 1 acquired, 49 cleanly rejected with zero data race.`);
    passedPoints++;

    // ---------------------------------------------------------------------------
    // Point 3: Safe Lease Renewal & Expired Lock Automatic Preemption
    // ---------------------------------------------------------------------------
    console.log('Running Point 3: Lease renewal & expired lock automatic preemption...');
    const shortExpiryKey = `lock:expiry:test-${Date.now()}`;
    const initialLease = lockService.tryAcquire(shortExpiryKey, 200, 'owner-short');
    if (!initialLease) {
      throw new Error('Point 3 Failed: Could not acquire short-lived lock');
    }

    // Renew lease before expiry
    const renewed = lockService.renew(initialLease, 600);
    if (!renewed || initialLease.expiresAt <= Date.now() + 200) {
      throw new Error('Point 3 Failed: Lease renewal failed to extend expiration timestamp');
    }

    // Wait for the renewed lease to expire
    await new Promise(r => setTimeout(r, 700));

    // Another worker should now successfully preempt the expired lock
    const preemptingLease = lockService.tryAcquire(shortExpiryKey, 5000, 'owner-preemptor');
    if (!preemptingLease) {
      throw new Error('Point 3 Failed: Expired lock was not automatically preempted');
    }
    if (preemptingLease.leaseId === initialLease.leaseId) {
      throw new Error('Point 3 Failed: Preempted lock retained previous lease ID');
    }
    if (preemptingLease.fencingToken <= initialLease.fencingToken) {
      throw new Error('Point 3 Failed: Preempting lease did not increment fencing token');
    }
    if (preemptingLease.version <= initialLease.version) {
      throw new Error('Point 3 Failed: Preempting lease did not increment version counter');
    }

    lockService.release(preemptingLease);

    console.log('✅ Point 3: Safe Lease Renewal & Expired Lock Automatic Preemption');
    console.log('   └─ Verified in-flight lease renewal and atomic preemption of stale leases with version incrementation.');
    passedPoints++;

    // ---------------------------------------------------------------------------
    // Point 4: Monotonic Fencing Token Correctness (Stale Token Rejection Guard)
    // ---------------------------------------------------------------------------
    console.log('Running Point 4: Monotonic fencing token correctness & stale write protection...');
    
    // Simulate a critical storage ledger or inventory balance
    let authoritativeBalance = 1000;
    let lastCommittedFencingToken = 0;

    const commitBalanceUpdate = (fencingToken: number, delta: number): boolean => {
      if (fencingToken <= lastCommittedFencingToken) {
        // Stale or out-of-order write rejected!
        return false;
      }
      authoritativeBalance += delta;
      lastCommittedFencingToken = fencingToken;
      return true;
    };

    const slotKey = `lock:inventory:slot-${Date.now()}`;
    const leaseA = lockService.tryAcquire(slotKey, 100, 'worker-slow-A');
    if (!leaseA) throw new Error('Point 4 Failed: Could not acquire leaseA');

    // Simulate worker A pausing/lagging while its lease expires
    await new Promise(r => setTimeout(r, 150));

    // Worker B acquires the newly expired lock and gets higher fencing token
    const leaseB = lockService.tryAcquire(slotKey, 5000, 'worker-fast-B');
    if (!leaseB) throw new Error('Point 4 Failed: Worker B could not acquire expired lock');

    // Worker B executes and commits write with its token
    const commitB = commitBalanceUpdate(leaseB.fencingToken, -100);
    if (!commitB || authoritativeBalance !== 900) {
      throw new Error('Point 4 Failed: Worker B legitimate write failed');
    }
    lockService.release(leaseB);

    // Worker A wakes up late and attempts to write with stale leaseA.fencingToken
    const commitA = commitBalanceUpdate(leaseA.fencingToken, -50);
    if (commitA) {
      throw new Error('Point 4 Failed: Stale fencing token from worker A was erroneously accepted!');
    }
    if (authoritativeBalance !== 900) {
      throw new Error('Point 4 Failed: Authoritative balance corrupted by stale write!');
    }

    console.log('✅ Point 4: Monotonic Fencing Token Correctness & Out-of-Order Write Defense');
    console.log('   └─ Verified that late/stale worker writes are rejected when superseded by a higher fencing token.');
    passedPoints++;

    // ---------------------------------------------------------------------------
    // Point 5: Multi-Instance Distributed Mutual Exclusion
    // ---------------------------------------------------------------------------
    console.log('Running Point 5: Multi-instance distributed mutual exclusion across simulated nodes...');
    const nodeInstance1 = DistributedLockService.createInstance('node-worker-us-east');
    const nodeInstance2 = DistributedLockService.createInstance('node-worker-eu-west');
    const crossNodeKey = `lock:cross-node:trip-calc-${Date.now()}`;

    const executionLog: string[] = [];

    // Run parallel tasks across node 1 and node 2 on the same resource
    const task1 = nodeInstance1.runWithLock(crossNodeKey, async (lease) => {
      executionLog.push(`node1-start-token-${lease.fencingToken}`);
      await new Promise(r => setTimeout(r, 100));
      executionLog.push(`node1-end-token-${lease.fencingToken}`);
      return 'result-node1';
    }, 2000, 3000);

    const task2 = nodeInstance2.runWithLock(crossNodeKey, async (lease) => {
      executionLog.push(`node2-start-token-${lease.fencingToken}`);
      await new Promise(r => setTimeout(r, 100));
      executionLog.push(`node2-end-token-${lease.fencingToken}`);
      return 'result-node2';
    }, 2000, 3000);

    const [res1, res2] = await Promise.all([task1, task2]);
    if (res1 !== 'result-node1' || res2 !== 'result-node2') {
      throw new Error('Point 5 Failed: Node execution results mismatch');
    }

    // Verify non-overlapping sequential execution
    if (executionLog.length !== 4) {
      throw new Error(`Point 5 Failed: Unexpected log length ${executionLog.length}`);
    }
    const isSequential1First = executionLog[0].startsWith('node1-start') && executionLog[1].startsWith('node1-end') && executionLog[2].startsWith('node2-start');
    const isSequential2First = executionLog[0].startsWith('node2-start') && executionLog[1].startsWith('node2-end') && executionLog[2].startsWith('node1-start');

    if (!isSequential1First && !isSequential2First) {
      throw new Error(`Point 5 Failed: Overlapping execution detected across instances: ${JSON.stringify(executionLog)}`);
    }

    console.log('✅ Point 5: Multi-Instance Distributed Mutual Exclusion');
    console.log('   └─ Verified strict serialized non-overlapping execution across distinct simulated service instances.');
    passedPoints++;

    // ---------------------------------------------------------------------------
    // Point 6: Persistence Crash Safety & Transaction Rollback Isolation
    // ---------------------------------------------------------------------------
    console.log('Running Point 6: Persistence crash safety & transaction rollback isolation...');
    const isolatedDb = new Database(new InMemoryPersistenceAdapter());
    const initialLockCount = isolatedDb.locks.length;

    let transactionErrorCaught = false;
    try {
      isolatedDb.runInTransaction(() => {
        isolatedDb.locks.push({
          id: 'test-phantom-lock',
          lockKey: 'test-phantom-lock',
          leaseId: 'LEASE-PHANTOM',
          owner: 'crash-tester',
          acquiredAt: Date.now(),
          expiresAt: Date.now() + 10000,
          fencingToken: 9999,
          version: 1
        });
        throw new Error('SIMULATED_DISK_WRITE_ABORT');
      });
    } catch (err: any) {
      transactionErrorCaught = true;
      if (!err.message.includes('SIMULATED_DISK_WRITE_ABORT')) {
        throw new Error(`Point 6 Failed: Unexpected error: ${err.message}`);
      }
    }

    if (!transactionErrorCaught) {
      throw new Error('Point 6 Failed: Transaction error was not thrown');
    }
    if (isolatedDb.locks.length !== initialLockCount) {
      throw new Error('Point 6 Failed: Phantom lock leaked into database after transactional rollback');
    }

    // Verify SQL Schema completeness validator
    const schemaValidation = validatePostgreSqlSchema();
    if (!schemaValidation.valid) {
      throw new Error(`Point 6 Failed: PostgreSQL schema validation failed: ${schemaValidation.errors.join(', ')}`);
    }
    if (!schemaValidation.tables.includes('distributed_locks')) {
      throw new Error('Point 6 Failed: schema.sql missing distributed_locks table');
    }

    console.log('✅ Point 6: Persistence Crash Safety & Transaction Rollback Isolation');
    console.log('   └─ Verified atomic transaction rollback isolation and complete PostgreSQL DDL relational schema integrity.');
    passedPoints++;

    console.log('----------------------------------------------------------------');
    console.log(`TOTAL: ${totalPoints} | PASSED: ${passedPoints} | CERTIFIED: YES ✅`);
    console.log('================================================================');
  } catch (error: any) {
    console.error('❌ PHASE 2 CERTIFICATION FAILED:', error.message);
    process.exit(1);
  }
}

runTests();
