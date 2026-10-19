import { db } from '../../db/database';
import {
  CatalogError,
  type FieldDef,
  type FieldOption,
  type FieldSchema,
  type I18n,
  type MetaView,
  type SectionDef,
  type SectionSchema,
} from './types';

/**
 * Schema-driven validation, normalisation and completeness for catalogue
 * fields. Every write goes through normalizeValue(), so an adapter's `set`
 * only ever receives a value of the right shape.
 */

export const L = (en: string, ar: string): I18n => ({ en, ar });

export const opt = (value: string, en: string, ar: string): FieldOption => ({ value, label: L(en, ar) });

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
/** Images live under the CMS media route, the self-hosted /images tree, or https. */
const IMAGE_RE = /^(\/api\/media\/|\/images\/|https:\/\/)[^\s<>"']{1,500}$/;

const DEFAULT_TEXT_MAX: Record<string, number> = { text: 200, i18nText: 200, i18nTextarea: 4000 };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const bad = (key: string, message: string) => new CatalogError(400, `${key}: ${message}`, 'bad-request', { field: key });

function str(key: string, v: unknown, max: number): string {
  if (typeof v !== 'string') throw bad(key, 'must be a string.');
  const t = v.trim();
  if (t.length > max) throw bad(key, `must be at most ${max} characters.`);
  return t;
}

function strList(key: string, v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) throw bad(key, 'must be an array of strings.');
  if (v.length > maxItems) throw bad(key, `must have at most ${maxItems} items.`);
  const out: string[] = [];
  for (const item of v) {
    const s = str(key, item, maxLen);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

function num(key: string, v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw bad(key, 'must be a number.');
  if (v < min || v > max) throw bad(key, `must be between ${min} and ${max}.`);
  return v;
}

/**
 * Validates one incoming value against its field schema and returns the
 * normalised value. `null` clears an optional field (passed to `set` as
 * undefined); it is refused for kinds that cannot be empty.
 */
export function normalizeValue(f: FieldSchema, raw: unknown, current: unknown): unknown {
  const key = f.key;
  if (raw === null) {
    if (f.kind === 'boolean') throw bad(key, 'must be true or false.');
    if (['tags', 'multiselect', 'timeList', 'gallery', 'dayPlan'].includes(f.kind)) return [];
    if (f.kind === 'i18nText' || f.kind === 'i18nTextarea') return { en: '', ar: '' };
    return undefined;
  }
  switch (f.kind) {
    case 'text':
      return str(key, raw, f.max ?? DEFAULT_TEXT_MAX.text);
    case 'i18nText':
    case 'i18nTextarea': {
      const max = f.max ?? DEFAULT_TEXT_MAX[f.kind];
      if (typeof raw === 'string') throw bad(key, 'must be an object { en, ar }.');
      if (!isObj(raw)) throw bad(key, 'must be an object { en, ar }.');
      const base = isObj(current) ? (current as Partial<I18n>) : {};
      const out: I18n = { en: typeof base.en === 'string' ? base.en : '', ar: typeof base.ar === 'string' ? base.ar : '' };
      for (const lang of ['en', 'ar'] as const) {
        if (raw[lang] !== undefined) out[lang] = str(`${key}.${lang}`, raw[lang] ?? '', max);
      }
      return out;
    }
    case 'number':
      return num(key, raw, f.min ?? 0, f.max ?? 10_000_000);
    case 'duration':
      return Math.round(num(key, raw, f.min ?? 0, f.max ?? 60 * 24 * 60));
    case 'money':
      return Math.round(num(key, raw, f.min ?? 0, f.max ?? 10_000_000));
    case 'boolean':
      if (typeof raw !== 'boolean') throw bad(key, 'must be true or false.');
      return raw;
    case 'select': {
      const v = str(key, raw, 200);
      if (f.options?.length && !f.options.some(o => o.value === v)) throw bad(key, `"${v}" is not one of the allowed options.`);
      return v;
    }
    case 'multiselect': {
      const list = strList(key, raw, f.max ?? 50, 200);
      const bad1 = f.options?.length ? list.find(v => !f.options!.some(o => o.value === v)) : undefined;
      if (bad1 !== undefined) throw bad(key, `"${bad1}" is not one of the allowed options.`);
      return list;
    }
    case 'tags':
      return strList(key, raw, f.max ?? 50, 80);
    case 'time': {
      const v = str(key, raw, 5);
      if (!TIME_RE.test(v)) throw bad(key, 'must be HH:MM (24h).');
      return v;
    }
    case 'timeList': {
      const list = strList(key, raw, f.max ?? 24, 5);
      const wrong = list.find(v => !TIME_RE.test(v));
      if (wrong !== undefined) throw bad(key, `"${wrong}" must be HH:MM (24h).`);
      return list.sort();
    }
    case 'geo': {
      if (!isObj(raw)) throw bad(key, 'must be { lat, lng }.');
      return { lat: num(`${key}.lat`, raw.lat, -90, 90), lng: num(`${key}.lng`, raw.lng, -180, 180) };
    }
    case 'gallery': {
      const list = strList(key, raw, f.max ?? 20, 520);
      const wrong = list.find(v => !IMAGE_RE.test(v));
      if (wrong !== undefined) throw bad(key, `"${wrong.slice(0, 60)}" is not an uploaded image URL (/api/media/...).`);
      return list;
    }
    case 'supplier': {
      const v = str(key, raw, 128);
      if (!db.suppliers.some(s => s.id === v)) throw bad(key, `supplier "${v}" does not exist.`);
      return v;
    }
    case 'dayPlan':
      return normalizeDayPlan(key, raw, f.max ?? 60);
    case 'json': {
      const size = JSON.stringify(raw ?? null).length;
      if (size > 20_000) throw bad(key, 'is too large (20 KB max).');
      return raw;
    }
  }
}

function normalizeDayPlan(key: string, raw: unknown, maxDays: number) {
  if (!Array.isArray(raw)) throw bad(key, 'must be an array of days.');
  if (raw.length > maxDays) throw bad(key, `must have at most ${maxDays} days.`);
  return raw.map((d, i) => {
    if (!isObj(d)) throw bad(`${key}[${i}]`, 'must be an object.');
    const day = d.day === undefined ? i + 1 : Math.round(num(`${key}[${i}].day`, d.day, 1, 366));
    const text = (k: string, max: number) => (d[k] === undefined || d[k] === null ? '' : str(`${key}[${i}].${k}`, d[k], max));
    const skus = d.activitySkuIds === undefined ? [] : strList(`${key}[${i}].activitySkuIds`, d.activitySkuIds, 20, 128);
    return {
      day,
      titleEn: text('titleEn', 200),
      titleAr: text('titleAr', 200),
      bodyEn: text('bodyEn', 2000),
      bodyAr: text('bodyAr', 2000),
      activitySkuIds: skus,
    };
  });
}

/** True when a required field counts as filled for completeness. */
export function isFilled(f: FieldSchema, v: unknown): boolean {
  switch (f.kind) {
    case 'i18nText':
    case 'i18nTextarea':
      return isObj(v) && typeof v.en === 'string' && !!v.en.trim() && typeof v.ar === 'string' && !!v.ar.trim();
    case 'money':
      return typeof v === 'number' && v > 0;
    case 'number':
    case 'duration':
      return typeof v === 'number' && Number.isFinite(v) && v > 0;
    case 'boolean':
      return typeof v === 'boolean';
    case 'gallery':
    case 'tags':
    case 'multiselect':
    case 'timeList':
    case 'dayPlan':
      return Array.isArray(v) && v.length >= Math.max(1, f.min ?? 1);
    case 'geo':
      return isObj(v) && typeof v.lat === 'number' && typeof v.lng === 'number';
    default:
      return typeof v === 'string' ? !!v.trim() : v !== undefined && v !== null;
  }
}

export function allFields<E>(sections: SectionDef<E>[]): FieldDef<E>[] {
  return sections.flatMap(s => s.fields);
}

/** Required fields plus a gallery with a minimum: those are what publishing needs. */
export function completenessOf<E>(sections: SectionDef<E>[], e: E, meta: MetaView): { completeness: number; missing: string[] } {
  const needed = allFields(sections).filter(f => f.required || (f.kind === 'gallery' && (f.min ?? 0) > 0));
  if (needed.length === 0) return { completeness: 1, missing: [] };
  const missing = needed.filter(f => !isFilled(f, f.get(e, meta))).map(f => f.key);
  return { completeness: Math.round(((needed.length - missing.length) / needed.length) * 100) / 100, missing };
}

/** Projects the bindings onto the public schema (drops get/set). */
export function toSchemaSections<E>(sections: SectionDef<E>[]): SectionSchema[] {
  return sections.map(s => ({
    key: s.key,
    label: s.label,
    fields: s.fields.map(({ get: _g, set, ...schema }) => (set ? schema : { ...schema, readOnly: true })),
  }));
}

/** Keys lifted to the top of the envelope rather than kept in `fields`. */
export const TOP_LEVEL_KEYS = new Set(['title', 'summary', 'images', 'supplierId']);

/**
 * Applies `values` (already merged from body top-level + body.fields) onto
 * the entity. Unknown and read-only keys are a 400 so a typo never silently
 * drops an edit.
 */
export function applyValues<E>(sections: SectionDef<E>[], e: E, meta: MetaView, values: Record<string, unknown>): string[] {
  const byKey = new Map(allFields(sections).map(f => [f.key, f]));
  const changed: string[] = [];
  for (const [key, raw] of Object.entries(values)) {
    if (raw === undefined) continue;
    const f = byKey.get(key);
    if (!f) throw bad(key, 'is not a field of this type.');
    if (!f.set) throw bad(key, 'is read-only.');
    const value = normalizeValue(f, raw, f.get(e, meta));
    f.set(e, value, meta);
    changed.push(key);
  }
  return changed;
}

/** i18n helpers for bindings over `xEn`/`xAr` or `x`/`xAr` column pairs. */
export const pair = (en: unknown, ar: unknown): I18n => ({
  en: typeof en === 'string' ? en : '',
  ar: typeof ar === 'string' ? ar : '',
});

export const areaOptions = (): FieldOption[] =>
  db.areaProfiles.map(a => opt(a.id, a.nameEn, a.nameAr)).sort((a, b) => a.label.en.localeCompare(b.label.en));

export const supplierSuggestionsFor = (category?: string): string[] =>
  db.suppliers.filter(s => !category || s.category === category).map(s => s.id).slice(0, 200);
