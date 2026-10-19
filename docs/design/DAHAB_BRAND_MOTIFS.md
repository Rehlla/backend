# DAHAB VISUAL LANGUAGE SYSTEM
## Brand Motifs, Textures & "Dahab Objects"

---

### 1. The Brand Motif Philosophy

To make the application feel unmistakably like Dahab, we avoid generic rectangular divider rules (`<hr />`), placeholder empty boxes, and decorative SaaS geometric blobs.

Instead, we employ **7 signature "Dahab Objects"** rooted in Sinai’s geography, sea geometry, and Bedouin heritage:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        THE 7 DAHAB BRAND MOTIFS                        │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ 🌊 Wave Crest   │ 🏔️ Topo Contour  │ ☀️ Solar Arc    │ 🧭 Compass Rose │
│ Organic marine  │ Geological rock  │ Rising/Setting  │ Coastal azimuth │
│ water rhythm    │ elevation strata │ sun geometry    │ navigation      │
├─────────────────┼──────────────────┼─────────────────┼─────────────────┤
│ 🛣️ Desert Route │ 🪸 Coral Line Art│ 👣 Footprint    │ 🌾 Sand Grain   │
│ Coastal path &  │ Submarine table  │ Shoreline walk  │ Tactile 35mm    │
│ journey trail   │ reef flora       │ Bedouin tracks  │ materiality     │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

---

### 2. Motif Specifications & Usage Rules

#### A. The Wave Crest (`DahabWaveDivider`)
- **Visual:** A continuous, calm single-line sinusoidal wave with varying stroke taper (`stroke-width="1.5"`).
- **Use:** Replaces generic horizontal line separators between major editorial sections.
- **Color:** `rgba(32, 168, 154, 0.35)` or `rgba(231, 168, 59, 0.35)`.

#### B. Topographic Elevation Contours (`DahabTopoBackground`)
- **Visual:** Smooth organic concentric rings mirroring South Sinai mountain elevation lines.
- **Use:** Low-opacity background texture (3% to 6% opacity) for dark hero surfaces, modals, and the Sinai Living Map.
- **Rule:** Must never interfere with foreground typography contrast.

#### C. The Solar Arc (`DahabSunArc`)
- **Visual:** 180-degree clean geometric semi-circle showing daytime progression, morning rays, or sunset glow.
- **Use:** Hero headers, Sinai Radar sunrise/sunset counters, time-of-day badges.

#### D. Coastal Route Vectors (`DahabRoutePath`)
- **Visual:** Tactile dashed line with milestone nodes linking itinerary points.
- **Use:** Day 1 to Day 3 itinerary connectors, transfer routes from Sharm El Sheikh to Dahab.

#### E. Living Reef & Coral Line Art (`DahabReefArt`)
- **Visual:** Minimalist single-line vector representation of Red Sea table coral branching.
- **Use:** Diving section watermarks, empty state illustrations, marine reserve notices.

#### F. Tactile Sand & 35mm Film Grain Texture (`.dahab-grain-subtle`)
- **Visual:** Ultra-fine 2% noise overlay simulating Sinai sand and analog film materiality.
- **Use:** Applied to body canvas and dark containers to eliminate sterile digital flatness.

---

### 3. Implementation Component: `<DahabMotif />`

All motifs are implemented as zero-dependency SVG React primitives in `src/components/common/DahabMotifs.tsx`:

```tsx
<DahabMotif name="wave-divider" className="text-dahab-teal/30 my-8" />
<DahabMotif name="topo-contour" className="text-dahab-sand/10 absolute inset-0 pointer-events-none" />
<DahabMotif name="compass-rose" size={24} className="text-dahab-gold" />
```
