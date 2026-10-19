# DAHAB — THE LIVING CHART: AUTONOMOUS FULL-STACK TRANSFORMATION
## Wave Execution Log (P0 → P7) — 2026-09-10

*Execution contract: the approved plan + `FRONTEND_TRANSFORMATION_BLUEPRINT.md` feature matrix +
`LIVING_CHART_DESIGN_SPEC.md`. Every changed capability carries its 13-field Impact Record
(USER GOAL · UX FLOW · UI · FRONTEND STATE · API CONTRACT · BACKEND LOGIC · DATABASE IMPACT ·
PERMISSIONS · ANALYTICS · LOGGING · ERROR STATES · TESTS · REGRESSION GATE). Regression gate
after every wave: `tsc --noEmit` clean + full vitest (node + UI) + `vite build` + targeted e2e.
Server restored on **:3000** (VS Code port-forward conflict resolved: the forwarding Code.exe
exited, port freed, dev server re-started on 3000 and verified via `/api/health` + `/`).*

---

## BASELINE (verified 2026-09-10, re-measured this session)

- `tsc --noEmit`: 0 errors
- `vitest run`: **1123 passed**, 5 skipped (Paymob live, secret-gated)
- `vitest run --config vitest.ui.config.ts`: **52 passed**
- `vite build`: green — index 894.79 kB / gzip 261 kB (P1 #5: warning limit reverted to 650,
  DayGI split into its own lazy chunk, no simulator chunk — verified absent)
- Dev server live on **:3000** (`/api/health` 200, `/` 200)
- P0 report (`PHASE_0_REPORT.md`) and baseline battery VERIFIED against source.

---

## WAVE P1 — HYGIENE (verified, no new implementation needed)

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Query-cache / no refetch storms | ✅ VERIFIED | `src/services/queryCache.ts` (TTL + dedupe + invalidate) wired into `useApiResource(cacheKey)` + `useCMSContent`; `tests/domain/queryCache.test.ts` |
| 2 | Emoji→Lucide sweep | ✅ VERIFIED | `tests/domain/emojiDiscipline.test.ts` gate; only dev-only AhmedJourneyWalkthrough + one toast string retain glyphs (staff/dev surfaces) |
| 3 | Floating-action de-crowding | ✅ VERIFIED | `SinaiFloatingQuickDock` consolidates DayGI + emergency + passbook; `ThumbBar`/`MobileSheet` primitives exist |
| 4 | Token-leak sweep + lint | ✅ VERIFIED | `tests/domain/tokenDiscipline.test.ts` gate; `chart-*` API is the only visual API |
| 5 | Bundle budget + DayGI split | ✅ VERIFIED | `chunkSizeWarningLimit` back at 650; DayGI view lazy chunk 49.98 kB; no simulator chunk in dist |

---

## WAVE P2 — SHIP BUILT CAPABILITY (finishing gaps)

### 13-FIELD IMPACT RECORD — Conditions-on-cards (P2 #11)

- **USER GOAL**: A traveler browsing discovery cards wants to know whether the sea is
  workable *now* for a water activity without opening a separate live page.
- **UX FLOW**: Explore grid → card shows server-judged suitability chip (go/caution/avoid)
  beside the tag → tooltip/sr-label carries the reason.
- **UI**: `ConditionsBadge` component (bilingual chip, Waves icon, verdict colors
  emerald/amber/red, reason in title + aria-label). Renders only when the server payload
  carries a verdict — no signal, no badge.
- **FRONTEND STATE**: `ExploreView` extends its marine state with `suitability[]`; memoized
  `conditionsByActivity` map (activityId → {verdict, reason}); card body reads it per place.
- **API CONTRACT**: unchanged — `GET /api/telemetry/marine` already returns `suitability:
  [{activityId, verdict, reasons[]}]` (verified live + in server.ts).
- **BACKEND LOGIC**: unchanged — `marineService.assessActivity` (written thresholds,
  activity `maxWindKnots` first) is the single judge; client never computes verdicts.
- **DATABASE IMPACT**: none (live model + corpus thresholds).
- **PERMISSIONS**: public telemetry (already in PUBLIC_RULES).
- **ANALYTICS**: none added this wave (telemetry reads are cached 10 min server-side).
- **LOGGING**: none added; existing marine endpoint logs via structured logger.
- **ERROR STATES**: 503 from the model → `data === null` → strip + badges simply absent
  (honest null, per marineService contract).
- **TESTS**: existing `marineService.test.ts` covers verdicts; `ConditionsBadge` is a thin
  presentational component; regression gate = tsc + full vitest.
- **REGRESSION GATE**: tsc 0 errors ✅ · vitest re-run at end of wave ✅ · build ✅.

