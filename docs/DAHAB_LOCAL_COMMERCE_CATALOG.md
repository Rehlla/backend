# Dahab Local Commerce Master Catalog
## Provenance-Aware Local Supplier, Activity, and Offer Intelligence

**Version:** 1.0.0  
**Environment:** Dahab Knowledge Operating System (DKOS 2.0)  
**Verification Standard:** CDWS Official Registry, Ministry of Tourism, Tribal Guilds, and Direct Ingestion Engine  
**Dataset Reference:** `/data/dahab_local_commerce.json`

---

## 1. Verified Local Supplier Directory

| Supplier ID | Business Name (EN / AR) | Category | Tier | CDWS Verified | Verification Level | Lead Contact & WhatsApp | Operating Area |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- | :--- |
| `SUP-KING-SAFARI` | **King Safari Dahab**<br>كينج سفاري دهب | `safari` | Tier 1 Certified | ❌ (Safari/MOT) | `WEB_CONFIRMED` | +20 100 682 8996 | El Masbat & Tourist Walkway |
| `RAW-SUP-BAKRY-SAFARI` | **Bakry Safari Dahab**<br>بكرى سفاري دهب | `safari` | Vetted Local Partner | ❌ | `SOURCE_REPORTED` | +20 109 923 4881<br>+20 114 522 9103 | Assalah Market & Lighthouse |
| `SUP-RED-SEA-RELAX` | **Red Sea Relax Dive Resort**<br>ريد سي ريلاكس لخدمات الغوص | `diving` | Tier 1 Certified | ✅ (`CDWS-DHB-104`) | `REGULATORY_VERIFIED` | +20 100 143 8266 | Lighthouse Beachfront |
| `SUP-DESERT-DIVERS` | **Desert Divers Dahab**<br>ديزرت دايفرز دهب | `diving` | Tier 1 Certified | ✅ (`CDWS-DHB-092`) | `REGULATORY_VERIFIED` | +20 100 684 0300 | Peace Road, Lighthouse |
| `SUP-POSEIDON-DIVERS` | **Poseidon Divers Dahab**<br>بوسيدون دايفرز دهب | `diving` | Tier 1 Certified | ✅ (`CDWS-DHB-071`) | `REGULATORY_VERIFIED` | +20 100 568 2145 | Masbat Bay Promenade |
| `SUP-SINAI-BEDOUIN-GUILD` | **Sinai Desert & Mountain Bedouin Guild**<br>رابطة أدلاء الصحراء والجبال البدوية (قبيلة المزينة) | `safari` | Tier 1 Certified | ❌ (Tribal Guild) | `SUPPLIER_CONFIRMED` | +20 109 451 7732 | Assalah Bedouin Village |
| `SUP-DAHAB-SAFARI-TOURS` | **Dahab Safari Day Tours**<br>دهب سفاري للرحلات اليومية | `safari` | Tier 2 Certified | ❌ | `WEB_CONFIRMED` | +20 102 334 9912 | Mashraba Street |
| `SUP-LAGUNA-WATERSPORTS` | **Dahab Laguna Wind & Kitesurf**<br>محطة لاجونا لركوب الأمواج والشراع | `safari` | Tier 1 Certified | ❌ (Watersports) | `SUPPLIER_CONFIRMED` | +20 101 776 5431 | Laguna Sandspit |

---

## 2. Canonical Activity Catalog

