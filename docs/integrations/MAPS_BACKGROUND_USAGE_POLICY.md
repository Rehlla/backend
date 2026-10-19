# Google Maps Platform Background Usage & Cost Governance Policy
**Dahab Tourism Platform & Native Trip OS**
*Version: 2026.1 — Production Architectural Standard*

---

## 1. Executive Summary & Core Principle
Google Maps Platform operates strictly as a **Background Context Engine** rather than a prominent consumer-facing widget. The traveler UI remains simple, calm, and focused on Sinai culture and adventures. 

Maps APIs provide coordinates, route durations, walking times, driving buffers, and geocoding behind the server-side application boundary. Every call is governed by caching, deduplication, request coalescing, and stale-while-revalidate lifecycles.

---

## 2. Universal API Usage Rules

| Principle | Specification |
| :--- | :--- |
| **Server-Side Proxy Only** | Direct browser-side calls with unprotected API keys are forbidden. All routing and geocoding pass through `/api/context/*`. |
| **Cache-First Pattern** | Stable Dahab pairs (e.g., *Hotel to Blue Hole*, *Lighthouse to Mashraba*) are precomputed and cached in-memory/database with 72-hour TTL. |
| **Stale-While-Revalidate** | Return cached travel estimates immediately to keep UX sub-50ms; revalidate in the background if aging > 24 hours. |
| **Minimum Field Selection** | When requesting Places or Routes, always specify exact field masks (`routes.duration`, `routes.distanceMeters`, `places.displayName`) to avoid billing for unused data. |
| **Batching & Request Coalescing** | Concurrent requests for the same origin/destination pair are joined into a single in-flight promise. |

---

## 3. Dahab Curated Knowledge vs. Maps Provider Division

```
                  ┌─────────────────────────────────────┐
                  │    DAHAB CURATED KNOWLEDGE          │
                  │  (src/data/dahabGeography.ts)       │
                  │  • Bedouin cultural context         │
                  │  • Shore-entry & reef topography    │
                  │  • Connectivity & power realities   │
                  │  • Trusted local safety protocols   │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼  (Enriched with)
                  ┌─────────────────────────────────────┐
                  │    GOOGLE MAPS GEOSPATIAL ENGINE    │
                  │  • Precise GPS coordinates          │
                  │  • Multi-modal transit durations    │
                  │  • 4x4 / Mountain route friction    │
                  │  • Geocoding normalization          │
                  └──────────────────┬──────────────────┘
                                     │
                                     ▼
                  ┌─────────────────────────────────────┐
                  │     UNIFIED DAHAB SPATIAL CONTEXT   │
                  │  "12 min away · Fits 2-hour window" │
                  └─────────────────────────────────────┘
```

---

## 4. Background Job & Enrichment Lifecycle

1. **Supplier Onboarding**:
   - Geocoding is enqueued as an asynchronous background job (`GEOCODE_SUPPLIER`).
   - Normalizes addresses to Dahab zones (Lighthouse, Eel Garden, Mashraba, Medina, Laguna, Canyon, Blue Hole).
   - Stores verified lat/lng in Cloud SQL without blocking the onboarding wizard.

2. **Route Matrix Precomputation**:
   - Background worker precomputes standard Sinai routes (Hubs to Dives, Dives to Cafes, Hotels to Airport).
   - Stored in the routing table with timestamp and provider confidence.

3. **"I Have Two Hours" Engine (`عندي ساعتين`)**:
   - Silently computes: `Origin + Transit (Maps) + Product Duration + Safety Buffer + Return Transit <= Available Window`.
   - Returns top 3-4 vetted options instantly without calling external APIs during the request.

4. **Post-Dive Food Proximity**:
   - Upon completing a coastal activity, the background context engine queries cached candidate eateries within walking radius (3-8 mins).

---

## 5. Cost Budgeting & Rate Limit Safeguards

- **Budget Alert Thresholds**: 50%, 80%, 95% of monthly allocated quota.
- **Fail-Safe Fallbacks**: If external Maps APIs fail or rate limit:
  - Fall back to Dahab Curated Static Geography distances (`travelTimeMinutesFromCenter`).
  - The UI degrades gracefully to local baseline estimates without throwing errors or displaying technical jargon.
- **Zero-Logging of Sensitive Data**: Coordinates are logged only to zone level (approximate center); private traveler GPS traces are never permanently stored.
