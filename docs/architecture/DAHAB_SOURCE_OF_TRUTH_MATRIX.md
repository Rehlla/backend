# DAHAB PLATFORM — SOURCE OF TRUTH (SoT) MATRIX
**Standard:** Strict Multi-Tier Data Architecture (August 2026)

---

## 1. Source of Truth Matrix by Domain

| Domain | Entity / Data Type | Primary Source of Truth (SoT) | Secondary / Read Replica | Permitted Static / Curated Scope | Enforcement Mechanism |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Identity & Authentication** | User Profile, Roles, Credentials, Emergency Contacts | `Cloud SQL / Backend Users Table` | Client `TripContext` (Session cache) | `ANONYMOUS_PROFILE` template (id: "", role: Traveler) | JWT verification + Session Resolver |
| **Commerce & Financials** | Booking States, Payments, Invoices, Refunds | `Double-Entry Ledger` (`server/services/commerceService.ts`) | Client `bookings` state | None — strictly forbidden | Idempotency keys + Cryptographic hash chains |
| **Inventory & Availability** | Hotel rooms, Dive slots, Transfer vehicles | `Supplier Inventory Slots Table` | Client Catalog View | Published baseline catalog prices | Locking holds with 15-min TTL |
| **Geography & Marine** | Reef maps, Dive depths, Coastal Coordinates | `Curated Geography Registry` (`src/data/dahabGeography.ts`) | OpenStreetMap / In-App Vector Layers | Full dataset (Physical geography is static) | Geographic verification against South Sinai Survey |
| **Environmental & Weather** | Wind speed, Wave height, Water visibility | `Live Weather Provider` (Open-Meteo / Ground Stations) | Client Fallback Constants (`INITIAL_LIVE_DAHAB_CONDITIONS`) | Static fallback constants for offline mode | 5-minute TTL cache + Live API polling |
| **Local Knowledge & Truth** | Decrees, CDWS warnings, Local union rates | `DKOS Governance Engine` (`server/services/dkosService.ts`) | Client Local Intelligence Card | Verified editorial ground facts | Dual-source verification + Expiry timestamp |
| **Demo / Simulation** | Ahmed 5-Day Golden Itinerary | `Demo Suite Engine` (`src/components/mytrip/myTripData.ts`) | Isolated in-memory state | Explicitly isolated to test runner | `isTestMode === true` gate |

---

## 2. Boundary Enforcement Rules

1. **The Zero-Static-Commerce Invariant:** No financial transaction or confirmed booking may be created without a matching ledger entry in the backend service.
2. **The Anonymous Isolation Invariant:** If `user` is null and `isTestMode` is false, the application MUST present discovery/planning actions and NEVER display personalized booking or schedule cards.
3. **The Single-Traveler Context Invariant:** `buildSingleTravelerContext` is the deterministic aggregator that computes the unified state for UI components based on authenticated credentials.
