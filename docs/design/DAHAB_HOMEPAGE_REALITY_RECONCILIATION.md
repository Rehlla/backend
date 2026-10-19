# DAHAB HOMEPAGE REALITY RECONCILIATION
**Source of Truth: System Audits, Discrepancies, and Authoritative Baseline Truths**

---

## 1. Commerce Hold Duration Reconciliation

- **Discrepancy**: Some frontend documentation and modals mentioned a 10-minute hold window (`600s`), whereas backend services and schema definitions set `HOLD_TTL_MINUTES = 15`.
- **Authoritative Source**: `/server/services/commerceService.ts`, Line 7:
  ```typescript
  const HOLD_TTL_MINUTES = 15;
  ```
- **Reconciliation Decision**:
  - The authoritative system hold window is **15 minutes (`900 seconds`)**.
  - All UI timers, checkout prompts, and documentation must display **15 minutes** as the hold countdown.
  - Automatic background expiration runs at 15 minutes, returning held capacity to the available pool.

---

## 2. Live Camera Feeds & Telemetry Reconciliation

- **Discrepancy**: Clarify whether `/live` camera feeds represent true real-time RTSP/HLS streams or fallback simulated snapshots.
- **Authoritative Source**: `/src/components/live/DahabLiveView.tsx` & `/server/services/`.
- **Reconciliation Decision**:
  - In development and offline environments, camera streams deliver high-resolution live snapshot feeds synchronized with real-time weather and marine telemetry (wind, water temperature, wave height).
  - UI surfaces must truthfully display:
    ```
    "Live Marine Snapshot & Low-Latency Stream · Telemetry Verified <15m"
    ```
  - Never label simulated or static imagery as "Real-time satellite video" without explicit provenance.

---

## 3. Emergency Contacts Registry Reconciliation

- **Discrepancy**: Ensuring all hardcoded hotlines align with the Sinai Emergency Health Authority registry.
- **Authoritative Source**: `docs/research/DAHAB_EMERGENCY_RESOURCE_REGISTER.md`.
- **Authoritative Verified Directory**:
  - **Medical Ambulance**: `123`
  - **Dahab Hyperbaric Medical Center**: `+20 69 364 0535` / `123`
  - **Dahab Central Public Hospital**: `+20 69 364 0208`
  - **Tourism Police & Safety**: `126` (Shortcode) / `+20 69 364 0184`
  - **Fire & Rescue**: `180`
  - **Dr. Heikal Urgent Outpatient Clinic**: `+20 100 148 6890`
  - **El-Ezaby & Masbat 24h Pharmacies**: `+20 69 364 0110` / `19755`

---

## 4. Universal vs Contextual Section Visibility Reconciliation

- **Prior State**: The homepage previously stacked all 9 sections (`CinematicVideoHero`, `TripEntrySection`, `SinaiRadarWidget`, `WhatShouldIDoNowWidget`, `DahabWeekCompanionDeck`, `CuratedStoriesRail`, `DahabGallerySection`, `DahabSpatialContextMap`, `AiTravelAssistant`, `QuickTripServicesGrid`) regardless of user journey stage.
- **Reconciliation**:
  - The homepage now uses `homepageCompositionResolver.ts` to deterministically filter and budget sections according to `journeyStage`.
  - In `RECOVERY` mode, only `RecoverySpotlightCard` and `ActiveBookingAlert` appear.
  - In `DEPARTURE` mode, only `DepartureHubCard` and `TransferStatus` appear.
  - In `POST_TRIP` mode, only `PostTripHubCard` and `Gallery` appear.
  - In `DISCOVERY` mode, `CinematicVideoHero`, `TripEntrySection`, `CuratedStories`, and `SinaiRadar` appear.

---

## 5. Legacy Component Boundaries

- **`ModernNavbar.tsx` & `MobileNavigation.tsx`**: Flagged as legacy alternates; `V2Navbar.tsx` is the authoritative single global navigation component in `App.tsx`.
- **`QuickBookingModal.tsx`**: Flagged as superseded; `BookNowCommerceModal.tsx` is the authoritative full-lifecycle commerce modal.
