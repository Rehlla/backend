/**
 * Dahab imagery — the registry for LOCAL, Dahab-first visual assets.
 *
 * This is the counterpart to `placeholderImagery.ts` (remote Unsplash
 * placeholders). Every constant here resolves to a file under
 * `public/images/` — no hotlinking, no CDN params, no per-view re-encoding.
 *
 * Sourcing priority (per asset): real Dahab photography → South Sinai /
 * Red Sea Egypt → Egypt → geographically relevant fallback. Anything that
 * could not be sourced from Dahab/Sinai is marked FALLBACK below and in
 * `public/images/attribution.json` (author + source URL per file).
 *
 * Rules:
 * - New UI image slots must import from here, not from `placeholderImagery`.
 * - Keep names semantic (`WHAT_it_shows_WHERE`), never photo-id-keyed.
 * - Card constants point at ≤1200px-wide WebP; hero constants at ≤1600px.
 */

/** Blue Hole coastal sanctuary aerial, North Dahab. */
export const IMG_EXP_BLUE_HOLE_SANCTUARY = '/images/experiences/blue-hole-sanctuary.webp';
/** Snorkeler over Red Sea coral reef (Eel Garden / Blue Hole saddle). */
export const IMG_EXP_EEL_GARDEN_SNORKEL = '/images/experiences/eel-garden-snorkel.webp';
/** Middle Eastern breakfast spread — falafel, shakshuka, pita. FALLBACK: not Dahab. */
export const IMG_EXP_RALPHS_BREAKFAST = '/images/experiences/ralphs-bakery-breakfast.webp';
/** Fresh fish grilling over charcoal. */
export const IMG_EXP_ALI_BABA_GRILL = '/images/experiences/ali-baba-seafood-grill.webp';
/** Farsha-style café entrance with hanging ornaments, Sharm El Sheikh. FALLBACK: not Dahab. */
export const IMG_EXP_CAFE_NIGHT = '/images/experiences/everyday-cafe-night.webp';

/** Group of scuba divers over coral reef. FALLBACK: not Egypt. */
export const IMG_BOOK_DIVING_CORAL_DIVERS = '/images/booking/diving-coral-divers.webp';
/** Seaside resort pool with palms, Taba (Red Sea Egypt). */
export const IMG_BOOK_HOTEL_BAY_POOL = '/images/booking/hotel-dahab-bay-pool.webp';
/** Resort architecture with sea and palms at sunset. FALLBACK: Egypt-unverified. */
export const IMG_BOOK_HOTEL_LODGE_SEAVIEW = '/images/booking/hotel-coral-lodge-seaview.webp';
/** Rustic tent with traditional decor against Sinai mountains. */
export const IMG_BOOK_HOTEL_BOHO_RETREAT = '/images/booking/hotel-boho-retreat.webp';
/** Bright hotel room, white linen. FALLBACK: generic. */
export const IMG_BOOK_HOTEL_ROOM = '/images/booking/hotel-room-morning.webp';
/** Hotel room with sea-view balcony at sunset. FALLBACK: Akrotiri, not Egypt. */
export const IMG_BOOK_HOTEL_ROOM_SEAVIEW = '/images/booking/hotel-room-seaview.webp';
/** Hotel room with luxurious bedding. FALLBACK: generic. */
export const IMG_BOOK_HOTEL_ROOM_DELUXE = '/images/booking/hotel-room-deluxe.webp';
/** Paved road through South Sinai desert. */
export const IMG_BOOK_TRANSFER_ROAD = '/images/booking/transfer-sinai-road.webp';
/** Off-road vehicles crossing Egyptian desert. */
export const IMG_BOOK_TRANSFER_SUV = '/images/booking/transfer-suv-desert.webp';
/** Hiking group on rocky trail, Saint Catherine (Sinai). */
export const IMG_BOOK_SAFARI_CANYON = '/images/booking/safari-canyon-trek.webp';
/** Tent under the Milky Way, Egypt's desert. */
export const IMG_BOOK_SAFARI_STARS = '/images/booking/safari-sinai-stars.webp';
/** Quad bike in Dahab's desert terrain. */
export const IMG_BOOK_SAFARI_QUAD = '/images/booking/safari-sunset-4x4.webp';

/** Brass teapots and textiles in an Arab tent. FALLBACK: not Dahab. */
export const IMG_FOOD_BEDOUIN_TEA = '/images/food/bedouin-tea-fire.webp';
/** Meat skewers grilling at a Cairo market stall. */
export const IMG_FOOD_GRILL_SKEWERS = '/images/food/grill-skewers.webp';
/** Fresh fish grilling over open flame. */
export const IMG_FOOD_SEAFOOD_GRILL = '/images/food/seafood-catch-grill.webp';

// ---------------------------------------------------------------------------
// Aliases onto the pre-existing local Dahab library (public/images/hero,
// attractions, restaurants, gallery). Reuse keeps one canonical file per
// scene instead of re-downloading the same bay twice.
// ---------------------------------------------------------------------------

