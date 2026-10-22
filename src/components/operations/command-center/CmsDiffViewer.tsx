import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { readJson } from '../../../services/apiError';
import { X, Clock, User, ChevronDown, ChevronRight } from 'lucide-react';

/**
 * CmsDiffViewer — shows a side-by-side or inline comparison of two revisions.
 * Used in the History tab to visualize what changed between versions.
 */

interface Revision {
  id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor_id: string;
  actor_name: string;
  payload: Record<string, any>;
  created_at: string;
}

const API_BASE = '/api/admin/content';

async function cmsFetch(path: string, options?: RequestInit): Promise<any> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(err.message || 'CMS API error');
  }
  return readJson(response, `CMS API call to ${path} failed.`);
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  field: string;
  value: string;
}

function computeDiff(oldPayload: Record<string, any>, newPayload: Record<string, any>): DiffLine[] {
  const lines: DiffLine[] = [];
  const allFields = new Set([...Object.keys(oldPayload), ...Object.keys(newPayload)]);

  for (const field of allFields) {
    // Skip metadata fields
    if (['fields', 'slug'].includes(field)) continue;

    const oldVal = oldPayload[field];
    const newVal = newPayload[field];

    if (JSON.stringify(oldVal) === JSON.stringify(newVal)) {
      if (oldVal !== undefined) {
        lines.push({ type: 'unchanged', field, value: String(oldVal) });
      }
    } else {
      if (oldVal !== undefined) {
        lines.push({ type: 'removed', field, value: String(oldVal) });
      }
      if (newVal !== undefined) {
        lines.push({ type: 'added', field, value: String(newVal) });
      }
    }
  }

  return lines;
}

export function CmsDiffViewer({
  entityId,
  entityType,
  onClose,
}: {
  entityId: string;
  entityType: string;
  onClose: () => void;
}) {
  const { language , t} = useLanguage();
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    cmsFetch(`/revisions?entityType=${entityType}&entityId=${entityId}&limit=20`)
      .then(d => {
        setRevisions(d.revisions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [entityId, entityType]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (revisions.length < 2) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)] text-sm">
        {t('cmd.notEnoughRevisionsTo')}
      </div>
    );
  }

  const current = revisions[selectedIdx];
  const previous = revisions[selectedIdx + 1];

  if (!current || !previous) {
    return (
      <div className="text-center py-12 text-[var(--text-muted)] text-sm">
        {t('cmd.selectTwoRevisionsTo')}
      </div>
    );
  }

  const diffLines = computeDiff(previous.payload, current.payload);

  const actionColors: Record<string, string> = {
    create: 'bg-green-500/20 text-green-300',
    update: 'bg-blue-500/20 text-blue-300',
    publish: 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]',
    scheduled_publish: 'bg-purple-500/20 text-purple-300',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">
          {t('cmd.compareChanges')}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="p-1.5 rounded-lg hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Revision selector */}
      <div className="flex items-center gap-2">
        <select
          value={selectedIdx}
          onChange={e => setSelectedIdx(parseInt(e.target.value))}
          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:border-[var(--accent-primary)]/50 focus:outline-none"
        >
          {revisions.slice(0, -1).map((rev, idx) => (
            <option key={rev.id} value={idx}>
              {rev.action} — {rev.actor_name || 'System'} — {new Date(rev.created_at).toLocaleString()}
            </option>
          ))}
        </select>
      </div>

      {/* Comparison header */}
      <div className="flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">{t('cmd.from')}:</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${actionColors[previous.action] || 'bg-[var(--btn-util-bg)] text-[var(--text-muted)]'}`}>
            {previous.action}
          </span>
          <span className="text-[var(--text-muted)]">{previous.actor_name || 'System'}</span>
          <span className="text-[var(--text-muted)]">{new Date(previous.created_at).toLocaleString()}</span>
        </div>
        <span className="text-[var(--text-muted)]">→</span>
        <div className="flex items-center gap-2">
          <span className="text-[var(--text-muted)]">{t('cmd.to')}:</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${actionColors[current.action] || 'bg-[var(--btn-util-bg)] text-[var(--text-muted)]'}`}>
            {current.action}
          </span>
          <span className="text-[var(--text-muted)]">{current.actor_name || 'System'}</span>
          <span className="text-[var(--text-muted)]">{new Date(current.created_at).toLocaleString()}</span>
        </div>
      </div>

      {/* Diff lines */}
      <div className="space-y-1 font-mono text-[11px]">
        {diffLines.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)]">
            {t('cmd.noChangesDetected')}
          </div>
        ) : (
          diffLines.map((line, idx) => {
            const fieldKey = `${line.field}-${idx}`;
            const isExpanded = expandedFields.has(fieldKey);
            const colors = {
              added: 'bg-green-500/10 border-green-500/20 text-green-300',
              removed: 'bg-red-500/10 border-red-500/20 text-red-300',
              unchanged: 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)] text-[var(--text-muted)]',
            };

            return (
              <div
                key={fieldKey}
                className={`rounded-lg border ${colors[line.type]} overflow-hidden`}
              >
                <button
                  type="button"
                  onClick={() => {
                    const newSet = new Set(expandedFields);
                    if (newSet.has(fieldKey)) {
                      newSet.delete(fieldKey);
                    } else {
                      newSet.add(fieldKey);
                    }
                    setExpandedFields(newSet);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-left cursor-pointer"
                >
                  {line.value.length > 80 ? (
                    isExpanded ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />
                  ) : null}
                  <span className="font-bold">{line.field}</span>
                  {line.type !== 'unchanged' && (
                    <span className="text-[10px] ml-1">
                      {line.type === 'added' ? '+ ' : '- '}
                    </span>
                  )}
                  <span className="truncate flex-1">
                    {line.value.length > 80 && !isExpanded
                      ? line.value.substring(0, 80) + '...'
                      : line.value}
                  </span>
                </button>
                {isExpanded && line.value.length > 80 && (
                  <div className="px-3 pb-2 text-[11px] whitespace-pre-wrap break-words opacity-80">
                    {line.value}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
        <span className="text-green-400">+ {diffLines.filter(l => l.type === 'added').length} {t('cmd.added')}</span>
        <span className="text-red-400">- {diffLines.filter(l => l.type === 'removed').length} {t('cmd.removed')}</span>
        <span>{diffLines.filter(l => l.type === 'unchanged').length} {t('cmd.unchanged')}</span>
      </div>
    </div>
  );
}
