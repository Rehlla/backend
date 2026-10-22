import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import { api } from '../../services/api';
import { DashCard, SectionHeader, EmptyState } from '../operations/command-center/ui';

interface Props {
  t: (key: string, fallback?: string) => string;
}

interface AuditRow {
  at: string;
  action: string;
  actor: string;
  entity: string;
  detail: string;
}

/**
 * Audit visibility for the Core: every query/tool/denial/confirmation/
 * mutation the Core performs is written to the audit trail server-side;
 * this card lets an admin read back the recent INTELLIGENCE_CORE_* entries.
 * Read-only (LOW tool) — inspecting the trail grants no privilege.
 */
export const AuditTrail: React.FC<Props> = ({ t }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (rows) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.intelligenceCoreAction({ tool: 'getCoreAudit', params: { limit: 15 } });
      const data = (res.result as { rows?: AuditRow[] } | undefined)?.rows;
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('intel.auditFailed', 'Audit trail unavailable.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashCard>
      <SectionHeader
        icon={FileText}
        title={t('intel.auditTitle', 'Audit trail')}
        actions={
          <button
            type="button"
            onClick={() => void load()}
            aria-expanded={open}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            {open ? t('intel.auditHide', 'Hide') : t('intel.auditShow', 'Show audit trail')}
          </button>
        }
      />
      {open ? (
        loading ? (
          <p className="text-xs text-[var(--text-muted)] mt-2" role="status">
            {t('intel.auditLoading', 'Loading audit entries…')}
          </p>
        ) : error ? (
          <p className="text-xs text-red-300 mt-2" role="alert">
            {error}
          </p>
        ) : rows && rows.length > 0 ? (
          <ul className="mt-2 space-y-1 max-h-56 overflow-y-auto" aria-label={t('intel.auditTitle', 'Audit trail')}>
            {rows.map((r, i) => (
              <li key={`${r.at}-${r.action}-${i}`} className="text-[11px] text-[var(--text-muted)] font-mono">
                {r.at ? new Date(r.at).toLocaleTimeString() : '—'} · {r.action} · {r.entity || '—'}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2">
            <EmptyState
              icon={FileText}
              title={t('intel.auditEmpty', 'No Core activity yet')}
              description={t('intel.auditEmptyBody', 'Ask the Core something — every step is recorded here.')}
            />
          </div>
        )
      ) : null}
    </DashCard>
  );
};
