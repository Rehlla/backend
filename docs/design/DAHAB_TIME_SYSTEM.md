# DAHAB VISUAL LANGUAGE SYSTEM
## "Dahab Time" 4-Phase Chrono-Visual System

---

### 1. The Dahab Time Concept

Dahab’s daily rhythm is dictated by the sun and tides:
- **Mornings** are glassy, calm, and filled with the scent of fresh coffee and bakeries.
- **Midday** is fierce sunlight, deep blue lagoon clarity, and active windsurfing.
- **Golden Hour** turns the Sinai granite mountains blazing pink and casts amber reflections across the Gulf of Aqaba.
- **Night** brings deep desert starlight, acoustic oud music, and quiet waterfront lanterns.

Our interface subtly reflects this rhythm across key atmospheric components (Hero, Sinai Radar, Companion widgets, Final CTA) while keeping text contrast, forms, and product utility 100% stable and accessible.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DAHAB TIME SYSTEM MATRIX                        │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ 🌅 MORNING      │ ☀️ MIDDAY        │ 🌇 GOLDEN HOUR  │ 🌌 NIGHT        │
│ (06:00 – 11:30) │ (11:30 – 16:30)  │ (16:30 – 19:30) │ (19:30 – 06:00) │
├─────────────────┼──────────────────┼─────────────────┼─────────────────┤
│ Soft Turquoise  │ Vivid Azure Blue │ Amber Sun Gold  │ Deep Obsidian   │
│ Early Sunlight  │ High Sea Clarity │ Coral Mountains │ Desert Starlight│
│ Glassy Water    │ Thermal Wind     │ Warm Lanterns   │ Phosphor Teal   │
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

---

### 2. Phase Color Palettes & Lighting Accents

#### Phase 1: Morning (الفجر والصباح)
- **Primary Ambient:** Soft Lagoon Turquoise (`#20A89A` at 15% opacity) over Deep Sea (`#062C35`).
- **Accent Glow:** Gentle Morning Amber (`#F4C36C`).
- **Hero Video/Photo Mood:** Calm glassy water at Lighthouse, divers strapping tanks, quiet bakery steam.
- **Microcopy Greeting:** *"Good morning from Dahab · The sea is glassy and calm."* / *"صباح الخير من دهب · البحر هادي والجو مثالي."*

#### Phase 2: Midday (الظهيرة والبحر)
- **Primary Ambient:** Brilliant Red Sea Azure (`#0F6F78`) with High-Sun Ivory (`#FAF7F0`).
- **Accent Glow:** Sun Gold (`#E7A83B`).
- **Hero Video/Photo Mood:** High visibility underwater drop-offs, kite surfers catching wind in Laguna.
- **Microcopy Greeting:** *"Peak visibility across all reefs · Wind 16–19 kn in the lagoon."* / *"رؤية واضحة في كل الشعاب · والرياح نشطة في اللاجونا."*

#### Phase 3: Golden Hour (ساعة الغروب الذهبية)
- **Primary Ambient:** Sunset Coral (`#D96C4F` / `#EA8E75`) blended with Deep Granite (`#0A1E24`).
- **Accent Glow:** Desert Sun Gold (`#E7A83B`).
- **Hero Video/Photo Mood:** Pink Sinai mountains glowing behind the bay, camel rides at sunset.
- **Microcopy Greeting:** *"Golden hour over South Sinai · Perfect time for waterfront dining."* / *"وقت الغروب الذهبي · الجبال باللون الوردي والبحر ساحر."*

#### Phase 4: Night & Starlight (ليل دهب وسكون النجوم)
- **Primary Ambient:** Deep Red Sea Night (`#04171D`) with subtle Starlight Silver (`#E7D3AE` at 10%).
- **Accent Glow:** Bioluminescent Lagoon Teal (`#52C4B7`).
- **Hero Video/Photo Mood:** Quiet waterfront deck cushions, acoustic guitar, starlight over the Gulf.
- **Microcopy Greeting:** *"Sinai starlight over the Gulf · Peaceful night along the promenade."* / *"سكون الليل ونجوم سيناء · أجواء هادية على الممشى."*

---

### 3. Boundary Rules & Usability Invariants

1. **No Layout Shifts:** Time changes NEVER shift DOM dimensions, grid structures, button sizes, or interactive element locations.
2. **Text Contrast Floor:** All body and header text maintains strict **WCAG AA contrast (≥ 4.5:1 for body, ≥ 3:1 for headers)** regardless of the active time theme.
3. **Manual Override Support:** Travelers can preview any time of day via a discrete toggle in the Sinai Radar or footer, allowing them to plan night dives or morning trips with corresponding visual context.
4. **Zero Battery Drain:** Time updates use a single lightweight hook (`useDahabTime()`) with a 60-second evaluation interval and zero continuous re-renders.
