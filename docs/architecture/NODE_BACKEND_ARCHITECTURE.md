# DAHAB APPLICATION BACKEND ARCHITECTURE SPECIFICATION
**Architecture Baseline**: Node.js / Express / Cloud SQL PostgreSQL / Firebase Auth / Google Maps / Gemini 3.7  
**Document ID**: `DOC-ARCH-2026-NODE-BACKEND-APPLICATION`  
**Classification**: Production-Oriented Enterprise Backend Specification  
**Version**: 2026.1 Production Release  

---

## 1. System Topology & Layering

```
+-----------------------------------------------------------------------------------+
|                              REACT / VITE CLIENT                                  |
|         (UI Shell, State Presentation, i18n, No Business Logic Mutation)           |
+-----------------------------------------------------------------------------------+
                                         |
                                         | HTTPS / REST / JSON
                                         v
+-----------------------------------------------------------------------------------+
|                           EXPRESS API & MIDDLEWARE                                |
|  - Correlation ID Middleware       - Centralized Error Handler (RFC 7807)         |
|  - Rate Limiter                    - Structured Audit Logger (Pino/JSON format)   |
|  - Firebase Auth / Session Token   - Role-Based Access Control (RBAC)             |
+-----------------------------------------------------------------------------------+
                                         |
          +------------------------------+-------------------------------+
          |                              |                               |
          v                              v                               v
+-------------------+          +-------------------+          +---------------------+
|   CONTROLLERS     |          |  DAYGI ORCHESTRA  |          |   OPS & RECOVERY    |
| - Dahab Context   |          | - Intent Analyzer |          | - Hold Manager      |
| - Unified Search  |          | - State Machine   |          | - Ledger Engine     |
| - Places/Activity |          | - Step Executor   |          | - Quality Monitor   |
| - Bookings/Trips  |          | - Guardrails Gate |          | - Incident Registry |
+-------------------+          +-------------------+          +---------------------+
          |                              |                               |
          +------------------------------+-------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                              APPLICATION SERVICES                                 |
|  - DahabKnowledgeOs        - RankingEngine         - SearchEngine                 |
|  - EntityResolutionService - ConflictEngine        - SnapshotService              |
|  - GeointelligenceService  - CommerceService       - TripService                  |
|  - PaymentService          - LedgerService         - RecoveryService              |
+-----------------------------------------------------------------------------------+
                                         |
          +------------------------------+-------------------------------+
          |                              |                               |
          v                              v                               v
+-------------------+          +-------------------+          +---------------------+
|    INTEGRATIONS   |          |   ASYNC JOBS &    |          |    REPOSITORIES     |
|  - Firebase Auth  |          |    EVENT BUS      |          | (PostgreSQL Author- |
|  - Google Maps    |          | - Event Dispatch  |          |  itative Store)     |
|  - Gemini 3.7     |          | - Knowledge Synch |          | - Trips & Items     |
|    (Reasoning     |          | - Stale Detect    |          | - Bookings & Holds  |
|     Only)         |          | - Telemetry Queue |          | - Facts & Evidence  |
+-------------------+          +-------------------+          +---------------------+
```

---

## 2. Core Architectural Guarantees

1. **Deterministic Business Authority**:
   - The React frontend does NOT contain business truth or direct database writes.
   - All state transitions (Trip creation, item holding, direct booking, payment verification, double-entry ledger settlement, supplier disbursement) are executed in transactional backend services.

2. **Integration Boundaries**:
   - **Firebase Auth**: Used exclusively for identity token issuance and verification. User roles and permissions are enforced server-side.
   - **Google Maps**: Used strictly for geospatial context, geocoding validation, route travel duration estimates, and discovery candidate signals.
   - **Gemini (Google Gen AI)**: Used solely for semantic reasoning, translation, and intent interpretation. Gemini is **strictly forbidden** from mutating database records or approving financial transactions directly.

3. **PostgreSQL Authoritative Storage**:
   - Cloud SQL PostgreSQL holds all authoritative entities: Users, Sessions, Trips, TripItems, InventorySlots, Bookings, PaymentTransactions, LedgerEntries, Suppliers, AuditLogs, KnowledgeFacts, EvidenceNodes, TemporalHistories, and ConflictSets.

4. **Fault Tolerance & Reliability**:
   - Idempotent API requests using `Idempotency-Key` headers.
   - Concurrency locking with optimistic version checks and inventory slot reservations.
   - Automated compensation and rollback on payment or supplier failures.
