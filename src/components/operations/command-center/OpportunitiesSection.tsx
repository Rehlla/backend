import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, CheckCircle2, AlertTriangle, RefreshCw, ExternalLink, TrendingUp, X, Clock } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';

export default function OpportunitiesSection() {
  const { language, t } = useLanguage();
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const fetchOpps = useCallback(async () => {
    try {
      const data = await api.getIntelligenceOpportunities();
      setOpportunities(data?.opportunities || data || []);
    } catch { setOpportunities([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchOpps(); }, [fetchOpps]);

  const handleAction = async (id: string, action: 'accept' | 'reject' | 'defer') => {
    if (!confirm(`Are you sure you want to ${action} this opportunity?`)) return;
    setActing(id);
    try {
      await api.actOnOpportunity(id, action, `Operator ${action}`);
      setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: action === 'accept' ? 'ACCEPTED' : action === 'reject' ? 'REJECTED' : 'DEFERRED' } : o));
    } catch (err: any) {
      alert(`Failed: ${err.message}`);
    } finally { setActing(null); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          {t('cmd.opps.title')}
        </h3>
        <button type="button" onClick={() => fetchOpps()} className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-[var(--text-muted)]">
          <span className="inline-block w-5 h-5 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mr-2" />
          {t('cmd.opps.loading')}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)]">
          <Lightbulb className="w-10 h-10 text-[var(--text-muted)] mx-auto mb-3" />
          <div className="text-sm font-bold text-[var(--text-muted)]">{t('cmd.opps.noOpps')}</div>
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map(opp => {
            const isDecided = opp.status === 'ACCEPTED' || opp.status === 'REJECTED' || opp.status === 'DEFERRED';
            return (
              <div key={opp.id} className={`p-5 rounded-2xl bg-[var(--surface-container)] border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${isDecided ? 'border-[var(--border-subtle)] opacity-60' : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {opp.category && <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">{opp.category}</span>}
                      {typeof opp.confidence === 'number' && opp.confidence > 0 && <span className="text-[11px] text-[var(--text-muted)] font-mono">Confidence: {Math.round(opp.confidence * 100)}%</span>}
                      {isDecided && (
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${opp.status === 'ACCEPTED' ? 'bg-emerald-500/20 text-emerald-300' : opp.status === 'REJECTED' ? 'bg-red-500/20 text-red-300' : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)]'}`}>
                          {opp.status}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-bold text-[var(--text-primary)] mt-1">{opp.title || opp.description || 'Opportunity'}</div>
                    {opp.description && opp.title && <p className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-2">{opp.description}</p>}
                    {opp.evidence && <p className="text-[11px] text-[var(--text-muted)] mt-1 italic">Evidence: {opp.evidence}</p>}
                  </div>
                  {!isDecided && (
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button type="button" onClick={() => handleAction(opp.id, 'accept')} disabled={acting === opp.id}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50">
                        Accept
                      </button>
                      <button type="button" onClick={() => handleAction(opp.id, 'defer')} disabled={acting === opp.id}
                        className="px-2.5 py-1 rounded bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50">
                        Defer
                      </button>
                      <button type="button" onClick={() => handleAction(opp.id, 'reject')} disabled={acting === opp.id}
                        className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-300 text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer disabled:opacity-50">
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
