import React from 'react';
import { Clock, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import { useTrip } from '../../../context/TripContext';
import type { TimelineActivity } from '../myTripData';

export interface NextUpActivity {
  dayNumber: number;
  dayTitle: string;
  activity: TimelineActivity;
}

interface TripNextUpBannerProps {
  nextUpActivity: NextUpActivity | null;
}

export const TripNextUpBanner: React.FC<TripNextUpBannerProps> = ({ nextUpActivity }) => {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const { showToast } = useTrip();

  return (
    <>
      {nextUpActivity && (
        <section
          aria-labelledby="next-up-heading"
          className={`p-6 sm:p-8 rounded-3xl border shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
            isDark
              ? 'bg-gradient-to-br from-[var(--surface-card)] to-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-primary)]'
              : 'bg-gradient-to-br from-[var(--surface-card)] to-[#F2EDDF] border-[var(--border-subtle)] text-[var(--text-primary)]'
          }`}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border border-[var(--accent-primary)]/30 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 animate-pulse" />
                <span>{t('myTrip.nextUpTitle')} · {t('myTrip.dayZero', { dayNumber: nextUpActivity.dayNumber })}</span>
              </span>
              <span className="text-xs font-bold text-[var(--accent-secondary)]">
                {nextUpActivity.activity.time}
              </span>
            </div>

            <h2 id="next-up-heading" className="text-xl sm:text-2xl chart-heading font-bold">
              {nextUpActivity.activity.title}
            </h2>

            <div className={`flex flex-wrap items-center gap-4 text-xs font-medium ${
              isDark ? 'text-[var(--text-secondary)]/80' : 'text-[var(--text-secondary)]'
            }`}>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span>{nextUpActivity.activity.location}</span>
              </span>
              {nextUpActivity.activity.notes && (
                <>
                  <span className="opacity-30">•</span>
                  <span>{nextUpActivity.activity.notes}</span>
                </>
              )}
            </div>
          </div>

          {/* Quick Next Up Actions */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              type="button"
              id="next-up-directions-btn"
              onClick={() => {
                showToast(
                  t('myTrip.openingDirectionsTo', { location: nextUpActivity.activity.location ?? '' })
                );
              }}
              className={`px-5 py-3 rounded-2xl text-xs font-bold border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-2 ${
                isDark
                  ? 'bg-[var(--surface-container)] hover:bg-[var(--surface-card)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                  : 'bg-[var(--surface-container)] hover:bg-[var(--surface-card)] text-[var(--text-primary)] border-[var(--border-subtle)]'
              }`}
            >
              <Navigation className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{t('myTrip.directions')}</span>
            </button>

            <button
              type="button"
              id="next-up-whatsapp-btn"
              onClick={() => {
                showToast(
                  t('myTrip.connectingWithSinaiLocal')
                );
              }}
              className="px-6 py-3 rounded-2xl bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)] text-[var(--surface-container)] text-xs font-extrabold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center gap-2 shadow-md"
            >
              <MessageCircle className="w-3.5 h-3.5 text-[var(--surface-container)]" />
              <span>{t('myTrip.contactHost')}</span>
            </button>
          </div>
        </section>
      )}
    </>
  );
};