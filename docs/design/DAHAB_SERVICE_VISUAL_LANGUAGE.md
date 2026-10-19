# DAHAB VISUAL LANGUAGE SYSTEM
## Service Visual Identity & Domain Token Taxonomy

---

### 1. The Domain Identity Philosophy

With over 20+ distinct travel services in the Dahab ecosystem (from Sharm airport transfers and technical freediving to Bedouin mountain dinners and scooter hire), travelers need **instant visual scannability** without fragmenting the unified brand identity.

Each major service category has a dedicated **accent personality** and **domain motif**, while strictly sharing the same container geometry, typography scale, button physics, and neutral canvas foundation.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   ONE BRAND · DISTINCT SERVICE ACCENTS                │
├─────────────────┬──────────────────┬─────────────────┬─────────────────┤
│ 🤿 DIVING       │ 🏜️ SAFARI        │ 🍽️ FOOD         │ 🛵 MOBILITY     │
│ Deep Sea & Teal │ Sand & Sun Gold  │ Sunset Coral    │ Lagoon Teal     │
│ #062C35 / #20A89A│ #C7A56A / #E7A83B│ #D96C4F / #EA8E75│ #0F6F78 / #52C4B7│
├─────────────────┼──────────────────┼─────────────────┼─────────────────┤
│ 🏕️ STAYS        │ 🧘 WELLNESS      │ 🚐 TRANSFERS    │ 🌙 NIGHTLIFE    │
│ Soft Sand Ivory │ Glassy Turquoise │ Obsidian Night  │ Phosphor Teal   │
│ #EFE8D8 / #8F7242│ #52C4B7 / #D5F3EF│ #04171D / #E7A83B│ #0A3A46 / #F4C36C│
└─────────────────┴──────────────────┴─────────────────┴─────────────────┘
```

---

### 2. Service Category Token Matrix

| Service Domain | Signature Color | Glow / Accent Pill | Domain Motif | Typical Tagline |
|---|---|---|---|---|
| **Diving & Freediving** | `#062C35` (Deep Sea) | `badge-dahab-lagoon` | Diver & Table Coral | World-class drop-offs & coral pinnacles |
| **Desert Safaris & Canyons** | `#C7A56A` (Amber Sand) | `badge-dahab-gold` | Granite Peak & Camel | Bedouin firelight & sandstone gorges |
| **Food & Dining** | `#D96C4F` (Sunset Coral) | `badge-dahab-coral` | Fresh Fish & Tea Cup | Fresh Red Sea catch & artisan bakeries |
| **Coastal Mobility (Scooters)** | `#0F6F78` (Lagoon Teal) | `badge-dahab-sea` | Scooter & Road Track | Coastline freedom along the Gulf of Aqaba |
| **Accommodation & Camps** | `#EFE8D8` (Soft Sand) | `badge-dahab-sand` | Bedouin Tent & Palm | Waterfront eco-camps & boutique stone rooms |
| **Airport & Border Transfers** | `#04171D` (Deep Night) | `badge-dahab-dark-gold`| 4x4 Vehicle & Compass | Sharm el-Sheikh to Dahab direct private rides |
| **Wellness & Yoga** | `#52C4B7` (Lagoon Glass) | `badge-dahab-dark-lagoon`| Sun Arc & Wave Swell | Sunrise sea-deck practice & breathwork |

---

### 3. Reusable Component Integration

Services consume tokens via standard TypeScript helpers:

```typescript
import { getServiceTheme } from '../tokens/services';

const theme = getServiceTheme('diving');
// Returns:
// {
//   id: 'diving',
//   label: 'Diving & Freediving',
//   labelAr: 'الغوص والغوص الحر',
//   color: '#062C35',
//   accentColor: '#20A89A',
//   badgeClass: 'badge-dahab-lagoon',
//   iconName: 'diver',
//   motifName: 'reef'
// }
```

This guarantees zero style fragmentation when new experiences, tours, or workshops are added to the platform.
