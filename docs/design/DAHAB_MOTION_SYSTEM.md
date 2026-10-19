# DAHAB VISUAL LANGUAGE SYSTEM
# Motion System & Organic Sinai Physics Specification

> **"Motion in Dahab is not an arbitrary digital afterthought—it is a physical expression of Sinai’s elements: the viscosity of the Red Sea, the mass of granite mountains, the directional pulse of coastal thermal winds, the atmospheric dissolve of the sunset, and the linear momentum of the desert journey."**

---

## 1. The 5 Core Motion Principles

Generic web applications default to mechanical `ease` or jittery spring presets. In the Dahab Visual Language System, all interactive movement and spatial transitions are governed by **5 foundational physical archetypes**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          THE 5 DAHAB MOTION ARCHETYPES                       │
├───────────────────┬───────────────────┬──────────────────┬──────────────────┤
│ 🌊 1. WATER       │ 🏜️ 2. DESERT      │ 💨 3. WIND       │ 🌅 4. SUNSET     │
│ Fluidity & Tides  │ Granite & Mass    │ Thermal & Flow   │ Chromatic Glow   │
│ Viscous easing,   │ Grounded settle,  │ Directional sway,│ Slow dissolves,  │
│ smooth expansions │ tactile click     │ subtle drift     │ soft blooms      │
├───────────────────┴───────────────────┴──────────────────┴──────────────────┤
│ 🧭 5. JOURNEY (Spatial Progression)                                         │
│ Milestone snapping, horizontal momentum, spatial waypoint continuity         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 🌊 Principle 1: Water (Fluid & Viscous)
- **Physical Metaphor:** Submerging into the Red Sea at Lighthouse reef; natural fluid drag, cushioned deceleration, and buoyant expansion.
- **Behavioral Characteristics:** Smooth initial entry with a long, cushioned settling curve. Eliminates abrupt hard stops.
- **Applied Surfaces:** Modals, navigation drawers, accordion content reveals, filter pill sliding tabs, dropdown sheets, and media lightboxes.
- **Cubic Bezier:** `cubic-bezier(0.25, 1, 0.5, 1)`

### 🏜️ Principle 2: Desert (Grounded & Substantial)
- **Physical Metaphor:** South Sinai red granite and compacted sandstone. High mass, resolute settling, instant authority, and absolute absence of rubbery oscillation.
- **Behavioral Characteristics:** Immediate response to touch, tight compression on press, fast grounded release without secondary rebound.
- **Applied Surfaces:** Primary button taps, card selection states, toggle switches, destructive confirmations, and sheet drag anchors.
- **Cubic Bezier:** `cubic-bezier(0.16, 1, 0.3, 1)`

### 💨 Principle 3: Wind (Directional & Kinetic)
- **Physical Metaphor:** The prevailing North-Northeast thermal breezes sweeping across Dahab Lagoon and the Gulf of Aqaba.
- **Behavioral Characteristics:** Continuous, low-amplitude sinusoidal movement with directional bias. Communicates real-time liveliness without distracting reading flow.
- **Applied Surfaces:** Live Sinai Radar wind vectors, sea swell indicators, compass needle orienting, ticker badges, and floating action hints.
- **Cubic Bezier:** `cubic-bezier(0.45, 0, 0.55, 1)`

### 🌅 Principle 4: Sunset (Gradual & Atmospheric)
- **Physical Metaphor:** The gentle twilight shift as the sun dips behind Mount Sinai, painting the granite peaks in terracotta, rose, and amber before deepening into midnight teal.
- **Behavioral Characteristics:** Extended, unhurried cross-fades and ambient luminance shifts that feel natural and non-disruptive.
- **Applied Surfaces:** Dahab Time phase transitions (Morning → Midday → Golden Hour → Night), background backdrop switches, hero scene transitions, and ambient glow pulses.
- **Cubic Bezier:** `cubic-bezier(0.4, 0, 0.2, 1)`

### 🧭 Principle 5: Journey (Momentum & Milestone Progression)
- **Physical Metaphor:** Moving along the coastal trail from Dahab to Ras Abu Galum or driving the mountain pass from Sharm El-Sheikh.
- **Behavioral Characteristics:** Directional horizontal momentum with magnetic snapping to distinct chronological milestones.
- **Applied Surfaces:** 5-Day itinerary day switchers, horizontal experience carousels, photo galleries, step-by-step onboarding, and transfer route checkpoints.
- **Cubic Bezier:** `cubic-bezier(0.22, 1, 0.36, 1)`

---

## 2. Standardized Timing Tokens & Easing Curves

All interactive components must consume standardized duration and easing tokens rather than arbitrary inline timing values.

### A. Easing Curve Definitions

```css
:root {
  /* 🌊 Water: Smooth fluid deceleration */
  --ease-water: cubic-bezier(0.25, 1, 0.5, 1);

  /* 🏜️ Desert: Grounded, high-mass settling */
  --ease-desert: cubic-bezier(0.16, 1, 0.3, 1);

  /* 💨 Wind: Sinusoidal continuous sway */
  --ease-wind: cubic-bezier(0.45, 0, 0.55, 1);

  /* 🌅 Sunset: Atmospheric gradual crossfade */
  --ease-sunset: cubic-bezier(0.4, 0, 0.2, 1);

  /* 🧭 Journey: Linear deceleration with milestone snapping */
  --ease-journey: cubic-bezier(0.22, 1, 0.36, 1);

  /* 🌿 Organic Spring: Subtle organic settle */
  --ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.15);
}
```

### B. Standard Duration Matrix

