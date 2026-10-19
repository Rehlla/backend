# API REMEDIATION PLAN

**Date:** August 31, 2026  
**Evidence:** Backend routes from `server.ts`, `dahabRoutes.ts`, `adminDahabRoutes.ts`. Frontend methods from `src/services/api.ts`. Consumer analysis from component imports.

---

## 1. Complete API Inventory

### 1.1 Backend Endpoints (Total: ~110)

**Registered in `server.ts` inline:** ~60  
**Registered in `dahabRoutes.ts`:** ~35  
**Registered in `adminDahabRoutes.ts`:** ~15

### 1.2 Frontend API Methods (Total: ~55)

**In `src/services/api.ts`:** ~55 methods

---

## 2. Classification of Every Endpoint

### 2.1 ✅ CONNECTED — Backend endpoint has frontend consumer

| # | Backend Endpoint | Frontend Method | Consumer Component |
|---|-----------------|-----------------|-------------------|
| 1 | `POST /api/auth/register` | `api.register()` | AuthContext |
| 2 | `POST /api/auth/login` | `api.login()` | AuthContext |
| 3 | `POST /api/auth/logout` | `api.logout()` | AuthContext |
| 4 | `GET /api/auth/me` | `api.getMe()` | AuthContext (on mount) |
| 5 | `POST /api/auth/firebase-session` | `api.syncFirebaseSession()` | AuthContext |
| 6 | `GET /api/trips/:tripId` | `api.getTrip()` | CommerceContext |
| 7 | `GET /api/trips/:tripId/bookings` | `api.getTripBookings()` | CommerceContext |
| 8 | `POST /api/trips` | `api.saveTrip()` | TripEntrySection |
| 9 | `GET /api/trips/user/:userId` | `api.getTripsForUser()` | CommerceContext |
| 10 | `POST /api/commerce/availability` | `api.checkMultiAvailability()` | Booking components |
| 11 | `POST /api/commerce/hold` | `api.createHold()` | BookingTransferStep |
| 12 | `POST /api/commerce/checkout/multi` | `api.completeMultiCheckout()` | BookNowCommerceModal/View |
| 13 | `POST /api/commerce/checkout` | `api.completeCheckout()` | BookingPaymentStep |
| 14 | `POST /api/commerce/recovery/substitute` | `api.substituteItineraryItem()` | ChangeAndRecoveryView |
| 15 | `POST /api/commerce/refund` | `api.processRefund()` | OperationsConsoleView |
| 16 | `POST /api/daygi/query` | `api.queryDayGi()` | DayGiConciergeView |
| 17 | `POST /api/daygi/action/execute` | `api.executeDayGiAction()` | DayGiConciergeView |
| 18 | `GET /api/daygi/proactive` | `api.getDayGiProactive()` | DayGiConciergeView |
| 19 | `GET /api/daygi/health/:tripId` | `api.getDayGiTripHealth()` | DayGiConciergeView |
| 20 | `GET /api/daygi/memory/:userId` | `api.getDayGiMemory()` | DayGiConciergeView |
| 21 | `POST /api/daygi/memory/:userId` | `api.updateDayGiMemory()` | DayGiConciergeView |
| 22 | `GET /api/daygi/tasks` | `api.getDayGiTasks()` | DayGiConciergeView |
| 23 | `GET /api/daygi/tasks/:taskId` | `api.getDayGiTask()` | DayGiConciergeView |
| 24 | `POST /api/daygi/tasks/:taskId/execute-step` | `api.executeDayGiTaskStep()` | DayGiConciergeView |
| 25 | `POST /api/daygi/tasks/:taskId/apply-recovery` | `api.applyDayGiTaskRecovery()` | DayGiConciergeView |
| 26 | `POST /api/daygi/tasks/:taskId/cancel` | `api.cancelDayGiTask()` | DayGiConciergeView |
| 27 | `POST /api/support/messages` | `api.sendSupportMessage()` | HelpMeNowView |
| 28 | `GET /api/support/messages` | `api.getSupportMessages()` | HelpMeNowView |
| 29 | `POST /api/analytics/daygi` | `api.trackDayGiEvent()` | DayGiConciergeView |
| 30 | `POST /api/daygi/beta/track-funnel` | `api.trackDayGiFunnel()` | DayGiConciergeView |
| 31 | `POST /api/daygi/beta/feedback` | `api.submitDayGiBetaFeedback()` | DayGiConciergeView |
| 32 | `POST /api/daygi/beta/alert-interaction` | `api.trackDayGiAlertInteraction()` | DayGiConciergeView |
| 33 | `POST /api/daygi/beta/card-interaction` | `api.trackDayGiCardInteraction()` | DayGiConciergeView |
| 34 | `GET /api/daygi/beta/dashboard` | `api.getDayGiBetaDashboard()` | DayGiQualityDashboard |
| 35 | `GET /api/daygi/beta/experiments` | `api.getDayGiBetaExperiments()` | DayGiQualityDashboard |
| 36 | `POST /api/daygi/beta/experiments` | `api.updateDayGiBetaExperiments()` | DayGiQualityDashboard |
| 37 | `POST /api/daygi/beta/run-scenarios` | `api.runDayGiGoldenScenarios()` | DayGiQualityDashboard |
| 38 | `POST /api/daygi/beta/generate-weekly-report` | `api.generateDayGiWeeklyReport()` | DayGiQualityDashboard |
| 39 | `GET /api/dahab/places` | `api.getDahabPlaces()` | ExploreView, SearchDrawer, Map |
| 40 | `GET /api/dahab/activities` | `api.getDahabActivities()` | ExploreView, SearchDrawer |
| 41 | `GET /api/dahab/food` | `api.getDahabDining()` | FoodNowView, SearchDrawer |
| 42 | `GET /api/dahab/content/gallery` | `api.getGalleryPhotos()` | DahabGallerySection |
| 43 | `GET /api/dahab/content/stories` | `api.getCuratedStories()` | CuratedStoriesRail |
| 44 | `GET /api/dahab/content/programmes` | `api.getReadyProgrammes()` | TripEntrySection |
| 45 | `POST /api/context/fit-window` | `api.getFitWindowOptions()` | WhatShouldIDoNowView |
| 46 | `GET /api/context/post-activity-food` | `api.getPostActivityFood()` | DailyCompanionDay2View |
| 47 | `GET /api/context/travel-time` | `api.getTravelEstimate()` | Various |
| 48 | `POST /api/context/parse-intent` | `api.parseSearchIntent()` | SearchDrawer |
| 49 | `POST /api/trip/generate` | `api.generateAiTrip()` | BuildingTripState |
| 50 | `POST /api/testing/golden-journey` | `api.runGoldenJourneySuite()` | OperationsConsoleView |
| 51 | `POST /api/market/refresh` | `api.refreshMarketIntelligence()` | MarketIntelligenceView |
| 52 | `GET /api/suppliers/:supplierId/dashboard` | `api.getSupplierDashboard()` | SupplierPortalView |
| 53 | `POST /api/suppliers/bookings/:bookingId/respond` | `api.respondSupplierBooking()` | SupplierPortalView |
| 54 | `GET /api/inventory/:serviceType` | Direct fetch in components | Booking components |

