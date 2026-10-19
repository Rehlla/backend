import { fork, ChildProcess } from 'child_process';
import path from 'path';
import { distributedLockService } from '../services/distributedLockService';
import { db } from '../db/database';

console.log('================================================================');
console.log('⚡ PHASE C: MULTI-PROCESS DISTRIBUTED CONCURRENCY CERTIFICATION');
console.log('================================================================');

let passedTests = 0;
const totalTests = 5;

function spawnWorker(workerId: string): ChildProcess {
  const workerScript = path.join(process.cwd(), 'server/test/workerLockProcess.ts');
  return fork(workerScript, [workerId], {
    execPath: process.execPath,
    execArgv: ['--import=tsx'],
    stdio: ['inherit', 'inherit', 'inherit', 'ipc']
  });
}

function sendToWorker(worker: ChildProcess, action: string, payload: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const handler = (msg: any) => {
      worker.off('message', handler);
      resolve(msg);
    };
    worker.on('message', handler);
    worker.send({ action, payload });
  });
}

async function runCertification() {
  const workers: ChildProcess[] = [];

  try {
    // -------------------------------------------------------------------------
    // Test 1: Cross-Process Mutual Exclusion (2 OS Processes)
    // -------------------------------------------------------------------------
    console.log('Running Test 1: Cross-Process Mutual Exclusion (2 distinct OS processes)...');
    const worker1 = spawnWorker('worker-os-proc-1');
    const worker2 = spawnWorker('worker-os-proc-2');
    workers.push(worker1, worker2);

    const testLockKey = `lock:resource:multi-proc:${Date.now()}`;

    const res1 = await sendToWorker(worker1, 'TRY_ACQUIRE', { lockKey: testLockKey, ttlMs: 10000 });
    const res2 = await sendToWorker(worker2, 'TRY_ACQUIRE', { lockKey: testLockKey, ttlMs: 10000 });

    if (!res1.lease || res1.lease.lockKey !== testLockKey) {
      throw new Error('Test 1 Failed: Worker 1 failed to acquire uncontested lock.');
    }
    if (res2.lease !== null) {
      throw new Error('Test 1 Failed: Worker 2 acquired lock held by Worker 1 (MUTUAL EXCLUSION VIOLATION).');
    }
    console.log(`✅ Test 1: Cross-Process Mutual Exclusion Verified (Winner: ${res1.workerId}, FencingToken: ${res1.lease.fencingToken})`);
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 2: Process Release & Handover with Monotonic Fencing Token
    // -------------------------------------------------------------------------
    console.log('Running Test 2: Process lock release & handover with monotonic fencing token...');
    const releaseRes = await sendToWorker(worker1, 'RELEASE', { lease: res1.lease });
    if (!releaseRes.released) {
      throw new Error('Test 2 Failed: Worker 1 failed to release lock.');
    }

    const res2AfterRelease = await sendToWorker(worker2, 'TRY_ACQUIRE', { lockKey: testLockKey, ttlMs: 10000 });
    if (!res2AfterRelease.lease) {
      throw new Error('Test 2 Failed: Worker 2 failed to acquire lock after Worker 1 released.');
    }
    if (res2AfterRelease.lease.fencingToken <= res1.lease.fencingToken) {
      throw new Error(`Test 2 Failed: Fencing token not strictly monotonic (${res2AfterRelease.lease.fencingToken} <= ${res1.lease.fencingToken})`);
    }
    console.log(`✅ Test 2: Process Release & Monotonic Handover Verified (FencingToken: ${res1.lease.fencingToken} -> ${res2AfterRelease.lease.fencingToken})`);
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 3: Multi-Process High-Concurrency Swarm (4 OS Processes Racing)
    // -------------------------------------------------------------------------
    console.log('Running Test 3: Multi-process concurrency swarm (4 separate OS processes racing simultaneously)...');
    const swarmKey = `lock:swarm:slot:${Date.now()}`;
    const worker3 = spawnWorker('worker-os-proc-3');
    const worker4 = spawnWorker('worker-os-proc-4');
    workers.push(worker3, worker4);

    const racePromises = workers.map(w => sendToWorker(w, 'TRY_ACQUIRE', { lockKey: swarmKey, ttlMs: 15000 }));
    const raceResults = await Promise.all(racePromises);

    const winners = raceResults.filter(r => r.lease !== null);
    const losers = raceResults.filter(r => r.lease === null);

    if (winners.length !== 1) {
      throw new Error(`Test 3 Failed: Expected exactly 1 winner out of 4 OS processes, got ${winners.length}`);
    }
    if (losers.length !== 3) {
      throw new Error(`Test 3 Failed: Expected 3 losers out of 4 OS processes, got ${losers.length}`);
    }
    console.log(`✅ Test 3: Multi-Process Swarm Race Verified (1 Winner: ${winners[0].workerId}, 3 Rejected)`);
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 4: Fencing Token Stale Commit Validation Across Processes
    // -------------------------------------------------------------------------
    console.log('Running Test 4: Fencing token stale commit rejection across OS processes...');
    const staleWorker = winners[0];
    const staleFencingToken = staleWorker.lease.fencingToken;

    // Release winner's lock
    const winnerWorker = workers.find(w => (w as any).pid !== undefined); // worker
    await sendToWorker(winnerWorker!, 'RELEASE', { lease: staleWorker.lease });

    // Another process acquires the same resource
    const newAcquire = await sendToWorker(worker4, 'TRY_ACQUIRE', { lockKey: swarmKey, ttlMs: 10000 });
    if (!newAcquire.lease) {
      throw new Error('Test 4 Failed: Worker 4 failed to acquire lock after release.');
    }

    // Now validate the old worker's fencing token
    const staleValidation = await sendToWorker(winnerWorker!, 'VALIDATE_FENCING', {
      lockKey: swarmKey,
      fencingToken: staleFencingToken
    });

    if (staleValidation.valid !== false) {
      throw new Error('Test 4 Failed: Stale fencing token was accepted as valid (SPLIT-BRAIN RISK).');
    }

    const currentValidation = await sendToWorker(worker4, 'VALIDATE_FENCING', {
      lockKey: swarmKey,
      fencingToken: newAcquire.lease.fencingToken
    });
    if (currentValidation.valid !== true) {
      throw new Error('Test 4 Failed: Valid active fencing token was rejected.');
    }
    console.log('✅ Test 4: Cross-Process Stale Fencing Token Rejection Verified');
    passedTests++;

    // -------------------------------------------------------------------------
    // Test 5: Process Crash / Lease Expiration Recovery
    // -------------------------------------------------------------------------
    console.log('Running Test 5: OS process lease expiration & auto-recovery...');
    const expireKey = `lock:expire:test:${Date.now()}`;
    const shortTtlRes = await sendToWorker(worker1, 'TRY_ACQUIRE', { lockKey: expireKey, ttlMs: 250 });
    if (!shortTtlRes.lease) {
      throw new Error('Test 5 Failed: Worker 1 failed to acquire short-lived lock.');
    }

    // Immediately kill worker1 simulating sudden crash
    worker1.kill();

    // Verify worker2 cannot acquire immediately
    const immediateTry = await sendToWorker(worker2, 'TRY_ACQUIRE', { lockKey: expireKey, ttlMs: 5000 });
    if (immediateTry.lease !== null) {
      throw new Error('Test 5 Failed: Worker 2 acquired unexpired lease prematurely.');
    }

    // Wait for TTL (250ms + 100ms buffer)
    console.log('Waiting 350ms for lock lease TTL expiry...');
    await new Promise(r => setTimeout(r, 350));

    const recoveryTry = await sendToWorker(worker2, 'TRY_ACQUIRE', { lockKey: expireKey, ttlMs: 5000 });
    if (!recoveryTry.lease) {
      throw new Error('Test 5 Failed: Worker 2 failed to acquire lock after crash and TTL expiration.');
    }
    console.log(`✅ Test 5: Crash & TTL Expiration Auto-Recovery Verified (Recovered by ${recoveryTry.workerId})`);
    passedTests++;

    console.log('----------------------------------------------------------------');
    console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | STATUS: 100% VERIFIED ✅`);
    console.log('================================================================');
    process.exit(0);
  } finally {
    // Terminate all spawned child processes
    for (const w of workers) {
      try {
        w.kill();
      } catch {}
    }
  }
}

runCertification().catch((err: any) => {
  console.error('❌ Multi-Process Concurrency Certification Failed:', err);
  process.exit(1);
});
