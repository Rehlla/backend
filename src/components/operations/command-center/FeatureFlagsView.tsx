import React, { useState, useEffect, useCallback } from 'react';
import { Flag, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader } from './ui/SectionHeader';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { DashCard } from './ui/DashCard';

export default function FeatureFlagsView() {
  const { language, t } = useLanguage();
  const [flags, setFlags] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchFlags = useCallback(async () => {
    try {
      const data = await api.getDayGiBetaExperiments();
      setFlags(data?.flags || data?.experimentFlags || data);
    } catch {
      setFlags(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  const handleToggle = async (key: string, value: any) => {
    if (!flags) return;
    const updated = { ...flags, [key]: value };
    setFlags(updated);
    setSaving(true);
    try {
      await api.updateDayGiBetaExperiments(updated);
    } catch {
      setFlags((prev: any) => prev);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <SectionHeader icon={Flag} title={t('cmd.flags.title')} />

      {loading ? (
        <Skeleton variant="list" count={6} />
      ) : !flags ? (
        <EmptyState icon={Flag} title={t('cmd.flags.noFlags')} />
      ) : (
        <div className="space-y-2">
          {Object.entries(flags).map(([key, value]) => {
            const isBoolean = typeof value === 'boolean';
            return (
              <DashCard key={key}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-mono font-bold text-[var(--text-primary)]">{key}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
                      {isBoolean ? (value ? t('cmd.flags.enabled') : t('cmd.flags.disabled')) : `${t('cmd.flags.valuePrefix')} ${String(value)}`}
                    </div>
                  </div>
                  {isBoolean ? (
                    <button
                      type="button"
                      onClick={() => handleToggle(key, !value)}
                      className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer p-0.5 ${
                        value ? 'bg-[var(--accent-primary)]' : 'bg-[var(--btn-util-bg)]'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-[var(--surface-card)] transition-transform ${
                        value ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  ) : (
                    <select
                      value={String(value)}
                      onChange={e => handleToggle(key, e.target.value)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--text-muted)] cursor-pointer focus:outline-none"
                    >
                      {['BALANCED', 'AGGRESSIVE', 'CONSERVATIVE', 'CONTEXT_AWARE', 'RANDOM', 'ON_DEMAND', 'ALWAYS',
                        'RICH_VERTICAL', 'COMPACT', 'MODAL_EXPLICIT', 'INLINE'].map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  )}
                </div>
              </DashCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
