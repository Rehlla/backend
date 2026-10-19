# DAHAB KNOWLEDGE MODEL & SCHEMA MAPPING
**Document Status**: Certified Canonical Model Specification  
**Platform**: Dahab Tourism Platform & Cloud SQL Relational Engine  
**Mapping Version**: 2026.1  
**Architecture Principle**: *Relationship-first, authoritative-provenance, temporal-safety, strictly mapped to existing Cloud SQL domain schema.*

---

## 1. Semantic Typing Architecture

Every piece of information extracted from the 36-document research corpus is strictly assigned one of the 16 canonical semantic types:

| Semantic Type | Definition & Purpose | Example from Dahab Research | Destination Cloud SQL Target |
|---|---|---|---|
| `ENTITY` | Discrete physical or conceptual subject with persistent identity | *Lighthouse Bay*, *Red Sea Relax*, *Ali Baba* | `AreaProfileEntity`, `PlaceEntity`, `SupplierEntity` |
| `ATTRIBUTE` | Intrinsic, static or slowly changing property of an entity | *Coordinates (28.5042°N, 34.5208°E)*, *Reef Max Depth (30m)* | Table columns (`coordinates`, `maxDepthMeters`) |
| `RELATIONSHIP` | Directional, typed link connecting two or more entities | *Lighthouse `SUPPORTS` Try Scuba Dive*, *Dive `NEAR` Ali Baba* | Relational Foreign Keys, Joint Table Entities |
| `OBSERVATION` | Empirical field note with specific timestamp & observer | *Audit on Aug 15 observed 65% cash payment split* | `TemporalFactEntity` (`sourceType: 'APPROVED_OPERATIONAL'`) |
| `RULE` | Invariant logic governing operations or physical behavior | *No ascending >300m or flying within 24h of deep dive* | System Validation Invariants, Recovery Logic |
| `CONSTRAINT` | Condition threshold required for activity execution | *Wind speed < 22 knots required for Blue Hole boat* | `ActivityDetailEntity.environmentalSensitivities` |
| `RECOMMENDATION` | Context-aware suggestion generated for specific user persona | *Recommend 1h Snorkel + Ali Baba for 2-hour relaxed slot* | DayGI Reasoning Engine, Ranking Engine Output |
| `PRICING_OBSERVATION` | Observed market or street rate (non-binding intelligence) | *Observed taxi rate: 50–100 EGP for Masbat to Laguna* | `TemporalFactEntity` (`predicate: 'observedPriceEGP'`) |
| `AVAILABILITY_OBSERVATION` | Live or sampled inventory capacity state | *High season hotel occupancy: 92% in October* | `InventorySlotEntity`, `TemporalFactEntity` |
| `TEMPORAL_FACT` | Time-bounded truth with validity interval & freshness policy | *Red Sea water temp in Aug: 27.5°C (Valid: Aug 2026)* | `TemporalFactEntity` (`validFrom`, `validUntil`) |
| `SAFETY_FACT` | Authoritative medical or life-safety parameter | *Dahab Hyperbaric Chamber operates 24/7 at Kilo 2* | `EmergencyResourceEntity`, `EvidenceNodeEntity` |
| `REGULATORY_FACT` | Legal decree or government protectorate statute | *Law 102/1983: No glove diving in South Sinai waters* | `RegulatoryDecreeEntity` |
| `MARKET_SIGNAL` | Aggregated economic or traveler trend indicator | *Nomad average stay length: 28 days in Asalah* | `TemporalFactEntity` (`subjectType: 'Market'`) |
| `TRAVELER_SIGNAL` | Behavioral trait or pain point of a traveler persona | *Ahmed (Cairo Exec) requires instant card-based booking* | `AreaProfileEntity.personaAffinity`, DayGI Profiles |
| `INFERENCE` | Derived logical deduction requiring operational review | *Eel Garden is likely unsuitable at spring low tide* | `ConflictSetEntity`, Human Review Queue |
| `UNKNOWN` | Staged claim pending primary source verification | *Newly submitted dive spot outside CDWS registry* | `PlaceDiscoveryEntity` (`status: 'REVIEW_REQUIRED'`) |

---

## 2. Canonical Entity Taxonomy & Extraction

Entities are uniquely identified with uppercase canonical slugs and fully normalized English and Arabic names:

