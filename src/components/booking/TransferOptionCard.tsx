import React from 'react';
import { Check, Sparkles, ShieldCheck, Clock, Users, Luggage, Car, Zap } from 'lucide-react';
import { TransferOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';
import { ClickableCard } from '../common/ClickableCard';

interface TransferOptionCardProps {
  transfer: TransferOption;
  isSelected: boolean;
  onSelect: (transferId: string) => void;
}

export const TransferOptionCard: React.FC<TransferOptionCardProps> = React.memo(({
  transfer,
  isSelected,
  onSelect,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const title = isAr && transfer.titleAr ? transfer.titleAr : transfer.title;
  const vehicleType = isAr && transfer.vehicleTypeAr ? transfer.vehicleTypeAr : transfer.vehicleType;
  const description = isAr && transfer.descriptionAr ? transfer.descriptionAr : transfer.description;
  const capacity = isAr && transfer.capacityAr ? transfer.capacityAr : transfer.capacity;
  const luggage = isAr && transfer.luggageAr ? transfer.luggageAr : transfer.luggage;
  const estimatedTime = isAr && transfer.estimatedTimeAr ? transfer.estimatedTimeAr : transfer.estimatedTime;
  const features = isAr && transfer.featuresAr ? transfer.featuresAr : transfer.features;
  const badgeLabel = isAr && transfer.badgeLabelAr ? transfer.badgeLabelAr : transfer.badgeLabel;

  const getBadgeStyle = () => {
    switch (transfer.badgeType) {
      case 'recommended':
        return 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border-[var(--accent-secondary)]/40';
      case 'value':
        return 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/40';
      case 'comfort':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-[var(--surface-card)]/10 text-[var(--text-secondary)] border-[var(--border-subtle)]';
    }
  };

  return (
    <ClickableCard
      id={`transfer-card-${transfer.id}`}
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={() => onSelect(transfer.id)}
      className={`rounded-3xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 overflow-hidden bg-[var(--surface-card)] text-[var(--text-primary)] relative ${
        isSelected
          ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30 shadow-lg'
          : transfer.badgeType === 'recommended'
          ? 'border-[var(--accent-secondary)]/40 hover:border-[var(--accent-secondary)] shadow-md'
          : 'border-[var(--border-subtle)] hover:border-white/20 shadow-md'
      }`}
    >
      {/* Recommended/Highlight Top Banner if applicable */}
      {transfer.badgeType === 'recommended' && (
        <div className="bg-[var(--surface-container)] border-b border-[var(--accent-secondary)]/30 px-5 sm:px-6 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-secondary)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)] fill-[var(--accent-secondary)]" />
            <span>{isAr ? 'مرشح ومثالي لرحلتك' : 'Recommended for your trip'}</span>
          </div>
          <span className="text-[12px] font-medium text-[var(--accent-secondary)]/80 hidden sm:inline">
            {isAr ? 'انتقال مباشر ومريح للمسافرين الاثنين معاً' : 'Direct and convenient for 2 travelers sharing'}
          </span>
        </div>
      )}

      <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Left Column: Image & Badges (md:col-span-4) */}
        <div className="md:col-span-4 relative">
          <div className="relative h-44 sm:h-48 md:h-52 w-full rounded-2xl overflow-hidden bg-black/40">
            <img
              src={transfer.image}
              alt={title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
            />

            {/* Top Badge */}
            {badgeLabel && (
              <div
                className={`absolute top-3 ${isRTL ? 'right-3' : 'left-3'} text-[12px] font-bold px-2.5 py-1 rounded-full border backdrop-blur-md shadow-xs ${getBadgeStyle()}`}
              >
                {badgeLabel}
              </div>
            )}

            {/* Selected Status Overlay badge */}
            {isSelected && (
              <div className={`absolute top-3 ${isRTL ? 'left-3' : 'right-3'} bg-[var(--accent-primary)] text-[var(--surface-container)] text-[12px] font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md animate-in zoom-in-90 duration-150`}>
                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isAr ? 'تم الاختيار' : 'Selected'}</span>
              </div>
            )}

            {/* Estimated Duration Pill */}
            <div className={`absolute bottom-3 ${isRTL ? 'right-3' : 'left-3'} bg-black/75 backdrop-blur-md text-white text-[12px] font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs border border-[var(--border-subtle)]`}>
              <Clock className="w-3 h-3 text-[var(--accent-secondary)]" />
              <span>{estimatedTime}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Title, Description, Included Features, Price & Action (md:col-span-8) */}
        <div className="md:col-span-8 flex flex-col justify-between h-full space-y-4">
          <div>
            {/* Header: Title & Price */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl sm:text-2xl chart-heading font-bold text-[var(--text-primary)]">
                  {title}
                </h3>
                <p className="text-xs text-[var(--text-secondary)]/70 flex items-center gap-1.5 mt-0.5 font-medium">
                  <Car className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                  <span>{vehicleType}</span>
                </p>
              </div>

              <div className="text-start sm:text-end">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-2xl font-black text-[var(--accent-secondary)]">
                    {transfer.priceEGP.toLocaleString()} {isAr ? 'جنيه' : 'EGP'}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--text-secondary)]/60 font-medium">
                  {isAr ? 'إجمالي للمسافرين الاثنين' : 'Total for 2 travelers'}
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
                <Users className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{capacity}</span>
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-medium">
                <Luggage className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{luggage}</span>
              </span>
            </div>

            {/* Key Features List */}
            <ul className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-[var(--text-secondary)]/80">
              {features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] flex-shrink-0" />
                  <span className="leading-snug">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom Card Action Bar */}
          <div className="pt-3.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
            <div className="text-[12px] text-[var(--text-secondary)]/70 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{isAr ? 'استقبال مباشر من مطار شرم الشيخ' : 'Direct Sharm Airport pickup'}</span>
            </div>

            <button
              type="button"
              id={`select-transfer-btn-${transfer.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(transfer.id);
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
                <span>{isAr ? 'اختيار وسيلة الانتقال' : 'Select this transfer'}</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </ClickableCard>
  );
});

