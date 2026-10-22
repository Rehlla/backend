import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft, Save, Eye, EyeOff, Plus, Trash2, GripVertical,
  ChevronDown, ChevronUp, ChevronRight, FileText, Image, Layout, Quote,
  HelpCircle, Link as LinkIcon, BarChart3, Minus, AlertCircle,
  CheckCircle2, X, Search
} from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { readJson } from '../../../services/apiError';
import { api } from '../../../services/api';
import { CmsPagePreview } from '../../pages/CmsStaticPage';

/**
 * CMS Page Editor — edit a page's metadata and content blocks.
 *
 * Supports:
 * - Page metadata (title, description, status, featured)
 * - Content blocks (rich_text, image_text, cta, divider, faq, stats, quote)
 * - Block reordering, visibility toggle, delete
 * - Bilingual fields (en/ar)
 */

const API_BASE = '/api/admin/content';

interface CmsPage {
  id: string;
  slug: string;
  type: string;
  title_en: string;
  title_ar: string;
  subtitle_en: string;
  subtitle_ar: string;
  description_en: string;
  description_ar: string;
  body_en: string;
  body_ar: string;
  hero_image_url: string;
  hero_image_alt_en: string;
  hero_image_alt_ar: string;
  status: string;
  sort_order: number;
  featured: number;
  version: number;
  preview_token: string;
  preview_expires_at: string;
  created_at: string;
  updated_at: string;
}

interface CmsBlock {
  id: string;
  page_id: string;
  type: string;
  sort_order: number;
  visible: number;
  title_en: string;
  title_ar: string;
  body_en: string;
  body_ar: string;
  config: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface CmsSeo {
  id: string;
  title_en: string;
  title_ar: string;
  description_en: string;
  description_ar: string;
  og_title_en: string;
  og_title_ar: string;
  og_description_en: string;
  og_description_ar: string;
  og_image_url: string;
  canonical_url: string;
  noindex: number;
}

const BLOCK_TYPES = [
  { value: 'rich_text', label: 'Rich Text', labelAr: 'نص منسق', icon: FileText },
  { value: 'image_text', label: 'Image + Text', labelAr: 'صورة + نص', icon: Image },
  { value: 'cta', label: 'Call to Action', labelAr: 'دعوة للعمل', icon: LinkIcon },
  { value: 'divider', label: 'Divider', labelAr: 'فاصل', icon: Minus },
  { value: 'faq', label: 'FAQ Accordion', labelAr: 'أسئلة شائعة', icon: HelpCircle },
  { value: 'stats', label: 'Statistics', labelAr: 'إحصائيات', icon: BarChart3 },
  { value: 'quote', label: 'Quote / Testimonial', labelAr: 'اقتباس', icon: Quote },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', labelAr: 'مسودة', color: '#F59E0B' },
  { value: 'published', label: 'Published', labelAr: 'منشورة', color: '#22C55E' },
  { value: 'archived', label: 'Archived', labelAr: 'مؤرشفة', color: '#6B7280' },
];

async function cmsFetch(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || 'CMS API error');
  }
  return readJson(response, `CMS API call to ${path} failed.`);
}

// ============================================================================
// Bilingual Field
// ============================================================================