/** Blue Hole dive site (card). */
export const IMG_LOCAL_BLUE_HOLE = '/images/attractions/blue-hole.jpg';
/** Blue Hole dive site (hero). */
export const IMG_LOCAL_BLUE_HOLE_HERO = '/images/hero/blue-hole.jpg';
/** Divers at the Blue Hole, Dahab. */
export const IMG_LOCAL_BLUE_HOLE_DIVERS = '/images/attractions/blue-hole-divers.jpg';
/** Coral reef dive, Dahab. */
export const IMG_LOCAL_REEF_DIVE = '/images/attractions/experience-diving.jpg';
/** Coral reef scene, Dahab. */
export const IMG_LOCAL_REEF = '/images/attractions/experience-reef.jpg';
/** Coral gardens, Dahab. */
export const IMG_LOCAL_CORAL_GARDENS = '/images/attractions/coral-gardens.jpg';
/** Three Pools reef, Dahab. */
export const IMG_LOCAL_THREE_POOLS = '/images/attractions/three-pools.jpg';
/** Lighthouse reef, Dahab. */
export const IMG_LOCAL_LIGHTHOUSE_REEF = '/images/attractions/lighthouse-reef.jpg';
/** Bouldering in Wadi Gnai. */
export const IMG_LOCAL_BOULDERING = '/images/attractions/experience-bouldering.jpg';
/** Sinai desert experience. */
export const IMG_LOCAL_DESERT = '/images/attractions/experience-desert.jpg';
/** Sinai desert safari. */
export const IMG_LOCAL_SINAI_SAFARI = '/images/attractions/sinai-desert-safari.jpg';
/** Kitesurfing the Dahab lagoon. */
export const IMG_LOCAL_KITESURF = '/images/hero/kitesurf.jpg';
/** Golden beach, Dahab. */
export const IMG_LOCAL_GOLDEN_BEACH = '/images/hero/golden-beach.jpg';
/** Camels on the Lighthouse coastal strip. */
export const IMG_LOCAL_CAMELS = '/images/hero/camels-beach.jpg';
/** Bohemian seaside lounge, Mashraba. */
export const IMG_LOCAL_BOHO_CAFE = '/images/hero/boho-cafe.jpg';
/** Sunset over the Dahab coast. */
export const IMG_LOCAL_SUNSET = '/images/hero/sunset.jpg';
/** Coral reef, Dahab (hero). */
export const IMG_LOCAL_CORAL_REEF = '/images/hero/coral-reef.jpg';
/** Dahab coastal panorama with Sinai mountains. */
export const IMG_LOCAL_PANORAMA = '/images/hero/dahab-panorama.jpg';
/** Boho beach café (restaurants). */
export const IMG_LOCAL_REST_BOHO = '/images/restaurants/boho-beach-cafe.jpg';
/** Breakfast by the sea (restaurants). */
export const IMG_LOCAL_REST_BREAKFAST = '/images/restaurants/breakfast-by-the-sea.jpg';
/** Lighthouse bay photo, Dahab gallery. */
export const IMG_LOCAL_GALLERY_LIGHTHOUSE = '/images/gallery/am-lighthouse.jpg';

