import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BedDouble, Users, CalendarDays, X, ChevronDown } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { DatePickerPopover, diffNights } from './DatePickerPopover';

/**
 * Dates, rooms and guests for the listing page.
 *
 * `/hotels` used to be a name-search with no dates at all — there was no way to
 * ask "what is free in Dahab the first week of July", which is the first
 * question anyone has when choosing a place to stay. The values live in the URL
 * (the page already syncs every other filter there), so a search is shareable
 * and survives a refresh, and with dates present the results are filtered by
 * real availability rather than only by name.
 */

interface StaySearchBarProps {
  checkIn: string;
  checkOut: string;
  rooms: number;
  guests: number;
  onDatesChange: (checkIn: string, checkOut: string) => void;
  onRoomsChange: (rooms: number) => void;
  onGuestsChange: (guests: number) => void;
  onClear: () => void;
}

const Stepper = ({
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
}) => (
  <div className="flex items-center justify-between gap-3 min-h-12">
    <span className="flex items-center gap-1.5 text-[13px] text-[var(--text-secondary)]">
      {icon}
      <span>{label}</span>
    </span>
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`− ${label}`}
        className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--btn-util-hover)] disabled:cursor-not-allowed disabled:opacity-30"
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
        aria-label={`+ ${label}`}
        className="flex h-9 w-9 items-center justify-center rounded-full text-base font-bold text-[var(--text-primary)] transition-colors hover:bg-[var(--btn-util-hover)] disabled:cursor-not-allowed disabled:opacity-30"
      >
        +
      </button>
    </span>
  </div>
);

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const StaySearchBar: React.FC<StaySearchBarProps> = ({
  checkIn,
  checkOut,
  rooms,
  guests,
  onDatesChange,
  onRoomsChange,
  onGuestsChange,
  onClear,
}) => {
  const { language, t, isRTL } = useLanguage();
  const isAr = language === 'ar';
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calendarOpen && !partyOpen) return;
    const onDown = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setCalendarOpen(false);
        setPartyOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCalendarOpen(false);
        setPartyOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [calendarOpen, partyOpen]);

  const nights = useMemo(() => diffNights(checkIn, checkOut), [checkIn, checkOut]);
  const hasDates = nights > 0;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'short' });

  // One compact row: the dates and the party, each a single tap. The
  // steppers only open on demand (progressive disclosure), so the list
  // starts higher on a phone.
  return (
    <motion.div
      ref={cardRef}
      dir={isRTL ? 'rtl' : 'ltr'}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      data-testid="stay-search-bar"
      className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-2 lg:w-[420px] lg:shrink-0"
    >
      <div className="relative min-w-0">
        <button
          type="button"
          data-testid="listing-date-field"
          onClick={() => {
            setPartyOpen(false);
            setCalendarOpen(v => !v);
          }}
          aria-expanded={calendarOpen}
          aria-label={t('hotels.stayDates')}
          className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-start text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)]/50"
        >
          <CalendarDays className="h-4 w-4 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
          <span className={`truncate ${hasDates ? 'font-semibold' : 'text-[var(--text-secondary)]'}`}>
            {hasDates ? `${fmt(checkIn)} – ${fmt(checkOut)}` : t('hotels.stayPickDates')}
          </span>
          {hasDates && (
            <span className="ms-auto shrink-0 rounded-full bg-[var(--accent-primary)]/15 px-2 py-0.5 text-[11px] font-bold text-[var(--accent-primary)]">
              {t('hotels.bookingNightsCount', { count: nights })}
            </span>
          )}
        </button>
        {hasDates && (
          <button
            type="button"
            onClick={onClear}
            aria-label={t('hotels.stayClearDates')}
            className="absolute -top-2 -end-2 flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {calendarOpen && (
          <DatePickerPopover
            checkIn={checkIn || todayIso()}
            checkOut={checkOut || todayIso()}
            onChange={(ci, co) => onDatesChange(ci, co)}
            onClose={() => setCalendarOpen(false)}
          />
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setCalendarOpen(false);
            setPartyOpen(v => !v);
          }}
          aria-expanded={partyOpen}
          aria-label={`${t('hotels.stayRoomsGuests')}: ${t('hotels.partySummary', { guests, rooms })}`}
          className="flex min-h-12 cursor-pointer items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--accent-primary)]/50"
        >
          <Users className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span className="tabular-nums">{guests}</span>
          <span className="text-[var(--text-secondary)]" aria-hidden="true">·</span>
          <BedDouble className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
          <span className="tabular-nums">{rooms}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-[var(--text-secondary)] transition-transform ${partyOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {partyOpen && (
          <div
            role="dialog"
            aria-label={t('hotels.stayRoomsGuests')}
            className="absolute z-40 mt-2 end-0 w-[min(88vw,300px)] rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-2xl"
          >
            <Stepper
              icon={<Users className="h-4 w-4" aria-hidden="true" />}
              label={t('hotels.bookingGuests')}
              value={guests}
              min={1}
              max={20}
              onChange={onGuestsChange}
            />
            <Stepper
              icon={<BedDouble className="h-4 w-4" aria-hidden="true" />}
              label={t('hotels.roomsLabel')}
              value={rooms}
              min={1}
              max={9}
              onChange={onRoomsChange}
            />
            <button
              type="button"
              onClick={() => setPartyOpen(false)}
              className="mt-2 w-full min-h-11 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-container)] text-sm font-bold cursor-pointer hover:brightness-110"
            >
              {t('hotels.done')}
            </button>
          </div>
        )}
      </div>

      {hasDates && (
        <p className="col-span-2 text-[11px] text-[var(--text-secondary)]">
          {t('hotels.stayAvailabilityOn', { count: rooms, guests })}
        </p>
      )}
    </motion.div>
  );
};
