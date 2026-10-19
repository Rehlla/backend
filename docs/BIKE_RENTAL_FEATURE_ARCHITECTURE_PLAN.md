# Dahab Bike Rental — Architecture & Implementation Plan

**Status:** Planning only — no code written
**Audience:** Senior engineer(s) executing the build
**Date:** 2026-09-06
**Method:** Existing-codebase audit (executable source authoritative) → international research (bike rental platforms, rental management systems, marketplace UX) → Dahab-specific product design → phased implementation plan

---

## 1. Executive Summary

Dahab's rental market is real but un-digitised: bicycles rent for ~5 €/day, e-scooters ~12 €/24h, quad bikes from ~15 €/day, monthly bikes from 250 EGP (observed on local Facebook/Instagram listings and TripAdvisor gear-rental pages: Koka Bikes, Dahab city Bike, Sinai Motors, Sea The Soul of Sinai). Every one of those businesses takes bookings through WhatsApp/Instagram DMs. There is no online availability, no calendar, no double-booking protection, and no price transparency — which is exactly the gap this feature closes.

The platform already contains a **production commerce engine**: quantity-based inventory (`productSkus` → `inventory_slots` → `holds` → `bookings` → `payments` → double-entry `ledger_entries`), 15-minute holds, idempotency keys, distributed locks with fencing tokens, a deny-by-default API policy, a supplier portal with accept/reject/complete workflows and 85% payout settlement, bilingual UI, and a seeded hotel catalogue that is a near-perfect structural template (seed file → catalogue list → slug detail → bookability → checkout).

**The core recommendation: do not build a parallel rental platform. Extend the existing commerce engine with one new vertical (`rental`), one new domain row (`rental_bookings`) for date-range bookings, and one new catalogue surface (`rental_listings`), following the hotels pattern exactly.** Inventory stays **quantity-based per day** (Option B), because that is what the existing engine already does, what Dahab shops actually operate (a fleet of "mountain bikes", not serial-numbered assets), and what travelers ask for ("I need 2 bikes for me and my wife").

MVP ships: discovery (list + filters + detail), server-side availability + quoting, a mobile-first 6-step booking flow, payment (existing simulated/card-last4 path), provider accept/reject + mark-returned + maintenance blocks, admin listing approval, notifications, ledger payout. Phase 2 adds provider self-service listing creation, damage reporting, deposits via a real gateway, delivery zone management, and asset-level tracking. The rental domain is designed so e-bikes, scooters, surfboards, SUP, kayaks and camping gear slot in as new categories **without touching the booking architecture**.

---

## 2. Existing Project Analysis

### 2.1 Current architecture

Single Node.js process: Express 4.21 API + React 19 SPA (Vite, Tailwind 4, Motion, Lucide, no React Router — routing is a `switch (currentRoute)` in `src/App.tsx` with lazy views). Persistence is adapter-based (`PERSISTENCE_ADAPTER`), SQLite default via `better-sqlite3` (WAL, FKs, indexes). The runtime working set is an **in-memory `DatabaseState`** (`server/db/database.ts`, 40+ typed arrays) hydrated from the adapter; every table stores the full entity as JSON in a `data` column plus promoted indexed columns defined in one place (`server/db/sqlite/tableSpecs.ts`).

### 2.2 Systems that already exist (reuse map)

| Existing system | Location | What it gives the rental feature |
|---|---|---|
| Quantity inventory engine | `server/services/commerceService.ts` | `checkAvailability`, `createHold` (15-min TTL, idempotent, distributed lock `lock:slot:<sku>:<date>:<time>`, capacity check inside transaction), `completeMultiServiceCheckout` |
| Holds | `holds` table + `releaseExpiredHolds()` | Booking-without-payment expiry |
| Payments + idempotency | `paymentService.processCheckout` | Replay-safe settlement; `idempotencyKey` UNIQUE |
| Double-entry ledger | `ledgerService` | `PLATFORM_ESCROW_MAIN` / `SUPPLIER_PAYABLE_<id>` / `PLATFORM_REVENUE_COMMISSIONS`; hash-chained integrity; 85/15 payout on COMPLETE |
| Bookings + supplier state machine | `bookings` table, `supplierService.updateBookingState` (ACCEPT/REJECT/DISPATCH/COMPLETE) | Provider acceptance, payout trigger, ownership enforced via `booking.supplierId` |
| Supplier identity | `UserEntity.supplierId`, `resolveActingSupplierId()` in `server.ts` | Providers can only act on their own listings/bookings |
| Catalogue seed pattern | `data/dahab_hotels.json` + `server/db/seeds/importDahabHotels.ts` + `hotelRouter` | Exact template for a seeded rental catalogue |
| Deny-by-default API gate | `server/middleware/apiAccessPolicy.ts` | New routes are private unless declared public/role-scoped |
| Validation | `server/middleware/bodyParams.ts` | `requiredString`, `requiredCount`, `requiredCalendarDate`, `requiredAmountEGP`, `pickAllowedKeys`, `rejectRawCardData` |
| Notifications | `notificationService.sendNotification` | Traveler + provider events on every transition |
| Audit | `db.logAudit` | Every mutation auditable |
| Locks | `distributedLockService` (fencing tokens) | Cross-request race protection on holds |
| Media | `server/services/mediaUpload.ts` (byte-sniffed, 100 KB, served at `/api/media/:filename`) | Listing images, already XSS-safe |
| Hotels UI | `src/components/hotels/{HotelsView,HotelCard,HotelDetailView}.tsx` | Catalogue + slug-detail + chips filter + `useApiResource` pattern to copy |
| Booking wizard UI | `src/components/booking/*` (`BookingPaymentStep`, review steps, sidebars) | Reuse the payment step and confirmation patterns |
| Supplier portal | `src/components/supplier/SupplierPortalView.tsx` | Add a Rentals tab (inbox / calendar / inventory) |
| i18n | `src/i18n/translations.ts` (`t(key, vars)`, EN/AR) | All new UI strings go here |
| Global search surface | `server/services/unifiedSearchEngine.ts` + ⌘K search | Add a rentals domain |

### 2.3 Constraints discovered

1. **`CommerceServiceType` is a closed union** of 6 verticals in **two** places that must stay in sync: `server/db/schema.ts` and `src/shared/types/commerce.ts`. Adding `'rental'` touches every exhaustive switch: `bodyParams.SERVICE_TYPES`, `commerceService.checkAvailability` default time slots, booking-ref prefix logic (`substring(0,3)` → `REN`), trip-item `dayNumber` mapping, ledger metadata, supplier dashboard, `src/types.ts`.
2. **Bookings are trip-anchored**: `completeMultiServiceCheckout` throws `UnknownTripError` without a `tripId`, and notifications address the trip owner. Rental bookings must attach to the traveler's trip (create/use one like hotels do) — a thin itinerary container, no parallel model.
3. **`bookings.supplierState` union is shared across verticals.** Additive states are safe (no migration cost — entity lives in `data` JSON); a new rental-only field must not repurpose an existing value (the codebase has scars from reused literals).
4. **No first-class reviews table.** Suppliers carry `rating`/`reviewCount`; hotels carry `rating`/`reviewCount` from the seed. Reviews-as-user-generated-content is a Phase 2 item; MVP surfaces seeded ratings only.
5. **Payments are gateway-optional** (simulated by default in dev; card last-4 only; full PCI scope avoided). A **deposit cannot be a real card authorization in MVP** — see §14 (Pricing) and §23 (Security).
6. **Frontend must never compute availability or price** — this is a documented, repeatedly-fixed invariant in this codebase (§13.3, §23).
7. **Single-instance reality**: better-sqlite3 sync writes + in-process event loop give serializable transactions. Distributed locks exist for multi-process safety; Cloud Run scale-out is possible but not the current default.

---

## 3. International Research

Products studied (primary sources: vendor sites, FAQs, review/comparison pages, pricing pages, 2026):

**A. Bike/vehicle rental platforms**
- **BikesBooking.com** — global marketplace for motorcycles/scooters/bicycles. Key patterns: real-time calendars, instant booking, free date-change/cancellation up to start, "best price guarantee", direct contractual relationship between traveler and rental provider, provider-facing dashboard + channel manager. Explicitly markets to Dahab (quad/ATV listings).
- **Viator / GetYourGuide bike-rental verticals** — tour-OTA treatment of rentals: "from $30", free cancellation, no hidden fees, calendar + participants, 24/7 support.
- **Local Dahab market** (TripAdvisor gear rentals, Facebook groups, Instagram: Koka Bikes, Dahab city Bike, Sinai Motors, Sea The Soul of Sinai) — pricing reality: bike ~5 €/day, e-scooter ~12 €/24h, quads ~15 €/day, monthly bikes from 250 EGP. **No online booking anywhere** — WhatsApp/Instagram DMs are the channel.

**B. Rental management systems**
- **Booqable** — fixed daily/hourly rates; **seasonal and weekday/weekend pricing rules**; **downtime scheduling (maintenance blocks stock for a period)**; real-time availability; deposit handling guides.
- **LendControl** — real-time inventory tracking to prevent double bookings; per-item status; multi-location support.
- **Bókun (bike rental vertical)** — OTA channel manager: **syncs calendars/rates across Airbnb, Vrbo, Booking.com, Expedia to prevent double booking** — evidence that cross-channel calendar sync is the industry answer to overbooking.
- **Bike Booking Engine** — centralises inventory, rules and logistics; full booking flow from catalogue to return.
- **Rides Rental Software** — customer-facing real-time availability + instant online booking as the double-booking prevention mechanism.
- Industry pricing norms (LendControl, Movcan, Métier, riders-share): **hourly = 25–35% of daily rate; weekly = 15–25% off the 7-day equivalent; multi-day ≥4 days ≈ 10% off; e-bikes daily $65–100, bikes $10–75**.
- Deposit norms (payrequest.io, GR Cycling, Reddit bike-mechanic threads): shops take a **card authorization hold** for damage/theft + a waiver, inspect on return, release or deduct. Dahab shops take cash deposits or passport/ID copies.