### 2.2 ❌ ORPHANED BACKEND — Endpoint exists, no frontend consumer

| # | Backend Endpoint | Category | Can Wait? |
|---|-----------------|----------|-----------|
| 1 | `GET /api/dahab/context` | Knowledge | Yes |
| 2 | `GET /api/dahab/search` | Knowledge | Yes |
| 3 | `GET /api/dahab/areas` | Knowledge | Yes |
| 4 | `GET /api/dahab/areas/:id` | Knowledge | Yes |
| 5 | `GET /api/dahab/conditions` | Weather | Yes |
| 6 | `GET /api/dahab/emergency` | Emergency | **No — safety** |
| 7 | `GET /api/dahab/regulations` | Compliance | Yes |
| 8 | `GET /api/dahab/questions` | Knowledge | Yes |
| 9 | `GET /api/dahab/badges/:entityId` | Trust | Yes |
| 10 | `GET /api/dahab/commerce/suppliers` | Commerce | Yes |
| 11 | `GET /api/dahab/commerce/offers` | Commerce | Yes |
| 12 | `GET /api/dahab/commerce/market-stats` | Intelligence | Yes |
| 13 | `GET /api/dahab/commerce/compare` | Intelligence | Yes |
| 14 | `GET /api/dahab/commerce/recommend` | Intelligence | Yes |
| 15 | `GET /api/dahab/commerce/price-history` | Intelligence | Yes |
| 16 | `GET /api/dahab/commerce/price-changes` | Intelligence | Yes |
| 17 | `GET /api/dahab/commerce/supplier-changes` | Intelligence | Yes |
| 18 | `GET /api/dahab/commerce/source-freshness` | Intelligence | Yes |
| 19 | `GET /api/dahab/commerce/market-trends` | Intelligence | Yes |
| 20 | `POST /api/dahab/commerce/refresh` | Intelligence | Yes |
| 21 | `GET /api/dahab/commerce/review-queue` | Intelligence | Yes |
| 22 | `POST /api/dahab/commerce/review-queue/:id/resolve` | Intelligence | Yes |
| 23 | `GET /api/dahab/commerce/refresh-runs` | Intelligence | Yes |
| 24 | `GET /api/dahab/commerce/source-health` | Intelligence | Yes |
| 25 | `GET /api/dahab/commerce/operations-overview` | Intelligence | Yes |
| 26 | `GET /api/dahab/commerce/search` | Intelligence | Yes |
| 27-41 | 15 more `/api/dahab/commerce/*` routes (duplicates of `/api/market/*`) | Intelligence | Yes |
| 42 | `GET /api/dahab/admin/health` | Admin | Yes |
| 43 | `GET /api/dahab/admin/conflicts` | Admin | Yes |
| 44 | `POST /api/dahab/admin/conflicts/resolve` | Admin | Yes |
| 45-58 | 14 more admin routes | Admin | Yes |

