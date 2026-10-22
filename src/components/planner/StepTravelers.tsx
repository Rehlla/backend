import React from 'react';
import { Users, Plus, Minus, ArrowRight, ArrowLeft, Heart, User, UserCheck, Compass } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export type TripDynamicType = 'Friends' | 'Couple' | 'Family' | 'Solo' | 'Group';

interface DynamicOption {
  id: TripDynamicType;
  labelKey: string;
  sublabelKey: string;
  icon: React.ReactNode;
}

const DYNAMIC_OPTIONS: DynamicOption[] = [
  {
    id: 'Friends',
    labelKey: 'planner.step2.friends.label',
    sublabelKey: 'planner.step2.friends.sub',
    icon: <Users className="w-4 h-4" />
  },
  {
    id: 'Couple',
    labelKey: 'planner.step2.couple.label',
    sublabelKey: 'planner.step2.couple.sub',
    icon: <Heart className="w-4 h-4" />
  },
  {
    id: 'Family',
    labelKey: 'planner.step2.family.label',
    sublabelKey: 'planner.step2.family.sub',
    icon: <UserCheck className="w-4 h-4" />
  },
  {
    id: 'Solo',
    labelKey: 'planner.step2.solo.label',
    sublabelKey: 'planner.step2.solo.sub',
    icon: <User className="w-4 h-4" />
  },
  {
    id: 'Group',
    labelKey: 'planner.step2.group.label',
    sublabelKey: 'planner.step2.group.sub',
    icon: <Compass className="w-4 h-4" />
  }
];

interface StepTravelersProps {
  adultsCount: number;
  childrenCount: number;
  tripDynamic: TripDynamicType | null;
  onAdultsChange: (count: number) => void;
  onChildrenChange: (count: number) => void;
  onTripDynamicChange: (dynamic: TripDynamicType | null) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const StepTravelers: React.FC<StepTravelersProps> = ({
  adultsCount,
  childrenCount,
  tripDynamic,
  onAdultsChange,
  onChildrenChange,
  onTripDynamicChange,
  onContinue,
  onBack,
}) => {
  const { t, isRTL } = useLanguage();

  const handleAdultsDecrement = () => {
    if (adultsCount > 1) {
      const next = adultsCount - 1;
      onAdultsChange(next);
      if (next === 1 && childrenCount === 0 && (tripDynamic === 'Friends' || tripDynamic === 'Couple')) {
        // keep or allow user to change
      }
    }
  };

  const handleAdultsIncrement = () => {
    if (adultsCount < 20) {
      onAdultsChange(adultsCount + 1);
    }
  };

  const handleChildrenDecrement = () => {
    if (childrenCount > 0) {
      onChildrenChange(childrenCount - 1);
    }
  };

  const handleChildrenIncrement = () => {
    if (childrenCount < 10) {
      onChildrenChange(childrenCount + 1);
      // Suggest Family when adding children, but don't override explicit user choice
      if (tripDynamic === null || tripDynamic === 'Friends' || tripDynamic === 'Couple' || tripDynamic === 'Solo') {
        onTripDynamicChange('Family');
      }
    }
  };

  const toggleDynamic = (dynamicId: TripDynamicType) => {
    // Always set (never toggle to null) — the user explicitly chose this option
    onTripDynamicChange(dynamicId);
  };

  return (
    <div id="step-travelers-container" className="w-full">
      {/* Question Header */}
      <div className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-xs font-bold mb-4">
          <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{t('planner.step2.badge')}</span>
        </div>
        
        <h1
          id="travelers-question-title"
          className="text-3xl sm:text-4xl md:text-5xl chart-heading text-[var(--text-primary)] tracking-tight leading-[1.12]"
        >
          {t('planner.step2.title')}
        </h1>
        
        <p
          id="travelers-supporting-text"
          className="mt-3 sm:mt-4 text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed font-normal"
        >
          {t('planner.step2.subtitle')}
        </p>
      </div>

      {/* Traveler Counters Block */}
      <div className="space-y-4 mb-8">
        
        {/* Adults Counter */}
        <div
          id="adults-counter-card"
          className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-lg flex items-center justify-between gap-4 transition-[background-color,border-color,color,box-shadow,transform,opacity]"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
                {t('planner.step2.adults')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]/70 mt-0.5 font-normal">
              {t('planner.step2.adultsDesc')}
            </p>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              id="adults-decrement-btn"
              onClick={handleAdultsDecrement}
              disabled={adultsCount <= 1}
              aria-label="Decrease adult count"
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                adultsCount <= 1
                  ? 'border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed bg-[var(--surface-container)]/40'
                  : 'border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-container)] active:scale-95'
              }`}
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>

            <span
              id="adults-count-display"
              className="text-xl sm:text-2xl font-black text-[var(--accent-secondary)] w-8 sm:w-10 text-center"
            >
              {adultsCount}
            </span>

            <button
              type="button"
              id="adults-increment-btn"
              onClick={handleAdultsIncrement}
              aria-label="Increase adult count"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-container)] active:scale-95 flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Children Counter */}
        <div
          id="children-counter-card"
          className="p-5 sm:p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] shadow-lg flex items-center justify-between gap-4 transition-[background-color,border-color,color,box-shadow,transform,opacity]"
        >
          <div>
            <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)] tracking-tight">
              {t('planner.step2.children')}
            </span>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]/70 mt-0.5 font-normal">
              {t('planner.step2.childrenDesc')}
            </p>
          </div>

          {/* Stepper Controls */}
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              id="children-decrement-btn"
              onClick={handleChildrenDecrement}
              disabled={childrenCount <= 0}
              aria-label="Decrease children count"
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-full border flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                childrenCount <= 0
                  ? 'border-[var(--border-subtle)] text-[var(--text-muted)] cursor-not-allowed bg-[var(--surface-container)]/40'
                  : 'border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-container)] active:scale-95'
              }`}
            >
              <Minus className="w-4 h-4 stroke-[2.5]" />
            </button>

