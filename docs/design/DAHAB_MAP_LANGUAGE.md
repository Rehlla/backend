# DAHAB VISUAL LANGUAGE SYSTEM
## Dahab Map Language & Cartographic Identity

---

### 1. Cartographic Vision: The Dahab Living Map

Standard Google Maps embeds or Mapbox default styles feel like generic urban navigation apps. Dahab’s geography is dramatically singular: **2,000-meter pink granite peaks plummeting directly into a 1,000-meter deep marine trench within 500 meters of shoreline**.

Our cartographic language turns the map into a signature brand asset inspired by vintage marine charts, geological survey maps of Sinai, and modern vector cartography.

```
❌ BANNED (Generic Web Map Traps)
- White road grids with yellow highways and pastel green generic park blocks
- Standard red tear-drop Google pins
- Cluttered commercial POI popups with crowded reviews
- Inaccurate flat terrain hiding the mountain wall and reef drop-offs

✅ REQUIRED: The "Sinai Topographic-Marine" Cartography
- Dark Obsidian/Deep Sea ocean base (#04171D to #062C35)
- Topographic contour elevation lines tracing the Sinai mountain massif
- Distinct coral reef drop-off line highlighted in Lagoon Turquoise (#20A89A)
- Golden coastal desert tracks (#E7A83B) connecting Lighthouse to Blue Hole
- Handcrafted circular micro-pins with domain glyphs (dive mask, fork, palm, bedouin tent)
- Clear Arabic and English bilingual area typography
```

---

### 2. Cartographic Layers & Color Specifications

```
  ┌────────────────────────────────────────────────────────┐
  │ 🏔️ SINAI GRANITE MASSIF (West)                         │
  │ Color: #0A1E24 / #0F2E36 with #20A89A (10% topo lines) │
  ├────────────────────────────────────────────────────────┤
  │ 🛣️ COASTAL DIRT & ASPHALT TRACKS                      │
  │ Color: #E7A83B (Gold, 2.5px dashed stroke)             │
  ├────────────────────────────────────────────────────────┤
  │ 🏖️ LAGOON & SHORE SHELF (Intertidal)                   │
  │ Color: #104957 with subtle sand stippling              │
  ├────────────────────────────────────────────────────────┤
  │ 🪸 CORAL REEF DROP-OFF & WALL                          │
  │ Color: #20A89A (Lagoon Turquoise, 4px glowing vector)  │
  ├────────────────────────────────────────────────────────┤
  │ 🌊 GULF OF AQABA DEEP TRENCH (East)                    │
  │ Color: #04171D (Deep Abyss, 800m+ bathymetric lines)   │
  └────────────────────────────────────────────────────────┘
```

---

### 3. Geographic Key Zones & Area Labeling

| Dahab Area | Coastal Role | Vector Accent | Key Landmark Pins |
|---|---|---|---|
| **Blue Hole & The Bells** | Deep North Marine Reserve | Turquoise Reef Halo | The Arch, The Bells Entry, Camel Station |
| **Eel Garden** | North Residential & Marine Wall | Fine Coral Green | Garden Eel Bank, Coral Pinnacles |
| **Lighthouse Bay** | Central Waterfront & Promenade | Warm Gold Anchor | Lighthouse Reef, Ralph's Bakery, Ali Baba |
| **Mashraba & Laguna** | South Sandy Spit & Windsurfing | Wind Streamlines | Windsurf Spit, Baby Bay, Kite Lagoon |
| **Assala Local Quarter** | Authentic Bedouin Town Market | Warm Sand Block | Assala Market, Local Spice Bazaars |
| **Wadi Gnai & Canyons** | Inland Mountain Climbing | Topographic Peaks | Granite Boulders, Bedouin Date Palm Oasis |
| **Ras Abu Galum** | North Protected Bedouin Wilderness | Desert Starlight | Camel Track, Bedouin Fish Camp |

---

### 4. Interactive Custom Pin System

Our pins are designed as precision circular instrument markers:

1. **Active/Selected Marker:**
   - Background: Sinai Sun Gold (`#E7A83B`) with Deep Night ink (`#04171D`)
   - Glow: `box-shadow: 0 0 16px rgba(231, 168, 59, 0.45)`
   - Callout: Pill tag showing name, distance, and walk time (`180m · 2 min walk`)
2. **Standard Landmark Marker:**
   - Background: Dark Red Sea (`#062C35`) with Lagoon border (`border: 1px solid #20A89A`)
   - Icon: White 14px vector glyph (`DahabIcon`)
3. **Marine Dive Marker:**
   - Special wave ring pulse indicating current underwater visibility.

---

### 5. Vector Map Accessibility & Performance

- **Lightweight SVG Foundation:** Map is rendered via optimized vector paths without heavy megabyte tile dependencies, ensuring instant sub-second rendering even on 3G beach connections in South Sinai.
- **Accessible ARIA Role:** Every map landmark has a linked keyboard-focusable card and semantic ARIA tree (`role="region" aria-label="Interactive Map of Dahab"`).
- **Dark & Light Adaptability:** The map maintains high contrast and visual integrity across day and night view modes.
