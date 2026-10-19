# DAHAB VISUAL LANGUAGE SYSTEM
## Custom Iconography & Vector Language

---

### 1. The Core Icon Philosophy

Standard multi-purpose icon libraries (Lucide, Heroicons, FontAwesome) lack the specific soul and maritime-desert geometry of South Sinai. While standard utility icons (arrows, checks, close X, search) remain functional, **all signature Dahab domain concepts must utilize our bespoke Dahab Icon Language**.

```
❌ BANNED
- Generic multi-style icon mismatches (mixing filled, outline, duotone haphazardly)
- Overly sharp brutalist 90° corners
- Cartoonish or clip-art tourist illustrations
- Ultra-thin 0.5px wireframes that disappear under Sinai outdoor sunlight

✅ REQUIRED: The "Hand-Touched Organic Geometric" Style
- Consistent 1.75px – 2.0px stroke on 24×24px coordinate grid
- Subtle rounded caps and joins (`stroke-linecap="round" stroke-linejoin="round"`)
- Hand-touched curves inspired by Bedouin weave patterns, wave crests, and granite fissures
- Dual-tone capability: Base stroke with signature Lagoon Teal or Sun Gold accent fill
```

---

### 2. The 12 Signature Dahab Icons Matrix

| Domain Key | Concept | Vector Metaphor | Primary Component Use |
|---|---|---|---|
| `diver` | Scuba & Technical Diver | Streamlined diver silhouette with cylinder & mask | Diving Hub, Dive Centers, Depth Logs |
| `fin` | Freediving & Snorkel Fin | Long-blade freediving fin blade with water wake | Snorkeling Sites, Equipment, Lighthouse Entry |
| `reef` | Living Coral & Marine Garden | Organic table coral branching with delicate fauna | Reef Status, Marine Protected Areas, Blue Hole |
| `mountain` | Sinai Granite Peaks & Canyons | Angular mountain crest with layered geological strata | Desert Safaris, Mount Sinai, Canyon Treks |
| `sun` | Sinai Solar Arc & Golden Hour | Rising sun disc over horizon with radiating heat rays | Daylight tracker, Golden Hour indicator, Weather |
| `wind` | Red Sea Thermal Wind Vector | Flowing aerodynamic streamlines with directional arrowhead | Windsurf, Kitesurf Lagoon, Lagoon Waves |
| `camel` | Bedouin Camel & Desert Caravan | Iconic single-hump camel silhouette with saddle curve | Desert Dining, Bedouin Camp, Mountain Safaris |
| `scooter` | Coastal Scooter & Mobility | Classic vintage coastal scooter with luggage rack | Scooter Rentals, Local Transit, Coastal Road |
| `food` | Fresh Red Sea Fish & Grill | Grilled whole sea bass over hot charcoal embers | Seafood Catch of the Day, Bedouin Dinners |
| `coffee` | Bedouin Sage Tea & Artisan Brew | Steaming glass cup with mint leaf & habaq sprig | Ralph's Bakery, Everyday Cafe, Bedouin Hospitality |
| `luggage` | Traveler Backpack & Gear Pack | Sturdy expedition pack with bedouin strap details | Trip Builder, Packing Checklist, Luggage Storage |
| `transfer` | 4x4 Jeep & Sharm Airport Van | Rugged desert 4x4 / private transfer silhouette | Sharm Airport Shuttles, Taba Border, Blue Hole Taxi |

---

### 3. Grid, Stroke, & Optical Weight Specifications

```
24x24 Vector Coordinate Canvas:
┌────────────────────────┐
│  . . . . . . . . . . . │  Padding: 2px safe zone on all edges
│  . . ┌──────────────┐. │  Active Drawn Area: 20x20px
│  . . │              │. │  Stroke Width: 1.75px (default), 2.0px (emphasis)
│  . . │  ICON BODY   │. │  Line Cap: round
│  . . │              │. │  Line Join: round
│  . . └──────────────┘. │  Optical Center: Centered on 12,12
│  . . . . . . . . . . . │
└────────────────────────┘
```

1. **Optical Centering:** Visual weight is balanced against the center of gravity, not just the bounding box.
2. **High-Contrast Outdoor Performance:** When rendered at 16×16px on mobile screens, strokes remain legible with minimum 1.5px thickness.
3. **Accent Drops:** Certain signature icons have a secondary accent fill at `15% opacity` (e.g., the sun disc with `fill="currentColor" fill-opacity="0.15"`).

---

### 4. Code Implementation Architecture

All custom icons are encapsulated in `<DahabIcon name="..." size={20} className="..." />` to guarantee single-source-of-truth rendering, seamless tree-shaking, and instant theming with Tailwind color tokens (`text-dahab-teal`, `text-dahab-gold`, `text-dahab-coral`).
