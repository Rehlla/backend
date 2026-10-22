import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { LedgerEntry, TransferTrackingRecord, ConfirmedBookingItem } from '../types';
// Fetched only when there is a Firebase user to sync for. See the note in
// AuthContext: the SDK is 680 kB and unusable on a deployment without Firebase
// Admin credentials, which is this one.
const loadFirebase = () => import('../lib/firebase');
import { useAuth } from './AuthContext';
import { useUI } from './UIContext';
import { api } from '../services/api';
import { ApiError } from '../services/apiError';
import { buildTravelerBookings, rentalBookingToConfirmedBookingItem, selectActiveTrip } from '../services/tripBookingMapper';
import { journeyStageFromTrip } from '../services/travelerLifecycleResolver';
import type { TripEntity, TripItemWithSupplier } from '../shared/types/trip';

/**
 * Five fabricated transactions totalling 20,800 EGP for "Ahmed Mansour".
 *
 * These were the *initial ledger state for every user* — a traveler who had
 * never paid anything opened their financial history and read a stranger's
 * payments — and the Firestore sync merged real entries into them rather than
 * replacing them, so they never went away. They are kept only for the
 * staff-gated demo simulation, which is what they were written for.
 */
export const DEMO_LEDGER_ENTRIES: LedgerEntry[] = [
  {
    id: 'LEDGER-001',
    transactionId: 'TXN-984102-PAY',
    idempotencyKey: 'IDEMP-PAY-001-894',
    bookingRef: 'DHB-HTL-2026-081',
    tripId: 'DHB-TRIP-894',
    type: 'PAYMENT_CAPTURED',
    amountEGP: 12500,
    debitAccount: 'TRAVELER_CC_TOKEN_4910',
    creditAccount: 'PLATFORM_ESCROW_MAIN',
    currency: 'EGP',
    timestamp: '2026-08-23 14:15:22',
    status: 'SETTLED',
    signatureHash: 'sha256:4a8b79e192f81498bca120934fa12480bcae8124',
    metadata: { serviceType: 'hotel', supplierId: 'SUP-HTL-01', travelerName: 'Ahmed Mansour', reason: 'Ali Baba Hotel 5 Nights Escrow' }
  },
  {
    id: 'LEDGER-002',
    transactionId: 'TXN-984103-PAY',
    idempotencyKey: 'IDEMP-PAY-002-894',
    bookingRef: 'DHB-TRF-2026-042',
    tripId: 'DHB-TRIP-894',
    type: 'PAYMENT_CAPTURED',
    amountEGP: 1400,
    debitAccount: 'TRAVELER_CC_TOKEN_4910',
    creditAccount: 'PLATFORM_ESCROW_MAIN',
    currency: 'EGP',
    timestamp: '2026-08-23 14:15:23',
    status: 'SETTLED',
    signatureHash: 'sha256:88bc410294f91048bc8190234fa9912048bac912',
    metadata: { serviceType: 'transfer', supplierId: 'SUP-SHUTTLE-01', travelerName: 'Ahmed Mansour', reason: 'SSH Airport Private Van Transfer' }
  },
  {
    id: 'LEDGER-003',
    transactionId: 'TXN-984104-PAY',
    idempotencyKey: 'IDEMP-PAY-003-894',
    bookingRef: 'DHB-DIV-2026-118',
    tripId: 'DHB-TRIP-894',
    type: 'PAYMENT_CAPTURED',
    amountEGP: 2700,
    debitAccount: 'TRAVELER_CC_TOKEN_4910',
    creditAccount: 'PLATFORM_ESCROW_MAIN',
    currency: 'EGP',
    timestamp: '2026-08-23 14:15:24',
    status: 'SETTLED',
    signatureHash: 'sha256:71048bcae9124801948291048fbca78f921e44bc',
    metadata: { serviceType: 'diving', supplierId: 'SUP-DIVE-02', travelerName: 'Ahmed Mansour', reason: 'Coral Canyon Guided Dive' }
  },
  {
    id: 'LEDGER-004',
    transactionId: 'TXN-984105-PAY',
    idempotencyKey: 'IDEMP-PAY-004-894',
    bookingRef: 'DHB-SAF-2026-095',
    tripId: 'DHB-TRIP-894',
    type: 'PAYMENT_CAPTURED',
    amountEGP: 4200,
    debitAccount: 'TRAVELER_CC_TOKEN_4910',
    creditAccount: 'PLATFORM_ESCROW_MAIN',
    currency: 'EGP',
    timestamp: '2026-08-23 14:15:25',
    status: 'SETTLED',
    signatureHash: 'sha256:948271048bcae9124801948291048fbca78f921e',
    metadata: { serviceType: 'safari', supplierId: 'SUP-SAFARI-01', travelerName: 'Ahmed Mansour', reason: 'St. Catherine Sunrise Trek' }
  },
  {
    id: 'LEDGER-005',
    transactionId: 'TXN-984106-COMM',
    idempotencyKey: 'IDEMP-COMM-001-894',
    bookingRef: 'DHB-TRF-2026-042',
    tripId: 'DHB-TRIP-894',
    type: 'PLATFORM_COMMISSION',
    amountEGP: 210,
    debitAccount: 'PLATFORM_ESCROW_MAIN',
    creditAccount: 'PLATFORM_REVENUE_COMMISSIONS',
    currency: 'EGP',
    timestamp: '2026-08-23 14:16:00',
    status: 'SETTLED',
    signatureHash: 'sha256:102384a9c18d948271048bcae912480194829104',
    metadata: { serviceType: 'transfer', reason: 'Platform Commission (15%)' }
  }
];

