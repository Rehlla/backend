import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { flushSync } from 'react-dom';
import { AppRoute, JourneyStage } from '../types';
import { DEFAULT_ROUTE, routeFromUrl, urlFromRoute, type RouteParams } from '../lib/routeUrl';

/**
 * The first curated experience in src/services/experienceService.ts. Nav and
 * entry links to /experiences without a slug land on this one instead of the
 * "Experience Not Found" screen. Kept in sync by convention; importing
 * CURATED_EXPERIENCES here would pull ExploreView (and a dependency cycle)
 * into UIContext.
 */
const DEFAULT_EXPERIENCE_SLUG = 'blue-hole';

/**
 * The address bar is the source of truth for which page is open.
 *
 * Reading it in a lazy useState initialiser rather than an effect matters:
 * an effect runs after the first paint, so a deep link would flash the
 * homepage before correcting itself.
 */
const readLocation = (): { route: AppRoute; params: RouteParams } =>
  typeof window === 'undefined'
    ? { route: DEFAULT_ROUTE, params: {} }
    : routeFromUrl(window.location.pathname, window.location.search);

export interface UIContextType {
  currentRoute: AppRoute;
  setCurrentRoute: (route: AppRoute) => void;
  selectedDayId: number | null;
  setSelectedDayId: (dayId: number | null) => void;
  selectedActivityId: string | null;
  setSelectedActivityId: (activityId: string | null) => void;
  selectedBookingId: string | null;
  setSelectedBookingId: (bookingId: string | null) => void;
  selectedProgramSlug: string | null;
  setSelectedProgramSlug: (slug: string | null) => void;
  selectedExperienceSlug: string | null;
  setSelectedExperienceSlug: (slug: string | null) => void;
  selectedHotelSlug: string | null;
  setSelectedHotelSlug: (slug: string | null) => void;
  selectedRentalSlug: string | null;
  setSelectedRentalSlug: (slug: string | null) => void;
  /**
   * The restaurant open on /restaurants. Lives here rather than in
   * App.tsx props for the same reason hotelSlug does: the URL owns it, so a
   * refresh and a shared link reopen the same menu.
   */
  selectedVenueSlug: string | null;
  setSelectedVenueSlug: (slug: string | null) => void;
  /** The product a checkout page should open on, from the address bar. */
  selectedSkuId: string | null;
  setSelectedSkuId: (skuId: string | null) => void;
  /**
   * The URL's param block for the route on screen.
   *
   * A view that needs more than one selection at once reads it here rather than
   * through a dedicated field per value — a stay checkout carries a room type,
   * a window and a party together, and a confirmation link a reference.
   */
  currentParams: RouteParams;
  journeyStage: JourneyStage;
  setJourneyStage: (stage: JourneyStage) => void;
  isEasyMode: boolean;
  setIsEasyMode: (val: boolean) => void;
  toggleEasyMode: () => void;
  /**
   * Active toasts, newest last. Each toast keeps its own dismiss timer, so a
   * second showToast during the first's window stacks rather than cutting the
   * first short (a screen-reader user would otherwise lose the first message
   * entirely).
   */
  toasts: UiToast[];
  showToast: (msg: string) => void;
  navigateTo: (route: AppRoute, params?: RouteParams) => void;
  /**
   * Returns to wherever the traveler came from.
   *
   * Real history, not a hardcoded parent: a page reached from three different
   * places has three different "backs", and sending everyone to /home from a
   * screen they opened mid-task loses their place. Falls back to /home only
   * when there is nothing of ours behind — a deep link, or a fresh tab — where
   * going back would leave the app entirely.
   */
  goBack: () => void;
  /** False on a cold entry, when goBack has nowhere of ours to return to. */
  canGoBack: boolean;
  activeDayGiPrompt: string | null;
  setActiveDayGiPrompt: (prompt: string | null) => void;
  openDayGiWithPrompt: (prompt: string) => void;
  activePersonaMode: 'PRE_TRIP' | 'IN_DAHAB';
  setActivePersonaMode: (mode: 'PRE_TRIP' | 'IN_DAHAB') => void;
}