### 13-FIELD IMPACT RECORD — Long-stay surface (P2 #8, verification)

- **USER GOAL**: Nomad/long-stay traveler needs the real server-computed weekly/monthly
  price before booking a month.
- **UX FLOW**: Hotel detail → nights selector at 28 → long-stay savings card (server
  pricing) with % saved and month price.
- **UI**: `AccommodationDetailView` long-stay block (i18n `hotels.longStay*`).
- **FRONTEND STATE**: lazy state `longStay` fetched at 28 nights; null when the stay has
  no weekly/monthly rates (honest absence).
- **API CONTRACT**: `GET /api/accommodations/:id/long-stay-price?nights=` +
  `GET /api/accommodations/long-stay` (client `getLongStayPrice`/`getLongStayAccommodations`).
- **BACKEND LOGIC**: `longStayService.computeDurationPrice/computeLongStaySavings`
  (server-computed, never client-invented).
- **DATABASE IMPACT**: `weeklyRateEGP`/`monthlyRateEGP` on accommodations (existing).
- **PERMISSIONS**: public.
- **ANALYTICS**: `listing_view` event only.
- **LOGGING**: standard handler correlation log.
- **ERROR STATES**: no rates → `savings: null` → block hidden; API failure → block absent.
- **TESTS**: `tests/domain/longStayPricing.test.ts` (pricing math, eligibility, savings).
- **REGRESSION GATE**: VERIFIED ✅.

### P2 status after wave
- #6 Supplier calendar UI ✅ (SupplierCalendarMini in portal + CRUD endpoints + tests)
- #7 Verified/reliability badges ✅ (ReliabilityBadge/ReefBadge on ListingCard + supplier-trust e2e)
- #8 Long-stay surface ✅ VERIFIED (server-computed pricing surfaced on hotel detail)
- #9 Reef-impact surface ✅ (TripConservationCard + ReefBadge + reef-traveler e2e)
- #10 /groups flow ✅ (group planning endpoints + TripGroupSplitCard; trip-scoped, not a
  separate route — matches trip-graph model)
- #11 Conditions-on-cards ✅ **IMPLEMENTED this wave**

---

## WAVE P3 — LIVING CHART + GLASS + SEARCH

### 13-FIELD IMPACT RECORD — Living Chart GLSL hero (P3 #13)

- **USER GOAL**: The homepage must *be* the Living Chart — a live dune/sea instrument
  reacting to theme, wind telemetry and scroll — not a stock video loop.
- **UX FLOW**: Load `/` → static gradient+starfield paints instantly (SSR-safe) →
  canvas mounts post-hydration → GLSL dune/sea crossfades in → scroll scrubs the sea
  (max 20% drift) → theme switch re-resolves the palette.
- **UI**: `livingChartShader.ts` (framework-free WebGL: fullscreen triangle, fbm dune/sea,
  gold ember, bone starlight, vignette) + `LivingChartHeroCanvas` wrapper inside
  `CinematicVideoHero`. Video demoted to the no-WebGL fallback; tier-5 `glass-cinema`
  headline plate + `.contour-strata` above the shader.
- **FRONTEND STATE**: `heroScroll` (rAF-throttled scroll measure), `supported`, theme in
  deps; wind from `/api/telemetry/weather` applied via `scene.setWind()`.
- **API CONTRACT**: unchanged — public telemetry endpoint.
- **BACKEND LOGIC**: unchanged.
- **DATABASE IMPACT**: none.
- **PERMISSIONS**: unchanged.
- **ANALYTICS**: none (ambient rendering is not an event).
- **LOGGING**: none added.
- **ERROR STATES**: no WebGL/compile failure → `createLivingChartScene` returns null →
  video/CSS fallback stays. Reduced motion → one static frame, no rAF. Hidden tab →
  loop paused. **StrictMode fix (real bug found in QA):** dispose() previously called
  `WEBGL_lose_context.loseContext()`, after which the same canvas can NEVER re-acquire
  a context — so in dev (mount→cleanup→mount) and on theme re-init the hero fell back
  permanently. dispose() now deletes program+buffer and keeps the context.
- **TESTS**: `tests/domain/livingChartShader.test.ts` (palette hex/color-mix resolution,
  fallbacks, GPU-only null contract) — 5 green.
- **REGRESSION GATE**: tsc ✅ · shader tests ✅ · **live-verified in browser**: canvas
  mounted 841×820, visible, painting (screenshot); hero plate + dock + telemetry intact.

### 13-FIELD IMPACT RECORD — View Transitions (P3 #13)