export const DEFAULT_ANONYMOUS_TRANSFER: TransferTrackingRecord = {
  bookingId: '',
  referenceCode: '',
  driverName: '',
  driverNameAr: '',
  driverPhone: '',
  vehicleModel: '',
  vehiclePlate: '',
  pickupLocation: '',
  dropoffLocation: '',
  scheduledTime: '',
  status: 'COMPLETED',
  lastGpsUpdate: ''
};

export const DEMO_AHMED_TRANSFER: TransferTrackingRecord = {
  bookingId: 'DHB-TRF-2026-042',
  referenceCode: 'DHB-TRF-2026-042',
  driverName: 'Mahmoud Salem',
  driverNameAr: 'محمود سالم',
  driverPhone: '+20 100 876 5432',
  vehicleModel: 'Toyota HiAce Comfort Van 2024 White',
  vehiclePlate: 'ط ج د 4821',
  pickupLocation: 'Sharm El Sheikh Intl Airport (SSH) Terminal 1',
  dropoffLocation: 'Ali Baba Hotel, Lighthouse, Dahab',
  scheduledTime: 'Day 1 · 10:30 AM',
  flightNumber: 'MS-028 (Cairo → Sharm El Sheikh)',
  flightStatus: 'ON_TIME',
  status: 'DISPATCHED',
  lastGpsUpdate: '3 mins ago (Nabq checkpoint northbound)'
};

export interface CommerceContextType {
  bookings: ConfirmedBookingItem[];
  /**
   * The trip the app is currently about, read from the backend for the signed-in
   * traveler. Null when signed out or when they have no trip yet — callers must
   * handle that rather than falling back to a demo id, which is how
   * 'DHB-TRIP-894' spread to forty call sites.
   */
  activeTrip: TripEntity | null;
  /**
   * The items of `activeTrip`, each with the supplier resolved through its
   * SKU. This is the traveler's real itinerary — what the timeline renders.
   */
  activeTripItems: TripItemWithSupplier[];
  /**
   * Every trip this traveler has, not only the active one.
   *
   * The profile page needs the finished ones: it used to show two invented
   * past trips — "Autumn Wind & Reef Escape, Nov 04–09 2024, EGP 11,200" and a
   * 2023 PADI trip — as the reader's own history, including what they spent.
   */
  allTrips: TripEntity[];
  /** True while the traveler's real trip and bookings are being loaded. */
  isTripLoading: boolean;
  /** Set when the load failed, in wording fit to show a traveler. */
  tripLoadError: string | null;
  /** Re-reads the trip and its bookings from the backend. */
  reloadTrip: () => void;
  /**
   * Opens the app on a specific trip.
   *
   * Without this, "start this trip" created the trip and then landed the
   * traveler on a *different* one, because selectActiveTrip ranks a confirmed
   * trip above a new plan. Ranking is the right default for a page load; it is
   * the wrong answer when the traveler has just named the trip they want.
   */
  openTrip: (tripId: string) => void;
  setBookings: React.Dispatch<React.SetStateAction<ConfirmedBookingItem[]>>;
  /**
   * Adds a confirmed booking to the traveler's list, replacing any existing
   * entry with the same id so a retry cannot duplicate it.
   */
  recordBooking: (booking: ConfirmedBookingItem) => void;
  ledgerEntries: LedgerEntry[];
  setLedgerEntries: React.Dispatch<React.SetStateAction<LedgerEntry[]>>;
  recordLedgerEntry: (entry: Omit<LedgerEntry, 'id' | 'timestamp' | 'signatureHash'>) => LedgerEntry;
  transferTracking: TransferTrackingRecord;
  setTransferTracking: React.Dispatch<React.SetStateAction<TransferTrackingRecord>>;
}