| Canonical Activity ID | Title (EN) | Title (AR) | Category | Duration | Access | Difficulty | Base Price (EGP) | Booking Mode |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| `ACT-BLUE-HOLE-SAFARI` | Blue Hole, Abu Galum & Blue Lagoon Day Safari | سفاري البلو هول ومحمية أبو جالوم والبلو لاجون | `safari` | 9.0h | 4X4 + Boat | All Levels | 550 EGP | `REQUEST_NOW` |
| `ACT-QUAD-TWILAT` | Quad Bike Sunset Safari to Jabal Al-Tawilat | سفاري البيتش باجي وغروب الشمس في جبل الطويلات | `safari` | 2.5h | VEHICLE | Beginner | 350 EGP | `BOOK_NOW` |
| `ACT-WISHWASHI-EXPEDITION` | Ras Shitan & Wadi El-Wishwashi Canyon Expedition | رحلة استكشاف وادي الوشواش والسباحة في رأس شيطان | `safari` | 10.5h | 4X4 | Intermediate | 750 EGP | `REQUEST_NOW` |
| `ACT-THREE-POOLS-SAFARI` | Three Pools Snorkeling & Southern Oasis Safari | سفاري السنوركلينج في الثري بولز والواحة الجنوبية | `safari` | 6.0h | VEHICLE | All Levels | 400 EGP | `BOOK_NOW` |
| `ACT-MOUNT-MOSES-TREK` | Mount Moses Summit Sunrise & St. Catherine Trek | صعود قمة جبل موسى لشروق الشمس وزيارة دير سانت كاترين | `safari` | 15.5h | HIKE | Advanced | 950 EGP | `REQUEST_NOW` |
| `ACT-WHITE-CANYON-SAFARI` | White Canyon & Ain Khodra Oasis Desert Crossing | سفاري الوادي الأبيض وواحة عين خضرة بالدفع الرباعي | `safari` | 10.0h | 4X4 | Intermediate | 1200 EGP | `REQUEST_NOW` |
| `ACT-INTRO-DISCOVER-DIVE` | Discover Scuba Diving (DSD) - First Time Shore Dive | تجربة الغوص الأولى للمبتدئين مع مدرب معتمد | `diving` | 3.0h | SHORE | Beginner | 1450 EGP | `BOOK_NOW` |
| `ACT-BLUE-HOLE-BELLS-DIVE`| Certified Guided Dive - The Bells & Blue Hole | غوصة موجهة للبلو هول ومنطقة البلز للغواصين المعتمدين | `diving` | 4.0h | SHORE | Advanced | 1100 EGP | `BOOK_NOW` |
| `ACT-CAMEL-DIVING-SAFARI` | Eco Camel Diving Safari to Ras Abu Galum (2 Dives) | سفاري الغوص البيئي بالجمال إلى رأس أبو جالوم | `diving` | 9.5h | CAMEL | Intermediate | 2400 EGP | `REQUEST_NOW` |
| `ACT-WADI-GNAI-CLIMBING` | Granite Rock Climbing & Bouldering in Wadi Gnai | تسلق صخور الجرانيت والبولدرينج في وادي قني | `safari` | 4.5h | 4X4 | Intermediate | 1600 EGP | `REQUEST_NOW` |
| `ACT-LAGUNA-KITESURF` | Private 2-Hour Kitesurfing Coaching (Flatwater) | درس كايت سيرف خاص وركوب الشراع في لاجونا دهب | `water_sport`| 2.0h | SHORE | Beginner | 2200 EGP | `REQUEST_NOW` |
| `ACT-GLASS-BOTTOM-BOAT` | Glass Bottom Coral Viewing Boat Cruise | جولة القارب الزجاجي لمشاهدة الشعاب المرجانية | `water_sport`| 1.5h | BOAT | All Levels | 350 EGP | `BOOK_NOW` |

---

## 3. Canonical Supplier Offer Catalog & Pricing Normalization

### 3.1 Desert & Mountain Safaris

#### Offer: `OFFER-KING-001` — Blue Hole + Abu Galum + Blue Lagoon
- **Supplier:** King Safari Dahab (`SUP-KING-SAFARI`)
- **Activity:** `ACT-BLUE-HOLE-SAFARI`
- **Price:** 550 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 08:30 AM → 05:30 PM (9.0h)
- **Includes:** 4x4 Land Cruiser transfer, Speedboat transfer across reef barrier to Abu Galum, Bedouin pickup truck to Blue Lagoon, Bedouin mint tea in beach hut.
- **Excludes:** National Park Environmental Fee ($10 foreigners / 50 EGP Egyptians), Snorkel gear rental, Lunch.
- **Verification:** `WEB_CONFIRMED` | **Source:** `flyer-king-safari-2026-p1`

