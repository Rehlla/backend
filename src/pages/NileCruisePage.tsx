import React from 'react';
import { useNileCruiseRoutes } from '../hooks/useNileCruise';

export const NileCruisePage: React.FC = () => {
  const { data, status } = useNileCruiseRoutes();
  const stops = (data as any)?.stops || (data as any)?.routes || [];
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0B151C] to-[#13232A] text-white">
      <div className="relative h-[50vh] overflow-hidden bg-[url('/images/cities/luxor.webp')] bg-cover bg-center">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0B151C] via-[#0B151C]/60 to-transparent" />
        <div className="absolute bottom-8 left-6 md:left-10">
          <h1 className="text-4xl md:text-6xl font-extrabold">نيل كروز</h1>
          <p className="text-sm text-white/70 mt-2">الأقصر → أسوان → أبو سمبل (اختياري)</p>
        </div>
      </div>
      <main className="max-w-5xl mx-auto px-6 py-10">
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">مسار 6 محطات</h2>
          {status === 'loading' ? <p>جارٍ التحميل...</p> : stops.length === 0 ? <p>لا توجد محطات حالياً.</p> : (
            <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-4">
              {stops.map((s: any, i: number) => (
                <div key={i} className="min-w-[14rem] bg-[#1A1625] rounded-xl p-5 shadow-lg border border-white/10">
                  <h3 className="font-bold text-lg">{s.name || s.nameAr || 'محطة'}</h3>
                  <p className="text-xs text-white/60">{s.lat?.toFixed(3)}°N {s.lng?.toFixed(3)}°E</p>
                  <p className="text-sm text-white/80 mt-2">{s.tags?.tourism || 'محطة سياحية'}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
