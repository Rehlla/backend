import crypto from 'crypto';
import { db } from '../../db/database';
import type { CatalogStatus, ProductSkuEntity } from '../../db/schema';
import { L } from './fields';
import { CatalogError, type FieldDef, type MetaView } from './types';

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

export const skuById = (id: string | undefined): ProductSkuEntity | undefined =>
  id ? db.productSkus.find(s => s.id === id) : undefined;

export const activeStatus = (active: boolean): CatalogStatus => (active ? 'published' : 'hidden');

export const slugify = (text: string) =>
  text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'item';

/** "08:30" -> "08:30 AM", the label format SKU time slots and inventory slots use. */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "08:30 AM (Morning Dive)" -> "08:30"; labels without a clock -> null. */
export function to24h(label: string): string | null {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(label);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ampm = m[3]?.toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** The catalogue gallery stored on the meta row, seeded from an entity cover when never edited. */
export function galleryField<E>(fallback: (e: E) => string[], onSet?: (e: E, images: string[]) => void): FieldDef<E> {
  return {
    key: 'images',
    kind: 'gallery',
    label: L('Photos', 'الصور'),
    min: 1,
    max: 20,
    help: L('The first photo is the cover. Upload via /api/admin/content/media/upload.', 'الصورة الأولى هي الغلاف.'),
    get: (e, meta) => meta.images ?? fallback(e),
    set: (e, v: string[], meta) => {
      meta.images = v;
      onSet?.(e, v);
    },
  };
}

export function supplierField<E>(
  get: (e: E) => string | null,
  set: (e: E, v: string | null) => void,
  required = false
): FieldDef<E> {
  return {
    key: 'supplierId',
    kind: 'supplier',
    label: L('Supplier', 'المورد'),
    required,
    get: e => get(e),
    set: (e, v) => set(e, v ?? null),
  };
}

/** Reads a value kept on the meta row's `extra` bag. */
export const extra = (meta: MetaView, key: string): unknown => meta.extra[key];

export const conflict = (message: string, slug = 'conflict', extraBody: Record<string, unknown> = {}) =>
  new CatalogError(409, message, slug, extraBody);

export const DAY_MS = 86_400_000;

/** Inclusive YYYY-MM-DD range, optionally filtered by weekday (0 = Sunday), capped. */
export function dateRange(from: string, to: string, weekdays: number[] | undefined, maxDays: number): string[] {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new CatalogError(400, 'from/to must be YYYY-MM-DD dates.');
  if (end < start) throw new CatalogError(400, 'to must not be before from.');
  if ((end - start) / DAY_MS + 1 > maxDays) throw new CatalogError(400, `The range spans more than ${maxDays} days — split it.`);
  const out: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const d = new Date(t);
    if (weekdays && weekdays.length && !weekdays.includes(d.getUTCDay())) continue;
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}
