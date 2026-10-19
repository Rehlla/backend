# DAYGI 4.0 TRAVELER OUTCOME TAXONOMY

## 1. Outcome Classification Matrix

| Outcome Category | Canonical Intent | Success State | Failure State | Safe Recovery Path |
|------------------|------------------|---------------|---------------|---------------------|
| **SCHEDULE_OPTIMIZATION** | `RELINK_SCHEDULE` / `PACE_RELAX` | Activity shifted to new day/time with zero overlaps | Conflicting reservation or blocked supplier slot | Auto-propose next open slot + notify operator |
| **WEATHER_RECOVERY** | `WEATHER_RESCHEDULE` | Hazardous dive postponed, credit issued or indoor activity booked | Traveler stranded in high winds | Auto-apply dive credit to ledger + arrange Lighthouse cafe lounge |
| **COMMERCE_HOLD** | `BOOK_HOLD` | Verified inventory locked for 30 mins with paymob link | Inventory expired before confirmation | Re-poll live inventory + hold alternative supplier SKU |
| **FINANCIAL_REBALANCE** | `OPTIMIZE_BUDGET` | 2,000 EGP saved via cheaper supplier with equal rating | Quality drop below 4.5★ or hidden transfer fee | Enforce strict constraint boundary checks |
| **PROACTIVE_SAFETY** | `SAFETY_ALERT` | Traveler acknowledges marine warning and accepts reroute | Traveler ignored warning | Escalate banner + notify Dahab dispatch operations |
| **DISCOVERY_ROUTING** | `NEARBY_RECOMMEND` | Traveler navigates to spot within stated time window | Recommendation closed or over budget | Provide instant live opening status and walking ETA |

## 2. Invariant Rules for Outcome Completion
1. An outcome is **ONLY** marked `SUCCESS` after explicit post-action state verification.
2. A financial change is **NEVER** marked completed without a matching cryptographic ledger audit record.
3. User intent ambiguity in Arabic dialects (Egyptian / Gulf / Levantine) **MUST** trigger clarification rather than hallucinated execution.
