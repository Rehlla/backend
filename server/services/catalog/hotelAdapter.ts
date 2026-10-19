import { db } from '../../db/database';
import type { AccommodationEntity, ProductSkuEntity, RoomTypeEntity, SupplierEntity } from '../../db/schema';
import { ensureNightlySku } from '../../db/seeds/backfillRoomTypes';
import { ACCOMMODATION_CATEGORIES, ACCOMMODATION_PRICE_BANDS, PROPERTY_TYPES } from '../accommodationService';
import { L, opt, pair, areaOptions } from './fields';
import { activeStatus, galleryField, newId, skuById, slugify, supplierField } from './common';
import { CatalogError, type CatalogAdapter, type ChildAdapter, type SectionDef } from './types';

/**
 * hotel = db.accommodations + its package SKU (ownership lives on the SKU,
 * accommodationService.createAccommodation). The gallery is kept on the meta
 * row; the first photo is mirrored to coverImageUrl, which the public site
 * already reads. Children: `rooms` (db.roomTypes, each with its nightly SKU)
 * and the `rates` calendar (db.roomRateNights, see catalogService).
 */

type H = AccommodationEntity;

const sku = (h: H) => skuById(h.skuId);

const AMENITY_SUGGESTIONS = ['wifi', 'pool', 'sea view', 'air conditioning', 'breakfast', 'kitchen', 'parking', 'beach access', 'diving centre', 'pet friendly'];

