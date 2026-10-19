# Live Dahab Market Change Policy & Governance Rules

## 1. Core Principles of Market Truth

1. **Observations are Append-Only**:
   Under no circumstance may an existing price observation record be overwritten or deleted. Historical market depth provides the basis for price trend analysis and auditability.

2. **Temporal Validity Intervals**:
   Every price observation exists in a continuous timeline.
   - Initial state: `validFrom = T_0, validUntil = undefined`
   - Superseded state: When an updated price $P_1$ is observed at $T_1$, the previous record $P_0$ is marked `validUntil = T_1`.

3. **Freshness Multi-Dimensionality**:
   The engine separates:
   - `supplierSourceFreshness`
   - `offerSourceFreshness`
   - `priceFreshness`
   - `regulatoryFreshness`
   An active Instagram profile or updated phone number does **not** reset the price freshness of an offer.

4. **Anomaly Handling Policy**:
   - Price increases $\ge 300\%$ or drops $\le 80\%$ on identical pricing basis are flagged as `PRICE_ANOMALY`.
   - The observation is preserved in the database to prevent data loss.
   - An entry is placed in the `MarketReviewQueue` for human supervisor review.
   - Search and ranking algorithms suppress anomalous records from being marked as `BEST_VALUE` until verified.

5. **Discrepancy & Conflict Policy**:
   - When Source A and Source B report conflicting prices on the same calendar day for the same supplier and activity, both observations are stored with their respective source references.
   - A `SOURCE_PRICE_CONFLICT` event is raised and added to the review queue.
   - The higher verification source (e.g., Regulatory > Supplier Official > Instagram > Flyer) receives priority in ranking calculations.

---

## 2. Supplier Lifecycle Governance

- **Active vs Inactive**:
  Suppliers not observed in any verified source for $> 180$ days are flagged as `AGING` or `STALE`, but are never purged from the knowledge graph.
- **Regulatory Revocation**:
  If a supplier loses CDWS verification or receives an `UNVERIFIED_REGULATORY_CLAIM` status, all safety-critical activities (scuba diving, boat trips) are immediately downgraded in ranking, and an alert is dispatched to operations.
