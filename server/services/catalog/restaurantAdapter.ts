import { db } from '../../db/database';
import type { DiningMenuItemEntity, DiningVenueEntity } from '../../db/schema';
import { L, opt, pair, areaOptions } from './fields';
import { galleryField, newId, slugify, supplierField } from './common';
import { CatalogError, type CatalogAdapter, type ChildAdapter, type SectionDef } from './types';

/**
 * restaurant = db.diningVenues; `menu` child = db.diningMenuItems.
 *
 * A venue has no on/off column, so its status lives only on the catalogue
 * meta row (default: published). The public dining endpoints do not read it
 * yet — see the deviations in docs/CATALOG_API_CONTRACT.md.
 */

type V = DiningVenueEntity;
type M = DiningMenuItemEntity;

const DIETARY = ['vegan', 'vegetarian', 'halal', 'freshSeafoodCatch'] as const;
const MENU_CATEGORIES: M['category'][] = ['breakfast', 'mains', 'grill', 'seafood', 'street_food', 'bakery', 'desserts', 'drinks'];

function cuisineSuggestions(): string[] {
  const seen = new Set<string>();
  for (const v of db.diningVenues) for (const c of v.cuisine) seen.add(c);
  return [...seen].sort().slice(0, 60);
}

function sections(): SectionDef<V>[] {
  return [
    {
      key: 'basics',
      label: L('Basics', 'الأساسيات'),
      fields: [
        { key: 'title', kind: 'i18nText', required: true, max: 120, label: L('Name', 'الاسم'), get: v => pair(v.nameEn, v.nameAr), set: (v, x) => { v.nameEn = x.en; v.nameAr = x.ar; } },
        {
          key: 'summary', kind: 'i18nTextarea', max: 600, label: L('Summary', 'الملخص'),
          get: (_v, m) => pair(m.extra.summaryEn, m.extra.summaryAr),
          set: (_v, x, m) => { m.extra.summaryEn = x.en; m.extra.summaryAr = x.ar; },
        },
        {
          key: 'area', kind: 'select', required: true, label: L('Area', 'المنطقة'), options: areaOptions(),
          get: v => v.areaId || undefined,
          set: (v, x) => {
            const area = db.areaProfiles.find(a => a.id === x);
            if (!area) return;
            v.areaId = area.id; v.areaName = area.nameEn; v.areaNameAr = area.nameAr;
          },
        },
        { key: 'cuisine', kind: 'tags', required: true, label: L('Cuisine (EN)', 'المطبخ (إنجليزي)'), suggestions: cuisineSuggestions(), get: v => v.cuisine, set: (v, x) => { v.cuisine = x; } },
        { key: 'cuisineAr', kind: 'tags', label: L('Cuisine (AR)', 'المطبخ (عربي)'), get: v => v.cuisineAr ?? [], set: (v, x) => { v.cuisineAr = x; } },
        {
          key: 'priceBand', kind: 'select', required: true, label: L('Price band', 'الفئة السعرية'),
          options: [opt('Budget ($)', 'Budget ($)', 'اقتصادي'), opt('Moderate ($$)', 'Moderate ($$)', 'متوسط'), opt('Premium ($$$)', 'Premium ($$$)', 'فاخر')],
          get: v => v.priceBand, set: (v, x) => { v.priceBand = x ?? 'Moderate ($$)'; },
        },
        { key: 'openingHours', kind: 'i18nText', max: 200, label: L('Opening hours', 'مواعيد العمل'), get: v => pair(v.openingHours, v.openingHoursAr), set: (v, x) => { v.openingHours = x.en; v.openingHoursAr = x.ar || undefined; } },
        { key: 'phone', kind: 'text', max: 32, label: L('Phone', 'الهاتف'), get: v => v.phone, set: (v, x) => { v.phone = x || undefined; } },
        { key: 'location', kind: 'geo', label: L('Location', 'الموقع'), get: v => v.coordinates, set: (v, x) => { v.coordinates = x; } },
        supplierField<V>(v => v.supplierId ?? null, (v, x) => { v.supplierId = x ?? undefined; }),
      ],
    },
    { key: 'media', label: L('Photos', 'الصور'), fields: [galleryField<V>(v => (v.coverImageUrl ? [v.coverImageUrl] : []), (v, imgs) => { v.coverImageUrl = imgs[0]; })] },
    {
      key: 'service',
      label: L('Service', 'الخدمة'),
      fields: [
        { key: 'priceFromEGP', kind: 'money', label: L('Average meal (EGP)', 'متوسط الوجبة (جنيه)'), get: v => v.averageMealPriceEGP, set: (v, x) => { v.averageMealPriceEGP = x; } },
        {
          key: 'bookingEligibility', kind: 'select', label: L('Booking', 'الحجز'),
          options: [opt('BOOK_NOW', 'Instant booking', 'حجز فوري'), opt('REQUEST_NOW', 'On request', 'بالطلب'), opt('WALK_IN', 'Walk-in', 'بدون حجز'), opt('DISCOVER_ONLY', 'Discover only', 'للاستكشاف فقط')],
          get: v => v.bookingEligibility, set: (v, x) => { v.bookingEligibility = x ?? 'WALK_IN'; },
        },
        {
          key: 'dietary', kind: 'multiselect', label: L('Dietary options', 'الخيارات الغذائية'),
          options: [opt('vegan', 'Vegan', 'نباتي صرف'), opt('vegetarian', 'Vegetarian', 'نباتي'), opt('halal', 'Halal', 'حلال'), opt('freshSeafoodCatch', 'Fresh catch', 'صيد طازج')],
          get: v => DIETARY.filter(k => v.dietaryOptions[k]),
          set: (v, x: string[]) => { for (const k of DIETARY) v.dietaryOptions[k] = x.includes(k); },
        },
        { key: 'wifiNomadFriendly', kind: 'boolean', label: L('Laptop friendly', 'مناسب للعمل'), get: v => v.wifiNomadFriendly, set: (v, x) => { v.wifiNomadFriendly = x; } },
        { key: 'prepMinutes', kind: 'number', max: 240, label: L('Kitchen prep (min)', 'وقت التحضير (دقيقة)'), get: v => v.prepMinutes, set: (v, x) => { v.prepMinutes = x === undefined ? undefined : Math.round(x); } },
      ],
    },
  ];
}

