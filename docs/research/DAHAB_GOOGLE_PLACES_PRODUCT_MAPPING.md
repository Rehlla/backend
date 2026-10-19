# DAHAB GOOGLE PLACES PRODUCT MAPPING SPECIFICATION
**Document ID**: `DOC-RES-2026-MAP-001`  
**Target Systems**: Trip OS, Book Now, DayGI AI, Daily Companion, Supplier OS, Operations Console  
**Standard**: Multi-Surface Feature Enrichment & Commercial Gating Protocol  
**Status**: PRODUCT INTEGRATION SPECIFICATION  

---

## 1. Feature Surface Integration Matrix

Every verified place and geospatial signal discovered through the intelligence harvest is systematically mapped to specific user-facing and operational product modules.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   DISCOVERED GEOSPATIAL INTELLIGENCE                   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
┌────────▼────────┐        ┌────────▼────────┐        ┌────────▼────────┐
│     TRIP OS     │        │    BOOK NOW     │        │     DAYGI AI    │
│  Area Clustering│        │ Instant SKUs    │        │ Context Engine  │
│  Route Buffers  │        │ Direct Payouts  │        │ "I Have 2 Hours"│
└────────┬────────┘        └────────┬────────┘        └────────┬────────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
┌────────▼────────┐        ┌────────▼────────┐        ┌────────▼────────┐
│ DAILY COMPANION │        │   SUPPLIER OS   │        │   OPS CONSOLE   │
│ Post-Dive Food  │        │ Candidate Queue │        │ Conflict Alerts │
│ Sunset Timers   │        │ Direct Dispatch │        │ Freshness Audits│
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

---

## 2. Detailed Mapping by Product Module

### 2.1 Native Trip OS & Trip Builder (`/trip-builder`, `/my-trip`)
- **Area & Day Clustering**: Automatically groups activities by micro-zone (e.g. Day 1: Lighthouse & Mashraba; Day 2: Canyon & Blue Hole; Day 3: Wadi Gnai & Three Pools) to eliminate unnecessary 4x4 transit across town.
- **Micro-Transit Buffers**: Injects realistic multi-modal transit times (walking vs. 4x4 pickup vs. speedboat) between consecutive itinerary slots using cached route estimates.
- **Shore Entry & Gear Warnings**: Generates customized packing checklists (e.g. "Hard-soled boots required for The Bells", "2L bottled water for Abu Galum") based on the specific reefs selected.

### 2.2 Book Now Commerce Engine (`/book-now`, `QuickBookingModal`)
- **Commercial Classification**: Places are assigned strict commercial tiers:
  - `BOOK_NOW`: Fully integrated live inventory SKU with online payment hold and automated supplier dispatch.
  - `REQUEST_NOW`: High-demand expedition requiring manual Bedouin guide availability check (max 15 min confirmation).
  - `WALK_IN`: Recommended local spot with zero pre-payment required (e.g. local bakeries, tea terraces).
  - `DISCOVER_ONLY`: Protected natural sites with municipal ticket requirements.
- **Transparent Price Anchoring**: Displays fair, uninflated local price ranges in Egyptian Pounds (EGP) with zero hidden markups.

### 2.3 DayGI Intelligent Concierge (`/daygi`, `DayGiConciergeView`)
- **"I Have Two Hours" Engine (`عندي ساعتين`)**: Dynamically slices available traveler time into micro-adventures using formula:
  $$\text{Window} \ge \text{Transit One-Way} + \text{Activity Duration} + \text{Safety Buffer (15m)} + \text{Return Transit}$$
- **Natural Language Grounding**: Empowers DayGI to answer hyper-local questions in Egyptian Arabic or English (e.g. *"أقرب مكان سمك سنجاري طازة مشي من اللايتهاوس"* or *"Where can I rent a 150cc scooter near Assalah square?"*).

### 2.4 Daily Companion & Spontaneous Mode (`/food`, `/change-recovery`, `WhatShouldIDoNowView`)
- **Post-Activity Food Proximity**: Automatically suggests top 3 vetted eateries within 5 minutes walking distance when a traveler finishes a dive or safari.
- **Sunset Orientation Engine**: Recommends the optimal sunset spot based on current zone:
  - *Sea Sunset*: Laguna Spit or Blue Lagoon.
  - *Desert Granite Sunset*: Wadi Gnai or St. Catherine.
  - *Social Promenade Sunset*: Lighthouse & Mashraba candlelit terraces.

### 2.5 Supplier OS & Operations Console (`/operations`, `/supplier`)
- **Discovery Candidate Ingestion**: Discovered businesses that pass field verification appear in the Ops Console as `Candidate Suppliers` for 1-click onboarding.
- **Conflict & Stale Status Detection**: Automatically flags venue closures, coordinate mismatches, or phone number changes detected during periodic Google Places reconciliation.
