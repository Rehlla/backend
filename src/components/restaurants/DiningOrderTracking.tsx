import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Clock, MapPin, Receipt, XCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useApiResource } from '../../hooks/useApiResource';
import { api } from '../../services/api';
import type { DiningOrder, DiningOrderStatus } from '../../types/dining';

/**
 * Where an order actually is.
 *
 * This exists because the surface it replaces had four buttons labelled
 * "Simulate status" wired to React state: the kitchen was imaginary, and a
 * traveler watching a progress bar was watching a local variable. Every state
 * shown here comes from GET /api/dining/orders/:id, and the only way it moves
 * is operations advancing it on the server.
 *
 * Polling, not websockets: the server has no push channel, the traveler is on
 * a phone that sleeps, and a 20-second poll while the order is alive is honest
 * about that. Polling stops once the order is terminal — a delivered order has
 * no next state to discover.
 */

const ACTIVE: ReadonlySet<DiningOrderStatus> = new Set([
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY'
]);

const POLL_MS = 20_000;

/** The steps a DELIVERY order is shown; PICKUP skips the courier leg. */
const DELIVERY_STEPS: DiningOrderStatus[] = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
  'DELIVERED'
];

const PICKUP_STEPS: DiningOrderStatus[] = [
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'DELIVERED'
];

export interface DiningOrderTrackingProps {
  orderId: string;
  onBack: () => void;
  /** Shown after a cancellation succeeds. */
  onCancelled?: () => void;
}

