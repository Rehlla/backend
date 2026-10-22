import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { cmsFetch } from './api';
import type { Revision } from './types';
import { CmsDiffViewer } from '../CmsDiffViewer';

export function RevisionsTab() {
  const { language, t } = useLanguage();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [diffEntity, setDiffEntity] = useState<{ entityId: string; entityType: string } | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackMessage, setRollbackMessage] = useState<string | null>(null);

  const loadRevisions = useCallback(() => {
    cmsFetch('/revisions?limit=100').then(d => {
      setRevisions(d.revisions || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadRevisions(); }, [loadRevisions]);

  const handleRollback = async (rev: Revision) => {
    if (!confirm(t('cmd.areYouSure'))) return;
    setRollingBack(rev.id);
    setRollbackMessage(null);
    try {
      await cmsFetch(`/pages/${rev.entity_id}/rollback`, {
        method: 'POST',
        body: JSON.stringify({ revisionId: rev.id }),
      });
      setRollbackMessage(t('cmd.rollbackDone', 'Page restored to this revision.'));
      loadRevisions();
    } catch (err: any) {
      setRollbackMessage(err?.message || 'Rollback failed');
    } finally {
      setRollingBack(null);
    }
  };

  const filtered = filter === 'all' ? revisions : revisions.filter(r => r.entity_type === filter);

  const actionColors: Record<string, string> = {
    create: 'bg-green-500/20 text-green-300',
    update: 'bg-blue-500/20 text-blue-300',
    publish: 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]',
    archive: 'bg-gray-500/20 text-gray-300',
    delete: 'bg-red-500/20 text-red-300',
    scheduled_publish: 'bg-purple-500/20 text-purple-300',
  };

  const entityLabels: Record<string, { en: string; ar: string }> = {
    page: { en: 'Page', ar: 'صفحة' },
    block: { en: 'Block', ar: 'كتلة' },
    media: { en: 'Media', ar: 'وسائط' },
    navigation: { en: 'Navigation', ar: 'تنقل' },
    seo: { en: 'SEO', ar: 'SEO' },
    homepage_section: { en: 'Homepage', ar: 'الرئيسية' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {t('cmd.changeHistory')}
        </h3>
        <span className="text-[11px] text-[var(--text-muted)]">{filtered.length} {t('cmd.entries')}</span>
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {[{ key: 'all', label: 'All' }, { key: 'page', label: 'Pages' }, { key: 'block', label: 'Blocks' }, { key: 'media', label: 'Media' }, { key: 'navigation', label: 'Navigation' }, { key: 'homepage_section', label: 'Homepage' }].map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
              filter === f.key
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--btn-util-bg)]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {rollbackMessage && (
        <div className="px-3 py-2 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[11px] font-bold text-[var(--accent-primary)]">
          {rollbackMessage}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          {t('cmd.noRevisionHistory')}
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map(rev => (
            <div key={rev.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${actionColors[rev.action] || 'bg-[var(--btn-util-bg)] text-[var(--text-muted)]'}`}>
                {rev.action}
              </span>
              <span className="text-[var(--text-muted)]">
                {entityLabels[rev.entity_type]?.[language === 'ar' ? 'ar' : 'en'] || rev.entity_type}
              </span>
              <span className="text-[var(--text-muted)] truncate flex-1">{rev.entity_id}</span>
              <span className="text-[var(--text-muted)] text-[11px]">
                {rev.actor_name || rev.actor_id || 'System'}
              </span>
              <span className="text-[var(--text-muted)] text-[11px]">
                {new Date(rev.created_at).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => setDiffEntity({ entityId: rev.entity_id, entityType: rev.entity_type })}
                className="px-2 py-1 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/10 text-[10px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                {t('cmd.compare')}
              </button>
              {rev.entity_type === 'page' && (rev.action === 'create' || rev.action === 'update') && (
                <button
                  type="button"
                  onClick={() => handleRollback(rev)}
                  disabled={rollingBack === rev.id}
                  title={t('cmd.restoreThisVersion', 'Restore the page to this revision')}
                  className="px-2 py-1 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-amber-300 hover:bg-amber-500/10 text-[10px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
                >
                  {rollingBack === rev.id ? '…' : t('cmd.restore', 'Restore')}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {diffEntity && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setDiffEntity(null)}>
          <div
            className="w-full max-w-3xl max-h-[80vh] overflow-y-auto rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] shadow-2xl p-4"
            onClick={e => e.stopPropagation()}
          >
            <CmsDiffViewer
              entityId={diffEntity.entityId}
              entityType={diffEntity.entityType}
              onClose={() => setDiffEntity(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