function sections(): SectionDef<H>[] {
  return [
    {
      key: 'basics',
      label: L('Basics', 'الأساسيات'),
      fields: [
        {
          key: 'title', kind: 'i18nText', required: true, max: 120, label: L('Name', 'الاسم'),
          get: h => pair(h.name, h.nameAr),
          set: (h, v) => { h.name = v.en; h.nameAr = v.ar; },
        },
        { key: 'summary', kind: 'i18nTextarea', required: true, max: 600, label: L('Tagline', 'الشعار'), get: h => pair(h.tagline, h.taglineAr), set: (h, v) => { h.tagline = v.en; h.taglineAr = v.ar; } },
        { key: 'description', kind: 'i18nTextarea', max: 4000, label: L('Description', 'الوصف'), get: h => pair(h.description, h.descriptionAr), set: (h, v) => { h.description = v.en; h.descriptionAr = v.ar; } },
        {
          key: 'propertyType', kind: 'select', required: true, label: L('Property type', 'نوع العقار'),
          options: PROPERTY_TYPES.map(t => opt(t, t.replace(/-/g, ' '), t)),
          get: h => h.propertyType, set: (h, v) => { h.propertyType = v ?? 'hotel'; },
        },
        {
          key: 'category', kind: 'select', label: L('Category', 'الفئة'),
          options: ACCOMMODATION_CATEGORIES.map(c => opt(c, c, c)),
          get: h => h.category, set: (h, v) => { h.category = v ?? 'mid-range'; },
        },
        {
          key: 'priceBand', kind: 'select', label: L('Price band', 'الفئة السعرية'),
          options: ACCOMMODATION_PRICE_BANDS.map(c => opt(c, c, c)),
          get: h => h.priceBand, set: (h, v) => { h.priceBand = v ?? 'moderate'; },
        },
        {
          key: 'area', kind: 'select', required: true, label: L('Area', 'المنطقة'), options: areaOptions(),
          get: h => h.areaId || undefined,
          set: (h, v) => {
            const area = db.areaProfiles.find(a => a.id === v);
            if (!area) return;
            h.areaId = area.id; h.area = area.id; h.areaName = area.nameEn; h.areaNameAr = area.nameAr;
          },
        },
        { key: 'location', kind: 'geo', label: L('Location', 'الموقع'), get: h => (typeof h.latitude === 'number' && typeof h.longitude === 'number' ? { lat: h.latitude, lng: h.longitude } : undefined), set: (h, v) => { h.latitude = v?.lat; h.longitude = v?.lng; } },
        supplierField<H>(h => sku(h)?.supplierId ?? null, (h, v) => setSupplier(h, v)),
      ],
    },
    { key: 'media', label: L('Photos', 'الصور'), fields: [galleryField<H>(h => (h.coverImageUrl ? [h.coverImageUrl] : []), (h, v) => { h.coverImageUrl = v[0]; })] },
    {
      key: 'pricing',
      label: L('Price & capacity', 'السعر والسعة'),
      fields: [
        { key: 'priceFromEGP', kind: 'money', required: true, label: L('From, per night (EGP)', 'يبدأ من، لليلة (جنيه)'), get: h => h.perNightEGP, set: (h, v) => { h.perNightEGP = v ?? 0; } },
        { key: 'weeklyRateEGP', kind: 'money', label: L('Weekly rate (EGP)', 'السعر الأسبوعي'), get: h => h.weeklyRateEGP, set: (h, v) => { h.weeklyRateEGP = v; } },
        { key: 'monthlyRateEGP', kind: 'money', label: L('Monthly rate (EGP)', 'السعر الشهري'), get: h => h.monthlyRateEGP, set: (h, v) => { h.monthlyRateEGP = v; } },
        { key: 'packageNights', kind: 'number', min: 1, max: 60, label: L('Package nights', 'ليالي الباقة'), get: h => h.packageNights, set: (h, v) => { h.packageNights = Math.round(v ?? 1); } },
        { key: 'rooms', kind: 'number', max: 2000, label: L('Rooms', 'عدد الغرف'), get: h => h.rooms, set: (h, v) => { h.rooms = Math.round(v ?? 0); } },
        { key: 'maxGuests', kind: 'number', required: true, min: 1, max: 100, label: L('Max guests', 'أقصى عدد ضيوف'), get: h => h.maxGuests, set: (h, v) => { h.maxGuests = Math.round(v ?? 1); } },
      ],
    },
    {
      key: 'details',
      label: L('Details', 'التفاصيل'),
      fields: [
        { key: 'amenities', kind: 'tags', label: L('Amenities (EN)', 'المرافق (إنجليزي)'), suggestions: AMENITY_SUGGESTIONS, get: h => h.amenities, set: (h, v) => { h.amenities = v; } },
        { key: 'amenitiesAr', kind: 'tags', label: L('Amenities (AR)', 'المرافق (عربي)'), get: h => h.amenitiesAr, set: (h, v) => { h.amenitiesAr = v; } },
        { key: 'bestFor', kind: 'i18nText', max: 200, label: L('Best for', 'الأنسب لـ'), get: h => pair(h.bestFor, h.bestForAr), set: (h, v) => { h.bestFor = v.en; h.bestForAr = v.ar; } },
        { key: 'note', kind: 'i18nTextarea', max: 1000, label: L('Note', 'ملاحظة'), get: h => pair(h.note, h.noteAr), set: (h, v) => { h.note = v.en; h.noteAr = v.ar; } },
        { key: 'featured', kind: 'boolean', label: L('Featured', 'مميز'), get: h => h.featured, set: (h, v) => { h.featured = v; } },
      ],
    },
  ];
}

function setSupplier(h: H, v: string | null) {
  const s = sku(h);
  if (!v) throw new CatalogError(400, 'supplierId: a property always has an owner; pick another supplier instead of clearing it.');
  if (s) s.supplierId = v;
  for (const rt of db.roomTypes) {
    if (rt.accommodationId !== h.id) continue;
    rt.supplierId = v;
    const rs = skuById(rt.skuId);
    if (rs) rs.supplierId = v;
  }
}

/** The property's package SKU, kept in step with the nightly price the way accommodationService does. */
function syncSku(h: H) {
  const s = sku(h);
  if (!s) return;
  s.title = `${h.name} — ${h.packageNights}-Night Stay`;
  s.titleAr = `${h.nameAr} — إقامة ${h.packageNights} ليالٍ`;
  s.basePriceEGP = h.perNightEGP * h.packageNights;
  s.durationMinutes = h.packageNights * 1440;
  s.routeFrom = h.areaName;
  s.routeTo = h.name;
}

// ─── rooms child (db.roomTypes) ─────────────────────────────────────────────

type R = RoomTypeEntity;

