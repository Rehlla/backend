# Dahab — Figma Master Design Prompt

> Paste **PROMPT 1** into Figma Make / Figma AI (or any design AI) to get the full system.
> Then use the per-screen prompts in **PROMPT 2** to expand screen by screen.
> `PROMPT 3` is a compact version for quick single-screen explorations.

---

## PROMPT 1 — Master prompt (paste this whole block)

You are a senior product designer creating an **original, exclusive design system and UI kit in Figma** for a real production travel product. Do not use generic travel-template patterns (no Airbnb clone, no Booking.com grid, no stock SaaS dashboard). The output must feel like it could only exist for this one place: **Dahab, South Sinai, Egypt**.

### 1. The product

**Dahab** is not a booking site. It is a **lifecycle-aware travel companion**: a single web app that detects where the traveler is in their journey and recomposes the entire interface around that moment.

The traveler lifecycle has 10 phases, and the UI must visibly change between them:
`DISCOVERY → BOOKING → PRE_TRIP → IN_TRANSIT → ARRIVAL → IN_DAHAB → ACTIVE_TRIP → DISRUPTED → DEPARTURE → POST_TRIP`

The same home screen therefore has at least four different faces:
- **Dreaming / not signed in** — cinematic, editorial, inspirational. One dominant CTA.
- **Planning / booked but not arrived** — countdown, checklist, itinerary preview, what to pack, transfer status.
- **In Dahab / active trip** — an operational cockpit: "what now", live sea + air conditions, time-of-day recommendations, nearby services, current/next activity.
- **Departing & after** — no "book now" anywhere. Wrap-up, memories, photo archive, receipts, reflection.

Context signals that drive composition and must be expressible as UI states: location (`OUTSIDE_DAHAB / APPROACHING / ARRIVED / IN_DAHAB / LEAVING`), booking state (`NO_BOOKING / PLANNING / HOLD_ACTIVE / CONFIRMED / SUPPLIER_PENDING / FAILED / RECOVERY_REQUIRED`), time of day (`EARLY_MORNING / MORNING / MIDDAY / AFTERNOON / SUNSET / EVENING / LATE_NIGHT`), and signal freshness (`LIVE / RECENT / STALE / UNKNOWN`).

**DayGi** is the built-in AI concierge with three modes — **Discover** ("I have 2 hours near the Lighthouse, what do I do?"), **Plan** ("make tomorrow calmer without raising my budget"), **Act** (it executes a real change to the trip). DayGi never replies with a wall of text: every answer is a **grounded action card** with a title, concrete facts (duration, price in EGP, distance, water temperature), a "Why this?" rationale, an explicit primary action button, and 2–3 follow-up chips.

### 2. Non-negotiable constraints

- **Bilingual EN/AR, first-class RTL.** Arabic is not a translation layer. Every screen must be designed in both LTR and RTL, with Arabic type that is actually beautiful — not Latin layout with Arabic poured in. Choose a real Arabic display face and pair it deliberately with the Latin face. Mirror icons, chevrons, progress rails, and card affordances in RTL.
- **Mobile-first.** Design 390px first, then 768px, then 1440px. Most travelers are on a phone, outdoors, in bright sun, on weak Sinai network — so contrast, tap-target size, and offline/stale states matter more than elegance at 1440.
- **Theme engine, 6 themes.** The system must survive re-skinning. Deliver semantic color *variables* (not raw hexes on layers) with modes for: `editorial-sand` (light), `deep-reef` (dark), `sinai-midnight`, `lagoon-breeze`, `charcoal-minimal`, `high-contrast-pro`. Every component must be checked in at least light, dark, and high-contrast.
- **Trust through transparency.** Real prices in EGP, real availability, no hidden fees. Design explicit UI for: price breakdown, freshness stamps ("live / 4 min ago / stale"), and confidence on AI suggestions.
- **Accessibility.** WCAG AA minimum for all text and interactive states, 44px minimum touch targets, visible focus rings, reduced-motion variant of every animated component, large-text mode.

