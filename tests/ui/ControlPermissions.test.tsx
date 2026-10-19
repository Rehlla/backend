import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { LanguageProvider } from '../../src/i18n/LanguageContext';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';
import { RequirePermission } from '../../src/components/auth/RequireRole';
import { RoleMatrix, toggleGrant } from '../../src/components/operations/command-center/control/RolesTab';
import { api, type AdminRole, type PermissionCatalogItem } from '../../src/services/api';
import { grantCovers, permissionGranted, roleFallbackPermissions } from '../../src/lib/permissions';

// vitest runs without globals here, so Testing Library's auto-cleanup is
// not registered — do it explicitly or DOM nodes leak between tests.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function meResponse(role: string, permissions?: string[]) {
  return {
    user: { id: 'U-1', email: 'staff@dahab.test', name: 'Staff', phone: '', role, status: 'active', createdAt: '2026-01-01T00:00:00.000Z' },
    session: { id: 'S-1', userId: 'U-1', role, expiresAt: '2026-12-31T00:00:00.000Z' },
    ...(permissions ? { permissions, flags: { 'killswitch.ai': false } } : {}),
  };
}

function Probe() {
  const { can, canAny, isSignedIn } = useAuth();
  if (!isSignedIn) return <div>signed-out</div>;
  return (
    <ul>
      <li data-testid="trips">{String(can('ops.trips.view'))}</li>
      <li data-testid="refund">{String(can('ops.commerce.refund'))}</li>
      <li data-testid="users">{String(can('admin.users.view'))}</li>
      <li data-testid="any">{String(canAny(['admin.settings.view', 'ops.audit.view']))}</li>
    </ul>
  );
}

function renderWithSession(me: unknown, ui: React.ReactNode) {
  vi.spyOn(api, 'getMe').mockResolvedValue(me as any);
  vi.spyOn(api, 'pingHealth').mockResolvedValue(null as any);
  return render(
    <LanguageProvider>
      <AuthProvider>{ui}</AuthProvider>
    </LanguageProvider>
  );
}

describe('permission matching', () => {
  it('honours *, area.* and exact grants', () => {
    expect(grantCovers('*', 'admin.users.manage')).toBe(true);
    expect(grantCovers('ops.*', 'ops.trips.view')).toBe(true);
    expect(grantCovers('ops.*', 'opsx.trips.view')).toBe(false);
    expect(grantCovers('ops.trips.view', 'ops.trips.manage')).toBe(false);
    expect(permissionGranted(['cms.content.view', 'ops.flags.view'], 'ops.flags.view')).toBe(true);
    expect(permissionGranted([], 'ops.flags.view')).toBe(false);
  });

  it('has role defaults for sessions without a permission list', () => {
    expect(roleFallbackPermissions('Admin')).toEqual(['*']);
    expect(permissionGranted(roleFallbackPermissions('Operations'), 'ops.audit.view')).toBe(true);
    expect(permissionGranted(roleFallbackPermissions('Operations'), 'admin.users.view')).toBe(false);
    expect(roleFallbackPermissions('Traveler')).toEqual([]);
  });
});

describe('useAuth().can', () => {
  it('uses the server permission list from /api/auth/me', async () => {
    renderWithSession(meResponse('Operations', ['ops.trips.view', 'ops.audit.view']), <Probe />);
    await waitFor(() => expect(screen.getByTestId('trips').textContent).toBe('true'));
    expect(screen.getByTestId('refund').textContent).toBe('false');
    expect(screen.getByTestId('users').textContent).toBe('false');
    expect(screen.getByTestId('any').textContent).toBe('true');
  });

  it('treats * as every permission', async () => {
    renderWithSession(meResponse('Admin', ['*']), <Probe />);
    await waitFor(() => expect(screen.getByTestId('users').textContent).toBe('true'));
    expect(screen.getByTestId('refund').textContent).toBe('true');
  });

  it('falls back to role defaults when /me carries no permissions', async () => {
    renderWithSession(meResponse('Operations'), <Probe />);
    await waitFor(() => expect(screen.getByTestId('trips').textContent).toBe('true'));
    expect(screen.getByTestId('users').textContent).toBe('false');
  });
});

describe('RequirePermission', () => {
  it('renders children when the permission is granted', async () => {
    renderWithSession(
      meResponse('Operations', ['ops.flags.view']),
      <RequirePermission permission="ops.flags.view"><div>flags-panel</div></RequirePermission>
    );
    await waitFor(() => expect(screen.getByText('flags-panel')).toBeTruthy());
  });

  it('renders the fallback when it is missing', async () => {
    renderWithSession(
      meResponse('Operations', ['ops.flags.view']),
      <RequirePermission anyOf={['admin.users.view', 'admin.settings.view']} fallback={<div>no-access</div>}>
        <div>admin-panel</div>
      </RequirePermission>
    );
    await waitFor(() => expect(screen.getByText('no-access')).toBeTruthy());
    expect(screen.queryByText('admin-panel')).toBeNull();
  });

  it('shows the default notice to a signed-out visitor', async () => {
    vi.spyOn(api, 'getMe').mockResolvedValue(null as any);
    vi.spyOn(api, 'pingHealth').mockResolvedValue(null as any);
    render(
      <LanguageProvider>
        <AuthProvider>
          <RequirePermission permission="ops.flags.view"><div>secret</div></RequirePermission>
        </AuthProvider>
      </LanguageProvider>
    );
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByText('secret')).toBeNull();
  });
});

