# DAHAB HOMEPAGE COMPOSITION ARCHITECTURE
**Source of Truth: Centralized State-Driven Homepage Composition Engine**

---

## 1. Architectural Principles

1. **Homepage as an Orchestrator**: The homepage never renders a static, 15-section monolithic stack. It acts as an intelligent director:
   $$\text{Journey Context} \longrightarrow \text{Homepage Mode} \longrightarrow \text{Section Eligibility} \longrightarrow \text{Priority & Budget} \longrightarrow \text{Render}$$
2. **Strict Content Budget**:
   - **One Primary Story**: The dominant card or banner addressing the traveler's most critical objective right now.
   - **A Few Supporting Surfaces**: 2 to 3 high-relevance secondary widgets (e.g., weather radar, contextual timeline, instant decision grid).
   - **One Clear Next Action**: A single Next Best Action (NBA) CTA preventing cognitive paralysis.
3. **Zero Redundancy / Deduplication Rule**: If a specific action or booking (e.g. "Rebook Morning Dive at Canyon") is already featured as the Primary Story, secondary widgets (like Quick Services or Stories) must not duplicate the exact same prompt.
4. **Single Deterministic Derived State**: We derive `HomepageMode` directly from the single existing `journeyStage` in `TripContext`:
   - `discover` $\rightarrow$ `DISCOVERY`
   - `plan` $\rightarrow$ `PLANNING`
   - `preview` $\rightarrow$ `PREVIEW`
   - `prepare` $\rightarrow$ `PREPARING`
   - `arrive` $\rightarrow$ `ARRIVAL`
   - `experience` $\rightarrow$ `IN_DESTINATION`
   - `spontaneous` $\rightarrow$ `SPONTANEOUS`
   - `food` $\rightarrow$ `FOOD`
   - `recovery` $\rightarrow$ `RECOVERY`
   - `help` $\rightarrow$ `HELP`
   - `departure` $\rightarrow$ `DEPARTURE`
   - `post_trip` $\rightarrow$ `POST_TRIP`

---

## 2. Section Eligibility Model

Each candidate homepage section registers an eligibility specification:

```typescript
export interface SectionEligibility {
  id: string;
  component: string;
  title: string;
  titleAr: string;
  priority: number; // Higher number = higher priority
  renderState: 'VISIBLE' | 'CONDITIONAL' | 'DEFERRED' | 'HIDDEN';
  hideReason?: string;
  isPrimary: boolean;
  isSecondary: boolean;
  isOptional: boolean;
  dataDependencies: string[];
  actionRoute?: string;
}
```

### Deterministic Priority Scoring Function
When selecting secondary surfaces from eligible candidates:
$$\text{Score} = (\text{Urgency} \times 40) + (\text{Relevance} \times 30) + (\text{Freshness} \times 20) + (\text{Commercial Value} \times 10)$$

- **Urgency**: Highest for `RECOVERY` (100), `DEPARTURE` (90), `ARRIVAL` (85), `SPONTANEOUS` (75), `IN_DESTINATION` (70), `DISCOVERY` (30).
- **Relevance**: Matched against current location, weather anomalies, and time of day.
- **Freshness**: Real-time telemetry (< 15 mins) weighted above cached or static editorial content.

---

## 3. Implementation Blueprint (`src/services/homepageCompositionResolver.ts`)

```typescript
export function resolveHomepageComposition(params: {
  journeyStage: JourneyStage;
  profile: TravelerProfile;
  tripDays: TimelineDay[];
  bookings: ConfirmedBookingItem[];
  travelerContext: SingleTravelerContext;
  nextBestActions: NextBestAction[];
  isMobile: boolean;
}): {
  mode: HomepageMode;
  primarySectionId: string;
  visibleSectionIds: string[];
  budgetApplied: { primary: number; secondary: number; total: number };
}
```

### Motion & Transitions
- Preserved shell (`V2Navbar`, Environmental Telemetry, Global Footer).
- In-place section morphing with smooth fade and subtle translate transitions (`motion/react` or CSS transitions).
- Respects `@media (prefers-reduced-motion: reduce)`.
