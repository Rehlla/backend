# Dahab Homepage — Lifecycle Section Matrix
**Deterministic Section Eligibility & Rendering Rules**  
*August 2026*

---

## 1. Section Eligibility & Evaluation Table

| Section ID | Component | Evaluated Lifecycle Conditions | Evaluated Stage (`journeyStage`) | Eligibility State | Hide Reason (When Hidden) |
|---|---|---|---|---|---|
| `cinematic-hero` | `CinematicVideoHero` | `DISCOVERY`, `BOOKING` | `discover` | **VISIBLE** (Primary in Discover) | Suppressed post-booking to prioritize live trip operations and flight/check-in readiness. |
| `trip-entry` | `TripEntrySection` | `DISCOVERY`, `BOOKING` | `discover`, `plan`, `preview` | **VISIBLE** (Primary in Planning) | Trip already booked or active; replaced by live itinerary cockpit. |
| `in-transit-tracker` | `InTransitTrackerCard` | `IN_TRANSIT` | `arrive` (Transfer active) | **VISIBLE** (Primary in Transit) | Active only when transfer shuttle telemetry is live. |
| `pre-arrival-prep` | `PreArrivalPrepCard` | `PRE_TRIP` | `prepare` | **VISIBLE** (Primary in Prep) | Relevant only in the 24–48 hours prior to departure. |
| `early-arrival-hub` | `EarlyArrivalHubCard` | `ARRIVAL` | `arrive` | **VISIBLE** (Primary in Arrival) | Active only during arrival and hotel check-in gap. |
| `active-activity-cockpit` | `ActiveActivityCockpitCard` | `ACTIVE_TRIP` | `experience` (Free window < 45m) | **VISIBLE** (Primary in Activity) | Traveler is currently submerged or in mountain transit. |
| `what-now` | `WhatShouldIDoNowWidget` | `IN_DAHAB`, `POST_ACTIVITY`, `ARRIVAL` | `experience`, `spontaneous`, `food` | **VISIBLE** (Primary in In-Dahab) | Requires traveler to be physically present in destination. |
| `week-companion` | `DahabWeekCompanionDeck` | `PRE_TRIP`, `IN_DAHAB`, `ACTIVE_TRIP` | `preview`, `prepare`, `experience` | **VISIBLE** (Secondary) | No confirmed itinerary items in discovery state. |
| `sinai-radar` | `SinaiRadarWidget` | All except `POST_TRIP` | All except `post_trip` | **VISIBLE** (Secondary) | Trip finished; marine wind and tide radar no longer needed. |
| `spatial-map` | `DahabSpatialContextMap` | `DISCOVERY`, `IN_DAHAB`, `POST_ACTIVITY` | `discover`, `plan`, `experience` | **VISIBLE** (Secondary) | Suppressed during Disruption/Departure to focus on resolution. |
| `curated-stories` | `CuratedStoriesRail` | `DISCOVERY` | `discover` | **VISIBLE** (Secondary) | Suppressed during live trip to avoid information overload. |
| `gallery` | `DahabGallerySection` | `DISCOVERY`, `POST_TRIP` | `discover`, `post_trip` | **VISIBLE** (Secondary) | Suppressed during active operational hours in Dahab. |
| `ai-assistant` | `AiTravelAssistant` | `DISCOVERY`, `IN_DAHAB`, `POST_TRIP`, `HELP` | `discover`, `plan`, `help`, `experience` | **VISIBLE** (Secondary) | Always available on demand in help & planning modes. |
| `recovery-spotlight` | `RecoverySpotlightCard` | `DISRUPTED` | `recovery` | **VISIBLE** (Primary in Disruption) | Active only when weather, boat, or supplier issue is detected. |
| `departure-hub` | `DepartureHubCard` | `DEPARTURE` | `departure` | **VISIBLE** (Primary in Departure) | Active only on departure day. |
| `post-trip-hub` | `PostTripHubCard` | `POST_TRIP` | `post_trip` | **VISIBLE** (Primary in Post-Trip) | Active only after trip is concluded. |
| `quick-services` | Quick Services & Emergency Dock | All except `POST_TRIP` | All | **VISIBLE** (Secondary) | Not required post-trip. |

---

## 2. Content Budget & Priority Verification

1. **DISCOVERY Mode**:
   - **Primary (1)**: `cinematic-hero`
   - **Secondary (4)**: `trip-entry`, `sinai-radar`, `curated-stories`, `spatial-map`
   - **NBA (1)**: "Plan My Dahab"
2. **PRE_TRIP Mode**:
   - **Primary (1)**: `pre-arrival-prep`
   - **Secondary (3)**: `sinai-radar`, `week-companion`, `quick-services`
   - **NBA (1)**: "Verify Packing & Shuttle"
3. **IN_TRANSIT Mode**:
   - **Primary (1)**: `in-transit-tracker`
   - **Secondary (2)**: `sinai-radar`, `quick-services`
   - **NBA (1)**: "Contact Driver Mahmoud"
4. **ARRIVAL Mode**:
   - **Primary (1)**: `early-arrival-hub`
   - **Secondary (3)**: `what-now`, `sinai-radar`, `quick-services`
   - **NBA (1)**: "Drop Luggage & Get Breakfast"
5. **IN_DAHAB Mode**:
   - **Primary (1)**: `what-now`
   - **Secondary (4)**: `week-companion`, `sinai-radar`, `spatial-map`, `quick-services`
   - **NBA (1)**: "Afternoon Snorkel / Dinner Booking"
6. **ACTIVE_ACTIVITY Mode**:
   - **Primary (1)**: `active-activity-cockpit`
   - **Secondary (2)**: `week-companion`, `sinai-radar`
   - **NBA (1)**: "Activity Route & Next Rendezvous"
7. **DISRUPTED Mode**:
   - **Primary (1)**: `recovery-spotlight`
   - **Secondary (2)**: `sinai-radar`, `quick-services`
   - **NBA (1)**: "Select Protected Reef Alternative"
8. **DEPARTURE Mode**:
   - **Primary (1)**: `departure-hub`
   - **Secondary (2)**: `sinai-radar`, `quick-services`
   - **NBA (1)**: "Review Shuttle & Boarding Pass"
9. **POST_TRIP Mode**:
   - **Primary (1)**: `post-trip-hub`
   - **Secondary (2)**: `gallery`, `ai-assistant`
   - **NBA (1)**: "Download Tax Invoice & Photos"
