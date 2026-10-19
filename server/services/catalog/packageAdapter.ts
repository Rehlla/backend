import { db } from '../../db/database';
import type { TripPackageDay, TripPackageEntity } from '../../db/schema';
import { L, pair } from './fields';
import { newId, supplierField } from './common';
import { CatalogError, type CatalogAdapter, type ChildAdapter, type SectionDef } from './types';

/** package = db.tripPackages (new). Days are an embedded array, also exposed as the `days` child. */

type P = TripPackageEntity;

function sections(): SectionDef<P>[] {
  return [
    {
      key: 'basics',
      label: L('Basics', 'الأساسيات'),
      fields: [
        { key: 'title', kind: 'i18nText', required: true, max: 120, label: L('Title', 'العنوان'), get: p => pair(p.titleEn, p.titleAr), set: (p, v) => { p.titleEn = v.en; p.titleAr = v.ar; } },
        { key: 'summary', kind: 'i18nTextarea', required: true, max: 600, label: L('Summary', 'الملخص'), get: p => pair(p.summaryEn, p.summaryAr), set: (p, v) => { p.summaryEn = v.en; p.summaryAr = v.ar; } },
        { key: 'durationDays', kind: 'number', required: true, min: 1, max: 60, label: L('Duration (days)', 'المدة (أيام)'), get: p => p.durationDays, set: (p, v) => { p.durationDays = Math.round(v ?? 1); } },
        supplierField<P>(p => p.supplierId ?? null, (p, v) => { p.supplierId = v ?? undefined; }),
      ],
    },
    {
      key: 'media',
      label: L('Photos', 'الصور'),
      fields: [
        {
          key: 'images', kind: 'gallery', min: 1, max: 20, label: L('Photos', 'الصور'),
          help: L('The first photo is the cover.', 'الصورة الأولى هي الغلاف.'),
          get: p => p.images.length ? p.images : p.coverImage ? [p.coverImage] : [],
          set: (p, v: string[]) => { p.images = v; p.coverImage = v[0]; },
        },
      ],
    },
    {
      key: 'pricing',
      label: L('Price', 'السعر'),
      fields: [
        { key: 'priceFromEGP', kind: 'money', required: true, label: L('Starting price (EGP)', 'السعر يبدأ من (جنيه)'), get: p => p.startingPriceEGP, set: (p, v) => { p.startingPriceEGP = v ?? 0; } },
        { key: 'priceIsEstimate', kind: 'boolean', label: L('Price is an estimate', 'السعر تقديري'), get: p => p.priceIsEstimate, set: (p, v) => { p.priceIsEstimate = v; } },
      ],
    },
    {
      key: 'programme',
      label: L('Day by day', 'البرنامج اليومي'),
      fields: [
        {
          key: 'days', kind: 'dayPlan', required: true, min: 1, max: 60, label: L('Days', 'الأيام'),
          help: L('[{ day, titleEn, titleAr, bodyEn, bodyAr, activitySkuIds[] }]', '[{ day, titleEn, titleAr, bodyEn, bodyAr, activitySkuIds[] }]'),
          get: p => p.days,
          set: (p, v: TripPackageDay[]) => { p.days = v.sort((a, b) => a.day - b.day); },
        },
        { key: 'includedEn', kind: 'tags', label: L("What's included (EN)", 'المشمول (إنجليزي)'), get: p => p.includedEn, set: (p, v) => { p.includedEn = v; } },
        { key: 'includedAr', kind: 'tags', label: L("What's included (AR)", 'المشمول (عربي)'), get: p => p.includedAr, set: (p, v) => { p.includedAr = v; } },
      ],
    },
  ];
}

const dayId = (d: TripPackageDay) => `day-${d.day}`;

export const daysChild: ChildAdapter<P, TripPackageDay> = {
  key: 'days',
  itemType: 'package-day',
  label: L('Days', 'الأيام'),
  sections: () => [
    {
      key: 'day',
      label: L('Day', 'اليوم'),
      fields: [
        { key: 'day', kind: 'number', required: true, min: 1, max: 366, label: L('Day number', 'رقم اليوم'), get: d => d.day, set: (d, v) => { d.day = Math.round(v ?? 1); } },
        { key: 'title', kind: 'i18nText', required: true, max: 200, label: L('Title', 'العنوان'), get: d => pair(d.titleEn, d.titleAr), set: (d, v) => { d.titleEn = v.en; d.titleAr = v.ar; } },
        { key: 'summary', kind: 'i18nTextarea', max: 2000, label: L('Plan', 'الخطة'), get: d => pair(d.bodyEn, d.bodyAr), set: (d, v) => { d.bodyEn = v.en; d.bodyAr = v.ar; } },
        { key: 'activitySkuIds', kind: 'tags', max: 20, label: L('Activities (SKU ids)', 'الأنشطة'), get: d => d.activitySkuIds, set: (d, v) => { d.activitySkuIds = v; } },
      ],
    },
  ],
  list: p => p.days,
  find: (p, id) => p.days.find(d => dayId(d) === id),
  idOf: dayId,
  blank: p => ({ day: (p.days.reduce((m, d) => Math.max(m, d.day), 0) || 0) + 1, titleEn: '', titleAr: '', bodyEn: '', bodyAr: '', activitySkuIds: [] }),
  insert: (p, d) => { p.days.push(d); },
  afterWrite: (p, d) => {
    if (p.days.filter(o => o.day === d.day).length > 1) throw new CatalogError(409, `Day ${d.day} already exists.`, 'conflict');
    p.days.sort((a, b) => a.day - b.day);
  },
  inUse: () => null,
  remove: (p, d) => { p.days.splice(p.days.indexOf(d), 1); },
};

export const packageAdapter: CatalogAdapter<P> = {
  type: 'package',
  area: 'packages',
  label: L('Trip packages', 'باقات الرحلات'),
  icon: 'map',
  supplierOwned: true,
  hasNativeActive: () => false,
  sections,
  children: [daysChild],
  listColumns: ['title', 'status', 'priceFromEGP', 'supplierName', 'completeness'],
  filters: ['status', 'supplierId'],
  priceKey: 'priceFromEGP',
  rows: () => db.tripPackages,
  idOf: p => p.id,
  supplierOf: p => p.supplierId ?? null,
  nativeStatus: p => p.status,
  applyStatus: (p, status) => { p.status = status; },
  entityUpdatedAt: p => p.updatedAt,
  touchEntity: (p, at, userId) => { p.updatedAt = at; p.updatedBy = userId; },
  blank: supplierId => {
    const now = new Date().toISOString();
    return {
      id: newId('PKG'), supplierId: supplierId ?? undefined, status: 'draft', titleEn: '', titleAr: '', summaryEn: '', summaryAr: '',
      images: [], durationDays: 1, startingPriceEGP: 0, priceIsEstimate: true, days: [], includedEn: [], includedAr: [],
      createdAt: now, updatedAt: now,
    };
  },
  insert: p => { db.tripPackages.push(p); },
  // Packages are not booked as a unit today; nothing references a package id.
  inUse: () => null,
  remove: p => { db.tripPackages.splice(db.tripPackages.indexOf(p), 1); },
  duplicate: p => {
    const copy: P = JSON.parse(JSON.stringify(p));
    copy.id = newId('PKG');
    delete copy.seedId;
    copy.titleEn = `${p.titleEn} (copy)`;
    copy.titleAr = p.titleAr ? `${p.titleAr} (نسخة)` : '';
    copy.createdAt = new Date().toISOString();
    return copy;
  },
  setSupplier: (p, v) => { p.supplierId = v ?? undefined; },
};
