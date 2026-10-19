# DAHAB TEMPORAL KNOWLEDGE & SNAPSHOT ARCHITECTURE
**Document ID**: `DOC-ARCH-2026-DKOS-TEMPORAL`  
**Classification**: Temporal Knowledge Engine & Snapshot Versioning  
**Version**: 2026.1  

---

## 1. Temporal States

Every fact in the Dahab Knowledge Operating System carries an explicit temporal state:

- **`CURRENT`**: Verified true at the present moment within the active validity window.
- **`HISTORICAL`**: True in a past interval, retained for auditing, seasonal baselines, and trend detection.
- **`FUTURE`**: Scheduled or upcoming state (e.g. planned seasonal closure, new ferry line starting next month).
- **`SEASONAL`**: Cyclically true during designated months or wind patterns (e.g. summer thermal winds, winter manta season).
- **`EXPIRED`**: Validity window passed without re-verification; triggers automated refresh queue.
- **`UNKNOWN`**: Insufficient evidence to establish veracity; requires field audit.

---

## 2. Temporal Fact Schema

```typescript
export interface TemporalFact<T = any> {
  id: string;
  subjectId: string;
  subjectType: string;
  predicate: string;
  value: T;
  sourceId: string;
  sourceType: 'AUTHORITATIVE' | 'APPROVED_OPERATIONAL' | 'VERIFIED_LOCAL' | 'GOOGLE_MAPS' | 'COMMUNITY' | 'INFERENCE';
  observedAt: string;
  verifiedAt: string;
  validFrom: string;
  validUntil?: string;
  confidence: number; // 0.0 to 1.0
  confidenceTier: 'VERY_HIGH' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';
  status: 'CURRENT' | 'HISTORICAL' | 'FUTURE' | 'SEASONAL' | 'EXPIRED' | 'UNKNOWN';
  supersedesFactId?: string;
  supersededByFactId?: string;
  verificationOwner: string;
  notes?: string;
}
```

---

## 3. Knowledge Snapshots & Diff Operations

Snapshots are immutable JSON representations of the knowledge state tagged with a version string (e.g. `DAHAB-2026-08-26`).

Comparing **Snapshot A** with **Snapshot B** produces a structured Knowledge Diff:
- **`ADDED`**: New entities or facts discovered.
- **`REMOVED`**: Decommissioned entities.
- **`CHANGED`**: Updated attributes or verified prices.
- **`STALE`**: Facts exceeding revalidation intervals.
- **`CONFLICTED`**: Newly detected opposing claims.
