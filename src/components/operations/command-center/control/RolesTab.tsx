import React, { useMemo, useState } from 'react';
import { AlertTriangle, Lock, Pencil, Plus, Save, Shield, Trash2, X } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api, type AdminRole, type PermissionCatalogItem } from '../../../../services/api';
import { useAuth } from '../../../../context/AuthContext';
import { grantCovers, permissionGranted } from '../../../../lib/permissions';
import { EmptyState, Skeleton } from '../ui';
import {
  NoticeBar,
  buttonClass,
  dangerButtonClass,
  inputClass,
  primaryButtonClass,
  useLoader,
  useMutationRunner,
  useReasonPrompt,
} from './controlShared';

/**
 * Toggle one key in a role's grant list. Unchecking a key that is covered by a
 * wildcard (`ops.*`) expands the wildcard into the catalogue keys it covers,
 * minus the one being removed — so the role keeps exactly what the operator
 * sees ticked.
 */
export function toggleGrant(grants: readonly string[], key: string, catalogKeys: readonly string[]): string[] {
  if (!permissionGranted(grants, key)) return [...grants, key];
  const out: string[] = [];
  for (const g of grants) {
    if (g === key) continue;
    if (g !== key && grantCovers(g, key)) {
      for (const k of catalogKeys) if (k !== key && grantCovers(g, k) && !out.includes(k)) out.push(k);
      continue;
    }
    if (!out.includes(g)) out.push(g);
  }
  return out;
}

interface RoleMatrixProps {
  catalog: readonly PermissionCatalogItem[];
  roles: readonly AdminRole[];
  /** The role whose column is editable, with its draft grants. */
  editing?: { roleId: string; grants: string[] } | null;
  onToggle?: (key: string) => void;
}