/** One queued toast notification. */
export interface UiToast {
  id: number;
  message: string;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => readLocation().route);
  const [selectedDayId, setSelectedDayId] = useState<number | null>(
    () => readLocation().params.dayId ?? null
  );
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    () => readLocation().params.activityId ?? null
  );
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(
    () => readLocation().params.bookingId ?? null
  );
  const [selectedProgramSlug, setSelectedProgramSlug] = useState<string | null>(
    () => readLocation().params.programSlug ?? null
  );
  const [selectedExperienceSlug, setSelectedExperienceSlug] = useState<string | null>(() => {
    const { route, params } = readLocation();
    return params.experienceSlug ?? (route === '/experiences' ? DEFAULT_EXPERIENCE_SLUG : null);
  });
  const [selectedHotelSlug, setSelectedHotelSlug] = useState<string | null>(
    () => readLocation().params.hotelSlug ?? null
  );
  const [selectedRentalSlug, setSelectedRentalSlug] = useState<string | null>(
    () => readLocation().params.rentalSlug ?? null
  );
  const [selectedVenueSlug, setSelectedVenueSlug] = useState<string | null>(
    () => readLocation().params.venueSlug ?? null
  );
  const [selectedSkuId, setSelectedSkuId] = useState<string | null>(
    () => readLocation().params.skuId ?? null
  );
  /**
   * The whole param block for the route currently on screen.
   *
   * The individual `selected*` fields above cover the selections that existed
   * one-at-a-time. A stay checkout needs seven values at once and an admin
   * preview a token — carving those one at a time would mean seven more fields
   * and an eighth place for them to drift. This holds the URL as parsed, so any
   * view can read its own params back off the current route.
   */
  const [currentParams, setCurrentParams] = useState<RouteParams>(
    () => readLocation().params
  );
  /**
   * Whether this session has navigated inside the app yet.
   *
   * window.history.length cannot answer this — it counts entries from before
   * the app was opened, so it is >1 on any tab that has been used at all and
   * `back()` would walk out to whatever site preceded us.
   */
  const [canGoBack, setCanGoBack] = useState<boolean>(false);
  const [journeyStage, setJourneyStage] = useState<JourneyStage>('discover');
  const [activeDayGiPrompt, setActiveDayGiPrompt] = useState<string | null>(null);
  const [activePersonaMode, setActivePersonaMode] = useState<'PRE_TRIP' | 'IN_DAHAB'>('PRE_TRIP');
  const [toasts, setToasts] = useState<UiToast[]>([]);
  const nextToastIdRef = useRef(0);
  // Per-toast dismiss timers: removing one toast must not touch the others.
  const toastTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const [isEasyMode, setIsEasyMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('dahab_easy_mode') === 'true';
    } catch {
      return false;
    }
  });

  const showToast = useCallback((msg: string) => {
    const id = ++nextToastIdRef.current;
    setToasts(prev => [...prev, { id, message: msg }]);
    const timer = setTimeout(() => {
      toastTimersRef.current.delete(id);
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
    toastTimersRef.current.set(id, timer);
  }, []);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach(timer => clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  const toggleEasyMode = useCallback(() => {
    setIsEasyMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('dahab_easy_mode', String(next));
      } catch {
        // noop
      }
      showToast(next ? 'Easy & Sunlight High-Visibility Mode ON' : 'Standard Dahab Cockpit Mode ON');
      return next;
    });
  }, [showToast]);

  /**
   * Moves the address bar to match a route.
   *
   * Skipping an unchanged URL is not just tidiness: re-tapping the current nav
   * tab would otherwise stack duplicate history entries, and the traveler would
   * need several Back presses to leave a page they visited once.
   */
  const pushRoute = useCallback((route: AppRoute, params?: RouteParams) => {
    if (typeof window === 'undefined') return;
    const next = urlFromRoute(route, params);
    if (`${window.location.pathname}${window.location.search}` === next) return;
    window.history.pushState({ route }, '', next);
  }, []);

  const navigateTo = useCallback(
    (
      route: AppRoute,
      params?: RouteParams
    ) => {
      // The whole transition in one function so View Transitions can capture
      // it as a single DOM snapshot pair (Living Chart spec §3, §8: route
      // change = 300ms crossfade; reduced-motion and non-supporting browsers
      // fall back to the plain synchronous update).
      const applyNavigation = () => {
        setCurrentParams(params ?? {});
        setCurrentRoute(route);
        if (params?.dayId !== undefined) setSelectedDayId(params.dayId);
        if (params?.activityId !== undefined) setSelectedActivityId(params.activityId);
        if (params?.bookingId !== undefined) setSelectedBookingId(params.bookingId);
        if (params?.programSlug !== undefined) setSelectedProgramSlug(params.programSlug);
        // /experiences without a slug (e.g. from the navbar) must never land on
        // the "Experience Not Found" screen — default to the first curated one.
        if (params?.experienceSlug === undefined && route === '/experiences') {
          params = { ...params, experienceSlug: DEFAULT_EXPERIENCE_SLUG };
        }
        if (params?.experienceSlug !== undefined) setSelectedExperienceSlug(params.experienceSlug);
        if (params?.hotelSlug !== undefined) setSelectedHotelSlug(params.hotelSlug);
        if (params?.rentalSlug !== undefined) setSelectedRentalSlug(params.rentalSlug);
        if (params?.venueSlug !== undefined) setSelectedVenueSlug(params.venueSlug);
        // Cleared when navigating without one, so a stale sku cannot make a later
        // visit to Book Now open on a product the traveler did not choose.
        setSelectedSkuId(params?.skuId ?? null);
        // pushRoute skips a no-op navigation, so only count the ones that
        // actually add an entry — otherwise re-tapping the current tab would
        // arm a back button with nothing behind it.
        const willPush =
          typeof window !== 'undefined' &&
          `${window.location.pathname}${window.location.search}` !== urlFromRoute(route, params);
        pushRoute(route, params);
        if (willPush) setCanGoBack(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      };

      if (
        typeof document !== 'undefined' &&
        'startViewTransition' in document &&
        typeof document.startViewTransition === 'function' &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        // React state updates are async, so flush them inside the transition
        // callback — otherwise the snapshot is taken before the new route
        // renders and the crossfade animates nothing.
        document.startViewTransition(() => {
          flushSync(applyNavigation);
        });
      } else {
        applyNavigation();
      }
    },
    [pushRoute]
  );

  /**
   * Exposed on the context (and re-exported by TripContext) in place of the raw
   * useState setter, so that a direct setCurrentRoute call cannot leave the
   * address bar pointing at a different page than the one on screen.
   */
  const setRoute = useCallback(
    (route: AppRoute) => {
      setCurrentRoute(route);
      pushRoute(route);
    },
    [pushRoute]
  );

  const goBack = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (canGoBack) {
      // popstate restores the route and consumes the entry, so Back does not
      // grow the stack the way navigating to the previous page would.
      window.history.back();
      return;
    }
    setCurrentRoute(DEFAULT_ROUTE);
    pushRoute(DEFAULT_ROUTE);
  }, [canGoBack, pushRoute]);

  const openDayGiWithPrompt = useCallback(
    (prompt: string) => {
      setActiveDayGiPrompt(prompt);
      setCurrentRoute('/daygi');
      pushRoute('/daygi');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [pushRoute]
  );

  /**
   * Back and Forward.
   *
   * This restores state FROM the URL and deliberately does not push: pushing
   * here would append a new entry instead of consuming one, and the Back button
   * would never make progress.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onPopState = () => {
      const { route, params } = readLocation();
      setCurrentRoute(route);
      setCurrentParams(params);
      setSelectedDayId(params.dayId ?? null);
      setSelectedActivityId(params.activityId ?? null);
      setSelectedBookingId(params.bookingId ?? null);
      setSelectedProgramSlug(params.programSlug ?? null);
      setSelectedExperienceSlug(params.experienceSlug ?? (route === '/experiences' ? DEFAULT_EXPERIENCE_SLUG : null));
      setSelectedHotelSlug(params.hotelSlug ?? null);
      setSelectedRentalSlug(params.rentalSlug ?? null);
      setSelectedVenueSlug(params.venueSlug ?? null);
      setSelectedSkuId(params.skuId ?? null);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  /**
   * Canonicalises the entry URL once, so an unrecognised path that resolved to
   * /home does not stay visible in the address bar — otherwise a later Back
   * press would return to a URL that never rendered.
   *
   * Query keys the router itself models (day/activity/booking/slug/sku and
   * their aliases) are re-emitted by urlFromRoute; anything else belongs to a
   * view — /listings ?type=&view=, /restaurants ?restaurant=, /attractions
   * ?attraction=&category=&sort= — and is preserved, because those views seed
   * their state from the URL on mount and stripping the query here would
   * silently drop the deep link the traveler just opened.
   */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const { route, params } = readLocation();
    const canonical = urlFromRoute(route, params);
    const preserved = preserveViewQueryParams(window.location.search, canonical);
    const next = preserved ? `${canonical}${canonical.includes('?') ? '&' : '?'}${preserved}` : canonical;
    if (`${window.location.pathname}${window.location.search}` !== next) {
      window.history.replaceState({ route }, '', next);
    }
  }, []);

  /**
   * Returns the incoming search minus the keys the router consumes. Kept in
   * routeUrl's PARAM_KEYS terms so a key moved into the router is automatically
   * dropped here and no longer duplicated.
   */
  const preserveViewQueryParams = (search: string, canonical = ''): string => {
    if (!search) return '';
    const params = new URLSearchParams(search);
    for (const key of ['day', 'activity', 'booking', 'slug', 'sku', 'id', 'program', 'experience', 'place']) {
      params.delete(key);
    }
    // Anything the canonical URL already carries is the router's too. The stay
    // keys (ref, accommodation, roomType, checkIn…) were missing from the list
    // above, so /hotels/checkout?ref=X became ?ref=X?ref=X on load and the
    // reference read back as "X?ref=X".
    const canonicalQuery = canonical.includes('?') ? canonical.slice(canonical.indexOf('?') + 1) : '';
    for (const key of new URLSearchParams(canonicalQuery).keys()) params.delete(key);
    return params.toString();
  };

  /**
   * A few routes are an act, not a location.
   *
   * Opening the planner really does mean "I am planning right now", so those
   * still set the stage. `'/home' -> 'discover'` was removed: home is where
   * everyone goes, and resetting the stage there sent a traveler standing in
   * Dahab back to discovery mode on every tap of the logo. Where the traveler
   * *is* comes from their trip — see journeyStageFromTrip, pushed in
   * CommerceContext — and that must not be overwritten by navigation.
   */
  useEffect(() => {
    if (currentRoute === '/trip-builder') setJourneyStage('plan');
    else if (currentRoute === '/trip-preview') setJourneyStage('preview');
    else if (currentRoute === '/departure') setJourneyStage('departure');
    else if (currentRoute === '/post-trip') setJourneyStage('post_trip');
  }, [currentRoute]);

  // Memoised so this object is only a new reference when something in it
  // actually changed. Without this, TripContext's own useMemo — which depends on
  // the context objects themselves — is invalidated on every render, and all 67
  // useTrip() consumers re-render on any state change anywhere in the app.
  const value = useMemo<UIContextType>(
    () => ({
      currentRoute,
      setCurrentRoute: setRoute,
      selectedDayId,
      setSelectedDayId,
      selectedActivityId,
      setSelectedActivityId,
      selectedBookingId,
      setSelectedBookingId,
      selectedProgramSlug,
      setSelectedProgramSlug,
      selectedExperienceSlug,
      setSelectedExperienceSlug,
      selectedHotelSlug,
      setSelectedHotelSlug,
      selectedRentalSlug,
      setSelectedRentalSlug,
      selectedVenueSlug,
      setSelectedVenueSlug,
      selectedSkuId,
      currentParams,
      setSelectedSkuId,
      journeyStage,
      setJourneyStage,
      isEasyMode,
      setIsEasyMode,
      toggleEasyMode,
      toasts,
      showToast,
      navigateTo,
      goBack,
      canGoBack,
      activeDayGiPrompt,
      setActiveDayGiPrompt,
      openDayGiWithPrompt,
      activePersonaMode,
      setActivePersonaMode
    }),
    [
      currentRoute,
      setRoute,
      selectedDayId,
      selectedActivityId,
      selectedBookingId,
      selectedProgramSlug,
      selectedExperienceSlug,
      selectedHotelSlug,
      selectedRentalSlug,
      selectedVenueSlug,
      selectedSkuId,
      currentParams,
      journeyStage,
      isEasyMode,
      toggleEasyMode,
      toasts,
      showToast,
      navigateTo,
      goBack,
      canGoBack,
      activeDayGiPrompt,
      openDayGiWithPrompt,
      activePersonaMode
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
