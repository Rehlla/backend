import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ImagePlus, Loader2, MapPin, Plus, Star, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogField, CatalogGeo, CatalogPlanDay, CatalogScope, CatalogSectionSchema, I18nString } from '../../../../types/catalog';
import type { SupplierEntity } from '../../../../shared/types/commerce';
import { inputClass, buttonClass } from '../control/controlShared';
import { fieldLabel, normalizeI18n, pickText, type FormValues } from './catalogShared';

/**
 * The schema-driven form. Renders whatever sections the server's catalogue
 * schema describes — one control per field kind — and reports each change by
 * field key. It owns no record state: the wizard and the edit view hold the
 * values and decide when to save.
 */

const GeoMap = React.lazy(() => import('./GeoMap'));

export interface FormEngineProps {
  sections: CatalogSectionSchema[];
  values: FormValues;
  onChange: (key: string, value: unknown) => void;
  scope: CatalogScope;
  /** Keys to flag as missing (client check plus a server 422). */
  missing?: ReadonlySet<string>;
  disabled?: boolean;
}

export function FormEngine({ sections, values, onChange, scope, missing, disabled }: FormEngineProps) {
  const { language } = useLanguage();
  return (
    <div className="space-y-5">
      {sections.map(section => {
        // A supplier never chooses the supplier: the server scopes it to them.
        const fields = section.fields.filter(f => !(scope === 'supplier' && f.kind === 'supplier'));
        if (fields.length === 0) return null;
        return (
          <fieldset key={section.key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-4 space-y-4" disabled={disabled}>
            {section.label && (
              <legend className="px-1 text-xs font-bold text-[var(--text-primary)]">{pickText(section.label, language)}</legend>
            )}
            {fields.map(field => (
              <FieldControl
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={v => onChange(field.key, v)}
                flagged={missing?.has(field.key) ?? false}
              />
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

interface ControlProps<V = unknown> {
  field: CatalogField;
  value: V;
  onChange: (v: unknown) => void;
  flagged: boolean;
}

function FieldControl(props: ControlProps) {
  const { field, flagged } = props;
  const { t, language } = useLanguage();
  const id = `cat-field-${field.key}`;
  const label = fieldLabel(field, language);
  const help = pickText(field.help, language);
  return (
    <div data-testid={`field-${field.key}`} data-field-kind={field.kind} className="space-y-1.5">
      {field.kind !== 'boolean' && (
        <label htmlFor={id} className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)]">
          {label}
          {field.required && <span className="text-red-400" aria-label={t('cat.required')}>*</span>}
          {flagged && <span className="ms-1 rounded-full bg-red-500/15 px-1.5 text-[10px] text-red-400">{t('cat.required')}</span>}
        </label>
      )}
      <KindControl {...props} id={id} label={label} />
      {help && <p className="text-[10px] text-[var(--text-muted)]">{help}</p>}
    </div>
  );
}

function KindControl(props: ControlProps & { id: string; label: string }) {
  const { field, value, onChange, flagged, id, label } = props;
  const { language } = useLanguage();
  const ring = flagged ? ' border-red-500/60' : '';
  switch (field.kind) {
    case 'text':
      return <input id={id} className={inputClass + ring} value={typeof value === 'string' ? value : ''} maxLength={field.max} onChange={e => onChange(e.target.value)} placeholder={pickText(field.placeholder, language)} />;
    case 'i18nText':
    case 'i18nTextarea':
      return <I18nControl id={id} field={field} value={value} onChange={onChange} flagged={flagged} />;
    case 'number':
      return <NumberInput id={id} className={inputClass + ring} value={value} min={field.min} max={field.max} onChange={onChange} />;
    case 'money':
      return <MoneyInput id={id} flagged={flagged} value={value} onChange={onChange} />;
    case 'boolean':
      return (
        <label className="inline-flex items-center gap-2 text-xs text-[var(--text-primary)] cursor-pointer">
          <input id={id} type="checkbox" checked={value === true} onChange={e => onChange(e.target.checked)} className="accent-[var(--accent-primary)]" />
          {label}
        </label>
      );
    case 'select':
      return <SelectControl id={id} field={field} value={value} onChange={onChange} className={inputClass + ring} />;
    case 'multiselect':
      return <MultiSelectControl field={field} value={value} onChange={onChange} />;
    case 'tags':
      return <TagsControl id={id} field={field} value={value} onChange={onChange} />;
    case 'time':
      return <input id={id} type="time" className={inputClass + ring + ' w-32'} value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)} />;
    case 'timeList':
      return <TimeListControl id={id} value={value} onChange={onChange} />;
    case 'duration':
      return <DurationControl id={id} value={value} onChange={onChange} />;
    case 'geo':
      return <GeoControl id={id} value={value} onChange={onChange} />;
    case 'gallery':
      return <GalleryControl id={id} field={field} value={value} onChange={onChange} flagged={flagged} />;
    case 'supplier':
      return <SupplierControl id={id} value={value} onChange={onChange} className={inputClass + ring} />;
    case 'dayPlan':
      return <DayPlanControl value={value} onChange={onChange} />;
    case 'json':
    default:
      return <JsonControl id={id} value={value} onChange={onChange} />;
  }
}

// ─── Text ───────────────────────────────────────────────────────────────────

/** AR and EN side by side; the side still empty is highlighted. */
function I18nControl({ id, field, value, onChange, flagged }: { id: string; field: CatalogField; value: unknown; onChange: (v: unknown) => void; flagged: boolean }) {
  const { t } = useLanguage();
  const v = normalizeI18n(value);
  const anyFilled = v.en.trim() !== '' || v.ar.trim() !== '';
  const multiline = field.kind === 'i18nTextarea';
  const side = (lang: keyof I18nString) => {
    const empty = v[lang].trim() === '';
    const highlight = empty && (anyFilled || flagged);
    const common = {
      id: lang === 'en' ? id : `${id}-ar`,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      lang,
      value: v[lang],
      maxLength: field.max,
      'aria-label': `${t(`cat.lang.${lang}`)}`,
      'aria-invalid': highlight || undefined,
      className: `${inputClass} ${highlight ? 'border-amber-500/70 bg-amber-500/5' : ''}`,
    } as const;
    const set = (text: string) => onChange({ ...v, [lang]: text });
    return (
      <div className="space-y-1" data-lang={lang} data-missing={highlight ? 'true' : undefined}>
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span className="font-bold">{t(`cat.lang.${lang}`)}</span>
          {highlight ? (
            <span className="text-amber-400 font-bold">{t(`cat.missingLang.${lang}`)}</span>
          ) : field.max ? (
            <span className="tabular-nums">{v[lang].length}/{field.max}</span>
          ) : null}
        </div>
        {multiline ? (
          <textarea {...common} rows={4} onChange={e => set(e.target.value)} />
        ) : (
          <input {...common} onChange={e => set(e.target.value)} />
        )}
      </div>
    );
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {side('ar')}
      {side('en')}
    </div>
  );
}

// ─── Numbers ────────────────────────────────────────────────────────────────

function toNumber(raw: string): number | null {
  if (raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function NumberInput({ id, className, value, min, max, onChange }: { id: string; className: string; value: unknown; min?: number; max?: number; onChange: (v: unknown) => void }) {
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      className={className + ' w-40'}
      value={typeof value === 'number' ? value : ''}
      min={min}
      max={max}
      onChange={e => onChange(toNumber(e.target.value))}
    />
  );
}

function MoneyInput({ id, value, onChange, flagged }: { id: string; value: unknown; onChange: (v: unknown) => void; flagged: boolean }) {
  const { t } = useLanguage();
  return (
    <div className={`inline-flex items-center rounded-lg border bg-[var(--btn-util-bg)] ${flagged ? 'border-red-500/60' : 'border-[var(--border-subtle)]'} focus-within:border-[var(--accent-primary)]`}>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        className="w-32 bg-transparent px-2.5 py-1.5 text-xs tabular-nums text-[var(--text-primary)] outline-none"
        value={typeof value === 'number' ? value : ''}
        onChange={e => onChange(toNumber(e.target.value))}
      />
      <span className="px-2 text-[10px] font-bold text-[var(--text-muted)] border-s border-[var(--border-subtle)]">{t('cat.egp')}</span>
    </div>
  );
}

function DurationControl({ id, value, onChange }: { id: string; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useLanguage();
  const total = typeof value === 'number' && value > 0 ? value : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  const set = (hours: number, mins: number) => {
    const next = Math.max(0, hours) * 60 + Math.max(0, Math.min(59, mins));
    onChange(next > 0 ? next : null);
  };
  return (
    <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
      <input id={id} type="number" min={0} className={inputClass + ' w-20'} value={value === undefined || value === null ? '' : h} aria-label={t('cat.duration.hours')} onChange={e => set(Number(e.target.value) || 0, m)} />
      <span>{t('cat.duration.hours')}</span>
      <input type="number" min={0} max={59} className={inputClass + ' w-20'} value={value === undefined || value === null ? '' : m} aria-label={t('cat.duration.minutes')} onChange={e => set(h, Number(e.target.value) || 0)} />
      <span>{t('cat.duration.minutes')}</span>
    </div>
  );
}

// ─── Choices ────────────────────────────────────────────────────────────────

function SelectControl({ id, field, value, onChange, className }: { id: string; field: CatalogField; value: unknown; onChange: (v: unknown) => void; className: string }) {
  const { t, language } = useLanguage();
  return (
    <select id={id} className={className} value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value || null)}>
      <option value="">{t('cat.select.none')}</option>
      {(field.options ?? []).map(o => (
        <option key={o.value} value={o.value}>{pickText(o.label, language) || o.value}</option>
      ))}
    </select>
  );
}

function MultiSelectControl({ field, value, onChange }: { field: CatalogField; value: unknown; onChange: (v: unknown) => void }) {
  const { language } = useLanguage();
  const list = Array.isArray(value) ? (value as string[]) : [];
  const toggle = (v: string) => onChange(list.includes(v) ? list.filter(x => x !== v) : [...list, v]);
  return (
    <div className="flex flex-wrap gap-1.5" role="group">
      {(field.options ?? []).map(o => {
        const on = list.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => toggle(o.value)}
            className={`px-2.5 py-1 rounded-full border text-[11px] font-bold cursor-pointer ${on ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}
          >
            {pickText(o.label, language) || o.value}
          </button>
        );
      })}
    </div>
  );
}

function TagsControl({ id, field, value, onChange }: { id: string; field: CatalogField; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState('');
  const tags = Array.isArray(value) ? (value as string[]) : [];
  const add = (raw: string) => {
    const tag = raw.trim();
    if (!tag || tags.includes(tag) || (field.max && tags.length >= field.max)) return;
    onChange([...tags, tag]);
  };
  const remaining = (field.suggestions ?? []).filter(s => !tags.includes(s));
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--btn-util-bg)] px-2 py-1.5">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[11px] text-[var(--text-primary)]">
            {tag}
            <button type="button" aria-label={t('cat.tags.remove', { tag })} onClick={() => onChange(tags.filter(x => x !== tag))} className="cursor-pointer opacity-70 hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={t('cat.tags.placeholder')}
          className="min-w-[8rem] flex-1 bg-transparent text-xs text-[var(--text-primary)] outline-none"
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add(draft);
              setDraft('');
            } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
              onChange(tags.slice(0, -1));
            }
          }}
          onBlur={() => { if (draft.trim()) { add(draft); setDraft(''); } }}
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {remaining.map(s => (
            <button key={s} type="button" onClick={() => add(s)} className="px-2 py-0.5 rounded-full border border-dashed border-[var(--border-subtle)] text-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TimeListControl({ id, value, onChange }: { id: string; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useLanguage();
  const times = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {times.map((time, i) => (
        <span key={i} className="inline-flex items-center gap-1">
          <input
            id={i === 0 ? id : undefined}
            type="time"
            className={inputClass + ' w-28'}
            value={time}
            aria-label={t('cat.time.n', { n: i + 1 })}
            onChange={e => onChange(times.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button type="button" aria-label={t('cat.time.remove')} onClick={() => onChange(times.filter((_, j) => j !== i))} className="cursor-pointer text-[var(--text-muted)] hover:text-red-400">
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}
      <button type="button" className={buttonClass} onClick={() => onChange([...times, times[times.length - 1] ?? '09:00'])}>
        <Plus className="w-3 h-3" /> {t('cat.time.add')}
      </button>
    </div>
  );
}

// ─── Geo ────────────────────────────────────────────────────────────────────

function GeoControl({ id, value, onChange }: { id: string; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useLanguage();
  const [showMap, setShowMap] = useState(false);
  const g = (value && typeof value === 'object' ? value : {}) as Partial<CatalogGeo>;
  const lat = typeof g.lat === 'number' ? g.lat : null;
  const lng = typeof g.lng === 'number' ? g.lng : null;
  const set = (next: Partial<CatalogGeo>) => onChange({ lat, lng, ...next });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <input id={id} type="number" step="0.000001" min={-90} max={90} className={inputClass + ' w-36'} value={lat ?? ''} aria-label={t('cat.geo.lat')} placeholder={t('cat.geo.lat')} onChange={e => set({ lat: toNumber(e.target.value) })} />
        <input type="number" step="0.000001" min={-180} max={180} className={inputClass + ' w-36'} value={lng ?? ''} aria-label={t('cat.geo.lng')} placeholder={t('cat.geo.lng')} onChange={e => set({ lng: toNumber(e.target.value) })} />
        <button type="button" className={buttonClass} onClick={() => setShowMap(s => !s)} aria-expanded={showMap}>
          <MapPin className="w-3 h-3" /> {showMap ? t('cat.geo.hideMap') : t('cat.geo.showMap')}
        </button>
      </div>
      {showMap && (
        <Suspense fallback={<div className="h-48 rounded-xl bg-[var(--btn-util-bg)] animate-pulse" />}>
          <GeoMap lat={lat} lng={lng} onPick={(la, ln) => onChange({ lat: la, lng: ln })} />
        </Suspense>
      )}
    </div>
  );
}

// ─── Gallery ────────────────────────────────────────────────────────────────

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('read failed'));
    r.readAsDataURL(file);
  });
}

/** Uploads through the media library (base64 dataUrl); the first photo is the cover. */
function GalleryControl({ id, field, value, onChange, flagged }: { id: string; field: CatalogField; value: unknown; onChange: (v: unknown) => void; flagged: boolean }) {
  const { t } = useLanguage();
  const images = Array.isArray(value) ? (value as string[]) : [];
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const latest = useRef(images);
  latest.current = images;
  const max = field.max ?? 20;

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= images.length) return;
    const next = images.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const room = Math.max(0, max - images.length);
    const list = Array.from(files).slice(0, room);
    for (const file of list) {
      setUploading(n => n + 1);
      try {
        const dataUrl = await readAsDataUrl(file);
        const res = await api.uploadCmsMedia({ dataUrl, filename: file.name, category: 'catalog' });
        const url = res.asset?.original_url ?? res.asset?.url;
        if (typeof url === 'string') {
          latest.current = [...latest.current, url];
          onChange(latest.current);
        }
      } catch (err) {
        setError((err as Error)?.message || t('cat.gallery.failed'));
      } finally {
        setUploading(n => n - 1);
      }
    }
  };

  return (
    <div className="space-y-2">
      <ul className={`grid grid-cols-3 sm:grid-cols-5 gap-2 rounded-xl ${flagged && images.length === 0 ? 'border border-dashed border-red-500/60 p-2' : ''}`} aria-label={t('cat.gallery.hint')}>
        {images.map((src, i) => (
          <li
            key={`${src}-${i}`}
            draggable
            data-testid="gallery-item"
            onDragStart={() => { dragFrom.current = i; }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); if (dragFrom.current !== null) move(dragFrom.current, i); dragFrom.current = null; }}
            className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--btn-util-bg)] cursor-grab group"
          >
            <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            {i === 0 && (
              <span className="absolute top-1 start-1 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white">
                <Star className="w-2.5 h-2.5" aria-hidden="true" /> {t('cat.gallery.cover')}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100">
              <button type="button" aria-label={t('cat.gallery.moveEarlier')} onClick={() => move(i, i - 1)} disabled={i === 0} className="p-1 text-white disabled:opacity-30 cursor-pointer">
                <ArrowLeft className="w-3 h-3 rtl:rotate-180" />
              </button>
              <button type="button" aria-label={t('cat.gallery.remove')} onClick={() => onChange(images.filter((_, j) => j !== i))} className="p-1 text-red-300 cursor-pointer">
                <Trash2 className="w-3 h-3" />
              </button>
              <button type="button" aria-label={t('cat.gallery.moveLater')} onClick={() => move(i, i + 1)} disabled={i === images.length - 1} className="p-1 text-white disabled:opacity-30 cursor-pointer">
                <ArrowRight className="w-3 h-3 rtl:rotate-180" />
              </button>
            </div>
          </li>
        ))}
        {images.length < max && (
          <li>
            <label className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-subtle)] text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
              {uploading > 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
              {uploading > 0 ? t('cat.gallery.uploading') : t('cat.gallery.upload')}
              <input id={id} type="file" accept="image/*" multiple className="sr-only" onChange={e => { void upload(e.target.files); e.target.value = ''; }} />
            </label>
          </li>
        )}
      </ul>
      <p className="text-[10px] text-[var(--text-muted)]">
        {t('cat.gallery.hint')} · {t('cat.gallery.count', { count: images.length, max })}
      </p>
      {error && <p role="alert" className="text-[11px] text-red-400">{error}</p>}
    </div>
  );
}

// ─── Supplier ───────────────────────────────────────────────────────────────

let supplierCache: Promise<SupplierEntity[]> | null = null;
function loadSuppliers(): Promise<SupplierEntity[]> {
  if (!supplierCache) {
    supplierCache = api.getCommerceSuppliers().then(r => r.suppliers ?? []).catch(err => {
      supplierCache = null;
      throw err;
    });
  }
  return supplierCache;
}

export function useSuppliers(): SupplierEntity[] {
  const [list, setList] = useState<SupplierEntity[]>([]);
  useEffect(() => {
    let alive = true;
    loadSuppliers().then(l => { if (alive) setList(l); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  return list;
}

function SupplierControl({ id, value, onChange, className }: { id: string; value: unknown; onChange: (v: unknown) => void; className: string }) {
  const { t, language } = useLanguage();
  const suppliers = useSuppliers();
  const current = typeof value === 'string' ? value : '';
  const options = useMemo(() => {
    const list = suppliers.map(s => ({ id: s.id, name: (language === 'ar' && s.businessNameAr) || s.businessName }));
    if (current && !list.some(o => o.id === current)) list.unshift({ id: current, name: current });
    return list;
  }, [suppliers, current, language]);
  return (
    <select id={id} className={className} value={current} onChange={e => onChange(e.target.value || null)}>
      <option value="">{t('cat.supplier.none')}</option>
      {options.map(o => (
        <option key={o.id} value={o.id}>{o.name}</option>
      ))}
    </select>
  );
}

// ─── Package day plan ───────────────────────────────────────────────────────

function DayPlanControl({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useLanguage();
  const days: CatalogPlanDay[] = Array.isArray(value)
    ? (value as Partial<CatalogPlanDay>[]).map((d, i) => ({
        day: i + 1,
        title: normalizeI18n(d?.title),
        description: normalizeI18n(d?.description),
        ...(Array.isArray(d?.activityIds) ? { activityIds: d.activityIds } : {}),
      }))
    : [];
  const commit = (next: CatalogPlanDay[]) => onChange(next.map((d, i) => ({ ...d, day: i + 1 })));
  const update = (i: number, patch: Partial<CatalogPlanDay>) => commit(days.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= days.length) return;
    const next = days.slice();
    const [d] = next.splice(i, 1);
    next.splice(to, 0, d);
    commit(next);
  };
  const dayField = (key: 'title' | 'description'): CatalogField => ({ key, kind: key === 'title' ? 'i18nText' : 'i18nTextarea', max: key === 'title' ? 120 : 1000 });
  return (
    <div className="space-y-3">
      {days.map((d, i) => (
        <div key={i} className="rounded-xl border border-[var(--border-subtle)] p-3 space-y-2" data-testid="dayplan-day">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--text-primary)]">{t('cat.dayPlan.day', { n: i + 1 })}</span>
            <div className="flex items-center gap-1">
              <button type="button" aria-label={t('cat.dayPlan.up')} disabled={i === 0} onClick={() => move(i, i - 1)} className="p-1 cursor-pointer disabled:opacity-30 text-[var(--text-muted)]"><ArrowUp className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label={t('cat.dayPlan.down')} disabled={i === days.length - 1} onClick={() => move(i, i + 1)} className="p-1 cursor-pointer disabled:opacity-30 text-[var(--text-muted)]"><ArrowDown className="w-3.5 h-3.5" /></button>
              <button type="button" aria-label={t('cat.dayPlan.remove')} onClick={() => commit(days.filter((_, j) => j !== i))} className="p-1 cursor-pointer text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
          <span className="block text-[10px] font-bold text-[var(--text-muted)]">{t('cat.dayPlan.title')}</span>
          <I18nControl id={`cat-day-${i}-title`} field={dayField('title')} value={d.title} onChange={v => update(i, { title: normalizeI18n(v) })} flagged={false} />
          <span className="block text-[10px] font-bold text-[var(--text-muted)]">{t('cat.dayPlan.description')}</span>
          <I18nControl id={`cat-day-${i}-desc`} field={dayField('description')} value={d.description} onChange={v => update(i, { description: normalizeI18n(v) })} flagged={false} />
        </div>
      ))}
      <button type="button" className={buttonClass} onClick={() => commit([...days, { day: days.length + 1, title: { en: '', ar: '' }, description: { en: '', ar: '' } }])}>
        <Plus className="w-3 h-3" /> {t('cat.dayPlan.add')}
      </button>
    </div>
  );
}

// ─── JSON ───────────────────────────────────────────────────────────────────

function JsonControl({ id, value, onChange }: { id: string; value: unknown; onChange: (v: unknown) => void }) {
  const { t } = useLanguage();
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value, null, 2)));
  const [invalid, setInvalid] = useState(false);
  return (
    <div className="space-y-1">
      <textarea
        id={id}
        dir="ltr"
        rows={5}
        spellCheck={false}
        className={`${inputClass} font-mono ${invalid ? 'border-red-500/60' : ''}`}
        value={text}
        onChange={e => {
          setText(e.target.value);
          if (e.target.value.trim() === '') { setInvalid(false); onChange(null); return; }
          try {
            onChange(JSON.parse(e.target.value));
            setInvalid(false);
          } catch {
            setInvalid(true);
          }
        }}
      />
      {invalid && <p role="alert" className="text-[10px] text-red-400">{t('cat.json.invalid')}</p>}
    </div>
  );
}

export default FormEngine;