function BilingualField({
  label,
  valueEn,
  valueAr,
  onChangeEn,
  onChangeAr,
  multiline,
  placeholder,
}: {
  label: string;
  valueEn: string;
  valueAr: string;
  onChangeEn: (v: string) => void;
  onChangeAr: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const { language, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const Input = multiline ? 'textarea' : 'input';

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors cursor-pointer w-full"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>{label}</span>
        <span className="text-[10px] text-[var(--text-muted)] ml-auto">
          {valueEn ? (language === 'ar' ? valueAr || '—' : valueEn.substring(0, 30) + (valueEn.length > 30 ? '...' : '')) : '—'}
        </span>
      </button>
      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 ml-5">
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">EN</span>
            {multiline ? (
              <textarea
                value={valueEn}
                onChange={e => onChangeEn(e.target.value)}
                placeholder={placeholder || 'English content...'}
                rows={3}
                className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none resize-y"
              />
            ) : (
              <input
                type="text"
                value={valueEn}
                onChange={e => onChangeEn(e.target.value)}
                placeholder={placeholder || 'English...'}
                className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
              />
            )}
          </div>
          <div>
            <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">AR</span>
            {multiline ? (
              <textarea
                value={valueAr}
                onChange={e => onChangeAr(e.target.value)}
                placeholder={placeholder || 'المحتوى بالعربية...'}
                rows={3}
                dir="rtl"
                className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none resize-y"
              />
            ) : (
              <input
                type="text"
                value={valueAr}
                onChange={e => onChangeAr(e.target.value)}
                placeholder={placeholder || '...عربي'}
                dir="rtl"
                className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Media Picker Modal
// ============================================================================

function MediaPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const d = await api.listAdminContentMedia();
        setMedia(d.media || []);
        setMediaError(null);
      } catch (err: any) {
        setMediaError(err?.message || 'Failed to load media');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = [...new Set(media.map(m => m.category))];
  const filtered = media.filter(m => {
    const matchSearch = !search ||
      m.filename.toLowerCase().includes(search.toLowerCase()) ||
      m.alt_en.toLowerCase().includes(search.toLowerCase());
    const matchCat = filter === 'all' || m.category === filter;
    return matchSearch && matchCat;
  });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-bold text-white">
            {t('cmd.selectMedia')}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-[var(--border-subtle)] flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('cmd.searchDots')}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {[{ key: 'all', label: 'All' }, ...categories.map(c => ({ key: c, label: c }))].map(cat => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setFilter(cat.key)}
                className={`px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap cursor-pointer border ${
                  filter === cat.key
                    ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
                    : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : mediaError ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-xs">
              <div className="px-3 py-2 rounded-xl bg-red-950/30 border border-red-500/30 text-red-300 inline-block">{mediaError}</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-[var(--text-muted)] text-xs">No media found</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {filtered.map(asset => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => { onSelect(asset.original_url); onClose(); }}
                  className="rounded-xl overflow-hidden border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer text-left"
                >
                  {asset.original_url ? (
                    <img src={asset.original_url} alt="" className="w-full h-24 object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-24 bg-[var(--btn-util-bg)] flex items-center justify-center">
                      <Image className="w-6 h-6 text-[var(--text-muted)]" />
                    </div>
                  )}
                  <div className="p-1.5">
                    <div className="text-[10px] text-white truncate">{asset.filename}</div>
                    <div className="text-[8px] text-[var(--text-muted)]">{asset.category}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Block Editor Card
// ============================================================================

function BlockCard({
  block,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: {
  block: CmsBlock;
  onUpdate: (data: Partial<CmsBlock>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { language, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const blockType = BLOCK_TYPES.find(t => t.value === block.type) || BLOCK_TYPES[0];
  const Icon = blockType.icon;

  return (
    <div className={`rounded-xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${block.visible ? 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)]' : 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)] opacity-60'}`}>
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <GripVertical className="w-3.5 h-3.5 text-[var(--text-muted)] flex-shrink-0" />

        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <Icon className="w-3.5 h-3.5 text-[var(--accent-primary)] flex-shrink-0" />
          <span className="text-xs font-semibold text-white truncate">
            {language === 'ar' ? blockType.labelAr : blockType.label}
          </span>
          {block.title_en && (
            <span className="text-[10px] text-[var(--text-muted)] truncate">
              — {language === 'ar' ? block.title_ar : block.title_en}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => onUpdate({ visible: block.visible ? 0 : 1 })}
            className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
            title={block.visible ? 'Hide' : 'Show'}
          >
            {block.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
          {!isFirst && (
            <button type="button" onClick={onMoveUp} aria-label="Move up" className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer">
              <ChevronUp className="w-3 h-3" />
            </button>
          )}
          {!isLast && (
            <button type="button" onClick={onMoveDown} aria-label="Move down" className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer">
              <ChevronDown className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-label="Toggle section"
            className="p-1 rounded hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
          >
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="p-1 rounded hover:bg-red-500/20 text-[var(--text-muted)] hover:text-red-400 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded Editor */}
      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--border-subtle)] pt-3">
          <BilingualField
            label="Title"
            valueEn={block.title_en}
            valueAr={block.title_ar}
            onChangeEn={v => onUpdate({ title_en: v })}
            onChangeAr={v => onUpdate({ title_ar: v })}
          />
          <BilingualField
            label="Body / Content"
            valueEn={block.body_en}
            valueAr={block.body_ar}
            onChangeEn={v => onUpdate({ body_en: v })}
            onChangeAr={v => onUpdate({ body_ar: v })}
            multiline
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Page Editor
// ============================================================================

interface CmsPageEditorProps {
  pageId: string;
  onBack: () => void;
}

export const CmsPageEditor: React.FC<CmsPageEditorProps> = ({ pageId, onBack }) => {
  const { language , t} = useLanguage();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [blocks, setBlocks] = useState<CmsBlock[]>([]);
  const [seo, setSeo] = useState<CmsSeo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'hero' | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [previewLang, setPreviewLang] = useState<'en' | 'ar'>('en');
  const [linkCopied, setLinkCopied] = useState(false);

  // Load page data
  useEffect(() => {
    const load = async () => {
      try {
        const data = await cmsFetch(`/pages/${pageId}`);
        setPage(data.page);
        setBlocks(data.blocks || []);
        setSeo(data.seo || null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [pageId]);

  // Auto-save page metadata
  const savePage = useCallback(async () => {
    if (!page || !dirty) return;
    try {
      setSaving(true);
      await cmsFetch(`/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title_en: page.title_en,
          title_ar: page.title_ar,
          subtitle_en: page.subtitle_en,
          subtitle_ar: page.subtitle_ar,
          description_en: page.description_en,
          description_ar: page.description_ar,
          body_en: page.body_en,
          body_ar: page.body_ar,
          hero_image_url: page.hero_image_url,
          sort_order: page.sort_order,
          featured: page.featured,
        }),
      });
      setDirty(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [page, dirty]);

  // Debounced auto-save: persist metadata 1.5s after the last keystroke
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => { savePage(); }, 1500);
    return () => clearTimeout(timer);
  }, [page, dirty, savePage]);

  // Publish / archive
  const handlePublish = async () => {
    if (!page) return;
    try {
      await cmsFetch(`/pages/${page.id}/publish`, { method: 'POST' });
      setPage(prev => prev ? { ...prev, status: 'published' } : prev);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleArchive = async () => {
    if (!page) return;
    try {
      await cmsFetch(`/pages/${page.id}/archive`, { method: 'POST' });
      setPage(prev => prev ? { ...prev, status: 'archived' } : prev);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Block operations
  const handleAddBlock = async (type: string) => {
    if (!page) return;
    try {
      const data = await cmsFetch('/blocks', {
        method: 'POST',
        body: JSON.stringify({ page_id: page.id, type, sort_order: blocks.length }),
      });
      setBlocks(prev => [...prev, data.block]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateBlock = async (blockId: string, data: Partial<CmsBlock>) => {
    try {
      await cmsFetch(`/blocks/${blockId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, ...data } : b));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await cmsFetch(`/blocks/${blockId}`, { method: 'DELETE' });
      setBlocks(prev => prev.filter(b => b.id !== blockId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleMoveBlock = async (blockId: string, direction: 'up' | 'down') => {
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= blocks.length) return;

    const newBlocks = [...blocks];
    [newBlocks[idx], newBlocks[newIdx]] = [newBlocks[newIdx], newBlocks[idx]];

    // Update sort orders
    for (let i = 0; i < newBlocks.length; i++) {
      newBlocks[i] = { ...newBlocks[i], sort_order: i };
    }
    setBlocks(newBlocks);

    // Persist new order
    try {
      for (const b of newBlocks) {
        await cmsFetch(`/blocks/${b.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ sort_order: b.sort_order }),
        });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!page) {
    return (
      <div className="text-center py-20 text-[var(--text-muted)]">
        <AlertCircle className="w-8 h-8 mx-auto mb-2" />
        <div className="text-sm">{t('cmd.pageNotFound')}</div>
        <button type="button" onClick={onBack} className="mt-3 text-xs text-[var(--accent-primary)] hover:underline cursor-pointer">
          {t('cmd.goBack')}
        </button>
      </div>
    );
  }

  const statusConfig = STATUS_OPTIONS.find(s => s.value === page.status) || STATUS_OPTIONS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h3 className="text-sm font-bold text-white">
              {language === 'ar' ? page.title_ar || page.title_en : page.title_en || 'Untitled'}
            </h3>
            <div className="text-[11px] text-[var(--text-muted)]">/{page.slug} · v{page.version}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
              showPreview
                ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]'
            }`}
          >
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {t('cmd.preview')}
          </button>
          <button
            type="button"
            title={
              page.preview_expires_at && page.preview_expires_at > new Date().toISOString()
                ? `Expires ${new Date(page.preview_expires_at).toLocaleString()}`
                : 'Link expired or missing — a fresh one will be minted'
            }
            onClick={async () => {
              try {
                let token = page.preview_token;
                const live =
                  !!token && !!page.preview_expires_at && page.preview_expires_at > new Date().toISOString();
                if (!live) {
                  const data = await cmsFetch(`/pages/${page.id}/preview-refresh`, { method: 'POST' });
                  token = data.preview_token;
                  setPage({ ...page, preview_token: data.preview_token, preview_expires_at: data.preview_expires_at });
                }
                const url = `${window.location.origin}/preview/${token}`;
                try {
                  await navigator.clipboard.writeText(url);
                } catch {
                  window.prompt('Copy preview link:', url);
                  return;
                }
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              } catch (err: any) {
                alert(err.message);
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-white text-[11px] font-bold border border-[var(--border-subtle)] cursor-pointer"
          >
            {linkCopied ? '✓' : t('cmd.copyPreviewLink')}
          </button>
          <span
            className="px-2 py-0.5 rounded-full text-[11px] font-bold border"
            style={{
              backgroundColor: `${statusConfig.color}20`,
              color: statusConfig.color,
              borderColor: `${statusConfig.color}30`,
            }}
          >
            {language === 'ar' ? statusConfig.labelAr : statusConfig.label}
          </span>

          {page.status === 'draft' && (
            <button
              type="button"
              onClick={handlePublish}
              className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] text-[11px] font-bold hover:bg-[var(--accent-primary)]/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
            >
              {t('cmd.publish')}
            </button>
          )}
          {page.status === 'published' && (
            <button
              type="button"
              onClick={handleArchive}
              className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
            >
              {t('cmd.archive')}
            </button>
          )}
        </div>
      </div>

      {/* Live preview — renders unsaved form state exactly as publishing would */}
      {showPreview && (
        <div className="rounded-xl border border-[var(--accent-primary)]/30 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-[var(--btn-util-bg)] border-b border-[var(--border-subtle)]">
            <span className="text-[11px] font-bold text-[var(--text-muted)]">{t('cmd.preview')}</span>
            <div className="flex gap-1 ml-2">
              {(['desktop', 'mobile'] as const).map(w => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setPreviewWidth(w)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    previewWidth === w ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {w === 'desktop' ? '960px' : '390px'}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(['en', 'ar'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setPreviewLang(l)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    previewLang === l ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            {dirty && (
              <span className="ml-auto text-[10px] text-amber-300">{t('cmd.unsavedChangesShown')}</span>
            )}
          </div>
          <div className="bg-[var(--surface-card)] overflow-auto max-h-[70vh]">
            <div className="mx-auto transition-all" style={{ maxWidth: previewWidth === 'desktop' ? 960 : 390 }}>
              <CmsPagePreview page={page} blocks={blocks} language={previewLang} />
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="ml-auto cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Page Metadata */}
      <div className="p-4 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] space-y-3">
        <h4 className="text-xs font-bold text-[var(--text-muted)]">
          {t('cmd.pageMetadata')}
        </h4>

        <BilingualField
          label={t('cmd.fieldTitle')}
          valueEn={page.title_en}
          valueAr={page.title_ar}
          onChangeEn={v => { setPage({ ...page, title_en: v }); setDirty(true); }}
          onChangeAr={v => { setPage({ ...page, title_ar: v }); setDirty(true); }}
        />
        <BilingualField
          label={t('cmd.fieldSubtitle')}
          valueEn={page.subtitle_en}
          valueAr={page.subtitle_ar}
          onChangeEn={v => { setPage({ ...page, subtitle_en: v }); setDirty(true); }}
          onChangeAr={v => { setPage({ ...page, subtitle_ar: v }); setDirty(true); }}
        />
        <BilingualField
          label={t('cmd.description')}
          valueEn={page.description_en}
          valueAr={page.description_ar}
          onChangeEn={v => { setPage({ ...page, description_en: v }); setDirty(true); }}
          onChangeAr={v => { setPage({ ...page, description_ar: v }); setDirty(true); }}
          multiline
        />

        {/* Hero image */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[var(--text-muted)]">
              {t('cmd.heroImageURL')}
            </span>
            <button
              type="button"
              onClick={() => { setMediaPickerTarget('hero'); setShowMediaPicker(true); }}
              className="text-[10px] text-[var(--accent-primary)] hover:text-[var(--accent-primary)] cursor-pointer"
            >
              {t('cmd.chooseFromLibrary')}
            </button>
          </div>
          <input
            type="text"
            value={page.hero_image_url}
            onChange={e => { setPage({ ...page, hero_image_url: e.target.value }); setDirty(true); }}
            placeholder="https://images.unsplash.com/..."
            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
          />
          {page.hero_image_url && (
            <img src={page.hero_image_url} alt="" className="w-full h-32 object-cover rounded-lg mt-1" />
          )}
        </div>

        {/* Featured toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setPage({ ...page, featured: page.featured ? 0 : 1 }); setDirty(true); }}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border ${
              page.featured
                ? 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border-[var(--accent-secondary)]/30'
                : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]'
            }`}
          >
            {page.featured ? '★ Featured' : t('cmd.featureThis')}
          </button>
        </div>

        {/* Save button */}
        {dirty && (
          <button
            type="button"
            onClick={savePage}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold hover:bg-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
          >
            {saving ? (t('cmd.saving')) : (t('cmd.saveChanges'))}
          </button>
        )}
      </div>

      {/* Content Blocks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[var(--text-muted)]">
            {t('cmd.contentBlocks')}
          </h4>
          <span className="text-[11px] text-[var(--text-muted)]">{blocks.length} blocks</span>
        </div>

        {blocks.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-xs">
            {t('cmd.noContentBlocksYet')}
          </div>
        ) : (
          <div className="space-y-2">
            {blocks.map((block, idx) => (
              <BlockCard
                key={block.id}
                block={block}
                onUpdate={data => handleUpdateBlock(block.id, data)}
                onDelete={() => handleDeleteBlock(block.id)}
                onMoveUp={() => handleMoveBlock(block.id, 'up')}
                onMoveDown={() => handleMoveBlock(block.id, 'down')}
                isFirst={idx === 0}
                isLast={idx === blocks.length - 1}
              />
            ))}
          </div>
        )}

        {/* Add block buttons */}
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map(bt => {
            const Icon = bt.icon;
            return (
              <button
                key={bt.value}
                type="button"
                onClick={() => handleAddBlock(bt.value)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <Icon className="w-3 h-3" />
                <span>{language === 'ar' ? bt.labelAr : bt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SEO Section */}
      <div className="border-t border-[var(--border-subtle)] pt-4">
        <button
          type="button"
          onClick={() => {
            setShowSeo(!showSeo);
            if (!showSeo && !seo) {
              // Initialize empty SEO record
              setSeo({
                id: '',
                title_en: page.title_en,
                title_ar: page.title_ar,
                description_en: page.description_en,
                description_ar: page.description_ar,
                og_title_en: '',
                og_title_ar: '',
                og_description_en: '',
                og_description_ar: '',
                og_image_url: '',
                canonical_url: '',
                noindex: 0,
              });
            }
          }}
          className="flex items-center gap-2 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-muted)] transition-colors cursor-pointer"
        >
          {showSeo ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>{t('cmd.sEOMetadata')}</span>
          {seo?.noindex ? (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/20 text-red-400 border border-red-500/30">
              NOINDEX
            </span>
          ) : null}
        </button>

        {showSeo && seo && (
          <div className="mt-3 p-4 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] space-y-3">
            {/* SEO Title */}
            <BilingualField
              label={t('cmd.sEOTitle')}
              valueEn={seo.title_en}
              valueAr={seo.title_ar}
              onChangeEn={v => setSeo({ ...seo, title_en: v })}
              onChangeAr={v => setSeo({ ...seo, title_ar: v })}
            />

            {/* SEO Description */}
            <BilingualField
              label={t('cmd.sEODescription')}
              valueEn={seo.description_en}
              valueAr={seo.description_ar}
              onChangeEn={v => setSeo({ ...seo, description_en: v })}
              onChangeAr={v => setSeo({ ...seo, description_ar: v })}
              multiline
            />

            {/* Open Graph Title */}
            <BilingualField
              label="Open Graph Title"
              valueEn={seo.og_title_en}
              valueAr={seo.og_title_ar}
              onChangeEn={v => setSeo({ ...seo, og_title_en: v })}
              onChangeAr={v => setSeo({ ...seo, og_title_ar: v })}
            />

            {/* Open Graph Description */}
            <BilingualField
              label="Open Graph Description"
              valueEn={seo.og_description_en}
              valueAr={seo.og_description_ar}
              onChangeEn={v => setSeo({ ...seo, og_description_en: v })}
              onChangeAr={v => setSeo({ ...seo, og_description_ar: v })}
              multiline
            />

            {/* OG Image */}
            <div>
              <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">OG Image URL</span>
              <input
                type="url"
                value={seo.og_image_url}
                onChange={e => setSeo({ ...seo, og_image_url: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
              />
              {seo.og_image_url && (
                <img src={seo.og_image_url} alt="" className="w-full h-24 object-cover rounded-lg mt-1" />
              )}
            </div>

            {/* Canonical URL */}
            <div>
              <span className="text-[10px] text-[var(--text-muted)] font-bold uppercase">Canonical URL</span>
              <input
                type="url"
                value={seo.canonical_url}
                onChange={e => setSeo({ ...seo, canonical_url: e.target.value })}
                placeholder="https://dahabtravel.com/..."
                className="w-full mt-0.5 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white placeholder-white/30 focus:border-[var(--accent-primary)]/50 focus:outline-none"
              />
            </div>

            {/* Noindex toggle */}
            <label className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] cursor-pointer">
              <input
                type="checkbox"
                checked={seo.noindex === 1}
                onChange={e => setSeo({ ...seo, noindex: e.target.checked ? 1 : 0 })}
                className="rounded"
              />
              {t('cmd.noindexPreventSearchEngine')}
            </label>

            {/* Save SEO */}
            <button
              type="button"
              onClick={async () => {
                try {
                  setSaving(true);
                  await cmsFetch(`/seo/page/${page.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify(seo),
                  });
                } catch (err: any) {
                  setError(err.message);
                } finally {
                  setSaving(false);
                }
              }}
              disabled={saving}
              className="px-4 py-1.5 rounded-lg bg-[var(--accent-primary)] text-[var(--surface-card)] text-xs font-bold hover:bg-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50"
            >
              {saving ? '...' : (t('cmd.saveSEO'))}
            </button>
          </div>
        )}
      </div>

      {/* Media Picker Modal */}
      {showMediaPicker && (
        <MediaPickerModal
          onSelect={(url) => {
            if (mediaPickerTarget === 'hero') {
              setPage({ ...page!, hero_image_url: url });
              setDirty(true);
            }
          }}
          onClose={() => setShowMediaPicker(false)}
        />
      )}
    </div>
  );
};
