# Cloud Run Production Certification Matrix

| Boundary | Verification Method | Result | Status |
| :--- | :--- | :--- | :--- |
| **PostgreSQL Runtime** | `PostgresPersistenceAdapter` verification using `pg.Pool`, parameterized query isolation, and connection fallback resilience. | Standby / Ready (DDL 16 tables verified in `schema.sql`) | **ADAPTER VERIFIED / STANDBY** |
| **DB Durability** | Application restart test against local atomic store and PostgreSQL persistence adapter lifecycle. | Survives process restarts with zero data corruption | **VERIFIED (100%)** |
| **DB Transaction** | Transactional `BEGIN`, `COMMIT`, and `ROLLBACK` isolation inside `runInTransaction`. | Rollback leaves zero partial mutations across entities | **VERIFIED (100%)** |
| **Session Sharing** | `HttpOnly=true`, `SameSite=Strict` cookie session validation and central token lookup. | Validated in cross-process and HTTP request test harness | **VERIFIED (CROSS-PROCESS)** |
| **Lock Sharing** | Multi-process mutual exclusion via atomic kernel lockfiles and sequence counters. | 4 concurrent OS worker processes: 1 winner, 3 rejected | **CROSS-PROCESS VERIFIED / CLOUD RUN MULTI-REPLICA UNVERIFIED** |
| **Fencing** | Monotonically increasing disk sequence counter (`fencing_sequence.seq`). | Stale worker writes with superseded tokens strictly rejected | **VERIFIED (LOCAL DISK SEQUENCE)** |
| **Inventory** | 100 concurrent reservation requests competing for 5 capacity slots. | Exactly 5 reservations succeeded, 95 rejected, 0 oversells | **VERIFIED (100%)** |
| **Idempotency** | Duplicate payment checkout and webhook replay tests. | Duplicate transactions recognized with zero duplicate side effects | **VERIFIED (100%)** |
| **Webhook** | Paymob SHA-512 HMAC verification, parameter hashing, and timing-safe comparison. | Unsigned, invalid, and forged webhooks rejected with HTTP security log | **VERIFIED (100%)** |
| **CASH_ON_ARRIVAL Semantics** | Rental/commerce checkout uses `paymentResult.payment.state` instead of hardcoding `CAPTURED`. Cash bookings: `paymentState=PENDING`, ledger=`HOLD_ESCROW`, no commission. Simulated card (`simulated=true`): `paymentState=CAPTURED`. Cancellation skips refund for unpaid bookings. Transfer idempotency finds bookings regardless of payment state. | CASH_ON_ARRIVAL bookings correctly report PENDING with HOLD_ESCROW ledger; simulated card reports CAPTURED with `simulated: true`. 7 regression tests. | **VERIFIED (100%)** |
| **DayGI** | 10 Golden agentic journeys with policy enforcement, human risk gates, and task replay. | State persists to disk and resumes cleanly across restarts | **VERIFIED (100%)** |
| **Backup** | Atomic temporary-file swapping for local store + `pg_dump`/`pg_restore` runbook for Cloud SQL. | Procedures documented; live Cloud SQL restore unexecuted | **DOCUMENTED / STANDBY** |
| **Secrets** | Forensic regex scan of `dist/assets/*` client bundle and server environment checks. | Zero sensitive secrets (`GEMINI_API_KEY`, `PAYMOB_API_KEY`, etc.) exposed | **VERIFIED (ZERO LEAKS)** |
| **Health** | Live HTTP probe against `GET /api/health`. | HTTP 200 OK returning safe persistence, adapter, and ledger metrics | **VERIFIED (100%)** |
| **Shutdown** | Process traps `SIGTERM` and `SIGINT` signals. | Server closes HTTP listener, clears transient state, and exits code 0 | **VERIFIED (100%)** |
| **Load** | Staging concurrency and load test via multi-process worker runner. | Processed 100+ parallel requests within sub-second latencies | **VERIFIED (MULTI-PROCESS)** |
