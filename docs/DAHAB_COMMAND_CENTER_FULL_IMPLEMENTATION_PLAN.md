# DAHAB COMMAND CENTER — FULL IMPLEMENTATION PLAN
## 100% Operational Control Plan

**Date:** August 31, 2026
**Goal:** Transform the Command Center from ~40% connected to 100% operational control over the Dahab platform.

---

## CURRENT STATE ASSESSMENT

### What Exists (Backend — 80+ endpoints)
The backend already has extensive operational capabilities:
- **36 backend services** covering trips, bookings, payments, suppliers, intelligence, knowledge, transfers, notifications, SMS, recovery, and more
- **80+ REST API endpoints** across server.ts, adminDahabRoutes.ts, and dahabRoutes.ts
- **Real database** with JsonFilePersistenceAdapter, audit events, ledger integrity
- **Real auth** with session cookies, RBAC (Operations, Admin, Supplier, Product roles)

### What Exists (Frontend — 14 Command Center files)
The Command Center shell and 11 section views exist, but most are **read-only summaries** that don't consume all available backend data or expose all available actions.

### Gap Analysis: What's Missing

| Area | Backend Ready? | Frontend Consumes? | Gap |
|------|---------------|-------------------|-----|
| Operations Overview | ✅ Full | ⚠️ Partial | Missing: transfer summary, notification count |
| Trip List | ⚠️ User-scoped only | ⚠️ Partial | Need: all-trips admin endpoint |
| Trip Command View | ✅ Full | ⚠️ Partial | Missing: transfers, SMS, health, recovery, item management |
| Exceptions | ✅ Full | ⚠️ Partial | Missing: transfer/payment/condition exceptions |
| Commerce | ✅ Full | ⚠️ Partial | Missing: anomalies, reconcile, refund UI, payment details |
| Suppliers | ✅ Full | ⚠️ Partial | Missing: supplier bookings, respond/reject actions, reliability |
| Intelligence | ✅ Full | ⚠️ Partial | Missing: opportunities, features, price history, trends, snapshots, jobs |
| Knowledge | ✅ Full | ⚠️ Partial | Missing: stale facts, entity resolve/merge, logs, expansion metrics, snapshot diff |
| Support | ✅ Full | ⚠️ Partial | Missing: notifications, SMS dispatch, SMS logs |
| Audit | ✅ Full | ⚠️ Partial | Missing: filtering, export, detail view |
| Feature Flags | ✅ Full | ⚠️ Partial | Missing: beta dashboard, funnel data, weekly report |
| System Health | ✅ Full | ⚠️ Partial | Missing: jobs detail, weather, cameras, integration status |
| Transfers | ✅ Full | ❌ Missing | No section exists |
| Notifications | ✅ Full | ❌ Missing | No section exists |
| SMS | ✅ Full | ❌ Missing | No section exists |
| Opportunities | ✅ Full | ❌ Missing | No section exists |
| Market Jobs | ✅ Full | ❌ Missing | No section exists |

---

## IMPLEMENTATION PLAN

### Phase 1: Backend — Missing Admin Endpoints (Priority: CRITICAL)
**Goal:** Add endpoints the frontend needs but don't exist yet.

#### 1.1 Trip Admin Endpoint
**Why:** The current `/api/trips/user/:userId` is user-scoped. Operations needs to see ALL trips.

```
GET /api/operations/trips
→ Returns all trips with summary data (no PII unless authorized)
→ Supports query params: status, startDate, endDate, limit, offset
```

#### 1.2 Bookings Admin Endpoint
**Why:** No way to list all bookings across the platform.

```
GET /api/operations/bookings
→ Returns all bookings with trip/supplier/payment state
→ Supports query params: status, supplierId, paymentState, limit, offset
```

#### 1.3 Payment Operations Endpoint
**Why:** No way to see payment failures or process refunds from the command center.

```
GET /api/operations/payments
→ Returns payment summary: total captured, total refunded, total pending, failures list

POST /api/operations/refund
→ Process refund with authorization check
→ Body: { bookingRef, amountEGP, reason, operatorId }
→ Creates audit event
```

