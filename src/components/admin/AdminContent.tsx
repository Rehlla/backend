import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { RequireRole } from '../auth/RequireRole';
import { DahabEmptyState } from '../common/DahabEmptyState';
import {
  Image, FileText, Layout, Home, Menu, Search, History, Upload, Type, ChevronRight
} from 'lucide-react';
import { MediaLibrary } from './MediaLibrary';
import { PagesCrud } from './PagesCrud';
import { BlocksCrud } from './BlocksCrud';
import { HomepageEditor } from './HomepageEditor';
import { NavigationEditor } from './NavigationEditor';
import { SeoEditor } from './SeoEditor';
import { RevisionsBrowser } from './RevisionsBrowser';

interface BreadcrumbItem {
  label: string;
  href?: string | null;
}

const SimpleBreadcrumb: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  return (
    <div className="flex items-center gap-1 px-4 py-2 text-xs text-[var(--text-muted)] bg-[var(--surface-container)] border-b border-[var(--border-subtle)]">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3" />}
          {item.href && typeof window !== 'undefined' ? (
            <a href={item.href} className="hover:text-[var(--text-primary)] transition-colors">{item.label}</a>
          ) : (
            <span>{item.label}</span>
          )}
        </span>
      ))}
    </div>
  );
};

type TabId = 'media' | 'pages' | 'blocks' | 'homepage' | 'navigation' | 'seo' | 'revisions';

const TABS: { id: TabId; icon: React.ReactNode; }[] = [
  { id: 'media', icon: <Image className="w-4 h-4" /> },
  { id: 'pages', icon: <FileText className="w-4 h-4" /> },
  { id: 'blocks', icon: <Layout className="w-4 h-4" /> },
  { id: 'homepage', icon: <Home className="w-4 h-4" /> },
  { id: 'navigation', icon: <Menu className="w-4 h-4" /> },
  { id: 'seo', icon: <Search className="w-4 h-4" /> },
  { id: 'revisions', icon: <History className="w-4 h-4" /> },
];

