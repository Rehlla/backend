/**
 * Placeholder imagery — the single registry for remote placeholder photos.
 *
 * Before this module there were ~150 inline `images.unsplash.com` literals
 * across `src/` (plus a further set on the server). The problems were not
 * aesthetic:
 *
 * 1. **Transform parameters drifted.** The same photo carried `?q=80&w=1200`,
 *    `?q=85&w=800`, and no parameters at all in different files — so the CDN
 *    re-encoded and re-shipped the same image at several sizes, and the
 *    parameterless ones arrived full-resolution over mobile data in Sinai.
 * 2. **Swapping to CMS media (the real fix, §1) meant editing 150 files.**
 *    One registry makes that a one-file change: the day a photo is replaced
 *    by an admin-curated `cms_media` asset, the constant's value changes and
 *    every consumer moves together, keeping `alt`/`credit` next to it.
 *
 * Rules:
 * - Every constant carries a normalized transform suffix: `?q=80&w=<width>&auto=format&fit=crop`.
 * - The registry is for *placeholder* imagery only. Traveler-uploaded or
 *   admin-curated content lives in the CMS media table and must never route
 *   through here.
 * - Do not add new inline Unsplash literals in `src/` — `tests/domain/imagery.test.ts`
 *   fails the build on them. Import or extend a constant instead.
 */

const PARAMS = {
  /** Hero headers and other full-bleed surfaces. */
  hero: '?q=80&w=1600&auto=format&fit=crop',
  /** Cards, tiles, and itinerary rows. */
  card: '?q=80&w=800&auto=format&fit=crop'
} as const;

// ---------------------------------------------------------------------------
// The registry — one constant per distinct photo ID.
// ---------------------------------------------------------------------------

/** A freediver descends the Blue Hole's drop-off — Dahab's signature scene. */
export const IMG_BLUE_HOLE = `https://images.unsplash.com/photo-1544551763-46a013bb70d5${PARAMS.card}`;
export const IMG_BLUE_HOLE_HERO = `https://images.unsplash.com/photo-1544551763-46a013bb70d5${PARAMS.hero}`;

/** Golden-hour sail above the reef shelf. */
export const IMG_SUNSET_SAIL = `https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9${PARAMS.card}`;

/** The Lighthouse bay at midday — the promenade's postcard. */
export const IMG_LIGHTHOUSE_BAY = `https://images.unsplash.com/photo-1507525428034-b723cf961d3e${PARAMS.card}`;

/** Beach café breakfast on the promenade sand. */
export const IMG_PROMENADE_CAFE = `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4${PARAMS.card}`;

/** Desert meeting water — the Sinai shoreline from above. */
export const IMG_DESERT_MEETS_SEA = `https://images.unsplash.com/photo-1534447677768-be436bb09401${PARAMS.card}`;

/** Wadi Gnai bouldering — the desert canyon side of the coast. */
export const IMG_WADI_GNAI = `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800${PARAMS.card}`;

/** Kitesurfing the lagoon's flat water. */
export const IMG_LAGOON_KITE = `https://images.unsplash.com/photo-1510312305653-8ed496efae75${PARAMS.card}`;

/** Boutique room interior — warm plaster and linen. */
export const IMG_BOUTIQUE_ROOM = `https://images.unsplash.com/photo-1520250497591-112f2f40a3f4${PARAMS.card}`;

/** Resort pool terrace at dusk. */
export const IMG_RESORT_TERRACE = `https://images.unsplash.com/photo-1582719508461-905c673771fd${PARAMS.card}`;

/** Hotel room, made bed and morning light. */
export const IMG_HOTEL_ROOM = `https://images.unsplash.com/photo-1590490360182-c33d57733427${PARAMS.card}`;

/** Infinity pool over the sea. */
export const IMG_SEA_POOL = `https://images.unsplash.com/photo-1571896349842-33c89424de2d${PARAMS.card}`;

/** Bedouin tea and bread over open fire in the mountains. */
export const IMG_BEDOUIN_TEA = `https://images.unsplash.com/photo-1555396273-367ea4eb4db5${PARAMS.card}`;