#### 1.4 Supplier Reliability Endpoint
**Why:** No way to see supplier health metrics.

```
GET /api/operations/supplier-reliability
→ Returns per-supplier: confirmation rate, avg response time, cancellation rate, issue count
```

#### 1.5 Transfer Operations Endpoint
**Why:** Transfers exist but have no operational overview.

```
GET /api/operations/transfers
→ Returns all active transfers with status, driver, vehicle, ETA
```

#### 1.6 Intelligence Opportunities Actions
**Why:** Opportunities exist but can't be acted on.

```
POST /api/intelligence/opportunities/:id/action
→ Body: { action: 'accept' | 'reject' | 'defer', reason, operatorId }
→ Creates audit event
```

#### 1.7 Feature Flag Management
**Why:** Experiments can be toggled but no audit trail.

```
POST /api/daygi/beta/experiments/:key/toggle
→ Body: { value: boolean | string, operatorId }
→ Creates audit event
→ Returns updated experiment state
```

#### 1.8 Notification Operations
**Why:** Notifications exist but have no operational view.

```
GET /api/operations/notifications
→ Returns notifications grouped by type, priority, age

POST /api/operations/notifications/:id/dismiss
→ Dismiss notification
```

#### 1.9 SMS Operations
**Why:** SMS gateway exists but no operational UI.

```
GET /api/operations/sms-logs
→ Returns recent SMS logs with status

POST /api/operations/sms-dispatch
→ Send SMS with authorization check
→ Body: { to, recipientName, recipientRole, message, bookingRef, channel }
→ Creates audit event
```

#### 1.10 System Integration Status
**Why:** Health endpoint exists but no integration-level detail.

```
GET /api/operations/integrations
→ Returns per-integration: provider, purpose, status, lastSuccess, lastFailure, freshness
→ Covers: Firebase, Gemini, PayMob, Twilio, Weather, Maps, Market Sources
```

---

### Phase 2: Frontend — Missing Sections (Priority: HIGH)
**Goal:** Add the missing operational sections.

#### 2.1 Transfers Section (NEW)
**File:** `src/components/operations/command-center/TransfersSection.tsx`
**Data:** `GET /api/operations/transfers` + `GET /api/transfers/telemetry/:bookingId`
**Features:**
- Active transfer list with status badges (BOOKING → VEHICLE → DRIVER → PICKUP → IN_TRANSIT → COMPLETED)
- Transfer detail view with route, driver, vehicle, supplier, ETA
- Telemetry freshness indicator (Live / Last updated / Stale / Unknown)
- Actions: [Ping Driver] [Refresh Telemetry] [Open Trip]
- No GPS fabrication — show "Location unavailable" when telemetry is stale

#### 2.2 Notifications Center (NEW)
**File:** `src/components/operations/command-center/NotificationsCenter.tsx`
**Data:** `GET /api/operations/notifications`
**Features:**
- Notification list grouped by type (trip, payment, supplier, system)
- Priority badges (CRITICAL / HIGH / MEDIUM / LOW)
- Age indicators
- Actions: [Dismiss] [Open Related Entity]
- Empty state: "No notifications"

#### 2.3 SMS Center (NEW)
**File:** `src/components/operations/command-center/SmsCenter.tsx`
**Data:** `GET /api/operations/sms-logs` + `POST /api/operations/sms-dispatch`
**Features:**
- SMS log table (to, recipient, role, message, status, timestamp)
- Dispatch form with recipient selector, message template, channel (SMS/WhatsApp)
- Confirmation dialog for dispatch
- Empty state: "No SMS logs"

#### 2.4 Opportunities Section (NEW)
**File:** `src/components/operations/command-center/OpportunitiesSection.tsx`
**Data:** `GET /api/intelligence/opportunities` + `POST /api/intelligence/opportunities/:id/action`
**Features:**
- Opportunity cards with evidence, confidence, category
- Actions: [Accept] [Reject] [Defer] [Link to Feature Register]
- Confirmation dialog for accept/reject
- Audit trail for decisions

