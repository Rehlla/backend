import React, { useState } from 'react';
import { FileText, Image, Layout, Clock, Link as LinkIcon, Package, Type, Info, Palette } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { CmsPageEditor } from './CmsPageEditor';
import type { CmsTab } from './cms/types';
import { OverviewTab } from './cms/CmsOverviewTab';
import { PagesTab } from './cms/CmsPagesTab';
import { HomepageTab } from './cms/CmsHomepageTab';
import { MediaTab } from './cms/CmsMediaTab';
import { NavigationTab } from './cms/CmsNavigationTab';
import { RevisionsTab } from './cms/CmsRevisionsTab';
import { CatalogTab } from './cms/CmsCatalogTab';
import { StringsTab } from './cms/CmsStringsTab';
import { SiteInfoTab } from './cms/CmsSiteInfoTab';
import { ThemeTab } from './cms/CmsThemeTab';

export const CmsContentDashboard: React.FC = () => {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<CmsTab>(() => {
    const sub = typeof window !== 'undefined' ? window.location.hash.replace('#cms/', '') : '';
    const valid: CmsTab[] = ['overview', 'pages', 'media', 'homepage', 'navigation', 'revisions', 'catalog', 'strings', 'info', 'theme'];
    return valid.includes(sub as CmsTab) ? (sub as CmsTab) : 'overview';
  });
  const [editingPageId, setEditingPageId] = useState<string | null>(null);

  /**
   * Tabs grouped by responsibility so the row stays scannable as CMS tabs
   * grow. Groups are purely presentational — every key is still a first-class
   * CmsTab, and the #cms/<tab> deep link keeps working.
   */
  const groups: { labelKey: string; tabs: { key: CmsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
    {
      labelKey: 'cmd.groupContent',
      tabs: [
        { key: 'overview' as CmsTab, label: t('cmd.overview'), icon: Layout },
        { key: 'pages' as CmsTab, label: t('cmd.pages-3'), icon: FileText },
        { key: 'homepage' as CmsTab, label: t('cmd.homepage'), icon: Layout },
        { key: 'navigation' as CmsTab, label: t('cmd.navigation'), icon: LinkIcon },
        { key: 'revisions' as CmsTab, label: t('cmd.history'), icon: Clock },
      ],
    },
    {
      labelKey: 'cmd.groupCatalogData',
      tabs: [
        { key: 'catalog' as CmsTab, label: t('cmd.catalogContent'), icon: Package },
        { key: 'strings' as CmsTab, label: t('cmd.stringsContent'), icon: Type },
      ],
    },
    {
      labelKey: 'cmd.groupSiteMedia',
      tabs: [
        { key: 'info' as CmsTab, label: t('cmd.siteInfo'), icon: Info },
        { key: 'theme' as CmsTab, label: t('cmd.themeContent'), icon: Palette },
        { key: 'media' as CmsTab, label: t('cmd.media'), icon: Image },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        {groups.map(group => (
          <div key={group.labelKey} className="space-y-0.5">
            <div className="px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t(group.labelKey)}
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-[var(--border-subtle)]">
              {group.tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setEditingPageId(null);
                      setActiveTab(tab.key);
                      if (typeof window !== 'undefined' && window.location.hash !== `#cms/${tab.key}`) {
                        window.history.replaceState(null, '', `#cms/${tab.key}`);
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                      activeTab === tab.key
                        ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                        : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-muted)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {editingPageId ? (
        <CmsPageEditor
          pageId={editingPageId}
          onBack={() => setEditingPageId(null)}
        />
      ) : (
        <>
          {activeTab === 'overview' && <OverviewTab onNavigate={setActiveTab} />}
          {activeTab === 'pages' && <PagesTab onPageSelect={setEditingPageId} />}
          {activeTab === 'catalog' && <CatalogTab />}
          {activeTab === 'strings' && <StringsTab />}
          {activeTab === 'info' && <SiteInfoTab />}
          {activeTab === 'theme' && <ThemeTab />}
          {activeTab === 'homepage' && <HomepageTab />}
          {activeTab === 'media' && <MediaTab />}
          {activeTab === 'navigation' && <NavigationTab />}
          {activeTab === 'revisions' && <RevisionsTab />}
        </>
      )}
    </div>
  );
};