**C. Marketplace UX**
- **Turo** — daily rate × days + trip fee; **refundable security deposit** assessed by the platform; optional protection plans; host payout after trip end; transparent cost breakdown before booking.
- **Fat Llama (now Hygglo)** — per-item (asset-based) P2P model, insurance-backed; note the 25% service fee economics and that per-item identity matters most when the "asset" is unique (camera, boat). For interchangeable fleet items (bikes), quantity-based inventory is standard.
- **Airbnb / Booking.com / Viator patterns worth copying** — calendar-driven availability, "left at this price" scarcity cues, transparent fee breakdowns, free-cancellation badges, mobile sticky booking CTA, provider identity + rating next to the product.

### Lessons learned (what NOT to copy)

- **Do not build asset-level tracking first.** Fat Llama-style per-item booking is the wrong MVP for a town where every shop rents "a mountain bike" from a fleet (and it would fight the existing engine).
- **Do not build a channel-manager / OTA sync.** That is Bókun's answer for shops selling on many OTAs; this platform *is* the shop's online channel. Calendar sync is moot until the platform has external channels.
- **Do not build dynamic pricing in MVP.** Booqable-style weekday/season rules are Phase 2; Dahab shops price simply (daily rate, weekly deal, holiday markup can wait).
- **Do copy:** real-time per-day availability shown before checkout; server-computed transparent price breakdown; maintenance downtime blocking stock; provider accept → traveler notification; deposit handled explicitly at pickup (recorded in MVP, authorized in Phase 2); free date-change/cancellation as a trust signal.

---

## 4. Competitive Feature Matrix

| Feature | Platform (evidence) | Value to Dahab | Recommendation |
|---|---|---|---|
| Real-time availability calendar | BikesBooking.com, Booqable, Rides | **High** — replaces WhatsApp back-and-forth; prevents overbooking | **MVP** — per-day quantity engine (§13) |
| Instant booking | BikesBooking.com, Viator, Turo | High — travelers "need a bike tomorrow" | **MVP** — hold → pay → provider confirmation |
| Double-booking prevention (transactional check) | LendControl, Booqable, all | Critical | **MVP** — existing hold/lock/transaction machinery |
| Transparent price breakdown | Turo, Viator, Airbnb | High — builds trust, no "hidden fees" | **MVP** — server-computed quote (§14) |
| Free cancellation window | BikesBooking.com, Viator, Airbnb | Medium-High — key trust signal for pre-trip bookings | **MVP** — per-listing `cancellationPolicyHours` (reuse field) |
| Hourly pricing | Booqable, local shops (4h / 24h rentals seen in Dahab) | Medium — some demand, adds complexity | **Phase 2** — schema supports `hourlyRateEGP` from day one |
| Weekly / multi-day discounts | Industry norm (15–25% off) | High — nomads & long-stay travelers in Dahab | **MVP** — `weeklyRateEGP` + simple `multiDayDiscountPercent` |
| Weekend/seasonal pricing rules | Booqable | Low for MVP (Dahab season is whole-winter) | **Phase 2** |
| Security deposit (card authorization) | Turo, payrequest.io | Medium — damage/theft is a real local cost | **MVP: recorded + settled at return (manual); Phase 2: gateway hold** |
| Delivery to hotel/camp | Turo (delivery), local norm (shops deliver to camps) | **High** — Dahab travelers stay spread along the coast | **MVP** — flat per-zone fees, pickup default (§15) |
| Provider dashboard: accept/reject/return/maintenance | Booqable, LendControl, BikesBooking company side | High | **MVP** — extend existing supplier portal |
| Provider self-service listing creation | BikesBooking, Fat Llama | Medium — admin-seeded catalogue is enough to launch | **Phase 2** (admin creates in MVP, §20) |
| Asset-level tracking (serial numbers, damage per unit) | Fat Llama/Hygglo, LendControl | Low for MVP, real later | **Phase 2/3** — availability stays quantity-based (§13) |
| Map of providers / delivery zones | Airbnb map, Google Maps | Low-Medium — static zones suffice; maps need API key | **Phase 2** (§21.2) |
| Reviews (UGC) | Viator, Airbnb, Turo | Medium — seeded ratings first | **Phase 2** (no reviews table exists today) |
| Channel/OTA calendar sync | Bókun | **None** — the platform is the channel | **Never (unless expansion)** |
| Dynamic pricing | Booqable | Low | **Phase 3** |

---

## 5. Product Recommendation

**One vertical, one catalogue, one booking engine — extended, not duplicated.**

- Extend `CommerceServiceType` with `'rental'` and model each rentable product line as a `product_skus` row (serviceType `'rental'`) owned by the existing supplier row. The sku's `basePriceEGP` becomes the **daily anchor rate** for "from X EGP/day" display; `maxCapacityPerSlot` becomes fleet quantity (schema comment will say so).
- New collections (all additive, following `tableSpecs` conventions): `rentalListings` (catalogue/editorial + pricing config), `rentalExtras`, `rentalBookings` (date-range lifecycle + price snapshot), `rentalMaintenanceBlocks`. Details in §12.
- Day-level availability lives in the **existing `inventory_slots`** (one row per listing per date, `timeSlot: 'FULL_DAY'`, materialized on first hold — exactly the hotels pattern). The new `rental_bookings` table is the *range* record that makes multi-day math and the lifecycle possible.
- Booking/checkout/payment/ledger reuse the existing pipeline 1:1: hold (now with a range-aware availability check) → `completeMultiServiceCheckout` → payment → booking row → trip item → notifications → ledger.
- Provider and traveler surfaces are new routes/views, but every building block (supplier dashboard, accept/reject, payout, notifications, media, i18n) is reused.

Why this and not a greenfield rental module: the codebase's own audit history shows the cost of parallel systems (catalogue-vs-checkout drift, booking records that bypass the supplier queue, ledger rows filed against invented suppliers). Every one of those failure modes is present in this architecture's history with a documented fix; reusing the engine inherits the fixes.

---

## 6. MVP Definition (and what is explicitly NOT in it)

**In MVP (launch):**
1. Seeded rental catalogue (committed `data/dahab_rentals.json`, like `dahab_hotels.json`): ~6–10 listings across **Bike** and **E-Bike** categories from 2–3 real Dahab suppliers already in the supplier catalogue.
2. Discovery: `/rentals` list with category chips (Bikes / E-Bikes), zone chips, price range, text search, sort; `/rentals/:slug` detail page with gallery, features, specs, provider card, pricing table, availability calendar widget, policies, similar rentals.
3. Availability: per-day quantity, range availability check, maintenance blocks, 15-min holds, transactional race prevention (§13).
4. Pricing: daily anchor, optional weekly rate, optional multi-day discount, extras (flat or per-day), per-zone delivery fee, deposit recorded (not gateway-authorized), server-computed breakdown.
5. Booking flow (mobile-first): dates + quantity → extras → pickup/delivery → review + quote → payment (existing path) → confirmation with voucher + provider contact.
6. Provider: accept/reject from the portal, upcoming-rentals calendar, mark-returned (with optional damage note), maintenance blocks, sees payout math as today.
7. Admin: approve/suspend listings, view all rental bookings, refund via existing `/api/commerce/refund`, feature listings.
8. Notifications to traveler + provider on every state change; audit events everywhere; bilingual UI for every string.

**Explicitly Phase 2 (post-validation):** provider self-service listing creation + image upload; hourly booking windows; delivery zone editor; damage reports with photos + deposit deduction; real gateway deposit authorization; reviews (UGC); asset serial numbers; weekday/seasonal pricing; cross-listing calendar.

**Phase 3 (architecture only):** new categories (scooter, surfboard, SUP, kayak, camping gear) = new category values + category-specific spec fields in `data` JSON; no booking-architecture changes. Asset tracking as optional per-listing layer. Map + delivery-zone polygons. Multi-provider package rentals.

---

## 7. Future Expansion (how the domain stays generic)

The system is a **rental domain**, not a bike domain. Proof points baked into the design:

- `rental_listings.category` is an open string (`'bike'`, `'e-bike'`, later `'scooter'`, `'surfboard'`, `'kayak'`, `'camping'`); category-specific attributes live in the listing's `data` JSON (`specs`) — no migration needed for a new category.
- `rental_extras` and delivery zones are not bike-specific.
- The availability engine, pricing engine, booking lifecycle, ledger and provider workflows are category-agnostic by construction.
- The only bike-coded piece is catalogue content + the pickup/return rules (bikes are picked up/dropped; a kayak booking might add launch-site). That is data, not code: `pickupMode`/`returnMode` on the listing.

Constraint honored: **no over-engineering** — there is no category-plugin system, no generic "asset" abstraction, no rule engine. A new category = new seed rows + new filter chip + (optionally) new spec fields. If a future category needs fundamentally different behavior (e.g., boat rental with skipper hours), it gets its own small domain row like `rental_bookings`, reusing the same engine.

