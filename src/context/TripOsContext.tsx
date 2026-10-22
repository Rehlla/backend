import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  TripBrief,
  TripFitResult,
  TradeOffOption,
  DayIntelligence,
  TripHealthSummary,
  TripReadinessSummary,
  BudgetBreakdown,
  PlanVariant,
  ImprovementActionType
} from '../types/tripOs';
import {
  INITIAL_TRIP_BRIEF,
  INITIAL_TRIP_FIT,
  INITIAL_TRADE_OFF_OPTIONS,
  INITIAL_DAY_INTELLIGENCE,
  INITIAL_TRIP_READINESS,
  INITIAL_BUDGET_BREAKDOWN,
  PLAN_VARIANTS,
  computeImprovementPreview
} from '../data/tripOsDefaults';
import { useUI } from './UIContext';
import { useCommerce } from './CommerceContext';
import { api } from '../services/api';
import { UNVERIFIED_TRIP_HEALTH, toTripHealthSummary } from '../services/tripHealthMapper';

export interface TripOsContextType {
  tripBrief: TripBrief;
  setTripBrief: React.Dispatch<React.SetStateAction<TripBrief>>;
  updateTripBrief: (updates: Partial<TripBrief>) => void;
  tripFit: TripFitResult;
  setTripFit: React.Dispatch<React.SetStateAction<TripFitResult>>;
  tradeOffOptions: TradeOffOption[];
  setTradeOffOptions: React.Dispatch<React.SetStateAction<TradeOffOption[]>>;
  selectTradeOffOption: (tradeOffId: string) => void;
  dayIntelligence: DayIntelligence[];
  setDayIntelligence: React.Dispatch<React.SetStateAction<DayIntelligence[]>>;
  tripHealth: TripHealthSummary;
  setTripHealth: React.Dispatch<React.SetStateAction<TripHealthSummary>>;
  resolveTripConflict: (conflictId: string) => void;
  tripReadiness: TripReadinessSummary;
  setTripReadiness: React.Dispatch<React.SetStateAction<TripReadinessSummary>>;
  toggleReadinessItem: (itemId: string) => void;
  budgetBreakdown: BudgetBreakdown;
  setBudgetBreakdown: React.Dispatch<React.SetStateAction<BudgetBreakdown>>;
  applyBudgetOptimization: (optId: string) => void;
  planVariants: PlanVariant[];
  selectedPlanVariantId: string;
  selectPlanVariant: (variantId: 'plan-a' | 'plan-b' | 'plan-c') => void;
  applyImprovementAction: (actionType: ImprovementActionType) => void;
}

const TripOsContext = createContext<TripOsContextType | undefined>(undefined);

