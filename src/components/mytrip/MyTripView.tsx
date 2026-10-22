import React, { useMemo, useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { formatTripDateRange } from '../../utils/tripDates';
import { useApiResource } from '../../hooks/useApiResource';
import { api } from '../../services/api';
import type { ConfirmedBookingItem } from './myTripData';
import { ManageTripModal } from './ManageTripModal';
import { EditTripDetailsSheet } from './EditTripDetailsSheet';
import { BookingDetailModal } from './BookingDetailModal';
import { OfflineTripPackModal } from '../expedition/OfflineTripPackModal';

// Sub-flow routing + logic
import { MyTripSubFlows } from './MyTripSubFlows';
import { useMyTripSubFlows } from './useMyTripSubFlows';

// Sections
import { TripCockpitHeader } from './sections/TripCockpitHeader';
import { TripHeroCard } from './sections/TripHeroCard';
import { TripNextUpBanner } from './sections/TripNextUpBanner';
import { TripTabRibbon } from './sections/TripTabRibbon';
import { TripTimelineTab } from './sections/TripTimelineTab';
import { TripBookingsTab } from './sections/TripBookingsTab';
import { TripToolsTab } from './sections/TripToolsTab';

interface MyTripViewProps {
  onBackToHome?: () => void;
  onExploreClick?: () => void;
  initialBriefingOpen?: boolean;
  initialArrivalOpen?: boolean;
  initialFirstTwoHoursOpen?: boolean;
  initialDay2CompanionOpen?: boolean;
  initialWhatShouldIDoNowOpen?: boolean;
  initialFoodNowOpen?: boolean;
  initialChangeRecoveryOpen?: boolean;
  initialHelpMeNowOpen?: boolean;
}

/**
 * Module scope so the reference is stable — useApiResource takes the fetcher as
 * an effect dependency, and an inline arrow re-requests on every render.
 */
const fetchTripWeather = () => api.getWeatherTelemetry();

export const MyTripView: React.FC<MyTripViewProps> = ({
  onBackToHome,
  onExploreClick,
  initialBriefingOpen = false,
  initialArrivalOpen = false,
  initialFirstTwoHoursOpen = false,
  initialDay2CompanionOpen = false,
  initialWhatShouldIDoNowOpen = false,
  initialFoodNowOpen = false,
  initialChangeRecoveryOpen = false,
  initialHelpMeNowOpen = false,
}) => {
  const {
    profile,
    tripBrief,
    user,
    activeTrip,
    activeTripItems,
    tripDays,
    bookings,
    navigateTo,
    showToast,
    reloadTrip
  } = useTrip();

  const { language, isRTL, t } = useLanguage();
  const { isDark } = useTheme();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'timeline' | 'bookings' | 'tools'>('timeline');

  // Active Day Filter in Timeline ('all' or 1..5)
  const [selectedDayFilter, setSelectedDayFilter] = useState<'all' | number>('all');

  // Sub-Flow States
  const sub = useMyTripSubFlows({
    briefingOpen: initialBriefingOpen,
    arrivalOpen: initialArrivalOpen,
    firstTwoHoursOpen: initialFirstTwoHoursOpen,
    day2CompanionOpen: initialDay2CompanionOpen,
    whatShouldIDoNowOpen: initialWhatShouldIDoNowOpen,
    foodNowOpen: initialFoodNowOpen,
    changeRecoveryOpen: initialChangeRecoveryOpen,
    helpMeNowOpen: initialHelpMeNowOpen,
  });

  // Modals
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isEditDetailsOpen, setIsEditDetailsOpen] = useState(false);
  const [isOfflinePackOpen, setIsOfflinePackOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ConfirmedBookingItem | null>(null);
  const [rentalCancellingId, setRentalCancellingId] = useState<string | null>(null);
  const [isDeletingTrip, setIsDeletingTrip] = useState(false);

  /** Cancels a rental booking, then re-reads the trip so the status updates. */
  const handleCancelRental = async (booking: ConfirmedBookingItem) => {
    setRentalCancellingId(booking.id);
    try {
      await api.cancelRentalBooking(booking.id);
      showToast('Rental booking cancelled.');
      reloadTrip();
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not cancel the rental booking.');
    } finally {
      setRentalCancellingId(null);
    }
  };

  // Expanded days accordion
  const [expandedDays, setExpandedDays] = useState<Record<number, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
  });

  const travelerDisplayName = profile.name || user?.displayName || (t('myTrip.ahmed'));
  const durationDays = tripBrief.durationDays || profile.lengthDays || (tripDays.length > 0 ? tripDays.length : 4);
  const travelersCount = activeTrip?.travelersCount ?? profile.travelersCount ?? 1;
  const dateRange = formatTripDateRange(activeTrip?.startDate, activeTrip?.endDate, language === 'ar' ? 'ar' : 'en');

  /**
   * Live conditions for the hero pill.
   *
   * The pill was the constant "28°C · Sunny · Calm Red Sea Swell". This is the
   * same reading /live already shows; getWeatherTelemetry resolves to null on
   * failure, and the pill is then not rendered at all.
   */
  const weatherResource = useApiResource(fetchTripWeather);
  const weather = weatherResource.data?.available ? weatherResource.data : null;

  // Next Up activity (finds first upcoming non-completed activity)
  const nextUpActivity = useMemo(() => {
    for (const day of tripDays) {
      for (const act of day.activities) {
        if (act.status !== 'Confirmed') {
          return { dayNumber: day.dayNumber, dayTitle: day.title, activity: act };
        }
      }
    }
    return null;
  }, [tripDays]);

  // Minutes until that next activity, for the spontaneous-recommendations
  // window. "H:MM AM/PM" in the itinerary is a wall-clock time on that day; a
  // past or far-future time (or an unparseable one) falls back to the 2h
  // "right now" window the backend assumes anyway.
  const availableMinutes = useMemo(() => {
    if (!nextUpActivity) return 120;
    const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((nextUpActivity.activity.time || '').trim());
    if (!m) return 120;
    let hours = Number(m[1]);
    const minutes = Number(m[2]);
    if (m[3].toUpperCase() === 'PM' && hours < 12) hours += 12;
    if (m[3].toUpperCase() === 'AM' && hours === 12) hours = 0;
    const target = hours * 60 + minutes;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const diff = target - nowMinutes;
    if (diff <= 0 || diff > 240) return 120;
    return diff;
  }, [nextUpActivity]);

  // Handle Share Trip
  const handleShareTrip = () => {
    if (navigator.share) {
      navigator.share({
        title: t('myTrip.sDahabJourney', { travelerDisplayName }),
        text: t('myTrip.reviewMyConfirmedDahab'),
        url: window.location.href,
      }).catch(() => {
        showToast(t('myTrip.tripLinkCopiedTo'));
      });
    } else {
      navigator.clipboard?.writeText?.(window.location.href);
      showToast(t('myTrip.tripLinkCopiedTo'));
    }
  };

  const toggleDayExpanded = (dayNum: number) => {
    setExpandedDays(prev => ({ ...prev, [dayNum]: !prev[dayNum] }));
  };

  const handleExpandAll = () => {
    setExpandedDays({ 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true });
  };

  const handleCollapseAll = () => {
    setExpandedDays({ 1: false, 2: false, 3: false, 4: false, 5: false, 6: false, 7: false });
  };

  // =========================================================================
  // SUB-FLOW ROUTING
  // =========================================================================
  if (sub.activeView) {
    return <MyTripSubFlows sub={sub} onExploreClick={onExploreClick} availableMinutes={availableMinutes} />;
  }

  return (
    <div
      id="mytrip-command-dashboard"
      className={`min-h-screen pb-28 transition-colors duration-300 relative ${
        isDark ? 'bg-gradient-to-b from-[var(--surface-container)] via-[#0f1813] to-[#08120f] text-[var(--text-primary)]' : 'bg-gradient-to-b from-[var(--bg-canvas)] via-[#f7f5f0] to-[#efeae2] text-[var(--text-primary)]'
      }`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <TripCockpitHeader
        onBackToHome={onBackToHome}
        onOpenSos={() => sub.openHelp()}
        onOpenFood={sub.toFood}
        onOpenOfflinePack={() => setIsOfflinePackOpen(true)}
      />

      {/* 2. MAIN CONTENT WRAPPER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        <TripHeroCard
          travelerDisplayName={travelerDisplayName}
          durationDays={durationDays}
          travelersCount={travelersCount}
          dateRange={dateRange}
          tripTitle={activeTrip?.title ?? null}
          tripStatus={activeTrip?.status ?? null}
          pendingBookings={bookings.filter(b => b.status === 'Pending').length}
          weather={weather}
          onShare={handleShareTrip}
          onManageTrip={() => setIsManageModalOpen(true)}
          onAddActivity={() => navigateTo('/explore')}
          onEditDetails={() => setIsEditDetailsOpen(true)}
        />

        {/* 3. NEXT UP LIVE COMPANION BANNER */}
        <TripNextUpBanner nextUpActivity={nextUpActivity} />

        {/* 4. COMMAND CENTER TABS */}
        <section aria-label="Trip dashboard sections" className="space-y-6">
          <TripTabRibbon
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onExpandAll={handleExpandAll}
            onCollapseAll={handleCollapseAll}
          />

          {activeTab === 'timeline' && (
            <TripTimelineTab
              selectedDayFilter={selectedDayFilter}
              onDayFilter={setSelectedDayFilter}
              expandedDays={expandedDays}
              onToggleDay={toggleDayExpanded}
            />
          )}

          {activeTab === 'bookings' && (
            <TripBookingsTab
              travelersCount={travelersCount}
              onShare={handleShareTrip}
              onSelectBooking={setSelectedBooking}
              tripId={activeTrip?.id}
            />
          )}

          {activeTab === 'tools' && (
            <TripToolsTab
              onOpenSos={() => sub.openHelp()}
              onOpenFood={sub.toFood}
              onOpenSpontaneous={sub.toSpontaneous}
              onOpenBriefing={sub.toBriefing}
              onOpenOfflinePack={() => setIsOfflinePackOpen(true)}
            />
          )}
        </section>

      </main>

      {/* 5. MODALS */}
      {isManageModalOpen && (
        <ManageTripModal
          isOpen={isManageModalOpen}
          onClose={() => setIsManageModalOpen(false)}
          canDelete={Boolean(activeTrip) && !['BOOKED', 'CONFIRMED'].some(s => (activeTripItems || []).some(i => i.status === s))}
          isDeleting={isDeletingTrip}
          onDelete={async () => {
            if (!activeTrip) return;
            setIsDeletingTrip(true);
            try {
              await api.deleteTrip(activeTrip.id);
              showToast('Trip deleted.');
              setIsManageModalOpen(false);
              // Re-read from the server: the deleted trip is now gone, so the
              // empty state shows instead of a stale copy in local state.
              reloadTrip();
            } catch (err: any) {
              showToast(err?.message || 'Could not delete this trip.');
            } finally {
              setIsDeletingTrip(false);
            }
          }}
          onSelectOption={(optionId) => {
            setIsManageModalOpen(false);
            // Each option now lands somewhere real: two open the flows that
            // already exist for the exact job, two show what data exists today
            // (bookings tab) instead of a toast pretending work is under way.
            switch (optionId) {
              case 'edit-itinerary':
                setActiveTab('timeline');
                showToast('Reorder or remove items directly in the day timeline.');
                break;
              case 'add-activity':
                navigateTo('/explore');
                break;
              case 'change-booking':
                setActiveTab('bookings');
                showToast('Open a booking to request changes through Dahab Booking Care.');
                break;
              case 'view-booking-details':
                setActiveTab('bookings');
                break;
              default:
                break;
            }
          }}
        />
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          isOpen={Boolean(selectedBooking)}
          onClose={() => setSelectedBooking(null)}
          onCancelRental={handleCancelRental}
          cancelling={rentalCancellingId === selectedBooking.id}
        />
      )}

      <EditTripDetailsSheet open={isEditDetailsOpen} onClose={() => setIsEditDetailsOpen(false)} />

      {isOfflinePackOpen && (
        <OfflineTripPackModal
          isOpen={isOfflinePackOpen}
          onClose={() => setIsOfflinePackOpen(false)}
        />
      )}

    </div>
  );
};