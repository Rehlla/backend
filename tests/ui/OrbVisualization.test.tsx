import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { OrbFallback, OrbVisualization } from '../../src/components/intelligence-core/OrbVisualization';
import type { OrbState } from '../../src/components/intelligence-core/types';

// Orb labels are localized via useLanguage; fall back to the English label.
vi.mock('../../src/i18n/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    isRTL: false,
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

const STATES: OrbState[] = [
  'idle', 'listening', 'thinking', 'responding', 'action',
  'success', 'warning', 'error', 'confirm', 'alert',
];

describe('OrbVisualization', () => {
  afterEach(() => cleanup());

  it('fallback communicates every state to screen readers (never color-only)', () => {
    for (const state of STATES) {
      cleanup();
      render(<OrbFallback state={state} size={80} />);
      const img = screen.getByRole('img');
      expect(img.getAttribute('aria-label')).toMatch(/Intelligence Core state: \w+/);
    }
  });

  it('compact mode renders the static fallback, never a canvas', () => {
    render(<OrbVisualization state="thinking" size={44} compact />);
    expect(document.querySelector('canvas')).toBeNull();
    expect(screen.getByRole('img')).toBeTruthy();
  });
});
