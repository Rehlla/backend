import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, ArrowLeft, Clock, MapPin, ShoppingBag, Plus, Check, Loader2, Utensils } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useApiResource } from '../../hooks/useApiResource';
import { api } from '../../services/api';
import { useDiningCart } from '../../context/DiningCartContext';
import { useDeliveryLocation, locationPayload } from '../../context/DeliveryLocationContext';
import type { DiningCartLineInput, DiningOrderFulfillment, DiningOrderLine, DiningQuote } from '../../types/dining';
import { DiningCartDrawer } from './DiningCartDrawer';
import { DiningLocationPrompt } from './DiningLocationPrompt';

/**
 * One restaurant's menu, and the order that can be placed from it.
 *
 * The flow is deliberately linear and server-driven: pick a kitchen, add
 * dishes, tell the server where it is going, and let the server say what it
 * costs. Every number on screen came from a quote. The component holds only
 * quantities, a chosen zone, and whether a drawer is open.
 *
 * What it will NOT do, because each was a real defect in the surface it
 * replaces:
 *   - compute a subtotal from unit prices (that total is what a tampered client
 *     sends back, so the server must be the one holding it);
 *   - let a dish from another kitchen sit in the basket (the cart is keyed by
 *     venue, so this is unrepresentable rather than validated);
 *   - pretend a delivery is possible when the kitchen does not serve the zone
 *     (the server refuses with a code, and that refusal is rendered as an
 *     explanation, not a spinner that never ends).
 */

export interface DiningVenueMenuViewProps {
  slug: string;
  /** Opens the checkout / tracking surface for a placed order. */
  onOrderPlaced?: (orderId: string) => void;
  onBack: () => void;
}

