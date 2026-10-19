# PRODUCT ONE SYSTEM ARCHITECTURE

**Date:** August 31, 2026  
**Principle:** ONE DAHAB PRODUCT — not many features.  
**Standard:** Every component renders product state. Business rules remain server-owned.

---

## 1. CORE PRINCIPLE

The Dahab platform is ONE product with ONE trip as the central object.

**Not:**
- Multiple booking systems
- Multiple itinerary systems
- Multiple AI systems
- Multiple analytics systems

**But:**
- ONE Trip (authoritative traveler context)
- ONE Booking layer (commercial execution)
- ONE Companion (intelligent assistance)
- ONE Intelligence layer (market learning)
- ONE Analytics system (measurement)

---

## 2. SYSTEM BOUNDARIES

### 2.1 Frontend (React 19 SPA)

```
┌─────────────────────────────────────────────────────────┐
│                    React 19 SPA                         │
├─────────────────────────────────────────────────────────┤
│  Context Layer                                          │
│  ├── TripContext (Trip + Itinerary + Bookings)          │
│  ├── CommerceContext (Payments + Ledger)                │
│  ├── AuthContext (User + Session)                       │
│  ├── IntelligenceContext (Opportunities + Features)     │
│  └── UIContext (Navigation + Toasts)                    │
├─────────────────────────────────────────────────────────┤
│  Service Layer                                          │
│  ├── api.ts (All HTTP calls)                            │
│  ├── analytics.ts (Event tracking)                      │
│  └── exploreMapper.ts (Data transformation)             │
├─────────────────────────────────────────────────────────┤
│  View Layer (25+ lazy-loaded views)                     │
│  ├── Home → Explore → Experience                        │
│  ├── Trip → Booking → Payment                           │
│  ├── MyTrip → Companion → Recovery                      │
│  └── Operations → Intelligence                          │
└─────────────────────────────────────────────────────────┘
```

**Rule:** Views render product state. They do NOT calculate critical business rules.

### 2.2 Backend (Express + Node.js)

```
┌─────────────────────────────────────────────────────────┐
│                  Express API Server                     │
├─────────────────────────────────────────────────────────┤
│  Middleware Pipeline                                     │
│  ├── optionalAuth (global)                              │
│  ├── apiAccessPolicy (deny-by-default)                  │
│  ├── requireAuth (protected routes)                     │
│  └── requireRole (RBAC)                                 │
├─────────────────────────────────────────────────────────┤
│  Domain Services                                        │
│  ├── tripService (Trip CRUD)                            │
│  ├── commerceService (Hold + Checkout + Payment)        │
│  ├── paymentService (Paymob integration)                │
│  ├── ledgerService (Double-entry accounting)            │
│  ├── transferService (Transfer operations)              │
│  ├── supplierService (Supplier management)              │
│  ├── daygiReasoningService (AI reasoning)               │
│  ├── daygiTaskOrchestrator (Task management)            │
│  └── daygiTripHealthService (Health scoring)            │
├─────────────────────────────────────────────────────────┤
│  Intelligence Services                                  │
│  ├── marketFreshnessService (Market data)               │
│  ├── knowledgeGapService (Knowledge management)         │
│  ├── entityResolutionService (Entity matching)          │
│  ├── conflictEngine (Conflict resolution)               │
│  └── snapshotService (Knowledge snapshots)              │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                             │
│  ├── Database (in-memory + JSON persistence)            │
│  ├── Repositories (Data access)                         │
│  └── Adapters (Persistence interfaces)                  │
└─────────────────────────────────────────────────────────┘
```

**Rule:** Backend provides coherent domain boundaries. No duplicate state machines.

### 2.3 Data Layer

```
┌─────────────────────────────────────────────────────────┐
│                   Data Layer                            │
├─────────────────────────────────────────────────────────┤
│  In-Memory Database                                     │
│  ├── users, sessions, trips, tripItems                  │
│  ├── suppliers, productSkus, inventorySlots             │
│  ├── holds, bookings, payments, ledgerEntries           │
│  ├── transferTelemetry, notifications                   │
│  ├── researchSources, temporalFacts, evidenceNodes      │
│  ├── conflictSets, areaProfiles, places                 │
│  ├── activities, diningVenues, emergencyResources       │
│  └── marketAlerts, marketSnapshots                      │
├─────────────────────────────────────────────────────────┤
│  JSON Persistence                                       │
│  └── data/dahab_db.json (atomic file persistence)       │
├─────────────────────────────────────────────────────────┤
│  External Integrations                                  │
│  ├── Google Gemini (AI reasoning)                       │
│  ├── Open-Meteo (Weather data)                          │
│  ├── Firebase (Auth + optional persistence)             │
│  └── Paymob (Payment - simulated until configured)      │
└─────────────────────────────────────────────────────────┘
```

