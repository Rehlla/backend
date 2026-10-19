import { execSync } from 'child_process';

const suites = [
  { name: 'Core Domain & Commerce Services', file: 'server/test/runCoreDomainServicesCertification.ts' },
  { name: 'Database Architecture & Relational Schema', file: 'server/test/runDatabaseArchitectureCertification.ts' },
  { name: 'Distributed Lock & Atomic Persistence', file: 'server/test/runDistributedLockAndPersistenceCertification.ts' },
  { name: 'Knowledge OS & Spatial Temporal Engine', file: 'server/test/runKnowledgeOsCertification.ts' },
  { name: 'Reliability & Fault-Tolerance', file: 'server/test/runReliabilityCertification.ts' },
  { name: 'Security, HMAC & scrypt Cryptography', file: 'server/test/runSecurityCertification.ts' },
  { name: 'State Management & Frontend Decoupling', file: 'server/test/runStateManagementAndFrontendDecouplingCertification.ts' },
  { name: 'DKOS Live Product & Proactive AI Proof', file: 'server/test/runDkosLiveProductProof.ts' },
  { name: 'Phase A: Session Transport & Cookie Security', file: 'server/test/runSessionTransportSecurityTest.ts' },
  { name: 'Phase B: PostgreSQL Persistence & Schema', file: 'server/test/runPostgresPersistenceCertification.ts' },
  { name: 'Phase C: Multi-Process Distributed Concurrency', file: 'server/test/runMultiProcessConcurrencyCertification.ts' },
  { name: 'Dahab Local Commerce & Provenance Intelligence', file: 'server/test/runDahabLocalCommerceCertification.ts' },
  { name: 'Dahab Data Truth & Instagram Market Intelligence', file: 'server/test/runDahabInstagramDataQualityCertification.ts' },
  { name: 'Project Content & Data Truth Integrity', file: 'server/test/runProjectContentIntegrityCertification.ts' },
  { name: 'Local Commerce Intelligence & Offer Comparison', file: 'server/test/runDahabCommerceIntelligenceCertification.ts' },
  { name: 'Live Dahab Market Intelligence & Data Freshness', file: 'server/test/runDahabMarketFreshnessCertification.ts' },
  { name: 'Live Dahab Market Refresh Engine & Change Pipeline', file: 'server/test/runLiveDahabMarketRefreshCertification.ts' }
];

console.log('================================================================================');
console.log('🏆 MASTER PRODUCTION HARDENING CERTIFICATION HARNESS');
console.log('================================================================================');

let totalSuitesPassed = 0;

for (let i = 0; i < suites.length; i++) {
  const s = suites[i];
  console.log(`\n[Suite ${i + 1}/${suites.length}] Executing: ${s.name}...`);
  try {
    const output = execSync(`npx tsx ${s.file}`, { stdio: 'pipe' }).toString();
    console.log(output.trim());
    console.log(`✅ [Suite ${i + 1}/${suites.length}] ${s.name} PASSED`);
    totalSuitesPassed++;
  } catch (err: any) {
    console.error(`❌ [Suite ${i + 1}/${suites.length}] ${s.name} FAILED!`);
    if (err.stdout) console.error(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

console.log('\n================================================================================');
console.log(`🎉 ALL ${suites.length}/${suites.length} PRODUCTION CERTIFICATION SUITES PASSED WITH ZERO REGRESSIONS`);
console.log('================================================================================');
