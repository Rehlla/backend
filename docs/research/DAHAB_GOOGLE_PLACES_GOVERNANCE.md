# DAHAB GOOGLE PLACES DATA GOVERNANCE & COMPLIANCE SPECIFICATION
**Document ID**: `DOC-RES-2026-GOV-001`  
**Compliance Standard**: Google Maps Platform Terms of Service & Data Protection Directives  
**Attribution Identifier**: `gmp_mcp_codeassist_v1_aistudio`  
**Status**: ACTIVE COMPLIANCE POLICY  

---

## 1. Core Data Persistence & Licensing Rules

### 1.1 Permitted Data Persistence vs. Prohibited Storage
In strict accordance with Google Maps Platform policies:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PERMITTED FOR STORAGE                           │
│  ✔ Google Place ID (`place_id`) as a permanent foreign key reference   │
│  ✔ GPS Coordinates (latitude, longitude) for geospatial indexing       │
│  ✔ Normalized Canonical Business Names and Zone Association            │
│  ✔ Internal Entity Resolution match confidence scores                  │
│  ✔ Our own verified operational attributes (CDWS status, cash advice)  │
│  ✔ Timestamps of observation and discovery query metadata              │
├────────────────────────────────────────────────────────────────────────┤
│                       PROHIBITED FROM STORAGE                          │
│  ✖ Bulk permanent scraping of end-user review text                     │
│  ✖ Permanent shadow storage of Google photo media binaries             │
│  ✖ Real-time volatile opening hours beyond standard caching TTL        │
│  ✖ End-user personal information from review authors                   │
│  ✖ Proprietary Google ranking algorithms or search ranking indexes     │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Runtime Fetching & Cache Lifecycles
- **Geospatial Route Matrices (Routes API)**: Cached in-memory with a 24-hour Stale-While-Revalidate lifecycle (max TTL 72 hours).
- **Place Details Enrichment**: Volatile place details (live open/closed status, current rating, phone number) are retrieved at runtime via server-side proxy when a traveler engages with a specific card.
- **Cache Invalidation**: Automated invalidation occurs on a 7-day rolling cycle or immediately upon manual Ops Console update.

---

## 2. Google Maps Attribution & UI Display Mandates

### 2.1 Display with Interactive Google Map
When place information is rendered inside or over an active `@vis.gl/react-google-maps` component:
- The standard Google logo and copyright watermark embedded in the map canvas satisfy attribution requirements.
- The `internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}` attribute is embedded on all `<Map>` instances.

### 2.2 Display without an Interactive Map (Card / List View)
When Google-derived place details (such as address, ratings count, or photo tokens) are displayed in a standalone card:
- The card must feature the official Google attribution badge ("Powered by Google").
- Third-party photographer or contributor attributions attached to Google Photos must remain intact and clickable.
- Google content must never be altered in a manner that misrepresents the source.

---

## 3. Cost Governance & Field Masking Standard

### 3.1 Field Masking Enforcements
To eliminate unnecessary billing and minimize network payloads, all server-side API requests strictly enforce field masks:

```typescript
// Example: Places API (New) Text Search Request with Strict Field Mask
const PLACES_SEARCH_FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
  'places.businessStatus'
].join(',');
```

### 3.2 Automated Quota Safeguards
1. **Request Coalescing**: Duplicate concurrent queries for the same coordinate zone or business name are joined into a single server promise.
2. **Circuit Breaker**: If monthly API expenditure reaches 85% of allocated budget, the system gracefully falls back to internal static geography datasets without interrupting traveler browsing.
3. **Zero Wildcard Policy**: The wildcard field mask (`X-Goog-FieldMask: *`) is banned across all production build scripts.

---

## 4. Privacy & Traveler Data Protection

1. **Zero Location Tracking**: The platform does not store continuous GPS tracking traces of travelers. Coordinates are queried strictly as point-in-time origin anchors (e.g. "Near Lighthouse") to calculate route buffers.
2. **Server-Side Proxy Isolation**: The Google Maps API key is never exposed to the client browser. All geospatial requests pass through authenticated backend proxy routes (`/api/context/*`).
3. **Anonymized Geocoding**: Search queries sent to Google APIs contain zero personally identifiable traveler metadata.
