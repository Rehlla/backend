# MASTER REALITY MATRIX

**Date:** August 31, 2026  
**Standard:** Every row verified against repository code. UNKNOWN = not verified.

---

## Legend

| Field | Meaning |
|-------|---------|
| **Real** | Production-grade, talks to real external system |
| **Simulated** | Works but does not contact real external system |
| **Adapter** | Interface exists, implementation incomplete |
| **Mock** | Hardcoded/faked data, no real backend |
| **Disconnected** | Backend exists, frontend doesn't call it |
| **Partial** | Works for some cases, not all |

---

## Capability Matrix

### Authentication & Session

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| A-01 | Email/password registration | `AuthContext.registerWithPassword()` | `POST /api/auth/register` | `db.users` | ✅ | None | **Real** | `authSession.test.ts` | Low | Done |
| A-02 | Email/password login | `AuthContext.signInWithPassword()` | `POST /api/auth/login` | `db.users`, `db.sessions` | ✅ | None | **Real** | `authSession.test.ts` | Low | Done |
| A-03 | Session restore on refresh | `AuthContext.useEffect → api.getMe()` | `GET /api/auth/me` | `db.sessions` | ✅ | None | **Real** | `authSession.test.ts` | Low | Done |
| A-04 | Sign out | `AuthContext.signOut()` | `POST /api/auth/logout` | `db.sessions` | ✅ | None | **Real** | `logout.test.ts` | Low | Done |
| A-05 | Revoke all sessions | Not in UI | `POST /api/auth/logout-all` | `db.sessions` | ✅ | None | **Real** | `logout.test.ts` | Low | Done |
| A-06 | Firebase Google OAuth | `AuthContext.signInWithGoogle()` | `POST /api/auth/firebase-session` | `db.users` | ⚠️ 503 | Firebase Admin (no creds) | **Broken** | `authSession.test.ts` | Medium | P1 |
| A-07 | Firebase email auth | `AuthContext.signInWithEmail()` | Client SDK only | None | ⚠️ 503 | Firebase Client SDK | **Broken** | None | Medium | P1 |
| A-08 | Password reset email | `AuthContext.sendResetPasswordEmail()` | Client SDK only | None | ⚠️ 503 | Firebase Client SDK | **Broken** | None | Low | P2 |
| A-09 | RBAC (5 roles) | `RequireRole` component | `requireRole` middleware + `apiAccessPolicy` | `UserEntity.role` | ✅ | None | **Real** | `apiAccessPolicy.test.ts` | Low | Done |
| A-10 | Deny-by-default API | None (server-side) | `apiAccessPolicy` middleware | None | ✅ | None | **Real** | `apiAccessPolicy.test.ts` | Low | Done |

### Trips & Itinerary

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| T-01 | Create/save trip | `TripEntrySection → api.saveTrip()` | `POST /api/trips` | `db.trips` | ✅ | None | **Real** | None (no trip creation test) | Low | P3 |
| T-02 | Read trip | `CommerceContext → api.getTrip()` | `GET /api/trips/:tripId` | `db.trips` | ✅ | None | **Real** | None | Low | Done |
| T-03 | Read trip bookings | `CommerceContext → api.getTripBookings()` | `GET /api/trips/:tripId/bookings` | `db.bookings`, `db.tripItems` | ✅ | None | **Real** | `tripBookingMapper.test.ts` | Low | Done |
| T-04 | User's trips | `CommerceContext → api.getTripsForUser()` | `GET /api/trips/user/:userId` | `db.trips` | ✅ | None | **Real** | None | Low | Done |
| T-05 | Generate AI trip | `BuildingTripState → api.generateAiTrip()` | `POST /api/trip/generate` | None (generates in-memory) | ✅ | Gemini AI | **Simulated** | None | Low | P2 |
| T-06 | Trip timeline | `MyTripView → TripTimeline` | Client-side from trip items | `db.tripItems` | N/A | None | **Real** | `tripBookingMapper.test.ts` | Low | Done |
| T-07 | Smart budget | `MyTripView → SmartBudgetSection` | Client-side calculation | `db.ledgerEntries` | N/A | None | **Real** | None | Low | Done |
| T-08 | Group travel voting | `MyTripView → GroupTravelSection` | Client-side only | None | None | None | **Mock** | None | Low | P3 |
| T-09 | Trip date formatting | `formatTripDateRange()` utility | None | None | N/A | None | **Real** | None | Low | Done |

