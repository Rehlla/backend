/**
 * Client-side permission matching (docs/OPS_API_CONTRACT.md, "Permissions").
 *
 * Keys are `area.section.action`. A grant of `*` covers everything; a grant
 * ending in `.*` covers every key with that prefix (`ops.*`). The server
 * resolves the effective list (/api/auth/me → `permissions`) — this module
 * only answers "does this list cover that key". It is a usability guard: the
 * server checks every request again.
 */

export type PermissionRole = 'Traveler' | 'Supplier' | 'Operations' | 'Product' | 'Admin';

/** True when `grant` covers `key`. */
export function grantCovers(grant: string, key: string): boolean {
  if (grant === '*' || grant === key) return true;
  if (grant.endsWith('.*')) return key.startsWith(grant.slice(0, -1));
  return false;
}

/** True when any grant in `permissions` covers `key`. */
export function permissionGranted(permissions: readonly string[], key: string): boolean {
  return permissions.some(g => grantCovers(g, key));
}

/**
 * The role defaults from the contract, used only when a session carries no
 * permission list (a session issued before permissions existed). Mirrors the
 * server's default role grants so the dashboard behaves as it did by role.
 */
export function roleFallbackPermissions(role: PermissionRole): string[] {
  switch (role) {
    case 'Admin':
      return ['*'];
    case 'Operations':
      return [
        'ops.*',
        'cms.content.*',
        'cms.media.upload',
        'market.view',
        'supplier.inbox.view',
        'supplier.inventory.view',
        'supplier.revenue.view',
        'supplier.reliability.view',
        'supplier.audit.view',
        'catalog.*',
      ];
    case 'Product':
      return [
        'market.*',
        'cms.*',
        'ops.flags.view',
        'ops.overview.view',
        // docs/CATALOG_API_CONTRACT.md: Product views and edits, but does not publish.
        'catalog.activities.view',
        'catalog.activities.manage',
        'catalog.packages.view',
        'catalog.packages.manage',
        'catalog.hotels.view',
        'catalog.hotels.manage',
        'catalog.restaurants.view',
        'catalog.restaurants.manage',
      ];
    case 'Supplier':
      return ['supplier.*'];
    default:
      return [];
  }
}
