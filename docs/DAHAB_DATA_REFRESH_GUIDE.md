# Dahab Data Refresh & Ingestion Guide

## 1. Overview & Operating Principles

This guide details the procedures, data contracts, and validation rules for refreshing Dahab market intelligence, supplier catalogs, price observations, and regulatory audits.

### Critical Ingestion Invariants
- **Non-Destructive**: Never perform `DELETE` or in-place overwrite on historical `priceObservations`.
- **Idempotency**: Retrying the same payload must produce identical database state and 0 duplicate events.
- **Atomicity**: All writes must execute within `db.runInTransaction`.
- **Provenance Requirement**: Every record must declare its `sourceType` and `sourceReference`.

---

## 2. Ingestion Data Contract (`POST /api/dahab/commerce/refresh`)

### Request Payload Specification
```typescript
interface MarketRefreshRequest {
  suppliers?: Array<SupplierEntity>;
  offers?: Array<SupplierOfferEntity>;
  priceObservations?: Array<PriceObservationEntity>;
  socialAccounts?: Array<SocialAccountEntity>;
  sourceReference: string;
  triggerSource: 'AUTOMATED_INGESTION' | 'MANUAL_SPOT_CHECK' | 'REGULATORY_AUDIT' | 'SUPPLIER_SUBMISSION';
  referenceTime?: string; // Optional override for backfilling historical observations
}
```

### Example Curl Request
```bash
curl -X POST "http://localhost:3000/api/dahab/commerce/refresh" \
  -H "Content-Type: application/json" \
  -d '{
    "triggerSource": "AUTOMATED_INGESTION",
    "sourceReference": "Dahab Spring 2026 Merchant Rate Card Ingestion",
    "priceObservations": [
      {
        "id": "OBS-SPRING-2026-001",
        "supplierId": "SUP-DESERT-DIVERS",
        "activityId": "ACT-BLUE-HOLE",
        "priceEGP": 2200,
        "pricingBasis": "PER_PERSON",
        "sourceType": "COMMERCIAL_FLYER",
        "sourceReference": "Spring 2026 Flyer Page 2",
        "observedAt": "2026-03-01T10:00:00Z",
        "freshnessStatus": "FRESH",
        "freshnessScore": 100,
        "validFrom": "2026-03-01T10:00:00Z"
      }
    ]
  }'
```

### Response Payload
```json
{
  "status": "success",
  "snapshotId": "SNP-1772450000000",
  "changesRecorded": 1,
  "events": [
    {
      "id": "EVT-CHG-1772450000000",
      "entityType": "PRICE",
      "eventType": "PRICE_INCREASE",
      "supplierId": "SUP-DESERT-DIVERS",
      "activityId": "ACT-BLUE-HOLE",
      "previousValue": 2000,
      "newValue": 2200,
      "percentageChange": 10,
      "timestamp": "2026-03-01T10:00:00Z"
    }
  ],
  "updatedSuppliersCount": 14,
  "updatedOffersCount": 28,
  "updatedObservationsCount": 29,
  "systemFreshnessScore": 96.5,
  "correlationId": "CORR-REFRESH-001"
}
```

---

## 3. Step-by-Step Refresh Workflow

1. **Extraction & Canonical Normalization**: Clean and normalize flyer/Instagram data (currency in EGP, category mapped to canonical taxonomy).
2. **Duplicate Check**: The engine verifies whether the incoming `id` or exact `(supplierId, activityId, observedAt)` already exists.
3. **Change Detection**: Evaluates incoming values against active database records to generate `MarketChangeEventEntity` records if price, contact, or licensing changed.
4. **Validity Window Handshake**:
   - Updates previous active observation's `validUntil` to `incoming.observedAt`.
   - Inserts incoming observation with `validFrom = incoming.observedAt` and `validUntil = undefined`.
5. **Freshness Recalculation**: Recomputes freshness statuses and scores across all active offers.
6. **Market Snapshot Creation**: Generates an immutable `MarketSnapshotEntity` logging total entities, median prices, and system health.