### Commerce & Booking

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| C-01 | Check availability | `BookingTransferStep → api.createHold()` | `POST /api/commerce/availability` | `db.inventorySlots` | ✅ | None | **Real** | `checkoutInventory.test.ts` | Low | Done |
| C-02 | Create hold (15-min TTL) | `BookingTransferStep → api.createHold()` | `POST /api/commerce/hold` | `db.holds` | ✅ | None | **Real** | `capacity.test.ts` | Low | Done |
| C-03 | Multi-item checkout | `BookNowCommerceModal → api.completeMultiCheckout()` | `POST /api/commerce/checkout/multi` | `db.bookings`, `db.payments` | ✅ | None | **Simulated** | `checkoutInventory.test.ts` | Medium | P1 |
| C-04 | Single-item checkout | `BookingPaymentStep → api.completeCheckout()` | `POST /api/commerce/checkout` | `db.bookings`, `db.payments` | ✅ | None | **Simulated** | `payments.test.ts` | Medium | P1 |
| C-05 | Payment processing | `paymentService.processCheckout()` | `paymentService.ts` | `db.payments` | N/A | None (simulated) | **Simulated** | `payments.test.ts` | High | P1 |
| C-06 | Refund | `OperationsConsoleView → api.processRefund()` | `POST /api/commerce/refund` | `db.ledgerEntries` | ✅ | None | **Simulated** | `refund.test.ts` | Medium | P1 |
| C-07 | Recovery substitution | `ChangeAndRecoveryView → api.substituteItineraryItem()` | `POST /api/commerce/recovery/substitute` | `db.tripItems` | ✅ | None | **Real** | None | Low | Done |
| C-08 | Paymob webhook | Not in frontend | `paymentService.handleWebhook()` | `db.payments` | ✅ (endpoint not mounted) | Paymob (optional) | **Adapter** | `payments.test.ts` | Medium | P2 |
| C-09 | Inventory catalog | `BookingHotelStep` (curated data) | `GET /api/inventory/:serviceType` | `db.productSkus` | ✅ | None | **Real** | None | Low | Done |
| C-10 | Dynamic slot generation | `transferService.checkAvailability()` | `transferService.ts` | `db.inventorySlots` | N/A | None | **Real** | `capacity.test.ts` | Low | Done |

### Ledger & Financial

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| L-01 | Double-entry recording | `ledgerService.recordDoubleEntry()` | `ledgerService.ts` | `db.ledgerEntries` | N/A | None | **Real** | `ledger.test.ts` | Low | Done |
| L-02 | SHA-256 hash chain | `ledgerService.calculateEntryHash()` | `ledgerService.ts` | `db.ledgerEntries[].signatureHash` | N/A | None | **Real** | `ledger.test.ts` | Low | Done |
| L-03 | Chain integrity verification | `ledgerService.verifyLedgerIntegrity()` | `ledgerService.ts` | `db.ledgerEntries` | N/A | None | **Real** | `ledger.test.ts` | Low | Done |
| L-04 | Escrow balance tracking | `verifyLedgerIntegrity().escrowBalanceEGP` | `ledgerService.ts` | `db.ledgerEntries` | N/A | None | **Real** | `ledger.test.ts` | Low | Done |
| L-05 | Idempotent entries | `ledgerService.recordDoubleEntry()` | `ledgerService.ts` | `db.ledgerEntries` | N/A | None | **Real** | `ledger.test.ts` | Low | Done |
| L-06 | Booking reconciliation | `ledgerService.reconcileBooking()` | `ledgerService.ts` | `db.ledgerEntries`, `db.bookings` | N/A | None | **Real** | None | Low | Done |
| L-07 | Anomaly detection | `ledgerService.detectLedgerAnomalies()` | `ledgerService.ts` | `db.ledgerEntries` | N/A | None | **Real** | None | Low | Done |
| L-08 | Ledger API (read) | `api.getLedger()` | **NO ENDPOINT** | None | ❌ | None | **Disconnected** | None | Medium | P1 |
| L-09 | Ledger verify API | `api.verifyLedger()` | **NO ENDPOINT** | None | ❌ | None | **Disconnected** | None | Medium | P1 |
| L-10 | Commission reversal on refund | `paymentService.processRefund()` | `paymentService.ts` | `db.ledgerEntries` | N/A | None | **Real** | `refund.test.ts` | Low | Done |