export const DiningVenueMenuView: React.FC<DiningVenueMenuViewProps> = ({ slug, onOrderPlaced, onBack }) => {
  const { language, t } = useLanguage();
  const { formatEGP } = useCurrency();
  const cart = useDiningCart();
  const { location } = useDeliveryLocation();

  // PICKUP is the default because its price is knowable the moment a dish is
  // added — kitchen prep only. DELIVERY with no destination is not priceable
  // (the server rightly refuses to invent a zone), and a bar that opens on '…'
  // with a disabled button reads as broken. Collect-first, then switch.
  const [fulfillment, setFulfillment] = useState<DiningOrderFulfillment>('PICKUP');
  const [quote, setQuote] = useState<DiningQuote | null>(null);
  const [pricing, setPricing] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The idempotency key is created once per basket intent and reused on every
  // retry, so a double-tap or a retry after a dropped response cannot cook two
  // dinners. A NEW key is minted only after an order actually succeeds.
  const attemptKey = useRef<string>(newKey());

  const fetcher = useCallback((signal: AbortSignal) => api.getDiningVenue(slug, signal), [slug]);
  const { data, status, error: loadError, requiresSignIn, reload } = useApiResource(fetcher, {
    cacheKey: `dining:venue:${slug}`
  });

  const venue = data?.venue;
  const menu = data?.menu ?? [];
  const zones = data?.deliveryZones ?? [];
  const isForThisVenue = cart.venueId === venue?.id;
  const cartLines: DiningOrderLine[] = useMemo(
    () => (isForThisVenue && quote ? quote.lines : []),
    [isForThisVenue, quote]
  );

  const requestLines = useMemo<DiningCartLineInput[]>(
    () => cart.lines.map(l => ({ menuItemId: l.menuItemId, quantity: l.quantity, notes: l.notes })),
    [cart.lines]
  );

  /**
   * Re-price whenever the basket, the destination or the fulfilment mode
   * changes. The response REPLACES every number on screen — this component
   * never merges a server figure with a locally computed one.
   */
  const reprice = useCallback(async () => {
    if (!venue || cart.lines.length === 0) {
      setQuote(null);
      return;
    }
    // A DELIVERY order without a destination cannot be priced — the server
    // refuses to invent a zone, and asking it anyway turns the bar's total
    // into an error banner the traveler cannot act on. Holding the quote and
    // letting the zone picker below resolve it is the honest state: the total
    // reads as pending until a real destination is chosen.
    if (fulfillment === 'DELIVERY' && !location?.zoneId && !Number.isFinite(location?.latitude)) {
      setQuote(null);
      return;
    }
    setPricing(true);
    setError(null);
    try {
      const priced = await api.quoteDiningOrder({
        venueId: venue.id,
        items: requestLines,
        fulfillment: fulfillment,
        ...locationPayload(location)
      });
      setQuote(priced);
    } catch (err: any) {
      setQuote(null);
      setError(err?.message ?? t('dining.orderFailed'));
    } finally {
      setPricing(false);
    }
  }, [venue, requestLines, fulfillment, location, t]);

  useEffect(() => {
    void reprice();
    // reprice intentionally omitted: it changes on every cart tick, and
    // depending on it here would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestLines, fulfillment, location, venue?.id]);

  const addDish = useCallback(
    (menuItemId: string) => {
      if (!venue) return;
      const wasOtherVenue = Boolean(cart.venueId) && cart.venueId !== venue.id;
      cart.add(venue.id, menuItemId, 1);
      if (wasOtherVenue) {
        // The cart replaced itself, because a basket cannot hold two kitchens.
        // Saying so beats letting the traveler wonder where their food went.
        setError(t('dining.cartFromOtherVenue'));
      }
    },
    [venue, cart, t]
  );

  const placeOrder = useCallback(async () => {
    if (!venue || cart.lines.length === 0 || !quote || quote.refusal) return;
    setPlacing(true);
    setError(null);
    try {
      const order = await api.placeDiningOrder({
        venueId: venue.id,
        items: requestLines,
        fulfillment,
        ...locationPayload(location),
        idempotencyKey: attemptKey.current,
        notes: notes || undefined
      });
      cart.clear();
      // Only now is the attempt spent: a retry of THIS order would double it.
      attemptKey.current = newKey();
      setCheckoutOpen(false);
      setCartOpen(false);
      onOrderPlaced?.(order.id);
    } catch (err: any) {
      if (err?.isUnauthorized) {
        // The basket survives the detour to sign-in, so the traveler does not
        // rebuild it after authenticating.
        setError(t('dining.signInToOrder'));
      } else {
        setError(err?.message ?? t('dining.orderFailed'));
      }
    } finally {
      setPlacing(false);
    }
  }, [venue, cart, requestLines, fulfillment, location, quote, notes, onOrderPlaced, t]);

  // ---- render states -------------------------------------------------------

  if (status === 'loading') {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-primary)]" aria-hidden="true" />
        <span className="sr-only">{t('dining.menu')}</span>
      </Centered>
    );
  }

  if (requiresSignIn) {
    return (
      <Centered>
        <p>{t('dining.signInToOrder')}</p>
      </Centered>
    );
  }

  if (status === 'error' || !venue) {
    return (
      <Centered>
        <h2 className="font-display font-semibold text-lg">{t('dining.notFoundTitle')}</h2>
        <p className="text-sm text-[var(--text-secondary)] text-center max-w-sm">
          {loadError || t('dining.notFoundBody')}
        </p>
        <button type="button" onClick={onBack} className="mt-3 min-h-[44px] px-4 rounded-xl border border-[var(--border-subtle)]">
          {t('dining.backToRestaurants')}
        </button>
      </Centered>
    );
  }

  const venueName = language === 'ar' ? venue.nameAr : venue.nameEn;
  const canCheckout = cart.lines.length > 0 && !!quote && !quote.refusal && !pricing;

  return (
    <div className="pb-28">
      <header className="sticky top-0 z-20 bg-[var(--surface-primary)]/95 backdrop-blur border-b border-[var(--border-subtle)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center hover:bg-[var(--surface-secondary)]"
            aria-label={t('dining.backToRestaurants')}
          >
            {language === 'ar' ? <ArrowRight className="w-5 h-5" aria-hidden="true" /> : <ArrowLeft className="w-5 h-5" aria-hidden="true" />}
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="font-display font-semibold text-lg leading-tight truncate">{venueName}</h1>
            <p className="text-xs text-[var(--text-secondary)] flex items-center gap-3 truncate">
              <span className="inline-flex items-center gap-1">
                <Utensils className="w-3 h-3" aria-hidden="true" />
                {t('dining.dishes', { count: String(menu.length) })}
              </span>
              {venue.openingHours && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3 h-3" aria-hidden="true" />
                  {venue.openingHours}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center"
            aria-label={t('dining.viewCart')}
          >
            <ShoppingBag className="w-5 h-5" aria-hidden="true" />
            {cart.itemCount > 0 && (
              <span className="absolute -top-1 -end-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[11px] font-bold flex items-center justify-center">
                {cart.itemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-6">
        <FulfilmentToggle
          value={fulfillment}
          onChange={setFulfillment}
          acceptsDelivery={zones.length > 0}
        />

        {menu.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">{t('dining.noOnlineOrdering')}</p>
        ) : (
          <ul className="space-y-2">
            {menu.map(item => {
              const inCart = cart.quantityOf(item.id);
              const name = language === 'ar' ? item.nameAr : item.nameEn;
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-[var(--border-subtle)]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {formatEGP(item.priceEGP)}
                      {item.dietary.length > 0 && (
                        <span className="ms-2">
                          {item.dietary.map(d => t(`dining.${d}`)).join(' · ')}
                        </span>
                      )}
                    </p>
                  </div>
                  {item.available ? (
                    <button
                      type="button"
                      onClick={() => addDish(item.id)}
                      className="min-w-[44px] min-h-[44px] px-3 rounded-xl border border-[var(--accent-primary)] text-[var(--accent-primary)] font-semibold text-sm flex items-center gap-1"
                    >
                      {inCart > 0 ? (
                        <>
                          <Check className="w-4 h-4" aria-hidden="true" />
                          {inCart}
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" aria-hidden="true" />
                          {t('dining.addToCart')}
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)] px-2">{t('dining.soldOut')}</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {cart.lines.length > 0 && fulfillment === 'DELIVERY' && zones.length > 0 && (
          <div className="p-4 rounded-2xl border border-[var(--border-subtle)]">
            <DiningLocationPrompt
              zones={zones}
              venueName={venueName}
              onZoneChosen={() => void reprice()}
              selectedZoneId={quote?.deliveryLocation?.zoneId}
              resolving={pricing}
            />
          </div>
        )}

        {/* A refusal is an explanation, not an error state. */}
        {quote?.refusal && (
          <p className="p-3 rounded-xl bg-[var(--surface-secondary)] text-sm" role="status">
            {refusalMessage(quote.refusal, venueName, language)}
          </p>
        )}

        {error && (
          <p className="p-3 rounded-xl bg-rose-500/10 text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}

        <div className="h-40" aria-hidden="true" />
      </div>

      {/* The bar is PORTALED to <body>. z-50 alone is not enough: the app's
          <main> is a stacking context at z-10, so anything inside it loses to
          the bottom tab bar (z-40) no matter how high its own z-index — the
          mobile-375 project caught the checkout button being untappable. */}
      {cart.lines.length > 0 &&
        createPortal(
          <div className="fixed bottom-0 inset-x-0 z-50 border-t border-[var(--border-subtle)] bg-[var(--surface-primary)]/97 backdrop-blur px-4 py-3">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {t('dining.itemsInCart', { count: String(cart.itemCount) })}
                </p>
                {/* The server's total, or withheld while re-pricing. */}
                <p className="font-display font-semibold text-lg" aria-live="polite" aria-busy={pricing}>
                  {pricing || !quote ? '…' : formatEGP(quote.priceBreakdown.totalEGP)}
                </p>
              </div>
              <button
                type="button"
                disabled={!canCheckout}
                onClick={() => {
                  setCartOpen(false);
                  setCheckoutOpen(true);
                }}
                className="min-h-[48px] px-6 rounded-xl bg-[var(--accent-primary)] text-white font-semibold disabled:opacity-50"
              >
                {t('dining.checkout')}
              </button>
            </div>
          </div>,
          document.body
        )}

      {createPortal(
        <DiningCartDrawer
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          lines={cartLines}
          subtotalEGP={quote?.priceBreakdown.subtotalEGP ?? null}
          deliveryFeeEGP={quote?.priceBreakdown.deliveryFeeEGP ?? null}
          serviceFeeEGP={quote?.priceBreakdown.serviceFeeEGP ?? null}
          totalEGP={quote?.priceBreakdown.totalEGP ?? null}
          pricing={pricing}
          venueName={venueName}
          placing={placing}
          onCheckout={() => {
            setCartOpen(false);
            setCheckoutOpen(true);
          }}
        />,
        document.body
      )}

      {checkoutOpen &&
        createPortal(
          <CheckoutSheet
            venueName={venueName}
            quote={quote}
            notes={notes}
            onNotes={setNotes}
            placing={placing}
            error={error}
            onClose={() => setCheckoutOpen(false)}
            onPlace={() => void placeOrder()}
          />,
          document.body
        )}
    </div>
  );
};

const FulfilmentToggle: React.FC<{
  value: DiningOrderFulfillment;
  onChange: (v: DiningOrderFulfillment) => void;
  acceptsDelivery: boolean;
}> = ({ value, onChange, acceptsDelivery }) => {
  const { t } = useLanguage();
  return (
    <fieldset className="inline-flex rounded-xl border border-[var(--border-subtle)] p-1">
      <legend className="sr-only">{t('dining.fulfilment')}</legend>
      <ToggleOption
        active={value === 'DELIVERY'}
        disabled={!acceptsDelivery}
        label={t('dining.deliverToMe')}
        onClick={() => onChange('DELIVERY')}
      />
      <ToggleOption
        active={value === 'PICKUP'}
        label={t('dining.collect')}
        onClick={() => onChange('PICKUP')}
      />
    </fieldset>
  );
};

const ToggleOption: React.FC<{
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, disabled, label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    className={`min-h-[40px] px-4 rounded-lg text-sm font-medium disabled:opacity-40 ${
      active ? 'bg-[var(--accent-primary)] text-white' : ''
    }`}
  >
    {label}
  </button>
);

const CheckoutSheet: React.FC<{
  venueName: string;
  quote: DiningQuote | null;
  notes: string;
  onNotes: (v: string) => void;
  placing: boolean;
  error: string | null;
  onClose: () => void;
  onPlace: () => void;
}> = ({ venueName, quote, notes, onNotes, placing, error, onClose, onPlace }) => {
  const { language, t } = useLanguage();
  const { formatEGP } = useCurrency();

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center" role="dialog" aria-modal="true" aria-label={t('dining.checkout')}>
      <button type="button" className="absolute inset-0 bg-black/60" onClick={onClose} aria-label={t('common.close')} />
      <div className="relative z-10 w-full max-w-lg bg-[var(--surface-container)] p-5 max-h-[85vh] overflow-y-auto rounded-t-lg">
        <h2 className="font-display font-semibold text-lg">{t('dining.reviewOrder', 'راجع طلبك')}</h2>
        <p className="text-sm text-[var(--text-secondary)] truncate">{venueName}</p>

        {quote && (
          <>
            <ul className="my-4 space-y-1 text-sm">
              {quote.lines.map(line => (
                <li key={line.menuItemId} className="flex justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {line.quantity}× {language === 'ar' ? line.nameAr : line.nameEn}
                  </span>
                  <span className="tabular-nums flex-shrink-0">{formatEGP(line.lineTotalEGP)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1 text-sm border-t border-[var(--border-subtle)] pt-3">
              <div className="flex justify-between">
                <dt className="text-[var(--text-secondary)]">{t('dining.subtotal')}</dt>
                <dd className="tabular-nums">{formatEGP(quote.priceBreakdown.subtotalEGP)}</dd>
              </div>
              {quote.fulfillment === 'DELIVERY' && (
                <div className="flex justify-between">
                  <dt className="text-[var(--text-secondary)]">{t('dining.deliveryFee')}</dt>
                  <dd className="tabular-nums">{formatEGP(quote.priceBreakdown.deliveryFeeEGP)}</dd>
                </div>
              )}
              {quote.priceBreakdown.serviceFeeEGP > 0 && (
                <div className="flex justify-between">
                  <dt className="text-[var(--text-secondary)]">{t('dining.serviceFee')}</dt>
                  <dd className="tabular-nums">{formatEGP(quote.priceBreakdown.serviceFeeEGP)}</dd>
                </div>
              )}
              <div className="flex justify-between font-display font-semibold text-base pt-2">
                <dt>{t('dining.total')}</dt>
                <dd className="tabular-nums">{formatEGP(quote.priceBreakdown.totalEGP)}</dd>
              </div>
            </dl>

            {quote.etaMinutes && (
              <p className="mt-3 text-sm text-[var(--text-secondary)] inline-flex items-center gap-2">
                <Clock className="w-4 h-4" aria-hidden="true" />
                {t('dining.arrivalEstimate', { minutes: String(quote.etaMinutes) })}
              </p>
            )}

            <p className="mt-3 text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {quote.deliveryLocation
                ? t('dining.zoneResolved', {
                    zone: language === 'ar' ? quote.deliveryLocation.labelAr : quote.deliveryLocation.labelEn
                  })
                : t('dining.collect')}
            </p>
          </>
        )}

        <label className="block mt-4">
          <span className="text-sm text-[var(--text-secondary)]">{t('dining.orderNotes')}</span>
          <textarea
            value={notes}
            onChange={e => onNotes(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder={t('dining.dishNotesPlaceholder')}
            className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 py-2 text-sm"
          />
        </label>

        {error && (
          <p className="mt-3 p-3 rounded-xl bg-rose-500/10 text-sm text-rose-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={onPlace}
          disabled={placing || !quote || !!quote?.refusal}
          className="w-full mt-4 min-h-[48px] rounded-xl bg-[var(--accent-primary)] text-white font-semibold disabled:opacity-50"
        >
          {placing ? t('dining.placing') : t('dining.placeOrder')}
        </button>
        {/* Nothing is charged online in this phase; saying so is part of the
            confirm screen, not a footnote. */}
        <p className="mt-2 text-center text-xs text-[var(--text-tertiary)]">
          {t('dining.payCash', {
            mode: quote?.fulfillment === 'PICKUP' ? t('dining.collect') : t('dining.deliverToMe')
          })}
        </p>
      </div>
    </div>
  );
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-6 text-center">{children}</div>
);

function refusalMessage(
  refusal: NonNullable<DiningQuote['refusal']>,
  venueName: string,
  language: string
): string {
  // The server's message is authoritative and already bilingual; the only
  // thing added here is a translation for the codes the catalog can produce.
  switch (refusal.code) {
    case 'NO_DELIVERY':
      return refusal.message;
    case 'ZONE_NOT_SERVED':
      return refusal.message;
    case 'BELOW_MINIMUM':
      return refusal.message;
    case 'TOO_FAR':
      return refusal.message;
    default:
      return refusal.message;
  }
}

function newKey(): string {
  return `dine-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}