import React from 'react';
import { 
  X, 
  Hotel, 
  PlusCircle, 
  MinusCircle, 
  Wallet, 
  CalendarDays, 
  RefreshCw, 
  Check, 
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface TripCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
}

export const TripCustomizeModal: React.FC<TripCustomizeModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  if (!isOpen) return null;

  const customizationOptions = [
    {
      id: 'hotel',
      icon: <Hotel className="w-4 h-4 text-[var(--accent-secondary)]" />,
      title: isAr ? 'تغيير الفندق أو مكان الإقامة' : 'Change Hotel or Stays',
      description: isAr ? 'التبديل بين إيكو لودج شاطئي، فنادق بوتيك، أو شقق خاصة هادئة.' : 'Switch between beachfront eco-lodges, boutique hotels, or private apartments.',
      badge: isAr ? 'متاح أثناء الحجز' : 'Available during booking',
    },
    {
      id: 'add-activity',
      icon: <PlusCircle className="w-4 h-4 text-[var(--accent-secondary)]" />,
      title: isAr ? 'إضافة نشاط جديد' : 'Add Activity',
      description: isAr ? 'أضف ركوب الأمواج، مدخل للغوص الحر، أو شروق الشمس من جبل موسى.' : 'Include windsurfing, freediving intro, or Mount Sinai sunrise hike.',
      badge: isAr ? 'إضافة مرنة' : 'Flexible add-on',
    },
    {
      id: 'remove-activity',
      icon: <MinusCircle className="w-4 h-4 text-[var(--accent-secondary)]" />,
      title: isAr ? 'حذف أو استبدال نشاط' : 'Remove / Replace Activity',
      description: isAr ? 'استبدل أي فعالية مقترحة بوقت استرخاء حر ومفتوح.' : 'Swap out any suggested event for more open relaxation time.',
      badge: isAr ? 'بدون أي رسوم' : 'Zero fees',
    },
    {
      id: 'adjust-budget',
      icon: <Wallet className="w-4 h-4 text-[var(--accent-secondary)]" />,
      title: isAr ? 'تغيير فئة الميزانية' : 'Change Budget Tier',
      description: isAr ? 'إعادة ضبط التجربة بين الفئة الاقتصادية، المتوسطة، أو الفاخرة.' : 'Recalibrate between Budget, Moderate, or Premium stays and experiences.',
      badge: isAr ? 'المتوسطة حالياً' : 'Moderate currently',
    },
    {
      id: 'adjust-days',
      icon: <CalendarDays className="w-4 h-4 text-[var(--accent-secondary)]" />,
      title: isAr ? 'تعديل جدول يوم محدد' : 'Adjust a Specific Day',
      description: isAr ? 'نقل موعد الغطس للصباح أو استبدال سفاري الكانيون برحلة بحرية.' : 'Shift diving to morning or swap afternoon canyon safari with boat trip.',
      badge: isAr ? 'الأيام ١–٥' : 'Day 1–5',
    },
    {
      id: 'alternatives',
      icon: <RefreshCw className="w-4 h-4 text-[var(--accent-secondary)]" />,
      title: isAr ? 'استكشاف جميع البدائل' : 'Explore All Alternatives',
      description: isAr ? 'تصفح خيارات بديلة لرحلات السفاري، القوارب، والمطاعم.' : 'Browse backup options for safaris, boat trips, and dining spots.',
      badge: isAr ? 'تبديل فوري' : 'Instant swap',
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div 
        className="bg-[var(--surface-card)] text-[var(--text-primary)] rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-[var(--border-subtle)] shadow-2xl p-6 sm:p-8 relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customize-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)] mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[var(--accent-secondary)]/15 flex items-center justify-center text-[var(--accent-secondary)]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 id="customize-modal-title" className="text-xl chart-heading font-bold text-[var(--text-primary)]">
                {isAr ? 'تخصيص رحلتك في دهب' : 'Customize Your Trip'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]/70 font-normal">
                {isAr ? 'عدّل كافة تفاصيل برنامج رحلتك الـ ٥ أيام' : 'Shape every detail of your 5-day Dahab experience'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق نافذة التخصيص' : 'Close customization modal'}
            className="w-8 h-8 rounded-full bg-[var(--surface-card)]/10 hover:bg-[var(--surface-card)]/15 flex items-center justify-center text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Options List */}
        <div className="space-y-3 mb-6">
          {customizationOptions.map((opt) => (
            <div
              key={opt.id}
              className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-secondary)]/40 hover:bg-[var(--surface-container)]/90 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer group flex items-start justify-between gap-4"
              onClick={onApply}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                  {opt.icon}
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-secondary)] transition-colors">
                    {opt.title}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]/70 mt-0.5 leading-relaxed font-normal">
                    {opt.description}
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-semibold text-[var(--accent-secondary)] bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/20 px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 self-start">
                {opt.badge}
              </span>
            </div>
          ))}
        </div>

        {/* Notice Info */}
        <div className="p-3.5 rounded-xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex items-start gap-2.5 text-xs text-[var(--text-secondary)] mb-6">
          <Info className="w-4 h-4 text-[var(--accent-secondary)] flex-shrink-0 mt-0.5" />
          <span>
            {isAr
              ? 'يمكنك تعديل أو تبديل أي نشاط فردي الآن أو لاحقاً عند تأكيد الحجز النهائي.'
              : 'You can customize or swap any single activity now or during the final booking checkout.'}
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)]/5 transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => {
              onApply();
              onClose();
            }}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[var(--accent-secondary)] hover:bg-amber-300 text-[var(--surface-container)] text-xs font-bold tracking-tight shadow-sm transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
          >
            <span>{isAr ? 'تم التخصيص' : 'Done Customizing'}</span>
            <Check className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

