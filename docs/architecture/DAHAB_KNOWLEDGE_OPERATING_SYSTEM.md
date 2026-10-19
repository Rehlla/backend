# DAHAB KNOWLEDGE OPERATING SYSTEM (DKOS) SPECIFICATION
**System Name**: Dahab Knowledge Operating System (DKOS)  
**Version**: 2026.1 Production Release  
**Status**: ACTIVE BACKEND OPERATIONAL SYSTEM  

---

## 1. System Mission & Operating Doctrine

DKOS transforms static destination research documents, real-time meteorological observations, Google Places harvests, and CDWS regulatory mandates into a **queryable, versioned, temporal, geospatial, trust-aware knowledge graph**.

The system answers traveler, supplier, and operational queries not through brute-force text generation or unstructured JSON dumps, but via:
- Deterministic entity resolution and identity graphs.
- Multi-source evidence graphs with explicit confidence propagation.
- Temporal validity tracking (`CURRENT`, `HISTORICAL`, `FUTURE`, `SEASONAL`, `EXPIRED`, `UNKNOWN`).
- Discrepancy reconciliation with classified conflict sets.
- Strict isolation of regulatory/safety truths from general advice.

---

## 2. The 13-Stage Knowledge Pipeline

```
  1. RESEARCH SOURCES (CDWS, Protectorates, Google Places, Local Guilds, Direct Field Audits)
        ↓
  2. INGESTION ENGINE (Idempotent batch & stream ingestion with SHA-256 fingerprinting)
        ↓
  3. PARSING & TOKENIZATION (Multilingual Arabic/English extraction, schema validation)
        ↓
  4. NORMALIZATION (Coordinate validation, pricing standard EGP, Arabic diacritics removal)
        ↓
  5. ENTITY RESOLUTION 2.0 (Identity Graph, Aliases, Transliterations, Reversible Merges)
        ↓
  6. EVIDENCE GRAPH (FACT → supported by → EVIDENCE → from → SOURCE)
        ↓
  7. TEMPORAL ENGINE (ValidFrom, ValidUntil, State classification, Fact history preservation)
        ↓
  8. CONFLICT ENGINE (Claim comparison, authority weighting, conflict classification)
        ↓
  9. CLOUD SQL POSTGRESQL (Authoritative relational storage & indexing)
        ↓
 10. CONTEXT SERVICES (Spatial distance, wind/tide safety gates, access models)
        ↓
 11. QUERY & SEARCH ENGINE (Natural language intent extraction + structured retrieval)
        ↓
 12. RANKING & "WHY THIS" ENGINE (Multi-dimensional scoring + machine-readable explanations)
        ↓
 13. PRODUCT PLATFORM INTEGRATION (DayGI, Trip OS, Book Now, Companion, Operations Console)
```

---

## 3. Core Capabilities

1. **Selective Context Retrieval**:
   - The browser never downloads the full knowledge base.
   - DayGI and frontend views retrieve exact, scoped context slices with source provenance.

2. **Deterministic Safety Enforcement**:
   - Environmental rules (e.g. wind > 22 knots blocks boat transfers) are evaluated as hard boolean gates.
   - Gemini cannot override safety constraints or promote unverified suppliers.

3. **Temporal Invariance**:
   - Updates to facts do not mutate history; past states remain auditable with full change lineage.