export const roomsChild: ChildAdapter<H, R> = {
  key: 'rooms',
  itemType: 'hotel-room',
  label: L('Room types', 'أنواع الغرف'),
  priceKey: 'priceFromEGP',
  sections: () => [
    {
      key: 'basics',
      label: L('Room', 'الغرفة'),
      fields: [
        { key: 'title', kind: 'i18nText', required: true, max: 200, label: L('Name', 'الاسم'), get: r => pair(r.name, r.nameAr), set: (r, v) => { r.name = v.en; r.nameAr = v.ar; } },
        { key: 'summary', kind: 'i18nTextarea', max: 3000, label: L('Description', 'الوصف'), get: r => pair(r.description, r.descriptionAr), set: (r, v) => { r.description = v.en || undefined; r.descriptionAr = v.ar || undefined; } },
        { key: 'code', kind: 'text', required: true, max: 32, label: L('Code', 'الرمز'), get: r => r.code, set: (r, v) => { r.code = v ?? r.code; } },
        { key: 'maxGuestsPerUnit', kind: 'number', required: true, min: 1, max: 30, label: L('Guests per room', 'الضيوف لكل غرفة'), get: r => r.maxGuestsPerUnit, set: (r, v) => { r.maxGuestsPerUnit = Math.round(v ?? 1); } },
        { key: 'totalUnits', kind: 'number', required: true, max: 2000, label: L('Rooms of this type', 'عدد الغرف من هذا النوع'), get: r => r.totalUnits, set: (r, v) => { r.totalUnits = Math.round(v ?? 0); } },
        { key: 'bedType', kind: 'text', max: 64, label: L('Bed type', 'نوع السرير'), get: r => r.bedType, set: (r, v) => { r.bedType = v || undefined; } },
        { key: 'bedCount', kind: 'number', max: 20, label: L('Beds', 'عدد الأسرة'), get: r => r.bedCount, set: (r, v) => { r.bedCount = v === undefined ? undefined : Math.round(v); } },
        { key: 'sizeSqm', kind: 'number', max: 5000, label: L('Size (m²)', 'المساحة (م²)'), get: r => r.sizeSqm, set: (r, v) => { r.sizeSqm = v; } },
        { key: 'view', kind: 'text', max: 64, label: L('View', 'الإطلالة'), get: r => r.view, set: (r, v) => { r.view = v || undefined; } },
        { key: 'active', kind: 'boolean', label: L('On sale', 'متاح للبيع'), get: r => r.active, set: (r, v) => { r.active = v; } },
        { key: 'displayOrder', kind: 'number', max: 1000, label: L('Order', 'الترتيب'), get: r => r.displayOrder, set: (r, v) => { r.displayOrder = Math.round(v ?? 0); } },
      ],
    },
    {
      key: 'pricing',
      label: L('Rates', 'الأسعار'),
      fields: [
        { key: 'priceFromEGP', kind: 'money', required: true, label: L('Nightly rate (EGP)', 'سعر الليلة (جنيه)'), get: r => r.baseNightlyEGP, set: (r, v) => { r.baseNightlyEGP = v ?? 0; } },
        { key: 'weeklyRateEGP', kind: 'money', label: L('Weekly rate', 'السعر الأسبوعي'), get: r => r.weeklyRateEGP, set: (r, v) => { r.weeklyRateEGP = v; } },
        { key: 'monthlyRateEGP', kind: 'money', label: L('Monthly rate', 'السعر الشهري'), get: r => r.monthlyRateEGP, set: (r, v) => { r.monthlyRateEGP = v; } },
        { key: 'minNights', kind: 'number', min: 1, max: 30, label: L('Min nights', 'أقل عدد ليالٍ'), get: r => r.minNights, set: (r, v) => { r.minNights = Math.round(v ?? 1); } },
        { key: 'maxNights', kind: 'number', min: 1, max: 365, label: L('Max nights', 'أقصى عدد ليالٍ'), get: r => r.maxNights, set: (r, v) => { r.maxNights = Math.round(v ?? 30); } },
        { key: 'cancellationPolicyHours', kind: 'number', max: 720, label: L('Free cancellation (hours)', 'الإلغاء المجاني (ساعات)'), get: r => r.cancellationPolicyHours, set: (r, v) => { r.cancellationPolicyHours = Math.round(v ?? 48); } },
      ],
    },
    {
      key: 'media',
      label: L('Photos & amenities', 'الصور والمرافق'),
      fields: [
        { key: 'images', kind: 'gallery', max: 20, label: L('Photos', 'الصور'), get: r => r.images, set: (r, v) => { r.images = v; } },
        { key: 'amenities', kind: 'tags', label: L('Amenities', 'المرافق'), suggestions: AMENITY_SUGGESTIONS, get: r => r.amenities, set: (r, v) => { r.amenities = v; } },
      ],
    },
  ],
  list: h => db.roomTypes.filter(r => r.accommodationId === h.id).sort((a, b) => a.displayOrder - b.displayOrder),
  find: (h, id) => db.roomTypes.find(r => r.id === id && r.accommodationId === h.id),
  idOf: r => r.id,
  statusOf: r => activeStatus(r.active),
  blank: (h, input) => {
    const code = String((input.fields as Record<string, unknown> | undefined)?.code ?? newId('RT').slice(-6)).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 32) || newId('RT').slice(-6);
    const supplierId = sku(h)?.supplierId;
    if (!supplierId) throw new CatalogError(409, 'This property has no owner SKU; it cannot sell rooms yet.', 'conflict');
    const now = new Date().toISOString();
    return {
      id: `RT-${h.id}-${code}`, accommodationId: h.id, skuId: `SKU-RT-${h.id}-${code}`, supplierId, code, name: '', nameAr: '',
      maxGuestsPerUnit: 2, baseNightlyEGP: 0, minNights: 1, maxNights: 30, cancellationPolicyHours: 48, totalUnits: 0,
      inventorySource: 'ADMIN_VERIFIED', amenities: [], images: [], active: false, displayOrder: 0, createdAt: now, updatedAt: now,
    };
  },
  insert: (_h, r) => {
    if (db.roomTypes.some(o => o.id === r.id)) throw new CatalogError(409, `Room code ${r.code} is already used for this property.`, 'conflict');
    db.roomTypes.push(r);
  },
  afterWrite: (_h, r) => {
    r.inventorySource = 'ADMIN_VERIFIED';
    // Zero units are not sellable — the rule adminHotelRoutes and the backfill apply.
    if (r.totalUnits <= 0) r.active = false;
    r.updatedAt = new Date().toISOString();
    ensureNightlySku(r, db.productSkus);
  },
  inUse: (_h, r) =>
    db.hotelBookings.some(b => b.roomTypeId === r.id) || db.bookings.some(b => b.roomTypeId === r.id || b.skuId === r.skuId)
      ? 'Stays were booked against this room type — set it off sale instead.'
      : null,
  remove: (_h, r) => {
    for (let i = db.roomRateNights.length - 1; i >= 0; i--) if (db.roomRateNights[i].roomTypeId === r.id) db.roomRateNights.splice(i, 1);
    db.roomTypes.splice(db.roomTypes.indexOf(r), 1);
    const s = skuById(r.skuId);
    if (s) db.productSkus.splice(db.productSkus.indexOf(s), 1);
  },
};

