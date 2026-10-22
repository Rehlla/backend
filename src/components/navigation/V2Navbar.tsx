import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Compass,
  Luggage,
  Sparkles,
  Activity,
  Search,
  Languages,
  User,
  Menu,
  X,
  ArrowRight,
  ChevronDown,
  Palette,
  Check,
  LogOut,
  Bell,
  Map,
  HelpCircle,
  LayoutGrid,
  UtensilsCrossed,
  Star,
  Ticket,
  Car,
  BedDouble,
  Mountain,
  Bike,
  MapPin,
  Navigation
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { useNavigation } from '../../hooks/useCMSContent';
import { AppRoute } from '../../types';
import { routePrefetchMap } from '../../App';
import { ThemeSelector } from './ThemeSelector';

interface V2NavbarProps {
  onOpenSearch: () => void;
  onOpenQuickBook: () => void;
}

type NavIcon = React.FC<{ className?: string }>;

interface NavChildDef {
  route: AppRoute;
  icon: NavIcon;
  labelEn: string;
  labelAr: string;
}

interface NavGroupDef {
  id: string;
  labelKey: string;
  landing: AppRoute;
  icon: NavIcon;
  children: NavChildDef[];
}

/**
 * Wayfinding groups — the header's information architecture.
 *
 * Four jobs (discover, stay & taste, get around, my trip) instead of eleven
 * flat pills. Every route on the site lives in exactly one group, so the
 * site-map panel reads as a map of the whole product rather than a menu.
 */
const NAV_GROUPS: NavGroupDef[] = [
  {
    id: 'discover',
    labelKey: 'nav.groupDiscover',
    landing: '/home',
    icon: Compass,
    children: [
      { route: '/home', icon: Compass, labelEn: 'Discover', labelAr: 'استكشف' },
      { route: '/explore', icon: Map, labelEn: 'Explore', labelAr: 'استكشف دهب' },
      { route: '/attractions', icon: Mountain, labelEn: 'Things to Do', labelAr: 'أنشطة وفعاليات' },
      { route: '/experiences', icon: Star, labelEn: 'Experiences', labelAr: 'التجارب' },
      { route: '/live', icon: Activity, labelEn: 'Dahab Live', labelAr: 'دهب لايف' },
    ],
  },
  {
    id: 'stay-taste',
    labelKey: 'nav.groupStayTaste',
    landing: '/hotels',
    icon: BedDouble,
    children: [
      { route: '/hotels', icon: BedDouble, labelEn: 'Hotels', labelAr: 'فنادق' },
      { route: '/food', icon: UtensilsCrossed, labelEn: 'Food & Dining', labelAr: 'الأكل والمطاعم' },
      { route: '/restaurants', icon: UtensilsCrossed, labelEn: 'Restaurants', labelAr: 'المطاعم' },
    ],
  },
  {
    id: 'getting-around',
    labelKey: 'nav.groupGettingAround',
    landing: '/transfers/local',
    icon: Car,
    children: [
      { route: '/transfers/local', icon: MapPin, labelEn: 'Rides in Dahab', labelAr: 'مشاوير جوه دهب' },
      { route: '/transfers/intercity', icon: Navigation, labelEn: 'Airport & Intercity', labelAr: 'المطار وبين المدن' },
      { route: '/rentals', icon: Bike, labelEn: 'Bike Rentals', labelAr: 'تأجير العجلات' },
      { route: '/help', icon: HelpCircle, labelEn: 'Help & SOS', labelAr: 'محتاج مساعدة؟' },
    ],
  },
  {
    id: 'my-trip',
    labelKey: 'nav.groupMyTrip',
    landing: '/my-trip',
    icon: Luggage,
    children: [
      { route: '/my-trip', icon: Luggage, labelEn: 'My Trip', labelAr: 'رحلتي' },
      { route: '/plan-for-me', icon: Compass, labelEn: 'Plan It For Me', labelAr: 'خططها لي' },
      { route: '/bookings', icon: Ticket, labelEn: 'Bookings', labelAr: 'حجوزاتي' },
      { route: '/daygi', icon: Sparkles, labelEn: 'AI Concierge', labelAr: 'المرشد الذكي' },
      { route: '/profile', icon: User, labelEn: 'Profile', labelAr: 'حسابي' },
    ],
  },
];

