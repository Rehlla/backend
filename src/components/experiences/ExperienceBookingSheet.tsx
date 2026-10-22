import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Minus, Plus, ShieldCheck, Wallet, RotateCw } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Sheet } from '../ui/sheet';
import { Button } from '../ui/button';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { analytics } from '../../services/analytics';
import { availabilitySlotViews, LIMITED_REMAINING, type AvailabilitySlotView } from '../../services/bookingManage';
import { useHeldCheckout } from '../../hooks/useHeldCheckout';
import { newAttemptKey, type HeldCheckoutOutcome } from '../../services/heldCheckout';
import { createPlanningTrip } from '../../services/tripLifecycle';
import { checkoutIssueFrom, checkoutIssueMessage } from '../../services/checkoutError';
import { useCurrency } from '../../context/CurrencyContext';
import { urlFromRoute } from '../../lib/routeUrl';
import { CheckoutIssuePanel } from '../commerce/CheckoutIssuePanel';
import type { ExperienceDetailData } from '../../services/experienceService';
import type { CommerceServiceType } from '../../shared/types/commerce';

const DAHAB_TZ = 'Africa/Cairo';
const BOOKABLE_DAYS = 14;
/** A departure closer than this is no longer offered: the operator needs time to plan. */
const LEAD_MINUTES = 45;
const DRAFT_KEY = 'rehla.experienceBookingDraft';

export interface ExperienceBookingDraft {
  slug: string;
  date: string;
  timeSlot: string | null;
  guests: number;
  phone: string;
  pickup: string;
  notes: string;
}

/** A draft saved before a detour through sign-in, for this experience only. */
export function readBookingDraft(slug: string): ExperienceBookingDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as ExperienceBookingDraft;
    return draft.slug === slug ? draft : null;
  } catch {
    return null;
  }
}

function writeBookingDraft(draft: ExperienceBookingDraft | null) {
  try {
    if (draft) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Private mode: the traveller re-picks after sign-in.
  }
}

/** Today's date and wall-clock minutes in Dahab, whatever the device's zone. */
function dahabNow(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DAHAB_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days, 12)).toISOString().slice(0, 10);
}

/** "03:30 PM" → 930. Null for labels that are not a clock time. */
function slotMinutes(timeSlot: string): number | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(timeSlot.trim());
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3]?.toUpperCase() === 'PM') hours += 12;
  if (!match[3]) hours = Number(match[1]);
  return hours * 60 + Number(match[2]);
}

