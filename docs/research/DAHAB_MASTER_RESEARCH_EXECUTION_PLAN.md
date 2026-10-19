# DAHAB MASTER RESEARCH & DISCOVERY EXECUTION PLAN
**Document ID**: `DOC-RES-2026-PLAN-001`  
**Standard**: Dahab Native Trip OS Intelligence Harvesting Protocol  
**Compliance Standard**: Google Maps Platform Policies & CDWS Sinai Maritime Regulatory Standard  
**Status**: APPROVED EXECUTION SPECIFICATION  
**Author**: Dahab Destination Intelligence & Research Architecture Group  
**Target Scope**: Comprehensive Destination Coverage & Multi-Zone Geospatial Matrix  

---

## 1. Executive Mission & Foundational Directive

This execution plan defines the systematic discovery, multi-source verification, semantic normalization, entity classification, provenance tracking, and product mapping for the entire Dahab ecosystem.

### 1.1 The Six Operational Laws of the Intelligence Harvest
1. **Zero Scraping Law**: All Google Maps geospatial observation must originate exclusively from official Google Maps Platform APIs (Places API New, Routes API, Geocoding API). No DOM/HTML parsing, no browser automation, and no scraping of Google web properties.
2. **Data Governance & Attribution Law**: Google-derived observations remain governed content. The platform persists `place_id`, normalized coordinate points, internal entity resolution hashes, and permissible operational derivatives. Full raw shadow stores are prohibited. All required attributions and provider notices are preserved.
3. **Authoritative Hierarchy Law**: Google Places observations provide discovery signals; they **never** govern regulatory status, maritime safety rules, hyperbaric emergency availability, or CDWS dive center compliance. 
4. **Entity Resolution Gate Law**: Discovered candidate places are assigned into explicit resolution bins (`EXACT`, `HIGH_CONFIDENCE`, `REVIEW_REQUIRED`, `DISTINCT_ENTITY`, `DUPLICATE`, `UNKNOWN`) and are never auto-promoted into production commercial suppliers without Ops verification.
5. **Multi-Zone & Bi-Lingual Query Expansion Law**: Search discovery is conducted through a structured 12-zone geographic matrix and a dual-language (English / Modern Standard Arabic / Egyptian Sinai Vernacular) category matrix with intent variants.
6. **Value-Gated Implementation Law**: Product improvements follow strict P0/P1/P2 opportunity ranking backed by verified provenance.

---

## 2. Seven-Phase Discovery & Harvesting Methodology

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASE 1: ECOSYSTEM RESEARCH                     │
│  Comprehensive destination audit across 40 operational domains         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                    PHASE 2: GOOGLE PLACES QUERY MATRIX                 │
│  12 Geographic Zones × 10 Core Verticals × 3 Language Variants        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                  PHASE 3: GOVERNED HARVEST & FIELD MASKING             │
│  Places API (New) Text & Nearby Search using exact SKU field masks     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                   PHASE 4: ENTITY RESOLUTION PIPELINE                  │
│  Match Google place_ids against Supplier OS, DB, & Geography Atlas     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                PHASE 5: MULTI-SOURCE GAP & CONFLICT ANALYSIS           │
│  Cross-check against CDWS, Sinai Parks, Local Guilds, & Field Audits  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│              PHASE 6: TOP 100 DISCOVERY SIGNALS CLASSIFICATION         │
│  Top 100 verified entities categorized into Book Now, Discover, etc.  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│             PHASE 7: PRODUCT OPPORTUNITY & ARCHITECTURAL GATING        │
│  Trip OS, DayGI, Companion, Book Now, Supplier OS, Operations Console │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Geographic Zone Decomposition (Zones A through L)

| Zone ID | Zone Name | Coordinates (Center) | Radius Biasing | Topographic Character & Operational Constraints |
| :--- | :--- | :--- | :--- | :--- |
| **Zone A** | **Central Dahab (El Kura / Midan)** | `28.4950, 34.5120` | 1,000m | Civic hub, administrative offices, bus stations, central pharmacies, main banks/ATMs. |
| **Zone B** | **Mashraba Waterfront & Heritage Strip** | `28.4905, 34.5155` | 800m | Coral rock shelf, boutique hotels, artisan craft stalls, candlelit seafront dining, bakeries. |
| **Zone C** | **Lighthouse Reef & Promenade** | `28.5030, 34.5200` | 750m | Social epicenter, shallow sandy training bay, dive centers, freediving schools, co-working cafes. |
| **Zone D** | **Assalah Village & Local Souk** | `28.5140, 34.5230` | 1,200m | Authentic Bedouin residential village, local vegetable souk, German bakeries, herbalists, long-term rentals. |
| **Zone E** | **Laguna Beach & Kitesurf Spit** | `28.4820, 34.5050` | 1,500m | Fine sand spit, shallow lagoon, thermal wind acceleration, windsurfing & kitesurfing stations, resorts. |
| **Zone F** | **Northern Dahab (Eel Garden & Canyon Road)** | `28.5080, 34.5210` | 1,000m | Quiet reef access, cliffside shacks, boutique freediving academies, peaceful guesthouses. |
| **Zone G** | **Blue Hole Coastal Corridor** | `28.5725, 34.5370` | 1,500m | Deep drop-off (100m+), vertical wall drift, mandatory CDWS safety checkpoints, unpaved coastal road. |
| **Zone H** | **Ras Abu Galum Protected Sanctuary** | `28.6250, 34.5750` | 2,500m | Protected wilderness, speed boat/camel access only, off-grid eco huts, sheer virgin reefs, zero grid power. |
| **Zone I** | **Blue Lagoon Turquoise Spit** | `28.6710, 34.5980` | 2,000m | High-wind shallow butter-flat sand lagoon, thatched palm huts, digital detox zone, zero cellular reception. |
| **Zone J** | **Wadi Gnai & Southern Canyons** | `28.4450, 34.4600` | 3,000m | Granite boulder canyons, desert oasis, sport climbing crags, quad safaris, Bedouin campfire dinners. |
| **Zone K** | **Saint Catherine & Mount Sinai Corridor** | `28.5560, 33.9750` | 5,000m | High alpine elevation (2,285m), UNESCO Monastery, midnight summit treks, Jebeliya Bedouin guides. |
| **Zone L** | **SSH Airport & Transit Highway** | `27.9780, 34.3940` | 10,000m | Sharm El Sheikh gateway, mountain checkpoint highway (1 hr drive), private transfer pickup zones. |

