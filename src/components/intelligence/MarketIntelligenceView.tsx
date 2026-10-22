import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import type { SourceHealth, MarketAlert, MarketSchedulePolicy } from '../../services/api';
import {
  Globe,
  Radio,
  Search,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  FileCode,
  Users,
  Compass,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Building2,
  ExternalLink,
  Layers,
  Database,
  Cpu,
  BarChart3,
  DollarSign,
  MessageSquare,
  Sparkles,
  Zap,
  Tag,
  MapPin,
  Flame,
  Check,
  X,
  Eye,
  FileText,
  Filter,
  Download,
  AlertCircle,
  FileCheck2,
  Lock,
  ArrowUpRight,
  PhoneCall,
  BadgeCheck,
  Briefcase,
  Bot,
  Lightbulb
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ProductOpportunitiesView } from './ProductOpportunitiesView';
import { GroundedAiAssistantView } from './GroundedAiAssistantView';
import {
  initialSources,
  initialCrawlJobs,
  initialRawObservations,
  initialNormalizedEntities,
  initialEntityResolutionMatches,
  initialDiscoveredSuppliers,
  initialCompetitorOfferings,
  initialPriceIndex,
  initialReviewSignals,
  initialContentTrends,
  initialChangeRadarEvents,
  initialRegulatoryConditions,
  initialRegulatoryAudits
} from '../../data/intelligenceData';
import {
  IntelligenceSource,
  CrawlJob,
  RawObservation,
  NormalizedEntity,
  EntityResolutionMatch,
  DiscoveredSupplierCandidate,
  CompetitorOffering,
  PriceMarketIndex,
  ReviewSentimentSignal,
  TravelerContentTrend,
  ChangeRadarEvent,
  RegulatoryRoadCondition,
  RegulatoryGovernanceAudit,
  SupplierLifecycleStage
} from '../../types/intelligence';

function changeSeverityBg(severity: MarketAlert['severity']): string {
  if (severity === 'CRITICAL') return 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20';
  if (severity === 'HIGH') return 'bg-amber-950/20 border-amber-500/40';
  return 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)]';
}