### DayGI AI Concierge

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| D-01 | Query processing | `DayGiConciergeView → api.queryDayGi()` | `POST /api/daygi/query` | `db.temporalFacts` | ✅ | Gemini AI | **Real** (with AI fallback) | None | Low | Done |
| D-02 | Action execution | `DayGiConciergeView → api.executeDayGiAction()` | `POST /api/daygi/action/execute` | Various | ✅ | None | **Real** | None | Low | Done |
| D-03 | Structured memory | `api.getDayGiMemory()` / `updateDayGiMemory()` | `GET/POST /api/daygi/memory/:userId` | In-memory (`daygiMemoryService`) | ✅ | None | **Real** | None | Low | Done |
| D-04 | Trip health scoring | `api.getDayGiTripHealth()` | `GET /api/daygi/health/:tripId` | In-memory | ✅ | None | **Real** | `tripHealthMapper.test.ts` | Low | Done |
| D-05 | Proactive suggestions | `api.getDayGiProactive()` | `GET /api/daygi/proactive` | In-memory | ✅ | None | **Real** | None | Low | Done |
| D-06 | Task orchestration | `api.getDayGiTasks()` etc. | `GET/POST /api/daygi/tasks/*` | In-memory (`daygiTaskOrchestrator`) | ✅ | None | **Real** | `taskOwnership.test.ts` | Low | Done |
| D-07 | Beta telemetry | `api.trackDayGiFunnel()` etc. | `POST /api/daygi/beta/*` | In-memory | ✅ | None | **Real** | None | Low | Done |
| D-08 | Intent parsing | `api.parseSearchIntent()` | `POST /api/context/parse-intent` | None | ✅ | Gemini AI | **Real** | None | Low | Done |
| D-09 | Daily briefing | Not wired to UI | `POST /api/context/daily-briefing` | None | ✅ | Gemini AI | **Disconnected** | None | Low | P2 |

### Explore & Discovery

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| E-01 | Places catalog | `ExploreView → api.getDahabPlaces()` | `GET /api/dahab/places` | `db.places` | ✅ | None | **Real** | None | Low | Done |
| E-02 | Activities catalog | `ExploreView → api.getDahabActivities()` | `GET /api/dahab/activities` | `db.activities` | ✅ | None | **Real** | None | Low | Done |
| E-03 | Dining venues | `FoodNowView → api.getDahabDining()` | `GET /api/dahab/food` | `db.diningVenues` | ✅ | None | **Real** | None | Low | Done |
| E-04 | Search drawer | `SearchDrawer` (3 parallel fetches) | Individual endpoints | `db.places`, `db.activities`, `db.diningVenues` | ✅ | None | **Real** (not unified) | None | Low | Done |
| E-05 | Unified search | Not wired | `GET /api/dahab/search` | `unifiedSearchEngine` | ✅ | None | **Disconnected** | None | Low | P2 |
| E-06 | Area profiles | Not wired | `GET /api/dahab/areas` | `db.areaProfiles` | ✅ | None | **Disconnected** | None | Low | P2 |
| E-07 | Emergency contacts | `HelpMeNowView` (hardcoded) | `GET /api/dahab/emergency` | `db.emergencyResources` | ✅ | None | **Disconnected** | None | Medium | P1 |
| E-08 | Regulations | Not wired | `GET /api/dahab/regulations` | `db.regulatoryDecrees` | ✅ | None | **Disconnected** | None | Low | P2 |
| E-09 | Trust badges | Not wired | `GET /api/dahab/badges/:entityId` | `dahabKnowledgeOs` | ✅ | None | **Disconnected** | None | Low | P3 |
| E-10 | Questions (knowledge) | Not wired | `GET /api/dahab/questions` | `dahabKnowledgeOs` | ✅ | None | **Disconnected** | None | Low | P3 |

