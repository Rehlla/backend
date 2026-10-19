# PRODUCT INTEGRATION MAP

**Date:** August 31, 2026  
**Status:** Audit Complete — Connection status verified against repository  
**Standard:** Every claim verified against actual code. No assumptions.

---

## 1. THE ONE TRIP OBJECT

The central object of the product is **TRIP**. Everything connects to Trip.

```
Trip (TripEntity)
├── TripItem[] (planned items)
├── Booking[] (commercial execution)
├── Payment[] (financial state)
├── LedgerEntry[] (financial audit)
├── Hold[] (inventory reservations)
├── Notification[] (state changes)
├── DayGiTask[] (AI orchestration)
└── DayGiTripHealth (real-time scoring)
```

**Evidence:** `TripEntity` in `src/shared/types/trip.ts` — status, items, budget, dates.  
**Evidence:** `CommerceContext.tsx` loads trip + bookings from backend as single source.

---

## 2. PRODUCT LIFECYCLE MAP

### 2.1 Customer Journey

| Stage | Component | Entry | Output | Next System | Connection Status |
|-------|-----------|-------|--------|-------------|-------------------|
| **Discover** | `V2HomeCockpit` | Homepage | Traveler intent | Explore/Plan | ✅ Connected |
| **Explore** | `ExploreView` | Homepage CTA | Experience discovery | Experience Detail | ✅ Connected |
| **Experience** | `ExperienceDetailView` | Explore → click | Selected experience | Trip (Add to Trip) | ✅ Connected |
| **Trip** | `MyTripView` | Experience → add | Planned itinerary | Booking (Book) | ✅ Connected |
| **Plan** | `TripPlanner` | Homepage → Plan | 5-step AI plan | Trip Preview | ✅ Connected |
| **Preview** | `GeneratedItinerary` | Plan → complete | Trip confirmation | Booking | ✅ Connected |
| **Booking** | `BookNowCommerceView` | Trip → Book | Cart/checkout | Payment | ✅ Connected |
| **Hold** | CommerceService | Booking → hold | 15-min reservation | Payment | ✅ Connected |
| **Payment** | `BookingPaymentStep` | Checkout → pay | Payment state | Supplier | ✅ Connected |
| **Supplier** | SupplierService | Payment → confirm | Supplier response | My Trip | ✅ Connected |
| **My Trip** | `MyTripView` | Confirmation | Active itinerary | Companion | ✅ Connected |
| **Companion** | `DayGiConciergeView` | My Trip → AI | Contextual help | Actions/Recovery | ✅ Connected |
| **Recovery** | `ChangeAndRecoveryView` | Disruption | Updated trip | My Trip | ✅ Connected |
| **Outcome** | Post-trip | Completion | Measured result | Intelligence | ⚠️ Partial |

### 2.2 Business Intelligence Loop

| Stage | System | Input | Output | Next System | Connection Status |
|-------|--------|-------|--------|-------------|-------------------|
| **Market** | `MarketIntelligenceView` | External signals | Raw observations | Intelligence | ✅ Connected |
| **Intelligence** | DKOS | Observations | Verified facts | Opportunity | ✅ Connected |
| **Opportunity** | `ProductOpportunitiesView` | Facts | Product hypotheses | Human Decision | ✅ Connected |
| **Product** | Feature Register | Approved hypothesis | Feature enhancement | Usage | ✅ Connected |
| **Usage** | Analytics | Live feature | Usage metrics | Outcome | ⚠️ Partial |
| **Outcome** | Analytics | Usage + result | Success/failure | Intelligence | ⚠️ Partial |
| **Intelligence** | DKOS | Outcomes | Updated confidence | Market | ⚠️ Partial |

---

## 3. DETAILED CONNECTION AUDIT

### 3.1 Explore → Experience → Trip

**Connection: EXPLORE → EXPERIENCE**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `ExploreView` | `api.getDahabPlaces()` | `GET /api/dahab/places` | ✅ Working |
| `ExploreView` | `api.getDahabActivities()` | `GET /api/dahab/activities` | ✅ Working |
| `ExploreView` | `api.getDahabAreas()` | `GET /api/dahab/areas` | ✅ Working |
| `ExperienceDetailView` | `getExperienceBySlug()` | Client-side lookup | ✅ Working |

**Connection: EXPERIENCE → TRIP**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `ExperienceDetailView` | `addActivityToDay()` | `ItineraryContext.addActivityToDay()` | ✅ Working |
| `ExploreView` | `addActivityToDay()` | `ItineraryContext.addActivityToDay()` | ✅ Working |
| `InteractiveSinaiMap` | `addActivityToDay()` | `ItineraryContext.addActivityToDay()` | ✅ Working |

**Gap:** Experience → Trip works but doesn't create a backend TripItem. The `addActivityToDay` function operates on client-side itinerary state only.

**Fix Required:** `addActivityToDay` should persist to backend when trip is PLANNED/CONFIRMED.

### 3.2 Trip → Booking → Payment

