import * as React from 'react';
import { cn } from '@/lib/cn';
import { useCurrency } from '../../context/CurrencyContext';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * PriceTag — the one way a price is shown to a traveler (plan §09).
 *
 *   EGP 1,400 per person
 *   ≈ $29
 *
 * The EGP amount is what gets charged and always comes first; the converted
 * line follows the traveler's display currency and carries "≈" while rates
 * are indicative. Amounts must come from the server (catalogue / explain-price),
 * never be computed here.
 */
export interface PriceTagProps {
  amountEGP: number;
  unit?: 'perPerson' | 'perNight' | 'total';
  /** "from EGP 1,400" for ranges and packages. */
  from?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Hide the converted line (e.g. map pins, dense tables). */
  egpOnly?: boolean;
  /** Stack the converted line under the main amount (default) or inline. */
  layout?: 'stack' | 'inline';
  className?: string;
}

const UNIT_KEYS = {
  perPerson: 'ui.price.perPerson',
  perNight: 'ui.price.perNight',
  total: 'ui.price.total',
} as const;

export const PriceTag: React.FC<PriceTagProps> = ({
  amountEGP,
  unit,
  from = false,
  size = 'md',
  egpOnly = false,
  layout = 'stack',
  className,
}) => {
  const { formatEGP, formatDisplay, approximate } = useCurrency();
  const { t } = useLanguage();
  const converted = egpOnly ? null : formatDisplay(amountEGP);

  return (
    <span className={cn('inline-flex min-w-0', layout === 'stack' ? 'flex-col' : 'flex-row flex-wrap items-baseline gap-x-2', className)}>
      <span aria-label={unit ? `Price ${unit === "perPerson" ? "per person" : unit === "perNight" ? "per night" : "total"}` : "Price"} role="text" className="inline-flex items-baseline gap-1.5 flex-wrap">  /* Apple HIG accessibility: price context label */
        {from && <span className="text-sm text-dg-ink-3  /* Apple HIG typography: 14px = text-sm, closer to Apple Small (15pt) */">{t('ui.price.from')}</span>}
        <span
          dir="ltr"
          className={cn(
            'font-semibold tabular-nums text-dg-ink [unicode-bidi:isolate]',
            size === 'sm' && 'text-[0.9375rem]',
            size === 'md' && 'text-[1.0625rem]',
            size === 'lg' && 'text-[1.375rem]'  /* Apple HIG: lg = Title2 scale; consider glass/surface pill for display prominence */,
          )}
        >
          {formatEGP(amountEGP)}
        </span>
        {unit && <span className="text-sm text-dg-ink-3  /* Apple HIG typography: 14px = text-sm, closer to Apple Small (15pt) */">{t(UNIT_KEYS[unit])}</span>}
      </span>
      {converted && (
        <span className="text-sm text-dg-ink-3  /* Apple HIG typography: 14px = text-sm, closer to Apple Small (15pt) */ tabular-nums">
          {approximate ? t('ui.price.about', { amount: converted }) : converted}
        </span>
      )}
    </span>
  );
};