---

## 8. User Journeys

### Journey 1 — "I need 2 bikes tomorrow" (Assalah, mid-trip, mobile)
1. Opens app → taps "Rentals" (new nav item) or types "bike" in ⌘K search.
2. List shows Bikes + E-Bikes chips; picks Bikes; filters by "Delivery to Assalah ✓" (zone chip) and price low→high.
3. Opens a mountain-bike listing; taps **"Check availability"** with tomorrow as start; sees 4 left tomorrow and a 3-day quote.
4. Stepper to 2 bikes; picks **Delivery** → Assalah hotel autofilled from trip → +100 EGP zone fee.
5. Adds 2 helmets + 2 locks; review shows server quote: base 2×600 − multi-day 10% + extras + delivery = breakdown; deposit shown "refundable at return".
6. Pays (existing card last-4 / simulated path), gets voucher + provider WhatsApp; provider accepts within the hour; bike delivered to the camp gate in the morning.

### Journey 2 — "E-bike for 3 days, cheapest option" (planning phase)
1. Rentals landing → E-Bikes chip → sort by price → picks cheapest with e-bike range ≥ Blue Hole round trip.
2. Quote page shows weekly-deal hint ("3 days = 3×900 − 10%"); books without a trip by having the flow create/attach to their itinerary trip.
3. Cancels 2 days later within the free window → instant full refund via existing refund path; notification confirms.

### Journey 3 — Provider "Koka Bikes" accepting rentals
1. Supplier portal → new **Rentals** tab → Inbox: 3 pending, each showing dates, quantity, delivery/pickup, total, traveler contact.
2. Accepts → traveler notified (existing `SUPPLIER_CONFIRMED` channel). Blocks 2 bikes Sep 15–17 for maintenance via calendar → those days show "unavailable" for new quotes instantly.
3. On return day: marks **Returned** with a damage note → COMPLETE settles 85% payout to their supplier payable account in the ledger (existing COMPLETE path).

### Journey 4 — Admin launching the vertical
1. Ops console → Rentals: approve 8 seeded listings (bulk), set featured flags, review 2 maintenance requests, process 1 refund for a traveler whose e-bike had a flat tyre (existing refund path + ledger reversal).

---

## 9. Information Architecture

```
Global nav (new): Discover ▸ Rentals   [also: nav.search can surface rentals]
│
├── /rentals                          RentalsView (catalogue)
│     ├── Hero: title + season blurb + stats (listings, avg rating, zones served)
│     ├── Filters: category chips (Bikes, E-Bikes, …) · zone chips · price range · text search · sort
│     ├── Result grid: RentalCard (image, name, "from X EGP/day", delivery badge, rating, scarcity cue)
│     └── Area guide: delivery-zone explainer cards (Lighthouse, Mashraba, Assalah, Eel Garden, Laguna, Blue Hole, Dahab Heights, North Camps)
│
├── /rentals?rentalSlug=<slug>        RentalDetailView (slug-driven like hotels)
│     ├── Gallery · Features · Specs (gear, brake, range for e-bikes)
│     ├── Provider card (business name, area, rating, WhatsApp)
│     ├── Pricing table (day / 3-day / week + extras + delivery + deposit)
│     ├── Availability calendar widget (per-day free quantity for next 30 days)
│     ├── Policies (cancellation window, deposit, damage rule)
│     └── Similar rentals (same category, other providers)
│
└── Rental booking flow (full-screen steps, mobile-first)
      1. Dates + quantity → 2. Extras → 3. Pickup / Delivery → 4. Review (quote) → 5. Payment → 6. Confirmation
      (desktop: sticky summary sidebar mirroring Booking*Step components; mobile: bottom-sheet steps + sticky CTA)

My Trip ▸ new "Rentals" section under bookings (reuses trip items + bookings views)
Supplier Portal ▸ new "Rentals" tab (inbox · calendar · inventory/maintenance)
Ops Console ▸ "Rentals" section (listings approval, bookings, refunds, feature flags)
```

Navigation wiring: `App.tsx` `renderCurrentView()` adds `case '/rentals'` (lazy `RentalsView`), plus a `selectedRentalSlug` state in `TripContext` (mirror of `selectedHotelSlug`), and a nav entry in the shared navigation component + `nav.*` i18n keys.

---

## 10. UX Recommendations (mobile-first)

1. **Sticky bottom CTA** on the detail page: "From 300 EGP/day · Check dates" — always thumb-reachable (pattern proven by every OTA; `FinalCTA` component exists for inspiration).
2. **Range date picker with per-day availability baked in** — each day cell shows a dot/color: green (≥4 free), amber (1–3), red (sold out), grey (blocked). This is the single most conversion-relevant piece: it shows *why* a window is unavailable before the user commits. Use a native `<input type="date">` pair on mobile (keyboard/UX consistency) with the availability overlay rendered under it.
3. **Quantity stepper** with live "X left" cap and message: "Only 3 left for these dates".
4. **Bottom-sheet filters** on mobile (category + zone + price), chips on desktop — matches the existing hotels chips pattern on desktop, upgraded to a sheet on mobile.
5. **Skeleton cards** during load; **empty state** that suggests widening filters ("No bikes match — try another area or dates"); **error state** with retry (reuse `useApiResource` + existing error copy conventions).
6. **Server quote shown verbatim** in Review step — no client-side price math; a "prices are final at booking" note.
7. **Confirmation = action page**: big voucher code, pickup/delivery instructions, provider WhatsApp button (WhatsApp is the de-facto Dahab channel), "add to My Trip" check.
8. **RTL**: all new views use `dir={isAr ? 'rtl' : 'ltr'}` and `t()` keys; Arabic labels for categories/zones come from seed data (`nameAr`, `zoneNameAr`).
9. **Scarcity and trust cues**: delivery badge ("Delivers to your area ✓"), rating chip, "Free cancellation until 24h before" chip, "Refundable deposit" note.
10. **Loading availability lazily**: the calendar widget fetches per-day availability only when opened (`POST /api/rentals/check-availability` for the visible month), keeping the detail page fast.

---

## 11. Domain Model

### 11.1 Asset model decision (Phase 4 of the brief)

| Option | Description | Fit |
|---|---|---|
| A. Individual assets | Each bike is a row with state Available/Reserved/Rented/Maintenance/Out | Fights the existing quantity engine; Dahab shops don't operate this way; serial-number management is provider ops, not traveler UX |
| B. Quantity-based | Listing has fleet count; availability computed per day | **Matches existing `productSkus.maxCapacityPerSlot` + `inventory_slots` exactly**; matches how travelers think ("2 bikes"); cheapest correct MVP |
| C. Hybrid | Quantity engine + optional asset layer | Correct *end state* |

