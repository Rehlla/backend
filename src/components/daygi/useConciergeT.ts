import { useCallback } from 'react';
import { getInstalledView, translateFrom } from '../../i18n/translator';
import type { TVars } from '../../i18n/resolve';

/**
 * Registry-backed translator bound to an explicit language, for DayGI
 * surfaces that carry their own language state: the concierge view owns a
 * language toggle and passes the chosen language down as a prop, while the
 * context t() stays bound to the site language. Resolving DayGI copy through
 * the site-bound t() is what produced Arabic titles inside English response
 * blocks. Same signature and fallback contract as the context t().
 */
export function useConciergeT(lang: 'ar' | 'en') {
  return useCallback((key: string, arg2?: TVars | string, arg3?: string): string => {
    const active = getInstalledView(lang);
    const enView = lang === 'en' ? active : getInstalledView('en');
    if (typeof arg2 === 'object') {
      return translateFrom(active, enView, key, lang, arg2, arg3);
    }
    return translateFrom(active, enView, key, lang, undefined, typeof arg2 === 'string' ? arg2 : arg3);
  }, [lang]);
}
