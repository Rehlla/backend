import React, { useEffect, useState } from 'react';
import { useTrip } from '../context';
import { useDestination } from '../context/DestinationContext';
import { DESTINATIONS, isDestinationId, type DestinationId } from '../design/destinations';
import { useCityHotels } from '../hooks/useCityPlaces';
import { fetchCityHotels } from '../services/cityService';
import { DestinationScene } from '../components/brand/DestinationScene';

const PAGE_SIZE = 12;

interface HotelItem {
  id?: string | number;
  name?: string | null;
  nameAr?: string | null;
  lat?: number | null;
  lng?: number | null;
  tourism?: string | null;
}

/**
 * /hotels — the stay listing for one destination.
 *
 * The city on screen is the URL's `?city=` when it names a destination, else
 * DestinationContext — the same source the header picker drives. A URL city
 * is also written into the context, so the URL, the header pill and the
 * fetched data can never name two different places. (An earlier version hard-coded
 * 'hurghada' as its default and synthesised extra cards out of the count,
 * which showed one city in the header and another on screen.)
 */
export const HotelsPage: React.FC = () => {
  const { currentParams } = useTrip();
  const { destinationId, setDestination } = useDestination();
  // A valid `?city=` wins for this render, so the title, count and cards follow
  // the address bar even before the context catches up; the effect below then
  // brings the header pill (the context) onto the same city.
  const candidate = String(currentParams?.city || '').trim().toLowerCase();
  const urlCity: DestinationId | null = isDestinationId(candidate) ? candidate : null;
  const city: DestinationId = urlCity ?? destinationId;
  const destination = DESTINATIONS[city];

  useEffect(() => {
    if (urlCity && urlCity !== destinationId) setDestination(urlCity, { instant: true });
  }, [urlCity, destinationId, setDestination]);

  const { data: hotelsData, status } = useCityHotels(city);

  // Load-more state, reset whenever the destination changes.
  const [items, setItems] = useState<HotelItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  useEffect(() => {
    setItems(null);
    setPage(1);
    setLoadingMore(false);
    setMoreError(false);
  }, [city]);

  const data = hotelsData as { count?: number; total?: number; items?: HotelItem[]; first?: HotelItem; page?: number; pages?: number } | null;
  const total = data?.count ?? data?.total ?? 0;
  const baseItems = data?.items ?? [];
  const shown = items ?? baseItems;
  const pages = data?.pages ?? 0;

  const loadMore = async () => {
    if (loadingMore || shown.length >= total) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const next = (await fetchCityHotels(city, PAGE_SIZE, page + 1)) as { items?: HotelItem[] };
      setItems([...shown, ...(next.items || [])]);
      setPage(page + 1);
    } catch {
      // The already-loaded real hotels stay on screen; state the failure instead of hiding it.
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B151C] to-[#13232A] text-white">
      <DestinationScene id={city} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="mb-2 text-3xl font-extrabold md:text-5xl">{destination.name.ar}</h1>
        <p className="mb-6 text-[var(--text-secondary)]">
          فنادق حقيقية من البيانات المفتوحة — <span className="font-bold text-[var(--accent-primary)]">{total}</span> مكان مفلتر tourism=hotel
        </p>

        {status === 'loading' ? (
          <p className="text-white/70">جارٍ التحميل...</p>
        ) : status === 'error' ? (
          <p className="rounded-xl border border-white/10 bg-[#1A1625] p-5 text-white/80">تعذر تحميل الفنادق — جرّب تاني.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {shown.map((h, i) => (
              <article
                key={(h.id ?? '') + '-' + i}
                className="rounded-xl border border-white/10 bg-[#1A1625] p-4 shadow-sm transition-colors hover:border-[var(--accent-primary)]"
              >
                <h4 className="mb-1 min-h-[2.5rem] font-bold leading-snug">{h.name || h.nameAr || '—'}</h4>
                {h.tourism && (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[0.7rem] text-white/70">{h.tourism}</span>
                )}
                <p className="mt-2 text-[0.7rem] text-white/40">
                  {h.lat != null && h.lng != null ? `${h.lat.toFixed(3)}°, ${h.lng.toFixed(3)}°` : ''}
                </p>
              </article>
            ))}
          </div>
        )}

        {total === 0 && status === 'ready' && (
          <p className="text-white/70">لا توجد فنادق مفهرسة بعد لهذه الوجهة.</p>
        )}

        {shown.length < total && status === 'ready' && (
          <div className="mt-6 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="rounded-full bg-[var(--accent-primary)] px-6 py-2.5 text-sm font-bold text-[#0B151C] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loadingMore ? 'جارٍ التحميل...' : `حمّل المزيد (${shown.length} من ${total})`}
            </button>
            {moreError && <p className="text-xs text-white/60">فشل تحميل الصفحة التالية — جرّب تاني.</p>}
            <p className="text-xs text-white/40">صفحة {data?.page ?? page} من {pages}</p>
          </div>
        )}
      </main>
    </div>
  );
};
