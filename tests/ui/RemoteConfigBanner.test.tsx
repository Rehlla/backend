import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { RemoteConfigBanner } from '../../src/components/RemoteConfigBanner';
import { useRemoteConfig } from '../../src/hooks/useRemoteConfig';
import { LanguageProvider } from '../../src/i18n/LanguageContext';
import type { RemoteConfig } from '../../src/services/remoteConfig';

/**
 * The root banner driven by the unified remote config (GET /api/config):
 * the maintenance strip and the dismissible announcement, per language.
 */

vi.mock('../../src/hooks/useRemoteConfig', () => ({ useRemoteConfig: vi.fn() }));
const mockConfig = useRemoteConfig as unknown as ReturnType<typeof vi.fn>;

// vitest runs without globals here, so Testing Library's auto-cleanup is
// not registered — do it explicitly or DOM nodes leak between tests.
afterEach(() => cleanup());

function makeConfig(over: Partial<RemoteConfig> = {}): RemoteConfig {
  return {
    version: 'cfg-test123',
    issuedAt: '2026-10-16T00:00:00Z',
    maintenance: { active: false, message: { en: 'Down for maintenance', ar: 'متوقف للصيانة' } },
    killswitches: {},
    flags: {},
    settings: { supportHours: '09:00-23:00', supportSlaMinutes: 30, currency: 'EGP' },
    apps: {
      android: { minVersion: '1.0.0', latestVersion: '1.0.0', storeUrl: '', updateRequired: false, updateAvailable: false },
      ios: { minVersion: '1.0.0', latestVersion: '1.0.0', storeUrl: '', updateRequired: false, updateAvailable: false },
    },
    announcement: null,
    ...over,
  };
}

beforeEach(() => {
  localStorage.clear();
  mockConfig.mockReturnValue(makeConfig());
});

function renderBanner() {
  return render(
    <LanguageProvider>
      <RemoteConfigBanner />
    </LanguageProvider>
  );
}

describe('RemoteConfigBanner', () => {
  it('renders nothing on a quiet config', () => {
    const { container } = renderBanner();
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('shows the maintenance strip while maintenance is active', () => {
    mockConfig.mockReturnValue(makeConfig({ maintenance: { active: true, message: { en: 'Down', ar: 'متوقف' } } }));
    renderBanner();
    expect(screen.getByRole('alert').textContent).toContain('maintenance');
  });

  it('shows and dismisses an announcement, remembering the config version', () => {
    mockConfig.mockReturnValue(
      makeConfig({ announcement: { tone: 'info', text: { en: 'New: Siwa trips', ar: 'جديد: رحلات سيوة' } } }),
    );
    renderBanner();
    expect(screen.getByRole('status').textContent).toContain('New: Siwa trips');

    fireEvent.click(screen.getByLabelText('Dismiss'));
    expect(screen.queryByRole('status')).toBeNull();
    expect(localStorage.getItem('dahab_announcement_dismissed')).toBe('cfg-test123');
  });

  it('a dismissed announcement returns when the version changes', () => {
    localStorage.setItem('dahab_announcement_dismissed', 'cfg-old');
    mockConfig.mockReturnValue(
      makeConfig({ announcement: { tone: 'warn', text: { en: 'Storm warning', ar: 'تحذير عاصفة' } } }),
    );
    renderBanner();
    expect(screen.getByRole('status').textContent).toContain('Storm warning');
  });
});