#### 2.5 Market Jobs Section (NEW)
**File:** `src/components/operations/command-center/MarketJobsSection.tsx`
**Data:** `GET /api/market/jobs` + `POST /api/market/jobs/trigger` + `POST /api/market/jobs/policy`
**Features:**
- Job list with schedule, last run, status
- Trigger job button
- Policy editor (enable/disable, schedule)
- Circuit breaker status per source
- Circuit breaker reset button

---

### Phase 3: Frontend — Enhance Existing Sections (Priority: HIGH)
**Goal:** Wire up all available backend data and actions in existing sections.

#### 3.1 Overview Enhancement
**File:** `src/components/operations/command-center/Overview.tsx`
**Changes:**
- Add transfer summary card (active transfers, pending pickups)
- Add notification count card
- Add SMS dispatch summary
- Add intelligence summary (opportunities count, changes detected)
- Improve action queue to include transfer exceptions, payment failures, trip conditions

#### 3.2 Live Trip Radar Enhancement
**File:** `src/components/operations/command-center/LiveTripRadar.tsx`
**Changes:**
- Add transfer status per trip (which bookings have active transfers)
- Add trip health indicator (from `/api/daygi/health/:tripId`)
- Add "Add Item" and "Remove Item" actions
- Add SMS dispatch to supplier action
- Add trip contact action
- Show trip timeline with real events

#### 3.3 Trip Command View Enhancement
**File:** `src/components/operations/command-center/LiveTripRadar.tsx` (TripCommandView)
**Changes:**
- Add Transfer tab with real telemetry
- Add Payment tab with ledger entries per booking
- Add Refund action with confirmation dialog
- Add Item management (add/remove itinerary items)
- Add SMS dispatch to suppliers
- Add Trip health panel
- Add Recovery options
- Add Incident timeline

#### 3.4 Exceptions Center Enhancement
**File:** `src/components/operations/command-center/ExceptionsCenter.tsx`
**Changes:**
- Add transfer exceptions (stale telemetry, driver no-show)
- Add payment exceptions (failed captures, webhook errors)
- Add trip condition exceptions (weather, safety)
- Add system exceptions (API down, DB issues)
- Add resolve action for review queue items
- Add severity-based color coding

#### 3.5 Commerce Control Enhancement
**File:** `src/components/operations/command-center/CommerceControl.tsx`
**Changes:**
- Add Anomalies tab (GET `/api/commerce/ledger/anomalies`)
- Add Reconcile tab (GET `/api/commerce/ledger/reconcile/:bookingRef`)
- Add Refund processing UI with confirmation
- Add payment failure list
- Add booking payment details per trip

#### 3.6 Supplier Command Enhancement
**File:** `src/components/operations/command-center/SupplierCommand.tsx`
**Changes:**
- Add supplier bookings list (GET `/api/suppliers/:supplierId/bookings`)
- Add booking respond action (POST `/api/suppliers/bookings/:bookingId/respond`)
- Add booking status update (POST `/api/suppliers/bookings/:bookingId/status`)
- Add reliability metrics display
- Add supplier verification actions

#### 3.7 Intelligence Command Enhancement
**File:** `src/components/operations/command-center/IntelligenceCommand.tsx`
**Changes:**
- Add Opportunities tab with action buttons
- Add Features tab (feature register)
- Add Price History tab
- Add Trends tab
- Add Source Freshness tab
- Add Market Events tab
- Add Snapshots tab with create/rollback
- Add Circuit Breaker reset
- Add Market Jobs management

#### 3.8 Knowledge Ops Enhancement
**File:** `src/components/operations/command-center/KnowledgeOps.tsx`
**Changes:**
- Add Stale Facts tab
- Add Entity Resolution UI (resolve, merge)
- Add Search Logs tab
- Add Expansion Metrics tab
- Add Snapshot Diff UI
- Add Proof of Fact action
- Add Stage/Promote Observation actions

