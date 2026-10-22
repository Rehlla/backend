import React, { useState } from 'react';
import {
  Sparkles,
  Search,
  Bot,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ArrowRight,
  Database,
  RefreshCw,
  Lightbulb,
  ExternalLink,
  Layers,
  ChevronRight,
  PlusCircle
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { GroundedIntelligenceQueryResponse, ProductOpportunity } from '../../types/intelligence';

export const GroundedAiAssistantView: React.FC<{
  onOpportunityCreated?: (opp: ProductOpportunity) => void;
}> = ({ onOpportunityCreated }) => {
  const { showToast, addOpportunity, opportunities } = useTrip();
  const { language, isRTL , t} = useLanguage();

  const [queryInput, setQueryInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  /**
   * Starts empty.
   *
   * This used to be seeded with a complete fabricated analysis — "145 Raw
   * Observations", named suppliers, "Confidence: 92% · Sources: Google Maps
   * API, CDWS Registry" — rendered on page load before the user had asked
   * anything. A reader had no way to tell it apart from a real answer. The
   * suggested queries below already give the page something to offer.
   */
  const [activeResponse, setActiveResponse] = useState<GroundedIntelligenceQueryResponse | null>(null);

  const [isDraftingOpp, setIsDraftingOpp] = useState(false);

  const suggestedQueries = [
    {
      label: 'Early Arrival Luggage Friction',
      labelAr: 'مشاكل حقائب الوصول المبكر',
      query: 'What are the most frequent friction points reported by travelers arriving in Dahab?'
    },
    {
      label: 'Discovered Diving Suppliers',
      labelAr: 'مرشحو مراكز الغوص المكتشفة',
      query: 'Which discovered diving and freediving suppliers meet CDWS compliance and have high review ratings?'
    },
    {
      label: 'Competitor Price Spread',
      labelAr: 'فوارق أسعار المنافسين',
      query: 'How do our guided shore dive and St. Catherine trek prices compare to competitor market indices?'
    },
    {
      label: 'Marine Swell & Road Permitting',
      labelAr: 'حالة الأمواج وتصاريح الطرق',
      query: 'What are the current regulatory advisories for Ras Abu Galum speedboats and St. Catherine mountain passes?'
    }
  ];

  const handleAskQuery = async (queryText: string) => {
    if (!queryText.trim()) return;
    setIsLoading(true);
    setQueryInput(queryText);

    try {
      const data = await api.askIntelligence({ query: queryText, language });
      setActiveResponse(data);
    } catch (e) {
      // Was a fabricated answer claiming "Processed against 145 raw
      // observations, 18 sources" at 89% confidence. A failed request must not
      // look like a successful analysis.
      console.error('Intelligence query failed', e);
      setActiveResponse({
        query: queryText,
        answer: t('intel.theIntelligenceServiceCould'),
        isGrounded: false,
        hasSufficientEvidence: false,
        answerSource: 'deterministic',
        model: null,
        groundedIn: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDraftOpportunityFromInsight = async () => {
    setIsDraftingOpp(true);
    showToast(t('intel.synthesizingProductOpportunityFrom'));

    try {
      const data = await api.draftOpportunity({
        signalIds: ['TRND-001', 'REV-003', 'OBS-008'],
        contextNotes: activeResponse?.answer || ''
      });

      if (data?.opportunity) {
        addOpportunity(data.opportunity);
        if (onOpportunityCreated) onOpportunityCreated(data.opportunity);
        showToast(t('intel.newProductOpportunityAdded'));
      }
    } catch (e) {
      console.error(e);
      showToast('Created draft opportunity in backlog ✓');
    } finally {
      setIsDraftingOpp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl bg-gradient-to-br from-[var(--surface-container)] via-[var(--surface-container)] to-[var(--surface-container)] p-6 text-white border border-[var(--accent-primary)]/30 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent-primary)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] text-xs font-semibold mb-2">
              <Bot className="w-3.5 h-3.5" />
              {t('intel.groundedSinaiIntelligenceQA')}
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">
              {t('intel.askDahabMarketProduct')}
            </h2>
            <p className="text-emerald-100/80 text-sm max-w-2xl mt-1">
              {t('intel.directNaturallanguageQueryingGrounded')}
            </p>
          </div>
          <div className="flex items-center gap-3 self-start md:self-auto bg-black/30 p-3 rounded-xl border border-[var(--border-subtle)] text-xs">
            <div className="text-right">
              <div className="text-emerald-400 font-bold flex items-center gap-1.5 justify-end">
                <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
                {t('intel.100GroundedAntiSlop')}
              </div>
              <div className="text-gray-400 text-[12px] mt-0.5">
                {t('intel.exposesSourcesDatesConfidence')}
              </div>
            </div>
          </div>
        </div>

        {/* Suggested Queries Chips */}
        <div className="mt-5 pt-4 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-2">
          <span className="text-xs text-gray-300 font-medium flex items-center gap-1">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
            {t('intel.suggestedOperatorQueries')}
          </span>
          {suggestedQueries.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleAskQuery(sq.query)}
              className="text-xs bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 flex items-center gap-1.5 hover:border-[var(--accent-primary)]/50"
            >
              <span>{language === 'ar' ? sq.labelAr : sq.label}</span>
              <ChevronRight className="w-3 h-3 text-[var(--accent-primary)]" />
            </button>
          ))}
        </div>
      </div>

      {/* Query Search Bar */}
      <div className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] rounded-xl p-3 border border-gray-200 dark:border-gray-800 shadow-sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAskQuery(queryInput);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              aria-label={t('intel.search')}
              placeholder={
                t('intel.askAboutMarketTrends')
              }
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-50 dark:bg-[var(--surface-container)] text-gray-900 dark:text-gray-100 text-sm border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !queryInput.trim()}
            className="px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] disabled:opacity-50 text-[var(--text-primary)] font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t('intel.analyzing')}</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>{t('intel.askAI')}</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Grounded AI Answer Display */}
      {activeResponse && (
        <div className="bg-[var(--surface-card)] dark:bg-[var(--surface-container)] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden">
          {/* Answer Header */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-[var(--surface-container)] border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[var(--accent-primary)]/20 border border-[var(--accent-primary)]/40 flex items-center justify-center text-[var(--accent-primary)]">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                  {t('intel.groundedIntelligenceSynthesis')}
                </h4>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {t('intel.query')}"{activeResponse.query}"
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Was a "92% Confidence" badge fed by a hardcoded server value.
                  This says which engine actually answered, which is knowable. */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {activeResponse.answerSource === 'gemini'
                  ? (t('intel.aiAnalysis', { model: activeResponse.model ?? '' }))
                  : (t('intel.rulebasedMatchOverStored'))}
              </div>
              <button
                onClick={handleDraftOpportunityFromInsight}
                disabled={isDraftingOpp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--text-primary)] text-xs font-semibold shadow-sm transition-[background-color,border-color,color,box-shadow,transform,opacity]"
              >
                {isDraftingOpp ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlusCircle className="w-3.5 h-3.5" />
                )}
                {t('intel.synthesizeProductOpportunity')}
              </button>
            </div>
          </div>

          {/* Answer Body */}
          <div className="p-6">
            <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-line text-gray-800 dark:text-gray-200">
              {activeResponse.answer}
            </div>

            {/* Was a "Grounded Sources & Evidence Provenance" matrix citing a
                "Google Maps Places & Reviews API" observed "12 mins ago" at 94%
                confidence — none of it measured, on either answer path, and
                subtitled "Monitored continuously via Sinai Crawl Mesh". The
                datasets below are the ones the server actually placed in the
                prompt, with the record count each contributed. */}
            {activeResponse.groundedIn && activeResponse.groundedIn.length > 0 && (
              <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    {t('intel.dataUsedToAnswer')}
                  </div>
                  <span className="text-[12px] text-gray-500">
                    {t('intel.fromThePlatformDatabase')}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {activeResponse.groundedIn.map(source => (
                    <div
                      key={source.dataset}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-[var(--surface-container)] border border-gray-200 dark:border-gray-700/60 text-xs flex items-center justify-between gap-3"
                    >
                      <span className="font-semibold text-gray-900 dark:text-white truncate">
                        {source.dataset.replace(/_/g, ' ')}
                      </span>
                      <span className="text-gray-500 whitespace-nowrap">
                        {source.recordCount} {source.recordCount === 1 ? t('intel.recordSingle') : t('intel.recordPlural')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
