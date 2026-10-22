import { useEffect, useState } from 'react';
import {
  fetchRemoteConfig,
  getCachedRemoteConfig,
  type RemoteConfig,
} from '../services/remoteConfig';

/**
 * The unified remote config, loaded once per page boot.
 *
 * Starts from the cached document (so kill-switch gates answer instantly)
 * and refreshes in the background; a 304 keeps the cache. A failed refresh
 * is silent — the server still enforces every switch on the API, this copy
 * only hides dead ends early.
 */
export function useRemoteConfig(): RemoteConfig | null {
  const [config, setConfig] = useState<RemoteConfig | null>(() => getCachedRemoteConfig());

  useEffect(() => {
    let isMounted = true;
    fetchRemoteConfig()
      .then(({ config: next }) => {
        if (isMounted && next) setConfig(next);
      })
      .catch(() => {
        // Offline or unreachable: the cache (or nothing) stands.
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return config;
}
