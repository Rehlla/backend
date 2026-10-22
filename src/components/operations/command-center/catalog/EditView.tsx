import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArchiveRestore, ArrowLeft, Check, Copy, Eye, EyeOff, Loader2, RefreshCw, Send, Trash2, Archive } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogChildSchema, CatalogEnvelope, CatalogScope, CatalogTypeSchema } from '../../../../types/catalog';
import { SkeletonCard, TabBar } from '../ui';
import { NoticeBar, buttonClass, dangerButtonClass, formatWhen, primaryButtonClass, useReasonPrompt } from '../control/controlShared';
import { FormEngine } from './FormEngine';
import { ChildListPanel, fallbackChildSchema } from './ChildListPanel';
import { MenuEditor } from './MenuEditor';
import { RateCalendar } from './RateCalendar';
import { SlotCalendar } from './SlotCalendar';
import {
  CompletenessBar, MissingList, StatusChip, allFields, bodyFromValues, completenessOf, isInUse, isPriceJump, isStale, missingFields,
  pickText, useCatalogRunner, valuesFromEnvelope, type FormValues,
} from './catalogShared';

const DiningOrdersSection = React.lazy(() => import('../DiningOrdersSection'));

/**
 * One listing, edited in place. The whole schema renders as one sectioned
 * form; every change autosaves (debounced PATCH carrying If-Match). A 409
 * means someone else saved first: the operator chooses to reload theirs or
 * keep their own edits on top of the newer version. A price jump over 30%
 * pauses autosave until a reason is given. Children (rooms, rates, slots,
 * menu, orders) are tabs.
 */

const AUTOSAVE_MS = 1200;

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict' | 'needsReason';

export interface EditViewProps {
  scope: CatalogScope;
  schema: CatalogTypeSchema;
  allTypes: CatalogTypeSchema[];
  id: string;
  canManage: boolean;
  canPublish: boolean;
  onBack: () => void;
  onOpen: (id: string) => void;
}

const fallbackMenuSchema: CatalogTypeSchema = {
  type: 'restaurant-menu-item',
  label: { en: 'Menu item', ar: 'صنف' },
  sections: [
    {
      key: 'basics',
      fields: [
        { key: 'title', kind: 'i18nText', required: true, max: 120, label: { en: 'Name', ar: 'الاسم' } },
        { key: 'summary', kind: 'i18nTextarea', max: 400, label: { en: 'Description', ar: 'الوصف' } },
        { key: 'section', kind: 'text', label: { en: 'Menu section', ar: 'قسم القائمة' } },
        { key: 'priceEGP', kind: 'money', required: true, label: { en: 'Price', ar: 'السعر' } },
        { key: 'available', kind: 'boolean', label: { en: 'Available', ar: 'متاح' } },
      ],
    },
  ],
};

function childEditor(child: CatalogChildSchema): 'rates' | 'slots' | 'menu' | 'embedded' | 'list' {
  if (child.kind === 'rateCalendar' || child.key === 'rates') return 'rates';
  if (child.kind === 'slotCalendar' || child.key === 'slots') return 'slots';
  if (child.key === 'menu' || child.kind === 'menu') return 'menu';
  if (child.key === 'days' && !child.itemType) return 'embedded';
  return 'list';
}

