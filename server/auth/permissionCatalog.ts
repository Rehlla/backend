/**
 * Permission catalogue for the staff dashboard (docs/OPS_API_CONTRACT.md).
 *
 * Keys are `area.section.action`. The catalogue is code, not data: a key that
 * no route checks is meaningless, so the list lives next to the code that
 * checks it and ships with it. Roles and per-user overrides (which ARE data)
 * reference these keys.
 *
 * `*` (Admin) grants everything. A grant ending in `.*` grants every key with
 * that prefix (`ops.*`, `supplier.*`).
 */

export type BaseRole = 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';

export interface PermissionDef {
  key: string;
  group: 'ops' | 'supplier' | 'market' | 'cms' | 'admin' | 'catalog';
  labelEn: string;
  labelAr: string;
  /** Moves money, changes access, or changes platform-wide behaviour. */
  dangerous: boolean;
}

const p = (key: string, labelEn: string, labelAr: string, dangerous = false): PermissionDef => ({
  key,
  group: key.split('.')[0] as PermissionDef['group'],
  labelEn,
  labelAr,
  dangerous,
});

export const PERMISSION_CATALOG: readonly PermissionDef[] = [
  // ops
  p('ops.overview.view', 'View operations overview', 'عرض نظرة عامة على العمليات'),
  p('ops.trips.view', 'View trips and bookings', 'عرض الرحلات والحجوزات'),
  p('ops.trips.manage', 'Manage trips and bookings', 'إدارة الرحلات والحجوزات'),
  p('ops.transfers.view', 'View transfers', 'عرض التنقلات'),
  p('ops.transfers.manage', 'Manage transfers', 'إدارة التنقلات'),
  p('ops.exceptions.view', 'View exceptions', 'عرض الاستثناءات'),
  p('ops.exceptions.resolve', 'Resolve exceptions', 'حل الاستثناءات'),
  p('ops.commerce.view', 'View payments and ledger', 'عرض المدفوعات والدفتر'),
  p('ops.commerce.refund', 'Issue refunds', 'إصدار المبالغ المستردة', true),
  p('ops.accommodations.view', 'View accommodations', 'عرض أماكن الإقامة'),
  p('ops.accommodations.manage', 'Manage accommodations', 'إدارة أماكن الإقامة'),
  p('ops.stays.view', 'View stays', 'عرض الإقامات'),
  p('ops.stays.manage', 'Manage stays, rooms and rates', 'إدارة الإقامات والغرف والأسعار'),
  p('ops.suppliers.view', 'View suppliers', 'عرض الموردين'),
  p('ops.suppliers.manage', 'Manage suppliers', 'إدارة الموردين'),
  p('ops.intelligence.view', 'View intelligence', 'عرض الذكاء'),
  p('ops.opportunities.view', 'View opportunities', 'عرض الفرص'),
  p('ops.knowledge.view', 'View knowledge base', 'عرض قاعدة المعرفة'),
  p('ops.knowledge.manage', 'Manage knowledge base', 'إدارة قاعدة المعرفة'),
  p('ops.support.view', 'View support inbox', 'عرض صندوق الدعم'),
  p('ops.support.reply', 'Reply to support messages', 'الرد على رسائل الدعم'),
  p('ops.sms.view', 'View SMS log', 'عرض سجل الرسائل'),
  p('ops.sms.send', 'Send SMS', 'إرسال الرسائل', true),
  p('ops.notifications.view', 'View notifications', 'عرض الإشعارات'),
  p('ops.notifications.send', 'Send notifications', 'إرسال الإشعارات', true),
  p('ops.audit.view', 'View audit log', 'عرض سجل التدقيق'),
  p('ops.flags.view', 'View feature flags', 'عرض مفاتيح الميزات'),
  p('ops.jobs.view', 'View background jobs', 'عرض المهام الخلفية'),
  p('ops.jobs.run', 'Run background jobs', 'تشغيل المهام الخلفية'),
  p('ops.health.view', 'View system health', 'عرض صحة النظام'),
  p('ops.pricing.view', 'View pricing', 'عرض التسعير'),
  p('ops.pricing.manage', 'Manage pricing and bundles', 'إدارة التسعير والباقات'),
  p('ops.dining.view', 'View dining orders', 'عرض طلبات المطاعم'),
  p('ops.dining.manage', 'Manage dining orders', 'إدارة طلبات المطاعم'),
  // supplier
  p('supplier.inbox.view', 'View supplier inbox', 'عرض صندوق المورد'),
  p('supplier.inbox.respond', 'Respond to booking requests', 'الرد على طلبات الحجز'),
  p('supplier.inventory.view', 'View inventory', 'عرض المخزون'),
  p('supplier.inventory.edit', 'Edit inventory', 'تعديل المخزون'),
  p('supplier.resources.manage', 'Manage resources', 'إدارة الموارد'),
  p('supplier.stays.manage', 'Manage own stays', 'إدارة الإقامات الخاصة'),
  p('supplier.rentals.manage', 'Manage own rentals', 'إدارة الإيجارات الخاصة'),
  p('supplier.revenue.view', 'View revenue', 'عرض الإيرادات'),
  p('supplier.reliability.view', 'View reliability', 'عرض الموثوقية'),
  p('supplier.audit.view', 'View supplier audit', 'عرض تدقيق المورد'),
  p('supplier.catalog.manage', 'Manage own catalogue listings', 'إدارة قوائم الكتالوج الخاصة'),
  // catalog (docs/CATALOG_API_CONTRACT.md)
  p('catalog.activities.view', 'View activities catalogue', 'عرض كتالوج الأنشطة'),
  p('catalog.activities.manage', 'Edit activities', 'تعديل الأنشطة'),
  p('catalog.activities.publish', 'Publish activities', 'نشر الأنشطة'),
  p('catalog.packages.view', 'View trip packages', 'عرض باقات الرحلات'),
  p('catalog.packages.manage', 'Edit trip packages', 'تعديل باقات الرحلات'),
  p('catalog.packages.publish', 'Publish trip packages', 'نشر باقات الرحلات'),
  p('catalog.transfers.view', 'View transfer catalogue', 'عرض كتالوج التنقلات'),
  p('catalog.transfers.manage', 'Edit transfer zones, buses and drivers', 'تعديل مناطق التنقل والحافلات والسائقين'),
  p('catalog.hotels.view', 'View hotels catalogue', 'عرض كتالوج الفنادق'),
  p('catalog.hotels.manage', 'Edit hotels, rooms and rates', 'تعديل الفنادق والغرف والأسعار'),
  p('catalog.hotels.publish', 'Publish hotels', 'نشر الفنادق'),
  p('catalog.restaurants.view', 'View restaurants catalogue', 'عرض كتالوج المطاعم'),
  p('catalog.restaurants.manage', 'Edit restaurants and menus', 'تعديل المطاعم والقوائم'),
  p('catalog.restaurants.publish', 'Publish restaurants', 'نشر المطاعم'),
  // market
  p('market.view', 'View market intelligence', 'عرض ذكاء السوق'),
  p('market.manage', 'Manage market data operations', 'إدارة عمليات بيانات السوق'),
  // cms
  p('cms.content.view', 'View content', 'عرض المحتوى'),
  p('cms.content.edit', 'Edit content', 'تعديل المحتوى'),
  p('cms.content.publish', 'Publish content', 'نشر المحتوى'),
  p('cms.media.upload', 'Upload media', 'رفع الوسائط'),
  p('cms.theme.manage', 'Manage theme', 'إدارة السمة'),
  p('cms.seo.manage', 'Manage SEO', 'إدارة تحسين محركات البحث'),
  // admin
  p('admin.users.view', 'View users', 'عرض المستخدمين'),
  p('admin.users.manage', 'Manage users', 'إدارة المستخدمين', true),
  p('admin.roles.manage', 'Manage roles', 'إدارة الأدوار', true),
  p('admin.settings.view', 'View settings', 'عرض الإعدادات'),
  p('admin.settings.manage', 'Change settings', 'تغيير الإعدادات', true),
  p('admin.flags.manage', 'Change flags and kill switches', 'تغيير المفاتيح ومفاتيح الإيقاف', true),
  p('admin.integrations.view', 'View integrations', 'عرض التكاملات'),
  p('admin.integrations.manage', 'Manage integrations', 'إدارة التكاملات', true),
  p('admin.approvals.decide', 'Decide approvals', 'البت في الموافقات', true),
  p('admin.audit.export', 'Export audit log', 'تصدير سجل التدقيق'),
  p('admin.viewas', 'View as another user', 'العرض كمستخدم آخر', true),
];

