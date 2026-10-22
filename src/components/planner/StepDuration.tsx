import React, { useState } from 'react';
import { Calendar, Clock, Check, ArrowRight, ArrowLeft, Sparkles, CalendarDays } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

export interface DurationOption {
  id: string;
  labelKey: string;
  subtitleKey: string;
  descKey: string;
  tagKey?: string;
  isCustom?: boolean;
}

const DURATION_OPTIONS: DurationOption[] = [
  {
    id: '2-3',
    labelKey: 'planner.step1.2-3.label',
    subtitleKey: 'planner.step1.2-3.subtitle',
    descKey: 'planner.step1.2-3.desc',
    tagKey: 'planner.step1.2-3.tag',
  },
  {
    id: '4-5',
    labelKey: 'planner.step1.4-5.label',
    subtitleKey: 'planner.step1.4-5.subtitle',
    descKey: 'planner.step1.4-5.desc',
    tagKey: 'planner.step1.4-5.tag',
  },
  {
    id: '6-7',
    labelKey: 'planner.step1.6-7.label',
    subtitleKey: 'planner.step1.6-7.subtitle',
    descKey: 'planner.step1.6-7.desc',
    tagKey: 'planner.step1.6-7.tag',
  },
  {
    id: '8+',
    labelKey: 'planner.step1.8plus.label',
    subtitleKey: 'planner.step1.8plus.subtitle',
    descKey: 'planner.step1.8plus.desc',
    tagKey: 'planner.step1.8plus.tag',
  },
  {
    id: 'custom',
    labelKey: 'planner.step1.custom.label',
    subtitleKey: 'planner.step1.custom.subtitle',
    descKey: 'planner.step1.custom.desc',
    isCustom: true,
  },
];

interface StepDurationProps {
  selectedDurationId: string;
  onSelectDuration: (id: string, label: string) => void;
  startDate: string;
  endDate: string;
  onDatesChange: (start: string, end: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export const StepDuration: React.FC<StepDurationProps> = ({
  selectedDurationId,
  onSelectDuration,
  startDate,
  endDate,
  onDatesChange,
  onContinue,
  onBack,
}) => {
  const { t, isRTL } = useLanguage();
  const [showDatePicker, setShowDatePicker] = useState(selectedDurationId === 'custom');

  const handleOptionClick = (option: DurationOption) => {
    onSelectDuration(option.id, t(option.labelKey));
    if (option.isCustom) {
      setShowDatePicker(true);
    } else {
      setShowDatePicker(false);
    }
  };

  // Calculate day difference if custom dates are selected
  const getCustomDaysCount = () => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : null;
  };

  const customDays = getCustomDaysCount();

  return (
    <div id="step-duration-container" className="w-full">
      {/* Question Header */}
      <div className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-xs font-bold mb-4">
          <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{t('planner.step1.badge')}</span>
        </div>
        
        <h1
          id="duration-question-title"
          className="text-3xl sm:text-4xl md:text-5xl chart-heading text-[var(--text-primary)] tracking-tight leading-[1.12]"
        >
          {t('planner.step1.title')}
        </h1>
        
        <p
          id="duration-supporting-text"
          className="mt-3 sm:mt-4 text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed font-normal"
        >
          {t('planner.step1.subtitle')}
        </p>
      </div>

      {/* Duration Options Grid */}
      <div className="space-y-3 sm:space-y-3.5 mb-8" role="radiogroup" aria-label="Trip duration options">
        {DURATION_OPTIONS.map((option) => {
          const isSelected = selectedDurationId === option.id;
          
          return (
            <div key={option.id} className="transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200">
              <button
                type="button"
                id={`duration-option-${option.id}`}
                onClick={() => handleOptionClick(option)}
                aria-checked={isSelected}
                role="radio"
                className={`w-full text-start p-4 sm:p-5 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer flex items-center justify-between gap-4 relative ${
                  isSelected
                    ? 'bg-[var(--surface-container)] border-[var(--accent-secondary)] shadow-lg ring-2 ring-[var(--accent-secondary)]/30 aurora-glow'
                    : 'bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)] aurora-hover'
                }`}
              >
                <div className="flex items-start sm:items-center gap-4 flex-1">
                  {/* Selection Radio Circle */}
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 sm:mt-0 transition-colors flex-shrink-0 ${
                      isSelected
                        ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold'
                        : 'border-2 border-[var(--border-subtle)] bg-transparent'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>

                  {/* Option Text */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className={`text-lg sm:text-xl font-bold tracking-tight ${isSelected ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-primary)]'}`}>
                        {t(option.labelKey)}
                      </span>
                      {option.tagKey && (
                        <span
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                            isSelected
                              ? 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/40'
                              : 'bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                          }`}
                        >
                          {t(option.tagKey)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed font-normal">
                      {t(option.subtitleKey)} · {t(option.descKey)}
                    </p>
                  </div>
                </div>

                {/* Right decorative pill / date indicator */}
                {option.isCustom && (
                  <div className="hidden sm:flex items-center gap-1 text-xs font-bold text-[var(--accent-secondary)] bg-[var(--surface-container)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-xl">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{customDays ? `${customDays} ${t('planner.step1.custom.daysSelected')}` : t('planner.step1.custom.label')}</span>
                  </div>
                )}
              </button>

              {/* Expandable Custom Date Picker when 'Choose dates' is selected */}
              {option.isCustom && isSelected && (
                <div
                  id="custom-date-picker-panel"
                  className="mt-3 p-5 rounded-2xl bg-[var(--surface-card)] border border-[var(--accent-secondary)]/40 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <CalendarDays className="w-4 h-4 text-[var(--accent-secondary)]" />
                    <h3 className="text-xs font-bold text-[var(--text-primary)]">
                      {t('planner.step1.custom.subtitle')}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="trip-start-date" className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                        {t('planner.step1.custom.start')}
                      </label>
                      <input
                        type="date"
                        id="trip-start-date"
                        value={startDate}
                        onChange={(e) => onDatesChange(e.target.value, endDate)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] text-sm text-[var(--text-primary)] font-medium focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-secondary)]/40 focus:border-[var(--accent-secondary)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="trip-end-date" className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                        {t('planner.step1.custom.end')}
                      </label>
                      <input
                        type="date"
                        id="trip-end-date"
                        value={endDate}
                        min={startDate || undefined}
                        onChange={(e) => onDatesChange(startDate, e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] text-sm text-[var(--text-primary)] font-medium focus:outline-hidden focus:ring-2 focus:ring-[var(--accent-secondary)]/40 focus:border-[var(--accent-secondary)]"
                      />
                    </div>
                  </div>

                  {customDays !== null && (
                    <div className="mt-3.5 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--accent-secondary)] font-bold">
                      <span>{t('planner.step1.custom.daysSelected')}:</span>
                      <span className="bg-[var(--surface-container)] border border-[var(--border-subtle)] px-3 py-1 rounded-full text-[var(--text-primary)]">
                        {customDays} {t('planner.step1.custom.daysSelected')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Footer Navigation */}
      <div className="pt-6 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
        {/* Back Button */}
        <button
          type="button"
          id="planner-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-3 rounded-full hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('planner.common.back')}</span>
        </button>

        {/* Primary Continue Button */}
        <button
          type="button"
          id="planner-continue-btn"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-full text-sm font-bold tracking-tight text-[var(--surface-card)] bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] active:scale-[0.98] transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-lg hover:shadow-xl cursor-pointer group"
        >
          <span>{t('planner.step1.continueBtn')}</span>
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