### 2.3 ❌ ORPHANED FRONTEND — Method exists, no backend endpoint

| # | Frontend Method | Endpoint Called | Issue |
|---|----------------|----------------|-------|
| 1 | `api.getLedger()` | `GET /api/commerce/ledger` | **No endpoint** |
| 2 | `api.verifyLedger()` | `GET /api/commerce/ledger/verify` | **No endpoint** |
| 3 | `api.getWeatherTelemetry()` | `GET /api/telemetry/weather` | **No endpoint** |
| 4 | `api.getCameraFeeds()` | `GET /api/telemetry/cameras` | **No endpoint** |
| 5 | `api.getSuppliers()` | `GET /api/suppliers` | **No endpoint** |
| 6 | `api.getSupplierBookings()` | `GET /api/suppliers/:supplierId/bookings` | **No endpoint** |
| 7 | `api.updateSupplierBookingStatus()` | `POST /api/suppliers/bookings/:bookingId/status` | **No endpoint** |
| 8 | `api.getOperationsOverview()` | `GET /api/operations/overview` | **No endpoint** |
| 9 | `api.getTransferTelemetry()` | `GET /api/transfers/telemetry/:bookingId` | **No endpoint** |
| 10 | `api.getSmsLogs()` | `GET /api/sms/logs` | **No endpoint** |
| 11 | `api.sendSmsDispatch()` | `POST /api/sms/send-dispatch` | **No endpoint** |
| 12 | `api.runGoldenJourneyTest()` | `POST /api/testing/golden-journey` | **Duplicate** of `runGoldenJourneySuite()` |

### 2.4 🔀 DUPLICATE PATHS — Same endpoint in multiple files

| # | Path | File A | File B | Resolution |
|---|------|--------|--------|-----------|
| 1 | `/api/market/jobs` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/jobs` | Keep `server.ts` |
| 2 | `/api/market/jobs/trigger` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/jobs/trigger` | Keep `server.ts` |
| 3 | `/api/market/jobs/policy` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/jobs/policy` | Keep `server.ts` |
| 4 | `/api/market/sources/health` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/source-health` | Keep `server.ts` |
| 5 | `/api/market/sources/circuit-breaker/reset` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/circuit-breakers/reset` | Keep `server.ts` |
| 6 | `/api/market/review-queue` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/review-queue` | Keep `server.ts` |
| 7 | `/api/market/review-queue/:id/resolve` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/review-queue/:id/resolve` | Keep `server.ts` |
| 8 | `/api/market/ops/overview` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/operations-overview` | Keep `server.ts` |
| 9 | `/api/market/ops/run-all` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/run-all-scheduled` | Keep `server.ts` |
| 10 | `/api/market/alerts` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/alerts` | Keep `server.ts` |
| 11 | `/api/market/alerts/:id/acknowledge` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/alerts/:id/acknowledge` | Keep `server.ts` |
| 12 | `/api/market/alerts/:id/resolve` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/alerts/:id/resolve` | Keep `server.ts` |
| 13 | `/api/market/snapshots` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/snapshots` | Keep `server.ts` |
| 14 | `/api/market/snapshots/create` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/snapshots/create` | Keep `server.ts` |
| 15 | `/api/market/snapshots/:id/rollback` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/snapshots/:id/rollback` | Keep `server.ts` |
| 16 | `/api/market/status` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/autonomous-status` | Keep `server.ts` |
| 17 | `/api/market/events` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/supplier-changes` | Keep `server.ts` |
| 18 | `/api/market/price-history` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/price-history` | Keep `server.ts` |
| 19 | `/api/market/trends` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/market-trends` | Keep `server.ts` |
| 20 | `/api/market/source-freshness` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/source-freshness` | Keep `server.ts` |
| 21 | `/api/market/refresh` | `server.ts` | `dahabRoutes.ts` as `/api/dahab/commerce/refresh` | Keep `server.ts` |

---

## 3. Remediation Order

### Phase 1: Fix Broken Frontend Methods (5 endpoints)

These frontend methods call endpoints that don't exist, causing silent failures.