---

## 4. Google Maps Category Matrix & Multilingual Query Expansion

### 4.1 Ten Core Discovery Verticals
1. **Accommodation**: Hotels, beach camps, eco-lodges, hostels, dive resorts, guest houses, serviced apartments.
2. **Food & Beverage**: Seafront fish restaurants, Bedouin slow-roast zarb, artisan bakeries, vegetarian/vegan cafes, espresso bars, local street breakfast (ful & falafel).
3. **Marine & Diving**: PADI/SSI dive centers, AIDA/Apnea freediving schools, snorkel gear rental, boat charters, kite/windsurf stations.
4. **Desert, Mountains & Land Safaris**: Rock climbing outfitters, 4x4 safari operators, camel trek organizers, Bedouin desert camps, quad bike rentals.
5. **Transport & Mobility**: Airport private transfers, local pickup taxis, scooter rentals, bicycle rentals, long-distance buses.
6. **Wellness & Recovery**: Yoga shalas, sound healing retreats, sports massage clinics, freediver breathwork studios, desert meditation spots.
7. **Practical & Municipal**: Pharmacies, medical clinics, ATMs/banks, telecom branches (Vodafone, Orange, We), laundries, supermarkets.
8. **Tourism & Natural Sanctuaries**: Reefs, marine reserves, mountain summits, canyons, historical ruins, sunset viewpoints.
9. **Services & Creators**: Underwater photographers, private expedition guides, co-working spaces, language & craft instructors.
10. **Emergency & Health**: Hyperbaric chamber facilities, government hospitals, ambulance stations, tourist police posts, 24/7 doctors.

### 4.2 Query Expansion Model
Each vertical is expanded programmatically into three dialectical tiers:
- **Tier 1 (English Global)**: International terminology (e.g., `freediving school Dahab`, `seafood restaurant Lighthouse Dahab`).
- **Tier 2 (Modern Standard Arabic)**: Formal administrative and tourist terminology (e.g., `مراكز الغوص في دهب`, `مطاعم المأكولات البحرية دهب`).
- **Tier 3 (Egyptian & Sinai Vernacular)**: Local colloquial naming and intent terms (e.g., `أحسن سمك سنجاري في المشربة`, `تأجير سكوتر بالعصلة`, `حجز عربية جيب للبلوهول`).

---

## 5. API Optimization, Field Masking & Governance Protocol

### 5.1 Strict Field Masking Specifications
All Places API (New) calls must use explicit field masks to minimize data transmission and eliminate billing overhead:
- **Discovery (Text Search / Nearby Search)**:
  `places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.rating,places.userRatingCount,places.priceLevel,places.businessStatus`
- **Place Details (Enrichment only upon user interaction)**:
  `places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.nationalPhoneNumber,places.currentOpeningHours,places.accessibilityOptions,places.photos`
- **Strict Prohibition**: Wildcard masks (`X-Goog-FieldMask: *`) are strictly forbidden in production configurations.

### 5.2 Persistent Storage vs. Runtime Refresh Rules
- **Permitted to Persist**: `place_id`, verified business name, category classification, GPS coordinates (latitude/longitude), internal entity resolution ID, audit timestamps, our internal operational verification score.
- **Prohibited from Bulk Persistence**: Google user reviews, third-party user photos, volatile real-time opening hours, and raw third-party descriptive snippets without license.
- **Runtime Retrieval**: Volatile status, live reviews sentiment summary, and photo tokens are fetched on-demand at runtime with standard caching (TTL 24-72 hours) and displayed with mandatory Google attribution (`gmp_mcp_codeassist_v1_aistudio`).

---

## 6. Document Generation & Deliverables Schedule

This execution plan initiates the generation of the following research deliverables:
1. `docs/research/DAHAB_GOOGLE_PLACES_DISCOVERY.md` — Core discovery methodology and catalog analysis.
2. `docs/research/DAHAB_GOOGLE_PLACES_CATEGORY_COVERAGE.md` — Detailed breakdown across all 10 verticals.
3. `docs/research/DAHAB_GOOGLE_PLACES_ZONE_COVERAGE.md` — Geographic mapping across Zones A–L.
4. `docs/research/DAHAB_GOOGLE_PLACES_ENTITY_RESOLUTION.md` — Matching pipeline, conflict rules, and resolution algorithms.
5. `docs/research/DAHAB_GOOGLE_PLACES_GOVERNANCE.md` — Compliance, licensing, attribution, privacy, and cost rules.
6. `docs/research/DAHAB_GOOGLE_PLACES_GAP_ANALYSIS.md` — Comparative analysis of online visibility vs. on-the-ground reality.
7. `docs/research/DAHAB_GOOGLE_PLACES_PRODUCT_MAPPING.md` — Mapping verified entities to Trip OS, Book Now, DayGi, and Operations.
8. Update `docs/research/DAHAB_MASTER_SYNTHESIS.md` — Comprehensive destination intelligence synthesis, Top 100 signals, and Product Opportunity Ranking.