export const TripOsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [tripFit, setTripFit] = useState<TripFitResult>(INITIAL_TRIP_FIT);
  const [tradeOffOptions, setTradeOffOptions] = useState<TradeOffOption[]>(INITIAL_TRADE_OFF_OPTIONS);
  const [dayIntelligence, setDayIntelligence] = useState<DayIntelligence[]>(INITIAL_DAY_INTELLIGENCE);
  /**
   * Starts unverified, and is filled from the computed health.
   *
   * It used to start at INITIAL_TRIP_HEALTH — a fixed "All Systems Green" with
   * one informational note asserting a 72-hour dive-to-fly interval — and stay
   * there, because nothing ever replaced it.
   */
  const [tripHealth, setTripHealth] = useState<TripHealthSummary>(UNVERIFIED_TRIP_HEALTH);
  const [tripReadiness, setTripReadiness] = useState<TripReadinessSummary>(INITIAL_TRIP_READINESS);
  const [budgetBreakdown, setBudgetBreakdown] = useState<BudgetBreakdown>(INITIAL_BUDGET_BREAKDOWN);
  const [planVariants] = useState<PlanVariant[]>(PLAN_VARIANTS);
  const [selectedPlanVariantId, setSelectedPlanVariantId] = useState<string>('plan-a');

  const { showToast } = useUI();
  const { activeTrip, activeTripItems } = useCommerce();

  const CATEGORY: Record<string, { en: string; ar: string; color: string }> = {
    hotel: { en: 'Accommodation', ar: 'الإقامة', color: '#0E252C' },
    diving: { en: 'Diving', ar: 'الغطس', color: '#C49756' },
    safari: { en: 'Safari', ar: 'السفاري', color: '#E07A5F' },
    transfer: { en: 'Transfers', ar: 'التنقلات', color: '#20A89A' },
    wellness: { en: 'Wellness', ar: 'العناية', color: '#52C4B7' },
    dining: { en: 'Dining', ar: 'المطاعم', color: '#F4C36C' }
  };

  /**
   * The brief describes the traveler's own trip.
   *
   * INITIAL_TRIP_BRIEF still carried a fixed 5 days, 12–16 September 2026, 2
   * travellers, a Moderate budget of 16,800 EGP and four interests — rendered
   * on the screen that asks the traveler to approve "their" plan.
   *
   * Derived fields come from activeTrip; user-editable fields (budgetTier, pace,
   * interests) are stored in state and merged during render to avoid the
   * double-render caused by the previous useEffect approach.
   */
  const [tripBriefOverrides, setTripBriefOverrides] = useState<Partial<Pick<TripBrief, 'budgetTier' | 'pace' | 'interests'>>>({});

  const tripBrief = useMemo<TripBrief>(() => ({
    ...INITIAL_TRIP_BRIEF,
    ...tripBriefOverrides,
    durationDays: activeTrip?.lengthDays ?? INITIAL_TRIP_BRIEF.durationDays,
    startDate: activeTrip?.startDate || INITIAL_TRIP_BRIEF.startDate,
    endDate: activeTrip?.endDate || INITIAL_TRIP_BRIEF.endDate,
    travelersCount: activeTrip?.travelersCount ?? INITIAL_TRIP_BRIEF.travelersCount,
    budgetTier: tripBriefOverrides.budgetTier ?? activeTrip?.budget ?? INITIAL_TRIP_BRIEF.budgetTier,
    pace: tripBriefOverrides.pace ?? activeTrip?.pace ?? INITIAL_TRIP_BRIEF.pace,
    estimatedBudgetEGP: activeTrip?.totalEstimatedEGP || INITIAL_TRIP_BRIEF.estimatedBudgetEGP,
    interests: tripBriefOverrides.interests ?? (activeTrip?.interests?.length ? activeTrip.interests : INITIAL_TRIP_BRIEF.interests),
  }), [activeTrip, tripBriefOverrides]);

  const prevTripIdRef = useRef<string | null>(null);
  useEffect(() => {
    const tripId = activeTrip?.id ?? null;
    if (tripId === prevTripIdRef.current) return;
    prevTripIdRef.current = tripId;

    if (!activeTrip || activeTripItems.length === 0) {
      setBudgetBreakdown(INITIAL_BUDGET_BREAKDOWN);
      return;
    }

    const totals = new Map<string, number>();
    let bookedTotal = 0;
    for (const item of activeTripItems) {
      totals.set(item.serviceType, (totals.get(item.serviceType) ?? 0) + item.priceEGP);
      if (item.status === 'CONFIRMED' || item.status === 'BOOKED') bookedTotal += item.priceEGP;
    }

    const estimatedTotal = [...totals.values()].reduce((sum, v) => sum + v, 0);
    if (estimatedTotal === 0) return;

    setBudgetBreakdown({
      ...INITIAL_BUDGET_BREAKDOWN,
      estimatedTotalEGP: estimatedTotal,
      bookedTotalEGP: bookedTotal,
      plannedRemainingEGP: Math.max(0, estimatedTotal - bookedTotal),
      perDayAverageEGP: Math.round(estimatedTotal / Math.max(1, activeTrip.lengthDays)),
      costDrivers: [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([serviceType, amountEGP]) => ({
          category: CATEGORY[serviceType]?.en ?? serviceType,
          categoryAr: CATEGORY[serviceType]?.ar ?? serviceType,
          amountEGP,
          percentage: Math.round((amountEGP / estimatedTotal) * 100),
          color: CATEGORY[serviceType]?.color ?? '#20A89A'
        })),
      optimizations: []
    });
  }, [activeTrip?.id, activeTripItems]);

  useEffect(() => {
    if (!activeTrip) {
      setTripHealth(UNVERIFIED_TRIP_HEALTH);
      return;
    }

    let cancelled = false;
    api
      .getDayGiTripHealth(activeTrip.id)
      .then(health => {
        if (!cancelled && health) setTripHealth(toTripHealthSummary(health));
      })
      // A failed read leaves the panel unverified rather than asserting health.
      .catch(() => {
        if (!cancelled) setTripHealth(UNVERIFIED_TRIP_HEALTH);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTrip]);

  const updateTripBrief = useCallback(
    (updates: Partial<TripBrief>) => {
      setTripBriefOverrides(prev => ({
        ...prev,
        ...(updates.budgetTier !== undefined && { budgetTier: updates.budgetTier }),
        ...(updates.pace !== undefined && { pace: updates.pace }),
        ...(updates.interests !== undefined && { interests: updates.interests }),
      }));
      showToast('Trip Brief parameters updated ✓');
    },
    [showToast]
  );

  const selectTradeOffOption = useCallback(
    (tradeOffId: string) => {
      setTradeOffOptions(prev =>
        prev.map(opt => ({
          ...opt,
          isSelected: opt.id === tradeOffId
        }))
      );
      const selected = tradeOffOptions.find(o => o.id === tradeOffId);
      if (selected) {
        showToast(`Selected trade-off: "${selected.title}" ✓`);
      }
    },
    [tradeOffOptions, showToast]
  );

  const resolveTripConflict = useCallback(
    (conflictId: string) => {
      setTripHealth(prev => {
        const updatedConflicts = prev.conflicts.map(c =>
          c.id === conflictId ? { ...c, resolved: true } : c
        );
        const remainingCritical = updatedConflicts.filter(c => !c.resolved && c.severity === 'critical').length;
        const remainingWarning = updatedConflicts.filter(c => !c.resolved && c.severity === 'warning').length;
        const remainingInfo = updatedConflicts.filter(c => !c.resolved && c.severity === 'info').length;

        return {
          ...prev,
          criticalCount: remainingCritical,
          warningCount: remainingWarning,
          infoCount: remainingInfo,
          status: remainingCritical > 0 ? 'conflict' : remainingWarning > 0 ? 'attention' : 'good',
          // Was "All Systems Green" / "الجدول متناسق تماماً" the moment the
          // last conflict was dismissed locally. Dismissing a warning in the UI
          // is not the same as the trip being checked and found sound, and the
          // label the service computed is what the panel should keep saying.
          statusLabel: prev.statusLabel,
          statusLabelAr: prev.statusLabelAr,
          conflicts: updatedConflicts
        };
      });
      showToast('Conflict resolved & itinerary optimized ✓');
    },
    [showToast]
  );

  const toggleReadinessItem = useCallback(
    (itemId: string) => {
      setTripReadiness(prev => {
        const updatedItems = prev.items.map(item => {
          if (item.id === itemId) {
            const nextStatus = item.status === 'complete' ? 'pending' : 'complete';
            return { ...item, status: nextStatus as 'complete' | 'pending' | 'action_required' };
          }
          return item;
        });
        const completedCount = updatedItems.filter(i => i.status === 'complete').length;
        const score = Math.round((completedCount / (updatedItems.length || 1)) * 100);

        return {
          ...prev,
          overallScore: score,
          completedItemsCount: completedCount,
          status: score >= 85 ? 'Ready to Travel' : score >= 60 ? 'Action Recommended' : 'Preparation Incomplete',
          statusAr: score >= 85 ? 'جاهز للسفر بامتياز' : score >= 60 ? 'إجراءات موصى بها' : 'قيد التجهيز',
          items: updatedItems
        };
      });
      showToast('Trip readiness status updated ✓');
    },
    [showToast]
  );

  const applyBudgetOptimization = useCallback(
    (optId: string) => {
      setBudgetBreakdown(prev => {
        const updatedOpts = prev.optimizations.map(o =>
          o.id === optId ? { ...o, applied: !o.applied } : o
        );
        const targetOpt = prev.optimizations.find(o => o.id === optId);
        const delta = targetOpt ? (targetOpt.applied ? targetOpt.savingsEGP : -targetOpt.savingsEGP) : 0;

        return {
          ...prev,
          estimatedTotalEGP: prev.estimatedTotalEGP + delta,
          plannedRemainingEGP: prev.plannedRemainingEGP + delta,
          optimizations: updatedOpts
        };
      });
      showToast('Budget optimization applied to Trip OS ✓');
    },
    [showToast]
  );

  const selectPlanVariant = useCallback(
    (variantId: 'plan-a' | 'plan-b' | 'plan-c') => {
      setSelectedPlanVariantId(variantId);
      const variant = planVariants.find(p => p.id === variantId);
      if (variant) {
        setTripFit(prev => ({
          ...prev,
          overallScore: variant.fitScore,
          tradeOffSummary: variant.tagline,
          tradeOffSummaryAr: variant.taglineAr
        }));
        showToast(`Switched to ${variant.name} ✓`);
      }
    },
    [planVariants, showToast]
  );

  const applyImprovementAction = useCallback(
    (actionType: ImprovementActionType) => {
      const preview = computeImprovementPreview(actionType);

      setTripFit(prev => ({
        ...prev,
        overallScore: Math.min(99, prev.overallScore + 2),
        whyHighlights: [
          {
            text: preview.changeTitle,
            textAr: preview.changeTitleAr,
            iconType: 'check'
          },
          ...prev.whyHighlights.slice(0, 3)
        ]
      }));

      if (actionType === 'make_relaxed' || actionType === 'more_free_time') {
        setTripBriefOverrides(prev => ({ ...prev, pace: 'Relaxed' }));
        setDayIntelligence(prev =>
          prev.map(day => ({
            ...day,
            freeTimeMinutes: day.freeTimeMinutes + 60,
            freeTimeFormatted: `${((day.freeTimeMinutes + 60) / 60).toFixed(1)} Hours Free Time`,
            intensity: {
              ...day.intensity,
              score: Math.max(1, day.intensity.score - 1),
              level: 'Relaxed',
              levelAr: 'هادئ وخفيف'
            }
          }))
        );
      } else if (actionType === 'make_cheaper') {
        setBudgetBreakdown(prev => ({
          ...prev,
          estimatedTotalEGP: prev.estimatedTotalEGP - 1800,
          plannedRemainingEGP: prev.plannedRemainingEGP - 1800
        }));
      } else if (actionType === 'add_diving' || actionType === 'more_adventurous') {
        setTripBriefOverrides(prev => ({ ...prev, pace: 'Active' }));
        setDayIntelligence(prev =>
          prev.map(day =>
            day.dayNumber === 2
              ? {
                  ...day,
                  intensity: {
                    ...day.intensity,
                    score: 5,
                    level: 'Active',
                    levelAr: 'نشيط ومغامرة'
                  }
                }
              : day
          )
        );
      }

      showToast(`Trip OS applied: "${preview.changeTitle}" ✓`);
    },
    [showToast]
  );

  // setTripBrief is kept for type compatibility but is a no-op;
  // use updateTripBrief() or setTripBriefOverrides instead.
  const setTripBriefNoop = useCallback(() => {}, []);

  // See the note in UIContext.
  const value = useMemo<TripOsContextType>(
    () => ({
      tripBrief,
      setTripBrief: setTripBriefNoop,
      updateTripBrief,
      tripFit,
      setTripFit,
      tradeOffOptions,
      setTradeOffOptions,
      selectTradeOffOption,
      dayIntelligence,
      setDayIntelligence,
      tripHealth,
      setTripHealth,
      resolveTripConflict,
      tripReadiness,
      setTripReadiness,
      toggleReadinessItem,
      budgetBreakdown,
      setBudgetBreakdown,
      applyBudgetOptimization,
      planVariants,
      selectedPlanVariantId,
      selectPlanVariant,
      applyImprovementAction
    }),
    [
      tripBrief,
      updateTripBrief,
      tripFit,
      tradeOffOptions,
      selectTradeOffOption,
      dayIntelligence,
      tripHealth,
      resolveTripConflict,
      tripReadiness,
      toggleReadinessItem,
      budgetBreakdown,
      applyBudgetOptimization,
      planVariants,
      selectedPlanVariantId,
      selectPlanVariant,
      applyImprovementAction
    ]
  );

  return <TripOsContext.Provider value={value}>{children}</TripOsContext.Provider>;
};

export const useTripOs = () => {
  const context = useContext(TripOsContext);
  if (!context) {
    throw new Error('useTripOs must be used within a TripOsProvider');
  }
  return context;
};