const CommerceContext = createContext<CommerceContextType | undefined>(undefined);

export const CommerceProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [bookings, setBookings] = useState<ConfirmedBookingItem[]>([]);
  const [activeTrip, setActiveTrip] = useState<TripEntity | null>(null);
  const [activeTripItems, setActiveTripItems] = useState<TripItemWithSupplier[]>([]);
  const [allTrips, setAllTrips] = useState<TripEntity[]>([]);
  const [isTripLoading, setIsTripLoading] = useState(false);
  const [tripLoadError, setTripLoadError] = useState<string | null>(null);
  const [tripReloadToken, setTripReloadToken] = useState(0);
  const [requestedTripId, setRequestedTripId] = useState<string | null>(null);
  // Starts empty. A traveler's ledger is what they have actually paid.
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [transferTracking, setTransferTracking] = useState<TransferTrackingRecord>(DEFAULT_ANONYMOUS_TRANSFER);

  const { user, sessionUser } = useAuth();
  const { showToast, setJourneyStage } = useUI();

  // Sync with Firestore Cloud Ledger when user is active
  useEffect(() => {
    if (!user) {
      setLedgerEntries([]);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      const firebase = await loadFirebase();
      if (cancelled) return;

      unsubscribe = firebase.subscribeToUserLedger(user.uid, (cloudEntries) => {
        if (cloudEntries && cloudEntries.length > 0) {
          setLedgerEntries(prev => {
            const map = new Map<string, LedgerEntry>();
            prev.forEach(e => map.set(e.id, e));
            cloudEntries.forEach(e => map.set(e.id, e));
            return Array.from(map.values()).sort(
              (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
            );
          });
        }
      });

      firebase.flushOfflineMutationQueue(user.uid).catch(() => {});
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user]);

  /**
   * Tells the rest of the app where this traveler is.
   *
   * The stage used to be set from the current route, which meant it described
   * the page rather than the person: a traveler in Dahab who tapped Home was
   * reclassified as a discovery-mode visitor, and every surface that keys off
   * the stage — the homepage composition, the lifecycle snapshot, the persona
   * mode — followed them backwards. It is derived from the trip here because
   * this is where the trip lives.
   *
   * Only syncs when the trip ID changes to avoid re-rendering the entire
   * context tree on reference instability.
   */
  const prevJourneyTripIdRef = useRef<string | null>(null);
  useEffect(() => {
    const tripId = activeTrip?.id ?? null;
    if (tripId === prevJourneyTripIdRef.current) return;
    prevJourneyTripIdRef.current = tripId;
    setJourneyStage(journeyStageFromTrip(activeTrip));
  }, [activeTrip?.id]);

  const reloadTrip = useCallback(() => setTripReloadToken(token => token + 1), []);

  const openTrip = useCallback((tripId: string) => {
    setRequestedTripId(tripId);
    setTripReloadToken(token => token + 1);
  }, []);

  /**
   * Loads the signed-in traveler's real trip and its real bookings.
   *
   * Until this existed the only backend call any page made on load anywhere in
   * the app was the Dahab Live camera list: `bookings` started empty and was
   * only ever appended to by a checkout in the same browser session, so a
   * refresh lost everything and the bookings page showed a hardcoded reference
   * for a trip nobody had booked.
   *
   * It lives here rather than in each page because `bookings` is read by the
   * bookings view, the my-trip view, the nav badge and DayGI's context — one
   * fetch, one source of truth, and every consumer becomes real at once.
   */
  useEffect(() => {
    if (!sessionUser) {
      // Signed out: hold no one's trip. This is the empty state, not an error.
      setActiveTrip(null);
      setActiveTripItems([]);
      setAllTrips([]);
      setBookings([]);
      setTripLoadError(null);
      setIsTripLoading(false);
      return;
    }

    const controller = new AbortController();
    const signal = controller.signal;
    let cancelled = false;

    const load = async () => {
      setIsTripLoading(true);
      setTripLoadError(null);
      try {
        const { trips } = await api.getTripsForUser(sessionUser.id, signal);
        if (!cancelled) setAllTrips(trips);
        // An explicitly requested trip wins over the ranking, but only if it is
        // actually theirs — the list came from the server, so membership in it
        // is the check.
        const trip =
          (requestedTripId ? trips.find(t => t.id === requestedTripId) : undefined) ||
          selectActiveTrip(trips);
        if (cancelled) return;

        if (!trip) {
          // A traveler with no trip yet. The pages show their empty state.
          setActiveTrip(null);
          setActiveTripItems([]);
          setBookings([]);
          return;
        }

        const [detail, bookingsResponse, rentals] = await Promise.all([
          api.getTrip(trip.id, signal),
          api.getTripBookings(trip.id, signal),
          api.getMyRentalBookings(signal).catch(() => null)
        ]);
        if (cancelled) return;

        setActiveTrip(detail.trip);
        // The supplier-enriched items, not detail.items: the timeline needs the
        // provider behind each item and only this response carries it.
        setActiveTripItems(bookingsResponse.items);
        const tripBookings = buildTravelerBookings(bookingsResponse.items, bookingsResponse.bookings);

        // Rental bookings live in their own table with their own lifecycle; the
        // trip-bookings endpoint does not see them, so they are fetched here and
        // merged. A failure to load them must not blank the trip's bookings —
        // rentals are additive, so the failure degrades to showing only the
        // commerce bookings.
        const rentalBookings = rentals
          ? rentals.bookings.map(rentalBookingToConfirmedBookingItem)
          : [];
        if (cancelled) return;
        setBookings([...tripBookings, ...rentalBookings]);
      } catch (error: unknown) {
        if (cancelled || signal.aborted) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;

        // A failed load must not blank the page or claim there are no bookings
        // — leaving `bookings` alone keeps whatever was already on screen.
        setTripLoadError(
          error instanceof ApiError && error.isUnauthorized
            ? 'Your session has expired. Sign in again to see your bookings.'
            : error instanceof Error
              ? error.message
              : 'Could not load your trip.'
        );
      } finally {
        if (!cancelled) setIsTripLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionUser, tripReloadToken, requestedTripId]);

  /**
   * BookNowCommerceView has always called recordBooking(), but it was never
   * implemented on the context. Because the call sits inside a setTimeout with
   * no try/catch, `recordBooking is not a function` was thrown asynchronously
   * and the rest of the handler never ran: the spinner never cleared, the
   * confirmation screen never appeared, no ledger entry was written, and the
   * booking was lost. The whole instant-booking flow was dead.
   */
  const recordBooking = useCallback((booking: ConfirmedBookingItem) => {
    setBookings(prev => {
      const withoutDuplicate = prev.filter(b => b.id !== booking.id);
      return [booking, ...withoutDuplicate];
    });
  }, []);

  const recordLedgerEntry = useCallback(
    (entry: Omit<LedgerEntry, 'id' | 'timestamp' | 'signatureHash'>): LedgerEntry => {
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      const randomSig = Math.random().toString(36).substring(2, 10);
      const newEntry: LedgerEntry = {
        ...entry,
        id: `LEDGER-${Date.now().toString().slice(-4)}`,
        timestamp,
        signatureHash: `sha256:audit-${randomSig}`
      };

      setLedgerEntries(prev => [newEntry, ...prev]);

      if (user?.uid) {
        // The caller used to hand-assemble the cloud document here, with two
        // casts, duplicating logic that firebase.ts also had. It owns that
        // mapping now.
        void loadFirebase().then(firebase => firebase.persistLedgerEntryToCloud(newEntry, user.uid)).catch(() => {});
      }

      showToast(`Audited Ledger: ${entry.type} · ${entry.amountEGP} EGP`);

      return newEntry;
    },
    [user, showToast]
  );

  // See the note in UIContext.
  const value = useMemo<CommerceContextType>(
    () => ({
      bookings,
      setBookings,
      activeTrip,
      activeTripItems,
      allTrips,
      isTripLoading,
      tripLoadError,
      reloadTrip,
      openTrip,
      recordBooking,
      ledgerEntries,
      setLedgerEntries,
      recordLedgerEntry,
      transferTracking,
      setTransferTracking
    }),
    [
      bookings,
      activeTrip,
      activeTripItems,
      allTrips,
      isTripLoading,
      tripLoadError,
      reloadTrip,
      openTrip,
      recordBooking,
      ledgerEntries,
      recordLedgerEntry,
      transferTracking
    ]
  );

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
};

export const useCommerce = () => {
  const context = useContext(CommerceContext);
  if (!context) {
    throw new Error('useCommerce must be used within a CommerceProvider');
  }
  return context;
};
