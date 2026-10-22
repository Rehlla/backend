/**
 * Turns a rental spec key into a human display label.
 *
 * `rental.specs` is `Record<string, string | number | boolean>` and the keys
 * the API actually sends are camelCase (`rangeKm`, `maxSpeedKmh`), while some
 * legacy rows use snake_case (`max_speed_kmh`). The original renderer only
 * replaced underscores and CSS-capitalized the first letter, so camelCase keys
 * rendered verbatim: "RangeKm", "MaxSpeedKmh". Splitting before each capital
 * letter makes both spellings read the same way.
 */
export function humanizeSpecKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim()
    .replace(/^./, c => c.toUpperCase());
}
