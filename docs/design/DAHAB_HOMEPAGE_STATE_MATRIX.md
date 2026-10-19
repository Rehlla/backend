# DAHAB HOMEPAGE STATE MATRIX
**Source of Truth: Section Eligibility, Priority, and Visibility Across the 12 Journey Stages**
*Generated directly from the Dahab Travel Operating System state graph.*

---

## 1. Core State Matrix

| Section ID | Section Component | discover | plan | preview | prepare | arrive | experience | spontaneous | food | recovery | help | departure | post_trip |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `next-best-action` | `NextBestActionBanner` | CONDITIONAL (Tip) | CONDITIONAL (Plan) | CONDITIONAL (Book) | VISIBLE (Prep) | VISIBLE (Arrival) | VISIBLE (Now) | VISIBLE (Free 2h) | VISIBLE (Meal) | VISIBLE (Recovery) | VISIBLE (Triage) | VISIBLE (Checkout) | VISIBLE (Review) |
| `hero-cockpit` | `CinematicVideoHero` | VISIBLE | CONDITIONAL (Min) | CONDITIONAL (Min) | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN |
| `trip-entry` | `TripEntrySection` | VISIBLE | VISIBLE | CONDITIONAL (Draft) | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN |
| `sinai-radar` | `SinaiRadarWidget` | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | HIDDEN | VISIBLE | VISIBLE | CONDITIONAL | HIDDEN |
| `what-now` | `WhatShouldIDoNowWidget` | HIDDEN | HIDDEN | HIDDEN | HIDDEN | CONDITIONAL | VISIBLE | VISIBLE (Dominant)| CONDITIONAL | HIDDEN | HIDDEN | HIDDEN | HIDDEN |
| `week-companion` | `DahabWeekCompanionDeck` | CONDITIONAL | CONDITIONAL | VISIBLE | VISIBLE | VISIBLE | VISIBLE | CONDITIONAL | CONDITIONAL | CONDITIONAL | CONDITIONAL | CONDITIONAL | HIDDEN |
| `curated-stories` | `CuratedStoriesRail` | VISIBLE | CONDITIONAL | CONDITIONAL | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | CONDITIONAL |
| `gallery` | `DahabGallerySection` | VISIBLE | CONDITIONAL | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | VISIBLE (Memories)|
| `spatial-map` | `DahabSpatialContextMap` | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | CONDITIONAL | CONDITIONAL | CONDITIONAL | HIDDEN |
| `ai-assistant` | `AiTravelAssistant` | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE |
| `quick-services` | `QuickServicesGrid` | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | CONDITIONAL | VISIBLE (SOS) | CONDITIONAL | CONDITIONAL |
| `active-booking-alert` | `ActiveBookingAlert` | HIDDEN | HIDDEN | HIDDEN | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE | VISIBLE (Urgent) | VISIBLE | VISIBLE (Shuttle) | HIDDEN |
| `pre-arrival-prep` | `PreArrivalPrepCard` | HIDDEN | HIDDEN | HIDDEN | VISIBLE (Dominant)| HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN |
| `early-arrival-hub` | `EarlyArrivalHubCard` | HIDDEN | HIDDEN | HIDDEN | HIDDEN | VISIBLE (Dominant)| HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN |
| `recovery-spotlight` | `RecoverySpotlightCard` | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | VISIBLE (Dominant)| HIDDEN | HIDDEN | HIDDEN |
| `departure-hub` | `DepartureHubCard` | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | VISIBLE (Dominant)| HIDDEN |
| `post-trip-hub` | `PostTripHubCard` | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | HIDDEN | VISIBLE (Dominant)|

---

## 2. Deterministic Section Reasons Across Stages

### 2.1. Discovery (`discover`)
- **Primary Goal**: Spark excitement, explain Dahab's authentic vibe, offer 4 distinct curated tracks.
- **Visible**: `hero-cockpit` (Inspiration), `trip-entry` (Intent builder), `curated-stories`, `gallery`, `spatial-map`, `sinai-radar`.
- **Hidden**: `active-booking-alert`, `pre-arrival-prep`, `early-arrival-hub`, `recovery-spotlight`, `departure-hub`.
- **Reason**: Traveler has no trip yet; tactical operational widgets would create cognitive clutter.

### 2.2. Planning (`plan`)
- **Primary Goal**: Guide itinerary customization, budget pacing, interest selection.
- **Visible**: `trip-entry` (Wizard focus), `sinai-radar` (Seasonal condition matching), `spatial-map`.
- **Hidden**: In-destination live tactical tools, recovery, departure.

### 2.3. Preview (`preview`)
- **Primary Goal**: Review 5-day proposed timeline, review costs, trigger instant booking holds.
- **Visible**: `week-companion` (Timeline review), `next-best-action` ("Lock your Dahab package"), `spatial-map`.

