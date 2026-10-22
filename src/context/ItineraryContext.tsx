import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import {
  TravelerProfile,
  TimelineDay,
  TimelineActivity,
  FoodOrderItem
} from '../types';
import { ANONYMOUS_PROFILE } from '../data/dahabContent';
import { AHMED_TRIP_DAYS } from '../components/mytrip/myTripData';
// Fetched only when there is a cloud write to make. See AuthContext.
const loadFirebase = () => import('../lib/firebase');
import { useAuth } from './AuthContext';
import { useLanguage } from '../i18n/LanguageContext';
import { useUI } from './UIContext';
import { useCommerce } from './CommerceContext';
import { buildTimelineDays } from '../services/tripBookingMapper';
import { createPlanningTrip } from '../services/tripLifecycle';
import { api } from '../services/api';

export interface ItineraryContextType {
  profile: TravelerProfile;
  setProfile: React.Dispatch<React.SetStateAction<TravelerProfile>>;
  updateProfile: (updates: Partial<TravelerProfile>) => void;
  tripDays: TimelineDay[];
  setTripDays: React.Dispatch<React.SetStateAction<TimelineDay[]>>;
  /**
   * Puts an experience on the traveler's itinerary, for real.
   *
   * Async and rejection-free: it resolves once the server has the item (or once
   * it is known that the server does not), so a caller can await it to show a
   * spinner. It reports failure through a toast rather than by throwing.
   */
  addActivityToDay: (dayNumber: number, activity: TimelineActivity) => Promise<void>;
  removeActivityFromDay: (dayNumber: number, activityId: string) => Promise<void>;
  updateActivityInDay: (dayNumber: number, activityId: string, updates: Partial<TimelineActivity>) => void;
  shiftActivityBetweenDays: (activityId: string, fromDay: number, toDay: number, newTimeSlot?: string) => void;
  activeFoodOrder: FoodOrderItem | null;
  setActiveFoodOrder: React.Dispatch<React.SetStateAction<FoodOrderItem | null>>;
  savedItems: string[];
  setSavedItems: React.Dispatch<React.SetStateAction<string[]>>;
  toggleSaveItem: (itemId: string) => void;
}

const ItineraryContext = createContext<ItineraryContextType | undefined>(undefined);

