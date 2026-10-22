import React from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useNavigation, useSiteInfo } from '../../hooks/useCMSContent';
import type { NavigationItemWire } from '../../services/api';
import type { CmsHomepageSection } from '../../services/api';
import type { AppRoute } from '../../types';

interface DahabFooterProps {
  navigateTo: (route: AppRoute, opts?: Record<string, unknown>) => void;
  cmsSection?: CmsHomepageSection | null;
}

/** Compiled fallback — the CMS footer menu overrides this when published. */
const FALLBACK_LINKS: Array<{ route: string; labelEn: string; labelAr: string }> = [
  { route: '/my-trip', labelEn: 'My Trip', labelAr: 'رحلتي' },
  { route: '/explore', labelEn: 'Explore Dahab', labelAr: 'استكشف دهب' },
  { route: '/food', labelEn: 'Food', labelAr: 'الأكل' },
  { route: '/help', labelEn: 'Help & SOS', labelAr: 'المساعدة والنجدة' },
];

/**
 * Site footer — the link columns come from the CMS footer navigation menu
 * (Navigation tab → footer), with the compiled list above as fallback. The
 * hyperbaric hotline and copyright lines are bilingual i18n strings.
 */
export const DahabFooter: React.FC<DahabFooterProps> = ({ navigateTo, cmsSection }) => {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';

  const { data: cmsLinks, fromCMS } = useNavigation('footer');
  const { data: siteInfo } = useSiteInfo();

  // CMS site-info slots (contact / social). Every slot is optional: the block
  // below renders only when at least one value exists, so a fresh CMS shows
  // no placeholder phone numbers or dead social links.
  const pick = (slot?: { value: string; valueAr: string }): string =>
    isAr ? (slot?.valueAr || slot?.value || '') : (slot?.value || '');
  const contactSlots = [
    { key: 'contact.phone', href: (v: string) => `tel:${v.replace(/[^+\d]/g, '')}` },
    { key: 'contact.whatsapp', href: (v: string) => `https://wa.me/${v.replace(/\D/g, '')}` },
    { key: 'contact.email', href: (v: string) => `mailto:${v}` },
    { key: 'contact.address', href: null as null | ((v: string) => string) },
  ]
    .map(s => ({ ...s, text: pick((siteInfo?.contact || {})[s.key]) }))
    .filter(s => s.text);
  const SOCIAL_LABELS: Record<string, string> = {
    'social.instagram': 'Instagram',
    'social.facebook': 'Facebook',
    'social.tiktok': 'TikTok',
    'social.youtube': 'YouTube',
    'social.website': 'Website',
  };
  const socialLinks = Object.entries(SOCIAL_LABELS)
    .map(([key, label]) => ({ label, url: (siteInfo?.social || {})[key]?.value || '' }))
    .filter(s => s.url);
  const hasSiteInfo = contactSlots.length > 0 || socialLinks.length > 0;

  const links = fromCMS && cmsLinks && cmsLinks.length > 0
    ? (cmsLinks as NavigationItemWire[]).map((item) => ({
        route: item.route || item.external_url || '#',
        labelEn: item.label_en,
        labelAr: item.label_ar,
        external: !!item.external_url,
        group: item.group_label_en || '',
      }))
    : FALLBACK_LINKS.map((l) => ({ ...l, external: false, group: '' }));

  // CMS visibility flag: hide the footer from the dashboard (Homepage tab).
  if (cmsSection && cmsSection.visible === 0) return null;

  const handleClick = (link: { route: string; external: boolean }) => {
    if (link.external) {
      window.open(link.route, '_blank', 'noopener,noreferrer');
      return;
    }
    // CMS routes that are not in the app's route union fall back to a plain
    // hash link rather than crashing the router.
    if (link.route.startsWith('/') && !link.route.includes(' ')) {
      navigateTo(link.route as AppRoute);
    }
  };

  return (
    <footer
      id="dahab-footer"
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 border-t border-[var(--border-subtle)] aurora-reveal scroll-mt-[calc(var(--dg-topbar-h)+var(--dg-safe-top)+12px)]"
      role="contentinfo"
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-8 pb-8">
        <div className="space-y-2 max-w-sm">
          <div className="flex items-center gap-2.5">
            {/* Brand mark: a plate on the theme's own container surface with
                accent copy ink — the same recipe as the navbar's TRAVEL OS
                chip, so the two brand marks read as one system. It was a
                painted gradient (#1C1917 -> accent -> #1B9A8B) whose fill the
                ink could not track: its fixed teal stop capped the white "D"
                at 3.47:1 (4.34 measured in Arabic) and, on a themed ramp, one
                theme drew a fill the paired dark ink sat on at 1.93:1. The
                surface pair a theme declares for its own canvas carries the
                accent ink at >=4.5:1 everywhere, measured. */}
            <div className="w-8 h-8 rounded-xl bg-[var(--surface-container)] text-[var(--text-accent-strong)] flex items-center justify-center text-sm font-bold shadow-md" aria-hidden="true">
              D
            </div>
            <span className="chart-heading font-bold tracking-wide text-[var(--text-primary)]">
              {t('brand.name')}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">· {t('brand.tagline')}</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            {t('home.footer.tagline')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs font-medium text-[var(--text-secondary)]">
          {links.map((link, i) => (
            <button
              key={`${link.route}-${i}`}
              type="button"
              onClick={() => handleClick(link)}
              className="cursor-pointer hover:text-[var(--text-primary)] underline-offset-4 decoration-[var(--accent-primary)]/60 hover:underline transition-colors py-2 -my-2"
            >
              {isAr ? link.labelAr || link.labelEn : link.labelEn}
            </button>
          ))}
        </div>
      </div>

      <div className="py-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
        <span>{t('home.footer.copyright')}</span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
          {t('home.footer.hyperbaricHotline')}: <strong dir="ltr" className="font-semibold text-[var(--text-primary)] [unicode-bidi:isolate] whitespace-nowrap">+20 69 364 0400</strong>
        </span>
      </div>

      {hasSiteInfo && (
        <div className="py-4 border-t border-[var(--border-subtle)] flex flex-col sm:flex-row items-start justify-between gap-3 text-[11px] text-[var(--text-secondary)]">
          {contactSlots.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="font-bold text-[var(--text-primary)]">{t('footer.contact')}</span>
              {contactSlots.map(c =>
                c.href ? (
                  <a key={c.key} href={c.href(c.text)} className="hover:text-[var(--text-primary)] underline-offset-4 decoration-[var(--accent-primary)]/60 hover:underline transition-colors" dir="ltr">
                    {c.text}
                  </a>
                ) : (
                  <span key={c.key}>{c.text}</span>
                )
              )}
            </div>
          )}
          {socialLinks.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="font-bold text-[var(--text-primary)]">{t('footer.follow')}</span>
              {socialLinks.map(s => (
                <a key={s.label} href={s.url} target="_blank" rel="noreferrer" className="hover:text-[var(--text-primary)] underline-offset-4 decoration-[var(--accent-primary)]/60 hover:underline transition-colors">
                  {s.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </footer>
  );
};

export default DahabFooter;