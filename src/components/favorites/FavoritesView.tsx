import React, { useCallback, useMemo, useState } from 'react';
import { Heart } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';

type Tab = 'hotels' | 'restaurants' | 'experiences';

interface Resolved {
  id: string;
  kind: Tab;
  title: string;
  subtitle?: string;
  image?: string;
  priceEGP?: number;
  href: string;
}

/**
 * Loads all three catalogues that back the heart button, so a saved id can be
 * resolved to something the traveller can actually click. The heart predates
 * this page, so saves exist for guests with no list to land in.
 */
const fetchSaved = async (signal: AbortSignal, language: 'en' | 'ar'): Promise<Resolved[]> => {
  const [stays, venues, activities] = await Promise.all([
    api.getAccommodations({ view: 'card' }, signal).catch(() => null),
    api.getDiningVenues(signal).catch(() => null),
    api.getDahabActivities(signal).catch(() => null),
  ]);

  const out: Resolved[] = [];
  for (const s of stays?.accommodations ?? []) {
    out.push({
      id: s.id,
      kind: 'hotels',
      title: language === 'ar' ? s.nameAr || s.name : s.name,
      subtitle: language === 'ar' ? s.areaNameAr || s.areaName : s.areaName,
      image: s.coverImageUrl ?? s.galleryImageUrls?.[0],
      priceEGP: s.perNightEGP,
      href: `/hotels/${s.slug}`,
    });
  }
  for (const v of venues?.venues ?? []) {
    out.push({
      id: v.id,
      kind: 'restaurants',
      title: language === 'ar' ? v.nameAr || v.nameEn : v.nameEn,
      subtitle: v.cuisine?.[0],
      image: v.coverImageUrl,
      priceEGP: v.averageMealPriceEGP ?? v.cheapestDishEGP ?? undefined,
      href: `/restaurants/${v.slug ?? v.id}`,
    });
  }
  for (const a of activities?.activities ?? []) {
    out.push({
      id: a.id,
      kind: 'experiences',
      title: language === 'ar' ? a.titleAr || a.titleEn : a.titleEn,
      subtitle: a.durationMinutes ? `${Math.round(a.durationMinutes / 60)}h` : undefined,
      priceEGP: a.basePriceEGP,
      href: `/experiences/${a.id}`,
    });
  }
  return out;
};

export const FavoritesView: React.FC = () => {
  const { savedItems, toggleSaveItem, navigateTo } = useTrip();
  const { t, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('hotels');

  const catalogue = useApiResource<Resolved[]>(
    useCallback((signal: AbortSignal) => fetchSaved(signal, language === 'ar' ? 'ar' : 'en'), [language]),
    { cacheKey: 'favorites:catalogue', ttlMs: 300_000 }
  );

  const saved = useMemo(() => {
    const ids = new Set(savedItems);
    return (catalogue.data ?? []).filter(item => ids.has(item.id));
  }, [catalogue.data, savedItems]);

  const perTab = useMemo(
    () => ({
      hotels: saved.filter(s => s.kind === 'hotels'),
      restaurants: saved.filter(s => s.kind === 'restaurants'),
      experiences: saved.filter(s => s.kind === 'experiences'),
    }),
    [saved]
  );

  const total = useMemo(
    () => perTab.hotels.length + perTab.restaurants.length + perTab.experiences.length,
    [perTab]
  );

  const visible = perTab[tab];

  return (
    <main className="mx-auto w-full max-w-[var(--dg-content-max)] px-[var(--dg-gutter)] py-10">
      <h1 className="font-dg-display text-[1.75rem] font-semibold text-dg-ink">
        {t('favorites.title', 'المحفوظات')}
      </h1>

      <div role="tablist" aria-label={t('favorites.title', 'المحفوظات')} className="mt-6 flex gap-2">
        {(['hotels', 'restaurants', 'experiences'] as Tab[]).map(k => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`h-11 rounded-full px-4 text-sm font-semibold transition-colors ${
              tab === k
                ? 'bg-[var(--accent-primary)] text-[var(--dg-on-accent)]'
                : 'bg-[var(--surface-card)] border border-[var(--border-subtle)] text-[var(--text-primary)]'
            }`}
          >
            {t(
              k === 'hotels'
                ? 'favorites.tab.hotels'
                : k === 'restaurants'
                ? 'favorites.tab.restaurants'
                : 'favorites.tab.experiences'
            )}
            <span className="ms-1.5 tabular-nums">{perTab[k].length}</span>
          </button>
        ))}
      </div>

      {total === 0 && catalogue.status !== 'loading' ? (
        <div className="mt-10 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-16 text-center">
          <Heart className="mx-auto mb-4 h-12 w-12 text-[var(--text-secondary)]" aria-hidden="true" />
          <p className="text-base font-semibold text-[var(--text-primary)]">
            {t('favorites.empty.title', 'لسه ما حفظتش حاجة')}
          </p>
          <p className="mx-auto mt-2 max-w-[42ch] text-sm text-[var(--text-secondary)]">
            {t('favorites.empty.body', 'دوس على القلب في أي فندق أو مطعم عشان يتحفظ هنا.')}
          </p>
          <button
            type="button"
            onClick={() => navigateTo('/')}
            className="mt-6 h-11 rounded-full bg-[var(--accent-primary)] px-6 text-sm font-semibold text-[var(--dg-on-accent)] transition-colors hover:opacity-90"
          >
            {t('favorites.empty.cta', 'اكتشف دهب')}
          </button>
        </div>
      ) : visible.length === 0 ? (
        <p className="mt-10 text-sm text-[var(--text-secondary)]">
          {t('favorites.empty.title', 'لسه ما حفظتش حاجة')}
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map(item => (
            <li key={item.id}>
              <a
                href={item.href}
                onClick={e => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  navigateTo(tab === 'hotels' ? '/hotels' : tab === 'restaurants' ? '/restaurants' : '/experiences',
                    tab === 'hotels' ? { hotelSlug: item.id } : tab === 'restaurants' ? { venueSlug: item.id } : { experienceSlug: item.id });
                }}
                className="group flex h-full gap-3 rounded-dg-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 transition-colors hover:border-[var(--accent-primary)]"
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.title}
                    loading="lazy"
                    className="h-20 w-20 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-md bg-[var(--surface-container)] text-xs text-[var(--text-secondary)]">
                    {item.title}
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold text-dg-ink">{item.title}</span>
                  {item.subtitle && (
                    <span className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">{item.subtitle}</span>
                  )}
                  {typeof item.priceEGP === 'number' && (
                    <span dir="ltr" className="mt-1 text-sm font-semibold tabular-nums text-[var(--text-primary)]">
                      {language === 'ar'
                        ? `${item.priceEGP.toLocaleString('en-US')} ج.م`
                        : `EGP ${item.priceEGP.toLocaleString('en-US')}`}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  aria-label={t('dining.removeItem', 'شيل من المحفوظات')}
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSaveItem(item.id);
                  }}
                  className="self-start p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
                </button>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
};