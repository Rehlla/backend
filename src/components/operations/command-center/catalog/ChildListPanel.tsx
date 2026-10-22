import React, { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2, Layers } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogEnvelope, CatalogScope, CatalogTypeSchema } from '../../../../types/catalog';
import { DataTable } from '../ui';
import { Drawer, NoticeBar, buttonClass, dangerButtonClass, primaryButtonClass, useMutationRunner, useReasonPrompt } from '../control/controlShared';
import { FormEngine } from './FormEngine';
import { bodyFromValues, formatEGP, getValue, missingFields, pickText, priceFieldKey, StatusChip, MissingList, valuesFromEnvelope, type FormValues } from './catalogShared';

/**
 * Child rows of a listing (hotel rooms, …): a table plus a drawer that edits
 * one row with the same form engine, driven by the child item type's schema.
 */

/** Used when the server schema does not describe the child item type. */
export function fallbackChildSchema(itemType: string): CatalogTypeSchema {
  return {
    type: itemType,
    label: { en: itemType, ar: itemType },
    sections: [
      {
        key: 'basics',
        fields: [
          { key: 'title', kind: 'i18nText', required: true, max: 120, label: { en: 'Name', ar: 'الاسم' } },
          { key: 'summary', kind: 'i18nTextarea', max: 600, label: { en: 'Description', ar: 'الوصف' } },
          { key: 'priceFromEGP', kind: 'money', label: { en: 'Price', ar: 'السعر' } },
        ],
      },
    ],
  };
}

export function ChildFormDrawer({
  open, title, scope, schema, initial, onClose, onSave,
}: {
  open: boolean;
  title: string;
  scope: CatalogScope;
  schema: CatalogTypeSchema;
  initial: CatalogEnvelope | null;
  onClose: () => void;
  onSave: (values: FormValues) => Promise<boolean>;
}) {
  const { t } = useLanguage();
  const [values, setValues] = useState<FormValues>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setValues(valuesFromEnvelope(schema, initial));
  }, [open, initial, schema]);
  const missing = missingFields(schema.sections, values);
  return (
    <Drawer open={open} title={title} onClose={onClose}>
      <FormEngine sections={schema.sections} values={values} scope={scope} onChange={(k, v) => setValues(prev => ({ ...prev, [k]: v }))} missing={new Set(missing.map(f => f.key))} />
      <MissingList fields={missing} />
      <div className="flex justify-end gap-2">
        <button type="button" className={buttonClass} onClick={onClose}>{t('ctl.action.cancel')}</button>
        <button
          type="button"
          className={primaryButtonClass}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              if (await onSave(values)) onClose();
            } finally {
              setSaving(false);
            }
          }}
        >
          {t('ctl.action.save')}
        </button>
      </div>
    </Drawer>
  );
}

export interface ChildListPanelProps {
  scope: CatalogScope;
  type: string;
  parentId: string;
  childKey: string;
  childSchema: CatalogTypeSchema;
  items: CatalogEnvelope[];
  onItemsChange: (items: CatalogEnvelope[]) => void;
}

export function ChildListPanel({ scope, type, parentId, childKey, childSchema, items, onItemsChange }: ChildListPanelProps) {
  const { t, language } = useLanguage();
  const { run, notice, clearNotice } = useMutationRunner();
  const { ask, dialog } = useReasonPrompt(run);
  const [editing, setEditing] = useState<CatalogEnvelope | null>(null);
  const [creating, setCreating] = useState(false);
  const priceKey = priceFieldKey(childSchema);

  const save = async (values: FormValues): Promise<boolean> => {
    const target = editing;
    return run(async () => {
      if (target) {
        const updated = await api.catalogChildPatch(scope, type, parentId, childKey, target.id, bodyFromValues(values));
        onItemsChange(items.map(i => (i.id === target.id ? updated : i)));
      } else {
        const created = await api.catalogChildCreate(scope, type, parentId, childKey, bodyFromValues(values));
        onItemsChange([...items, created]);
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--text-muted)]">{t('cat.child.count', { n: items.length })}</span>
        <button type="button" className={primaryButtonClass} onClick={() => { setEditing(null); setCreating(true); }}>
          <Plus className="w-3 h-3" /> {t('cat.child.add')}
        </button>
      </div>
      <NoticeBar notice={notice} onDismiss={clearNotice} />
      <DataTable
        data={items}
        emptyIcon={Layers}
        emptyTitle={t('cat.child.empty')}
        onRowClick={item => { setCreating(false); setEditing(item); }}
        columns={[
          { key: 'title', header: t('cat.col.title'), render: i => <span className="font-bold text-[var(--text-primary)]">{pickText(i.title, language) || i.id}</span> },
          { key: 'price', header: t('cat.col.price'), render: i => <span className="tabular-nums">{formatEGP((priceKey ? getValue(i, priceKey) : i.priceFromEGP) as number, language)}</span> },
          { key: 'status', header: t('cat.col.status'), render: i => <StatusChip status={i.status} /> },
          {
            key: 'actions',
            header: '',
            align: 'right',
            render: i => (
              <span className="inline-flex gap-1" onClick={e => e.stopPropagation()}>
                <button type="button" className={buttonClass} aria-label={t('ctl.action.edit')} onClick={() => { setCreating(false); setEditing(i); }}>
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  className={dangerButtonClass}
                  aria-label={t('ctl.action.delete')}
                  onClick={() =>
                    ask({
                      title: t('cat.child.deleteTitle', { name: pickText(i.title, language) || i.id }),
                      critical: true,
                      confirmLabel: t('ctl.action.delete'),
                      run: async reason => {
                        await api.catalogChildDelete(scope, type, parentId, childKey, i.id, reason);
                        onItemsChange(items.filter(x => x.id !== i.id));
                      },
                      success: t('cat.notice.deleted'),
                    })
                  }
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ),
          },
        ]}
      />
      <ChildFormDrawer
        open={creating || editing !== null}
        title={editing ? pickText(editing.title, language) || editing.id : t('cat.child.add')}
        scope={scope}
        schema={childSchema}
        initial={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSave={save}
      />
      {dialog}
    </div>
  );
}

export default ChildListPanel;