// ─── menu child ─────────────────────────────────────────────────────────────

export const menuChild: ChildAdapter<V, M> = {
  key: 'menu',
  itemType: 'restaurant-menu-item',
  label: L('Menu', 'القائمة'),
  priceKey: 'priceEGP',
  sections: () => [
    {
      key: 'dish',
      label: L('Dish', 'الطبق'),
      fields: [
        { key: 'title', kind: 'i18nText', required: true, max: 120, label: L('Name', 'الاسم'), get: m => pair(m.nameEn, m.nameAr), set: (m, x) => { m.nameEn = x.en; m.nameAr = x.ar; } },
        { key: 'summary', kind: 'i18nTextarea', max: 600, label: L('Description', 'الوصف'), get: m => pair(m.descriptionEn, m.descriptionAr), set: (m, x) => { m.descriptionEn = x.en || undefined; m.descriptionAr = x.ar || undefined; } },
        { key: 'section', kind: 'select', required: true, label: L('Section', 'القسم'), options: MENU_CATEGORIES.map(c => opt(c, c.replace('_', ' '), c)), get: m => m.category, set: (m, x) => { m.category = x ?? 'mains'; } },
        { key: 'priceEGP', kind: 'money', required: true, label: L('Price (EGP)', 'السعر (جنيه)'), get: m => m.priceEGP, set: (m, x) => { m.priceEGP = x ?? 0; } },
        { key: 'available', kind: 'boolean', label: L('Available today', 'متاح اليوم'), get: m => m.available, set: (m, x) => { m.available = x; } },
        {
          key: 'dietary', kind: 'multiselect', label: L('Dietary', 'غذائي'),
          options: [opt('vegan', 'Vegan', 'نباتي صرف'), opt('vegetarian', 'Vegetarian', 'نباتي'), opt('halal', 'Halal', 'حلال')],
          get: m => m.dietary, set: (m, x) => { m.dietary = x; },
        },
        { key: 'prepMinutes', kind: 'number', max: 240, label: L('Prep (min)', 'التحضير (دقيقة)'), get: m => m.prepMinutes, set: (m, x) => { m.prepMinutes = x === undefined ? undefined : Math.round(x); } },
        { key: 'sortOrder', kind: 'number', max: 10_000, label: L('Order', 'الترتيب'), get: m => m.sortOrder, set: (m, x) => { m.sortOrder = Math.round(x ?? 0); } },
      ],
    },
  ],
  list: v => db.diningMenuItems.filter(m => m.venueId === v.id).sort((a, b) => MENU_CATEGORIES.indexOf(a.category) - MENU_CATEGORIES.indexOf(b.category) || a.sortOrder - b.sortOrder),
  find: (v, id) => db.diningMenuItems.find(m => m.id === id && m.venueId === v.id),
  idOf: m => m.id,
  statusOf: m => (m.available ? 'published' : 'hidden'),
  blank: v => ({
    id: newId(`MENU-${v.id}`), venueId: v.id, nameEn: '', nameAr: '', category: 'mains', priceEGP: 0, dietary: [], available: true,
    sortOrder: db.diningMenuItems.filter(m => m.venueId === v.id).length,
  }),
  insert: (_v, m) => { db.diningMenuItems.push(m); },
  inUse: (_v, m) => (db.diningOrders.some(o => o.lines.some(l => l.menuItemId === m.id)) ? 'Orders include this dish — mark it unavailable instead.' : null),
  remove: (_v, m) => { db.diningMenuItems.splice(db.diningMenuItems.indexOf(m), 1); },
};

