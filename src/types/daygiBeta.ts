// ============================================================================
// DayGI Closed Beta — Productization, Funnel & Outcome Metrics Types
// ============================================================================

export type DayGiFunnelStep =
  | 'DAYGI_OPENED'
  | 'INTENT_ENTERED'
  | 'INTENT_UNDERSTOOD'
  | 'RECOMMENDATION_SHOWN'
  | 'ACTION_SELECTED'
  | 'CONFIRMATION_SHOWN'
  | 'ACTION_EXECUTED'
  | 'ACTION_VERIFIED'
  | 'TRIP_UPDATED'
  | 'USER_OUTCOME';

export type DayGiIntentTier = 'GREEN' | 'YELLOW' | 'RED';

export type DayGiAlertLifecycle = 'SHOWN' | 'OPENED' | 'IGNORED' | 'ACTED_ON' | 'DISMISSED';

export type DayGiAlertQuality = 'USEFUL' | 'NEUTRAL' | 'NOISE';

export type DayGiOutcomeClassification = 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'CANCELLED' | 'ABANDONED';

export type DayGiAbandonmentPhase = 'PRE_ACTION_CONFIRMATION' | 'PAYMENT_AUTH' | 'SUPPLIER_WAIT' | 'POST_RECOVERY_CHOICE';

