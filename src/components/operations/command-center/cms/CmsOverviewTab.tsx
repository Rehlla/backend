import React, { useState, useEffect } from 'react';
import {
  FileText, Image, Layout, CheckCircle2, Clock, AlertCircle,
  ChevronRight, Link as LinkIcon, Package, Type
} from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { cmsFetch } from './api';
import type { CmsTab, CmsPage } from './types';

export function OverviewTab({ onNavigate }: { onNavigate: (tab: CmsTab) => void }) {
  const { t } = useLanguage();
  const [stats, setStats] = useState({ pages: 0, published: 0, draft: 0, media: 0, revisions: 0 });

  useEffect(() => {
    Promise.all([
      cmsFetch('/pages'),
      cmsFetch('/media'),
      cmsFetch('/revisions?limit=1'),
    ]).then(([pagesData, mediaData, revData]) => {
      const pages = pagesData.pages || [];
      setStats({
        pages: pages.length,
        published: pages.filter((p: CmsPage) => p.status === 'published').length,
        draft: pages.filter((p: CmsPage) => p.status === 'draft').length,
        media: (mediaData.media || []).length,
        revisions: revData.count || 0,
      });
    }).catch(() => {});
  }, []);

  const cards = [
    { label: t('cmd.totalPages'), value: stats.pages, icon: FileText, color: '#20A89A' },
    { label: t('cmd.published'), value: stats.published, icon: CheckCircle2, color: '#22C55E' },
    { label: t('cmd.drafts'), value: stats.draft, icon: Clock, color: '#F59E0B' },
    { label: t('cmd.media'), value: stats.media, icon: Image, color: '#8B5CF6' },
  ];

  const [freshness, setFreshness] = useState<{ stalePages: number; recentlyUpdated: number; unusedMedia: number }>({ stalePages: 0, recentlyUpdated: 0, unusedMedia: 0 });

  useEffect(() => {
    Promise.all([
      cmsFetch('/pages'),
      cmsFetch('/media'),
    ]).then(([pagesData, mediaData]) => {
      const now = Date.now();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      const pages = pagesData.pages || [];
      const media = mediaData.media || [];
      setFreshness({
        stalePages: pages.filter((p: CmsPage) => p.status === 'published' && (now - new Date(p.updated_at).getTime()) > thirtyDays).length,
        recentlyUpdated: pages.filter((p: CmsPage) => (now - new Date(p.updated_at).getTime()) < sevenDays).length,
        unusedMedia: media.filter((m: any) => (m.usage_count || 0) === 0).length,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="p-4 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color: card.color }} />
                <span className="text-xs text-[var(--text-muted)]">{card.label}</span>
              </div>
              <div className="text-2xl font-bold text-white">{card.value}</div>
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] space-y-3">
        <h3 className="text-xs font-bold text-white">
          {t('cmd.contentAnalytics')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <div>
              <div className="text-[11px] text-amber-400/60 font-bold">{t('cmd.staleContent30Days')}</div>
              <div className="text-sm font-bold text-amber-300">{freshness.stalePages}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            <div>
              <div className="text-[11px] text-green-400/60 font-bold">{t('cmd.recentlyUpdated7Days')}</div>
              <div className="text-sm font-bold text-green-300">{freshness.recentlyUpdated}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-red-400" />
            <div>
              <div className="text-[11px] text-red-400/60 font-bold">{t('cmd.unusedMedia')}</div>
              <div className="text-sm font-bold text-red-300">{freshness.unusedMedia}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] space-y-4">
        <h3 className="text-sm font-bold text-white">
          {t('cmd.quickAccess')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { tab: 'homepage' as CmsTab, label: t('cmd.homepageContent'), icon: Layout },
            { tab: 'pages' as CmsTab, label: t('cmd.managePages'), icon: FileText },
            { tab: 'catalog' as CmsTab, label: t('cmd.catalogContent'), icon: Package },
            { tab: 'strings' as CmsTab, label: t('cmd.stringsContent'), icon: Type },
            { tab: 'media' as CmsTab, label: t('cmd.mediaLibrary'), icon: Image },
            { tab: 'navigation' as CmsTab, label: t('cmd.navigation'), icon: LinkIcon },
          ].map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => onNavigate(item.tab)}
                className="flex items-center gap-3 p-3 rounded-xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs font-semibold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                <Icon className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{item.label}</span>
                <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
