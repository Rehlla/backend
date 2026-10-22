import React from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { problemSlug } from '../../../../services/api';
import { useMutationRunner } from '../control/controlShared';
import type {
  CatalogEnvelope,
  CatalogField,
  CatalogSectionSchema,
  CatalogStatus,
  CatalogTypeSchema,
  CatalogWriteBody,
  I18nString,
} from '../../../../types/catalog';

/**
 * Pure helpers shared by the catalogue screens: reading and writing envelope
 * values by schema field key, the client-side "what is missing" check that
 * keeps Publish disabled, price-jump detection (> 30% needs a reason) and the
 * mapping of catalogue problems (409 stale / in-use, 422 incomplete) to copy.
 */

export type FormValues = Record<string, unknown>;

/** Field keys that live on the envelope itself rather than in `fields`. */
const TOP_LEVEL_KEYS = new Set(['title', 'summary', 'images', 'supplierId']);

export const PRICE_JUMP_RATIO = 0.3;

export function pickText(s: Partial<I18nString> | undefined | null, language: string): string {
  if (!s) return '';
  const own = language === 'ar' ? s.ar : s.en;
  return own || s.en || s.ar || '';
}

export function humanizeKey(key: string): string {
  return key
    .replace(/EGP$/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/^./, c => c.toUpperCase());
}

export function fieldLabel(field: CatalogField, language: string): string {
  return pickText(field.label, language) || humanizeKey(field.key);
}

export function allFields(schema: CatalogTypeSchema): CatalogField[] {
  return schema.sections.flatMap(s => s.fields);
}

export function getValue(env: Partial<CatalogEnvelope> | null | undefined, key: string): unknown {
  if (!env) return undefined;
  if (TOP_LEVEL_KEYS.has(key)) return (env as Record<string, unknown>)[key];
  const fromFields = env.fields?.[key];
  if (fromFields !== undefined) return fromFields;
  return (env as Record<string, unknown>)[key];
}

export function valuesFromEnvelope(schema: CatalogTypeSchema, env: Partial<CatalogEnvelope> | null | undefined): FormValues {
  const out: FormValues = {};
  for (const f of allFields(schema)) {
    const v = getValue(env, f.key);
    if (v !== undefined) out[f.key] = v;
  }
  return out;
}

/** Builds a write body from form values; `keys` limits it to the changed fields (PATCH). */
export function bodyFromValues(values: FormValues, keys?: Iterable<string>): CatalogWriteBody {
  const body: CatalogWriteBody = {};
  const fields: Record<string, unknown> = {};
  const list = keys ? Array.from(keys) : Object.keys(values);
  for (const key of list) {
    const v = values[key];
    if (key === 'title' || key === 'summary') body[key] = normalizeI18n(v);
    else if (key === 'images') body.images = Array.isArray(v) ? (v as string[]) : [];
    else if (key === 'supplierId') body.supplierId = typeof v === 'string' && v ? v : null;
    else fields[key] = v;
  }
  if (Object.keys(fields).length > 0) body.fields = fields;
  return body;
}

export function normalizeI18n(v: unknown): I18nString {
  const o = (v && typeof v === 'object' ? v : {}) as Partial<I18nString>;
  return { en: typeof o.en === 'string' ? o.en : '', ar: typeof o.ar === 'string' ? o.ar : '' };
}

export function isEmptyValue(field: CatalogField, v: unknown): boolean {
  if (v === undefined || v === null) return true;
  switch (field.kind) {
    case 'i18nText':
    case 'i18nTextarea': {
      const o = normalizeI18n(v);
      return !o.en.trim() || !o.ar.trim();
    }
    case 'gallery':
      return !Array.isArray(v) || v.length < Math.max(1, field.min ?? 1);
    case 'tags':
    case 'multiselect':
    case 'timeList':
    case 'dayPlan':
      return !Array.isArray(v) || v.length < Math.max(1, field.min ?? 1);
    case 'geo': {
      const g = v as { lat?: unknown; lng?: unknown };
      return typeof g.lat !== 'number' || typeof g.lng !== 'number';
    }
    case 'number':
    case 'money':
    case 'duration':
      return typeof v !== 'number' || Number.isNaN(v) || (field.kind === 'money' && v <= 0);
    case 'boolean':
      return false;
    default:
      return typeof v === 'string' ? v.trim() === '' : false;
  }
}

/** Required fields still empty (a gallery with a `min` counts as required). */
export function missingFields(sections: CatalogSectionSchema[], values: FormValues): CatalogField[] {
  const out: CatalogField[] = [];
  for (const s of sections) {
    for (const f of s.fields) {
      const required = f.required || (f.kind === 'gallery' && (f.min ?? 0) > 0);
      if (required && isEmptyValue(f, values[f.key])) out.push(f);
    }
  }
  return out;
}

export function completenessOf(sections: CatalogSectionSchema[], values: FormValues): number {
  const req = sections.flatMap(s => s.fields).filter(f => f.required || (f.kind === 'gallery' && (f.min ?? 0) > 0));
  if (req.length === 0) return 1;
  return (req.length - missingFields(sections, values).length) / req.length;
}

/** The schema's price field: `priceFromEGP` when present, else the first money field. */
export function priceFieldKey(schema: CatalogTypeSchema): string | null {
  const money = allFields(schema).filter(f => f.kind === 'money');
  return money.find(f => f.key === 'priceFromEGP')?.key ?? money[0]?.key ?? null;
}

/** True when a price moves by more than 30% from a positive previous value. */
export function isPriceJump(before: unknown, after: unknown): boolean {
  if (typeof before !== 'number' || typeof after !== 'number' || before <= 0) return false;
  return Math.abs(after - before) / before > PRICE_JUMP_RATIO;
}