#### Offer: `OFFER-KING-002` — Quad Bike Sunset Safari (Jabal Al-Tawilat)
- **Supplier:** King Safari Dahab (`SUP-KING-SAFARI`)
- **Activity:** `ACT-QUAD-TWILAT`
- **Single Buggy Price:** 350 EGP | **Double Buggy Price:** 450 EGP | **Basis:** `SINGLE`
- **Departure / Return:** 04:30 PM → 07:00 PM (2.5h)
- **Includes:** Automatic 350cc Quad Bike, Bedouin trail escort, Desert campfire tea at Jabal Al-Tawilat tent, Helmet.
- **Excludes:** Bedouin cotton scarf (50 EGP), Dust goggles (30 EGP), Dinner.
- **Verification:** `WEB_CONFIRMED` | **Source:** `flyer-king-safari-2026-p1`

#### Offer: `OFFER-BAKRY-001` — Panorama Dahab & Wadi Gnai Quad Safari
- **Supplier:** Bakry Safari Dahab (`RAW-SUP-BAKRY-SAFARI`)
- **Activity:** `ACT-QUAD-TWILAT`
- **Single Buggy Price:** 300 EGP | **Double Buggy Price:** 400 EGP | **Basis:** `SINGLE`
- **Departure / Return:** 04:30 PM → 06:30 PM (2.0h)
- **Includes:** Quad bike, Guide, Bedouin tea.
- **Excludes:** Scarf, Dust goggles.
- **Verification:** `SOURCE_REPORTED` | **Source:** `flyer-bakry-safari-2026`

#### Offer: `OFFER-KING-003` — Ras Shitan & Wadi El-Wishwashi Canyon Expedition
- **Supplier:** King Safari Dahab (`SUP-KING-SAFARI`)
- **Activity:** `ACT-WISHWASHI-EXPEDITION`
- **Price:** 750 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 07:30 AM → 06:00 PM (10.5h)
- **Includes:** A/C Minibus to Nuweiba, 4x4 Bedouin Hilux transfer into granite canyon, Bedouin guide, Swim in natural freshwater granite pool, Bedouin lunch at Ras Shitan beach camp, Snorkeling at Ras Shitan reef.
- **Excludes:** Snorkel equipment rental, Soft drinks.
- **Verification:** `WEB_CONFIRMED` | **Source:** `flyer-king-safari-2026-p1`

#### Offer: `OFFER-BAKRY-002` — Wadi Wishwashi & Ras Shitan Shared Day Trip
- **Supplier:** Bakry Safari Dahab (`RAW-SUP-BAKRY-SAFARI`)
- **Activity:** `ACT-WISHWASHI-EXPEDITION`
- **Price:** 650 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 08:00 AM → 05:30 PM (9.5h)
- **Includes:** Transfers, Bedouin guide, Beach hut lunch.
- **Excludes:** Gear rental, Drinks.
- **Verification:** `SOURCE_REPORTED` | **Source:** `flyer-bakry-safari-2026`

#### Offer: `OFFER-KING-004` — Three Pools Snorkeling & Southern Oasis Safari
- **Supplier:** King Safari Dahab (`SUP-KING-SAFARI`)
- **Activity:** `ACT-THREE-POOLS-SAFARI`
- **Price:** 400 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 09:30 AM → 03:30 PM (6.0h)
- **Includes:** 4x4 transport, Guided reef snorkeling across three connected coral lagoons, Bedouin lunch at beach palapa, Scenic walk through Wadi Gnai palm oasis.
- **Excludes:** EEAA environmental ticket (50 EGP), Snorkel rental.
- **Verification:** `WEB_CONFIRMED` | **Source:** `flyer-king-safari-2026-p1`

#### Offer: `OFFER-GUILD-001` — Mount Moses Summit Sunrise & St. Catherine Trek
- **Supplier:** Sinai Desert & Mountain Bedouin Guild (`SUP-SINAI-BEDOUIN-GUILD`)
- **Activity:** `ACT-MOUNT-MOSES-TREK`
- **Price:** 950 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 10:00 PM → 01:30 PM (+1 day) (15.5h)
- **Includes:** Roundtrip A/C tourist transport Dahab ↔ St. Catherine, Licensed Bedouin mountain guide (Muzeina tribe), St. Catherine Monastery visit & Burning Bush, Flashlight loan, Summit mountain tea.
- **Excludes:** Monastery icon museum entrance ($5), Optional camel ride up 700 steps, Breakfast.
- **Verification:** `SUPPLIER_CONFIRMED` | **Source:** `bedouin-guild-sinai-2026`

