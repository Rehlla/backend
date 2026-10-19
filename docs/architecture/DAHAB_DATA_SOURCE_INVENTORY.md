# DAHAB PLATFORM — DATA SOURCE INVENTORY & CLASSIFICATION AUDIT
**Standard:** Enterprise Data Governance & Truth Boundary Model (August 2026)  
**Scope:** Complete repository inventory across `/src/data/`, `/src/components/`, `/server/`, and `/data/`.

---

## 1. Executive Summary

A comprehensive data audit of the Dahab Platform was conducted to classify all data sources, detect static/mock leaks, verify backend authority, and reconcile client vs server responsibilities.

### Key Classifications:
1. **Curated Public Destination Knowledge (`CURATED`):** Geographic POIs, dive site coordinates, topography, wind behavior, cultural etiquette. Permitted to remain curated in code/cache because physical Dahab geography is immutable on short timescales.
2. **Authoritative Production Truth (`AUTHORITATIVE_BACKEND` / `CLOUD_SQL_FIRESTORE`):** User identity, confirmed bookings, financial ledger transactions, merchant inventory, supplier credentials, emergency contacts. Must originate from backend storage (`server/db/database.ts` / Firestore).
3. **DKOS Research & Evidence (`DKOS_GOVERNANCE`):** Fact engine, source credibility registry, temporal validation, and dispute resolutions.
4. **Live Provider Feeds (`LIVE_ADAPTER`):** Open-Meteo marine/wind conditions, hyperbaric status, live driver telemetry.
5. **Demo / Golden Journey Data (`DEMO_ISOLATED`):** Ahmed 5-day scenario data (`AHMED_TRIP_DAYS`, `AHMED_BOOKINGS`, `DEMO_AHMED_PROFILE`). Strictly gated to demo mode and forbidden from leaking into anonymous visitor sessions.

---

## 2. Complete Data Source Inventory Table

| Data File / Source | Category | Classification | Description & Scope | Consumer Modules / Components | Authority Risk | Isolation Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `src/data/dahabGeography.ts` | Geography & Marine | `CURATED_DESTINATION` | 7 distinct zones, 12 dive sites, GPS coordinates, depth profiles, coral reef boundaries, wind stations. | `ExploreView`, `InteractiveMap`, `DiveSiteDetail`, `EnvironmentalWidgets` | Low | Curated Public |
| `src/data/dahabContent.ts` | Editorial Guide | `CURATED_EDITORIAL` | Curated itineraries, recommended local dining, Bedouin tea etiquette, packing checklists, seasonal guides. | `ExploreView`, `ItineraryView`, `TripBuilder` | Low | Curated Public |
| `src/data/readyTripsData.ts` | Package Blueprints | `CURATED_EDITORIAL` | 5 ready-made package itineraries (3-day to 7-day) with pricing baselines and daily schedules. | `ReadyTripsView`, `TripPreviewModal`, `TripBuilder` | Low | Curated Public |
| `src/data/intelligenceData.ts` | Local Knowledge | `DKOS_GOVERNANCE` | Ground intelligence items, pricing signals, seasonal wind patterns, transport union fixed rates. | `DahabLocalIntelligenceCard`, `NextBestActionBanner` | Medium | Governed by DKOS |
| `src/data/intelligenceSources.ts` | Knowledge Provenance | `DKOS_GOVERNANCE` | Registry of CDWS, Sinai Health Directorate, Bedouin tribal councils, and meteorological sources. | `TrustBadge`, `EvidenceGraphModal`, DKOS pipeline | Low | Governed Registry |
| `src/data/tripOsDefaults.ts` | State Defaults | `DEFAULT_STATE` | Clean baseline parameters (`ANONYMOUS_PROFILE`, `DEFAULT_TRIP_BRIEF`, default budget tiers). | `TripContext.tsx`, `TripBuilder` | Medium | Neutral Baselines |
| `src/components/mytrip/myTripData.ts` | Golden Journey Simulation | `DEMO_ISOLATED` | Ahmed's 5-day October trip timeline (`AHMED_TRIP_DAYS`) & bookings (`AHMED_BOOKINGS`). | `DailyCompanionDay2View`, `ChangeAndRecoveryView`, Demo Simulator | High (if unisolated) | Gated to Demo Simulator |
| `src/components/booking/bookingData.ts` | Service Catalog & Options | `CURATED_COMMERCE_CATALOG` | Hotel rooms, dive center packages, 4x4 transfers, desert safari options with transparent pricing. | `BookingHotelStep`, `BookingDivingStep`, `BookingTransferStep` | High | Reconciled with Ledger |
| `src/components/commerce/BookNowCommerceModal.tsx` | In-Destination Commerce | `LIVE_COMMERCE_DISPATCH` | Instant-bookable gear, sunset safaris, afternoon dives with double-entry ledger capture. | `V2HomeCockpit`, `BookNowCommerceView` | Critical | Authoritative Ledger Pipeline |
| `server/db/database.ts` | Backend System of Record | `AUTHORITATIVE_BACKEND` | Persistent storage for users, sessions, trips, bookings, payments, and immutable double-entry ledger. | `server/api/dahabRoutes.ts`, `server/api/adminDahabRoutes.ts` | High Authority | Server Authoritative |
| `data/dahab_db.json` | Persistent JSON Database | `AUTHORITATIVE_STORAGE` | File-backed JSON store with WAL journaling simulating relational DB for local/container dev. | `server/db/database.ts` | High Authority | Server Authoritative |
| `src/services/travelerJourneyEngine.ts` | Journey Context Factory | `GOVERNED_COMPUTATION` | Real-time calculation of traveler journey phase, trust badge resolution, and Next Best Actions. | `TripContext.tsx`, `V2HomeCockpit`, `NextBestActionBanner` | Low | Dynamic Resolver |
| `src/services/travelerLifecycleResolver.ts` | Lifecycle Gatekeeper | `GOVERNED_COMPUTATION` | Mathematical isolation of `DISCOVERY` (Anonymous) vs `ACTIVE_TRIP` vs `POST_TRIP`. | `TripContext.tsx`, `V2HomeCockpit` | Critical | Security Gatekeeper |
| `src/services/homepageCompositionResolver.ts` | UI Surface Resolver | `GOVERNED_COMPUTATION` | Determines section visibility (hero, quick actions, cockpit, trip entry) based on lifecycle. | `V2HomeCockpit.tsx` | Medium | Layout Controller |