#### 3.9 Support Center Enhancement
**File:** `src/components/operations/command-center/SupportCenter.tsx`
**Changes:**
- Add notification management tab
- Add SMS dispatch form
- Add SMS logs tab
- Add trip context display per support message

#### 3.10 Audit Center Enhancement
**File:** `src/components/operations/command-center/AuditCenter.tsx`
**Changes:**
- Add filtering by action type, entity type, actor
- Add date range filter
- Add export to CSV
- Add event detail view (expand row)

#### 3.11 Feature Flags Enhancement
**File:** `src/components/operations/command-center/FeatureFlagsView.tsx`
**Changes:**
- Add beta dashboard view (GET `/api/daygi/beta/dashboard`)
- Add funnel tracking data
- Add weekly report generation (POST `/api/daygi/beta/generate-weekly-report`)
- Add audit trail for flag changes

#### 3.12 System Health Enhancement
**File:** `src/components/operations/command-center/SystemHealth.tsx`
**Changes:**
- Add background jobs detail (GET `/api/jobs/status`)
- Add job enqueue UI
- Add weather telemetry (GET `/api/telemetry/weather`)
- Add camera feeds (GET `/api/telemetry/cameras`)
- Add integration status (GET `/api/operations/integrations`)
- Add market status detail

---

### Phase 4: Frontend — Action Center & Confirmation UX (Priority: MEDIUM)
**Goal:** Make every action explicit, audited, and reversible where possible.

#### 4.1 Action Center Component
**File:** `src/components/operations/command-center/ActionCenter.tsx`
**Purpose:** Centralized action handling for all sections.
**Features:**
- Action registry: maps action types to handlers
- Confirmation dialog for destructive/financial actions
- Audit event creation for every action
- Success/failure feedback
- Undo where supported

#### 4.2 Confirmation Dialog Component
**File:** `src/components/operations/command-center/ConfirmDialog.tsx`
**Purpose:** Standardized confirmation for high-risk actions.
**Features:**
- Title, consequence description, affected entity
- Amount display for financial actions
- Reason input (required for destructive actions)
- Confirm/Cancel buttons
- No dark patterns

#### 4.3 Action Registry
**File:** `src/components/operations/command-center/actionRegistry.ts`
**Purpose:** Maps action IDs to handlers, authorization requirements, and audit metadata.
**Features:**
- Type-safe action definitions
- Authorization check per action
- Audit event template per action
- Confirmation required flag per action

---

### Phase 5: Frontend — Polish & Performance (Priority: MEDIUM)
**Goal:** Make the UI production-ready.

#### 5.1 Pagination
- Add pagination to all list views (trips, bookings, suppliers, ledger, audit, SMS)
- Cursor-based pagination for large datasets
- "Load more" pattern for infinite scroll

#### 5.2 Real-time Updates
- Implement polling with exponential backoff
- Show data freshness on every section
- Distinguish: Live / Updated X ago / Stale / Unknown
- WebSocket support where backend supports it (future)

#### 5.3 Responsive Refinement
- Test and fix all sections at 1024px, 1280px, 1440px, 1920px
- Ensure tables scroll horizontally on small screens
- Ensure action buttons are touch-friendly at 1024px

#### 5.4 Accessibility
- Keyboard navigation through all interactive elements
- ARIA labels on all buttons and links
- Focus management for modals and drawers
- Screen reader announcements for action results
- Reduced motion support

#### 5.5 Empty States
- Every section must have an honest empty state
- No demo data, no fake metrics
- "No active trips" / "No pending actions" / "All systems operational"

#### 5.6 Loading States
- Skeleton loaders for all data-dependent sections
- Progressive loading (show structure first, then data)
- Error boundaries per section

---

### Phase 6: Testing & Documentation (Priority: MEDIUM)
**Goal:** Ensure quality and maintainability.

