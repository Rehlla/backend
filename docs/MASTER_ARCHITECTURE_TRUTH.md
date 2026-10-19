# MASTER ARCHITECTURE TRUTH

**Date:** August 31, 2026  
**Evidence standard:** Every claim verified against the repository. No assumptions.

---

## 1. What This Application Is

A **full-stack travel platform** for Dahab, South Sinai, Egypt. It runs as a single Node.js process serving both the React SPA and the Express API.

**Evidence:** `package.json` name is `react-example`. `server.ts` is the entry point. `vite.config.ts` builds the frontend. The build script bundles both: `vite build && esbuild server.ts --bundle`.

---

## 2. Runtime Architecture

### 2.1 Single Process

```
Node.js process (port 3000)
├── Express 4.21 (HTTP server)
│   ├── Vite dev middleware (dev) OR static file serving (prod)
│   ├── API routes (~120 endpoints)
│   └── Middleware pipeline
├── In-memory database (all tables in RAM)
└── SQLite persistence (data/dahab.sqlite, default) / JSON file (json adapter)
└── External API calls (Gemini, Open-Meteo, Twilio)
```

**Evidence:** `server.ts` line: `const app = express()`. `server.ts` line: `const PORT = Number(process.env.PORT) || 3000`. `server/db/database.ts`: `export const db = new Database()` — singleton in-memory store.

### 2.2 Frontend

| Layer | Technology | Version | Evidence |
|-------|-----------|---------|----------|
| Framework | React | 19.0.1 | `package.json` |
| Build | Vite | 6.2.3 | `package.json`, `vite.config.ts` |
| Styling | Tailwind CSS | 4.1.14 | `package.json`, `@tailwindcss/vite` plugin |
| Animation | Motion | 12.23.24 | `package.json` (formerly Framer Motion) |
| Icons | Lucide React | 0.546.0 | `package.json` |
| Maps | @vis.gl/react-google-maps | 1.9.0 | `package.json` (lazy-loaded) |
| Language | TypeScript | 5.8.2 | `package.json` devDependencies |

**Routing:** State-driven via `useTrip()` context, not React Router. `App.tsx` `renderCurrentView()` switches on `currentRoute` string. Lazy-loaded via `React.lazy()` for all 25+ views.

**Evidence:** `src/App.tsx` — no `react-router` import. `renderCurrentView()` uses `switch (currentRoute)`.

### 2.3 Backend

| Layer | Technology | Version | Evidence |
|-------|-----------|---------|----------|
| Runtime | Node.js | >=18.0.0 | `package.json` engines (implied) |
| HTTP | Express | 4.21.2 | `package.json`, `server.ts` |
| TypeScript | tsx | 4.21.0 | `package.json` (dev script: `tsx server.ts`) |
| Production bundle | esbuild | 0.25.0 | `package.json` (build script) |
| Security | Helmet | 8.3.0 | `package.json`, `server.ts` |
| Cookies | cookie-parser | 1.4.7 | `package.json`, `server.ts` |

**Entry point:** `server.ts` — 2571 lines. Contains inline route handlers (~60) plus mounts `dahabRouter` and `adminDahabRouter`.

### 2.4 Database / Persistence

Persistence is adapter-based, chosen by `PERSISTENCE_ADAPTER` at boot
(`server/db/selectAdapter.ts`). **SQLite is the default and the primary
production store.**

| Component | Implementation | Evidence |
|-----------|---------------|----------|
| Primary store (default) | **SQLite** at `data/dahab.sqlite` via `better-sqlite3` (sync, WAL, FKs, indexes, per-row writes) | `selectAdapter.ts`, `server/db/sqlite/SqlitePersistenceAdapter.ts`, `docs/DATABASE.md` |
| Alternate store | JSON file (atomic temp+rename) `data/dahab_db.json` — supported for tests & rollback via `PERSISTENCE_ADAPTER=json` | `JsonFilePersistenceAdapter.ts`, `selectAdapter.ts` |
| In-memory mirror | `server/db/database.ts`: `DatabaseState` singleton holding 40+ typed array fields | `server/db/database.ts` |
| Postgres adapter | EXISTS but `save()` is NOT IMPLEMENTED | `PostgresPersistenceAdapter.save()` logs error and returns |
| Test isolation | InMemoryPersistenceAdapter | `tests/setup.ts` swaps adapter at module level |

**Critical facts:**
- `selectAdapter` defaults to `sqlite`. It refuses to auto-migrate: if `dahab.sqlite`
  is missing but `dahab_db.json` exists, it throws instead of silently starting empty.
