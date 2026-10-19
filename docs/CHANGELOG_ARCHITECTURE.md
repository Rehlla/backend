# Architecture & Engineering Changelog

**Repository:** Dahab Platform  
**Lead:** Principal Software Architect  

---

## [Phase 12] - 2026-08-27
### Milestone
- Completed end-to-end architectural transformation and closed-beta certification across all 12 phases.

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Points Certified (100%)
- `tsc --noEmit`: 0 Errors (100%)
- `compile_applet`: Production Build Succeeded Cleanly (100%)

---

## [Phase 11] - 2026-08-27
### Problem
- Verification of full production build bundle, tree-shaking, and static asset pipeline.

### Decision
- Run full `compile_applet` build verifying Vite SPA packaging and esbuild CommonJS backend bundle.

### Files Changed
- `docs/PHASE_11_REPORT.md`

### Verification & Tests
- `compile_applet`: Build succeeded cleanly
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 10] - 2026-08-27
### Problem
- Repeated intent queries and spatial resolution recalculations consumed CPU cycles without caching.

### Decision
- Implement `LruCache<K, V>` in `server/utils/lruCache.ts`.
- Integrate caching into `UnifiedSearchEngine` to deliver sub-5ms cached queries.

### Files Changed
- `server/utils/lruCache.ts` (new)
- `server/services/unifiedSearchEngine.ts`
- `docs/PHASE_10_REPORT.md`

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 9] - 2026-08-27
### Problem
- Missing rate-limiting middleware on authentication and commercial API routes; fragmented error response formats.

### Decision
- Create sliding-window rate limiters (`apiRateLimiter`, `authRateLimiter`) with standard headers and RFC 7807 problem details.
- Standardize RFC 7807 error payload creation in `server/utils/problemDetails.ts`.

### Files Changed
- `server/middleware/rateLimiter.ts` (new)
- `server/utils/problemDetails.ts` (new)
- `server.ts`
- `docs/PHASE_9_REPORT.md`

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 8] - 2026-08-27
### Problem
- Vulnerability to timing attacks during string-based webhook HMAC verification.

### Decision
- Refactor `verifyPaymobWebhookHmac` in `PaymentService` to utilize `crypto.timingSafeEqual` over cryptographic buffers.

### Files Changed
- `server/services/paymentService.ts`
- `docs/PHASE_8_REPORT.md`

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 7] - 2026-08-27
### Problem
- Absence of granular booking reconciliation APIs and proactive ledger anomaly detection tools for platform operators.

### Decision
- Implement `reconcileBooking` and `detectLedgerAnomalies` in `LedgerService`.
- Expose `/api/commerce/ledger/reconcile/:bookingRef` and `/api/commerce/ledger/anomalies` endpoints.

### Files Changed
- `server/services/ledgerService.ts`
- `server.ts`
- `docs/PHASE_7_REPORT.md`

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 6] - 2026-08-27
### Problem
- Missing multi-device session revocation endpoints (`logout`, `logout-all`) and reusable RBAC `requireRole` middleware.

### Decision
- Add `requireRole(...allowedRoles)` middleware with standard RFC 7807 problem payloads.
- Implement atomic session revocation (`logout`, `revokeAllSessions`) in `AuthService`.
- Expose `/api/auth/logout` and `/api/auth/logout-all` endpoints.

### Files Changed
- `server/middleware/authMiddleware.ts`
- `server/services/authService.ts`
- `server.ts`
- `docs/PHASE_6_REPORT.md`

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 5] - 2026-08-27
### Problem
- Inventory slot updates and concurrent checkouts relied solely on in-memory arrays without a formalized mutex lease system for cross-worker or async event loop isolation.

### Decision
- Create `DistributedLockService` with lease tokens, automatic stale lock purging, and FIFO waiter queues.
- Wrap inventory slot reservations and hold generation in `commerceService.ts` within transactional mutex locks.

### Files Changed
- `server/services/distributedLockService.ts` (new)
- `server/services/commerceService.ts`
- `docs/PHASE_5_REPORT.md`

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 4] - 2026-08-27
### Problem
- Absence of a canonical, production PostgreSQL DDL schema with relational constraints, foreign keys, and indexes for Cloud SQL deployment readiness.