// ─── NEW: Experiences (25) ─────────────────────────────
/** Snorkeler over vibrant coral reef in the Red Sea. */
export const IMG_EXP_SNORKELING_REEF = '/images/experiences/exp-snorkeling-reef.webp';
/** Kitesurfing on the Dahab lagoon at sunset. */
export const IMG_EXP_KITE_SURFING = '/images/experiences/exp-kite-surfing.webp';
/** Diving near the Blue Hole, Sinai. */
export const IMG_EXP_DIVING_BLUE_HOLE = '/images/experiences/exp-diving-blue-hole.webp';
/** Quad biking through desert terrain. */
export const IMG_EXP_DESERT_QUAD = '/images/experiences/exp-desert-quad.webp';
/** Rock climbing on red desert ridge. */
export const IMG_EXP_BOULDERING_RIDGE = '/images/experiences/exp-bouldering-ridge.webp';
/** Traditional boat on the Red Sea. */
export const IMG_EXP_BOAT_TRIP = '/images/experiences/exp-boat-trip.webp';
/** Stand-up paddleboarding on calm sea. */
export const IMG_EXP_SUP_PADDLE = '/images/experiences/exp-sup-paddle.webp';
/** Sunset motorboat cruise on the Red Sea. */
export const IMG_EXP_SUNSET_CRUISE = '/images/experiences/exp-sunset-cruise.webp';
/** Hiking through Sinai canyon mountains. */
export const IMG_EXP_CANYON_TREK = '/images/experiences/exp-canyon-trek.webp';
/** Stargazing in the desert night sky. */
export const IMG_EXP_STARGAZING = '/images/experiences/exp-stargazing.webp';
/** Camel ride along the beach. */
export const IMG_EXP_CAMEL_RIDE = '/images/experiences/exp-camel-ride.webp';
/** Traditional Bedouin tent in the Sinai mountains. */
export const IMG_EXP_BEDOUIN_VILLAGE = '/images/experiences/exp-bedouin-village.webp';
/** Freediving in clear blue waters. */
export const IMG_EXP_FREEDIVING = '/images/experiences/exp-freediving.webp';
/** Kayaking along the Red Sea coast. */
export const IMG_EXP_KAYAKING = '/images/experiences/exp-kayaking.webp';
/** Windsurfing on the open Red Sea. */
export const IMG_EXP_WINDSURFING = '/images/experiences/exp-windsurfing.webp';
/** Photography tour through desert landscapes. */
export const IMG_EXP_PHOTO_TOUR = '/images/experiences/exp-photo-tour.webp';
/** Wellness spa resort with palm trees. */
export const IMG_EXP_WELLNESS_SPA = '/images/experiences/exp-wellness-spa.webp';
/** Morning yoga on an oceanfront deck. */
export const IMG_EXP_YOGA_DECK = '/images/experiences/exp-yoga-deck.webp';
/** Swimming with sea turtles underwater. */
export const IMG_EXP_TURTLE_SWIM = '/images/experiences/exp-turtle-swim.webp';
/** Colorful reef fish on the Red Sea. */
export const IMG_EXP_RAINBOW_REEF = '/images/experiences/exp-rainbow-reef.webp';
/** Sunrise over Mount Sinai. */
export const IMG_EXP_MOUNT_SINAI = '/images/experiences/exp-mount-sinai.webp';
/** Night diving with underwater light. */
export const IMG_EXP_NIGHT_DIVING = '/images/experiences/exp-night-diving.webp';
/** Underwater cave diving exploration. */
export const IMG_EXP_UNDERWATER_CAVE = '/images/experiences/exp-underwater-cave.webp';
/** Glass-bottom boat over coral reef. */
export const IMG_EXP_GLASS_BOAT = '/images/experiences/exp-glass-boat.webp';
/** Coral restoration nursery underwater. */
export const IMG_EXP_CORAL_NURSERY = '/images/experiences/exp-coral-nursery.webp';

// ─── NEW: Food & Dining (20) ───────────────────────────
/** Egyptian koshari bowl. */
export const IMG_FOOD_KOSHARI = '/images/food/food-koshari.webp';
/** Traditional ful medames breakfast. */
export const IMG_FOOD_FUL_MEDAMES = '/images/food/food-ful-medames.webp';
/** Fresh seafood platter on ice. */
export const IMG_FOOD_SEAFOOD_PLATTER = '/images/food/food-seafood-platter.webp';
/** Street food vendor at night. */
export const IMG_FOOD_STREET_VENDOR = '/images/food/food-street-vendor.webp';
/** Traditional tea house gathering. */
export const IMG_FOOD_TEA_HOUSE = '/images/food/food-tea-house.webp';
/** Bohemian shisha lounge. */
export const IMG_FOOD_SHISHA_LOUNGE = '/images/food/food-shisha-lounge.webp';
/** Beachside cafe table with ocean view. */
export const IMG_FOOD_BEACH_CAFE = '/images/food/food-beach-cafe.webp';
/** Rooftop dining with sea view at night. */
export const IMG_FOOD_ROOFTOP_DINING = '/images/food/food-rooftop-dining.webp';
/** Middle Eastern breakfast spread. */
export const IMG_FOOD_BREAKFAST_SPREAD = '/images/food/food-breakfast-spread.webp';
/** Fresh fruit and juice bar display. */
export const IMG_FOOD_JUICE_BAR = '/images/food/food-juice-bar.webp';
/** Egyptian baklava and pastries. */
export const IMG_FOOD_EGYPTIAN_PASTRY = '/images/food/food-egyptian-pastry.webp';
/** Mixed grill kebab platter. */
export const IMG_FOOD_MIXED_GRILL = '/images/food/food-mixed-grill.webp';
/** Local market with fresh produce. */
export const IMG_FOOD_LOCAL_MARKET = '/images/food/food-local-market.webp';
/** Vintage Turkish coffee cup. */
export const IMG_FOOD_COFFEE_CUP = '/images/food/food-coffee-cup.webp';
/** Family dinner table with warm lighting. */
export const IMG_FOOD_FAMILY_TABLE = '/images/food/food-family-table.webp';
/** Elegant fine dining restaurant. */
export const IMG_FOOD_FINE_DINING = '/images/food/food-fine-dining.webp';
/** Sunset cocktail with sea view. */
export const IMG_FOOD_SUNSET_COCKTAIL = '/images/food/food-sunset-cocktail.webp';
/** Falafel and hummus plate. */
export const IMG_FOOD_FALAFEL_PLATE = '/images/food/food-falafel-plate.webp';
/** Baklava dessert with pistachios. */
export const IMG_FOOD_DESSERT_BAKLAVA = '/images/food/food-dessert-baklava.webp';
/** Grilled whole fish on charcoal. */
export const IMG_FOOD_SEAFOOD_GRILL_2 = '/images/food/food-seafood-grill-2.webp';