export const ItineraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<TravelerProfile>(ANONYMOUS_PROFILE);
  const [tripDays, setTripDays] = useState<TimelineDay[]>(AHMED_TRIP_DAYS);
  const [activeFoodOrder, setActiveFoodOrder] = useState<FoodOrderItem | null>(null);
  const [savedItems, setSavedItems] = useState<string[]>([]);

  const { user, sessionUser, isSignedIn, setIntendedRoute } = useAuth();
  const { t } = useLanguage();
  const { showToast, navigateTo } = useUI();
  const { activeTrip, activeTripItems, openTrip, reloadTrip } = useCommerce();

  /**
   * Fill the traveler's identity and trip settings from the session and their
   * real trip.
   *
   * `profile` started at ANONYMOUS_PROFILE and nothing ever moved it, so every
   * greeting in the app — Food's "جعان يا أحمد؟", Help's "محتاج مساعدة يا
   * أحمد؟", DayGI's "Welcome, Ahmed!" — was either a hardcoded demo name or an
   * empty string, and the trip settings shown as "yours" were the defaults.
   *
   * Nothing here is invented: the name, email and phone come from the session
   * record; the length, party size, budget, pace and interests come from the
   * traveler's own trip when they have one. Fields the backend does not hold
   * (passport, emergency contact) are left exactly as they were.
   */
  useEffect(() => {
    if (!sessionUser) {
      setProfile(ANONYMOUS_PROFILE);
      return;
    }

    setProfile(previous => ({
      ...previous,
      name: sessionUser.name || previous.name,
      email: sessionUser.email || previous.email,
      phone: sessionUser.phone || previous.phone
    }));
  }, [sessionUser]);

  useEffect(() => {
    if (!activeTrip) return;
    setProfile(previous => ({
      ...previous,
      lengthDays: activeTrip.lengthDays,
      travelersCount: activeTrip.travelersCount,
      budget: activeTrip.budget,
      pace: activeTrip.pace,
      interests: activeTrip.interests.length > 0 ? activeTrip.interests : previous.interests
    }));
  }, [activeTrip]);

  /**
   * Fill the timeline from the traveler's real trip.
   *
   * `tripDays` started empty and nothing ever filled it, so TripTimeline fell
   * through to AHMED_TRIP_DAYS — a hand-authored five-day plan for the demo
   * persona, shown to every traveler as their own itinerary. When there is a
   * real trip the days come from its items; when there is not, this leaves the
   * array empty and the timeline keeps its illustrative plan, which is the
   * empty state rather than a claim about anyone's booking.
   */
  useEffect(() => {
    if (!activeTrip) return;
    const days = buildTimelineDays(activeTrip, activeTripItems);
    if (days.length > 0) setTripDays(days);
  }, [activeTrip, activeTripItems]);

  const updateProfile = useCallback((updates: Partial<TravelerProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Puts an activity on a day, creating the day when the itinerary has no such
   * day yet.
   *
   * The previous version was a plain `prevDays.map(...)`: with no matching day
   * it returned the list untouched and the activity was simply lost. Since
   * `tripDays` is empty for any traveler without a trip, that was the ordinary
   * case, and it happened underneath a toast that said "Added ✓".
   */
  const placeActivity = useCallback(
    (days: TimelineDay[], dayNumber: number, activity: TimelineActivity): TimelineDay[] => {
      if (days.some(day => day.dayNumber === dayNumber)) {
        return days.map(day =>
          day.dayNumber === dayNumber
            ? { ...day, activities: [...day.activities, activity] }
            : day
        );
      }

      const newDay: TimelineDay = {
        dayNumber,
        dateStr: `Day ${dayNumber}`,
        title: `Day ${dayNumber}`,
        subtitle: '1 booking',
        activities: [activity]
      };
      return [...days, newDay].sort((a, b) => a.dayNumber - b.dayNumber);
    },
    []
  );

  /**
   * Adds an experience to the traveler's real trip.
   *
   * What this replaces, in order: an update to client state only, which vanished
   * on refresh; a fire-and-forget backend write whose `.catch` showed the *same
   * success toast* as the success path, so a failed save was indistinguishable
   * from a saved one; a `skuId` filled with the activity's **location string**,
   * which meant the checkout — which matches an unbooked item to its booking by
   * skuId — could never link the two and instead created a duplicate line; and
   * no refresh afterwards, so the server's own item never appeared.
   */
  const addActivityToDay = useCallback(
    async (dayNumber: number, activity: TimelineActivity): Promise<void> => {
      let trip = activeTrip;

      // Allow adding to a planning trip even without sign-in — the page
      // should work for anonymous visitors too.
      if (!isSignedIn && !trip) {
        try {
          trip = await createPlanningTrip({
            title: 'My Dahab Trip',
            idPrefix: 'TRIP-DAHAB',
            lengthDays: profile.lengthDays,
            travelersCount: profile.travelersCount,
            budget: profile.budget,
            pace: profile.pace,
            interests: profile.interests
          });
          openTrip(trip.id);
        } catch (error: unknown) {
          showToast(
            t('itinerary.startTripFailed', {
              reason: error instanceof Error ? error.message : 'please try again'
            })
          );
          return;
        }
      }

      if (!trip) {
        // Signed-in user without a trip — create one here.
        try {
          trip = await createPlanningTrip({
            title: 'My Dahab Trip',
            idPrefix: 'TRIP-DAHAB',
            lengthDays: profile.lengthDays,
            travelersCount: profile.travelersCount,
            budget: profile.budget,
            pace: profile.pace,
            interests: profile.interests
          });
          openTrip(trip.id);
        } catch (error: unknown) {
          showToast(
            t('itinerary.startTripFailed', {
              reason: error instanceof Error ? error.message : 'please try again'
            })
          );
          return;
        }
      }

      // Shown immediately, removed again below if the server refuses it.
      setTripDays(prevDays => placeActivity(prevDays, dayNumber, activity));

      try {
        await api.addTripItem(trip.id, {
          title: activity.title,
          dayNumber,
          timeSlot: activity.time || 'All Day',
          // The activity's own vertical when it has one. 'activity' is the
          // catch-all the server already defaults to.
          serviceType: activity.serviceType || 'activity',
          // The real product, or nothing at all. Never the location string.
          skuId: activity.skuId,
          priceEGP: activity.priceEGP ?? 0
        });

        showToast(t('itinerary.addedToDay', { title: activity.title, day: dayNumber }));
        // Replaces the optimistic entry with the server's, which carries the
        // real item id and its SUGGESTED status — both of which the Book and
        // Remove actions need.
        reloadTrip();
      } catch (error: unknown) {
        setTripDays(prevDays =>
          prevDays.map(day =>
            day.dayNumber === dayNumber
              ? { ...day, activities: day.activities.filter(a => a.id !== activity.id) }
              : day
          )
        );
        showToast(
          t('itinerary.addFailed', {
            title: activity.title,
            reason: error instanceof Error ? error.message : 'please try again'
          })
        );
        return;
      }

      // Firebase cloud persistence if user is authenticated
      if (user?.uid) {
        void loadFirebase().then(firebase => firebase.persistActivityToCloud(
          {
            id: activity.id,
            userId: user.uid,
            dayNumber,
            time: activity.time,
            title: activity.title,
            location: activity.location || 'Dahab',
            status: activity.status,
            notes: activity.notes || ''
          },
          dayNumber,
          user.uid
        )).catch(() => {});
      }
    },
    [
      activeTrip,
      isSignedIn,
      navigateTo,
      openTrip,
      placeActivity,
      profile,
      reloadTrip,
      setIntendedRoute,
      showToast,
      user
    ]
  );

  /**
   * Removes an activity from the itinerary.
   *
   * `activityId` is the **server's** trip item id, which is what
   * buildTimelineDays puts on each timeline entry. The previous version sent
   * whatever id the caller had minted client-side — `exp-1756…` from the
   * experience page — which no stored item could ever match, so the row came
   * off the screen and stayed in the database.
   */
  const removeActivityFromDay = useCallback(
    async (dayNumber: number, activityId: string): Promise<void> => {
      const removed = tripDays
        .find(day => day.dayNumber === dayNumber)
        ?.activities.find(activity => activity.id === activityId);

      setTripDays(prevDays =>
        prevDays.map(day => {
          if (day.dayNumber === dayNumber) {
            return {
              ...day,
              activities: day.activities.filter(act => act.id !== activityId)
            };
          }
          return day;
        })
      );

      if (!activeTrip) {
        showToast(t('itinerary.removed'));
        return;
      }

      try {
        await api.removeTripItem(activeTrip.id, activityId);
        showToast(t('itinerary.removed'));
        reloadTrip();
      } catch (error: unknown) {
        // Put it back. A row that is still stored must still be on screen.
        if (removed) {
          setTripDays(prevDays => placeActivity(prevDays, dayNumber, removed));
        }
        showToast(
          t('itinerary.removeFailed', {
            reason: error instanceof Error ? error.message : 'please try again'
          })
        );
      }
    },
    [activeTrip, placeActivity, reloadTrip, showToast, t, tripDays]
  );

  const updateActivityInDay = useCallback(
    (dayNumber: number, activityId: string, updates: Partial<TimelineActivity>) => {
      setTripDays(prevDays =>
        prevDays.map(day => {
          if (day.dayNumber === dayNumber) {
            return {
              ...day,
              activities: day.activities.map(act =>
                act.id === activityId ? { ...act, ...updates } : act
              )
            };
          }
          return day;
        })
      );
    },
    []
  );

  const shiftActivityBetweenDays = useCallback(
    (activityId: string, fromDay: number, toDay: number, newTimeSlot?: string) => {
      let movedActivity: TimelineActivity | null = null;

      setTripDays(prevDays => {
        const updated = prevDays.map(d => {
          if (d.dayNumber === fromDay) {
            const act = d.activities.find(a => a.id === activityId);
            if (act) movedActivity = { ...act };
            return {
              ...d,
              activities: d.activities.filter(a => a.id !== activityId)
            };
          }
          return d;
        });

        if (!movedActivity) return prevDays;

        const actToInsert: TimelineActivity = {
          ...movedActivity,
          time: newTimeSlot || (movedActivity as TimelineActivity).time,
          notes:
            ((movedActivity as TimelineActivity).notes
              ? (movedActivity as TimelineActivity).notes + ' · '
              : '') + 'تم النقل بواسطة DayGI'
        };

        const targetDayExists = updated.some(d => d.dayNumber === toDay);
        if (!targetDayExists) {
          const newDay: TimelineDay = {
            dayNumber: toDay,
            dateStr: `Day ${toDay}`,
            title: `Day ${toDay}`,
            subtitle: `Custom Day · اليوم ${toDay}`,
            activities: [actToInsert]
          };
          return [...updated, newDay].sort((a, b) => a.dayNumber - b.dayNumber);
        }

        return updated.map(d => {
          if (d.dayNumber === toDay) {
            return {
              ...d,
              activities: [...d.activities, actToInsert].sort((a, b) => a.time.localeCompare(b.time))
            };
          }
          return d;
        });
      });

      showToast(`تم نقل النشاط إلى اليوم ${toDay} بنجاح`);
    },
    [showToast]
  );

  const toggleSaveItem = useCallback(
    (itemId: string) => {
      setSavedItems(prev => {
        const exists = prev.includes(itemId);
        const updated = exists ? prev.filter(id => id !== itemId) : [...prev, itemId];
        showToast(exists ? t('profile.removedFromSaved') : t('profile.savedToBucketList'));
        return updated;
      });
    },
    [showToast, t]
  );

  // See the note in UIContext.
  const value = useMemo<ItineraryContextType>(
    () => ({
      profile,
      setProfile,
      updateProfile,
      tripDays,
      setTripDays,
      addActivityToDay,
      removeActivityFromDay,
      updateActivityInDay,
      shiftActivityBetweenDays,
      activeFoodOrder,
      setActiveFoodOrder,
      savedItems,
      setSavedItems,
      toggleSaveItem
    }),
    [
      profile,
      updateProfile,
      tripDays,
      addActivityToDay,
      removeActivityFromDay,
      updateActivityInDay,
      shiftActivityBetweenDays,
      activeFoodOrder,
      savedItems,
      toggleSaveItem
    ]
  );

  return <ItineraryContext.Provider value={value}>{children}</ItineraryContext.Provider>;
};

export const useItinerary = () => {
  const context = useContext(ItineraryContext);
  if (!context) {
    throw new Error('useItinerary must be used within an ItineraryProvider');
  }
  return context;
};