**Connection: TRIP → BOOKING**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `MyTripView` | Book button → CommerceView | Navigation | ✅ Working |
| `BookNowCommerceView` | `api.createHold()` | `POST /api/commerce/hold` | ✅ Working |
| `BookNowCommerceView` | `api.executeCheckout()` | `POST /api/commerce/checkout` | ✅ Working |

**Connection: BOOKING → PAYMENT**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `BookingPaymentStep` | `api.processPayment()` | `POST /api/commerce/payment` | ✅ Working |
| `BookingPaymentStep` | Ledger entry | `recordLedgerEntry()` | ✅ Working |

**Connection: PAYMENT → SUPPLIER**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `BookingPaymentStep` | Supplier notification | Internal service | ✅ Working |
| `SupplierPortalView` | Booking display | `api.getSupplierBookings()` | ⚠️ Partial |

**Gap:** Supplier confirmation is simulated. Real supplier response loop not implemented.

### 3.3 Supplier → My Trip

**Connection: SUPPLIER → MY TRIP**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `MyTripView` | Booking display | `api.getTripBookings()` | ✅ Working |
| `tripBookingMapper` | Status mapping | Client-side | ✅ Working |

**Status Mapping:**
```
Payment Captured → Booking Pending Supplier
Supplier Confirmed → Booking Confirmed ✓
Supplier Rejected → Booking Changed → Recovery
```

### 3.4 My Trip → Companion

**Connection: MY TRIP → COMPANION**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `DayGiConciergeView` | `api.getDayGiTripHealth()` | `GET /api/daygi/health/:tripId` | ✅ Working |
| `DayGiConciergeView` | `api.getDayGiProactive()` | `GET /api/daygi/proactive` | ✅ Working |
| `DayGiConciergeView` | `api.queryDayGi()` | `POST /api/daygi/query` | ✅ Working |
| `DailyCompanionDay2View` | Trip context | `useTrip()` | ✅ Working |

**Gap:** Companion reads Trip context but doesn't receive real-time booking status changes. The companion uses a snapshot, not live state.

### 3.5 Companion → Recovery

**Connection: COMPANION → RECOVERY**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `DayGiConciergeView` | `api.executeDayGiAction()` | `POST /api/daygi/action/execute` | ✅ Working |
| `ChangeAndRecoveryView` | `api.getRecoveryAlternatives()` | `GET /api/commerce/recovery` | ✅ Working |
| `ChangeAndRecoveryView` | `api.applyRecovery()` | `POST /api/commerce/recovery/apply` | ✅ Working |

**Status:** Recovery flow is connected. The Change Engine can identify alternatives and update bookings.

### 3.6 Recovery → Outcome → Analytics

**Connection: RECOVERY → OUTCOME**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `ChangeAndRecoveryView` | Outcome recording | `recordLedgerEntry()` | ✅ Working |
| `PostTripView` | Feedback submission | `api.sendSupportMessage()` | ✅ Working |
| `analytics.track()` | Event tracking | Client-side | ⚠️ Partial |

**Gap:** Outcome → Intelligence loop is not closed. Product outcomes don't feed back into intelligence confidence scores.

### 3.7 Market → Intelligence → Opportunity

**Connection: MARKET → INTELLIGENCE**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `MarketIntelligenceView` | `api.refreshMarketIntelligence()` | `POST /api/market/refresh` | ✅ Working |
| `MarketIntelligenceView` | `api.getMarketSourceHealth()` | `GET /api/market/sources/health` | ✅ Working |
| `MarketIntelligenceView` | `api.getMarketAlerts()` | `GET /api/market/alerts` | ✅ Working |

**Connection: INTELLIGENCE → OPPORTUNITY**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `ProductOpportunitiesView` | `opportunities` context | `IntelligenceContext` | ✅ Working |
| `GroundedAiAssistantView` | `api.draftOpportunity()` | `POST /api/intelligence/draft-opportunity` | ✅ Working |

### 3.8 Opportunity → Product → Usage → Outcome

**Connection: OPPORTUNITY → PRODUCT**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| `ProductOpportunitiesView` | `decideOpportunity()` | `IntelligenceContext` | ✅ Working |
| `ProductOpportunitiesView` | Feature register | `featureRegister` | ✅ Working |

**Connection: PRODUCT → USAGE → OUTCOME**

| Component | Method | Backend Endpoint | Status |
|-----------|--------|------------------|--------|
| Analytics | Event tracking | `analytics.track()` | ⚠️ Partial |
| `DayGiProductTelemetryService` | Beta telemetry | `POST /api/daygi/beta/*` | ✅ Working |

**Gap:** Usage → Outcome → Intelligence loop not closed. Product success/failure doesn't update intelligence confidence.

---

## 4. CRITICAL GAPS (Blocking Golden Journey)

### GAP-01: Experience → Trip (Backend Persistence)

**Problem:** `addActivityToDay()` only updates client-side state. When trip is PLANNED/CONFIRMED, changes are lost on refresh.