- **USER GOAL**: Navigation should feel like one continuous chart, not page swaps.
- **UX FLOW**: Any `navigateTo()` → document.startViewTransition (when supported) →
  300ms crossfade; reduced-motion → plain navigation (media query).
- **UI**: CSS `::view-transition-old/new(root)` appended to `src/index.css`;
  `UIContext.pushRoute` wraps the state update in `startViewTransition`.
- **FRONTEND STATE**: none new (wrap-only).
- **API/BACKEND/DB/PERMISSIONS**: none.
- **ANALYTICS/LOGGING**: none.
- **ERROR STATES**: no `startViewTransition` (Firefox/old Safari) → plain navigation;
  `prefers-reduced-motion: reduce` → animation disabled by CSS.
- **TESTS**: covered by UI regression (behavior is additive).
- **REGRESSION GATE**: tsc ✅.

### P3 status after wave
- Glass tiers (tier-1..5, rarity budget, `--glass-mode: solid` for High Contrast Pro) ✅ VERIFIED (pre-existing)
- Unified search + explanation payload + zero-result state ✅ VERIFIED (SearchDrawer + `/api/dahab/search` with whyEn/whyAr)
- Living Chart GLSL hero ✅ **IMPLEMENTED this wave** (incl. StrictMode disposal bug fix)
- View Transitions ✅ **IMPLEMENTED this wave**

---

## WAVE P4 — BOOKING & TRUST

### 13-FIELD IMPACT RECORD — Hold countdown (P4 #15)

- **USER GOAL**: The traveler holding a seat must see the real 15-minute deadline
  instead of losing it silently.
- **UX FLOW**: Transfer step → "Continue" creates the real hold → countdown chip appears
  (green >5min, amber <5, red <2, aria-live) → expiry shows an honest expired state with
  re-select guidance.
- **UI**: `src/components/booking/HoldCountdown.tsx` (tabular-nums MM:SS, role=timer,
  urgency tiers, `TimerOff` expired state), mounted in `BookingTransferStep` above the
  header context when a hold is active.
- **FRONTEND STATE**: `holdExpiresAt` captured from the hold response (was only ever
  written to sessionStorage); cleared on expire.
- **API CONTRACT**: unchanged — `/api/commerce/hold` already returns `expiresAt`.
- **BACKEND LOGIC**: **state-truthfulness fix**: `completeMultiServiceCheckout` no longer
  converts an EXPIRED/RELEASED hold — previously it moved held→reserved capacity for a
  hold that had already given its seats back, reserving inventory the supplier cannot
  deliver. Only `status === 'ACTIVE'` converts.
- **DATABASE IMPACT**: holds/inventory only via the existing (fixed) transitions.
- **PERMISSIONS**: unchanged (hold endpoint is session-owned).
- **ANALYTICS**: `hold_countdown_viewed`, `hold_expired` added to client allowlist AND
  server `ALLOWED_EVENT_NAMES` (otherwise dropped at ingest).
- **LOGGING**: analytics events carry `expiresAt` metadata.
- **ERROR STATES**: expired → red state, no fake timer; malformed `expiresAt` →
  `Date.parse` NaN → countdown treats as expired (safe direction).
- **TESTS**: component covered indirectly via domain fixes; `tests/domain/bookingTrust.test.ts`
  covers the hold/availability truth (9 tests).
- **REGRESSION GATE**: tsc ✅ · domain suite ✅ (incl. the two i18n placeholder tests the
  wave fixed: `booking.tripSummaryLine` missing `{travelerWord}` in ar).

### 13-FIELD IMPACT RECORD — Sold-out alternatives (P4 #15)

- **USER GOAL**: On a 409 sold-out hold the traveler needs real alternatives NOW.
- **UX FLOW**: hold fails 409 → alternatives panel fetches server truth → tap an
  alternative → selection switches and the traveler retries the hold.
- **UI**: inline panel in `BookingTransferStep` (loading / list / per-item price,
  bilingual reason, seats left).
- **FRONTEND STATE**: `alternatives`, `alternativesLoading`; cleared on next attempt.
- **API CONTRACT**: **new** `POST /api/commerce/alternatives` `{tripId, skuId, date,
  timeSlot?, passengersCount, limit?}` → `{alternatives: [{skuId, title, titleAr,
  serviceType, supplierId, basePriceEGP, currency, timeSlot, available, status, reason,
  reasonAr}]}`. Trip-ownership enforced (mayActOnTripsOf).
- **BACKEND LOGIC**: `commerceService.findAlternatives` — same availability math as
  `createHold` (`total − (reserved + held)`), runs `releaseExpiredHolds()` first, ranks
  by price distance then seats, same serviceType + active only, never the origin SKU.
