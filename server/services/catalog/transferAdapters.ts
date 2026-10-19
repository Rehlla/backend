import { db } from '../../db/database';
import type { TransferBusScheduleEntity, TransferDriverEntity, TransferZonePriceEntity } from '../../db/schema';
import { transferHubService } from '../transferHubService';
import { L, opt, pair } from './fields';
import { activeStatus, galleryField, newId, slugify } from './common';
import type { CatalogAdapter, FieldDef, SectionDef } from './types';

/**
 * transfer-zone / transfer-bus / transfer-driver over the future-ride hub
 * tables (transferHubService seeds them on first read). None of them has an
 * owner, so they are staff-only (supplierOwned: false); the supplier portal
 * refuses these types.
 */

const seeded = <T>(rows: () => T[]) => () => {
  transferHubService.ensureSeed();
  return rows();
};

const money = <E>(key: string, en: string, ar: string, get: (e: E) => number, set: (e: E, v: number) => void, required = false): FieldDef<E> => ({
  key, kind: 'money', required, label: L(en, ar), get, set: (e, v) => set(e, v ?? 0),
});

// ─── zones ──────────────────────────────────────────────────────────────────

type Z = TransferZonePriceEntity;

const zoneSections = (): SectionDef<Z>[] => [
  {
    key: 'basics',
    label: L('Basics', 'الأساسيات'),
    fields: [
      { key: 'title', kind: 'i18nText', required: true, max: 80, label: L('Zone name', 'اسم المنطقة'), get: z => pair(z.labelEn, z.labelAr), set: (z, v) => { z.labelEn = v.en; z.labelAr = v.ar; } },
      { key: 'summary', kind: 'i18nText', max: 160, label: L('Subtitle', 'الوصف المختصر'), get: z => pair(z.subEn, z.subAr), set: (z, v) => { z.subEn = v.en; z.subAr = v.ar; } },
      { key: 'regionEn', kind: 'text', max: 80, label: L('Region', 'الإقليم'), get: z => z.regionEn, set: (z, v) => { z.regionEn = v ?? ''; } },
      { key: 'haul', kind: 'select', required: true, label: L('Haul', 'نوع المسافة'), options: [opt('short', 'Short haul (distance formula)', 'مسافة قصيرة'), opt('long', 'Long haul (price matrix)', 'مسافة طويلة')], get: z => z.haul, set: (z, v) => { z.haul = v ?? 'long'; } },
      { key: 'distanceKm', kind: 'number', required: true, max: 2000, label: L('Distance (km)', 'المسافة (كم)'), get: z => z.distanceKm, set: (z, v) => { z.distanceKm = Math.round(v ?? 0); } },
      { key: 'duration', kind: 'i18nText', max: 40, label: L('Drive time', 'مدة الرحلة'), get: z => pair(z.durationEn, z.durationAr), set: (z, v) => { z.durationEn = v.en; z.durationAr = v.ar; } },
    ],
  },
  { key: 'media', label: L('Photos', 'الصور'), fields: [{ ...galleryField<Z>(() => []), min: 0 }] },
  {
    key: 'pricing',
    label: L('Prices (EGP)', 'الأسعار (جنيه)'),
    fields: [
      money<Z>('priceFromEGP', 'Private car', 'سيارة خاصة', z => z.privateEGP, (z, v) => { z.privateEGP = v; }, true),
      money<Z>('sharedEGP', 'Shared ride', 'رحلة مشتركة', z => z.sharedEGP, (z, v) => { z.sharedEGP = v; }),
      money<Z>('busEGP', 'Bus seat', 'مقعد حافلة', z => z.busEGP, (z, v) => { z.busEGP = v; }),
      money<Z>('supplierPrivateEGP', 'Supplier cost: private', 'تكلفة المورد: خاص', z => z.supplierPrivateEGP, (z, v) => { z.supplierPrivateEGP = v; }),
      money<Z>('supplierBusEGP', 'Supplier cost: bus', 'تكلفة المورد: حافلة', z => z.supplierBusEGP, (z, v) => { z.supplierBusEGP = v; }),
      money<Z>('lastMileEGP', 'Last mile', 'الميل الأخير', z => z.lastMileEGP, (z, v) => { z.lastMileEGP = v; }),
      money<Z>('lastMileDriverDiscountEGP', 'Last-mile driver discount', 'خصم السائق للميل الأخير', z => z.lastMileDriverDiscountEGP, (z, v) => { z.lastMileDriverDiscountEGP = v; }),
    ],
  },
];

