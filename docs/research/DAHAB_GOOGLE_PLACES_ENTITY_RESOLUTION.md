# DAHAB GOOGLE PLACES ENTITY RESOLUTION SPECIFICATION
**Document ID**: `DOC-RES-2026-RES-001`  
**System Module**: Entity Resolution Engine (`server/services/entityResolutionService.ts`)  
**Standard**: Multi-Source Deduplication, Geocoding Reconciliation, and Conflict Arbitration  
**Status**: ARCHITECTURAL SPECIFICATION & RULES  

---

## 1. The Entity Resolution Pipeline

Every candidate place discovered through Google Places APIs is processed through a strict deterministic pipeline before it can be associated with platform products or geography entities.

```
┌─────────────────────────────────────────────────────────────┐
│                 GOOGLE PLACES DISCOVERY                     │
│  { place_id, displayName, location, address, primaryType }  │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           STAGE 1: CANONICAL NORMALIZATION                  │
│  • Strip common noise words ("Restaurant", "Hotel", "Dahab")│
│  • Dual-language Arabic/English transliteration matching   │
│  • Exact GPS coordinate bounding (Haversine < 150m)         │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           STAGE 2: CANDIDATE MATCHING & SCORING             │
│  • Jaro-Winkler string similarity on canonical aliases      │
│  • Phone number & website URL exact hash matching          │
│  • Micro-zone containment check (same zone ID)             │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           STAGE 3: CLASSIFICATION ASSIGNMENT                │
│  • EXACT (Confidence >= 0.95)                               │
│  • HIGH_CONFIDENCE (Confidence 0.85 – 0.94)                 │
│  • REVIEW_REQUIRED (Confidence 0.60 – 0.84)                 │
│  • DISTINCT_ENTITY (Confidence < 0.60, new venue)           │
│  • DUPLICATE (Identical entity with duplicate place_id)     │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│           STAGE 4: OPERATIONAL PROMOTION GATE               │
│  • Authoritative Safety > Verified Supplier > Google Place  │
│  • Requires Ops Console human sign-off for commercial use   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Match State Definitions & Resolution Rules

| Match State | Confidence Threshold | Action Triggered | Automatic Behavior | Ops Review Required |
| :--- | :--- | :--- | :--- | :--- |
| **`EXACT`** | 0.95 – 1.00 | Links Google `place_id` to existing database entity (e.g. `rest-ali-baba` ↔ `ChIJ...`). | Auto-enriches coordinates, current place rating, and formatted address. | No (Auto-resolved) |
| **`HIGH_CONFIDENCE`** | 0.85 – 0.94 | Potential match with slight naming or coordinate variance (< 80m). | Staged as linked candidate; displays in Ops Console for 1-click confirmation. | Optional batch review |
| **`REVIEW_REQUIRED`** | 0.60 – 0.84 | Ambiguous match (e.g., Ralph's German Bakery Mashraba vs. Ralph's Assalah). | Placed in Quarantine Queue. Never modifies existing supplier records. | **Mandatory** |
| **`DISTINCT_ENTITY`** | 0.00 – 0.59 | New business discovered that does not exist in our internal geography. | Created as a `CandidatePlace` for local field verification and potential onboarding. | Yes (for onboarding) |
| **`DUPLICATE`** | N/A (Duplicate place_id or identical address + phone) | Merges metadata into single canonical entity while preserving alias array. | Silently deduplicated; logged in audit register. | No |
| **`UNKNOWN`** | N/A (Missing critical spatial or category data) | Flagged for re-query with enriched query context. | Discarded from production index until resolved. | No |

---

## 3. Authoritative Source Hierarchy

When conflicting information exists between Google Places and local sources, the platform enforces an absolute truth hierarchy:

```
┌──────────────────────────────────────────────────────────────┐
│  TIER 1: AUTHORITATIVE REGULATORY & MARITIME SAFETY          │
│  • CDWS Dive Center Licensing & Decompression Protocols      │
│  • Egyptian Ministry of Environment Protectorate Boundaries  │
│  • South Sinai Police & Military Security Checkpoint Rules   │
└──────────────────────────────┬───────────────────────────────┘
                               │ (Overrules)
┌──────────────────────────────▼───────────────────────────────┐
│  TIER 2: APPROVED SUPPLIER DIRECT CONTRACT DATA              │
│  • Itemized commercial pricing & live capacity slots         │
│  • Dedicated driver license & vehicle registration plates     │
│  • Payout IBANs & direct emergency contact numbers           │
└──────────────────────────────┬───────────────────────────────┘
                               │ (Overrules)
┌──────────────────────────────▼───────────────────────────────┐
│  TIER 3: OPERATIONAL & HISTORICAL PLATFORM TELEMETRY         │
│  • Verified transit durations from Dahab GPS logging         │
│  • Actual recorded boat transfer departure windows           │
│  • Verified power/cellular signal field tests                │
└──────────────────────────────┬───────────────────────────────┘
                               │ (Overrules)
┌──────────────────────────────▼───────────────────────────────┐
│  TIER 4: VERIFIED LOCAL FIELD AUDIT DATA                     │
│  • Dahab merchant council registries                         │
│  • Local guide guild certifications                          │
└──────────────────────────────┬───────────────────────────────┘
                               │ (Overrules)
┌──────────────────────────────▼───────────────────────────────┐
│  TIER 5: GOOGLE PLACES OBSERVATIONS                          │
│  • Public display names, open status, rating counts          │
│  • Approximate GPS coordinates                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Conflict Arbitration Scenarios

### Scenario A: Dive Center Claims 24/7 Hours on Google Maps
- **Google Data**: Lists opening hours as "Open 24 Hours".
- **Authoritative CDWS Rule**: Commercial recreational diving is strictly forbidden before 06:00 and after sunset unless a specific CDWS Night Dive Permit is filed with the coastguard.
- **Platform Resolution**: The platform enforces CDWS operational dive windows (06:30 – 17:30) for dive scheduling, noting Google opening hours as reception-only.

### Scenario B: Restaurant Listed as "Dahab Paradise" at Wrong Coordinates
- **Google Data**: Pin placed 400m inland in residential Assalah.
- **Local Verification**: Property is physically located on the northern beachfront road facing the sea.
- **Platform Resolution**: Platform persists verified physical coordinates from local field audit (`28.5190, 34.5245`), flags the coordinate discrepancy in the Ops Console, and uses verified coordinates for route routing.

### Scenario C: Blue Hole Listed as "Free Admission"
- **Google Data**: User review snippet claims free entry.
- **Authoritative Protectorate Rule**: Foreign nationals require a mandatory $10 entry ticket; Egyptian citizens require EGP 50 ticket purchased at the police checkpoint.
- **Platform Resolution**: Platform injects mandatory entry ticket into practical checklist and price estimation models.