/** Night sky over the Sinai highlands — stargazing trips. */
export const IMG_SINAI_STARS = `https://images.unsplash.com/photo-1518709268805-4e9042af9f23${PARAMS.card}`;

/** A row of colored-paint boat hulls on the sand. */
export const IMG_BOATS = `https://images.unsplash.com/photo-1549399542-7e3f8b79c341${PARAMS.card}`;

/** Desert expedition truck track toward the horizon. */
export const IMG_DESERT_ROAD = `https://images.unsplash.com/photo-1539635278303-d4002c07eae3${PARAMS.card}`;

/** Snorkeler over coral bommies. */
export const IMG_SNORKEL_REEF = `https://images.unsplash.com/photo-1682687220063-4742bd7fd538${PARAMS.card}`;

/** Red Sea reef wall with schools of fish. */
export const IMG_REEF_WALL = `https://images.unsplash.com/photo-1541544741938-0af808871cc0${PARAMS.card}`;

/** Grilled catch of the day — the local food voice. */
export const IMG_GRILLED_CATCH = `https://images.unsplash.com/photo-1555939594-58d7cb561ad1${PARAMS.card}`;

/** Rooftop breakfast with sea view. */
export const IMG_ROOFTOP_BREAKFAST = `https://images.unsplash.com/photo-1566073771259-6a8506099945${PARAMS.card}`;

/** Spa and wellness terrace. */
export const IMG_WELLNESS = `https://images.unsplash.com/photo-1540555700478-4be289fbecef${PARAMS.card}`;

/** Beach umbrella and lounger — the chill voice. */
export const IMG_BEACH_UMBRELLA = `https://images.unsplash.com/photo-1570125909232-eb263c188f7e${PARAMS.card}`;

/** Group of travelers on a viewpoint — the together voice. */
export const IMG_TRAVELERS_VIEWPOINT = `https://images.unsplash.com/photo-1488646953014-85cb44e25828${PARAMS.card}`;

/** Stand-up paddleboarder in glassy water. */
export const IMG_SUP_GLASS = `https://images.unsplash.com/photo-1502680390469-be75c86b636f${PARAMS.card}`;

/** Hotel exterior with palms. */
export const IMG_HOTEL_PALMS = `https://images.unsplash.com/photo-1618773928121-c32242e63f39${PARAMS.card}`;

/** Eilat–Dahab coastal road trip shot. */
export const IMG_COASTAL_ROAD = `https://images.unsplash.com/photo-1502920917128-1aa500764cbd${PARAMS.card}`;

/** Camel caravan on the beach at dusk. */
export const IMG_CAMELS_BEACH = `https://images.unsplash.com/photo-1512100356356-de1b84283e18${PARAMS.card}`;

/** Yoga deck overlooking the water. */
export const IMG_YOGA_DECK = `https://images.unsplash.com/photo-1544367567-0f2fcb009e0b${PARAMS.card}`;

/** Bike on a coastal promenade — rentals. */
export const IMG_BIKE_PROMENADE = `https://images.unsplash.com/photo-1485965120184-e220f721d03e${PARAMS.card}`;

/** Mount Sinai summit trail at dawn. */
export const IMG_MOUNT_SINAI = `https://images.unsplash.com/photo-1559067096-49ebca3406aa${PARAMS.card}`;

// ---------------------------------------------------------------------------
// Generated constants (photo-id-keyed). The curated names above cover the
// most-reused photos; the codemod-generated constants below cover the rest
// until a human renames them.
// ---------------------------------------------------------------------------

// --- Generated by codemod-unsplash-registry (photo-id-keyed constants) ---

