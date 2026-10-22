import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { CmsPagePreview, type CmsBlock } from './CmsStaticPage';
import { FileText } from 'lucide-react';

/**
 * CmsPreviewPage — renders a draft page behind a preview token (/preview/:token).
 *
 * No authentication: the unguessable token IS the access control, and tokens
 * expire (7 days; see PREVIEW_TOKEN_TTL_MS server-side). An expired or
 * unknown token renders an explicit "expired" state, never a draft leak and
 * never the homepage.
 */

type PreviewState =
  | { status: 'loading' }
  | { status: 'ready'; page: any; blocks: CmsBlock[] }
  | { status: 'expired' }
  | { status: 'error'; message: string };

function tokenFromPathname(): string {
  try {
    return window.location.pathname.replace(/^\/preview\//, '').split('/')[0].trim();
  } catch {
    return '';
  }
}

export const CmsPreviewPage: React.FC<{ token?: string; onBack: () => void }> = ({ token: tokenProp, onBack }) => {
  const { language, t } = useLanguage();
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  // Prop (App route) wins; pathname parsing is the fallback for direct loads
  // that bypass the router.
  const token = tokenProp || tokenFromPathname();

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setState({ status: 'expired' });
      return;
    }
    // NOTE: no raw fetch here — the api-contract test forbids /api calls
    // outside src/services (the call lives in api.getCmsPreview).
    api.getCmsPreview(token)
      .then(data => {
        if (cancelled) return;
        setState({ status: 'ready', page: data.page, blocks: (data.blocks || []) as CmsBlock[] });
      })
      .catch((err: any) => {
        if (cancelled) return;
        if (/expired/i.test(err?.message || '')) setState({ status: 'expired' });
        else setState({ status: 'error', message: err?.message || 'Network error' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen bg-[var(--surface-card)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (state.status === 'ready') {
    return (
      <>
        <div className="sticky top-0 z-40 px-4 py-2 bg-amber-500/90 text-black text-xs font-bold text-center" dir={language === 'ar' ? 'rtl' : 'ltr'}>
          {t('cmd.draftPreview')}
        </div>
        <CmsPagePreview page={state.page} blocks={state.blocks} language={language} onBack={onBack} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-card)] flex flex-col items-center justify-center text-center px-4">
      <FileText className="w-12 h-12 text-[var(--text-muted)] mb-4" />
      <h1 className="text-xl font-bold text-white mb-2">
        {state.status === 'expired' ? t('cmd.previewExpired') : t('pageNotFound')}
      </h1>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        {state.status === 'expired' ? t('cmd.previewExpiredBody') : state.status === 'error' ? state.message : ''}
      </p>
      <button
        type="button"
        onClick={onBack}
        className="px-4 py-2 rounded-xl bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-sm cursor-pointer"
      >
        {t('goBack')}
      </button>
    </div>
  );
};
