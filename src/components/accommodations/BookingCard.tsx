import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { MapPin, CalendarDays, BedDouble, Users } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DatePickerPopover, diffNights, parseISODate } from './DatePickerPopover';

interface BookingCardProps {
  /** Prefilled destination, e.g. "Assalah, Dahab". */
  destination: string;
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  maxGuests: number;
  checking: boolean;
  onDatesChange: (checkIn: string, checkOut: string) => void;
  onRoomsChange: (rooms: number) => void;
  onGuestsChange: (guests: number) => void;
  onSubmit: () => void;
}

function Stepper({
  icon,
  label,
  value,
  min,
  max,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <div className="flex min-h-12 flex-1 items-center justify-between gap-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3">
      <span className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
        {icon}
        <span className="hidden min-[380px]:inline">{label}</span>
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`${t('hotels.bookingStepDecrease')} ${label}`}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-base font-bold text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--btn-util-hover)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-bold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`${t('hotels.bookingStepIncrease')} ${label}`}
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-base font-bold text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--btn-util-hover)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
      </span>
    </div>
  );
}

/**
 * Integrated reservation card: destination input, date-range selector with
 * calendar flyout, rooms/guests steppers, and one availability CTA.
 */
export const BookingCard: React.FC<BookingCardProps> = ({
  destination,
  checkIn,
  checkOut,
  rooms,
  guests,
  maxGuests,
  checking,
  onDatesChange,
  onRoomsChange,
  onGuestsChange,
  onSubmit,
}) => {
  const { language, t, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const locale = isAr ? 'ar-EG' : 'en-US';
  const [place, setPlace] = useState(destination);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlace(destination);
  }, [destination]);

  useEffect(() => {
    if (!calendarOpen) return;
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [calendarOpen]);

  const fmtShort = (iso: string) =>
    parseISODate(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const nights = diffNights(checkIn, checkOut);

  return (
    <motion.div
      ref={cardRef}
      dir={isRTL ? 'rtl' : 'ltr'}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[0_2px_6px_rgba(0,0,0,0.04)]"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setCalendarOpen(false);
          onSubmit();
        }}
        className="space-y-5"
      >
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t('hotels.bookingDestinations')}
          </h3>
          <div className="relative">
            <MapPin
              className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--accent-primary)] ${isRTL ? 'right-3' : 'left-3'}`}
              aria-hidden="true"
            />
            <input
              type="text"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              aria-label={t('hotels.bookingDestinations')}
              className={`h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[15px] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-primary)] focus:ring-4 focus:ring-[var(--accent-primary)]/10 ${isRTL ? 'pl-4 pr-10' : 'pl-10 pr-4'}`}
            />
          </div>
        </div>

        <div className="relative space-y-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">
            {t('hotels.bookingDetails')}
          </h3>
          <button
            type="button"
            data-testid="booking-date-field"
            onClick={() => setCalendarOpen((v) => !v)}
            aria-expanded={calendarOpen}
            className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3.5 text-start text-sm text-[var(--text-primary)] transition-colors duration-200 hover:bg-[var(--btn-util-hover)]"
          >
            <CalendarDays className="h-5 w-5 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
            <span className="font-medium">
              {fmtShort(checkIn)} – {fmtShort(checkOut)}
            </span>
            {nights > 0 && (
              <span className="ms-auto rounded-full bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent-primary)]">
                {t('hotels.bookingNightsCount', { count: nights })}
              </span>
            )}
          </button>
          <div className="flex gap-2">
            <Stepper
              icon={<BedDouble className="h-4 w-4" aria-hidden="true" />}
              label={t('hotels.roomsLabel')}
              value={rooms}
              min={1}
              max={9}
              onChange={onRoomsChange}
            />
            <Stepper
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              label={t('hotels.bookingGuests')}
              value={guests}
              min={1}
              max={Math.max(1, maxGuests)}
              onChange={onGuestsChange}
            />
          </div>
          {calendarOpen && (
            <DatePickerPopover
              checkIn={checkIn}
              checkOut={checkOut}
              onChange={(ci, co) => onDatesChange(ci, co)}
              onClose={() => setCalendarOpen(false)}
            />
          )}
        </div>

        <motion.button
          type="submit"
          data-testid="booking-submit"
          disabled={checking || nights <= 0}
          whileTap={{ scale: 0.98 }}
          className="h-12 w-full cursor-pointer rounded-full bg-[var(--accent-primary)] text-base font-bold text-[var(--accent-primary-ink)] transition-colors duration-200 hover:bg-[var(--btn-book-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('hotels.checkAvailability')}
        </motion.button>
      </form>
    </motion.div>
  );
};
