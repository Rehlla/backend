import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveLivingChartPalette, createLivingChartScene } from '../../src/lib/livingChartShader';

/**
 * The Living Chart hero's instrument layer contract (LIVING_CHART_DESIGN_SPEC
 * §5, §4.5): theme-driven palette, GPU-only fallback, honest wind.
 */

/** Minimal document/documentElement stub so the node env can run these. */
function installDocumentStub() {
  const vars = new Map<string, string>();
  const style: Record<string, unknown> = {
    setProperty: (name: string, value: string) => { vars.set(name, value); },
    removeProperty: (name: string) => { vars.delete(name); },
  };
  const documentElement = { style };
  const doc = {
    documentElement,
    createElement: (tag: string) => {
      if (tag === 'canvas') {
        return {
          width: 0,
          height: 0,
          clientWidth: 320,
          clientHeight: 180,
          getContext: () => null,
        } as unknown as HTMLCanvasElement;
      }
      return {} as unknown as HTMLElement;
    },
  } as unknown as Document;
  (globalThis as any).document = doc;
  (globalThis as any).getComputedStyle = () => ({
    getPropertyValue: (name: string) => vars.get(name) ?? '',
  });
  return { vars, doc };
}

beforeEach(() => {
  installDocumentStub();
});

afterEach(() => {
  delete (globalThis as any).document;
  delete (globalThis as any).getComputedStyle;
  vi.restoreAllMocks();
});

describe('resolveLivingChartPalette', () => {
  it('resolves hex tokens from CSS variables', () => {
    const { vars } = installDocumentStub();
    vars.set('--bg-canvas', '#141311');
    vars.set('--surface-card', '#1C1917');
    vars.set('--accent-primary', '#C8933D');
    vars.set('--accent-secondary', '#52C4B7');
    vars.set('--text-primary', '#F2EDDF');

    const p = resolveLivingChartPalette();
    expect(p.ink[0]).toBeCloseTo(0.0784, 2);
    expect(p.card[0]).toBeCloseTo(0.1098, 2);
    expect(p.gold[0]).toBeCloseTo(0.7843, 2);
    expect(p.teal[1]).toBeCloseTo(0.7686, 2);
    expect(p.bone[2]).toBeCloseTo(0.8745, 2);
  });

  it('falls back to documented values when a variable is missing', () => {
    const p = resolveLivingChartPalette();
    for (const key of ['ink', 'card', 'gold', 'teal', 'bone'] as const) {
      for (const channel of p[key]) {
        expect(Number.isFinite(channel)).toBe(true);
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
    // Missing canvas var resolves to the documented ink #141311.
    expect(p.ink[0]).toBeCloseTo(0.0784, 2);
  });

  it('extracts a hex literal from a color-mix() variable', () => {
    const { vars } = installDocumentStub();
    vars.set('--accent-primary', 'color-mix(in srgb, #C8933D 70%, transparent)');
    const p = resolveLivingChartPalette();
    expect(p.gold[0]).toBeCloseTo(0.7843, 2);
  });
});

describe('createLivingChartScene', () => {
  it('returns null when WebGL is unavailable (GPU-only contract)', () => {
    const canvas = document.createElement('canvas');
    const spy = vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    const scene = createLivingChartScene(canvas, {
      staticFrame: true,
      palette: resolveLivingChartPalette(),
    });
    expect(scene).toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  it('dispose is idempotent and never throws without a context', () => {
    const canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(null);
    const scene = createLivingChartScene(canvas, {
      staticFrame: true,
      palette: resolveLivingChartPalette(),
    });
    expect(scene).toBeNull();
    // Null scene → nothing to dispose; the wrapper guards null.
    expect(() => scene?.dispose()).not.toThrow();
  });
});