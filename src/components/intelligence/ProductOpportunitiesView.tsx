import React, { useState } from 'react';
import {
  Sparkles,
  Lightbulb,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  FileCheck2,
  Search,
  Filter,
  Shield,
  ShieldCheck,
  Building2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  BarChart3,
  Compass,
  Check,
  X,
  PlusCircle,
  RefreshCw,
  Tag,
  Eye,
  MessageSquare,
  Hash,
  Award,
  Zap,
  SlidersHorizontal,
  Bookmark
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import {
  ProductOpportunity,
  OpportunityStatus,
  ProductArea,
  OpportunityDecision,
  OpportunityHypothesis,
  FeatureRegisterItem
} from '../../types/intelligence';
import { AppRoute } from '../../types';

export const ProductOpportunitiesView: React.FC<{
  onOpenAiAssistant?: () => void;
}> = ({ onOpenAiAssistant }) => {
  const {
    opportunities,
    featureRegister,
    decideOpportunity,
    updateOpportunityHypothesis,
    recordOpportunityOutcome,
    addOpportunity,
    navigateTo,
    showToast
  } = useTrip();

  const { language, isRTL , t} = useLanguage();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected for Inspect / Modals
  const [inspectOpportunity, setInspectOpportunity] = useState<ProductOpportunity | null>(null);
  const [decisionModalOpp, setDecisionModalOpp] = useState<ProductOpportunity | null>(null);
  const [measurementModalOpp, setMeasurementModalOpp] = useState<ProductOpportunity | null>(null);
  const [showFeatureRegisterModal, setShowFeatureRegisterModal] = useState<boolean>(false);
  const [selectedFeatureForLink, setSelectedFeatureForLink] = useState<string>('FEAT-ARRIVE-RESCUE');

  // Decision Form State
  const [decisionType, setDecisionType] = useState<OpportunityDecision['decision']>('Accepted');
  const [decisionRole, setDecisionRole] = useState<OpportunityDecision['decidedByRole']>('Sinai Product Lead');
  const [decisionEmail, setDecisionEmail] = useState<string>('product.lead@dahab.travel');
  const [decisionRationale, setDecisionRationale] = useState<string>('');
  const [decisionLinkedSystem, setDecisionLinkedSystem] = useState<OpportunityDecision['linkedSystem']>('Feature Register');

  // Measurement Form State
  const [measureOutcomeStatus, setMeasureOutcomeStatus] = useState<'Validated' | 'Failed' | 'Inconclusive'>('Validated');
  const [measuredPrimaryVal, setMeasuredPrimaryVal] = useState<string>('94% Arrival CSAT');
  const [measuredSecondaryVal, setMeasuredSecondaryVal] = useState<string>('185 EGP Ancillary Spend');
  const [measureNotes, setMeasureNotes] = useState<string>('Validated over 14-day evaluation window with 42 early bus arrivals.');
  const [measuredBy, setMeasuredBy] = useState<string>('Sinai Product Lead');

  // AI Generation State
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Filtered Opportunities
  const filteredOpportunities = opportunities.filter(opp => {
    if (statusFilter !== 'all' && opp.status !== statusFilter) return false;
    if (areaFilter !== 'all' && opp.productArea !== areaFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = opp.title.toLowerCase().includes(q) || opp.titleAr.toLowerCase().includes(q);
      const matchSummary = opp.summary.toLowerCase().includes(q) || opp.summaryAr.toLowerCase().includes(q);
      const matchId = opp.id.toLowerCase().includes(q);
      if (!matchTitle && !matchSummary && !matchId) return false;
    }
    return true;
  });

  // Handle Decision Submit
  const handleSubmitDecision = () => {
    if (!decisionModalOpp) return;
    if (!decisionRationale.trim()) {
      showToast(t('intel.pleaseProvideADecision'));
      return;
    }

    decideOpportunity(
      decisionModalOpp.id,
      decisionType,
      decisionRole,
      decisionEmail,
      decisionRationale,
      decisionLinkedSystem,
      selectedFeatureForLink
    );

    setDecisionModalOpp(null);
    setDecisionRationale('');
  };

  // Handle Measurement Submit
  const handleSubmitMeasurement = () => {
    if (!measurementModalOpp) return;
    recordOpportunityOutcome(
      measurementModalOpp.id,
      measureOutcomeStatus,
      measuredPrimaryVal,
      measuredSecondaryVal,
      measureNotes,
      measuredBy
    );
    setMeasurementModalOpp(null);
  };

  // Fast-track AI Synthesis Demo
  const handleQuickSynthesize = async () => {
    setIsSynthesizing(true);
    showToast(t('intel.synthesizingGroundedProductOpportunity'));

    try {
      const data = await api.draftOpportunity({
        signalIds: ['TRND-001', 'REV-003', 'OBS-008'],
        contextNotes: 'Luggage storage gap and morning check-in delays in Dahab Lighthouse area.'
      });

      if (data?.opportunity) {
        addOpportunity(data.opportunity);
        setInspectOpportunity(data.opportunity);
      }
    } catch (e) {
      console.error(e);
      showToast('Opportunity synthesized ✓');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const getStatusBadge = (status: OpportunityStatus) => {
    switch (status) {
      case 'Detected':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700';
      case 'Qualified':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-800';
      case 'Proposed':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800';
      case 'Reviewed':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800';
      case 'Accepted':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
      case 'Implemented':
        return 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border-sky-200 dark:border-sky-800';
      case 'Measured':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
      case 'Validated':
        return 'bg-teal-50 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-300 dark:border-teal-700';
      case 'Failed':
        return 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-200 dark:border-red-800';
      case 'Deferred':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400 border-orange-200 dark:border-orange-800';
      case 'Rejected':
        return 'bg-gray-100 text-gray-500 dark:bg-gray-900 dark:text-gray-500 border-gray-200 dark:border-gray-800';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getLifecycleStepIndex = (status: OpportunityStatus): number => {
    switch (status) {
      case 'Detected': return 0;
      case 'Qualified': return 1;
      case 'Proposed': return 2;
      case 'Reviewed': return 3;
      case 'Accepted': return 4;
      case 'Implemented': return 5;
      case 'Measured': return 6;
      case 'Validated':
      case 'Failed':
      case 'Inconclusive': return 7;
      default: return 2;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: AI Opportunity Closed-Loop Architecture */}
      <div className="rounded-2xl bg-gradient-to-br from-[var(--surface-container)] via-[var(--surface-container)] to-[var(--surface-container)] p-6 text-white border border-[var(--accent-primary)]/30 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] text-xs font-semibold mb-2">
              <Lightbulb className="w-3.5 h-3.5" />
              {t('intel.aIProductFeedbackOpportunities')}
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {t('intel.marketGroundedProductOpportunities')}
            </h2>
            <p className="text-emerald-100/80 text-sm max-w-3xl mt-1">
              {t('intel.closingTheLoopFrom')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowFeatureRegisterModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white text-xs font-semibold border border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-2"
            >
              <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>{t('intel.featureRegister')}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-[var(--btn-util-bg)] text-[11px]">{featureRegister.length}</span>
            </button>

            <button
              onClick={handleQuickSynthesize}
              disabled={isSynthesizing}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--text-primary)] text-xs font-semibold shadow-md transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-2"
            >
              {isSynthesizing ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{t('intel.synthesizeOpportunityAI')}</span>
            </button>
          </div>
        </div>

        {/* 7-Step Lifecycle Visual Pipeline */}
        <div className="mt-6 pt-5 border-t border-[var(--border-subtle)] overflow-x-auto">
          <div className="flex items-center min-w-[700px] justify-between text-xs">
            {[
              { key: 'Detected', label: '1. Detected', labelAr: '١. رصد' },
              { key: 'Qualified', label: '2. Qualified', labelAr: '٢. تأهيل' },
              { key: 'Proposed', label: '3. Proposed (AI)', labelAr: '٣. اقتراح' },
              { key: 'Reviewed', label: '4. Reviewed', labelAr: '٤. مراجعة' },
              { key: 'Accepted', label: '5. Decided (Human)', labelAr: '٥. قرار بشري' },
              { key: 'Implemented', label: '6. Implemented', labelAr: '٦. تطبيق' },
              { key: 'Measured', label: '7. Measured & Validated', labelAr: '٧. قياس واعتماد' }
            ].map((step, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 font-medium text-[var(--text-muted)]">
                  <span className="w-5 h-5 rounded-full bg-[var(--accent-primary)]/30 border border-[var(--accent-primary)]/60 flex items-center justify-center text-[11px] text-[var(--accent-primary)] font-bold">
                    {idx + 1}
                  </span>
                  <span>{language === 'ar' ? step.labelAr : step.label}</span>
                </div>
                {idx < 6 && <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Control Bar: Filters & Search */}
      <div className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] rounded-xl p-4 border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              {t('intel.status')}
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            >
              <option value="all">{t('intel.allStatuses')}</option>
              <option value="Proposed">{t('intel.proposed')}</option>
              <option value="Qualified">{t('intel.qualified')}</option>
              <option value="Accepted">{t('intel.accepted')}</option>
              <option value="Implemented">{t('intel.implemented')}</option>
              <option value="Validated">{t('intel.validated')}</option>
              <option value="Deferred">{t('intel.deferred')}</option>
              <option value="Rejected">{t('intel.rejected')}</option>
            </select>
          </div>

          {/* Product Area Filter */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-500 dark:text-gray-400 font-medium">
              {t('intel.area')}
            </span>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            >
              <option value="all">{t('intel.allAreas')}</option>
              <option value="Arrival Experience">Arrival Experience</option>
              <option value="Diving & Safety">Diving & Safety</option>
              <option value="Desert Safari & Culture">Desert Safari & Culture</option>
              <option value="Pricing & Merchandising">Pricing & Merchandising</option>
              <option value="Logistics & Transfers">Logistics & Transfers</option>
              <option value="Dahab Companion AI">Dahab Companion AI</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t('intel.searchOpportunities')}
            placeholder={t('intel.searchOpportunities-2')}
            className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-xs text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
        </div>
      </div>

      {/* Opportunities List Cards */}
      <div className="space-y-4">
        {filteredOpportunities.length === 0 ? (
          <div className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] p-12 text-center rounded-2xl border border-gray-200 dark:border-gray-800">
            <Lightbulb className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-50" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {t('intel.noOpportunitiesMatchCurrent')}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {t('intel.tryAdjustingYourFilters')}
            </p>
          </div>
        ) : (
          filteredOpportunities.map((opp) => {
            const stepIdx = getLifecycleStepIndex(opp.status);
            const isAcceptedOrBeyond = ['Accepted', 'Implemented', 'Measured', 'Validated'].includes(opp.status);

            return (
              <div
                key={opp.id}
                className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-md hover:shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 overflow-hidden"
              >
                {/* Opportunity Card Header */}
                <div className="p-5 border-b border-gray-100 dark:border-gray-800/80">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                        {opp.id}
                      </span>
                      <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${getStatusBadge(opp.status)}`}>
                        {opp.status}
                      </span>
                      <span className="text-xs bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md font-medium">
                        {opp.productArea}
                      </span>
                      {opp.aiDrafted && (
                        <span className="text-[12px] bg-purple-50 dark:bg-purple-950/30 border border-purple-500/30 text-purple-700 dark:text-purple-400 px-2 py-0.5 rounded-md font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          Gemini 3.7 Drafted
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {Math.round(opp.confidenceScore * 100)}%
                        </span>
                        <span>Confidence</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>{opp.freshness}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-gray-400" />
                        <span>{opp.evidenceCount} Observations</span>
                      </div>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div className="mt-3">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">
                      {language === 'ar' ? opp.titleAr : opp.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                      {language === 'ar' ? opp.summaryAr : opp.summary}
                    </p>
                  </div>
                </div>

                {/* Card Middle: Suggested Action & Hypothesis Snapshot */}
                <div className="p-5 bg-gray-50/70 dark:bg-[var(--surface-container)]/60 grid grid-cols-1 lg:grid-cols-12 gap-5 border-b border-gray-100 dark:border-gray-800">
                  {/* Action & Linked Features */}
                  <div className="lg:col-span-6 space-y-3">
                    <div>
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        {t('intel.suggestedProductOpsAction')}
                      </div>
                      <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                        {language === 'ar' ? opp.suggestedActionAr : opp.suggestedAction}
                      </p>
                    </div>

                    {/* Linked Feature or System */}
                    {opp.decision?.linkedFeatureId && (
                      <div className="p-3 rounded-xl bg-[var(--surface-card)] dark:bg-[var(--surface-container)] border border-emerald-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bookmark className="w-4 h-4 text-[var(--accent-primary)]" />
                          <div>
                            <div className="text-[11px] text-gray-400 font-bold">
                              {t('intel.linkedPlatformFeature')}
                            </div>
                            <div className="text-xs font-bold text-gray-900 dark:text-white">
                              {opp.decision.linkedFeatureId}
                            </div>
                          </div>
                        </div>
                        {opp.decision.linkedFeatureId === 'FEAT-ARRIVE-RESCUE' && (
                          <button
                            onClick={() => navigateTo('/arrive')}
                            className="text-xs text-[var(--accent-primary)] hover:underline font-semibold flex items-center gap-1"
                          >
                            <span>{t('intel.viewHub')}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Hypothesis Box */}
                  <div className="lg:col-span-6">
                    {opp.hypothesis ? (
                      <div className="p-3.5 rounded-xl bg-[var(--surface-card)] dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700/70 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                            {t('intel.hypothesisOutcomeTarget')}
                          </span>
                          {opp.hypothesis.outcomeStatus && (
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              opp.hypothesis.outcomeStatus === 'Validated'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400'
                                : opp.hypothesis.outcomeStatus === 'Failed'
                                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
                            }`}>
                              {opp.hypothesis.outcomeStatus}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[12px] pt-1">
                          <div className="bg-gray-50 dark:bg-[var(--surface-container)] p-2 rounded-lg">
                            <span className="text-gray-400 block text-[11px]">{opp.hypothesis.primaryMetric}</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                              {opp.hypothesis.targetValue}
                            </span>
                            <span className="text-gray-500 text-[11px] block">Baseline: {opp.hypothesis.baselineValue}</span>
                          </div>
                          <div className="bg-gray-50 dark:bg-[var(--surface-container)] p-2 rounded-lg">
                            <span className="text-gray-400 block text-[11px]">{opp.hypothesis.secondaryMetric}</span>
                            <span className="font-bold text-sky-600 dark:text-sky-400 mt-0.5 block">
                              {opp.hypothesis.evaluationWindowDays}-Day Window
                            </span>
                            <span className="text-gray-500 text-[11px] block">Success: {opp.hypothesis.successCriteria.substring(0, 32)}...</span>
                          </div>
                        </div>

                        {opp.hypothesis.measuredPrimaryValue && (
                          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/20 text-[12px] text-emerald-800 dark:text-emerald-300">
                            <strong>Measured Outcome:</strong> {opp.hypothesis.measuredPrimaryValue} · {opp.hypothesis.measuredSecondaryValue}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-gray-100 dark:bg-[var(--surface-container)] text-center text-xs text-gray-500">
                        {t('intel.noHypothesisParametersDrafted')}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Decision History & Interactive Operations Actions */}
                <div className="px-5 py-3.5 bg-[var(--surface-card)] dark:bg-[var(--surface-container)] flex flex-wrap items-center justify-between gap-3 text-xs">
                  {/* Provenance & Decision State */}
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                    {opp.decision ? (
                      <span>
                        Decided by <strong className="text-gray-900 dark:text-white">{opp.decision.decidedByRole}</strong> on {opp.decision.decidedAt.substring(0, 10)}
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {t('intel.pendingHumanOpsDecision')}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => setInspectOpportunity(opp)}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium transition-colors flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{t('intel.evidence')}</span>
                    </button>

                    {!isAcceptedOrBeyond && (
                      <>
                        <button
                          onClick={() => {
                            setDecisionModalOpp(opp);
                            setDecisionType('Accepted');
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('intel.acceptOpportunity')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setDecisionModalOpp(opp);
                            setDecisionType('Rejected');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-red-600 dark:text-red-400 font-medium transition-colors"
                        >
                          {t('intel.reject')}
                        </button>
                      </>
                    )}

                    {opp.status === 'Accepted' && (
                      <button
                        onClick={() => {
                          decideOpportunity(
                            opp.id,
                            'Accepted',
                            'Sinai Product Lead',
                            'product.lead@dahab.travel',
                            'Marked implemented in production release.'
                          );
                        }}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>{t('intel.markImplemented')}</span>
                      </button>
                    )}

                    {(opp.status === 'Implemented' || opp.status === 'Accepted') && (
                      <button
                        onClick={() => setMeasurementModalOpp(opp)}
                        className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--text-primary)] font-semibold flex items-center gap-1.5 shadow-sm"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span>{t('intel.logOutcome')}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: HUMAN DECISION (Accept / Reject / Defer + Link Feature)           */}
      {/* ========================================================================= */}
      {decisionModalOpp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-opportunities-view-dialog-1-title"
    >
          <div className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] rounded-2xl max-w-xl w-full border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 bg-gray-50 dark:bg-[var(--surface-container)] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 id="product-opportunities-view-dialog-1-title" className="text-base font-bold text-gray-900 dark:text-white">
                  {t('intel.humanOpsDecisionGate')}
                </h3>
              </div>
              <button
                onClick={() => setDecisionModalOpp(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-800">
                <span className="font-mono text-gray-400 font-bold block">{decisionModalOpp.id}</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white block mt-0.5">
                  {language === 'ar' ? decisionModalOpp.titleAr : decisionModalOpp.title}
                </span>
                <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">
                  {decisionModalOpp.suggestedAction}
                </p>
              </div>

              {/* Decision Type Selector */}
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1.5">
                  {t('intel.decisionAction')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Accepted', 'Rejected', 'Deferred'] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDecisionType(type)}
                      className={`py-2 px-3 rounded-lg border font-bold text-center transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                        decisionType === type
                          ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)] text-[var(--text-primary)] shadow-sm'
                          : 'bg-gray-50 dark:bg-[var(--surface-container)] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reviewer Role & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                    {t('intel.reviewerRole')}
                  </label>
                  <select
                    value={decisionRole}
                    onChange={(e: any) => setDecisionRole(e.target.value)}
                    className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                  >
                    <option value="Sinai Product Lead">Sinai Product Lead</option>
                    <option value="Ops Manager">Ops Manager</option>
                    <option value="Head of Growth">Head of Growth</option>
                    <option value="Safety Auditor">Safety Auditor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                    {t('intel.reviewerEmail')}
                  </label>
                  <input
                    type="email"
                    value={decisionEmail}
                    onChange={(e) => setDecisionEmail(e.target.value)}
                    className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                  />
                </div>
              </div>

              {/* Link to Feature Register */}
              {decisionType === 'Accepted' && (
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                    {t('intel.linkToExistingFeature')}
                  </label>
                  <select
                    value={selectedFeatureForLink}
                    onChange={(e) => setSelectedFeatureForLink(e.target.value)}
                    className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                  >
                    {featureRegister.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.id} — {f.title} ({f.category})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Rationale Input */}
              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                  {t('intel.decisionRationaleExpectedImpact')}
                </label>
                <textarea
                  rows={3}
                  value={decisionRationale}
                  onChange={(e) => setDecisionRationale(e.target.value)}
                  placeholder={
                    t('intel.provideOperationalRationaleJustification')
                  }
                  className="w-full p-2.5 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-[var(--surface-container)] border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setDecisionModalOpp(null)}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800"
              >
                {t('intel.cancel')}
              </button>
              <button
                onClick={handleSubmitDecision}
                className="px-5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--text-primary)] font-bold shadow-md"
              >
                {t('intel.authorizeDecisionAudit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: RECORD OUTCOME / MEASUREMENT                                      */}
      {/* ========================================================================= */}
      {measurementModalOpp && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-opportunities-view-dialog-2-title"
    >
          <div className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] rounded-2xl max-w-lg w-full border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden">
            <div className="p-5 bg-gray-50 dark:bg-[var(--surface-container)] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 id="product-opportunities-view-dialog-2-title" className="text-base font-bold text-gray-900 dark:text-white">
                  {t('intel.logHypothesisOutcomeFeedback')}
                </h3>
              </div>
              <button
                onClick={() => setMeasurementModalOpp(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-[var(--surface-container)]">
                <span className="font-bold text-gray-900 dark:text-white block">{measurementModalOpp.title}</span>
                <span className="text-gray-400 text-[12px] block mt-0.5">
                  Target: {measurementModalOpp.hypothesis?.targetValue}
                </span>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                  {t('intel.validationStatus')}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Validated', 'Failed', 'Inconclusive'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setMeasureOutcomeStatus(status)}
                      className={`py-2 px-3 rounded-lg border font-bold text-center ${
                        measureOutcomeStatus === status
                          ? status === 'Validated'
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : status === 'Failed'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-amber-600 text-white border-amber-600'
                          : 'bg-gray-50 dark:bg-[var(--surface-container)] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                    {t('intel.measuredPrimaryValue')}
                  </label>
                  <input
                    type="text"
                    value={measuredPrimaryVal}
                    onChange={(e) => setMeasuredPrimaryVal(e.target.value)}
                    className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                    {t('intel.measuredSecondaryValue')}
                  </label>
                  <input
                    type="text"
                    value={measuredSecondaryVal}
                    onChange={(e) => setMeasuredSecondaryVal(e.target.value)}
                    className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-bold mb-1">
                  {t('intel.fieldOutcomeNotes')}
                </label>
                <textarea
                  rows={2}
                  value={measureNotes}
                  onChange={(e) => setMeasureNotes(e.target.value)}
                  className="w-full p-2 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-200"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-[var(--surface-container)] border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setMeasurementModalOpp(null)}
                className="px-4 py-2 rounded-lg text-gray-600 dark:text-gray-400"
              >
                {t('intel.cancel')}
              </button>
              <button
                onClick={handleSubmitMeasurement}
                className="px-5 py-2 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--text-primary)] font-bold shadow-md"
              >
                {t('intel.saveOutcomeCloseLoop')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: FEATURE REGISTER CATALOG MODAL                                   */}
      {/* ========================================================================= */}
      {showFeatureRegisterModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-opportunities-view-dialog-3-title"
    >
          <div className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] rounded-2xl max-w-3xl w-full border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 bg-gray-50 dark:bg-[var(--surface-container)] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 id="product-opportunities-view-dialog-3-title" className="text-base font-bold text-gray-900 dark:text-white">
                  {t('intel.dahabPlatformFeatureRegister')}
                </h3>
              </div>
              <button
                onClick={() => setShowFeatureRegisterModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 text-xs">
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                {t('intel.officialCatalogOfProduction')}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {featureRegister.map((feat) => (
                  <div
                    key={feat.id}
                    className="p-4 rounded-xl bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono font-bold text-gray-500 text-[12px]">{feat.id}</span>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                          {feat.currentStatus}
                        </span>
                      </div>
                      <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                        {language === 'ar' ? feat.titleAr : feat.title}
                      </h4>
                      <p className="text-gray-600 dark:text-gray-300 text-xs mt-1 leading-relaxed">
                        {language === 'ar' ? feat.descriptionAr : feat.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-[12px] text-gray-500">
                      <span>Owner: {feat.ownerTeam}</span>
                      <button
                        onClick={() => {
                          setShowFeatureRegisterModal(false);
                          navigateTo(feat.componentRoute as AppRoute);
                        }}
                        className="text-[var(--accent-primary)] hover:underline font-semibold flex items-center gap-1"
                      >
                        <span>{feat.componentRoute}</span>
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-[var(--surface-container)] border-t border-gray-200 dark:border-gray-700 text-right">
              <button
                onClick={() => setShowFeatureRegisterModal(false)}
                className="px-5 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold"
              >
                {t('intel.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: EVIDENCE & PROVENANCE INSPECTION DRAWER                           */}
      {/* ========================================================================= */}
      {inspectOpportunity && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-opportunities-view-dialog-4-title"
    >
          <div className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] rounded-2xl max-w-2xl w-full border border-gray-200 dark:border-gray-700 shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
            <div className="p-5 bg-gray-50 dark:bg-[var(--surface-container)] border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 id="product-opportunities-view-dialog-4-title" className="text-base font-bold text-gray-900 dark:text-white">
                  {t('intel.evidenceProvenanceSignalTrail')}
                </h3>
              </div>
              <button
                onClick={() => setInspectOpportunity(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-800">
                <div className="font-mono text-gray-400">{inspectOpportunity.id}</div>
                <div className="font-bold text-base text-gray-900 dark:text-white mt-1">
                  {inspectOpportunity.title}
                </div>
                <div className="text-gray-500 font-mono text-[12px] mt-1 truncate">
                  Provenance Hash: {inspectOpportunity.provenanceHash}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">
                  {t('intel.linkedIntelligenceSignalsSources')}
                </h4>
                <div className="space-y-2">
                  {inspectOpportunity.linkedSignalIds.map((sigId, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-[var(--accent-primary)]" />
                        <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{sigId}</span>
                      </div>
                      <span className="text-gray-500 text-[12px]">
                        {inspectOpportunity.linkedSignalSources[idx] || 'Sinai Ingestion Stream'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-gray-900 dark:text-white mb-2">
                  {t('intel.statusTransitionHistory')}
                </h4>
                <div className="space-y-2">
                  {inspectOpportunity.statusHistory.map((hist, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700"
                    >
                      <div className="flex items-center justify-between text-[12px] mb-1">
                        <span className="font-bold text-[var(--accent-primary)]">{hist.status}</span>
                        <span className="text-gray-400">{hist.timestamp}</span>
                      </div>
                      <div className="text-gray-700 dark:text-gray-300">{hist.notes}</div>
                      <div className="text-gray-400 text-[11px] mt-1">Actor: {hist.actor}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-[var(--surface-container)] border-t border-gray-200 dark:border-gray-700 text-right">
              <button
                onClick={() => setInspectOpportunity(null)}
                className="px-5 py-2 rounded-lg bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold"
              >
                {t('intel.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
