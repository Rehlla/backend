/**
 * Curated mappings from research-document names to database record ids.
 *
 * Name matching is deliberately strict (see `bestMatch`): it only acts on full
 * token containment, because the loose version silently mapped "Guided Try
 * Scuba Dive (First-Timer)" onto "The Canyon Submarine Chasm Guided Scuba Dive"
 * — a beginner's first dive enriched with the price and skill level of an
 * advanced 52-metre chasm.
 *
 * That strictness leaves a handful of genuine pairs unmatched, where both names
 * carry extra words: "Intro Kitesurf / Windsurf Lesson" against "Laguna
 * Flatwater Windsurf / Kitesurf Session & Gear". There are seven of them. A
 * hand-checked table of seven is auditable and correct; a fuzzy threshold tuned
 * until these seven pass is neither, and would re-admit the Canyon bug.
 *
 * Each entry below was verified against the record's actual title.
 */

/** Research activity id -> database activity id. */
export const ACTIVITY_ALIASES: Record<string, string> = {
  // "Guided Try Scuba Dive (First-Timer)" -> "Discover Scuba Diving (DSD) -
  // First Time Beginner Shore Dive". Same product, no shared distinctive words.
  'act-try-dive': 'ACT-INTRO-DISCOVER-DIVE',

  // "Sunset Eel Garden Snorkeling" -> "Eel Garden Sunset Guided Snorkel".
  'act-eel-snorkel': 'act_eel_garden_sunset_snorkel',

  // "Intro Kitesurf / Windsurf Lesson" -> "Laguna Flatwater Windsurf /
  // Kitesurf Session & Gear". Chosen over ACT-LAGUNA-KITESURF, which is a
  // narrower "Private 2-Hour Kitesurfing Coaching" product; the research row
  // covers both disciplines at beginner-to-advanced level.
  'act-laguna-kitesurf': 'act_laguna_windsurf_session',

  // "Mount Twilat Sunset Tea & Stargazing" -> "Mount Twilat Sunset Vista,
  // Bedouin Zarbed Feast & Stargazing". Not ACT-QUAD-TWILAT, which is a quad
  // bike safari to the same summit.
  'act-twilat-sunset': 'act_mount_twilat_bedouin_stargazing',

  // "Bells to Blue Hole Guided Drift" -> "Certified Guided Dive - The Bells &
  // Blue Hole Saddle Drop". Not act_blue_hole_safari_dive, which is the wider
  // "Blue Hole & Bells Guided Expedition".
  'act-blue-hole-bells': 'ACT-BLUE-HOLE-BELLS-DIVE'
};

/** Research dive-site name -> database place id. */
export const DIVE_SITE_ALIASES: Record<string, string> = {
  'Bells to Blue Hole': 'place_bells_dropoff'
};

/**
 * Research venue name -> database dining venue id.
 *
 * Only the one the strict matcher misses: the research calls it "Yum Yum
 * Falafel & Foul", the database "Yum Yum Authentic Egyptian Kitchen". They
 * share only "yum", which is far below the bar — and without this entry the
 * importer would have created a second Yum Yum.
 */
export const DINING_ALIASES: Record<string, string> = {
  'rest-yum-yum': 'dining_yum_yum_falafel'
};

/**
 * Research resource name -> database emergency resource id.
 *
 * Every one of the five already exists; the register and the database simply
 * name them differently ("Dahab Central Public Hospital" against "Dahab
 * Specialized Central Hospital ER"). Without these, the importer would have
 * duplicated the entire emergency register — the one table where a duplicate
 * is genuinely dangerous, because it is what a traveller in trouble is shown.
 */
export const EMERGENCY_ALIASES: Record<string, string> = {
  'Dahab Hyperbaric Medical Center': 'EMERG-HYPER-DAHAB-01',
  'Dahab Central Public Hospital': 'EMERG-HOSP-DAHAB-01',
  'Dr. Heikal Clinic & Urgent Care': 'EMERG-CLINIC-MASHRABA-01',
  'El-Ezaby & Masbat 24h Pharmacies': 'EMERG-PHARM-ASSALAH-01',
  'Dahab Tourism & Civil Police': 'EMERG-POLICE-DAHAB-01'
};

/**
 * Dining venues the research documents and the database does not hold.
 *
 * Listed explicitly rather than created whenever a name fails to match.
 * Creation-as-fallback is what produced the duplicate Yum Yum and the duplicate
 * emergency register in the first draft: a missed match and a genuine gap look
 * identical to the matcher, so only this list decides which is which.
 */
export const NEW_DINING = new Set(['rest-athanor', 'rest-jackies', 'rest-friends', 'rest-king-chicken']);

/**
 * Dive sites the research documents and the database does not hold.
 *
 * `areaId` is NOT NULL with a foreign key, so these cannot be created without
 * choosing an area. Both are southern-reef sites reached by boat or camel from
 * south Dahab, which puts them in `three_pools` ("Three Pools & Southern
 * Reefs") — but that is a judgement from the research text, not a stated fact
 * in it, so the importer prints it as an assumption to confirm.
 */
export const NEW_DIVE_SITES: Record<string, { id: string; areaId: string; nameAr: string; category: string }> = {
  'Gabr El Bint': {
    id: 'place_gabr_el_bint',
    areaId: 'three_pools',
    nameAr: 'جبر البنت',
    category: 'DIVE_SITE'
  },
  'Islands Reef': {
    id: 'place_islands_reef',
    areaId: 'three_pools',
    nameAr: 'الجزر',
    category: 'DIVE_SITE'
  }
};

/**
 * Activities the research documents and the database does not hold.
 *
 * Created without a SKU or supplier, so the catalogue treats them the way it
 * already treats uninventoried experiences: downgraded to REQUEST_NOW rather
 * than offered for instant booking. Inventing a supplier to make them bookable
 * would put something on sale that nobody has agreed to deliver.
 */
export const NEW_ACTIVITIES: Record<string, { id: string; areaId: string; placeId: string | null; category: string }> = {
  'act-freedive-depth': {
    id: 'act_freedive_line_training',
    areaId: 'lighthouse',
    placeId: 'place_lighthouse_reef',
    category: 'FREEDIVING'
  },
  'act-promenade-bike': {
    id: 'act_seafront_cruiser_bike',
    areaId: 'masbat',
    placeId: 'place_masbat_promenade',
    category: 'LEISURE'
  }
};
