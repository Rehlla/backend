import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Sparkles, 
  Check, 
  SunMedium, 
  Utensils, 
  Coffee, 
  Compass, 
  Moon, 
  Flame 
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

interface SafariDaySchedulerProps {
  selectedDay: number; // 3 (recommended), 4, or 2
  onSelectDay: (day: number) => void;
  selectedTime: string;
  divingDay: number; // 2 by default
}

export const SafariDayScheduler: React.FC<SafariDaySchedulerProps> = ({
  selectedDay,
  onSelectDay,
  selectedTime,
  divingDay,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const [conflictPromptDay, setConflictPromptDay] = useState<number | null>(null);

  const days = [
    {
      dayNumber: 3,
      label: isAr ? 'اليوم ٣' : 'Day 3',
      badge: isAr ? 'موصى به' : 'Recommended',
      isRecommended: true,
      description: isAr ? 'موعد مثالي بعد الظهر مع صباح مريح للاستجمام' : 'Ideal afternoon slot with unhurried morning rest',
    },
    {
      dayNumber: 4,
      label: isAr ? 'اليوم ٤' : 'Day 4',
      badge: isAr ? 'متاح' : 'Available',
      isRecommended: false,
      description: isAr ? 'سهرة وداع واستكشاف الغروب في أواخر الرحلة' : 'Late-trip desert sunset farewell',
    },
    {
      dayNumber: 2,
      label: isAr ? 'اليوم ٢' : 'Day 2',
      badge: isAr ? 'متاح' : 'Available',
      isRecommended: false,
      description: isAr ? 'في نفس يوم نشاط الغطس الصباحي' : 'Same day as diving morning activity',
    },
  ];

  const handleDayClick = (dayNum: number) => {
    // If selecting the day that already has diving (Day 2 or divingDay), show prompt
    if (dayNum === divingDay && selectedDay !== dayNum) {
      setConflictPromptDay(dayNum);
    } else {
      setConflictPromptDay(null);
      onSelectDay(dayNum);
    }
  };

  const confirmConflictDay = (dayNum: number) => {
    onSelectDay(dayNum);
    setConflictPromptDay(null);
  };

  return (
    <div
      id="safari-day-scheduler"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-4">
        <div>
          <h3 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
            {isAr ? 'في أي يوم تفضل الانطلاق بالسفاري؟' : 'When would you like to go?'}
          </h3>
          <p className="text-xs text-[var(--text-secondary)]/60 mt-0.5">
            {isAr ? 'مخطط لفترة بعد الظهر الذهبية حينما تكتسي الصحراء بأجمل ألوان الغروب' : 'Planned for the golden afternoon hours when desert light is at its best'}
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs bg-[var(--surface-container)] px-3 py-1.5 rounded-full border border-[var(--border-subtle)] self-start sm:self-auto">
          <Clock className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          <span className="font-bold text-[var(--text-primary)]">
            {isAr ? `الموعد المقترح: ${selectedTime}` : `Recommended time: ${selectedTime}`}
          </span>
        </div>
      </div>

      {/* Day Selector Buttons */}
      <div>
        <label className="text-xs font-bold text-[var(--text-primary)] block mb-2">
          {isAr ? 'اختر يوم السفاري من جدول رحلتك' : 'Select safari itinerary day'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {days.map((d) => {
            const isDaySelected = selectedDay === d.dayNumber;
            const hasConflict = d.dayNumber === divingDay;

            return (
              <button
                key={d.dayNumber}
                type="button"
                id={`safari-day-btn-${d.dayNumber}`}
                onClick={() => handleDayClick(d.dayNumber)}
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
                  {!isDaySelected && hasConflict && (
                    <span className="text-[var(--accent-secondary)] text-[11px] font-semibold">
                      {isAr ? 'يوجد غطس صباحاً' : 'Diving booked'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive Conflict Resolution Dialog / Inline Alert */}
      {conflictPromptDay !== null && (
        <div
          id="safari-schedule-conflict-prompt"
          className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/40 text-[var(--text-primary)] space-y-3 animate-in fade-in duration-200"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-[var(--accent-secondary)] flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-xs sm:text-sm text-[var(--text-primary)]">
                {isAr ? 'قد يكون هذا اليوم مزدحماً ومجهداً بعض الشيء.' : 'This may make your day feel busy.'}
              </h4>
              <p className="text-xs text-[var(--text-secondary)]/80 leading-relaxed font-normal">
                {isAr
                  ? `لديك نشاط رئيسي بالفعل (الغطس) في اليوم ${conflictPromptDay}. نوصي باختيار اليوم ٣ لإيقاع أكثر توازناً واسترخاء.`
                  : `You already have another major activity (Diving) scheduled on Day ${conflictPromptDay}. We recommend Day 3 for a more balanced experience.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1 pl-8 rtl:pl-0 rtl:pr-8">
            <button
              type="button"
              id="keep-day-3-btn"
              onClick={() => {
                onSelectDay(3);
                setConflictPromptDay(null);
              }}
              className="px-4 py-2 rounded-full bg-[var(--accent-primary)] hover:bg-[var(--btn-book-hover)] text-[var(--accent-primary-ink)] text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              {isAr ? 'البقاء على اليوم ٣ (الموصى به)' : 'Keep Day 3 (Recommended)'}
            </button>

            <button
              type="button"
              id="choose-anyway-btn"
              onClick={() => confirmConflictDay(conflictPromptDay)}
              className="px-4 py-2 rounded-full bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs font-bold transition-colors cursor-pointer"
            >
              {isAr ? 'اختيار اليوم ٢ على أي حال' : 'Choose Anyway'}
            </button>
          </div>
        </div>
      )}

      {/* Warning banner if current selection is Day 2 (conflicting with diving) */}
      {selectedDay === divingDay && conflictPromptDay === null && (
        <div
          id="safari-active-conflict-warning"
          className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--accent-secondary)]/40 text-[var(--accent-secondary)] text-xs flex items-start gap-3 animate-in fade-in duration-150"
        >
          <AlertTriangle className="w-4 h-4 text-[var(--accent-secondary)] flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold block text-[var(--text-primary)]">
              {isAr ? `اليوم ${selectedDay} يجمع بين الغطس والسفاري معاً.` : `Day ${selectedDay} has both Diving and Safari scheduled.`}
            </span>
            <p className="text-[var(--text-secondary)]/80 text-[12px] leading-relaxed">
              {isAr ? 'يبدأ صباحك بالغطس في ٠٩:٠٠ صباحاً يليه السفاري في ٠٢:٠٠ ظهراً.' : 'Your morning starts with Diving at 09:00 AM, followed by Safari at 02:00 PM.'}
            </p>
          </div>
        </div>
      )}

      {/* Coordinated Schedule Context for Day 3 */}
      {selectedDay === 3 ? (
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>{isAr ? 'جدول يومك الثالث' : 'Your Day 3'}</span>
            </span>
            <span className="text-[12px] text-[var(--text-secondary)]/60 font-medium">
              {isAr ? 'إيقاع متوازن · صباح متاح للاسترخاء والسباحة' : 'Balanced pace · Morning free to relax'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {/* 09:00 Slow Breakfast */}
            <div className="p-2.5 rounded-xl bg-[var(--surface-card)]/50 border border-[var(--border-subtle)] text-[var(--text-primary)]">
              <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--accent-primary)]">
                <Coffee className="w-3 h-3" />
                <span>09:00</span>
              </div>
              <div className="font-bold text-xs mt-1">{isAr ? 'إفطار هادئ' : 'Slow Breakfast'}</div>
              <div className="text-[11px] text-[var(--text-secondary)]/60">{isAr ? 'إطلالة البحر وقهوة' : 'Bay view & coffee'}</div>
            </div>

            {/* 11:00 Free Morning */}
            <div className="p-2.5 rounded-xl bg-[var(--surface-card)]/50 border border-[var(--border-subtle)] text-[var(--text-primary)]">
              <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--accent-primary)]">
                <SunMedium className="w-3 h-3" />
                <span>11:00</span>
              </div>
              <div className="font-bold text-xs mt-1">{isAr ? 'صباح حر' : 'Free Morning'}</div>
              <div className="text-[11px] text-[var(--text-secondary)]/60">{isAr ? 'تمشية اللايتهاوس' : 'Lighthouse stroll'}</div>
            </div>

            {/* 14:00 Desert Safari (ACTIVE) */}
            <div className="p-2.5 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 text-[var(--text-primary)]">
              <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--accent-primary)]">
                <Compass className="w-3 h-3" />
                <span>14:00</span>
              </div>
              <div className="font-bold text-xs mt-1">{isAr ? 'سفاري الصحراء' : 'Desert Safari'}</div>
              <div className="text-[11px] text-[var(--text-secondary)]/80">{isAr ? 'جولة 4x4 في الوديان' : '4x4 canyon trek'}</div>
            </div>

            {/* 18:00 Sunset */}
            <div className="p-2.5 rounded-xl bg-[var(--accent-secondary)]/10 border border-[var(--accent-secondary)]/30 text-[var(--text-primary)]">
              <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--accent-secondary)]">
                <Flame className="w-3 h-3" />
                <span>18:00</span>
              </div>
              <div className="font-bold text-xs mt-1">{isAr ? 'غروب الشمس' : 'Sunset'}</div>
              <div className="text-[11px] text-[var(--text-secondary)]/70">{isAr ? 'شاي بدوي ع الجبل' : 'Bedouin mountain tea'}</div>
            </div>

            {/* 20:00 Dinner */}
            <div className="p-2.5 rounded-xl bg-[var(--surface-card)]/50 border border-[var(--border-subtle)] text-[var(--text-primary)]">
              <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--accent-primary)]">
                <Utensils className="w-3 h-3" />
                <span>20:00</span>
              </div>
              <div className="font-bold text-xs mt-1">{isAr ? 'عشاء دهباوي' : 'Dinner'}</div>
              <div className="text-[11px] text-[var(--text-secondary)]/60">{isAr ? 'مأكولات سيناوية طازجة' : 'Traditional cuisine'}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-4 sm:p-5 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--accent-primary)] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
              <span>{isAr ? `جدول يومك ${selectedDay}` : `Your Day ${selectedDay} Schedule`}</span>
            </span>
            <span className="text-[12px] text-[var(--text-secondary)]/60 font-medium">
              {isAr ? 'موعد السفاري بعد الظهر' : 'Afternoon safari slot'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-[var(--surface-card)]/50 border border-[var(--border-subtle)] text-[var(--text-primary)]">
              <div className="font-bold text-xs">{isAr ? 'الصباح · وقت حر' : 'Morning · Free Pace'}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/60">
                {selectedDay === 2
                  ? (isAr ? '٠٩:٠٠ جلسة الغطس محجوزة' : '09:00 Diving session booked')
                  : (isAr ? 'صباح هادئ واستجمام في دهب' : 'Relaxed morning in Dahab')}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/40 text-[var(--text-primary)]">
              <div className="font-bold text-xs">{isAr ? '١٤:٠٠ · سفاري الصحراء' : '14:00 · Desert Safari'}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/80">
                {isAr ? 'استكشاف بسيارة 4x4 ومطل جبلي ساحر' : '4x4 exploration and mountain vista'}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-card)]/50 border border-[var(--border-subtle)] text-[var(--text-primary)]">
              <div className="font-bold text-xs">{isAr ? '١٨:٠٠ · مشهد الغروب والعشاء' : '18:00 · Golden Sunset & Dinner'}</div>
              <div className="text-[12px] text-[var(--text-secondary)]/60">
                {isAr ? 'شاي بدوي وعودة مسائية هادئة' : 'Bedouin tea and evening return'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
