import React from 'react';
import { Gauge, Check, Sparkles, ArrowLeft, ArrowRight, Info, Coffee, Sun, Flame } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { IMG_P1469854523086cc02fe5d8800_800, IMG_P1507525428034b723cf961d3e_CARD, IMG_P154455176346a013bb70d5_CARD } from '../../shared/placeholderImagery';

export type PaceType = 'slow' | 'balanced' | 'packed';

export interface PaceOption {
  id: PaceType;
  titleKey: string;
  descriptionKey: string;
  sublabelKey: string;
  image: string;
  icon: React.ReactNode;
}

const PACE_OPTIONS: PaceOption[] = [
  {
    id: 'slow',
    titleKey: 'planner.step5.slow.title',
    descriptionKey: 'planner.step5.slow.desc',
    sublabelKey: 'planner.step5.slow.sub',
    image: IMG_P1507525428034b723cf961d3e_CARD,
    icon: <Coffee className="w-4 h-4" />,
  },
  {
    id: 'balanced',
    titleKey: 'planner.step5.balanced.title',
    descriptionKey: 'planner.step5.balanced.desc',
    sublabelKey: 'planner.step5.balanced.sub',
    image: IMG_P154455176346a013bb70d5_CARD,
    icon: <Sun className="w-4 h-4" />,
  },
  {
    id: 'packed',
    titleKey: 'planner.step5.packed.title',
    descriptionKey: 'planner.step5.packed.desc',
    sublabelKey: 'planner.step5.packed.sub',
    image: IMG_P1469854523086cc02fe5d8800_800,
    icon: <Flame className="w-4 h-4" />,
  },
];

interface StepPaceProps {
  selectedPace: PaceType;
  onSelectPace: (pace: PaceType) => void;
  onBuildTrip: () => void;
  onBack: () => void;
}

export const StepPace: React.FC<StepPaceProps> = ({
  selectedPace,
  onSelectPace,
  onBuildTrip,
  onBack,
}) => {
  const { t, isRTL } = useLanguage();

  return (
    <div id="step-pace-container" className="w-full">
      {/* Question Header */}
      <div className="mb-8 sm:mb-10">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)] text-xs font-bold mb-4">
          <Gauge className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span>{t('planner.step5.badge')}</span>
        </div>

        <h1
          id="pace-question-title"
          className="text-3xl sm:text-4xl md:text-5xl chart-heading text-[var(--text-primary)] tracking-tight leading-[1.12]"
        >
          {t('planner.step5.title')}
        </h1>

        <p
          id="pace-supporting-text"
          className="mt-3 sm:mt-4 text-base sm:text-lg text-[var(--text-secondary)] leading-relaxed font-normal"
        >
          {t('planner.step5.subtitle')}
        </p>
      </div>

      {/* 3 Pace Option Cards */}
      <div
        className="space-y-4 mb-8"
        role="radiogroup"
        aria-label="Travel pace options"
      >
        {PACE_OPTIONS.map((option) => {
          const isSelected = selectedPace === option.id;

          return (
            <button
              type="button"
              key={option.id}
              id={`pace-option-${option.id}`}
              onClick={() => onSelectPace(option.id)}
              aria-checked={isSelected}
              role="radio"
              className={`w-full text-start p-5 sm:p-6 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden group ${
                isSelected
                  ? 'bg-[var(--surface-container)] border-[var(--accent-secondary)] shadow-lg ring-2 ring-[var(--accent-secondary)]/30 aurora-glow'
                  : 'bg-[var(--surface-card)] hover:bg-[var(--surface-container)] border-[var(--border-subtle)] hover:border-[var(--border-subtle)] aurora-hover'
              }`}
            >
              {/* Left Details */}
              <div className="flex items-start gap-4 flex-1">
                {/* Radio Checkbox Indicator */}
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center mt-1 sm:mt-0.5 transition-colors flex-shrink-0 ${
                    isSelected
                      ? 'bg-[var(--accent-secondary)] text-[var(--surface-card)] font-bold'
                      : 'border-2 border-[var(--border-subtle)] bg-transparent'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className={`text-lg sm:text-xl font-bold tracking-tight ${isSelected ? 'text-[var(--accent-secondary)]' : 'text-[var(--text-primary)]'}`}>
                      {t(option.titleKey)}
                    </span>

                    {/* Small sublabel pill */}
                    <span
                      className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/40'
                          : 'bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)]'
                      }`}
                    >
                      {t(option.sublabelKey)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1.5 leading-relaxed font-normal">
                    {t(option.descriptionKey)}
                  </p>
                </div>
              </div>

              {/* Right Visual Thumbnail */}
              <div className="sm:w-28 sm:h-20 h-24 w-full rounded-xl overflow-hidden relative flex-shrink-0 bg-[var(--surface-card)] border border-[var(--border-subtle)]">
                <img
                  src={option.image}
                  alt={t(option.titleKey)}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 opacity-90"
                />
                <div className="absolute inset-0 bg-[var(--surface-card)]/25" />
                <div className={`absolute bottom-1.5 ${isRTL ? 'left-1.5' : 'right-1.5'} p-1 rounded-md bg-[var(--surface-card)]/80 backdrop-blur-xs text-[var(--accent-secondary)]`}>
                  {option.icon}
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
          id="planner-pace-back-btn"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] px-4 py-3 rounded-full hover:bg-[var(--btn-util-bg)] transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          {isRTL ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{t('planner.common.back')}</span>
        </button>

        {/* Primary Build My Trip CTA Button */}
        <button
          type="button"
          id="planner-build-trip-btn"
          onClick={onBuildTrip}
          className="inline-flex items-center justify-center gap-2.5 px-8 sm:px-10 py-3.5 sm:py-4 rounded-full text-sm sm:text-base font-bold tracking-tight text-[var(--surface-card)] bg-[var(--accent-secondary)] hover:bg-[var(--accent-secondary)] active:scale-[0.98] transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-lg hover:shadow-xl cursor-pointer group"
        >
          <Sparkles className="w-4 h-4 text-[var(--surface-card)] group-hover:rotate-12 transition-transform" />
          <span>{t('planner.step5.buildBtn')}</span>
        </button>
      </div>
    </div>
  );
};
