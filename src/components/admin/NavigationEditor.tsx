import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Menu, Plus, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { DahabEmptyState } from '../common/DahabEmptyState';
import { ClickableCard } from '../common/ClickableCard';
import { api } from '../../services/api';
import type { NavigationItemWire } from '../../services/api';

interface NavigationEditorProps {
  menuKey?: string;
  onBack?: () => void;
}

const DEFAULT_MENU_KEY = 'main';

export const NavigationEditor: React.FC<NavigationEditorProps> = ({ menuKey = DEFAULT_MENU_KEY, onBack }) => {
  const { t, language } = useLanguage();
  const { showToast } = useUI();
  const [items, setItems] = useState<NavigationItemWire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<NavigationItemWire>>({
    menu_key: menuKey,
    item_order: 0,
    label_en: '',
    label_ar: '',
    route: '',
    external_url: '',
    visible: 1,
    open_in_new: 0,
    group_label_en: '',
    group_label_ar: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.getCmsNavigationAdmin(menuKey);
      setItems(json.items || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('cms.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [menuKey, t]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const startCreate = () => {
    setForm({
      menu_key: menuKey,
      item_order: items.length,
      label_en: '',
      label_ar: '',
      route: '',
      external_url: '',
      visible: 1,
      open_in_new: 0,
      group_label_en: '',
      group_label_ar: '',
    });
    setEditingId('__new__');
  };

  const startEdit = (item: NavigationItemWire) => {
    setEditingId(item.id);
    setForm({
      id: item.id,
      menu_key: item.menu_key,
      item_order: item.item_order,
      label_en: item.label_en,
      label_ar: item.label_ar,
      route: item.route,
      external_url: item.external_url,
      visible: item.visible,
      open_in_new: item.open_in_new,
      group_label_en: item.group_label_en,
      group_label_ar: item.group_label_ar,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({
      menu_key: menuKey,
      item_order: items.length,
      label_en: '',
      label_ar: '',
      route: '',
      external_url: '',
      visible: 1,
      open_in_new: 0,
      group_label_en: '',
      group_label_ar: '',
    });
  };

  const handleSave = async () => {
    if (!form.label_en && !form.label_ar) {
      showToast(t('cms.labelRequired'));
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (form.id) {
        const json = await api.updateCmsNavigationItem(form.id, payload);
        setItems(prev => prev.map(i => i.id === form.id ? json.item : i));
        showToast(t('cms.navItemSaved'));
      } else {
        const json = await api.createCmsNavigationItem(payload);
        setItems(prev => [...prev, json.item]);
        showToast(t('cms.navItemCreated'));
      }
      cancelEdit();
    } catch (err: any) {
      showToast(err?.message || t('cms.navSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('cms.deleteNavConfirm'))) return;
    setSaving(true);
    try {
      await api.deleteCmsNavigationItem(id);
      setItems(prev => prev.filter(i => i.id !== id));
      showToast(t('cms.navItemDeleted'));
    } catch (err: any) {
      showToast(err?.message || t('cms.navDeleteFailed'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVisible = (id: string, current: number) => {
    api.updateCmsNavigationItem(id, { id, visible: current ? 0 : 1 }).then(() => loadItems());
  };

  const visibleItems = items.filter(i => i.visible === 1);
  const hiddenItems = items.filter(i => i.visible !== 1);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
        <div>
          <h1 className="text-lg font-extrabold text-[var(--text-primary)]">{t('cms.navTitle')}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {language === 'ar' ? `قائمة: ${menuKey}` : `Menu: ${menuKey}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110 transition-[filter]"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('cms.newNavItem')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <span className="w-5 h-5 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
          </div>
        )}
        {error && !loading && (
          <DahabEmptyState title={error} iconName="alert-triangle" motifName="wave-divider" />
        )}
        {!loading && !error && items.length === 0 && (
          <DahabEmptyState
            title={t('cms.noNavItems')}
            description={t('cms.noNavItemsDesc')}
            iconName="menu"
            motifName="reef-art"
            actionText={t('cms.addFirstNavItem')}
            onAction={startCreate}
          />
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-3">
            {/* Visible items */}
            {visibleItems.length > 0 && (
              <div>
                <h2 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  {language === 'ar' ? 'العناصر المرئية' : 'Visible Items'}
                </h2>
                <div className="space-y-2">
                  {visibleItems.map(item => (
                    <ClickableCard
                      key={item.id}
                      onClick={() => startEdit(item)}
                      className="w-full p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] hover:bg-[var(--surface-container)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.route && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                                {language === 'ar' ? 'داخلي' : 'Internal'}
                              </span>
                            )}
                            {item.external_url && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">
                                {language === 'ar' ? ' خارجي' : 'External'}
                              </span>
                            )}
                            {item.open_in_new === 1 && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                                {language === 'ar' ? ' taxicab جديدة' : ' new tab'}
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">
                            {language === 'ar' ? item.label_ar : item.label_en}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                            {item.route ? `/${item.route}` : item.external_url ? item.external_url : '—'}
                          </p>
                          {item.group_label_en && (
                            <p className="text-[10px] text-[var(--text-muted)] mt-1 italic">
                              {language === 'ar' ? `مجموعة: ${item.group_label_ar || item.group_label_en}` : `Group: ${item.group_label_en}`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleVisible(item.id, item.visible)}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                              item.visible
                                ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                            title={item.visible ? t('cms.hide') : t('cms.show')}
                          >
                            {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                            className="p-1 rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 transition-colors"
                            aria-label={t('cms.deleteNavItem')}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </ClickableCard>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden items */}
            {hiddenItems.length > 0 && (
              <div>
                <h2 className="text-xs font-extrabold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  {language === 'ar' ? 'العناصر المخفية' : 'Hidden Items'}
                </h2>
                <div className="space-y-2 opacity-60">
                  {hiddenItems.map(item => (
                    <ClickableCard
                      key={item.id}
                      onClick={() => startEdit(item)}
                      className="w-full p-3 rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-container)]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-bold text-[var(--text-secondary)] truncate">
                            {language === 'ar' ? item.label_ar : item.label_en}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                            {item.route ? `/${item.route}` : '—'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleVisible(item.id, item.visible)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        >
                          {t('cms.show')}
                        </button>
                      </div>
                    </ClickableCard>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Edit / Create form modal */}
        {editingId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={cancelEdit}>
            <div className="w-full max-w-xl rounded-2xl bg-[var(--surface-container)] p-5 shadow-lg" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-extrabold text-[var(--text-primary)]">
                  {editingId === '__new__' ? t('cms.newNavItem') : t('cms.editNavItem')}
                </h2>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="p-1 rounded hover:bg-[var(--surface-card)] text-[var(--text-muted)]"
                  aria-label={t('cms.cancel')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    {language === 'ar' ? 'العددية (EN)' : 'Label (English)'}
                  </label>
                  <input
                    type="text"
                    value={form.label_en || ''}
                    onChange={e => setForm(f => ({ ...f, label_en: e.target.value }))}
                    placeholder={t('cms.navLabelEnPlaceholder')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    {language === 'ar' ? 'العددية (عربي)' : 'Label (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={form.label_ar || ''}
                    onChange={e => setForm(f => ({ ...f, label_ar: e.target.value }))}
                    placeholder={t('cms.navLabelArPlaceholder')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      {language === 'ar' ? 'المسار الداخلي' : 'Internal Route'}
                    </label>
                    <input
                      type="text"
                      value={form.route || ''}
                      onChange={e => setForm(f => ({ ...f, route: e.target.value }))}
                      placeholder="experiences"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {language === 'ar' ? 'بدون斜杠' : 'Without leading slash'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      {language === 'ar' ? 'رابط خارجي' : 'External URL'}
                    </label>
                    <input
                      type="url"
                      value={form.external_url || ''}
                      onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))}
                      placeholder="https://..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.open_in_new === 1}
                      onChange={e => setForm(f => ({ ...f, open_in_new: e.target.checked ? 1 : 0 }))}
                      className="w-3.5 h-3.5 rounded border-[var(--border-subtle)] text-[var(--accent-primary)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">
                      {language === 'ar' ? 'فتح في تبويب جديد' : 'Open in new tab'}
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.visible === 1}
                      onChange={e => setForm(f => ({ ...f, visible: e.target.checked ? 1 : 0 }))}
                      className="w-3.5 h-3.5 rounded border-[var(--border-subtle)] text-[var(--accent-primary)]"
                    />
                    <span className="text-xs text-[var(--text-muted)]">{t('cms.visible')}</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      {language === 'ar' ? 'ترتيب' : 'Order'}
                    </label>
                    <input
                      type="number"
                      value={form.item_order || 0}
                      onChange={e => setForm(f => ({ ...f, item_order: parseInt(e.target.value) || 0 }))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      {language === 'ar' ? 'ر Killer مجموعة (EN)' : 'Group Label (English)'}
                    </label>
                    <input
                      type="text"
                      value={form.group_label_en || ''}
                      onChange={e => setForm(f => ({ ...f, group_label_en: e.target.value }))}
                      placeholder={t('cms.navGroupEnPlaceholder')}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    {language === 'ar' ? 'ر Killer مجموعة (عربي)' : 'Group Label (Arabic)'}
                  </label>
                  <input
                    type="text"
                    value={form.group_label_ar || ''}
                    onChange={e => setForm(f => ({ ...f, group_label_ar: e.target.value }))}
                    placeholder={t('cms.navGroupArPlaceholder')}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-sm focus:outline-none focus:border-[var(--accent-primary)] dir=rtl"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-3 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs font-bold cursor-pointer hover:bg-[var(--surface-container)]"
                  >
                    {t('cms.cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || (!form.label_en && !form.label_ar)}
                    className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold cursor-pointer hover:brightness-110 disabled:opacity-50 transition-colors"
                  >
                    {saving ? t('cms.saving') : t('cms.save')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
