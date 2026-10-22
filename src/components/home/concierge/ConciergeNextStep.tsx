import React from 'react';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTrip } from '../../../context/TripContext';
import { resolveHomeNextStep } from '../../../services/homeNextStepResolver';
import { clockMinutes, resolveTripPass, type PassStop, type PassStopStatus } from '../../../services/homeTripPass';
import { daysLabel, travelersLabel } from '../../../utils/countLabels';

/**
 * The homepage's next-step gate, set as a trip pass: the next day out (its
 * date, the countdown and the shape of that day), then the phase's copy, the
 * trip's facts and the booked outings with their real status.
 *
 * Purely presentational. The copy and routes come from `resolveHomeNextStep`,
 * the trip reading from `resolveTripPass`; both are pure and unit-tested
 * (tests/domain/homeNextStep, tests/domain/homeTripPass). Whatever the trip
 * does not hold — no dates, no outings — is left out, not filled in.
 */

type Lang = 'en' | 'ar';

const localeOf = (language: Lang) => (language === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);

const formatDate = (iso: string, language: Lang, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(localeOf(language), { timeZone: 'UTC', ...options }).format(asDate(iso));

/** "9 Oct" or "9 – 12 Oct" (or across months, "30 Sep – 2 Oct"). */
function dateRange(start: string, end: string | undefined, language: Lang): string {
  const short: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (!end || end === start) return formatDate(start, language, { day: 'numeric', month: 'long' });
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const from = sameMonth ? formatDate(start, language, { day: 'numeric' }) : formatDate(start, language, short);
  return `${from} – ${formatDate(end, language, short)}`;
}

function countdown(days: number, language: Lang): string {
  const text = new Intl.RelativeTimeFormat(localeOf(language), { numeric: 'auto' }).format(days, 'day');
  return language === 'en' ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** "03:30 PM" → "3:30 PM" / "3:30 م". */
function clockLabel(time: string, language: Lang): string {
  const m = time.trim().match(/^0?(\d{1,2}:\d{2})\s*(AM|PM)?$/i);
  if (!m) return time;
  if (!m[2]) return m[1];
  if (language === 'en') return `${m[1]} ${m[2].toUpperCase()}`;
  return `${m[1]} ${m[2].toUpperCase() === 'AM' ? 'ص' : 'م'}`;
}

const STATUS_TONE: Record<PassStopStatus, string> = {
  confirmed: 'bg-dg-positive-wash text-dg-positive',
  pending: 'bg-dg-warning-wash text-dg-warning',
  changed: 'bg-dg-critical-wash text-dg-critical',
  planned: 'bg-dg-sunken text-dg-ink-2',
};

const STATUS_DOT: Record<PassStopStatus, string> = {
  confirmed: 'bg-dg-positive',
  pending: 'bg-dg-warning',
  changed: 'bg-dg-critical',
  planned: 'bg-dg-ink-3',
};

const DAY_START = 6 * 60;
const DAY_END = 24 * 60;
const DEFAULT_OUTING_MINUTES = 90;

const STATUS_BLOCK: Record<PassStopStatus, string> = {
  confirmed: 'bg-dg-positive',
  pending: 'bg-dg-warning',
  changed: 'bg-dg-critical',
  planned: 'bg-dg-ink-3',
};

function hourLabel(hour: number, language: Lang): string {
  const h = hour % 24;
  const twelve = h % 12 === 0 ? 12 : h % 12;
  if (language === 'en') return `${twelve} ${h < 12 ? 'AM' : 'PM'}`;
  return `${twelve} ${h < 12 ? 'ص' : 'م'}`;
}

/** The day from 6 AM to midnight, each outing a block at its departure and as long as it runs. */
const DayStrip: React.FC<{ stops: PassStop[]; language: Lang; t: (k: string) => string }> = ({ stops, language, t }) => {
  const span = DAY_END - DAY_START;
  const blocks = stops
    .map((stop) => ({ stop, start: clockMinutes(stop.time) }))
    .filter((b): b is { stop: PassStop; start: number } => b.start !== null && b.start < DAY_END)
    .map(({ stop, start }) => {
      const from = Math.max(start, DAY_START);
      const to = Math.min(start + (stop.durationMinutes ?? DEFAULT_OUTING_MINUTES), DAY_END);
      return {
        stop,
        offset: ((from - DAY_START) / span) * 100,
        width: Math.max(((to - from) / span) * 100, 2.5),
      };
    });
  if (blocks.length === 0) return null;

  return (
    <div>
      <p className="mb-3 text-[0.8125rem] font-medium text-dg-ink-3">{t('home.pass.dayShape')}</p>
      <div className="relative h-11 rounded-dg-md border border-dg-line bg-dg-bg/40">
        {[12, 18].map((h) => (
          <span
            key={h}
            className="absolute inset-y-2 w-px bg-dg-line"
            style={{ insetInlineStart: `${(((h * 60) - DAY_START) / span) * 100}%` }}
            aria-hidden="true"
          />
        ))}
        {blocks.map(({ stop, offset, width }) => (
          <span
            key={stop.id}
            title={`${stop.time ? clockLabel(stop.time, language) : ''} ${(language === 'ar' && stop.titleAr) || stop.titleEn}`}
            className={cn('absolute inset-y-1.5 rounded-[6px] opacity-90', STATUS_BLOCK[stop.status])}
            style={{ insetInlineStart: `${offset}%`, width: `${width}%` }}
          />
        ))}
      </div>
      <div className="relative mt-2 h-4 text-[0.6875rem] text-dg-ink-3 tabular-nums" aria-hidden="true">
        {[6, 12, 18, 24].map((h, i, all) => (
          <span
            key={h}
            className={cn('absolute top-0 whitespace-nowrap', i === 0 ? '' : i === all.length - 1 ? '-translate-x-full rtl:translate-x-full' : '-translate-x-1/2 rtl:translate-x-1/2')}
            style={{ insetInlineStart: `${(((h * 60) - DAY_START) / span) * 100}%` }}
          >
            {hourLabel(h, language)}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Shown when the trip has no dates yet: the place, quietly. */
const TripMark: React.FC = () => {
  const { t } = useLanguage();
  return (
    <div className="flex h-full flex-col justify-end gap-2">
      <p className="font-dg-display text-[4.5rem] font-semibold leading-[0.9] text-dg-ink sm:text-[5.5rem]">
        {t('home.pass.place')}
      </p>
      <p className="text-[0.9375rem] text-dg-ink-2">{t('home.pass.noDates')}</p>
    </div>
  );
};

const Fact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="min-w-0 px-4 first:ps-0 last:pe-0">
    <dt className="text-[0.75rem] text-dg-ink-3">{label}</dt>
    <dd className="mt-1 truncate text-[0.9375rem] font-semibold text-dg-ink">{value}</dd>
  </div>
);

const StopRow: React.FC<{ stop: PassStop; showDate: boolean; language: Lang; t: (k: string) => string; last: boolean }> = ({
  stop,
  showDate,
  language,
  t,
  last,
}) => {
  const title = (language === 'ar' && stop.titleAr) || stop.titleEn;
  const supplier = (language === 'ar' && stop.supplierAr) || stop.supplierEn;
  return (
    <li className="relative grid grid-cols-[4.75rem_minmax(0,1fr)] gap-x-4 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]">
      <div className="pt-0.5 text-end tabular-nums">
        {stop.time && <p className="text-[0.9375rem] font-semibold text-dg-ink">{clockLabel(stop.time, language)}</p>}
        {showDate && stop.date && (
          <p className="mt-0.5 text-[0.75rem] text-dg-ink-3">
            {formatDate(stop.date, language, { weekday: 'short', day: 'numeric' })}
          </p>
        )}
      </div>
      <div className={cn('relative min-w-0 border-s border-dg-line ps-5', last ? 'pb-1' : 'pb-5')}>
        <span
          className={cn('absolute -start-[5px] top-[0.55rem] h-[9px] w-[9px] rounded-full ring-4 ring-dg-surface', STATUS_DOT[stop.status])}
          aria-hidden="true"
        />
        <p className="font-semibold leading-snug text-dg-ink">{title}</p>
        {supplier && <p className="mt-0.5 truncate text-[0.8125rem] text-dg-ink-3">{supplier}</p>}
        <span
          className={cn(
            'mt-2 inline-flex rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium sm:hidden',
            STATUS_TONE[stop.status]
          )}
        >
          {t(`home.pass.status.${stop.status}`)}
        </span>
      </div>
      <span
        className={cn(
          'hidden self-start whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-medium sm:inline-flex',
          STATUS_TONE[stop.status]
        )}
      >
        {t(`home.pass.status.${stop.status}`)}
      </span>
    </li>
  );
};

export const ConciergeNextStep: React.FC = () => {
  const { t, isRTL, language } = useLanguage();
  const { lifecycle, activeTrip, activeTripItems, bookings, navigateTo } = useTrip();
  const lang: Lang = language === 'ar' ? 'ar' : 'en';

  const pass = resolveTripPass(activeTrip, activeTripItems ?? [], bookings ?? []);
  const step = resolveHomeNextStep(lifecycle, { activeTrip, pendingBookings: pass?.pendingCount });

  const stops = pass?.stops ?? [];
  const multiDay = new Set(stops.map((s) => s.date).filter(Boolean)).size > 1;
  const running = lifecycle.hasActiveActivity
    ? (lang === 'ar' && lifecycle.activeActivityTitleAr) || step.liveValue
    : undefined;
  // With outings listed, the trip's name adds nothing; a running activity always does.
  const live = running ?? (stops.length === 0 ? step.liveValue : undefined);

  const facts = [
    pass?.startDate && { label: t('home.pass.dates'), value: dateRange(pass.startDate, pass.endDate, lang) },
    pass?.lengthDays && { label: t('home.pass.length'), value: daysLabel(pass.lengthDays, lang) },
    pass?.travelers && { label: t('home.pass.travelers'), value: travelersLabel(pass.travelers, lang) },
  ].filter((f): f is { label: string; value: string } => Boolean(f));

  return (
    <section aria-label={t('home.nextStep.label')} dir={isRTL ? 'rtl' : 'ltr'} className="dahab-shell pt-10 sm:pb-10">
      <div
        id="concierge-nextstep"
        data-nextstep={step.mode}
        className="-mx-4 grid overflow-hidden rounded-dg-xl border border-dg-line bg-dg-surface text-dg-ink sm:-mx-6 lg:-mx-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        {/* The next day out: its date, how far off it is, and the shape of that day. */}
        <div
          className="relative flex flex-col justify-between gap-8 overflow-hidden border-b border-dg-line p-6 sm:p-8 lg:border-b-0 lg:border-e lg:p-10"
          style={{
            backgroundImage:
              'radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, var(--dg-action) 16%, transparent) 0%, transparent 60%), linear-gradient(to bottom, color-mix(in oklab, var(--dg-action) 6%, var(--dg-surface)), var(--dg-surface))',
          }}
        >
          {pass?.nextDate ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <p className="text-[0.8125rem] font-medium text-dg-ink-3">{t('home.pass.nextOuting')}</p>
                {pass.daysUntilNext !== undefined && (
                  <span className="inline-flex items-center gap-2 rounded-full bg-dg-action-wash px-3 py-1 text-[0.8125rem] font-semibold text-dg-action">
                    <span className="h-1.5 w-1.5 rounded-full bg-dg-action" aria-hidden="true" />
                    {countdown(pass.daysUntilNext, lang)}
                  </span>
                )}
              </div>

              <div className="flex items-end gap-5">
                <p className="font-dg-display text-[5.5rem] font-semibold leading-[0.8] text-dg-ink tabular-nums sm:text-[7rem]">
                  {formatDate(pass.nextDate, lang, { day: 'numeric' })}
                </p>
                <div className="pb-1.5">
                  <p className="text-lg font-semibold text-dg-ink">{formatDate(pass.nextDate, lang, { weekday: 'long' })}</p>
                  <p className="text-[0.9375rem] text-dg-ink-2">
                    {formatDate(pass.nextDate, lang, { month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              <DayStrip stops={stops.filter((s) => s.date === pass.nextDate)} language={lang} t={t} />
            </>
          ) : (
            <TripMark />
          )}
        </div>

        <div className="flex min-w-0 flex-col p-6 sm:p-8 lg:p-10">
          <p data-nextstep="eyebrow" className="inline-flex items-center gap-2 text-[0.8125rem] font-medium text-dg-ink-2">
            <span
              className={cn('h-1.5 w-1.5 rounded-full', pass && pass.pendingCount > 0 ? 'bg-dg-warning' : 'bg-dg-positive')}
              aria-hidden="true"
            />
            {t(step.eyebrowKey)}
          </p>
          <h2
            data-nextstep="title"
            className="mt-3 font-dg-display text-[2rem] font-semibold leading-[1.1] text-dg-ink text-balance sm:text-[2.5rem]"
          >
            {t(step.titleKey)}
          </h2>
          <p data-nextstep="body" className="mt-3 max-w-[52ch] text-[0.9375rem] leading-relaxed text-dg-ink-2">
            {t(step.bodyKey)}
          </p>

          {live && (
            <p className="mt-4 inline-flex max-w-full items-center gap-2 self-start rounded-full border border-dg-line px-3 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-dg-action" aria-hidden="true" />
              <span data-nextstep="live" className="truncate text-[0.8125rem] font-medium text-dg-ink-2">
                {live}
              </span>
            </p>
          )}

          {facts.length > 0 && (
            <dl
              className="mt-7 grid divide-x divide-dg-line border-y border-dg-line py-4"
              style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}
            >
              {facts.map((f) => (
                <Fact key={f.label} {...f} />
              ))}
            </dl>
          )}

          {stops.length > 0 && (
            <div className="mt-7">
              <p className="mb-4 text-[0.8125rem] font-medium text-dg-ink-3">{t('home.pass.bookings')}</p>
              <ol>
                {stops.map((stop, i) => (
                  <StopRow
                    key={stop.id}
                    stop={stop}
                    showDate={multiDay}
                    language={lang}
                    t={t}
                    last={i === stops.length - 1}
                  />
                ))}
              </ol>
              {pass && pass.moreCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigateTo('/my-trip')}
                  className="mt-3 ms-[7rem] text-[0.8125rem] font-medium text-dg-ink-2 underline-offset-4 hover:text-dg-ink hover:underline sm:ms-[7.75rem]"
                >
                  {t('home.pass.more', { n: pass.moreCount })}
                </button>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-col gap-3 sm:mt-auto sm:flex-row sm:items-center sm:pt-8">
            <button
              type="button"
              onClick={() => navigateTo(step.primaryRoute)}
              className="group inline-flex h-[52px] items-center justify-between gap-5 rounded-full bg-dg-action ps-7 pe-2 text-[0.9375rem] font-semibold text-dg-action-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.22)] transition-[transform,background-color] duration-300 ease-out hover:bg-dg-action-hover focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-dg-action active:scale-[0.985] sm:justify-center"
            >
              <span data-nextstep="primary">{t(step.primaryKey)}</span>
              <span
                className="grid h-9 w-9 place-items-center rounded-full bg-dg-action-ink/10 transition-transform duration-300 ease-out group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"
                aria-hidden="true"
              >
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
              </span>
            </button>

            {step.secondaryKey && step.secondaryRoute && (
              <button
                type="button"
                onClick={() => navigateTo(step.secondaryRoute!)}
                className="inline-flex h-[52px] items-center justify-center rounded-full px-5 text-[0.9375rem] font-medium text-dg-ink-2 transition-colors duration-200 hover:bg-dg-action-wash hover:text-dg-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-dg-ink"
              >
                <span data-nextstep="secondary">{t(step.secondaryKey)}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