#### Offer: `OFFER-GUILD-002` — White Canyon & Ain Khodra Oasis 4x4 Safari
- **Supplier:** Sinai Desert & Mountain Bedouin Guild (`SUP-SINAI-BEDOUIN-GUILD`)
- **Activity:** `ACT-WHITE-CANYON-SAFARI`
- **Price:** 1200 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 07:00 AM → 05:00 PM (10.0h)
- **Includes:** 4x4 Toyota Land Cruiser desert crossing, Canyon scramble with Bedouin guide, Spring water at Ain Khodra palm groves, Traditional Zarba / Madfouna feast cooked in desert embers, Bedouin sage tea.
- **Excludes:** Driver tips, Personal equipment.
- **Verification:** `SUPPLIER_CONFIRMED` | **Source:** `bedouin-guild-sinai-2026`

---

### 3.2 Certified Scuba Diving & Marine Activities

#### Offer: `OFFER-RELAX-001` — PADI Discover Scuba Diving (DSD)
- **Supplier:** Red Sea Relax Dive Resort (`SUP-RED-SEA-RELAX`)
- **Activity:** `ACT-INTRO-DISCOVER-DIVE`
- **Price:** 1450 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 09:00 AM → 12:00 PM (3.0h)
- **Includes:** Full Mares/Aqualung scuba equipment, 1-on-1 certified PADI instructor ratio, Theory & pool/confined water briefing, Open water reef dive (max 10-12m), CDWS hyperbaric chamber search & rescue insurance.
- **Excludes:** Underwater photography package (optional 350 EGP).
- **Verification:** `REGULATORY_VERIFIED` (`CDWS-DHB-104`) | **Source:** `cdws-official-registry-2026`

#### Offer: `OFFER-RELAX-002` — Guided Shore Dive: The Bells & Blue Hole
- **Supplier:** Red Sea Relax Dive Resort (`SUP-RED-SEA-RELAX`)
- **Activity:** `ACT-BLUE-HOLE-BELLS-DIVE`
- **Price:** 1100 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 08:30 AM → 12:30 PM (4.0h)
- **Includes:** 4x4 transfer to Blue Hole, Certified PADI Divemaster guide, 12L Aluminum 200 bar tanks and weights, On-site emergency O2 kit.
- **Excludes:** Full equipment rental (400 EGP/day if needed), Nitrox (120 EGP/tank), National park entry fee ($10).
- **Verification:** `REGULATORY_VERIFIED` (`CDWS-DHB-104`) | **Source:** `cdws-official-registry-2026`

#### Offer: `OFFER-DESERT-001` — Eco Camel Diving Safari to Ras Abu Galum
- **Supplier:** Desert Divers Dahab (`SUP-DESERT-DIVERS`)
- **Activity:** `ACT-CAMEL-DIVING-SAFARI`
- **Price:** 2400 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 07:30 AM → 05:00 PM (9.5h)
- **Includes:** Transfer to Blue Hole, Camel trek carrying dive equipment along coastal cliff, 2 guided reef dives in Ras Abu Galum reserve, Fresh Bedouin fish or vegetarian lunch, Bedouin tea.
- **Excludes:** Equipment rental if needed, Park entry ticket.
- **Verification:** `REGULATORY_VERIFIED` (`CDWS-DHB-092`) | **Source:** `cdws-official-registry-2026`

#### Offer: `OFFER-DESERT-002` — Granite Rock Climbing in Wadi Gnai
- **Supplier:** Desert Divers Dahab (`SUP-DESERT-DIVERS`)
- **Activity:** `ACT-WADI-GNAI-CLIMBING`
- **Price:** 1600 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 07:30 AM → 12:00 PM (4.5h)
- **Includes:** 4x4 transfer to Middle Gnai crag, Certified climbing instructor, Full UIAA climbing harness, shoes, chalk, helmet, ropes, and top-rope setup on routes from 4a to 7b.
- **Excludes:** Personal snacks.
- **Verification:** `REGULATORY_VERIFIED` (`CDWS-DHB-092`) | **Source:** `cdws-official-registry-2026`

