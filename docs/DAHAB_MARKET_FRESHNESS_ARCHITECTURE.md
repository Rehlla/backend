# Dahab Market Freshness & Change Intelligence Architecture

## 1. System Overview & Core Directives

The **Dahab Market Freshness & Live Change Intelligence Engine** transforms the Dahab Local Commerce catalog into an immutable, time-aware, multi-source temporal intelligence network.

### Fundamental Operating Directives
1. **Source Discovery ≠ Live Inventory**: Market flyer extractions, Instagram rate cards, and spot checks are stored as **Price Observations** with explicit source references and validity windows. They are never conflated with live bookable inventory.
2. **Price Observation ≠ Live Price ≠ Hold Reservation**: An observed price is a historical data point anchored to a timestamp. Direct bookings require explicit supplier reservation confirmation via DayGI/Commerce Hold protocols.
3. **Non-Destructive Temporal Tracking**: Historical price observations are never overwritten or deleted. When an updated price is ingested, the existing active observation's `validUntil` window is closed and a new observation is created with `validFrom` set to the observation timestamp.
4. **Freshness Status & Decay Scoring**: Data automatically ages based on real-time chronological decay across 5 formal tiers (`FRESH`, `RECENT`, `AGING`, `STALE`, `EXPIRED`). Stale data is never represented as current.
5. **Transactional & Idempotent Ingestion**: All refresh routines execute within database transactions and produce zero redundant events upon duplicate ingestion.

---

## 2. Temporal Data Model & Entity Specifications

```
  +-------------------------------------------------------------------------------+
  |                             MarketSnapshotEntity                              |
  |  - id, snapshotAt, totalSuppliers, totalOffers, totalObservations, etc.       |
  +-------------------------------------------------------------------------------+
                                         |
                                         v
  +------------------------+  tracks   +------------------------------------------+
  | MarketChangeEventEntity| <-------- |         PriceObservationEntity           |
  |  - eventType           |           |  - validFrom: ISO8601 (inclusive)        |
  |  - previousValue       |           |  - validUntil: ISO8601 | null (active)   |
  |  - newValue            |           |  - freshnessStatus: FreshnessStatus      |
  |  - percentageChange    |           |  - freshnessScore: 0 - 100               |
  +------------------------+           +------------------------------------------+
             ^                                     ^
             | records                             | links to
  +------------------------+           +------------------------------------------+
  |  ContactHistoryEntity  |           |          SupplierOfferEntity             |
  |  - supplierId          |           |  - basePriceEGP                          |
  |  - fieldName           |           |  - canonicalCategory                     |
  |  - verifiedAt          |           |  - verificationTrustScore                |
  +------------------------+           +------------------------------------------+
```

### Freshness Status Tiers

| Status | Age Range (Days) | Freshness Score Range | Impact on Recommendation Ranking |
|---|---|---|---|
| `FRESH` | 0 – 7 days | 100 | Full ranking eligibility (1.0x score multiplier) |
| `RECENT` | 7 – 30 days | 80 – 95 | Eligible with minor decay factor (0.95x) |
| `AGING` | 30 – 90 days | 50 – 79 | Moderate decay factor (0.80x); warning badge displayed |
| `STALE` | 90 – 180 days | 20 – 49 | Severe decay penalty (0.40x); disqualified from "Best Value" |
| `EXPIRED` | > 180 days | 0 | Excluded from primary recommendations; marked as historic archive |

---

## 3. Automated Change Detection Rules

The engine automatically evaluates incoming data against current database state and records structured events:

1. **Price Increases (`PRICE_INCREASE`)**: Triggered when `incoming.priceEGP > previous.priceEGP`. Records absolute delta, percentage increase, previous source, and new source.
2. **Price Decreases (`PRICE_DECREASE`)**: Triggered when `incoming.priceEGP < previous.priceEGP`. Records negative percentage change.
3. **Pricing Basis Alterations (`PRICING_BASIS_CHANGED`)**: Triggered when the quotation unit changes (e.g. from `PER_PERSON` to `PER_GROUP` or `PER_HOUR`).
4. **Price Expiration (`PRICE_EXPIRED`)**: Triggered when observation age exceeds 180 days without fresh field verification.
5. **Supplier Profile Updates (`SUPPLIER_PROFILE_UPDATED`)**: Triggered when legal business name, category, or service types are modified.
6. **Contact & Social Updates (`CONTACT_INFO_CHANGED`, `SOCIAL_HANDLE_CHANGED`)**: Triggered when phone numbers, WhatsApp, or Instagram handles change.
7. **Regulatory Status Updates (`REGULATORY_STATUS_CHANGED`)**: Triggered when CDWS chamber licensing status or audit rating transitions.

---

## 4. API Interface Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/dahab/commerce/price-history` | Full temporal price observation series for a supplier or offer |
| `GET` | `/api/dahab/commerce/price-changes` | Filterable log of price increase/decrease and basis change events |
| `GET` | `/api/dahab/commerce/supplier-changes` | Recent supplier profile, contact, Instagram, and regulatory updates |
| `GET` | `/api/dahab/commerce/source-freshness` | 4-dimensional source freshness audit and system health metrics |
| `GET` | `/api/dahab/commerce/market-trends` | Aggregated market price movements, rates of change, and category trends |
| `POST` | `/api/dahab/commerce/refresh` | Transactional ingestion endpoint for verified new market observations |