```
                                  [ DAHAB ONTOLOGY ROOT ]
                                             │
      ┌────────────────┬─────────────────────┼─────────────────────┬────────────────┐
      ▼                ▼                     ▼                     ▼                ▼
[ AreaProfile ]   [ Place ]           [ ActivityDetail ]   [ DiningVenue ]   [ EmergencyResource ]
(17 Micro-Zones) (Certified POIs)    (Experiences/SKUs)   (Restaurants)     (Medical/Safety)
      │                │                     │                     │                │
      └────────────────┴─────────────────────┼─────────────────────┴────────────────┘
                                             ▼
                                     [ SupplierEntity ]
                                 (Licensed Local Operators)
                                             │
                                             ▼
                                    [ ProductSkuEntity ]
                                 (Bookable Transactional Units)
```

### Core Entity Mapping Table:

| Canonical Entity ID | Canonical Name (En) | Canonical Name (Ar) | Transliterations & Aliases | Category | Coordinates / Location | Source Provenance |
|---|---|---|---|---|---|---|
| `lighthouse` | Lighthouse Bay & Promenade | خليج وممشى اللايتهاوس | Light House, El Fanar, Masbat North | Area / Zone | 28.5042° N, 34.5208° E | CDWS Atlas 2026 |
| `eel_garden` | Eel Garden Marine Area | منطقة إيل جاردن البحرية | Ras El-Kora, Hadikat Al-Thoaban | Area / Zone | 28.5085° N, 34.5242° E | CDWS Atlas 2026 |
| `mashraba` | Mashraba Heritage Strip | ممشى المشربة التراثي | Masraba, Mashraba Beach | Area / Zone | 28.4980° N, 34.5160° E | Field Audit Q3 2026 |
| `laguna` | Dahab Laguna Sand Spit | بحيرة اللاجونا واللسان الرملي | The Lagoon, Ghazala Bay | Area / Zone | 28.4720° N, 34.5020° E | Field Audit Q3 2026 |
| `blue_hole` | Blue Hole Protected Sanctuary | محمية البلو هول البحرية | The Blue Hole, Al-Baqaa Al-Zarqaa | Area / Zone | 28.5725° N, 34.5375° E | EEAA Protectorates Decree |
| `ras_abu_galum` | Ras Abu Galum Protected Reserve | محمية رأس أبو جالوم | Abu Galum, Ras Abu Gallum | Area / Zone | 28.6180° N, 34.5620° E | EEAA Protectorates Decree |
| `blue_lagoon` | The Blue Lagoon (Abu Galum) | البلو لاجون السحرية | Magic Lagoon, Deep North Lagoon | Area / Zone | 28.6410° N, 34.5750° E | Field Audit Q3 2026 |
| `place_lighthouse_reef` | Lighthouse Coral Reef | شعاب اللايتهاوس المرجانية | Lighthouse Reef, Fanar Diving Site | Place / Reef | 28.5042° N, 34.5208° E | CDWS-SS-REG-2026 |
| `place_eel_garden_reef` | Eel Garden Reef Channel | قناة وشعاب إيل جاردن | Eel Garden Reef, Ras El-Kora Dive Site | Place / Reef | 28.5085° N, 34.5242° E | CDWS-SS-REG-2026 |
| `place_blue_hole_sanctuary` | The Blue Hole Marine Chasm | فجوة البلو هول البحرية | Blue Hole Chasm, The Arch Site | Place / Marine | 28.5725° N, 34.5375° E | CDWS-SS-REG-2026 |
| `SUP-DIVE-01` | Red Sea Relax Diving Center | مركز غطس ريد سي ريلاكس | Red Sea Relax Resort & Dive | Supplier | Lighthouse Promenade | CDWS License #104 |
| `SUP-SAFARI-01` | Sinai Desert & Mountain Guild | جمعية رحلات جبال سيناء | Bedouin Safari Guild (Muzeina) | Supplier | Asalah / Wadi Qnai | SINAI-BED-42 |
| `SUP-TRANS-01` | Sinai Safe Fleet Transfers | أسطول سيناء للتوصيل السياحي | Sinai Transfer Fleet | Supplier | Kilo 16 / Masbat | MOT-SINAI-512 |
| `act_try_dive_lighthouse` | Guided Try Scuba Dive | تجربة غطس استكشافية للمبتدئين | Discover Scuba Diving, Intro Dive | Activity / SKU | Lighthouse Bay | CDWS Standard |
| `act_eel_garden_snorkel` | Eel Garden Sunset Snorkel | سنوركلينج حديقة ثعابين البحر | Eel Garden Guided Snorkeling | Activity / SKU | Eel Garden Reef | CDWS Standard |
| `rest_ali_baba_seafood` | Ali Baba Seafood Restaurant | مطعم علي بابا للمأكولات البحرية | Ali Baba Masbat, Ali Baba Fish | Dining Venue | Masbat Waterfront | Field Audit Q3 2026 |
| `rest_ralphs_german_bakery` | Ralph's German Bakery | مخبز رالف الألماني | Ralph's Mashraba, German Bakery | Dining Venue | Mashraba Strip | Field Audit Q3 2026 |
| `EMERG-HYPER-DAHAB-01` | Dahab Hyperbaric Chamber | وحدة العلاج بالأكسجين وضغط الهواء | Dahab Decompression Chamber | Emergency | Dahab Hospital, Kilo 2 | MOHP Registry 2026 |

