# DAHAB DATA MODEL & ARCHITECTURE AUDIT
**Subsystem**: Local Commerce, DKOS, Supplier Engine, Catalog & DayGI Architecture  
**Audit Date**: August 2026  
**Auditor**: Principal Data Architect & Travel Marketplace Engine Team  
**Scope**: Schema, Seeds, Repositories, Domain Models, Services, Shared Types, UI Bindings  

---

## 1. Executive Summary

This audit evaluates the state of the Dahab travel platform data models prior to ingesting real local commerce intelligence. The existing architecture contains rich enterprise abstractions for core bookings, DKOS (Dahab Knowledge Operating System), temporal facts, double-entry ledgers, and distributed locking. However, a structural gap existed between **knowledge-level place/activity entities** and **supplier-specific commercial offers**.

Previously:
- Prices were often modeled either as abstract base estimates on activities (`basePriceEGP`) or static product SKUs (`ProductSkuEntity`).
- Supplier identities were coupled to single SKU types without multi-offer provenance tracking.
- Flyer and promotional material semantics (e.g. Single vs. Double buggy prices, shared 4x4 vs. private boat, source capture timestamps) were not decoupled into a dedicated provenance-aware raw-source layer.

This document inventories the existing entities, identifies missing fields and duplication risks, and sets the blueprint for the **Dahab Local Commerce Engine**.

---

## 2. Existing Data Models Inventory

### 2.1 Supplier Model (`SupplierEntity` in `server/db/schema.ts`)
```ts
export interface SupplierEntity {
  id: string;
  businessName: string;
  businessNameAr: string;
  category: 'transfer' | 'diving' | 'hotel' | 'safari' | 'restaurant' | 'logistics';
  tier: 'Tier 1 Certified' | 'Tier 2 Certified' | 'Vetted Local Partner';
  status: 'Active' | 'Pending_Verification' | 'Suspended';
  leadContact: string;
  phone: string;
  email: string;
  area: string;
  licenseNumber: string;
  rating: number;
  reviewCount: number;
  onboardedAt: string;
  approvedBy?: string;
  payoutAccountNumber?: string;
  metadata?: Record<string, any>;
}
```
*Current Strengths*: Strict typing, status lifecycle (`Active`, `Pending_Verification`, `Suspended`), category classification.  
*Gaps & Limitations*:
1. Missing aliases (`aliases: string[]`) to handle multi-lingual or informal names (e.g. "Bakry Safari Dahab" vs "بكرى سفاري دهب").
2. Missing granular contact channels (`whatsappNumbers`, `socialLinks`, `bookingChannels`).
3. Single `licenseNumber` field conflates CDWS, Ministry of Tourism (MOT), and Bedouin Tribal guild registrations.
4. Lacks explicit multi-tier verification provenance (`verificationStatus`, `verificationSources`).

---

### 2.2 Activity & Place Models (`ActivityDetailEntity`, `PlaceEntity` in DKOS)
```ts
export interface PlaceEntity {
  id: string;
  nameEn: string;
  nameAr: string;
  aliases: string[];
  arabicNames: string[];
  transliterations: string[];
  areaId: string;
  category: string;
  coordinates: { lat: number; lng: number };
  operationalStatus: 'OBSERVED' | 'CANDIDATE' | 'UNDER_REVIEW' | 'VERIFIED' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  descriptionEn: string;
  descriptionAr: string;
  verifiedAt: string;
}

export interface ActivityDetailEntity {
  id: string;
  skuId?: string;
  titleEn: string;
  titleAr: string;
  category: 'diving' | 'safari' | 'water_sport' | 'wellness' | 'culture' | 'food';
  placeId: string;
  areaId: string;
  durationMinutes: number;
  accessMethod: 'WALK' | 'SHORE' | 'BOAT' | 'VEHICLE' | '4X4' | 'CAMEL' | 'HIKE' | 'MIXED' | 'UNKNOWN';
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced' | 'All Levels';
  basePriceEGP: number;
  bookingMode: 'BOOK_NOW' | 'REQUEST_NOW' | 'DISCOVER_ONLY' | 'WALK_IN' | 'PLAN_LATER' | 'UNKNOWN';
  supplierId?: string;
}
```
*Current Strengths*: Rich geospatial and contextual awareness, environmental sensitivity guards, multi-intent search aliases.  
*Gaps & Limitations*:
1. Activities define a single `basePriceEGP`, which falsely implies a uniform market price across all suppliers.
2. In reality, multiple suppliers offer distinct packages for the same canonical activity (e.g. Blue Hole Safari offered by King Safari, Bakry Safari, Sinai Desert Guild at varying prices and inclusions).