/** Placeholder — photo-154455176346a013bb70d5, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P154455176346a013bb70d5_HERO = `https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-1469854523086cc02fe5d8800, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1469854523086cc02fe5d8800_800 = `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1509316975850ff9c5deb0cd9, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1509316975850ff9c5deb0cd9_CARD = `https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15187092688054e9042af9f23, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15187092688054e9042af9f23_800 = `https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1520250497591112f2f40a3f4, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1520250497591112f2f40a3f4_CARD = `https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1520250497591112f2f40a3f4, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1520250497591112f2f40a3f4_HERO = `https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-15334733593310135ef1b58bf, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15334733593310135ef1b58bf_800 = `https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15405557004784be289fbecef, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15405557004784be289fbecef_800 = `https://images.unsplash.com/photo-1540555700478-4be289fbecef?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-154455176346a013bb70d5, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P154455176346a013bb70d5_CARD = `https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15493995427e3f8b79c341, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15493995427e3f8b79c341_800 = `https://images.unsplash.com/photo-1549399542-7e3f8b79c341?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15660737712596a8506099945, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15660737712596a8506099945_HERO = `https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-1570125909232eb263c188f7e, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1570125909232eb263c188f7e_800 = `https://images.unsplash.com/photo-1570125909232-eb263c188f7e?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-157189634984233c89424de2d, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P157189634984233c89424de2d_800 = `https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1578683010236d716f9a3f461, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1578683010236d716f9a3f461_800 = `https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1582719508461905c673771fd, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1582719508461905c673771fd_800 = `https://images.unsplash.com/photo-1582719508461-905c673771fd?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15832122924541fe6229603b7, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15832122924541fe6229603b7_800 = `https://images.unsplash.com/photo-1544551763-46a013bb70d5?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-158413296733410e028bd69f7, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P158413296733410e028bd69f7_HERO = `https://images.unsplash.com/photo-1584132967334-10e028bd69f7?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-1590490360182c33d57733427, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1590490360182c33d57733427_800 = `https://images.unsplash.com/photo-1590490360182-c33d57733427?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1618773928121c32242e63f39, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1618773928121c32242e63f39_800 = `https://images.unsplash.com/photo-1618773928121-c32242e63f39?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-16826872200634742bd7fd538, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P16826872200634742bd7fd538_CARD = `https://images.unsplash.com/photo-1682687220063-4742bd7fd538?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15172481354674c7edcad34c4, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15172481354674c7edcad34c4_CARD = `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15415447419380af808871cc0, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15415447419380af808871cc0_800 = `https://images.unsplash.com/photo-1541544741938-0af808871cc0?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-155593959458d7cb561ad1, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P155593959458d7cb561ad1_800 = `https://images.unsplash.com/photo-1555939594-58d7cb561ad1?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15103123056538ed496efae75, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15103123056538ed496efae75_CARD = `https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1507525428034b723cf961d3e, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1507525428034b723cf961d3e_HERO = `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-15103123056538ed496efae75, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15103123056538ed496efae75_HERO = `https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-16826872200634742bd7fd538, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P16826872200634742bd7fd538_HERO = `https://images.unsplash.com/photo-1682687220063-4742bd7fd538?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-1507525428034b723cf961d3e, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1507525428034b723cf961d3e_CARD = `https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1526778548025fa2f459cd5c1, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1526778548025fa2f459cd5c1_800 = `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1555396273367ea4eb4db5, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1555396273367ea4eb4db5_800 = `https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-1539635278303d4002c07eae3, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1539635278303d4002c07eae3_HERO = `https://images.unsplash.com/photo-1539635278303-d4002c07eae3?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-1509316975850ff9c5deb0cd9, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1509316975850ff9c5deb0cd9_HERO = `https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-15172481354674c7edcad34c4, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15172481354674c7edcad34c4_HERO = `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-1534447677768be436bb09401, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1534447677768be436bb09401_HERO = `https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-1511671782779c97d3d27a1d4, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P1511671782779c97d3d27a1d4_HERO = `https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1600&auto=format&fit=crop`;

/** Placeholder — photo-15541188111e0d58224f24, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15541188111e0d58224f24_CARD = `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=800&auto=format&fit=crop`;

/** Placeholder — photo-15541188111e0d58224f24, generated by scripts/codemod-unsplash-registry.ts. */
export const IMG_P15541188111e0d58224f24_HERO = `https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1600&auto=format&fit=crop`;
