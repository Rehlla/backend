# Dahab Native Trip OS — Complete Functional & UI Specification

## 1. Scope & Primary Workflows

The Dahab Native Trip OS delivers an end-to-end trip companion across 7 synchronized operational phases:

```
[Phase 1: Pre-Trip Planning & Customization]
    |--> Multi-dimensional Trip Fit Score (7 Dimensions)
    |--> Make It Better Optimization Bar (Relax pace, Budget adjust, Desert evening swap)
    |--> Conflict & Decompression safety validation

[Phase 2: Day 1 Arrival & First 2 Hours Rescue]
    |--> Private Sharm El Sheikh (SSH) flight van tracking & Nabq checkpoint pass
    |--> Early arrival luggage drop & seaside breakfast plan at Ali Baba / Ralph's

[Phase 3: Active Day Management & Companion]
    |--> Day Rhythm & Intensity Indicator (Relaxed / Balanced / Active / Intense)
    |--> Live step-by-step itinerary tracking with weather & visibility radar
    |--> Immediate activity modification & swap triggers

[Phase 4: Spontaneous Decision & Food Engine]
    |--> "What Should I Do Now?" 3-mood recommendation matrix (Chill / Explore / Adventure)
    |--> "Food Now" reef-walking proximity engine with local verified dining

[Phase 5: Disruption & Recovery]
    |--> Extreme wind, rough sea swell, or physical fatigue auto-detection
    |--> Multi-option recovery cards with 1-click trip synchronization

[Phase 6: Remote Reserve & Expedition Mode]
    |--> Blue Lagoon & Ras Abu Galum zero-connectivity protocol
    |--> Downloadable and printable Offline Trip Pack (JSON / PDF)

[Phase 7: Departure Day & Souvenir Stroll]
    |--> Safe no-dive buffer enforcement
    |--> Slow breakfast, artisan souvenir shopping, and SSH airport transfer
```

---

## 2. Component Hierarchy & Navigation Mapping

| Route / View ID | Component | Core Responsibilities |
|---|---|---|
| `/mytrip` | `MyTripView.tsx` | 5-Day Master Timeline, Day Intelligence Header, Dahab Local Intelligence Card, Trip Fit Card, Make It Better Bar, Group Travel, Smart Budget, and Offline Pack Modal. |
| `/companion` | `DailyCompanionDay2View.tsx` | Real-time companion for Day 2: Live status, Canyon dive gear checklist, next steps, food suggestions, and fatigue alerts. |
| `/now` | `WhatShouldIDoNowView.tsx` | Contextual recommendation engine matching remaining free time, energy level, and walking distance. |
| `/food` | `FoodNowView.tsx` | Proximity food discovery with walking minutes from current reef/hotel, price filters, and dietary tags. |
| `/director` | `AiDirectorView.tsx` | AI-assisted planning chat with structured prompt chips and instant timeline updates. |
| `/recovery` | `ChangeAndRecoveryView.tsx` | Incident management (wind shifts, boat cancellations, tired legs) with alternative options. |

---

## 3. Visual & Aesthetic Standards

- **Color Palette**: Warm Sinai Terracotta (`#D97706`, `#B45309`), Deep Red Sea Teal (`#0D9488`, `#115E59`), Mountain Granite Charcoal (`#1C1917`, `#292524`), and Sand Warm Neutral (`#F5F5F0`, `#E7E5E4`).
- **Typography**: Refined Serif headings (Playfair/Cinzel/Noto Naskh Arabic) paired with high-legibility modern sans-serif body copy.
- **Microcopy**: Grounded in authentic Egyptian Arabic and professional English with zero generic marketing fluff.
