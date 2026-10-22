import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

/**
 * Granite & Lagoon (src/styles/tokens.css): one palette, three themes. The
 * colour values live in CSS only — this context owns the `data-theme-id`
 * attribute and nothing else, so CSS, the CMS and components can no longer
 * disagree about what the accent is (they used to: four authorities).
 */
export type ThemeId = 'abyss' | 'salt' | 'high-contrast-pro';
export type ThemeMode = 'dark' | 'light';

export interface ThemeOption {
  id: ThemeId;
  nameEn: string;
  nameAr: string;
  category: ThemeMode;
  taglineEn: string;
  taglineAr: string;
  accentLabel: string;
  wcagLevel: 'AAA' | 'AA+';
  contrastRatio: string;
  swatches: {
    bg: string;
    card: string;
    container: string;
    accent: string;
    accentSecondary: string;
    text: string;
    textSecondary: string;
    focusRing: string;
  };
}

// Swatches mirror tokens.css for the theme picker and the CMS preview only.
export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'abyss',
    nameEn: 'Abyss',
    nameAr: 'عُمق',
    category: 'dark',
    taglineEn: 'Red Sea at depth, lagoon light',
    taglineAr: 'عمق البحر الأحمر مع ضوء اللاجونا',
    accentLabel: 'Lagoon',
    wcagLevel: 'AAA',
    contrastRatio: '15.2:1',
    swatches: {
      bg: '#0B151C',
      card: '#0F1C25',
      container: '#13222C',
      accent: '#3CC2BC',
      accentSecondary: '#F08A6C',
      text: '#ECE9E2',
      textSecondary: '#BAC3C7',
      focusRing: '#3CC2BC',
    },
  },
  {
    id: 'salt',
    nameEn: 'Salt',
    nameAr: 'ملح',
    category: 'light',
    taglineEn: 'Salt flat light, granite ink',
    taglineAr: 'ضوء الملّاحة وحبر الجرانيت',
    accentLabel: 'Lagoon',
    wcagLevel: 'AAA',
    contrastRatio: '16.4:1',
    swatches: {
      bg: '#F5F4F0',
      card: '#FFFFFF',
      container: '#ECEAE4',
      accent: '#0E7C7A',
      accentSecondary: '#B4523A',
      text: '#0B151C',
      textSecondary: '#4B4744',
      focusRing: '#0E7C7A',
    },
  },
  {
    id: 'high-contrast-pro',
    nameEn: 'High Contrast',
    nameAr: 'أقصى وضوح',
    category: 'dark',
    taglineEn: 'Pure black 21:1 contrast for maximum visibility',
    taglineAr: 'أسود نقي مع أصفر ساطع لأقصى درجات الوضوح',
    accentLabel: 'Pure Yellow',
    wcagLevel: 'AAA',
    contrastRatio: '21.0:1',
    swatches: {
      bg: '#000000',
      card: '#0A0A0A',
      container: '#171717',
      accent: '#FFE600',
      accentSecondary: '#00F0FF',
      text: '#FFFFFF',
      textSecondary: '#F5F5F5',
      focusRing: '#FFE600',
    },
  },
];

/** Saved ids from the six-theme era fold into the two brand themes. */
const LEGACY_THEME_IDS: Record<string, ThemeId> = {
  'charcoal-minimal': 'abyss',
  'deep-reef': 'abyss',
  'sinai-midnight': 'abyss',
  'editorial-sand': 'salt',
  'lagoon-breeze': 'salt',
};

export const resolveThemeId = (raw: string | null | undefined): ThemeId | null => {
  if (!raw) return null;
  if (THEME_OPTIONS.some(t => t.id === raw)) return raw as ThemeId;
  return LEGACY_THEME_IDS[raw] ?? null;
};

