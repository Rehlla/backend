/**
 * Hero scrim strength plumbing (dashboard `overlay_opacity` 0–100 → CSS
 * multiplier 0–1). Pure and framework-free so the CMS contract is unit
 * tested without rendering the hero.
 */

/** Missing/garbage renders full scrims (1): unset config must look exactly like the compiled default. */
export function scrimOpacityFromConfig(config?: Record<string, any> | null): number {
  const raw = Number(config?.overlay_opacity);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(100, Math.max(0, raw)) / 100;
}

/** Clamp a component-level scrim prop so a stray NaN never blanks the scrims. */
export function clampScrimOpacity(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}
