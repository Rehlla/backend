# Dahab Traveler Lifecycle Composition Model
**Architecture Specification & State Integration Guide**  
*Version 2.4 — August 2026*

---

## 1. Executive Overview & Core Principle

The Dahab Homepage Composition Architecture integrates two complementary, non-competing state dimensions:
1. **`journeyStage`** (12 Authoritative Operational Stages): `discover`, `plan`, `preview`, `prepare`, `arrive`, `experience`, `spontaneous`, `food`, `recovery`, `help`, `departure`, `post_trip`.
2. **`TravelerLifecyclePhase`** (Real-World Traveler Position): `DISCOVERY`, `BOOKING`, `PRE_TRIP`, `IN_TRANSIT`, `ARRIVAL`, `IN_DAHAB`, `ACTIVE_TRIP`, `DISRUPTED`, `DEPARTURE`, `POST_TRIP`.

The homepage composition resolves naturally according to the **Real Traveler Reality Hierarchy**:

```
TravelerContext
      ↓
TravelerLifecyclePhase
      ↓
journeyStage
      ↓
Context Flags & Signals (Location, Booking, Time, Disruption)
      ↓
Section Eligibility (VISIBLE, CONDITIONAL, DEFERRED, HIDDEN)
      ↓
Priority Ranking & Content Budgeting (1 Primary, 2-4 Secondary, 1 NBA)
      ↓
Deduplication
      ↓
Fluid Render (Zero Page Reloads)
```

---

## 2. Real-World Lifecycle Matrix

| Lifecycle Phase | Primary Story & Emotional Anchor | What is Visible | What is Hidden / Suppressed | Canonical CTA |
|---|---|---|---|---|
| **`PRE_BOOKING` / `DISCOVERY`** | **"Plan Your Dahab"** | Cinematic Hero, Trip Entry Track Selector, Curated Stories, Sinai Radar, Gallery | Active Trip Cockpits, Transit Telemetry, Departure Hub, Post-Trip Hub | "Build My Dahab" / "Choose a Track" |
| **`BOOKING` / `PLANNING`** | **"Select & Customize"** | Trip Entry Track Selector, Sinai Spatial Map, Radar, AI Assistant | Live in-destination tactical cards | "Lock & Confirm Track" |
| **`PRE_TRIP`** | **"Your Trip is Being Prepared"** | Confirmed Bookings, Countdown Timer, Pre-Arrival Checklist, Packing Guide, DayGI Briefing | Generic Trip Discovery, repeated builder CTAs | "View Pre-Arrival Checklist" |
| **`IN_TRANSIT`** | **"You Are on Your Way"** | Live Highway Shuttle Telemetry, Driver Mahmoud Contact, Arrival Weather, First 2h Briefing | Broad discovery grids, multi-day builder forms | "Track Arrival & Call Driver" |
| **`ARRIVAL`** | **"Welcome to Dahab"** | Arrival & First 2 Hours Hub, Luggage Drop, Hotel Check-In Gap, Low-effort Breakfast | Planning-heavy builders, generic discovery | "Open First 2 Hours Plan" |
| **`IN_DAHAB`** | **"Dahab Live OS — What Matters Now"** | Next Best Action, What Should I Do Now (Time-of-day), Near Me, Food Now, Sinai Radar, Spatial Map | Long-form marketing hero, early pre-trip forms | "Build Next 3 Hours" / "Book Slot" |
| **`ACTIVE_TRIP`** | **"Live Activity Cockpit"** | Current Activity Status, Dive Guide Protocol, Countdown, Pickup Route, Safety Badge | Broad discovery, unrelated commercial offers | "View Activity Route & Safety" |
| **`POST_ACTIVITY`** | **"What Can I Do Nearby?"** | Post-Dive Hydration, Seafront Food Tagines, Habak Bedouin Tea, Spontaneous 2-Hour Slots | Planning tools, pre-booking discovery | "Order Beachside Food" |
| **`DISRUPTED`** | **"What Changed? We Will Fix This"** | Disruption Cause (e.g., 24kt wind), Instant Alternative Slots, Price/Time Delta, Re-booking | Normal discovery grids, non-urgent widgets | "Accept 1-Tap Alternative Slot" |
| **`DEPARTURE`** | **"Let's Get You Home"** | Checkout Timing, Luggage Hold, Airport Shuttle Pickup, Departure Flight Boarding Checklist | Multi-day trip builders, discovery inspiration | "Review Departure Route" |
| **`POST_TRIP`** | **"Keep the Memory"** | Photo Memory Book, Consolidated EGP Tax Invoice, Supplier Reviews, Saved Places | Live travel ops, departure checklists | "Download Tax Invoice & Review" |

---

## 3. Location, Booking & Time Context Signal Derivation

### Location Context Classification
- **`UNKNOWN`**: Anonymous traveler or GPS disabled (fallback to discovery baseline).
- **`OUTSIDE_DAHAB`**: Pre-booking and pre-trip planning phase.
- **`APPROACHING_DAHAB`**: Active transfer vehicle on Sharm-Dahab or Cairo-Dahab corridor ($>0.90$ confidence).
- **`ARRIVED_DAHAB`**: Hotel check-in or arrival geo-fence trigger.
- **`IN_DAHAB`**: Active stay within Lighthouse, Eel Garden, Laguna, Masbat, or Masraba.
- **`LEAVING_DAHAB`**: Departure transfer active to SSH airport or bus depot.

### Booking Context Classification
- `NO_BOOKING` $\rightarrow$ `PLANNING` $\rightarrow$ `HOLD_ACTIVE` $\rightarrow$ `BOOKING_CONFIRMED` $\rightarrow$ `SUPPLIER_PENDING` $\rightarrow$ `BOOKING_FAILED` $\rightarrow$ `RECOVERY_REQUIRED` $\rightarrow$ `COMPLETED`.

### Time Context Classification
- `BEFORE_TRIP`
- `EARLY_MORNING` (05:00 – 08:00): Sunrise climbs, calm water prep.
- `MORNING` (08:00 – 12:00): Coral reef snorkel, fresh bakery breakfasts.
- `MIDDAY` (12:00 – 15:00): Shaded lagoon palapas, kitesurf observation, seafood tagines.
- `AFTERNOON` (15:00 – 17:00): Coral canyon dives, freediving breathwork.
- `SUNSET` (17:00 – 19:00): Habak Bedouin tea on Lighthouse seafront carpets.
- `EVENING` (19:00 – 23:00): Candlelight grilled catch, Wadi Gnai campfire.
- `LATE_NIGHT` (23:00+): Acoustic beachfront chill, stargazing.

---

## 4. Deduplication & Content Budget Enforcement

The engine strictly enforces:
1. **Single Primary Anchor**: Exactly 1 prominent stage hero card.
2. **Budgeted Secondary Surfaces**: Maximum 2 (during Disruption/Departure) to 4 (during Discovery/In-Dahab).
3. **Single Canonical Next Best Action (NBA)**: Rendered in the top contextual banner; never redundantly echoed across cards.
4. **Fluid Transitions**: Modifying lifecycle updates component props and rendering flags without full-page reloads.
