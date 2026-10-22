import React, { useState } from 'react';
import { AlertCircle, RefreshCw, Tag } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { PriceTag } from '../ui/price-tag';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { api, type CommerceAlternative } from '../../services/api';
import { checkoutIssueMessage, type CheckoutIssue } from '../../services/checkoutError';

/**
 * What went wrong with a hold or checkout, and the one next step that fixes
 * it — shared by every booking surface so the same failure reads the same way
 * everywhere.
 *
 * - price changed → the new amount and "Book at EGP 1,500" (same holds)
 * - hold expired / mismatched → "Hold it again"
 * - supplier unavailable / sold out → similar options from
 *   /api/commerce/alternatives (same availability math as the hold)
 * - fraud block / forbidden → nothing charged, contact support
 *
 * Nothing here decides a price or availability; it only presents what the
 * server said.
 */
export interface CheckoutIssuePanelProps {
  /** A failure. Ignored when `priceChange` is set. */
  issue?: CheckoutIssue | null;
  /** The holds cost something other than what was shown. */
  priceChange?: { shownTotalEGP: number; currentTotalEGP: number } | null;
  busy?: boolean;
  onConfirmPrice?: () => void;
  onRehold?: () => void;
  onRetry?: () => void;
  onSignIn?: () => void;
  onContactSupport?: () => void;
  onPickAnotherDate?: () => void;
  onDismiss?: () => void;
  /** Needed to look up alternatives; without it that recovery is not offered. */
  alternativesQuery?: {
    tripId: string;
    skuId: string;
    date: string;
    timeSlot?: string;
    passengersCount: number;
  } | null;
  onPickAlternative?: (alternative: CommerceAlternative) => void;
  className?: string;
}

export const CheckoutIssuePanel: React.FC<CheckoutIssuePanelProps> = ({
  issue,
  priceChange,
  busy = false,
  onConfirmPrice,
  onRehold,
  onRetry,
  onSignIn,
  onContactSupport,
  onPickAnotherDate,
  onDismiss,
  alternativesQuery,
  onPickAlternative,
  className,
}) => {
  const { t, language } = useLanguage();
  const { formatEGP } = useCurrency();
  const [alternatives, setAlternatives] = useState<CommerceAlternative[] | null>(null);
  const [alternativesState, setAlternativesState] = useState<'idle' | 'loading' | 'error'>('idle');

  if (!priceChange && !issue) return null;

  const loadAlternatives = async () => {
    if (!alternativesQuery) return;
    setAlternativesState('loading');
    try {
      const res = await api.findAlternatives({ ...alternativesQuery, limit: 3 });
      setAlternatives(res.alternatives || []);
      setAlternativesState('idle');
    } catch {
      setAlternativesState('error');
    }
  };

  const dismiss = onDismiss && (
    <Button variant="ghost" size="sm" onClick={onDismiss} disabled={busy}>
      {t('checkout.action.notNow')}
    </Button>
  );

  if (priceChange) {
    return (
      <section role="alert" aria-live="assertive" className={`rounded-dg-lg border border-dg-line-strong bg-dg-surface p-4 space-y-3 ${className ?? ''}`}>
        <div className="flex items-center gap-2">
          <Badge tone="warning" icon={<Tag className="h-3.5 w-3.5" aria-hidden="true" />}>
            {t('checkout.priceChanged.title')}
          </Badge>
        </div>
        <p className="text-sm text-dg-ink">
          {t('checkout.error.priceChanged', { amount: formatEGP(priceChange.currentTotalEGP) })}
        </p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <PriceTag amountEGP={priceChange.currentTotalEGP} unit="total" size="lg" />
          <span className="text-[0.8125rem] text-dg-ink-3 line-through" dir="ltr">
            {formatEGP(priceChange.shownTotalEGP)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {onConfirmPrice && (
            <Button onClick={onConfirmPrice} loading={busy}>
              {t('checkout.action.confirmNewPrice', { amount: formatEGP(priceChange.currentTotalEGP) })}
            </Button>
          )}
          {dismiss}
        </div>
      </section>
    );
  }

  const current = issue as CheckoutIssue;
  const message = checkoutIssueMessage(current, t, formatEGP);

  const action = (() => {
    switch (current.recovery) {
      case 'confirmPrice':
      case 'rehold':
        return onRehold ? (
          <Button onClick={onRehold} loading={busy} leadingIcon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}>
            {t('checkout.action.rehold')}
          </Button>
        ) : null;
      case 'alternatives':
        return alternativesQuery && alternatives === null ? (
          <Button variant="outline" onClick={loadAlternatives} loading={alternativesState === 'loading'}>
            {t('checkout.action.seeAlternatives')}
          </Button>
        ) : null;
      case 'pickAnotherDate':
        return onPickAnotherDate ? (
          <Button variant="outline" onClick={onPickAnotherDate}>{t('checkout.action.pickAnotherDate')}</Button>
        ) : null;
      case 'signIn':
        return onSignIn ? <Button onClick={onSignIn}>{t('checkout.action.signIn')}</Button> : null;
      case 'contactSupport':
        return onContactSupport ? (
          <Button variant="outline" onClick={onContactSupport}>{t('checkout.action.contactSupport')}</Button>
        ) : null;
      case 'retry':
      default:
        return onRetry ? (
          <Button variant="outline" onClick={onRetry} loading={busy}>{t('checkout.action.tryAgain')}</Button>
        ) : null;
    }
  })();

  return (
    <section role="alert" aria-live="assertive" className={`rounded-dg-lg border border-dg-line-strong bg-dg-surface p-4 space-y-3 ${className ?? ''}`}>
      <p className="flex items-start gap-2 text-sm text-dg-ink">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-dg-critical" aria-hidden="true" />
        <span>{message}</span>
      </p>

      {alternativesState === 'error' && (
        <p className="text-[0.8125rem] text-dg-ink-2">{t('checkout.alternatives.failed')}</p>
      )}
      {alternatives !== null && alternatives.length === 0 && (
        <p className="text-[0.8125rem] text-dg-ink-2">{t('checkout.alternatives.none')}</p>
      )}
      {alternatives !== null && alternatives.length > 0 && (
        <div className="space-y-2">
          <p className="text-[0.8125rem] font-semibold text-dg-ink-2">{t('checkout.alternatives.title')}</p>
          <ul className="space-y-2">
            {alternatives.map(alt => (
              <li key={`${alt.skuId}-${alt.timeSlot}`} className="flex flex-wrap items-center justify-between gap-3 rounded-dg-md bg-dg-sunken px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-dg-ink">{language === 'ar' ? alt.titleAr : alt.title}</p>
                  <p className="text-[0.8125rem] text-dg-ink-3">
                    {language === 'ar' ? alt.reasonAr : alt.reason} · <span dir="ltr">{alt.timeSlot}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PriceTag amountEGP={alt.basePriceEGP} unit={alt.serviceType === 'hotel' ? 'total' : 'perPerson'} size="sm" egpOnly />
                  {onPickAlternative && (
                    <Button size="sm" variant="secondary" onClick={() => onPickAlternative(alt)}>
                      {t('checkout.action.chooseAlternative')}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(action || dismiss) && (
        <div className="flex flex-wrap gap-2">
          {action}
          {dismiss}
        </div>
      )}
    </section>
  );
};
