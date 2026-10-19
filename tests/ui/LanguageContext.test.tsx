import { render, screen, renderHook, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, beforeEach } from 'vitest';
import React from 'react';
import { LanguageProvider, useLanguage } from '../../src/i18n/LanguageContext';

function Probe(): React.ReactElement {
  const { language, isRTL, setLanguage, t } = useLanguage();
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="rtl">{String(isRTL)}</span>
      <span data-testid="greeting">{t('nav.myTrip')}</span>
      <span data-testid="fallback">{t('key.that.does.not.exist', 'Fallback text')}</span>
      <span data-testid="vars">{t('itinerary.addedToDay', { title: 'Diving', day: 2 }, 'missing')}</span>
      <span data-testid="docLang">{document.documentElement.lang}</span>
      <button type="button" onClick={() => setLanguage('ar')}>
        to-ar
      </button>
    </div>
  );
}

describe('LanguageProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = '';
    document.documentElement.dir = '';
    document.documentElement.classList.remove('rtl', 'ltr');
  });

  // vitest runs without globals here, so Testing Library's auto-cleanup is
  // not registered — do it explicitly or DOM nodes leak between tests.
  afterEach(() => cleanup());

  it('applies lang/dir/class attributes to the document immediately', () => {
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.classList.contains('ltr')).toBe(true);
  });

  it('switching to Arabic flips dir to rtl and persists the choice', async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    await user.click(screen.getByText('to-ar'));

    expect(screen.getByTestId('lang').textContent).toBe('ar');
    expect(screen.getByTestId('rtl').textContent).toBe('true');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem('dahab_os_lang')).toBe('ar');
  });

  it('restores a persisted language instead of defaulting to en', () => {
    localStorage.setItem('dahab_os_lang', 'ar');
    render(
      <LanguageProvider>
        <Probe />
      </LanguageProvider>
    );

    expect(screen.getByTestId('lang').textContent).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('defaults to Arabic for an Arabic browser with no stored choice', () => {
    const original = navigator.language;
    Object.defineProperty(window.navigator, 'language', { value: 'ar-EG', configurable: true });
    try {
      render(
        <LanguageProvider>
          <Probe />
        </LanguageProvider>
      );
      expect(screen.getByTestId('lang').textContent).toBe('ar');
    } finally {
      Object.defineProperty(window.navigator, 'language', { value: original, configurable: true });
    }
  });
});

describe('t() contract', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => cleanup());

  it('returns the translated string for a known key', () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>
    });
    expect(result.current.t('nav.myTrip')).toBe('My Trip');
  });

  it('uses the fallback for an unknown key instead of shipping the key to the traveler', () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>
    });
    expect(result.current.t('totally.missing.key', 'Saved!')).toBe('Saved!');
  });

  it('interpolates {placeholder} vars', () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: ({ children }: { children: React.ReactNode }) => <LanguageProvider>{children}</LanguageProvider>
    });
    const out = result.current.t('itinerary.addedToDay', { title: 'Reef', day: 3 }, 'missing');
    expect(out).toBe('Added "Reef" to Day 3 ✓');
  });
});