// ─── NEW: Hotels (20) ──────────────────────────────────
/** Resort infinity pool overlooking the sea. */
export const IMG_HOTEL_RESORT_POOL = '/images/hotels/hotel-resort-pool.webp';
/** Boutique hotel in Dahab. */
export const IMG_HOTEL_BOUTIQUE = '/images/hotels/hotel-boutique.webp';
/** Desert glamping camp in Sinai. */
export const IMG_HOTEL_DESERT_CAMP = '/images/hotels/hotel-desert-camp.webp';
/** Modern hostel dorm room. */
export const IMG_HOTEL_HOSTEL_DORM = '/images/hotels/hotel-hostel-dorm.webp';
/** Private villa with sea view pool. */
export const IMG_HOTEL_VILLA_PRIVATE = '/images/hotels/hotel-villa-private.webp';
/** Eco lodge with bamboo and greenery. */
export const IMG_HOTEL_ECO_LODGE = '/images/hotels/hotel-eco-lodge.webp';
/** Standard hotel room, clean and modern. */
export const IMG_HOTEL_ROOM_STANDARD = '/images/hotels/hotel-room-standard.webp';
/** Hotel room with ocean view window. */
export const IMG_HOTEL_ROOM_SEA_2 = '/images/hotels/hotel-room-sea-2.webp';
/** Pool and beach resort in Dahab. */
export const IMG_HOTEL_POOL_BEACH = '/images/hotels/hotel-pool-beach.webp';
/** Bohemian hotel lobby reception. */
export const IMG_HOTEL_LOBBY = '/images/hotels/hotel-lobby.webp';
/** Hotel terrace with morning coffee and sea view. */
export const IMG_HOTEL_TERRACE_MORNING = '/images/hotels/hotel-terrace-morning.webp';
/** Hotel garden path with palm trees. */
export const IMG_HOTEL_GARDEN_PATH = '/images/hotels/hotel-garden-path.webp';
/** Rooftop pool with city view. */
export const IMG_HOTEL_ROOFTOP_POOL = '/images/hotels/hotel-rooftop-pool.webp';
/** Beachfront hotel on the Egyptian coast. */
export const IMG_HOTEL_BEACHFRONT = '/images/hotels/hotel-beachfront.webp';
/** Family-friendly hotel room. */
export const IMG_HOTEL_FAMILY_ROOM = '/images/hotels/hotel-family-room.webp';
/** Bedouin tent camp under the stars. */
export const IMG_HOTEL_CAMP_TENT = '/images/hotels/hotel-camp-tent.webp';
/** Luxury hotel spa bathtub. */
export const IMG_HOTEL_SPA_BATH = '/images/hotels/hotel-spa-bath.webp';
/** Hotel sunset view from balcony. */
export const IMG_HOTEL_SUNSET_VIEW = '/images/hotels/hotel-sunset-view.webp';
/** Hammock by the beach resort. */
export const IMG_HOTEL_HAMMOCK = '/images/hotels/hotel-hammock.webp';
/** Waterfront hotel with Dahab promenade view. */
export const IMG_HOTEL_WATERFRONT = '/images/hotels/hotel-waterfront.webp';

// ─── NEW: Explore (15) ─────────────────────────────────
/** Hidden beach cove in Sinai. */
export const IMG_EXPLORE_BEACH_COVE = '/images/explore/explore-beach-cove.webp';
/** Historic fort in the Sinai desert. */
export const IMG_EXPLORE_HISTORIC_FORT = '/images/explore/explore-historic-fort.webp';
/** Oasis with palm trees in the desert. */
export const IMG_EXPLORE_OASIS_PALM = '/images/explore/explore-oasis-palm.webp';
/** Aerial panorama of Dahab coast. */
export const IMG_EXPLORE_PANORAMA_2 = '/images/explore/explore-panorama-2.webp';
/** School of fish over coral reef. */
export const IMG_EXPLORE_FISH_SCHOOL = '/images/explore/expreef-fish-school.webp';
/** Coastal walking trail along the sea. */
export const IMG_EXPLORE_COASTAL_TRAIL = '/images/explore/explore-coastal-trail.webp';
/** Canyon view in the Sinai mountains. */
export const IMG_EXPLORE_CANYON_VIEW = '/images/explore/explore-canyon-view.webp';
/** Lighthouse reef at dusk. */
export const IMG_EXPLORE_LIGHTHOUSE_2 = '/images/explore/explore-lighthouse-2.webp';
/** Marina with boats on the Red Sea. */
export const IMG_EXPLORE_MARINA_BOATS = '/images/explore/explore-marina-boats.webp';
/** Island view from the seashore. */
export const IMG_EXPLORE_ISLAND_DISTANCE = '/images/explore/explore-island-distance.webp';
/** Natural rock arch in the desert. */
export const IMG_EXPLORE_ROCK_ARCH = '/images/explore/explore-rock-arch.webp';
/** Golden sunrise on an Egyptian beach. */
export const IMG_EXPLORE_SUNRISE_GOLDEN = '/images/explore/explore-sunrise-golden.webp';
/** Cliff drop to the sea in Sinai. */
export const IMG_EXPLORE_CLIFF_DROP = '/images/explore/explore-cliff-drop.webp';
/** Turtle on coral reef underwater. */
export const IMG_EXPLORE_TURTLE_CORAL = '/images/explore/expreef-turtle-coral.webp';
/** Local souk market scene. */
export const IMG_EXPLORE_LOCAL_SOUK = '/images/explore/explore-local-souk.webp';