| Token | Milliseconds | Easing Archetype | Primary Use Cases |
|---|---|---|---|
| `motion-instant` | `100ms` | `linear` | Tooltip visibility, radio toggles, icon color shifts |
| `motion-fast` | `200ms` | `var(--ease-desert)` | Button click compression, badge hover highlights, tab indicators |
| `motion-base` | `320ms` | `var(--ease-water)` | Card hover elevations, dropdown menu reveals, accordion expansion |
| `motion-deliberate`| `480ms` | `var(--ease-water)` | Full-screen modal slide-in, bottom drawer reveals, search dialogs |
| `motion-cinematic` | `800ms` | `var(--ease-sunset)` | Hero background changes, theme mode morphs, image lightbox reveals |
| `motion-ambient` | `3200ms` | `var(--ease-wind)` | Radar pulses, wave divider shimmer, compass oscillation loop |

---

## 3. Motion Implementation in Code

### A. TypeScript Motion Tokens (`src/tokens/motion.ts`)

```typescript
export const DAHAB_MOTION = {
  easings: {
    water: 'cubic-bezier(0.25, 1, 0.5, 1)',
    desert: 'cubic-bezier(0.16, 1, 0.3, 1)',
    wind: 'cubic-bezier(0.45, 0, 0.55, 1)',
    sunset: 'cubic-bezier(0.4, 0, 0.2, 1)',
    journey: 'cubic-bezier(0.22, 1, 0.36, 1)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.15)',
  },

  durations: {
    instant: '100ms',
    fast: '200ms',
    base: '320ms',
    deliberate: '480ms',
    cinematic: '800ms',
    ambient: '3200ms',
  },

  transitions: {
    waterSlide: 'all 320ms cubic-bezier(0.25, 1, 0.5, 1)',
    desertPress: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)',
    sunsetFade: 'opacity 800ms cubic-bezier(0.4, 0, 0.2, 1), background-color 800ms cubic-bezier(0.4, 0, 0.2, 1)',
    windHover: 'transform 240ms cubic-bezier(0.45, 0, 0.55, 1)',
    journeySlide: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)',
  },
} as const;
```

### B. Motion Variant Presets for `motion/react`

```typescript
import { DAHAB_MOTION } from '../tokens/motion';

// 🌊 1. Water Reveal (Modals, Sheets, Dialogs)
export const waterRevealVariants = {
  initial: { opacity: 0, y: 20, scale: 0.98 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.38,
      ease: [0.25, 1, 0.5, 1],
    },
  },
  exit: {
    opacity: 0,
    y: 12,
    scale: 0.98,
    transition: {
      duration: 0.24,
      ease: [0.25, 1, 0.5, 1],
    },
  },
};

// 🏜️ 2. Desert Button Press
export const desertButtonMotion = {
  whileHover: { scale: 1.02, transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] } },
  whileTap: { scale: 0.97, transition: { duration: 0.12, ease: [0.16, 1, 0.3, 1] } },
};

// 🧭 3. Journey Horizontal Slider (Days & Timeline)
export const journeySlideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 32 : -32,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.36,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 32 : -32,
    opacity: 0,
    transition: {
      duration: 0.24,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
};
```

---

## 4. Component Motion Recipes

### Recipe A: Desert Button Press
- **Default State:** Flat elevation or subtle border glow.
- **Hover State:** Translate `-1px` vertically with a soft shadow bloom (`duration: 180ms`, `ease: desert`).
- **Active / Tap State:** Compress scale to `0.97` with zero vertical elevation (`duration: 100ms`, `ease: desert`).

### Recipe B: Water Bottom Drawer & Sheet Presentation
- **Entry:** Glide upwards from `translateY(100%)` with `--ease-water` over `420ms`.
- **Backdrop:** Background overlay transitions from `opacity: 0` to `opacity: 0.6` with backdrop blur increasing from `0px` to `16px`.
- **Drag Feedback:** Elastic resistance when dragged past constraints, snapping shut if released past 40% of viewport height.

### Recipe C: Live Marine Indicator Sway (Wind & Wave)
- **Oscillation:** Continuous sine loop shifting horizontal position by `±3px` over `3.2s` with `cubic-bezier(0.45, 0, 0.55, 1)`.
- **Wind Compass Direction:** On live data refresh, vector needle rotates smoothly to the new azimuth degree over `600ms` with `--ease-water`.

### Recipe D: Sunset Phase Crossfade (Dahab Time)
- **Trigger:** Automatic local diurnal change or user manual preview override.
- **Execution:** Canvas neutral tones, accent pill colors, and atmospheric ambient gradients transition simultaneously over `800ms` with `--ease-sunset`. Text contrast is preserved at every frame.

---

## 5. Strict Reduced-Motion & Performance Protocols

To guarantee accessibility for users with vestibular sensitivities and ensure smooth 60fps execution on mobile devices outdoors under the Sinai sun:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Motion Safety Rules:
1. **Never Move Content Drastically on Screen Load:** Large layout shifts (`y: 100px+`) are strictly forbidden. Content entrances are capped at `12px–20px` delta.
2. **Respect `prefers-reduced-motion`:** All continuous ambient loops (wind float, radar pulse) and kinetic translations must instantly collapse to static, high-contrast states.
3. **GPU-Accelerated Properties Only:** Animate strictly `transform` and `opacity`. Never animate `width`, `height`, `margin`, `padding`, or `top/left` properties.
4. **Stagger Limits:** Maximum stagger delay across item grids is capped at `40ms` per item, with a total stagger sequence ceiling of `280ms`.