- **DATABASE IMPACT**: reads skus/slots/holds; writes only expired-hold release.
- **PERMISSIONS**: authenticated, trip-owned.
- **ANALYTICS**: `alternative_selected` (client + server allowlist).
- **LOGGING**: standard handler correlation.
- **ERROR STATES**: unknown origin SKU → `[]` (no guesses); API failure → panel hides.
- **TESTS**: `tests/domain/bookingTrust.test.ts` — ranking, capacity exclusion, expired
  hold release, inactive/origin exclusion, unknown SKU.
- **REGRESSION GATE**: ✅ (9/9 new tests green, domain suite green).

### 13-FIELD IMPACT RECORD — Price explainer (P4 #15)

- **USER GOAL**: "Why is the total what it is?" answered from catalogue truth, not vibes.
- **UX FLOW**: payment step cost card → "Why this total?" toggle → per-line basis
  (per-person ×N or whole-stay) + supplier cancellation window; amounts remain the real
  charge lines this checkout settles (no competing catalogue total).
- **UI**: expandable block in `BookingPaymentStep` cost breakdown card.
- **FRONTEND STATE**: `priceExplanation` (lazy fetch on first expand), `showPriceExplainer`,
  `priceExplanationError`.
- **API CONTRACT**: **new** `POST /api/commerce/explain-price` `{tripId, items:[{skuId,
  passengersCount?, nights?}]}` → `{currency, lines:[{skuId, title, titleAr, serviceType,
  basis, passengersCount, nights, unitPriceEGP, amountEGP, supplierId,
  cancellationPolicyHours}], totalEGP}`. Trip-owned.
- **BACKEND LOGIC**: `commerceService.explainPrice` — hotel = per-stay (basePriceEGP is
  the block), everything else per-person; UnknownSkuError on catalogue miss.
- **DATABASE IMPACT**: read-only on productSkus.
- **PERMISSIONS**: authenticated, trip-owned.
- **ANALYTICS**: `price_explainer_opened` (client + server allowlist).
- **LOGGING**: standard.
- **ERROR STATES**: fetch failure → honest "could not load" note; closed state → nothing.
- **TESTS**: `tests/domain/bookingTrust.test.ts` — per-person, per-stay, mixed basket
  totals, cancellation windows, unknown-SKU throw.
- **REGRESSION GATE**: ✅.

### P4 status after wave
- #15 Hold countdown ✅ IMPLEMENTED · alternatives ✅ IMPLEMENTED · price explainer ✅
  IMPLEMENTED · hold-conversion state-truthfulness ✅ FIXED · i18n placeholder parity fix ✅

---

## WAVE P5 — MOBILE-FIRST

### 13-FIELD IMPACT RECORD — Mobile dock ≤5 + 375px AR QA (P5)

- **USER GOAL**: A one-thumb traveler on a 375px phone gets a comfortable bottom dock and
  a page that never scrolls sideways — in Arabic (RTL) as much as in English.
- **UX FLOW**: Any page at 375px → dock shows exactly 5 primary destinations (thumb
  range), search stays one tap away in the header; menu → grouped site map; sheets via
  `MobileSheet`.
- **UI**: `V2Navbar` mobile dock — the 6th item (search button) removed; dock now =
  [/home] Discover · Hotels · Explore · Food · My Trip (5). Search remains reachable via
  the always-visible header button + mobile-menu quick action + ⌘K.
- **FRONTEND STATE**: none new.
- **API/BACKEND/DB/PERMISSIONS**: none.
- **ANALYTICS**: none (navigation events already tracked elsewhere).
- **LOGGING**: none.
- **ERROR STATES**: no-route fallback already handled by the router.
- **TESTS (live 375×812, Playwright MCP, AR locale)**:
  - dock items = **5**, zero item overflow beyond viewport ✅
  - `document.dir = rtl`, horizontal overflow = **false** on `/`, `/my-trip`, `/explore` ✅
  - min dock touch target = **48px** ✅ (44px minimum)
  - hero H1 at 48px, text rgb(245,242,236) on ink shader plate — contrast preserved ✅
  - Living Chart canvas renders full-bleed at 369×881 on mobile ✅
  - console errors limited to the two honest signals (401 anonymous auth probe, 503
    marine model down — both by design) ✅
  - screenshots archived: `tests/browser-qa/screenshots/wave-p5/*.png` ✅
- **REGRESSION GATE**: tsc ✅ · dock ≤5 ✅ · 375px AR pass ✅.

### P5 status after wave
- Bottom nav ≤5 ✅ **IMPLEMENTED this wave** (search demoted to header) · MobileSheet
  primitive ✅ VERIFIED (pre-existing) · SinaiFloatingQuickDock consolidation ✅ VERIFIED ·
  375px AR QA ✅ **EXECUTED this wave**

