import React from 'react';
import { Check, Sparkles, Clock, Compass, Users, ShieldCheck, SunMedium, Flame, Info } from 'lucide-react';
import { SafariOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';
import { ClickableCard } from '../common/ClickableCard';

interface SafariOptionCardProps {
  safari: SafariOption;
  isSelected: boolean;
  onSelect: (safariId: string) => void;
  onViewDetails: (safari: SafariOption) => void;
}

export const SafariOptionCard: React.FC<SafariOptionCardProps> = React.memo(({
  safari,
  isSelected,
  onSelect,
  onViewDetails,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const getBadgeStyle = () => {
    switch (safari.badgeType) {
      case 'match':
        return 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border-[var(--accent-secondary)]/40';
      case 'adventure':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/40';
      case 'relaxed':
        return 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/40';
      default:
        return 'bg-[var(--surface-card)]/10 text-[var(--text-secondary)] border-[var(--border-subtle)]';
    }
  };

  const totalPrice = safari.pricePerPersonEGP * 2;
  const title = isAr && safari.titleAr ? safari.titleAr : safari.title;
  const badgeLabel = isAr && safari.badgeLabelAr ? safari.badgeLabelAr : safari.badgeLabel;
  const description = isAr && safari.descriptionAr ? safari.descriptionAr : safari.description;
  const duration = isAr && safari.durationAr ? safari.durationAr : safari.duration;
  const difficulty = isAr && safari.difficultyAr ? safari.difficultyAr : safari.difficulty;
  const group = isAr && safari.groupAr ? safari.groupAr : safari.group;
  const location = isAr && safari.locationAr ? safari.locationAr : safari.location;
  const includesList = isAr && safari.includesAr ? safari.includesAr : safari.includes;

  return (
    <ClickableCard
      id={`safari-card-${safari.id}`}
      onClick={() => onSelect(safari.id)}
      className={`rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 overflow-hidden bg-[var(--surface-card)] text-[var(--text-primary)] relative ${
        isSelected
          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30 shadow-lg'
          : safari.badgeType === 'match'
          ? 'border-[var(--accent-secondary)]/40 hover:border-[var(--accent-secondary)] shadow-md'
          : 'border-[var(--border-subtle)] hover:border-white/20 shadow-md'
      }`}
    >
      {/* Top Banner for Best Match / Recommended */}
      {safari.badgeType === 'match' && (
        <div className="bg-[var(--surface-container)] border-b border-[var(--accent-secondary)]/30 px-5 sm:px-6 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-secondary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)] fill-[var(--accent-secondary)]" />
            <span>{isAr ? 'الخيار الأنسب لرحلتك' : 'Recommended for your trip'}</span>
          </div>
          <span className="text-[12px] font-medium text-[var(--accent-secondary)]/80 hidden sm:inline">
            {isAr ? 'يتوافق مع الإيقاع المتوازن واستكشاف الصحراء' : 'Matches your balanced pace & desert adventure'}
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left: Visual Asset & Duration Pill (md:col-span-4) */}
        <div className="md:col-span-4 relative">
          <div className="relative h-44 sm:h-48 md:h-52 w-full rounded-2xl overflow-hidden bg-black/40">
            <img
              src={safari.image}
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
                  <SunMedium className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{location}</span>
                </p>
              </div>

              <div className="text-end flex-shrink-0">
                <div className="flex items-baseline justify-end rtl:justify-start gap-1">
                  <span className="text-2xl font-black text-[var(--accent-secondary)]">
                    {safari.pricePerPersonEGP.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]/60 font-medium">{isAr ? '/ فرد' : '/ person'}</span>
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]/60 font-semibold mt-0.5">
                  {isAr ? `تقديري ${totalPrice.toLocaleString()} ج.م إجمالي (فردين)` : `Est. EGP ${totalPrice.toLocaleString()} total (2 adults)`}
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
                <span>{difficulty}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-medium">
                <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{group}</span>
              </span>
            </div>

            {/* Includes list */}
            <ul className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[var(--text-secondary)]/80">
              {includesList.map((inc, idx) => (
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
              id={`view-safari-details-${safari.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails(safari);
              }}
              className="text-xs font-bold text-[var(--accent-secondary)] hover:text-[var(--text-primary)] transition-colors underline underline-offset-4 cursor-pointer flex items-center gap-1"
            >
              <span>{isAr ? 'عرض التفاصيل الكاملة' : 'View details'}</span>
            </button>

            <button
              type="button"
              id={`select-safari-btn-${safari.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(safari.id);
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