**Recommendation: B for MVP, C in Phase 3.** MVP availability is pure quantity math (§13). Phase 3 adds an optional `rental_assets` table (serial/tag per unit, condition log) **only for providers who want it**, and the availability engine treats it as a per-unit reservation constraint on top of the same day math. This keeps the MVP engine simple without foreclosing asset tracking. For bikes, quantity-only is industry-appropriate (a fleet of interchangeable bikes; Fat Llama's asset model exists for unique goods).

### 11.2 Entities

```
SupplierEntity (existing) 1──n RentalListingEntity (new) 1──n RentalExtraEntity (new)
                                    │ 1
                                    │ n
                          RentalMaintenanceBlockEntity (new)
                          RentalBookingEntity (new) n──1 (existing) ProductSkuEntity
                                                          │
                                                    1──n InventorySlotEntity (existing, per-day)
```

- **RentalListingEntity** (new): `id, supplierId, skuId, slug, category ('bike'|'e-bike'|…), subcategory ('mountain'|'city'|'kids'|'hybrid'|…), name, nameAr, tagline, taglineAr, description, descriptionAr, features[], featuresAr[], specs (Record, category-specific), images[] (urls), quantity (fleet), dailyRateEGP, hourlyRateEGP?, weeklyRateEGP?, multiDayMinDays?, multiDayDiscountPercent?, depositEGP, pickupZoneId, deliveryZones[] (zone ids + fee per zone), pickupMode ('SHOP'|'ANYWHERE'|'BOTH'), returnMode, rating?, reviewCount?, featured, status ('DRAFT'|'PENDING_REVIEW'|'APPROVED'|'REJECTED'|'SUSPENDED'), active, cancellationPolicyHours (mirror sku), policies {en, ar}, createdAt, updatedAt`
- **RentalExtraEntity** (new): `id, listingId, name, nameAr, priceEGP, pricingBasis ('FLAT'|'PER_DAY'), active`
- **RentalMaintenanceBlockEntity** (new): `id, listingId, startDate, endDate, quantityBlocked, reason, createdBy, createdAt`
- **RentalBookingEntity** (new): `id, bookingRef, skuId, listingId, supplierId, tripId, userId, travelerName, travelerPhone, travelerEmail, startDate, endDate, quantity, status (§16 machine), paymentState, paymentId?, holdToken?, idempotencyKey?, priceBreakdown { baseEGP, extrasEGP, deliveryEGP, depositEGP, discountEGP, totalEGP }, deliveryMode ('PICKUP'|'DELIVERY'), deliveryZoneId?, deliveryAddress?, extras[] (snapshot: id,name,price,count), depositStatus ('RECORDED'|'RETURNED'|'DEDUCTED'), damageReport?, lateFeeEGP?, notes?, createdAt, updatedAt`
- Booking row (existing `bookings`) is created at checkout as today — it is the financial/supplier record; `rentalBookings` is the rental-lifecycle record. They reference each other by id; the trip item is created as today (`serviceType 'rental'`).

### 11.3 The sku ↔ listing split

- `product_skus` row: `serviceType 'rental'`, `title = listing.name`, `basePriceEGP = dailyRateEGP`, `maxCapacityPerSlot = quantity`, `cancellationPolicyHours` — powers the existing inventory/hold/checkout/ledger machinery unchanged.
- `rental_listings` row: editorial content, pricing config, extras, delivery zones, lifecycle status — powers catalogue + quoting.
- `resolveBookability(skuId)` (existing) drives the "bookable" flag; a listing is bookable when status APPROVED + active + sku active.

---

## 12. Database / Data Structure Proposal

All additive. Files: `server/db/schema.ts` (interfaces), `server/db/database.ts` (`DatabaseState` arrays), `server/db/sqlite/tableSpecs.ts` (DDL + indexes; the single source of truth — regenerate `server/db/sql/sqlite-schema.sql` via `npm run db:schema`), `server/db/migrations.ts` (idempotent seed call), new `server/db/seeds/importDahabRentals.ts` + committed `data/dahab_rentals.json`.

| Table | Key promoted columns (indexed) | Notes |
|---|---|---|
| `rental_listings` | `supplier_id` (FK RESTRICT), `sku_id` (index), `slug` (UNIQUE), `category`, `active`, `status`, `daily_rate_egp`, `quantity` | Full entity in `data` JSON incl. specs, zones, pricing config |
| `rental_extras` | `listing_id` (FK CASCADE), `active` | |
| `rental_bookings` | `booking_ref` (UNIQUE), `listing_id`, `supplier_id` (FK RESTRICT — never cascade money rows), `trip_id` (index only, mirrors bookings convention), `user_id` (index), `sku_id`, `status`, `payment_state`, `start_date`, `end_date`, `quantity` | Composite indexes: `(listing_id, status)`, `(listing_id, start_date, end_date)` — the availability query |
| `rental_maintenance_blocks` | `listing_id`, `start_date`, `end_date` | Composite `(listing_id, start_date, end_date)` |

Persistence notes:
- The working set stays in-memory (`DatabaseState`); SQLite WAL is the durable store; `data` JSON column means **no column migration for any new field** on these entities — add the interface field, re-run `db:schema`.
- FKs follow existing conventions: money-bearing rows (`rental_bookings`) reference suppliers with RESTRICT (deleting a supplier must not delete paid bookings); catalogue children CASCADE.
- Seed idempotency: `importDahabRentals` upserts by `slug` (mirror `importDahabHotels`); creating the matching sku + `rentalExtras` rows in the same transaction.

---

## 13. Availability Engine Design

### 13.1 Data and formula

Availability is **per-day quantity**, computed from three sources:
1. Fleet: `listing.quantity` (constant, editable by provider/admin).
2. Committed quantity: `rental_bookings` with `status ∈ {PENDING_PAYMENT, PENDING_CONFIRMATION, CONFIRMED, ACTIVE, READY_FOR_PICKUP}` and `startDate ≤ day ≤ endDate` (inclusive both ends — a Sep 10–12 rental occupies Sep 10, 11, 12).
3. Blocked quantity: `rental_maintenance_blocks` overlapping the day (sum of `quantityBlocked`).

```
committed(day)  = Σ quantity over active rental_bookings overlapping day
blocked(day)    = Σ quantityBlocked over maintenance blocks overlapping day
available(day)  = listing.quantity − committed(day) − blocked(day)
windowAvailable(start, end) = min over day ∈ [start..end] of available(day)
windowFits(q)   = windowAvailable(start,end) ≥ q
```

**Worked example (from the brief):** fleet 10 mountain bikes.
- Booking A: Sep 10–12, qty 4. Booking B: Sep 11–13, qty 3.

| Day | committed | available |
|---|---|---|
| Sep 10 | 4 (A) | 6 |
| Sep 11 | 7 (A+B) | 3 |
| Sep 12 | 7 (A+B) | 3 |
| Sep 13 | 3 (B) | 7 |

- A new request for qty 4 on Sep 11–12 → windowAvailable = min(3,3) = 3 < 4 → **rejected with 409** and a day-by-day breakdown so the UI can show exactly which day is the constraint.
- A request for qty 3 on Sep 11–12 → fits. A request Sep 10–13 qty 1 → fits (min = 3).

This "min over days" is the classic rental availability rule used by Booqable/Rides-class software; it is also exactly what the existing slot engine does for one date, generalised to a range.

### 13.2 Booking states that consume inventory

Only these consume: `PENDING_PAYMENT` (held), `PENDING_CONFIRMATION`, `CONFIRMED`, `READY_FOR_PICKUP`, `ACTIVE`, `OVERDUE` (still consuming). **`REJECTED`, `CANCELLED`, `COMPLETED`, `RETURNED` release inventory.** `PENDING_PAYMENT` rows expire via the existing hold TTL path (15 min) — `releaseExpiredHolds` is reused and extended to release range holds.

### 13.3 Race conditions — two users grab the last bike simultaneously

**Design rule: the frontend is never the source of truth.** The client may display a projected quote, but only the server re-validates at two moments: (1) `POST /api/rentals/check-availability` (projected, anonymous, cached) and (2) **`POST /api/rental-bookings` (authoritative hold)**.

Inside `createRentalHold`:
1. Acquire `distributedLockService.tryAcquire('lock:rental:<listingId>', 5000)` — one lock per listing for range ops (the existing hold path locks per slot; a range spans many day-slots, so the listing is the right lock granularity).
2. Inside `db.runInTransaction(...)`: recompute `windowAvailable(start,end)` from committed bookings + blocks, compare to `quantity`; on shortfall throw the existing `InsufficientCapacityError` (409) with per-day detail. On success write the `rental_bookings` row (status `PENDING_PAYMENT`) and the per-day `inventory_slots` rows (`timeSlot 'FULL_DAY'`, `reserved/held` incremented), plus the 15-min expiry timestamp.
3. Release the lease in `finally`.

**Why this is safe:**
- *Single instance (current reality):* Node's event loop is single-threaded and `runInTransaction` runs synchronously — two simultaneous requests serialize; the second re-reads committed rows and sees `windowAvailable = 0 < 1` → 409. No interleaving is possible.
- *Multi-instance (future):* the DB-backed lock (with fencing token, existing service) serializes the check-and-write across processes; SQLite WAL serializes the actual write. The same code path works.
- *Idempotency:* `idempotencyKey` UNIQUE on the hold prevents double-submission from creating two holds for one tap (existing pattern).
- *Payments:* checkout re-verifies the hold is unexpired and unconverted, exactly as `completeMultiServiceCheckout` does today.

### 13.4 Maintenance, closures, blackouts

- Maintenance: `rental_maintenance_blocks` rows; instantly visible in every quote/check (subtracted in the formula) — the Booqable "downtime blocks stock" pattern.
- Provider closure / blackout dates: MVP models a full-quantity maintenance block (reason: 'CLOSED') rather than a separate mechanism — one code path, no schema creep. Phase 2 can add a `closureReason` display field.

### 13.5 Expiry and cleanup

- A `PENDING_PAYMENT` rental booking expires with its hold (15 min); a sweeper (`releaseExpiredRentalHolds`) flips it to `CANCELLED` and releases the day-slots. It runs exactly where the existing engine releases holds — lazily at the start of availability checks and hold creation (the `commerceService.releaseExpiredHolds` precedent) — plus an hourly sweep modeled on the existing `retentionService.startScheduledSweep()` pattern. All in one transaction.
- **Never trust a client-declared availability window** — every quote endpoint returns the server-computed figure and every hold recomputes it.

---

## 14. Pricing Engine

### 14.1 Config (MVP — provider/admin-set per listing, server-stored)

| Field | Semantics |
|---|---|
| `dailyRateEGP` | Anchor. Required. Powers "from X EGP/day" and the sku's `basePriceEGP`. |
| `weeklyRateEGP` | Optional. If set and span ≥ 7 days, the rental is priced `weeks × weeklyRate + days × dailyRate` (weeks = floor(days/7), remainder at daily). |
| `multiDayMinDays` / `multiDayDiscountPercent` | Optional simple rule: span ≥ N days → apply P% off the *base* (before extras/delivery). One rule, no rule engine. |
| `hourlyRateEGP` | **Phase 2 field** (reserved in the schema now; MVP UI hides it). Hourly windows are a separate booking mode. |
| `depositEGP` | Refundable. MVP: recorded on the booking, settled manually at return (mark-returned → deposit `RETURNED`; damage note → `DEDUCTED` with amount). **Not gateway-authorized in MVP** (see §23 — no PCI expansion). |
| Extras | `rental_extras`: `FLAT` (once per booking) or `PER_DAY` (× span days). |

Dahab grounding for defaults (research §3): bike ≈ 300 EGP/day (≈5 €), e-bike ≈ 900 EGP/day (≈15 €), scooter (Phase 2) ≈ 700 EGP/24h; weekly = ~15% off 7× daily; multi-day ≥3 days = 10%; helmets/locks flat, child seats per-day; delivery zone fees: Assalah +100, Dahab Heights +150, Blue Hole +200, North Camps +250, central zones (Lighthouse/Mashraba/Eel Garden) free or +50.

### 14.2 Server-computed breakdown

`POST /api/rentals/quote` returns (and the hold stores the snapshot):

```
baseEGP       = Σ day-rates for span (weekly/multi-day rules applied)
extrasEGP     = Σ (FLAT ? price : price × spanDays) per selected extra
deliveryEGP   = 0 if PICKUP else deliveryZones[zone].fee
depositEGP    = listing.depositEGP (shown separately, refundable)
discountEGP   = (multi-day/weekly savings) — shown as a line, never hidden
totalEGP      = base + extras + delivery
```

The client sends **only** `listingId, startDate, endDate, quantity, extraIds[], deliveryMode, deliveryZoneId?` — never amounts. The server recomputes from stored config at quote, at hold, and at checkout; `completeMultiServiceCheckout` already receives `amountEGP` per item **but for rentals the server derives it from the stored snapshot** (the hold row's `priceBreakdown.totalEGP`) instead of trusting the body — this is a deliberate strengthening of the existing flow for a new vertical (the existing flow's `amountEGP` comes from the client; for rentals we have a server-side snapshot, so we use it).

---

## 15. Delivery & Pickup

- **Pickup (default):** traveler goes to the shop at the agreed time on `startDate`; MVP records `pickupTimePreference` as a free-text/time field on the booking (providers and travelers in Dahab negotiate times in WhatsApp anyway — a rigid time-slot grid is Phase 2).
- **Delivery (MVP, simple):** listing declares `deliveryZones: [{zoneId, feeEGP}]`. Zone ids come from a small committed constant list aligned with the existing area vocabulary (`lighthouse`, `mashraba`, `assalah`, `eel_garden`, `laguna`, `blue_hole`, `dahab_heights`, `north_camps`) — these match the area ids already used by hotels/places, so the area-guide UI and zone chips reuse existing labels + i18n. Delivery address is free text + optional zone; the fee is added server-side.
- **Not in MVP:** dynamic distance-based pricing, real-time courier tracking, delivery *time windows* — flat zone fees + free-text notes cover Dahab's real usage (shops already deliver to camps by arrangement).
- **Return:** same mode by default (delivery → pickup at return or re-delivery fee if the traveler moved; modeled as a `notes` field + admin override in MVP).

---

## 16. Booking Lifecycle (state machine)

The brief proposed DRAFT → PENDING → …; research (Bókun, Booqable, supplier portals) and this codebase's existing supplier state machine (`PENDING_CONFIRMATION → CONFIRMED → … → COMPLETED`, plus `REJECTED`/`CANCELLED`) argue for a **slightly different machine** — no `DRAFT` (unnecessary state — the wizard accumulates client-side and only creates the record at hold), no separate `PAYMENT_PENDING` (a hold IS the payment-pending state, with an expiry), and `READY_FOR_PICKUP` folded into the day-of-start transition. The full payment/completion/payout machinery stays on the existing `bookings` row.

```
 PENDING_PAYMENT ──(hold expires 15 min / user cancel)──▶ CANCELLED
      │  (inventory held)
      │  checkout (pay)
      ▼
 PENDING_CONFIRMATION ── provider REJECT ──▶ REJECTED
      │  (inventory held)                (inventory released)
      │  provider ACCEPT
      ▼
 CONFIRMED ── user cancel within policy ──▶ CANCELLED (+ refund)
      │  (inventory held)
      │  startDate arrives (reconciler, like reconcileTripStatus)
      ▼
 READY_FOR_PICKUP ── provider marks handover ──▶ ACTIVE
      │  (inventory held)                         (inventory held)
      │  endDate + grace passes, not returned
      ▼
 OVERDUE ── provider marks RETURNED ──▶ RETURNED ──▶ COMPLETED
                                        (inventory released; damage report;
                                         deposit RECORDED → RETURNED / DEDUCTED;
                                         provider COMPLETE → 85% payout ledger path)
```

**Allowed transitions (each validated server-side; actor column enforced):**

| From | To | Actor | Notes |
|---|---|---|---|
| PENDING_PAYMENT | CANCELLED | Traveler / system | Hold expiry or explicit cancel before payment; releases inventory |
| PENDING_PAYMENT | PENDING_CONFIRMATION | System (checkout) | Payment settled → `bookings` row created (`supplierState PENDING_CONFIRMATION`, existing) |
| PENDING_CONFIRMATION | CONFIRMED | Provider (ACCEPT) | Existing `supplierService.updateBookingState('ACCEPT')` |
| PENDING_CONFIRMATION | REJECTED | Provider (REJECT) | Releases inventory; traveler notified + refund offered via existing path |
| PENDING_CONFIRMATION | CANCELLED | Traveler / Ops | Before acceptance, full refund (existing `processRefund`) |
| CONFIRMED | CANCELLED | Traveler / Ops | Only if within `cancellationPolicyHours` of `startDate`; refund per policy |
| CONFIRMED | READY_FOR_PICKUP | System | Reconciler on `startDate` (pattern: `reconcileTripStatus` runs on read) |
| READY_FOR_PICKUP | ACTIVE | Provider | "Bike handed over" |
| ACTIVE | OVERDUE | System | Reconciler: `endDate` + grace (e.g., 3h) passed, not RETURNED; `lateFeeEGP` assessed as ledger ADJUSTMENT at return |
| ACTIVE / OVERDUE | RETURNED | Provider | Damage report optional; deposit resolution recorded |
| RETURNED | COMPLETED | Provider (COMPLETE) | Existing COMPLETE → 85% payout ledger entry; inventory released at RETURNED |
| any non-terminal | CANCELLED | Ops/Admin | Override with reason + audit (dispute path) |

Notifications fire on every transition (`BOOKING_CREATED`, `SUPPLIER_CONFIRMED`, new `RENTAL_STATUS_*` types are additive to the `NotificationEntity.type` union), audit events on every mutation.

---

## 17. API Architecture

Follow existing conventions exactly: routers mounted in `server.ts` (mirror `hotelRouter`), deny-by-default exceptions declared in `apiAccessPolicy.ts`, body validated through `bodyParams`, ownership from the session via `resolveActingSupplierId`/`mayActOnTripsOf`-style helpers, errors as `{ status, title, detail, type }` (reuse `InsufficientCapacityError`, `UnknownSkuError`, `UnknownTripError`).

**New router: `server/api/rentalRoutes.ts`, mounted at `/api/rentals`** (list/detail/quote/availability), plus rental-booking routes either in the same router or inline in `server.ts` following the existing booking-route style. **Proposed surface:**

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /api/rentals` | public | List: `category, subcategory, zone, deliveryZone, priceMin, priceMax, q, sort, startDate, endDate, quantity` (when dates+qty given, only listings with `windowFits` are returned — availability-aware catalogue) |
| `GET /api/rentals/:slug` | public | Detail incl. pricing config (no private data), extras, zones, provider card, rating; optional `startDate&endDate&quantity` → server-computed per-day availability for the calendar |
| `POST /api/rentals/check-availability` | public | `{listingId, startDate, endDate, quantity}` → `{available, availablePerDay[], reasonDay?}` (projected; cached 15s) |
| `POST /api/rentals/quote` | public | `{listingId, startDate, endDate, quantity, extraIds[], deliveryMode, deliveryZoneId?}` → full server-computed breakdown (§14.2) |
| `POST /api/rental-bookings` | Traveler | Authoritative hold: re-validates availability + recomputes quote, creates `rental_bookings` (PENDING_PAYMENT) + day slots + hold; 409 on conflict; idempotencyKey |
| `POST /api/rental-bookings/:id/checkout` | Traveler | Converts hold → payment → `bookings` row → trip item → notifications → ledger (extends `completeMultiServiceCheckout` path; server re-derives amount from snapshot) |
| `GET /api/rental-bookings` | Traveler | Own bookings (server scopes by session user; Ops/Admin see all) |
| `GET /api/rental-bookings/:id` | Owner/Ops/Admin | Detail (404 for non-owners — no enumeration) |
| `POST /api/rental-bookings/:id/cancel` | Owner/Ops/Admin | Validated transition + refund via existing path |
| `GET /api/rentals/provider` | Supplier/Ops/Admin | My listings (via `resolveActingSupplierId`) |
| `POST /api/rentals` | Supplier/Ops/Admin | Create listing — **Phase 2** for suppliers; Admin can create in MVP (seeded otherwise) |
| `PATCH /api/rentals/:id` | Owner supplier / Ops/Admin | Update pricing/qty/zones; ownership asserted; **quantity changes validated against future bookings (§22)** |
| `POST /api/rentals/:id/maintenance-blocks` | Owner supplier / Ops/Admin | Block dates (availability reflects instantly) |
| `GET /api/rental-bookings/provider` | Owner supplier / Ops/Admin | Bookings for my listings, filter by date range/status |
| `POST /api/rental-bookings/:id/accept` · `/reject` | Owner supplier | Reuse `supplierService.updateBookingState` |
| `POST /api/rental-bookings/:id/mark-returned` | Owner supplier | `{damageReport?}` → RETURNED; deposit resolution |
| `POST /api/rental-bookings/:id/complete` | Owner supplier | Existing COMPLETE + payout |
| `PATCH /api/rentals/:id/status` | Ops/Admin | Approve/reject/suspend/feature (admin console) |
| `GET /api/operations/rental-bookings` | Ops/Admin | All rental bookings, status filters, dispute queue (extend the existing operations surface pattern) |

**`apiAccessPolicy` additions:** PUBLIC_RULES — `{ pattern: /^\/rentals(\/|$)/, methods: ['GET'] }`, `{ pattern: /^\/rentals\/(check-availability|quote)$/, methods: ['POST'] }`. ROLE_RULES — `{ pattern: /^\/rentals\/provider/, roles: ['Supplier','Operations','Admin'] }`, `{ pattern: /^\/rentals\/[^/]+\/(maintenance-blocks|status)$/, roles: ['Supplier','Operations','Admin'] }` (with handler-level ownership checks — policy grants role, handler grants ownership), `{ pattern: /^\/rental-bookings\/[^/]+\/(accept|reject|mark-returned|complete)$/, roles: ['Supplier','Operations','Admin'] }`, `{ pattern: /^\/operations\//, ... }` already covers the ops list. Traveler booking mutations fall under the default (authenticated) rule, with handler-level ownership.

**Rate limiting:** the existing `/api` limiter covers everything; quote/check-availability are public but cheap (cached).

---

## 18. Frontend Architecture

### 18.1 New files (mirroring existing patterns)

| File | Pattern source |
|---|---|
| `src/components/rentals/RentalsView.tsx` | `HotelsView` (hero, chips, search, grid, empty state) |
| `src/components/rentals/RentalCard.tsx` | `HotelCard` |
| `src/components/rentals/RentalDetailView.tsx` | `HotelDetailView` (gallery, sections, booking widget, sticky CTA) |
| `src/components/rentals/RentalAvailabilityCalendar.tsx` | new — per-day availability overlay (server data) |
| `src/components/rentals/booking/RentalBookingFlow.tsx` | wizard shell (like `Booking*Step` orchestration in BookNow) |
| `src/components/rentals/booking/…Steps` (dates, extras, delivery, review, confirmation) | `BookingTransferStep` / `BookingPaymentStep` / `BookingReviewStep` |
| `src/components/rentals/booking/RentalSummarySidebar.tsx` | `BookingSummarySidebar` |
| `src/services/api.ts` additions | `getRentals, getRentalBySlug, checkRentalAvailability, quoteRental, createRentalHold, checkoutRental, cancelRental, provider rental methods` |
| `src/shared/types/commerce.ts` additions | `RentalListing, RentalBooking, RentalQuote, RentalZone` (or new `src/shared/types/rentals.ts` mirroring `transfers.ts` convention) |
| `src/i18n/translations.ts` | ~130 new keys |
| `src/App.tsx` | `case '/rentals'` + lazy import + `selectedRentalSlug` (TripContext) |
| Navigation component | "Rentals" nav item + i18n keys |

### 18.2 Booking flow UX (step-by-step, mobile-first)

1. **Dates + quantity** — range picker (min 1, max 30 days) with per-day availability dots; stepper 1..available; "Only N left for these dates" cue. Live re-check on change (debounced `check-availability`).
2. **Extras** — checkbox chips (helmet 50 EGP, lock 30, child seat 100/day, phone holder 40); price line updates from server quote only (no client math).
3. **Pickup / Delivery** — segmented control; delivery → zone selector (badges with fees, "Delivers to Assalah ✓"); address field.
4. **Review** — the server quote rendered verbatim (base / discount / extras / delivery / deposit line); traveler contact prefilled from session; policy summary (free cancel until X); **"Pay {total} EGP"** CTA.
5. **Payment** — reuse `BookingPaymentStep` (card last-4, simulated fallback, idempotency key generated client-side like today); on success → confirmation.
6. **Confirmation** — voucher, dates, delivery/pickup instructions, provider WhatsApp button, "Add to My Trip" (trip item already exists server-side), notification copy.

Wizard state is a local reducer; nothing is persisted to the backend until step 5's hold/checkout (matching existing flows). Desktop gets a sticky summary sidebar; mobile gets a bottom progress bar + sticky CTA.

### 18.3 i18n and theming

All strings via `t()`; `dir` RTL; dark/light theme vars reused (`--surface-card`, `--accent-primary`, …). Category names, zone names and policies come from seed data with `nameAr`/`zoneNameAr` columns so the catalogue is translatable without code changes (hotels precedent).

---

## 19. Backend Architecture

New/edited server modules (conventions preserved — no framework changes):

| Module | Responsibility | Key reuse |
|---|---|---|
| `server/db/schema.ts` | New entity interfaces; extend `CommerceServiceType` + `NotificationEntity.type` | — |
| `server/db/database.ts` | Add 4 arrays to `DatabaseState` | — |
| `server/db/sqlite/tableSpecs.ts` | 4 table specs + indexes; regenerate schema.sql | — |
| `server/db/seeds/importDahabRentals.ts` + `data/dahab_rentals.json` | Idempotent seed: listings, skus (`serviceType 'rental'`), extras | `importDahabHotels` |
| `server/db/migrations.ts` | Call the rental seed inside the boot transaction | existing seed ordering |
| `server/services/rentalService.ts` | Domain core: availability math, quoting, lifecycle transitions, maintenance blocks, provider listing queries | `commerceService`, `supplierService`, `ledgerService`, `notificationService`, `distributedLockService` |
| `server/api/rentalRoutes.ts` | All `/api/rentals*` + `/api/rental-bookings*` handlers | `hotelRouter`, inline booking routes in `server.ts` |
| `server/middleware/apiAccessPolicy.ts` | Public/role declarations for new routes | — |
| `server/middleware/bodyParams.ts` | New validators: `requiredDateRange` (start ≤ end, max span), `requiredZoneId`, `extraIds` array validation | existing validators |
| `server.ts` | Mount router; optionally inline checkout extensions; `releaseExpiredRentalHolds` sweep | existing boot |
| `server/services/unifiedSearchEngine.ts` + search UI | Rentals domain in global search (§21) | existing intent parsing |
| `server/services/notificationService.ts` | Additive `RENTAL_*` notification types | — |
| `src/shared/types/` | Wire types shared by api.ts and components | — |

**Responsibilities/validation/authorization** are spelled per endpoint in §17; the two hard rules are (a) ownership always from session (`req.user.supplierId` / trip-owner checks), (b) availability + price + permissions always computed server-side at the hold.

---

## 20. Provider & Admin Requirements

### 20.1 Provider (MVP = extend `SupplierPortalView` with a Rentals tab)

Must exist at launch (all reuse existing portal patterns):
- **Inbox**: rental bookings with dates, quantity, delivery/pickup, total, traveler contact; ACCEPT / REJECT (existing `respondSupplierBooking` path).
- **Calendar**: upcoming rentals by day (read-only list/table MVP).
- **Return desk**: mark RETURNED (+ optional damage note → deposit RECORDED→DEDUCTED/RETURNED), then COMPLETE → payout (existing).
- **Maintenance blocks**: add/remove date ranges with quantity — availability updates instantly.
- **Read-only pricing/qty view** (what's live for each listing).

Deferred to Phase 2 (deliberately — protects launch quality and matches "what can Admin handle during MVP"): listing creation/editing, image upload (media pipeline exists, but provider-facing upload UX is real work), hourly windows, delivery-zone editing, asset/condition tracking.

### 20.2 Admin (Ops console, reuse `/api/operations/*` patterns)

- Listing queue: approve / reject / suspend / feature (`PATCH /api/rentals/:id/status`), with audit.
- Category management: MVP = constant list in seed + code (categories are few and stable); a future admin UI for categories is Phase 2.
- All rental bookings with status filters; **override transitions** (any state → CANCELLED with reason) for disputes; **refunds** via existing `/api/commerce/refund` (ledger-correct).
- Monitor: overbooked-day warnings (a day where `available < 0` — should be impossible, but alert anyway), pending-confirmation SLA (like supplier reliability stats), inventory-vs-maintenance health.

---

## 21. Search & Map Integration

### 21.1 Search (Phase 13 of the brief)

**Yes — rentals belong in global search.** Dahab queries like "bike rental", "mountain bike", "e-bike near Lighthouse", "bike tomorrow" are common. Two cheap, high-value integrations:

1. **⌘K / global search surface:** new `GET /api/rentals/search?q=&zone=` endpoint (keyword match on `name, nameAr, tagline, features, category, subcategory` + optional zone boost). The search UI shows a "Rentals" result group when the query matches — same pattern as other grouped results in the app.
2. **UnifiedSearchEngine intent mapping:** extend `parseTravelerQuery` with rental signals (`bike|bicycle|e-bike|دراجة|عجلة|سكوتر…`) producing a `wantsRental` flag + zone; when set, append rental listings ranked by (zone match > price ascending > rating). "Bike tomorrow" → the engine already extracts no strong temporal intent; MVP matches the keyword and ranks by cheapest available (dates optional → the availability-aware list defaults to tomorrow's date when a "tomorrow"-style word is present — a small, explicit parser addition).
3. **Filters:** dedicated rental filters (category, zone, price, dates+qty availability) live on `/api/rentals` (server-side), not in the global search — global search surfaces, rental catalogue filters.

### 21.2 Map (Phase 14)

**Recommendation: no interactive map in MVP.** Evidence: the app's map integration requires a Google Maps key, is lazy-loaded for the homepage only, and the conversion problem in Dahab is *"will they deliver to my camp?"* — which a zone chip answers better than a map. Suppliers already carry `coordinates`; MVP renders a static position hint (lat/lng or "2 km from Lighthouse") on the provider card. Revisit in Phase 2 if analytics show zone-selection friction; delivery-zone polygons are the natural Phase 2 map use.

---

## 22. Edge Cases (explicit handling)

| # | Edge case | Handling |
|---|---|---|
| 1 | Provider deletes listing with active bookings | **Forbidden by design**: FK RESTRICT on supplier + `rental_listings` cannot be deleted while `rental_bookings` exist (like `bookings` → RESTRICT). Use SUSPENDED status instead; active bookings continue, new holds rejected. |
| 2 | Quantity reduced below future reservations | `PATCH /api/rentals/:id` validates: new `quantity ≥ max(committed(day))` for all future days; else 409 listing the worst day. Provider must cancel/reschedule bookings first (or Ops overrides with reason + audit). |
| 3 | Hold expires without payment | `PENDING_PAYMENT` → CANCELLED via sweep; day-slots released atomically; traveler sees "hold expired, rebook" UI state if they land back on checkout. |
| 4 | Customer books overlapping dates | Impossible by construction — one active rental per (user, listing, overlapping window) checked at hold time; plus per-day quantity math. |
| 5 | Provider puts bike in maintenance mid-booking | Block only affects *future* windows; the block overlap check excludes days already committed to existing bookings (a block and a confirmed booking may coexist on a day only if committed ≤ quantity − blocked is honored at *block creation*: block creation validates `blocked(day) + committed(day) ≤ quantity` on every day, else 409). |
| 6 | Customer extends rental | Phase 2 UI; Phase 1 path: provider marks RETURNED late → OVERDUE → late fee as ledger `ADJUSTMENT`; extension handled manually with an Ops/adjustment note. Schema has `lateFeeEGP` ready. |
| 7 | Customer returns late | Reconciler flags OVERDUE after `endDate + 3h` grace; late fee assessed at return (provider sets amount, capped at listing policy, ledger entry `ADJUSTMENT` with reason). |
| 8 | Provider cancels a confirmed booking | Only via REJECT (PENDING_CONFIRMATION) or Ops override (CONFIRMED+); traveler notified + full refund via existing path; inventory released. |
| 9 | Delivery to unsupported zone | Zone selector only offers `deliveryZones`; a crafted request with an unknown zone id is rejected by `requiredZoneId` against the listing's zones (400). |
| 10 | Two users race for last unit | §13.3 — transactional check + listing lock + 409; frontend shows day-by-day availability so the loser understands why. |
| 11 | Timezone / date boundaries | Dahab is UTC+2, no DST. All dates are **local calendar dates** (`YYYY-MM-DD` strings, as everywhere in this codebase); a booking day = local date; day starts 00:00 local. No UTC conversion anywhere. |
| 12 | Price changes after booking | Price is snapshotted in `rental_bookings.priceBreakdown` at hold; checkout uses the snapshot; later rate changes affect only new bookings. Quote vs hold mismatch (rate edited between quote and hold) → hold uses current server config and returns the fresh total; UI shows "price updated" toast. |
| 13 | Listing becomes unavailable after checkout starts | Checkout re-validates the hold (unexpired, unconverted) and the inventory; a maintenance block created in the 15-min window yields 409 and the hold is released. |
| 14 | Payment retry / double submit | `idempotencyKey` UNIQUE on payments + hold idempotency short-circuit (existing `replayed` path) — no duplicate bookings. |
| 15 | Traveler with no trip | Booking flow ensures a trip exists (create on demand like hotels) — `UnknownTripError` guard retained. |
| 16 | Provider has zero pending-action SLA | Reuse supplier reliability tracking; pending confirmation older than 24h → notification to Ops. |
| 17 | Deposit dispute | `damageReport` + photos (Phase 2) + `depositStatus` DEDUCTED with amount + Ops dispute review; ledger ADJUSTMENT. MVP: manual settlement at return, recorded. |
| 18 | Featured listing sells out | Card shows "Sold out for your dates" state; similar listings surfaced (same category). |
| 19 | Category with no listings | Category chip hidden when count = 0; empty state copy guides to other categories. |
| 20 | Seed re-run on boot | Idempotent upsert by slug; never touches existing bookings (seed only creates/updates catalogue + skus). |

---

## 23. Security & Data Integrity Audit

| Threat | Control (all server-side) |
|---|---|
| Price tampering | Client sends no amounts; server recomputes quote at hold from stored config; checkout uses the stored snapshot (`priceBreakdown.totalEGP`), not the request body — strictly stronger than the existing flow for this vertical. |
| Availability manipulation | `check-availability` is advisory; **the hold is the authority** and re-runs the full day-math inside a transaction + listing lock. |
| Double booking / race | §13.3: synchronous transaction + `distributedLockService` (fencing tokens) + UNIQUE idempotency keys + SQLite WAL serialization. |
| Booking-status manipulation | Transition table (§16) enforced in `rentalService`; actor column checked; provider transitions require `booking.supplierId === acting supplier` (existing `supplierService` ownership rule); traveler transitions require trip owner / session user. |
| ID enumeration | Rental bookings: 404 for non-owners (existing convention); ids are random-hex refs (`REN-2026-<12 hex>`) like bookings. |
| IDOR | Identity always from session (`req.user.supplierId`, trip-owner checks); never from body/path for authorization. |
| Input validation | All body fields through `bodyParams` (`requiredDateRange`, `requiredCount(1..50)` for quantity, `pickAllowedKeys`, enum checks for status/zones/deliveryMode, `rejectRawCardData` in checkout). |
| Provider impersonation | `resolveActingSupplierId` + listing ownership asserted on every provider route. |
| XSS via listing content | Content is seeded/admin-authored; if provider-generated later (Phase 2), reuse the media pipeline's byte-sniffing + `default-src 'none'; sandbox` serving; render text as text (React escapes by default). |
| Refund abuse | Refunds go through the existing `/api/commerce/refund` (Ops/Admin role in policy) + ledger reversal entries; cancel-within-policy is automated but amount-capped to the booking snapshot. |
| Deposit fraud | MVP deposit is *recorded*, not collected — no gateway hold, no PCI expansion. Phase 2 deposit authorization must go through a hosted gateway token (never PANs — existing `rejectRawCardData` invariant). |
| Rate limiting / DoS on quote | Existing `/api` limiter + 15s LRU cache on check-availability (pattern exists in `unifiedSearchEngine`). |

---

## 24. Performance Considerations

1. **Reads are in-memory.** The working set is `DatabaseState` arrays; SQLite is persistence. Catalogue list + availability for Dahab scale (tens of listings, hundreds of bookings) is microseconds of array filtering — no N+1 problem comparable to a disk DB. Keep joins in JS over indexed-looking arrays (mirror `hotelRoutes`/`supplierService` style).
2. **Availability query cost:** per-listing window check = 2 filtered scans (`rental_bookings` by `listingId+status`, `rental_maintenance_blocks` by `listingId`) — O(active bookings of one listing). A 30-day calendar widget = 2 scans + a fold over days. Cache: 15s LRU on `check-availability` (per listing+window) and on the catalogue list (like `unifiedSearchEngine`'s 30s cache).
3. **Avoid computing availability on list render when no dates requested** — the list endpoint only runs the window filter when `startDate&endDate&quantity` are present; otherwise it returns `bookable` + static fields.
4. **SQLite indexes** (declared in `tableSpecs`, enforced by the adapter): `rental_bookings(listing_id, status)`, `(listing_id, start_date, end_date)`, `rental_maintenance_blocks(listing_id, start_date, end_date)`, `rental_listings(slug UNIQUE)`, `(category, active)`, `(supplier_id)`.
5. **No new infrastructure.** No Redis, queues, or workers: holds, sweepers and reconcilers all reuse the existing in-process timer/read-time patterns (`releaseExpiredHolds`, `reconcileTripStatus`). If Cloud Run ever scales to multiple instances, the DB-backed distributed lock already serializes the critical section; document this in the lock key comment.
6. **Bundle:** rentals views lazy-loaded + added to the existing manualChunks scheme; the availability calendar uses `date-fns` (already a dependency) — no new heavy deps.

---

## 25. Migration / Integration Strategy

1. **Schema:** add 4 interfaces + 4 `DatabaseState` arrays + 4 `TABLE_SPECS`; run `npm run db:schema` to regenerate `sqlite-schema.sql`; boot auto-creates tables (`CREATE TABLE IF NOT EXISTS`) — no data migration (new tables only).
2. **Seed:** commit `data/dahab_rentals.json` (gitignore already whitelists seed files); `importDahabRentals()` inside the existing boot transaction (idempotent upsert by slug), called after hotel seeding. Remember `DAHAB_SEED_DIR` vs `DAHAB_DATA_DIR` split — the seed file lives in the seed dir; runtime rows live in the data dir.
3. **ServiceType extension:** add `'rental'` to `CommerceServiceType` in both `server/db/schema.ts` and `src/shared/types/commerce.ts`; update every exhaustive switch (compile errors will find them): `bodyParams.SERVICE_TYPES`, `commerceService.checkAvailability` default times (`['FULL_DAY']`), booking-ref prefix (`REN`), trip-item day mapping, `IN_DESTINATION_SKUS` (not needed — rentals have their own catalogue), any `serviceType` filters in the supplier dashboard and bookings UI.
4. **Ledger accounts:** `SUPPLIER_PAYABLE_<id>` and `PLATFORM_ESCROW_MAIN` are already generic — no new accounts for MVP.
5. **Rollback:** feature-flag the nav entry + routes behind a constant (`RENTALS_ENABLED`) defaulted on for launch; turning it off hides UI while data stays intact (additive tables are inert if unused).
6. **Test isolation:** the fs tripwire in `tests/setup.ts` already protects the real store; new tests use the in-memory adapter (see §27).

---

## 26. File-by-File Implementation Plan

**Sprint 0 — Foundation (schema + seed)**
- `server/db/schema.ts` — 4 new interfaces; `'rental'` in `CommerceServiceType`; additive notification types.
- `server/db/database.ts` — 4 arrays in `DatabaseState` (+ empty-array defaults in the factory/loader).
- `server/db/sqlite/tableSpecs.ts` — 4 specs + indexes; regenerate `server/db/sql/sqlite-schema.sql` (`npm run db:schema`).
- `data/dahab_rentals.json` — seeded catalogue (2–3 suppliers, 6–10 listings, extras, zones, prices per §14.1 defaults).
- `server/db/seeds/importDahabRentals.ts` — idempotent seed (listings + skus + extras in one transaction), modeled on `importDahabHotels`.
- `server/db/migrations.ts` — invoke the seed in boot order.

**Sprint 1 — Domain core (services)**
- `server/services/rentalService.ts` — availability math (§13), quote engine (§14), lifecycle transitions (§16), maintenance blocks, provider queries, `releaseExpiredRentalHolds`.
- `server/services/notificationService.ts` — additive `RENTAL_*` types.
- `server/middleware/bodyParams.ts` — `requiredDateRange`, `requiredZoneId`, extras validation.
- Tests: `tests/domain/rentalAvailability.test.ts` (the Sep 10–13 worked example), `tests/domain/rentalPricing.test.ts`, `tests/domain/rentalLifecycle.test.ts` (all transitions + actor rules), race test (§13.3).

**Sprint 2 — API**
- `server/api/rentalRoutes.ts` — endpoints per §17.
- `server/middleware/apiAccessPolicy.ts` — public + role rules.
- `server.ts` — mount router; checkout integration (hold → snapshot-priced checkout → booking/tripItem/ledger); sweep hook.
- `server/services/unifiedSearchEngine.ts` — rental intent + ranked rental results; `GET /api/rentals/search`.
- Tests: `tests/security/rentalApiPolicy.test.ts`, `tests/security/rentalOwnership.test.ts`, `tests/security/rentalPriceTamper.test.ts`.

**Sprint 3 — Shared types + API client**
- `src/shared/types/rentals.ts` (or into `commerce.ts`) — wire types.
- `src/services/api.ts` — client methods (list, detail, check, quote, hold, checkout, cancel, provider, admin).
- `src/i18n/translations.ts` — all new keys.

**Sprint 4 — Traveler frontend**
- `src/App.tsx` + `TripContext` — `/rentals` route + `selectedRentalSlug`; nav entry.
- `src/components/rentals/RentalsView.tsx`, `RentalCard.tsx`, `RentalDetailView.tsx`, `RentalAvailabilityCalendar.tsx`.
- `src/components/rentals/booking/*` — 6-step flow + summary sidebar + confirmation.
- Browser QA: `tests/browser-qa/rentals-*.mjs` (manual, existing pattern).

**Sprint 5 — Provider + admin**
- `src/components/supplier/SupplierPortalView.tsx` — Rentals tab (inbox, calendar, return desk, maintenance).
- `src/components/operations/*` or new ops rentals section — approval queue, all-bookings view, refund/override.
- `server/api/adminDahabRoutes.ts` or `server.ts` inline — admin listing-status + ops list endpoints (whichever matches the existing ops-console convention).

**Sprint 6 — Search + polish**
- Global search UI group for rentals; zone-boost ranking; availability-aware catalogue listing.
- Loading skeletons, empty/error states, RTL pass, a11y pass (labels on steppers/calendars).

**Dependencies:** 0 → 1 → 2 → 3 → 4/5 (4 and 5 parallel after 3) → 6. **Risks** per sprint: seed drift (S0 — solve by deriving everything from the seed like hotels); union-switch omissions (S1 — let `tsc` find them; this is the main regression surface); checkout amount trust (S2 — use snapshot, covered by tamper test); mobile calendar UX (S4 — prototype the availability overlay early with the browser-QA script).

---

## 27. Testing Strategy

- **Unit (vitest, in-memory adapter, fs tripwire intact):**
  - `rentalAvailability.test.ts` — worked example (§13.1), inclusive-date edges (same-day start/end = 1 day), blocked days, expiry release, quantity-reduction rejection (§22.2), maintenance-block overlap rules (§22.5).
  - `rentalPricing.test.ts` — daily, weekly rate, multi-day %, extras FLAT/PER_DAY, zone fees, deposit line, quote stability.
  - `rentalLifecycle.test.ts` — full transition table (§16): every allowed/forbidden transition, actor enforcement, hold expiry, refund-on-cancel, payout-on-complete ledger entries (85/15), late-fee ADJUSTMENT.
  - `rentalRace.test.ts` — two holds for the last unit: second gets 409; idempotent retry returns the same hold; checkout replay returns `replayed` without duplicating bookings.
  - `rentalSearch.test.ts` — intent parsing ("bike tomorrow", "دراجة"), zone ranking.
- **Security tests:** policy (public vs role per endpoint), ownership (supplier B cannot touch supplier A's listing/booking; traveler cannot read others), price tamper (client-sent `amountEGP` ignored), availability tamper (client-sent "available" ignored — server recomputes), input validation (bad dates, >50 qty, unknown zones).
- **Integration (existing style):** hold → checkout → trip item → notifications → ledger integrity (`db:check`-style assertions); seed idempotency (boot twice, same state).
- **Browser QA (manual, existing Playwright scripts, dev server on :3000):** mobile-first booking flow (375px viewport), RTL pass, calendar widget, empty/error states, provider accept→return→complete, admin approval.
- **Acceptance gate:** `npm run lint` clean, `npm test` green, `npm run build` OK, `db:check` clean.

---

## 28. Risks & Open Questions

**Risks**
1. **ServiceType union churn** — the highest-regression surface; mitigated by additive union extension + letting `tsc` catch exhaustives + a dedicated security test suite.
2. **Checkout trust boundary** — the existing flow trusts client `amountEGP`; rentals must not. Mitigated by snapshot pricing + tamper test. (Flagged as a deliberate deviation; consider back-porting snapshot pricing to other verticals later.)
3. **Provider adoption** — if shops won't use the portal, accept/reject stalls. Mitigation: MVP is admin-assisted (seeded listings), provider actions are 3 buttons; WhatsApp fallback: Ops can act on behalf of a supplier (already supported by `resolveActingSupplierId`).
4. **Deposit realism** — recorded-not-collected deposits leave damage risk with the shop; explicit MVP copy ("deposit paid at pickup to the shop") prevents surprise. Real gateway hold is the Phase 2 de-risking step.
5. **Seed data quality** — prices/quantities guessed from market research. Mitigation: mark seeded rates as "starting from", validate with 2–3 real shops before launch (the platform's own market-intelligence pipeline can price-check).

**Open questions for the product owner**
1. Launch catalogue: which shops first (Koka Bikes? Sinai Motors?) and who onboards them — ops or the shops themselves?
2. Does the MVP need hourly windows after all (some travelers want a 4-hour beach bike)? Schema is ready; UI + availability-mode is ~1 week extra.
3. Commission: keep the existing flat 15% (ledger already assumes 85/15) or configure per-supplier `commission_rate` (field exists on suppliers) for rentals?
4. Cancellation policy default: 24h-free (recommended) vs 48h vs none? Per-listing override?
5. Deposit currency/amounts: cash deposit at pickup (recommended MVP) vs card authorization via a gateway (Phase 2, needs gateway integration work).
6. Should rental bookings appear in the traveler's **trip itinerary** as a normal day item (recommended — reuses everything) or live in a separate "Bookings" section only?

---

## Appendix A — Research sources (primary)

- BikesBooking.com — company FAQ, platform FAQ, Dahab quad listing (`bikesbooking.com`).
- Bókun — "Best Bike Rental Booking Software" (2026), channel-manager calendar sync (Airbnb/Vrbo/Booking.com/Expedia).
- Booqable — pricing, blog ("How to Start an Event Rental Business", "Schedule Downtime", rental glossary: availability calendar, downtime).
- LendControl — "Bike Rental Software", "How to Price Bike Rentals" (hourly = 25–35% of daily; weekly = 15–25% off).
- Bike Booking Engine — "Bike Rental Booking System" (inventory, rules, logistics).
- Rides Rental Software — "Preventing Overbooking and Double Bookings".
- Turo Help — "Trip costs", "Security deposits", "Protection plans".
- Fat Llama / Hygglo — P2P asset model, 25% service fee; Sharetribe analysis.
- Viator Egypt bike rentals; GetYourGuide marketplace pages (free cancellation, from-price).
- Dahab local: TripAdvisor "Gear Rentals in Dahab" (Koka Bikes, Sea The Soul of Sinai, Happy Kite school…), Facebook Dahab groups (bike ~5 €/day, e-scooter ~12 €/24h, monthly from 250 EGP, quad ~15 €/day), Instagram accounts (Dahab city Bike, Sinai Motors, Powerbike Dahab).
- Deposit norms: payrequest.io (authorization periods), bike-shop reddit/FAQ threads (CC holds, waivers, return inspection).
- Pricing norms: LendControl, Movcan, Métier, Palm Beach Ebike, riders-share (weekly 10–20% savings).

*Primary vendor pages were read via search-result snippets; treat specific numbers (prices, percentages) as directional and re-validate before product copy is finalized.*