---

## WAVE P6 — OPS/SUPPLIER ATTENTION

### 13-FIELD IMPACT RECORD — Supplier Revenue & Analytics tab (P6)

- **USER GOAL**: A supplier must see what the platform owes them and how their business
  is trending, computed from their real bookings — not a hardcoded 4.9 or a made-up 99%.
- **UX FLOW**: Supplier portal → "Revenue & Analytics" tab → totals cards (gross, earned
  payout, escrow, scheduled payouts) → completion rate / avg booking / cancelled chips →
  by-service-type table → top bookings.
- **UI**: New tab in `SupplierPortalView` (between Rentals and Reliability), bilingual.
- **FRONTEND STATE**: `revenue` via `useApiResource` (same enabled-gate as the dashboard;
  status-based loading/error rendering).
- **API CONTRACT**: **new** `GET /api/suppliers/:supplierId/revenue-analytics?days=` →
  `{supplierId, windowDays, currency, totals{grossBookingsEGP, payoutEGP,
  escrowPendingEGP, payoutScheduledEGP, bookingsCount, completedCount, cancelledCount,
  rejectedCount, completionRate, avgBookingEGP}, byServiceType[], daily[], topBookings[]}`.
  Same `resolveActingSupplierId` ownership rule as the dashboard.
- **BACKEND LOGIC**: `supplierService.getSupplierRevenueAnalytics` — same bookings and
  same 85% share as `getSupplierDashboard`; daily UTC buckets over a 7–90 day window;
  scheduled payouts read `payoutSchedule` (PENDING only).
- **DATABASE IMPACT**: read-only on bookings + payoutSchedule.
- **PERMISSIONS**: supplier-owned (Operations/Admin via the same resolve rule).
- **ANALYTICS**: none (supplier-own data, not traveler funnel).
- **LOGGING**: standard handler correlation.
- **ERROR STATES**: no linked supplier → explanatory empty state; fetch failure →
  retry note; empty book of business → nulls and zeros, never invented numbers.
- **TESTS**: `tests/domain/supplierRevenueAnalytics.test.ts` — 6 tests (payout share &
  completion rate, empty-state nulls, window exclusion, service-type grouping, scheduled
  payouts, top-booking ranking).
- **REGRESSION GATE**: ✅ (tsc + suite green).

### P6 status after wave
- Attention queue ✅ VERIFIED (Intelligence Core `/api/intelligence-core/attention` +
  AttentionPanel; 401 unauthenticated by design)
- Ops revenue ✅ VERIFIED (CommerceControl: `/api/operations/payments` + ledger +
  anomalies + verify)
- Supplier Revenue & Analytics ✅ **IMPLEMENTED this wave**

---

## WAVE P7 — SCALE & HARDEN

### Verification record (no code changes required — verified against source + live)

- **Payments sim discipline** ✅ `paymentService.simulationAllowed()`: off in production
  unless `ALLOW_SIMULATED_PAYMENTS=true`; simulated settlements are flagged `simulated:
  true` and never presented as settled money; CASH_ON_ARRIVAL honestly PENDING.
- **Paymob webhooks** ✅ rejected without `PAYMOB_HMAC_SECRET` (timing-safe compare,
  replay protection, failure-transition fix already in place); `ENABLE_TEST_ENDPOINTS`
  unset → golden-journey 401s (verified live) and stays off wherever real data lives.
- **Rate limiting** ✅ shared SQLite fixed-window store (`rateLimitStore.ts`) —
  multi-process correct on one machine, fail-open, `shared: false` contract documents
  the cross-machine gap.
- **Locks** ✅ `distributedLockService` (fencing tokens, lease expiry, file+DB sweep)
  gates hold creation and checkout slot mutations.
- **Persistence** ✅ `selectAdapter` sqlite/json/postgres; Postgres adapter refuses to
  boot without a connection. **Not certified against a live Postgres instance** —
  per plan, the default stays sqlite and the flag stays documented, not flipped.
- **Redis** — **NOT PRESENT, documented**: the only cross-machine gap named in code is
  rate limiting (see rateLimitStore header). No Redis dependency is warranted for the
  current single-host deployment; adding one before multi-host is speculative scope.
- **Media variants** ✅ CMS upload pipeline writes 400/800/1200px responsive variants
  (never upscaled), original + variants cleaned on asset delete.
- **Offline** ✅ offline passbook/voucher caching + queued-mutation engine
  (`offlineStorage.ts`) and the traveler-facing Offline Trip Pack modal; `offline`
  listeners degrade honestly in BookingsView/SinaiPassbook.
