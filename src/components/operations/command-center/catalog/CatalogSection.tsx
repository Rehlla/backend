import React, { useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { useAuth } from '../../../../context/AuthContext';
import { api } from '../../../../services/api';
import type { CatalogEnvelope, CatalogScope, CatalogStatus } from '../../../../types/catalog';
import { EmptyState, SectionHeader, SkeletonCard } from '../ui';
import { buttonClass, useLoader } from '../control/controlShared';
import { CatalogHome } from './CatalogHome';
import { CatalogList } from './CatalogList';
import { CreateWizard } from './CreateWizard';
import { EditView } from './EditView';
import { permissionArea, topLevelTypes } from './catalogShared';

/**
 * The Catalogue section (docs/CATALOG_API_CONTRACT.md): home → list → create
 * wizard / edit view, every form generated from the server schema. Mounted in
 * the staff command center (`scope="staff"`) and in the supplier portal's
 * "My listings" tab (`scope="supplier"`: own records only, publish becomes
 * "Submit for review").
 */

type View =
  | { kind: 'home' }
  | { kind: 'list'; type: string; status?: CatalogStatus }
  | { kind: 'create'; type: string }
  | { kind: 'edit'; type: string; id: string };

export function CatalogSection({ scope = 'staff' }: { scope?: CatalogScope }) {
  const { t } = useLanguage();
  const { can } = useAuth();
  const [view, setView] = useState<View>({ kind: 'home' });
  const { data, error, loading, reload } = useLoader(signal => api.catalogSchema(scope, signal), [scope]);

  const perms = useMemo(() => {
    const view = (type: string) => scope === 'supplier' || can(`catalog.${permissionArea(type)}.view`);
    const manage = (type: string) => (scope === 'supplier' ? can('supplier.catalog.manage') : can(`catalog.${permissionArea(type)}.manage`));
    // Transfers have no publish permission of their own: manage covers it.
    const publish = (type: string) =>
      scope === 'staff' && (permissionArea(type) === 'transfers' ? can('catalog.transfers.manage') : can(`catalog.${permissionArea(type)}.publish`));
    return { view, manage, publish };
  }, [scope, can]);

  const allTypes = useMemo(() => [...(data?.types ?? []), ...(data?.itemTypes ?? [])], [data]);
  const types = useMemo(() => topLevelTypes(data?.types ?? []).filter(ty => perms.view(ty.type)), [data, perms]);
  const schemaOf = (type: string) => allTypes.find(ty => ty.type === type);

  if (loading && !data) return <SkeletonCard />;
  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300 flex items-center justify-between gap-2">
        <span>{t('cat.schemaError')} {error}</span>
        <button type="button" className={buttonClass} onClick={reload}>{t('ctl.action.retry')}</button>
      </div>
    );
  }

  const header = view.kind === 'home' && (
    <SectionHeader icon={BookOpen} title={scope === 'supplier' ? t('cat.myListings') : t('cat.title')} subtitle={t('cat.subtitle')} />
  );

  let body: React.ReactNode = null;
  if (view.kind === 'home') {
    body = types.length === 0 ? (
      <EmptyState icon={BookOpen} title={t('cat.noTypes')} />
    ) : (
      <CatalogHome
        scope={scope}
        types={types}
        canManage={perms.manage}
        onOpenList={(type, status) => setView({ kind: 'list', type, status })}
        onNew={type => setView({ kind: 'create', type })}
      />
    );
  } else {
    const schema = schemaOf(view.type);
    if (!schema) {
      body = <EmptyState icon={BookOpen} title={t('cat.noTypes')} action={{ label: t('cat.back'), onClick: () => setView({ kind: 'home' }) }} />;
    } else if (view.kind === 'list') {
      body = (
        <CatalogList
          key={`${view.type}:${view.status ?? ''}`}
          scope={scope}
          schema={schema}
          initialStatus={view.status}
          canManage={perms.manage(view.type)}
          canPublish={perms.publish(view.type)}
          onOpen={id => setView({ kind: 'edit', type: view.type, id })}
          onNew={() => setView({ kind: 'create', type: view.type })}
          onBack={() => setView({ kind: 'home' })}
        />
      );
    } else if (view.kind === 'create') {
      body = (
        <CreateWizard
          scope={scope}
          schema={schema}
          canPublish={perms.publish(view.type)}
          onDone={(record: CatalogEnvelope | null, openEditor: boolean) =>
            setView(record && openEditor ? { kind: 'edit', type: view.type, id: record.id } : { kind: 'list', type: view.type })
          }
        />
      );
    } else {
      body = (
        <EditView
          key={view.id}
          scope={scope}
          schema={schema}
          allTypes={allTypes}
          id={view.id}
          canManage={perms.manage(view.type)}
          canPublish={perms.publish(view.type)}
          onBack={() => setView({ kind: 'list', type: view.type })}
          onOpen={id => setView({ kind: 'edit', type: view.type, id })}
        />
      );
    }
  }

  return (
    <div className="space-y-4">
      {header}
      {body}
    </div>
  );
}

export default CatalogSection;