            <span
              id="children-count-display"
              className="text-xl sm:text-2xl font-black text-[var(--accent-secondary)] w-8 sm:w-10 text-center"
            >
              {childrenCount}
            </span>

            <button
              type="button"
              id="children-increment-btn"
              onClick={handleChildrenIncrement}
              aria-label="Increase children count"
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border border-[var(--border-subtle)] text-[var(--text-primary)] hover:border-[var(--accent-secondary)] hover:bg-[var(--surface-container)] active:scale-95 flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Optional Trip Dynamic Selector */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3.5">
          <label className="text-sm font-bold text-[var(--text-primary)] tracking-tight block">
            {t('planner.step2.dynamicTitle')}
          </label>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {DYNAMIC_OPTIONS.map((option) => {
            const isSelected = tripDynamic === option.id;
            return (
              <button
                type="button"
                key={option.id}
                id={`dynamic-option-${option.id.toLowerCase()}`}
                onClick={() => toggleDynamic(option.id)}
                className={`p-3.5 sm:p-4 rounded-2xl border text-start transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-[var(--surface-container)] border-[var(--accent-secondary)] shadow-md ring-2 ring-[var(--accent-secondary)]/30'
                    : 'bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)]'
                        : 'bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    {option.icon}
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[var(--accent-secondary)]" />
                  )}
                </div>

                <div>
                  <div className={`text-sm sm:text-base font-bold ${isSelected ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-primary)]'}`}>
                    {t(option.labelKey)}
                  </div>
                  <div className="text-[12px] text-[var(--text-secondary)]/70 font-normal leading-tight mt-0.5 line-clamp-1">
                    {t(option.sublabelKey)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action Footer Navigation */}
      <div className="pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
        {/* Back Button */}
        <button
          type="button"
          id="planner-travelers-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-3 rounded-full hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('planner.common.back')}</span>
        </button>

        {/* Primary Continue Button */}
        <button
          type="button"
          id="planner-travelers-continue-btn"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-bold tracking-tight text-[var(--surface-card)] bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] active:scale-[0.98] transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-lg hover:shadow-xl cursor-pointer group"
        >
          <span>{t('planner.step2.continueBtn')}</span>
          {isRTL ? (
            <ArrowLeft className="w-4 h-4 text-[var(--surface-card)] group-hover:-translate-x-0.5 transition-transform" />
          ) : (
            <ArrowRight className="w-4 h-4 text-[var(--surface-card)] group-hover:translate-x-0.5 transition-transform" />
          )}
        </button>
      </div>
    </div>
  );
};

