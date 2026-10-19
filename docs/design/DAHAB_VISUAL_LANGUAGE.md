# DAHAB VISUAL LANGUAGE SYSTEM
# Master Architecture & Design System Specification

> **"Make the product feel unmistakably like Dahab: Not generic Egypt. Not generic tourism. Not SaaS. Not a marketplace template."**

---

## 1. System Overview & Architectural Manifesto

The **Dahab Visual Language System** is the unified design foundation for the Dahab Digital Travel Platform & Companion Operating System. Every color token, typography scale, photographic crop, motion curve, cartographic vector, and microcopy phrase is intentionally calibrated to reflect the real atmosphere of South Sinai.

```
                                  DAHAB VISUAL LANGUAGE
                                           │
         ┌───────────────────┬─────────────┴────────────┬───────────────────┐
         │                   │                          │                   │
    🎨 COLOR SYSTEM     📸 PHOTOGRAPHY              🔤 TYPOGRAPHY       🗺️ LIVING MAP
    Native Sinai &      Anti-Stock, Real           Bilingual EN/AR     Topographic &
    Red Sea Palette     Humans, 35mm Grain         Magazine/Utility    Bathymetric Depth
         │                   │                          │                   │
    ⏱️ DAHAB TIME       💨 ENVIRONMENTAL UI        🎭 BRAND MOTIFS     🧭 ICON LANGUAGE
    4-Phase Diurnal     Live Marine & Solar        7 Dahab Objects     Bespoke Sinai
    Lighting System     Sensory Instruments        (Wave, Topo, Sun)   Vector Glyphs
         │                   │                          │                   │
    🎬 MOTION SYSTEM    💬 BRAND VOICE             🏷️ SERVICE IDENTITY 🧩 UI PRIMITIVES
    Water, Desert, &    Warm, Local, Confident,    20+ Domains Under   Accessible,
    Wind Physics        Minimal Microcopy          1 Coherent Brand    Outdoor Legible
```

---

## 2. Core Sub-System Documentation Index

| Sub-System | Specification Document | Key Focus Areas |
|---|---|---|
| **1. Color System** | [`DAHAB_COLOR_SYSTEM_SPECIFICATION.md`](./DAHAB_COLOR_SYSTEM_SPECIFICATION.md) | Deep Sea, Lagoon Turquoise, Sinai Sand, Sunset Coral, Sun Gold |
| **2. Color Audit** | [`DAHAB_COLOR_SYSTEM_AUDIT.md`](./DAHAB_COLOR_SYSTEM_AUDIT.md) | Elimination of cold grays, neon purple, and generic SaaS colors |
| **3. Photography** | [`DAHAB_PHOTOGRAPHY_ART_DIRECTION.md`](./DAHAB_PHOTOGRAPHY_ART_DIRECTION.md) | Authentic humans, natural skin, 35mm warmth, zero stock poses |
| **4. Typography** | [`DAHAB_TYPOGRAPHY_SYSTEM.md`](./DAHAB_TYPOGRAPHY_SYSTEM.md) | Outfit & Alexandria (Display) + Plus Jakarta & Cairo (Utility) |
| **5. Iconography** | [`DAHAB_ICONOGRAPHY_SYSTEM.md`](./DAHAB_ICONOGRAPHY_SYSTEM.md) | 12 custom Sinai vector icons (diver, fin, reef, camel, scooter, etc.) |
| **6. Motion** | [`DAHAB_MOTION_SYSTEM.md`](./DAHAB_MOTION_SYSTEM.md) | Water fluidity, desert groundedness, wind drift, sunset transitions |
| **7. Map Language**| [`DAHAB_MAP_LANGUAGE.md`](./DAHAB_MAP_LANGUAGE.md) | Topographic mountain contours, reef drop-offs, custom pins |
| **8. Dahab Time** | [`DAHAB_TIME_SYSTEM.md`](./DAHAB_TIME_SYSTEM.md) | Morning, Midday, Golden Hour, Night 4-phase diurnal palette |
| **9. Environmental**| [`DAHAB_ENVIRONMENTAL_UI.md`](./DAHAB_ENVIRONMENTAL_UI.md) | Wind knots, wave swell, water temp, visibility depth gauge |
| **10. Brand Voice** | [`DAHAB_VOICE_AND_MICROCOPY.md`](./DAHAB_VOICE_AND_MICROCOPY.md) | Warm local guide voice, banned vs required copy, Arabic voice |
| **11. Services** | [`DAHAB_SERVICE_VISUAL_LANGUAGE.md`](./DAHAB_SERVICE_VISUAL_LANGUAGE.md) | Visual taxonomy for diving, safaris, dining, mobility, stays |
| **12. Brand Motifs**| [`DAHAB_BRAND_MOTIFS.md`](./DAHAB_BRAND_MOTIFS.md) | 7 Dahab Objects: wave crest, topo lines, sun arc, coral art |