---

### 3.3 Watersports & Coastal Cruises

#### Offer: `OFFER-LAGUNA-001` — Private 2-Hour Kitesurfing Lesson
- **Supplier:** Dahab Laguna Wind & Kitesurf Station (`SUP-LAGUNA-WATERSPORTS`)
- **Activity:** `ACT-LAGUNA-KITESURF`
- **Price:** 2200 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 10:00 AM → 12:00 PM (2.0h)
- **Includes:** 1-on-1 IKO certified coach, Duotone kite, control bar, harness, radio helmet, impact vest, Beach pilotage & body dragging in waist-deep flat lagoon, Safety rescue boat cover.
- **Excludes:** Wetsuit rental in winter (100 EGP).
- **Verification:** `SUPPLIER_CONFIRMED` | **Source:** `laguna-watersports-center-2026`

#### Offer: `OFFER-SAFARI-TOURS-001` — Glass Bottom Coral Viewing Boat Cruise
- **Supplier:** Dahab Safari Day Tours (`SUP-DAHAB-SAFARI-TOURS`)
- **Activity:** `ACT-GLASS-BOTTOM-BOAT`
- **Price:** 350 EGP | **Basis:** `PER_PERSON`
- **Departure / Return:** 11:00 AM → 12:30 PM (1.5h)
- **Includes:** Glass bottom viewing salon with optical magnification glass over Napoleon Reef, Marine life narration by guide, Life jackets for all passengers.
- **Excludes:** Snorkeling from boat.
- **Verification:** `WEB_CONFIRMED` | **Source:** `flyer-dahab-safari-tours-2026`

---

## 4. Observed Market Price Statistics & Benchmarks

| Activity ID | Canonical Name (EN / AR) | Lowest (EGP) | Highest (EGP) | Median (EGP) | Observed Range | Benchmark Label |
| :--- | :--- | :---: | :---: | :---: | :--- | :--- |
| `ACT-QUAD-TWILAT` | Quad Sunset Safari<br>سفاري البيتش باجي | **300** | **350** | **325** | `300 - 350 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-WISHWASHI-EXPEDITION` | Wishwashi & Ras Shitan<br>وادي الوشواش ورأس شيطان | **650** | **750** | **700** | `650 - 750 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-BLUE-HOLE-SAFARI` | Blue Hole + Abu Galum<br>البلو هول وأبو جالوم | **550** | **550** | **550** | `550 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-THREE-POOLS-SAFARI` | Three Pools Snorkeling<br>سفاري الثري بولز | **400** | **400** | **400** | `400 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-MOUNT-MOSES-TREK` | Mount Moses Sunrise<br>جبل موسى وسانت كاترين | **950** | **950** | **950** | `950 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-WHITE-CANYON-SAFARI`| White Canyon 4x4<br>الوادي الأبيض وعين خضرة | **1200** | **1200** | **1200** | `1200 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-INTRO-DISCOVER-DIVE`| Intro Scuba Dive (DSD)<br>تجربة الغوص الأولى | **1450** | **1450** | **1450** | `1450 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-BLUE-HOLE-BELLS-DIVE`| Guided Blue Hole Dive<br>غوصة البلو هول الموجهة | **1100** | **1100** | **1100** | `1100 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-CAMEL-DIVING-SAFARI` | Camel Diving Safari<br>سفاري الغوص بالجمال | **2400** | **2400** | **2400** | `2400 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-WADI-GNAI-CLIMBING` | Wadi Gnai Rock Climbing<br>تسلق صخور وادي قني | **1600** | **1600** | **1600** | `1600 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-LAGUNA-KITESURF` | Laguna Kitesurfing Lesson<br>كايت سيرف لاجونا دهب | **2200** | **2200** | **2200** | `2200 EGP` | `OBSERVED_MARKET_DATA` |
| `ACT-GLASS-BOTTOM-BOAT` | Glass Bottom Boat Cruise<br>جولة القارب الزجاجي | **350** | **350** | **350** | `350 EGP` | `OBSERVED_MARKET_DATA` |
