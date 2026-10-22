import { useEffect, useState } from 'react';
import { MessageSquare, Trash2, Plus, X } from 'lucide-react';
import type { DayGiChatSummary } from '../../shared/types/daygi';
import { useConciergeT } from './useConciergeT';

/**
 * "All chats" — the saved-conversation list, TripAdvisor-style. A pure view
 * over summaries fetched by the concierge view: resume, delete, start new.
 * Every string comes from the i18n catalog.
 */

export interface DayGiChatHistoryModalProps {
  open: boolean;
  chats: DayGiChatSummary[];
  loading: boolean;
  lang: 'en' | 'ar';
  onResume: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}

function formatChatDate(iso: string, lang: 'en' | 'ar'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function DayGiChatHistoryModal({
  open,
  chats,
  loading,
  lang,
  onResume,
  onDelete,
  onNewChat,
  onClose
}: DayGiChatHistoryModalProps) {
  // Follows the concierge's in-page language toggle via the `lang` prop,
  // not the site language.
  const t = useConciergeT(lang);
  const [filter, setFilter] = useState<'all' | 'plan'>('all');

  useEffect(() => {
    if (open) setFilter('all');
  }, [open]);

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

  const visibleChats = filter === 'plan' ? chats.filter(chat => chat.hasPlan) : chats;

  return (
    <div
      className="daygi-surface fixed inset-0 bg-[var(--dg-scrim)] backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="daygi-chat-history"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dg-chats-title"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        className="w-full sm:max-w-md max-h-[80vh] rounded-2xl border border-[var(--dg-line)] bg-[var(--dg-panel)] shadow-2xl flex flex-col min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2 shrink-0">
          <h3 id="dg-chats-title" className="text-sm font-bold text-[var(--dg-text)] flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-[var(--dg-teal)]" aria-hidden="true" />
            {t('daygi.chatHistory')}
          </h3>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onNewChat}
              className="dg-focus h-8 px-3 rounded-lg text-xs font-semibold bg-[var(--dg-teal)] text-[var(--dg-gold-ink)] flex items-center gap-1.5 hover:brightness-110 transition-[filter]"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              {t('daygi.newChat')}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('daygi.chatsClose')}
              className="dg-focus w-8 h-8 rounded-lg flex items-center justify-center text-[var(--dg-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-tint-2)] transition-colors"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="dg-scroll flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-1.5">
          {/*
            Chat-type filter, TripAdvisor-style (All / Itinerary / Comparison
            there; All / With plan here — DayGI chats either carry a plan
            canvas or they don't, and there is no comparison-chat concept to
            filter on). Resets to All every time the modal opens.
          */}
          {!loading && chats.length > 0 && (
            <div role="tablist" aria-label={t('daygi.chatHistory')} className="flex gap-1.5 pb-1">
              {(['all', 'plan'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={filter === tab}
                  onClick={() => setFilter(tab)}
                  className={`dg-focus px-3 h-7 rounded-full text-[11px] font-semibold transition-colors ${
                    filter === tab
                      ? 'bg-[var(--dg-teal)] text-[var(--dg-gold-ink)]'
                      : 'bg-[var(--dg-tint)] text-[var(--dg-text-2)] hover:text-[var(--dg-text)]'
                  }`}
                >
                  {tab === 'all' ? t('daygi.chatsAll') : t('daygi.chatsWithPlan')}
                </button>
              ))}
            </div>
          )}
          {loading && (
            <p className="text-xs text-[var(--dg-muted)] py-6 text-center">{t('daygi.loadingChats')}</p>
          )}
          {!loading && visibleChats.length === 0 && (
            <p className="text-xs text-[var(--dg-muted)] py-6 text-center">{t('daygi.noChatsYet')}</p>
          )}
          {!loading && visibleChats.map((chat) => (
            <div
              key={chat.chatId}
              className="group flex items-center gap-2 rounded-xl border border-[var(--dg-line)] bg-[var(--dg-tint)] hover:bg-[var(--dg-tint-2)] transition-colors"
            >
              <button
                type="button"
                onClick={() => onResume(chat.chatId)}
                className="dg-focus flex-1 min-w-0 text-start px-3 py-2.5"
                aria-label={chat.title}
              >
                <p className="text-xs font-semibold text-[var(--dg-text)] truncate">{chat.title}</p>
                <p className="text-[10px] text-[var(--dg-muted)] mt-0.5">
                  <span className="dg-num">{t('daygi.messagesCount', { count: chat.messageCount })}</span>
                  {' · '}
                  {formatChatDate(chat.updatedAt, lang)}
                </p>
              </button>
              <button
                type="button"
                onClick={() => onDelete(chat.chatId)}
                aria-label={`${t('daygi.deleteChat')}: ${chat.title}`}
                className="dg-focus me-2 w-7 h-7 rounded-lg flex items-center justify-center text-[var(--dg-muted)] hover:text-[var(--dg-text)] hover:bg-[var(--dg-panel)] transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
