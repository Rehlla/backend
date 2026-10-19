# DAHAB PLATFORM — MASTER REALITY & HARDENING PLAN
**Engineering Roadmap: Transitioning from High-Fidelity Prototype to Production Core**  
*Plan Date: 2026-08-25*

---

## 1. Overview & Strategy

The Dahab Tourism Platform possesses a world-class, responsive, bilingual user interface across 26 views and 12 traveler journey stages. To transition this platform from an interactive prototype to a fully operational, multi-tenant digital travel agency and companion, the following phased engineering plan is established.

---

## 2. Phased Priority Roadmap

```
┌───────────────────────────────────────────────────────────────────────────┐
│                          HARDENING PHASES & TIMELINE                      │
├───────────────────────────────────────────────────────────────────────────┤
│  P0: CORE DATA PERSISTENCE & FINANCIAL INTEGRITY (Foundation)             │
│  ├── Database Engine (PostgreSQL / Firestore)                             │
│  ├── Persistent Double-Entry Ledger & Transaction Tables                 │
│  ├── Multi-Tenant Authentication & Session Management                     │
│  └── Real Payment Gateway & Webhook Signature Verification (Paymob/Stripe)│
├───────────────────────────────────────────────────────────────────────────┤
│  P1: EXTERNAL PROVIDERS & TELEMETRY ADAPTERS (Real Integrations)         │
│  ├── Live Marine & Wind API (OpenWeather / Stormglass / CDWS RSS)         │
│  ├── Live Airport & Flight Telemetry (FlightAware / AviationStack)        │
│  ├── WhatsApp Business API Dispatch for Bookings & Briefings              │
│  └── Restaurant Partner Dispatch Bridge (Direct POS / WhatsApp Webhook)   │
├───────────────────────────────────────────────────────────────────────────┤
│  P2: OBSERVABILITY, STREAMING & SUPPLIER EXPANSION (Scale)                │
│  ├── Live HLS/WebRTC Camera Feed Ingestion (4 Dahab Spots)                │
│  ├── Supplier OS Document KYC & Automated Payouts                         │
│  ├── Distributed Ingestion Workers for Market Intelligence                │
│  └── End-to-End Automated Test Suite (Playwright & Vitest)               │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Phase Breakdown

### Phase P0: Core Data Persistence & Financial Integrity (Estimated: 2-3 Sprints)

1. **Durable Database Implementation**:
   - Establish relational or document persistence for:
     - `Users` & `TravelerProfiles` (multi-tenant auth).
     - `Trips` & `TripItems` (state machine: `DRAFT` → `BOOKED` → `ACTIVE` → `COMPLETED`).
     - `Bookings` & `LedgerEntries` (ACID-compliant double-entry ledger).
     - `Suppliers` & `InventorySlots` (real-time availability locks).

2. **Real Payment Gateway Integration**:
   - Integrate **Paymob / Stripe** with Egyptian EGP and International Card support.
   - Implement real server-side payment intent generation: `POST /api/commerce/pay`.
   - Implement HMAC-SHA256 verified webhook listeners for `PAYMENT_CAPTURED`, `REFUND_PROCESSED`, and `CHARGEBACK`.
   - Enforce database-level unique constraints on `idempotencyKey` to prevent double-charging.

3. **Session & State Decoupling**:
   - Decouple the UI from the single static `Ahmed Mansour` profile.
   - Support anonymous trip creation with guest cookies, upgrading to authenticated profile on checkout.

---

### Phase P1: External Telemetry & Provider Adapters (Estimated: 2 Sprints)

1. **Live Marine & Weather Integration**:
   - Connect `SinaiRadarWidget` and `DahabLiveView` to **OpenWeatherMap One Call API 3.0** & **Stormglass Marine API**.
   - Ingest real wind speed (knots), swell height (meters), and water temperature with a 15-minute background refresh cache.
   - Integrate CDWS safety warnings via structured webhook/RSS parser.

2. **Airport Transfer Telematics**:
   - Connect `/api/transfers/telemetry/:bookingId` to real flight status APIs (e.g. FlightRadar24 / AviationStack) for SSH airport arrivals.
   - Provide mobile driver web-app endpoint for real GPS location pinging.

3. **Automated WhatsApp Notification Queue**:
   - Connect WhatsApp Business API (via Twilio or Meta Cloud API) to send automated pre-arrival briefings, transfer pickup reminders, and morning daily syncs.

---

### Phase P2: Media Streaming & Operational Scale (Estimated: 2 Sprints)

1. **Live Video Camera Ingestion**:
   - Install or partner with local beachfront establishments (Lighthouse, Blue Hole, Laguna, Eel Garden) to provide RTSP/HLS stream URLs.
   - Embed real HTML5/HLS video player in `DahabLiveView.tsx` with fallback camera snapshots.

2. **Automated Market Intelligence Scrapers**:
   - Implement scheduled server-side crawler microservice (using Playwright) to periodically scrape Google Maps reviews and local diving forums, feeding real-time observations into `server.ts`.

3. **E2E Testing & Hardening**:
   - Deploy automated Playwright E2E suites covering the Golden Path: `Search` → `Customize` → `Checkout` → `Day 2 Companion` → `Recovery Rebooking`.