export const transferZoneAdapter: CatalogAdapter<Z> = {
  type: 'transfer-zone',
  area: 'transfers',
  label: L('Transfer zones', 'مناطق التنقل'),
  icon: 'route',
  supplierOwned: false,
  hasNativeActive: () => true,
  sections: zoneSections,
  children: [],
  listColumns: ['title', 'status', 'priceFromEGP', 'completeness'],
  filters: ['status', 'haul'],
  priceKey: 'priceFromEGP',
  rows: seeded(() => db.transferZonePrices),
  idOf: z => z.id,
  supplierOf: () => null,
  nativeStatus: z => activeStatus(z.active),
  applyStatus: (z, s) => { z.active = s === 'published'; },
  blank: (_s, input) => {
    const title = (input.title as { en?: string } | undefined)?.en || 'zone';
    return {
      id: `${slugify(title)}-${newId('Z').slice(-4).toLowerCase()}`, labelEn: '', labelAr: '', subEn: '', subAr: '', regionEn: '',
      privateEGP: 0, sharedEGP: 0, busEGP: 0, supplierPrivateEGP: 0, supplierBusEGP: 0, lastMileEGP: 0, lastMileDriverDiscountEGP: 0,
      distanceKm: 0, durationEn: '', durationAr: '', haul: 'long', active: false,
    };
  },
  insert: z => { db.transferZonePrices.push(z); },
  inUse: z => {
    if (db.transferBusSchedules.some(b => b.originId === z.id)) return 'Bus schedules depart from this zone.';
    return db.bookings.some(b => b.hubQuote?.originId === z.id || b.hubQuote?.destinationId === z.id) ? 'Rides were booked for this zone.' : null;
  },
  remove: z => { db.transferZonePrices.splice(db.transferZonePrices.indexOf(z), 1); },
  duplicate: z => ({ ...JSON.parse(JSON.stringify(z)), id: `${z.id}-copy-${newId('Z').slice(-4).toLowerCase()}`, labelEn: `${z.labelEn} (copy)` }),
  setSupplier: () => undefined,
};

// ─── buses ──────────────────────────────────────────────────────────────────

type B = TransferBusScheduleEntity;