### 2.4. Preparation (`prepare` - 24 Hours Pre-Arrival)
- **Primary Goal**: Airport transfer details, packing list, wind/tide forecast, SIM card advice.
- **Visible**: `pre-arrival-prep` (Dominant card), `active-booking-alert` (SSH transfer confirmation), `sinai-radar`.
- **Hidden**: Generic inspirational hero, photo gallery.

### 2.5. Arrival (`arrive` - Day 1 Early Arrival)
- **Primary Goal**: Luggage drop-off hubs, 2-hour café relaxation guide, check-in countdown.
- **Visible**: `early-arrival-hub` (Dominant card), `active-booking-alert` (Ali Baba check-in 14:00), `next-best-action` ("Drop bags at Lighthouse Hub").
- **Hidden**: Generic pre-trip planning forms.

### 2.6. In-Destination Live Companion (`experience` - Day 2 Onwards)
- **Primary Goal**: Real-time contextual companion ("Dahab Now"), upcoming activity countdown, quick Book Now actions.
- **Visible**: `next-best-action` (P0 actionable card), `what-now` (Instant 3-step decision flow), `week-companion`, `sinai-radar`, `spatial-map`.
- **Hidden**: Pre-trip hero, trip planner entry.

### 2.7. Spontaneous Free-Time (`spontaneous` - "I have 2 hours")
- **Primary Goal**: High-probability recommendations for immediate unbooked windows.
- **Visible**: `what-now` (Dominant card), `next-best-action` ("Grab Bedouin tea at Lighthouse"), `spatial-map` (Walkable spots within 15 mins).

### 2.8. Food & Dining (`food`)
- **Primary Goal**: Contextual breakfast, beachside lunch, or seafood dinner recommendations with verified payment methods.
- **Visible**: `what-now` (Culinary highlights), `spatial-map` (Restaurant cluster), `quick-services` (Beach delivery shortcut).

### 2.9. Change & Recovery (`recovery`)
- **Primary Goal**: Reconcile weather disruption or cancelled activity with 3 instant alternatives.
- **Visible**: `recovery-spotlight` (Dominant P0 emergency alternative selector), `active-booking-alert` ("Dive rescheduled due to 22kt wind").
- **Hidden**: All leisure discovery, photo galleries, marketing rails.

### 2.10. Help & Support (`help`)
- **Primary Goal**: 24/7 emergency dispatch, hyperbaric doctor hotline, hotel concierge triage.
- **Visible**: `next-best-action` (Emergency contacts), `quick-services` (SOS action card), `ai-assistant`.

### 2.11. Departure Day (`departure`)
- **Primary Goal**: Hotel checkout checklist, SSH airport transfer countdown, flight timing.
- **Visible**: `departure-hub` (Dominant card), `active-booking-alert` (Van driver pickup 15:30), `next-best-action` ("Confirm airport checkout").
- **Hidden**: Multi-day trip planners, dive package marketing.

### 2.12. Post-Trip (`post_trip`)
- **Primary Goal**: Review ratings, photo memories archive, itemized tax invoice download, future return discount.
- **Visible**: `post-trip-hub` (Dominant review card), `gallery` (Memory photo stream), `next-best-action` ("Download Trip Invoice").

---

## 3. Content Budget Rules

| Mode | Max Primary Sections | Max Secondary Sections | Max Total Rendered Sections |
|---|---|---|---|
| `DISCOVERY` | 1 (`hero-cockpit`) | 3 (`trip-entry`, `sinai-radar`, `curated-stories`) | 6 |
| `PLANNING` | 1 (`trip-entry`) | 2 (`sinai-radar`, `spatial-map`) | 4 |
| `PREPARING` | 1 (`pre-arrival-prep`) | 2 (`active-booking-alert`, `sinai-radar`) | 4 |
| `ARRIVAL` | 1 (`early-arrival-hub`) | 2 (`active-booking-alert`, `what-now`) | 4 |
| `IN_DESTINATION`| 1 (`next-best-action`) | 3 (`what-now`, `week-companion`, `sinai-radar`) | 5 |
| `SPONTANEOUS` | 1 (`what-now`) | 2 (`next-best-action`, `spatial-map`) | 4 |
| `RECOVERY` | 1 (`recovery-spotlight`)| 1 (`active-booking-alert`) | 3 |
| `DEPARTURE` | 1 (`departure-hub`) | 2 (`active-booking-alert`, `sinai-radar`) | 4 |
| `POST_TRIP` | 1 (`post-trip-hub`) | 2 (`gallery`, `ai-assistant`) | 4 |
