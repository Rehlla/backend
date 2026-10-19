# DAHAB KNOWLEDGE GOVERNANCE & ACCESS CONTROL SPECIFICATION
**Document ID**: `DOC-ARCH-2026-DKOS-GOVERNANCE`  
**Classification**: RBAC Security, Data Isolation & Boundary Enforcement  
**Version**: 2026.1  

---

## 1. Access Control Tiers (RBAC)

1. **`PUBLIC` / `TRAVELER`**:
   - Access to verified public entities (Places, Activities, Restaurants, Transport options, Why-Matched explanations).
   - Forbidden from accessing: Supplier wholesale commissions, internal risk flags, unverified candidate businesses, reviewer raw notes.

2. **`SUPPLIER`**:
   - Access to own business profile, assigned product SKUs, booking orders, inventory calendar, and ledger payouts.
   - Forbidden from viewing competitor margins or private traveler telemetry.

3. **`OPERATIONS` & `PRODUCT`**:
   - Access to full Knowledge Health Dashboard, Conflict Sets, Stale Fact queues, Change Radar, Supplier promotion reviews, and double-entry ledger audits.

4. **`ADMIN`**:
   - Master configuration, regulatory decree updates, pipeline re-runs, and snapshot rollback operations.

---

## 2. The Strict Supplier Promotion Gate

```
[ Google Places Observation / Unvetted Lead ]
                     ↓
[ Automated Entity Resolution & Duplicate Check ]
                     ↓
[ Evidence Node Attached (Business license, location, contact) ]
                     ↓
[ Operations Field Verification (Tier 1/2/Vetted Local) ]
                     ↓
[ Approved & Activated in Supplier OS ]
```

Direct Google Places observations **NEVER** write directly to active suppliers without human operational approval.