const busSections = (): SectionDef<B>[] => [
  {
    key: 'basics',
    label: L('Basics', 'الأساسيات'),
    fields: [
      { key: 'title', kind: 'i18nText', required: true, max: 80, label: L('Operator', 'المشغّل'), get: b => pair(b.operatorName, b.operatorNameAr), set: (b, v) => { b.operatorName = v.en; b.operatorNameAr = v.ar; } },
      {
        key: 'summary', kind: 'i18nText', max: 160, label: L('Note', 'ملاحظة'),
        get: (_b, m) => pair((m.extra.summaryEn as string) ?? '', (m.extra.summaryAr as string) ?? ''),
        set: (_b, v, m) => { m.extra.summaryEn = v.en; m.extra.summaryAr = v.ar; },
      },
      {
        key: 'originId', kind: 'select', required: true, label: L('Departs from', 'نقطة الانطلاق'),
        options: db.transferZonePrices.map(z => opt(z.id, z.labelEn, z.labelAr)),
        get: b => b.originId, set: (b, v) => { b.originId = v ?? b.originId; },
      },
      { key: 'operatorId', kind: 'text', max: 40, label: L('Operator id', 'معرّف المشغّل'), get: b => b.operatorId, set: (b, v) => { b.operatorId = v ?? ''; } },
      { key: 'fromLabel', kind: 'text', max: 80, label: L('From (label)', 'من'), get: b => b.fromLabel, set: (b, v) => { b.fromLabel = v ?? ''; } },
      { key: 'toLabel', kind: 'text', max: 80, label: L('To (label)', 'إلى'), get: b => b.toLabel, set: (b, v) => { b.toLabel = v ?? ''; } },
      { key: 'departLabel', kind: 'text', required: true, max: 40, label: L('Departs', 'المغادرة'), get: b => b.departLabel, set: (b, v) => { b.departLabel = v ?? ''; } },
      { key: 'arriveLabel', kind: 'text', max: 40, label: L('Arrives', 'الوصول'), get: b => b.arriveLabel, set: (b, v) => { b.arriveLabel = v ?? ''; } },
      { key: 'durationLabel', kind: 'text', max: 40, label: L('Duration', 'المدة'), get: b => b.durationLabel, set: (b, v) => { b.durationLabel = v ?? ''; } },
    ],
  },
  { key: 'media', label: L('Photos', 'الصور'), fields: [{ ...galleryField<B>(() => []), min: 0 }] },
  {
    key: 'pricing',
    label: L('Price & seats', 'السعر والمقاعد'),
    fields: [
      money<B>('priceFromEGP', 'Seat price', 'سعر المقعد', b => b.priceEGP, (b, v) => { b.priceEGP = v; }, true),
      { key: 'seats', kind: 'number', required: true, max: 200, label: L('Seats on sale', 'المقاعد المعروضة'), get: b => b.seats, set: (b, v) => { b.seats = Math.round(v ?? 0); } },
    ],
  },
];

export const transferBusAdapter: CatalogAdapter<B> = {
  type: 'transfer-bus',
  area: 'transfers',
  label: L('Bus timetable', 'جدول الحافلات'),
  icon: 'bus',
  supplierOwned: false,
  hasNativeActive: () => true,
  sections: busSections,
  children: [],
  listColumns: ['title', 'status', 'priceFromEGP', 'completeness'],
  filters: ['status', 'originId'],
  priceKey: 'priceFromEGP',
  rows: seeded(() => db.transferBusSchedules),
  idOf: b => b.id,
  supplierOf: () => null,
  nativeStatus: b => activeStatus(b.active),
  applyStatus: (b, s) => { b.active = s === 'published'; },
  blank: (_s, input) => {
    const originId = String((input.fields as Record<string, unknown> | undefined)?.originId ?? db.transferZonePrices[0]?.id ?? '');
    return {
      id: `bus-${originId || 'x'}-${newId('B').slice(-4).toLowerCase()}`, originId, operatorId: 'gobus', operatorName: '', operatorNameAr: '',
      departLabel: '', arriveLabel: '', durationLabel: '', priceEGP: 0, fromLabel: originId, toLabel: 'Dahab', seats: 0, active: false,
    };
  },
  insert: b => { db.transferBusSchedules.push(b); },
  inUse: b => (db.bookings.some(bk => bk.hubQuote?.busScheduleId === b.id) ? 'Seats on this bus were booked.' : null),
  remove: b => { db.transferBusSchedules.splice(db.transferBusSchedules.indexOf(b), 1); },
  duplicate: b => ({ ...JSON.parse(JSON.stringify(b)), id: `bus-${b.originId}-${newId('B').slice(-4).toLowerCase()}` }),
  setSupplier: () => undefined,
};

// ─── drivers ────────────────────────────────────────────────────────────────

type D = TransferDriverEntity;

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');

