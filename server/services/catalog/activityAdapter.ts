import { db } from '../../db/database';
import type { ActivityDetailEntity, CommerceServiceType, InventorySlotEntity, ProductSkuEntity } from '../../db/schema';
import { L, opt, pair, areaOptions } from './fields';
import { activeStatus, galleryField, newId, skuById, supplierField, to12h, to24h } from './common';
import { CatalogError, type CatalogAdapter, type ChildAdapter, type MetaView, type SectionDef } from './types';

/**
 * activity = db.activities (detail) + its db.productSkus row (bookable).
 *
 * The SKU needs a real supplier (product_skus.supplier_id is a FK), so a draft
 * without a supplier has no SKU yet: SKU-only values (summary, capacity,
 * departures, inclusions) wait in the meta row's `extra` and are copied onto
 * the SKU the moment a supplier is assigned.
 */

type A = ActivityDetailEntity;

const CATEGORY_SERVICE: Record<A['category'], CommerceServiceType> = {
  diving: 'diving',
  water_sport: 'diving',
  safari: 'safari',
  culture: 'safari',
  wellness: 'wellness',
  food: 'dining',
};

const sku = (a: A) => skuById(a.skuId);

/** SKU-backed value: the SKU when it exists, the meta bag until then. */
function skuGet<T>(a: A, meta: MetaView, key: keyof ProductSkuEntity, fallback: T): T {
  const s = sku(a);
  if (s && s[key] !== undefined) return s[key] as unknown as T;
  return (meta.extra[key as string] as T) ?? fallback;
}
function skuSet(a: A, meta: MetaView, key: keyof ProductSkuEntity, value: unknown) {
  meta.extra[key as string] = value;
  const s = sku(a);
  if (s) (s as unknown as Record<string, unknown>)[key as string] = value;
}

