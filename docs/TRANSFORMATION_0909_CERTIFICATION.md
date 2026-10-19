# 2026-09-09 Transformation Certification
## Blueprint P0/P1 + quick wins + availability-joined AI + Postgres save() port

*Date: 2026-09-09. Tree: `D:\dahab-—-travel-platform` (master, working tree). Scope: the
execution phase of `DAHAB_TRANSFORMATION_BLUEPRINT.md` (Phase 0 trust/integrity rows,
P1 discovery rows, and the "quick wins" list).*

---

## 1. Battery (all green on the final tree)

| Gate | Command | Result |
| :--- | :--- | :--- |
| Typecheck | `npx tsc --noEmit` | 0 errors |
| Unit (node) | `npx vitest run` | **915 passed**, 5 skipped (Paymob live secret-gated) |
| Unit (UI/jsdom) | `npx vitest run --config vitest.ui.config.ts` | **23 passed** |
| Client build | `npx vite build` | OK; **no Ahmed-simulator chunk** in `dist/assets/` (tree-shaken) |
| Server bundle | `npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external` | OK (`dist/server.cjs`, 2.2 MB) |
| E2E (Playwright) | `npx playwright test` (en + ar, isolated port 3100 + throwaway data dir) | **32/32 passed** (2.1 min) — last full run before the review feature; re-run advised |

## 2b. Review integrity — verified-stay reviews (blueprint row #14, completed after the first battery)

- `reviewService.ts` — the verified-stay gate: the reviewer must own the
  booking's **trip** (`BookingEntity` carries no userId; ownership lives on
  the trip, same boundary as `bookingService.requireOwnership`), and the
  booking must be `COMPLETED` or `paymentState=CAPTURED`. Rejections are
  machine-readable (`ReviewRejectedError` with 404 / 403 / 409) so routes
  never leak booking existence. Ratings clamped to 1–5; one review per
  booking (resubmission replaces and re-enters moderation).
- Lifecycle: every new review starts `pending`; ops approves / flags / hides
  via `POST /api/reviews/:id/moderate`; only approved reviews are public.
  Suppliers respond once to their own approved reviews
  (`POST /api/reviews/:id/respond`, acting supplier resolved from the
  session via `resolveActingSupplierId`).
- Invitation loop: `supplierService.updateBookingState(COMPLETE)` sends a
  `REVIEW_INVITATION` notification; `GET /api/bookings/:ref/review` returns
  `{ review, invitation }` driving the bookings-surface CTA;
  `submitReview` marks the invitation consumed. Public aggregate + list at
  `GET /api/reviews/supplier/:id` (display names only, never emails/phones).
- Persistence: `reviews` TableSpec (promoted booking_ref/user_id/
  supplier_id/moderation_status + composite index); SQLite + Postgres DDL
  regenerated — **57 tables** in both dialects.
- Traveler UI: `ReviewInvitations` panel on `/bookings` (star + text form,
  bilingual, verified badge note, consumes its CTA on success).
- Tests: `tests/domain/reviewService.test.ts` (13) — gate (owner/403/404/
  409/captured/clamp/replace), moderation + supplier response, invitation
  lifecycle incl. cross-traveler isolation.
- Live QA on :3000: public read 200 `{reviews:[],average:0,count:0}`; anon
  writes 401; authed POST for unknown ref → 404 `Booking not found.`;
  invalid rating → 400. QA account used for the smoke test was removed from
  the dev DB afterwards.

## 2. Blueprint rows shipped (verified in code + tests)

