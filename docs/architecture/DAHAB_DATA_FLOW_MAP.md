# DAHAB PLATFORM — DATA FLOW & LIFECYCLE MAP
**Standard:** Enterprise Flow Architecture & Event Routing (August 2026)

---

## 1. End-to-End Data Flow Architecture

```
+-----------------------------------------------------------------------------------+
|                              1. INGRESS & CONTEXT                                 |
|                                                                                   |
|  [ Anonymous Visitor ]               [ Authenticated Traveler / Demo ]            |
|          |                                          |                             |
|          v                                          v                             |
|  +-----------------------------------------------------------------------------+  |
|  |             travelerLifecycleResolver: deriveTravelerLifecycle()             |  |
|  |   Checks: isAuthenticated, hasBookings, isTestMode, timeInDestination       |  |
|  +-----------------------------------------------------------------------------+  |
|          |                                          |                             |
|          | Phase: DISCOVERY                         | Phase: PRE_TRIP / IN_DAHAB  |
|          v                                          v                             |
+----------|------------------------------------------|-----------------------------+
           |                                          |
           v                                          v
+-----------------------+                  +----------------------------------------+
| 2. DISCOVERY SURFACE  |                  | 3. ACTIVE TRIP SURFACE                 |
|                       |                  |                                        |
| * Hero Header         |                  | * Next Best Action Engine              |
| * Interactive Builder |                  | * Daily Timeline Companion             |
| * Ready Trips (5 pkg) |                  | * Live Weather Radar                   |
| * Curated Dive Sites  |                  | * Verified Voucher Cards               |
| * Transparent Catalog |                  | * In-Destination Book Now              |
+-----------------------+                  +----------------------------------------+
           |                                          |
           | Selects & Customizes                     | Requests On-Demand Service
           v                                          v
+-----------------------------------------------------------------------------------+
|                             4. COMMERCE ENGINE FLOW                               |
|                                                                                   |
|  [ User Initiates Booking / Instant Cart ]                                        |
|          |                                                                        |
|          v                                                                        |
|  [ Inventory Hold Validation (15 min TTL) ]                                       |
|          |                                                                        |
|          v                                                                        |
|  [ Double-Entry Ledger Entry: Debit Traveler / Credit Platform Escrow ]          |
|          |                                                                        |
|          v                                                                        |
|  [ Booking Entity Created & Persisted to Backend DB ]                             |
|          |                                                                        |
|          v                                                                        |
|  [ Notification Dispatched to Supplier + Driver Telemetry Initialized ]          |
|          |                                                                        |
|          v                                                                        |
|  [ Real-time Update: TripContext.bookings & Active Day Timeline ]                 |
+-----------------------------------------------------------------------------------+
```

---

## 2. Dynamic Lifecycle Transitions

1. **Anonymous / Discovery (`DISCOVERY`):**
   - Clean profile (`ANONYMOUS_PROFILE`), zero bookings.
   - Next Best Actions: "Build Custom Dahab Itinerary" & "Explore 5 Tested Dahab Ready-Made Programs".
   - Zero private data rendered.
2. **Pre-Booking (`PRE_BOOKING` / `PLANNING`):**
   - Authenticated user selecting services or reviewing saved trips.
   - Live availability checks against backend inventory slots.
3. **Confirmed Pre-Trip (`PRE_TRIP`):**
   - Active bookings present, departure date in future.
   - Next Best Action: "Pre-Arrival Briefing Ready" + packing checklist + driver tracking status.
4. **Active In-Destination (`IN_DAHAB`):**
   - Active day companion mode (e.g. Day 2: Coral Canyon Dive + Bedouin Dinner).
   - In-destination commerce modal (`BookNowCommerceModal`) enabled for instant gear/activities.
5. **Post-Trip Review (`POST_TRIP`):**
   - Completed bookings, memory album, trip rating and feedback submission.
