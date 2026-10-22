import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Megaphone, Wrench, X } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';
import { useRemoteConfig } from '../hooks/useRemoteConfig';
import type { BilingualText } from '../services/remoteConfig';

const DISMISS_KEY = 'dahab_announcement_dismissed';

/**
 * Platform-wide notices from the unified remote config (GET /api/config),
 * rendered at the app root above every route:
 *
 * - maintenance: the desk has put the platform in maintenance mode. API
 *   calls already 503; this strip says so before the traveller taps.
 * - announcement: the optional desk banner ({en, ar}). Dismissing remembers
 *   the config version, so a new announcement reappears.
 */
export const RemoteConfigBanner: React.FC = () => {
  const config = useRemoteConfig();
  const { language, isRTL, t } = useLanguage();
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });
  if (!config || typeof document === 'undefined') return null;

  const textOf = (b: BilingualText): string => b[language] ?? b.en;
  const showAnnouncement = config.announcement && dismissed !== config.version;

  if (!config.maintenance.active && !showAnnouncement) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, config.version);
    } catch {
      // Dismissal is a nicety; the banner simply returns next boot.
    }
    setDismissed(config.version);
  };

  return createPortal(
    <div dir={isRTL ? 'rtl' : 'ltr'} className="fixed top-0 inset-x-0 z-[110] flex flex-col">
      {config.maintenance.active && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-center gap-2 border-b border-red-400/60 bg-red-600 px-4 py-1.5 text-xs font-bold text-white"
        >
          <Wrench className="w-4 h-4" aria-hidden="true" />
          <span>{t('ctl.notice.maintenance')}</span>
          <span className="font-normal opacity-90">{textOf(config.maintenance.message)}</span>
        </div>
      )}
      {showAnnouncement && (
        <div
          role="status"
          className={`flex flex-wrap items-center justify-center gap-2 border-b px-4 py-1.5 text-xs font-bold ${
            config.announcement!.tone === 'warn'
              ? 'border-amber-400/60 bg-amber-500 text-black'
              : 'border-sky-400/60 bg-sky-600 text-white'
          }`}
        >
          <Megaphone className="w-4 h-4" aria-hidden="true" />
          <span>{textOf(config.announcement!.text)}</span>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded p-0.5 opacity-70 hover:opacity-100 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>,
    document.body
  );
};

export default RemoteConfigBanner;