| Priority | New Endpoint | Frontend Method | File to Modify |
|----------|-------------|-----------------|----------------|
| P1 | `GET /api/telemetry/weather` | `api.getWeatherTelemetry()` | `server.ts` |
| P1 | `GET /api/telemetry/cameras` | `api.getCameraFeeds()` | `server.ts` |
| P1 | `GET /api/commerce/ledger` | `api.getLedger()` | `server.ts` |
| P1 | `GET /api/commerce/ledger/verify` | `api.verifyLedger()` | `server.ts` |
| P1 | `GET /api/transfers/telemetry/:bookingId` | `api.getTransferTelemetry()` | `server.ts` |
| P1 | `GET /api/suppliers` | `api.getSuppliers()` | `server.ts` |
| P1 | `GET /api/suppliers/:supplierId/bookings` | `api.getSupplierBookings()` | `server.ts` |

### Phase 2: Wire Critical Orphaned Endpoints (8 endpoints)

| Priority | Backend Endpoint | Frontend Consumer | Component |
|----------|-----------------|-------------------|-----------|
| P1 | `GET /api/dahab/emergency` | New `api.getEmergencyResources()` | HelpMeNowView |
| P1 | `GET /api/dahab/admin/conflicts` | New `api.getConflicts()` | OperationsConsoleView |
| P2 | `GET /api/dahab/search` | New `api.searchDahab()` | SearchDrawer |
| P2 | `GET /api/dahab/areas` | New `api.getDahabAreas()` | ExploreView |
| P2 | `GET /api/dahab/regulations` | New `api.getRegulations()` | PreArrivalBriefing |
| P2 | `GET /api/dahab/commerce/price-history` | New `api.getMarketPriceHistory()` | MarketIntelligenceView |
| P2 | `GET /api/dahab/commerce/market-trends` | New `api.getMarketTrends()` | MarketIntelligenceView |
| P2 | `GET /api/dahab/commerce/source-health` | New `api.getMarketSourceHealth()` | MarketIntelligenceView |

### Phase 3: Consolidate Duplicate Routes

Remove 21 duplicate routes from `dahabRoutes.ts` that also exist in `server.ts` under `/api/market/*`.

### Phase 4: Add Missing RBAC Checks

| Endpoint | Current Auth | Required Fix |
|----------|-------------|-------------|
| `GET /api/daygi/beta/dashboard` | Any auth | Add `requireRole('Product', 'Operations', 'Admin')` |
| `GET /api/daygi/beta/experiments` | Any auth | Add role check |
| `POST /api/daygi/beta/experiments` | Any auth | Add role check |
| `POST /api/daygi/beta/run-scenarios` | Any auth | Add role check |
| `POST /api/daygi/beta/generate-weekly-report` | Any auth | Add role check |

### Phase 5: Remove Dead Frontend Code

| Method | Action |
|--------|--------|
| `api.runGoldenJourneyTest()` | Remove (duplicate of `runGoldenJourneySuite()`) |
| `api.updateSupplierBookingStatus()` | Remove or implement endpoint |
| `api.getOperationsOverview()` | Remove or implement endpoint |

---

## 4. Schema Drift Analysis

### 4.1 Frontend Types vs Backend Schema

| Shared Type | Frontend Location | Backend Location | Match? |
|-------------|-------------------|------------------|--------|
| `TripEntity` | `src/shared/types/trip.ts` | `server/db/schema.ts` | ✅ |
| `TripItemEntity` | `src/shared/types/trip.ts` | `server/db/schema.ts` | ✅ |
| `ConfirmedBookingItem` | `src/shared/types/commerce.ts` | Derived from `BookingEntity` | ✅ |
| `LedgerEntry` | `src/shared/types/commerce.ts` | `LedgerEntryEntity` | ✅ |
| `TravelerProfile` | `src/shared/types/user.ts` | `UserEntity` (partial) | ✅ |
| `SupportMessage` | `src/shared/` | `SupportMessageEntity` | ✅ |
| `DahabPlace` | `src/shared/` | `PlaceEntity` | ✅ |
| `DahabActivity` | `src/shared/` | `ActivityDetailEntity` | ✅ |
| `DahabDiningVenue` | `src/shared/` | `DiningVenueEntity` | ✅ |
| `CommerceServiceType` | `src/shared/` | `server/db/schema.ts` | ✅ |

### 4.2 Frontend Types Not in Backend

| Type | Location | Purpose |
|------|----------|---------|
| `DayGiResponse` | `src/types.ts` | AI concierge response shape |
| `DayGiParsedIntent` | `src/types.ts` | Intent classification |
| `DayGiOrchestratedTask` | `src/types.ts` | Task orchestration state |
| All `DayGi*` types | `src/types.ts` | Frontend-specific AI types |

These are frontend-only types used by the DayGI concierge UI. They don't need backend schema equivalents because the backend returns them as generic JSON.

---

*Every finding has a file reference. No assumptions.*