- The Postgres adapter's `save()` is an empty stub. It refuses to be selected unless
  `ALLOW_NONPERSISTENT_POSTGRES_ADAPTER=true` is set; `assertUsable()` throws otherwise.

**Evidence:** `selectAdapter.ts`: `const requested = (env.PERSISTENCE_ADAPTER || 'sqlite')`. `PostgresPersistenceAdapter.save()`: `console.error('[PostgresPersistenceAdapter] save() is not implemented...')`. `PostgresPersistenceAdapter.assertUsable()`: throws unless env var set.

### 2.5 Authentication

| Mechanism | Status | Evidence |
|-----------|--------|----------|
| Email/password login | ✅ Working | `POST /api/auth/login` → `authService.login()` |
| Email/password register | ✅ Working | `POST /api/auth/register` → `authService.register()` |
| Firebase Google OAuth | ❌ Broken (503) | `POST /api/auth/firebase-session` → `firebaseAdminService.credentialState()` returns false |
| Session storage | HttpOnly cookie | `Set-Cookie: dahab_auth_token=...; HttpOnly; SameSite=Strict` |
| Session token format | `tok_...` (72h TTL) | `authService.ts` |
| Password hashing | SHA-256 (legacy) + scrypt | `UserEntity.passwordAlgorithm` field |
| Token validation | Header OR cookie | `authMiddleware.ts`: `requireAuth` reads both |

**Critical fact:** Firebase Admin has no credentials on this deployment. `firebaseAdminService.credentialState()` returns false. Every Google sign-in returns 503.

**Evidence:** `server.ts` line: `firebaseAdminConfigured: firebaseAdminService.credentialState()`. `AuthContext.tsx`: `isFederatedSignInAvailable` set from `/api/health`.

### 2.6 External Integrations

| Service | Purpose | Status | Evidence |
|---------|---------|--------|----------|
| Google Gemini | AI reasoning, trip generation | ✅ Working (with quota) | `@google/genai` ^2.4.0, `geminiReasoningService.ts` |
| Open-Meteo | Weather conditions | ✅ Working (free, no key) | `weatherService.ts`: fetches from `api.open-meteo.com` |
| Firebase Auth | Google OAuth | ❌ No Admin credentials | `firebaseAdminService.ts` |
| Firebase Firestore | Cloud sync | ❌ Not configured | `firestore.rules` exists but no runtime usage found |
| Google Maps | Map display | ⚠️ Requires API key | `@vis.gl/react-google-maps`, `VITE_GOOGLE_MAPS_API_KEY` |
| Twilio SMS | Driver/instructor alerts | ⚠️ Optional (simulated fallback) | `smsGatewayService.ts`: falls back to console.log |
| Paymob | Payment gateway | ⚠️ Optional (simulated) | `paymentService.ts`: `simulationAllowed()` check |

### 2.7 Build & Deploy

| Aspect | Implementation | Evidence |
|--------|---------------|----------|
| Dev server | `tsx server.ts` (Vite HMR) | `package.json` scripts.dev |
| Build | `vite build` + `esbuild` server bundle | `package.json` scripts.build |
| Production | `node dist/server.cjs` | `package.json` scripts.start |
| Deployment | Google Cloud Run (AI Studio) | `README.md`, `Dockerfile` |
| Code splitting | Manual chunks (Firebase, Maps, GenAI, Motion, Charts) | `vite.config.ts` `manualChunks` |

---

## 3. Data Model Summary

### 3.1 Core Tables (40+ collections in `DatabaseState`)

| Category | Tables | Count |
|----------|--------|-------|
| Users & Auth | users, sessions | 2 |
| Trips | trips, tripItems | 2 |
| Commerce | suppliers, productSkus, inventorySlots, holds, payments, bookings | 6 |
| Financial | ledgerEntries | 1 |
| Operations | transferTelemetry, notifications, supportMessages, auditEvents | 4 |
| Knowledge (DKOS) | researchSources, temporalFacts, evidenceNodes, conflictSets, areaProfiles, places, activities, diningVenues, emergencyResources, regulatoryDecrees, knowledgeSnapshots, placeDiscoveries, resolutionCandidates | 13 |
| Market Intelligence | rawSupplierSources, rawOfferSources, supplierOffers, marketPriceStats, socialAccounts, sourceRecords, priceObservations, marketChangeEvents, marketSnapshots, sourceFreshnessRecords, contactHistory, marketRefreshRuns, marketReviewQueue, sourceHealthRecords, refreshSchedulePolicies, marketAlerts | 16 |
| Infrastructure | locks, fencingSequence | 2 |