const CATALOG: PermissionCatalogItem[] = [
  { key: 'ops.trips.view', group: 'ops', labelEn: 'View trips and bookings', labelAr: 'عرض الرحلات', dangerous: false },
  { key: 'ops.commerce.refund', group: 'ops', labelEn: 'Issue refunds', labelAr: 'إصدار المبالغ المستردة', dangerous: true },
  { key: 'cms.content.view', group: 'cms', labelEn: 'View content', labelAr: 'عرض المحتوى', dangerous: false },
  { key: 'admin.users.manage', group: 'admin', labelEn: 'Manage users', labelAr: 'إدارة المستخدمين', dangerous: true },
];

const ROLES: AdminRole[] = [
  { id: 'Operations', name: 'Operations', description: '', isSystem: true, permissions: ['ops.*', 'cms.content.view'], userCount: 3 },
  { id: 'Product', name: 'Product', description: '', isSystem: true, permissions: ['cms.*'], userCount: 1 },
  { id: 'Admin', name: 'Admin', description: '', isSystem: true, permissions: ['*'], userCount: 1 },
];

describe('RoleMatrix', () => {
  beforeEach(() => {
    vi.spyOn(api, 'getMe').mockResolvedValue(null as any);
  });

  function renderMatrix(editing?: { roleId: string; grants: string[] } | null) {
    return render(
      <LanguageProvider>
        <RoleMatrix catalog={CATALOG} roles={ROLES} editing={editing} onToggle={() => {}} />
      </LanguageProvider>
    );
  }

  it('groups permissions by area with one column per role', () => {
    renderMatrix();
    const table = screen.getByRole('table');
    expect(within(table).getByText('Operations', { selector: 'th[scope="rowgroup"]' })).toBeTruthy();
    expect(within(table).getByText('Content')).toBeTruthy();
    expect(within(table).getByText('Administration')).toBeTruthy();
    expect(table.querySelectorAll('thead th').length).toBe(ROLES.length + 1);
    expect(table.querySelectorAll('tr[data-permission]').length).toBe(CATALOG.length);
  });

  it('marks dangerous permissions', () => {
    renderMatrix();
    expect(screen.getAllByTestId('dangerous-marker').length).toBe(2);
    const refundRow = document.querySelector('tr[data-permission="ops.commerce.refund"]')!;
    expect(within(refundRow as HTMLElement).getByTestId('dangerous-marker')).toBeTruthy();
  });

  it('ticks grants including wildcards, and locks columns not being edited', () => {
    renderMatrix();
    const box = (role: string, key: string) => screen.getByLabelText(`${role}: ${key}`) as HTMLInputElement;
    expect(box('Operations', 'ops.commerce.refund').checked).toBe(true);
    expect(box('Operations', 'admin.users.manage').checked).toBe(false);
    expect(box('Product', 'cms.content.view').checked).toBe(true);
    expect(box('Product', 'ops.trips.view').checked).toBe(false);
    expect(box('Admin', 'admin.users.manage').checked).toBe(true);
    expect(box('Operations', 'ops.trips.view').disabled).toBe(true);
  });

  it('enables only the edited column and shows its draft', () => {
    renderMatrix({ roleId: 'Product', grants: ['cms.*', 'ops.trips.view'] });
    const productTrips = screen.getByLabelText('Product: ops.trips.view') as HTMLInputElement;
    expect(productTrips.checked).toBe(true);
    expect(productTrips.disabled).toBe(false);
    expect((screen.getByLabelText('Operations: ops.trips.view') as HTMLInputElement).disabled).toBe(true);
  });
});

describe('toggleGrant', () => {
  const keys = CATALOG.map(p => p.key);
  it('adds a missing key', () => {
    expect(toggleGrant(['cms.*'], 'ops.trips.view', keys)).toEqual(['cms.*', 'ops.trips.view']);
  });
  it('removes an exact key', () => {
    expect(toggleGrant(['ops.trips.view', 'cms.content.view'], 'ops.trips.view', keys)).toEqual(['cms.content.view']);
  });
  it('expands a wildcard when unticking a key it covers', () => {
    expect(toggleGrant(['ops.*'], 'ops.commerce.refund', keys)).toEqual(['ops.trips.view']);
  });
});