// ─── adapter ────────────────────────────────────────────────────────────────

export const hotelAdapter: CatalogAdapter<H> = {
  type: 'hotel',
  area: 'hotels',
  label: L('Hotels & stays', 'الفنادق والإقامات'),
  icon: 'bed',
  supplierOwned: true,
  hasNativeActive: () => true,
  sections,
  children: [roomsChild],
  extraChildren: [{ key: 'rates', label: L('Rate calendar', 'تقويم الأسعار'), kind: 'rateCalendar' }],
  listColumns: ['title', 'status', 'priceFromEGP', 'supplierName', 'completeness'],
  filters: ['status', 'supplierId', 'area', 'propertyType'],
  priceKey: 'priceFromEGP',
  rows: () => db.accommodations,
  idOf: h => h.id,
  supplierOf: h => sku(h)?.supplierId ?? null,
  nativeStatus: h => activeStatus(h.active),
  applyStatus: (h, s) => { h.active = s === 'published'; },
  entityUpdatedAt: h => h.updatedAt,
  touchEntity: (h, at) => { h.updatedAt = at; },
  blank: (supplierId, input) => {
    const now = new Date().toISOString();
    const fields = (input.fields as Record<string, unknown> | undefined) ?? {};
    const area = db.areaProfiles.find(a => a.id === fields.area) ?? db.areaProfiles[0];
    const title = (input.title as { en?: string } | undefined)?.en || 'property';
    const id = newId('ACC');
    return {
      id, slug: `${slugify(title)}-${id.slice(-6).toLowerCase()}`, name: '', nameAr: '', propertyType: 'hotel', category: 'mid-range',
      priceBand: 'moderate', areaId: area?.id ?? '', area: area?.id ?? '', areaName: area?.nameEn ?? '', areaNameAr: area?.nameAr ?? '',
      rating: 0, reviewCount: 0, typeChips: [], typeChipsAr: [], tagline: '', taglineAr: '', description: '', descriptionAr: '',
      amenities: [], amenitiesAr: [], perNightEGP: 0, packageNights: 1, rooms: 0, maxGuests: 2, bestFor: '', bestForAr: '',
      note: '', noteAr: '', skuId: supplierId ?? '', active: false, featured: false, createdAt: now, updatedAt: now,
    };
  },
  insert: h => {
    // blank() parked the requested owner in skuId; resolve it into a real
    // owner SKU now (a placeholder supplier when staff named none, exactly as
    // accommodationService.createAccommodation does).
    let supplierId = h.skuId && db.suppliers.some(s => s.id === h.skuId) ? h.skuId : '';
    if (!supplierId) {
      const supplier: SupplierEntity = {
        id: newId('SUP-ACC'), businessName: h.name || 'New property', businessNameAr: h.nameAr || h.name || 'عقار جديد', category: 'hotel',
        businessType: `Directory accommodation — ${h.propertyType.toUpperCase()}`, tier: 'Vetted Local Partner', status: 'Active',
        serviceTypes: ['hotel'], area: h.area, address: h.areaName, city: 'Dahab', country: 'Egypt',
        metadata: { source: 'catalogService' },
      };
      db.suppliers.push(supplier);
      supplierId = supplier.id;
    }
    const row: ProductSkuEntity = {
      id: newId('SKU-ACC'), supplierId, serviceType: 'hotel', title: '', titleAr: '', description: '', basePriceEGP: 0, currency: 'EGP',
      maxCapacityPerSlot: 10, active: true, cancellationPolicyHours: 48,
    };
    db.productSkus.push(row);
    h.skuId = row.id;
    db.accommodations.push(h);
  },
  afterWrite: h => syncSku(h),
  inUse: h => {
    if (db.hotelBookings.some(b => b.accommodationId === h.id)) return 'Stays were booked at this property.';
    if (db.bookings.some(b => b.skuId === h.skuId)) return 'The property package was booked.';
    return null;
  },
  remove: h => {
    for (const r of db.roomTypes.filter(x => x.accommodationId === h.id)) roomsChild.remove(h, r);
    for (let i = db.propertySources.length - 1; i >= 0; i--) if (db.propertySources[i].accommodationId === h.id) db.propertySources.splice(i, 1);
    const s = sku(h);
    if (s) db.productSkus.splice(db.productSkus.indexOf(s), 1);
    db.accommodations.splice(db.accommodations.indexOf(h), 1);
  },
  duplicate: h => {
    const copy: H = JSON.parse(JSON.stringify(h));
    copy.id = newId('ACC');
    copy.slug = `${h.slug}-copy-${copy.id.slice(-4).toLowerCase()}`;
    copy.name = `${h.name} (copy)`;
    copy.nameAr = h.nameAr ? `${h.nameAr} (نسخة)` : '';
    delete copy.tripadvisor;
    // insert() turns this owner id into a fresh package SKU. Rooms are not copied.
    copy.skuId = sku(h)?.supplierId ?? '';
    copy.createdAt = new Date().toISOString();
    return copy;
  },
  setSupplier,
};