const driverSections = (): SectionDef<D>[] => [
  {
    key: 'basics',
    label: L('Basics', 'الأساسيات'),
    fields: [
      { key: 'title', kind: 'i18nText', required: true, max: 80, label: L('Name', 'الاسم'), get: d => pair(d.nameEn, d.nameAr), set: (d, v) => { d.nameEn = v.en; d.nameAr = v.ar; d.initials = initialsOf(v.en) || d.initials; } },
      {
        key: 'summary', kind: 'i18nText', max: 160, label: L('Note', 'ملاحظة'),
        get: (_d, m) => pair((m.extra.summaryEn as string) ?? '', (m.extra.summaryAr as string) ?? ''),
        set: (_d, v, m) => { m.extra.summaryEn = v.en; m.extra.summaryAr = v.ar; },
      },
      { key: 'phone', kind: 'text', required: true, max: 32, label: L('Phone', 'الهاتف'), get: d => d.phone, set: (d, v) => { d.phone = v ?? ''; } },
      { key: 'car', kind: 'i18nText', required: true, max: 80, label: L('Car', 'السيارة'), get: d => pair(d.carEn, d.carAr), set: (d, v) => { d.carEn = v.en; d.carAr = v.ar; } },
      { key: 'plate', kind: 'text', max: 32, label: L('Plate', 'رقم اللوحة'), get: d => d.plate, set: (d, v) => { d.plate = v ?? ''; } },
      { key: 'langs', kind: 'tags', label: L('Languages', 'اللغات'), suggestions: ['en', 'ar', 'ru', 'de', 'it'], get: d => d.langs, set: (d, v) => { d.langs = v; } },
      { key: 'badgesEn', kind: 'tags', label: L('Badges (EN)', 'الشارات (إنجليزي)'), get: d => d.badgesEn, set: (d, v) => { d.badgesEn = v; } },
      { key: 'badgesAr', kind: 'tags', label: L('Badges (AR)', 'الشارات (عربي)'), get: d => d.badgesAr, set: (d, v) => { d.badgesAr = v; } },
      { key: 'rating', kind: 'number', max: 5, label: L('Rating', 'التقييم'), get: d => d.rating, set: (d, v) => { d.rating = v ?? 0; } },
      { key: 'verified', kind: 'boolean', label: L('Verified', 'موثّق'), get: d => d.verified, set: (d, v) => { d.verified = v; } },
    ],
  },
  { key: 'media', label: L('Photos', 'الصور'), fields: [{ ...galleryField<D>(() => []), min: 0 }] },
];

export const transferDriverAdapter: CatalogAdapter<D> = {
  type: 'transfer-driver',
  area: 'transfers',
  label: L('Drivers', 'السائقون'),
  icon: 'steering-wheel',
  supplierOwned: false,
  hasNativeActive: () => true,
  sections: driverSections,
  children: [],
  listColumns: ['title', 'status', 'completeness'],
  filters: ['status'],
  priceKey: 'priceFromEGP',
  rows: seeded(() => db.transferDrivers),
  idOf: d => d.id,
  supplierOf: () => null,
  nativeStatus: d => activeStatus(d.active),
  applyStatus: (d, s) => { d.active = s === 'published'; },
  blank: () => ({
    id: newId('drv').toLowerCase(), nameEn: '', nameAr: '', rating: 0, trips: 0, langs: [], badgesEn: [], badgesAr: [],
    carEn: '', carAr: '', initials: '', verified: false, active: false, phone: '', plate: '',
  }),
  insert: d => { db.transferDrivers.push(d); },
  inUse: d => (db.bookings.some(b => b.hubQuote && b.assignedResource?.driverName === d.nameEn && !!d.nameEn) ? 'The driver has assigned rides.' : null),
  remove: d => { db.transferDrivers.splice(db.transferDrivers.indexOf(d), 1); },
  duplicate: d => ({ ...JSON.parse(JSON.stringify(d)), id: newId('drv').toLowerCase(), nameEn: `${d.nameEn} (copy)`, trips: 0 }),
  setSupplier: () => undefined,
};