**Evidence:** `server/db/database.ts` `DatabaseState` interface — 40+ typed array fields.

### 3.2 Schema Location

All entity interfaces defined in `server/db/schema.ts` (769 lines). Shared types between frontend and backend in `src/shared/types/`.

---

## 4. API Surface

### 4.1 Registration Points

| File | Mount Path | Handler Count |
|------|-----------|---------------|
| `server.ts` inline | `/api/*` | ~60 |
| `server/api/dahabRoutes.ts` | `/api/dahab/*` | ~35 |
| `server/api/adminDahabRoutes.ts` | `/api/dahab/admin/*` | ~15 |
| **Total** | | **~110** |

### 4.2 Authentication Enforcement

| Middleware | Scope | Evidence |
|-----------|-------|----------|
| `optionalAuth` | Global (mounted on `/api`) | `server.ts`: `app.use(optionalAuth)` |
| `apiAccessPolicy` | Global (deny-by-default) | `server.ts`: `app.use('/api', apiAccessPolicy)` |
| `requireAuth` | Per-route (adminDahabRouter) | `adminDahabRouter.use(requireAuth)` |
| `requireRole` | Per-route (adminDahabRouter) | `adminDahabRouter.use(requireRole('Operations', 'Admin', 'Product'))` |

---

## 5. Test Infrastructure

### 5.1 Test Framework

- **Runner:** Vitest 4.1.11
- **Config:** `vitest.config.ts` — `environment: 'node'`, `fileParallelism: false`
- **Setup:** `tests/setup.ts` — swaps DB to InMemoryPersistenceAdapter, monkey-patches fs to prevent real DB writes

### 5.2 Test Coverage

| Directory | Files | Focus |
|-----------|-------|-------|
| `tests/domain/` | 15 files | Business logic: payments, ledger, checkout, persistence, weather, capacity, etc. |
| `tests/security/` | 6 files | Auth, RBAC, API access policy, input validation, logout, task ownership |
| `tests/helpers/` | 1 fixture file | `resetDb()`, `seedSku()`, `nextIdempotencyKey()` |

**Total:** 282 tests passing (verified via `vitest run`).

### 5.3 Test Isolation

The test setup (`tests/setup.ts`) does three things:
1. Swaps the database adapter to `InMemoryPersistenceAdapter` at module level
2. Verifies the swap with an assertion
3. Monkey-patches `fs.openSync`, `fs.writeFileSync`, `fs.renameSync` to throw if they target `data/dahab_db.json`

**Evidence:** `tests/setup.ts` lines 1-80.

---

## 6. What Is NOT Here

| Absent | Evidence |
|--------|----------|
| React Router | `App.tsx` uses `switch (currentRoute)` — no router import |
| Real database | Postgres adapter exists but `save()` is unimplemented |
| Real payments | `paymentService.processCheckout()` never contacts a gateway |
| Real weather stations | `weatherService.ts` fetches from Open-Meteo (public API) |
| Real cameras | No camera integration found |
| WebSocket/SSE | No real-time push — all polling |
| Background job queue | `asyncJobService.ts` exists but is synchronous |
| Email service | No email sending implementation found |
| File upload/storage | No file upload endpoints |
| Internationalization library | Custom `LanguageContext` + `translations.ts` — no i18n library |

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `GEMINI_API_KEY` | Yes (for AI) | None | Google Gemini API |
| `GEMINI_MODEL` | No | `gemini-3.6-flash` | Model ID |
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | development | Controls simulation gating |
| `ALLOW_SIMULATED_PAYMENTS` | No | false in prod | Enables payment simulation |
| `PAYMOB_HMAC_SECRET` | No | None | Webhook verification |
| `TWILIO_ACCOUNT_SID` | No | None | SMS dispatch |
| `TWILIO_AUTH_TOKEN` | No | None | SMS dispatch |
| `DATABASE_URL` | No | None | Postgres connection |
| `PERSISTENCE_ADAPTER` | No | `sqlite` | Which adapter to use |
| `ALLOW_NONPERSISTENT_POSTGRES_ADAPTER` | No | false | Acknowledges data loss risk |
| `SEED_USER_PASSWORD` | No | None | Seeds demo accounts on boot |
| `ENABLE_TEST_ENDPOINTS` | No | false | Exposes `/api/testing/*` |
| `VITE_GOOGLE_MAPS_API_KEY` | No | None | Maps SDK |

**Evidence:** `.env.example` file, `server.ts` `dotenv.config()`, various service files reading `process.env`.

---

*This document describes what IS, not what SHOULD BE. Every claim has a file reference.*