#### 6.1 Unit Tests
- Test all new API client methods
- Test action registry handlers
- Test confirmation dialog logic
- Test pagination logic
- Test freshness indicator calculations

#### 6.2 Integration Tests
- Test full action flow: trigger → confirm → execute → audit → verify
- Test RBAC enforcement (Operations can't do Supplier actions)
- Test financial action authorization

#### 6.3 Browser QA
- Extend Playwright QA to cover all new sections
- Test all viewport sizes
- Test all interactive elements
- Test empty states
- Test error states

#### 6.4 Documentation
- Update `DAHAB_COMMAND_CENTER_ARCHITECTURE.md` with all sections
- Create `DAHAB_COMMAND_CENTER_CONTROL_MAP.md` (Area / View / Data Source / Actions / Role / Audit)
- Create `DAHAB_COMMAND_CENTER_UX_SPEC.md` (visual hierarchy, spacing, colors, typography)

---

## IMPLEMENTATION ORDER

| Step | Description | Files | Effort |
|------|-------------|-------|--------|
| 1 | Backend: Add missing admin endpoints | server.ts | Medium |
| 2 | Frontend: Add API client methods | api.ts | Small |
| 3 | Frontend: Add Transfers section | TransfersSection.tsx | Medium |
| 4 | Frontend: Add Notifications section | NotificationsCenter.tsx | Small |
| 5 | Frontend: Add SMS section | SmsCenter.tsx | Medium |
| 6 | Frontend: Add Opportunities section | OpportunitiesSection.tsx | Medium |
| 7 | Frontend: Add Market Jobs section | MarketJobsSection.tsx | Small |
| 8 | Frontend: Enhance Overview | Overview.tsx | Medium |
| 9 | Frontend: Enhance Trip Command View | LiveTripRadar.tsx | Large |
| 10 | Frontend: Enhance Commerce Control | CommerceControl.tsx | Medium |
| 11 | Frontend: Enhance Supplier Command | SupplierCommand.tsx | Medium |
| 12 | Frontend: Enhance Intelligence | IntelligenceCommand.tsx | Large |
| 13 | Frontend: Enhance Knowledge | KnowledgeOps.tsx | Medium |
| 14 | Frontend: Enhance Support | SupportCenter.tsx | Medium |
| 15 | Frontend: Enhance Audit | AuditCenter.tsx | Small |
| 16 | Frontend: Enhance Feature Flags | FeatureFlagsView.tsx | Small |
| 17 | Frontend: Enhance System Health | SystemHealth.tsx | Medium |
| 18 | Frontend: Add Action Center + Confirm Dialog | ActionCenter.tsx, ConfirmDialog.tsx | Medium |
| 19 | Frontend: Update sidebar navigation | CommandCenterShell.tsx | Small |
| 20 | Frontend: Add pagination to all lists | Multiple files | Medium |
| 21 | Frontend: Polish responsive + a11y | Multiple files | Medium |
| 22 | Testing: Unit + integration + browser QA | tests/ | Medium |
| 23 | Documentation: Update all docs | docs/ | Small |

---

## ESTIMATED TOTALS

- **Backend changes:** ~10 new endpoints + modifications to operations/overview
- **Frontend changes:** 5 new section components + 12 enhanced components + 3 new shared components
- **New files:** ~8 new TSX files + 1 new test file + 3 updated docs
- **Estimated effort:** 3-4 days of focused implementation

---

## RISK MITIGATION

| Risk | Mitigation |
|------|-----------|
| Backend endpoints return unexpected shapes | Use `Promise.allSettled` + graceful fallback in all data fetching |
| Auth/RBAC blocks operations actions | Verify `requireRole('Operations', 'Admin')` on all new endpoints |
| Financial actions lack authorization | Require explicit confirmation + audit event for all refund/cancel actions |
| Real-time data goes stale | Show freshness indicator on every section, never fake "live" |
| Large datasets cause performance issues | Implement pagination from the start, never load all records |
| UI breaks at edge viewport sizes | Test at 1024, 1280, 1440, 1920px for every new component |