### 3. Art direction — what "exclusive" means here

Dahab is the shoreline where the **Sinai desert falls straight into the Red Sea**: sun-bleached sand and granite mountains on one side, a reef wall dropping into blue-black depth on the other. Bedouin culture, hand-woven textile geometry, low-rise camps, freedivers, wind, and salt.

Build the visual world from **that collision**, and commit to it structurally — not as a decorative gradient on a hero:

- **Depth as an axis.** Descending the page should read as descending from sand into water: warm and bright at the top, cooler and deeper further down. Surfaces, dividers, and elevation should express depth, not drop shadows borrowed from Material.
- **Two voices.** A warm, dry, granular "desert" voice (sand, stone, textile, ochre, hand-drawn line) and a cool, fluid, luminous "sea" voice (teal, refraction, caustic light, glass). Every section should belong clearly to one of them, and the transitions between them are the signature of the brand.
- **Editorial, not e-commerce.** Big confident display type, generous whitespace, real photography with intent, asymmetry where it earns attention. Cards are a last resort, not the default container.
- **Local and specific.** Micro-details drawn from Bedouin weaving geometry, reef topography, wind and tide charts, dive-slate marks. Avoid emoji, avoid generic globe/plane/suitcase icons.

Starting palette (you may refine it, but keep this DNA and justify any change):
`#E7D3AE` warm Sinai sand · `#F7F3EA` bone · `#20A89A` reef teal (live/interactive) · `#0F6F78` ocean teal (CTA) · `#062C35` ocean night · `#04171D` abyss.

Add what is missing: a sunset/alert warm accent, a success, a warning, a destructive, plus a full neutral ramp, all as semantic tokens.

### 4. What to deliver in Figma

Organize the file into these pages:

1. **00 · Foundations** — color variables with 6 theme modes, type scale (Latin + Arabic, display / heading / body / mono for prices & codes), 4px spacing scale, radii, elevation/depth tokens, iconography rules, motion tokens (duration + easing + a reduced-motion equivalent), photography direction with art-direction rules and 6+ example crops.
2. **01 · Components** — as real Figma components with variants and variable bindings: buttons (primary/secondary/ghost/destructive × size × state × LTR/RTL), inputs, selects, date & traveler pickers, chips/filters, badges (live / ocean / sunset / stale), price tag, rating, avatar, cards (experience, dive, hotel, restaurant, transfer, story), list rows, tabs, bottom nav, top bar with location capsule + language switch + theme switch, modals/sheets, toasts, empty states, skeletons, error states, offline banner, stepper, progress rail, map pin & map card, DayGi message bubble, DayGi action card, follow-up chips.
3. **02 · Home — 4 lifecycle states** — Dreaming, Planning, In-Dahab cockpit, Post-trip. Mobile + desktop each.
4. **03 · Discover & Detail** — explore, filtered listings, experience detail, dive-site detail with depth profile, restaurant detail, hotel detail, spatial map view with nearby services.
5. **04 · Booking flow** — multi-step (select → options/gear → travelers → date & time → price breakdown → payment → confirmation), plus hold-active, supplier-pending, payment-failed, and recovery/change screens. Payment is Paymob (Egyptian market) — design for local payment reality.
6. **05 · Trip companion** — my trip, day-by-day timeline, activity card, first-two-hours-after-arrival view, "what should I do now", live conditions (air/water/wind/sunset), budget tracker, transfer tracking.
7. **06 · DayGi concierge** — full conversation surface in all three modes, an empty/first-run state, a thinking state, a grounded action card, an "apply this change to my trip" confirmation, and a graceful degraded state for when the AI is unavailable or slow.
8. **07 · Departure & memories** — checkout/wrap-up, receipts, photo archive, trip recap, reflection prompt, share card.
9. **08 · Account & Ops** — sign-in/sign-up (Google federated), profile, preferences, notifications, plus a light pass at the operations console and supplier portal (these are dense data screens — data table, filters, status pills, timeline; they should read as a quieter, tool-like sibling of the consumer brand, not a different product).
10. **09 · RTL** — the 8 most important screens fully mirrored in Arabic with Arabic copy, not lorem ipsum.
11. **10 · Prototype** — one clickable flow: land → plan a 3-day trip → book a dive → arrive → ask DayGi → apply the change.

