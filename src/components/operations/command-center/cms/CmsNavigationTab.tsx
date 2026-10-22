import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit3, Trash2, Eye, EyeOff, ChevronUp, ChevronDown,
  GripVertical, Link as LinkIcon
} from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { cmsFetch } from './api';
import type { NavItem } from './types';
import { NavAddForm } from './CmsNavAddForm';

export function NavigationTab() {
  const { language, t } = useLanguage();
  const [items, setItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuKey, setMenuKey] = useState('footer');
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState<NavItem | null>(null);
  const [editForm, setEditForm] = useState<Partial<NavItem>>({});
  const [saving, setSaving] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const loadItems = useCallback(async () => {
    try {
      setLoading(true);
      const data = await cmsFetch(`/navigation/${menuKey}`);
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load navigation:', err);
    } finally {
      setLoading(false);
    }
  }, [menuKey]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleAdd = async (data: Partial<NavItem>) => {
    try {
      setSaving(true);
      const result = await cmsFetch('/navigation', {
        method: 'POST',
        body: JSON.stringify({ ...data, menu_key: menuKey, item_order: items.length }),
      });
      setItems(prev => [...prev, result.item]);
      setShowAdd(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (id: string, data: Partial<NavItem>) => {
    try {
      setSaving(true);
      const result = await cmsFetch(`/navigation/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setItems(prev => prev.map(i => i.id === id ? result.item : i));
      setEditItem(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('cmd.areYouSure'))) return;
    try {
      await cmsFetch(`/navigation/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const persistNavOrder = async (newItems: NavItem[]) => {
    try {
      for (const item of newItems) {
        await cmsFetch(`/navigation/${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ item_order: item.item_order }),
        });
      }
    } catch (err: any) {
      console.error('Reorder failed:', err);
    }
  };

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= items.length) return;

    const newItems = [...items];
    [newItems[idx], newItems[newIdx]] = [newItems[newIdx], newItems[idx]];
    for (let i = 0; i < newItems.length; i++) {
      newItems[i] = { ...newItems[i], item_order: i };
    }
    setItems(newItems);
    persistNavOrder(newItems);
  };

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) return;
    const newItems = [...items];
    const [moved] = newItems.splice(dragIdx, 1);
    newItems.splice(idx, 0, moved);
    for (let i = 0; i < newItems.length; i++) {
      newItems[i] = { ...newItems[i], item_order: i };
    }
    setItems(newItems);
    setDragIdx(null);
    setDragOverIdx(null);
    persistNavOrder(newItems);
  };
  const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };

  const menuOptions = [
    { key: 'footer', label: t('cmd.footer') },
    { key: 'header', label: t('cmd.header') },
    { key: 'mobile', label: t('cmd.mobile') },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {t('cmd.navigationManagement')}
        </h3>
        <button
          type="button"
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          {t('cmd.addItem')}
        </button>
      </div>

      <div className="flex gap-1">
        {menuOptions.map(opt => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setMenuKey(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
              menuKey === opt.key
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {showAdd && (
        <NavAddForm
          onSave={handleAdd}
          onCancel={() => setShowAdd(false)}
          saving={saving}
          menuLabel={menuOptions.find(o => o.key === menuKey)?.label || menuKey}
        />
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          {t('cmd.noNavigationItemsIn')}
        </div>
      ) : (
        <div className="space-y-1">
          {items.map((item, idx) => (
            <div
              key={item.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDrop={() => handleDrop(idx)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl bg-[var(--btn-util-bg)] border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                dragIdx === idx
                  ? 'opacity-50 border-[var(--accent-primary)]/50'
                  : dragOverIdx === idx
                    ? 'border-[var(--accent-primary)]/50 bg-[var(--accent-primary)]/5'
                    : 'border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0 cursor-grab" />
                <LinkIcon className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white">
                    {language === 'ar' ? item.label_ar : item.label_en}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    {item.route || item.external_url || '(no route)'}
                    {item.visible ? '' : ` · ${t('cmd.hidden-2')}`}
                  </div>
                </div>

                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {idx > 0 && (
                    <button type="button" onClick={() => handleReorder(item.id, 'up')} aria-label="Move item up" className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                  )}
                  {idx < items.length - 1 && (
                    <button type="button" onClick={() => handleReorder(item.id, 'down')} aria-label="Move item down" className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleUpdate(item.id, { visible: item.visible ? 0 : 1 })}
                    aria-label={item.visible ? 'Hide item' : 'Show item'}
                    className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"
                  >
                    {item.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditItem(item); setEditForm(item); }}
                    aria-label="Edit item"
                    className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    aria-label="Delete item"
                    className="p-1 rounded hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {editItem?.id === item.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Label (EN)</span>
                      <input
                        type="text"
                        value={editForm.label_en || ''}
                        onChange={e => setEditForm({ ...editForm, label_en: e.target.value })}
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Label (AR)</span>
                      <input
                        type="text"
                        value={editForm.label_ar || ''}
                        onChange={e => setEditForm({ ...editForm, label_ar: e.target.value })}
                        dir="rtl"
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Internal Route</span>
                      <input
                        type="text"
                        value={editForm.route || ''}
                        onChange={e => setEditForm({ ...editForm, route: e.target.value })}
                        placeholder="/explore"
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">External URL</span>
                      <input
                        type="url"
                        value={editForm.external_url || ''}
                        onChange={e => setEditForm({ ...editForm, external_url: e.target.value })}
                        placeholder="https://..."
                        className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdate(item.id, editForm)}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold hover:bg-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
                    >
                      {saving ? '...' : (t('cmd.save'))}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditItem(null)}
                      className="px-4 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-xs font-bold hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
                    >
                      {t('intel.cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
