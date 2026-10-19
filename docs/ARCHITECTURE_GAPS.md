# Architecture Gaps & Code Discrepancies Report

**Target:** `docs/ARCHITECTURE_GAPS.md`  
**Author:** Principal Software Architect & Security Auditor  
**Date:** 2026-08-27  
**Scope:** Discrepancy Analysis between Documentation/Specifications and Actual Source Code  

---

## 1. Executive Gap Matrix

| Gap ID | Domain | Discrepancy / Risk Description | Severity | Source Evidence in Codebase |
| :--- | :--- | :--- | :---: | :--- |
| **GAP-01** | **Testing & QA** | `runDkosLiveProductProof.ts` test fixture alignment. | **RESOLVED (Phase 1)** | All 30/30 test proof points passing, verified via `runDkosLiveProductProof.ts`. |
| **GAP-02** | **Security (Auth)** | Unsalted single-round `SHA-256` password hashing. | **P0 (Critical)** | `server/services/authService.ts` line 8 (`crypto.createHash('sha256').update(password).digest('hex')`). |
| **GAP-03** | **Security (Session)**| Auth Bearer tokens stored in browser `localStorage` instead of `HttpOnly` cookies. | **P1 (High)** | `src/context/TripContext.tsx` line 85 (`localStorage.setItem('dahab_auth_token', token)`). |
| **GAP-04** | **Persistence** | In-Memory Database with `JSON.stringify` on transactions and file-based WAL. | **P1 (High)** | `server/db/database.ts` lines 157-184 (`this.transactionBackup = JSON.stringify(this.state)`). |
| **GAP-05** | **Architecture** | Cross-layer dependency leak: Backend service importing directly from frontend types. | **P2 (Medium)**| `server/services/daygiTaskOrchestrator.ts` line 14 (`import { ... } from '../../src/types'`). |
| **GAP-06** | **State Management**| Monolithic Frontend Context with excessive responsibilities (1,338 lines). | **P2 (Medium)**| `src/context/TripContext.tsx` (Handles Auth, Routing, Cart, Bookings, Offline sync, Modals). |
| **GAP-07** | **Concurrency** | Distributed locking relying on single-process in-memory Sets & Maps. | **P1 (High)** | `server/services/daygiTaskOrchestrator.ts` (`executingLocks: Set<string>`, `idempotencyRegistry`). |
| **GAP-08** | **Dual Source of Truth**| Fragmented persistence between Firestore and Server JSON database without sync adapter. | **P2 (Medium)**| `src/lib/firebase.ts` + `server/db/database.ts` (No 2-way authoritative synchronization). |
| **GAP-09** | **Route Routing** | State-driven pseudo-routing in React lacking URL synchronization & browser history support. | **P3 (Low)** | `src/App.tsx` (`renderCurrentView()` switches based on `currentRoute` state). |

---

## 2. Detailed Gap Analysis

### 2.1 GAP-01: Certification Suite Test Discrepancies
* **Documented Claim**: `PROJECT_DOCUMENTATION.md` stated that the DKOS 30-Point Live Product Proof suite verifies 100% of spatial, supplier, and resolution invariants.
* **Code Ground Truth**: Running `npx tsx server/test/runDkosLiveProductProof.ts` produces **25 passed, 5 failed**.
* **Root Cause**:
  1. **Point 6 (Entity Resolution)**: Test expects exact Arabic transliteration match against `canonical Lighthouse reef`, but the seed dataset in `server/data/dkosExpansionData.ts` has alternate canonical naming keys.
  2. **Point 11 (Unified Retrieval)**: Test expects an automatic dining adjacency recommendation attached to the response, but the mock query parser did not trigger the food flag.
  3. **Point 16 (Supplier Governance)**: Test asserts `verifiedSupplierStage === 'ACTIVE'`, but initial seed status is `OBSERVATION_ONLY`.
  4. **Point 27 (Golden Journey Scenario)**: Test asserts pairing with `"Ali Baba Waterfront Seafood"`, but seed returns `"Red Cat Artisan Trattoria & Pizzeria"`.
  5. **Point 30 (Final Certification)**: Fails as a rollup of the above 4 points.
