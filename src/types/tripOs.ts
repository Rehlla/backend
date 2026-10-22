export type ConstraintType = 'must_have' | 'prefer' | 'avoid';

export type ConstraintCategory =
  | 'transfer'
  | 'diving'
  | 'timing'
  | 'comfort'
  | 'pace'
  | 'food'
  | 'location'
  | 'budget';

export interface TripConstraint {
  id: string;
  type: ConstraintType;
  category: ConstraintCategory;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr?: string;
  isLocked?: boolean;
}

export interface TripBrief {
  travelerName: string;
  durationDays: number;
  startDate?: string;
  endDate?: string;
  travelersCount: number;
  tripDynamic: string;
  budgetTier: 'Budget' | 'Moderate' | 'Premium';
  estimatedBudgetEGP: number;
  interests: string[];
  pace: 'Relaxed' | 'Balanced' | 'Active';
  comfortLevel: 'Authentic / Bohemian' | 'Comfort Boutique' | 'Luxury Resort';
  mustHaves: TripConstraint[];
  preferences: TripConstraint[];
  avoidances: TripConstraint[];
}

export interface TripFitDimension {
  id: 'preference' | 'budget' | 'pace' | 'time' | 'availability' | 'logistics';
  name: string;
  nameAr: string;
  score: number; // 0 - 100
  weight: number;
  status: 'perfect' | 'good' | 'warning';
  explanation: string;
  explanationAr: string;
}

export interface TripFitResult {
  overallScore: number;
  grade: 'Optimal Fit' | 'Strong Fit' | 'Moderate Fit' | 'Attention Needed';
  dimensions: TripFitDimension[];
  whyHighlights: {
    text: string;
    textAr: string;
    iconType: 'check' | 'clock' | 'wallet' | 'heart' | 'shield';
  }[];
  tradeOffSummary: string;
  tradeOffSummaryAr: string;
}

export interface TradeOffOption {
  id: string;
  title: string;
  titleAr: string;
  tagline: string;
  taglineAr: string;
  badge: string;
  badgeAr: string;
  gains: string[];
  gainsAr: string[];
  givesUp: string[];
  givesUpAr: string[];
  costDeltaEGP: number;
  intensityDeltaScore: number; // e.g. -2 or +1
  freeTimeDeltaHours: number; // e.g. +2.5
  isSelected?: boolean;
}

export type IntensityLevel = 'Relaxed' | 'Balanced' | 'Active' | 'Intense';

export interface DayIntensity {
  score: number; // 1 to 10
  level: IntensityLevel;
  levelAr: string;
  color: string;
  reasons: string[];
  reasonsAr: string[];
  breakdown: {
    activitiesCount: number;
    earlyStart: boolean;
    divingOrStrenuous: boolean;
    drivingMinutes: number;
    freeTimeMinutes: number;
    recoveryBufferMinutes: number;
  };
}

export interface DayIntelligence {
  dayNumber: number;
  dateStr: string;
  theme: string;
  themeAr: string;
  mainAnchor: string;
  mainAnchorAr: string;
  supportingActivity: string;
  supportingActivityAr: string;
  freeTimeMinutes: number;
  freeTimeFormatted: string;
  freeTimeFormattedAr: string;
  travelTimeMinutes: number;
  travelTimeFormatted: string;
  recoveryBufferMinutes: number;
  recoveryBufferFormatted: string;
  estimatedCostEGP: number;
  confidence: 'High' | 'Medium' | 'Estimated';
  intensity: DayIntensity;
  conflictDetected?: boolean;
  freeTimeSuggestions?: {
    id: string;
    title: string;
    titleAr: string;
    category: 'food' | 'chilling' | 'shopping' | 'sunset';
    duration: string;
    location: string;
    priceEGP: number;
  }[];
}

export type ConflictSeverity = 'critical' | 'warning' | 'info';

export interface TripConflict {
  id: string;
  severity: ConflictSeverity;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  affectedDayNumber: number;
  source: 'timing' | 'transfer' | 'availability' | 'weather' | 'payment' | 'fatigue';
  suggestedFix: string;
  suggestedFixAr: string;
  resolved: boolean;
  autoFixable?: boolean;
}

export interface TripHealthSummary {
  status: 'good' | 'attention' | 'conflict' | 'unverified';
  statusLabel: string;
  statusLabelAr: string;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  conflicts: TripConflict[];
}

export interface ReadinessCheckItem {
  id: string;
  label: string;
  labelAr: string;
  category: 'booking' | 'payment' | 'transfer' | 'supplier' | 'documents' | 'timing';
  status: 'complete' | 'pending' | 'action_required';
  detail: string;
  detailAr: string;
}

export interface TripReadinessSummary {
  overallScore: number; // 0 - 100
  status: 'Ready to Travel' | 'Action Recommended' | 'Preparation Incomplete';
  statusAr: string;
  completedItemsCount: number;
  totalItemsCount: number;
  items: ReadinessCheckItem[];
  nextActionRequired?: {
    label: string;
    labelAr: string;
    ctaRoute: string;
  };
}

export interface BudgetCostDriver {
  /**
   * Free text, because the breakdown is computed from the trip's own items now
   * and the commerce engine sells six verticals — the closed set of four here
   * could not describe a wellness or dining line at all. It was only ever
   * satisfiable because the whole breakdown was a fixed object.
   */
  category: string;
  categoryAr: string;
  amountEGP: number;
  percentage: number;
  color: string;
}

export interface BudgetOptimizationSuggestion {
  id: string;
  title: string;
  titleAr: string;
  savingsEGP: number;
  description: string;
  descriptionAr: string;
  tradeOffGivesUp: string;
  tradeOffGivesUpAr: string;
  applied: boolean;
}

export interface BudgetBreakdown {
  estimatedTotalEGP: number;
  bookedTotalEGP: number;
  plannedRemainingEGP: number;
  perDayAverageEGP: number;
  costDrivers: BudgetCostDriver[];
  optimizations: BudgetOptimizationSuggestion[];
}

export interface PlanVariant {
  id: 'plan-a' | 'plan-b' | 'plan-c';
  name: string;
  nameAr: string;
  tagline: string;
  taglineAr: string;
  fitScore: number;
  totalCostEGP: number;
  pace: 'Relaxed' | 'Balanced' | 'Active';
  intensityAvg: number;
  gains: string[];
  gainsAr: string[];
  givesUp: string[];
  givesUpAr: string[];
  highlightDays: {
    dayNumber: number;
    theme: string;
    anchor: string;
  }[];
}

export interface ChangeImpactPreview {
  changeTitle: string;
  changeTitleAr: string;
  costDeltaEGP: number;
  freeTimeDeltaHours: number;
  intensityDeltaScore: number;
  gains: string[];
  gainsAr: string[];
  givesUp: string[];
  givesUpAr: string[];
  conflictsResolved: string[];
  conflictsIntroduced: string[];
}

export interface MultiTravelerPreference {
  id: string;
  name: string;
  avatarColor: string;
  mustHaves: string[];
  preferences: string[];
  avoidances: string[];
}

export type ImprovementActionType =
  | 'make_relaxed'
  | 'make_cheaper'
  | 'add_diving'
  | 'reduce_driving'
  | 'more_local_food'
  | 'more_free_time'
  | 'couple_friendly'
  | 'more_adventurous';