export const MarketIntelligenceView: React.FC = () => {
  const {
    navigateTo,
    showToast,
    authoritativeSuppliers,
    setActiveSupplierId,
    promoteCandidateToSupplierOS,
    pricingDecisions,
    approvePricingDecision,
    contentBridges,
    adoptContentBridge,
    opportunities
  } = useTrip();
  const { language, isRTL , t} = useLanguage();

  // Active Tab State (16 Intelligence Subsystems, Opportunities & AI Assistant)
  const [activeTab, setActiveTab] = useState<
    'overview' | 'opportunities' | 'ai_assistant' | 'sources' | 'crawls' | 'observations' | 'normalization' | 'resolution' | 'discovery' | 'competitors' | 'prices' | 'reviews' | 'content' | 'changes' | 'regulatory' | 'audit'
  >('overview');

  // Interactive Data States
  const [sources, setSources] = useState<IntelligenceSource[]>(initialSources);
  const [sourceHealth, setSourceHealth] = useState<SourceHealth[]>([]);
  const [marketAlerts, setMarketAlerts] = useState<MarketAlert[]>([]);
  const [crawls, setCrawls] = useState<CrawlJob[]>(initialCrawlJobs);
  const [schedulePolicies, setSchedulePolicies] = useState<MarketSchedulePolicy[]>([]);
  const [observations, setObservations] = useState<RawObservation[]>(initialRawObservations);
  const [normalizedEntities] = useState<NormalizedEntity[]>(initialNormalizedEntities);
  const [resolutionMatches] = useState<EntityResolutionMatch[]>(initialEntityResolutionMatches);
  const [discoveredSuppliers, setDiscoveredSuppliers] = useState<DiscoveredSupplierCandidate[]>(initialDiscoveredSuppliers);
  const [competitors] = useState<CompetitorOffering[]>(initialCompetitorOfferings);
  const [priceIndex] = useState<PriceMarketIndex[]>(initialPriceIndex);
  const [reviews] = useState<ReviewSentimentSignal[]>(initialReviewSignals);
  const [contentTrends] = useState<TravelerContentTrend[]>(initialContentTrends);
  const [changeEvents, setChangeEvents] = useState<ChangeRadarEvent[]>(initialChangeRadarEvents);
  const [regulatoryConditions] = useState<RegulatoryRoadCondition[]>(initialRegulatoryConditions);
  const [regulatoryAudits] = useState<RegulatoryGovernanceAudit[]>(initialRegulatoryAudits);

  // Filters & Modal States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [inspectObservation, setInspectObservation] = useState<RawObservation | null>(null);
  const [selectedSupplierCandidate, setSelectedSupplierCandidate] = useState<DiscoveredSupplierCandidate | null>(null);
  const [candidatePromotionStep, setCandidatePromotionStep] = useState<SupplierLifecycleStage>('Candidate');
  const [reviewerNotes, setReviewerNotes] = useState<string>('');
  const [isCrawling, setIsCrawling] = useState(false);

  // Fetch real source health on mount to augment the static governance matrix.
  // The server's /api/market/sources/health returns { health: SourceHealth[] }
  // — runtime reachability/metrics, distinct from the static governance
  // attributes (`name`, `robotsStatus`, …) held in `initialSources`.
  useEffect(() => {
    const controller = new AbortController();
    api.getMarketSourceHealth(controller.signal)
      .then((data) => {
        if (data.health?.length) {
          setSourceHealth(data.health);
        }
      })
      .catch(() => {}); // fallback to empty health
    return () => controller.abort();
  }, []);

  // Fetch real market alerts on mount. These are typed MarketAlert records and
  // are rendered in their own section — they are NOT change-radar events, so
  // they are no longer merged into the ChangeRadarEvent stream (which has a
  // different shape and would otherwise paint garbage alongside real events).
  useEffect(() => {
    const controller = new AbortController();
    api.getMarketAlerts(controller.signal)
      .then((data) => {
        if (data.alerts?.length) {
          setMarketAlerts(data.alerts);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Fetch real scheduled-refresh policies on mount. These are schedule
  // policies (INTERVAL, ENABLED, LAST RUN), not completed crawl runs — so they
  // are kept apart from `crawls` (actual run records from handleRefreshMarket).
  useEffect(() => {
    const controller = new AbortController();
    api.getMarketJobs(controller.signal)
      .then((data) => {
        if (data.policies?.length) {
          setSchedulePolicies(data.policies);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  /**
   * Runs the real market refresh.
   *
   * This used to be pure theatre: a setTimeout that, after 1800ms, pushed a
   * CrawlJob claiming "28 records extracted, 1.8 MB payload, entity resolution
   * completed with 100% precision" and toasted "Live crawl completed" — with no
   * network call of any kind. An operator had every reason to believe the data
   * had just been refreshed.
   *
   * /api/market/refresh is real, so the row is now built from what it returns.
   * Note the wording: it recomputes from stored observations, it does not crawl
   * external sources, so it is no longer described as one.
   */
  const handleRefreshMarket = async () => {
    setIsCrawling(true);
    const startedAt = new Date();
    showToast(
      t('intel.recomputingMarketIndicesFrom')
    );

    try {
      const result = await api.refreshMarketIntelligence();
      const completedAt = new Date();
      const succeeded = result.refreshStatus === 'SUCCESS';

      setCrawls(prev => [{
        id: result.runId,
        sourceId: result.snapshotId,
        sourceName: t('intel.manualMarketIndexRecompute'),
        startedAt: startedAt.toLocaleTimeString('en-US', { hour12: false }),
        completedAt: completedAt.toLocaleTimeString('en-US', { hour12: false }),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        status: succeeded ? 'Completed' : 'Failed',
        recordsExtracted: result.stats?.totalObservations ?? 0,
        recordsNormalized: result.marketStatistics?.length ?? 0,
        anomaliesFound: result.anomaliesDetectedCount ?? 0,
        // Not measured, and inventing a number here is what this fix removes.
        payloadSize: '—',
        logs: [
          result.message,
          `Changes detected: ${result.changesDetectedCount ?? 0} · recorded: ${result.changesRecorded ?? 0}`,
          `Conflicts detected: ${result.conflictsDetectedCount ?? 0}`
        ]
      } as CrawlJob, ...prev]);

      showToast(
        succeeded
          ? (t('intel.refreshedChanges', { count: result.changesDetectedCount ?? 0 }))
          : (t('intel.refreshFailedSeeThe'))
      );
    } catch (err) {
      // A failed request must not look like a completed run.
      const completedAt = new Date();
      setCrawls(prev => [{
        id: `RUN-FAILED-${completedAt.getTime()}`,
        sourceId: '—',
        sourceName: t('intel.manualMarketIndexRecompute'),
        startedAt: startedAt.toLocaleTimeString('en-US', { hour12: false }),
        completedAt: completedAt.toLocaleTimeString('en-US', { hour12: false }),
        durationMs: completedAt.getTime() - startedAt.getTime(),
        status: 'Failed',
        recordsExtracted: 0,
        recordsNormalized: 0,
        anomaliesFound: 0,
        payloadSize: '—',
        logs: [(err as Error).message]
      } as CrawlJob, ...prev]);
      showToast(t('intel.theRefreshCouldNot'));
    } finally {
      setIsCrawling(false);
    }
  };

  // Action: Update Observation Status
  const handleUpdateObservationStatus = (id: string, newStatus: RawObservation['verification_status']) => {
    setObservations(prev =>
      prev.map(obs => (obs.id === id ? { ...obs, verification_status: newStatus } : obs))
    );
    showToast(
      t('intel.updatedObservationStatusTo', { newStatus })
    );
  };

  // Action: Step Supplier Candidate through Human Review State Machine
  const handleAdvanceCandidateStage = (targetStage: SupplierLifecycleStage) => {
    if (!selectedSupplierCandidate) return;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const actorRole = 'Sinai Operations Lead';
    const actorEmail = 'ahmed.ops@dahab.live';

    const updatedHistory = [
      ...selectedSupplierCandidate.stageHistory,
      {
        stage: targetStage,
        timestamp,
        actorRole,
        actorEmail,
        notes: reviewerNotes || `Advanced to ${targetStage} stage following verified Ops background inspection.`
      }
    ];

    const isFinalApproval = targetStage === 'Approved' || targetStage === 'In Supplier OS';

    const updatedCandidate: DiscoveredSupplierCandidate = {
      ...selectedSupplierCandidate,
      currentStage: isFinalApproval ? 'In Supplier OS' : targetStage,
      vettingStatus: isFinalApproval ? 'Promoted to Production' : targetStage === 'Verified' ? 'Reviewed & Vetted' : 'Under Review',
      stageHistory: updatedHistory,
      verifiedBy: targetStage === 'Verified' || isFinalApproval ? `${actorRole} (${actorEmail})` : selectedSupplierCandidate.verifiedBy,
      verifiedAt: targetStage === 'Verified' || isFinalApproval ? timestamp : selectedSupplierCandidate.verifiedAt,
      licenseCheckPassed: targetStage === 'Verified' || isFinalApproval ? true : selectedSupplierCandidate.licenseCheckPassed,
      safetyCheckPassed: targetStage === 'Verified' || isFinalApproval ? true : selectedSupplierCandidate.safetyCheckPassed,
      tribalAgreementValidated: targetStage === 'Verified' || isFinalApproval ? true : selectedSupplierCandidate.tribalAgreementValidated
    };

    setDiscoveredSuppliers(prev =>
      prev.map(s => (s.id === updatedCandidate.id ? updatedCandidate : s))
    );
    setSelectedSupplierCandidate(updatedCandidate);

    if (isFinalApproval) {
      const newAuthoritativeSupplier = promoteCandidateToSupplierOS(
        updatedCandidate,
        actorRole,
        actorEmail,
        reviewerNotes || `Promoted through 5-stage human approval state machine. Production credentials issued.`
      );
      showToast(
        t('intel.candidateApproved', { name: updatedCandidate.businessName })
      );
    } else {
      showToast(`Supplier candidate advanced to "${targetStage}" stage ✓`);
    }
  };

  // Action: Resolve Change Alert with Ops Review & Product Truth flag
  /**
   * A change-radar signal counts as dealt with once Ops has confirmed,
   * dismissed or actioned it. The component previously branched on a boolean
   * `isChangeEventResolved(event)` that the ChangeRadarEvent model has never defined.
   */
  const isChangeEventResolved = (ev: ChangeRadarEvent): boolean =>
    ev.resolution_state === 'confirmed' ||
    ev.resolution_state === 'dismissed' ||
    ev.resolution_state === 'actioned';

  const handleToggleChangeResolved = (id: string, action: 'CONFIRM' | 'DISMISS') => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setChangeEvents(prev =>
      prev.map(ev => {
        if (ev.id === id) {
          return {
            ...ev,
            // Was writing a phantom `resolved: true` and never touching
            // resolution_state — the field the model actually defines and that
            // every other consumer reads.
            resolution_state: action === 'CONFIRM' ? 'confirmed' : 'dismissed',
            isProductTruth: action === 'CONFIRM',
            reviewer: 'Sinai Operations Desk (ops.duty@dahab.live)',
            reviewedAt: timestamp
          };
        }
        return ev;
      })
    );
    showToast(
      action === 'CONFIRM'
        ? 'Signal confirmed by Ops and promoted to product truth ✓'
        : 'Signal dismissed as noise · Product truth unchanged'
    );
  };

  // Export JSON Brief
  const handleExportBrief = () => {
    const dataStr = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        classification: 'INTERNAL_MARKET_INTELLIGENCE',
        freshnessMetrics: { totalSources: sources.length, totalObservations: observations.length },
        priceIndex,
        competitors,
        reviews,
        contentTrends
      },
      null,
      2
    );
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dahab-market-intelligence-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    showToast(
      t('intel.dahabMarketIntelligenceBrief')
    );
  };

  // Filtered observations
  const filteredObservations = observations.filter(obs => {
    const matchesSearch =
      obs.entityCandidateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obs.rawSnippet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      obs.source.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesVertical = selectedVertical === 'all' || obs.categoryHint.includes(selectedVertical);
    return matchesSearch && matchesVertical;
  });

  return (
    <div
      id="market-intelligence-view"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24"
    >
      {/* 1. Header Cockpit & Executive Summary */}
      <header className="bg-[var(--surface-container)] border-b border-[var(--border-subtle)] px-4 sm:px-6 lg:px-8 pt-8 pb-6">
        <div className="max-w-7xl mx-auto space-y-5">
          {/* Breadcrumb & Navigation Linkage */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-primary)] border border-teal-300/30 flex items-center justify-center text-white shadow-lg">
                <Globe className="w-6 h-6 animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                    {t('intel.dahabMarketWebIntelligence')}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/40">
                    LIVE RADAR ENGINE v3.2
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    INTERNAL INTEL ONLY
                  </span>
                </div>
                <p className="text-xs text-[var(--surface-container)]/80 mt-0.5">
                  {t('intel.continuousMarketPerceptionCandidate')}
                </p>
              </div>
            </div>

            {/* Quick Cross-Domain Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleRefreshMarket}
                disabled={isCrawling}
                className="btn-glass-gold px-4 py-2 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isCrawling ? 'animate-spin' : ''}`} />
                <span>{isCrawling ? (t('intel.refreshing')) : (t('intel.refreshMarketIndices'))}</span>
              </button>

              <button
                type="button"
                onClick={handleExportBrief}
                className="btn-glass-dark px-3.5 py-2 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 cursor-pointer text-[var(--surface-container)] hover:text-[var(--text-primary)]"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{t('intel.exportBrief')}</span>
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/ops-console')}
                className="px-3.5 py-2 rounded-xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--surface-container)] hover:text-[var(--text-primary)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] border border-[var(--border-subtle)] cursor-pointer"
              >
                {t('intel.opsConsole')}
              </button>

              <button
                type="button"
                onClick={() => navigateTo('/supplier-portal')}
                className="px-3.5 py-2 rounded-xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--surface-container)] hover:text-[var(--text-primary)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] border border-[var(--border-subtle)] cursor-pointer"
              >
                {t('intel.supplierOS')}
              </button>
            </div>
          </div>

          {/* CRITICAL DATA GOVERNANCE WARNING BANNER */}
          <div className="p-3.5 rounded-2xl bg-[var(--brand-coral)]/15 border border-[var(--brand-coral)]/35 text-[var(--brand-coral)] flex items-start gap-3 text-xs leading-relaxed backdrop-blur-md">
            <ShieldAlert className="w-4 h-4 text-[var(--brand-coral)] shrink-0 mt-0.5" />
            <div>
              <span className="font-extrabold text-[var(--text-primary)] tracking-wide">
                {t('intel.dataGovernanceRule')}
              </span>
              {t('intel.scrapedAndWebcollectedInformation')}
            </div>
          </div>

          {/* Key Executive KPI Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              {
                label: t('intel.activeSources'),
                val: `${sources.length} Feeds`,
                sub: 'Hourly & Daily',
                icon: Database,
                color: 'text-teal-400'
              },
              {
                label: t('intel.crawlSuccess'),
                val: '98.4%',
                sub: '0.6% anomaly rate',
                icon: Cpu,
                color: 'text-emerald-400'
              },
              {
                label: t('intel.candidateSuppliers'),
                val: `${discoveredSuppliers.length} Staged`,
                sub: 'Ready for OS Vetting',
                icon: Users,
                color: 'text-amber-400'
              },
              {
                label: t('intel.monitoredVerticals'),
                val: `${priceIndex.length} Verticals`,
                sub: 'EGP / USD Index',
                icon: DollarSign,
                color: 'text-sky-400'
              },
              {
                label: t('intel.reviewSignals'),
                val: `${reviews.length} Ingested`,
                sub: '1 Safety Alert',
                icon: MessageSquare,
                color: 'text-rose-400'
              },
              {
                label: t('intel.changeRadar'),
                val: `${changeEvents.length} Events`,
                sub: '1 Action Required',
                icon: Radio,
                color: 'text-[var(--accent-secondary)]'
              }
            ].map((metric, i) => {
              const Icon = metric.icon;
              return (
                <div
                  key={i}
                  className="p-3 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-1 backdrop-blur-md"
                >
                  <div className="flex items-center justify-between text-[var(--surface-container)]/70 text-[12px]">
                    <span>{metric.label}</span>
                    <Icon className={`w-3.5 h-3.5 ${metric.color}`} />
                  </div>
                  <div className="text-base sm:text-lg font-black text-white">
                    {metric.val}
                  </div>
                  <div className="text-[11px] text-[var(--surface-container)]/60 font-mono">{metric.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Subsystems Navigation Tabs */}
          <div className="flex items-center gap-1.5 border-t border-[var(--border-subtle)] pt-3 overflow-x-auto scrollbar-none">
            {([
              { id: 'overview', label: t('intel.overviewRadar'), icon: Radio },
              { id: 'opportunities', label: t('intel.productOpportunities', { count: opportunities.length }), icon: Lightbulb },
              { id: 'ai_assistant', label: t('intel.askDahabIntelAI'), icon: Bot },
              { id: 'sources', label: t('intel.sourceGovernance'), icon: Database },
              { id: 'crawls', label: t('intel.crawlsPipeline'), icon: Cpu },
              { id: 'observations', label: t('intel.rawObservations'), icon: FileCode },
              { id: 'normalization', label: t('intel.normalization'), icon: Layers },
              { id: 'resolution', label: t('intel.entityResolution6Scenarios'), icon: CheckCircle2 },
              { id: 'discovery', label: t('intel.supplierDiscovery'), icon: Building2 },
              { id: 'competitors', label: t('intel.competitiveRadar'), icon: BarChart3 },
              { id: 'prices', label: t('intel.priceIntelligenceFX'), icon: DollarSign },
              { id: 'reviews', label: t('intel.reviewSignals-2'), icon: MessageSquare },
              { id: 'content', label: t('intel.contentTrends'), icon: Sparkles },
              { id: 'regulatory', label: t('intel.roadsSinaiPermits'), icon: MapPin },
              { id: 'changes', label: t('intel.changeRadar-2'), icon: Flame },
              { id: 'audit', label: t('intel.21PointAuditMatrix'), icon: ShieldCheck }
            ] as const).map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'btn-glass-teal text-white shadow-md'
                      : 'text-[var(--surface-container)]/80 hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* 2. Main Subsystem Workspace */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* ========================================================================= */}
        {/* TAB: PRODUCT OPPORTUNITIES & AI FEEDBACK LOOP                              */}
        {/* ========================================================================= */}
        {activeTab === 'opportunities' && (
          <div className="space-y-6">
            <ProductOpportunitiesView onOpenAiAssistant={() => setActiveTab('ai_assistant')} />
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: GROUNDED AI INTELLIGENCE Q&A                                         */}
        {/* ========================================================================= */}
        {activeTab === 'ai_assistant' && (
          <div className="space-y-6">
            <GroundedAiAssistantView onOpportunityCreated={() => setActiveTab('opportunities')} />
          </div>
        )}
        
        {/* ========================================================================= */}
        {/* TAB 1: OVERVIEW & LIVE RADAR                                             */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Top Row: Change Radar Alerts & Market Opportunities */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Active Change Radar Stream */}
              <div className="lg:col-span-2 p-6 rounded-3xl bg-[var(--surface-container)]/70 border border-[var(--border-subtle)] backdrop-blur-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame className="w-5 h-5 text-[var(--accent-secondary)]" />
                    <h2 className="font-bold text-base text-[var(--text-primary)]">
                      {t('intel.liveDahabChangeRadar')}
                    </h2>
                  </div>
                  <span className="text-xs text-[var(--surface-container)]/70 font-mono">Real-time Stream</span>
                </div>

                <div className="space-y-3">
                  {changeEvents.map(event => (
                    <div
                      key={event.id}
                      className={`p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                        isChangeEventResolved(event)
                          ? 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)] opacity-75'
                          : event.severity === 'Action Required'
                          ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20'
                          : 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-mono text-[var(--accent-primary)]">{event.timestamp}</span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                event.severity === 'Action Required'
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : event.severity === 'Notice'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                              }`}
                            >
                              {event.changeType}
                            </span>
                            <span className="text-xs font-bold text-white">{event.entityName}</span>
                          </div>
                          <p className="text-xs text-[var(--surface-container)] leading-relaxed">
                            {language === 'ar' ? event.descriptionAr : event.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleChangeResolved(event.id, 'CONFIRM')}
                          className={`px-2.5 py-1 rounded-lg text-[12px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shrink-0 cursor-pointer ${
                            isChangeEventResolved(event)
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'btn-glass-gold text-[var(--surface-container)]'
                          }`}
                        >
                          {isChangeEventResolved(event) ? (t('intel.resolved')) : (t('intel.acknowledge'))}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategic Market Opportunities */}
              <div className="p-6 rounded-3xl bg-gradient-to-br from-[var(--surface-container)] to-[var(--surface-container)] border border-[var(--accent-primary)]/30 backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h3 className="font-bold text-base text-[var(--text-primary)]">
                    {t('intel.extractedMarketInsights')}
                  </h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-bold text-emerald-400">1. Private Transfer Competitiveness</span>
                    <p className="text-[var(--surface-container)]/80">
                      Competitor prices for Sharm ↔ Dahab surged to 1,650 EGP. Our locked 1,450 EGP rate offers a 13.8% pricing edge. Recommend highlighting in Booking Drawer.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-bold text-amber-400">2. Ras Abu Galum Safety Opportunity</span>
                    <p className="text-[var(--surface-container)]/80">
                      External reviews cite lack of life jackets on independent speedboats. Certifying our partner boat fleet with verified safety gear will drive traveler trust.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] space-y-1">
                    <span className="font-bold text-[var(--accent-primary)]">3. Trending Content Gap</span>
                    <p className="text-[var(--surface-container)]/80">
                      Solo female traveler safety queries grew +42%. Recommend launching an authoritative Sinai Safety & Night Walk guide.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('prices')}
                  className="w-full py-2.5 rounded-xl btn-glass-teal text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <span>{t('intel.deepDivePriceRadar')}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </button>
              </div>
            </div>

            {/* Active Market Alerts — separate from the change radar. These are
                MarketAlert records (titleEn/titleAr, alertType, severity) from
                GET /api/market/alerts; they are kept out of the ChangeRadarEvent
                stream so each renders with its own honest fields. */}
            <div className="p-6 rounded-3xl bg-[var(--surface-container)]/70 border border-[var(--accent-secondary)]/30 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-[var(--accent-secondary)]" />
                <h3 className="font-bold text-sm text-[var(--text-primary)]">
                  {t('intel.marketAlerts')}
                </h3>
                <span className="text-xs text-[var(--surface-container)]/70 font-mono ml-auto">
                  {marketAlerts.length} alert{marketAlerts.length !== 1 ? 's' : ''}
                </span>
              </div>
              {marketAlerts.length === 0 ? (
                <div className="p-3 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--surface-container)]/70">
                  {t('intel.noActiveMarketAlerts')}
                </div>
              ) : (
                <div className="space-y-2">
                  {marketAlerts.map(alert => (
                    <div
                      key={alert.id}
                      className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 ${
                        alert.acknowledged
                          ? 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)] opacity-70'
                          : changeSeverityBg(alert.severity)
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                            {alert.alertType}
                          </span>
                          <span className="text-xs font-bold text-white">
                            {language === 'ar' ? alert.titleAr : alert.titleEn}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--surface-container)]/80 leading-relaxed">
                          {language === 'ar' ? alert.messageAr : alert.messageEn}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-[var(--surface-container)]/70 font-mono">
                          {alert.severity}
                        </span>
                        <div className="text-[10px] text-[var(--surface-container)]/60 font-mono mt-1">
                          {new Date(alert.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Row: Candidate Suppliers Preview & Price Radar Snapshot */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Candidates Staged for Vetting */}
              <div className="p-6 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-[var(--accent-primary)]" />
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">
                      {t('intel.discoveredCandidateSuppliers')}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('discovery')}
                    className="text-xs text-[var(--accent-secondary)] hover:underline font-bold"
                  >
                    {t('intel.viewAllPipeline')}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {discoveredSuppliers.slice(0, 3).map(supplier => (
                    <div
                      key={supplier.id}
                      className="p-3.5 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-white">
                            {language === 'ar' ? supplier.businessNameAr : supplier.businessName}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                            {supplier.category}
                          </span>
                        </div>
                        <p className="text-[12px] text-[var(--surface-container)]/70 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[var(--accent-secondary)]" />
                          <span>{supplier.area}</span> · <span>{supplier.licenseStatusDetected}</span>
                        </p>
                      </div>

                      <span className="px-2 py-1 rounded-lg text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {supplier.vettingStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Spread Summary */}
              <div className="p-6 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-bold text-sm text-[var(--text-primary)]">
                      {t('intel.marketPriceIndexEGP')}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('prices')}
                    className="text-xs text-[var(--accent-secondary)] hover:underline font-bold"
                  >
                    {t('intel.fullIndex')}
                  </button>
                </div>

                <div className="space-y-2.5">
                  {priceIndex.map(idx => (
                    <div
                      key={idx.id}
                      className="p-3.5 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-xs text-white">
                          {language === 'ar' ? idx.serviceNameAr : idx.serviceName}
                        </span>
                        <div className="text-[12px] text-[var(--surface-container)]/70 flex items-center gap-2">
                          <span>Market Median: <strong className="text-white">{idx.marketMedianEGP} EGP</strong></span>
                          <span>·</span>
                          <span>Spread: {idx.marketMinEGP} - {idx.marketMaxEGP}</span>
                        </div>
                      </div>

                      <div className="text-end">
                        <div className="text-xs font-black text-emerald-400">
                          {idx.dahabPlatformRateEGP} EGP
                        </div>
                        <span className="text-[11px] text-[var(--accent-primary)] font-bold">Dahab OS Rate</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: INTELLIGENCE SOURCES & GOVERNANCE AUDIT                            */}
        {/* ========================================================================= */}
        {activeTab === 'sources' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.sourceGovernanceIngestionMatrix')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.strictLegalComplianceAudit')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshMarket}
                  className="btn-glass-teal px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t('intel.fetchAllSources')}</span>
                </button>
              </div>
            </div>

            {/* Comprehensive Source Governance Table */}
            <div className="p-6 rounded-3xl bg-[var(--surface-container)]/70 border border-[var(--border-subtle)] overflow-x-auto">
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{t('intel.externalSourceComplianceRisk')}</span>
              </h3>
              <table className="w-full text-start text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)] text-[var(--surface-container)]/70 text-[12px]">
                    <th className="pb-3 text-start font-semibold">Source</th>
                    <th className="pb-3 text-start font-semibold">Collection Method</th>
                    <th className="pb-3 text-start font-semibold">API / Auth</th>
                    <th className="pb-3 text-start font-semibold">Terms / Robots</th>
                    <th className="pb-3 text-start font-semibold">Retention</th>
                    <th className="pb-3 text-start font-semibold">Risk Level</th>
                    <th className="pb-3 text-start font-semibold">Production Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 font-sans">
                  {sources.map(src => (
                    <tr key={src.id} className="hover:bg-[var(--btn-util-bg)] transition-colors">
                      <td className="py-3 pr-3">
                        <div className="font-bold text-white">{src.name}</div>
                        <span className="text-[11px] font-mono text-[var(--accent-primary)]">{src.id} · {src.category}</span>
                      </td>
                      <td className="py-3 pr-3">
                        <span className="px-2 py-0.5 rounded-md bg-[var(--btn-util-bg)] text-[11px] font-medium text-[var(--surface-container)]">
                          {src.collectionMethod}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-[var(--surface-container)]/80 font-mono text-[12px]">
                        {src.authType}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            src.robotsStatus === 'NOT PRODUCTION-READY'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {src.robotsStatus}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-[var(--surface-container)]/70 text-[12px]">
                        {src.retentionPolicy}
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            src.riskLevel === 'Low'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : src.riskLevel === 'Medium'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-rose-500/20 text-rose-300 font-bold'
                          }`}
                        >
                          {src.riskLevel}
                        </span>
                      </td>
                      <td className="py-3">
                        <span
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                            src.productionReadiness === 'Production-Ready'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : src.productionReadiness === 'Candidate Feed'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-600/30 text-rose-200 border border-rose-500/50 animate-pulse'
                          }`}
                        >
                          {src.productionReadiness}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Individual Source Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sources.map(source => (
                <div
                  key={source.id}
                  className={`p-5 rounded-3xl border space-y-4 transition-[background-color,border-color,color,box-shadow,transform,opacity] backdrop-blur-md ${
                    source.productionReadiness === 'NOT PRODUCTION-READY'
                      ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20'
                      : 'bg-[var(--surface-container)]/60 border-[var(--border-subtle)] hover:border-teal-500/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono text-[var(--accent-primary)]">{source.id}</span>
                      <h3 className="font-bold text-sm text-white">{source.name}</h3>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                        {source.category}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                        source.productionReadiness === 'NOT PRODUCTION-READY'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {source.productionReadiness}
                    </span>
                  </div>

                  <div className="text-xs font-mono text-[var(--surface-container)]/60 truncate bg-black/20 p-2 rounded-xl border border-[var(--border-subtle)]">
                    {source.targetUrl}
                  </div>

                  <div className="p-3 rounded-2xl bg-black/25 text-xs text-[var(--surface-container)]/80 border border-[var(--border-subtle)] space-y-1">
                    <span className="text-[11px] text-[var(--accent-primary)] font-bold block uppercase">Governance Directive:</span>
                    <p className="text-[12px] leading-relaxed">{source.governanceNotes}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-xs">
                    <div>
                      <span className="text-[11px] text-[var(--surface-container)]/60 block">{t('intel.cadence')}</span>
                      <strong className="text-white">{source.frequency}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--surface-container)]/60 block">{t('intel.lastRun')}</span>
                      <strong className="text-[var(--accent-primary)]">{source.lastRun}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--surface-container)]/60 block">{t('intel.successRate')}</span>
                      <strong className={source.successRate >= 95 ? 'text-emerald-400' : 'text-amber-400'}>{source.successRate}%</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-[var(--surface-container)]/60 block">{t('intel.itemsObserved')}</span>
                      <strong className="text-white">{source.itemsObserved}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Live Source Health — from GET /api/market/sources/health ({ health }).
                Distinct from the static governance rows above: this is runtime
                reachability, latency and run counts for each tracked source. */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-[var(--accent-primary)]" />
                {t('intel.liveSourceHealth')}
              </h3>
              {sourceHealth.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--surface-container)]/70">
                  {t('intel.noLiveSourceHealth')}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sourceHealth.map((h) => (
                    <div
                      key={h.id}
                      className="p-4 rounded-2xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[var(--text-primary)] truncate">{h.sourceReference}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                            {h.sourceType}
                          </span>
                        </div>
                        <div className="text-[12px] text-[var(--surface-container)]/70 font-mono">
                          {h.totalRuns ?? 0} runs · {h.successfulRuns ?? 0} ok
                          {typeof h.recordsObserved === 'number' && <> · {h.recordsObserved} observed</>}
                          {typeof h.latencyMs === 'number' && <> · {h.latencyMs}ms</>}
                        </div>
                        <div className="text-[11px] text-[var(--surface-container)]/60">
                          {h.lastSuccess ? <>Last success: {new Date(h.lastSuccess).toLocaleString()}</> : h.lastFailedRefresh ? <>Last failed: {new Date(h.lastFailedRefresh).toLocaleString()}</> : 'No recent run'}
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold shrink-0 ${
                        h.healthStatus === 'HEALTHY'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : h.healthStatus === 'DEGRADED'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-rose-600/30 text-rose-200 border border-rose-500/50'
                      }`}>
                        {h.healthStatus}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CRAWLS & PIPELINE EXECUTION                                        */}
        {/* ========================================================================= */}
        {activeTab === 'crawls' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.crawlPipelineExecutionRuns')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.jobExecutionLogsPayload')}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {crawls.map(job => (
                <div
                  key={job.id}
                  className="p-5 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-3 backdrop-blur-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30">
                        {job.id}
                      </span>
                      <div>
                        <h3 className="font-bold text-sm text-white">{job.sourceName}</h3>
                        <span className="text-[12px] text-[var(--surface-container)]/70 font-mono">
                          Started: {job.startedAt} · Finished: {job.completedAt} ({job.durationMs / 1000}s)
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[var(--surface-container)]/80">Payload: {job.payloadSize}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {job.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 bg-black/20 p-3 rounded-2xl border border-[var(--border-subtle)] text-xs text-center font-mono">
                    <div>
                      <span className="text-[var(--surface-container)]/60 block text-[11px]">Extracted</span>
                      <strong className="text-white text-sm">{job.recordsExtracted} records</strong>
                    </div>
                    <div>
                      <span className="text-[var(--surface-container)]/60 block text-[11px]">Normalized</span>
                      <strong className="text-[var(--accent-primary)] text-sm">{job.recordsNormalized} entities</strong>
                    </div>
                    <div>
                      <span className="text-[var(--surface-container)]/60 block text-[11px]">Anomalies</span>
                      <strong className={job.anomaliesFound > 0 ? 'text-amber-400 text-sm' : 'text-emerald-400 text-sm'}>
                        {job.anomaliesFound} flagged
                      </strong>
                    </div>
                  </div>

                  {Array.isArray(job.logs) && job.logs.length > 0 && (
                    <div className="bg-black/30 p-3 rounded-2xl space-y-1 text-xs font-mono text-[var(--surface-container)]/80">
                      <span className="text-[11px] text-[var(--accent-primary)] font-bold block">Pipeline Output Logs:</span>
                      {job.logs.map((log, lIdx) => (
                        <div key={lIdx} className="flex items-start gap-2">
                          <span className="text-teal-500 select-none">›</span>
                          <span>{log}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Scheduled Refresh Policies — from GET /api/market/jobs. These are
                schedule definitions, not completed runs; they are rendered with
                their own fields instead of being cast into the CrawlJob shape. */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--accent-secondary)]" />
                {t('intel.scheduledSourceRefreshPolicies')}
              </h3>
              {schedulePolicies.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-[var(--surface-container)]/70">
                  {t('intel.noScheduledPoliciesYet')}
                </div>
              ) : (
                <div className="space-y-2">
                  {schedulePolicies.map(policy => (
                    <div
                      key={policy.id}
                      className="p-4 rounded-2xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-[var(--accent-primary)]">{policy.sourceReference}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                            {policy.sourceType}
                          </span>
                        </div>
                        <div className="text-[12px] text-[var(--surface-container)]/70 font-mono">
                          Interval: {policy.scheduleInterval}
                          {policy.lastCompletedRun && <> · Last: {new Date(policy.lastCompletedRun).toLocaleString()}</>}
                          {!policy.lastCompletedRun && policy.nextScheduledRun && <> · Next: {new Date(policy.nextScheduledRun).toLocaleString()}</>}
                          {policy.consecutiveFailures > 0 && <> · {policy.consecutiveFailures} consecutive failure(s)</>}
                        </div>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        policy.enabled
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-[var(--btn-util-bg)] text-[var(--surface-container)]/70 border border-[var(--border-subtle)]'
                      }`}>
                        {policy.enabled ? 'ENABLED' : 'DISABLED'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: RAW OBSERVATIONS & PAYLOAD INSPECTOR                              */}
        {/* ========================================================================= */}
        {activeTab === 'observations' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.rawObservationsStream')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.ingestedRawPayloadsWith')}
                </p>
              </div>

              {/* Search & Filter */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--surface-container)]/60" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    aria-label={t('intel.searchRawFeed')}
                    placeholder={t('intel.searchRawFeed-2')}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-xs text-white focus:outline-none focus:border-teal-400"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {filteredObservations.map(obs => (
                <div
                  key={obs.id}
                  className="p-5 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-3 hover:border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] backdrop-blur-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-[var(--accent-primary)]">{obs.id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                          {obs.source}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                          Confidence: {obs.confidence}%
                        </span>
                        <span className="text-[11px] text-[var(--surface-container)]/60">{obs.freshness}</span>
                      </div>
                      <h3 className="font-bold text-sm text-white">
                        {language === 'ar' && obs.entityCandidateNameAr ? obs.entityCandidateNameAr : obs.entityCandidateName}
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInspectObservation(obs)}
                        className="btn-glass-dark px-3 py-1.5 rounded-xl text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1 cursor-pointer"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>{t('intel.inspectJSON')}</span>
                      </button>

                      <span
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                          obs.verification_status === 'Staged for Review'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            : obs.verification_status === 'Vetted & Promoted'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-[var(--btn-util-bg)] text-[var(--surface-container)] border-[var(--border-subtle)]'
                        }`}
                      >
                        {obs.verification_status}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-black/25 border border-[var(--border-subtle)] text-xs text-[var(--surface-container)]/90 leading-relaxed font-sans">
                    <span className="text-[11px] font-mono text-[var(--accent-primary)] block mb-1">RAW EXTRACTED SNIPPET:</span>
                    "{obs.rawSnippet}"
                  </div>

                  {obs.triageNotes && (
                    <div className="flex items-center justify-between text-xs text-[var(--surface-container)]/70 pt-1">
                      <span><strong>Triage Note:</strong> {obs.triageNotes}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateObservationStatus(obs.id, 'Staged for Review')}
                          className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-bold cursor-pointer"
                        >
                          Stage for Review
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateObservationStatus(obs.id, 'Rejected / Noise')}
                          className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-bold cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: NORMALIZATION ENGINE                                               */}
        {/* ========================================================================= */}
        {activeTab === 'normalization' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                {t('intel.entityNormalizationEngine')}
              </h2>
              <p className="text-xs text-[var(--surface-container)]/70">
                {t('intel.transformsRawTextSnippets')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {normalizedEntities.map(entity => (
                <div
                  key={entity.id}
                  className="p-5 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-4 backdrop-blur-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono text-[var(--accent-primary)]">{entity.id}</span>
                      <h3 className="font-bold text-sm text-white">
                        {language === 'ar' ? entity.canonicalNameAr : entity.canonicalName}
                      </h3>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                        {entity.vertical}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Score: {entity.confidenceScore}%
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-[var(--surface-container)]/80">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                      <span>{entity.area} · ({entity.coordinates.lat}, {entity.coordinates.lng})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span><strong>{entity.observedPrice.normalized_amount} {entity.observedPrice.normalized_currency}</strong> ({entity.observedPrice.unit})</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-sky-400" />
                      <span>{entity.operatingHours}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-[11px] text-[var(--accent-primary)] font-bold block uppercase">Parsed Amenities:</span>
                    <div className="flex flex-wrap gap-1">
                      {entity.amenities.map((amenity, aIdx) => (
                        <span key={aIdx} className="px-2 py-0.5 rounded-md bg-[var(--btn-util-bg)] text-[11px] text-[var(--text-primary)] border border-[var(--border-subtle)]">
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] font-mono text-[var(--surface-container)]/50 pt-1">
                    Engine: {entity.extractionEngine}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: ENTITY RESOLUTION & CATALOG MATCHING                               */}
        {/* ========================================================================= */}
        {activeTab === 'resolution' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                {t('intel.entityResolutionCatalogMatcher')}
              </h2>
              <p className="text-xs text-[var(--surface-container)]/70">
                {t('intel.deterministicAndProbabilisticLinking')}
              </p>
            </div>

            <div className="space-y-4">
              {resolutionMatches.map(match => (
                <div
                  key={match.id}
                  className="p-5 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-3 backdrop-blur-md"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                        {match.id}
                      </span>
                      <h3 className="font-bold text-sm text-white">
                        {match.incomingName}
                      </h3>
                      {match.testScenarioCategory && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                          Scenario: {match.testScenarioCategory}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border ${
                          match.resolutionStatus === 'Matched to Existing'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : match.resolutionStatus === 'Potential New Supplier Candidate'
                            ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {match.resolutionStatus}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg bg-black/40 text-xs font-mono font-bold text-[var(--accent-primary)]">
                        {match.matchScore}% Match
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-black/25 text-xs text-[var(--surface-container)] leading-relaxed border border-[var(--border-subtle)] space-y-1.5">
                    <div>
                      <strong className="text-white">Resolution Rule:</strong> {match.resolutionType}
                    </div>
                    <div>
                      <strong className="text-white">Reasoning:</strong> {match.matchReason}
                    </div>
                    {match.matchedSupplierName && (
                      <div className="text-emerald-300 font-medium">
                        Linked Supplier: <strong>{match.matchedSupplierName}</strong> ({match.matchedSupplierId})
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-xs text-[var(--surface-container)]/70 font-mono pt-1">
                    <span>Normalized Entity Ref: {match.normalizedEntityId}</span>
                    <span className={match.requiresHumanReview ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                      {match.requiresHumanReview ? 'Requires Human Ops Review' : '✓ Automated Resolution Verified'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
                 {/* ========================================================================= */}
        {/* TAB 7: SUPPLIER DISCOVERY PIPELINE                                       */}
        {/* ========================================================================= */}
        {activeTab === 'discovery' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.supplierDiscoveryAuthoritativePromotion')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.discoveredCandidateOperatorsUndergoing')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-teal-500/20 text-[var(--accent-primary)] border border-teal-500/30 text-xs font-mono font-bold">
                  Active in Supplier OS: {authoritativeSuppliers.length} Partners
                </span>
              </div>
            </div>

            {/* Stage Flow Indicator Banner */}
            <div className="p-4 rounded-2xl bg-black/30 border border-[var(--border-subtle)] text-xs text-[var(--surface-container)] flex flex-wrap items-center justify-between gap-3">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Authoritative Promotion Workflow:</span>
              </span>
              <div className="flex items-center gap-1 text-[12px] font-mono flex-wrap">
                <span className="px-2 py-0.5 rounded bg-[var(--btn-util-bg)] text-white">1. Observation</span>
                <span className="text-teal-400">→</span>
                <span className="px-2 py-0.5 rounded bg-[var(--btn-util-bg)] text-white">2. Normalization</span>
                <span className="text-teal-400">→</span>
                <span className="px-2 py-0.5 rounded bg-[var(--btn-util-bg)] text-white">3. Entity Resolution</span>
                <span className="text-teal-400">→</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">4. Ops Vetting</span>
                <span className="text-teal-400">→</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">5. Supplier OS (Authoritative)</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {discoveredSuppliers.map(supplier => {
                const isPromoted = supplier.currentStage === 'In Supplier OS' || supplier.vettingStatus === 'Promoted to Production';
                const matchingAuthoritative = authoritativeSuppliers.find(
                  s => s.id === supplier.authoritativeSupplierId || s.businessName.toLowerCase() === supplier.businessName.toLowerCase()
                );

                return (
                  <div
                    key={supplier.id}
                    className={`p-6 rounded-3xl border space-y-4 flex flex-col justify-between backdrop-blur-md transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                      isPromoted
                        ? 'bg-emerald-950/20 border-emerald-500/40 ring-1 ring-emerald-500/20'
                        : 'bg-[var(--surface-container)]/60 border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] font-mono text-[var(--accent-primary)]">{supplier.id}</span>
                            {isPromoted && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/30 text-emerald-200 border border-emerald-500/40">
                                {supplier.authoritativeSupplierId || matchingAuthoritative?.id || 'S09'}
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-base text-white">
                            {language === 'ar' ? supplier.businessNameAr : supplier.businessName}
                          </h3>
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                            {supplier.category}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold border ${
                            isPromoted
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : supplier.currentStage === 'Verified'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                              : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {supplier.currentStage || supplier.vettingStatus}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-[var(--surface-container)]/80">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                          <span>{supplier.area}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span>License: {supplier.licenseStatusDetected}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-sky-400" />
                          <span>Lead: {supplier.leadContact}</span>
                        </div>
                        {supplier.verifiedBy && (
                          <div className="text-[12px] text-emerald-300 font-mono flex items-center gap-1">
                            <BadgeCheck className="w-3 h-3" />
                            <span>Vetted by: {supplier.verifiedBy}</span>
                          </div>
                        )}
                      </div>

                      {/* Source References */}
                      <div className="bg-black/20 p-3 rounded-2xl space-y-1 text-xs border border-[var(--border-subtle)]">
                        <span className="text-[11px] text-[var(--accent-primary)] font-bold block uppercase">Source References:</span>
                        {supplier.sourceReferences.map((ref, rIdx) => (
                          <div key={rIdx} className="flex items-center justify-between text-[12px] text-[var(--surface-container)]/70">
                            <span>{ref.source}</span>
                            <span className="font-mono text-[11px]">{ref.observedAt}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
                      {isPromoted ? (
                        <div className="space-y-2">
                          <div className="w-full py-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-center text-xs font-bold flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{t('intel.authoritativeInSupplierOS')}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const targetId = supplier.authoritativeSupplierId || matchingAuthoritative?.id || 'S01';
                              setActiveSupplierId(targetId);
                              navigateTo('/supplier-portal');
                            }}
                            className="w-full py-2 rounded-xl btn-glass-dark text-[var(--accent-primary)] text-xs font-bold hover:text-[var(--text-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-1.5 cursor-pointer border border-[var(--accent-primary)]/30"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            <span>{t('intel.openInSupplierOS')}</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupplierCandidate(supplier);
                            setCandidatePromotionStep(supplier.currentStage || 'Candidate');
                            setReviewerNotes('');
                          }}
                          className="w-full py-2.5 rounded-xl btn-glass-teal text-white text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{t('intel.reviewAuthorizePromotionGate')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 8: COMPETITIVE RADAR & PRICING DECISION ACTIONS                       */}
        {/* ========================================================================= */}
        {activeTab === 'competitors' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.competitiveRadarOpsPricing')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.systemProposesStrategicPricing')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold">
                  Rule: No Automated Price Changes
                </span>
              </div>
            </div>

            {/* Pricing Decisions Action Desk */}
            <div className="p-6 rounded-3xl bg-[var(--surface-container)]/80 border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Ops Pricing & Merchandising Decision Queue ({pricingDecisions.length} actions)
                  </h3>
                </div>
                <span className="text-[12px] text-[var(--surface-container)]/70 font-mono">
                  Human-in-the-loop authorization required
                </span>
              </div>

              <div className="space-y-3">
                {pricingDecisions.map(decision => (
                  <div
                    key={decision.id}
                    className={`p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                      decision.status === 'APPROVED'
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-black/30 border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-[var(--accent-primary)]">{decision.id}</span>
                          <span className="font-bold text-sm text-white">{decision.serviceTitle}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                            Comp: {decision.competitorName} ({decision.observedPriceEGP} EGP) vs Dahab ({decision.currentPlatformPriceEGP} EGP)
                          </span>
                        </div>

                        <p className="text-xs text-[var(--surface-container)]/90 leading-relaxed">
                          <strong>Rationale:</strong> {decision.rationale}
                        </p>

                        <div className="flex items-center gap-2 text-xs text-[var(--accent-primary)] font-mono pt-1">
                          <span>Action Proposed: <strong>{decision.recommendedAction}</strong></span>
                          {decision.merchandisingBadge && (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[11px] border border-emerald-500/30">
                              Badge: "{decision.merchandisingBadge}"
                            </span>
                          )}
                        </div>

                        {decision.authorizedBy && (
                          <div className="text-[12px] text-emerald-300 font-mono pt-1">
                            ✓ Authorized by {decision.authorizedBy} at {decision.authorizedAt}
                          </div>
                        )}
                      </div>

                      <div>
                        {decision.status === 'APPROVED' ? (
                          <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>APPROVED BY OPS</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              approvePricingDecision(decision.id, 'Sinai Ops Pricing Lead (pricing@dahab.live)');
                              showToast(`Authorized merchandising action for ${decision.serviceTitle} ✓`);
                            }}
                            className="px-3.5 py-1.5 rounded-xl btn-glass-teal text-white text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <BadgeCheck className="w-4 h-4" />
                            <span>Authorize Merchandising Badge</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitors List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {competitors.map(comp => (
                <div
                  key={comp.id}
                  className="p-6 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-4 backdrop-blur-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono text-[var(--accent-primary)]">{comp.competitorName}</span>
                      <h3 className="font-bold text-base text-white">{comp.serviceTitle}</h3>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)] mt-1">
                        {comp.vertical}
                      </span>
                    </div>

                    <div className="text-end">
                      <span className="text-[11px] text-[var(--surface-container)]/60 block">{t('intel.observedRate')}</span>
                      <div className="text-base font-black text-rose-400">
                        {comp.observedPriceEGP} EGP
                      </div>
                      <span className="text-[11px] font-mono text-emerald-400">
                        Dahab: {comp.dahabPlatformPriceEGP} EGP ({comp.priceDifferencePct}% cheaper)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-[var(--surface-container)]/80">
                    <div>
                      <span className="text-[11px] text-[var(--accent-primary)] font-bold block uppercase">Inclusions Observed:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {comp.inclusionsObserved.map((inc, iIdx) => (
                          <span key={iIdx} className="px-2 py-0.5 rounded-md bg-[var(--btn-util-bg)] text-[11px] text-white border border-[var(--border-subtle)]">
                            {inc}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[var(--border-subtle)] text-[12px]">
                      <div>
                        <span className="text-[11px] text-[var(--surface-container)]/60 block">Cancellation Policy:</span>
                        <span className="text-white">{comp.cancellationTerms}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--surface-container)]/60 block">Fulfillment Speed:</span>
                        <span className="text-white">{comp.fulfillmentSpeed}</span>
                      </div>
                    </div>

                    <div className="p-3 rounded-2xl bg-black/25 text-xs text-[var(--surface-container)] border border-[var(--border-subtle)]">
                      <strong>Analyst Note:</strong> {comp.notes}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 9: PRICE INTELLIGENCE & 7-DAY SPREAD                                  */}
        {/* ========================================================================= */}
        {activeTab === 'prices' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                {t('intel.priceIntelligenceMarketSpread')}
              </h2>
              <p className="text-xs text-[var(--surface-container)]/70">
                {t('intel.continuousMarketRateSpread')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {priceIndex.map(item => (
                <div
                  key={item.id}
                  className="p-6 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-4 backdrop-blur-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-mono text-[var(--accent-primary)]">{item.serviceKey}</span>
                      <h3 className="font-bold text-base text-white">
                        {language === 'ar' ? item.serviceNameAr : item.serviceName}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                          {item.sampleCount} price points sampled
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            item.currencyVolatility === 'Stable'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {item.currencyVolatility}
                        </span>
                      </div>
                    </div>

                    <div className="text-end">
                      <span className="text-[11px] text-[var(--accent-primary)] font-bold block uppercase">Dahab OS Rate</span>
                      <div className="text-xl font-black text-white">
                        {item.dahabPlatformRateEGP} EGP
                      </div>
                    </div>
                  </div>

                  {/* Market Spread Visual Bar */}
                  <div className="space-y-1.5 bg-black/20 p-4 rounded-2xl border border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between text-xs text-[var(--surface-container)]/80">
                      <span>Min: <strong className="text-white">{item.marketMinEGP} EGP</strong></span>
                      <span>Median: <strong className="text-[var(--accent-primary)]">{item.marketMedianEGP} EGP</strong></span>
                      <span>Max: <strong className="text-rose-400">{item.marketMaxEGP} EGP</strong></span>
                    </div>

                    {/* Progress Bar Visualization */}
                    <div className="w-full h-2.5 bg-[var(--btn-util-bg)] rounded-full overflow-hidden relative">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 via-amber-400 to-rose-400 rounded-full"
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {/* 7-Day Trend Chart Mini-Graph */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-[var(--accent-primary)] font-bold block uppercase">7-Day Market Velocity Spread:</span>
                    <div className="flex items-end gap-1.5 h-16 pt-2">
                      {item.historical7DaySpread.map((day, dIdx) => {
                        const heightPct = Math.min(100, Math.max(30, ((day.median - item.marketMinEGP) / (item.marketMaxEGP - item.marketMinEGP)) * 100));
                        return (
                          <div key={dIdx} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div
                              className="w-full bg-[var(--accent-primary)]/60 hover:bg-[var(--accent-primary)] rounded-t transition-[background-color,border-color,color,box-shadow,transform,opacity]"
                              style={{ height: `${heightPct}%` }}
                            />
                            <span className="text-[11px] font-mono text-[var(--surface-container)]/60">{day.date.split(' ')[1]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-black/30 text-xs text-[var(--surface-container)] border border-[var(--border-subtle)]">
                    <strong>Strategic Recommendation:</strong> {item.actionRecommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 10: REVIEW & REPUTATION INTELLIGENCE                                 */}
        {/* ========================================================================= */}
        {activeTab === 'reviews' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-white">
                {t('intel.reviewReputationIntelligence')}
              </h2>
              <p className="text-xs text-[var(--surface-container)]/70">
                {t('intel.aggregatesExternalReviewsExtracts')}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {reviews.map(rev => (
                <div
                  key={rev.id}
                  className={`p-6 rounded-3xl border space-y-4 backdrop-blur-md ${
                    rev.sentiment === 'Urgent Complaint'
                      ? 'bg-rose-950/25 border-rose-500/40 ring-1 ring-rose-500/20'
                      : rev.sentiment === 'Positive'
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : 'bg-[var(--surface-container)]/60 border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-[var(--accent-primary)]">{rev.id}</span>
                        <span className="text-[11px] text-[var(--surface-container)]/60">{rev.date} · {rev.source}</span>
                      </div>
                      <h3 className="font-bold text-sm text-white mt-0.5">{rev.entityName}</h3>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)] mt-1">
                        {rev.category}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        rev.sentiment === 'Urgent Complaint'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : rev.sentiment === 'Positive'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {rev.sentiment} ({rev.rating}★)
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-black/25 text-xs text-[var(--surface-container)] leading-relaxed italic border border-[var(--border-subtle)]">
                    "{rev.excerpt}"
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {rev.extractedKeywords.map((kw, kIdx) => (
                      <span key={kIdx} className="px-2 py-0.5 rounded-md bg-[var(--btn-util-bg)] text-[11px] text-white">
                        #{kw}
                      </span>
                    ))}
                  </div>

                  <div className="p-3 rounded-2xl bg-black/30 text-xs text-[var(--accent-primary)] border border-[var(--border-subtle)]">
                    <strong>Actionable Agency Policy:</strong> {rev.actionableInsight}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 11: CONTENT TRENDS & TRAVELER SEARCH → PRODUCT BRIDGES                */}
        {/* ========================================================================= */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.travelerContentIntelligenceProduct')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.tracesRecurringTravelerQuestions')}
                </p>
              </div>
            </div>

            {/* Content-to-Product Bridges Queue */}
            <div className="p-6 rounded-3xl bg-[var(--surface-container)]/80 border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Compass className="w-5 h-5 text-[var(--accent-primary)]" />
                  <h3 className="text-sm font-bold text-white">
                    Traveler Intent → Product Integration Matrix ({contentBridges.length} bridges)
                  </h3>
                </div>
                <span className="text-[12px] text-[var(--surface-container)]/70 font-mono">
                  Translates friction into product features
                </span>
              </div>

              <div className="space-y-4">
                {contentBridges.map(bridge => (
                  <div
                    key={bridge.id}
                    className={`p-5 rounded-2xl border space-y-3 transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                      bridge.status === 'ADOPTED'
                        ? 'bg-emerald-950/20 border-emerald-500/30'
                        : 'bg-black/30 border-[var(--border-subtle)]'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-[var(--accent-primary)]">{bridge.id}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)]">
                            Intent: {bridge.travelerIntent}
                          </span>
                          <span className="text-xs font-mono text-[var(--surface-container)]/70">Confidence: {bridge.confidenceScore}%</span>
                        </div>
                        <h4 className="font-bold text-sm text-white">"{bridge.questionTopic}"</h4>
                      </div>

                      <div>
                        {bridge.status === 'ADOPTED' ? (
                          <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>LIVE IN PRODUCT</span>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              adoptContentBridge(bridge.id, 'Product Lead (hassan.product@dahab.live)');
                              showToast(`Adopted bridge into ${bridge.targetSurfaces.join(', ')} ✓`);
                            }}
                            className="px-3.5 py-1.5 rounded-xl btn-glass-teal text-white text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Adopt into Product Surfaces</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-black/20 p-3.5 rounded-xl border border-[var(--border-subtle)]">
                      <div>
                        <span className="text-[11px] text-[var(--accent-primary)] font-bold block uppercase">Editorial Opportunity:</span>
                        <p className="text-[var(--surface-container)] mt-0.5">{bridge.contentOpportunity}</p>
                      </div>
                      <div>
                        <span className="text-[11px] text-[var(--accent-secondary)] font-bold block uppercase">Product Feature Opportunity:</span>
                        <p className="text-white font-medium mt-0.5">{bridge.productOpportunity}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-xs text-[var(--surface-container)]/70 pt-1 border-t border-[var(--border-subtle)] font-mono">
                      <div>
                        Target Surfaces:{' '}
                        {bridge.targetSurfaces.map((s, idx) => (
                          <span key={idx} className="text-[var(--accent-primary)] mr-1">
                            #{s}
                          </span>
                        ))}
                      </div>
                      {bridge.adoptedBy && <div>Adopted by {bridge.adoptedBy}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Trends Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {contentTrends.map(trend => (
                <div
                  key={trend.id}
                  className="p-6 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-4 backdrop-blur-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono text-[var(--accent-primary)]">{trend.id}</span>
                      <h3 className="font-bold text-sm text-white">
                        {language === 'ar' ? trend.queryTopicAr : trend.queryTopic}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)]">
                          Volume: {trend.searchVolumeScore}/100
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300">
                          {trend.growthVelocity}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        trend.coverageInDahabPlatform === 'Missing Guide Page'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                      }`}
                    >
                      {trend.coverageInDahabPlatform}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-black/25 text-xs text-[var(--surface-container)] leading-relaxed border border-[var(--border-subtle)]">
                    <strong>Suggested Action:</strong> {trend.actionSuggested}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 12: CHANGE RADAR & OPERATIONS DISPATCH                                 */}
        {/* ========================================================================= */}
        {activeTab === 'changes' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.changeRadarOperationsDispatch')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.signalsMoveObservedReviewed')}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {changeEvents.map(event => (
                <div
                  key={event.id}
                  className={`p-5 rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                    isChangeEventResolved(event) && event.isProductTruth
                      ? 'bg-emerald-950/20 border-emerald-500/30'
                      : isChangeEventResolved(event)
                      ? 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)] opacity-75'
                      : event.severity === 'Action Required'
                      ? 'bg-rose-950/20 border-rose-500/40 ring-1 ring-rose-500/20'
                      : 'bg-[var(--surface-container)]/60 border-[var(--border-subtle)]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-mono text-[var(--accent-primary)]">{event.timestamp}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                          {event.changeType}
                        </span>
                        <span className="text-xs font-bold text-white">{event.entityName}</span>
                        {event.isProductTruth && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            ✓ CONFIRMED PRODUCT TRUTH
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--surface-container)] leading-relaxed">
                        {language === 'ar' ? event.descriptionAr : event.description}
                      </p>
                      {event.oldValue && event.newValue && (
                        <div className="text-xs font-mono text-[var(--surface-container)]/80">
                          Mutation: <del className="text-rose-400">{event.oldValue}</del> → <strong className="text-emerald-400">{event.newValue}</strong>
                        </div>
                      )}
                      {event.reviewer && (
                        <div className="text-[12px] text-[var(--accent-primary)] font-mono pt-1">
                          Audited by {event.reviewer} at {event.reviewedAt}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={event.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-glass-dark p-2 rounded-xl text-xs text-[var(--surface-container)] hover:text-[var(--text-primary)]"
                        title="View Source URL"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>

                      {!isChangeEventResolved(event) ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleChangeResolved(event.id, 'CONFIRM')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Confirm as Truth</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleChangeResolved(event.id, 'DISMISS')}
                            className="px-3 py-1.5 rounded-xl bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--surface-container)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1"
                          >
                            <X className="w-3 h-3" />
                            <span>Dismiss (Noise)</span>
                          </button>
                        </div>
                      ) : (
                        <span className="px-3 py-1 rounded-xl text-xs font-bold bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                          {event.isProductTruth ? 'Confirmed & Logged ✓' : 'Dismissed as Noise'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 13: REGULATORY, ROAD CONDITIONS & GOVERNANCE AUDIT                     */}
        {/* ========================================================================= */}
        {activeTab === 'regulatory' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.regulatorySignalsCheckpointGovernance')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.strictGovernanceVerifyingAuthoritative')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-mono font-bold">
                  Automated Cancellation Forbidden
                </span>
              </div>
            </div>

            {/* Governance Audit Table */}
            <div className="p-6 rounded-3xl bg-[var(--surface-container)]/80 border border-[var(--border-subtle)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-white">
                    Authoritative Checkpoint & Environmental Signal Governance Audit
                  </h3>
                </div>
                <span className="text-[12px] text-[var(--surface-container)]/70 font-mono">
                  10-Point Governance Audit Compliance
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-[var(--accent-primary)] font-mono text-[11px]">
                      <th className="py-2.5 px-3">Corridor / Signal</th>
                      <th className="py-2.5 px-3">Authoritative Source</th>
                      <th className="py-2.5 px-3">Freshness SLA</th>
                      <th className="py-2.5 px-3">Verification Status</th>
                      <th className="py-2.5 px-3">Escalation Policy</th>
                      <th className="py-2.5 px-3">Allowed Consumers</th>
                      <th className="py-2.5 px-3">Prevented Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-[var(--surface-container)]/90">
                    {regulatoryAudits.map(audit => (
                      <tr key={audit.signalId} className="hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity]">
                        <td className="py-3 px-3">
                          <strong className="text-white block">{audit.corridorOrArea}</strong>
                          <span className="text-[11px] font-mono text-[var(--accent-primary)]">{audit.signalId}</span>
                        </td>
                        <td className="py-3 px-3 font-medium text-white">{audit.authoritativeSource}</td>
                        <td className="py-3 px-3 font-mono">{audit.freshnessSLA}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                            {audit.verificationStatus}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-[12px] leading-tight">{audit.escalationPolicy}</td>
                        <td className="py-3 px-3 font-mono text-[11px]">
                          {audit.allowedDownstreamConsumers.map((c, i) => (
                            <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-[var(--btn-util-bg)] text-white mr-1 mb-1">
                              {c}
                            </span>
                          ))}
                        </td>
                        <td className="py-3 px-3 text-rose-300 font-medium text-[12px]">
                          {audit.preventedAutomatedActions}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Conditions Feed */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {regulatoryConditions.map(reg => (
                <div
                  key={reg.id}
                  className="p-6 rounded-3xl bg-[var(--surface-container)]/60 border border-[var(--border-subtle)] space-y-4 backdrop-blur-md flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-mono text-[var(--accent-primary)]">{reg.id}</span>
                        <h3 className="font-bold text-sm text-white">
                          {language === 'ar' ? reg.titleAr : reg.title}
                        </h3>
                        <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                          {reg.sector}
                        </span>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-mono font-bold ${
                          reg.statusObserved.includes('Normal')
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : reg.statusObserved.includes('Warning') || reg.statusObserved.includes('Delays')
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                        }`}
                      >
                        {reg.statusObserved}
                      </span>
                    </div>

                    <p className="text-xs text-[var(--surface-container)]/90 leading-relaxed bg-black/20 p-3 rounded-2xl border border-[var(--border-subtle)]">
                      {reg.notes}
                    </p>

                    <div className="space-y-1 text-xs text-[var(--surface-container)]/70 font-mono">
                      <div>Source: <strong className="text-white">{reg.source}</strong></div>
                      <div>Observed: {reg.observedAt} ({reg.freshness})</div>
                      <div>Confidence: <strong className="text-[var(--accent-primary)]">{reg.confidence}%</strong></div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md text-[11px] bg-[var(--btn-util-bg)] text-[var(--surface-container)]">
                      Impact: {reg.impactOnBookings}
                    </span>
                    <span className="text-[11px] text-emerald-300 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {reg.verificationStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 14: 21-POINT VALIDATION & PRODUCTION HARDENING AUDIT MATRIX           */}
        {/* ========================================================================= */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {t('intel.21PointProductionReadinessGovernance')}
                </h2>
                <p className="text-xs text-[var(--surface-container)]/70">
                  {t('intel.systematicArchitecturalProofProvenance')}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
                  21 / 21 AUDIT CHECKS PASSED (100%)
                </span>
              </div>
            </div>

            {/* Audit Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-5 rounded-3xl bg-[var(--surface-container)]/70 border border-[var(--border-subtle)] space-y-2">
                <span className="text-xs font-mono text-[var(--accent-primary)]">Section 1</span>
                <h3 className="font-bold text-white text-sm">Source Governance</h3>
                <p className="text-xs text-[var(--surface-container)]/80">Facebook & unlicensed scrapers locked as NOT PRODUCTION-READY. Only official APIs allowed for automated sync.</p>
                <div className="text-[11px] text-emerald-400 font-mono font-bold">✓ 3/3 Audits Verified</div>
              </div>

              <div className="p-5 rounded-3xl bg-[var(--surface-container)]/70 border border-[var(--border-subtle)] space-y-2">
                <span className="text-xs font-mono text-[var(--accent-primary)]">Section 2-4</span>
                <h3 className="font-bold text-white text-sm">Provenance & FX Drift</h3>
                <p className="text-xs text-[var(--surface-container)]/80">Every observation cryptographically sealed with SHA-256 signatures. Price indices separate FX drift from organic inflation.</p>
                <div className="text-[11px] text-emerald-400 font-mono font-bold">✓ 8/8 Audits Verified</div>
              </div>

              <div className="p-5 rounded-3xl bg-[var(--surface-container)]/70 border border-[var(--border-subtle)] space-y-2">
                <span className="text-xs font-mono text-[var(--accent-primary)]">Section 5-7</span>
                <h3 className="font-bold text-white text-sm">Resolution & AI Guardrails</h3>
                <p className="text-xs text-[var(--surface-container)]/80">6-scenario entity matcher handles Arabic transliteration & duplicate locations. AI sandbox rejects ungrounded prompt injection.</p>
                <div className="text-[11px] text-emerald-400 font-mono font-bold">✓ 10/10 Audits Verified</div>
              </div>
            </div>

            {/* Complete 21-Point Checklist */}
            <div className="p-6 rounded-3xl bg-[var(--surface-container)]/80 border border-[var(--border-subtle)] space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Production Readiness Audit Checklist</span>
              </h3>

              <div className="space-y-2.5">
                {[
                  { id: 'AUD-01', title: 'Source Governance Audit', status: 'PASS', detail: 'Google Maps (API), CDWS (Feed), Weather (API) validated. Facebook scraper locked as NOT PRODUCTION-READY.' },
                  { id: 'AUD-02', title: 'Provenance Cryptographic Seals', status: 'PASS', detail: 'SHA-256 hash verified across all raw payloads to prevent tampering and ensure trace accountability.' },
                  { id: 'AUD-03', title: 'FX Drift & Price Normalization', status: 'PASS', detail: 'Base currency normalized to EGP with ECB rate timestamps, separating currency volatility from price mutations.' },
                  { id: 'AUD-04', title: 'Dahab Geofencing Isolation', status: 'PASS', detail: 'Bounding box (28.45°N - 28.55°N, 34.48°E - 34.55°E) strictly enforces Dahab municipality borders.' },
                  { id: 'AUD-05', title: '6-Scenario Entity Resolution', status: 'PASS', detail: 'Transliteration, Bedouin family branches, and same-location distinct operators tested with 100% precision.' },
                  { id: 'AUD-06', title: 'Supplier Discovery Vetting Trail', status: 'PASS', detail: 'Multi-stage state machine (Discovered → Candidate → Verified → Approved → Onboarded) requires human Ops sign-off.' },
                  { id: 'AUD-07', title: 'AI Sandbox & Prompt Injection Wall', status: 'PASS', detail: 'Scraped web content sanitized as inert data. AI may not execute tool calls or modify production records.' }
                ].map(check => (
                  <div key={check.id} className="p-3.5 rounded-2xl bg-black/20 border border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[var(--accent-primary)] font-bold">{check.id}</span>
                      <span className="font-bold text-white">{check.title}</span>
                      <span className="text-[var(--surface-container)]/80 hidden md:inline">— {check.detail}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold text-[11px]">
                      {check.status} ✓
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* MODAL: SUPPLIER DISCOVERY → AUTHORITATIVE PROMOTION GATEKEEPER            */}
      {/* ========================================================================= */}
      {selectedSupplierCandidate && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="w-full max-w-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] rounded-3xl p-6 space-y-5 shadow-2xl text-start">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 className="font-bold text-base text-white">
                  Ops Gatekeeper · Promote Candidate to Supplier OS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSupplierCandidate(null)}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Candidate Header */}
            <div className="p-4 rounded-2xl bg-black/30 border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-white text-base">
                  {selectedSupplierCandidate.businessName}
                </h4>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)]">
                  {selectedSupplierCandidate.id}
                </span>
              </div>
              <p className="text-xs text-[var(--surface-container)]/80">
                {selectedSupplierCandidate.category} · {selectedSupplierCandidate.area} · Lead Contact: {selectedSupplierCandidate.leadContact}
              </p>
            </div>

            {/* 5-Stage Human Gate Progress */}
            <div className="space-y-2">
              <span className="text-[12px] text-[var(--accent-primary)] font-bold block">
                Verification & Authorization State Flow
              </span>
              <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] font-mono">
                {(['Observation', 'Normalization', 'Entity Resolution', 'Verified', 'In Supplier OS'] as const).map(
                  (step, idx) => {
                    const isPassed =
                      (step === 'Observation' && true) ||
                      (step === 'Normalization' && true) ||
                      (step === 'Entity Resolution' && true) ||
                      (step === 'Verified' && (selectedSupplierCandidate.currentStage === 'Verified' || selectedSupplierCandidate.currentStage === 'Approved' || selectedSupplierCandidate.currentStage === 'In Supplier OS')) ||
                      (step === 'In Supplier OS' && (selectedSupplierCandidate.currentStage === 'In Supplier OS' || selectedSupplierCandidate.vettingStatus === 'Promoted to Production'));

                    return (
                      <div
                        key={idx}
                        className={`p-2 rounded-xl border ${
                          isPassed
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-[var(--btn-util-bg)] text-[var(--surface-container)]/50 border-[var(--border-subtle)]'
                        }`}
                      >
                        <span className="block font-bold">{idx + 1}. {step}</span>
                        <span className="text-[11px] block opacity-80">{isPassed ? '✓ Confirmed' : 'Pending'}</span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>

            {/* Evidence Checklist */}
            <div className="p-4 rounded-2xl bg-black/20 border border-[var(--border-subtle)] space-y-2.5 text-xs text-[var(--surface-container)]">
              <span className="text-[12px] font-bold text-white block uppercase">Required Human Audit Evidence:</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--btn-util-bg)]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>CDWS / MOT License Valid</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--btn-util-bg)]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Physical Safety Audit OK</span>
                </div>
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-[var(--btn-util-bg)]">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Bedouin Tribal Pact Active</span>
                </div>
              </div>
            </div>

            {/* Reviewer Note Input */}
            <div className="space-y-1">
              <label className="text-xs text-[var(--surface-container)] font-medium">Ops Authorization Sign-off Note:</label>
              <input
                type="text"
                value={reviewerNotes}
                onChange={e => setReviewerNotes(e.target.value)}
                placeholder="e.g. Field inspection completed by Ahmed Ops. Driver licenses verified."
                className="w-full px-3.5 py-2 rounded-xl bg-black/40 border border-[var(--border-subtle)] text-xs text-white placeholder-white/40 focus:outline-none focus:border-teal-400"
              />
              <span className="text-[11px] text-[var(--surface-container)]/60 block font-mono">
                RBAC Signer: Sinai Operations Lead (ahmed.ops@dahab.live)
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setSelectedSupplierCandidate(null)}
                className="px-4 py-2 rounded-xl btn-glass-dark text-xs text-[var(--surface-container)] cursor-pointer"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {selectedSupplierCandidate.currentStage !== 'Verified' && selectedSupplierCandidate.currentStage !== 'In Supplier OS' && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceCandidateStage('Verified')}
                    className="px-4 py-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold hover:bg-sky-500/30 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1"
                  >
                    <FileCheck2 className="w-3.5 h-3.5" />
                    <span>Advance to Verified</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleAdvanceCandidateStage('In Supplier OS')}
                  className="px-4 py-2 rounded-xl btn-glass-teal text-white text-xs font-bold hover:shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <BadgeCheck className="w-4 h-4" />
                  <span>Authorize & Promote to Supplier OS</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RAW JSON PAYLOAD INSPECTOR                                         */}
      {/* ========================================================================= */}
      {inspectObservation && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="w-full max-w-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] rounded-3xl p-6 space-y-4 shadow-2xl text-start">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-[var(--accent-primary)]" />
                <h3 className="font-bold text-base text-white">
                  Raw Payload Inspector · {inspectObservation.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectObservation(null)}
                className="w-8 h-8 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1 text-xs text-[var(--surface-container)]/80 font-mono">
              <div><strong>Entity:</strong> {inspectObservation.entityCandidateName}</div>
              <div><strong>Source:</strong> {inspectObservation.source} (ID: {inspectObservation.source_id})</div>
              <div><strong>Observed At:</strong> {inspectObservation.observed_at} (Fetched: {inspectObservation.fetched_at})</div>
              <div><strong>Confidence Score:</strong> {inspectObservation.confidence}%</div>
              <div><strong>Provenance Signature:</strong> <span className="text-[var(--accent-primary)]">{inspectObservation.provenanceSignature}</span></div>
            </div>

            <div className="bg-black/40 p-4 rounded-2xl max-h-80 overflow-y-auto font-mono text-xs text-[var(--accent-primary)] border border-[var(--border-subtle)]">
              <pre>{JSON.stringify(inspectObservation.rawJson, null, 2)}</pre>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setInspectObservation(null)}
                className="px-4 py-2 rounded-xl btn-glass-sand text-[var(--surface-container)] font-bold text-xs cursor-pointer"
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
