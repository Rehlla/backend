import React, { useCallback, useEffect, useState } from 'react';
import { Building2, ExternalLink, Plus, Trash2, RefreshCw, Search } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader } from './ui/SectionHeader';
import type { AccommodationEntity, PropertySourceEntity } from '../../../shared/types/commerce';

const SOURCE_TYPES: PropertySourceEntity['sourceType'][] = ['WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'BOOKING_COM', 'AIRBNB', 'OTHER'];

/**
 * Admin CRUD for accommodation external reference links (WhatsApp/Instagram/
 * website/Booking.com/Airbnb) — the data behind the "Also listed on" section
 * on the public accommodation detail page. Purely informational: this UI
 * never claims price comparison, and the form doesn't offer a "price" field
 * for a source link on purpose.
 */
export default function AccommodationsAdmin() {
  const { t } = useLanguage();
  const [accommodations, setAccommodations] = useState<AccommodationEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sources, setSources] = useState<PropertySourceEntity[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [newSourceType, setNewSourceType] = useState<PropertySourceEntity['sourceType']>('WHATSAPP');
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);

  const loadAccommodations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminListAccommodations(q ? { q } : undefined);
      setAccommodations(data.accommodations);
    } catch (e: any) {
      setError(e?.message || 'Failed to load accommodations.');
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => { loadAccommodations(); }, [loadAccommodations]);

  const loadSources = useCallback(async (accommodationId: string) => {
    setSourcesLoading(true);
    try {
      const data = await api.adminListPropertySources(accommodationId);
      setSources(data.sources);
    } catch (e: any) {
      setError(e?.message || 'Failed to load source links.');
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) loadSources(selectedId);
    else setSources([]);
  }, [selectedId, loadSources]);

  const selected = accommodations.find(a => a.id === selectedId) || null;

  const handleToggleActive = async (a: AccommodationEntity) => {
    try {
      const { accommodation } = await api.adminSetAccommodationActive(a.id, !a.active);
      setAccommodations(prev => prev.map(x => (x.id === a.id ? accommodation : x)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update.');
    }
  };

  const handleAddSource = async () => {
    if (!selectedId || !newUrl.trim()) return;
    if (newSourceType === 'OTHER' && !newLabel.trim()) {
      setError('A label is required for "Other" links.');
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await api.adminAddPropertySource(selectedId, {
        sourceType: newSourceType,
        url: newUrl.trim(),
        label: newLabel.trim() || undefined
      });
      setNewUrl('');
      setNewLabel('');
      await loadSources(selectedId);
    } catch (e: any) {
      setError(e?.message || 'Failed to add source link.');
    } finally {
      setAdding(false);
    }
  };

  const handleToggleSourceActive = async (s: PropertySourceEntity) => {
    if (!selectedId) return;
    try {
      await api.adminUpdatePropertySource(selectedId, s.id, { active: !s.active });
      await loadSources(selectedId);
    } catch (e: any) {
      setError(e?.message || 'Failed to update source link.');
    }
  };

  const handleDeleteSource = async (s: PropertySourceEntity) => {
    if (!selectedId) return;
    try {
      await api.adminDeletePropertySource(selectedId, s.id);
      setSources(prev => prev.filter(x => x.id !== s.id));
    } catch (e: any) {
      setError(e?.message || 'Failed to remove source link.');
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Building2}
        title={t('cmd.accommodations.title', 'Accommodations')}
        actions={
          <button type="button" onClick={() => loadAccommodations()}
            className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        }
      />

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 text-rose-400 text-xs">{error}</div>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
        <input
          type="search"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('cmd.accommodations.search', 'Search by name…')}
          className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
        {/* Accommodation list */}
        <div className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] max-h-[520px] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">{t('cmd.loading', 'Loading…')}</div>
          ) : accommodations.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">No accommodations found.</div>
          ) : (
            accommodations.map(a => (
              <button
                key={a.id}
                type="button"
                onClick={() => setSelectedId(a.id)}
                className={`w-full text-left px-4 py-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                  selectedId === a.id ? 'bg-[var(--accent-primary)]/10' : 'hover:bg-[var(--btn-util-bg)]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[var(--text-primary)] truncate">{a.name}</div>
                  <div className="text-[10.5px] text-[var(--text-muted)] mt-0.5">{a.propertyType} · {a.areaName}</div>
                </div>
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); handleToggleActive(a); }}
                  className={`shrink-0 w-9 h-5 rounded-full relative cursor-pointer p-0.5 ${a.active ? 'bg-[var(--accent-primary)]' : 'bg-[var(--btn-util-bg)]'}`}
                  title={a.active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                >
                  <span className={`block w-4 h-4 rounded-full bg-[var(--surface-card)] transition-transform ${a.active ? 'translate-x-4' : 'translate-x-0'}`} />
                </span>
              </button>
            ))
          )}
        </div>

        {/* Source links panel */}
        <div className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-4">
          {!selected ? (
            <div className="py-12 text-center text-sm text-[var(--text-muted)]">
              {t('cmd.accommodations.selectHint', 'Select an accommodation to manage its external reference links.')}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)]">{selected.name}</div>
                <div className="text-[10.5px] text-[var(--text-muted)]">{selected.slug}</div>
              </div>

              <div className="space-y-2">
                {sourcesLoading ? (
                  <div className="text-xs text-[var(--text-muted)]">{t('cmd.loading', 'Loading…')}</div>
                ) : sources.length === 0 ? (
                  <div className="text-xs text-[var(--text-muted)]">No external links yet.</div>
                ) : (
                  sources.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[var(--btn-util-bg)]">
                      <div className="min-w-0 flex items-center gap-2">
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-[var(--text-primary)]">{s.sourceType}{s.label ? ` — ${s.label}` : ''}</div>
                          <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10.5px] text-[var(--accent-primary)] truncate block max-w-[220px]">{s.url}</a>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggleSourceActive(s)}
                          className={`w-8 h-4.5 rounded-full relative cursor-pointer p-0.5 ${s.active ? 'bg-[var(--accent-primary)]' : 'bg-[var(--surface-card)]'}`}
                          title={s.active ? 'Active — click to hide' : 'Hidden — click to show'}
                        >
                          <span className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${s.active ? 'translate-x-3.5' : 'translate-x-0'}`} />
                        </button>
                        <button type="button" onClick={() => handleDeleteSource(s)} className="text-rose-400 hover:text-rose-300 cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add new source */}
              <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                <div className="text-[11px] font-bold text-[var(--text-muted)]">{t('cmd.accommodations.addLink', 'Add a reference link')}</div>
                <div className="flex gap-2">
                  <select
                    value={newSourceType}
                    onChange={e => setNewSourceType(e.target.value as PropertySourceEntity['sourceType'])}
                    className="px-2 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] cursor-pointer focus:outline-none"
                  >
                    {SOURCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input
                    type="text"
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    placeholder={newSourceType === 'WHATSAPP' ? 'https://wa.me/201...' : 'https://…'}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] focus:outline-none"
                  />
                </div>
                {newSourceType === 'OTHER' && (
                  <input
                    type="text"
                    value={newLabel}
                    onChange={e => setNewLabel(e.target.value)}
                    placeholder="Label (required for Other)"
                    className="w-full px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] focus:outline-none"
                  />
                )}
                <button
                  type="button"
                  onClick={handleAddSource}
                  disabled={adding || !newUrl.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-container)] text-[11px] font-bold cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('cmd.accommodations.add', 'Add')}
                </button>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
                  Informational only — never sync a price here. The public page copy is fixed to "Also listed on / Contact via", never a price comparison.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