---

## 3. The 10 "Does This Feel Like Dahab?" Quality Gates

Before any component, card, modal, or section is merged, run this silent checklist:

1. **[Color]** Does it use our Native Sinai Palette (Deep Red Sea `#062C35`, Lagoon Teal `#20A89A`, Sinai Sand `#E7D3AE`, Sun Gold `#E7A83B`) instead of generic SaaS blues/purples/cold slates?
2. **[Photography]** Are all images authentic, showing real people, candid moments, and natural dynamic range without airbrushed stock-travel tropes?
3. **[Typography]** Does the heading use characterful display type (`Outfit` / `Alexandria`) while data/tables use compact utility type (`Plus Jakarta Sans` / `Cairo`)?
4. **[Bilingual Parity]** Does the Arabic layout look as thoughtfully designed and native as the English layout, with proper line-height and no broken glyphs?
5. **[Icons]** Are domain concepts using the bespoke `<DahabIcon />` set instead of random mismatched third-party icon shapes?
6. **[Motion]** Does interactive motion feel organic (viscous water ease, grounded desert press) rather than repetitive generic fade-ups?
7. **[Microcopy]** Does the copy sound like an experienced local friend giving real advice rather than a marketing agency selling packages?
8. **[Environmental Grounding]** Are marine variables (wind, swell, visibility, temperature) presented with intuitive visual gauges?
9. **[Textures & Motifs]** Are section breaks and empty states elevated with signature Dahab Objects (wave lines, topo contours, sun arcs) rather than plain grey bars?
10. **[Accessibility & Outdoor Contrast]** Does every text element pass WCAG AA contrast (≥ 4.5:1), and are controls single-line with 40px+ touch targets?

---

## 4. Code Architecture & Component Directory

All developers and components inherit this system through centralized modules:

```
src/
├── tokens/
│   ├── index.ts                # Main design tokens export
│   ├── colors.ts               # Complete Dahab color palette & hex values
│   ├── typography.ts           # Font families, scales, letter spacing
│   ├── motion.ts               # Easing curves, duration tokens, keyframes
│   ├── services.ts             # 20+ Service domain token mappings
│   ├── photography.ts          # Aspect ratios, overlays, 35mm grain rules
│   └── microcopy.ts            # Standardized bilingual UI strings & CTAs
├── context/
│   ├── DahabTimeContext.tsx    # 4-Phase diurnal lighting context & hook
│   └── TripContext.tsx         # Traveler itinerary & state
├── components/common/
│   ├── DahabIcons.tsx          # 12 Bespoke vector icons (diver, fin, camel, etc.)
│   ├── DahabMotifs.tsx         # 7 Signature brand objects (wave, topo, sun)
│   ├── EnvironmentalWidgets.tsx# Wind, wave, visibility, and solar instruments
│   ├── DahabEmptyState.tsx     # Contextual Dahab-themed empty states
│   └── DahabLoadingScreen.tsx  # Organic water/sand shimmer loader
└── index.css                   # Tailwind theme tokens & global CSS variables
```
