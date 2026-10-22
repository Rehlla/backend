import React from 'react';
import { ArrowLeft, CheckCircle2, Home, Sparkles, Clock, Users, Compass, Waves, Gauge } from 'lucide-react';
import { TripDynamicType } from './StepTravelers';
import { BudgetTier } from './StepBudget';
import { InterestId, INTERESTS_DATA } from './StepInterests';

interface StepPlaceholderProps {
  selectedDurationLabel: string;
  adultsCount: number;
  childrenCount: number;
  tripDynamic: TripDynamicType | null;
  selectedBudget: BudgetTier;
  selectedInterests: InterestId[];
  onBackToInterests: () => void;
  onReturnHome: () => void;
}

export const StepPlaceholder: React.FC<StepPlaceholderProps> = ({
  selectedDurationLabel,
  adultsCount,
  childrenCount,
  tripDynamic,
  selectedBudget,
  selectedInterests,
  onBackToInterests,
  onReturnHome,
}) => {
  const travelersSummary = `${adultsCount} Adult${adultsCount > 1 ? 's' : ''}${
    childrenCount > 0 ? `, ${childrenCount} Child${childrenCount > 1 ? 'ren' : ''}` : ''
  }${tripDynamic ? ` (${tripDynamic})` : ''}`;

  const budgetDisplayMap: Record<BudgetTier, string> = {
    budget: 'Easy on the budget (Budget)',
    moderate: 'A balanced trip (Moderate)',
    premium: 'Treat yourself (Premium)',
  };

  const selectedInterestNames = INTERESTS_DATA.filter((item) =>
    selectedInterests.includes(item.id)
  )
    .map((item) => item.name)
    .join(' · ');

  return (
    <div id="step-placeholder-container" className="w-full">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--text-secondary)]/10 text-[var(--text-secondary)] text-xs font-bold mb-4">
          <Gauge className="w-3.5 h-3.5" />
          <span>Step 5 Preview · Travel Pace & Daily Rhythm</span>
        </div>
        
        <h1
          id="step-5-placeholder-title"
          className="text-3xl sm:text-4xl md:text-5xl chart-heading text-[var(--text-primary)] tracking-tight leading-[1.12]"
        >
          How fast or relaxed do you want your days?
        </h1>
        
        <p
          id="step-5-placeholder-subtitle"
          className="mt-3 text-base sm:text-lg text-[var(--text-primary)]/70 leading-relaxed font-normal"
        >
          Step 5 will finalize your daily rhythm (Relaxed vs Active) and generate your custom Dahab itinerary.
        </p>
      </div>

      {/* Confirmation & Accumulated Blueprint Summary */}
      <div className="bg-[var(--surface-card)] border border-[var(--text-primary)]/10 rounded-3xl p-6 sm:p-8 shadow-xs mb-8">
        <div className="flex items-center gap-3 pb-5 border-b border-[var(--text-primary)]/5 mb-6">
          <div className="w-8 h-8 rounded-full bg-[var(--text-secondary)]/15 text-[var(--text-secondary)] flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--text-secondary)]">
              Trip Blueprint Calibrated
            </div>
            <div className="text-base font-bold text-[var(--text-primary)]">
              {selectedDurationLabel} · {travelersSummary} · {budgetDisplayMap[selectedBudget]}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-start gap-3">
            <Compass className="w-4 h-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm text-[var(--text-primary)]/75 leading-relaxed font-medium">
              <span className="font-bold text-[var(--text-primary)]">Selected Interests:</span>{' '}
              {selectedInterestNames || 'Custom experiences'} configured for diving sessions, desert safari, and local cuisine.
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--text-secondary)]/5 border border-[var(--text-secondary)]/15 flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-[var(--text-secondary)] mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm text-[var(--text-primary)]/75 leading-relaxed font-medium">
              <span className="font-bold text-[var(--text-primary)]">Next Step:</span> Step 5 (Travel Pace) will finalize your daily rhythm and generate your day-by-day Dahab schedule.
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="pt-6 border-t border-[var(--text-primary)]/8 flex items-center justify-between gap-4">
        <button
          type="button"
          id="placeholder-back-to-interests"
          onClick={onBackToInterests}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-primary)]/80 hover:text-[var(--text-primary)] px-4 py-3 rounded-full hover:bg-[var(--text-primary)]/5 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Interests</span>
        </button>

        <button
          type="button"
          id="placeholder-return-home"
          onClick={onReturnHome}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-[var(--accent-primary-ink)] bg-[var(--accent-primary)] hover:brightness-110 transition-[background-color,border-color,color,box-shadow,transform,opacity,filter] cursor-pointer shadow-xs"
        >
          <Home className="w-4 h-4" />
          <span>Return to Homepage</span>
        </button>
      </div>
    </div>
  );
};
