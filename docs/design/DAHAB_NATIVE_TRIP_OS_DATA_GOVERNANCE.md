# Dahab Native Trip OS — Data Governance & Local Provenance Standards

## 1. Ground Truth & Provenance Policy

To maintain complete credibility with Dahab travelers and local operators, the Dahab Native Trip OS enforces strict data governance rules:

1. **Zero Synthetic Hallucinations**:
   - No non-existent dive sites, closed restaurants, or fabricated weather conditions are permitted in the system.
   - All venues, places, and emergency contact numbers must map to verified physical operations in South Sinai.

2. **Telemetry Freshness & Fallback Protocol**:
   - Wind speed, swell direction, water visibility, and water temperature must include explicit verification timestamps.
   - If telemetry exceeds a 4-hour freshness window, the UI displays a clear notice: `Conditions Require Local Confirmation` along with direct contact guidance for local dive marshals.

3. **Pricing & Currency Integrity**:
   - All prices are primarily denominated in **Egyptian Pounds (EGP)** with transparent guidance on cash requirements vs card-accepting venues.
   - National park entrance fees (e.g. Ras Abu Galum & Blue Hole protected area passes) are explicitly noted with cash requirements.

---

## 2. Emergency & Hyperbaric Protocol Standards

All offline trip dossiers, master itinerary modals, and companion views must reference verified medical infrastructure:

- **Hyperbaric Medical Facility**:
  - *Dr. Adel Taher Hyperbaric Medical Center*, Lighthouse Promenade, Dahab (`+20 69 364 0536` / `+20 122 212 4292`).
- **Emergency Ambulance Dispatch**:
  - *South Sinai Central Emergency Dispatch*: `123`.
- **Tourist Police & Security**:
  - *Dahab Tourist Police Station*: `126` / `+20 69 364 0140`.
- **Dahab Medical Clinic**:
  - *Sinai Medical Care Unit*, Assalah: `+20 69 364 0910`.

---

## 3. Schema Versioning & Data Consistency

- Current Schema Version: `2.4-SINAI-NATIVE`.
- Data entities must comply with TypeScript types in `/src/types/dahabContext.ts`.
- Place and restaurant IDs must follow immutable naming conventions (e.g. `place-lighthouse`, `place-blue-hole`, `place-canyon`, `place-abu-galum`, `rest-ralphs-bakery`, `rest-ali-baba`).
