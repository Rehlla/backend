import React from 'react';
import { 
  Facebook, Twitter, Instagram, Youtube, Mail, MapPin, Phone, MessageCircle,
  Download, Github, Linkedin, Heart
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import { Button } from '../ui/button';

/**
 * Site footer — four-column layout with Company, Support, Legal, Connect.
 * RTL-ready, language-aware, minimal visual weight.
 */
export const Footer: React.FC = () => {
  const { language, t } = useLanguage();
  const year = new Date().getFullYear();

  const isAr = language === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const nav = (href: string, label: string) => {
  // P0-07: Filter internal operational routes for all non-Admin/non-Operations visitors
  const internalRoutes = ['/ops', '/operations', '/supplier', '/admin', '/command-center'];
  const isInternalRoute = internalRoutes.some(prefix => href.startsWith(prefix));
  // Always filter for visitors since we no longer have sessionUserRole
  const shouldFilter = true;
  const shouldRender = !isInternalRoute || !shouldFilter;
  
  if (!shouldRender) return null;
  
  // P1-11 / P2-08: a real anchor so middle-click, Ctrl/Cmd+Click and "open in new
  // tab" all work, and no full page reload. Padding lives on the anchor itself so
  // the row reads as one item per line rather than four glued words.
  return (
    <a
      href={href}
      className="block rounded-md px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
    >
      {label}
    </a>
  );
};

  const socialBtn = (icon: React.ReactNode, ariaLabel: string, href: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-container)] transition-colors"
    >
      {icon}
    </a>
  );

  const appStoreBtn = (label: string, href: string) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-container)] transition-colors"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );

  return (
    <footer role="contentinfo" dir={dir} className="bg-[var(--surface-card)] border-t border-[var(--border-subtle)]">
      <div className="mx-auto max-w-[var(--dg-content-max)] px-[var(--dg-gutter)] py-12 lg:py-16">
        {/* Main Grid: 4 columns on desktop, 2 on tablet, 1 on mobile */}
        <div className="grid gap-8 lg:grid-cols-4 md:grid-cols-2">
          {/* Column 1: Company */}
          <div className="space-y-4">
            <p className="font-semibold text-[var(--text-primary)]">{t('footer.company')}</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {t('footer.companyDesc')}
            </p>
            <div className="flex flex-wrap gap-3">
              {nav('/about', t('footer.about'))}
              {nav('/careers', t('footer.careers'))}
              {nav('/press', t('footer.press'))}
            </div>
          </div>

          {/* Column 2: Support */}
          <div className="space-y-4">
            <p className="font-semibold text-[var(--text-primary)]">{t('footer.support')}</p>
            <div className="space-y-3 text-sm text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{t('footer.whatsapp')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{t('footer.email')}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{t('footer.office')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                <span>{t('footer.phone')}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              {nav('/help', t('footer.helpCenter'))}
              {nav('/faq', t('footer.faq'))}
            </div>
          </div>

          {/* Column 3: Legal */}
          <div className="space-y-4">
            <p className="font-semibold text-[var(--text-primary)]">{t('footer.legal')}</p>
            <div className="flex flex-col items-start gap-2">
              {nav('/privacy', t('footer.privacy'))}
              {nav('/terms', t('footer.terms'))}
              {nav('/refund-policy', t('footer.refundPolicy'))}
              {nav('/cookies', t('footer.cookies'))}
            </div>
          </div>

          {/* Column 4: Connect */}
          <div className="space-y-4">
            <p className="font-semibold text-[var(--text-primary)]">{t('footer.connect')}</p>
            
            {/* Social Links — a real list: bare <li> inside a <div> kept the
                UA list markers (stray bullets next to the icons). */}
            <ul className="flex gap-2 list-none m-0 p-0" aria-label={t('footer.socialAria')}>
              <li>{socialBtn(<Instagram className="h-5 w-5" />, 'Instagram', 'https://instagram.com/rehla.travel')}</li>
              <li>{socialBtn(<Facebook className="h-5 w-5" />, 'Facebook', 'https://facebook.com/rehla.travel')}</li>
              <li>{socialBtn(<Twitter className="h-5 w-5" />, 'X (Twitter)', 'https://x.com/rehla_travel')}</li>
              <li>{socialBtn(<Youtube className="h-5 w-5" />, 'YouTube', 'https://youtube.com/@rehla_travel')}</li>
              <li>{socialBtn(<Linkedin className="h-5 w-5" />, 'LinkedIn', 'https://linkedin.com/company/rehla-travel')}</li>
              <li>{socialBtn(<Github className="h-5 w-5" />, 'GitHub', 'https://github.com/rehla-travel')}</li>
            </ul>

            {/* App Store Buttons */}
            <div className="flex flex-wrap gap-3">
              {appStoreBtn(t('footer.appStore'), 'https://apps.apple.com/app/rehla-travel')}
              {appStoreBtn(t('footer.playStore'), 'https://play.google.com/store/apps/details?id=com.rehla.travel')}
            </div>

            {/* Newsletter Signup */}
            <div className="space-y-2">
              <p className="text-sm text-[var(--text-secondary)]">{t('footer.newsletterDesc')}</p>
              <NewsletterForm />
            </div>
          </div>
        </div>

        {/* Bottom Bar: Copyright + Locale */}
        <div className="mt-10 pt-8 border-t border-[var(--border-subtle)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-secondary)]" dir="ltr">
            © {year} REHLA. {t('footer.rightsReserved')}
          </p>
          <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
            {/* `inline`: Tailwind preflight sets svg to display:block, which
                pushed the heart glyph onto its own line in the bilingual
                made-with line. The literal heart character stays out of the
                source entirely — the emoji-discipline gate scans comments
                too — so the Lucide Heart component is the glyph. */}
            <span>{t('footer.madeWith')} <Heart className="h-4 w-4 inline shrink-0 text-[var(--accent-primary)]" aria-hidden="true" /> {t('footer.inDahab')}</span>
            <span className="px-2 py-0.5 rounded-full bg-[var(--surface-container)] text-xs font-mono">
              {isAr ? 'AR' : 'EN'}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};

/* Newsletter form — posts to /api/newsletter via api.subscribeNewsletter */
function NewsletterForm() {
  const { language, t } = useLanguage();
  const [email, setEmail] = React.useState('');
  const [status, setStatus] = React.useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setStatus('submitting');
    try {
      await api.subscribeNewsletter({ email, lang: language });
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2" aria-label="Newsletter signup">
      <label htmlFor="newsletter-email" className="sr-only">{t('footer.newsletterLabel')}</label>
      <input
        id="newsletter-email"
        type="email"
        placeholder={t('footer.newsletterPlaceholder')}
        value={email}
        onChange={e => setEmail(e.target.value)}
        disabled={status === 'submitting' || status === 'success'}
        className="flex-1 min-w-[200px] px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]"
        autoComplete="email"
      />
      <button
        type="submit"
        disabled={status === 'submitting' || status === 'success' || !email}
        className="px-4 py-2 rounded-xl bg-[var(--accent-primary)] text-[var(--accent-primary-ink)] text-sm font-semibold hover:bg-[var(--accent-secondary)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        {status === 'submitting' ? t('footer.subscribing') : status === 'success' ? t('footer.subscribed') : t('footer.subscribe')}
      </button>
    </form>
  );
}