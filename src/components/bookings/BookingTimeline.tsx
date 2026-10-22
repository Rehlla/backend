import React from 'react';
import { Check } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { bookingTimeline } from '../../shared/bookingTimeline';

/**
 * BookingTimeline — the traveler-visible lifecycle of one booking.
 *
 * Renders the four stages (requested → confirmed → in service → completed)
 * as an accessible ordered list, or a single terminal verdict (completed /
 * cancelled / refunded / failed) when the booking has left the live path.
 * Colors follow the manage modal's status tones so the two never disagree.
 */
export const BookingTimeline: React.FC<{
  supplierState: string;
  refunded?: boolean;
}> = ({ supplierState, refunded = false }) => {
  const { t } = useLanguage();
  const { stages, terminal } = bookingTimeline(supplierState, refunded);

  if (terminal) {
    const tone =
      terminal.tone === 'good'
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/40'
        : 'bg-red-500/10 text-red-400 border-red-500/40';
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-extrabold ${tone}`}
        role="status"
      >
        {t(terminal.labelKey)}
      </div>
    );
  }

  return (
    <ol className="flex items-center w-full" aria-label={t('bookings.timeline.label')}>
      {stages.map((stage, i) => {
        const done = stage.state === 'done';
        const current = stage.state === 'current';
        return (
          <li key={stage.key} className={`flex items-center ${i < stages.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <span
                aria-current={current ? 'step' : undefined}
                className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-[11px] font-extrabold ${
                  done
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : current
                      ? 'border-[var(--accent-primary)] text-[var(--accent-primary)] bg-[var(--accent-primary)]/10'
                      : 'border-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : <span aria-hidden="true">{i + 1}</span>}
              </span>
              <span
                className={`text-[10px] font-bold whitespace-nowrap ${
                  done || current ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'
                }`}
              >
                {t(`bookings.timeline.${stage.key}`)}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div
                aria-hidden="true"
                className={`flex-1 h-0.5 mx-1 mb-6 rounded ${done ? 'bg-emerald-500' : 'bg-[var(--border-subtle)]'}`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default BookingTimeline;
