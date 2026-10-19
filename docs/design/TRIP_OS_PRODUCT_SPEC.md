# DAHAB TRIP OS — PRODUCT SPECIFICATION

## 1. Product Concept & Mission
Dahab Trip OS transforms the traditional static itinerary into an active, context-aware travel operating system. It orchestrates the entirety of a traveler's journey in Dahab across 5 core pillars:
1. **Clarity**: Unambiguous understanding of what the trip consists of, what constraints are met, and what trade-offs were made.
2. **Pacing & Energy**: Mathematical and physiological intelligence ensuring rest buffers between diving, hiking, and late desert nights.
3. **Operational Readiness**: Real-time validation of transfers, marine permits, gear sizing, hotel confirmations, and payment states.
4. **Adaptive Optimization**: Instant one-click itinerary upgrades ("Make It Better") that restructure days without causing scheduling conflicts.
5. **Calm Companion**: Seamless handover from planning to on-the-ground operational guidance.

---

## 2. Core Entities & Data Architecture

### 2.1 Trip Brief
The structured input and constraints model:
- `travelerName`, `travelersCount`, `tripDynamic` (Solo, Couple, Friends, Family).
- `durationDays`, `startDate`, `endDate`.
- `budgetTier` ('Budget' | 'Moderate' | 'Premium') and `estimatedBudgetEGP`.
- `pace` ('Relaxed' | 'Balanced' | 'Active').
- `comfortLevel` ('Authentic / Bohemian' | 'Comfort Boutique' | 'Luxury Resort').
- `mustHaves`, `preferences`, `avoidances` (array of `TripConstraint` objects with type, category, label, labelAr, isLocked).

### 2.2 Trip Fit Score Engine
A weighted aggregate score (0–100%) calculated across 6 primary dimensions:
- **Preference Fit** (Weight: 25%): Coverage of selected interests and constraints.
- **Budget Fit** (Weight: 20%): Proximity to target budget without hidden surprises.
- **Pace Fit** (Weight: 20%): Alignment between traveler's desired energy and scheduled intensity.
- **Time & Logistics** (Weight: 15%): Geographic clustering and minimizing unnecessary transit.
- **Availability & Feasibility** (Weight: 10%): Marine season suitability and booking slot availability.
- **Recovery & Buffer** (Weight: 10%): Surface intervals after dives and rest gaps.

### 2.3 Day Intelligence & Intensity
Each day computes:
- `mainAnchor`: The pivotal experience of the day (e.g., "The Canyon Deep Dive").
- `supportingActivity`: Secondary complementing item (e.g., "Sunset Habak Tea").
- `intensity`: Score (1-10) computed from strenuous flags, early starts, driving minutes, and free time.
- `freeTimeMinutes` & `travelTimeMinutes`: Visualized with high-contrast calm badges.
- `recoveryBufferMinutes`: Guaranteed surface intervals or relaxation gaps.

### 2.4 Trip Health & Conflict Monitor
Detects scheduling, physical, and environmental issues:
- `timing`: Overlapping events or tight transfer windows.
- `fatigue`: Back-to-back strenuous activities (e.g., Mount Sinai midnight hike immediately followed by deep boat diving).
- `availability`: Seasonal or weather conditions (e.g., high wind at Blue Lagoon).
- `payment` / `logistics`: Missing airport transfer confirmation or unpaid deposit.

### 2.5 Trip Readiness
Operational checklist tracking readiness before departure:
- Airport transfer assigned.
- Accommodation confirmed.
- Diving certifications / gear sizes submitted.
- Emergency contact & Sinai pass documents verified.
- Deposits and ledger balances cleared.

---

## 3. UI & UX Architecture

### 3.1 Visual Language
- **Palette**: Deep Sea Azure (`#071417`, `#0E252C`), Golden Ochre / Sinai Sand (`#C49756`, `#D4A373`), Terracotta Coral (`#E07A5F`), Off-white Canvas (`#FAF8F5`).
- **Typography**: Display: Outfit / Plus Jakarta Sans; Arabic: Noto Sans Arabic; Body: Inter / System Sans.
- **Spatial Principles**: Generous 24px–32px section paddings, no nested container slop, high-contrast readable badges.

### 3.2 Key Views & Touchpoints
1. **Trip Brief Summary Card / Modal**: Accessible at any time to view and edit trip goals.
2. **Trip Fit & Trade-off Bar**: Embedded in the Itinerary Header to build immediate confidence.
3. **"Make It Better" Intelligence Bar**: Horizontal action strip with smart preset optimizations.
4. **Day Intelligence Card Header**: Pinned above each day's timeline activities.
5. **Trip Health & Readiness Drawer / Widget**: Compact status pill expanding into actionable steps.

---

## 4. AI Grounding & Offline Resilience
- **Deterministic Rules**: All calculations (Fit scores, day intensity, conflict checks, readiness items) have robust deterministic TypeScript algorithms.
- **AI Enhancement**: When AI Director is invoked, prompts are grounded directly in the `TripBrief` and active day timeline.
- **Graceful Degradation**: If backend AI services fail or timeout, local preset flows and algorithmic optimizations execute instantly.
