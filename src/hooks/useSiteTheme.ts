import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';

/**
 * Applies CMS theme-token overrides OVER the compiled theme.
 *
 * Ordering is the whole trick: ThemeProvider (an ancestor) writes the
 * compiled theme's inline variables in its own effect, and ancestor effects
 * always run before descendant effects — so this hook, called from app
 * content below the provider, wins on every commit, including theme
 * switches (themeId in the dep list re-applies after each switch).
 * Unsetting a token removes the inline override, restoring the compiled
 * value from the stylesheet instantly.
 */

const TOKEN_VARS: Record<string, string[]> = {
  'brand.accent': ['--accent-primary'],
  'brand.accentSecondary': ['--accent-secondary'],
  'type.display': ['--font-display'],
  'type.body': ['--font-sans'],
  'type.arabic': ['--font-arabic', '--font-arabic-display', '--font-arabic-body'],
};

const CACHE_KEY = 'dahab_theme_bundle_v1';

function readCachedBundle(): { version: string; tokens: Record<string, string> } | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.version !== 'string' || typeof parsed?.tokens !== 'object' || !parsed.tokens) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useSiteTheme(): Record<string, string> {
  const { themeId } = useTheme();
  const [tokens, setTokens] = useState<Record<string, string>>(() => readCachedBundle()?.tokens || {});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cached = readCachedBundle();
    if (cached) {
      setTokens(cached.tokens);
      setLoaded(true);
    }
    const params = cached?.version ? { v: cached.version } : {};
    api.getThemeTokens(params)
      .then(data => {
        if (cancelled || !data) return;
        if (data.unchanged) {
          setLoaded(true);
          return;
        }
        const next = (data.tokens || {}) as Record<string, string>;
        setTokens(next);
        setLoaded(true);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({ version: data.version, tokens: next }));
        } catch {
          // Storage blocked — the live bundle is already in state.
        }
      })
      .catch(() => {
        // Offline: compiled theme renders; cached tokens (if any) applied below.
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Never touch variables before the first bundle resolves — the theme
    // engine owns them until then (avoids a flash of stylesheet values).
    if (!loaded) return;
    const root = document.documentElement;
    for (const [key, vars] of Object.entries(TOKEN_VARS)) {
      const value = tokens[key];
      for (const name of vars) {
        if (value) root.style.setProperty(name, value);
        else root.style.removeProperty(name);
      }
    }
  }, [tokens, loaded, themeId]);

  return tokens;
}
