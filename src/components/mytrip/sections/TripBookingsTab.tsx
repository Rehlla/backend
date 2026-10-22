import React from 'react';
import { Building, Car, Waves, Bike } from 'lucide-react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { useTheme } from '../../../context/ThemeContext';
import { useTrip } from '../../../context/TripContext';
import type { ConfirmedBookingItem } from '../myTripData';
import { TripBudgetCard } from './TripBudgetCard';
import { TripGroupSplitCard } from './TripGroupSplitCard';
import { TripConservationCard } from './TripConservationCard';

interface TripBookingsTabProps {
  travelersCount: number;
  onShare: () => void;
  onSelectBooking: (booking: ConfirmedBookingItem) => void;
  tripId?: string;
}

export const TripBookingsTab: React.FC<TripBookingsTabProps> = ({ travelersCount, onShare, onSelectBooking, tripId }) => {
  const { language, t } = useLanguage();
  const { isDark } = useTheme();
  const { bookings } = useTrip();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* Left Column: Bookings Matrix (7/12) */}
      <div className="lg:col-span-7 space-y-6">
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-xl space-y-6 ${
          isDark ? 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] text-[var(--text-primary)]'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-[var(--accent-primary)]">
                {t('myTrip.bookingsTitle')}
              </span>
              <h3 className="text-xl chart-heading font-bold mt-1">
                {t('myTrip.activeVouchersLogistics')}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">
              {bookings.length} {t('myTrip.confirmedBookings')}
            </span>
          </div>

          <div className="space-y-3.5">
            {bookings.map(b => (
              <div
                key={b.id}
                onClick={() => onSelectBooking(b)}
                className={`p-4 rounded-2xl border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer flex items-center justify-between gap-4 ${
                  isDark ? 'bg-[var(--surface-container)] border-white/5 hover:border-white/20' : 'bg-[var(--surface-card)] border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] flex items-center justify-center font-bold">
                    {b.serviceType === 'hotel' ? <Building className="w-5 h-5" /> : b.serviceType === 'transfer' ? <Car className="w-5 h-5" /> : b.serviceType === 'rental' ? <Bike className="w-5 h-5" /> : <Waves className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm chart-heading font-bold text-current">{b.title}</h4>
                    <span className={`text-xs ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]'}`}>
                      #{b.confirmationCode} · {b.provider}
                    </span>
                    {b.futureRide && (
                      <div className="text-[11px] mt-1 text-[var(--text-secondary)]">
                        {t('transfers.hub.step.booked')}
                        {' → '}
                        {t('transfers.hub.step.driver')}
                        {b.futureRide.driverAssigned ? ' ✓' : ''}
                        {' → '}
                        {t('transfers.hub.step.pickup')}
                        {' → '}
                        {t('transfers.hub.step.arrival')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-end">
                  <span className="text-sm font-bold chart-heading text-[var(--accent-secondary)] block">{b.priceEGP.toLocaleString()} EGP</span>
                  <span className="text-[10px] font-bold text-emerald-400">✓ {b.status}</span>
                </div>
              </div>
            ))}
          </div>        </div>

        {/* Traveler's reef-impact record + eco-action logging. */}
        <TripConservationCard tripId={tripId} />

      </div>

      {/* Right Column: Budget & Group Split (5/12) */}
      <div className="lg:col-span-5 space-y-6">
        <TripBudgetCard />
        <TripGroupSplitCard travelersCount={travelersCount} onShare={onShare} tripId={tripId} />
      </div>

    </div>
  );
};