# Dahab Market & Web Intelligence Layer — Architecture & System Specification

## 1. Executive Summary & Purpose

The **Dahab Market & Web Intelligence Layer** is an internal auxiliary intelligence subsystem built directly within the existing Dahab Tourism Platform (Angular/React frontend, Laravel/Node backend architecture). Its primary function is to continuously ingest, normalize, and synthesize external market data—including pricing benchmarks, review sentiment, candidate supplier discovery, competitor packages, regulatory access conditions, and traveler inquiries across South Sinai.

### Core Architectural Principle: Strict Separation of Intelligence vs. Production Truth
```
┌────────────────────────────────────────────────────────────────────────┐
│               UNTRUSTED EXTERNAL WEB & REGISTRY FEEDS                  │
│   (Google Places API, CDWS Registry, TripAdvisor Microdata, Feeds)     │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ (Ingestion / Rate-Limited Crawlers)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│             DAHAB MARKET & WEB INTELLIGENCE LAYER (READ-ONLY)          │
│   • Raw Observations & SHA-256 Provenance Signature Store              │
│   • Entity Normalization Engine (EGP Standard, GPS Geofencing)         │
│   • Entity Resolution Matrix (Deterministic & Probabilistic)           │
│   • Discovered Supplier Vetting Pipeline (Candidate Staging)           │
│   • Competitive Pricing & 7-Day Velocity Index (FX Drift Isolation)    │
│   • Change Radar (Immutable Audit Timeline)                            │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ (Explicit Human Ops Vetting ONLY)
                                     │ (Zero Automatic Mutation)
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│             DAHAB PRODUCTION TRUTH & OPERATIONAL CORE                  │
│   • Supplier OS (Active Verified Providers & CDWS Licenses)            │
│   • Booking & Checkout Engine (Guaranteed Fixed Tariffs)               │
│   • Real-Time Operations Dispatch & Bedouin Driver Manifests           │
└────────────────────────────────────────────────────────────────────────┘
```

> **CRITICAL INVARIANT**: External market intelligence data is **never** automatically promoted to Production Truth. Verified pricing, capacity, booking commitments, and active supplier status require explicit verification and approval by Dahab Operations human administrators.

---

## 2. Ingestion & Crawling Pipeline

### 2.1 Job Scheduling & Execution
- Ingestion jobs are executed via rate-limited, idempotent schedulers (`CrawlJob`).
- Each job records:
  - `startedAt`, `completedAt`, `durationMs`
  - `recordsExtracted`, `recordsNormalized`, `anomaliesFound`
  - `payloadSize`, `correlationId`, `idempotencyKey`
  - Granular pipeline logs for auditability.

### 2.2 Anomaly & Rate Limit Handling
- Connectors enforce exponential backoff with jitter on HTTP 429 / 503 responses.
- If payload structural variance exceeds 15%, the connector flags an anomaly and isolates the batch into quarantine (`Staged for Review`) without breaking downstream normalization.

---

## 3. Provenance & Cryptographic Traceability

Every raw observation ingested by the Intelligence Layer is stamped with an immutable provenance record:
- **`provenanceSignature`**: SHA-256 hash computed over `[source_id + source_url + fetched_at + rawSnippet]`.
- **`parser_version` & `connector_version`**: Ensures backward compatibility and schema evolution tracking.
- **`freshness` & `confidence`**: Numerical confidence scoring (0–100%) grounded in source authority.

---

## 4. Normalization Engine

The Normalization Engine converts unstructured or semi-structured data into canonical domain representations:
1. **Currency & Pricing**:
   - Every price point is normalized to Egyptian Pounds (EGP).
   - Foreign currencies (USD, EUR, GBP) are converted using the official daily exchange rate timestamped at ingestion.
   - **FX Drift Tracking**: Flags whether a price hike is an organic supplier tariff change or an FX currency devaluation artifact (`fx_drift_flag: true`).
2. **Geographic Geofencing**:
   - Resolves South Sinai locations into canonical areas (`Lighthouse`, `Eel Garden`, `Blue Hole`, `Canyon`, `Mashraba`, `Assalah`, `Lagoona`, `Wadi Qnai`, `Ras Abu Galum`, `St. Catherine`).
   - Validates coordinates within South Sinai bounding box: `Lat: 28.3° to 28.9° N, Lng: 34.3° to 34.7° E`.
3. **Contact & Amenities Extraction**:
   - Structured parsing for Egyptian phone/WhatsApp formats (`+20 ...`).
   - Standardized amenity tags (e.g., Nitrox, PADI 5-Star, Equipment Rental, WiFi, Bedouin Dinner).

---

## 5. Entity Resolution & Deduplication Matrix

To prevent catalog duplication and distinguish between multiple branches, aliases, or distinct operators at the same location, the resolution engine executes a multi-tier matching cascade:

| Tier | Strategy | Threshold | Action |
|---|---|---|---|
| **Tier 1** | **Deterministic Exact / License / Tax ID Match** | 100% | Linked directly to existing Verified Supplier ID. |
| **Tier 2** | **Deterministic Normalized Phone / GPS Proximity (<50m)** | >90% | High-confidence link; tagged for single-click Ops confirmation. |
| **Tier 3** | **Probabilistic Fuzzy Name & Category Alignment** | 70%–89% | Staged as Ambiguity Review; requires human triage. |
| **Tier 4** | **No Match Found (<70%)** | <70% | Staged as New Supplier Candidate in Discovery Pipeline. |

### Edge Case Handlers:
- **Arabic / English Transliterations**: Normalizes variations (e.g., "Sheikh Ali Resort" vs "فندق الشيخ علي Dahab").
- **Same Location, Distinct Operators**: Distinguishes between dive centers operating out of the same hotel premises (e.g., Lighthouse Dive Base vs In-House Dive Desk).
- **Same Supplier, Multiple Verticals**: Consolidates operators offering both Safari and Scuba under a unified candidate record.

---

## 6. Supplier Discovery & Vetting Pipeline

Discovered operators undergo a strict 8-stage vetting lifecycle before becoming active in Supplier OS:
```
[Discovered] ──► [Reviewed] ──► [Candidate] ──► [Contacted] ──► [Verified] ──► [Approved] ──► [Onboarded]
                                                                        │
                                                                        └──► [Rejected / Archive]
```
- **Verification Evidence**: CDWS License lookup, Tax ID confirmation, on-site safety equipment inspection (O2 kits, boat life jackets, vehicle 4x4 permits).
- **Explicit Human Audit**: Promotion requires a verified operator signature and role audit log (`actorRole: 'Sinai Operations Admin'`).

---

## 7. Change Radar & Market Alerts

The Change Radar is an append-only event stream tracking market mutations:
- `PRICE_MUTATION`: Competitor or supplier price adjustments.
- `STATUS_CHANGE`: Venue seasonal opening, relocation, or renovation.
- `ROAD_ACCESS`: St. Catherine mountain passes, Blue Hole checkpoint advisories, marine swell alerts.
- `NEW_OFFERING`: Emerging local tours (e.g., Ras Abu Galum sunrise boat runs).

All change events maintain immutable history and require operational acknowledgement.