export const PERMISSION_KEYS: ReadonlySet<string> = new Set(PERMISSION_CATALOG.map(d => d.key));

const keysWithPrefix = (prefix: string) => PERMISSION_CATALOG.filter(d => d.key.startsWith(prefix)).map(d => d.key);

const PRODUCT_CATALOG_KEYS = ['activities', 'packages', 'hotels', 'restaurants']
  .flatMap(area => [`catalog.${area}.view`, `catalog.${area}.manage`]);

/**
 * Keys added after system roles were first persisted. ensureSystemRoles
 * backfills them into stored system roles that hold none of them yet, so an
 * existing store picks up the catalogue grants without a manual role edit.
 */
export const LATER_ROLE_DEFAULTS: Partial<Record<BaseRole, { permissions: string[] }>> = {
  Operations: { permissions: keysWithPrefix('catalog.') },
  Product: { permissions: PRODUCT_CATALOG_KEYS },
  Supplier: { permissions: ['supplier.catalog.manage'] },
};

/**
 * Default grants for the system roles. They mirror the pre-existing ROLE_RULES
 * in server/middleware/apiAccessPolicy.ts: every path a role could reach
 * before permissions existed must still be reachable with these defaults
 * (tests/ops/permissions.test.ts proves it rule by rule).
 *
 * Deviations from the plain contract table, each needed to keep a ROLE_RULES
 * path reachable, are documented in docs/OPS_API_CONTRACT.md.
 */