// ─── adapter ────────────────────────────────────────────────────────────────

export const restaurantAdapter: CatalogAdapter<V> = {
  type: 'restaurant',
  area: 'restaurants',
  label: L('Restaurants & cafés', 'المطاعم والمقاهي'),
  icon: 'utensils',
  supplierOwned: true,
  hasNativeActive: () => false,
  sections,
  children: [menuChild],
  listColumns: ['title', 'status', 'priceFromEGP', 'supplierName', 'completeness'],
  filters: ['status', 'supplierId', 'area', 'priceBand'],
  priceKey: 'priceFromEGP',
  rows: () => db.diningVenues,
  idOf: v => v.id,
  supplierOf: v => v.supplierId ?? null,
  nativeStatus: () => 'published',
  applyStatus: () => undefined,
  blank: (supplierId, input) => {
    const fields = (input.fields as Record<string, unknown> | undefined) ?? {};
    const area = db.areaProfiles.find(a => a.id === fields.area) ?? db.areaProfiles[0];
    const title = (input.title as { en?: string } | undefined)?.en || 'restaurant';
    const id = newId('VEN');
    return {
      id, slug: `${slugify(title)}-${id.slice(-4).toLowerCase()}`, nameEn: '', nameAr: '', areaId: area?.id ?? '', areaName: area?.nameEn, areaNameAr: area?.nameAr,
      cuisine: [], priceBand: 'Moderate ($$)', dietaryOptions: { vegan: false, vegetarian: false, halal: false, freshSeafoodCatch: false },
      wifiNomadFriendly: false, openingHours: '', bookingEligibility: 'WALK_IN', supplierId: supplierId ?? undefined, source: 'catalog',
    };
  },
  insert: v => { db.diningVenues.push(v); },
  inUse: v => (db.diningOrders.some(o => o.venueId === v.id) ? 'The restaurant has orders.' : null),
  remove: v => {
    for (let i = db.diningMenuItems.length - 1; i >= 0; i--) if (db.diningMenuItems[i].venueId === v.id) db.diningMenuItems.splice(i, 1);
    db.diningVenues.splice(db.diningVenues.indexOf(v), 1);
  },
  duplicate: v => {
    const copy: V = JSON.parse(JSON.stringify(v));
    copy.id = newId('VEN');
    copy.slug = `${v.slug || slugify(v.nameEn)}-copy-${copy.id.slice(-4).toLowerCase()}`;
    copy.nameEn = `${v.nameEn} (copy)`;
    copy.nameAr = v.nameAr ? `${v.nameAr} (نسخة)` : '';
    delete copy.tripadvisor;
    return copy;
  },
  setSupplier: (v, x) => {
    if (x && !db.suppliers.some(s => s.id === x)) throw new CatalogError(400, `supplierId: supplier "${x}" does not exist.`);
    v.supplierId = x ?? undefined;
  },
};
