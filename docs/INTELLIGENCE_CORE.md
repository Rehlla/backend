# Dahab Intelligence Core

Admin control plane inside the Ops console (`/ops-console` → section `core`),
plus a floating **Global Intelligence Core** available from every admin section.
Design language: Living Chart — Sinai 2027 (gold `#C8933D`, teal `#52C4B7`).

## Architecture

```
Admin → CommandCenterShell (section "core" | floating Core + context)
  → POST /api/intelligence-core/query|action|confirm, GET /attention
  → intelligenceCoreService (intent → plan → risk gate → confirm → execute)
  → intelligenceCoreTools TOOL_REGISTRY (allowlist, wraps existing services)
  → bookingService / supplierService / notificationService / ledgerService …
  → db.logAudit(INTELLIGENCE_CORE_*) + analytics telemetry
```

DayGI is the traveler reasoning layer; the Core reuses its patterns (scoped
confirmation TTL, grounded summarization) but has its own deterministic
router. Gemini is quota-guarded polish only — with no key or exhausted quota
the Core still answers from real tool output and says when reasoning is
degraded. **Real data only**: KNOWN / UNKNOWN / UNAVAILABLE / NOT AUTHORIZED.

## Tool registry (`server/services/intelligenceCoreTools.ts`)

Reads (LOW): `getDashboardSummary, getBookings, getBooking, searchBookings,
getPendingSupplierBookings, getSupplierPerformance, getOrders,
getInventoryAlerts, getRevenueSummary, getTripSummary, getSystemHealth,
getRecentErrors, getAnalytics, getAttentionQueue, getReviews,
getMarketIntelligence, getKnowledgeStatus, getReliabilityStatus,
getCoreAudit`.

Mutations (wrap existing services, never reimplement rules): `cancelBooking,
rescheduleBooking, approveSupplierBooking, rejectSupplierBooking` (HIGH),
`updateInventory, sendNotification` (MEDIUM). No ledger/payout/role/secret
tools exist — anything else is rejected as unknown.

## Risk + confirmation

LOW executes · MEDIUM/HIGH return an expiring confirmation token (10 min,
single-use, bound to creator + role) with impact summary + affected count ·
bulk returns per-item ok/failed (ids validated before any token is issued) ·
confirmation re-authorizes before executing. Consumed-token replays are
rejected (404) and audited; expired tokens sweep opportunistically.

## Security

- `apiAccessPolicy`: `/intelligence-core/` → Operations, Admin (deny-by-default).
- Identity from `req.user` only; `bodyParams` validation; per-tool param
  sanitization (prototype keys dropped, lengths capped, no nested operators).
- Prompt injection: DB content is data, model output is never executed; tool
  allowlist only; PII (phones + emails) masked on every booking detail before
  any model polish; per-tool wall-clock timeouts enforced by the router.
- Audit: `INTELLIGENCE_CORE_QUERY/TOOL_CALL/DENIED/CONFIRM/MUTATION/
  BULK_ACTION/ERROR` via `db.logAudit` (no secrets, minimized PII); the
  `getCoreAudit` read tool + Audit Trail card give admins read-back access.
  Server-only telemetry (`intel.query/tool/deny/confirm/mutation/error`,
  latency in payloads) — the client analytics path rejects `intel.*` names.

## Frontend (`src/components/intelligence-core/`)

`IntelligenceCoreView` (dedicated) + `GlobalIntelligenceCore` (floating,
context-aware: resolves "this booking" from the current selection) +
`OrbVisualization` + `Conversation` + `CommandUI` + `AttentionPanel` +
`ActionPlan` + `GestureControl` + `useIntelligenceCore` reducer state machine
(idle/listening/thinking/responding/action/confirm/success/warning/error/alert).

Orb: `src/lib/dahabOrbScene.ts` — Canvas 2D adaptation of the ULTRON scene
architecture (shells, counter-rotating core, particle field, scan ring,
additive glow), DPR ≤ 1.75, off-screen/hidden pause, render-on-demand under
reduced motion, full dispose, `prefers-reduced-motion` reactive, canvas-2D
capability gate, SVG fallback on small screens/no-canvas, `rotate`/`zoom`
gesture API. Voice: Web Speech STT + TTS read-aloud with text fallback.
Gestures: lazy MediaPipe (camera OFF by default, GPU→CPU fallback, start/stop
race guard, full cleanup). Conversation memory resolves follow-up "this
booking" questions from the last inspected booking.

## Env / ops

No new required env vars. Optional: `GEMINI_API_KEY` (polish),
`GEMINI_MODEL` (default `gemini-3.6-flash`). Multi-replica note:
confirmations are in-memory (10-min TTL) — sticky sessions or a shared store
is needed before multi-replica deploys.

## Troubleshooting

- `403` on Core endpoints → role must be Operations/Admin.
- `Unknown tool` → client requested a non-allowlisted tool; update registry.
- `Confirmation expired/unknown` → request the action again (10-min TTL, single-use).
- Orb static → WebGL unavailable, small screen, or reduced motion (by design).
- Gestures unavailable → package/CDN blocked; text + voice keep working.
