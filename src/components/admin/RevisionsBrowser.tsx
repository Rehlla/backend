import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { DahabEmptyState } from '../common/DahabEmptyState';
import { ClickableCard } from '../common/ClickableCard';
import { api } from '../../services/api';
import type { CmsRevision } from '../../services/api';

interface RevisionsBrowserProps {
  entityType?: string;
  entityId?: string;
  onBack?: () => void;
}

export const RevisionsBrowser: React.FC<RevisionsBrowserProps> = ({ entityType, entityId, onBack }) => {
  const { t, language } = useLanguage();
  const { showToast } = useUI();
  const [revisions, setRevisions] = useState<CmsRevision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(50);

  const loadRevisions = useCallback(async () => {
    setLoading(true);
    try {
      const json = await api.listCmsRevisions(entityType, entityId, limit);
      setRevisions(json.revisions || []);
      setError(null);
    } catch (err: any) {
      setError(err?.message || t('cms.revisionsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, limit, t]);

  useEffect(() => { loadRevisions(); }, [loadRevisions]);

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return language === 'ar'
        ? d.toLocaleString('ar-EG', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : d.toLocaleString('en-US', { month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      create: { en: 'Created', ar: 'تم الإنشاء' },
      update: { en: 'Updated', ar: 'تم التحديث' },
      publish: { en: 'Published', ar: 'تم النشر' },
      archive: { en: 'Archived', ar: 'تم الأرشفة' },
      delete: { en: 'Deleted', ar: 'تم الحذف' },
      rollback: { en: 'Rolled back', ar: 'تم الاسترجاع' },
      schedule: { en: 'Scheduled', ar: 'مجدول' },
      upsert: { en: 'Saved', ar: 'تم الحفظ' },
    };
    return labels[action]?.[language === 'ar' ? 'ar' : 'en'] || action;
  };

  const getTypeLabel = (entityType: string) => {
    const labels: Record<string, { en: string; ar: string }> = {
      page: { en: 'Page', ar: 'صفحة' },
      block: { en: 'Block', ar: 'كتلة' },
      homepage: { en: 'Homepage', ar: 'الصفحة الرئيسية' },
      navigation: { en: 'Navigation', ar: 'التنقل' },
      seo: { en: 'SEO', ar: 'SEO' },
      site_string: { en: 'Site String', ar: 'نص الموقع' },
      theme: { en: 'Theme', ar: 'المظهر' },
      binding: { en: 'Binding', ar: 'ربط' },
    };
    return labels[entityType]?.[language === 'ar' ? 'ar' : 'en'] || entityType;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
        <div>
          <h1 className="text-lg font-extrabold text-[var(--text-primary)]">{t('cms.revisionsTitle')}</h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {entityType && entityId
              ? `${t('cms.revisionsFor')} ${getTypeLabel(entityType)} / ${entityId}`
              : t('cms.revisionsAll')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] cursor-pointer">
            {t('cms.limit')}:
            <input
              type="number"
              value={limit}
              onChange={e => setLimit(Math.min(100, Math.max(10, parseInt(e.target.value) || 50)))}
              className="w-16 px-2 py-1 rounded bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs text-center focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </label>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-2.5 py-1.5 rounded-lg bg-[var(--surface-card)] border border-[var(--border-subtle)] text-xs font-bold cursor-pointer hover:bg-[var(--surface-container)] transition-colors"
            >
              {t('cms.back')}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {loading && (
          <div className="flex items-center justify-center h-40">
            <span className="w-5 h-5 rounded-full border-2 border-[var(--accent-primary)] border-t-transparent animate-spin" />
          </div>
        )}
        {error && !loading && (
          <DahabEmptyState title={error} iconName="alert-triangle" motifName="wave-divider" />
        )}
        {!loading && !error && revisions.length === 0 && (
          <DahabEmptyState
            title={t('cms.noRevisions')}
            description={t('cms.noRevisionsDesc')}
            iconName="history"
            motifName="topo-contour"
          />
        )}
        {!loading && !error && revisions.length > 0 && (
          <div className="divide-y divide-[var(--border-subtle)]">
            {revisions.map(rev => {
              let payloadPreview: string | null = null;
              try {
                payloadPreview = rev.payload ? JSON.stringify(JSON.parse(typeof rev.payload === 'string' ? rev.payload : JSON.stringify(rev.payload)), null, 2).slice(0, 200) : null;
              } catch {
                payloadPreview = null;
              }
              return (
                <ClickableCard
                  key={rev.id}
                  className="w-full p-4 hover:bg-[var(--surface-container)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          rev.action === 'create' ? 'bg-emerald-100 text-emerald-700' :
                          rev.action === 'publish' ? 'bg-blue-100 text-blue-700' :
                          rev.action === 'archive' ? 'bg-slate-100 text-slate-600' :
                          rev.action === 'delete' ? 'bg-red-100 text-red-700' :
                          'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                        }`}>
                          {getActionLabel(rev.action)}
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--surface-card)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                          {getTypeLabel(rev.entity_type)}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--surface-card)] px-1.5 py-0.5 rounded border border-[var(--border-subtle)]">
                          {rev.entity_id}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {language === 'ar' ? `بواسطة: ${rev.actor_name}` : `by ${rev.actor_name}`}
                        {rev.actor_id && (
                          <span className="text-[var(--text-muted)]"> · {rev.actor_id}</span>
                        )}
                      </p>
                      {payloadPreview && (
                        <pre className="mt-2 text-[10px] text-[var(--text-muted)] bg-[var(--surface-card)] rounded-lg p-2 overflow-x-auto border border-[var(--border-subtle)] max-h-20 overflow-y-auto">
                          {payloadPreview}
                        </pre>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] font-mono text-[var(--text-muted)]">{formatDateTime(rev.created_at)}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">#{rev.id.slice(0, 8)}</p>
                    </div>
                  </div>
                </ClickableCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