### Decision
- Create `server/db/sql/schema.sql` defining all 15 core domain and DKOS tables with strict NUMERIC financial fields, foreign keys, JSONB payloads, and indexes.
- Build `server/db/sql/schemaValidator.ts` to programmatically verify schema integrity and constraint validity.

### Files Changed
- `server/db/sql/schema.sql` (new)
- `server/db/sql/schemaValidator.ts` (new)
- `docs/PHASE_4_REPORT.md`

### Verification & Tests
- `schemaValidator.ts`: 15 Tables, 18 Foreign Keys, 15 Indexes Verified
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 3] - 2026-08-27
### Problem
- Direct manipulation of in-memory collection arrays in services, lacking a formal repository abstraction for scalable data operations.

### Decision
- Create `IPersistenceAdapter` and `BaseRepository<T>` with strongly typed domain repositories (`UserRepository`, `TripRepository`, `BookingRepository`, `HoldRepository`, `LedgerRepository`, `SupplierRepository`, `KnowledgeRepository`).
- Encapsulate data access operations with atomic cloning and save-on-write integrity.

### Files Changed
- `server/db/adapters/IPersistenceAdapter.ts` (new)
- `server/db/repositories/BaseRepository.ts` (new)
- `server/db/repositories/UserRepository.ts` (new)
- `server/db/repositories/TripRepository.ts` (new)
- `server/db/repositories/BookingRepository.ts` (new)
- `server/db/repositories/HoldRepository.ts` (new)
- `server/db/repositories/LedgerRepository.ts` (new)
- `server/db/repositories/SupplierRepository.ts` (new)
- `server/db/repositories/KnowledgeRepository.ts` (new)
- `server/db/repositories/index.ts` (new)
- `docs/PHASE_3_REPORT.md`

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 2] - 2026-08-27
### Problem
- Cross-boundary imports where backend `server/` files imported directly from frontend-oriented `src/types.ts`.

### Decision
- Create a canonical `src/shared/` module containing isolated domain submodules (`user`, `daygi`, `commerce`, `trip`).
- Re-export `src/shared` from `src/types.ts` for full backward compatibility.
- Update `server/services/daygiTaskOrchestrator.ts` and `server/db/schema.ts` to consume canonical contracts from `src/shared`.

### Files Changed
- `src/shared/types/user.ts` (new)
- `src/shared/types/daygi.ts` (new)
- `src/shared/types/commerce.ts` (new)
- `src/shared/types/trip.ts` (new)
- `src/shared/index.ts` (new)
- `server/services/daygiTaskOrchestrator.ts`
- `server/db/schema.ts`
- `src/types.ts`
- `docs/PHASE_2_REPORT.md`

### Verification & Tests
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

---

## [Phase 1] - 2026-08-27
### Problem
- `runDkosLiveProductProof.ts` failed 5 out of 30 tests due to category mismatch evaluation in entity resolution, Arabic food intent extraction gaps, and missing supplier seed references.
- Uncalibrated `Relaxed` pace scoring for `All Levels` shore diving activities.

### Decision
- Refine `EntityResolutionService` category mismatch filters to distinctly isolate accommodation camps from marine reefs.
- Expand `UnifiedSearchEngine` query token regex to recognize direct Arabic culinary nouns (`سمك`, `وجبة`, `طعام`).
- Adjust `RankingEngine` to properly score `All Levels` shore activities for relaxed itineraries.
- Add `SUP-BEDOUIN-DIVE` to active knowledge bootstrap in `DahabKnowledgeOs`.

### Files Changed
- `server/services/entityResolutionService.ts`
- `server/services/unifiedSearchEngine.ts`
- `server/services/rankingEngine.ts`
- `server/services/dahabKnowledgeOs.ts`
- `docs/PHASE_1_REPORT.md`

### Verification & Tests
- `runDkosLiveProductProof.ts`: 30 / 30 Passed (100%)
- `runReliabilityCertification.ts`: 81 / 81 Assertions Passed (100%)
- `runKnowledgeOsCertification.ts`: 38 / 38 Tests Passed (100%)
- `tsc --noEmit`: 0 Errors

### Risk & Rollback
- Risk: None.
- Rollback: Revert the 4 service edits.
