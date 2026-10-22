import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Utensils } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogEnvelope, CatalogScope, CatalogTypeSchema } from '../../../../types/catalog';
import { EmptyState } from '../ui';
import { NoticeBar, buttonClass, primaryButtonClass, useMutationRunner, useReasonPrompt } from '../control/controlShared';
import { ChildFormDrawer } from './ChildListPanel';
import { allFields, bodyFromValues, getValue, isPriceJump, pickText, priceFieldKey, type FormValues } from './catalogShared';

/**
 * A restaurant's menu, grouped by section, with an inline price edit and an
 * "available" toggle per item. Field keys come from the menu item schema: the
 * price is its money field, availability its boolean `available*` field and
 * the grouping its `section` / `category` field.
 */

export interface MenuEditorProps {
  scope: CatalogScope;
  venueId: string;
  childKey: string;
  itemSchema: CatalogTypeSchema;
  items: CatalogEnvelope[];
  onItemsChange: (items: CatalogEnvelope[]) => void;
}

export function MenuEditor({ scope, venueId, childKey, itemSchema, items, onItemsChange }: MenuEditorProps) {
  const { t, language } = useLanguage();
  const { run, busy, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const [editing, setEditing] = useState<CatalogEnvelope | null>(null);
  const [creating, setCreating] = useState(false);
  const [draftPrices, setDraftPrices] = useState<Record<string, string>>({});

  const fields = allFields(itemSchema);
  const priceKey = priceFieldKey(itemSchema) ?? 'priceEGP';
  const availableKey = fields.find(f => f.kind === 'boolean' && /avail/i.test(f.key))?.key ?? 'available';
  const sectionField = fields.find(f => f.key === 'section' || f.key === 'category');
  const sectionKey = sectionField?.key ?? 'section';

  const groups = useMemo(() => {
    const m = new Map<string, CatalogEnvelope[]>();
    for (const item of items) {
      const raw = getValue(item, sectionKey);
      const key = typeof raw === 'string' && raw ? raw : '';
      const list = m.get(key) ?? [];
      list.push(item);
      m.set(key, list);
    }
    return [...m.entries()];
  }, [items, sectionKey]);

  const sectionLabel = (value: string) => {
    if (!value) return t('cat.menu.other');
    const opt = sectionField?.options?.find(o => o.value === value);
    return pickText(opt?.label, language) || value;
  };

  const patch = (item: CatalogEnvelope, values: FormValues, reason?: string) =>
    run(async () => {
      const updated = await api.catalogChildPatch(scope, 'restaurant', venueId, childKey, item.id, { ...bodyFromValues(values), ...(reason ? { reason } : {}) });
      onItemsChange(items.map(i => (i.id === item.id ? updated : i)));
    });

  const commitPrice = (item: CatalogEnvelope) => {
    const raw = draftPrices[item.id];
    if (raw === undefined) return;
    setDraftPrices(({ [item.id]: _drop, ...rest }) => rest);
    const n = Number(raw);
    const before = getValue(item, priceKey);
    if (!Number.isFinite(n) || n < 0 || n === before) return;
    if (isPriceJump(before, n)) {
      ask({
        title: t('cat.price.jumpTitle'),
        description: t('cat.price.jumpBody'),
        run: async reason => {
          const updated = await api.catalogChildPatch(scope, 'restaurant', venueId, childKey, item.id, { ...bodyFromValues({ [priceKey]: n }), reason });
          onItemsChange(items.map(i => (i.id === item.id ? updated : i)));
        },
      });
      return;
    }
    void patch(item, { [priceKey]: n });
  };

  const save = async (values: FormValues) => {
    const target = editing;
    return run(async () => {
      if (target) {
        const updated = await api.catalogChildPatch(scope, 'restaurant', venueId, childKey, target.id, bodyFromValues(values));
        onItemsChange(items.map(i => (i.id === target.id ? updated : i)));
      } else {
        const created = await api.catalogChildCreate(scope, 'restaurant', venueId, childKey, bodyFromValues(values));
        onItemsChange([...items, created]);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">{t('cat.child.count', { n: items.length })}</span>
        <button type="button" className={primaryButtonClass} onClick={() => { setEditing(null); setCreating(true); }}>
          <Plus className="w-3 h-3" /> {t('cat.menu.add')}
        </button>
      </div>
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      {items.length === 0 ? (
        <EmptyState icon={Utensils} title={t('cat.menu.empty')} />
      ) : (
        groups.map(([section, list]) => (
          <section key={section || '_'} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)]">
            <h4 className="px-4 py-2 border-b border-[var(--border-subtle)] text-xs font-bold text-[var(--text-primary)]">
              {sectionLabel(section)} <span className="text-[var(--text-muted)] font-normal">({list.length})</span>
            </h4>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {list.map(item => {
                const price = getValue(item, priceKey);
                const available = getValue(item, availableKey) !== false;
                return (
                  <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-2" data-testid="menu-item">
                    <span className={`flex-1 min-w-[10rem] text-xs font-bold ${available ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through'}`}>
                      {pickText(item.title, language) || item.id}
                    </span>
                    <label className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--btn-util-bg)] px-2 py-1">
                      <input
                        type="number"
                        min={0}
                        aria-label={t('cat.menu.price', { name: pickText(item.title, language) })}
                        className="w-20 bg-transparent text-xs tabular-nums text-[var(--text-primary)] outline-none"
                        value={draftPrices[item.id] ?? (typeof price === 'number' ? String(price) : '')}
                        onChange={e => setDraftPrices(p => ({ ...p, [item.id]: e.target.value }))}
                        onBlur={() => commitPrice(item)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      />
                      <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('cat.egp')}</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] cursor-pointer">
                      <input type="checkbox" role="switch" checked={available} disabled={busy} onChange={e => void patch(item, { [availableKey]: e.target.checked })} className="accent-[var(--accent-primary)]" />
                      {t('cat.menu.available')}
                    </label>
                    <button type="button" className={buttonClass} aria-label={t('ctl.action.edit')} onClick={() => { setCreating(false); setEditing(item); }}>
                      <Pencil className="w-3 h-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      <ChildFormDrawer
        open={creating || editing !== null}
        title={editing ? pickText(editing.title, language) || editing.id : t('cat.menu.add')}
        scope={scope}
        schema={itemSchema}
        initial={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={save}
      />
      {dialog}
    </div>
  );
}

export default MenuEditor;
