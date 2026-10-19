# DAHAB SPATIAL & ONTOLOGICAL KNOWLEDGE GRAPH
**Truth Status**: PRODUCTION GRAPH ONTOLOGY  
**Node Types**: `Place`, `Activity`, `Supplier`, `Restaurant`, `Transport`, `Condition`, `Hazard`, `Persona`  
**Last Verified**: August 2026

## 1. Graph Entity Schema & Relationships

```
(Place: Lighthouse)
  ├── HAS_ACCESS_TYPE ──→ (Direct Promenade Walk / 0 min)
  ├── HAS_SHORE_ENTRY ──→ (Sandy Gradual Slope / No Booties Needed)
  ├── COMPATIBLE_WITH ──→ (Activity: Try Scuba Dive, Snorkeling, Night Dive, Sunset Stroll)
  ├── CONNECTED_TO ────→ (Restaurant: Ali Baba, Jackie's, Ralph's Bakery)
  ├── SERVED_BY_SUPPLIER → (Supplier: Red Sea Relax Dive, Sinai Safari Co.)
  └── SENSITIVE_TO ────→ (Condition: Wind > 25 kts / Otherwise Sheltered)

(Place: Eel Garden)
  ├── HAS_ACCESS_TYPE ──→ (Pedestrian Promenade / 8 min walk from center)
  ├── HAS_SHORE_ENTRY ──→ (Coral Reef Channel / Requires Mid-to-High Tide)
  ├── COMPATIBLE_WITH ──→ (Activity: Certified Reef Dive, Garden Eel Snorkeling)
  ├── CONNECTED_TO ────→ (Restaurant: Ralph's Asalah, Yum Yum Falafel)
  └── SENSITIVE_TO ────→ (Condition: Low Tide Spring Surge / Low Visibility at Outgoing Tide)

(Place: The Blue Hole)
  ├── HAS_ACCESS_TYPE ──→ (Pickup Taxi 22 min / 4x4 Road)
  ├── HAS_SHORE_ENTRY ──→ (Bells Chimney Entry / Saddle Exit)
  ├── COMPATIBLE_WITH ──→ (Activity: Deep Certified Diving, Freediving Depth Training, Snorkeling)
  ├── REQUIRES_PERMIT ──→ (South Sinai Protected Area Gate / $10 Foreigners)
  ├── RECOVERY_ROUTE ───→ (If Wind > 20 kts: Reroute to Lighthouse or Southern Sheltered Bays)
  └── EXPEDITION_LINK ──→ (Boat or Camel Trek to Ras Abu Galum & Blue Lagoon)

(Place: Laguna Sand Spit)
  ├── HAS_ACCESS_TYPE ──→ (Paved Road / 8 min Taxi or 15 min Bike)
  ├── HAS_SHORE_ENTRY ──→ (Pure Soft Sandy Beach / Zero Reef Hazard)
  ├── COMPATIBLE_WITH ──→ (Activity: Kitesurfing, Windsurfing, Relaxed Sunset Walk)
  ├── HIGH_WIND_BENEFIT → (Wind 15-28 kts creates ideal flat water speed strip)
  └── CONNECTED_TO ────→ (Restaurant: Laguna Club House, Swiss Inn Deck)
```

---

## 2. Deterministic Context Slicing Rules for DayGI
When DayGI answers a traveler prompt:
1. **Locate Target Node**: Determine traveler's current place node (`place-lighthouse`, `place-mashraba`, `place-laguna`, `place-blue-hole`).
2. **Slice 1-Hop & 2-Hop Relations Only**: Extract immediate connected food, walking transit times, shore entry conditions, and active weather alerts.
3. **Never Inject Entire Graph into Prompt**: Only inject the relevant sub-graph JSON slice (< 800 tokens) ensuring lightning-fast latency (< 1.2s) and deterministic accuracy.