// ─── NEW: Attractions (15) ─────────────────────────────
/** Aerial view of the Blue Hole, Dahab. */
export const IMG_ATTR_BLUE_HOLE_AERIAL = '/images/attractions/attr-blue-hole-aerial.webp';
/** Ras Abu Galum protected area. */
export const IMG_ATTR_RAS_ABU_GALUM = '/images/attractions/attr-ras-abu-galum.webp';
/** Three Pools natural rock formation. */
export const IMG_ATTR_THREE_POOLS = '/images/attractions/attr-three-pools.webp';
/** Narrow canyon hiking in Sinai. */
export const IMG_ATTR_CANYON_NARROW = '/images/attractions/attr-canyon-narrow.webp';
/** Underwater coral garden with fish. */
export const IMG_ATTR_CORAL_GARDEN_2 = '/images/attractions/attr-coral-garden-2.webp';
/** Garden eels in sandy seabed. */
export const IMG_ATTR_EEL_GARDEN = '/images/attractions/attr-eel-garden.webp';
/** Snorkeling on the house reef. */
export const IMG_ATTR_HOUSE_REEF = '/images/attractions/attr-house-reef.webp';
/** Desert mountain landscape at sunset. */
export const IMG_ATTR_DESERT_MOUNTAIN = '/images/attractions/attr-desert-mountain.webp';
/** Sinai highway through barren desert. */
export const IMG_ATTR_SINAI_HIGHWAY = '/images/attractions/attr-sinai-highway.webp';
/** Saint Catherine's Monastery walls. */
export const IMG_ATTR_ST_CATHERINE = '/images/attractions/attr-st-catherine.webp';
/** Mangrove tunnel along the coast. */
export const IMG_ATTR_MANGROVE = '/images/attractions/attr-mangrove.webp';
/** Colored canyon narrow passage. */
export const IMG_ATTR_COLORED_CANYON = '/images/attractions/attr-colored-canyon.webp';
/** Underwater shipwreck dive site. */
export const IMG_ATTR_UNDERWATER_SHIPWRECK = '/images/attractions/attr-underwater-shipwreck.webp';
/** Reef wall drop-off for diving. */
export const IMG_ATTR_REEF_WALL = '/images/attractions/attr-reef-wall.webp';
/** Pebble beach on the Sinai coast. */
export const IMG_ATTR_BEACH_PEBBLES = '/images/attractions/attr-beach-pebbles.webp';

// ─── NEW: Booking (15) ─────────────────────────────────
/** Diving gear and equipment preparation. */
export const IMG_BOOK_DIVING_GEAR = '/images/booking/book-diving-gear.webp';
/** Hotel exterior on the Dahab coast. */
export const IMG_BOOK_HOTEL_EXTERIOR = '/images/booking/book-hotel-exterior.webp';
/** Transfer van at airport terminal. */
export const IMG_BOOK_TRANSFER_VAN = '/images/booking/book-transfer-van.webp';
/** Safari jeep in the desert. */
export const IMG_BOOK_SAFARI_JEEP = '/images/booking/book-safari-jeep.webp';
/** Aerial view of resort on the Red Sea. */
export const IMG_BOOK_RESORT_AERIAL = '/images/booking/book-resort-aerial.webp';
/** Diving class instruction in pool. */
export const IMG_BOOK_DIVING_CLASS = '/images/booking/book-diving-class.webp';
/** Quad bike adventure at sunset. */
export const IMG_BOOK_SUNSET_QUAD = '/images/booking/book-sunset-quad.webp';
/** Hotel pool with evening lights. */
export const IMG_BOOK_HOTEL_POOL_2 = '/images/booking/book-hotel-pool-2.webp';
/** Sinai mountains panoramic view. */
export const IMG_BOOK_SINAI_MOUNTAINS = '/images/booking/book-sinai-mountains.webp';
/** Boat deck with sea view. */
export const IMG_BOOK_BOAT_DECK = '/images/booking/book-boat-deck.webp';
/** Beach umbrella overlooking the ocean. */
export const IMG_BOOK_BEACH_UMBRELLA = '/images/booking/book-beach-umbrella.webp';
/** Desert camp bonfire at night. */
export const IMG_BOOK_DESERT_CAMP_2 = '/images/booking/book-desert-camp-2.webp';
/** Group canyon hike in Sinai. */
export const IMG_BOOK_CANYON_HIKE = '/images/booking/book-canyon-hike.webp';
/** Snorkel mask and gear set. */
export const IMG_BOOK_SNORKEL_SET = '/images/booking/book-snorkel-set.webp';
/** Hotel check-in reception desk. */
export const IMG_BOOK_CHECKIN_DESK = '/images/booking/book-checkin-desk.webp';

