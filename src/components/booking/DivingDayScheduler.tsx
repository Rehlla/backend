import React from 'react';
import { Calendar, Clock, AlertCircle, Sparkles, Check, Info, Sun, Utensils, Compass, Waves } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface DivingDaySchedulerProps {
  selectedDay: number; // 2, 3, or 4
  onSelectDay: (day: number) => void;
  selectedTime: string;
}

export const DivingDayScheduler: React.FC<DivingDaySchedulerProps> = ({
  selectedDay,
  onSelectDay,
  selectedTime,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const days = [
    {
      dayNumber: 2,
      label: isAr ? 'اليوم ٢' : 'Day 2',
      badge: isAr ? 'موصى به' : 'Recommended',
      isRecommended: true,
      description: isAr ? 'مجدول بعد قسط كافٍ من الراحة في يوم الوصول' : 'Scheduled after morning rest from arrival day',
    },
    {
      dayNumber: 3,
      label: isAr ? 'اليوم ٣' : 'Day 3',
      badge: isAr ? 'متاح' : 'Available',
      isRecommended: false,
      description: isAr ? 'فترة صباحية في منتصف الرحلة' : 'Mid-trip morning slot',
    },
    {
      dayNumber: 4,
      label: isAr ? 'اليوم ٤' : 'Day 4',
      badge: isAr ? 'متاح' : 'Available',
      isRecommended: false,
      description: isAr ? 'قبل موعد سفاري الصحراء في فترة ما بعد الظهر' : 'Before late afternoon desert safari',
    },
  ];

  return (
    <div
      id="diving-day-scheduler"
      className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h3 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
            {isAr ? 'متى تفضل ممارسة الغطس؟' : 'When would you like to dive?'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]/60 mt-0.5">
            {isAr ? 'منسق بتوافق تام مع وتيرة برنامج رحلتك الممتد لـ ٥ أيام' : 'Coordinated with your 5-day Dahab itinerary pace'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-[var(--surface-container)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)] self-start sm:self-auto">
          <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="font-bold text-[var(--text-primary)]">{isAr ? `الوقت الموصى به: ${selectedTime}` : `Recommended time: ${selectedTime}`}</span>
        </div>
      </div>

      {/* Day Selector Buttons */}
      <div>
        <label className="text-xs font-bold text-[var(--text-primary)] block mb-2">
          {isAr ? 'اختر يوم النشاط في البرنامج' : 'Select itinerary day'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {days.map((d) => {
            const isDaySelected = selectedDay === d.dayNumber;
            return (
              <button
                key={d.dayNumber}
                type="button"
                id={`day-select-btn-${d.dayNumber}`}
                onClick={() => onSelectDay(d.dayNumber)}
                className={`p-4 rounded-2xl border text-start transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer relative flex flex-col justify-between space-y-2 ${
                  isDaySelected
                    ? 'border-[var(--accent-primary)] ring-2 ring-[var(--accent-primary)]/30 bg-[var(--surface-container)] shadow-xs'
                    : d.isRecommended
                    ? 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--surface-container)]/70'
                    : 'border-[var(--border-subtle)] hover:border-[var(--border-subtle)] bg-[var(--surface-container)]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[var(--accent-primary)]" />
                    <span>{d.label}</span>
                  </span>

                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      d.isRecommended
                        ? 'bg-[var(--accent-secondary)]/20 text-[var(--accent-secondary)] border border-[var(--accent-secondary)]/40'
                        : 'bg-[var(--btn-util-bg)] text-[var(--text-secondary)]/60'
                    }`}
                  >
                    {d.badge}
                  </span>
                </div>

                <div className="text-[12px] text-[var(--text-secondary)]/70 leading-tight">
                  {d.description}
                </div>

                <div className="pt-1 flex items-center justify-between text-[12px]">
                  <span className="font-bold text-[var(--accent-primary)]">{selectedTime}</span>
                  {isDaySelected && (
                    <span className="text-[var(--accent-primary)] font-bold flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[2.5]" />
                      <span>{isAr ? 'تم الاختيار' : 'Selected'}</span>
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule Warning if user shifts away from Day 2 */}
      {selectedDay !== 2 && (
        <div
          id="schedule-shift-warning"
          className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/40 text-[var(--accent-secondary)] text-xs flex items-start gap-3 animate-in fade-in duration-150"
        >
          <AlertCircle className="w-4 h-4 text-[var(--accent-secondary)] flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block text-[var(--text-primary)]">
              {isAr ? 'قد يؤثر تعديل موعد هذا النشاط على جدول اليوم الثاني.' : 'Moving this activity may affect your Day 2 schedule.'}
            </span>
            <p className="text-[var(--text-secondary)]/80 text-[12px] leading-relaxed">
              {isAr
                ? `تم تخطيط الغطس في الأساس لصباح اليوم الثاني. تم نقل الموعد إلى اليوم ${selectedDay} في تمام ${selectedTime}. يمكنك مراجعة الجدول المحدث في أي وقت.`
                : `Your generated itinerary originally planned Dahab diving for Day 2 morning. We have slotted diving onto Day ${selectedDay} at ${selectedTime}. You can review the updated timeline anytime.`}
            </p>
          </div>
        </div>
      )}

      {/* Coordinated Schedule Context */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
            <span>{isAr ? `برنامج اليوم ${selectedDay}` : `Your Day ${selectedDay}`}</span>
          </span>
          <span className="text-[12px] text-[var(--text-secondary)]/60 font-medium">
            {isAr ? 'إيقاع متوازن · دون استعجال أو ضغط' : 'Balanced pace · No rushed transfers'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
          {/* 09:00 Diving Activity */}
          <div className="p-3 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 text-[var(--text-primary)] flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Waves className="w-3 h-3" />
            </span>
            <div>
              <div className="font-bold text-xs">{isAr ? '٠٩:٠٠ · الغطس' : '09:00 · Diving'}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/80">
                {isAr ? 'جلسة غطس إرشادية واستكشاف الشعاب' : 'Guided dive session & reef discovery'}
              </div>
            </div>
          </div>

          {/* 13:00 Lunch */}
          <div className="p-3 rounded-xl bg-[var(--surface-card)]/40 border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[var(--btn-util-bg)] text-[var(--accent-primary)] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Utensils className="w-3 h-3" />
            </span>
            <div>
              <div className="font-bold text-xs text-[var(--text-primary)]">{isAr ? '١٣:٠٠ · الغداء' : '13:00 · Lunch'}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/60">
                {isAr ? 'مأكولات بحرية طازجة على البحر' : 'Fresh seaside seafood by the bay'}
              </div>
            </div>
          </div>

          {/* 15:00 Free Time */}
          <div className="p-3 rounded-xl bg-[var(--surface-card)]/40 border border-[var(--border-subtle)] text-[var(--text-primary)] flex items-start gap-2.5">
            <span className="w-6 h-6 rounded-full bg-[var(--btn-util-bg)] text-[var(--accent-primary)] font-bold text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sun className="w-3 h-3" />
            </span>
            <div>
              <div className="font-bold text-xs text-[var(--text-primary)]">{isAr ? '١٥:٠٠ · وقت حر' : '15:00 · Free Time'}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/60">
                {isAr ? 'جولة في مقاهي الممشى أو استرخاء على الشاطئ' : 'Lighthouse cafe stroll or beach rest'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
