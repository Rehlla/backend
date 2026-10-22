import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Eye, Loader2, Send, X } from 'lucide-react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { api } from '../../../../services/api';
import type { CatalogEnvelope, CatalogScope, CatalogSectionSchema, CatalogTypeSchema } from '../../../../types/catalog';
import { NoticeBar, buttonClass, primaryButtonClass } from '../control/controlShared';
import { FormEngine } from './FormEngine';
import { MissingList, bodyFromValues, incompleteKeys, missingFields, pickText, useCatalogRunner, type FormValues } from './catalogShared';

/**
 * New listing in three steps — Basics, Photos, Price & availability — split
 * from the schema's sections. The record is created as a draft on the first
 * "Next" and PATCHed on every later step, so nothing typed is lost. Publish
 * (supplier: "Submit for review") stays disabled until every required field
 * is filled, and lists what is missing; a server 422 adds its own list.
 */

const PRICE_SECTION = /price|pricing|rate|availability|schedule|capacity|slot|fare/i;

/** Splits schema sections into the wizard's three steps. */
export function wizardSteps(schema: CatalogTypeSchema): [CatalogSectionSchema[], CatalogSectionSchema[], CatalogSectionSchema[]] {
  const basics: CatalogSectionSchema[] = [];
  const photos: CatalogSectionSchema[] = [];
  const price: CatalogSectionSchema[] = [];
  for (const s of schema.sections) {
    if (s.fields.some(f => f.kind === 'gallery')) photos.push(s);
    else if (PRICE_SECTION.test(s.key) || (s.fields.length > 0 && s.fields.every(f => f.kind === 'money' || f.kind === 'timeList' || f.kind === 'number'))) price.push(s);
    else basics.push(s);
  }
  return [basics, photos, price];
}

export interface CreateWizardProps {
  scope: CatalogScope;
  schema: CatalogTypeSchema;
  canPublish: boolean;
  onDone: (record: CatalogEnvelope | null, openEditor: boolean) => void;
}

export function CreateWizard({ scope, schema, canPublish, onDone }: CreateWizardProps) {
  const { t, language } = useLanguage();
  const steps = useMemo(() => wizardSteps(schema), [schema]);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>({});
  const [record, setRecord] = useState<CatalogEnvelope | null>(null);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [serverMissing, setServerMissing] = useState<string[]>([]);
  const { run, busy, notice, clearNotice, setNotice } = useCatalogRunner();

  const missing = missingFields(schema.sections, values);
  const missingKeys = new Set([...missing.map(f => f.key), ...serverMissing]);
  const stepLabels = [t('cat.wizard.basics'), t('cat.wizard.photos'), t('cat.wizard.price')];

  const change = (key: string, v: unknown) => {
    setValues(prev => ({ ...prev, [key]: v }));
    setDirty(prev => new Set(prev).add(key));
    setServerMissing(prev => prev.filter(k => k !== key));
  };

  /** Creates the draft, or PATCHes what changed since the last save. */
  const saveDraft = async (): Promise<CatalogEnvelope | null> => {
    let saved: CatalogEnvelope | null = record;
    const ok = await run(async () => {
      if (!record) {
        const body = bodyFromValues(values);
        saved = await api.catalogCreate(scope, schema.type, { ...body, title: body.title ?? { en: '', ar: '' }, fields: body.fields ?? {} });
      } else if (dirty.size > 0) {
        saved = await api.catalogPatch(scope, schema.type, record.id, bodyFromValues(values, dirty), record.updatedAt);
      }
      setRecord(saved);
      setDirty(new Set());
    }, t('cat.wizard.draftSaved'));
    return ok ? saved : null;
  };

  const next = async () => {
    if (await saveDraft()) setStep(s => Math.min(2, s + 1));
  };

  const publish = async () => {
    const saved = await saveDraft();
    if (!saved) return;
    try {
      const published = await api.catalogPublish(scope, schema.type, saved.id);
      setNotice({ kind: 'success', text: scope === 'supplier' ? t('cat.notice.submitted') : t('cat.notice.published') });
      onDone(published, true);
    } catch (err) {
      const keys = incompleteKeys(err);
      if (keys) {
        setServerMissing(keys);
        setNotice({ kind: 'error', text: t('cat.notice.incomplete', { fields: keys.join(', ') || '—' }) });
      } else {
        setNotice({ kind: 'error', text: (err as Error)?.message || t('ctl.notice.failed') });
      }
    }
  };

  const sections = steps[step];
  const publishLabel = scope === 'supplier' ? t('cat.action.submit') : t('cat.action.publish');
  const publishAllowed = scope === 'supplier' || canPublish;

  return (
    <div className="space-y-4" aria-label={t('cat.wizard.title', { type: pickText(schema.label, language) })}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">{t('cat.wizard.title', { type: pickText(schema.label, language) || schema.type })}</h2>
        <button type="button" className={buttonClass} onClick={() => onDone(record, false)} aria-label={t('cmd.close')}>
          <X className="w-3 h-3" /> {t('cmd.close')}
        </button>
      </div>
      <ol className="flex items-center gap-2" aria-label={t('cat.wizard.steps')}>
        {stepLabels.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <button
              type="button"
              disabled={i > 0 && !record}
              onClick={() => setStep(i)}
              aria-current={i === step ? 'step' : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${i === step ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}
            >
              <span className="tabular-nums">{i < step ? <Check className="w-3 h-3" /> : i + 1}</span>
              {label}
            </button>
            {i < 2 && <span className="h-px w-6 bg-[var(--border-subtle)]" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      <NoticeBar notice={notice} onDismiss={clearNotice} />

      {sections.length > 0 ? (
        <FormEngine sections={sections} values={values} onChange={change} scope={scope} missing={missingKeys} />
      ) : (
        <p className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]">
          {step === 2 ? t('cat.wizard.priceLater') : t('cat.wizard.nothingHere')}
        </p>
      )}

      <div className="sticky bottom-0 z-10 space-y-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)] p-3 shadow-lg">
        <MissingList fields={missing} extraKeys={serverMissing} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass} disabled={step === 0 || busy} onClick={() => setStep(s => Math.max(0, s - 1))}>
            <ArrowLeft className="w-3 h-3 rtl:rotate-180" /> {t('cat.wizard.back')}
          </button>
          {record && <span className="text-[10px] text-[var(--text-muted)]">{t('cat.wizard.savedAsDraft')}</span>}
          <span className="flex-1" />
          {step < 2 ? (
            <button type="button" className={primaryButtonClass} disabled={busy} onClick={() => void next()}>
              {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {t('cat.wizard.next')} <ArrowRight className="w-3 h-3 rtl:rotate-180" />
            </button>
          ) : (
            <button type="button" className={buttonClass} disabled={busy} onClick={async () => { const saved = await saveDraft(); if (saved) onDone(saved, true); }}>
              {t('cat.wizard.saveDraft')}
            </button>
          )}
          {publishAllowed && (
            <button
              type="button"
              className={primaryButtonClass}
              disabled={busy || missing.length > 0}
              aria-disabled={busy || missing.length > 0}
              onClick={() => void publish()}
            >
              {scope === 'supplier' ? <Send className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {publishLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateWizard;