---

## 3. Relationship-First Relational Architecture

The relational model explicitly establishes directed links between entities, preventing flat prose storage:

```
[ PlaceEntity: place_lighthouse_reef ]
       │
       ├── (1:N) [ ActivityDetailEntity: act_try_dive_lighthouse ]
       │                │
       │                ├── (N:1) [ SupplierEntity: SUP-DIVE-01 ] ──→ (1:N) [ ProductSkuEntity: sku_try_dive ]
       │                ├── (N:1) [ AreaProfileEntity: lighthouse ]
       │                └── (N:M) [ DiningVenueEntity: rest_ali_baba_seafood ] (Adjacency: 2 min walk)
       │
       ├── (1:N) [ SpatialRouteCacheEntity: route_lh_to_eg ] ──→ [ PlaceEntity: place_eel_garden_reef ]
       │                └── (Attributes: 8 min walk, 100% pedestrian, 0.8 km)
       │
       └── (1:N) [ TemporalFactEntity: FACT-LH-DEPTH-01 ]
                        └── (Predicate: maxReefDepthMeters, Value: 30, Source: CDWS_DESTINATION_ATLAS_2026)
```

### Relational Matrix Definitions:
1. **`place_activity`**: Links physical coordinates (`PlaceEntity`) to structured experiences (`ActivityDetailEntity`).
2. **`activity_supplier`**: Connects experiences to verified operational partners (`SupplierEntity`) with CDWS licenses and response SLAs.
3. **`activity_access`**: Defines entry modality (`WALK`, `SHORE`, `4X4`, `BOAT`, `CAMEL`) and equipment requirements.
4. **`place_food` / `activity_food`**: Models physical proximity (walk times < 5 min) for post-activity dining workflows.
5. **`activity_condition`**: Maps environmental dependencies (`maxWindKnots`, `tideState`, `daylightRequired`) to real-time weather sensors.
6. **`activity_persona`**: Links experiences to target archetypes (`Ahmed`, `Sarah`, `Marco`, `Layla`) with specific pace and budget weights.

---

## 4. Mapping Research Concepts into Existing Cloud SQL Schema

We strictly map all research concepts into the **EXISTING** Cloud SQL schema (`server/db/schema.ts`) without creating redundant or duplicate tables:

| Research Corpus Concept | Existing Cloud SQL Table Entity | Key Fields Utilized | Redundant Tables Rejected |
|---|---|---|---|
| Research Document / Source | `ResearchSourceEntity` | `id`, `name`, `sourceType`, `authorityWeight`, `publisher`, `documentRef` | `ResearchDocument`, `RawDocTable` |
| Observed Field Metric | `TemporalFactEntity` | `subjectId`, `predicate`, `value`, `observedAt`, `verifiedAt`, `confidence` | `MarketResearchFact`, `AuditDump` |
| Verification Proof | `EvidenceNodeEntity` | `factId`, `sourceId`, `claim`, `authorityScore`, `independenceId` | `RawEvidenceBlob` |
| Disagreement between sources | `ConflictSetEntity` | `entityId`, `property`, `claimA`, `claimB`, `classification`, `status` | `DisputeTable` |
| Micro-Zone / Neighborhood | `AreaProfileEntity` | `id`, `nameEn`, `nameAr`, `walkabilityScore`, `atmosphere`, `personaAffinity` | `ZoneResearch` |
| POI / Reef / Destination | `PlaceEntity` | `id`, `nameEn`, `nameAr`, `aliases`, `areaId`, `coordinates`, `operationalStatus` | `ResearchPlace` |
| Experience / Tour | `ActivityDetailEntity` | `id`, `titleEn`, `category`, `durationMinutes`, `accessMethod`, `bookingMode` | `ResearchTour` |
| Restaurant / Cafe | `DiningVenueEntity` | `id`, `nameEn`, `areaId`, `cuisine`, `averageMealPriceEGP`, `bookingEligibility` | `ResearchRestaurant` |
| Emergency / Hospital / Chamber | `EmergencyResourceEntity` | `id`, `nameEn`, `category`, `hotlineNumbers`, `authority`, `operatingHours` | `HospitalTable` |
| Legal / Environmental Law | `RegulatoryDecreeEntity` | `id`, `titleEn`, `category`, `authority`, `sourceDocRef`, `enforcementAction` | `LawTable` |
| Google Places Candidate | `PlaceDiscoveryEntity` | `googlePlaceId`, `canonicalName`, `matchState`, `confidenceScore` | `GooglePlacesRawDump` |
| Commercial Operator | `SupplierEntity` | `id`, `businessName`, `tier`, `licenseNumber`, `rating`, `onboardedAt` | `ResearchSupplier` |
| Bookable Catalog Product | `ProductSkuEntity` | `id`, `supplierId`, `serviceType`, `title`, `basePriceEGP`, `durationMinutes` | `ResearchProduct` |

---

## 5. Canonical Intermediate Record (`DahabKnowledgeRecord`)

Before database insertion, all candidate items pass through the normalized intermediate representation:

```typescript
export interface DahabKnowledgeRecord<T = any> {
  entityId: string;
  entityType: 'Area' | 'Place' | 'Activity' | 'Dining' | 'Supplier' | 'Emergency' | 'Decree';
  predicate: string;
  value: T;
  sourceId: string;
  authorityClassification: 'AUTHORITATIVE' | 'VERIFIED' | 'APPROVED_OPERATIONAL' | 'OBSERVATION' | 'MARKET_SIGNAL' | 'INFERENCE' | 'UNVERIFIED';
  confidenceScore: number; // 0.0 to 1.0
  validityInterval: {
    observedAt: string;
    verifiedAt: string;
    validFrom: string;
    validUntil?: string;
  };
  freshnessPolicy: {
    domain: ResearchDomain;
    freshDaysMax: number;
    agingDaysMax: number;
  };
  provenance: {
    publisher: string;
    documentRef: string;
    auditor: string;
  };
  status: 'CURRENT' | 'HISTORICAL' | 'SEASONAL' | 'STAGED' | 'CONFLICTED';
}
```

---

## 6. Entity Resolution & Normalization Invariants

1. **Bilingual String Normalization**:
   - Arabic names undergo standard character normalization (e.g. `إ / أ / آ` → `ا`, `ة` → `ه`, stripping `الـ` prefixes during phonetic indexing).
   - Transliterations map common romanized variants (`Masbat`, `Mashbat`, `El Masbat` → `masbat`).
2. **Coordinates Precision**:
   - High-precision WGS84 coordinates (4 decimal places ~11m precision).
   - Distance calculations utilize Haversine formula with topographic obstacle weighting (e.g. coral reef barrier multiplier).
3. **Currency & Unit Standardization**:
   - All financial amounts standardized to Egyptian Pounds (`EGP`) integer values; foreign currency quotes stored in metadata with reference conversion rate.
   - Durations standardized to integer minutes (`durationMinutes`).

---

## 7. Quality Gate & Promotion Filters

A candidate knowledge item **CANNOT** be promoted to authoritative Cloud SQL production state unless it passes all 5 quality invariants:
1. **Source Integrity**: `sourceId` must exist in `ResearchSourceEntity` with `authorityWeight ≥ 0.85` and valid `documentRef`.
2. **Epistemic Classification**: Semantic type must not be `UNKNOWN` or `INFERENCE` for safety/regulatory claims.
3. **Entity Resolution**: Target entity must resolve to `EXACT` or `HIGH_CONFIDENCE` (score ≥ 0.90).
4. **Temporal Metadata**: `observedAt`, `verifiedAt`, and `validFrom` must be valid ISO8601 timestamps.
5. **Conflict Resolution**: Must have zero active `TRUE_CONFLICT` entries in `ConflictSetEntity`.