function dayParts(isoDate: string, language: 'en' | 'ar') {
  const [y, m, d] = isoDate.split('-').map(Number);
  const at = new Date(Date.UTC(y, m - 1, d, 12));
  const locale = language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...o }).format(at);
  return {
    weekday: fmt({ weekday: 'short' }),
    day: fmt({ day: 'numeric' }),
    month: fmt({ month: 'short' }),
    long: fmt({ weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

/** "6 hours" / "٦ ساعات" — Arabic counts take a different noun form by number. */
function hoursLabel(hours: number, language: 'en' | 'ar'): string {
  if (language === 'en') return hours === 1 ? '1 hour' : `${hours} hours`;
  if (hours === 1) return 'ساعة واحدة';
  if (hours === 2) return 'ساعتين';
  if (hours >= 3 && hours <= 10) return `${hours} ساعات`;
  return `${hours} ساعة`;
}

interface ExperienceBookingSheetProps {
  experience: ExperienceDetailData;
  open: boolean;
  onClose: () => void;
  /** Restores the choices made before a sign-in detour. */
  initialDraft?: ExperienceBookingDraft | null;
}

export const ExperienceBookingSheet: React.FC<ExperienceBookingSheetProps> = ({ experience, open, onClose, initialDraft }) => {
  const {
    isSignedIn,
    sessionUser,
    profile,
    activeTrip,
    setIntendedRoute,
    navigateTo,
    showToast,
    recordBooking,
    reloadTrip,
    openTrip,
  } = useTrip();
  const { t, language } = useLanguage();
  const { formatEGP } = useCurrency();
  const bookable = experience.bookable!;
  const title = language === 'ar' ? experience.titleAr : experience.titleEn;
  const supplier = (language === 'ar' ? bookable.supplierNameAr : bookable.supplierName) || bookable.supplierName || '';
  const meetingPoint = (language === 'ar' ? bookable.meetingPointAr : undefined) || bookable.meetingPoint;

  const today = useMemo(() => dahabNow().date, [open]);
  const days = useMemo(() => Array.from({ length: BOOKABLE_DAYS }, (_, i) => addDays(today, i)), [today]);

  const [date, setDate] = useState<string>(initialDraft?.date && initialDraft.date >= today ? initialDraft.date : today);
  const [guests, setGuests] = useState<number>(initialDraft?.guests ?? 2);
  const [timeSlot, setTimeSlot] = useState<string | null>(initialDraft?.timeSlot ?? null);
  const [phone, setPhone] = useState<string>(initialDraft?.phone ?? (profile?.phone || sessionUser?.phone || ''));
  const [pickup, setPickup] = useState<string>(initialDraft?.pickup ?? (profile?.savedPlaces?.[0] || ''));
  const [notes, setNotes] = useState<string>(initialDraft?.notes ?? '');
  const [phoneMissing, setPhoneMissing] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ reference: string; amountEGP: number; when: string } | null>(null);
  const createdTripIdRef = useRef<string | null>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [slots, setSlots] = useState<AvailabilitySlotView[]>([]);
  const [slotsState, setSlotsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [slotsRetry, setSlotsRetry] = useState(0);

  const maxGuests = Math.max(1, bookable.maxCapacityPerSlot);
  const perPerson = (bookable.pricingBasis ?? 'per_person') === 'per_person';
  const totalEGP = perPerson ? bookable.basePriceEGP * guests : bookable.basePriceEGP;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setSlotsState('loading');
    api
      .checkRichAvailability({
        serviceType: bookable.serviceType as CommerceServiceType,
        skuId: bookable.skuId,
        date,
        passengers: guests,
      })
      .then((response) => {
        if (cancelled) return;
        setSlots(availabilitySlotViews(response, guests));
        setSlotsState('ready');
      })
      .catch(() => {
        if (!cancelled) setSlotsState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [open, bookable.serviceType, bookable.skuId, date, guests, slotsRetry]);

  const now = dahabNow();
  const departed = (slot: AvailabilitySlotView) => {
    if (date !== now.date) return false;
    const at = slotMinutes(slot.timeSlot);
    return at !== null && at - LEAD_MINUTES <= now.minutes;
  };
  const selectable = (slot: AvailabilitySlotView) => !departed(slot) && (slot.kind === 'available' || slot.kind === 'limited');

  // A choice that stopped fitting (new day, bigger group) is dropped rather
  // than carried into checkout.
  useEffect(() => {
    if (slotsState !== 'ready' || !timeSlot) return;
    const slot = slots.find((s) => s.timeSlot === timeSlot);
    if (!slot || !selectable(slot)) setTimeSlot(null);
  }, [slots, slotsState]);

  const checkout = useHeldCheckout({
    keyPrefix: 'EXP',
    onConfirmed: (outcome) => onBooked(outcome),
  });

  const whenLabel = timeSlot ? `${dayParts(date, language).long}, ${timeSlot}` : dayParts(date, language).long;

  function onBooked(outcome: Extract<HeldCheckoutOutcome, { kind: 'confirmed' }>) {
    const booked = outcome.result.bookings?.[0];
    const reference = booked?.confirmationCode || booked?.bookingRef || outcome.result.transactionId;
    const amountEGP = outcome.held.reduce((sum, line) => sum + line.amountEGP, 0);
    writeBookingDraft(null);
    setConfirmed({ reference, amountEGP, when: whenLabel });
    recordBooking({
      id: booked?.bookingRef || reference,
      serviceType: bookable.serviceType as CommerceServiceType,
      title,
      subtitle: language === 'ar' ? experience.locationAr : experience.locationEn,
      details: `${guests} × ${title}${pickup ? ` — ${pickup}` : ''}`,
      datesOrTime: whenLabel,
      priceEGP: amountEGP,
      provider: supplier,
      confirmationCode: reference,
      status: 'Pending',
      location: meetingPoint || (language === 'ar' ? experience.locationAr : experience.locationEn),
      iconType: bookable.serviceType === 'diving' ? 'waves' : 'compass',
      included: language === 'ar' ? experience.includedAr : experience.includedEn,
    });
    analytics.track('booking_completed', {
      sourceMode: `experience_detail:${experience.slug}`,
      metadata: { skuId: bookable.skuId, bookingRef: booked?.bookingRef },
    } as any);
    if (createdTripIdRef.current && !activeTrip) openTrip(createdTripIdRef.current);
    else reloadTrip();
  }

  const handleConfirm = async () => {
    if (!timeSlot || checkout.busy || preparing) return;

    if (!isSignedIn) {
      writeBookingDraft({ slug: experience.slug, date, timeSlot, guests, phone, pickup, notes });
      setIntendedRoute(urlFromRoute('/experiences', { experienceSlug: experience.slug }));
      showToast(t('experiences.signInToComplete'));
      navigateTo('/auth/sign-in');
      return;
    }

    if (!phone.trim()) {
      setPhoneMissing(true);
      phoneRef.current?.focus();
      return;
    }

    setPrepareError(null);
    checkout.reset();
    analytics.track('booking_started', {
      sourceMode: `experience_detail:${experience.slug}`,
      metadata: { skuId: bookable.skuId, serviceType: bookable.serviceType },
    } as any);

    let tripId = activeTrip?.id || createdTripIdRef.current;
    if (!tripId) {
      setPreparing(true);
      try {
        const daysAhead = days.indexOf(date);
        const trip = await createPlanningTrip({
          title,
          lengthDays: 1,
          travelersCount: guests,
          startsInDays: Math.max(0, daysAhead),
          idPrefix: 'TRIP-EXP',
        });
        tripId = trip.id;
        createdTripIdRef.current = trip.id;
      } catch (err) {
        setPrepareError(checkoutIssueMessage(checkoutIssueFrom(err), t, formatEGP));
        return;
      } finally {
        setPreparing(false);
      }
    }

    await checkout.submit({
      tripId,
      traveler: {
        name: sessionUser?.name || profile.name,
        phone: phone.trim(),
        email: sessionUser?.email || profile.email,
      },
      lines: [
        {
          serviceType: bookable.serviceType as CommerceServiceType,
          skuId: bookable.skuId,
          scheduledDate: date,
          scheduledTime: timeSlot,
          passengersCount: guests,
          amountEGP: totalEGP,
          pickupLocation: pickup.trim() || undefined,
          specialRequests: notes.trim() || undefined,
        },
      ],
      payment: { provider: 'CASH_ON_ARRIVAL' },
      attemptKey: newAttemptKey('EXP'),
    });
  };

  const close = () => {
    onClose();
    if (confirmed) {
      setConfirmed(null);
      setTimeSlot(null);
      checkout.reset();
    }
  };

  const busy = checkout.busy || preparing;

  // ------------------------------------------------------------- confirmed

  if (confirmed) {
    return (
      <Sheet
        open={open}
        onClose={close}
        title={t('expBooking.doneTitle')}
        closeLabel={t('expBooking.close')}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={close}>
              {t('expBooking.done')}
            </Button>
            <Button
              onClick={() => {
                close();
                navigateTo('/bookings');
              }}
            >
              {t('expBooking.seeBookings')}
            </Button>
          </div>
        }
      >
        <div className="grid gap-5">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-dg-positive-wash text-dg-positive">
              <Check className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-dg-ink-2">
              {t('expBooking.doneBody', { supplier: supplier || title, phone: phone.trim() })}
            </p>
          </div>

          <div className="rounded-dg-lg bg-dg-sunken px-4 py-3">
            <p className="text-[0.8125rem] text-dg-ink-3">{t('expBooking.reference')}</p>
            <p className="mt-0.5 font-dg-display text-2xl font-semibold tracking-wide tabular-nums" dir="ltr">
              {confirmed.reference}
            </p>
          </div>

          <dl className="grid gap-3 text-[0.9375rem]">
            {[
              [t('expBooking.when'), confirmed.when],
              [t('expBooking.peopleLabel'), String(guests)],
              ...(meetingPoint ? [[t('expBooking.meet'), pickup.trim() || meetingPoint]] : []),
              [t('expBooking.payOnDayAmount'), formatEGP(confirmed.amountEGP)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b border-dg-line pb-3 last:border-0 last:pb-0">
                <dt className="text-dg-ink-3">{label}</dt>
                <dd className="text-end font-medium text-dg-ink">{value}</dd>
              </div>
            ))}
          </dl>

          {bookable.cancellationPolicyHours ? (
            <p className="flex items-center gap-2 text-[0.8125rem] text-dg-ink-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-dg-positive" aria-hidden="true" />
              {t('expBooking.freeCancel', { hours: hoursLabel(bookable.cancellationPolicyHours, language) })}
            </p>
          ) : null}
        </div>
      </Sheet>
    );
  }

  // ---------------------------------------------------------------- choose

  return (
    <Sheet
      open={open}
      onClose={close}
      title={title}
      description={supplier ? t('expBooking.runBy', { supplier }) : undefined}
      closeLabel={t('expBooking.close')}
      size="lg"
      footer={
        <div className="grid gap-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.8125rem] text-dg-ink-3">{t('expBooking.total')}</p>
              <p className="font-dg-display text-2xl font-semibold tabular-nums">{formatEGP(totalEGP)}</p>
            </div>
            <p className="pb-1 text-end text-[0.8125rem] text-dg-ink-3" dir={perPerson ? 'ltr' : undefined}>
              {perPerson
                ? t('expBooking.unitLine', { n: guests, unit: formatEGP(bookable.basePriceEGP) })
                : t('expBooking.wholeGroup')}
            </p>
          </div>
          <Button block size="lg" loading={busy} disabled={!timeSlot} onClick={() => void handleConfirm()}>
            {!timeSlot
              ? t('expBooking.pickDeparture')
              : isSignedIn
              ? t('expBooking.confirm')
              : t('expBooking.signInToConfirm')}
          </Button>
          <p className="flex items-center justify-center gap-1.5 text-center text-[0.75rem] text-dg-ink-3">
            <Wallet className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {isSignedIn ? t('expBooking.payOnDay') : t('expBooking.signInKept')}
          </p>
        </div>
      }
    >
      <div className="grid gap-7">
        {/* Day */}
        <fieldset className="min-w-0">
          <legend className="mb-2.5 text-[0.875rem] font-semibold text-dg-ink">{t('expBooking.dayLabel')}</legend>
          <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1 no-scrollbar">
            {days.map((d, i) => {
              const parts = dayParts(d, language);
              const selected = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={selected}
                  aria-label={parts.long}
                  onClick={() => setDate(d)}
                  className={cn(
                    'flex w-[4.25rem] shrink-0 snap-start flex-col items-center rounded-dg-lg border px-2 py-2.5 transition-[background-color,border-color,color] duration-200',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-focus)]',
                    selected
                      ? 'border-dg-ink bg-dg-ink text-dg-bg'
                      : 'border-dg-line-strong text-dg-ink hover:bg-dg-action-wash',
                  )}
                >
                  <span className={cn('text-[0.6875rem]', selected ? 'text-dg-bg/75' : 'text-dg-ink-3')}>
                    {i === 0 ? t('expBooking.today') : i === 1 ? t('expBooking.tomorrow') : parts.weekday}
                  </span>
                  <span className="font-dg-display text-xl font-semibold leading-tight tabular-nums">{parts.day}</span>
                  <span className={cn('text-[0.6875rem]', selected ? 'text-dg-bg/75' : 'text-dg-ink-3')}>{parts.month}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* People */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[0.875rem] font-semibold text-dg-ink">{t('expBooking.peopleLabel')}</p>
            <p className="text-[0.8125rem] text-dg-ink-3">{t('expBooking.peopleMax', { n: maxGuests })}</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-dg-line-strong p-1">
            <button
              type="button"
              aria-label={t('expBooking.fewerPeople')}
              disabled={guests <= 1}
              onClick={() => setGuests((g) => Math.max(1, g - 1))}
              className="grid h-9 w-9 place-items-center rounded-full text-dg-ink transition-colors hover:bg-dg-sunken disabled:opacity-35"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <output aria-live="polite" className="w-8 text-center font-dg-display text-lg font-semibold tabular-nums">
              {guests}
            </output>
            <button
              type="button"
              aria-label={t('expBooking.morePeople')}
              disabled={guests >= maxGuests}
              onClick={() => setGuests((g) => Math.min(maxGuests, g + 1))}
              className="grid h-9 w-9 place-items-center rounded-full text-dg-ink transition-colors hover:bg-dg-sunken disabled:opacity-35"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Departure */}
        <fieldset className="min-w-0">
          <legend className="mb-2.5 text-[0.875rem] font-semibold text-dg-ink">{t('expBooking.departureLabel')}</legend>
          {slotsState === 'loading' && (
            <div className="grid gap-2 sm:grid-cols-2" aria-busy="true" aria-label={t('expBooking.loadingTimes')}>
              {[0, 1].map((i) => (
                <div key={i} className="h-[4.25rem] animate-pulse rounded-dg-lg bg-dg-sunken" />
              ))}
            </div>
          )}
          {slotsState === 'error' && (
            <div className="flex items-center justify-between gap-3 rounded-dg-lg bg-dg-critical-wash px-4 py-3 text-[0.875rem]">
              <span className="text-dg-ink">{t('expBooking.timesFailed')}</span>
              <Button variant="secondary" size="sm" leadingIcon={<RotateCw className="h-3.5 w-3.5" />} onClick={() => setSlotsRetry((n) => n + 1)}>
                {t('expBooking.retry')}
              </Button>
            </div>
          )}
          {slotsState === 'ready' && (slots.length === 0 || slots.every((s) => departed(s))) && (
            <p className="rounded-dg-lg bg-dg-sunken px-4 py-3 text-[0.875rem] text-dg-ink-2">{t('expBooking.noTimes')}</p>
          )}
          {slotsState === 'ready' && slots.some((s) => !departed(s)) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {slots.map((slot) => {
                const gone = departed(slot);
                const canPick = selectable(slot);
                const selected = slot.timeSlot === timeSlot;
                const note = gone
                  ? t('expBooking.departed')
                  : slot.kind === 'sold-out'
                  ? t('expBooking.full')
                  : slot.kind === 'fits-no-party'
                  ? t('expBooking.tooSmall', { n: slot.capacityRemaining })
                  : slot.capacityRemaining <= LIMITED_REMAINING
                  ? t('expBooking.fewLeft', { n: slot.capacityRemaining })
                  : t('expBooking.placesLeft', { n: slot.capacityRemaining });
                return (
                  <button
                    key={slot.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={!canPick}
                    onClick={() => setTimeSlot(slot.timeSlot)}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-dg-lg border px-4 py-3 text-start transition-[background-color,border-color] duration-200',
                      'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dg-focus)]',
                      selected ? 'border-dg-action bg-dg-action-wash' : 'border-dg-line-strong hover:bg-dg-sunken',
                      !canPick && 'cursor-not-allowed opacity-45 hover:bg-transparent',
                    )}
                  >
                    <span>
                      <span className="block font-dg-display text-lg font-semibold tabular-nums" dir="ltr">
                        {slot.timeSlot}
                      </span>
                      <span
                        className={cn(
                          'text-[0.8125rem]',
                          canPick && slot.capacityRemaining <= LIMITED_REMAINING ? 'text-dg-warning' : 'text-dg-ink-3',
                        )}
                      >
                        {note}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        'grid h-5 w-5 shrink-0 place-items-center rounded-full border',
                        selected ? 'border-dg-action bg-dg-action text-dg-action-ink' : 'border-dg-line-strong',
                      )}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </fieldset>

        {/* Details */}
        <fieldset className="grid min-w-0 gap-4">
          <legend className="mb-2.5 text-[0.875rem] font-semibold text-dg-ink">{t('expBooking.detailsLabel')}</legend>
          <label className="grid gap-1.5">
            <span className="text-[0.8125rem] text-dg-ink-2">{t('expBooking.phone')}</span>
            <input
              ref={phoneRef}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              aria-invalid={phoneMissing || undefined}
              aria-describedby="exp-booking-phone-hint"
              onChange={(e) => {
                setPhone(e.target.value);
                if (e.target.value.trim()) setPhoneMissing(false);
              }}
              placeholder="+20 1xx xxx xxxx"
              className={cn(
                'h-11 rounded-dg-md border bg-dg-surface px-3.5 text-dg-ink placeholder:text-dg-ink-3 rtl:text-right',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--dg-focus)]',
                phoneMissing ? 'border-dg-critical' : 'border-dg-line-strong',
              )}
            />
            <span id="exp-booking-phone-hint" className={cn('text-[0.75rem]', phoneMissing ? 'text-dg-critical' : 'text-dg-ink-3')}>
              {phoneMissing ? t('expBooking.phoneRequired') : t('expBooking.phoneHint')}
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[0.8125rem] text-dg-ink-2">{t('expBooking.pickup')}</span>
            <input
              type="text"
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              placeholder={t('expBooking.pickupPlaceholder')}
              className="h-11 rounded-dg-md border border-dg-line-strong bg-dg-surface px-3.5 text-dg-ink placeholder:text-dg-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--dg-focus)]"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[0.8125rem] text-dg-ink-2">{t('expBooking.notes')}</span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('expBooking.notesPlaceholder')}
              className="resize-none rounded-dg-md border border-dg-line-strong bg-dg-surface px-3.5 py-2.5 text-dg-ink placeholder:text-dg-ink-3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--dg-focus)]"
            />
          </label>
        </fieldset>

        {bookable.cancellationPolicyHours ? (
          <p className="flex items-center gap-2 text-[0.8125rem] text-dg-ink-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-dg-positive" aria-hidden="true" />
            {t('expBooking.freeCancel', { hours: hoursLabel(bookable.cancellationPolicyHours, language) })}
          </p>
        ) : null}

        {prepareError && (
          <p role="alert" className="rounded-dg-lg bg-dg-critical-wash px-4 py-3 text-[0.875rem] text-dg-ink">
            {prepareError}
          </p>
        )}

        {checkout.outcome && (checkout.phase === 'priceChanged' || checkout.phase === 'failed') && (
          <CheckoutIssuePanel
            priceChange={checkout.outcome.kind === 'priceChanged' ? checkout.outcome : null}
            issue={checkout.outcome.kind === 'failed' ? checkout.outcome.issue : null}
            busy={checkout.busy}
            onConfirmPrice={() => void checkout.confirmPrice()}
            onRehold={() => void checkout.rehold()}
            onRetry={() => void handleConfirm()}
            onSignIn={() => {
              writeBookingDraft({ slug: experience.slug, date, timeSlot, guests, phone, pickup, notes });
              setIntendedRoute(urlFromRoute('/experiences', { experienceSlug: experience.slug }));
              navigateTo('/auth/sign-in');
            }}
            onContactSupport={() => navigateTo('/help')}
            onPickAnotherDate={() => {
              checkout.reset();
              setTimeSlot(null);
              setSlotsRetry((n) => n + 1);
            }}
            onDismiss={checkout.reset}
          />
        )}
      </div>
    </Sheet>
  );
};