**Impact:** Traveler adds experience → refreshes page → experience gone.

**Fix:** `addActivityToDay` should call `POST /api/trips/:tripId/items` when trip status is PLANNED or CONFIRMED.

**Priority:** P0 (blocks golden journey)

### GAP-02: Supplier Confirmation Loop

**Problem:** Supplier confirmation is simulated. No real supplier response mechanism.

**Impact:** All bookings show "Pending Supplier Check" indefinitely. No real operational state.

**Fix:** Implement supplier webhook/confirmation endpoint. Until real supplier integration: keep simulation clearly labeled.

**Priority:** P1 (blocks real operations)

### GAP-03: Outcome → Intelligence Loop

**Problem:** Product outcomes don't feed back into intelligence confidence scores.

**Impact:** Intelligence doesn't learn from what worked/failed. Market loop is open, not closed.

**Fix:** After major outcomes (booking success/failure, recovery success/failure), update relevant intelligence confidence scores.

**Priority:** P2 (blocks intelligence learning)

### GAP-04: Analytics Funnel Continuity

**Problem:** Analytics events exist but don't form a continuous funnel across the full journey.

**Impact:** Cannot measure end-to-end conversion. Cannot identify where travelers drop off.

**Fix:** Instrument the full journey: explore → experience → trip → booking → payment → confirmation → usage → recovery → completion.

**Priority:** P2 (blocks measurement)

### GAP-05: Companion Real-Time State

**Problem:** Companion uses Trip snapshot, not live booking state.

**Impact:** Companion may show stale information when bookings change.

**Fix:** Companion should re-fetch trip health when booking state changes.

**Priority:** P2 (blocks companion accuracy)

---

## 5. WHAT'S ALREADY CONNECTED (Working End-to-End)

### ✅ Explore → Experience → Trip (Client-Side)
- ExploreView shows places/activities
- Click opens ExperienceDetailView
- "Add to Trip" calls `addActivityToDay()`
- Trip shows added activity

### ✅ Trip → Booking → Payment (Backend)
- MyTripView shows trip items
- Book button opens BookNowCommerceView
- Hold created with 15-min TTL
- Payment processed via CommerceService
- Ledger entry recorded

### ✅ My Trip → Companion (Backend)
- DayGiConciergeView reads trip context
- Trip health evaluated via `daygiTripHealthService`
- Proactive suggestions generated
- AI queries answered with trip context

### ✅ Companion → Recovery (Backend)
- ChangeAndRecoveryView receives disruption
- Recovery alternatives fetched
- One-tap rebook updates booking
- Trip updated with new booking

### ✅ Market → Intelligence (Backend)
- MarketIntelligenceView shows sources/alerts
- Refresh recomputes market indices
- Source health monitored
- Alerts generated for anomalies

### ✅ Intelligence → Opportunity (Backend)
- ProductOpportunitiesView shows opportunities
- GroundedAiAssistantView drafts new opportunities
- Human approval workflow exists
- Feature register tracks decisions

---

## 6. WHAT'S SIMULATED (Not Real)

| Capability | Status | Evidence |
|-----------|--------|----------|
| Payment processing | Simulated | No Paymob integration configured |
| Supplier confirmation | Simulated | No real supplier webhook |
| Flight tracking | Simulated | No flight API integration |
| SMS notifications | Simulated | Twilio not configured |
| GPS/real-time tracking | Simulated | No driver GPS |
| Camera feeds | Simulated | No physical cameras |

**Rule:** Never disguise simulation as real. UI must not imply live data when provider is not live.

---

## 7. REFERENCE: ONE PRODUCT DIAGRAM

```
┌─────────────────────────────────────────────────────────────────┐
│                        DAHAB PLATFORM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CUSTOMER JOURNEY                    BUSINESS LEARNING           │
│  ─────────────────                   ──────────────────          │
│                                                                 │
│  Discover ──→ Explore ──→ Experience    Market ──→ Intelligence  │
│       │              │            │           │            │     │
│       ▼              ▼            ▼           ▼            ▼     │
│  Plan ──→ Trip ──→ Booking     Opportunity ──→ Product           │
│       │              │            │           │            │     │
│       ▼              ▼            ▼           ▼            ▼     │
│  Payment ──→ Supplier ──→ My Trip    Usage ──→ Outcome           │
│       │              │            │           │            │     │
│       ▼              ▼            ▼           ▼            ▼     │
│  Companion ──→ Recovery ──→ Outcome ──→ Intelligence             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     ONE TRIP (Central Object)                   │
├─────────────────────────────────────────────────────────────────┤
│  TripEntity │ TripItem[] │ Booking[] │ Payment[] │ LedgerEntry[]│
├─────────────────────────────────────────────────────────────────┤
│  In-Memory DB + JSON Persistence │ Real-time via API            │
└─────────────────────────────────────────────────────────────────┘
```

---

*Audit completed: August 31, 2026*  
*All claims verified against repository*