function sections(): SectionDef<A>[] {
  return [
    {
      key: 'basics',
      label: L('Basics', 'الأساسيات'),
      fields: [
        {
          key: 'title', kind: 'i18nText', required: true, max: 120, label: L('Title', 'العنوان'),
          get: a => pair(a.titleEn, a.titleAr),
          set: (a, v) => {
            a.titleEn = v.en; a.titleAr = v.ar;
            const s = sku(a);
            if (s) { s.title = v.en; s.titleAr = v.ar; }
          },
        },
        {
          key: 'summary', kind: 'i18nTextarea', max: 600, label: L('Summary', 'الملخص'),
          get: (a, m) => pair(skuGet(a, m, 'description', ''), skuGet(a, m, 'descriptionAr', '')),
          set: (a, v, m) => { skuSet(a, m, 'description', v.en); skuSet(a, m, 'descriptionAr', v.ar); },
        },
        {
          key: 'category', kind: 'select', required: true, label: L('Category', 'الفئة'),
          options: [
            opt('diving', 'Diving & snorkelling', 'الغوص والسنوركل'),
            opt('water_sport', 'Water sports', 'الرياضات المائية'),
            opt('safari', 'Desert safari', 'سفاري الصحراء'),
            opt('culture', 'Culture & heritage', 'الثقافة والتراث'),
            opt('wellness', 'Wellness', 'العافية'),
            opt('food', 'Food experiences', 'تجارب الطعام'),
          ],
          get: a => a.category,
          set: (a, v) => { a.category = v; const s = sku(a); if (s) s.serviceType = CATEGORY_SERVICE[a.category]; },
        },
        { key: 'area', kind: 'select', required: true, label: L('Area', 'المنطقة'), options: areaOptions(), get: a => a.areaId || undefined, set: (a, v) => { a.areaId = v ?? ''; } },
        {
          key: 'placeId', kind: 'select', label: L('Place', 'المكان'),
          options: db.places.map(p => opt(p.id, p.nameEn, p.nameAr)),
          get: a => a.placeId || undefined, set: (a, v) => { a.placeId = v ?? ''; },
        },
        supplierField<A>(
          a => a.supplierId ?? sku(a)?.supplierId ?? null,
          (a, v) => {
            const s = sku(a);
            if (!v && s) throw new CatalogError(400, 'supplierId: a bookable activity must keep a supplier.');
            a.supplierId = v ?? undefined;
            if (s && v) s.supplierId = v;
          },
          true
        ),
        { key: 'durationMinutes', kind: 'duration', required: true, label: L('Duration (minutes)', 'المدة (بالدقائق)'), max: 60 * 24 * 14, get: a => a.durationMinutes, set: (a, v) => { a.durationMinutes = v ?? 0; const s = sku(a); if (s) s.durationMinutes = a.durationMinutes; } },
        {
          key: 'difficulty', kind: 'select', label: L('Difficulty', 'الصعوبة'),
          options: [opt('All Levels', 'All levels', 'كل المستويات'), opt('Beginner', 'Beginner', 'مبتدئ'), opt('Intermediate', 'Intermediate', 'متوسط'), opt('Advanced', 'Advanced', 'متقدم')],
          get: a => a.difficulty, set: (a, v) => { a.difficulty = v ?? 'All Levels'; },
        },
        {
          key: 'accessMethod', kind: 'select', label: L('Access', 'طريقة الوصول'),
          options: ['WALK', 'SHORE', 'BOAT', 'VEHICLE', '4X4', 'CAMEL', 'HIKE', 'MIXED', 'UNKNOWN'].map(v => opt(v, v, v)),
          get: a => a.accessMethod, set: (a, v) => { a.accessMethod = v ?? 'UNKNOWN'; },
        },
        {
          key: 'bookingMode', kind: 'select', label: L('Booking mode', 'طريقة الحجز'),
          options: [
            opt('BOOK_NOW', 'Instant booking', 'حجز فوري'), opt('REQUEST_NOW', 'On request', 'بالطلب'),
            opt('DISCOVER_ONLY', 'Discover only', 'للاستكشاف فقط'), opt('WALK_IN', 'Walk-in', 'بدون حجز'),
          ],
          get: a => a.bookingMode, set: (a, v) => { a.bookingMode = v ?? 'REQUEST_NOW'; },
        },
        { key: 'experienceLevelRequired', kind: 'text', max: 200, label: L('Experience needed', 'الخبرة المطلوبة'), get: a => a.experienceLevelRequired, set: (a, v) => { a.experienceLevelRequired = v ?? ''; } },
      ],
    },
    { key: 'media', label: L('Photos', 'الصور'), fields: [galleryField<A>(() => [])] },
    {
      key: 'pricing',
      label: L('Price & availability', 'السعر والتوفر'),
      fields: [
        { key: 'priceFromEGP', kind: 'money', required: true, label: L('Price from (EGP)', 'السعر يبدأ من (جنيه)'), get: a => a.basePriceEGP, set: (a, v) => { a.basePriceEGP = v ?? 0; const s = sku(a); if (s) s.basePriceEGP = a.basePriceEGP; } },
        { key: 'maxCapacityPerSlot', kind: 'number', min: 1, max: 500, label: L('Capacity per departure', 'السعة لكل موعد'), get: (a, m) => skuGet(a, m, 'maxCapacityPerSlot', 10), set: (a, v, m) => skuSet(a, m, 'maxCapacityPerSlot', Math.round(v ?? 10)) },
        {
          key: 'timeSlots', kind: 'timeList', label: L('Daily departures', 'مواعيد الانطلاق اليومية'),
          get: (a, m) => skuGet<string[]>(a, m, 'timeSlots', []).map(t => to24h(t)).filter((t): t is string => !!t),
          set: (a, v: string[], m) => skuSet(a, m, 'timeSlots', v.length ? v.map(to12h) : undefined),
        },
        { key: 'cancellationPolicyHours', kind: 'number', min: 0, max: 720, label: L('Free cancellation (hours before)', 'الإلغاء المجاني (ساعات قبل)'), get: (a, m) => skuGet(a, m, 'cancellationPolicyHours', 24), set: (a, v, m) => skuSet(a, m, 'cancellationPolicyHours', Math.round(v ?? 24)) },
        { key: 'includedEn', kind: 'tags', label: L("What's included (EN)", 'المشمول (إنجليزي)'), get: (a, m) => skuGet(a, m, 'includedItems', []), set: (a, v, m) => skuSet(a, m, 'includedItems', v) },
        { key: 'includedAr', kind: 'tags', label: L("What's included (AR)", 'المشمول (عربي)'), get: (a, m) => skuGet(a, m, 'includedItemsAr', []), set: (a, v, m) => skuSet(a, m, 'includedItemsAr', v) },
      ],
    },
    {
      key: 'details',
      label: L('Details', 'التفاصيل'),
      fields: [
        {
          key: 'seasonalityMonths', kind: 'multiselect', label: L('Season (months)', 'الموسم (الشهور)'),
          options: Array.from({ length: 12 }, (_, i) => opt(String(i + 1), new Date(Date.UTC(2026, i, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' }), String(i + 1))),
          get: a => a.seasonalityMonths.map(String),
          set: (a, v: string[]) => { a.seasonalityMonths = v.map(Number).sort((x, y) => x - y); },
        },
        { key: 'preparationTipsEn', kind: 'tags', label: L('Preparation tips (EN)', 'نصائح التحضير (إنجليزي)'), get: a => a.preparationTips, set: (a, v) => { a.preparationTips = v; } },
        { key: 'preparationTipsAr', kind: 'tags', label: L('Preparation tips (AR)', 'نصائح التحضير (عربي)'), get: a => a.preparationTipsAr, set: (a, v) => { a.preparationTipsAr = v; } },
      ],
    },
  ];
}

/** Creates the SKU once the activity has a supplier, from the activity + parked values. */
function ensureSku(a: A, meta: MetaView) {
  if (sku(a)) return;
  const supplierId = a.supplierId;
  if (!supplierId || !db.suppliers.some(s => s.id === supplierId)) return;
  const x = meta.extra;
  const row: ProductSkuEntity = {
    id: newId('SKU-ACT'),
    supplierId,
    serviceType: CATEGORY_SERVICE[a.category],
    title: a.titleEn,
    titleAr: a.titleAr,
    description: typeof x.description === 'string' ? x.description : '',
    descriptionAr: typeof x.descriptionAr === 'string' ? x.descriptionAr : undefined,
    durationMinutes: a.durationMinutes || undefined,
    basePriceEGP: a.basePriceEGP,
    currency: 'EGP',
    maxCapacityPerSlot: typeof x.maxCapacityPerSlot === 'number' ? x.maxCapacityPerSlot : 10,
    active: false,
    includedItems: Array.isArray(x.includedItems) ? (x.includedItems as string[]) : undefined,
    includedItemsAr: Array.isArray(x.includedItemsAr) ? (x.includedItemsAr as string[]) : undefined,
    cancellationPolicyHours: typeof x.cancellationPolicyHours === 'number' ? x.cancellationPolicyHours : 24,
    timeSlots: Array.isArray(x.timeSlots) ? (x.timeSlots as string[]) : undefined,
  };
  db.productSkus.push(row);
  a.skuId = row.id;
}

// ─── slots child (db.inventorySlots) ────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function recomputeSlotStatus(slot: InventorySlotEntity) {
  const remaining = slot.totalCapacity - slot.reservedCapacity - slot.heldCapacity;
  slot.status = remaining <= 0 ? 'SOLD_OUT' : remaining <= Math.ceil(slot.totalCapacity * 0.2) ? 'ALMOST_FULL' : 'AVAILABLE';
}

export const slotsChild: ChildAdapter<A, InventorySlotEntity> = {
  key: 'slots',
  itemType: 'activity-slot',
  label: L('Departures', 'المواعيد'),
  priceKey: 'priceEGP',
  sections: () => [
    {
      key: 'slot',
      label: L('Departure', 'الموعد'),
      fields: [
        { key: 'title', kind: 'i18nText', label: L('Label', 'الوصف'), get: s => ({ en: `${s.date} ${s.timeSlot}`, ar: `${s.date} ${s.timeSlot}` }) },
        { key: 'date', kind: 'text', required: true, max: 10, label: L('Date (YYYY-MM-DD)', 'التاريخ'), get: s => s.date, set: (s, v) => { s.date = v ?? ''; } },
        { key: 'time', kind: 'time', required: true, label: L('Time', 'الوقت'), get: s => to24h(s.timeSlot) ?? s.timeSlot, set: (s, v) => { s.timeSlot = to12h(v); } },
        { key: 'capacity', kind: 'number', required: true, min: 0, max: 500, label: L('Capacity', 'السعة'), get: s => s.totalCapacity, set: (s, v) => { s.totalCapacity = Math.round(v ?? 0); } },
        { key: 'priceEGP', kind: 'money', required: true, label: L('Price (EGP)', 'السعر (جنيه)'), get: s => s.priceEGP, set: (s, v) => { s.priceEGP = v ?? 0; } },
        { key: 'reserved', kind: 'number', label: L('Booked', 'محجوز'), get: s => s.reservedCapacity },
        { key: 'held', kind: 'number', label: L('Held', 'معلّق'), get: s => s.heldCapacity },
        { key: 'availability', kind: 'text', label: L('Availability', 'التوفر'), get: s => s.status },
      ],
    },
  ],
  list: (a, q) => {
    const from = typeof q.from === 'string' ? q.from : '';
    const to = typeof q.to === 'string' ? q.to : '9999-12-31';
    if (!a.skuId) return [];
    return db.inventorySlots
      .filter(s => s.skuId === a.skuId && s.date >= from && s.date <= to)
      .sort((x, y) => x.date.localeCompare(y.date) || (to24h(x.timeSlot) ?? '').localeCompare(to24h(y.timeSlot) ?? ''));
  },
  find: (a, id) => db.inventorySlots.find(s => s.id === id && s.skuId === a.skuId),
  idOf: s => s.id,
  statusOf: s => (s.totalCapacity > 0 ? 'published' : 'hidden'),
  blank: a => {
    const s = sku(a);
    if (!s) throw new CatalogError(409, 'This activity has no bookable SKU yet — assign a supplier first.', 'conflict');
    return {
      id: newId(`SLOT-${s.id}`), skuId: s.id, date: '', timeSlot: '', totalCapacity: s.maxCapacityPerSlot || 10,
      reservedCapacity: 0, heldCapacity: 0, priceEGP: s.basePriceEGP, status: 'AVAILABLE',
    };
  },
  insert: (_a, s) => { db.inventorySlots.push(s); },
  afterWrite: (_a, s) => {
    if (!DATE_RE.test(s.date)) throw new CatalogError(400, 'date: must be YYYY-MM-DD.');
    if (!s.timeSlot) throw new CatalogError(400, 'time: is required.');
    if (s.totalCapacity < s.reservedCapacity + s.heldCapacity) {
      throw new CatalogError(400, `capacity: cannot go below ${s.reservedCapacity + s.heldCapacity} (already booked or held).`);
    }
    const twin = db.inventorySlots.find(o => o !== s && o.skuId === s.skuId && o.date === s.date && o.timeSlot === s.timeSlot);
    if (twin) throw new CatalogError(409, `A departure at ${s.date} ${s.timeSlot} already exists (${twin.id}).`, 'conflict');
    recomputeSlotStatus(s);
  },
  inUse: (_a, s) => (s.reservedCapacity > 0 || s.heldCapacity > 0 || db.holds.some(h => h.slotId === s.id) ? 'The departure has bookings or holds.' : null),
  remove: (_a, s) => { db.inventorySlots.splice(db.inventorySlots.indexOf(s), 1); },
};

export { recomputeSlotStatus };

// ─── adapter ────────────────────────────────────────────────────────────────

export const activityAdapter: CatalogAdapter<A> = {
  type: 'activity',
  area: 'activities',
  label: L('Activities & experiences', 'الأنشطة والتجارب'),
  icon: 'compass',
  supplierOwned: true,
  hasNativeActive: a => !!sku(a),
  sections,
  children: [slotsChild],
  extraChildren: [],
  listColumns: ['title', 'status', 'priceFromEGP', 'supplierName', 'completeness'],
  filters: ['status', 'supplierId', 'category', 'area'],
  priceKey: 'priceFromEGP',
  rows: () => db.activities,
  idOf: a => a.id,
  supplierOf: a => a.supplierId ?? sku(a)?.supplierId ?? null,
  nativeStatus: a => {
    const s = sku(a);
    return s ? activeStatus(s.active) : 'published';
  },
  applyStatus: (a, status) => {
    const s = sku(a);
    if (s) s.active = status === 'published';
  },
  blank: (supplierId, input) => {
    const category = typeof (input.fields as Record<string, unknown> | undefined)?.category === 'string'
      ? ((input.fields as Record<string, unknown>).category as A['category'])
      : 'culture';
    return {
      id: newId('ACT'), titleEn: '', titleAr: '', category: CATEGORY_SERVICE[category] ? category : 'culture', placeId: '', areaId: '',
      durationMinutes: 0, accessMethod: 'UNKNOWN', difficulty: 'All Levels', experienceLevelRequired: '', basePriceEGP: 0,
      bookingMode: 'REQUEST_NOW', supplierId: supplierId ?? undefined, seasonalityMonths: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
      environmentalSensitivities: {}, dependencies: [], preparationTips: [], preparationTipsAr: [], travelerFitPersonas: [],
    };
  },
  insert: a => { db.activities.push(a); },
  afterWrite: (a, meta) => ensureSku(a, meta),
  inUse: a => {
    const s = sku(a);
    if (s && (db.bookings.some(b => b.skuId === s.id) || db.holds.some(h => h.skuId === s.id) || db.inventorySlots.some(sl => sl.skuId === s.id && sl.reservedCapacity > 0))) {
      return 'The activity has bookings.';
    }
    const pkg = s && db.tripPackages.find(p => p.days.some(d => d.activitySkuIds.includes(s.id)));
    return pkg ? `The activity is part of the package ${pkg.id}.` : null;
  },
  remove: a => {
    const s = sku(a);
    if (s) {
      for (let i = db.inventorySlots.length - 1; i >= 0; i--) if (db.inventorySlots[i].skuId === s.id) db.inventorySlots.splice(i, 1);
      db.productSkus.splice(db.productSkus.indexOf(s), 1);
    }
    db.activities.splice(db.activities.indexOf(a), 1);
  },
  duplicate: a => {
    const copy: A = JSON.parse(JSON.stringify(a));
    copy.id = newId('ACT');
    copy.titleEn = `${a.titleEn} (copy)`;
    copy.titleAr = a.titleAr ? `${a.titleAr} (نسخة)` : '';
    const s = sku(a);
    if (s) {
      const skuCopy: ProductSkuEntity = { ...JSON.parse(JSON.stringify(s)), id: newId('SKU-ACT'), title: copy.titleEn, titleAr: copy.titleAr, active: false };
      db.productSkus.push(skuCopy);
      copy.skuId = skuCopy.id;
    } else {
      delete copy.skuId;
    }
    return copy;
  },
  setSupplier: (a, v) => {
    const s = sku(a);
    if (!v && s) throw new CatalogError(400, 'supplierId: a bookable activity must keep a supplier.');
    a.supplierId = v ?? undefined;
    if (s && v) s.supplierId = v;
  },
};