### 5. Rules for the work

- Use **Figma variables and styles for everything**; no hardcoded hex on any layer.
- Use **auto layout everywhere**, with proper constraints and min/max widths so screens survive resize and RTL mirroring.
- Name layers and components semantically (`card/experience/default`, not `Frame 214`).
- Every component needs: default, hover, focus-visible, active, disabled, loading, error, and empty where applicable.
- Write **real copy** in the brand voice: warm, knowledgeable, slightly adventurous — never corporate, never precious. Real place names (Blue Hole, the Canyon, Lighthouse, Ras Abu Galum, Three Pools, Assalah, Ralph's), real prices in EGP, real durations.
- Annotate each screen with a short note: which lifecycle phase it serves and which context signals change it.
- One dominant primary action per viewport. Secondary actions must be visibly quieter.

### 6. Start here

Before producing full screens, present **three distinct art directions** for the home screen (dreaming state, mobile + desktop) — each with its own palette-in-context, type pairing, and hero concept, each with a one-line name and a two-sentence rationale. Make them genuinely different from each other, not three tints of the same idea. Then wait for a pick before building the rest of the system.

---

## PROMPT 2 — Per-screen follow-ups

Use after picking a direction. Prefix each with: *"Continue in the chosen direction, using the established variables and components."*

- **Home / In-Dahab cockpit:** "Design the In-Dahab home cockpit at 390px. Top: location capsule with live weather (air, water temp, sunset time) and freshness stamp. Then a single 'What now' hero card generated from time-of-day + free-window minutes, then next confirmed activity with countdown, then nearby-now rail, then quick services. Show three time variants: MORNING, SUNSET, LATE_NIGHT."
- **DayGi action card:** "Design the DayGi grounded action card in all three types — RECOMMENDATION, TRIP_CHANGE, BOOKING — each with facts row, 'Why this?' expandable rationale, a primary apply action, and follow-up chips. Include the loading and the AI-unavailable fallback."
- **Booking:** "Design the 6-step dive booking flow at 390px, including the price breakdown with zero hidden fees, the hold-active timer state, and the supplier-pending and payment-failed states with a clear recovery path."
- **Dive site detail:** "Design the dive-site detail page for the Blue Hole: depth profile visualization, conditions today, difficulty and certification requirements, safety notes, operators comparison, and booking CTA."
- **RTL pass:** "Mirror the following 8 screens to Arabic RTL with real Arabic copy and an Arabic display type pairing. Show me a side-by-side of the LTR and RTL home so the mirroring logic is auditable."
- **Theme pass:** "Show the component library rendered across all 6 theme modes as a comparison board, and flag any component that fails WCAG AA in any mode."
- **Ops console:** "Design the operations console: booking queue table, supplier status timeline, disruption alerts, and traveler detail drawer. Dense, quiet, tool-like — same variables, lower saturation, higher information density."

---

## PROMPT 3 — Short version (single-screen quick explorations)

Design the [SCREEN] for **Dahab**, a lifecycle-aware travel companion app for Dahab, South Sinai — not a booking site. The visual world is the shoreline where the Sinai desert falls into the Red Sea: warm sand and granite meeting reef teal and abyss blue, depth used as a structural axis rather than decoration; editorial type, real photography, Bedouin-textile geometry, no generic travel iconography. Mobile-first at 390px, bilingual EN/AR with true RTL, semantic color variables with light/dark/high-contrast modes, WCAG AA, one dominant CTA per viewport. Palette DNA: `#E7D3AE` sand, `#F7F3EA` bone, `#20A89A` reef teal, `#0F6F78` ocean teal, `#062C35` ocean night, `#04171D` abyss. Use real Dahab place names and real EGP prices. Voice: warm, knowledgeable, slightly adventurous.
