import React from 'react';
import { 
  X, 
  Check, 
  Clock, 
  Compass, 
  Users, 
  ShieldCheck, 
  SunMedium, 
  MapPin, 
  Luggage,
  CalendarCheck
} from 'lucide-react';
import { SafariOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';

interface SafariDetailModalProps {
  safari: SafariOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export const SafariDetailModal: React.FC<SafariDetailModalProps> = ({
  safari,
  isSelected,
  onSelect,
  onClose,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const totalPrice = safari.pricePerPersonEGP * 2;
  const title = isAr && safari.titleAr ? safari.titleAr : safari.title;
  const badgeLabel = isAr && safari.badgeLabelAr ? safari.badgeLabelAr : safari.badgeLabel;
  const description = isAr && safari.descriptionAr ? safari.descriptionAr : safari.description;
  const duration = isAr && safari.durationAr ? safari.durationAr : safari.duration;
  const difficulty = isAr && safari.difficultyAr ? safari.difficultyAr : safari.difficulty;
  const group = isAr && safari.groupAr ? safari.groupAr : safari.group;
  const location = isAr && safari.locationAr ? safari.locationAr : safari.location;
  const includesList = isAr && safari.includesAr ? safari.includesAr : safari.includes;
  const whatToBringList = isAr && safari.whatToBringAr ? safari.whatToBringAr : safari.whatToBring;
  const meetingInfo = isAr && safari.meetingInfoAr ? safari.meetingInfoAr : safari.meetingInfo;
  const safetyInfo = isAr && safari.safetyInfoAr ? safari.safetyInfoAr : safari.safetyInfo;
  const cancellationPolicy = isAr && safari.cancellationPolicyAr ? safari.cancellationPolicyAr : safari.cancellationPolicy;

  return (
    <div
      id="safari-detail-modal"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    
      role="dialog"
      aria-modal="true"
      aria-labelledby="safari-detail-modal-dialog-1-title"
    >
      <div className="bg-[var(--surface-card)] text-[var(--text-primary)] w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] flex flex-col max-h-[90vh] my-auto">
        {/* Modal Header with Close Button */}
        <div className="relative h-48 sm:h-64 w-full bg-[var(--surface-card)]/10 flex-shrink-0">
          <img
            src={safari.image}
            alt={title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-card)] via-black/40 to-transparent" />

          {/* Close X Button */}
          <button
            type="button"
            id="close-safari-detail-btn"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-9 h-9 rounded-full bg-black/60 hover:bg-black/80 text-[var(--text-primary)] flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer border border-[var(--border-subtle)]`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top Badges */}
          <div className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} flex items-center gap-2`}>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--surface-card)]/90 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 backdrop-blur-md shadow-sm">
              {badgeLabel}
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-black/60 text-[var(--text-primary)] backdrop-blur-md flex items-center gap-1.5 border border-[var(--border-subtle)]">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>{duration}</span>
            </span>
          </div>

          {/* Title on bottom of banner */}
          <div className="absolute bottom-4 left-4 right-4 text-[var(--text-primary)]">
            <h2 id="safari-detail-modal-dialog-1-title" className="text-2xl sm:text-3xl chart-heading font-bold tracking-tight">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-[var(--accent-secondary)]" />
              <span>{location}</span>
            </p>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          {/* Overview Description */}
          <div>
            <h3 className="text-xs font-bold text-[var(--accent-primary)] mb-1.5">
              {isAr ? 'نظرة عامة على التجربة' : 'Experience overview'}
            </h3>
            <p className="text-sm sm:text-base text-[var(--text-secondary)]/80 leading-relaxed">
              {description} {isAr ? 'اكتشف روعة الممرات الصخرية والرمال الذهبية وهضاب سيناء الساحرة في مشهد لا يُنسى عند الغروب.' : 'Discover the mystical granite canyons, sweeping golden dunes, and silent Bedouin mountain plateaus framed by warm desert sunset hues.'}
            </p>
          </div>

          {/* Key Activity Attributes Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]/60 font-semibold">
                <Clock className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'المدة' : 'Duration'}</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{duration}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/60 font-normal">{isAr ? 'حوالي ٤ ساعات إجمالاً' : 'Approx 4 hrs total'}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]/60 font-semibold">
                <Compass className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'مستوى الصعوبة' : 'Difficulty'}</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{difficulty}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/60 font-normal">{isAr ? 'مناسب وممتع للجميع' : 'Accessible for friends'}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]/60 font-semibold">
                <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'حجم المجموعة' : 'Group Size'}</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{group}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/60 font-normal">{isAr ? 'مجموعة مصغرة وخاصة' : 'Small intimate group'}</div>
            </div>
          </div>

          {/* Included Features & What to Bring */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[var(--border-subtle)]">
            {/* What's Included */}
            <div>
              <h4 className="text-xs font-bold text-[var(--accent-primary)] mb-3 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[var(--accent-primary)] stroke-[2.5]" />
                <span>{isAr ? 'ما تشمله الرحلة' : 'What is included'}</span>
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]/80">
                {includesList.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* What to Bring */}
            <div>
              <h4 className="text-xs font-bold text-[var(--accent-primary)] mb-3 flex items-center gap-1.5">
                <Luggage className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'ما يجب إحضاره معك' : 'What to bring'}</span>
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]/80">
                {whatToBringList.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-primary)] flex-shrink-0 mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Meeting & Safety Info */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3 text-xs">
            <div>
              <span className="font-bold text-[var(--text-primary)] block mb-0.5">
                {isAr ? 'معلومات التجمع والتحرك:' : 'Meeting & Pickup Information:'}
              </span>
              <p className="text-[var(--text-secondary)]/70 font-normal leading-relaxed">
                {meetingInfo}
              </p>
            </div>
            <div className="border-t border-[var(--border-subtle)] pt-2">
              <span className="font-bold text-[var(--text-primary)] block mb-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{isAr ? 'معايير الأمان وسلامة المسار:' : 'Safety & Terrain Standards:'}</span>
              </span>
              <p className="text-[var(--text-secondary)]/70 font-normal leading-relaxed">
                {safetyInfo}
              </p>
            </div>
            <div className="border-t border-[var(--border-subtle)] pt-2">
              <span className="font-bold text-[var(--text-primary)] block mb-0.5 flex items-center gap-1">
                <CalendarCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{isAr ? 'سياسة الإلغاء وتعديل المواعيد:' : 'Cancellation & Rescheduling:'}</span>
              </span>
              <p className="text-[var(--text-secondary)]/70 font-normal leading-relaxed">
                {cancellationPolicy}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Sticky Footer Action */}
        <div className="p-4 sm:p-6 bg-[var(--surface-container)] border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-[var(--text-primary)]">
                {safari.pricePerPersonEGP.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}
              </span>
              <span className="text-xs text-[var(--text-secondary)]/60 font-medium">{isAr ? '/ فرد' : '/ person'}</span>
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]/60 font-semibold">
              {isAr ? `تقديري ${totalPrice.toLocaleString()} ج.م إجمالي (فردين)` : `Estimated EGP ${totalPrice.toLocaleString()} total (2 adults)`}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 sm:w-auto px-5 py-3 rounded-full text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]/10 border border-[var(--border-subtle)] transition-colors"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>

            <button
              type="button"
              id={`modal-select-safari-${safari.id}`}
              onClick={() => {
                onSelect(safari.id);
                onClose();
              }}
              className={`w-1/2 sm:w-auto px-7 py-3 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                isSelected
                  ? 'bg-[var(--accent-primary)] hover:brightness-110 text-[var(--accent-primary-ink)]'
                  : 'bg-[var(--accent-primary)] hover:brightness-110 text-[var(--accent-primary-ink)]'
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
    </div>
  );
};
