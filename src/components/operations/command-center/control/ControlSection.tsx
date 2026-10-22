import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardCheck, Eye, FileText, Flag, Plug, Shield, SlidersHorizontal, Users } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { EmptyState, SectionHeader, TabBar } from '../ui';
import UsersTab from './UsersTab';
import RolesTab from './RolesTab';
import SettingsTab from './SettingsTab';
import FlagsTab from './FlagsTab';
import IntegrationsTab from './IntegrationsTab';
import ApprovalsTab from './ApprovalsTab';
import AuditTab from './AuditTab';
import ViewAsTab from './ViewAsTab';

type ControlTabId = 'users' | 'roles' | 'settings' | 'flags' | 'integrations' | 'approvals' | 'audit' | 'viewas';

const TABS: { id: ControlTabId; permission: string; icon: React.ElementType }[] = [
  { id: 'users', permission: 'admin.users.view', icon: Users },
  { id: 'roles', permission: 'admin.users.view', icon: Shield },
  { id: 'settings', permission: 'admin.settings.view', icon: SlidersHorizontal },
  { id: 'flags', permission: 'ops.flags.view', icon: Flag },
  { id: 'integrations', permission: 'admin.integrations.view', icon: Plug },
  { id: 'approvals', permission: 'admin.approvals.decide', icon: ClipboardCheck },
  { id: 'audit', permission: 'ops.audit.view', icon: FileText },
  { id: 'viewas', permission: 'admin.viewas', icon: Eye },
];

/** The permissions that make the Control section visible at all (CommandCenterShell). */
export const CONTROL_SECTION_PERMISSIONS = [
  'admin.users.view',
  'admin.settings.view',
  'ops.flags.view',
  'admin.integrations.view',
  'admin.approvals.decide',
  'ops.audit.view',
] as const;

export default function ControlSection() {
  const { t } = useLanguage();
  const { can } = useAuth();
  const visible = useMemo(() => TABS.filter(tab => can(tab.permission)), [can]);
  const [active, setActive] = useState<ControlTabId>(() => {
    const sub = typeof window !== 'undefined' ? window.location.hash.replace('#', '').split('/')[1] : '';
    return (TABS.some(x => x.id === sub) ? sub : 'users') as ControlTabId;
  });
  const current = visible.some(v => v.id === active) ? active : visible[0]?.id;

  useEffect(() => {
    if (!current || typeof window === 'undefined') return;
    const want = `#control/${current}`;
    if (window.location.hash !== want) window.history.replaceState(null, '', want);
  }, [current]);

  if (!current) return <EmptyState icon={Shield} title={t('ctl.access.deniedTitle')} description={t('ctl.access.deniedBody')} />;

  return (
    <div className="space-y-4">
      <SectionHeader icon={Shield} title={t('ctl.title')} subtitle={t('ctl.subtitle')} />
      <TabBar
        variant="underline"
        size="md"
        tabs={visible.map(v => ({ id: v.id, label: t(`ctl.tab.${v.id}`), icon: v.icon }))}
        activeTab={current}
        onChange={id => setActive(id as ControlTabId)}
      />
      <div>
        {current === 'users' && <UsersTab />}
        {current === 'roles' && <RolesTab />}
        {current === 'settings' && <SettingsTab />}
        {current === 'flags' && <FlagsTab />}
        {current === 'integrations' && <IntegrationsTab />}
        {current === 'approvals' && <ApprovalsTab />}
        {current === 'audit' && <AuditTab />}
        {current === 'viewas' && <ViewAsTab />}
      </div>
    </div>
  );
}
