# Live Dahab Market Refresh Operations Manual

## 1. Operational Endpoints

| Endpoint | Method | Role / Security | Purpose |
| :--- | :--- | :--- | :--- |
| `/api/dahab/commerce/refresh` | `POST` | Authenticated | Trigger market refresh with snapshot payload or live ingestion trigger |
| `/api/dahab/commerce/review-queue` | `GET` | Authenticated / Ops | Retrieve pending price anomalies, conflicts, and regulatory issues |
| `/api/dahab/commerce/review-queue/:id/resolve` | `POST` | Supervisor / Admin | Resolve flagged queue items (`APPROVED`, `REJECTED`, `AUTO_RESOLVED`) |
| `/api/dahab/commerce/refresh-runs` | `GET` | Authenticated | Audit history of refresh runs, timings, and detected changes |
| `/api/dahab/commerce/source-health` | `GET` | Authenticated | Monitor upstream source stability and consecutive failure counts |
| `/api/dahab/commerce/operations-overview` | `GET` | Authenticated | High-level operations telemetry dashboard |

---

## 2. Ingestion Manifest Schema Example

```json
{
  "sourceReference": "Dahab Marine & Desert Suppliers Gazette Q1 2026",
  "sourceType": "INSTAGRAM",
  "ingestionMode": "IMPORTED_SNAPSHOT",
  "capturedAt": "2026-03-01T12:00:00.000Z",
  "suppliers": [
    {
      "id": "SUP-DAHAB-SAFARI-01",
      "businessName": "Desert Fox Quad Safaris",
      "businessNameAr": "سفاري ثعلب الصحراء",
      "category": "safari",
      "phone": "+20 100 234 5678",
      "verificationStatus": "SUPPLIER_CONFIRMED"
    }
  ],
  "priceObservations": [
    {
      "supplierId": "SUP-DAHAB-SAFARI-01",
      "activityId": "ACT-QUAD-WADI-GUNAI",
      "priceEGP": 1800,
      "pricingBasis": "PER_VEHICLE",
      "sourcePriceText": "1800 EGP 3hr Wadi Gunai Quad",
      "observedAt": "2026-03-01T12:00:00.000Z"
    }
  ]
}
```

---

## 3. Incident Recovery & Troubleshooting

### Scenario A: Consecutive Upstream Failures
- If `consecutiveFailures >= 3` for any source reference, the engine marks the source health status as `FAILING`.
- Automated alerts are recorded in the refresh manifest.
- System falls back gracefully to latest verified cached snapshots without disrupting live search or DayGI reasoning.

### Scenario B: Accidental Ingestion Rollback
- Since all refreshes execute inside `db.runInTransaction`, an exception at any stage aborts all state mutations.
- The run record is saved with `status: 'FAILED'` and the specific error stack trace for auditability.