// ─── NEW: Restaurants (15) ─────────────────────────────
/** Fresh seafood display on ice. */
export const IMG_REST_SEAFOOD_DISPLAY = '/images/restaurants/rest-seafood-display.webp';
/** Rooftop restaurant with night city view. */
export const IMG_REST_ROOFTOP_NIGHT = '/images/restaurants/rest-rooftop-night.webp';
/** Egyptian restaurant decorated interior. */
export const IMG_REST_EGYPTIAN_INTERIOR = '/images/restaurants/rest-egyptian-interior.webp';
/** Middle Eastern restaurant decor. */
export const IMG_REST_MIDDLE_EASTERN = '/images/restaurants/rest-middle-eastern.webp';
/** Pastry display case in a bakery. */
export const IMG_REST_PASTRY_DISPLAY = '/images/restaurants/rest-pastry-display.webp';
/** Beach shack restaurant by the sea. */
export const IMG_REST_BEACH_SHACK = '/images/restaurants/rest-beach-shack.webp';
/** Egyptian street food cart. */
export const IMG_REST_STREET_FOOD_2 = '/images/restaurants/rest-street-food-2.webp';
/** Morning cafe with sunlight on tables. */
export const IMG_REST_MORNING_CAFE = '/images/restaurants/rest-morning-cafe.webp';
/** Traditional coffee service with brass pot. */
export const IMG_REST_TRADITIONAL_COFFEE = '/images/restaurants/rest-traditional-coffee.webp';
/** Seafood grilling over charcoal flame. */
export const IMG_REST_SEAFOOD_GRILL_3 = '/images/restaurants/rest-seafood-grill-3.webp';
/** Romantic dinner table with candles. */
export const IMG_REST_ROMANTIC_TABLE = '/images/restaurants/rest-romantic-table.webp';
/** Family dinner gathering with warm lighting. */
export const IMG_REST_FAMILY_DINNER = '/images/restaurants/rest-family-dinner.webp';
/** Sunset terrace dining with sea view. */
export const IMG_REST_SUNSET_TERRACE = '/images/restaurants/rest-sunset-terrace.webp';
/** Traditional tea glass on brass tray. */
export const IMG_REST_TEA_GLASS = '/images/restaurants/rest-tea-glass.webp';
/** Brunch spread with variety on rustic table. */
export const IMG_REST_BRUNCH_SPREAD = '/images/restaurants/rest-brunch-spread.webp';

// ─── NEW: Itinerary (10) ───────────────────────────────
/** Quiet morning on Dahab beach. */
export const IMG_ITIN_DAY1_MORNING = '/images/itinerary/itin-day1-morning.webp';
/** Group diving day at the Blue Hole. */
export const IMG_ITIN_DAY2_DIVE = '/images/itinerary/itin-day2-dive.webp';
/** Desert safari day in Sinai. */
export const IMG_ITIN_DAY3_DESERT = '/images/itinerary/itin-day3-desert.webp';
/** Relaxing beach day with umbrellas. */
export const IMG_ITIN_DAY4_BEACH = '/images/itinerary/itin-day4-beach.webp';
/** Cultural visit to Saint Catherine's Monastery. */
export const IMG_ITIN_DAY5_CULTURAL = '/images/itinerary/itin-day5-cultural.webp';
/** Hiking trail in the Sinai mountains. */
export const IMG_ITIN_DAY6_HIKE = '/images/itinerary/itin-day6-hike.webp';
/** Farewell sunset over Dahab. */
export const IMG_ITIN_DAY7_SUNSET = '/images/itinerary/itin-day7-sunset.webp';
/** Morning yoga on the coast at dawn. */
export const IMG_ITIN_MORNING_YOGA = '/images/itinerary/itin-morning-yoga.webp';
/** Afternoon snorkeling on the reef. */
export const IMG_ITIN_AFTERNOON_SNORKEL = '/images/itinerary/itin-afternoon-snorkel.webp';
/** Evening tea in a Bedouin tent. */
export const IMG_ITIN_EVENING_TEA = '/images/itinerary/itin-evening-tea.webp';

