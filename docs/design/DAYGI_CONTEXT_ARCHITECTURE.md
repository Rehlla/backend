# DAYGI CONTEXT & REASONING ARCHITECTURE
**Dual-Engine Hybrid Reasoning Pipeline**  
**Version:** 1.0.0

---

## 1. Architectural Architecture Diagram

```
[User Inquiry & Spatial Context]
  (Location, Available Minutes, User Pace, Trip State)
                   │
                   ▼
       [DayGI Gateway (Express)]
                   │
      ┌────────────┴────────────┐
      ▼                         ▼
[Deterministic Rules Engine]  [Google Gemini 3.7 Flash Engine]
  - CDWS Marine Safety Flags     - Natural Language Nuance
  - Real-Time Route Matrix       - Egyptian Arabic Phrasing
  - Verified Supplier SKUs       - Cultural Context & Rationale
      └────────────┬────────────┘
                   │
                   ▼
       [Synthesis & Action Structuring]
       - Structured ActionType (RECOMMENDATION / PLAN_CHANGE / DISCOVERY / BOOK_HANDOFF)
       - "Why This Choice?" Explanation
       - Source & Confidence Metadata (VERIFIED_FACT / CURATED_DAHAB)
       - Suggested Follow-Up Prompts
                   │
                   ▼
         [Client DayGiConciergeView]
```

---

## 2. Dual-Engine Workflow

1. **Deterministic Safety Layer:**
   - Evaluates marine safety (CDWS green/yellow/red flags).
   - Validates physical walking distances using cached location coordinates in Dahab.
   - Prevents unsafe recommendations (e.g., freediving at Blue Hole during red-flag winds).

2. **Gemini 3.7 Flash Generative Layer:**
   - Synthesizes personalized advice matching traveler pace and budget.
   - Generates natural, authentic Egyptian Arabic responses and English equivalents.
   - Constructs clear "Why This Choice?" explanations.

3. **Safe State Mutation (Frontend Handshake):**
   - The engine returns action payloads with precise identifiers (`activityId`, `fromDay`, `toDay`, `skuId`).
   - The user interface explicitly presents these proposals with clear action buttons.
   - State updates occur safely in `TripContext` upon user click.
