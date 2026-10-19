# DAHAB KNOWLEDGE ONTOLOGY & ENTITY REGISTRY
**Document ID**: `DOC-ARCH-2026-DKOS-ONTOLOGY`  
**Classification**: Formal Domain Ontology  
**Version**: 2026.1  

---

## 1. Domain Ontology Schema

The Dahab Knowledge Operating System models the destination using 32 formal domain entity types:

### 1.1 Geographic & Spatial Entities
- **Area**: Micro-destination zone (e.g. `lighthouse`, `mashraba`, `assalah`, `eel_garden`, `laguna`, `blue_hole`, `canyon`, `wadi_gnai`, `blue_lagoon`, `ras_abu_galum`).
- **Place**: Specific physical landmark or point of interest with validated coordinates.
- **Route**: Directional path between places with terrain type, estimated duration, and distance.
- **AccessMethod**: Normalized modality (`WALK`, `SHORE`, `BOAT`, `VEHICLE`, `4X4`, `CAMEL`, `HIKE`, `MIXED`).

### 1.2 Commercial & Service Entities
- **Business**: Observed or candidate commercial entity in Dahab.
- **Supplier**: Formally vetted operational partner bound to legal tiers (Tier 1, Tier 2, Vetted Local).
- **ProductSku**: Standardized bookable SKU (diver course, airport transfer, bedouin dinner, desert safari).
- **InventorySlot**: Real-time capacity partition for a ProductSku on a specific date and time.
- **Restaurant**: Food & dining establishment with cuisine tags, seating style, dietary flags, and price band.
- **Accommodation**: Stay property (ecolodge, beachfront hotel, boutique camp, dive resort).
- **TransportOption**: Vehicle/shuttle offering with passenger capacity, luggage limit, and AC status.

### 1.3 Activity & Experience Entities
- **Activity**: Curated adventure, diving, water sport, or cultural experience.
- **ConditionRule**: Rule linking environmental thresholds to activity feasibility.
- **Season**: Temporal climatic period with water temperature, wind patterns, and tourism density.

### 1.4 Traveler & Decision Entities
- **TravelerPersona**: Archetype (`DiverExplorer`, `BedouinSeeker`, `FamilyRelaxer`, `DigitalNomad`, `KitesurfAddict`).
- **Preference**: Traveler interest tag (e.g. `seafood`, `quiet`, `coral_reefs`, `freediving`).
- **Constraint**: Hard filter (e.g. `max_duration_minutes`, `budget_limit_egp`, `no_walking`).

### 1.5 Governance & Trust Entities
- **Regulation**: Official decree issued by state or regional authorities (CDWS, Protectorates).
- **Permit**: Required authorization (e.g. Coast Guard boat manifest, St. Catherine border pass).
- **Authority**: Official governing body (e.g. `CDWS`, `SouthSinaiProtectorates`, `MinistryOfTourism`).
- **SafetyRule**: Mandatory operational rule protecting human life and environmental integrity.
- **PracticalTip**: Sourced guidance from local experts (e.g. cash ATMs, wind timings).
- **EmergencyResource**: 24/7 medical or dispatch infrastructure (e.g. Hyperbaric Chamber, ER Hospital).

### 1.6 Intelligence & Observation Entities
- **ResearchSource**: Authoritative or field source record with reliability weighting.
- **Evidence**: Specific claim observation linked to a source.
- **Fact**: Synthesized canonical statement with temporal validity and confidence score.
- **PriceObservation**: Monitored price point for economic index tracking.
- **AvailabilityObservation**: Scraped or verified calendar slot availability.
- **ReviewSignal**: Traveler sentiment summary extracted from verified reviews.
- **MarketObservation**: Macro-economic or competitor product trends.
- **Competitor**: External platform or agent operating in the South Sinai corridor.
- **ProductOpportunity**: High-demand unmet traveler need identified by telemetry.
- **KnowledgeSnapshot**: Immutable point-in-time state of the entire knowledge graph.
