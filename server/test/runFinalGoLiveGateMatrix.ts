import { execSync } from 'child_process';
import fs from 'fs';

interface SuiteResult {
  name: string;
  file: string;
  command: string;
  exitCode: number;
  durationMs: number;
  passed: number;
  failed: number;
  skipped: number;
  status: 'PASSED' | 'FAILED';
  output: string;
}

const suites = [
  { name: 'Core Domain & Commerce Services', file: 'server/test/runCoreDomainServicesCertification.ts', expectedCount: 10 },
  { name: 'Database Architecture & Relational Schema', file: 'server/test/runDatabaseArchitectureCertification.ts', expectedCount: 6 },
  { name: 'Distributed Lock & Atomic Persistence', file: 'server/test/runDistributedLockAndPersistenceCertification.ts', expectedCount: 6 },
  { name: 'Knowledge OS & Spatial Temporal Engine', file: 'server/test/runKnowledgeOsCertification.ts', expectedCount: 40 },
  { name: 'Reliability & Fault-Tolerance', file: 'server/test/runReliabilityCertification.ts', expectedCount: 17 },
  { name: 'Security, HMAC & scrypt Cryptography', file: 'server/test/runSecurityCertification.ts', expectedCount: 50 },
  { name: 'State Management & Frontend Decoupling', file: 'server/test/runStateManagementAndFrontendDecouplingCertification.ts', expectedCount: 41 },
  { name: 'DKOS Live Product & Proactive AI Proof', file: 'server/test/runDkosLiveProductProof.ts', expectedCount: 30 },
  { name: 'Phase A: Session Transport & Cookie Security', file: 'server/test/runSessionTransportSecurityTest.ts', expectedCount: 8 },
  { name: 'Phase B: PostgreSQL Persistence & Schema', file: 'server/test/runPostgresPersistenceCertification.ts', expectedCount: 7 },
  { name: 'Phase C: Multi-Process Distributed Concurrency', file: 'server/test/runMultiProcessConcurrencyCertification.ts', expectedCount: 5 },
  { name: 'Dahab Local Commerce & Provenance Intelligence', file: 'server/test/runDahabLocalCommerceCertification.ts', expectedCount: 27 }
];

console.log('================================================================================');
console.log('🚀 FINAL PRODUCTION GO-LIVE GATE EXECUTION');
console.log('================================================================================');

const results: SuiteResult[] = [];
let totalPassed = 0;
let totalFailed = 0;
let totalDuration = 0;

for (let i = 0; i < suites.length; i++) {
  const s = suites[i];
  const cmd = `npx tsx ${s.file}`;
  const startTime = Date.now();
  let exitCode = 0;
  let rawOutput = '';
  let status: 'PASSED' | 'FAILED' = 'PASSED';
  let passed = 0;
  let failed = 0;
  const skipped = 0;

  try {
    rawOutput = execSync(cmd, { stdio: 'pipe' }).toString();
    exitCode = 0;
  } catch (err: any) {
    exitCode = err.status || 1;
    rawOutput = (err.stdout?.toString() || '') + '\n' + (err.stderr?.toString() || '');
    status = 'FAILED';
  }

  const durationMs = Date.now() - startTime;
  totalDuration += durationMs;

  // Extract pass counts from output patterns
  const totalMatches = rawOutput.match(/(?:PASSED|TOTAL CHECKS|TOTAL ASSERTIONS|TOTAL POINTS|TOTAL):\s*(\d+)/i);
  const passedMatches = rawOutput.match(/PASSED:\s*(\d+)/i);

  if (passedMatches && passedMatches[1]) {
    passed = parseInt(passedMatches[1], 10);
  } else {
    passed = (rawOutput.match(/✅/g) || []).length;
  }

  if (exitCode !== 0 || status === 'FAILED') {
    failed = Math.max(1, s.expectedCount - passed);
    status = 'FAILED';
    totalFailed += failed;
  } else {
    totalPassed += passed;
  }

  results.push({
    name: s.name,
    file: s.file,
    command: cmd,
    exitCode,
    durationMs,
    passed,
    failed,
    skipped,
    status,
    output: rawOutput
  });

  console.log(`[${i + 1}/${suites.length}] ${s.name} | Exit: ${exitCode} | Time: ${durationMs}ms | Checks: ${passed} passed, ${failed} failed -> ${status}`);
}

console.log('================================================================================');
console.log(`SUMMARY: Total Duration: ${totalDuration}ms | Passed Checks: ${totalPassed} | Failed: ${totalFailed}`);
console.log('================================================================================');

fs.writeFileSync('data/go_live_gate_results.json', JSON.stringify({ summary: { totalPassed, totalFailed, totalDuration, totalSuites: suites.length }, results }, null, 2));