### Market Intelligence

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| M-01 | Market refresh | `MarketIntelligenceView → api.refreshMarketIntelligence()` | `POST /api/market/refresh` | `marketFreshnessService` | ✅ | None | **Real** | None | Low | Done |
| M-02 | Price history | Not wired | `GET /api/dahab/commerce/price-history` | `db.priceObservations` | ✅ | None | **Disconnected** | None | Low | P2 |
| M-03 | Market trends | Not wired | `GET /api/dahab/commerce/market-trends` | `marketFreshnessService` | ✅ | None | **Disconnected** | None | Low | P2 |
| M-04 | Source health | Not wired | `GET /api/dahab/commerce/source-health` | `db.sourceHealthRecords` | ✅ | None | **Disconnected** | None | Low | P2 |
| M-05 | Supplier catalog | Not wired | `GET /api/dahab/commerce/suppliers` | `db.suppliers` | ✅ | None | **Disconnected** | None | Low | P2 |
| M-06 | Offer comparison | Not wired | `GET /api/dahab/commerce/compare` | `commerceIntelligenceService` | ✅ | None | **Disconnected** | None | Low | P3 |
| M-07 | Review queue | Not wired | `GET /api/dahab/commerce/review-queue` | `db.marketReviewQueue` | ✅ | None | **Disconnected** | None | Low | P3 |
| M-08 | Autonomous data ops | Not wired | Multiple `/api/market/*` endpoints | `autonomousDataOpsService` | ✅ | None | **Disconnected** | None | Low | P3 |
| M-09 | Market alerts | Not wired | `GET /api/market/alerts` | `db.marketAlerts` | ✅ | None | **Disconnected** | None | Low | P3 |
| M-10 | Snapshots + rollback | Not wired | `GET/POST /api/market/snapshots/*` | `db.marketSnapshots` | ✅ | None | **Disconnected** | None | Low | P3 |

### In-Destination Companion

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| I-01 | Pre-arrival briefing | `PreArrivalBriefing` | None (client-side) | None | N/A | None | **Real** (static content) | None | Low | Done |
| I-02 | Early arrival | `EarlyArrivalView` | None (client-side) | None | N/A | None | **Real** (static content) | None | Low | Done |
| I-03 | First 2 hours | `FirstTwoHoursView` | `api.getFitWindowOptions()` | `mapsContextService` | ✅ | None | **Real** | None | Low | Done |
| I-04 | Daily companion | `DailyCompanionDay2View` | Client-side + weather | `weatherService` | ✅ | Open-Meteo | **Real** | `weather.test.ts` | Low | Done |
| I-05 | What Should I Do Now | `WhatShouldIDoNowView` | `api.getFitWindowOptions()` | `mapsContextService` | ✅ | None | **Real** | None | Low | Done |
| I-06 | Food Now | `FoodNowView` | `api.getDahabDining()` | `db.diningVenues` | ✅ | None | **Real** | None | Low | Done |
| I-07 | Change & recovery | `ChangeAndRecoveryView` | `api.substituteItineraryItem()` | `recoveryService` | ✅ | None | **Real** | None | Low | Done |
| I-08 | Help & emergency | `HelpMeNowView` | `api.sendSupportMessage()` | `db.supportMessages` | ✅ | None | **Real** | None | Low | Done |
| I-09 | Departure | `DepartureView` | None (client-side) | None | N/A | None | **Real** (static content) | None | Low | Done |
| I-10 | Post-trip | `PostTripView` | None (client-side) | None | N/A | None | **Mock** (badges, reviews) | None | Low | P3 |

