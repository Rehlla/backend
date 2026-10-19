# Live Dahab Market Refresh Engine — Architecture & Execution Pipeline

## 1. Executive Summary
The **Live Dahab Market Refresh Engine** powers real-time and scheduled market synchronization, change detection, anomaly classification, and temporal knowledge graph updates for the Dahab local commerce ecosystem.

Unlike naive scrapers or synthetic databases, this pipeline enforces strict temporal truth guarantees:
1. **Source Snapshots are Immutable**: Every ingested payload generates a cryptographic fingerprint and immutable snapshot.
2. **History is Never Destroyed**: Price observations are append-only. Old observations are terminated with `validUntil` closed intervals.
3. **Price Observation != Live Inventory**: Observations represent field recordings with verification trust weights, never synthetic live availability.
4. **Pure Idempotency & Transactional Atomicity**: Identical payload re-runs produce zero duplicate records, zero duplicate events, and zero orphaned facts.

---

## 2. Ingestion Modes & Source Hierarchy

```
+-------------------------------------------------------------------------+
|                        INGESTION MODES                                  |
|   1. LIVE_FETCH (Official Regulatory / Direct Supplier API)             |
|   2. IMPORTED_SNAPSHOT (Standardized Snapshot with provenance hash)    |
|   3. MANUAL_REFRESH (Verified Supervisor Override)                      |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                    DETERMINISTIC FINGERPRINTING                         |
|   - Supplier Fingerprint: fp_sup_{name}_{phone}_{whatsapp}              |
|   - Offer Fingerprint:    fp_off_{supplierId}_{activityId}_{title}      |
|   - Price Fingerprint:    fp_prc_{offerId}_{amount}_{currency}_{basis}  |
|   - Contact Fingerprint:  fp_cnt_{supplierId}_{field}_{value}           |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                TRANSACTIONAL PIPELINE (db.runInTransaction)             |
|   Step 1: Supplier Ingestion & Contact Change Detection                 |
|   Step 2: Social Account Activity Signal Tracking                       |
|   Step 3: Offer Ingestion & Temporal Price Evaluation                   |
|   Step 4: Anomaly Detection (>300% / <-80%) & Conflict Resolution       |
|   Step 5: 4-Dimensional Freshness & Health Audit                        |
|   Step 6: DKOS Temporal Fact Synchronization (CURRENT vs SUPERSEDED)    |
|   Step 7: Market Price Statistics Recalculation                         |
|   Step 8: Immutable Market Snapshot Persistence                         |
+-------------------------------------------------------------------------+
```

---

## 3. Data Freshness Decay Mathematics (4 Tiers)

Freshness is computed against observation timestamps using a continuous mathematical decay model:

| Status | Age in Days | Freshness Score | Operational Meaning |
| :--- | :--- | :--- | :--- |
| **FRESH** | $\le 7$ days | **100** | Recent direct observation; top recommendation priority |
| **RECENT** | $8 - 30$ days | **95 - 80** | Valid observed market price; reliable baseline |
| **AGING** | $31 - 90$ days | **79 - 50** | Moderate confidence; flagged for scheduled refresh |
| **STALE** | $91 - 180$ days | **49 - 20** | Outdated; penalized in ranking algorithms |
| **EXPIRED** | $> 180$ days | **0** | Historical reference only; ineligible for primary ranking |

---

## 4. Change Event & Anomaly Classification

The engine classifies changes into distinct event types:

1. `NEW_SUPPLIER` / `SUPPLIER_UPDATED`: Discovered new operators or changes to established vendors.
2. `CONTACT_CHANGED`: Discrepancy in phone, WhatsApp, email, or lead contact. Recorded in `db.contactHistory`.
3. `REGULATORY_STATUS_CHANGED`: Changes in CDWS licensing, prompting immediate supervisor review if downgraded.
4. `PRICE_INCREASE` / `PRICE_DECREASE`: Verified price movement with delta and percentage change.
5. `PRICING_BASIS_CHANGED`: Shift in unit economics (e.g., `PER_PERSON` to `PER_VEHICLE`).
6. `PRICE_ANOMALY`: Extreme price spike ($\ge +300\%$) or collapse ($\le -80\%$). Enqueued into `MarketReviewQueue` with `severity: 'HIGH'`.
7. `SOURCE_PRICE_CONFLICT`: Conflicting prices reported on the same date by different sources. Enqueued with `severity: 'MEDIUM'`.
8. `INSTAGRAM_ACCOUNT_CHANGED` / `ACTIVITY_SIGNAL_CHANGED`: Social presence tracking and posting activity signals.

---

## 5. Temporal Knowledge Graph Integration
When a price changes:
- The previous observation's `validUntil` timestamp is set to the new observation's `observedAt` timestamp.
- The corresponding `TemporalFactEntity` in the Dahab Knowledge OS is marked `status = 'SUPERSEDED'` with `validUntil` closed.
- A new `TemporalFactEntity` is inserted with `status = 'CURRENT'` and `validFrom` set to the observation timestamp.
- The DKOS memory cache is automatically invalidated.
