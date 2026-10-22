import React from 'react';
import { Compass, Luggage, Route, Sun, UserRound } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useDestination } from '../../context/DestinationContext';
import type { AppRoute } from '../../types';
import { haptic } from '../../design/feedback';

/**
 * Phone navigation: four places, always in the same order (plan §04).
 *
 *   Discover · Plan · Trip/Today · Account
 *
 * "Trip" becomes "Today" while the traveler is in the destination. The bar
 * sits above the home indicator (safe-area inset) and hides from `lg` up,
 * where the header carries navigation.
 */

type TabId = 'discover' | 'plan' | 'trip' | 'account';

type Tab = {
  id: TabId;
  label: string;
  route: AppRoute;
  icon: React.ReactNode;
  badge?: React.ReactNode;
};

const DISCOVER_ROUTES: string[] = ['/', '/home', '/discover', '/explore', '/attractions', '/experiences', '/programs', '/hotels', '/accommodations', '/food', '/restaurants', '/rentals', '/transfers', '/transfers/local', '/transfers/intercity', '/live', '/listings'];
const PLAN_ROUTES: string[] = ['/plan', '/plan-for-me', '/trip-builder', '/trip-preview'];
const TRIP_ROUTES: string[] = ['/my-trip', '/my-trip/day', '/my-trip/activity', '/bookings', '/arrive', '/first-two-hours', '/help', '/change-recovery', '/departure', '/post-trip', '/memories'];

export function activeTabFor(route: string): TabId | null {
  if (DISCOVER_ROUTES.includes(route)) return 'discover';
  if (PLAN_ROUTES.includes(route)) return 'plan';
  if (TRIP_ROUTES.includes(route)) return 'trip';
  if (route === '/profile' || route.startsWith('/auth')) return 'account';
  return null;
}

export const AppTabBar: React.FC = () => {
  const { currentRoute, navigateTo, activeTrip, isSignedIn, bookings } = useTrip();
  const { t } = useLanguage();
  const { destination } = useDestination();
  const reduce = useReducedMotion();
  const active = activeTabFor(currentRoute);
  const inDestination = activeTrip?.status === 'IN_DESTINATION';
  const pendingBookingsCount = bookings?.filter(b => b.status === 'Pending').length ?? 0;

  const tabs: Tab[] = [
    { id: 'discover', label: t('shell.tab.discover'), route: '/home', icon: <Compass className="h-[22px] w-[22px]" strokeWidth={1.7} /> },
    // The orb belongs to DayGi (header); planning is a route being drawn.
    { id: 'plan', label: t('shell.tab.plan'), route: '/plan', icon: <Route className="h-[22px] w-[22px]" strokeWidth={1.7} /> },
    {
      id: 'trip',
      label: inDestination ? t('shell.tab.today') : t('shell.tab.trip'),
      route: '/my-trip',
      icon: inDestination ? <Sun className="h-[22px] w-[22px]" strokeWidth={1.7} /> : <Luggage className="h-[22px] w-[22px]" strokeWidth={1.7} />,
      badge: pendingBookingsCount > 0 ? (
        <span
          className="absolute -top-0.5 -right-0.5 w-5 h-5 rounded-full bg-dg-action text-[1px] flex items-center justify-center text-xs text-dg-action-ink"
        >
          {pendingBookingsCount}
        </span>
      ) : null,
    },
    {
      id: 'account',
      label: t('shell.tab.account'),
      route: isSignedIn ? '/profile' : '/auth/sign-in',
      icon: <UserRound className="h-[22px] w-[22px]" strokeWidth={1.7} />,
    },
  ];

  return (
    <nav
      aria-label={t('shell.tabsLabel')}
      className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-dg-line bg-dg-chrome backdrop-blur-xl backdrop-saturate-150 pb-[var(--dg-safe-bottom)]"
    >
      <ul className="mx-auto grid h-[var(--dg-tabbar-h)] max-w-lg grid-cols-4">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const badge = tab.badge;
          return (
            <li key={tab.id} className="relative">
              <button
                type="button"
                onClick={() => {
                  haptic('tap');
                  // Re-tapping the tab you are on returns to the top, as in native apps.
                  if (isActive) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
                  else navigateTo(tab.route);
                }}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-full w-full flex-col items-center justify-center gap-1 text-[0.75rem] font-medium transition-colors',
                  isActive ? 'text-dg-ink' : 'text-dg-ink-3 hover:text-dg-ink-2',
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="tabbar-indicator"
                    className="absolute top-0 h-[3px] w-6 rounded-full bg-dg-action"
                    transition={reduce ? { duration: 0 } : destination.motion.layout}
                    aria-hidden="true"
                  />
                )}
                {badge}
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