---

## 3. Data Integrity & Anonymous Visitor Isolation Audit

### Bug Analysis: Anonymous State Leak ("Good morning, Ahmed")
* **Root Cause:** Certain sub-views in `/src/components/mytrip/` (`MyTripHeader`, `WhatsNextCard`, `BookingsSection`, `TripTimeline`) previously rendered hardcoded strings or directly imported `AHMED_BOOKINGS` / `AHMED_TRIP_DAYS` instead of consuming dynamic state from `useTrip()`.
* **Resolution Applied:**
  1. `MyTripHeader`: Replaced static strings with dynamic traveler display names, trip lengths, and dates derived from `useTrip()` and `LanguageContext`.
  2. `WhatsNextCard`: Converted personalized messaging to adapt to current user context (`profile.name` or generic friendly welcome).
  3. `BookingsSection`: Updated to map over `useTrip().bookings` with a clean empty state and CTA to book verified services when empty.
  4. `TripTimeline`: Configured to accept dynamic `tripDays` from `useTrip()`.
  5. `BookingsView`, `ProfileView`, `DepartureView`, `PostTripView`: Dynamic traveler names and zero placeholder leakage for new authenticated users.
  6. `travelerLifecycleResolver` & `buildSingleTravelerContext`: Confirmed strict isolation returning empty profiles and public actions for unauthenticated visitors.

---

## 4. Reconciled Data Governance Rules

1. **Editorial Rule:** Public geography, dive site profiles, and guide articles are immutable curated assets. They are stored client-side for zero-latency retrieval.
2. **Commerce Rule:** Every booking, payment hold, cancellation, and refund MUST execute against the double-entry ledger in `server/services/commerceService.ts` and persist to backend storage.
3. **Identity Rule:** Traveler profiles start as `ANONYMOUS_PROFILE` with zero bookings. Authenticated profiles load from backend/auth token.
4. **Demo Rule:** Ahmed's 5-day scenario is isolated to the "Demo Simulation Suite" and never seeds anonymous visits.