interface ThemeContextType {
  themeId: ThemeId;
  theme: ThemeMode;
  isDark: boolean;
  activeTheme: ThemeOption;
  availableThemes: ThemeOption[];
  setThemeId: (id: ThemeId) => void;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode | ThemeId) => void;
  // Accessibility Features
  highContrastMode: boolean;
  setHighContrastMode: (enabled: boolean) => void;
  toggleHighContrastMode: () => void;
  reducedMotion: boolean;
  setReducedMotion: (enabled: boolean) => void;
  toggleReducedMotion: () => void;
  largeText: boolean;
  setLargeText: (enabled: boolean) => void;
  toggleLargeText: () => void;
  announcement: string;
  announce: (msg: string) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useState<ThemeId>(() => {
    try {
      const saved = resolveThemeId(localStorage.getItem('dahab_travel_os_theme_id'));
      if (saved) return saved;
      const legacyTheme = localStorage.getItem('dahab_travel_os_theme');
      if (legacyTheme === 'light') return 'salt';
      if (legacyTheme === 'dark') return 'abyss';
    } catch {
      // Fallback
    }
    return 'abyss';
  });

  // CMS default theme for first-time visitors: only when this browser never
  // chose (nothing saved), a published brand.homeTheme token wins over the
  // compiled default above. Returning visitors keep their saved choice.
  // NOTE: no raw fetch here — the api-contract test forbids /api calls
  // outside src/services (the fetch lives in api.getThemeBundle).
  useEffect(() => {
    let cancelled = false;
    try {
      if (localStorage.getItem('dahab_travel_os_theme_id') || localStorage.getItem('dahab_travel_os_theme')) return;
    } catch {
      return;
    }
    import('../services/api').then(({ api }) =>
      api.getThemeBundle().then(data => {
        if (cancelled || !data) return;
        const id = resolveThemeId(data.tokens?.['brand.homeTheme']);
        if (id) setThemeIdState(id);
      }).catch(() => {
        // Offline: compiled default stands.
      })
    ).catch(() => {
      // Unreachable in practice; compiled default stands.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Accessibility States
  const [highContrastMode, setHighContrastModeState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dahab_a11y_high_contrast') === 'true';
    } catch {
      return false;
    }
  });

  const [reducedMotion, setReducedMotionState] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('dahab_a11y_reduced_motion');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  });

  const [largeText, setLargeTextState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dahab_a11y_large_text') === 'true';
    } catch {
      return false;
    }
  });

  const [announcement, setAnnouncement] = useState<string>('');

  const activeTheme = THEME_OPTIONS.find((t) => t.id === themeId) || THEME_OPTIONS[0];
  const isDark = activeTheme.category === 'dark';
  const theme: ThemeMode = activeTheme.category;

  const announce = (msg: string) => {
    setAnnouncement(msg);
  };

  useEffect(() => {
    try {
      localStorage.setItem('dahab_travel_os_theme_id', themeId);
      localStorage.setItem('dahab_travel_os_theme', isDark ? 'dark' : 'light');
      localStorage.setItem('dahab_a11y_high_contrast', String(highContrastMode));
      localStorage.setItem('dahab_a11y_reduced_motion', String(reducedMotion));
      localStorage.setItem('dahab_a11y_large_text', String(largeText));
    } catch {
      // ignore
    }

    const root = document.documentElement;
    const body = document.body;

    // Theme attributes live on <html> only: a copy on <body> re-declared the
    // tokens one level down and hid the destination palette (tokens.css).
    root.setAttribute('data-theme-id', themeId);
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Accessibility attributes
    root.setAttribute('data-high-contrast', String(highContrastMode));
    body.setAttribute('data-high-contrast', String(highContrastMode));
    root.setAttribute('data-reduced-motion', String(reducedMotion));
    body.setAttribute('data-reduced-motion', String(reducedMotion));
    root.setAttribute('data-large-text', String(largeText));
    body.setAttribute('data-large-text', String(largeText));

    if (isDark) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }

    if (highContrastMode) {
      root.classList.add('a11y-high-contrast');
    } else {
      root.classList.remove('a11y-high-contrast');
    }

    if (reducedMotion) {
      root.classList.add('a11y-reduced-motion');
    } else {
      root.classList.remove('a11y-reduced-motion');
    }

    if (largeText) {
      root.classList.add('a11y-large-text');
    } else {
      root.classList.remove('a11y-large-text');
    }

    // Browser chrome (Android address bar, iOS PWA status area) follows the
    // canvas. The colours themselves are CSS-only (tokens.css).
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', activeTheme.swatches.bg);
  }, [themeId, activeTheme, isDark, highContrastMode, reducedMotion, largeText]);

  const toggleTheme = () => {
    setThemeIdState(themeId === 'salt' ? 'abyss' : 'salt');
  };

  const setThemeId = (newId: ThemeId) => {
    setThemeIdState(newId);
    const selected = THEME_OPTIONS.find((t) => t.id === newId);
    if (selected) {
      announce(`Theme changed to ${selected.nameEn}. Contrast level ${selected.wcagLevel}`);
    }
  };

  const setTheme = (modeOrId: ThemeMode | ThemeId) => {
    if (modeOrId === 'dark') {
      setThemeIdState('abyss');
    } else if (modeOrId === 'light') {
      setThemeIdState('salt');
    } else {
      const id = resolveThemeId(modeOrId);
      if (id) setThemeIdState(id);
    }
  };

  const setHighContrastMode = (enabled: boolean) => {
    setHighContrastModeState(enabled);
    announce(enabled ? 'High contrast outlines enabled' : 'High contrast outlines disabled');
  };

  const toggleHighContrastMode = () => {
    setHighContrastMode(!highContrastMode);
  };

  const setReducedMotion = (enabled: boolean) => {
    setReducedMotionState(enabled);
    announce(enabled ? 'Reduced motion enabled' : 'Reduced motion disabled');
  };

  const toggleReducedMotion = () => {
    setReducedMotion(!reducedMotion);
  };

  const setLargeText = (enabled: boolean) => {
    setLargeTextState(enabled);
    announce(enabled ? 'Large high-legibility text enabled' : 'Standard text size restored');
  };

  const toggleLargeText = () => {
    setLargeText(!largeText);
  };

  const providerValue = useMemo(() => ({
    themeId,
    theme,
    isDark,
    activeTheme,
    availableThemes: THEME_OPTIONS,
    setThemeId,
    toggleTheme,
    setTheme,
    highContrastMode,
    setHighContrastMode,
    toggleHighContrastMode,
    reducedMotion,
    setReducedMotion,
    toggleReducedMotion,
    largeText,
    setLargeText,
    toggleLargeText,
    announcement,
    announce,
  }), [
    themeId, isDark, highContrastMode, reducedMotion, largeText, announcement,
    setThemeId, toggleTheme, setTheme, setHighContrastMode, toggleHighContrastMode,
    setReducedMotion, toggleReducedMotion, setLargeText, toggleLargeText, announce
  ]);

  return (
    <ThemeContext.Provider
      value={providerValue}
    >
      {/* Hidden Live Region for Screen Readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="theme-announcer-live-region"
      >
        {announcement}
      </div>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