* **Remediation**: Reconcile seed data entity fixtures with test assertion expectations without altering core domain logic.

---

### 2.2 GAP-02: Unsalted SHA-256 Password Hashing
* **Location**: `server/services/authService.ts`:
  ```typescript
  private hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }
  ```
* **Security Risk**: Plain `SHA-256` is an un-salted, fast cryptographic hash designed for data integrity, not password storage. Modern GPUs can calculate billions of SHA-256 hashes per second, making stored passwords susceptible to rainbow table and brute-force attacks.
* **Target Architecture**: Migrate to **Argon2id** or salted **PBKDF2 / bcrypt** with minimum 100,000 iterations and per-user cryptographic salts.

---

### 2.3 GAP-03: LocalStorage Auth Token Exposure
* **Location**: `src/context/TripContext.tsx` & `src/services/api.ts`.
* **Security Risk**: Tokens stored in `localStorage` are accessible to any JavaScript running within the origin. If an XSS vulnerability exists (e.g. from third-party scripts or un-sanitized user input), the session token can be exfiltrated.
* **Target Architecture**: Transition session management to `HttpOnly`, `Secure`, `SameSite=Strict` cookies.

---

### 2.4 GAP-04: In-Memory JSON Database & Transaction Backup Overhead
* **Location**: `server/db/database.ts`:
  ```typescript
  public beginTransaction() {
    if (this.transactionDepth === 0) {
      this.isTransactionActive = true;
      this.transactionBackup = JSON.stringify(this.state);
    }
    this.transactionDepth++;
  }
  ```
* **Architectural Risk**:
  1. `JSON.stringify(this.state)` deep-clones the entire dataset (all 25 collections) whenever a transaction begins.
  2. Memory footprint and CPU time scale linearly with dataset size ($O(N)$), leading to high event-loop blocking latencies.
  3. Cannot scale across multiple horizontal instances in Cloud Run.
* **Target Architecture**: Introduce a Database Abstraction Layer (`server/db/interfaces/`) with adapters for both JSON (for fast local dev/testing) and **PostgreSQL** (for production persistence, ACID transactions, and horizontal scaling).

---

### 2.5 GAP-05: Backend-to-Frontend Type Coupling
* **Location**: `server/services/daygiTaskOrchestrator.ts`:
  ```typescript
  import {
    DayGiOrchestratedTask,
    DayGiOrchestratedStep,
    ...
  } from '../../src/types';
  ```
* **Architectural Risk**: Backend server modules are directly referencing frontend source files (`../../src/types.ts`), violating modular architecture principles and creating circular build coupling.
* **Target Architecture**: Extract domain models and API contracts into a centralized shared layer (`packages/shared/` or `src/shared/`).

---

### 2.6 GAP-06: Monolithic Frontend State Container (`TripContext.tsx`)
* **Location**: `src/context/TripContext.tsx` (1,338 lines).
* **Code Smell & Maintainability Risk**:
  - `TripContext` combines Authentication, Route Navigation, Trip Timeline, Dynamic Cart, Multi-Vertical Commerce Holds, Food Ordering, Disruption Recovery, Market Intelligence Opportunities, and Modal Visibility.
  - Any state change triggers re-renders across all consumer components.
* **Target Architecture**: Decompose `TripContext` into domain-specific contexts/stores:
  - `AuthContext` (User session, login, signup, Firebase sync)
  - `TripContext` (Active trip timeline & itinerary)
  - `CommerceContext` (Cart, holds, checkout)
  - `UIContext` (Modals, search drawer, quick dock, toast notifications)

---

### 2.7 GAP-07: In-Process Locking & State Storage
* **Location**: `server/services/daygiTaskOrchestrator.ts` (`executingLocks`, `idempotencyRegistry`, `confirmationMemory`).
* **Risk**:
  - If a task execution is initiated on Instance A, Instance B in a multi-instance container cluster has no visibility into `executingLocks`, potentially allowing concurrent execution of non-idempotent actions.
* **Target Architecture**: Move task locking and idempotency tracking into database transactions / Redis locks.
