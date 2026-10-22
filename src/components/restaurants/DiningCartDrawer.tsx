import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useDiningCart } from '../../context/DiningCartContext';
import type { DiningOrderLine } from '../../types/dining';

/**
 * The basket, and the quote that prices it.
 *
 * Nothing here computes a price. The line prices come from a server quote, and
 * the subtotal rendered is the SERVER's subtotal echoed back. The quantity
 * steppers mutate local quantities only; the next quote replaces every number
 * on screen.
 *
 * That is the whole design constraint. A cart that sums unitPrice × quantity in
 * the browser will eventually disagree with the server — through a stale
 * cached menu, a rounding rule change, or a tampered request — and the traveler
 * sees two different totals for the same basket.
 */

export interface DiningCartDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Priced lines from the server quote. The cart context only knows ids, so
   *  the names and any per-line notes come from here. */
  lines: DiningOrderLine[];
  subtotalEGP: number | null;
  deliveryFeeEGP: number | null;
  serviceFeeEGP: number | null;
  totalEGP: number | null;
  /** Set while the quote is in flight, so the total does not read as final. */
  pricing: boolean;
  /** The kitchen's name, shown under the confirm button. */
  venueName: string;
  onCheckout: () => void;
  /** True while the order is being placed, to disable the confirm button. */
  placing?: boolean;
}

export const DiningCartDrawer: React.FC<DiningCartDrawerProps> = ({
  open,
  onClose,
  lines,
  subtotalEGP,
  deliveryFeeEGP,
  serviceFeeEGP,
  totalEGP,
  pricing,
  venueName,
  onCheckout,
  placing
}) => {
  const { language, t } = useLanguage();
  const { formatEGP } = useCurrency();
  const { itemCount, increment, decrement, remove } = useDiningCart();

  const pricedById = useMemo(
    () => new Map(lines.map(l => [l.menuItemId, l])),
    [lines]
  );
  const hasLines = lines.length > 0;
  const money = useMemo(
    () => (amount: number | null) => (amount === null ? '—' : formatEGP(amount)),
    [formatEGP]
  );

  if (!open) return null;

  // Portaled to <body> for the same reason as the order bar: inside the app's
  // <main> (z-10 stacking context) a z-[70] drawer still loses to the bottom
  // tab bar (z-40) on a phone, so the tab bar would paint over the modal.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label={t('dining.cart')}>
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label={t('common.close')}
      />

      <aside className="relative z-10 h-full w-full max-w-md flex flex-col bg-[var(--surface-primary)] shadow-2xl">
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2 min-w-0">
            <ShoppingBag className="w-5 h-5 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-display font-semibold text-lg leading-tight truncate">{t('dining.cart')}</h2>
              {hasLines && (
                <p className="text-xs text-[var(--text-secondary)] truncate">
                  {t('dining.itemsInCart', { count: String(itemCount) })}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]"
            aria-label={t('common.close')}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </header>

        {!hasLines ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center">
            <ShoppingBag className="w-10 h-10 text-[var(--text-tertiary)]" aria-hidden="true" />
            <p className="font-medium">{t('dining.cartEmpty')}</p>
            <p className="text-sm text-[var(--text-secondary)]">{t('dining.cartEmptyBody')}</p>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
              {lines.map(line => (
                <CartRow
                  key={line.menuItemId}
                  name={language === 'ar' ? line.nameAr : line.nameEn}
                  quantity={line.quantity}
                  onIncrement={() => increment(line.menuItemId)}
                  onDecrement={() => decrement(line.menuItemId)}
                  onRemove={() => remove(line.menuItemId)}
                />
              ))}
            </ul>

            <footer className="border-t border-[var(--border-subtle)] px-5 py-4 space-y-2">
              <PriceRow label={t('dining.subtotal')} value={money(subtotalEGP)} muted />
              {deliveryFeeEGP !== null && (
                <PriceRow
                  label={t('dining.deliveryFee')}
                  value={deliveryFeeEGP === 0 ? t('dining.free') : money(deliveryFeeEGP)}
                  muted
                />
              )}
              {serviceFeeEGP !== null && serviceFeeEGP > 0 && (
                <PriceRow label={t('dining.serviceFee')} value={money(serviceFeeEGP)} muted />
              )}
              <div className="flex items-baseline justify-between pt-2 border-t border-[var(--border-subtle)]">
                <span className="font-display font-semibold text-base">{t('dining.total')}</span>
                {/* While re-pricing, the previous total is withheld rather than
                    shown: a stale number under a spinner reads as the real one. */}
                <span className="font-display font-semibold text-lg" aria-live="polite" aria-busy={pricing}>
                  {pricing ? '…' : money(totalEGP)}
                </span>
              </div>
              <button
                type="button"
                onClick={onCheckout}
                disabled={placing || pricing || lines.length === 0}
                className="w-full mt-2 min-h-[48px] rounded-xl bg-[var(--accent-primary)] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placing ? t('dining.placing') : t('dining.checkout')}
              </button>
              <p className="text-[11px] text-[var(--text-tertiary)] text-center pt-1 truncate">
                {venueName}
              </p>
            </footer>
          </>
        )}
      </aside>
    </div>,
    document.body
  );
};

const CartRow: React.FC<{
  name: string;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}> = ({ name, quantity, onIncrement, onDecrement, onRemove }) => {
  const { t } = useLanguage();
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <span className="flex-1 min-w-0 text-sm font-medium truncate">{name}</span>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onDecrement}
          aria-label={t('dining.decrease', 'قلّل {item}').replace('{item}', name)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-[var(--border-subtle)] flex items-center justify-center"
        >
          {/* At quantity 1 there is nothing to decrement, so this becomes the
              remove control. Labelled per-action either way. */}
          {quantity <= 1 ? <Trash2 className="w-4 h-4" aria-hidden="true" /> : <Minus className="w-4 h-4" aria-hidden="true" />}
        </button>
        <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-live="polite">{quantity}</span>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={t('dining.increase', 'زوّد {item}').replace('{item}', name)}
          className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full border border-[var(--border-subtle)] flex items-center justify-center"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
};

const PriceRow: React.FC<{ label: string; value: string; muted?: boolean }> = ({ label, value, muted }) => (
  <div className="flex items-baseline justify-between text-sm">
    <span className={muted ? 'text-[var(--text-secondary)]' : ''}>{label}</span>
    <span className={muted ? 'text-[var(--text-secondary)]' : ''}>{value}</span>
  </div>
);