---

### 2.3 Commerce & SKU Models (`ProductSkuEntity`, `InventorySlotEntity`, `HoldEntity`, `BookingEntity`)
*Current Strengths*: Robust double-entry ledger integration, idempotency keys, hold TTL expiration, and driver/guide telemetry.  
*Gaps & Limitations*:
1. Direct binding of `ProductSkuEntity` to instant `InventorySlotEntity` is ideal for live bookable products, but unverified or source-reported flyers should NOT immediately populate artificial inventory slots.
2. We need a clean distinction between:
   - **Market Intelligence Offers** (`SupplierOffer` / `SOURCE_REPORTED`)
   - **Bookable Commercial SKUs** (`ProductSkuEntity` / `BOOK_NOW` with active supplier contracts)

---

### 2.4 Knowledge & Provenance Models (`ResearchSourceEntity`, `TemporalFactEntity`, `EvidenceNodeEntity`)
*Current Strengths*: Cryptographic snapshots, conflict sets, authority weights, temporal validity intervals (`validFrom`, `validUntil`), source attribution.  
*Integration Opportunity*:
The Local Commerce Dataset can directly link raw flyer sources and verified web sources into `ResearchSourceEntity` and `EvidenceNodeEntity`, allowing DayGI and Unified Search to quote prices with transparent provenance tags.

---

## 3. Data Inconsistency & Risk Matrix

| Risk Factor | Prior State | Remediation Strategy |
|---|---|---|
| **Single Price Fallacy** | `ActivityDetailEntity.basePriceEGP` held 1 scalar value. | Maintain `ActivityDetailEntity` as canonical reference, but create `SupplierOfferEntity[]` per supplier to track individual offer prices. |
| **Fake Availability** | Flyer prices risked being turned into fake booking slots. | Keep `InventorySlotEntity` strictly for live certified suppliers. Flyer offers remain `SOURCE_REPORTED` intelligence items. |
| **OCR vs. Visual Truth** | Unsupervised OCR could corrupt numbers or terms. | Visual inspection verification layer; all raw extraction preserved in `RawSupplierSource` and `RawOfferSource`. |
| **SN / DB Pricing Confusion** | Single / Double buggy prices collapsed into 1 number. | Strict `pricingBasis` enumeration: `SINGLE`, `DOUBLE`, `PER_PERSON`, `PER_GROUP`, `VIP_PER_PERSON`, `INQUIRY`. |
| **Unverified CDWS Claims** | Marketing logos mistaken for legal compliance. | Regulatory status requires CDWS registry citation (`CDWS-DHB-xxx`). |

---

## 4. Integration Target Architecture

```
[Raw Sources: Flyers, CDWS, Web]
              │
              ▼
   [Raw Source Ingestion Layer]
   (RawSupplierSource / RawOfferSource)
              │
    ┌─────────┴─────────┐
    ▼                   ▼
[Canonical Suppliers] [Canonical Activities]
    │                   │
    └─────────┬─────────┘
              ▼
    [Supplier Offers Layer] ──► [Pricing Intelligence & Market Stats]
              │
    ┌─────────┼─────────────────────────┐
    ▼         ▼                         ▼
[DKOS Graph] [Unified Search Engine]  [DayGI AI Concierge]
    │                                   │
    ▼                                   ▼
(Temporal Facts)                    (Provenance-Aware Quotes)
```

This audit establishes the baseline for the non-destructive, provenance-preserving ingestion of the master Dahab local commerce dataset.