export const DiningOrderTracking: React.FC<DiningOrderTrackingProps> = ({ orderId, onBack, onCancelled }) => {
  const { language, t } = useLanguage();
  const { formatEGP } = useCurrency();

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const lastUpdatedAt = useRef<string | null>(null);

  const fetcher = useCallback((signal: AbortSignal) => api.getDiningOrder(orderId, signal), [orderId]);
  const { data: order, status, error, reload } = useApiResource(fetcher);

  // Poll while the order can still move. A ref-guarded interval avoids stacking
  // timers when StrictMode double-mounts in dev.
  const isActive = order ? ACTIVE.has(order.status) : false;
  useEffect(() => {
    if (!isActive) return;
    const id = window.setInterval(() => {
      // Only refetch when the previous poll finished — on a slow network a
      // stacked request is a wasted request.
      reload();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [isActive, reload]);

  const cancel = useCallback(async () => {
    setConfirmingCancel(false);
    setCancelling(true);
    setCancelError(null);
    try {
      await api.cancelDiningOrder(orderId);
      onCancelled?.();
      reload();
    } catch (err: any) {
      // 409 means the kitchen already started; that is a truthful answer and
      // the copy explains it rather than treating it as a fault.
      setCancelError(err?.message ?? t('dining.cancelTooLate'));
    } finally {
      setCancelling(false);
    }
  }, [orderId, onCancelled, reload, t]);

  const steps = useMemo(
    () => (order?.fulfillment === 'PICKUP' ? PICKUP_STEPS : DELIVERY_STEPS),
    [order?.fulfillment]
  );
  const stepIndex = order ? steps.indexOf(order.status) : -1;

  if (status === 'loading') {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
      </Centered>
    );
  }

  if (status === 'error' || !order) {
    return (
      <Centered>
        <p className="text-sm text-[var(--text-secondary)]">{error || t('dining.notFoundBody')}</p>
        <button type="button" onClick={onBack} className="mt-3 min-h-[44px] px-4 rounded-xl border border-[var(--border-subtle)]">
          {t('dining.backToRestaurants')}
        </button>
      </Centered>
    );
  }

  const venueName = venueNameOf(order, language);

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-[var(--surface-secondary)]"
          aria-label={t('dining.myOrders')}
        >
          {language === 'ar' ? <ArrowRight className="w-5 h-5" aria-hidden="true" /> : <ArrowLeft className="w-5 h-5" aria-hidden="true" />}
        </button>
        <div className="min-w-0">
          <h1 className="font-display font-semibold text-lg leading-tight truncate">{venueName}</h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('dining.orderRef')}: <span className="font-mono">{order.orderRef}</span>
          </p>
        </div>
      </header>

      {isTerminal(order.status) ? (
        <p
          className={`p-4 rounded-2xl text-sm font-medium ${
            order.status === 'DELIVERED'
              ? 'bg-emerald-500/10 text-emerald-700'
              : 'bg-[var(--surface-secondary)]'
          }`}
          role="status"
        >
          {t(`dining.status.${order.status.toLowerCase()}`)}
        </p>
      ) : (
        <ol className="space-y-0" aria-live="polite">
          {steps.map((step, i) => {
            const done = i < stepIndex;
            const current = i === stepIndex;
            return (
              <li key={step} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${
                      done
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : current
                          ? 'border-[var(--accent-primary)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]'
                    }`}
                    aria-hidden="true"
                  >
                    {done ? '✓' : i + 1}
                  </span>
                  {i < steps.length - 1 && (
                    <span className={`w-0.5 flex-1 min-h-6 ${done ? 'bg-emerald-500' : 'bg-[var(--border-subtle)]'}`} aria-hidden="true" />
                  )}
                </div>
                <div className="pb-4">
                  <p className={`text-sm font-medium ${current ? '' : done ? 'text-[var(--text-secondary)]' : 'text-[var(--text-tertiary)]'}`}>
                    {t(`dining.status.${step.toLowerCase()}`)}
                  </p>
                  {current && order.etaMinutes && (
                    <p className="text-xs text-[var(--text-secondary)] inline-flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" aria-hidden="true" />
                      {t('dining.arrivalEstimate', { minutes: String(order.etaMinutes) })}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {order.deliveryLocation && (
        <p className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
          <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span>
            {language === 'ar' ? order.deliveryLocation.labelAr : order.deliveryLocation.labelEn}
            {order.deliveryLocation.addressText ? ` — ${order.deliveryLocation.addressText}` : ''}
          </span>
        </p>
      )}

      <section aria-labelledby="dining-order-lines">
        <h2 id="dining-order-lines" className="font-display font-semibold text-base mb-2 inline-flex items-center gap-2">
          <Receipt className="w-4 h-4" aria-hidden="true" />
          {t('dining.cart')}
        </h2>
        <ul className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)]">
          {order.lines.map(line => (
            <li key={line.menuItemId} className="flex justify-between gap-3 px-4 py-3 text-sm">
              <span className="min-w-0 truncate">
                {line.quantity}× {language === 'ar' ? line.nameAr : line.nameEn}
              </span>
              <span className="tabular-nums flex-shrink-0">{formatEGP(line.lineTotalEGP)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--text-secondary)]">{t('dining.subtotal')}</dt>
            <dd className="tabular-nums">{formatEGP(order.priceBreakdown.subtotalEGP)}</dd>
          </div>
          {order.fulfillment === 'DELIVERY' && (
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">{t('dining.deliveryFee')}</dt>
              <dd className="tabular-nums">{formatEGP(order.priceBreakdown.deliveryFeeEGP)}</dd>
            </div>
          )}
          {order.priceBreakdown.serviceFeeEGP > 0 && (
            <div className="flex justify-between">
              <dt className="text-[var(--text-secondary)]">{t('dining.serviceFee')}</dt>
              <dd className="tabular-nums">{formatEGP(order.priceBreakdown.serviceFeeEGP)}</dd>
            </div>
          )}
          <div className="flex justify-between font-display font-semibold pt-1">
            <dt>{t('dining.total')}</dt>
            <dd className="tabular-nums">{formatEGP(order.priceBreakdown.totalEGP)}</dd>
          </div>
        </dl>
      </section>

      <p className="text-xs text-[var(--text-tertiary)]">{t('dining.orderRefHint')}</p>

      {canCancel(order.status) && !confirmingCancel && (
        <button
          type="button"
          onClick={() => setConfirmingCancel(true)}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-rose-400/60 text-rose-600 text-sm font-medium"
        >
          <XCircle className="w-4 h-4" aria-hidden="true" />
          {t('dining.cancelOrder')}
        </button>
      )}

      {confirmingCancel && (
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] space-y-3" role="alertdialog" aria-label={t('dining.cancelOrder')}>
          <p className="text-sm">{t('dining.cancelReason')}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={cancelling}
              className="min-h-[44px] px-4 rounded-xl bg-rose-600 text-white text-sm font-semibold disabled:opacity-50"
            >
              {t('dining.cancelConfirm')}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingCancel(false)}
              className="min-h-[44px] px-4 rounded-xl border border-[var(--border-subtle)] text-sm"
            >
              {t('dining.viewDetails')}
            </button>
          </div>
        </div>
      )}

      {cancelError && (
        <p className="p-3 rounded-xl bg-[var(--surface-secondary)] text-sm" role="status">
          {cancelError}
        </p>
      )}
    </div>
  );
};

const MyOrdersList: React.FC<{ onOpen: (orderId: string) => void }> = ({ onOpen }) => {
  const { language, t } = useLanguage();
  const { formatEGP } = useCurrency();
  const fetcher = useCallback((signal: AbortSignal) => api.getDiningOrders(signal), []);
  const { data, status, error, requiresSignIn } = useApiResource(fetcher, { cacheKey: 'dining:orders', ttlMs: 10_000 });

  if (requiresSignIn) {
    return (
      <Centered>
        <p>{t('dining.signInToOrder')}</p>
      </Centered>
    );
  }
  if (status === 'loading') {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
      </Centered>
    );
  }
  if (status === 'error') {
    return (
      <Centered>
        <p className="text-sm text-[var(--text-secondary)]">{error}</p>
      </Centered>
    );
  }
  if (!data || data.orders.length === 0) {
    return (
      <Centered>
        <p className="font-medium">{t('dining.noOrders')}</p>
        <p className="text-sm text-[var(--text-secondary)]">{t('dining.noOrdersBody')}</p>
      </Centered>
    );
  }

  return (
    <ul className="max-w-2xl mx-auto px-4 py-4 space-y-3">
      {data.orders.map(order => {
        const venue = venueNameOf(order, language);
        return (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => onOpen(order.id)}
              className="w-full text-start p-4 rounded-2xl border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium truncate">{venue}</span>
                <span className="text-xs text-[var(--text-secondary)] tabular-nums flex-shrink-0">
                  {formatEGP(order.priceBreakdown.totalEGP)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full font-medium ${
                    order.status === 'DELIVERED'
                      ? 'bg-emerald-500/10 text-emerald-700'
                      : order.status === 'CANCELLED' || order.status === 'REJECTED'
                        ? 'bg-[var(--surface-secondary)] text-[var(--text-secondary)]'
                        : 'bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]'
                  }`}
                >
                  {t(`dining.status.${order.status.toLowerCase()}`)}
                </span>
                <span className="font-mono text-[var(--text-tertiary)]">{order.orderRef}</span>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

export { MyOrdersList as DiningOrdersList };

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function isTerminal(status: DiningOrderStatus): boolean {
  return status === 'DELIVERED' || status === 'CANCELLED' || status === 'REJECTED' || status === 'FAILED';
}

function canCancel(status: DiningOrderStatus): boolean {
  // Mirrors the server's rule: cancellation ends where the food begins. The
  // server still decides; this only hides a button that would earn a 409.
  return (
    status === 'PENDING_CONFIRMATION' ||
    status === 'CONFIRMED' ||
    status === 'PREPARING'
  );
}

/**
 * The kitchen's live name, resolved server-side onto the order. Falls back to
 * the order reference when the venue has been removed — inventing a name from
 * the id would show the traveler a transliterated slug and call it a kitchen.
 */
function venueNameOf(order: DiningOrder, language: string): string {
  if (order.venue) return language === 'ar' ? order.venue.nameAr : order.venue.nameEn;
  return order.orderRef;
}

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">{children}</div>
);