# Dahab Temporal Price History & Trend Catalog

## Overview

This catalog records chronological price movements and observations across Dahab activities. In accordance with platform integrity directives, observations represent verified historical and recent market findings, not guaranteed real-time merchant inventories.

---

## 1. Key Activity Price Timelines

### Activity: Blue Hole Guided Shore & Boat Diving (`ACT-BLUE-HOLE`)
*Canonical Category: Diving | Location: Blue Hole Protected Area*

| Observation ID | Date | Supplier | Price (EGP) | Pricing Basis | Source Type | Freshness Status | Valid Period |
|---|---|---|---|---|---|---|---|
| `OBS-BH-001` | 2025-11-01 | Desert Divers Dahab | 1,900 | PER_PERSON | Flyer 2025 | AGING | 2025-11-01 -> 2026-01-15 |
| `OBS-BH-002` | 2026-01-15 | Desert Divers Dahab | 2,000 | PER_PERSON | Flyer Q1 2026 | RECENT | 2026-01-15 -> 2026-02-28 |
| `OBS-BH-003` | 2026-02-28 | Desert Divers Dahab | 2,200 | PER_PERSON | Instagram Post | FRESH | 2026-02-28 -> Current |
| `OBS-BH-004` | 2026-02-15 | Poseidon Divers | 2,400 | PER_PERSON | Rate Sheet Q1 | FRESH | 2026-02-15 -> Current |
| `OBS-BH-005` | 2026-02-20 | Red Rock Dive Center | 2,100 | PER_PERSON | Instagram Post | FRESH | 2026-02-20 -> Current |

*Observed Price Range: 2,100 – 2,400 EGP | Median: 2,200 EGP | Trend: RISING (+10.0%)*

---

### Activity: Canyon Guided Reef Dive (`ACT-CANYON`)
*Canonical Category: Diving | Location: Dahab Canyon*

| Observation ID | Date | Supplier | Price (EGP) | Pricing Basis | Source Type | Freshness Status | Valid Period |
|---|---|---|---|---|---|---|---|
| `OBS-CN-001` | 2025-12-01 | Reef 2000 Dive Club | 2,600 | PER_PERSON | Commercial Flyer | AGING | 2025-12-01 -> 2026-02-01 |
| `OBS-CN-002` | 2026-02-01 | Reef 2000 Dive Club | 2,700 | PER_PERSON | Official Rate Sheet | FRESH | 2026-02-01 -> Current |
| `OBS-CN-003` | 2026-02-18 | Sinai Divers Dahab | 2,800 | PER_PERSON | Instagram Post | FRESH | 2026-02-18 -> Current |

*Observed Price Range: 2,700 – 2,800 EGP | Median: 2,750 EGP | Trend: STABLE (+3.8%)*

---

### Activity: Ras Abu Galum & Blue Lagoon Trek / Boat (`ACT-ABU-GALUM`)
*Canonical Category: Safari / Trekking | Location: Ras Abu Galum Protected Area*

| Observation ID | Date | Supplier | Price (EGP) | Pricing Basis | Source Type | Freshness Status | Valid Period |
|---|---|---|---|---|---|---|---|
| `OBS-AG-001` | 2025-10-15 | Sinai Safari Excursions | 1,700 | PER_PERSON | Commercial Flyer | AGING | 2025-10-15 -> 2026-01-10 |
| `OBS-AG-002` | 2026-01-10 | Sinai Safari Excursions | 1,800 | PER_PERSON | Social Post | RECENT | 2026-01-10 -> 2026-02-25 |
| `OBS-AG-003` | 2026-02-25 | Sinai Safari Excursions | 1,600 | PER_PERSON | Spring Promo Flyer | FRESH | 2026-02-25 -> Current |

*Observed Price Range: 1,600 – 1,800 EGP | Median: 1,650 EGP | Trend: FALLING (-11.1%)*

---

## 2. Temporal Query Guide for Developers

### Fetch Price History via API
```bash
# Query complete price observation timeline for a specific activity
curl -X GET "http://localhost:3000/api/dahab/commerce/price-history?activityId=ACT-BLUE-HOLE"

# Query price history for a specific supplier
curl -X GET "http://localhost:3000/api/dahab/commerce/price-history?supplierId=SUP-DESERT-DIVERS"
```

### Response Schema Highlights
```json
{
  "status": "success",
  "totalCount": 3,
  "observations": [
    {
      "id": "OBS-BH-001",
      "priceEGP": 1900,
      "validFrom": "2025-11-01T00:00:00Z",
      "validUntil": "2026-01-15T00:00:00Z",
      "freshnessStatus": "AGING",
      "freshnessScore": 60
    },
    {
      "id": "OBS-BH-003",
      "priceEGP": 2200,
      "validFrom": "2026-02-28T00:00:00Z",
      "validUntil": null,
      "freshnessStatus": "FRESH",
      "freshnessScore": 100
    }
  ],
  "trend": "RISING",
  "changePercentage": 10.0,
  "classification": "OBSERVED_MARKET_DATA"
}
```
