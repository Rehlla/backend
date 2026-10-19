# DAHAB EVIDENCE GRAPH & CONFIDENCE PROPAGATION
**Document ID**: `DOC-ARCH-2026-DKOS-EVIDENCE-GRAPH`  
**Classification**: Provenance Architecture & Confidence Propagation  
**Version**: 2026.1  

---

## 1. Evidence Graph Topology

```
+------------------+       +-------------------+       +-----------------------+
|  RESEARCH SOURCE | ----> |   EVIDENCE NODE   | ----> |      CANONICAL FACT   |
| (e.g. CDWS 2026) |       | (Specific Claim)  |       | (Subject-Predicate-Val|
+------------------+       +-------------------+       +-----------------------+
         |                          |                              |
         |                          v                              v
+------------------+       +-------------------+       +-----------------------+
| INDEPENDENT LOCAL| ----> | 2nd EVIDENCE NODE | ----> | CONFIDENCE ACCUMULATOR|
|  FIELD AUDIT     |       | (Corroboration)   |       | (Weighted Score 0..1) |
+------------------+       +-------------------+       +-----------------------+
```

---

## 2. Evidence Strength Formulation

Evidence nodes are evaluated across 5 deterministic axes:
1. **Authority Weight ($w_{auth}$)**: 
   - `OFFICIAL_AUTHORITY` (CDWS, Government) = 1.00
   - `APPROVED_OPERATIONAL_DATA` (Direct Supplier) = 0.90
   - `VERIFIED_LOCAL_INSPECTION` (Field Researcher) = 0.85
   - `GOOGLE_MAPS_OBSERVATION` = 0.70
   - `COMMUNITY_REPORT` = 0.50
   - `AI_INFERENCE` = 0.30

2. **Independence Multiplier ($m_{ind}$)**:
   - 1 source: $1.0\times$
   - 2 independent sources: $1.25\times$
   - 3+ independent sources: $1.40\times$ (capped at 1.0 overall fact confidence)

3. **Recency Decay ($d_{rec}$)**:
   - Verified < 30 days: $1.00$
   - Verified 30–90 days: $0.90$
   - Verified 90–180 days: $0.75$
   - Verified > 180 days: $0.50$ (flags fact as `STALE`)

4. **Consistency**:
   - Matches existing consensus: $+0.10$
   - Active conflict: Triggers Conflict Set evaluation.

---

## 3. Weakest Material Dependency Propagation

When evaluating multi-fact composite recommendations (e.g. Activity Recommendation = Location Valid + Time Window Fits + Route Feasible + Condition Safe + Supplier Available):

$$\text{Confidence}_{\text{Composite}} = \min(\text{Conf}_{\text{Location}}, \text{Conf}_{\text{Time}}, \text{Conf}_{\text{Route}}, \text{Conf}_{\text{Condition}}, \text{Conf}_{\text{Supplier}})$$

If any critical dependency has `LOW` or `INSUFFICIENT` confidence, the entire recommendation confidence drops to that level.