// ─── NEW: Transfers (8) ────────────────────────────────
/** Airport terminal transfer in Egypt. */
export const IMG_TRANSFER_AIRPORT = '/images/transfers/transfer-airport.webp';
/** Highway through the desert of Sinai. */
export const IMG_TRANSFER_HIGHWAY = '/images/transfers/transfer-highway.webp';
/** Scenic coastal drive along the Red Sea. */
export const IMG_TRANSFER_SCENIC = '/images/transfers/transfer-scenic.webp';
/** Comfortable van interior with leather seats. */
export const IMG_TRANSFER_VAN_INTERIOR = '/images/transfers/transfer-van-interior.webp';
/** SUV off-roading through desert dust. */
export const IMG_TRANSFER_SUV_2 = '/images/transfers/transfer-suv-2.webp';
/** Intercity road through Egyptian landscape. */
export const IMG_TRANSFER_INTERCITY = '/images/transfers/transfer-intercity.webp';
/** Night drive with city lights bokeh. */
export const IMG_TRANSFER_NIGHT_DRIVE = '/images/transfers/transfer-night-drive.webp';
/** Boat transfer across the sea. */
export const IMG_TRANSFER_BOAT_TRANSFER = '/images/transfers/transfer-boat-transfer.webp';

// ─── NEW: Rentals (8) ──────────────────────────────────
/** Bicycle riding near the beach promenade. */
export const IMG_RENT_BIKE = '/images/rentals/rent-bike.webp';
/** Snorkel mask, fins, and gear. */
export const IMG_RENT_SNORKEL_GEAR = '/images/rentals/rent-snorkel-gear.webp';
/** Electric bike on the coast road. */
export const IMG_RENT_E_BIKE = '/images/rentals/rent-e-bike.webp';
/** Colorful kayaks on the beach. */
export const IMG_RENT_KAYAK = '/images/rentals/rent-kayak.webp';
/** Stand-up paddleboard on calm water. */
export const IMG_RENT_SUP_BOARD = '/images/rentals/rent-sup-board.webp';
/** Jeep driving through the desert. */
export const IMG_RENT_JEEP = '/images/rentals/rent-jeep.webp';
/** Vintage scooter in a coastal town. */
export const IMG_RENT_SCOOTER = '/images/rentals/rent-scooter.webp';
/** Water sports equipment on the beach. */
export const IMG_RENT_EQUIPMENT = '/images/rentals/rent-equipment.webp';

// ─── NEW: Live Cameras (4) ─────────────────────────────
/** Blue Hole dive spot from Dahab. */
export const IMG_LIVE_BLUE_HOLE_2 = '/images/live/live-blue-hole-2.webp';
/** Lighthouse reef underwater camera. */
export const IMG_LIVE_LIGHTHOUSE_2 = '/images/live/live-lighthouse-2.webp';
/** Canyon dive site underwater. */
export const IMG_LIVE_CANYON_2 = '/images/live/live-canyon-2.webp';
/** Lagoon kitesurfing spot in Dahab. */
export const IMG_LIVE_LAGOON_2 = '/images/live/live-lagoon-2.webp';

// ─── NEW: Concierge Hero (5) ───────────────────────────
/** Golden sand beach in Dahab. */
export const IMG_CONC_HERO_BEACH = '/images/hero/conc-hero-beach.webp';
/** Sunset over the Dahab sea. */
export const IMG_CONC_HERO_SUNSET = '/images/hero/conc-hero-sunset.webp';
/** Aerial view of coral reef on the Red Sea. */
export const IMG_CONC_HERO_REEF = '/images/hero/conc-hero-reef.webp';
/** Panoramic Sinai desert landscape. */
export const IMG_CONC_HERO_DESERT = '/images/hero/conc-hero-desert.webp';
/** Sinai mountain range at sunset. */
export const IMG_CONC_HERO_MOUNTAIN = '/images/hero/conc-hero-mountain.webp';

// ─── NEW: Splash (4) ───────────────────────────────────
/** Aerial view of Dahab coast with blue water. */
export const IMG_SPLASH_AERIAL = '/images/hero/splash-aerial.webp';
/** Underwater diver in the blue sea. */
export const IMG_SPLASH_UNDERWATER = '/images/hero/splash-underwater.webp';
/** Palm trees on Dahab beach resort. */
export const IMG_SPLASH_BEACH_PALM = '/images/hero/splash-beach-palm.webp';
/** Golden sand dunes in the Egyptian desert. */
export const IMG_SPLASH_DESERT_GOLDEN = '/images/hero/splash-desert-golden.webp';

// ─── NEW: Stories (5) ──────────────────────────────────
/** Kid snorkeling in shallow water. */
export const IMG_STORY_SNORKEL_KID = '/images/gallery/story-snorkel-kid.webp';
/** Friends celebrating sunset on the beach. */
export const IMG_STORY_BEACH_SUNSET_2 = '/images/gallery/story-beach-sunset-2.webp';
/** Diver selfie underwater on the reef. */
export const IMG_STORY_DIVER_SELFIE = '/images/gallery/story-diver-selfie.webp';
/** Campfire in the desert with friends. */
export const IMG_STORY_CAMPFIRE = '/images/gallery/story-campfire.webp';
/** Browsing local market crafts. */
export const IMG_STORY_MARKET_BROWSE = '/images/gallery/story-market-browse.webp';