export const SYSTEM_ROLE_DEFAULTS: Record<BaseRole, { description: string; permissions: string[] }> = {
  Traveler: { description: 'Travellers. No staff permissions.', permissions: [] },
  Supplier: {
    description: 'Supplier accounts, scoped to their own supplierId.',
    permissions: keysWithPrefix('supplier.'),
  },
  Operations: {
    description: 'Operations desk.',
    permissions: [
      ...keysWithPrefix('ops.'),
      'cms.content.view', 'cms.content.edit', 'cms.content.publish', 'cms.media.upload',
      // market.manage: ROLE_RULES let Operations write /market/* and the
      // /dahab/commerce data-ops endpoints.
      'market.view', 'market.manage',
      ...keysWithPrefix('supplier.').filter(k => k.endsWith('.view')),
      // Catalogue (docs/CATALOG_API_CONTRACT.md): Operations gets every catalog.* key.
      ...keysWithPrefix('catalog.'),
    ],
  },
  Product: {
    description: 'Product and content team.',
    permissions: [
      ...keysWithPrefix('market.'), ...keysWithPrefix('cms.'), 'ops.flags.view', 'ops.overview.view',
      // Catalogue: drafts and edits, not publishing; transfers stay with Operations.
      ...PRODUCT_CATALOG_KEYS,
    ],
  },
  Admin: { description: 'Administrators. Everything.', permissions: ['*'] },
};

export const SYSTEM_ROLE_IDS: readonly BaseRole[] = ['Traveler', 'Supplier', 'Operations', 'Product', 'Admin'];

/** True when a single grant (exact, `prefix.*`, or `*`) covers `key`. */
export function grantCovers(grant: string, key: string): boolean {
  if (grant === '*') return true;
  if (grant === key) return true;
  if (grant.endsWith('.*')) return key.startsWith(grant.slice(0, -1));
  return false;
}

/** Grant keys accepted on role/override writes: catalogue keys, `*`, or a known prefix wildcard. */
export function isValidGrantKey(key: string): boolean {
  if (key === '*' || PERMISSION_KEYS.has(key)) return true;
  if (key.endsWith('.*')) {
    const prefix = key.slice(0, -1);
    return PERMISSION_CATALOG.some(d => d.key.startsWith(prefix));
  }
  return false;
}
