import React from 'react';
import { useTrip } from '../context';
import { SUB_DESTINATIONS, PARENT_MAP } from '../design/destinations';
import { useSubDestinations } from '../hooks/useSubDestinations';

export const SubDestinationPage: React.FC = () => {
  // Params arrive via routeFromUrl (/cities/:citySlug/sub/:subSlug) — currentRoute
  // is just '/cities', so matching it can never see the slugs.
  const { currentParams } = useTrip();
  const parent = (currentParams?.citySlug || 'sharm').toLowerCase();
  const sub = (currentParams?.subSlug || 'ras_mohamed').toLowerCase();
  const meta = SUB_DESTINATIONS[sub as 'ras_mohamed' | 'colored_canyon' | 'abu_simbel'];
  const subData = useSubDestinations(parent, sub, 'places');

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B151C] to-[#1E1B2E] text-white">
      <div className="relative h-[55vh] overflow-hidden">
        <img src={meta?.heroImage || '/images/cities/sub/abu_simbel.webp'} alt={meta?.name.ar || sub} className="w-full h-full object-cover opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B151C] via-transparent to-transparent" />
        <div className="absolute bottom-6 left-6 md:left-10">
          <a href={`/cities/${meta?.parent || parent}`} className="text-xs font-medium text-white/70 hover:text-white mb-2 block">← عودة لتجربة {meta?.parent}</a>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">{meta?.name.ar || sub}</h1>
          <p className="text-sm text-white/70 mt-2">{meta?.vibe || ''} · {meta?.coords?.lat.toFixed(4)}°N {meta?.coords?.lng.toFixed(4)}°E</p>
        </div>
      </div>
      <main className="max-w-4xl mx-auto px-6 py-10">
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-3">أماكن حقيقية</h2>
          {subData.status === 'loading' ? <p>جارٍ التحميل...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {((subData.data as any)?.places || subData.data?.data?.places || []).slice(0, 3).map((f: any) => (
                <div key={f.id} className="bg-[#1A1625] rounded-xl p-5 shadow-lg border border-white/10">
                  <h4 className="font-bold text-base">{f.name || f.nameAr || '—'}</h4>
                  <p className="text-xs text-white/60 mt-1">{f.tags?.tourism || f.tags?.historic || 'سياحة'}</p>
                  <p className="text-xs text-white/40">{f.lat ? `${f.lat.toFixed(4)}°` : ''} {f.lng ? `${f.lng.toFixed(4)}°` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