| Blueprint row | What landed | Evidence |
| :--- | :--- | :--- |
| #1 Hero literal fix + content integrity | `server/services/textIntegrity.ts` refuses literal escape sequences (`\u2019`, `\n`…) on CMS page/block/string writes; 400-class error names the field | `tests/domain/textIntegrity.test.ts` (12) |
| #4 404 + SEO | `NotFoundView` + `/404` route; `isKnownClientPath()`; server SPA fallback serves real 404 for unknown paths; meta injection (og/twitter/canonical/hreflang) | `routeUrl.test.ts`, e2e 404 flow, live screenshot |
| #5 Booking timeline + manage | `src/shared/bookingTimeline.ts` + `BookingTimeline`/`BookingManageModal`; server booking manage/re-schedule APIs | `tests/domain/bookingTimeline.test.ts`, `bookingManage.test.ts` |
| #7 Shared rate limits | `server/middleware/rateLimitStore.ts` (in-memory, per-process, GC'd) replacing per-route maps | `tests/domain/rateLimitStore.test.ts` |
| #8 Backups | `server/services/backupService.ts` — verified boot pass + scheduled (default 6 h), retention; wired in `server.ts` | `tests/domain/backupService.test.ts` |
| #9 Marine conditions (P1) | `server/services/marineService.ts` (Open-Meteo marine model) + `GET /api/telemetry/marine` + `MarineConditions` on `/live`; per-activity go/caution/avoid from written thresholds | `tests/domain/marineService.test.ts`, live QA |
| #11 Unified search (P1) | `unifiedSearchEngine` + `GET /api/dahab/search` bilingual NL search over catalogue, with parsed-interest echo | `tests/domain/unifiedSearch.test.ts` |
| #19 Missing-AR CI (P1) | `tests/domain/i18nCoverage.test.ts` — every `t()` key must resolve with Arabic + English | suite gate |
| CMS catalog bindings | `cms_content_bindings` (draft→schedule→publish), `CATALOG_FIELD_REGISTRY` deny-by-default fields, public read merges published overlays; admin registry + browse UIs | `tests/domain/catalogBindings.test.ts` (25), live QA |
| Postgres DDL gen (P0 #3 groundwork) | `server/db/postgres/pgDdl.ts` — PG DDL generated from `tableSpecs.ts` (JSONB data, checksum-guarded migrations); `npm run db:schema:pg` | `tests/domain/postgresDdl.test.ts` |

## 3. Quick wins (audit §H list)

| Win | What landed | Evidence |
| :--- | :--- | :--- |
| Toast queue + SR separation | `toasts[]` with per-toast timers (no overwrites); visual stack aria-hidden; separate polite live region holds newest toast — route announcements can't be clobbered | Live QA: 4 toasts queued in order; two independent sr-only regions |
| CMS tab grouping | 10 tabs grouped CONTENT / CATALOG & DATA / SITE & MEDIA; every key stays a `CmsTab`; `#cms/<tab>` deep links intact | Live QA incl. tab switch |
| `useContentPage` slug refetch | `useCmsFetch(fn, fallback, deps)`; `[slug]` / `[menuKey]` deps; stale data cleared per load | Live QA `/about`→`/faq` |
| Dead Firebase path | `testConnection()` self-invoked unauthenticated probe removed; all remaining exports live-wired | — |
| Dev-simulator out of prod bundle | Ahmed walkthrough import gated `DEV \|\| VITE_SHOW_JOURNEY_SIMULATOR=true`; prod build contains no walkthrough chunk | `dist/assets/` inspection |

## 4. Availability-joined AI generation (P1 #10, completed)

- `server/services/availabilityJoinService.ts` — `enrichItinerary` replaces every
  hallucinated price with the real DB price + bookability (`resolveBookability`),
  attaches `skuId`, zeroes unsellable items (never an invented number), totals only
  bookable prices, reports `bookablePercent`. Wired into **both** the Gemini path and
  the deterministic fallback in `/api/trip/generate`.
- `/api/trip/apply-ai` now accepts the enriched shape: `skuId` + `priceEGP` are
  persisted, and the server re-resolves the price from the DB (`resolveSkuPrice`) —
  the client can never smuggle a price; a stale SKU is trusted with nothing.
- Client (`PlanWithAiWidget`, `api.ts`) forwards `priceEGP`/`skuId`, renders real
  prices without the `≈` estimate marker, and saves bookable items holdable.
- Tests: `tests/domain/availabilityJoin.test.ts` (8) — substitution, category→
  service-type mapping, inactive-SKU exclusion, totals/percent, resolveSkuPrice
  authority.

## 5. Postgres save() port (P0 #3, completed — not yet certified against a live instance)

- `server/db/postgres/pgFlush.ts` — pure shadow-diff flush planner: deletes
  child-first / upserts parent-first (TABLE_SPECS order), cheap `seq` reseqs for
  reorders, `store_meta` last; PostgreSQL upsert SQL with promoted columns + JSONB
  `data`, mirroring the SQLite adapter's diff contract.
- `PostgresPersistenceAdapter.save()` — lazy checksum-guarded schema application
  (`initializeSchemaFromSpecs`), single-transaction flush, serialized fire-and-forget
  saves (sync interface, async driver), failures recorded on `lastSaveError` for
  `/api/health` instead of silent unhandled rejections.
- `selectAdapter.ts` postgres branch now boots on connection config (no
  `ALLOW_NONPERSISTENT_POSTGRES_ADAPTER`); `assertUsable` refuses without
  `DATABASE_URL`/`PG*`; health reports "PostgreSQL (spec-schema, diffed save())".
- Tests: `tests/domain/pgFlush.test.ts` (8) — planner diffing/ordering + adapter
  save() transaction flow through a fake pool.

## 6. Remaining (explicitly NOT certified)

- Real payment capture (Paymob live cert) — simulated path only; live tests gated on `PAYMOB_HMAC_SECRET`.
- Real SMS delivery (Twilio) — seeds/sim only.
- **Postgres against a live instance** — schema/migration runner + save() are unit-
  and DDL-tested, but no provisioned PG has run the boot+restart durability drill.
- Multi-replica (Redis locks/quota), object-storage media, offline-pack e2e.

## 7. Notes

- Two concurrent agent threads edited this tree mid-session (media-variants feature
  in `catalogContentService`/`mediaLibrary.test.ts`); the stale overlay-meta
  expectation was updated to include `variants`/`srcset`.
- Dev server left running on `:3000` with all changes live; QA admin account used
  for ops-console checks was removed afterwards (dev DB returned to prior state).
- Seed data, `.env`, and `data/` are untouched by this certification (E2E runs on a
  throwaway dir; unit tests run on the in-memory adapter with the fs tripwire green).