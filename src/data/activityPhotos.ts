/**
 * A photo that shows the activity itself, chosen from what the outing is.
 *
 * Catalogue ids do not line up with a fixed id→photo map (a scuba outing used
 * to show camels), so the picture follows the English title. First match wins,
 * so the specific places come before the generic kinds of outing.
 */
const ACTIVITY_PHOTOS: [RegExp, string][] = [
  [/eel garden/i, '/images/attractions/attr-eel-garden.webp'],
  [/three pools/i, '/images/attractions/three-pools.jpg'],
  [/white canyon|colou?red canyon|wishwashi/i, '/images/attractions/attr-colored-canyon.webp'],
  [/camel/i, '/images/hero/camels-beach.jpg'],
  [/abu galum/i, '/images/attractions/attr-ras-abu-galum.webp'],
  [/bells|blue hole.*dive|dive.*blue hole/i, '/images/attractions/blue-hole-divers.jpg'],
  [/blue hole/i, '/images/attractions/attr-blue-hole-aerial.webp'],
  [/canyon/i, '/images/attractions/attr-reef-wall.webp'],
  [/glass bottom|napoleon/i, '/images/attractions/coral-gardens.jpg'],
  [/discover scuba|try scuba|first.time/i, '/images/hero/splash-underwater.webp'],
  [/lighthouse/i, '/images/attractions/lighthouse-reef.jpg'],
  [/kite|wind|surf/i, '/images/hero/blue-lagoon-kitesurf.jpg'],
  [/climb|boulder/i, '/images/attractions/bouldering-wadi-gnai.jpg'],
  [/moses|catherine/i, '/images/attractions/attr-st-catherine.webp'],
  [/quad/i, '/images/attractions/sinai-desert-safari.jpg'],
  [/twilat|stargaz|sunset/i, '/images/hero/conc-hero-sunset.webp'],
  [/airport|transfer/i, '/images/attractions/attr-sinai-highway.webp'],
  [/bike|bicycle|cycling/i, '/images/rentals/rent-bike.webp'],
  [/scuba|dive|diving/i, '/images/attractions/experience-diving.jpg'],
  [/snorkel|reef/i, '/images/attractions/attr-house-reef.webp'],
  [/desert|safari|jeep|4x4/i, '/images/attractions/experience-desert.jpg'],
];

export const photoForActivity = (titleEn: string): string =>
  ACTIVITY_PHOTOS.find(([re]) => re.test(titleEn))?.[1] ?? '/images/attractions/blue-hole.jpg';

/** The `/experiences/:slug` slug for a catalogue activity id. */
export const experienceSlugForActivity = (activityId: string): string =>
  activityId.toLowerCase().replace(/_/g, '-');
