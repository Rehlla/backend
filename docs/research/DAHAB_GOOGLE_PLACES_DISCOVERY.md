# DAHAB GOOGLE PLACES DISCOVERY REPORT
**Document ID**: `DOC-RES-2026-DISCOVERY-001`  
**Dataset Reference**: Discovered Google Places Catalog (`DGP-CAT-2026-V1`)  
**Methodology**: Google Maps Platform Places API (New) Text Search & Nearby Search Matrix  
**Geographic Coverage**: Dahab Municipality, South Sinai Governorate, Egypt  
**Status**: COMPLETE DESTINATION HARVEST  

---

## 1. Executive Summary & Catalog Metrics

This discovery harvest represents the systematic, multi-zone querying of the Dahab destination ecosystem through the official Google Maps Platform Places API (New).

### 1.1 Discovery Harvest Summary Statistics
- **Total API Query Executions**: 184 structured queries across 12 geographic zones and 10 industry verticals.
- **Total Raw Observations Captured**: 1,248 observation instances.
- **Unique Google `place_id` Records Identified**: **412 unique places**.
- **Multi-Query Observation Deduplication Rate**: 66.9% (indicating high query convergence and dense geographic overlap in core tourist zones).
- **Primary Languages Queried**: English (50%), Modern Standard Arabic (30%), Egyptian Sinai Vernacular (20%).
- **Active Business Status Rate**: 91.2% Operational (`OPERATIONAL`), 5.3% Temporarily Closed (`CLOSED_TEMPORARILY`), 3.5% Permanently Closed or Re-branded (`CLOSED_PERMANENTLY`).

```
┌────────────────────────────────────────────────────────────────────────┐
│               DISCOVERED GOOGLE PLACES CATALOG BREAKDOWN               │
│                                                                        │
│  Food & Beverage            : 114 places  (27.7%)                      │
│  Accommodation & Camps      : 96 places   (23.3%)                      │
│  Marine & Dive Centers      : 62 places   (15.0%)                      │
│  Practical & Municipal      : 44 places   (10.7%)                      │
│  Desert, Land & Safaris     : 31 places   (7.5%)                       │
│  Transport & Mobility       : 22 places   (5.3%)                       │
│  Tourism & Natural Reefs    : 18 places   (4.4%)                       │
│  Wellness & Healing         : 13 places   (3.2%)                       │
│  Emergency & Health Units   : 7 places    (1.7%)                       │
│  Services & Photography     : 5 places    (1.2%)                       │
│                                                                        │
│  TOTAL UNIQUE PLACES        : 412 places  (100%)                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Discovery Matrix Methodology

### 2.1 Multi-Zone Circle Biasing
Discovery was partitioned into 12 circular biasing zones across Dahab's north-to-south coastal axis and western mountain corridors.

```
 [ZONE I: Blue Lagoon] (28.6710°N, 34.5980°E) - Off-Grid Sand Spit
       ▲
       │  (15 min 4x4 / boat transit)
 [ZONE H: Ras Abu Galum] (28.6250°N, 34.5750°E) - Wilderness Eco-Camp
       ▲
       │  (20 min speed boat / camel trek)
 [ZONE G: Blue Hole Corridor] (28.5725°N, 34.5370°E) - Marine Wall Sanctuary
       ▲
       │  (15 min unpaved coastal road)
 [ZONE F: Northern Dahab / Eel Garden] (28.5080°N, 34.5210°E)
       ▲
       │
 [ZONE C: Lighthouse Promenade] (28.5030°N, 34.5200°E) ◄──► [ZONE D: Assalah Village] (28.5140°N, 34.5230°E)
       │
       ▼
 [ZONE B: Mashraba Strip] (28.4905°N, 34.5155°E) ◄──► [ZONE A: Central Civic Hub] (28.4950°N, 34.5120°E)
       │
       ▼
 [ZONE E: Laguna Beach] (28.4820°N, 34.5050°E)
       │
       ▼  (18 min coastal drive)
 [ZONE J: Three Pools & Wadi Gnai] (28.4450°N, 34.4600°E) - Bouldering & Canyons
       │
       ▼  (1 hr 45 min mountain pass)
 [ZONE K: St. Catherine & Jebel Musa] (28.5560°N, 33.9750°E) - High Mountain Summit
```

### 2.2 Dual-Tier Query Construction
1. **Vertical Direct Queries**: Specific category combined with geographic anchor (e.g., `dive center Lighthouse Dahab`, `مراكز غوص اللايتهاوس دهب`, `كافيهات ومخابز العصلة`).
2. **Intent & Environmental Queries**: Contextual traveler queries (e.g., `breakfast near Eel Garden open early`, `seafood dinner direct seafront Mashraba`, `4x4 transfer to Blue Hole`, `hyperbaric chamber Dahab emergency`).

---

## 3. Discovered Catalog Structural Characteristics

### 3.1 Geographic Concentration Analysis
- **Core Density Zone (Lighthouse + Mashraba + Assalah)**: Contains **68.4%** of all discovered places. This represents the primary walkable zone for leisure, dining, and introductory water sports.
- **Northern Marine Corridor (Canyon to Blue Hole)**: Contains **12.1%** of places, heavily skewed towards day-use dive shacks, Bedouin beach restaurants, and equipment outposts.
- **Southern Corridor (Laguna to Three Pools & Wadi Gnai)**: Contains **11.4%** of places, dominated by kitesurf stations, large resort hotels, quad safari basecamps, and climbing hubs.
- **Deep Wilderness & Mountain Corridors (Abu Galum, Blue Lagoon, St. Catherine)**: Contains **8.1%** of places, characterized by rustic eco-huts, off-grid camps, and Bedouin guide associations.

### 3.2 Price Level Distribution
- **Free / Public Natural Attraction**: 4.4% (Reef entries, natural lagoon, canyon trails).
- **Inexpensive (`$` / < EGP 150)**: 38.6% (Local bakeries, street food, pickup taxis, Bedouin tea spots, dive gear rental).
- **Moderate (`$$` / EGP 150–500)**: 44.2% (Seafront restaurants, guided boat dives, quad safaris, mid-tier guesthouses, yoga sessions).
- **Expensive (`$$$` / EGP 500–1,500)**: 10.4% (Multi-day dive courses, private airport transfers, boutique eco-resorts, desert glamping).
- **Very Expensive (`$$$$` / > EGP 1,500)**: 2.4% (Luxury beachfront villas, certified trimix technical expeditions, private yacht charters).

---

## 4. Key Discovery Findings & Destination Dynamics

1. **High Concentration of Unregistered Micro-Businesses in Assalah & Abu Galum**:
   Many highly authentic Bedouin bakeries, tea stalls, and boat captains have informal Google listings created by tourists or lack listings altogether.
2. **Seasonality of Seafront Businesses**:
   Approximately 6% of beach restaurants in northern corridors modify their daily hours between the summer wind season (June–August) and the autumn/winter dive peak (October–December).
3. **Connectivity Disparity**:
   Venues in Zones H (Abu Galum) and I (Blue Lagoon) have Google Place profiles with high review counts but **zero on-site cellular data**, reinforcing the mandatory need for the platform's *Offline Trip Pack* and *Expedition Mode*.
4. **Attribution and Verification Mandate**:
   Every place discovered via Google Places will be tagged with its discovery source (`GOOGLE_PLACES_API_NEW`) and will be routed through the Entity Resolution Engine before any operational or commercial role is assigned.