export interface DayGiFunnelEvent {
  id: string;
  sessionId: string;
  tripId: string;
  userId: string;
  step: DayGiFunnelStep;
  intentKey?: string;
  language: 'ar' | 'en';
  actionType?: string;
  cardType?: string;
  latencyMs?: number;
  confidenceScore?: number;
  whyThisInteracted?: boolean;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface DayGiFeedbackEvent {
  id: string;
  messageId: string;
  userId: string;
  tripId: string;
  rating: 'HELPFUL' | 'NOT_HELPFUL';
  reasonTag?: 'ACCURATE' | 'FAST_RESOLUTION' | 'SAVED_MONEY' | 'TOO_VAGUE' | 'WRONG_LOCATION' | 'TIMING_OFF' | 'UNEXPECTED_ACTION';
  feedbackNotes?: string;
  intentKey: string;
  language: 'ar' | 'en';
  timestamp: string;
}

export interface DayGiProactiveAlertMetric {
  alertId: string;
  ruleType: string;
  title: string;
  titleAr: string;
  impressionsCount: number;
  openedCount: number;
  actedOnCount: number;
  dismissedCount: number;
  ignoredCount: number;
  qualityClassification: DayGiAlertQuality;
  conversionRate: number;
  noiseScore: number; // 0 to 1
  recommendation: 'KEEP_ACTIVE' | 'THROTTLE_FREQUENCY' | 'DEPRECATE_ALERT';
}

export interface DayGiActionCardMetric {
  cardType: 'RECOMMENDATION' | 'BOOKING_CARD' | 'PLAN_CHANGE' | 'RECOVERY' | 'SUPPORT_OPS' | 'BUDGET_SAVINGS' | 'MULTI_ACTION';
  impressions: number;
  clicks: number;
  acceptances: number;
  rejections: number;
  completions: number;
  ctr: number; // click-through rate %
  conversionRate: number; // acceptance to completion %
  avgDurationSec: number;
}

export interface DayGiIntentPerformance {
  intentKey: string;
  labelEn: string;
  labelAr: string;
  tier: DayGiIntentTier;
  samplePrompts: string[];
  totalQueries: number;
  arabicQueries: number;
  englishQueries: number;
  understandingRate: number;
  clarificationRate: number;
  completionRate: number;
  abandonmentRate: number;
  avgConfidence: number;
  primaryFrictionCause?: string;
}

export interface DayGiOutcomeAuditEntry {
  id: string;
  taskId: string;
  tripId: string;
  userId: string;
  language: 'ar' | 'en';
  intentKey: string;
  classification: DayGiOutcomeClassification;
  rootCause: string;
  rootCauseAr: string;
  rootCauseType: 'UX_ABANDONMENT' | 'BACKEND_EXECUTION_FAILURE' | 'SUPPLIER_UNAVAILABLE' | 'USER_CHANGED_MIND' | 'SUCCESSFUL_FULFILLMENT';
  actionTaken?: string;
  financialImpactEGP: number;
  ledgerVerified: boolean;
  timeToResolutionSec: number;
  timestamp: string;
}

export interface DayGiExperimentFlags {
  proactiveAlertFrequency: 'CONSERVATIVE' | 'BALANCED' | 'PROACTIVE';
  quickPromptOrdering: 'POPULAR_FIRST' | 'CONTEXT_AWARE';
  explanationLevel: 'MINIMAL' | 'DETAILED' | 'ON_DEMAND';
  confirmationStyle: 'MODAL_EXPLICIT' | 'INLINE_CARD';
  recommendationCardLayout: 'COMPACT_HORIZONTAL' | 'RICH_VERTICAL';
}

export interface DayGiGoldenScenarioResult {
  id: string;
  scenarioName: string;
  scenarioNameAr: string;
  archetype: string;
  prompt: string;
  language: 'ar' | 'en';
  expectedBehavior: string;
  actualStatus: 'PASSED' | 'CLARIFIED_SAFELY' | 'FAILED';
  intentMapped: string;
  confidence: number;
  actionTaken: string;
  timeToResolutionMs: number;
  passed: boolean;
  safetyCheck: boolean;
}

export interface DayGiBetaDashboardData {
  timeWindow: string;
  summary: {
    totalSessions: number;
    totalQueries: number;
    intentUnderstandingRate: number;
    clarificationRate: number;
    recommendationAcceptanceRate: number;
    actionCompletionRate: number;
    partialCompletionRate: number;
    failureRate: number;
    recoverySuccessRate: number;
    bookingConversionRate: number;
    tripModificationAcceptanceRate: number;
    proactiveEngagementRate: number;
    avgTimeToResolutionSec: number;
    whyThisInteractionRate: number;
    whyThisConversionLift: number;
    feedbackHelpfulPercentage: number;
  };
  funnelSteps: Array<{
    step: DayGiFunnelStep;
    labelEn: string;
    labelAr: string;
    count: number;
    dropoffPercentage: number;
    stepConversionPercentage: number;
  }>;
  localeComparison: {
    arabic: {
      queriesCount: number;
      understandingRate: number;
      clarificationRate: number;
      actionSuccessRate: number;
      abandonmentRate: number;
      avgLatencyMs: number;
    };
    english: {
      queriesCount: number;
      understandingRate: number;
      clarificationRate: number;
      actionSuccessRate: number;
      abandonmentRate: number;
      avgLatencyMs: number;
    };
  };
  intentTiers: {
    green: DayGiIntentPerformance[];
    yellow: DayGiIntentPerformance[];
    red: DayGiIntentPerformance[];
  };
  proactiveAlerts: DayGiProactiveAlertMetric[];
  actionCards: DayGiActionCardMetric[];
  recentOutcomeAudits: DayGiOutcomeAuditEntry[];
  recentFeedback: DayGiFeedbackEvent[];
  experimentFlags: DayGiExperimentFlags;
  governedOpportunitiesFromFriction: Array<{
    id: string;
    title: string;
    titleAr: string;
    frictionPattern: string;
    occurrenceCount: number;
    suggestedAction: string;
    suggestedActionAr: string;
    status: 'Proposed' | 'Under Review' | 'Accepted' | 'Deferred';
    linkedOpportunityId?: string;
  }>;
  operationalThresholds: Array<{
    metricName: string;
    targetThreshold: string;
    currentValue: string;
    status: 'PASS' | 'WARN' | 'FAIL';
    zeroTolerance?: boolean;
  }>;
}