// ─── NEW: Planner (7) ──────────────────────────────────
/** Adventure activity in the Sinai mountains. */
export const IMG_PLAN_ADVENTURE = '/images/planner/plan-adventure.webp';
/** Relaxing hammock on a quiet beach. */
export const IMG_PLAN_RELAX = '/images/planner/plan-relax.webp';
/** Foodie experience with local cuisine. */
export const IMG_PLAN_FOODIE = '/images/planner/plan-foodie.webp';
/** Cultural experience with local Egyptian traditions. */
export const IMG_PLAN_CULTURAL = '/images/planner/plan-cultural.webp';
/** Family vacation on the beach. */
export const IMG_PLAN_FAMILY = '/images/planner/plan-family.webp';
/** Solo traveler with backpack. */
export const IMG_PLAN_SOLO = '/images/planner/plan-solo.webp';
/** Couple watching sunset on rocky shore. */
export const IMG_PLAN_COUPLE = '/images/planner/plan-couple.webp';

// ─── NEW: My Trip (4) ──────────────────────────────────
/** Beach panorama for trip hero. */
export const IMG_MYTRIP_HERO_BEACH = '/images/mytrip/mytrip-hero-beach.webp';
/** Desert adventure trip hero. */
export const IMG_MYTRIP_HERO_DESERT = '/images/mytrip/mytrip-hero-desert.webp';
/** Diving underwater trip hero. */
export const IMG_MYTRIP_HERO_DIVE = '/images/mytrip/mytrip-hero-dive.webp';
/** Calm sunset trip hero. */
export const IMG_MYTRIP_HERO_SUNSET = '/images/mytrip/mytrip-hero-sunset.webp';

// ─── NEW: Journey Stages (8) ───────────────────────────
/** Arrival at the airport gate. */
export const IMG_JOURN_ARRIVAL = '/images/journey/journ-arrival.webp';
/** Packing suitcase for travel. */
export const IMG_JOURN_PACKING = '/images/journey/journ-packing.webp';
/** First steps on Dahab beach. */
export const IMG_JOURN_FIRST_STEPS = '/images/journey/journ-first-steps.webp';
/** Morning routine with balcony sea view. */
export const IMG_JOURN_MORNING_ROUTINE = '/images/journey/journ-morning-routine.webp';
/** Resting in a hammock in the afternoon. */
export const IMG_JOURN_REST_AFTERNOON = '/images/journey/journ-rest-afternoon.webp';
/** Adventure day activity on a zip line. */
export const IMG_JOURN_ADVENTURE_DAY = '/images/journey/journ-adventure-day.webp';
/** Departure at the airport. */
export const IMG_JOURN_DEPARTURE = '/images/journey/journ-departure.webp';
/** Travel memory photograph keepsake. */
export const IMG_JOURN_MEMORY_PHOTO = '/images/journey/journ-memory-photo.webp';

// ─── NEW: Spontaneous (8) ──────────────────────────────
/** Morning swim in the quiet sea. */
export const IMG_SPONT_MORNING_SWIM = '/images/spontaneous/spont-morning-swim.webp';
/** Evening walk on the Dahab promenade. */
export const IMG_SPONT_EVENING_WALK = '/images/spontaneous/spont-evening-walk.webp';
/** Night market with lights in Egypt. */
export const IMG_SPONT_NIGHT_MARKET = '/images/spontaneous/spont-night-market.webp';
/** Reading a book on the beach in shade. */
export const IMG_SPONT_AFTERNOON_READ = '/images/spontaneous/spont-afternoon-read.webp';
/** Impromptu dive into the blue sea. */
export const IMG_SPONT_RANDOM_DIVE = '/images/spontaneous/spont-random-dive.webp';
/** Sunset viewing point over the coast. */
export const IMG_SPONT_SUNSET_POINT = '/images/spontaneous/spont-sunset-point.webp';
/** Discovering a hidden bohemian cafe. */
export const IMG_SPONT_CAFE_DISCOVER = '/images/spontaneous/spont-cafe-discover.webp';
/** Beach chilling in the afternoon. */
export const IMG_SPONT_BEACH_CHILL = '/images/spontaneous/spont-beach-chill.webp';

// ─── NEW: Profile (3) ──────────────────────────────────
/** Travel achievement badge. */
export const IMG_PROFILE_ACHIEVEMENT = '/images/profile/profile-achievement.webp';
/** Traveler portrait at the beach. */
export const IMG_PROFILE_TRAVELER = '/images/profile/profile-traveler.webp';
/** Photo collection of travel memories. */
export const IMG_PROFILE_COLLECTION = '/images/profile/profile-collection.webp';

// ─── NEW: Programs (2) ─────────────────────────────────
/** First-time visitor to Dahab. */
export const IMG_PROG_FIRST_TIMER = '/images/programs/prog-first-timer.webp';
/** Adventure week activity-packed program. */
export const IMG_PROG_ADVENTURE_WEEK = '/images/programs/prog-adventure-week.webp';
