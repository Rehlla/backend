import React from 'react';
import { Check, Sparkles, Clock, Compass, Users, ShieldCheck, Waves, Info, ExternalLink } from 'lucide-react';
import { DivingOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';
import { ClickableCard } from '../common/ClickableCard';

interface DivingOptionCardProps {
  diving: DivingOption;
  isSelected: boolean;
  onSelect: (divingId: string) => void;
  onViewDetails: (diving: DivingOption) => void;
}

export const DivingOptionCard: React.FC<DivingOptionCardProps> = React.memo(({
  diving,
  isSelected,
  onSelect,
  onViewDetails,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const getBadgeStyle = () => {
    switch (diving.badgeType) {
      case 'match':
        return 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border-[var(--accent-secondary)]/40';
      case 'adventure':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'easy':
        return 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/40';
      default:
        return 'bg-[var(--surface-card)]/10 text-[var(--text-secondary)] border-[var(--border-subtle)]';
    }
  };

  const totalPrice = diving.pricePerPersonEGP * 2;
  const title = isAr && diving.titleAr ? diving.titleAr : diving.title;
  const description = isAr && diving.descriptionAr ? diving.descriptionAr : diving.description;
  const location = isAr && diving.locationAr ? diving.locationAr : diving.location;
  const badgeLabel = isAr && diving.badgeLabelAr ? diving.badgeLabelAr : diving.badgeLabel;
  const duration = isAr && diving.durationAr ? diving.durationAr : diving.duration;
  const level = isAr && diving.levelAr ? diving.levelAr : diving.level;
  const group = isAr && diving.groupAr ? diving.groupAr : diving.group;
  const includes = isAr && diving.includesAr ? diving.includesAr : diving.includes;

  return (
    <ClickableCard
      id={`diving-card-${diving.id}`}
      onClick={() => onSelect(diving.id)}
      className={`rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 overflow-hidden bg-[var(--surface-card)] text-[var(--text-primary)] relative ${
        isSelected
          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30 shadow-lg'
          : diving.badgeType === 'match'
          ? 'border-[var(--accent-secondary)]/40 hover:border-[var(--accent-secondary)] shadow-md'
          : 'border-[var(--border-subtle)] hover:border-white/20 shadow-md'
      }`}
    >
      {/* Top Banner for Best Match / Recommendation */}
      {diving.badgeType === 'match' && (
        <div className="bg-[var(--surface-container)] border-b border-[var(--accent-secondary)]/30 px-5 sm:px-6 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-secondary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)] fill-[var(--accent-secondary)]" />
            <span>{isAr ? 'موصى به لرحلتك' : 'Recommended for your trip'}</span>
          </div>
          <span className="text-[12px] font-medium text-[var(--accent-secondary)]/80 hidden sm:inline">
            {isAr ? 'يتوافق مع تفضيلات الغطس والمغامرة' : 'Matches your diving & adventure preferences'}
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left: Visual Asset & Duration Pill (md:col-span-4) */}
        <div className="md:col-span-4 relative">
          <div className="relative h-44 sm:h-48 md:h-52 w-full rounded-2xl overflow-hidden bg-black/40">
            <img
              src={diving.image}
              alt={title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            />

            {/* Badge */}
            <div
              className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-[12px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md shadow-xs ${getBadgeStyle()}`}
            >
              {badgeLabel}
            </div>

            {/* Selected Status Overlay */}
            {isSelected && (
              <div className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} bg-[var(--accent-primary)] text-[var(--surface-container)] text-[12px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md animate-in zoom-in-90 duration-150`}>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isAr ? 'تم الاختيار' : 'Selected'}</span>
              </div>
            )}

            {/* Duration Tag */}
            <div className={`absolute bottom-3 ${isRTL ? 'right-3' : 'left-3'} bg-black/75 backdrop-blur-md text-white text-[12px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs border border-[var(--border-subtle)]`}>
              <Clock className="w-3 h-3 text-[var(--accent-secondary)]" />
              <span>{duration}</span>
            </div>
          </div>
        </div>

        {/* Right: Info & Pricing (md:col-span-8) */}
        <div className="md:col-span-8 flex flex-col justify-between h-full space-y-4">
          <div>
            {/* Header: Title & Pricing */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl sm:text-2xl chart-heading font-bold text-[var(--text-primary)]">
                  {title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]/70 flex items-center gap-1.5 mt-0.5 font-medium">
                  <Waves className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{location}</span>
                </p>
              </div>

              <div className="text-end flex-shrink-0">
                <div className="flex items-baseline justify-end rtl:justify-start gap-1">
                  <span className="text-2xl font-black text-[var(--accent-secondary)]">
                    {diving.pricePerPersonEGP.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]/60 font-medium">{isAr ? '/ للفرد' : '/ person'}</span>
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]/60 font-semibold mt-0.5">
                  {isAr ? `تقديرياً ${totalPrice.toLocaleString()} ج.م إجمالي (فردين)` : `Est. EGP ${totalPrice.toLocaleString()} total (2 adults)`}
                </div>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]/90 mt-2 leading-relaxed font-normal">
              {description}
            </p>

            {/* Quick Spec Pills */}
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-medium">
                <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{duration}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-medium">
                <Compass className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{level}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-medium">
                <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{group}</span>
              </span>
            </div>

            {/* Includes list */}
            <ul className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[var(--text-secondary)]/80">
              {includes.map((inc, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] flex-shrink-0" />
                  <span className="leading-snug">{inc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom Card Action Bar */}
          <div className="pt-3.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <button
              type="button"
              id={`view-details-${diving.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(diving);
              }}
              className="text-xs font-bold text-[var(--accent-secondary)] hover:text-[var(--text-primary)] transition-colors underline underline-offset-4 cursor-pointer flex items-center gap-1"
            >
              <span>{isAr ? 'عرض التفاصيل' : 'View details'}</span>
            </button>

            <button
              type="button"
              id={`select-diving-btn-${diving.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(diving.id);
              }}
              className={`inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                isSelected
                  ? 'bg-[var(--accent-primary)] hover:brightness-110 text-[var(--accent-primary-ink)] font-bold shadow-md'
                  : 'bg-[var(--accent-secondary)] hover:brightness-110 text-[var(--accent-primary-ink)] font-bold hover:shadow-xs'
              }`}
            >
              {isSelected ? (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{isAr ? 'تم الاختيار ✓' : 'Selected ✓'}</span>
                </>
              ) : (
                <span>{isAr ? 'اختيار هذه التجربة' : 'Select this experience'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </ClickableCard>
  );
});
