import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DeliveryLocationDraft } from '../types/dining';

/**
 * Where the customer's food is going.
 *
 * Two rules shaped this:
 *
 * 1. The manual path is always visible, never a fallback behind a permission
 *    wall. The traveler is often on a Sinai mobile network where a geolocation
 *    fix takes seconds or never comes; a UI that opens with a browser prompt
 *    and hides the alternative turns "slow GPS" into "this app is broken".
 *
 * 2. This context stores a ZONE, never a free-text address it guessed. The
 *    server prices by zone, so a client that resolved its own idea of "near the
 *    mosque" would produce a fee nobody can justify.
 *
 * Deliberately tiny: it is mounted at the app root, so everything here lands in
 * the entry chunk. No map library, no leaflet, no geocoder — the one thing that
 * could grow it is a map, and there is not one.
 */

const STORAGE_KEY = 'rehla_delivery_location';

export type DeliveryLocationState =
  /** Nothing chosen yet. */
  | 'idle'
  | 'detecting'
  | 'detected'
  /** The traveler said no. Distinct from 'failed' so the copy can apologise
   *  rather than report a fault that is not one. */
  | 'denied'
  /** The fix failed for a reason other than refusal (no GPS, timeout). */
  | 'failed';

interface DeliveryLocationValue {
  state: DeliveryLocationState;
  /** Null until the traveler has either detected a fix or picked a zone. */
  location: DeliveryLocationDraft | null;
  /** Ask the browser for a fix. Resolves to the resulting state. */
  detect: () => Promise<DeliveryLocationState>;
  /** The manual path: a zone the kitchen lists, plus optional free text. */
  chooseZone: (zoneId: string, addressText?: string) => void;
  /** A coordinate the traveler supplied some other way (a shared link, a
   *  hotel concierge). The server still resolves the zone from it. */
  chooseCoordinate: (latitude: number, longitude: number, addressText?: string) => void;
  clear: () => void;
}

const DeliveryLocationContext = createContext<DeliveryLocationValue | null>(null);

function readStored(): DeliveryLocationDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DeliveryLocationDraft;
    // A stored value with neither a zone nor a coordinate cannot be priced, so
    // it is dropped rather than carried into a quote that will be refused.
    if (!parsed?.source) return null;
    if (!parsed.zoneId && !Number.isFinite(parsed.latitude)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const DeliveryLocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocation] = useState<DeliveryLocationDraft | null>(readStored);
  const [state, setState] = useState<DeliveryLocationState>(() => (readStored() ? 'detected' : 'idle'));

  const persist = useCallback((next: DeliveryLocationDraft | null) => {
    setLocation(next);
    if (typeof window === 'undefined') return;
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // A full or blocked localStorage must not stop someone ordering dinner.
    }
  }, []);

  const detect = useCallback(async (): Promise<DeliveryLocationState> => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('failed');
      return 'failed';
    }
    setState('detecting');
    // Same options TransfersHubView uses: maximumAge 0 because a stale fix
    // would send the food to where they were an hour ago, and no
    // enableHighAccuracy because an exact fix costs seconds on a slow network
    // and zone resolution only needs neighbourhood precision.
    return new Promise<DeliveryLocationState>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          persist({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            source: 'geo'
          });
          setState('detected');
          resolve('detected');
        },
        (err) => {
          // GeolocationPositionError: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE,
          // 3 = TIMEOUT. These were swapped in the first draft and the test caught
          // it — the difference matters because 'denied' is the traveler's own
          // choice and 'failed' is a fault to apologise for.
          const next: DeliveryLocationState =
            err?.code === 1 ? 'denied' : 'failed';
          setState(next);
          resolve(next);
        },
        { timeout: 8000, maximumAge: 0 }
      );
    });
  }, [persist]);

  const chooseZone = useCallback(
    (zoneId: string, addressText?: string) => {
      persist({ zoneId, addressText, source: 'manual' });
      setState('detected');
    },
    [persist]
  );

  const chooseCoordinate = useCallback(
    (latitude: number, longitude: number, addressText?: string) => {
      persist({ latitude, longitude, addressText, source: 'reverse_geocoded' });
      setState('detected');
    },
    [persist]
  );

  const clear = useCallback(() => {
    persist(null);
    setState('idle');
  }, [persist]);

  const value = useMemo<DeliveryLocationValue>(
    () => ({ state, location, detect, chooseZone, chooseCoordinate, clear }),
    [state, location, detect, chooseZone, chooseCoordinate, clear]
  );

  return <DeliveryLocationContext.Provider value={value}>{children}</DeliveryLocationContext.Provider>;
};

export function useDeliveryLocation(): DeliveryLocationValue {
  const ctx = useContext(DeliveryLocationContext);
  if (!ctx) {
    throw new Error('useDeliveryLocation must be used inside DeliveryLocationProvider.');
  }
  return ctx;
}

/** Turns the stored draft into the payload /api/dining/quote expects. */
export function locationPayload(location: DeliveryLocationDraft | null): {
  zoneId?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  locationSource?: DeliveryLocationDraft['source'];
} {
  if (!location) return {};
  return {
    zoneId: location.zoneId,
    latitude: location.latitude,
    longitude: location.longitude,
    addressText: location.addressText,
    locationSource: location.source
  };
}