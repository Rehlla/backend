import React from 'react';
import { Compass, House, Search, LifeBuoy } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTrip } from '../../context/TripContext';

/**
 * NotFoundView — rendered for every unrecognised path (see routeFromUrl).
 *
 * A dead end must explain itself and offer a way forward, not silently dump
 * the traveler on the homepage: quick links home, discovery with the most
 * common intents, and help for anything urgent. Fully bilingual like the
 * rest of the product.
 */
export const NotFoundView: React.FC = () => {
  const { language, t } = useLanguage();
  const { navigateTo } = useTrip();
  const isAr = language === 'ar';

  const suggestions: { route: '/explore' | '/food' | '/hotels' | '/help'; labelEn: string; labelAr: string }[] = [
    { route: '/explore', labelEn: 'Explore Dahab', labelAr: 'اكتشف دهب' },
    { route: '/food', labelEn: 'Food & Dining', labelAr: 'الأكل والمطاعم' },
    { route: '/hotels', labelEn: 'Places to stay', labelAr: 'أماكن الإقامة' },
    { route: '/help', labelEn: 'Help & Emergency', labelAr: 'المساعدة والطوارئ' },
  ];

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/15 flex items-center justify-center mb-5">
        <Compass className="w-7 h-7 text-[var(--accent-primary)]" aria-hidden="true" />
      </div>
      <p className="text-xs font-bold tracking-widest text-[var(--text-muted)] mb-2" dir="ltr">404</p>
      <h1 className="text-xl font-extrabold text-[var(--text-primary)] mb-2">
        {t('pageNotFound')}
      </h1>
      <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-8 max-w-md">
        {t('thisPageIsNot')}
      </p>
      <div className="flex flex-col sm:flex-row gap-2.5 justify-center mb-8">
        <button
          type="button"
          onClick={() => navigateTo('/home')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold cursor-pointer bg-[var(--btn-book-bg)] hover:bg-[var(--btn-book-hover)] text-[var(--btn-book-text)] transition-colors"
        >
          <House className="w-3.5 h-3.5" aria-hidden="true" />
          {isAr ? 'العودة للرئيسية' : 'Back to home'}
        </button>
        <button
          type="button"
          onClick={() => navigateTo('/explore')}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold cursor-pointer border border-[var(--border-subtle)] text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-colors"
        >
          <Search className="w-3.5 h-3.5" aria-hidden="true" />
          {isAr ? 'ابحث بدلاً من ذلك' : 'Search instead'}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-[var(--text-secondary)]">
        <LifeBuoy className="w-3.5 h-3.5" aria-hidden="true" />
        {suggestions.map(s => (
          <button
            key={s.route}
            type="button"
            onClick={() => navigateTo(s.route)}
            className="cursor-pointer hover:text-[var(--text-primary)] transition-colors py-2 -my-2"
          >
            {isAr ? s.labelAr : s.labelEn}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NotFoundView;
