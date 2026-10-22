import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DEFAULT_DESTINATION,
  DESTINATIONS,
  isDestinationId,
  type Destination,
  type DestinationId,
} from '../design/destinations';
import { useTheme } from './ThemeContext';

/**
 * The destination the visitor is exploring. It is part of the identity, not
 * a filter: switching it re-tints and re-paces the whole product
 * (tokens.css, data-destination) and scopes catalogue screens.
 *
 * Resolution order: `?d=` in the URL (shareable links), `?city=` (the
 * /hotels listing), the saved choice, then Dahab. index.html applies the same
 * read before first paint so the page never flashes the wrong palette.
 *
 * `?city=` is read here too, not only seeded by the page after mount: a
 * crossfaded setDestination waits for the View Transition's next rendered
 * frame, so /hotels?city=sharm could sit on the saved city in the meantime.
 */

const STORAGE_KEY = 'rehla_destination';

function readInitial(): DestinationId {
  try {
    const query = new URLSearchParams(window.location.search);
    const fromUrl = query.get('d');
    if (isDestinationId(fromUrl)) return fromUrl;
    const fromCity = query.get('city')?.trim().toLowerCase();
    if (isDestinationId(fromCity)) return fromCity;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isDestinationId(saved)) return saved;
  } catch {
    // storage or URL unavailable: the default stands
  }
  return DEFAULT_DESTINATION;
}

interface DestinationContextValue {
  destinationId: DestinationId;
  destination: Destination;
  /**
   * The destination once the page-wide colour crossfade has finished. Media
   * that make their own entrance (the home hero photo) key on this, so the
   * photo arrives after the palette instead of being frozen inside the
   * crossfade snapshot.
   */
  settledDestinationId: DestinationId;
  /**
   * Switch place. Cross-fades the document where the browser supports it.
   * `instant` skips the crossfade: for syncing to a URL rather than a tap,
   * where the update must not wait on a View Transition's next frame.
   */
  setDestination: (id: DestinationId, opts?: { instant?: boolean }) => void;
}

const DestinationContext = createContext<DestinationContextValue | undefined>(undefined);

export const DestinationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [destinationId, setDestinationId] = useState<DestinationId>(readInitial);
  const [settledDestinationId, setSettled] = useState<DestinationId>(destinationId);
  const { themeId, reducedMotion } = useTheme();

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-destination', destinationId);
    try {
      localStorage.setItem(STORAGE_KEY, destinationId);
      // Keep a shared ?d= link honest: it should reopen where you are now.
      const url = new URL(window.location.href);
      if (url.searchParams.has('d') && url.searchParams.get('d') !== destinationId) {
        url.searchParams.set('d', destinationId);
        window.history.replaceState(window.history.state, '', url);
      }
    } catch {
      // per-run only
    }
    const d = DESTINATIONS[destinationId];
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && themeId !== 'high-contrast-pro') meta.setAttribute('content', themeId === 'salt' ? d.chrome.salt : d.chrome.abyss);
  }, [destinationId, themeId]);

  const setDestination = useCallback(
    (id: DestinationId, opts?: { instant?: boolean }) => {
      if (id === destinationId) return;
      if (opts?.instant) {
        setDestinationId(id);
        setSettled(id);
        return;
      }
      // Warm the next hero photo while the palette crossfades.
      try {
        const img = new Image();
        img.decoding = 'async';
        img.src = DESTINATIONS[id].heroImage;
      } catch {
        // preloading is an optimisation only
      }
      const apply = () => flushSync(() => setDestinationId(id));
      type VT = { ready?: Promise<unknown>; finished?: Promise<unknown> };
      const doc = document as Document & { startViewTransition?: (cb: () => void) => VT };
      if (!reducedMotion && typeof doc.startViewTransition === 'function') {
        const vt = doc.startViewTransition(apply);
        // A newer switch (or navigation) can abort this one; the state update
        // still lands, so the rejection is expected and not an error.
        vt?.ready?.catch(() => {});
        if (vt?.finished) vt.finished.catch(() => {}).finally(() => setSettled(id));
        else setSettled(id);
      } else {
        apply();
        setSettled(id);
      }
    },
    [destinationId, reducedMotion],
  );

  const value = useMemo(
    () => ({ destinationId, destination: DESTINATIONS[destinationId], settledDestinationId, setDestination }),
    [destinationId, settledDestinationId, setDestination],
  );

  return <DestinationContext.Provider value={value}>{children}</DestinationContext.Provider>;
};

export const useDestination = (): DestinationContextValue => {
  const ctx = useContext(DestinationContext);
  if (!ctx) throw new Error('useDestination must be used within a DestinationProvider');
  return ctx;
};
