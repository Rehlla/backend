import React, { useState } from 'react';
import { MapPin, Loader2, Crosshair, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useDeliveryLocation } from '../../context/DeliveryLocationContext';
import type { DiningVenueDeliveryZone } from '../../types/dining';

/**
 * "Where should we bring it" — the step that turns a menu into an order.
 *
 * Two design decisions worth stating, because both were argued about:
 *
 * 1. The zone list is ALWAYS rendered, even before any detection and even after
 *    a refusal. The browser prompt is an offer at the top of a choice, never a
 *    gate in front of one. On a Sinai mobile network a fix can take 8 seconds
 *    or never arrive, and a screen that opens with a permission dialog and
 *    hides the alternatives turns "slow GPS" into "this app is broken".
 *
 * 2. Prices shown next to a zone come from the server, per kitchen. Two
 *    restaurants in the same neighbourhood quote different drops, so the fee
 *    can never be derived from the zone alone.
 */

export interface DiningLocationPromptProps {
  /** Zones this kitchen actually delivers to. Empty means pickup only. */
  zones: DiningVenueDeliveryZone[];
  venueName: string;
  /** Called once the kitchen has confirmed it reaches this zone, with the fee. */
  onZoneChosen: (zoneId: string) => void;
  /** The zone currently priced, so the list can mark it. */
  selectedZoneId?: string;
  /** True while the zone lookup is in flight. */
  resolving?: boolean;
}

export const DiningLocationPrompt: React.FC<DiningLocationPromptProps> = ({
  zones,
  venueName,
  onZoneChosen,
  selectedZoneId,
  resolving
}) => {
  const { language, t } = useLanguage();
  const { formatEGP } = useCurrency();
  const { state, location, detect, chooseZone } = useDeliveryLocation();
  const [addressText, setAddressText] = useState(location?.addressText ?? '');

  const hasZones = zones.length > 0;

  return (
    <section className="space-y-4" aria-labelledby="dining-location-heading">
      <h3 id="dining-location-heading" className="font-display font-semibold text-base">
        {t('dining.whereDeliver')}
      </h3>

      {/* Offer first, not gate — but only when there is something to deliver.
          A pickup-only kitchen has no destination to resolve, and offering a
          browser permission for it is noise. */}
      {hasZones && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void detect()}
            disabled={state === 'detecting'}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl border border-[var(--border-subtle)] font-medium disabled:opacity-60"
          >
            {state === 'detecting' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Crosshair className="w-4 h-4" aria-hidden="true" />
            )}
            {state === 'detecting' ? t('dining.detecting') : t('dining.useMyLocation')}
          </button>

          {location && (
            <span className="text-sm text-[var(--text-secondary)]" aria-live="polite">
              {location.zoneId
                ? t('dining.zoneResolved', { zone: zoneLabel(zones, location.zoneId, language) })
                : t('dining.zoneResolved', { zone: t('dining.useMyLocation') })}
            </span>
          )}
        </div>
      )}

      {/* A refusal is a fact about the device, not a fault to apologise for. */}
      {state === 'denied' && (
        <p className="flex items-start gap-2 text-sm text-[var(--text-secondary)]" role="status">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          {t('dining.locationDenied')}
        </p>
      )}
      {state === 'failed' && (
        <p className="flex items-start gap-2 text-sm text-[var(--text-secondary)]" role="status">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          {t('dining.locationFailed')}
        </p>
      )}

      {hasZones ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-[var(--text-secondary)]">{t('dining.pickYourArea')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {zones.map(zone => {
              const selected = selectedZoneId === zone.zoneId || location?.zoneId === zone.zoneId;
              return (
                <button
                  key={zone.zoneId}
                  type="button"
                  onClick={() => {
                    chooseZone(zone.zoneId, addressText || undefined);
                    onZoneChosen(zone.zoneId);
                  }}
                  aria-pressed={selected}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition-colors ${
                    selected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/8'
                      : 'border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/50'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <MapPin className="w-4 h-4 flex-shrink-0 text-[var(--accent-primary)]" aria-hidden="true" />
                    <span className="truncate text-sm font-medium">
                      {language === 'ar' ? zone.labelAr : zone.labelEn}
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-xs text-[var(--text-secondary)] tabular-nums">
                    {formatEGP(zone.feeEGP)} · {t('dining.arrivalEstimate', { minutes: String(zone.etaMinutes) })}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : (
        <p className="text-sm text-[var(--text-secondary)]">{t('dining.pickupOnly')}</p>
      )}

      <label className="block">
        <span className="text-sm text-[var(--text-secondary)]">{t('dining.addAddressDetails')}</span>
        <input
          type="text"
          value={addressText}
          onChange={e => setAddressText(e.target.value)}
          placeholder={t('dining.addressPlaceholder')}
          maxLength={300}
          className="mt-1 w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-primary)] px-3 text-sm"
        />
      </label>

      {resolving && (
        <p className="text-sm text-[var(--text-secondary)]" role="status">
          {t('dining.detecting')}…
        </p>
      )}

      <p className="sr-only">{venueName}</p>
    </section>
  );
};

function zoneLabel(zones: DiningVenueDeliveryZone[], zoneId: string, language: string): string {
  const zone = zones.find(z => z.zoneId === zoneId);
  if (!zone) return zoneId;
  return language === 'ar' ? zone.labelAr : zone.labelEn;
}