export const AdminContent: React.FC = () => {
  const { t, language, isRTL } = useLanguage();
  const { showToast } = useUI();
  const [activeTab, setActiveTab] = useState<TabId>('media');
  const [subView, setSubView] = useState<string>('');
  const [context, setContext] = useState<Record<string, any>>({});

  const renderTabContent = () => {
    switch (activeTab) {
      case 'media':
        return (
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
              <div>
                <h1 className="text-lg font-extrabold text-[var(--text-primary)]">{t('admin.contentMediaTitle')}</h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('admin.contentMediaSubtitle')}</p>
              </div>
            </div>
            {/* Library */}
            <div className="flex-1 overflow-hidden">
              <MediaLibrary />
            </div>
          </div>
        );

      case 'pages':
        if (subView === 'editor' && context.pageId) {
          return (
            <div className="flex flex-col h-full">
              <SimpleBreadcrumb items={[{ label: t('admin.pagesTitle'), href: '/admin/content' }, { label: t('admin.editPage'), href: null }]} />
              <div className="flex-1 overflow-hidden">
                <BlocksCrud pageId={context.pageId as string} onBack={() => setSubView('')} />
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col h-full">
            <SimpleBreadcrumb items={[{ label: t('admin.pagesTitle'), href: null }]} />
            <div className="flex-1 overflow-hidden">
              <PagesCrud onBack={() => {}} />
            </div>
          </div>
        );

      case 'blocks':
        if (subView === 'editor' && context.pageId) {
          return (
            <div className="flex flex-col h-full">
              <SimpleBreadcrumb items={[{ label: t('admin.blocksTitle'), href: '/admin/content' }, { label: t('admin.blocksForPage'), href: null }]} />
              <div className="flex-1 overflow-hidden">
                <BlocksCrud pageId={context.pageId as string} onBack={() => { setSubView(''); setActiveTab('pages'); }} />
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col h-full">
            <SimpleBreadcrumb items={[{ label: t('admin.blocksTitle'), href: null }]} />
            <div className="flex-1 overflow-hidden">
              <DahabEmptyState
                title={t('admin.blocksSelectPage')}
                description={t('admin.blocksSelectPageDesc')}
                iconName="layout"
                motifName="topo-contour"
                actionText={t('admin.goToPages')}
                onAction={() => setActiveTab('pages')}
              />
            </div>
          </div>
        );

      case 'homepage':
        return (
          <div className="flex flex-col h-full">
            <SimpleBreadcrumb items={[{ label: t('admin.homepageTitle'), href: null }]} />
            <div className="flex-1 overflow-hidden">
              <HomepageEditor onBack={() => {}} />
            </div>
          </div>
        );

      case 'navigation':
        return (
          <div className="flex flex-col h-full">
            <SimpleBreadcrumb items={[{ label: t('admin.navTitle'), href: null }]} />
            <div className="flex-1 overflow-hidden">
              <NavigationEditor onBack={() => {}} />
            </div>
          </div>
        );

      case 'seo':
        return (
          <div className="flex flex-col h-full">
            <SimpleBreadcrumb items={[{ label: t('admin.seoTitle'), href: null }]} />
            <div className="flex-1 overflow-hidden p-6">
              <DahabEmptyState
                title={t('admin.seoSelectPage')}
                description={t('admin.seoSelectPageDesc')}
                iconName="search"
                motifName="reef-art"
                actionText={t('admin.seoGoToPages')}
                onAction={() => setActiveTab('pages')}
              />
              {/* Demo SEO editor for a specific page */}
              <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 max-w-xl">
                <h3 className="text-xs font-extrabold text-[var(--text-primary)] uppercase tracking-wider mb-3">
                  {t('admin.seoDemo')}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mb-3">
                  {t('admin.seoDemoDesc')}
                </p>
                <select
                  value="about-dahab"
                  onChange={e => {
                    setContext({ pageId: e.target.value, pageType: 'page' });
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-sm cursor-pointer focus:outline-none focus:border-[var(--accent-primary)] mb-3"
                >
                  <option value="about-dahab">/about (about-dahab)</option>
                  <option value="faq">/faq (faq)</option>
                  <option value="travel-guides">/travel-guides (travel-guides)</option>
                </select>
                <SeoEditor
                  seo={null}
                  pageType="page"
                  pageId={context.pageId || 'about-dahab'}
                />
              </div>
            </div>
          </div>
        );

      case 'revisions':
        return (
          <div className="flex flex-col h-full">
            <SimpleBreadcrumb items={[{ label: t('admin.revisionsTitle'), href: null }]} />
            <div className="flex-1 overflow-hidden">
              <RevisionsBrowser onBack={() => {}} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <RequireRole roles={['Operations', 'Admin']}>
      <div className="flex flex-col h-screen bg-[var(--surface-base)]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--surface-container)]">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-primary)] flex items-center justify-center">
              <Type className="w-4 h-4 text-[var(--accent-primary-ink)]" />
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-[var(--text-primary)] leading-tight">
                {t('admin.contentTitle')}
              </h1>
              <p className="text-[10px] text-[var(--text-muted)]">
                {t('admin.contentSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[var(--text-muted)] px-2 py-1 rounded-full bg-[var(--surface-card)] border border-[var(--border-subtle)]">
              {language === 'ar' ? 'محتوى CMS' : 'CMS Content'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex border-b border-[var(--border-subtle)] ${isRTL ? 'rtl' : 'ltr'}`}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setActiveTab(tab.id); setSubView(''); setContext({}); }}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/5'
                  : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]/50'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">
                {tab.id === 'media' && language === 'ar' ? 'وسائط' : tab.id === 'media' ? 'Media' : ''}
                {tab.id === 'pages' && language === 'ar' ? 'صفحات' : tab.id === 'pages' ? 'Pages' : ''}
                {tab.id === 'blocks' && language === 'ar' ? 'كتل' : tab.id === 'blocks' ? 'Blocks' : ''}
                {tab.id === 'homepage' && language === 'ar' ? 'الرئيسية' : tab.id === 'homepage' ? 'Homepage' : ''}
                {tab.id === 'navigation' && language === 'ar' ? 'التنقل' : tab.id === 'navigation' ? 'Navigation' : ''}
                {tab.id === 'seo' && language === 'ar' ? 'SEO' : tab.id === 'seo' ? 'SEO' : ''}
                {tab.id === 'revisions' && language === 'ar' ? 'الإصدارات' : tab.id === 'revisions' ? 'Revisions' : ''}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderTabContent()}
        </div>
      </div>
    </RequireRole>
  );
};
