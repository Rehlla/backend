import React, { useEffect, useState } from 'react';
import { Copy, KeyRound, LogOut, Plus, Search, ShieldOff, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { api, type AdminRole, type AdminUserRow, type PermissionCatalogItem } from '../../../../services/api';
import { DataTable, EmptyState, Skeleton, StatusBadge } from '../ui';
import {
  Drawer,
  NoticeBar,
  buttonClass,
  dangerButtonClass,
  formatWhen,
  inputClass,
  primaryButtonClass,
  useLoader,
  useMutationRunner,
  useReasonPrompt,
} from './controlShared';

const PAGE = 25;

export default function UsersTab() {
  const { t, language } = useLanguage();
  const { can } = useAuth();
  const canManage = can('admin.users.manage');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<'' | 'active' | 'suspended'>('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<AdminUserRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  // Debounced search box.
  useEffect(() => {
    const id = window.setTimeout(() => { setQuery(q.trim()); setCursor(undefined); }, 300);
    return () => window.clearTimeout(id);
  }, [q]);

  const list = useLoader(
    signal => api.adminListUsers({ q: query || undefined, role: role || undefined, status: status || undefined, cursor, limit: PAGE, sort: '-createdAt' }, signal),
    [query, role, status, cursor]
  );
  useEffect(() => {
    if (!list.data) return;
    setRows(prev => (cursor ? [...prev, ...list.data!.items.filter(i => !prev.some(p => p.id === i.id))] : list.data!.items));
  }, [list.data, cursor]);

  const meta = useLoader(async signal => {
    const [roles, perms] = await Promise.all([api.adminListRoles(signal), api.adminListPermissions(signal)]);
    return { roles: roles.items, catalog: perms.items };
  }, []);

  const resetAndReload = () => {
    if (cursor) setCursor(undefined);
    else list.reload();
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <label className="relative flex-1 min-w-[200px]">
          <span className="sr-only">{t('ctl.users.search')}</span>
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" aria-hidden="true" />
          <input className={`${inputClass} ps-8`} value={q} onChange={e => setQ(e.target.value)} placeholder={t('ctl.users.search')} />
        </label>
        <select aria-label={t('ctl.users.role')} className={`${inputClass} w-auto`} value={role} onChange={e => { setRole(e.target.value); setCursor(undefined); }}>
          <option value="">{t('ctl.users.allRoles')}</option>
          {(meta.data?.roles ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select aria-label={t('ctl.users.status')} className={`${inputClass} w-auto`} value={status} onChange={e => { setStatus(e.target.value as typeof status); setCursor(undefined); }}>
          <option value="">{t('ctl.users.allStatuses')}</option>
          <option value="active">{t('ctl.users.active')}</option>
          <option value="suspended">{t('ctl.users.suspended')}</option>
        </select>
        {canManage && (
          <button type="button" className={primaryButtonClass} onClick={() => setInviting(true)}>
            <UserPlus className="w-3.5 h-3.5" /> {t('ctl.users.invite')}
          </button>
        )}
      </div>

      {list.error ? (
        <EmptyState icon={Users} title={t('ctl.loadFailed')} description={list.error} action={{ label: t('ctl.action.retry'), onClick: list.reload }} />
      ) : list.loading && rows.length === 0 ? (
        <Skeleton variant="table" />
      ) : (
        <>
          <DataTable<AdminUserRow>
            data={rows}
            onRowClick={u => setSelected(u.id)}
            emptyIcon={Users}
            emptyTitle={t('ctl.users.empty')}
            columns={[
              { key: 'name', header: t('ctl.users.name'), render: u => (
                <div>
                  <div className="font-bold text-[var(--text-primary)]">{u.name || '—'}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{u.email}</div>
                </div>
              ) },
              { key: 'role', header: t('ctl.users.role'), render: u => <span className="font-mono">{u.role}</span> },
              { key: 'status', header: t('ctl.users.status'), render: u => <StatusBadge status={u.status === 'active' ? 'ACTIVE' : 'FAILED'} /> },
              { key: 'devices', header: t('ctl.users.devices'), align: 'center', render: u => u.deviceCount },
              { key: 'seen', header: t('ctl.users.lastSeen'), render: u => formatWhen(u.lastSeenAt, language) },
            ]}
          />
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>{t('ctl.list.showing', { shown: rows.length, total: list.data?.total ?? rows.length })}</span>
            {list.data?.nextCursor && (
              <button type="button" className={buttonClass} disabled={list.loading} onClick={() => setCursor(list.data!.nextCursor!)}>
                {t('ctl.action.loadMore')}
              </button>
            )}
          </div>
        </>
      )}

      {selected && (
        <UserDrawer
          userId={selected}
          roles={meta.data?.roles ?? []}
          catalog={meta.data?.catalog ?? []}
          canManage={canManage}
          onClose={() => setSelected(null)}
          onChanged={resetAndReload}
        />
      )}
      {inviting && <InviteDrawer roles={meta.data?.roles ?? []} onClose={() => setInviting(false)} onInvited={resetAndReload} />}
    </div>
  );
}

// ─── Detail drawer ──────────────────────────────────────────────────────────

function UserDrawer({ userId, roles, catalog, canManage, onClose, onChanged }: {
  userId: string;
  roles: AdminRole[];
  catalog: PermissionCatalogItem[];
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { t, language } = useLanguage();
  const { sessionUser } = useAuth();
  const { run, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const detail = useLoader(signal => api.adminGetUser(userId, signal), [userId]);
  const [roleId, setRoleId] = useState('');
  const [overrides, setOverrides] = useState<{ permission: string; effect: 'grant' | 'deny' }[]>([]);
  const [newPerm, setNewPerm] = useState('');
  const [newEffect, setNewEffect] = useState<'grant' | 'deny'>('grant');

  useEffect(() => {
    if (!detail.data) return;
    setRoleId(detail.data.roleId);
    setOverrides(detail.data.overrides.map(o => ({ permission: o.permission, effect: o.effect })));
  }, [detail.data]);

  const d = detail.data;
  const isSelf = sessionUser?.id === userId;
  const afterChange = () => { detail.reload(); onChanged(); };
  const overridesDirty = d ? JSON.stringify(overrides) !== JSON.stringify(d.overrides.map(o => ({ permission: o.permission, effect: o.effect }))) : false;

  return (
    <Drawer open title={d ? d.user.name || d.user.email : t('cmd.loading')} onClose={onClose}>
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      {detail.loading && !d ? <Skeleton variant="list" count={4} /> : detail.error ? (
        <EmptyState icon={Users} title={t('ctl.loadFailed')} description={detail.error} />
      ) : d ? (
        <>
          <section className="space-y-1 text-xs">
            <div className="text-[var(--text-primary)] font-bold">{d.user.email}</div>
            <div className="text-[var(--text-muted)]">{d.user.phone || '—'} · <span className="font-mono">{d.user.id}</span></div>
            <div className="flex items-center gap-2">
              <StatusBadge status={d.user.status === 'active' ? 'ACTIVE' : 'FAILED'} />
              <span className="text-[var(--text-muted)]">{t('ctl.users.created', { when: formatWhen(d.user.createdAt, language) })}</span>
            </div>
          </section>

          {/* Role */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('ctl.users.role')}</h4>
            <div className="flex gap-2">
              <select aria-label={t('ctl.users.role')} className={inputClass} value={roleId} disabled={!canManage || isSelf} onChange={e => setRoleId(e.target.value)}>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                {!roles.some(r => r.id === roleId) && roleId && <option value={roleId}>{roleId}</option>}
              </select>
              {canManage && (
                <button
                  type="button"
                  className={primaryButtonClass}
                  disabled={roleId === d.roleId || isSelf}
                  onClick={() => {
                    const target = roles.find(r => r.id === roleId);
                    const grantsAdmin = target?.permissions.includes('*') ?? roleId === 'Admin';
                    ask({
                      title: t('ctl.users.changeRoleTitle', { role: target?.name ?? roleId }),
                      description: grantsAdmin ? t('ctl.users.adminNeedsApproval') : undefined,
                      critical: grantsAdmin,
                      run: reason => api.adminUpdateUser(userId, { roleId, reason }),
                      success: t('ctl.users.roleChanged'),
                      after: afterChange,
                    });
                  }}
                >
                  {t('ctl.action.apply')}
                </button>
              )}
            </div>
            {isSelf && <p className="text-[10px] text-[var(--text-muted)]">{t('ctl.users.selfLocked')}</p>}
          </section>

          {/* Status + sessions */}
          {canManage && !isSelf && (
            <section className="flex flex-wrap gap-2">
              {d.user.status === 'active' ? (
                <button type="button" className={dangerButtonClass} onClick={() => ask({
                  title: t('ctl.users.suspendTitle', { email: d.user.email }),
                  description: t('ctl.users.suspendBody'),
                  critical: true,
                  confirmLabel: t('ctl.users.suspend'),
                  run: reason => api.adminUpdateUser(userId, { status: 'suspended', reason }),
                  success: t('ctl.users.suspended'),
                  after: afterChange,
                })}>
                  <ShieldOff className="w-3.5 h-3.5" /> {t('ctl.users.suspend')}
                </button>
              ) : (
                <button type="button" className={buttonClass} onClick={() => ask({
                  title: t('ctl.users.reactivateTitle', { email: d.user.email }),
                  run: reason => api.adminUpdateUser(userId, { status: 'active', reason }),
                  success: t('ctl.users.active'),
                  after: afterChange,
                })}>
                  <ShieldCheck className="w-3.5 h-3.5" /> {t('ctl.users.reactivate')}
                </button>
              )}
              <button type="button" className={dangerButtonClass} onClick={() => ask({
                title: t('ctl.users.revokeTitle', { email: d.user.email }),
                description: t('ctl.users.revokeBody'),
                critical: true,
                confirmLabel: t('ctl.users.revoke'),
                run: async reason => {
                  const r = await api.adminRevokeUserSessions(userId, reason);
                  return r;
                },
                success: t('ctl.users.revoked'),
                after: afterChange,
              })}>
                <LogOut className="w-3.5 h-3.5" /> {t('ctl.users.revoke')}
              </button>
            </section>
          )}

          {/* Overrides */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('ctl.users.overrides')}</h4>
            {overrides.length === 0 && <p className="text-[11px] text-[var(--text-muted)]">{t('ctl.users.noOverrides')}</p>}
            <ul className="space-y-1">
              {overrides.map((o, i) => (
                <li key={`${o.permission}-${i}`} className="flex items-center gap-2 text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${o.effect === 'grant' ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}`}>
                    {o.effect === 'grant' ? t('ctl.users.grant') : t('ctl.users.deny')}
                  </span>
                  <span className="font-mono flex-1 text-[var(--text-primary)]">{o.permission}</span>
                  {canManage && !isSelf && (
                    <button type="button" aria-label={t('ctl.action.remove')} className="text-[var(--text-muted)] hover:text-red-400 cursor-pointer" onClick={() => setOverrides(overrides.filter((_, j) => j !== i))}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            {canManage && !isSelf && (
              <div className="flex flex-wrap gap-2">
                <select aria-label={t('ctl.roles.permission')} className={`${inputClass} flex-1 min-w-[160px]`} value={newPerm} onChange={e => setNewPerm(e.target.value)}>
                  <option value="">{t('ctl.users.pickPermission')}</option>
                  {catalog.filter(p => !overrides.some(o => o.permission === p.key)).map(p => (
                    <option key={p.key} value={p.key}>{p.dangerous ? '(!) ' : ''}{p.key} — {language === 'ar' ? p.labelAr : p.labelEn}</option>
                  ))}
                </select>
                <select aria-label={t('ctl.users.effect')} className={`${inputClass} w-auto`} value={newEffect} onChange={e => setNewEffect(e.target.value as 'grant' | 'deny')}>
                  <option value="grant">{t('ctl.users.grant')}</option>
                  <option value="deny">{t('ctl.users.deny')}</option>
                </select>
                <button type="button" className={buttonClass} disabled={!newPerm} onClick={() => { setOverrides([...overrides, { permission: newPerm, effect: newEffect }]); setNewPerm(''); }}>
                  <Plus className="w-3.5 h-3.5" /> {t('ctl.action.add')}
                </button>
                <button type="button" className={primaryButtonClass} disabled={!overridesDirty} onClick={() => ask({
                  title: t('ctl.users.saveOverridesTitle', { email: d.user.email }),
                  critical: overrides.some(o => o.effect === 'grant' && catalog.find(p => p.key === o.permission)?.dangerous),
                  run: reason => api.adminSetUserOverrides(userId, overrides, reason),
                  success: t('ctl.users.overridesSaved'),
                  after: afterChange,
                })}>
                  {t('ctl.action.save')}
                </button>
              </div>
            )}
          </section>

          {/* Effective permissions */}
          <section className="space-y-1">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('ctl.users.effective')}</h4>
            <div className="flex flex-wrap gap-1">
              {d.effectivePermissions.map(p => (
                <span key={p} className="px-1.5 py-0.5 rounded bg-[var(--btn-util-bg)] font-mono text-[10px] text-[var(--text-muted)]">{p}</span>
              ))}
            </div>
          </section>

          {/* Devices */}
          <section className="space-y-1">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('ctl.users.devices')}</h4>
            {d.devices.length === 0 ? <p className="text-[11px] text-[var(--text-muted)]">{t('ctl.users.noDevices')}</p> : (
              <ul className="divide-y divide-[var(--border-subtle)] text-[11px]">
                {d.devices.map(dev => (
                  <li key={dev.id} className="py-1.5 flex items-center gap-2">
                    <span className="font-bold text-[var(--text-primary)]">{dev.name || dev.platform}</span>
                    <span className="font-mono text-[var(--text-muted)]">{dev.platform}</span>
                    <span className="ms-auto text-[var(--text-muted)]">{formatWhen(dev.lastSeenAt, language)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
      {dialog}
    </Drawer>
  );
}

// ─── Invite ─────────────────────────────────────────────────────────────────

function InviteDrawer({ roles, onClose, onInvited }: { roles: AdminRole[]; onClose: () => void; onInvited: () => void }) {
  const { t } = useLanguage();
  const { run, busy, notice, clearNotice } = useMutationRunner();
  const invitable = roles.filter(r => !r.permissions.includes('*') && r.baseRole !== 'Traveler' && r.id !== 'Traveler');
  const [form, setForm] = useState({ email: '', name: '', phone: '', roleId: '', supplierId: '' });
  const [issued, setIssued] = useState<{ email: string; tempPassword: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const roleId = form.roleId || invitable[0]?.id || '';
  const selectedRole = invitable.find(r => r.id === roleId);
  const needsSupplier = selectedRole?.baseRole === 'Supplier' || selectedRole?.id === 'Supplier';
  const valid = /\S+@\S+\.\S+/.test(form.email) && form.name.trim().length > 0 && !!roleId && (!needsSupplier || form.supplierId.trim().length > 0);

  const submit = async () => {
    let result: { user: { email: string }; tempPassword: string } | null = null;
    const ok = await run(async () => {
      result = await api.adminInviteUser({
        email: form.email.trim(),
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        roleId,
        supplierId: needsSupplier ? form.supplierId.trim() : undefined,
      });
    }, t('ctl.users.invited'));
    if (ok && result) {
      const r = result as { user: { email: string }; tempPassword: string };
      setIssued({ email: r.user.email, tempPassword: r.tempPassword });
      onInvited();
    }
  };

  return (
    <Drawer open title={t('ctl.users.invite')} onClose={onClose}>
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      {issued ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
              <KeyRound className="w-4 h-4" aria-hidden="true" /> {t('ctl.users.tempPasswordTitle')}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('ctl.users.tempPasswordBody', { email: issued.email })}</p>
            <div className="flex items-center gap-2">
              <code dir="ltr" className="flex-1 rounded-lg bg-[var(--btn-util-bg)] px-2 py-1.5 font-mono text-sm text-[var(--text-primary)] select-all">{issued.tempPassword}</code>
              <button
                type="button"
                className={buttonClass}
                onClick={() => {
                  void navigator.clipboard?.writeText(issued.tempPassword).then(() => setCopied(true)).catch(() => setCopied(false));
                }}
              >
                <Copy className="w-3.5 h-3.5" /> {copied ? t('ctl.action.copied') : t('ctl.action.copy')}
              </button>
            </div>
          </div>
          <button type="button" className={primaryButtonClass} onClick={onClose}>{t('ctl.action.done')}</button>
        </div>
      ) : (
        <div className="space-y-2">
          {(['email', 'name', 'phone'] as const).map(field => (
            <label key={field} className="block">
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{t(`ctl.users.field.${field}`)}</span>
              <input
                className={inputClass}
                type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'}
                dir={field === 'name' ? undefined : 'ltr'}
                value={form[field]}
                onChange={e => setForm({ ...form, [field]: e.target.value })}
              />
            </label>
          ))}
          <label className="block">
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.users.role')}</span>
            <select className={inputClass} value={roleId} onChange={e => setForm({ ...form, roleId: e.target.value })}>
              {invitable.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </label>
          {needsSupplier && (
            <label className="block">
              <span className="text-[10px] font-bold text-[var(--text-muted)]">{t('ctl.users.field.supplierId')}</span>
              <input className={inputClass} dir="ltr" value={form.supplierId} onChange={e => setForm({ ...form, supplierId: e.target.value })} />
            </label>
          )}
          <p className="text-[10px] text-[var(--text-muted)]">{t('ctl.users.inviteHint')}</p>
          <button type="button" className={primaryButtonClass} disabled={!valid || busy} onClick={submit}>
            <UserPlus className="w-3.5 h-3.5" /> {t('ctl.users.sendInvite')}
          </button>
        </div>
      )}
    </Drawer>
  );
}
