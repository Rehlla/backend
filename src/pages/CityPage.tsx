import React from 'react';
import { useTrip } from '../context';
import { DESTINATIONS, SUB_DESTINATIONS, ALL_DESTINATION_IDS } from '../design/destinations';
import { useCityPlaces, useCityMeta, useCityHotels, useCityFood } from '../hooks/useCityPlaces';
import { useSubDestinations } from '../hooks/useSubDestinations';
import { DestinationScene } from '../components/brand/DestinationScene';

export const CityPage: React.FC = () => {
  // The slug arrives as a route param (routeFromUrl resolves /cities/:slug),
  // not by re-matching currentRoute — currentRoute here is just '/cities'.
  const { currentParams, navigateTo } = useTrip();
  const slug = (currentParams?.citySlug || 'dahab').toLowerCase() as typeof ALL_DESTINATION_IDS[number];
  const meta = DESTINATIONS[slug] || DESTINATIONS.dahab;
  const { data: placesData, status: placesStatus } = useCityPlaces(slug);
  const { data: metaData } = useCityMeta(slug);
  const { data: hotelsData } = useCityHotels(slug);
  const { data: foodData } = useCityFood(slug);
  const subIds = meta.subDestinations || [];
  return (
    <div className="min-h-screen flex flex-col">
      <DestinationScene id={slug as any} />
      <main className="max-w-5xl mx-auto px-6 py-10 flex-1">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{meta.name.ar}</h1>
        <p className="text-[var(--text-secondary)] mb-6">{meta.tagline.ar} — {meta.catalogue}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <div className="bg-[var(--surface-secondary)] rounded-xl p-5 shadow-sm border border-[var(--border-subtle)]">
            <h3 className="font-semibold mb-2">المكان</h3>
            <p className="text-4xl font-extrabold text-[var(--accent-primary)]">{(placesData as any)?.count ?? '-'}</p>
            <p className="text-xs text-[var(--text-secondary)]">أماكن حقيقية من API</p>
          </div>
          <div className="bg-[var(--surface-secondary)] rounded-xl p-5 shadow-sm border border-[var(--border-subtle)]">
            <h3 className="font-semibold mb-2">سياحة</h3>
            <p className="text-4xl font-extrabold text-[var(--accent-secondary)]">{(placesData as any)?.tourismCount ?? '-'}</p>
          </div>
          <div className="bg-[var(--surface-secondary)] rounded-xl p-5 shadow-sm border border-[var(--border-subtle)]">
            <h3 className="font-semibold mb-2">فنادق / مطاعم</h3>
            <p className="text-2xl font-extrabold">{hotelsData?.count || '-'}</p>
            <p className="text-xs text-[var(--text-secondary)]">طعام: {foodData?.count || '-'}</p>
          </div>
        </div>
        {subIds.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-bold mb-4">وجهات فرعية</h2>
            <div className="flex gap-3 flex-wrap">
              {subIds.map(subId => {
                const subDef = SUB_DESTINATIONS[subId as 'ras_mohamed' | 'colored_canyon' | 'abu_simbel'];
                if (!subDef) return null;
                return (
                  <button key={subId} type="button" onClick={() => navigateTo('/cities', { citySlug: subDef.parent, subSlug: subId })} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-secondary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)] transition-colors cursor-pointer">
                    <img src={subDef.heroImage} alt={subDef.name.ar} className="w-6 h-6 rounded-full object-cover" loading="lazy" />
                    <span className="font-medium text-sm">{subDef.name.ar}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
        <section>
          <h2 className="text-xl font-bold mb-4">أول 3 أماكن</h2>
          {placesStatus === 'loading' ? <p>جارٍ التحميل...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(placesData?.places || []).slice(0, 3).map((f: any) => (
                <div key={f.id} className="bg-[var(--surface-secondary)] rounded-xl p-4 shadow-sm border border-[var(--border-subtle)]">
                  <h4 className="font-bold text-base">{f.name || f.nameAr || '—'}</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">{f.tags?.tourism || f.tags?.historic || 'سياحة'}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{f.lat ? `${f.lat.toFixed(4)}°` : ''} {f.lng ? `${f.lng.toFixed(4)}°` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
