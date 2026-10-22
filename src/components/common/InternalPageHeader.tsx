import React from 'react';
import { AppRoute } from '../../types';
import { ChevronRight, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';

export interface BreadcrumbItem {
  label: string;
  /** A real route, not any string — navigateTo only accepts AppRoute. */
  to?: AppRoute;
}

export interface InternalPageHeaderProps {
  variant?: 'editorial' | 'trip' | 'utility' | 'operations';
  title: string;
  eyebrow?: string;
  eyebrowIcon?: React.ReactNode;
  subtitle?: string | React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  badges?: Array<{
    text: string;
    variant?: 'gold' | 'teal' | 'sand' | 'emerald' | 'amber' | 'rose';
    icon?: React.ReactNode;
  }>;
  actions?: React.ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const InternalPageHeader: React.FC<InternalPageHeaderProps> = ({
  variant = 'editorial',
  title,
  eyebrow,
  eyebrowIcon,
  subtitle,
  breadcrumbs = [],
  badges = [],
  actions,
  onBack,
  showBack = false,
  className = '',
  children,
}) => {
  const { navigateTo } = useTrip();
  const { isRTL, t } = useLanguage();
  const isRtl = isRTL;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  // 1. EDITORIAL VARIANT (Discovery, Stories, Explore, Stays)
  // Concierge language: plain gold eyebrow, serif display title, generous air.
  if (variant === 'editorial') {
    return (
      <header
        className={`relative bg-gradient-to-b from-[var(--surface-container)] via-[var(--surface-container)] to-[var(--surface-container)] text-[var(--text-primary)] pt-12 pb-12 sm:pt-16 sm:pb-14 px-4 sm:px-6 lg:px-8 border-b border-[var(--accent-primary)]/20 overflow-hidden ${className}`}
      >
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-[var(--accent-secondary)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-[var(--accent-primary)]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto space-y-4 relative z-10">
          {/* Breadcrumbs & Back */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
              {showBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-[var(--accent-secondary)] hover:text-[var(--accent-secondary)] me-2 py-2 px-3 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] transition-colors"
                >
                  {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                  <span>{t('common.back')}</span>
                </button>
              )}
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className={`w-3 h-3 text-[var(--text-muted)] ${isRtl ? 'rotate-180' : ''}`} />}
                  {crumb.to ? (
                    <button
                      type="button"
                      onClick={() => { if (crumb.to) navigateTo(crumb.to); }}
                      className="hover:text-[var(--text-primary)] hover:underline transition-colors py-2 -my-2"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-[var(--text-primary)] font-semibold">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>

            {badges.length > 0 && (
              <div className="flex items-center gap-2">
                {badges.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--surface-container)] border border-[var(--accent-primary)]/30 text-[var(--accent-secondary)]"
                  >
                    {b.icon}
                    <span>{b.text}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Main Title Area */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pt-1">
            <div className="space-y-3 max-w-3xl">
              {eyebrow && (
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                  {eyebrowIcon}
                  <span>{eyebrow}</span>
                </p>
              )}
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
                {title}
              </h1>
              {subtitle && (
                <div className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-2xl">
                  {subtitle}
                </div>
              )}
            </div>

            {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
          </div>

          {children && <div className="pt-2">{children}</div>}
        </div>
      </header>
    );
  }

  // 2. TRIP VARIANT (My Trip, Bookings, Wallet, Today, Memories)
  if (variant === 'trip') {
    return (
      <header
        className={`relative bg-[var(--surface-container)] text-[var(--text-primary)] pt-12 pb-10 sm:pt-14 px-4 sm:px-6 lg:px-8 border-b border-[var(--accent-primary)]/25 overflow-hidden ${className}`}
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-[var(--accent-primary)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-7xl mx-auto space-y-4 relative z-10">
          {/* Top meta row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
              {showBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-[var(--accent-secondary)] hover:text-[var(--accent-secondary)] me-2 py-2 px-3 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] transition-colors"
                >
                  {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                  <span>{t('common.back')}</span>
                </button>
              )}
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className={`w-3 h-3 text-[var(--text-muted)] ${isRtl ? 'rotate-180' : ''}`} />}
                  {crumb.to ? (
                    <button
                      type="button"
                      onClick={() => { if (crumb.to) navigateTo(crumb.to); }}
                      className="hover:text-[var(--text-primary)] hover:underline py-2 -my-2"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-[var(--text-primary)] font-semibold">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>

            {badges.length > 0 && (
              <div className="flex items-center gap-2">
                {badges.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--surface-container)] border border-[var(--accent-primary)]/40 text-[var(--accent-primary)]"
                  >
                    {b.icon}
                    <span>{b.text}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Heading + Actions */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              {eyebrow && (
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)]">
                  {eyebrowIcon}
                  <span>{eyebrow}</span>
                </p>
              )}
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
                {title}
              </h1>
              {subtitle && <div className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">{subtitle}</div>}
            </div>

            {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
          </div>

          {children && <div className="pt-2 border-t border-[var(--border-subtle)]">{children}</div>}
        </div>
      </header>
    );
  }

  // 3. UTILITY VARIANT (Forms, Checkout, Recovery, Briefing)
  if (variant === 'utility') {
    return (
      <header className={`bg-[var(--surface-card)] border-b border-[var(--border-subtle)] pt-6 pb-6 px-4 sm:px-6 lg:px-8 text-[var(--text-primary)] ${className}`}>
        <div className="max-w-7xl mx-auto space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]/70">
              {showBack && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1 text-[var(--accent-primary)] hover:text-[var(--accent-secondary)] me-2 py-2 px-3 rounded-lg bg-[var(--surface-container)] border border-[var(--border-subtle)] font-bold transition-colors"
                >
                  {isRtl ? <ArrowRight className="w-3.5 h-3.5" /> : <ArrowLeft className="w-3.5 h-3.5" />}
                  <span>{t('common.back')}</span>
                </button>
              )}
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className={`w-3 h-3 text-[var(--text-muted)] ${isRtl ? 'rotate-180' : ''}`} />}
                  {crumb.to ? (
                    <button
                      type="button"
                      onClick={() => { if (crumb.to) navigateTo(crumb.to); }}
                      className="hover:text-[var(--text-primary)] hover:underline py-2 -my-2"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="text-[var(--text-primary)] font-bold">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </div>

            {badges.length > 0 && (
              <div className="flex items-center gap-2">
                {badges.map((b, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--surface-container)] text-[var(--accent-primary)] border border-[var(--border-subtle)]"
                  >
                    {b.icon}
                    <span>{b.text}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1.5">
              {eyebrow && (
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--accent-primary)] block">
                  {eyebrow}
                </span>
              )}
              <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[var(--text-primary)] tracking-tight text-balance">
                {title}
              </h1>
              {subtitle && <div className="text-sm text-[var(--text-secondary)] leading-relaxed">{subtitle}</div>}
            </div>

            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>

          {children}
        </div>
      </header>
    );
  }

  // 4. OPERATIONS VARIANT (Operations Console, Supplier Portal)
  return (
      <header className={`bg-[var(--bg-canvas)] text-[var(--text-primary)] border-b border-cyan-500/20 py-4 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              aria-label={t('common.back')}
              className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--btn-util-bg)] transition-colors"
            >
              {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            </button>
          )}
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              {eyebrow && (
                <span className="text-[11px] font-bold font-mono text-[var(--accent-secondary)]">
                  {eyebrow}
                </span>
              )}
              {badges.map((b, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/60 border border-cyan-500/30 text-cyan-300"
                >
                  {b.icon}
                  <span>{b.text}</span>
                </span>
              ))}
            </div>
            <h1 className="text-lg sm:text-xl font-bold font-mono tracking-tight text-[var(--text-primary)]">
              {title}
            </h1>
          </div>
        </div>

        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="max-w-7xl mx-auto pt-3 mt-2 border-t border-[var(--border-subtle)]">{children}</div>}
    </header>
  );
};
