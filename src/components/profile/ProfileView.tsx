import React, { useState, useMemo } from 'react';
import {
  Heart,
  ShieldCheck,
  Compass,
  Luggage,
  Bell,
  Sparkles,
  Edit3,
  Save,
  X,
  LogOut
} from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { formatTripDateRange } from '../../utils/tripDates';
import type { TripEntity } from '../../shared/types/trip';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';
import { localizeInterest } from '../../i18n/interests';
import { NEAR_ME_DATA, fetchDestinationCorpus } from '../explore/ExploreView';
import { useApiResource } from '../../hooks/useApiResource';
import { buildExploreItems } from '../../services/exploreMapper';

type SectionId = 'dossier' | 'saved' | 'journeys' | 'settings';

const SECTION_ANCHOR: Record<SectionId, string> = {
  dossier: 'profile-section-dossier',
  saved: 'profile-section-saved',
  journeys: 'profile-section-journeys',
  settings: 'profile-section-settings',
};

const PACE_OPTIONS = ['Relaxed', 'Balanced', 'Active'] as const;
const BUDGET_OPTIONS = ['Budget', 'Moderate', 'Premium'] as const;

function readStored(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: the setting simply does not survive a reload */
  }
}

export const ProfileView: React.FC = () => {
  const { profile, setProfile, savedItems, toggleSaveItem, navigateTo, showToast, sessionUser, isSignedIn, allTrips, activeTrip, bookings, signOut } = useTrip();
  const { language, isRTL, t } = useLanguage();

  // Settings persist on this device so they still hold after a reload.
  const [currency, setCurrency] = useState<'EGP' | 'USD' | 'EUR'>(() => {
    const stored = readStored('dahab.profile.currency', 'EGP');
    return stored === 'USD' || stored === 'EUR' ? stored : 'EGP';
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return readStored('dahab.profile.notifications', 'on') !== 'off';
  });

  // Removed: a check for 'ahmed' in the email or name that, when it matched,
  // filled in an emergency contact ("+20 111 234 5678 (Nour Mansour - Sister)")
  // and a passport number ("A28941092") the account had never supplied. A
  // passport number and a next-of-kin are the two most consequential fields on
  // this page; inventing them for anyone whose name happens to contain "ahmed"
  // is not a placeholder, it is a false record. Both now show only what the
  // traveler entered.
  const displayName = profile.name || sessionUser?.name || '';

  // Edit profile state. Synced from the live profile every time editing
  // starts, so a profile that finished loading after first paint does not
  // leave the form holding stale blanks. Cancel restores by simply closing.
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: profile.name,
    phone: profile.phone,
    email: profile.email,
    emergencyContact: profile.emergencyContact || '',
    passportNumber: profile.passportNumber || '',
    pace: profile.pace,
    budget: profile.budget,
  });
  /**
   * Saving talks to the server now, so it has its own busy/error state: a slow
   * request must disable the button, and a refusal (bad phone format, a
   * network drop) must show inside the dialog instead of a success toast.
   */
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const auth = useAuth();
  const { user, refreshSession } = auth || { user: null, refreshSession: async () => {} };

  const beginEditing = () => {
    setEditForm({
      name: profile.name,
      phone: profile.phone,
      email: profile.email,
      emergencyContact: profile.emergencyContact || '',
      passportNumber: profile.passportNumber || '',
      pace: profile.pace,
      budget: profile.budget,
    });
    setSaveError(null);
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (savingProfile) return;
    setSaveError(null);
    const nextName = editForm.name.trim();
    const nextPhone = editForm.phone.trim();
    if (!nextName) {
      setSaveError(t('profile.nameRequired'));
      return;
    }
    // Client-side guard that mirrors the server rule, so the common failure is
    // caught before a network round-trip. The server re-checks: client
    // validation is a convenience, never the boundary.
    if (nextPhone && !/^\+?[\d\s\-()]{7,24}$/.test(nextPhone)) {
      setSaveError(t('profile.phoneInvalid'));
      return;
    }
    setSavingProfile(true);
    try {
      /**
       * The context write alone was the whole bug: "Save" used to change
       * React state and toast success while `/api/auth/me` kept the old
       * record — after a reload the edit silently vanished and every flow
       * that reads the phone for booking contact details kept the blank.
       * The server is the truth now: it returns the fresh record,
       * refreshSession() re-reads the session so ItineraryContext syncs from
       * it, and only a real success closes the dialog.
       */
      const result = await api.updateProfile({ name: nextName, phone: nextPhone || undefined });
      setProfile(prev => ({
        ...prev,
        name: result?.user?.name ?? nextName,
        phone: result?.user?.phone ?? nextPhone,
      }));
      await refreshSession();
      setIsEditing(false);
      showToast(t('profile.profileUpdatedSuccessfully'));
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : t('tripEdit.error.generic'));
    } finally {
      setSavingProfile(false);
    }
  };

  /**
   * The bucket resolves ids against the same shelf explore reads from: the
   * live corpus when it loads, the hand-written places when it does not. The
   * old filter only knew the fallback shelf, so with real data every saved
   * heart silently matched nothing and the tab stayed empty forever.
   */
  const corpus = useApiResource(fetchDestinationCorpus);
  const savedPlacesList = useMemo(() => {
    const shelf =
      !corpus.data || corpus.data.activities.length === 0
        ? NEAR_ME_DATA
        : buildExploreItems(corpus.data.activities, corpus.data.places, language === 'ar');
    return shelf.filter((p) => savedItems.includes(p.id));
  }, [corpus.data, savedItems, language]);

  /**
   * The traveler's own finished trips.
   *
   * This was two fabricated entries — "Autumn Wind & Reef Escape, Nov 04–09
   * 2024, EGP 11,200" and a 2023 PADI certification trip — rendered under
   * "Past Sinai Journeys" as this reader's history, down to what they had
   * spent. GET /api/trips/user/:userId returns their real trips and has
   * enforced ownership since the IDOR on it was closed.
   *
   * A trip counts as past when it is COMPLETED or its end date has gone by.
   */
  const pastTrips = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return allTrips
      .filter(trip => {
        if (trip.id === activeTrip?.id) return false;
        if (trip.status === 'COMPLETED') return true;
        return Boolean(trip.endDate && trip.endDate < today);
      })
      .sort((a, b) => (b.endDate || b.updatedAt).localeCompare(a.endDate || a.updatedAt));
  }, [allTrips, activeTrip]);

  /** The hotel and the next activity on the active trip, from its bookings. */
  const accommodation = bookings.find(b => b.serviceType === 'hotel')?.subtitle;
  const nextScheduled = bookings.find(b => b.serviceType !== 'hotel')?.subtitle;

  /** "04 Nov – 09 Nov 2024 (5 days)" from the trip's own dates. */
  const tripDateLabel = (trip: TripEntity): string => {
    const range = formatTripDateRange(trip.startDate, trip.endDate, language === 'ar' ? 'ar' : 'en');
    const days = t('profile.days', { lengthDays: trip.lengthDays });
    return range ? `${range} · ${days}` : days;
  };

  const scrollToSection = (section: SectionId) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document
      .getElementById(SECTION_ANCHOR[section])
      ?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const contactLine = [profile.email || sessionUser?.email, profile.phone || sessionUser?.phone]
    .filter(Boolean)
    .join(' · ') || t('profile.signInToSee');

  // Counts what the section actually shows: the bucket resolves place ids
  // from the shared list, so anything it cannot resolve is not counted.
  const sections: { id: SectionId; label: string; count: number | null }[] = [
    { id: 'dossier', label: t('profile.travelerProfilePreferences'), count: null },
    { id: 'saved', label: t('profile.savedSection'), count: savedPlacesList.length },
    { id: 'journeys', label: t('profile.journeysSection'), count: pastTrips.length },
    { id: 'settings', label: t('profile.preferencesCurrency'), count: null },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex flex-col items-center justify-center text-center px-4 space-y-6">
        <h1 className="text-3xl font-display font-semibold text-[var(--text-primary)]">{t('profile.completePrompt')}</h1>
        <p className="text-[var(--text-secondary)]">{t('profile.personalizedTrips')}</p>
        <button onClick={() => navigateTo('/plan')} className="px-8 py-3 rounded-xl bg-[var(--accent-primary)] text-white font-bold">{t('profile.addTrip')}</button>
      </div>
    );
  }

  return (
    <div
      id="traveler-profile-view"
      dir={isRTL ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] pb-24"
    >
      <h1 className="sr-only">{t('profile.completePrompt')}</h1>
      {/* 1. Identity band — the dossier seal, the name, and the way out to the trip */}
      <section className="bg-[var(--surface-card)] border-b border-[var(--border-subtle)] pt-10 pb-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-5 relative z-10">
          <div
            aria-hidden="true"
            className="w-16 h-16 rounded-3xl flex items-center justify-center font-bold text-2xl text-[#F2EDDF] shadow-md ring-1 ring-[var(--accent-secondary)]/40"
            style={{ background: 'linear-gradient(135deg, #1C1917 0%, #2A2622 55%, var(--accent-secondary) 130%)' }}
          >
            {/* Was a literal 'A' when there was no name — the demo
                persona's initial, shown to every anonymous visitor. */}
            {displayName ? displayName.charAt(0).toUpperCase() : '·'}
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Rendered an empty <h1> for anyone not signed in: the page
                  had no accessible name and no title at all. */}
              <h1 className="chart-heading text-2xl sm:text-3xl text-[var(--text-primary)]">
                {displayName || t('profile.yourProfile')}
              </h1>
              {/* Claimed "Active Traveler ✓" even when signed out. */}
              {isSignedIn && (
                <span className="chart-badge chart-badge-live">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('profile.activeTraveler')}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{contactLine}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <>
                {saveError && (
                  <p role="alert" className="w-full text-sm font-medium text-red-600 dark:text-red-400">
                    {saveError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => { setSaveError(null); setIsEditing(false); }}
                  disabled={savingProfile}
                  className="chart-cta-secondary inline-flex items-center gap-2 text-sm cursor-pointer !py-2.5 !px-5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                  <span>{t('profile.cancel')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSaveProfile(); }}
                  disabled={savingProfile}
                  aria-busy={savingProfile}
                  className="chart-cta-primary inline-flex items-center gap-2 text-sm cursor-pointer !py-2.5 !px-5 disabled:opacity-50 disabled:cursor-wait"
                >
                  <Save className="w-4 h-4" aria-hidden="true" />
                  <span>{savingProfile ? t('profile.saving') : t('profile.saveChanges')}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={beginEditing}
                  className="chart-cta-secondary inline-flex items-center gap-2 text-sm cursor-pointer !py-2.5 !px-5"
                >
                  <Edit3 className="w-4 h-4" aria-hidden="true" />
                  <span>{t('profile.editProfile')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigateTo('/my-trip')}
                  className="chart-cta-primary inline-flex items-center gap-2 text-sm cursor-pointer !py-2.5 !px-5"
                >
                  <Luggage className="w-4 h-4" aria-hidden="true" />
                  <span>{t('profile.activeDahabTrip')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-10 lg:items-start">
        {/* 2. Section rail — every part of the dossier, always visible */}
        <nav
          aria-label={t('profile.yourProfile')}
          className="mb-8 lg:mb-0 lg:sticky lg:top-24"
        >
          <div className="flex lg:flex-col gap-2 overflow-x-auto no-scrollbar pb-1">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-semibold whitespace-nowrap cursor-pointer border border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-card)] hover:border-[var(--border-subtle)] transition-colors text-start"
              >
                <span className="flex-1">{section.label}</span>
                {section.count !== null && (
                  <span className="tabular-nums text-xs font-bold px-2 py-0.5 rounded-full bg-[var(--surface-container)] text-[var(--text-secondary)]">
                    {section.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </nav>

        <main className="space-y-12 min-w-0">
          {/* 3. Dossier — who travels, how they travel, and the papers to prove it */}
          <section id={SECTION_ANCHOR.dossier} aria-label={t('profile.travelPreferences')} className="scroll-mt-24 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <div className="md:col-span-7 chart-card rounded-3xl p-6 sm:p-8 space-y-6">
                <div className="space-y-1">
                  <h2 className="chart-heading text-xl text-[var(--text-primary)]">
                    {t('profile.travelPreferences')}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)]">
                    {t('profile.personalizedForDahab')}
                  </p>
                </div>

                {isEditing ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label htmlFor="profile-edit-name" className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                          {t('profile.fullName')}
                        </label>
                        <input
                          id="profile-edit-name"
                          type="text"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full p-2.5 rounded-xl text-sm font-medium"
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="profile-edit-phone" className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                            {t('profile.phone')}
                          </label>
                          <input
                            id="profile-edit-phone"
                            type="tel"
                            autoComplete="tel"
                            value={editForm.phone}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label htmlFor="profile-edit-email" className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                            {t('profile.email')}
                          </label>
                          <input
                            id="profile-edit-email"
                            type="email"
                            autoComplete="email"
                            readOnly
                            value={editForm.email}
                            className="w-full p-2.5 rounded-xl text-sm font-medium opacity-70 cursor-not-allowed"
                          />
                          <p className="text-xs text-[var(--text-secondary)] mt-1">
                            {t('profile.emailReadOnly')}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="profile-edit-emergency" className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                            {t('profile.emergencyContact')}
                          </label>
                          <input
                            id="profile-edit-emergency"
                            type="text"
                            value={editForm.emergencyContact}
                            onChange={(e) => setEditForm({ ...editForm, emergencyContact: e.target.value })}
                            className="w-full p-2.5 rounded-xl text-sm font-medium"
                          />
                        </div>
                        <div>
                          <label htmlFor="profile-edit-passport" className="block text-sm font-bold text-[var(--text-primary)] mb-1.5">
                            {t('profile.iDPassportNumber')}
                          </label>
                          <input
                            id="profile-edit-passport"
                            type="text"
                            autoComplete="off"
                            value={editForm.passportNumber}
                            onChange={(e) => setEditForm({ ...editForm, passportNumber: e.target.value })}
                            className="w-full p-2.5 rounded-xl font-mono text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span id="profile-edit-pace-label" className="block text-sm font-bold text-[var(--text-primary)]">
                        {t('profile.travelStylePace')}
                      </span>
                      <div role="group" aria-labelledby="profile-edit-pace-label" className="flex flex-wrap gap-2">
                        {PACE_OPTIONS.map((pace) => (
                          <button
                            key={pace}
                            type="button"
                            aria-pressed={editForm.pace === pace}
                            onClick={() => setEditForm({ ...editForm, pace })}
                            className={`px-4 py-2 rounded-full text-xs font-bold cursor-pointer border transition-colors ${
                              editForm.pace === pace
                                ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                                : 'text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {t(`profile.pace.${pace}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <span id="profile-edit-budget-label" className="block text-sm font-bold text-[var(--text-primary)]">
                        {t('profile.budgetTier')}
                      </span>
                      <div role="group" aria-labelledby="profile-edit-budget-label" className="flex flex-wrap gap-2">
                        {BUDGET_OPTIONS.map((budget) => (
                          <button
                            key={budget}
                            type="button"
                            aria-pressed={editForm.budget === budget}
                            onClick={() => setEditForm({ ...editForm, budget })}
                            className={`px-4 py-2 rounded-full text-xs font-bold cursor-pointer border transition-colors ${
                              editForm.budget === budget
                                ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                                : 'text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {t(`hotels.${budget.toLowerCase()}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{t('profile.travelStylePace')}</p>
                      <span className="chart-badge chart-badge-live !text-xs !py-1.5 !px-3.5">
                        {profile.pace === 'Balanced' ? t('profile.balanced12MainActivitiesday') : profile.pace}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{t('profile.budgetTier')}</p>
                      <span className="chart-badge chart-badge-live !text-xs !py-1.5 !px-3.5">
                        {profile.budget === 'Moderate' ? t('profile.moderateTierBalanceOf') : profile.budget}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{t('profile.coreTravelInterests')}</p>
                      {profile.interests.length > 0 ? (
                        <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
                          {profile.interests.map((interest) => (
                            <li
                              key={interest}
                              className="px-3 py-1 rounded-full bg-[var(--surface-container)] text-[var(--text-primary)] font-bold border border-[var(--border-subtle)] text-xs"
                            >
                              {localizeInterest(interest, language)}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-[var(--text-secondary)]">—</p>
                      )}
                    </div>

                    {/* Papers — passport and next-of-kin show only what was entered */}
                    <div className="pt-5 border-t border-[var(--border-subtle)] space-y-3">
                      <h3 className="chart-heading text-base text-[var(--text-primary)]">
                        {t('profile.sinaiTravelPermitsSecurity')}
                      </h3>
                      <dl className="chart-thread m-0">
                        <div className="chart-waypoint !py-3.5">
                          <dt className="text-sm text-[var(--text-secondary)]">{t('profile.passportDocument')}</dt>
                          <dd className="ms-auto font-mono font-bold text-sm text-[var(--text-primary)] m-0">
                            {profile.passportNumber || '—'}
                          </dd>
                        </div>
                        <div className="chart-waypoint !py-3.5">
                          <dt className="text-sm text-[var(--text-secondary)]">{t('profile.emergencyContact')}</dt>
                          <dd className="ms-auto font-bold text-sm text-[var(--text-primary)] m-0">
                            {profile.emergencyContact || '—'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}
              </div>

              {/* The trip right now */}
              <div className="md:col-span-5 chart-card rounded-3xl p-6 sm:p-7 space-y-4">
                <span className="chart-badge chart-badge-ember">
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                  {t('profile.activeJourney')}
                </span>

                {/*
                  The active trip card. Was entirely fixed: "5 Days in Dahab",
                  "October 12 – October 16 · 2 Travelers · Balanced Pace",
                  "Dahab Bay Hotel (4 nights)" and "The Canyon Coral Dive" as the
                  next scheduled activity — shown under the heading "Active
                  Journey" to every traveler.
                */}
                <div className="space-y-1.5">
                  <h2 className="chart-heading text-xl text-[var(--text-primary)]">
                    {activeTrip?.title || t('profile.noActiveTripYet')}
                  </h2>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {activeTrip
                      ? [
                          tripDateLabel(activeTrip),
                          `${activeTrip.travelersCount} ${t('profile.travellers')}`,
                          activeTrip.pace
                        ].join(' · ')
                      : t('profile.startATripAnd')}
                  </p>
                </div>

                {activeTrip && (
                  <dl className="rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] p-4 space-y-2.5 text-sm m-0">
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--text-secondary)]">{t('profile.accommodations')}</dt>
                      <dd className="font-bold text-[var(--text-primary)] text-end m-0">{accommodation || '—'}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--text-secondary)]">{t('profile.nextScheduled')}</dt>
                      <dd className="font-bold text-[var(--accent-primary)] text-end m-0">{nextScheduled || '—'}</dd>
                    </div>
                  </dl>
                )}

                <button
                  type="button"
                  onClick={() => navigateTo(activeTrip ? '/my-trip' : '/trip-builder')}
                  className="chart-cta-primary w-full inline-flex items-center justify-center text-sm cursor-pointer"
                >
                  <span>{activeTrip ? t('profile.goToMyTrip') : t('nav.planTrip')}</span>
                </button>
              </div>
            </div>
          </section>

          {/* 4. Saved — the bucket list, image first */}
          <section id={SECTION_ANCHOR.saved} aria-label={t('profile.yourSavedDahabBucket')} className="scroll-mt-24 space-y-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="chart-heading text-xl text-[var(--text-primary)]">
                {t('profile.yourSavedDahabBucket')}
              </h2>
              {savedPlacesList.length > 0 && (
                <button
                  type="button"
                  onClick={() => navigateTo('/explore')}
                  className="text-sm font-bold text-[var(--accent-primary)] hover:underline cursor-pointer"
                >
                  {t('profile.exploreMoreSpots')}
                </button>
              )}
            </div>

            {savedPlacesList.length === 0 ? (
              <div className="chart-card rounded-3xl p-10 text-center space-y-3">
                <Heart className="w-8 h-8 text-[var(--text-secondary)] mx-auto" aria-hidden="true" />
                <p className="text-sm text-[var(--text-secondary)] max-w-[52ch] mx-auto leading-relaxed">
                  {t('profile.noPlacesSavedYet')}
                </p>
                <button
                  type="button"
                  onClick={() => navigateTo('/explore')}
                  className="chart-cta-secondary inline-flex items-center gap-2 text-sm cursor-pointer !py-2.5 !px-5"
                >
                  <Compass className="w-4 h-4" aria-hidden="true" />
                  <span>{t('profile.exploreMoreSpots')}</span>
                </button>
              </div>
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 list-none m-0 p-0">
                {savedPlacesList.map((place) => {
                  const title = language === 'ar' && place.nameAr ? place.nameAr : place.name;
                  const tag = language === 'ar' && place.tagAr ? place.tagAr : place.tag;
                  const desc = language === 'ar' && place.descriptionAr ? place.descriptionAr : place.description;

                  return (
                    <li
                      key={place.id}
                      className="chart-card rounded-3xl overflow-hidden flex flex-col"
                    >
                      <div className="relative h-40 w-full overflow-hidden bg-[var(--surface-container)]">
                        <img
                          src={place.image}
                          alt={title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => toggleSaveItem(place.id)}
                          aria-label={t('explore.removeFromFavourites')}
                          aria-pressed="true"
                          className="absolute top-3 end-3 w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md cursor-pointer"
                        >
                          <Heart className="w-4 h-4 fill-white" aria-hidden="true" />
                        </button>
                      </div>

                      <div className="p-5 space-y-2 flex-1">
                        <p className="text-xs font-bold text-[var(--accent-primary)] m-0">
                          {tag}
                        </p>
                        <h3 className="chart-heading text-base text-[var(--text-primary)]">
                          {title}
                        </h3>
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed line-clamp-2 m-0">
                          {desc}
                        </p>
                      </div>

                      <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
                        <span className="tabular-nums text-xs font-bold text-[var(--accent-primary)]">
                          {place.distance} {t('profile.away')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            showToast(t('profile.openedDetails', { name: title }));
                            navigateTo('/explore');
                          }}
                          className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          {t('profile.viewInExplore')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 5. Journeys — past trips on a timeline rail. A sequence, so the
              rail earns its structure: each dot is a trip that ended. */}
          <section id={SECTION_ANCHOR.journeys} aria-label={t('profile.pastSinaiJourneys')} className="scroll-mt-24 space-y-5 max-w-3xl">
            <h2 className="chart-heading text-xl text-[var(--text-primary)]">
              {t('profile.pastSinaiJourneys')}
            </h2>

            {pastTrips.length === 0 ? (
              <div className="chart-card rounded-3xl p-10 text-center space-y-3">
                <Luggage className="w-8 h-8 text-[var(--text-secondary)] mx-auto" aria-hidden="true" />
                <p className="text-sm text-[var(--text-secondary)] max-w-[52ch] mx-auto leading-relaxed">
                  {t('profile.noPastTripsYet')}
                </p>
                <button
                  type="button"
                  onClick={() => navigateTo('/trip-builder')}
                  className="chart-cta-secondary inline-flex items-center gap-2 text-sm cursor-pointer !py-2.5 !px-5"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>{t('nav.planTrip')}</span>
                </button>
              </div>
            ) : (
              <ol className="relative ms-2 space-y-6 border-s border-[var(--border-subtle)] ps-6 list-none">
                {pastTrips.map((trip) => (
                  <li key={trip.id} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute top-6 -start-[31px] w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)] ring-4 ring-[var(--accent-primary)]/15"
                    />
                    <div className="chart-card rounded-3xl p-6 space-y-3">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="space-y-1">
                          <h3 className="chart-heading text-base text-[var(--text-primary)]">
                            {trip.title}
                          </h3>
                          <p className="tabular-nums text-xs text-[var(--text-secondary)]">
                            {tripDateLabel(trip)}
                          </p>
                        </div>
                        {/* What was actually paid, from the trip record. Was a
                            written "EGP 11,200". */}
                        <span className="dg-num font-mono text-xs font-bold text-[var(--accent-primary)]">
                          {trip.totalPaidEGP > 0 ? `EGP ${trip.totalPaidEGP.toLocaleString()}` : '—'}
                        </span>
                      </div>

                      {trip.interests.length > 0 && (
                        <p className="text-sm text-[var(--text-secondary)] leading-relaxed m-0">
                          <strong className="text-[var(--text-primary)]">{t('profile.interests')}</strong>{' '}
                          {trip.interests.map((i) => localizeInterest(i, language)).join(t('itinerary._item_'))}
                        </p>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <span className="chart-badge chart-badge-live">
                          {trip.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            showToast(t('profile.rebookingItineraryOptionsLoaded'));
                            navigateTo('/trip-builder');
                          }}
                          className="text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          {t('profile.rebookSimilarTrip')}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* 6. Settings — display currency and trip pings, both kept on this device */}
          <section id={SECTION_ANCHOR.settings} aria-label={t('profile.travelerPreferencesCurrency')} className="scroll-mt-24 space-y-5 max-w-2xl">
            <h2 className="chart-heading text-xl text-[var(--text-primary)]">
              {t('profile.travelerPreferencesCurrency')}
            </h2>

            <div className="chart-card rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="space-y-2.5">
                <p id="profile-currency-label" className="text-sm font-bold text-[var(--text-primary)] m-0">
                  {t('profile.displayCurrency')}
                </p>
                <div role="group" aria-labelledby="profile-currency-label" className="flex flex-wrap gap-2">
                  {(['EGP', 'USD', 'EUR'] as const).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      aria-pressed={currency === curr}
                      onClick={() => {
                        setCurrency(curr);
                        store('dahab.profile.currency', curr);
                        showToast(t('profile.currencyUpdatedTo', { curr }));
                      }}
                      className={`min-h-[44px] px-5 rounded-2xl text-xs font-bold cursor-pointer transition-colors border ${
                        currency === curr
                          ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)] border-[var(--accent-primary)]/40'
                          : 'text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <h3 className="chart-heading text-base text-[var(--text-primary)]">
                    {t('profile.liveTripNotificationsWeather')}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed m-0">
                    {t('profile.receiveTimelyMorningSea')}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={notificationsEnabled}
                  aria-label={t('profile.liveTripNotificationsWeather')}
                  onClick={() => {
                    const next = !notificationsEnabled;
                    setNotificationsEnabled(next);
                    store('dahab.profile.notifications', next ? 'on' : 'off');
                    showToast(next ? t('profile.notificationsEnabled') : t('profile.notificationsMuted'));
                  }}
                  className={`relative w-12 h-7 rounded-full transition-colors flex-shrink-0 cursor-pointer border ${
                    notificationsEnabled
                      ? 'bg-[var(--accent-primary)] border-[var(--accent-primary)]'
                      : 'bg-[var(--surface-container)] border-[var(--border-subtle)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-[background-color,border-color,color,box-shadow,transform,opacity] ${
                      notificationsEnabled ? 'start-[26px]' : 'start-0.5'
                    }`}
                  />
                  <Bell className="sr-only" aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          {/*
            Signing out.

            Also reachable from the account menu in the header, but this is
            where people look for it — and until now the platform had no way
            out at all: a traveler could sign in and never sign out, which on
            a shared device leaves the next person holding their bookings,
            their payment history and their passport field.
          */}
          {isSignedIn && (
            <section aria-label={t('profile.signOut')} className="max-w-2xl rounded-3xl p-6 border border-[var(--brand-coral)]/25 bg-[var(--surface-card)] space-y-3">
              <div className="space-y-1">
                <h2 className="chart-heading text-base text-[var(--text-primary)]">
                  {t('profile.signOut')}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed m-0">
                  {t('profile.endsYourSessionOn')}
                </p>
              </div>
              <button
                type="button"
                id="profile-signout-btn"
                onClick={() => void signOut()}
                className="min-h-[44px] px-5 rounded-full border border-[var(--brand-coral)]/40 text-[var(--brand-coral)] hover:bg-[var(--brand-coral)]/10 text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" aria-hidden="true" />
                <span>{t('profile.signOut')}</span>
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};
