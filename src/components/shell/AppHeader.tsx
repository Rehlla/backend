import React, { useEffect, useRef, useState } from 'react';
import { Search, LayoutGrid, Moon, Sun, ChevronDown, LogOut, Luggage, UserRound, LifeBuoy, Activity, Store, Ticket } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/lib/cn';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import type { AppRoute } from '../../types';
import { RehlaLogo, RehlaMark } from '../brand/RehlaLogo';
import { DestinationSwitcher } from './DestinationSwitcher';
import { SiteMenu } from './SiteMenu';
import { AskDaygiButton } from './AskDaygiButton';
import { Button } from '../ui/button';
import { tween } from '../../design/motion';

/**
 * The top bar.
 *
 * Phones: logo, the destination pill, search and language — navigation
 * lives in the tab bar at the bottom, within thumb reach. From `lg`: logo,
 * destination, five primary destinations-of-intent, utilities, account and
 * the one primary action (Plan my trip).
 *
 * On the home hero it starts transparent with light ink and settles onto
 * the chrome surface once the page scrolls.
 */

const OVERLAY_ROUTES = new Set<string>(['/', '/home', '/discover']);

const PRIMARY: { route: AppRoute; key: string; match: string[] }[] = [
  { route: '/home', key: 'shell.tab.discover', match: ['/', '/home', '/discover', '/explore'] },
  { route: '/hotels', key: 'shell.nav.stays', match: ['/hotels', '/accommodations', '/rentals-page'] },
  { route: '/attractions', key: 'shell.nav.experiences', match: ['/attractions', '/experiences', '/programs', '/listings'] },
  { route: '/transfers/local', key: 'shell.nav.rides', match: ['/transfers', '/transfers/local', '/transfers/intercity', '/rentals'] },
  // "Food" points at /restaurants, the full dining surface. /food is the narrower
  // trip-meal view and stays reachable from the trip flow, so the header must
  // not offer two destinations for the same label.
  { route: '/restaurants', key: 'shell.nav.food', match: ['/food', '/restaurants'] },
];