- **Gemini quota** ✅ `/api/health` reports `geminiQuota` with deterministic canned
  fallback on exhaustion (live check: not exhausted).
- **Correlation logging** ✅ `withCorrelation` wraps mutating handlers; analytics ingest
  logs batches with counts.

### P7 status after wave
All feasible hardening items VERIFIED; two documented not-certified items: live-Postgres
adapter certification and cross-machine (Redis-class) rate-limit sharing — both carry
documented contracts and are safe on the current single-host deployment.

---

## FINAL REGRESSION BATTERY (2026-09-10)

- `tsc --noEmit`: **0 errors**
- `vitest run` (node): **1150 passed**, 5 skipped (Paymob live, secret-gated)
- `vitest run --config vitest.ui.config.ts` (jsdom UI): **52 passed**
- `vite build`: green — warning surfaced for index (911.67 kB, gzip 266.61 kB; up from
  894.79 kB baseline with this wave's booking-trust + supplier-analytics features; DayGI
  and all vendor splits intact; no simulator chunk)
- Dev server on **:3000**: `/api/health` ok, `/` 200
- Browser QA: P3 hero (screenshot), P5 375px AR (3 screenshots archived), console clean
  of unexpected errors

## CERTIFICATION SUMMARY

| Wave | Verdict |
|---|---|
| P0 baseline | ✅ VERIFIED (PHASE_0_REPORT + battery) |
| P1 hygiene | ✅ VERIFIED (5/5 items, incl. bundle-budget sub-items) |
| P2 capability→UI | ✅ VERIFIED + ConditionsBadge implemented |
| P3 Living Chart | ✅ GLSL hero implemented (incl. StrictMode WebGL disposal fix) + View Transitions; glass tiers + unified search verified |
| P4 booking & trust | ✅ hold countdown + alternatives + price explainer implemented; expired-hold conversion fixed |
| P5 mobile-first | ✅ dock ≤5 + 375px AR QA pass (48px targets, no h-overflow) |
| P6 ops/supplier | ✅ Revenue & Analytics implemented; attention + ops revenue verified |
| P7 scale & harden | ✅ verified; 2 documented not-certified items (live Postgres, cross-machine rate limit) |

Every changed capability carries its 13-field Impact Record above. Remaining honest gaps
are external-integration realities (no payment gateway, no SMS gateway configured,
marine model upstream down at QA time — all degrade honestly by design).

---

## POST-CERTIFICATION — E2E RE-RUN & CONTRACT FIXES (2026-09-10, later session)

The certification above carried one explicit caveat: the Playwright suite had not been
re-run since the review feature landed. The advised re-run was executed and found
**18 failures (6 unique × 3 projects) — all API-contract tests in ci-smoke.spec.ts.**
Four real defects, all fixed and regression-covered:

1. **Public reads 401'd: `GET /api/reef-action-types`, `GET /api/bundles`,
   `POST /api/bundles/compute-discount`.** The handlers were written public but had no
   PUBLIC_RULES entry — the deny-by-default gate (by design) answered 401. Added public
   rules: the reef scoring rubric (same class as the reef-positive list) and the bundle
   catalogue read + cart calculator. Bundle mutations stay Admin/Operations.
2. **Six dead ROLE_RULES with an `/api/…` prefix.** Paths arrive relative to the `/api`
   mount, so `/^\/api\/bundles…/`, `/^\/api\/fraud\//`, `/^\/api\/support\/…/` and
   `/^\/api\/payouts\/pending$/` never matched — those surfaces ran on the
   authenticated default (any signed-in role) instead of the roles the file says.
   Patterns fixed to mount-relative. Latent companion bug: `requiredRolesFor()` ignored
   a rule's `methods`, so method-scoped rules would have gated every method on the
   path — the middleware now passes the method, and `GET /bundles/:id` stays on the
   authenticated default while its mutations stay role-gated.
3. **`GET /api/accommodations/long-stay` → 404 "Accommodation not found."** Route
   shadowing: the accommodation router's `/:slug` (registered earlier) swallowed the
   path as a slug lookup. Moved into `accommodationRoutes.ts` BEFORE `/:slug`; the dead
   copy in server.ts removed with a pointer comment.
4. **`GET /api/suppliers/:id/availability` invented a calendar.** An unknown supplier
   got `{blocked: false}` for 30 days — a promise nobody made, readable as verified
   availability. Route now 404s via new `supplierCalendarService.supplierExists()`;
   real suppliers still serve the view.

**Discovered + closed while fixing #4:** `supplierCalendarService` shipped with its
full CRUD/query surface, but `isDateBlocked`/`isRangeBlocked` had **zero call sites** —
supplier blocks never actually gated anything, despite the service docblock claiming
"rejects the booking at checkout time". The calendar now gates all three chokepoints
in `commerceService`:

- `createHold` → throws `SupplierDateBlockedError` (409, carries supplier/date/reason)
  before any hold row or capacity reservation;
- `completeMultiServiceCheckout` → same check in the resolve loop BEFORE
  `processCheckout` (money rows are written outside the booking transaction — a later
  discovery would leave the traveler charged for a booking the supplier already
  refused);
- `findAlternatives` → candidates whose supplier blocked the date are excluded, so the
  sold-out recovery panel only shows servable options.

### Tests + battery

- New: `tests/domain/supplierCalendarGate.test.ts` (15) — hold/checkout/alternatives
  gates, boundary dates, no-money-on-block, multi-item, alternatives honesty.
- Extended: `apiAccessPolicy.test.ts` (public reef/bundle rules, dead-pattern
  regression incl. method-scoped role rules), `supplierCalendar.test.ts`
  (`supplierExists`).
- **Battery**: tsc 0 errors · node **1171 passed** (+21), 5 skipped (secret-gated) ·
  UI **52 passed** · `vite build` OK (index 911.67 kB / gzip 266.61 kB — pre-existing
  budget overrun, unchanged by this session; split is the next workstream) ·
  **E2E 116 passed / 10 skipped (desktop-only by design) / 0 failed** — first fully
  green E2E run since the review feature landed.
- Dev server restarted on :3000 with all fixes live; all five formerly-failing
  endpoints verified by hand (200/200/200/404/400 as appropriate).

---

## FOLLOW-UP SESSION — BLOCKED-DATE UX + BUNDLE BUDGET (2026-09-10, same day)

Two workstreams closing the loop on the fixes above: making the new 409 honest in the
traveler UI, and the index chunk back under the 650 kB budget it had been exceeding.

### Blocked-date 409 surfaced in the booking flow

- `api.createHold` now carries the server's structured `status` + `details`
  (skuId/supplierId/date/reason) on the thrown error — the UI no longer has to
  regex-parse prose to classify a failure.
- `BookingTransferStep`: the supplier-date-blocked 409 gets its **own state**, distinct
  from sold-out — amber panel (not red), `CalendarOff` icon, the supplier's own block
  reason, the blocked date, and an explicit "this is not sold out — the supplier closed
  the date themselves" line so a traveler understands why no amount of seat-hunting
  helps. Bilingual inline, matching the file's style.
- The alternatives panel now tells the truth when the search succeeds but nothing is
  servable: "Nothing servable for this date — we will not invent seats" (empty state,
  previously the panel silently vanished).
- Sold-out flow unchanged: red error + ranked alternatives as before.

### Index chunk under budget (911.67 kB → 543.90 kB)