export function EditView({ scope, schema, allTypes, id, canManage, canPublish, onBack, onOpen }: EditViewProps) {
  const { t, language } = useLanguage();
  const type = schema.type;
  const [record, setRecord] = useState<CatalogEnvelope | null>(null);
  const [children, setChildren] = useState<Record<string, CatalogEnvelope[]>>({});
  const [values, setValues] = useState<FormValues>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tab, setTab] = useState('details');
  const dirty = useRef<Set<string>>(new Set());
  const saved = useRef<FormValues>({});
  const valuesRef = useRef<FormValues>({});
  const recordRef = useRef<CatalogEnvelope | null>(null);
  const timer = useRef<number | null>(null);
  const { run, busy, notice, clearNotice, setNotice } = useCatalogRunner();
  const { ask, dialog } = useReasonPrompt(run);

  const apply = useCallback((env: CatalogEnvelope, resetValues: boolean) => {
    recordRef.current = env;
    setRecord(env);
    const fresh = valuesFromEnvelope(schema, env);
    saved.current = fresh;
    if (resetValues) {
      dirty.current = new Set();
      valuesRef.current = fresh;
      setValues(fresh);
    }
  }, [schema]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadError(null);
    try {
      const detail = await api.catalogGet(scope, type, id, signal);
      apply(detail.item, true);
      setChildren(detail.children);
      setSaveState('idle');
    } catch (err) {
      if (!signal?.aborted) setLoadError((err as Error)?.message || t('ctl.notice.failed'));
    }
  }, [scope, type, id, apply, t]);

  useEffect(() => {
    const c = new AbortController();
    void load(c.signal);
    return () => c.abort();
  }, [load]);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  /** PATCH the dirty keys. `force` re-reads the latest version first (keep mine). */
  const save = useCallback(async (opts: { reason?: string; force?: boolean } = {}) => {
    const current = recordRef.current;
    if (!current || dirty.current.size === 0) return;
    const keys = new Set(dirty.current);
    const snapshot = valuesRef.current;
    if (!opts.reason) {
      const jump = allFields(schema).some(f => f.kind === 'money' && keys.has(f.key) && isPriceJump(saved.current[f.key], snapshot[f.key]));
      if (jump) {
        setSaveState('needsReason');
        return;
      }
    }
    setSaveState('saving');
    try {
      let ifMatch = current.updatedAt;
      if (opts.force) ifMatch = (await api.catalogGet(scope, type, id)).item.updatedAt;
      const body = { ...bodyFromValues(snapshot, keys), ...(opts.reason ? { reason: opts.reason } : {}) };
      const updated = await api.catalogPatch(scope, type, id, body, ifMatch);
      for (const k of keys) dirty.current.delete(k);
      apply(updated, false);
      setSavedAt(updated.updatedAt);
      if (updated.approvalId) setNotice({ kind: 'info', text: t('cat.notice.approval') });
      setSaveState(dirty.current.size > 0 ? 'dirty' : 'saved');
    } catch (err) {
      if (isStale(err)) setSaveState('conflict');
      else {
        setSaveState('error');
        setNotice({ kind: 'error', text: (err as Error)?.message || t('ctl.notice.failed') });
      }
    }
  }, [scope, type, id, schema, apply, setNotice, t]);

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { timer.current = null; void save(); }, AUTOSAVE_MS);
  }, [save]);

  const change = (key: string, v: unknown) => {
    const next = { ...valuesRef.current, [key]: v };
    valuesRef.current = next;
    setValues(next);
    dirty.current.add(key);
    if (saveState !== 'conflict' && saveState !== 'needsReason') {
      setSaveState('dirty');
      schedule();
    }
  };

  // A price jump paused autosave: ask once for the reason, then save with it.
  useEffect(() => {
    if (saveState !== 'needsReason') return;
    ask({
      title: t('cat.price.jumpTitle'),
      description: t('cat.price.jumpBody'),
      run: reason => save({ reason }),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState]);

  const missing = missingFields(schema.sections, values);
  const completeness = completenessOf(schema.sections, values);
  const missingSet = useMemo(() => new Set(missing.map(f => f.key)), [missing]);

  const childTabs = (schema.children ?? []).filter(c => childEditor(c) !== 'embedded');
  const childSchemaFor = useMemo(() => {
    const m: Record<string, CatalogTypeSchema> = {};
    for (const c of schema.children ?? []) {
      const found = c.itemType ? allTypes.find(x => x.type === c.itemType) : undefined;
      m[c.key] = found ?? (childEditor(c) === 'menu' ? fallbackMenuSchema : fallbackChildSchema(c.itemType ?? c.key));
    }
    return m;
  }, [schema, allTypes]);

  if (loadError) {
    return (
      <div className="space-y-3">
        <button type="button" className={buttonClass} onClick={onBack}><ArrowLeft className="w-3 h-3 rtl:rotate-180" /> {t('cat.back')}</button>
        <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{loadError}</div>
      </div>
    );
  }
  if (!record) return <SkeletonCard />;

  const flushThen = async (fn: () => Promise<unknown>) => {
    if (timer.current) { window.clearTimeout(timer.current); timer.current = null; }
    if (dirty.current.size > 0) await save();
    return fn();
  };

  const publish = () =>
    run(() => flushThen(async () => apply(await api.catalogPublish(scope, type, id), false)), scope === 'supplier' ? t('cat.notice.submitted') : t('cat.notice.published'));
  const hide = () => run(async () => apply(await api.catalogHide(scope, type, id), false), t('cat.notice.hidden'));
  const restore = () => run(async () => apply(await api.catalogRestore(scope, type, id), false), t('cat.notice.restored'));
  const duplicate = () =>
    run(async () => { const copy = await api.catalogDuplicate(scope, type, id); onOpen(copy.id); }, t('cat.notice.duplicated'));
  const archive = () =>
    ask({
      title: t('cat.archive.title', { name: pickText(record.title, language) || id }),
      description: t('cat.archive.body'),
      critical: true,
      confirmLabel: t('cat.action.archive'),
      run: async reason => apply(await api.catalogArchive(scope, type, id, reason), false),
      success: t('cat.notice.archived'),
    });
  const remove = () =>
    ask({
      title: t('cat.delete.title', { name: pickText(record.title, language) || id }),
      description: t('cat.delete.body'),
      critical: true,
      confirmLabel: t('ctl.action.delete'),
      run: async reason => {
        try {
          await api.catalogDelete(scope, type, id, reason);
          onBack();
        } catch (err) {
          if (!isInUse(err)) throw err;
          // Booked before: offer the archive instead.
          ask({
            title: t('cat.inUse.title'),
            description: t('cat.inUse.body'),
            confirmLabel: t('cat.action.archive'),
            run: async reason2 => apply(await api.catalogArchive(scope, type, id, reason2), false),
            success: t('cat.notice.archived'),
          });
          throw err;
        }
      },
      success: t('cat.notice.deleted'),
    });

  const status = record.status;
  const publishLabel = scope === 'supplier' ? t('cat.action.submit') : status === 'published' ? t('cat.action.publishChanges') : t('cat.action.publish');
  const showPublish = canManage && (scope === 'supplier' ? status !== 'review' && status !== 'archived' : canPublish && status !== 'archived');

  const saveText =
    saveState === 'saving' ? t('cat.save.saving')
    : saveState === 'dirty' ? t('cat.save.dirty')
    : saveState === 'error' ? t('cat.save.error')
    : saveState === 'conflict' ? t('cat.save.conflict')
    : saveState === 'needsReason' ? t('cat.save.needsReason')
    : savedAt ? t('cat.save.savedAt', { when: formatWhen(savedAt, language) })
    : t('cat.save.saved');

  const tabs = [
    { id: 'details', label: t('cat.tab.details') },
    ...childTabs.map(c => ({ id: `child:${c.key}`, label: pickText(c.label, language) || c.key, count: childEditor(c) === 'list' || childEditor(c) === 'menu' ? (children[c.key]?.length ?? 0) : undefined })),
    ...(type === 'restaurant' && scope === 'staff' ? [{ id: 'orders', label: t('cat.tab.orders') }] : []),
  ];

  const renderChild = (c: CatalogChildSchema) => {
    const items = children[c.key] ?? [];
    const setItems = (next: CatalogEnvelope[]) => setChildren(prev => ({ ...prev, [c.key]: next }));
    switch (childEditor(c)) {
      case 'rates':
        return <RateCalendar scope={scope} hotelId={id} rooms={children.rooms ?? []} />;
      case 'slots':
        return <SlotCalendar scope={scope} activityId={id} />;
      case 'menu':
        return <MenuEditor scope={scope} venueId={id} childKey={c.key} itemSchema={childSchemaFor[c.key]} items={items} onItemsChange={setItems} />;
      default:
        return <ChildListPanel scope={scope} type={type} parentId={id} childKey={c.key} childSchema={childSchemaFor[c.key]} items={items} onItemsChange={setItems} />;
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} onClick={() => void flushThen(async () => onBack())}>
          <ArrowLeft className="w-3 h-3 rtl:rotate-180" /> {t('cat.back')}
        </button>
        <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">{pickText(record.title, language) || t('cat.untitled')}</h2>
        <StatusChip status={status} />
        <CompletenessBar value={completeness} />
        <span className="flex-1" />
        {canManage && (
          <button type="button" className={buttonClass} disabled={busy} onClick={() => void duplicate()}>
            <Copy className="w-3 h-3" /> {t('cat.action.duplicate')}
          </button>
        )}
      </div>

      {saveState === 'conflict' && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4" aria-hidden="true" />
          <span className="flex-1">{t('cat.conflict.body')}</span>
          <button type="button" className={buttonClass} onClick={() => void load()}>
            <RefreshCw className="w-3 h-3" /> {t('cat.conflict.reload')}
          </button>
          <button type="button" className={primaryButtonClass} onClick={() => void save({ force: true })}>
            {t('cat.conflict.keepMine')}
          </button>
        </div>
      )}
      <NoticeBar notice={notice} onDismiss={clearNotice} />

      {tabs.length > 1 && <TabBar tabs={tabs} activeTab={tab} onChange={setTab} variant="underline" />}

      {tab === 'details' && (
        <FormEngine sections={schema.sections} values={values} onChange={change} scope={scope} missing={missingSet} disabled={!canManage} />
      )}
      {childTabs.map(c => (tab === `child:${c.key}` ? <div key={c.key}>{renderChild(c)}</div> : null))}
      {tab === 'orders' && (
        <React.Suspense fallback={<SkeletonCard />}>
          <DiningOrdersSection venueId={id} />
        </React.Suspense>
      )}

      <div className="sticky bottom-0 z-10 space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 shadow-lg" data-testid="catalog-savebar">
        {showPublish && <MissingList fields={missing} />}
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]" aria-live="polite">
            {saveState === 'saving' ? <Loader2 className="w-3 h-3 animate-spin" /> : saveState === 'saved' || saveState === 'idle' ? <Check className="w-3 h-3 text-emerald-400" /> : null}
            {saveText}
          </span>
          <span className="flex-1" />
          {canManage && status === 'published' && (
            <button type="button" className={buttonClass} disabled={busy} onClick={() => void hide()}><EyeOff className="w-3 h-3" /> {t('cat.action.hide')}</button>
          )}
          {canManage && (status === 'archived' || status === 'hidden') && (
            <button type="button" className={buttonClass} disabled={busy} onClick={() => void restore()}><ArchiveRestore className="w-3 h-3" /> {t('cat.action.restore')}</button>
          )}
          {canManage && status !== 'archived' && (
            <button type="button" className={dangerButtonClass} disabled={busy} onClick={archive}><Archive className="w-3 h-3" /> {t('cat.action.archive')}</button>
          )}
          {canManage && status === 'draft' && (
            <button type="button" className={dangerButtonClass} disabled={busy} onClick={remove}><Trash2 className="w-3 h-3" /> {t('ctl.action.delete')}</button>
          )}
          {showPublish && (
            <button type="button" className={primaryButtonClass} disabled={busy || missing.length > 0 || saveState === 'conflict'} onClick={() => void publish()}>
              {scope === 'supplier' ? <Send className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {publishLabel}
            </button>
          )}
        </div>
      </div>
      {dialog}
    </div>
  );
}

export default EditView;