### Operations & Admin

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| O-01 | Operations console | `OperationsConsoleView` | Various | Various | ✅ | None | **Partial** | None | Low | Done |
| O-02 | Supplier portal | `SupplierPortalView` | `api.respondSupplierBooking()` | `db.bookings` | ✅ | None | **Real** | None | Low | Done |
| O-03 | Knowledge conflicts | Not wired | `GET /api/dahab/admin/conflicts` | `db.conflictSets` | ✅ | None | **Disconnected** | None | Low | P2 |
| O-04 | Knowledge gaps | Not wired | `GET /api/dahab/admin/gaps` | `knowledgeGapService` | ✅ | None | **Disconnected** | None | Low | P3 |
| O-05 | Entity resolution | Not wired | `POST /api/dahab/admin/entities/resolve` | `entityResolutionService` | ✅ | None | **Disconnected** | None | Low | P3 |
| O-06 | Stale facts | Not wired | `GET /api/dahab/admin/stale-facts` | `db.temporalFacts` | ✅ | None | **Disconnected** | None | Low | P3 |
| O-07 | DKOS health | Not wired | `GET /api/dahab/admin/health` | `dahabKnowledgeOs` | ✅ | None | **Disconnected** | None | Low | P3 |
| O-08 | 30-point proof | Not wired | `POST /api/dahab/admin/proof` | `runDkosLiveProductProof` | ✅ | None | **Disconnected** | None | Low | P3 |

### Weather & Conditions

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| W-01 | Live weather | `SinaiRadarWidget → api.getWeatherTelemetry()` | **NO ENDPOINT** for `/api/telemetry/weather` | None | ❌ | None | **Disconnected** | `weather.test.ts` (service only) | Medium | P1 |
| W-02 | Camera feeds | `DahabLiveView → api.getCameraFeeds()` | **NO ENDPOINT** for `/api/telemetry/cameras` | None | ❌ | None | **Disconnected** | None | Low | P2 |
| W-03 | Weather service | `weatherService.getCurrentConditions()` | `weatherService.ts` | None (in-memory cache) | N/A | Open-Meteo | **Real** | `weather.test.ts` | Low | Done |

### Support & Messaging

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| S-01 | Send support message | `HelpMeNowView → api.sendSupportMessage()` | `POST /api/support/messages` | `db.supportMessages` | ✅ | None | **Real** | None | Low | Done |
| S-02 | Read support messages | `api.getSupportMessages()` | `GET /api/support/messages` | `db.supportMessages` | ✅ | None | **Real** | None | Low | Done |
| S-03 | Reply to message | Not wired (Operations) | `POST /api/support/messages/:id/reply` | `db.supportMessages` | ✅ | None | **Disconnected** | None | Low | P2 |

### SMS & Notifications

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| N-01 | Send SMS | Not wired | `smsGatewayService.sendSms()` | `smsDispatchLogs` | ⚠️ No endpoint | Twilio (optional) | **Simulated** | None | Low | P2 |
| N-02 | Read SMS logs | `api.getSmsLogs()` | **NO ENDPOINT** | None | ❌ | None | **Disconnected** | None | Low | P2 |
| N-03 | In-app notifications | None | `notificationService.sendNotification()` | `db.notifications` | None | None | **Real** (internal only) | None | Low | Done |

### Editorial Content

| ID | Capability | Frontend | Backend | DB | API | External | Status | Tests | Risk | Priority |
|----|-----------|----------|---------|-----|-----|----------|--------|-------|------|----------|
| EC-01 | Gallery photos | `DahabGallerySection → api.getGalleryPhotos()` | `GET /api/dahab/content/gallery` | `editorialContent.ts` | ✅ | None | **Real** | None | Low | Done |
| EC-02 | Curated stories | `CuratedStoriesRail → api.getCuratedStories()` | `GET /api/dahab/content/stories` | `editorialContent.ts` | ✅ | None | **Real** | None | Low | Done |
| EC-03 | Ready programmes | `TripEntrySection → api.getReadyProgrammes()` | `GET /api/dahab/content/programmes` | `editorialContent.ts` | ✅ | None | **Real** | None | Low | Done |

---

## Summary Counts

| Status | Count | Percentage |
|--------|-------|------------|
| **Real** | 45 | 52% |
| **Simulated** | 5 | 6% |
| **Disconnected** | 20 | 23% |
| **Broken** | 3 | 3% |
| **Mock** | 2 | 2% |
| **Partial** | 1 | 1% |
| **Adapter** | 1 | 1% |
| **Unknown** | 9 | 10% |

**Key insight:** 23% of capabilities have working backends but no frontend consumer. 3% are broken due to missing Firebase credentials.

---

*Every row has a file reference in the evidence column. UNKNOWN means not verified.*