---

## 3. THE ONE TRIP OBJECT

### 3.1 TripEntity Schema

```typescript
interface TripEntity {
  id: string;                    // DHB-TRIP-894
  userId: string;                // Owner
  title: string;                 // "Dahab Personalized Trip"
  status: TripStatus;            // DRAFT → PLANNED → CONFIRMED → IN_DESTINATION → COMPLETED
  lengthDays: number;            // 5
  travelersCount: number;        // 2
  budget: BudgetTier;            // Budget | Moderate | Premium
  pace: PaceType;                // Relaxed | Balanced | Active
  interests: string[];           // ["Diving", "Adventure"]
  startDate?: string;            // 2026-10-12
  endDate?: string;              // 2026-10-16
  totalEstimatedEGP: number;     // 22200
  totalPaidEGP: number;          // 15000
  createdAt: string;
  updatedAt: string;
}
```

### 3.2 TripItem Schema

```typescript
interface TripItemEntity {
  id: string;
  tripId: string;
  title: string;
  type: TripItemType;            // Activity | Dining | Transfer | Accommodation
  status: TripItemStatus;        // SUGGESTED | HELD | BOOKED | CONFIRMED | CANCELLED
  dayNumber: number;             // 1-5
  startTime?: string;
  endTime?: string;
  priceEGP?: number;
  supplierId?: string;
  bookingId?: string;            // Links to BookingEntity
  metadata?: Record<string, any>;
}
```

### 3.3 Trip as Central Object

Every system reads/writes Trip:

| System | Read | Write |
|--------|------|-------|
| Explore | Trip interests, preferences | TripItem (add activity) |
| Booking | Trip items, budget | Booking, Payment, Ledger |
| My Trip | Trip + items + bookings | Status updates |
| Companion | Trip context, health | Recommendations |
| Recovery | Trip items, bookings | Updated bookings |
| Operations | Trip status, exceptions | Status changes |
| Intelligence | Trip outcomes | Confidence updates |

---

## 4. API COHERENCE

### 4.1 Canonical Endpoints

| Domain | Endpoint | Purpose |
|--------|----------|---------|
| **Trip** | `GET /api/trips/:id` | Get trip + items |
| **Trip** | `POST /api/trips` | Create/update trip |
| **Trip** | `PATCH /api/trips/:id/status` | Transition status |
| **Booking** | `GET /api/trips/:id/bookings` | Get trip bookings |
| **Commerce** | `POST /api/commerce/hold` | Create 15-min hold |
| **Commerce** | `POST /api/commerce/checkout` | Execute checkout |
| **Payment** | `POST /api/commerce/payment` | Process payment |
| **Ledger** | `GET /api/commerce/ledger` | View ledger |
| **Ledger** | `GET /api/commerce/ledger/verify` | Verify integrity |
| **DayGI** | `POST /api/daygi/query` | AI reasoning |
| **DayGI** | `GET /api/daygi/health/:tripId` | Trip health |
| **DayGI** | `GET /api/daygi/proactive` | Proactive suggestions |
| **Market** | `POST /api/market/refresh` | Refresh indices |
| **Market** | `GET /api/market/alerts` | View alerts |
| **Admin** | `GET /api/dahab/admin/health` | DKOS health |
| **Admin** | `GET /api/dahab/admin/gaps` | Knowledge gaps |

### 4.2 Frontend API Client

All HTTP calls go through `src/services/api.ts`. No direct fetch() in components.

```typescript
// Correct pattern
const data = await api.getTrip(tripId, signal);

// Wrong pattern (do not do this)
const res = await fetch('/api/trips/123');
```

---

## 5. STATE MANAGEMENT

### 5.1 Context Hierarchy

```
App
├── AuthProvider (user, session)
├── ThemeProvider (dark/light)
├── LanguageProvider (en/ar)
├── UIProvider (navigation, toasts)
├── TripProvider (trip, items, bookings)
├── CommerceContext (payments, ledger)
├── ItineraryContext (timeline activities)
├── IntelligenceContext (opportunities)
└── DahabTimeProvider (time simulation)
```

### 5.2 State Ownership

| State | Owner | Consumers |
|-------|-------|-----------|
| User/Session | AuthContext | All views |
| Trip + Items | TripContext | All trip-related views |
| Bookings | CommerceContext | MyTrip, Bookings, Companion |
| Ledger | CommerceContext | SmartBudget, Operations |
| Opportunities | IntelligenceContext | Opportunities, AI Assistant |
| Health | DayGiContext | Companion, MyTrip |

