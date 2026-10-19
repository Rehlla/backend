# DAHAB VISUAL LANGUAGE SYSTEM
## Environmental UI & Maritime Condition Indicators

---

### 1. The Environmental UI Philosophy

Dahab is an outdoor adventure environment where tides, wind, sea swells, and sun angles dictate whether you should freedive at the Lighthouse, kitesurf in the Laguna, or hike in Colored Canyon.

Standard weather apps display a generic sun-behind-cloud icon and a static number. **The Dahab Environmental UI gives travelers intuitive, sensory visual instruments** grounded in real Red Sea marine variables.

```
❌ BANNED
- Generic cartoon cloud/rain icons unrelated to arid South Sinai
- Raw ungrounded numbers without traveler interpretation (e.g. "22 km/h" with no advice)
- Fabricated or fake live feeds; indicators must state real measured conditions or clearly labeled historical averages

✅ REQUIRED: The "Sinai Marine Instrument" Language
- Directional Wind Compass with true Beaufort / Knot vector arrow
- Wave Rhythm Swell Bar with state taxonomy (Glassy · Light Chop · Swell)
- Underwater Visibility Depth Gauge (10m · 20m · 30m+ Crystal)
- Dual Temperature Meter (Air Temperature + Sea Surface Water Temp)
- Solar Arc Tracker showing real-time sun progression across the Sinai sky
```

---

### 2. Environmental Variables & Visual Metaphors

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ENVIRONMENTAL INSTRUMENT PRIMITIVES                  │
├──────────────────┬─────────────────┬──────────────────┬────────────────┤
│ 💨 WIND VECTOR   │ 🌊 WAVE SWELL   │ 🤿 VISIBILITY    │ 🌡️ DUAL TEMP   │
│ Direction & Kn   │ Water state bar │ Marine depth     │ Air vs. Water  │
│ 18 kn · NNE ↗    │ 0.3m · Glassy   │ 30m · Ultra-Clear│ 28° Air · 24° Sea│
└──────────────────┴─────────────────┴──────────────────┴────────────────┘
```

#### A. Wind Indicator (`WindGauge`)
- **Visual:** Circular compass dial with a rotating aerodynamic vector arrow pointing in true wind direction (e.g., North-Northeast thermal wind).
- **Condition Tiers:**
  - *0–8 kn (Gentle):* Ideal for beginner freediving and SUP paddle boarding. Accent: `#20A89A`.
  - *9–16 kn (Moderate):* Perfect for coastal snorkeling and boat trips. Accent: `#0F6F78`.
  - *17–25 kn (Active):* Prime condition for Laguna kitesurfing & windsurfing. Accent: `#E7A83B`.
  - *26+ kn (Gale):* Caution for open sea diving; recommend protected canyons. Accent: `#D96C4F`.

#### B. Wave & Tide Rhythm (`WaveRhythm`)
- **Visual:** Smooth oscillating wave vector whose amplitude matches the swell height.
- **States:** `Glassy (< 0.2m)` → `Gentle Ripple (0.2–0.5m)` → `Moderate Chop (0.5–1.0m)` → `High Swell (> 1.0m)`.

#### C. Underwater Visibility Gauge (`VisibilityMeter`)
- **Visual:** Vertical bathymetric clarity bar from 0m to 40m depth.
- **Clarity Levels:**
  - *30m+ (Crystal Clear):* Full Blue Hole arch visibility.
  - *20–30m (Good):* Ideal coral reef exploration.
  - *< 15m (Plankton Bloom):* Higher marine feeding activity; macro photography focus.

#### D. Solar Arc Progress (`SolarArc`)
- **Visual:** Half-circle geometric arc with current sun position marker, sunrise time, and golden hour timestamp.

---

### 3. Reusable Component Primitives

The system provides `<EnvironmentalWidget type="..." value="..." label="..." />` and composite strips like `<SinaiRadarStrip />` that integrate seamlessly into:
1. **The Sinai Radar Widget** on the homepage and mobile cockpit.
2. **Diving & Snorkeling Spot Detail Cards** (e.g., Blue Hole, Bells, Canyon, Islands).
3. **Daily Traveler Timeline** in the My Trip operating system.

---

### 4. Arabic Localization of Marine Terms

| Variable | English Label | Arabic Label | Context Description |
|---|---|---|---|
| **Wind** | Wind Speed & Direction | سرعة واتجاه الرياح | شمالية شرقية نشطة (مناسبة لركوب الأمواج) |
| **Waves** | Sea State & Swell | حالة البحر والأمواج | هادئ ومثالي للغطس والسنوركلنج |
| **Visibility** | Underwater Visibility | مدى الرؤية تحت الماء | فائقة الوضوح (أكثر من ٣٠ متر) |
| **Water Temp** | Sea Surface Temperature | حرارة مياه البحر | مياه دافئة ومثالية للغوص بدون بدلة ثقيلة |
| **Tide** | Low / High Tide | حالة المد والجزر | جزر منخفض (أفضل وقت لدخول الثقب الأزرق) |