export const AppHeader: React.FC<{ onOpenSearch: () => void }> = ({ onOpenSearch }) => {
  const { currentRoute, navigateTo, isSignedIn, sessionUser, profile, authRole, signOut } = useTrip();
  const { t, language, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme, themeId } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [siteMenuOpen, setSiteMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [currentRoute]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const overlay = OVERLAY_ROUTES.has(currentRoute) && !scrolled;
  const name = sessionUser?.name || profile?.name || sessionUser?.email || '';
  const initial = name ? name.charAt(0).toUpperCase() : '';
  const canSeeOps = isSignedIn && (authRole === 'Operations' || authRole === 'Admin');
  const canSeeSupplier = isSignedIn && (authRole === 'Supplier' || authRole === 'Operations' || authRole === 'Admin');

  const iconBtn = cn(
    'grid h-10 w-10 place-items-center rounded-full transition-colors',
    overlay ? 'text-white hover:bg-white/15' : 'text-dg-ink-2 hover:bg-dg-action-wash hover:text-dg-ink',
  );

  const menuItem = 'flex w-full items-center gap-3 px-4 min-h-11 text-sm text-start hover:bg-dg-action-wash transition-colors';

  return (
    <>
      <a href="#main-app-content" className="skip-link">
        {t('nav.skipToMainContent')}
      </a>
      <header
        role="banner"
        className={cn(
          'fixed inset-x-0 top-0 z-40 pt-[var(--dg-safe-top)] transition-[background-color,border-color,box-shadow] duration-300',
          overlay ? 'bg-transparent border-b border-transparent' : 'bg-dg-chrome backdrop-blur-xl backdrop-saturate-150 border-b border-dg-line',
        )}
      >
        <div className="mx-auto flex h-[var(--dg-topbar-h)] max-w-[var(--dg-content-max)] items-center gap-2 px-[var(--dg-gutter)]">
          <button type="button" onClick={() => navigateTo('/home')} aria-label={t('shell.brand')} className="shrink-0 rounded-dg-sm">
            <RehlaLogo
              className={cn('hidden sm:inline-flex', overlay && 'text-white')}
              markClassName={overlay ? 'text-white' : undefined}
            />
            <RehlaMark className={cn('h-9 w-9 sm:hidden', overlay ? 'text-white' : 'text-dg-action')} sunColor="var(--dg-highlight)" />
          </button>

          <DestinationSwitcher tone={overlay ? 'media' : 'chrome'} className="ms-1" />

          <nav aria-label={t('shell.tabsLabel')} className="hidden lg:flex items-center gap-0.5 xl:gap-1 ms-2 xl:ms-4 min-w-0">
            {PRIMARY.map((item) => {
              const isActive = item.match.includes(currentRoute);
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => navigateTo(item.route)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'relative h-10 px-2.5 xl:px-3.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                    overlay
                      ? isActive ? 'text-white' : 'text-white/80 hover:text-white'
                      : isActive ? 'text-dg-ink' : 'text-dg-ink-2 hover:text-dg-ink',
                  )}
                >
                  {t(item.key)}
                  {isActive && (
                    <motion.span
                      layoutId="header-indicator"
                      className={cn('absolute inset-x-3.5 -bottom-0.5 h-0.5 rounded-full', overlay ? 'bg-white' : 'bg-dg-action')}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="ms-auto flex shrink-0 items-center gap-0.5 xl:gap-1">
            <AskDaygiButton overlay={overlay} />
            <button type="button" onClick={onOpenSearch} aria-label={t('shell.search')} className={iconBtn}>
              <Search className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSiteMenuOpen(true)}
              aria-label={t('menu.open')}
              aria-haspopup="dialog"
              className={iconBtn}
            >
              <LayoutGrid className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={toggleLanguage}
              // WCAG 2.5.3 (Label in Name): the accessible name must contain the visible
              // text, or voice control users cannot say what they see. The glyph
              // is "EN" in Arabic mode and "ع" in English mode, so it leads.
              aria-label={`${language === 'ar' ? 'EN' : 'ع'}: ${t('shell.switchLanguageLabel')}`}
              className={cn(iconBtn, 'w-auto px-3 text-sm font-semibold')}
            >
              {language === 'ar' ? 'EN' : 'ع'}
            </button>
            {themeId !== 'high-contrast-pro' && (
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? t('shell.theme.toLight') : t('shell.theme.toDark')}
                className={cn(iconBtn, 'hidden xl:grid')}
              >
                {isDark ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
              </button>
            )}

            {isSignedIn ? (
              <div className="relative hidden lg:block" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  aria-label={t('nav.accountMenu')}
                  className={cn('flex h-10 items-center gap-1.5 rounded-full ps-1 pe-2.5', overlay ? 'text-white hover:bg-white/15' : 'hover:bg-dg-action-wash')}
                >
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-dg-action text-sm font-semibold text-dg-action-ink">
                    {initial || <UserRound className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', menuOpen && 'rotate-180')} aria-hidden="true" />
                </button>
                <AnimatePresence>
                  {menuOpen && (
                    <motion.div
                      role="menu"
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      transition={tween.quick}
                      className="absolute end-0 mt-2 w-64 overflow-hidden rounded-dg-lg border border-dg-line bg-dg-surface py-1 text-dg-ink shadow-dg-modal"
                    >
                      <div className="px-4 py-3 border-b border-dg-line">
                        <p className="truncate font-semibold">{name || t('nav.account')}</p>
                        {sessionUser?.email && <p className="truncate text-[0.8125rem] text-dg-ink-3">{sessionUser.email}</p>}
                      </div>
                      <button type="button" role="menuitem" className={menuItem} onClick={() => navigateTo('/my-trip')}>
                        <Luggage className="h-4 w-4 text-dg-action" aria-hidden="true" />
                        {t('nav.myTrip')}
                      </button>
                      <button type="button" role="menuitem" className={menuItem} onClick={() => navigateTo('/bookings')}>
                        <Ticket className="h-4 w-4 text-dg-action" aria-hidden="true" />
                        {t('shell.nav.bookings')}
                      </button>
                      <button type="button" role="menuitem" className={menuItem} onClick={() => navigateTo('/profile')}>
                        <UserRound className="h-4 w-4 text-dg-action" aria-hidden="true" />
                        {t('nav.profileShort')}
                      </button>
                      <button type="button" role="menuitem" className={menuItem} onClick={() => navigateTo('/help')}>
                        <LifeBuoy className="h-4 w-4 text-dg-highlight" aria-hidden="true" />
                        {t('shell.nav.help')}
                      </button>
                      {(canSeeOps || canSeeSupplier) && (
                        <div className="border-t border-dg-line my-1">
                          {canSeeOps && (
                            <button type="button" role="menuitem" className={menuItem} onClick={() => navigateTo('/ops-console')}>
                              <Activity className="h-4 w-4" aria-hidden="true" />
                              {t('nav.opsConsole')}
                            </button>
                          )}
                          {canSeeSupplier && (
                            <button type="button" role="menuitem" className={menuItem} onClick={() => navigateTo('/supplier-portal')}>
                              <Store className="h-4 w-4" aria-hidden="true" />
                              {t('nav.suppliers')}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="border-t border-dg-line mt-1">
                        <button type="button" role="menuitem" className={cn(menuItem, 'text-dg-critical')} onClick={() => void signOut()}>
                          <LogOut className="h-4 w-4" aria-hidden="true" />
                          {t('nav.signOut')}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => navigateTo('/auth/sign-in')}
                className={cn('hidden lg:inline-flex h-10 items-center whitespace-nowrap px-3 rounded-full text-sm font-semibold', overlay ? 'text-white hover:bg-white/15' : 'text-dg-ink hover:bg-dg-action-wash')}
              >
                {t('shell.signIn')}
              </button>
            )}

            <Button
              size="sm"
              variant={overlay ? 'onMedia' : 'primary'}
              className="hidden lg:inline-flex ms-1 shrink-0 whitespace-nowrap"
              onClick={() => navigateTo('/plan')}
            >
              {t('shell.cta.plan')}
            </Button>
          </div>
        </div>
      </header>
      <SiteMenu open={siteMenuOpen} onClose={() => setSiteMenuOpen(false)} />
    </>
  );
};
