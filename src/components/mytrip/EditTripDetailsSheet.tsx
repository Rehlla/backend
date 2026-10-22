import React, { useEffect, useMemo, useState } from 'react';
import { Info, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { ApiError } from '../../services/apiError';
import { dahabToday } from '../../services/travelerLifecycleResolver';
import { daysLabel, travelersLabel } from '../../utils/countLabels';
import {
  addDays,
  isBookingLive,
  planTripDetailsUpdate,
  tripDetailsConstraints,
  TRIP_BUDGETS,
  TRIP_LIMITS,
  TRIP_PACES,
  type PolicyBooking,
  type TripBudget,
  type TripDetailsPatch,
  type TripPace,
} from '../../shared/tripDetailsPolicy';

/**
 * Edit the trip itself: name, start date, length, party size, pace, budget.
 *
 * The limits shown here are the server's own (src/shared/tripDetailsPolicy):
 * the party cannot drop below a booking, the dates must still hold every
 * booking, a started trip keeps its start date. The sheet reads the live
 * booking records when it opens so those limits reflect what is committed now.
 */

type Lang = 'en' | 'ar';

const localeOf = (language: Lang) => (language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

const longDate = (iso: string, language: Lang) =>
  new Intl.DateTimeFormat(localeOf(language), { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${iso}T00:00:00Z`)
  );

const shortDate = (iso: string, language: Lang) =>
  new Intl.DateTimeFormat(localeOf(language), { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(
    new Date(`${iso}T00:00:00Z`)
  );

const Stepper: React.FC<{
  value: string;
  onLess: () => void;
  onMore: () => void;
  canLess: boolean;
  canMore: boolean;
  lessLabel: string;
  moreLabel: string;
}> = ({ value, onLess, onMore, canLess, canMore, lessLabel, moreLabel }) => (
  <div className="flex items-center gap-1 rounded-full border border-dg-line-strong p-1">
    <button
      type="button"
      aria-label={lessLabel}
      disabled={!canLess}
      onClick={onLess}
      className="grid h-9 w-9 place-items-center rounded-full text-dg-ink transition-colors hover:bg-dg-sunken disabled:opacity-35"
    >
      <Minus className="h-4 w-4" aria-hidden="true" />
    </button>
    <output aria-live="polite" className="min-w-[5.5rem] text-center text-[0.9375rem] font-semibold tabular-nums text-dg-ink">
      {value}
    </output>
    <button
      type="button"
      aria-label={moreLabel}
      disabled={!canMore}
      onClick={onMore}
      className="grid h-9 w-9 place-items-center rounded-full text-dg-ink transition-colors hover:bg-dg-sunken disabled:opacity-35"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
    </button>
  </div>
);

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: (v: T) => string;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-dg-lg bg-dg-sunken p-1">
      {options.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              'h-10 rounded-dg-md text-[0.875rem] font-medium transition-[background-color,color,box-shadow] duration-200',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--dg-focus)] disabled:opacity-45',
              selected ? 'bg-dg-surface text-dg-ink shadow-dg-card' : 'text-dg-ink-2 hover:text-dg-ink'
            )}
          >
            {label(option)}
          </button>
        );
      })}
    </div>
  );
}

const Row: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
    <div className="min-w-0">
      <p className="text-[0.875rem] font-semibold text-dg-ink">{label}</p>
      {hint && <p className="mt-0.5 text-[0.8125rem] text-dg-ink-3">{hint}</p>}
    </div>
    {children}
  </div>
);

export const EditTripDetailsSheet: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { t, language } = useLanguage();
  const lang: Lang = language === 'ar' ? 'ar' : 'en';
  const { activeTrip, activeTripItems, reloadTrip, showToast } = useTrip();

  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState<string | undefined>();
  const [lengthDays, setLengthDays] = useState(1);
  const [travelers, setTravelers] = useState(1);
  const [pace, setPace] = useState<TripPace>('Balanced');
  const [budget, setBudget] = useState<TripBudget>('Moderate');
  const [bookings, setBookings] = useState<PolicyBooking[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !activeTrip) return;
    setTitle(activeTrip.title);
    setStartDate(activeTrip.startDate);
    setLengthDays(activeTrip.lengthDays || 1);
    setTravelers(activeTrip.travelersCount || 1);
    setPace((TRIP_PACES as readonly string[]).includes(activeTrip.pace) ? activeTrip.pace : 'Balanced');
    setBudget((TRIP_BUDGETS as readonly string[]).includes(activeTrip.budget) ? activeTrip.budget : 'Moderate');
    setServerError(null);
    setBookings(null);

    const ctrl = new AbortController();
    api
      .getTripBookings(activeTrip.id, ctrl.signal)
      .then(({ bookings: records }) =>
        setBookings(
          records.map((b) => ({
            id: b.id,
            bookingRef: b.bookingRef,
            tripItemId: b.tripItemId,
            passengersCount: b.passengersCount,
            scheduledDate: b.scheduledDate,
            active: isBookingLive(b.supplierState, b.paymentState),
          }))
        )
      )
      .catch(() => setBookings([]));
    return () => ctrl.abort();
  }, [open, activeTrip]);

  const today = dahabToday();
  const items = useMemo(() => activeTripItems ?? [], [activeTripItems]);
  const rules = useMemo(
    () => (activeTrip ? tripDetailsConstraints(activeTrip, items, bookings ?? []) : null),
    [activeTrip, items, bookings]
  );

  const patch: TripDetailsPatch = useMemo(() => {
    if (!activeTrip) return {};
    const p: TripDetailsPatch = {};
    if (title.trim() !== activeTrip.title) p.title = title;
    if (startDate && startDate !== activeTrip.startDate) p.startDate = startDate;
    if (lengthDays !== activeTrip.lengthDays) p.lengthDays = lengthDays;
    if (travelers !== activeTrip.travelersCount) p.travelersCount = travelers;
    if (pace !== activeTrip.pace) p.pace = pace;
    if (budget !== activeTrip.budget) p.budget = budget;
    return p;
  }, [activeTrip, title, startDate, lengthDays, travelers, pace, budget]);

  const changed = Object.keys(patch).length > 0;
  const plan = activeTrip && bookings ? planTripDetailsUpdate(activeTrip, items, bookings, patch, today) : null;

  const errorText = (code: string | undefined, details: Record<string, unknown>): string => {
    const known = [
      'TRIP_CLOSED',
      'DATES_LOCKED',
      'TITLE_LENGTH',
      'TRAVELERS_RANGE',
      'TRAVELERS_BELOW_BOOKED',
      'LENGTH_RANGE',
      'START_IN_PAST',
      'END_IN_PAST',
      'BOOKING_OUTSIDE_DATES',
      'PLANS_BEYOND_END',
    ];
    if (!code || !known.includes(code)) return t('tripEdit.error.generic');
    const vars: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(details)) {
      if (typeof v === 'number') vars[k] = v;
      else if (typeof v === 'string') vars[k] = /^\d{4}-\d{2}-\d{2}$/.test(v) ? shortDate(v, lang) : v;
    }
    return t(`tripEdit.error.${code}`, vars);
  };

  const localError = plan && !plan.ok ? errorText(plan.code, { ...plan.params }) : null;
  const shownError = localError ?? serverError;

  if (!activeTrip || !rules) return null;

  const endDate = startDate ? addDays(startDate, lengthDays - 1) : undefined;
  const closed = !rules.canEditParty;
  const minLength = Math.max(TRIP_LIMITS.lengthMin, rules.lastPlannedDay);

  const save = async () => {
    if (!changed || !plan?.ok) return;
    setSaving(true);
    setServerError(null);
    try {
      await api.updateTripDetails(activeTrip.id, patch);
      reloadTrip();
      showToast(t('tripEdit.saved'));
      onClose();
    } catch (err: unknown) {
      setServerError(err instanceof ApiError ? errorText(err.code, err.details) : t('tripEdit.error.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('tripEdit.title')}
      description={closed ? t('tripEdit.closed') : t('tripEdit.description')}
      closeLabel={t('tripEdit.close')}
      size="md"
      footer={
        <div className="grid gap-3">
          {shownError && (
            <p role="alert" className="flex items-start gap-2 rounded-dg-md bg-dg-warning-wash px-3.5 py-2.5 text-[0.8125rem] text-dg-ink">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-dg-warning" aria-hidden="true" />
              {shownError}
            </p>
          )}
          <Button block size="lg" loading={saving} disabled={!changed || !plan?.ok} onClick={() => void save()}>
            {changed ? t('tripEdit.save') : t('tripEdit.noChanges')}
          </Button>
        </div>
      }
    >
      <div className="grid gap-7">
        <label className="grid gap-1.5">
          <span className="text-[0.875rem] font-semibold text-dg-ink">{t('tripEdit.name')}</span>
          <input
            type="text"
            value={title}
            maxLength={TRIP_LIMITS.titleMax}
            onChange={(e) => setTitle(e.target.value)}
            className="h-11 rounded-dg-md border border-dg-line-strong bg-dg-surface px-3.5 text-dg-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--dg-focus)]"
          />
        </label>

        <div className="grid gap-5 border-t border-dg-line pt-6">
          <label className="grid gap-1.5">
            <span className="text-[0.875rem] font-semibold text-dg-ink">{t('tripEdit.start')}</span>
            <input
              type="date"
              value={startDate ?? ''}
              min={rules.canEditStart ? today : undefined}
              max={rules.bookedDates[0]}
              disabled={!rules.canEditStart}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
              className="h-11 w-full rounded-dg-md border border-dg-line-strong bg-dg-surface px-3.5 text-dg-ink [color-scheme:light_dark] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--dg-focus)] disabled:opacity-55"
            />
            <span className="text-[0.8125rem] text-dg-ink-3">
              {!rules.canEditStart && !closed
                ? t('tripEdit.startLocked')
                : startDate && endDate && startDate === endDate
                ? t('tripEdit.single', { date: longDate(startDate, lang) })
                : startDate && endDate
                ? t('tripEdit.range', { from: longDate(startDate, lang), to: longDate(endDate, lang) })
                : t('tripEdit.noStart')}
            </span>
          </label>

          <Row
            label={t('tripEdit.length')}
            hint={
              rules.bookedDates.length > 0
                ? t('tripEdit.bookedOn', { dates: rules.bookedDates.map((d) => shortDate(d, lang)).join(lang === 'ar' ? '، ' : ', ') })
                : undefined
            }
          >
            <Stepper
              value={daysLabel(lengthDays, lang)}
              canLess={!closed && lengthDays > minLength}
              canMore={!closed && lengthDays < TRIP_LIMITS.lengthMax}
              onLess={() => setLengthDays((n) => Math.max(minLength, n - 1))}
              onMore={() => setLengthDays((n) => Math.min(TRIP_LIMITS.lengthMax, n + 1))}
              lessLabel={t('tripEdit.fewerDays')}
              moreLabel={t('tripEdit.moreDays')}
            />
          </Row>
        </div>

        <div className="border-t border-dg-line pt-6">
          <Row
            label={t('tripEdit.travelers')}
            hint={rules.minTravelers > 1 ? t('tripEdit.travelersMin', { n: rules.minTravelers }) : undefined}
          >
            <Stepper
              value={travelersLabel(travelers, lang)}
              canLess={!closed && travelers > rules.minTravelers}
              canMore={!closed && travelers < TRIP_LIMITS.travelersMax}
              onLess={() => setTravelers((n) => Math.max(rules.minTravelers, n - 1))}
              onMore={() => setTravelers((n) => Math.min(TRIP_LIMITS.travelersMax, n + 1))}
              lessLabel={t('tripEdit.fewerTravelers')}
              moreLabel={t('tripEdit.moreTravelers')}
            />
          </Row>
        </div>

        <div className="grid gap-5 border-t border-dg-line pt-6">
          <div className="grid gap-2.5">
            <p className="text-[0.875rem] font-semibold text-dg-ink">{t('tripEdit.pace')}</p>
            <Segmented
              options={TRIP_PACES}
              value={pace}
              onChange={setPace}
              label={(v) => t(`tripEdit.pace.${v}`)}
              disabled={closed}
            />
          </div>
          <div className="grid gap-2.5">
            <p className="text-[0.875rem] font-semibold text-dg-ink">{t('tripEdit.budget')}</p>
            <Segmented
              options={TRIP_BUDGETS}
              value={budget}
              onChange={setBudget}
              label={(v) => t(`tripEdit.budget.${v}`)}
              disabled={closed}
            />
          </div>
        </div>
      </div>
    </Sheet>
  );
};
