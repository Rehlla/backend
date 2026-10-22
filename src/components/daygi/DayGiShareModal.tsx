import { useEffect, useState } from 'react';
import { Link2, Check, Copy, X } from 'lucide-react';
import { useConciergeT } from './useConciergeT';

/**
 * The share-link dialog, TripAdvisor-style: whoever opens the link reads a
 * frozen snapshot of the conversation — later turns never appear under an
 * existing link. Copying is explicit (the button flips to "Copied!"); the
 * URL itself is read-only text, never an editable field.
 */

export interface DayGiShareModalProps {
  open: boolean;
  shareUrl: string | null;
  creating: boolean;
  lang: 'en' | 'ar';
  onCopy: () => Promise<void>;
  onClose: () => void;
}

export function DayGiShareModal({
  open,
  shareUrl,
  creating,
  lang,
  onCopy,
  onClose
}: DayGiShareModalProps) {
  // Follows the concierge's in-page language toggle via the `lang` prop,
  // not the site language.
  const t = useConciergeT(lang);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) setCopied(false);
  }, [open, shareUrl]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      await onCopy();
      setCopied(true);
    } catch {
      // onCopy already surfaced the failure (toast); the button simply stays
      // unflipped. Swallowed deliberately so a denied clipboard never becomes
      // an unhandled rejection.
    }
  };

  return (
    <div
      className="daygi-surface fixed inset-0 bg-[var(--dg-scrim)] backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="daygi-share-modal"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dg-share-title"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="w-full sm:max-w-md rounded-2xl border border-[var(--dg-line)] bg-[var(--dg-panel)] shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 id="dg-share-title" className="text-sm font-bold text-[var(--dg-text)] flex items-center gap-2">
            <Link2 className="w-4 h-4 text-[var(--dg-teal)]" aria-hidden="true" />
            {t('daygi.shareChat')}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('daygi.chatsClose')}
            className="dg-focus w-8 h-8 rounded-lg flex items-center justify-center text-[var(--dg-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint-2)] transition-colors"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-[var(--dg-text-2)]">
          {t('daygi.shareSnapshotNote')}
        </p>

        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            readOnly
            value={shareUrl ?? ''}
            aria-label={t('daygi.shareChat')}
            placeholder={creating ? t('daygi.loadingChats') : ''}
            onFocus={(e) => e.target.select()}
            className="dg-focus flex-1 min-w-0 bg-[var(--dg-tint)] border border-[var(--dg-line)] rounded-xl px-3 h-10 text-xs text-[var(--dg-text-2)] outline-none truncate"
            data-testid="daygi-share-url"
          />
          <button
            type="button"
            onClick={handleCopy}
            disabled={!shareUrl}
            className="dg-focus h-10 px-3.5 rounded-xl text-xs font-semibold bg-[var(--dg-teal)] text-[var(--dg-gold-ink)] flex items-center gap-1.5 hover:brightness-110 transition-[filter] disabled:opacity-40 shrink-0"
          >
            {copied
              ? <><Check className="w-3.5 h-3.5" aria-hidden="true" />{t('daygi.shareCopied')}</>
              : <><Copy className="w-3.5 h-3.5" aria-hidden="true" />{t('daygi.shareCopyLink')}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
