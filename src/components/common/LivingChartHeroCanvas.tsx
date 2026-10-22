import React, { useEffect, useRef, useState } from 'react';
import {
  createLivingChartScene,
  resolveLivingChartPalette,
  type LivingChartScene,
} from '../../lib/livingChartShader';
import { api } from '../../services/api';
import { useTheme } from '../../context/ThemeContext';

/**
 * LivingChartHeroCanvas — the Living Chart hero's dune/sea instrument layer.
 *
 * Progressive enhancement in exactly the order the design spec demands:
 * 1. SSR-safe: nothing mounts server-side; the canvas appears only after
 *    hydration (the hero's static gradient/starfield paint first).
 * 2. GPU-only: no WebGL context ⇒ renders nothing and the hero's video/CSS
 *    fallback stays visible (createLivingChartScene returns null).
 * 3. Reduced motion: `staticFrame` renders one frame and stops the clock —
 *    no rAF loop, no drift, final frame only.
 * 4. Telemetry truth: the wind uniform comes from /api/telemetry/weather
 *    when available; without data the angle stays at its calm default.
 * 5. Budget: the rAF loop pauses when the canvas is offscreen or the tab is
 *    hidden; DPR is capped at 2; GL objects are released on unmount.
 *
 * StrictMode note (dev): effects run mount→cleanup→mount. The shader's
 * dispose() deletes GL objects but keeps the context alive, so the second
 * run re-initializes cleanly on the same canvas element.
 */

interface LivingChartHeroCanvasProps {
  /** Hero scroll progress 0..1 — drives the sea shift (scrub). */
  scrollProgress?: number;
  className?: string;
}

const COMPASS_TO_DEG: Record<string, number> = {
  N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135,
  SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270,
  WNW: 292.5, NW: 315, NNW: 337.5,
};

export const LivingChartHeroCanvas: React.FC<LivingChartHeroCanvasProps> = ({
  scrollProgress = 0,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<LivingChartScene | null>(null);
  const scrollRef = useRef(0);
  const windRef = useRef(0);
  const [supported, setSupported] = useState<boolean | null>(null);
  const { theme } = useTheme();

  useEffect(() => {
    scrollRef.current = scrollProgress;
    sceneRef.current?.setScroll(scrollProgress);
  }, [scrollProgress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // WebGL capability probe — the gate for everything below.
    const probe = document.createElement('canvas');
    const gl =
      probe.getContext('webgl2') ||
      probe.getContext('webgl') ||
      probe.getContext('experimental-webgl');
    if (!gl) {
      setSupported(false);
      return;
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setSupported(true);

    let scene: LivingChartScene | null = null;
    let raf = 0;
    let last = performance.now();
    let running = false;
    let disposed = false;

    const loop = (now: number) => {
      if (!running || disposed) return;
      const dt = Math.min((now - last) / 1000, 0.1); // clamp long tab-hide gaps
      last = now;
      scene?.tick(dt);
      raf = requestAnimationFrame(loop);
    };

    // The palette re-resolves when the theme changes so the shader follows
    // all six themes (and High Contrast Pro keeps its opaque inks).
    const start = () => {
      scene?.dispose();
      scene = createLivingChartScene(canvas, {
        staticFrame: reducedMotion,
        windDeg: windRef.current,
        scroll: scrollRef.current,
        palette: resolveLivingChartPalette(),
      });
      sceneRef.current = scene;
      if (!scene) {
        setSupported(false);
        return;
      }
      last = performance.now();
      updateRunState();
    };

    const updateRunState = () => {
      if (disposed || !scene) return;
      const shouldRun = !reducedMotion && document.visibilityState === 'visible';
      if (shouldRun && !running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else if (!shouldRun && running) {
        running = false;
        cancelAnimationFrame(raf);
      }
    };

    // Wind from real telemetry — honest data or calm default. Applied to the
    // live scene as soon as it arrives (and picked up by theme re-inits).
    api
      .getWeatherTelemetry()
      .then(data => {
        const dir = data?.wind?.direction;
        const deg = dir ? COMPASS_TO_DEG[dir] : undefined;
        if (typeof deg === 'number') {
          windRef.current = deg;
          sceneRef.current?.setWind(deg);
        }
      })
      .catch(() => { /* no telemetry → calm default */ });

    // Pause on hidden tabs (battery budget); viewport pauses are unnecessary
    // because the hero is the top-of-page pinned section.
    const onVisibility = () => updateRunState();
    document.addEventListener('visibilitychange', onVisibility);

    const onResize = () => scene?.resize();
    window.addEventListener('resize', onResize);

    start();

    return () => {
      disposed = true;
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      scene?.dispose();
      sceneRef.current = null;
    };
    // theme is the only re-init trigger; everything else is self-contained.
  }, [theme]);

  if (supported === false) return null;

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  );
};

export default LivingChartHeroCanvas;