export function formatEGP(n: number | null | undefined, language: string): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString(language === 'ar' ? 'ar-EG' : 'en-US')} EGP`;
}

// ─── Problems ───────────────────────────────────────────────────────────────

export function errorStatus(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status;
  return typeof s === 'number' ? s : null;
}

export function isInUse(err: unknown): boolean {
  return errorStatus(err) === 409 && problemSlug(err) === 'in-use';
}

/** 409 from a stale If-Match (`.../stale`; `conflict` is a different refusal). */
export function isStale(err: unknown): boolean {
  return errorStatus(err) === 409 && problemSlug(err) === 'stale';
}

export function incompleteKeys(err: unknown): string[] | null {
  if (errorStatus(err) !== 422) return null;
  const missing = (err as { details?: { missing?: unknown } }).details?.missing;
  return Array.isArray(missing) ? missing.filter((m): m is string => typeof m === 'string') : [];
}

// ─── Status chip ────────────────────────────────────────────────────────────

export const STATUSES: CatalogStatus[] = ['draft', 'review', 'published', 'hidden', 'archived'];

const STATUS_TONE: Record<string, string> = {
  draft: 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-[var(--border-subtle)]',
  review: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  published: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  hidden: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  archived: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export function StatusChip({ status }: { status: CatalogStatus | string }) {
  const { t } = useLanguage();
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_TONE[status] ?? STATUS_TONE.draft}`}>
      {STATUSES.includes(status as CatalogStatus) ? t(`cat.status.${status}`) : status}
    </span>
  );
}

export function CompletenessBar({ value, className = '' }: { value: number; className?: string }) {
  const { t } = useLanguage();
  const pct = Math.round(Math.max(0, Math.min(1, value || 0)) * 100);
  const tone = pct >= 100 ? 'bg-emerald-400' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className={`flex items-center gap-2 ${className}`} title={t('cat.completeness', { pct })}>
      <div
        className="h-1.5 w-16 rounded-full bg-[var(--btn-util-bg)] overflow-hidden"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('cat.completeness', { pct })}
      >
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-[var(--text-muted)]">{pct}%</span>
    </div>
  );
}

/** "Missing: Title (Arabic), Photos" — what keeps Publish disabled. */
export function MissingList({ fields, extraKeys = [] }: { fields: CatalogField[]; extraKeys?: string[] }) {
  const { t, language } = useLanguage();
  const labels = [...fields.map(f => fieldLabel(f, language))];
  for (const k of extraKeys) {
    if (!fields.some(f => f.key === k)) labels.push(humanizeKey(k));
  }
  if (labels.length === 0) return null;
  return (
    <div role="status" data-testid="catalog-missing" className="text-[11px] text-amber-400">
      <span className="font-bold">{t('cat.missing')}</span> {labels.join(language === 'ar' ? '، ' : ', ')}
    </div>
  );
}

// ─── Mutation runner ────────────────────────────────────────────────────────

/** True when a write answered 202 `{ queuedForApproval: true }` (envelope or rates result). */
export function isQueuedForApproval(result: unknown): boolean {
  return Boolean(result && typeof result === 'object' && (result as { queuedForApproval?: unknown }).queuedForApproval === true);
}

/**
 * useMutationRunner plus the catalogue problems: a 422 incomplete names the
 * missing fields, a 409 in-use / stale gets its own sentence. When `fn`
 * resolves to a write the server queued for approval (202), the notice says
 * "Sent for review" instead of the success text.
 */
export function useCatalogRunner() {
  const { t } = useLanguage();
  const base = useMutationRunner();
  const { setNotice, describeError } = base;
  const [busy, setBusy] = React.useState(false);
  const run = React.useCallback(
    async (fn: () => Promise<unknown>, successText?: string): Promise<boolean> => {
      setBusy(true);
      try {
        const result = await fn();
        setNotice(
          isQueuedForApproval(result)
            ? { kind: 'info', text: t('cat.notice.sentForReview') }
            : { kind: 'success', text: successText ?? t('ctl.notice.saved') }
        );
        return true;
      } catch (err) {
        const missing = incompleteKeys(err);
        if (missing) {
          setNotice({ kind: 'error', text: t('cat.notice.incomplete', { fields: missing.map(humanizeKey).join(', ') || '—' }) });
        } else if (isInUse(err)) {
          setNotice({ kind: 'error', text: t('cat.notice.inUse') });
        } else if (isStale(err)) {
          setNotice({ kind: 'error', text: t('cat.notice.stale') });
        } else {
          setNotice(describeError(err));
        }
        return false;
      } finally {
        setBusy(false);
      }
    },
    [describeError, setNotice, t]
  );
  return { ...base, run, busy };
}

// ─── Types, permissions, icons ──────────────────────────────────────────────

/** The permission area for a catalogue type (`catalog.<area>.view|manage|publish`). */
export function permissionArea(type: string): string {
  if (type.startsWith('transfer')) return 'transfers';
  if (type === 'activity') return 'activities';
  if (type === 'package') return 'packages';
  if (type === 'hotel') return 'hotels';
  if (type === 'restaurant') return 'restaurants';
  return `${type}s`;
}

export const CATALOG_VIEW_PERMISSIONS = [
  'catalog.activities.view',
  'catalog.packages.view',
  'catalog.transfers.view',
  'catalog.hotels.view',
  'catalog.restaurants.view',
] as const;

/** Top-level types: those no other type lists as a child item type. */
export function topLevelTypes(types: CatalogTypeSchema[]): CatalogTypeSchema[] {
  const childTypes = new Set(types.flatMap(t => (t.children ?? []).map(c => c.itemType).filter(Boolean) as string[]));
  return types.filter(t => !childTypes.has(t.type));
}
