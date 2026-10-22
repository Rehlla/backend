import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Eye } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';

/**
 * Persistent banner while the session is a read-only view-as of another user
 * (POST /api/admin/view-as). It is rendered at the app root, because during a
 * view-as /api/auth/me answers as the target user — the admin may land on a
 * screen without the Command Center — and ending it must always be one tap away.
 */
export const ViewAsBanner: React.FC = () => {
  const { viewAs, refreshSession } = useAuth();
  const { t, isRTL } = useLanguage();
  const [ending, setEnding] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!viewAs || typeof document === 'undefined') return null;

  const end = async () => {
    setEnding(true);
    setFailed(false);
    try {
      await api.adminEndViewAs();
      await refreshSession();
    } catch {
      setFailed(true);
    } finally {
      setEnding(false);
    }
  };

  return createPortal(
    <div
      role="status"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed top-0 inset-x-0 z-[120] flex flex-wrap items-center justify-center gap-3 border-b border-amber-400/60 bg-amber-500 px-4 py-1.5 text-xs font-bold text-black shadow-lg"
    >
      <Eye className="w-4 h-4" aria-hidden="true" />
      <span>{t('ctl.viewAs.banner', { email: viewAs.email })}</span>
      {failed && <span className="font-normal">{t('ctl.notice.failed')}</span>}
      <button
        type="button"
        onClick={end}
        disabled={ending}
        className="rounded-lg bg-black px-3 py-1 text-[11px] font-bold text-amber-300 hover:bg-black/80 cursor-pointer disabled:opacity-60"
      >
        {t('ctl.viewAs.end')}
      </button>
    </div>,
    document.body
  );
};

export default ViewAsBanner;
