import React from 'react';
import { Wallet, Check, ArrowRight, ArrowLeft, Info, Sparkles, Compass, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export type BudgetTier = 'budget' | 'moderate' | 'premium';

export interface BudgetOption {
  id: BudgetTier;
  titleKey: string;
  supportingTextKey: string;
  badgeLabelKey: string;
  isRecommended?: boolean;
}

const BUDGET_OPTIONS: BudgetOption[] = [
  {
    id: 'budget',
    titleKey: 'planner.step3.budget.title',
    supportingTextKey: 'planner.step3.budget.desc',
    badgeLabelKey: 'planner.step3.budget.badge',
  },
  {
    id: 'moderate',
    titleKey: 'planner.step3.moderate.title',
    supportingTextKey: 'planner.step3.moderate.desc',
    badgeLabelKey: 'planner.step3.moderate.badge',
    isRecommended: true,
  },
  {
    id: 'premium',
    titleKey: 'planner.step3.premium.title',
    supportingTextKey: 'planner.step3.premium.desc',
    badgeLabelKey: 'planner.step3.premium.badge',
  },
];

interface StepBudgetProps {
  selectedBudget: BudgetTier;
  onSelectBudget: (tier: BudgetTier) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const StepBudget: React.FC<StepBudgetProps> = ({
  selectedBudget,
  onSelectBudget,
  onContinue,
  onBack,
}) => {
  const { t, isRTL } = useLanguage();

  return (
    <div id="step-budget-container" className="w-full">
      {/* Question Header */}
      <div className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-xs font-bold mb-4">
          <Wallet className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{t('planner.step3.badge')}</span>
        </div>

        <h1
          id="budget-question-title"
          className="text-3xl sm:text-4xl md:text-5xl chart-heading text-[var(--text-primary)] tracking-tight leading-[1.12]"
        >
          {t('planner.step3.title')}
        </h1>

        <p
          id="budget-supporting-text"
          className="mt-3 sm:mt-4 text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed font-normal"
        >
          {t('planner.step3.subtitle')}
        </p>
      </div>

      {/* 3 Budget Option Cards */}
      <div
        className="space-y-4 mb-8"
        role="radiogroup"
        aria-label="Trip budget tiers"
      >
        {BUDGET_OPTIONS.map((option) => {
          const isSelected = selectedBudget === option.id;

          return (
            <button
              type="button"
              key={option.id}
              id={`budget-option-${option.id}`}
              onClick={() => onSelectBudget(option.id)}
              aria-checked={isSelected}
              role="radio"
              className={`w-full text-start p-5 sm:p-6 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer flex items-center justify-between gap-4 relative ${
                isSelected
                  ? 'bg-[var(--surface-container)] border-[var(--accent-secondary)] shadow-lg ring-2 ring-[var(--accent-secondary)]/30 aurora-glow'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)] aurora-hover'
              }`}
            >
              <div className="flex items-start sm:items-center gap-4 flex-1">
                {/* Radio Indicator */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 sm:mt-0 transition-colors flex-shrink-0 ${
                    isSelected
                      ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold'
                      : 'border-2 border-[var(--border-subtle)] bg-transparent'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>

                {/* Option Text Content */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className={`text-lg sm:text-xl font-bold tracking-tight ${isSelected ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-primary)]'}`}>
                      {t(option.titleKey)}
                    </span>

                    {/* Tag badge */}
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/40'
                          : 'bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {t(option.badgeLabelKey)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed font-normal">
                    {t(option.supportingTextKey)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Action Footer Navigation */}
      <div className="pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
        {/* Back Button */}
        <button
          type="button"
          id="planner-budget-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-3 rounded-full hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('planner.common.back')}</span>
        </button>

        {/* Primary Continue Button */}
        <button
          type="button"
          id="planner-budget-continue-btn"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-bold tracking-tight text-[var(--surface-card)] bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] active:scale-[0.98] transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-lg hover:shadow-xl cursor-pointer group"
        >
          <span>{t('planner.step3.continueBtn')}</span>
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