export const V2Navbar: React.FC<V2NavbarProps> = ({ onOpenSearch, onOpenQuickBook }) => {
  const {
    currentRoute,
    navigateTo,
    user,
    sessionUser,
    signOut,
    isSignedIn,
    profile,
    authRole
  } = useTrip();

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAccountMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setIsAccountMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAccountMenuOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isAccountMenuOpen]);

  const signedInName =
    sessionUser?.name || user?.displayName || profile.name || sessionUser?.email || user?.email || '';
  const signedInInitial = signedInName ? signedInName.charAt(0).toUpperCase() : '';

  const canSeeOps = isSignedIn && (authRole === 'Operations' || authRole === 'Admin');
  const canSeeSupplier =
    isSignedIn && (authRole === 'Supplier' || authRole === 'Operations' || authRole === 'Admin');
  const showBackOfficeLinks = canSeeOps || canSeeSupplier;
  const { t, language, toggleLanguage, isRTL } = useLanguage();
  const { theme, isDark, toggleTheme, themeId, setThemeId, availableThemes } = useTheme();

  const headerRef = useRef<HTMLElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Site-map panel: a group id spotlights that column, 'all' shows the map even.
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const headerInnerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        const scrolled = window.scrollY > 20;
        headerRef.current.classList.toggle('pt-2', scrolled);
        headerRef.current.classList.toggle('sm:pt-2.5', scrolled);
        headerRef.current.classList.toggle('pt-2.5', !scrolled);
        headerRef.current.classList.toggle('sm:pt-3.5', !scrolled);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu and site-map panel on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setOpenPanel(null);
  }, [currentRoute]);

  // Site-map panel answers keyboard and pointer-away the way menus must.
  useEffect(() => {
    if (!openPanel) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!headerInnerRef.current?.contains(event.target as Node)) setOpenPanel(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenPanel(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [openPanel]);

  const iconMap: Record<string, React.FC<{ className?: string }>> = {
    Compass, Luggage, Activity, Sparkles, Search, User, Menu, Map, UtensilsCrossed, Star, Ticket, Car, BedDouble, Mountain, HelpCircle, LayoutGrid, Bike,
  };

  const fallbackNavLinks = [
    { route: '/home', labelEn: 'Discover', labelAr: 'استكشف', icon: 'Compass' },
    { route: '/hotels', labelEn: 'Hotels', labelAr: 'فنادق', icon: 'BedDouble' },
    { route: '/attractions', labelEn: 'Things to Do', labelAr: 'أنشطة وفعاليات', icon: 'Mountain' },
    { route: '/explore', labelEn: 'Explore', labelAr: 'استكشف دهب', icon: 'Map' },
    { route: '/transfers/local', labelEn: 'Transfers', labelAr: 'النقل', icon: 'Car' },
    { route: '/rentals', labelEn: 'Bike Rentals', labelAr: 'تأجير العجلات', icon: 'Bike' },
    { route: '/food', labelEn: 'Food & Dining', labelAr: 'الأكل والمطاعم', icon: 'UtensilsCrossed' },
    { route: '/restaurants', labelEn: 'Restaurants', labelAr: 'المطاعم', icon: 'UtensilsCrossed' },
    { route: '/experiences', labelEn: 'Experiences', labelAr: 'التجارب', icon: 'Star' },
    { route: '/bookings', labelEn: 'Bookings', labelAr: 'حجوزاتي', icon: 'Ticket' },
    { route: '/my-trip', labelEn: 'My Trip', labelAr: 'رحلتي', icon: 'Luggage' },
    { route: '/live', labelEn: 'Dahab Live', labelAr: 'دهب لايف', icon: 'Activity' },
  ];

  const { data: cmsNavItems, fromCMS } = useNavigation('header');

  const navLinks = useMemo(() => {
    const items = fromCMS && cmsNavItems && cmsNavItems.length > 0
      ? cmsNavItems.map((item: any) => ({
          route: (item.route || '/home') as AppRoute,
          labelEn: item.label_en,
          labelAr: item.label_ar,
          icon: item.icon || 'Compass',
        }))
      : fallbackNavLinks.map(item => ({ ...item, route: item.route as AppRoute }));

    return items.map(item => ({
      ...item,
      icon: iconMap[item.icon] || Compass,
    }));
  }, [cmsNavItems, fromCMS]);

  /**
   * Groups with CMS labels overlaid: when the CMS publishes a header item for
   * a grouped route, its label wins; CMS-only routes are appended to Discover
   * so the site map never silently drops a published destination.
   */
  const navGroups: NavGroupDef[] = useMemo(() => {
    // globalThis: the lucide `Map` icon shadows the global in this file.
    const cmsByRoute = new globalThis.Map<string, { labelEn: string; labelAr: string; icon: NavIcon }>();
    if (fromCMS && cmsNavItems && cmsNavItems.length > 0) {
      for (const item of cmsNavItems as any[]) {
        if (!item?.route) continue;
        cmsByRoute.set(item.route, {
          labelEn: item.label_en,
          labelAr: item.label_ar,
          icon: iconMap[item.icon] || Compass,
        });
      }
    }
    const known = new globalThis.Set<string>();
    const groups = NAV_GROUPS.map((group) => ({
      ...group,
      children: group.children.map((child) => {
        known.add(child.route);
        const cms = cmsByRoute.get(child.route);
        return cms ? { ...child, ...cms } : child;
      }),
    }));
    const extras = [...cmsByRoute.entries()]
      .filter(([route]) => !known.has(route))
      .map(([route, cms]) => ({ route: route as AppRoute, ...cms }));
    if (extras.length > 0) {
      groups[0] = { ...groups[0], children: [...groups[0].children, ...extras] };
    }
    return groups;
  }, [cmsNavItems, fromCMS]);

  const isNavActive = (route: AppRoute) => {
    if (route === '/home') {
      return currentRoute === '/home' || currentRoute === '/discover' || currentRoute === '/';
    }
    if (route === '/my-trip') {
      return currentRoute.startsWith('/my-trip');
    }
    if (route === '/explore') {
      return currentRoute === '/explore' || currentRoute.startsWith('/experiences') || currentRoute === '/programs';
    }
    if (route === '/attractions') {
      return currentRoute === '/attractions';
    }
    if (route === '/food' || route === '/restaurants') {
      return currentRoute === route || currentRoute === '/food' || currentRoute === '/restaurants';
    }
    if (route === '/hotels') {
      return currentRoute.startsWith('/hotels');
    }
    if (route === '/rentals') {
      return currentRoute.startsWith('/rentals');
    }
    if (route === '/help') {
      return currentRoute === '/help';
    }
    if (route === '/profile') {
      return currentRoute === '/profile';
    }
    if (route === '/daygi') {
      return currentRoute === '/daygi' || currentRoute === '/ai-director';
    }
    if (route === '/plan-for-me') {
      return currentRoute === '/plan-for-me';
    }
    return currentRoute === route;
  };

  const isGroupActive = (group: NavGroupDef) =>
    group.children.some((child) => isNavActive(child.route)) || isNavActive(group.landing);

  // Contextual CTA text
  const ctaLabel = useMemo(() => {
    if (currentRoute === '/home' || currentRoute === '/' || currentRoute === '/discover') {
      return t('nav.planTrip');
    }
    if (currentRoute === '/my-trip') {
      return t('nav.bookNow');
    }
    return t('nav.getStarted');
  }, [currentRoute, language]);

  return (
    <>
      {/* Skip link for WCAG AA Accessibility */}
      <a href="#main-app-content" className="skip-link">
        {t('nav.skipToMainContent')}
      </a>

      {/* ========================================================================= */}
      {/* MAIN HEADER — 3-ZONE GLASSMORPHIC PILL                                   */}
      {/* ========================================================================= */}
      <header
        ref={headerRef}
        role="banner"
        dir={isRTL ? 'rtl' : 'ltr'}
        className="fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 pointer-events-none pt-2.5 sm:pt-3.5"
      >
        <div
          ref={headerInnerRef}
          onMouseLeave={() => setOpenPanel(null)}
          className="max-w-7xl min-[1500px]:max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 relative"
        >
          <nav
            aria-label="DAHAB TRAVEL OS Header"
            style={{
              backgroundColor: 'var(--header-bg)',
              borderColor: 'var(--header-border)',
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)'
            }}
            className="pointer-events-auto mx-auto rounded-full transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-300 flex items-center justify-between border px-3 sm:px-5 py-2 sm:py-2.5 shadow-lg text-[var(--text-primary)]"
          >
            {/* =================================================================== */}
            {/* ZONE 1: BRAND                                                       */}
            {/* =================================================================== */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <button
                type="button"
                id="brand-logo-btn"
                onClick={() => navigateTo('/home')}
                aria-label="DAHAB TRAVEL OS"
                className="flex items-center gap-2.5 group cursor-pointer text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded-full select-none"
              >
                {/* Animated chart gradient icon */}
                <div className="relative w-8 h-8 rounded-full flex items-center justify-center overflow-hidden shadow-md group-hover:shadow-lg transition-shadow duration-300">
                  <div
                    className="absolute inset-0 animate-[chartShift_8s_ease-in-out_infinite]"
                    style={{
                      background: 'linear-gradient(135deg, #1C1917 0%, #2A2622 50%, var(--accent-secondary) 100%)',
                      backgroundSize: '200% 200%'
                    }}
                  />
                  <span className="relative z-10 font-black text-xs text-[var(--text-on-media)] leading-none tracking-tighter">
                    D
                  </span>
                </div>

                {/* Text mark */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5 leading-none">
                    <span className="font-black text-sm text-[var(--text-primary)]">
                      DAHAB
                    </span>
                    {/* 10px bold needs 4.5:1; raw `--accent-primary` on this
                        chip measured 4.18:1 (lagoon-breeze) / 4.28:1
                        (editorial-sand). `--text-accent` is the theme's own
                        accent pulled toward its canvas ink, but on a chip this
                        small it measured 4.21:1 (lagoon-breeze) at the real
                        1514px desktop width — the earlier 5.2:1 was read at
                        938px. Small accent copy takes the strong variant: same
                        hue, contrast moved the safe way in every theme. */}
                    <span className="hidden sm:inline text-[10px] font-bold font-['SF_Arabic',monospace] px-1.5 py-0.5 rounded-md bg-[var(--surface-container)] text-[var(--text-accent-strong)] border border-[var(--border-subtle)]">
                      TRAVEL OS
                    </span>
                  </div>
                </div>
              </button>
            </div>

            {/* =================================================================== */}
            {/* ZONE 2: WAYFINDING GROUPS + SITE MAP                              */}
            {/* Four jobs instead of eleven pills; hover or focus opens the map   */}
            {/* below, click lands on the group's home.                           */}
            {/* =================================================================== */}
            <div className="hidden lg:flex items-center gap-1 p-1 rounded-full border relative bg-[var(--header-pill-bg)] border-[var(--header-pill-border)] shadow-inner min-w-0 flex-1 justify-center overflow-x-auto no-scrollbar">
              {navGroups.map((group) => {
                const active = isGroupActive(group);
                const GroupIcon = group.icon;
                const open = openPanel === group.id || openPanel === 'all';

                return (
                  <button
                    key={group.id}
                    id={`nav-group-${group.id}`}
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={open}
                    onMouseEnter={() => setOpenPanel(group.id)}
                    onFocus={() => setOpenPanel(group.id)}
                    onClick={() => {
                      setOpenPanel(null);
                      navigateTo(group.landing);
                    }}
                    aria-current={active ? 'page' : undefined}
                    className={`relative px-3 xl:px-4 py-1.5 rounded-full text-xs font-semibold transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer flex items-center gap-1.5 z-10 whitespace-nowrap ${
                      active
                        ? 'text-[var(--text-primary)] font-bold'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)]'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="activeNavPill"
                        className="absolute inset-0 rounded-full shadow-sm z-[-1] bg-[var(--surface-card)] border border-[var(--accent-primary)]/40 shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
                        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      />
                    )}
                    <GroupIcon
                      className={`w-3.5 h-3.5 transition-colors ${
                        active
                          ? 'text-[var(--accent-secondary)]'
                          : 'text-[var(--accent-primary)]'
                      }`}
                    />
                    <span>{t(group.labelKey)}</span>
                    <ChevronDown
                      className={`w-3 h-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}

              <div className="w-px h-4 bg-[var(--border-subtle)] mx-1" aria-hidden="true" />

              <button
                type="button"
                id="nav-site-map-btn"
                aria-haspopup="true"
                aria-expanded={openPanel === 'all'}
                onMouseEnter={() => setOpenPanel('all')}
                onFocus={() => setOpenPanel('all')}
                onClick={() => setOpenPanel('all')}
                title={t('nav.siteMap')}
                aria-label={t('nav.siteMap')}
                className={`relative p-2 rounded-full transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer flex items-center z-10 ${
                  openPanel === 'all'
                    ? 'text-[var(--text-primary)] bg-[var(--surface-card)] border border-[var(--accent-primary)]/40'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* =================================================================== */}
            {/* ZONE 3: UTILITIES & CTA                                            */}
            {/* =================================================================== */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Theme selector (desktop) */}
              <div className="hidden sm:block">
                <ThemeSelector />
              </div>

              {/* Search */}
              <button
                type="button"
                id="header-search-btn"
                onClick={onOpenSearch}
                aria-label={t('nav.search') || 'Search'}
                title="Search destinations & experiences (⌘K)"
                className="w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border shadow-xs bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--btn-util-text)] border-[var(--border-subtle)]"
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              {/* Language toggle */}
              <button
                type="button"
                id="header-language-btn"
                onClick={toggleLanguage}
                aria-label={`Switch to ${language === 'en' ? 'Arabic' : 'English'}`}
                className="hidden sm:flex h-8 px-2.5 rounded-full items-center gap-1 text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border shadow-xs bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--btn-util-text)] border-[var(--border-subtle)]"
              >
                <Languages className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                <span className="text-[12px] hidden min-[1500px]:inline">{language === 'en' ? 'العربية' : 'EN'}</span>
              </button>

              {/* Notifications bell (signed in only) */}
              {isSignedIn && (
                <button
                  type="button"
                  id="header-notifications-btn"
                  onClick={() => navigateTo('/help')}
                  aria-label={t('nav.notifications')}
                   className="hidden min-[1500px]:flex w-8 h-8 rounded-full items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border shadow-xs bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--btn-util-text)] border-[var(--border-subtle)] relative"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--accent-secondary)] animate-pulse" />
                </button>
              )}

              {/* Sign In / Account */}
              {isSignedIn ? (
                <div className="relative" ref={accountMenuRef}>
                  <button
                    type="button"
                    id="header-profile-btn"
                    onClick={() => setIsAccountMenuOpen(open => !open)}
                    aria-haspopup="menu"
                    aria-expanded={isAccountMenuOpen}
                    title={`Signed in as ${signedInName || 'Traveler'}`}
                    className="h-8 pl-1 pr-2.5 rounded-full flex items-center gap-1.5 transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border shadow-xs bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] border-[var(--border-subtle)] text-[var(--text-primary)]"
                  >
                    {/* Avatar circle. Ink is `--accent-primary-ink`, the same
                        "foreground for anything sitting ON the accents" the
                        filled CTAs and the selected intent pill use: white on
                        this gradient measured 2.56:1 on the dark themes
                        (brass) and 1.31:1 on high-contrast-pro (cyan->yellow),
                        against 4.5:1 needed at 10px bold. The pair passes in
                        every theme because the theme owns both sides of it. */}
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] flex items-center justify-center text-[10px] font-bold text-[var(--accent-primary-ink)]">
                      {signedInInitial || <User className="w-3 h-3" />}
                    </div>
                    <span className="max-w-[70px] truncate text-[12px] font-bold hidden sm:inline">
                      {signedInName.split(' ')[0] || (t('nav.account'))}
                    </span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform hidden sm:block ${isAccountMenuOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>

                  <AnimatePresence>
                    {isAccountMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        role="menu"
                        aria-label={t('nav.accountMenu')}
                        className="absolute end-0 mt-2 w-64 rounded-2xl border shadow-2xl overflow-hidden z-50 bg-[var(--surface-card)] border-[var(--border-subtle)]"
                      >
                        {/* Profile header */}
                        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                          <div className="flex items-center gap-3">
                            {/* Same gradient, same problem as the bar avatar
                                above — same fix. */}
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent-secondary)] to-[var(--accent-primary)] flex items-center justify-center text-sm font-bold text-[var(--accent-primary-ink)] shadow-md">
                              {signedInInitial || <User className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="block text-sm font-bold truncate text-[var(--text-primary)]">
                                {signedInName || (t('nav.account'))}
                              </span>
                              {sessionUser?.email && (
                                <span className="block text-[11px] truncate text-[var(--text-secondary)]">
                                  {sessionUser.email}
                                </span>
                              )}
                              <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                                {authRole || 'Traveler'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Menu items */}
                        <div className="py-1">
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              navigateTo('/my-trip');
                            }}
                            className="w-full text-start px-4 min-h-[44px] text-xs font-semibold hover:bg-black/5 dark:hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer flex items-center gap-2.5"
                           
                          >
                            <Luggage className="w-4 h-4 text-[var(--accent-primary)]" aria-hidden="true" />
                            <span>{t('nav.myTrip')}</span>
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              navigateTo('/profile');
                            }}
                            className="w-full text-start px-4 min-h-[44px] text-xs font-semibold hover:bg-black/5 dark:hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer flex items-center gap-2.5"
                           
                          >
                            <User className="w-4 h-4" aria-hidden="true" />
                            <span>{t('nav.profileShort')}</span>
                          </button>

                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              navigateTo('/help');
                            }}
                            className="w-full text-start px-4 min-h-[44px] text-xs font-semibold hover:bg-black/5 dark:hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer flex items-center gap-2.5"
                           
                          >
                            <HelpCircle className="w-4 h-4" aria-hidden="true" />
                            <span>{t('nav.helpSupport')}</span>
                          </button>

                          {showBackOfficeLinks && (
                            <div className="border-t my-1 border-[var(--border-subtle)]">
                              {canSeeOps && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setIsAccountMenuOpen(false);
                                    navigateTo('/ops-console');
                                  }}
                                  className="w-full text-start px-4 min-h-[44px] text-xs font-semibold hover:bg-black/5 dark:hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer flex items-center gap-2.5"
                                 
                                >
                                  <Activity className="w-4 h-4 text-[var(--accent-secondary)]" aria-hidden="true" />
                                  <span>{t('nav.opsConsole')}</span>
                                </button>
                              )}
                              {canSeeSupplier && (
                                <button
                                  type="button"
                                  role="menuitem"
                                  onClick={() => {
                                    setIsAccountMenuOpen(false);
                                    navigateTo('/supplier-portal');
                                  }}
                                  className="w-full text-start px-4 min-h-[44px] text-xs font-semibold hover:bg-black/5 dark:hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer flex items-center gap-2.5"
                                 
                                >
                                  <Map className="w-4 h-4 text-[var(--accent-secondary)]" aria-hidden="true" />
                                  <span>{t('nav.suppliers')}</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Sign out */}
                        <div className="border-t px-4 py-2 border-[var(--border-subtle)]">
                          <button
                            type="button"
                            role="menuitem"
                            id="header-signout-btn"
                            onClick={() => {
                              setIsAccountMenuOpen(false);
                              void signOut();
                            }}
                            className="w-full min-h-[40px] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-[var(--accent-danger, #C0553C)]/10 text-[var(--accent-danger,#C0553C)]"
                          >
                            <LogOut className="w-4 h-4" aria-hidden="true" />
                            <span>{t('nav.signOut')}</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  type="button"
                  id="header-signin-btn"
                  onClick={() => navigateTo('/auth/sign-in')}
                  title={t('nav.signIn')}
                  className="hidden sm:flex h-8 px-2.5 rounded-full items-center gap-1.5 text-xs font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer border shadow-xs bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] border-[var(--border-subtle)] text-[var(--btn-util-text)]"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="text-[12px]">{t('nav.signIn-2')}</span>
                </button>
              )}

              {/* Primary CTA */}
              <button
                type="button"
                id="header-book-now-cta"
                onClick={onOpenQuickBook}
                className="h-11 sm:h-8 px-3 xl:px-4 rounded-full font-bold text-xs transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 shadow-md cursor-pointer flex items-center gap-1.5 active:scale-95 bg-gradient-to-r from-[var(--btn-book-bg)] to-[var(--accent-secondary)] hover:shadow-lg text-[var(--btn-book-text)] border border-[var(--border-subtle)] flex-shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 hidden sm:block flex-shrink-0" />
                <span className="whitespace-nowrap">{ctaLabel}</span>
              </button>

              {/* Mobile menu toggle */}
              <button
                type="button"
                id="header-mobile-menu-btn"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-expanded={isMobileMenuOpen}
                aria-label={t(isMobileMenuOpen ? 'a11y.closeMobileMenu' : 'a11y.openMobileMenu')}
                className="lg:hidden w-11 h-11 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-200 cursor-pointer border bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--btn-util-text)] border-[var(--border-subtle)]"
              >
                <motion.div
                  animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
                </motion.div>
              </button>
            </div>
          </nav>

          {/* ============================================================= */}
          {/* SITE MAP — the whole product at a glance, grouped by job.     */}
          {/* Hovering a group spotlights its column; the grid button shows */}
          {/* the map even. One user-triggered motion only.                 */}
          {/* ============================================================= */}
          <AnimatePresence>
            {openPanel && (
              <motion.nav
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                aria-label={t('nav.siteMap')}
                dir={isRTL ? 'rtl' : 'ltr'}
                style={{
                  backgroundColor: 'var(--header-bg)',
                  borderColor: 'var(--header-border)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)'
                }}
                className="pointer-events-auto absolute top-full inset-x-3 sm:inset-x-6 lg:inset-x-8 mt-2 rounded-3xl border shadow-2xl overflow-hidden hidden lg:block text-[var(--text-primary)]"
              >
                <p className="px-6 pt-4 text-xs text-[var(--text-secondary)]">
                  {t('nav.siteMapIntro')}
                </p>
                <div className="grid grid-cols-4 gap-2 p-4">
                  {navGroups.map((group) => {
                    const GroupIcon = group.icon;
                    const dimmed = openPanel !== 'all' && openPanel !== group.id;
                    return (
                      <div
                        key={group.id}
                        className={`rounded-2xl p-2 transition-opacity ${dimmed ? 'opacity-50' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setOpenPanel(null);
                            navigateTo(group.landing);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer hover:bg-[var(--btn-util-bg)] text-[var(--text-primary)]"
                        >
                          <GroupIcon className="w-4 h-4 text-[var(--accent-secondary)]" aria-hidden="true" />
                          <span>{t(group.labelKey)}</span>
                        </button>
                        <div className="mt-1 space-y-0.5 border-t border-[var(--border-subtle)] pt-1.5">
                          {group.children.map((child) => {
                            const ChildIcon = child.icon;
                            const childActive = isNavActive(child.route);
                            const childLabel = language === 'ar' ? child.labelAr : child.labelEn;
                            return (
                              <button
                                key={child.route}
                                id={`nav-link-${child.route.replace('/', '')}`}
                                type="button"
                                onClick={() => {
                                  setOpenPanel(null);
                                  navigateTo(child.route);
                                }}
                                onMouseEnter={() => routePrefetchMap[child.route]?.()}
                                onFocus={() => routePrefetchMap[child.route]?.()}
                                aria-current={childActive ? 'page' : undefined}
                                className={`w-full flex items-center gap-2.5 px-3 min-h-[40px] rounded-xl text-xs font-semibold transition-colors cursor-pointer text-start ${
                                  childActive
                                    ? 'bg-[var(--header-pill-active)] text-[var(--header-pill-active-text)] font-bold'
                                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)]'
                                }`}
                              >
                                <ChildIcon
                                  className={`w-3.5 h-3.5 flex-shrink-0 ${childActive ? '' : 'text-[var(--accent-primary)]'}`}
                                  aria-hidden="true"
                                />
                                <span>{childLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {showBackOfficeLinks && (
                  <div
                    className="mx-4 mb-4 rounded-2xl border border-[var(--border-subtle)] px-4 py-2.5 flex flex-wrap items-center gap-2"
                  >
                    {canSeeOps && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenPanel(null);
                          navigateTo('/ops-console');
                        }}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--accent-primary)] border-[var(--border-subtle)]"
                      >
                        {t('nav.opsConsole')}
                      </button>
                    )}
                    {canSeeSupplier && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenPanel(null);
                          navigateTo('/supplier-portal');
                        }}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--accent-secondary)] border-[var(--border-subtle)]"
                      >
                        {t('nav.suppliers')}
                      </button>
                    )}
                    {canSeeOps && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenPanel(null);
                          navigateTo('/market-intelligence');
                        }}
                        className="px-3 py-1.5 rounded-full text-[11px] font-bold cursor-pointer border bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30"
                      >
                        {t('nav.intel')}
                      </button>
                    )}
                  </div>
                )}
              </motion.nav>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Dropdown Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.97 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="pointer-events-auto lg:hidden max-w-7xl mx-auto px-3 pt-2"
              dir={isRTL ? 'rtl' : 'ltr'}
            >
              <div
                style={{
                  backgroundColor: 'var(--header-bg)',
                  borderColor: 'var(--header-border)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)'
                }}
                className="rounded-3xl p-4 border shadow-2xl text-[var(--text-primary)]"
              >
                {/* Nav links, grouped by job so the menu reads as a site map */}
                <div className="space-y-3">
                  {navGroups.map((group) => {
                    const GroupIcon = group.icon;
                    return (
                      <div key={group.id}>
                        <p className="flex items-center gap-1.5 px-1 pb-1.5 text-[11px] font-bold text-[var(--text-secondary)]">
                          <GroupIcon className="w-3.5 h-3.5 text-[var(--accent-secondary)]" aria-hidden="true" />
                          {t(group.labelKey)}
                        </p>
                        <div className="space-y-1">
                          {group.children.map((item) => {
                            const active = isNavActive(item.route);
                            const Icon = item.icon;
                            const label = language === 'ar' ? item.labelAr : item.labelEn;

                            return (
                              <button
                                key={item.route}
                                id={`mobile-nav-link-${item.route.replace('/', '')}`}
                                type="button"
                                onClick={() => {
                                  navigateTo(item.route);
                                  setIsMobileMenuOpen(false);
                                }}
                                onMouseEnter={() => routePrefetchMap[item.route]?.()}
                                onFocus={() => routePrefetchMap[item.route]?.()}
                                aria-current={active ? 'page' : undefined}
                                className={`w-full p-3.5 rounded-2xl text-sm font-semibold transition-[background-color,border-color,color,box-shadow,transform,opacity] flex items-center justify-between cursor-pointer ${
                                  active
                                    ? 'bg-[var(--header-pill-active)] text-[var(--header-pill-active-text)] font-bold border border-[var(--accent-primary)]/40 shadow-md'
                                    : 'hover:bg-[var(--btn-util-hover)] text-[var(--text-secondary)] border border-transparent'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                                    active
                                      ? 'bg-[var(--accent-secondary)]/20'
                                      : 'bg-[var(--surface-container)]'
                                  }`}>
                                    <Icon className={`w-4 h-4 ${active ? 'text-[var(--accent-secondary)]' : 'text-[var(--accent-primary)]'}`} />
                                  </div>
                                  <span>{label}</span>
                                </div>
                                <ArrowRight className="w-4 h-4 rtl:rotate-180 opacity-50" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick actions row */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSearch();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex-1 p-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer border bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>{t('nav.searchShort')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={toggleLanguage}
                    className="flex-1 p-2.5 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 cursor-pointer border bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--text-secondary)] border-[var(--border-subtle)]"
                  >
                    <Languages className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    <span>{language === 'en' ? 'العربية' : 'EN'}</span>
                  </button>
                </div>

                {/* Theme selector */}
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="flex items-center justify-between text-[12px] font-bold px-1 mb-2 text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5" />
                      {t('nav.theme-2')}
                    </span>
                    <span className="text-[11px] font-mono opacity-80">
                      {language === 'ar' ? availableThemes.find((t) => t.id === themeId)?.nameAr : availableThemes.find((t) => t.id === themeId)?.nameEn}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {availableThemes.map((opt) => {
                      const isSelected = opt.id === themeId;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setThemeId(opt.id)}
                          className={`p-2 rounded-xl text-[11px] font-bold text-center flex flex-col items-center gap-1.5 border transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--header-pill-active)] border-[var(--accent-primary)] text-[var(--header-pill-active-text)] shadow-md'
                              : 'bg-[var(--btn-util-bg)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <div
                            className="w-5 h-5 rounded-full border-2 border-white/30 shadow-inner"
                            style={{ backgroundColor: opt.swatches.accent }}
                          />
                          <span className="truncate w-full">{language === 'ar' ? opt.nameAr : opt.nameEn}</span>
                          {isSelected && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Back-office links */}
                {showBackOfficeLinks && (
                  <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5 border-[var(--border-subtle)]">
                    {canSeeOps && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateTo('/ops-console');
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex-1 min-w-[6rem] p-2 rounded-xl text-[12px] font-bold text-center cursor-pointer border bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--accent-primary)] border-[var(--border-subtle)]"
                      >
                        {t('nav.opsConsole')}
                      </button>
                    )}
                    {canSeeSupplier && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateTo('/supplier-portal');
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex-1 min-w-[6rem] p-2 rounded-xl text-[12px] font-bold text-center cursor-pointer border bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-hover)] text-[var(--accent-secondary)] border-[var(--border-subtle)]"
                      >
                        {t('nav.suppliers')}
                      </button>
                    )}
                    {canSeeOps && (
                      <button
                        type="button"
                        onClick={() => {
                          navigateTo('/market-intelligence');
                          setIsMobileMenuOpen(false);
                        }}
                        className="flex-1 min-w-[6rem] p-2 rounded-xl text-[12px] font-bold text-center cursor-pointer border bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]/30"
                      >
                        {t('nav.intel')}
                      </button>
                    )}
                  </div>
                )}

                {/* CTA */}
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenQuickBook();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full py-3.5 rounded-2xl font-black text-sm text-center cursor-pointer shadow-lg transition-[background-color,border-color,color,box-shadow,transform,opacity] active:scale-98 bg-gradient-to-r from-[var(--btn-book-bg)] to-[var(--accent-secondary)] hover:shadow-xl text-[var(--btn-book-text)] flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{ctaLabel}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ========================================================================= */}
      {/* MOBILE BOTTOM DOCK                                                       */}
      {/* ========================================================================= */}
      <nav
        aria-label="Mobile Navigation Dock"
        dir={isRTL ? 'rtl' : 'ltr'}
        style={{
          backgroundColor: 'var(--header-bg)',
          borderColor: 'var(--header-border)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)'
        }}
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t px-2 py-1.5 flex items-center justify-around shadow-2xl text-[var(--text-primary)]"
      >
    {/* Mobile dock nav — a curated subset so the bottom bar stays comfortable on narrow screens */}
        {navLinks
          .filter(item => ['/home', '/hotels', '/explore', '/food', '/my-trip'].includes(item.route))
          .map((item) => {
          const active = isNavActive(item.route);
          const Icon = item.icon;
          const label = language === 'ar' ? item.labelAr : item.labelEn;

          return (
            <button
              key={item.route}
              type="button"
              onClick={() => navigateTo(item.route)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 px-2.5 min-h-[48px] rounded-xl transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer relative ${
                active
                  ? 'text-[var(--accent-secondary)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {active && (
                <motion.div
                  layoutId="activeDockIndicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-1 rounded-full bg-[var(--accent-secondary)]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : 'opacity-60'}`} />
              <span className="text-[10px] font-bold leading-none">{label}</span>
            </button>
          );
        })}

        {/* Search intentionally lives in the header (always visible on mobile),
            keeping the dock at the 5-item comfort limit (P5 gate). */}
      </nav>
    </>
  );
};
