import React from 'react';
import { 
  X, 
  Check, 
  Clock, 
  Compass, 
  Users, 
  ShieldCheck, 
  Waves, 
  MapPin, 
  AlertCircle, 
  Info, 
  Sparkles,
  Luggage,
  CalendarCheck
} from 'lucide-react';
import { DivingOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';

interface DivingDetailModalProps {
  diving: DivingOption;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export const DivingDetailModal: React.FC<DivingDetailModalProps> = ({
  diving,
  isSelected,
  onSelect,
  onClose,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const totalPrice = diving.pricePerPersonEGP * 2;
  const title = isAr && diving.titleAr ? diving.titleAr : diving.title;
  const description = isAr && diving.descriptionAr ? diving.descriptionAr : diving.description;
  const location = isAr && diving.locationAr ? diving.locationAr : diving.location;
  const badgeLabel = isAr && diving.badgeLabelAr ? diving.badgeLabelAr : diving.badgeLabel;
  const duration = isAr && diving.durationAr ? diving.durationAr : diving.duration;
  const level = isAr && diving.levelAr ? diving.levelAr : diving.level;
  const group = isAr && diving.groupAr ? diving.groupAr : diving.group;
  const includes = isAr && diving.includesAr ? diving.includesAr : diving.includes;
  const whatToBring = isAr && diving.whatToBringAr ? diving.whatToBringAr : diving.whatToBring;
  const meetingInfo = isAr && diving.meetingInfoAr ? diving.meetingInfoAr : diving.meetingInfo;
  const safetyInfo = isAr && diving.safetyInfoAr ? diving.safetyInfoAr : diving.safetyInfo;
  const cancellationPolicy = isAr && diving.cancellationPolicyAr ? diving.cancellationPolicyAr : diving.cancellationPolicy;

  return (
    <div
      id="diving-detail-modal"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    
      role="dialog"
      aria-modal="true"
      aria-labelledby="diving-detail-modal-dialog-1-title"
    >
      <div className="bg-[var(--surface-card)] text-[var(--text-primary)] w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl border border-white/15 flex flex-col max-h-[90vh] my-auto">
        {/* Modal Header with Close Button */}
        <div className="relative h-48 sm:h-64 w-full bg-black/40 flex-shrink-0">
          <img
            src={diving.image}
            alt={title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-card)] via-black/40 to-transparent" />

          {/* Close X Button */}
          <button
            type="button"
            id="close-diving-detail-btn"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} w-9 h-9 rounded-full bg-black/60 hover:bg-black/90 text-[var(--text-primary)] flex items-center justify-center backdrop-blur-md transition-colors cursor-pointer`}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Top Badges */}
          <div className={`absolute top-4 ${isRTL ? 'right-4' : 'left-4'} flex items-center gap-2`}>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-[var(--accent-secondary)] text-[var(--surface-container)] backdrop-blur-md shadow-sm">
              {badgeLabel}
            </span>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-black/60 text-[var(--text-primary)] backdrop-blur-md flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{duration}</span>
            </span>
          </div>

          {/* Title on bottom of banner */}
          <div className="absolute bottom-4 left-4 right-4 text-[var(--text-primary)]">
            <h2 id="diving-detail-modal-dialog-1-title" className="text-2xl sm:text-3xl chart-heading font-bold tracking-tight text-[var(--text-primary)]">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]/80 flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-[var(--accent-primary)]" />
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
            <p className="text-sm sm:text-base text-[var(--text-secondary)]/90 leading-relaxed font-normal">
              {description} {isAr ? 'تتميز طبيعة دهب الساحلية برؤية نقية تحت الماء تتجاوز ٣٠ متراً وشعاب مرجانية خلابة ونقاط دخول هادئة على طول خليج العقبة.' : "Dahab's legendary coastal topography offers crystal-clear visibility exceeding 30 meters, vibrant coral pinnacles, and calm entry points along the Gulf of Aqaba."}
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
              <div className="text-[12px] text-[var(--text-secondary)]/50 font-normal">{isAr ? 'حوالي ٣–٤ ساعات إجمالاً' : 'Approx 3–4 hrs total'}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]/60 font-semibold">
                <Compass className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'مستوى التجربة' : 'Experience Level'}</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{level}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/50 font-normal">{isAr ? 'لا تشترط شهادة غطس مسبقة' : 'No prior depth cert required'}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]/60 font-semibold">
                <Users className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>{isAr ? 'حجم المجموعة' : 'Group Size'}</span>
              </div>
              <div className="text-sm font-bold text-[var(--text-primary)]">{group}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/50 font-normal">{isAr ? 'اهتمام وإرشاد فردي مضمون' : 'Personal attention guaranteed'}</div>
            </div>
          </div>

          {/* Included Features & What to Bring */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-[var(--border-subtle)]">
            {/* What's Included */}
            <div>
              <h4 className="text-xs font-bold text-[var(--accent-primary)] mb-3 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-[var(--accent-primary)] stroke-[2.5]" />
                <span>{isAr ? 'ما تتضمنه التجربة' : 'What is included'}</span>
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]/90">
                {includes.map((item, idx) => (
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
                <span>{isAr ? 'ما يجب إحضاره' : 'What to bring'}</span>
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-[var(--text-secondary)]/90">
                {whatToBring.map((item, idx) => (
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
                {isAr ? 'معلومات التجمع والاستقبال:' : 'Meeting & Pickup Information:'}
              </span>
              <p className="text-[var(--text-secondary)]/70 font-normal leading-relaxed">
                {meetingInfo}
              </p>
            </div>
            <div className="border-t border-[var(--border-subtle)] pt-2">
              <span className="font-bold text-[var(--text-primary)] block mb-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{isAr ? 'معايير السلامة والمعدات:' : 'Safety & Equipment Standards:'}</span>
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
                {diving.pricePerPersonEGP.toLocaleString()} {isAr ? 'ج.م' : 'EGP'}
              </span>
              <span className="text-xs text-[var(--text-secondary)]/60 font-medium">{isAr ? '/ للفرد' : '/ person'}</span>
            </div>
            <div className="text-[12px] text-[var(--text-secondary)]/70 font-semibold">
              {isAr ? `تقديرياً ${totalPrice.toLocaleString()} ج.م إجمالي (فردين)` : `Estimated EGP ${totalPrice.toLocaleString()} total (2 adults)`}
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 sm:w-auto px-5 py-3 rounded-full text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]/10 border border-[var(--border-subtle)] transition-colors cursor-pointer"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>

            <button
              type="button"
              id={`modal-select-diving-${diving.id}`}
              onClick={() => {
                onSelect(diving.id);
                onClose();
              }}
              className={`w-1/2 sm:w-auto px-7 py-3 rounded-full text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-md cursor-pointer flex items-center justify-center gap-2 ${
                isSelected
                  ? 'bg-[var(--accent-primary)] hover:brightness-110 text-[var(--accent-primary-ink)]'
                  : 'bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--surface-container)]'
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
