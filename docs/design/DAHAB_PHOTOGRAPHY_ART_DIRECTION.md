# DAHAB VISUAL LANGUAGE SYSTEM
## Photography Art Direction & Visual Authenticity Guide

---

### 1. Core Philosophy: The Anti-Stock Rule

Dahab is not a polished Mediterranean resort, a glossy luxury Dubai catalog, or a staged Egyptian tourism brochure. Dahab is raw Sinai granite, crystal Gulf of Aqaba depths, Bedouin firelight, salty wind-tousled hair, desert silence, and unhurried human connection.

```
❌ BANNED (Stock Tourism & Egypt Tropes)
- Staged influencer poses gazing into the distance with sunhats
- Over-saturated turquoise neon water filters (#00ffff overkill)
- Cliché Egyptian pyramids/pharaonic tropes pasted onto Sinai
- Plastic skin smoothing, airbrushed gym-model bodies, artificial smiles
- Unnatural studio lighting or flash photography in outdoor settings
- Generic drone top-downs devoid of human scale and texture
- Cluttered tourist crowds with plastic commercial umbrellas

✅ REQUIRED (Dahab Native Authenticity)
- Real humans: diverse travelers, freedivers, local Bedouin guides, cafe owners
- Natural textures: salt-encrusted skin, sun-warmed granite, coarse sand, weathered wood
- Candid, in-between moments: checking dive computers, passing mint tea, laughter over fresh fish
- Golden hour rim-lighting and deep blue-hour atmospheric moods
- Environmental integration: humans are part of the vast landscape, not dominating it
- Film-like warmth, analog grain, subtle halation, natural dynamic range
```

---

### 2. Color Grading & Tonal Profile

Every photo in the Dahab ecosystem must adhere to our standardized 35mm-inspired color profile:

| Photographic Axis | Target Setting | Visual Effect |
|---|---|---|
| **Shadows & Blacks** | Deep Ink (#04171D), crushed slightly with +3% warm teal lift | Cinematic film depth, avoids milky washed-out blacks |
| **Midtones & Skin** | Sinai Sand & Amber warmth (#C7A56A to #E7A83B) | Natural, healthy skin tones, sun-kissed Bedouin atmosphere |
| **Highlights** | Soft Sand Ivory (#F7F3EA), rolled off smoothly | No harsh digital clipping; sun glow is soft and warm |
| **Water / Ocean** | Deep Red Sea (#062C35) to Lagoon Teal (#20A89A) | True Red Sea color: rich deep blues near drop-offs, jade near shore |
| **Color Temperature** | Warm bias (+300K to +600K shift), 5200K – 5800K daylight | Feels sun-drenched and welcoming |
| **Texture & Grain** | Fine 35mm film grain (ISO 400 aesthetic, 2–4% opacity in UI) | Tactile materiality, avoids flat digital sterility |

---

### 3. Subject Matter & Thematic Pillars

#### A. Ocean & Submarine Life (Diving / Freediving / Reefs)
- **Framing:** Wide underwater angles capturing the scale of the drop-off (Blue Hole, Canyon, Bells).
- **Subjects:** Divers in natural trim, adjusting masks, safety stops, freedivers gliding effortlessly with monofins.
- **Lighting:** Natural water rays (caustics) piercing down from surface; deep gradient from teal surface to midnight drop-off.
- **Marine Life:** Red Sea table corals, anemone fish, garden eels in eel garden, lionfish on pinnacles. Never touched or disturbed.

#### B. Sinai Desert & Bedouin Hospitality (Safari / Canyons / Mountains)
- **Framing:** Vast geological scale — granite canyons framing small figures or 4x4 tracks.
- **Subjects:** Bedouin hosts brewing sweet habaq (Sinai sage) tea over iron kettles; bread baked in embers (libba); camel silhouettes at twilight.
- **Lighting:** Raking late-afternoon sunlight casting long shadows across sand ripples; starlight over mountain ridgelines (Mount Sinai / St. Catherine).

#### C. Local Life, Cafés & Dahab Town (Lighthouse, Eel Garden, Assala)
- **Framing:** Eye-level documentary style along the pedestrian waterfront promenade.
- **Subjects:** Sourdough pretzels at Ralph's Bakery; wooden decks over the water with floor cushions; cats sunbathing on stone walls; vintage bicycles and scooters parked against adobe walls.
- **Lighting:** Diffused morning sea-glow or warm nighttime lantern lights strung between palms.

#### D. Coastal Mobility & Freedom (Scooters / Bicycles / Jeeps)
- **Framing:** Dynamic horizontal tracking shots along the coastal mountain road between Dahab and Blue Hole.
- **Subjects:** A scooter rider with a dive bag or snorkel fins strapped to the back; an open-air bedouin pickup cruising against the pink granite backdrop.

---

### 4. Composition & Crop Ratios

1. **Hero & Panoramic Surfaces (16:9, 21:9):**
   - Negative space on the text side (left for LTR, right for RTL).
   - Horizon line strictly on the upper third or lower third (Golden Ratio).
   - Contrast gradients applied in UI via CSS, never baked harshly into the image file.

2. **Editorial Story & Highlight Modules (4:3, 3:2, 16:10):**
   - Subject off-center with environmental context.
   - Shallow depth of field (f/2.0 – f/4.0) to separate the foreground subject from the textured background.

3. **Compact Discovery & Utility Thumbnails (1:1, 4:5):**
   - Immediate focal point (a steaming glass of Bedouin tea, a pair of fins resting on a wooden deck, a fresh grilled fish on ice).
   - High legibility even at 80×80px or 120×120px sizes.

---

### 5. Section-by-Section Usage Matrix

| Product Section | Photographic Tone | Primary Subject Focus | Aspect Ratio | Color Bias |
|---|---|---|---|---|
| **Hero / Landing** | Expansive, cinematic, majestic | Coastline where jagged mountains meet azure water | 16:9 / 21:9 | Deep Red Sea + Golden Light |
| **Sinai Radar / Live** | Atmospheric, environmental | Current state of water (calm swells, wind ripples) | 16:9 / Widget | Real-time time-of-day tone |
| **Diving Service** | Immersive, technical yet peaceful | Diver descent into Blue Hole arch, coral pinnacles | 4:3 / 16:9 | Red Sea Deep Teal (#062C35) |
| **Safari Service** | Raw, earthy, timeless | Colored Canyon rock strata, Bedouin campfire | 4:3 / 16:9 | Sinai Amber Sand (#C7A56A) |
| **Food & Dining** | Warm, sensory, appetizing | Seafood grill by the water, freshly baked bedouin flatbread | 1:1 / 4:3 | Sunset Coral & Warm Amber |
| **Mobility & Transfers** | Open road, adventurous, practical | Coastal highway between granite peaks and the Gulf | 16:9 / 3:2 | Daylight Cyan & Granite Gray |
| **Accommodation** | Serene, bohemian, grounded | Simple stone bungalow, hammock with sea view | 4:3 / 3:2 | Soft Sand & White Linens |
| **Empty / Loading States** | Minimal, graphic, storytelling | Lonely desert path, single wave crest, diving buoy | 1:1 / Vector-mixed | Monochromatic Ink & Sand |
| **Final CTA** | Soulful, unforgettable | Golden hour sunset over Dahab bay, warm lantern glow | 16:9 / Banner | Golden Hour Coral (#D96C4F / #E7A83B) |

---

### 6. Technical Implementation Standards

- **Format:** Modern Next-Gen `.webp` and `.avif` with progressive JPEG fallbacks.
- **Responsiveness:** Standard `srcset` breakpoints (640w, 1024w, 1600w, 2400w).
- **Accessibility:** Mandatory descriptive `alt` text explaining context (e.g., `"Freediver descending along the coral wall at Dahab Blue Hole during morning sun"`), never empty or generic `"image"`.
- **Performance:** `loading="lazy"` on all cards below the viewport fold, `fetchpriority="high"` on Hero.
