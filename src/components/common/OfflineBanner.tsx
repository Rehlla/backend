import React, { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * Persistent offline notice.
 *
 * Without this, going offline mid-navigation drops the traveller into the
 * error boundary with no explanation. The banner is `role="status"` so it is
 * announced once when it appears rather than interrupting repeatedly.
 */
export const OfflineBanner: React.FC = () => {
  const { t } = useLanguage();
  const [offline, setOffline] = useState(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-[var(--accent-secondary)] px-4 py-2 text-[13px] font-semibold text-[var(--dg-on-accent)]"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{t('common.offline', 'إنت أوفلاين دلوقتي. هنكمّل أول ما النت يرجع.')}</span>
    </div>
  );
};