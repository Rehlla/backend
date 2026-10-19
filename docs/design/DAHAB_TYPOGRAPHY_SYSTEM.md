# DAHAB VISUAL LANGUAGE SYSTEM
## Typography System & Dual-Script Hierarchy (EN / AR)

---

### 1. Architectural Philosophy: The Dual-Personality System

Dahab is simultaneously a **world-renowned travel destination** (requiring editorial elegance and storytelling power) and an **advanced travel operating system** (requiring razor-sharp utility, tabular numbers, and instant mobile scannability).

Our typography pairs an **editorial magazine display tier** with a **precision product utility tier**, with first-class bi-directional parity between English and Arabic.

```
┌────────────────────────────────────────────────────────────────────────┐
│  EDITORIAL DISPLAY LAYER (Headings, Hero, Section Titles, Vignettes)    │
│  EN: Outfit & Playfair Display / AR: Alexandria & Readex Pro           │
│  Character: Wide tracking, high vertical authority, graceful ligatures  │
├────────────────────────────────────────────────────────────────────────┤
│  PRODUCT UTILITY LAYER (Cards, Tables, Timelines, Badges, Microcopy)  │
│  EN: Plus Jakarta Sans / AR: Cairo & IBM Plex Sans Arabic              │
│  Character: Compact x-height, tabular numerals, unambiguous glyphs     │
└────────────────────────────────────────────────────────────────────────┘
```

---

### 2. Primary Font Families

#### English Typography Stack
1. **Display & Expressive Titles:** `'Outfit'`, `'Space Grotesk'`, sans-serif
   - *Weights:* 300 (Light for massive headers), 600 (Semi-bold), 800 (Extra-bold for accents)
   - *Attributes:* Clean geometric proportions, modern travel magazine feel.
2. **Editorial Accents & Monograph Serifs:** `'Playfair Display'`, Georgia, serif
   - *Weights:* 400 (Regular italic), 700 (Bold)
   - *Usage:* Limited strictly to poetic subtitles, quotes, or story milestones.
3. **Core Interface & Body Text:** `'Plus Jakarta Sans'`, -apple-system, BlinkMacSystemFont, sans-serif
   - *Weights:* 400 (Regular), 500 (Medium), 700 (Bold)
   - *Attributes:* Generous counter-spaces, optimal legibility in outdoor bright sunlight.
4. **Data, Coordinates & Timelines:** `'JetBrains Mono'`, `'Fira Code'`, monospace
   - *Usage:* Coordinates (`28.4975° N, 34.5167° E`), tide times, dive depths, flight numbers.

#### Arabic Typography Stack (First-Class RTL)
1. **Arabic Display & Hero Titles:** `'Alexandria'`, `'Readex Pro'`, `'Cairo'`, sans-serif
   - *Weights:* 300 (Light), 600 (Semi-bold), 800 (Extra-bold)
   - *Attributes:* Open geometric terminals, majestic presence, perfectly calibrated baseline alignment matching Outfit.
2. **Arabic UI, Forms & Body Text:** `'Alexandria'`, `'IBM Plex Sans Arabic'`, `'Readex Pro'`, sans-serif
   - *Weights:* 400 (Regular), 500 (Medium), 700 (Bold)
   - *Attributes:* Ultra-crisp readability at 11–15px sizes, natural kashida balance, no letter clipping.
3. **Arabic Poetic Serifs & Cultural Vignettes:** `'El Messiri'`, serif
   - *Weights:* 500 (Medium), 700 (Bold)
   - *Attributes:* Curved Sinai calligraphic elegance pairing seamlessly with Playfair Display.

---

### 3. Modular Typographic Scale

We utilize a **Major Second (1.125)** ratio for dense product UI and a **Perfect Fourth (1.333)** ratio for editorial display surfaces.

| Scale Token | Size (px / rem) | Line Height | Tracking (Letter Spacing) | Usage in Dahab Interface |
|---|---|---|---|---|
| `text-display-2xl` | 64px / 4.0rem | 1.05 | -0.035em | Hero Landing Title ("DAHAB UNFILTERED") |
| `text-display-xl` | 48px / 3.0rem | 1.10 | -0.025em | Primary Page Titles (My Trip, Sinai Radar) |
| `text-display-lg` | 36px / 2.25rem | 1.15 | -0.020em | Section Headlines (Diving Drop-offs, Safaris) |
| `text-title` | 24px / 1.5rem | 1.25 | -0.015em | Module / Card Group Titles, Modal Headers |
| `text-subtitle` | 18px / 1.125rem | 1.35 | -0.010em | Card Titles (Blue Hole Freedive, Ali Baba Grill) |
| `text-body` | 15px / 0.9375rem | 1.60 | 0.000em | Long-form story copy, descriptions, guide tips |
| `text-caption` | 13px / 0.8125rem | 1.50 | +0.010em | Form labels, card secondary metadata, notes |
| `text-utility` | 11px / 0.6875rem | 1.30 | +0.040em (Uppercase) | Status badges, category pills, tide tags |
| `text-micro` | 10px / 0.625rem | 1.20 | +0.060em (Uppercase) | Distance meters (`180m`), coordinates, stamps |

---

### 4. Special Formatting Rules

#### A. Prices & Financial Data
- **Format:** Currency prefix/suffix with tabular numerals (e.g., `EGP 1,450` / `1,450 ج.م` / `$95 USD`).
- **Styling:** Primary numeral is bold and prominent (`text-base sm:text-lg font-bold text-dahab-ink`), currency code is muted and compact (`text-xs font-semibold text-dahab-ink-secondary`).
- Never append unstyled decimal zeroes (`.00`) when pricing whole numbers.

#### B. Environmental & Technical Metrics
- Units are spaced cleanly from numbers (`18 kn`, `24°C`, `102 m`, `1.2 m`).
- Metric symbols use high-contrast accents (`text-dahab-teal` or `text-dahab-gold`).

#### C. Micro-Labels & Category Headers
- Max 2 words per pill/badge.
- Strict single-line (`whitespace-nowrap shrink-0`) to prevent awkward wrap defects.
- Uppercase tracking (`tracking-wider` or `tracking-widest`) with font-size 10–11px.

---

### 5. Bi-Directional (LTR / RTL) Parity Rules

1. **Font Size Alignment:** Arabic text rendered at the same point size as Latin text can visually appear slightly smaller due to x-height differences. In body text, Arabic is allowed `+0.5px` to `+1px` visual optical balance when needed.
2. **Line Height Generosity:** Arabic script requires slightly greater vertical breathing room (`leading-relaxed` or `leading-loose`) to accommodate upper and lower diacritics without vertical collision.
3. **No Artificial Italicization:** Arabic typography should NEVER use mechanical CSS `font-style: italic`, as slanted Naskh/Kufic breaks traditional script anatomy.
4. **Number Formatting:** Standard Arabic-Indic numerals (`١، ٢، ٣`) or Western Arabic numerals (`1, 2, 3`) are preserved consistently based on the user's localized trip preference.
