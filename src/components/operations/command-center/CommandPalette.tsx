import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Plane, Users, MessageSquare, DollarSign, Globe, X, ArrowRight, FileText, Flag, HeartPulse, AlertTriangle, Brain, Clock, Star } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { SectionId } from './CommandCenterShell';
import { NAV_SECTIONS } from './CommandCenterShell';

interface SearchResult {
  id: string;
  type: 'trip' | 'supplier' | 'support' | 'section' | 'ledger';
  title: string;
  subtitle?: string;
  section?: SectionId;
  group?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: SectionId) => void;
}

const RECENT_KEY = 'dahab-palette-recent';
const MAX_RECENT = 5;

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function addRecent(sectionId: string) {
  const recent = getRecent().filter(r => r !== sectionId);
  recent.unshift(sectionId);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

export default function CommandPalette({ isOpen, onClose, onNavigate }: Props) {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Section items built with i18n + grouping
  const sectionItems: SearchResult[] = useMemo(() => {
    const groups: Record<string, string> = { core: 'Live Ops', domain: 'Domains', system: 'System' };
    return NAV_SECTIONS.map(s => ({
      id: `sec-${s.id}`, type: 'section' as const,
      title: language === 'ar' ? s.labelAr : s.label,
      section: s.id, group: groups[s.group] || s.group,
    }));
  }, [language]);

  // Recent items
  const recentItems = useMemo(() => {
    const recentIds = getRecent();
    return recentIds
      .map(id => sectionItems.find(s => s.section === id))
      .filter(Boolean)
      .map(s => ({ ...s!, id: `recent-${s!.section}` }));
  }, [sectionItems]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setQuery('');
      setResults(sectionItems);
      setSelectedIndex(0);
    }
  }, [isOpen, sectionItems]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(sectionItems);
      return;
    }

    setLoading(true);
    const lower = q.toLowerCase();
    const matched: SearchResult[] = [];

    // Section matches
    sectionItems.forEach(item => {
      if (item.title.toLowerCase().includes(lower)) {
        matched.push(item);
      }
    });

    // Search backend
    try {
      const [suppliersData, supportData] = await Promise.allSettled([
        api.getSuppliers(),
        api.getSupportMessages(),
      ]);

      if (suppliersData.status === 'fulfilled') {
        (suppliersData.value as any)?.suppliers?.forEach((s: any) => {
          if (s.businessName?.toLowerCase().includes(lower) || s.id?.toLowerCase().includes(lower)) {
            matched.push({ id: s.id, type: 'supplier', title: s.businessName, subtitle: `${s.category} · ${s.id}` });
          }
        });
      }

      if (supportData.status === 'fulfilled') {
        (supportData.value as any)?.messages?.forEach((m: any) => {
          if (m.id?.toLowerCase().includes(lower) || m.message?.toLowerCase().includes(lower) || m.travelerName?.toLowerCase().includes(lower)) {
            matched.push({ id: m.id, type: 'support', title: `Support: ${m.travelerName || m.id}`, subtitle: m.message?.substring(0, 60) });
          }
        });
      }
    } catch { /* search is best-effort */ }

    setResults(matched.length > 0 ? matched : [{ id: 'no-results', type: 'section', title: t('cmd.palette.noResults'), section: 'overview' }]);
    setSelectedIndex(0);
    setLoading(false);
  }, [sectionItems, t]);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 150);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (result: SearchResult) => {
    if (result.section) {
      addRecent(result.section);
      onNavigate(result.section);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  if (!isOpen) return null;

  const TYPE_ICONS: Record<string, React.ElementType> = {
    trip: Plane, supplier: Users, support: MessageSquare, section: ArrowRight, ledger: DollarSign,
  };

  const TYPE_COLORS: Record<string, string> = {
    section: 'text-[var(--accent-primary)]',
    supplier: 'text-emerald-400',
    support: 'text-amber-400',
    trip: 'text-sky-400',
  };

  // Group results by group
  const grouped = useMemo(() => {
    const map = new Map<string, SearchResult[]>();
    results.forEach(r => {
      const group = r.group || r.type || 'other';
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(r);
    });
    return map;
  }, [results]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] sm:pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 bg-[var(--surface-container)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[var(--border-subtle)]">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={t('cmd.palette.search')}
            placeholder={t('cmd.palette.search')}
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)]/50 focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); setResults(sectionItems); }}
              className="p-1 rounded-md hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--btn-util-bg)] text-[var(--text-muted)] font-mono border border-[var(--border-subtle)]">ESC</kbd>
        </div>

        {/* Recent searches (when no query) */}
        {!query && recentItems.length > 0 && (
          <div className="px-3 pt-2 pb-1">
            <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              <Clock className="w-3 h-3" />Recent
            </div>
            {recentItems.map(item => {
              const Icon = TYPE_ICONS[item.type] || ArrowRight;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="w-full px-3 py-2 flex items-center gap-2.5 rounded-lg text-left hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer"
                >
                  <Icon className="w-3.5 h-3.5 text-[var(--text-muted)]/60" />
                  <span className="text-xs text-[var(--text-muted)]">{item.title}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {loading ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)]">
              <span className="inline-block w-4 h-4 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mr-2" />
              Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="py-6 text-center text-xs text-[var(--text-muted)]">{t('cmd.palette.noResults')}</div>
          ) : (
            Array.from(grouped.entries()).map(([group, items]) => (
              <div key={group}>
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-[var(--text-muted)]/60 uppercase tracking-wider">
                  {group}
                </div>
                {items.map(result => {
                  const globalIndex = results.indexOf(result);
                  const Icon = TYPE_ICONS[result.type] || ArrowRight;
                  const colorClass = TYPE_COLORS[result.type] || 'text-[var(--text-muted)]';
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => handleSelect(result)}
                      className={`w-full px-4 py-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer ${
                        globalIndex === selectedIndex ? 'bg-[var(--accent-primary)]/12' : 'hover:bg-[var(--btn-util-bg)]'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        globalIndex === selectedIndex ? 'bg-[var(--accent-primary)]/20' : 'bg-[var(--btn-util-bg)]'
                      }`}>
                        <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">{result.title}</div>
                        {result.subtitle && <div className="text-[11px] text-[var(--text-muted)] truncate">{result.subtitle}</div>}
                      </div>
                      {result.section && (
                        <span className="text-[10px] text-[var(--text-muted)] font-mono flex-shrink-0">↵</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[var(--border-subtle)] flex items-center gap-4 text-[10px] text-[var(--text-muted)]/60">
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-[var(--btn-util-bg)] font-mono">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-[var(--btn-util-bg)] font-mono">↵</kbd> select</span>
          <span className="flex items-center gap-1"><kbd className="px-1 py-0.5 rounded bg-[var(--btn-util-bg)] font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
