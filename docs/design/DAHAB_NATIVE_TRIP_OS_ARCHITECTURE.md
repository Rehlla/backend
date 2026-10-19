# Dahab Native Trip OS — Architecture & Engine Specifications

## 1. Architectural Principles

The Dahab Native Trip OS is architected as an **Offline-Resilient, Geography-Aware Client & Server System** built for South Sinai operations.

```
+-------------------------------------------------------------------------+
|                       DAHAB NATIVE TRIP OS (V2.4)                       |
+-------------------------------------------------------------------------+
| [Traveler Experience Layer]                                             |
|  - MyTripView (Dynamic 5-Day Master Timeline & Auditor)                 |
|  - WhatShouldIDoNowView (Contextual Decision & Spontaneous Engine)     |
|  - FoodNowView (Walking Proximity & Cuisine Engine)                     |
|  - DailyCompanionDay2View (Live Companion & Schedule Tracking)          |
|  - AiDirectorView (Natural Language Re-planning & Chat Interface)       |
|  - ChangeAndRecoveryView (Disruption Handling & Auto-Reschedule)        |
+-------------------------------------------------------------------------+
| [Dahab Local Intelligence Services & Engines]                           |
|  - dahabLocalEngine.ts                                                  |
|    * Food Proximity Engine (walkingMinutesFromReefs)                    |
|    * Environmental & Ocean Suitability (Wind, Vis, Swell, Heat)         |
|    * Day Rhythm & Intensity Engine (Anchor, Supporting, Buffer)         |
|    * Conflict & Decompression Safety Detector (DAN 24h Buffer Rule)     |
|    * Offline Trip Pack Generator (Authoritative JSON & Print Format)    |
|    * Trip Fit 2.0 Engine (7 Transparent Weighted Dimensions)            |
+-------------------------------------------------------------------------+
| [Authoritative Ground Truth Data Layer]                                 |
|  - dahabGeography.ts (Places, Entry Dynamics, Constraints, Reserves)   |
|  - dahabContext.ts (TypeScript Interfaces & Domain Schemas)             |
|  - sampleTripData.ts (Traveler Context & Master Itinerary)              |
+-------------------------------------------------------------------------+
| [Sinai Ground & Operations Integration Layer]                           |
|  - Verified Sinai Provider Directory & Hyperbaric Emergency Desk        |
|  - Offline Storage & Sync Engine (PWA Local Cache & Printable Snapshot)|
+-------------------------------------------------------------------------+
```

---

## 2. Core Service Modules

### 2.1. Food Proximity Engine (`getNearbyFoodAfterActivity`)
- Computes walking distance in minutes from any Dahab reef entry/exit point.
- Considers dietary preferences, budget tiers, and post-activity state (e.g. hot tea and hearty carb meals after cold open-water dives).

### 2.2. Environmental Suitability Evaluator (`evaluateActivityConditionSuitability`)
- Evaluates real-time or verified weather telemetry against strict threshold tables:
  - Kite/Wind: Optimal 15–28 kts at Laguna; Unsuitable <10 kts.
  - Deep Dive: Optimal visibility >=25m; Moderate swell tolerance.
  - Marine Transfer: Ras Abu Galum boat flagged as *Marginal Swell Risk* if wind >22 kts after 02:30 PM.
- Adheres to the **Provenance Freshness Mandate**: If telemetry is older than 4 hours, it flags as *Requires Local Confirmation* and provides direct contact lines for local dive marshals rather than fabricating synthetic data.

### 2.3. Conflict & Decompression Safety Detector (`detectDahabConflicts`)
- **DAN Diving Pre-Flight Rule**: Strictly flags any dive scheduled on departure day or <18–24 hours before flight from SSH.
- **Remote Lagoon Departure Risk**: Flags afternoon boat returns on departure day due to weather vulnerability.
- **Early Arrival Check-in Gap**: Identifies morning arrivals before 02:00 PM check-in and triggers the *First 2 Hours Early Arrival Rescue Plan*.

### 2.4. Offline Trip Pack Payload (`buildDahabOfflineTripPack`)
- Generates a standalone, deterministic JSON and printable PDF snapshot containing:
  - Master itinerary with trail access methods and terrain markers.
  - Booking confirmation vouchers with provider direct mobile numbers.
  - 24/7 Hyperbaric Chamber (`+20 69 364 0536`) & Sinai Ambulance (`123`).
  - Cash and checkpoint preparation checklist.

---

## 3. Localization & Dual-Language Architecture

All data structures, badges, reasoning engines, and UI cards natively support **Egyptian Arabic (لهجة مصرية سيناوية طبيعية)** and **English**:
- Cultural terms preserved (*روقان*, *شلتات*, *قعدة بدوية*, *قبطان*, *ممشى اللايتهاوس*).
- Directional and temporal terminology adapted accurately for Sinai geography (North Reefs vs South Bays vs Off-grid Reserves).
