import React from 'react';
import { Plane, MapPin, Users, Info, Luggage, UserCheck, Navigation, ShieldCheck } from 'lucide-react';
import { HotelOption } from './bookingData';
import { useLanguage } from '../../i18n/LanguageContext';

interface TransferArrivalInfoProps {
  selectedHotel: HotelOption | null;
  flightNumber: string;
  onFlightNumberChange: (value: string) => void;
}

export const TransferArrivalInfo: React.FC<TransferArrivalInfoProps> = ({
  selectedHotel,
  flightNumber,
  onFlightNumberChange,
}) => {
  const { language, isRTL } = useLanguage();
  const isAr = language === 'ar';

  const hotelName = selectedHotel ? (isAr && selectedHotel.nameAr ? selectedHotel.nameAr : selectedHotel.name) : (isAr ? 'فندق خليج دهب' : 'Dahab Bay Hotel');
  const hotelLoc = selectedHotel ? (isAr && selectedHotel.locationAr ? selectedHotel.locationAr : selectedHotel.location) : (isAr ? 'منطقة اللايتهاوس، دهب' : 'Lighthouse Area, Dahab');

  return (
    <div className="space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* 1. Your Arrival Details Card */}
      <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-6">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h3 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
              {isAr ? 'تفاصيل وصولك' : 'Your arrival'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]/60 mt-0.5">
              {isAr ? 'مسار الرحلة المنسق من شرم الشيخ إلى دهب' : 'Trip route coordinated from Sharm El Sheikh to Dahab'}
            </p>
          </div>
          <span className="text-xs font-bold text-[var(--accent-primary)] bg-[var(--surface-container)] border border-[var(--border-subtle)] px-2.5 py-1 rounded-full">
            {isAr ? 'استقبال منسق' : 'Coordinated Pickup'}
          </span>
        </div>

        {/* Coordinated Trip Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* Origin Airport */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1.5">
            <span className="text-[12px] font-bold text-[var(--text-secondary)]/50 block">
              {isAr ? 'المطار' : 'Airport'}
            </span>
            <div className="flex items-start gap-2 text-[var(--text-primary)] font-bold text-sm">
              <Plane className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
              <span>{isAr ? 'مطار شرم الشيخ الدولي' : 'Sharm El Sheikh International Airport'}</span>
            </div>
            <p className="text-[12px] text-[var(--text-secondary)]/60 font-normal">
              {isAr ? 'صالة الوصول الرئيسية (SSH)' : 'Main arrival terminal (SSH)'}
            </p>
          </div>

          {/* Destination Hotel */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1.5">
            <span className="text-[12px] font-bold text-[var(--text-secondary)]/50 block">
              {isAr ? 'وجهة الوصول' : 'Destination'}
            </span>
            <div className="flex items-start gap-2 text-[var(--text-primary)] font-bold text-sm">
              <MapPin className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0 mt-0.5" />
              <span>{hotelName}</span>
            </div>
            <p className="text-[12px] text-[var(--text-secondary)]/60 font-normal">
              {hotelLoc}
            </p>
          </div>

          {/* Travelers */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] space-y-1.5">
            <span className="text-[12px] font-bold text-[var(--text-secondary)]/50 block">
              {isAr ? 'المسافرون' : 'Travelers'}
            </span>
            <div className="flex items-center gap-2 text-[var(--text-primary)] font-bold text-sm">
              <Users className="w-4 h-4 text-[var(--accent-primary)] flex-shrink-0" />
              <span>{isAr ? 'فردين بالغين' : '2 adults'}</span>
            </div>
            <p className="text-[12px] text-[var(--text-secondary)]/60 font-normal">
              {isAr ? 'أصدقاء · ميزانية متوازنة' : 'Friends · Moderate budget'}
            </p>
          </div>
        </div>

        {/* Optional Flight Number Field */}
        <div className="pt-2 border-t border-[var(--border-subtle)]">
          <label
            htmlFor="flight-number-input"
            className="block text-xs font-bold text-[var(--text-primary)] mb-1.5"
          >
            {isAr ? 'رقم الرحلة الجوية' : 'Flight number'} <span className="text-[var(--text-secondary)]/40 font-normal">({isAr ? 'اختياري' : 'Optional'})</span>
          </label>
          <div className="max-w-xs">
            <input
              id="flight-number-input"
              type="text"
              value={flightNumber}
              onChange={(e) => onFlightNumberChange(e.target.value)}
              placeholder={isAr ? 'مثال: MS123' : 'e.g. MS123'}
              className="w-full px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-container)] text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)]/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/50 focus:border-[var(--accent-primary)] transition-[background-color,border-color,color,box-shadow,transform,opacity] font-mono"
            />
          </div>
          <p className="text-[12px] text-[var(--text-secondary)]/60 mt-1.5 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[var(--accent-primary)] flex-shrink-0" />
            <span>{isAr ? 'اختياري — يساعد السائق في تتبع موعد وصول الطائرة بدقة وأي تأخير محتمل.' : 'Optional — helps the driver track your arrival and flight delays.'}</span>
          </p>
        </div>
      </div>

      {/* 2. Pickup Instructions (When you arrive) */}
      <div className="bg-[var(--surface-card)] rounded-3xl p-6 sm:p-7 border border-[var(--border-subtle)] shadow-xs space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl chart-heading font-bold text-[var(--text-primary)]">
              {isAr ? 'عند وصولك للمطار' : 'When you arrive'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)]/60 mt-0.5">
              {isAr ? '٣ خطوات سهلة للاستقبال في مطار شرم الشيخ' : 'Simple 3-step arrival coordination at Sharm El Sheikh Airport'}
            </p>
          </div>
          <ShieldCheck className="w-5 h-5 text-[var(--accent-primary)]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold flex items-center justify-center">
                01
              </span>
              <Luggage className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)] mb-0.5">
                {isAr ? 'استلام الحقائب والأمتعة' : 'Collect your luggage'}
              </h4>
              <p className="text-[12px] text-[var(--text-secondary)]/70 leading-relaxed font-normal">
                {isAr ? 'استلم حقائبك وتوجه مباشرة نحو بوابة الخروج بصالة الوصول.' : 'Clear baggage claim and proceed through the arrival exit.'}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold flex items-center justify-center">
                02
              </span>
              <UserCheck className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)] mb-0.5">
                {isAr ? 'مقابلة سائقك الخاص' : 'Meet your driver at arrival'}
              </h4>
              <p className="text-[12px] text-[var(--text-secondary)]/70 leading-relaxed font-normal">
                {isAr ? 'سيكون سائقك بانتظارك بصالة الوصول حاملاً لافتة باسمك.' : 'Your driver will be waiting in the arrival hall holding a sign with your name.'}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between">
              <span className="w-7 h-7 rounded-full bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-xs font-bold flex items-center justify-center">
                03
              </span>
              <Navigation className="w-4 h-4 text-[var(--accent-primary)]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[var(--text-primary)] mb-0.5">
                {isAr ? 'الانطلاق المباشر لفندقك' : 'Direct to your hotel'}
              </h4>
              <p className="text-[12px] text-[var(--text-secondary)]/70 leading-relaxed font-normal">
                {isAr ? 'ينقلك السائق مباشرة لفندقك في دهب (حوالي ساعة في طريق ساحلي آمن).' : 'Your driver takes you directly to your hotel in Dahab (~1 hour drive).'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

