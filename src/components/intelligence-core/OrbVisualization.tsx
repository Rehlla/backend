import React, { useEffect, useRef, useState } from 'react';
import { createDahabOrbScene, type DahabOrbApi, type OrbState } from '../../lib/dahabOrbScene';
import { useLanguage } from '../../i18n/LanguageContext';
import { ORB_STATE_LABEL } from './types';

/** Localized orb-state label with the English label as fallback. */
export function orbLabel(state: OrbState, t: (k: string, fb?: string) => string): string {
  return t(`orb.${state}`, ORB_STATE_LABEL[state]);
}

function canvas2dAvailable(): boolean {
  // The scene is Canvas 2D (no WebGL/three.js dependency) — gate on a 2D
  // context, not on WebGL. A previous revision checked WebGL here, which
  // could force the SVG fallback on machines that render 2D canvas fine.
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('2d'));
  } catch {
    return false;
  }
}

export function OrbFallback({ state, size = 120 }: { state: OrbState; size?: number }) {
  const { t } = useLanguage();
  const label = orbLabel(state, t);
  const color =
    state === 'error' ? '#C0564F'
    : state === 'success' || state === 'listening' || state === 'responding' ? '#52C4B7'
    : state === 'warning' || state === 'alert' || state === 'confirm' ? '#D9A441'
    : 'var(--accent-primary)';
  return (
    <div
      role="img"
      aria-label={`Intelligence Core state: ${label}`}
      style={{ width: size, height: size }}
      className="relative mx-auto"
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        <circle cx="50" cy="50" r="44" fill="none" stroke={color} strokeOpacity="0.35" strokeWidth="1" />
        <circle cx="50" cy="50" r="34" fill="none" stroke={color} strokeOpacity="0.55" strokeWidth="1.2" />
        <ellipse cx="50" cy="50" rx="44" ry="16" fill="none" stroke={color} strokeOpacity="0.4" strokeWidth="1" />
        <circle cx="50" cy="50" r="10" fill={color} fillOpacity="0.85" />
        <circle cx="50" cy="50" r="18" fill={color} fillOpacity="0.18" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface Props {
  state: OrbState;
  attentionCount?: number;
  size?: number;
  compact?: boolean;
  /** Optional out-param: receives the live scene API (rotate/zoom/dispose). */
  apiRef?: React.MutableRefObject<DahabOrbApi | null>;
}

/**
 * Lazy canvas orb. Never blocks the dashboard: the scene initializes after
 * mount, pauses off-screen/hidden, renders on demand under reduced motion,
 * and falls back to SVG when canvas 2D is unavailable or the viewport is
 * small.
 */
export const OrbVisualization: React.FC<Props> = ({ state, attentionCount = 0, size = 220, compact = false, apiRef }) => {
  const { t } = useLanguage();
  const ref = useRef<HTMLDivElement>(null);
  const apiRefInternal = useRef<DahabOrbApi | null>(null);
  const [failed, setFailed] = useState(false);
  const small = compact || size < 140;
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || small) return;
    if (!canvas2dAvailable()) {
      setFailed(true);
      return;
    }
    try {
      const api = createDahabOrbScene(el, { initialState: state, reducedMotion: reduced });
      apiRefInternal.current = api;
      if (apiRef) apiRef.current = api;
    } catch {
      setFailed(true);
    }
    return () => {
      apiRefInternal.current?.dispose();
      apiRefInternal.current = null;
      if (apiRef) apiRef.current = null;
    };
    // Scene lifecycle is mount/size-driven; state flows through setState.
    // `reduced` is captured at scene creation (a change remounts via key in
    // the parent or recreates here).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [small, reduced]);

  useEffect(() => {
    apiRefInternal.current?.setState(state);
  }, [state]);

  useEffect(() => {
    apiRefInternal.current?.setAttentionCount(attentionCount);
  }, [attentionCount]);

  if (small || failed) {
    return <OrbFallback state={state} size={Math.min(size, 120)} />;
  }

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div ref={ref} style={{ width: size, height: size }} aria-hidden="true" />
      <span className="sr-only" role="status">
        Intelligence Core state: {orbLabel(state, t)}
        {attentionCount > 0 ? `, ${t('orb.attentionCount', '{count} items need attention').replace('{count}', String(attentionCount))}` : ''}
      </span>
    </div>
  );
};
