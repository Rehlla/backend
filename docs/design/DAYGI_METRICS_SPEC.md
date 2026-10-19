# DAYGI 4.0 METRICS SPECIFICATION & TARGET THRESHOLDS

## 1. Primary Success Metrics (The 6 Pillars)

| Metric Code | Metric Name | Target Threshold | Formula / Definition |
|-------------|-------------|-------------------|----------------------|
| **MET-01** | Outcome Completion Rate | **≥ 75%** | `Verified Outcomes / Initiated Task Intents` |
| **MET-02** | Arabic vs English Parity Gap | **≤ 5%** | `\|Conversion_AR - Conversion_EN\|` |
| **MET-03** | Mean Time to Outcome (MTTO) | **≤ 45 sec** | Time from intent entry to verified trip update |
| **MET-04** | Confirmation Safety Compliance | **100%** | `Confirmed Actions / High-Risk Executions` (Zero unprompted executions) |
| **MET-05** | Fallback / Clarification Rate | **≤ 8%** | `Clarification Prompts / Total Queries` |
| **MET-06** | Financial Ledger Integrity | **100% (0 errors)** | Total debits equal total credits across all transactions |

## 2. Real-Time Telemetry Pipeline Spec

### Funnel Events Schema:
- `DAYGI_OPENED`: Concierge interface loaded or opened in session.
- `INTENT_ENTERED`: User submitted conversational prompt.
- `INTENT_UNDERSTOOD`: Intent classifier parsed intent with confidence score ≥ 0.70.
- `RECOMMENDATION_SHOWN`: UI rendered cards/options/briefings for user selection.
- `ACTION_SELECTED`: User clicked a structured action card or multi-step option.
- `CONFIRMATION_SHOWN`: 5-point audit modal or task confirmation rendered.
- `ACTION_EXECUTED`: Deterministic service invoked with action token.
- `ACTION_VERIFIED`: Post-action state checked against Cloud SQL / supplier API.
- `TRIP_UPDATED`: Client state and trip schedule updated.
- `USER_OUTCOME`: Traveler task marked successfully resolved.

### Intent Performance Matrix Tracking:
- `UNDERSTANDING_RATE`: Percentage of queries correctly parsed into canonical intents.
- `OUTCOME_CONVERSION`: Percentage of understood intents culminating in verified state changes.
- `CONFIRMATION_DROP_RATE`: Traveler abandoned at confirmation step.
- `WHY_THIS_ENGAGEMENT`: Proportion of users inspecting rationale.
- `USER_SATISFACTION_INDEX`: Ratio of positive to negative feedback.
