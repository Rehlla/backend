import { activityAdapter } from './activityAdapter';
import { packageAdapter } from './packageAdapter';
import { transferBusAdapter, transferDriverAdapter, transferZoneAdapter } from './transferAdapters';
import { hotelAdapter } from './hotelAdapter';
import { restaurantAdapter } from './restaurantAdapter';
import { toSchemaSections } from './fields';
import { CatalogError, type CatalogAdapter, type CatalogType, type ChildRef, type TypeSchema } from './types';

/** The catalogue registry: one adapter per type (docs/CATALOG_API_CONTRACT.md, Types). */
export const ADAPTERS: Record<CatalogType, CatalogAdapter<any>> = {
  activity: activityAdapter,
  package: packageAdapter,
  'transfer-zone': transferZoneAdapter,
  'transfer-bus': transferBusAdapter,
  'transfer-driver': transferDriverAdapter,
  hotel: hotelAdapter,
  restaurant: restaurantAdapter,
};

export const CATALOG_TYPES = Object.keys(ADAPTERS) as CatalogType[];

export function adapterFor(type: string): CatalogAdapter<any> {
  const adapter = (ADAPTERS as Record<string, CatalogAdapter<any> | undefined>)[type];
  if (!adapter) throw new CatalogError(404, `Unknown catalogue type "${type}".`);
  return adapter;
}

/** Permission key for one action on one type. Transfers have no publish key: manage covers it. */
export function permissionFor(adapter: CatalogAdapter<any>, action: 'view' | 'manage' | 'publish'): string {
  if (adapter.area === 'transfers' && action === 'publish') return 'catalog.transfers.manage';
  return `catalog.${adapter.area}.${action}`;
}

/**
 * GET /schema. `types` drives the list + form per type; `itemTypes` carries
 * the child forms (hotel-room, restaurant-menu-item, activity-slot,
 * package-day) referenced by children[].itemType.
 */
export function buildSchema(filter: (a: CatalogAdapter<any>) => boolean = () => true): { types: TypeSchema[]; itemTypes: TypeSchema[] } {
  const types: TypeSchema[] = [];
  const itemTypes: TypeSchema[] = [];
  for (const adapter of CATALOG_TYPES.map(t => ADAPTERS[t]).filter(filter)) {
    const children: ChildRef[] = adapter.children.map(c => ({ key: c.key, label: c.label, itemType: c.itemType, kind: 'list' as const }));
    if (adapter.type === 'activity') {
      const slots = children.find(c => c.key === 'slots');
      if (slots) slots.kind = 'slotCalendar';
    }
    children.push(...(adapter.extraChildren ?? []));
    types.push({
      type: adapter.type,
      label: adapter.label,
      icon: adapter.icon,
      sections: toSchemaSections(adapter.sections()),
      children,
      listColumns: adapter.listColumns,
      filters: adapter.filters,
    });
    for (const child of adapter.children) {
      itemTypes.push({
        type: child.itemType,
        label: child.label,
        icon: adapter.icon,
        sections: toSchemaSections(child.sections()),
        children: [],
        listColumns: ['title', 'status', 'priceFromEGP'],
        filters: [],
      });
    }
  }
  return { types, itemTypes };
}
