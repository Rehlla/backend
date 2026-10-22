import React from 'react';
import {
  Mountain, Map, Activity, BedDouble, UtensilsCrossed, Utensils, Car, Plane, Bike, Sparkles, Sparkle, Compass, Luggage, Ticket, LifeBuoy, Info, CircleHelp, BookOpen,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';
import { useDestination } from '../../context/DestinationContext';
import type { AppRoute } from '../../types';
import { DESTINATIONS } from '../../design/destinations';
import { Sheet } from '../ui/sheet';

/**
 * The whole product on one sheet. The tab bar keeps the four daily places in
 * thumb reach; everything else — every vertical, every trip tool, help — is
 * one tap away here, on phones and desktop alike. This replaces the old
 * header's site-map panel, which never existed on phones.
 */

interface Item {
  route: AppRoute;
  key: string;
  icon: React.ReactNode;
}

const ic = 'h-5 w-5';
const GROUPS: { key: string; items: Item[] }[] = [
  {
    key: 'menu.group.do',
    items: [
      { route: '/attractions', key: 'menu.attractions', icon: <Mountain className={ic} /> },
      { route: '/explore', key: 'menu.explore', icon: <Map className={ic} /> },
      { route: '/live', key: 'menu.live', icon: <Activity className={ic} /> },
      { route: '/parties', key: 'menu.parties', icon: <Sparkle className={ic} /> },
    ],
  },
  {
    key: 'menu.group.stay',
    items: [
      { route: '/hotels', key: 'menu.hotels', icon: <BedDouble className={ic} /> },
      { route: '/food', key: 'menu.foodNow', icon: <Utensils className={ic} /> },
      { route: '/restaurants', key: 'menu.restaurants', icon: <UtensilsCrossed className={ic} /> },
    ],
  },
  {
    key: 'menu.group.move',
    items: [
      { route: '/transfers/local', key: 'menu.ridesLocal', icon: <Car className={ic} /> },
      { route: '/transfers/intercity', key: 'menu.ridesIntercity', icon: <Plane className={ic} /> },
      { route: '/rentals', key: 'menu.bikes', icon: <Bike className={ic} /> },
    ],
  },
  {
    key: 'menu.group.trip',
    items: [
      { route: '/plan', key: 'menu.plan', icon: <Compass className={ic} /> },
      { route: '/daygi', key: 'menu.daygi', icon: <Sparkles className={ic} /> },
      { route: '/my-trip', key: 'menu.myTrip', icon: <Luggage className={ic} /> },
      { route: '/bookings', key: 'menu.bookings', icon: <Ticket className={ic} /> },
    ],
  },
  {
    key: 'menu.group.info',
    items: [
      { route: '/help', key: 'menu.help', icon: <LifeBuoy className={ic} /> },
      { route: '/faq', key: 'menu.faq', icon: <CircleHelp className={ic} /> },
      { route: '/travel-guides', key: 'menu.guides', icon: <BookOpen className={ic} /> },
      { route: '/about', key: 'menu.about', icon: <Info className={ic} /> },
    ],
  },
];

/** Routes whose content is Dahab's catalogue today. */
const DAHAB_ONLY = new Set<AppRoute>(['/attractions', '/explore', '/live', '/hotels', '/food', '/restaurants', '/parties', '/transfers/local', '/transfers/intercity', '/rentals']);

export const SiteMenu: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { t, language } = useLanguage();
  const { navigateTo, currentRoute } = useTrip();
  const { destination } = useDestination();
  const place = destination.name[language];
  const early = destination.catalogue === 'early';

  const go = (route: AppRoute) => {
    onClose();
    navigateTo(route);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('menu.title', { place })}
      description={early ? t('menu.earlyNote', { place }) : undefined}
      closeLabel={t('shell.close')}
      size="lg"
    >
      <nav aria-label={t('menu.open')} className="grid gap-6 sm:grid-cols-2">
        {GROUPS.map((group) => (
          <div key={group.key} className="min-w-0">
            <h3 className="mb-2 text-[0.8125rem] font-semibold text-dg-ink-3">{t(group.key)}</h3>
            <ul className="grid gap-1">
              {group.items.map((item) => {
                const active = currentRoute === item.route;
                return (
                  <li key={item.route}>
                    <button
                      type="button"
                      onClick={() => go(item.route)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex w-full items-center gap-3 rounded-dg-md px-3 py-2.5 text-start transition-colors ${active ? 'bg-dg-action-wash text-dg-ink' : 'text-dg-ink hover:bg-dg-action-wash'}`}
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-dg-sunken text-dg-action">{item.icon}</span>
                      <span className="min-w-0 flex-1 font-medium">{t(item.key)}</span>
                      {early && DAHAB_ONLY.has(item.route) && (
                        <span className="shrink-0 text-[0.75rem] text-dg-ink-3">{DESTINATIONS.dahab.name[language]}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </Sheet>
  );
};