**Rule:** One source of truth per data type. No duplicate state.

---

## 6. ANALYTICS ARCHITECTURE

### 6.1 Event Types (Existing)

```typescript
type AnalyticsEventType =
  // Discovery
  | 'trip_entry_viewed'
  | 'explore_opened'
  // Planning
  | 'planner_started'
  | 'planner_completed'
  | 'trip_created'
  // Booking
  | 'booking_started'
  | 'booking_completed'
  // Payment
  | 'payment_started'
  | 'payment_succeeded'
  | 'payment_failed'
  // Usage
  | 'activity_completed'
  | 'recovery_started'
  | 'recovery_completed'
  // Outcome
  | 'trip_completed'
  | 'departure_completed';
```

### 6.2 Event Funnel

```
trip_entry_viewed
  → explore_opened
    → experience_viewed
      → trip_item_added
        → booking_started
          → hold_created
            → checkout_started
              → payment_started
                → payment_succeeded
                  → supplier_pending
                    → booking_confirmed
                      → trip_item_confirmed
                        → activity_completed
                          → recovery_started (if needed)
                            → recovery_completed
                              → trip_completed
                                → departure_completed
```

---

## 7. SECURITY MODEL

### 7.1 Authentication

- Session-based (HttpOnly cookie + optional header)
- Identity from session, never from request body
- Optional auth for public endpoints
- Required auth for protected endpoints

### 7.2 Authorization (RBAC)

| Role | Access |
|------|--------|
| Traveler | Own trips, own bookings, public content |
| Supplier | Own bookings, own inventory |
| Operations | All trips, all bookings, supplier management |
| Admin | Everything |
| Product | Intelligence, analytics, features |

### 7.3 Key Security Rules

1. **IDOR Protection:** 404 for unauthorized access (not 403)
2. **Price Tampering:** Backend recalculates all prices
3. **Webhook Verification:** HMAC-SHA256 signature check
4. **Replay Protection:** Idempotency keys on financial operations
5. **Rate Limiting:** Per-user, per-endpoint

---

## 8. INTELLIGENCE ARCHITECTURE

### 8.1 Intelligence Pipeline

```
Market Signals (External)
  ↓
Raw Observations (Ingested)
  ↓
Normalized Entities (Cleaned)
  ↓
Temporal Facts (Verified)
  ↓
Knowledge Gaps (Detected)
  ↓
Opportunities (Generated)
  ↓
Human Decision (Approved)
  ↓
Product Change (Shipped)
  ↓
Usage Metrics (Measured)
  ↓
Outcome (Evaluated)
  ↓
Confidence Update (Learned)
```

### 8.2 Intelligence Boundaries

**Intelligence DOES:**
- Collect market signals
- Identify patterns
- Generate opportunities
- Measure outcomes

**Intelligence DOES NOT:**
- Make booking decisions
- Set prices
- Approve suppliers
- Make safety decisions

**AI (Gemini) DOES:**
- Reason about traveler queries
- Summarize information
- Classify intents
- Generate recommendations

**AI DOES NOT:**
- Execute payments
- Confirm bookings
- Make financial decisions
- Override safety rules

---

## 9. ERROR HANDLING

### 9.1 Error Types

| Type | User Experience | Technical |
|------|----------------|-----------|
| Network | "Connection issue. Retrying..." | Retry with backoff |
| Auth | "Session expired. Please sign in." | Redirect to auth |
| Validation | "Please check your input." | Show field errors |
| Business | "This slot is no longer available." | Show alternatives |
| System | "Something went wrong. Our team is notified." | Log + alert |

### 9.2 Recovery Patterns

1. **Payment fails:** Show retry + alternative methods
2. **Hold expires:** Show re-selection with new hold
3. **Supplier rejects:** Show alternatives + recovery
4. **Network offline:** Queue mutations for sync
5. **AI unavailable:** Deterministic fallback

---

## 10. OFFLINE / FAILURE

### 10.1 What's Preserved Offline

- Trip context (read-only)
- Planned items (read-only)
- Booking state (read-only)

### 10.2 What's Queued Offline

- New trip items
- Booking attempts
- Payment retries
- Support messages

### 10.3 Sync Strategy

- Queue mutations in localStorage
- Replay on reconnect
- Conflict resolution: last-write-wins for non-financial
- Financial operations: server-authoritative

---

*Architecture document: August 31, 2026*