- **Composition (measured via the build's sourcemap `sourcesContent`, not guessed):**
  `i18n/translations.ts` 346 kB source ≈ **51% of the chunk** (the entire ~1,940-key
  bilingual dictionary shipped before first paint); then `services/api.ts` 104 kB,
  `data/intelligenceData.ts` 78 kB, `V2Navbar` 55 kB, `data/dahabGeography.ts` 49 kB,
  `travelerJourneyEngine` 36 kB, `tripOsDefaults` 35 kB, and ~35 more eager files.
- **Fix:** `manualChunks` now emits the dictionary as its own `i18n-dictionary` chunk
  (368 kB / gzip 114 kB). The index chunk **statically imports it** (`from
  "./i18n-dictionary-…js"` in the built output), so the browser fetches and executes it
  before any app code — `t()` can never render a raw key, no key-flash, no async
  loading states, zero app-code change. Cache win: returning travelers stop
  re-downloading ~440 kB of strings on every deploy that does not touch copy.
- Result: **index 543.90 kB / gzip 153.17 kB** (was 911.67 kB / 266.61 kB), under the
  650 kB budget. The only chunk still over the limit is `vendor-firebase` (749 kB) —
  pre-existing, dynamically imported only for federated sign-in, off the critical
  path.
- Documented follow-up (the bigger real win, deliberately not rushed): split the
  dictionary per language (~50% true byte cut on first visit) behind a registry filled
  by a dynamic import before first render; needs the `i18nCoverage` gate and
  `LanguageContext` to guarantee load-before-render and needs careful test updates.

### Battery (final tree)

tsc 0 · node **1171 passed** / 5 skipped (secret-gated) · UI **52 passed** · build OK
(index **543.90 kB**, gzip 153.17 kB) · E2E 115 passed + mytrip-baseline 3/3 on the
documented Windows snapshot file-lock retry (0 real failures). Dev server on :3000
needs no restart for client-only edits; server-side fixes from the earlier session
remain live.

---

## SESSION — PER-LANGUAGE DICTIONARY SPLIT + FULL-PLAN RE-VERIFICATION (2026-09-11)

### Per-language dictionary split (the documented follow-up, implemented)

- Client code no longer imports `src/i18n/translations.ts` at all (server catalog keeps
  it as the authoring source). Client runtime resolves `t()` through a registry
  (`src/i18n/translator.ts`) fed by two GENERATED per-language modules
  (`src/i18n/dictionaries/{en,ar}.ts`, emitted by `npm run i18n:emit` from the catalog).
  Shared resolution logic lives in `src/i18n/resolve.ts` (pure, semantic — one
  implementation, no drifting copies); boot contract in `src/i18n/boot.ts`.
- Boot-order guarantee: `main.tsx` decides the initial language once, awaits its
  dictionary via dynamic import, fetches App **in parallel** (no extra pre-paint
  waterfall), and only then renders. Alternate language preloads at idle → sync
  toggles, no raw-key flash, no fallback flicker. A failed dictionary fetch degrades
  to the compiled fallback copy instead of a blank page.
- Build: index entry **2.45 kB** (boot glue only), `i18n-en` **184.18 kB** (gzip 59.81),
  `i18n-ar` **244.11 kB** (gzip 73.58) as standalone chunks. First-visit pre-paint
  dictionary bytes: 114 → 60 gzip kB (EN) / 74 (AR), ~45% cut; App chunk fetched in
  parallel with the dictionary.
- Gates: `tests/domain/i18nDictionarySync.test.ts` enforces (1) catalog↔dictionary sync,
  (2) EN/AR registry parity, (3) an **absolute ban** on client imports of
  `translations.ts` — including sibling `'./translations'` forms (negatively tested by
  planting a violation). Test environments seed the registry via `tests/i18nSeed.ts`
  wired into both vitest configs' setupFiles.
- Live QA on :3000: AR boot fully resolved (RTL), instant EN toggle (LTR, full copy),
  language restored; console clean apart from the documented benign anonymous-401s.

### Full plan re-verification (P0–P7) against the current tree

The certified battery was re-run on today's tree (which additionally carries the split
above and the date-rot fix below) — plan gates still hold, wave by wave:

- `tsc --noEmit`: **0 errors**
- `vitest run` (node): **1176 passed**, 5 skipped (Paymob live, secret-gated) — up from
  the certified 1171 (+5 from the i18n split's gate tests)
- `vitest run --config vitest.ui.config.ts`: **52 passed**
- `vite build`: green — index 2.45 kB, i18n-en/ar standalone (above), budget limit 650
  intact, no simulator chunk
- **E2E (Playwright, 3 projects): 116 passed / 10 skipped (desktop-only supplier-trust
  specs by design) / 0 failed**
- Wave artifacts re-verified in source: P1 (emoji/token/bundle discipline — enforcement
  tests green), P2 (`ConditionsBadge`, `TripGroupSplitCard`, long-stay + reef surfaces),
  P3 (`LivingChartHeroCanvas` + `livingChartShader.ts` GLSL hero, View Transitions,
  glass tiers, `unifiedSearchEngine` ↔ `SearchDrawer`), P4 (`HoldCountdown`,
  alternatives, price explainer, blocked-date 409 UX), P5 (`SinaiFloatingQuickDock` /
  `ThumbBar`, 375px AR specs in the green E2E run), P6 (`/api/intelligence-core/attention`,
  supplier Revenue & Analytics, ops command-center), P7 (deny-by-default policy tests,
  ledger integrity — unchanged and green).
- Dev server verified live on **:3000** (`/api/health` ok, `/` 200, both languages
  render); the earlier VS Code port-forward conflict remains resolved — :3000 is the
  canonical dev port.

### Rental test date-rot fix (found during re-verification)

`tests/domain/rentalAvailability.test.ts` and `rentalPricing.test.ts` hardcoded
`2026-09-10` fixture dates — the suite began failing purely by calendar (yesterday's
date violates `assertBookingWindow`'s no-past-starts rule) and would fail every day
after. All fixture dates now derive from the service's `todayLocal()` contract via a
`future(offset)` helper; rentals 21/21 green; node suite back to fully green.

### Wave verdicts (unchanged)

P0 ✅ · P1 ✅ · P2 ✅ · P3 ✅ · P4 ✅ · P5 ✅ · P6 ✅ · P7 ✅ — re-certified on the
2026-09-11 tree. Remaining honest gaps are unchanged and external: no live payment
gateway, no live SMS gateway, Postgres adapter not certified against a live instance
(2 documented not-certified items).