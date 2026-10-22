import React from 'react';
import { X, ShieldCheck, Clock, Check, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface BookingReviewTermsModalProps {
  onClose: () => void;
}

export const BookingReviewTermsModal: React.FC<BookingReviewTermsModalProps> = ({ onClose }) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  return (
    <div
      id="booking-review-terms-modal"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-review-terms-modal-dialog-1-title"
    >
      <div className="bg-[var(--surface-card)] text-[var(--text-primary)] w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] flex flex-col max-h-[90vh] my-auto">
        {/* Modal Header */}
        <div className="p-6 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--surface-container)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[var(--accent-secondary)]/15 flex items-center justify-center text-[var(--accent-secondary)]">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 id="booking-review-terms-modal-dialog-1-title" className="text-lg chart-heading font-bold text-[var(--text-primary)]">
                {isAr ? 'شروط وسياسات الحجز' : 'Booking Terms & Policies'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {isAr ? 'شروط مرنة وشفافة لرحلتك إلى دهب' : 'Transparent and flexible terms for your Dahab journey'}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="close-terms-modal-btn"
            onClick={onClose}
            aria-label={isAr ? 'إغلاق' : 'Close'}
            className="w-8 h-8 rounded-full hover:bg-[var(--surface-container)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1 text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
          {/* Section 1: Coordinated Trip Guarantee */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-2">
            <h4 className="font-bold text-xs text-[var(--accent-secondary)] flex items-center gap-1.5">
              <Check className="w-4 h-4 text-[var(--accent-primary)] stroke-[2.5]" />
              <span>{isAr ? 'ضمان تنسيق الرحلة الشاملة' : 'Coordinated Trip Guarantee'}</span>
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {isAr
                ? 'فندقك وانتقالات المطار وباقات الغطس وسفاري الصحراء محجوزة معاً كبرنامج رحلة واحد منسق. في حالة تأخر الطيران أو تغير الأحوال الجوية، يتولى فريقنا المحلي في دهب تعديل كافة المواعيد والأنشطة المرتبطة بسلاسة وتناغم تام.'
                : 'Your hotel, airport transfer, guided diving, and desert safari are booked together as one unified itinerary. If flight delays or weather conditions require shifting an activity, our local Dahab team coordinates adjustments across all related services seamlessly.'}
            </p>
          </div>

          {/* Section 2: Cancellation & Changes by Service */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs text-[var(--accent-secondary)]">
              {isAr ? 'فترات الإلغاء وتعديل المواعيد' : 'Cancellation & Rescheduling Windows'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">{isAr ? '٠١ الإقامة الفندقية' : '01 Hotel Accommodation'}</span>
                <p className="text-[var(--text-secondary)]">
                  {isAr ? 'إلغاء مجاني أو تعديل التاريخ حتى ٤٨ ساعة قبل موعد تسجيل الدخول.' : 'Free cancellation or date adjustment up to 48 hours prior to your scheduled check-in.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">{isAr ? '٠٢ انتقالات المطار' : '02 Airport Transfer'}</span>
                <p className="text-[var(--text-secondary)]">
                  {isAr ? 'تحديث مجاني لوقت وصول الرحلة حتى ١٢ ساعة قبل الهبوط في شرم الشيخ.' : 'Free flight arrival time updates up to 12 hours before airport landing in Sharm El Sheikh.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">{isAr ? '٠٣ رحلات الغطس الإرشادية' : '03 Guided Diving'}</span>
                <p className="text-[var(--text-secondary)]">
                  {isAr ? 'استرداد كامل أو نقل اليوم مجاناً حتى ٢٤ ساعة قبل موعد الغطس.' : 'Full refund or free day shift up to 24 hours prior to dive briefing.'}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] space-y-1">
                <span className="font-bold text-[var(--text-primary)] block">{isAr ? '٠٤ سفاري الصحراء' : '04 Desert Safari'}</span>
                <p className="text-[var(--text-secondary)]">
                  {isAr ? 'إلغاء مجاني أو إعادة جدولة بسبب الطقس حتى ٢٤ ساعة قبل التحرك.' : 'Free cancellation or weather rescheduling up to 24 hours before desert departure.'}
                </p>
              </div>
            </div>
          </div>

          {/* Section 3: Pricing & Availability Notice */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] text-[var(--text-primary)] space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
              <AlertCircle className="w-4 h-4 text-[var(--accent-secondary)]" />
              <span>{isAr ? 'شفافية الأسعار والمصاريف' : 'Transparent Pricing'}</span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {isAr
                ? 'الأسعار التقديرية معروضة لكامل المجموعة (فردين بالغين). يتم التحقق النهائي من التوافر وتأكيد السعر بدقة قبل خطوة الدفع النهائية. لا توجد أي رسوم إضافية مخفية أو مفاجئة.'
                : 'Estimated prices are displayed for your complete party (2 adults). Final availability and exact price confirmation are verified in the final confirmation stage before any payment is collected. No unexpected surcharge or hidden platform fee is added.'}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-6 bg-[var(--surface-container)] border-t border-[var(--border-subtle)] flex items-center justify-end">
          <button
            type="button"
            id="close-terms-footer-btn"
            onClick={onClose}
            className="px-6 py-2.5 rounded-full bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] hover:brightness-110 text-[var(--accent-primary-ink)] text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] shadow-xs cursor-pointer"
          >
            {isAr ? 'فهمت ذلك' : 'I Understand'}
          </button>
        </div>
      </div>
    </div>
  );
};