/** Permission × role grid, grouped by area, with dangerous keys marked. */
export function RoleMatrix({ catalog, roles, editing, onToggle }: RoleMatrixProps) {
  const { t, language } = useLanguage();
  const groups = useMemo(() => {
    const map = new Map<string, PermissionCatalogItem[]>();
    for (const p of catalog) {
      const list = map.get(p.group) ?? [];
      list.push(p);
      map.set(p.group, list);
    }
    return [...map.entries()];
  }, [catalog]);

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] overflow-x-auto">
      <table className="w-full text-[11px]" aria-label={t('ctl.roles.matrix')}>
        <thead>
          <tr className="bg-[var(--btn-util-bg)] border-b border-[var(--border-subtle)]">
            <th scope="col" className="py-2 px-3 text-start font-bold text-[var(--text-muted)] uppercase tracking-wider">{t('ctl.roles.permission')}</th>
            {roles.map(r => (
              <th key={r.id} scope="col" className={`py-2 px-2 text-center font-bold whitespace-nowrap ${editing?.roleId === r.id ? 'text-[var(--accent-primary)]' : 'text-[var(--text-muted)]'}`}>
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        {groups.map(([group, perms]) => (
          <tbody key={group} className="divide-y divide-[var(--border-subtle)]">
            <tr>
              <th colSpan={roles.length + 1} scope="rowgroup" className="py-1.5 px-3 text-start text-[10px] font-bold uppercase tracking-wider text-[var(--accent-primary)] bg-[var(--accent-primary)]/5">
                {t(`ctl.roles.group.${group}`, group)}
              </th>
            </tr>
            {perms.map(p => (
              <tr key={p.key} data-permission={p.key} className="hover:bg-[var(--btn-util-bg)]/50">
                <th scope="row" className="py-1.5 px-3 text-start font-normal">
                  <div className="flex items-center gap-1.5">
                    {p.dangerous && (
                      <span title={t('ctl.roles.dangerous')} data-testid="dangerous-marker" className="inline-flex items-center gap-0.5 rounded-full border border-red-500/30 bg-red-500/10 px-1.5 text-[9px] font-bold text-red-400">
                        <AlertTriangle className="w-2.5 h-2.5" aria-hidden="true" />
                        {t('ctl.roles.dangerousShort')}
                      </span>
                    )}
                    <span className="text-[var(--text-primary)]">{language === 'ar' ? p.labelAr : p.labelEn}</span>
                  </div>
                  <div className="font-mono text-[10px] text-[var(--text-muted)]">{p.key}</div>
                </th>
                {roles.map(r => {
                  const isEditing = editing?.roleId === r.id;
                  const grants = isEditing ? editing!.grants : r.permissions;
                  const checked = permissionGranted(grants, p.key);
                  return (
                    <td key={r.id} className={`py-1.5 px-2 text-center ${isEditing ? 'bg-[var(--accent-primary)]/5' : ''}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!isEditing}
                        onChange={() => onToggle?.(p.key)}
                        aria-label={`${r.name}: ${p.key}`}
                        className="accent-[var(--accent-primary)] cursor-pointer disabled:cursor-default"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}

export default function RolesTab() {
  const { t } = useLanguage();
  const { can } = useAuth();
  const canManage = can('admin.roles.manage');
  const { run, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const { data, loading, error, reload } = useLoader(
    async signal => {
      const [perms, roles] = await Promise.all([api.adminListPermissions(signal), api.adminListRoles(signal)]);
      return { catalog: perms.items, roles: roles.items };
    },
    []
  );
  const [editing, setEditing] = useState<{ roleId: string; grants: string[]; description: string } | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '', baseRole: 'Operations' as 'Operations' | 'Product' | 'Supplier' });

  if (loading && !data) return <Skeleton variant="table" />;
  if (error) return <EmptyState icon={Shield} title={t('ctl.loadFailed')} description={error} action={{ label: t('ctl.action.retry'), onClick: reload }} />;
  if (!data) return null;
  const catalogKeys = data.catalog.map(p => p.key);
  const editingRole = editing ? data.roles.find(r => r.id === editing.roleId) : undefined;

  const createRole = async () => {
    const ok = await run(
      () => api.adminCreateRole({ name: draft.name.trim(), description: draft.description, permissions: [], baseRole: draft.baseRole }),
      t('ctl.roles.created')
    );
    if (ok) {
      setCreating(false);
      setDraft({ name: '', description: '', baseRole: 'Operations' });
      reload();
    }
  };

  return (
    <div className="space-y-3">
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-[var(--text-muted)] flex-1 min-w-[200px]">{t('ctl.roles.intro')}</p>
        {canManage && !creating && (
          <button type="button" className={primaryButtonClass} onClick={() => setCreating(true)}>
            <Plus className="w-3.5 h-3.5" /> {t('ctl.roles.create')}
          </button>
        )}
      </div>

      {creating && (
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 grid gap-2 sm:grid-cols-4 items-end">
          <label className="block sm:col-span-1">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.roles.name')}</span>
            <input className={inputClass} value={draft.name} maxLength={60} onChange={e => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.roles.description')}</span>
            <input className={inputClass} value={draft.description} maxLength={500} onChange={e => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.roles.baseRole')}</span>
            <select className={inputClass} value={draft.baseRole} onChange={e => setDraft({ ...draft, baseRole: e.target.value as typeof draft.baseRole })}>
              <option value="Operations">Operations</option>
              <option value="Product">Product</option>
              <option value="Supplier">Supplier</option>
            </select>
          </label>
          <div className="sm:col-span-4 flex justify-end gap-2">
            <button type="button" className={buttonClass} onClick={() => setCreating(false)}>
              <X className="w-3.5 h-3.5" /> {t('ctl.action.cancel')}
            </button>
            <button type="button" className={primaryButtonClass} disabled={draft.name.trim().length < 2} onClick={createRole}>
              <Save className="w-3.5 h-3.5" /> {t('ctl.roles.create')}
            </button>
          </div>
        </div>
      )}

      {/* Role cards: who holds it, and its actions. */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {data.roles.map(r => {
          const isAdminRole = r.permissions.includes('*');
          return (
            <div key={r.id} className={`rounded-2xl border p-3 bg-[var(--surface-container)] ${editing?.roleId === r.id ? 'border-[var(--accent-primary)]/60' : 'border-[var(--border-subtle)]'}`}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[var(--text-primary)] truncate">{r.name}</span>
                {r.isSystem && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--text-muted)]"><Lock className="w-3 h-3" aria-hidden="true" />{t('ctl.roles.system')}</span>
                )}
                <span className="ms-auto text-[10px] font-mono text-[var(--text-muted)]">{t('ctl.roles.userCount', { count: r.userCount })}</span>
              </div>
              {r.description && <p className="text-[11px] text-[var(--text-muted)] mt-1">{r.description}</p>}
              {canManage && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {editing?.roleId === r.id ? (
                    <>
                      <button
                        type="button"
                        className={primaryButtonClass}
                        onClick={() =>
                          ask({
                            title: t('ctl.roles.saveTitle', { name: r.name }),
                            description: t('ctl.roles.saveBody'),
                            run: reason => api.adminUpdateRole(r.id, { permissions: editing.grants, description: editing.description, reason }),
                            success: t('ctl.roles.saved'),
                            after: () => { setEditing(null); reload(); },
                          })
                        }
                      >
                        <Save className="w-3.5 h-3.5" /> {t('ctl.action.save')}
                      </button>
                      <button type="button" className={buttonClass} onClick={() => setEditing(null)}>
                        <X className="w-3.5 h-3.5" /> {t('ctl.action.cancel')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={isAdminRole}
                      title={isAdminRole ? t('ctl.roles.adminLocked') : undefined}
                      onClick={() => setEditing({ roleId: r.id, grants: [...r.permissions], description: r.description })}
                    >
                      <Pencil className="w-3.5 h-3.5" /> {t('ctl.action.edit')}
                    </button>
                  )}
                  {!r.isSystem && (
                    <button
                      type="button"
                      className={dangerButtonClass}
                      disabled={r.userCount > 0}
                      title={r.userCount > 0 ? t('ctl.roles.deleteBlocked') : undefined}
                      onClick={() =>
                        ask({
                          title: t('ctl.roles.deleteTitle', { name: r.name }),
                          critical: true,
                          confirmLabel: t('ctl.action.delete'),
                          run: reason => api.adminDeleteRole(r.id, reason),
                          success: t('ctl.roles.deleted'),
                          after: () => { if (editing?.roleId === r.id) setEditing(null); reload(); },
                        })
                      }
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {t('ctl.action.delete')}
                    </button>
                  )}
                </div>
              )}
              {editing?.roleId === r.id && (
                <label className="block mt-2">
                  <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.roles.description')}</span>
                  <input className={inputClass} value={editing.description} maxLength={500} onChange={e => setEditing({ ...editing, description: e.target.value })} />
                </label>
              )}
            </div>
          );
        })}
      </div>

      {editingRole && (
        <p className="text-[11px] text-[var(--accent-primary)] font-bold">{t('ctl.roles.editingHint', { name: editingRole.name })}</p>
      )}
      <RoleMatrix
        catalog={data.catalog}
        roles={data.roles}
        editing={editing ? { roleId: editing.roleId, grants: editing.grants } : null}
        onToggle={key => editing && setEditing({ ...editing, grants: toggleGrant(editing.grants, key, catalogKeys) })}
      />
      {dialog}
    </div>
  );
}
