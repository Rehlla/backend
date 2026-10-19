# Dahab Market Intelligence — External Source Registry & Audit Matrix

## 1. External Source Registry Matrix

| Source ID | Source Name | Category | Collection Method | API / Auth | Terms / Robots Status | Allowed Data Types | Retention Policy | Usage Classification | Risk Level | Production Readiness |
|---|---|---|---|---|---|---|---|---|---|---|
| **SRC-001** | Google Maps Places & Reviews API | Google Maps | Official API | OAuth2 / API Key | API Terms of Service Governed | Business Name, GPS Coordinates, Aggregated Rating, Hours, Price Level | 30-Day Aggregated Cache | Intelligence Only | Low | **Production-Ready** |
| **SRC-002** | CDWS Egypt Official Dive Center Registry | Sinai Tourism Portal | Authorized Feed | Public RSS / JSON-LD | Allowed (robots.txt OK) | Legal Business Name, CDWS License Number, Expiry, Safety Rating | Permanent Reference Registry | Vetting Reference | Low | **Production-Ready** |
| **SRC-003** | TripAdvisor Public Activity & Tour Listings | TripAdvisor | Public Web Page | HTML Microdata | NOT PRODUCTION-READY | Aggregated Rating, Tour Title, Public Excerpt Snippet | 14-Day Ephemeral Cache | Intelligence Only | High (Legal/IP) | **NOT PRODUCTION-READY** |
| **SRC-004** | Dahab Community Travelers & Expats Hub | Social Feed | Authorized Feed | Public RSS / JSON-LD | Allowed (robots.txt OK) | Public Inquiry Topics, Feedback, Logistics Questions | 7-Day Trend Cache | Intelligence Only | Low | **Production-Ready** |
| **SRC-005** | Facebook Dahab Community Public Groups | Social Group | Unsupported Scraping | None | NOT PRODUCTION-READY | None - Prohibited | Purged Immediately | Intelligence Only | Critical | **NOT PRODUCTION-READY** |
| **SRC-006** | OTA & Competitor Tariff Monitor | Competitor Website | Indirect / Aggregated | Manual Inspection | Allowed (robots.txt OK) | Public Package Name, Advertised Retail Price, Inclusions | 90-Day Time-Series Table | Internal Benchmark | Medium | **Candidate Feed** |

---

## 2. Granular Source Governance Analysis

### SRC-001: Google Maps Places & Reviews API
- **Authorization**: Governed under Google Maps Platform commercial agreement.
- **Data Boundaries**: Consumes canonical Place Details (place_id, geometry.location, formatted_phone_number, opening_hours). Review text is limited to 5 aggregated excerpts; individual reviewer profiles and emails are never collected or stored.
- **Status**: Production-Ready.

### SRC-002: CDWS Egypt Official Registry
- **Authorization**: Egyptian Chamber of Diving & Watersports public statutory portal.
- **Data Boundaries**: Official license validity data used for mandatory supplier verification prior to promoting dive centers or safari centers to Supplier OS.
- **Status**: Production-Ready (Golden Truth reference for dive certifications).

### SRC-003: TripAdvisor Public Listings
- **Audit Findings**: Microdata collection of public attraction pages without a paid TripAdvisor Content API license poses intellectual property and terms-of-service compliance risks.
- **Governance Directive**: Classified as **NOT PRODUCTION-READY**. Connector is throttled and restricted to staging environments. Commercial license negotiation required before live production activation.

### SRC-004: Dahab Community Travelers & Expats Hub
- **Authorization**: Public syndicate feed with CORS headers and RSS endpoint for local tourism announcements.
- **Data Boundaries**: Collects general travel questions (e.g., ATM status, weather in Blue Hole, checkpoint timings) to identify content gaps in the Dahab AI Director.
- **Status**: Production-Ready.

### SRC-005: Facebook Dahab Community Public Groups
- **Audit Findings**: Scraping Facebook groups violates Meta Platform Terms and robot exclusion rules.
- **Governance Directive**: **CRITICAL VIOLATION IF ACTIVE**. Feed is **LOCKED and PAUSED**. All historical raw observation snippets have been purged from the staging database. Re-activation requires official Meta Graph API permissions.

### SRC-006: OTA & Competitor Tariff Monitor
- **Authorization**: Public published brochure rates collected through verified manual sampling.
- **Data Boundaries**: Packaged tour prices (e.g., Sharm ↔ Dahab transfer, Mt. Sinai sunrise hike) used to benchmark Dahab platform partner fair-pricing index.
- **Status**: Candidate Feed.
