import React, { useCallback, useMemo, useState } from 'react';
import { Clock, MapPin, Moon, Sparkles, Wallet, ArrowUpRight } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { useApiResource } from '../../hooks/useApiResource';
import { api } from '../../services/api';
import { ConciergePageHeader } from '../concierge/ConciergePageHeader';
import { PartyZoneMap } from './PartyZoneMap';
import { PartyDetailView } from './PartyDetailView';
import {
  PARTY_CATEGORY_COLORS,
  PARTY_ZONE_INFO,
  type PartyCategory,
  type PartyListResponse,
  type PartyTonightResponse,
  type PartyView,
  type PartyZone
} from '../../shared/dahabParties';

/**
 * Dahab Tonight — the nightlife home.
 *
 * Dark by default whatever the app theme says: this is a screen about 22:00,
 * and a bright "parties" page reads as a broken promise. The zone map is the
 * orientation layer (which part of the coast is awake tonight), the chips are
 * the vibe filter, and the cards promise what Dahab actually sells: a start
 * time, a meeting point, and a price in EGP.
 *
 * Dual pricing (spec): EGP is the anchor figure everywhere; the USD toggle is
 * a display convenience for the 70% foreign audience, never a conversion the
 * client computes — the server sends priceUsd or it does not.
 */

type VibeFilter = 'all' | 'tonight' | 'free' | PartyCategory;

const VIBE_CHIPS: { id: VibeFilter; key: string }[] = [
  { id: 'all', key: 'parties.filter.all' },
  { id: 'tonight', key: 'parties.filter.tonight' },
  { id: 'free', key: 'parties.filter.free' },
  { id: 'full_moon_desert', key: 'parties.category.full_moon_desert' },
  { id: 'beach_bar_live', key: 'parties.category.beach_bar_live' },
  { id: 'psytrance_weekly', key: 'parties.category.psytrance_weekly' },
  { id: 'wellness_party', key: 'parties.category.wellness_party' },
  { id: 'bonfire_community', key: 'parties.category.bonfire_community' },
  { id: 'night_adventure', key: 'parties.category.night_adventure' },
  { id: 'rooftop_chill', key: 'parties.category.rooftop_chill' }
];

export const PartiesView: React.FC = () => {
  const { currentParams, navigateTo } = useTrip();
  const { language, t } = useLanguage();
  const isAr = language === 'ar';

  // The server owns the 6h cache (spec: tonight in <2s on weak internet) and
  // reports it via fromCache/cachedUntil; a client-side cache on top would
  // mask admin catalogue updates for hours, so none is layered here.
  const tonight = useApiResource<PartyTonightResponse>(
    useCallback((signal: AbortSignal) => api.getDahabPartyTonight(undefined, signal), [])
  );

  const [vibe, setVibe] = useState<VibeFilter>('all');
  const [zone, setZone] = useState<PartyZone | null>(null);
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');

  const catalogue = useApiResource<PartyListResponse>(
    useCallback(
      (signal: AbortSignal) =>
        api.getDahabParties(
          {
            ...(vibe === 'tonight' ? { tonight: true } : {}),
            ...(vibe === 'free' ? { freeOnly: true } : {}),
            ...(vibe !== 'all' && vibe !== 'tonight' && vibe !== 'free' ? { category: vibe } : {}),
            ...(zone ? { zone } : {})
          },
          signal
        ),
      [vibe, zone]
    )
  );

  const parties = catalogue.data?.parties ?? [];
  const tonightParties = tonight.data?.parties ?? [];

  /** Detail wins when the URL carries a party slug (RentalsView pattern). */
  const partySlug = currentParams.partySlug;
  if (partySlug) {
    return <PartyDetailView partyId={partySlug} onBack={() => navigateTo('/parties')} />;
  }

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0f1e] text-slate-100">
      <ConciergePageHeader
        eyebrow={t('parties.eyebrow')}
        title={t('parties.title')}
        subtitle={t('parties.subtitle')}
        image="/images/hero/gulf-sunset.jpg"
        imageAlt={t('parties.title')}
        compact
        meta={
          tonight.data ? (
            <span className="font-semibold text-white/70">
              {tonight.data.count} · {t('parties.tonightCount')}
            </span>
          ) : undefined
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cache honesty strip: Dahab internet is weak, and the spec prices
            tonight's list in <2s — so say when it came from the 6h cache. */}
        {catalogue.data?.fromCache && (
          <p className="mb-4 text-[11px] font-semibold text-amber-300/90 flex items-center gap-1.5">
            <Moon className="w-3 h-3" aria-hidden="true" />
            {t('parties.cacheNote')}
          </p>
        )}

        {/* Zone map — orientation before list. */}
        <div className="mb-6">
          <PartyZoneMap
            parties={parties.length > 0 ? parties : tonightParties}
            activeZone={zone}
            onSelectZone={setZone}
          />
        </div>

        {/* Vibe chips */}
        <div className="flex flex-wrap items-center gap-2 mb-6" role="tablist" aria-label={t('parties.filter.groupLabel')}>
          {VIBE_CHIPS.map(chip => {
            const active = vibe === chip.id;
            const color = chip.id !== 'all' && chip.id !== 'tonight' && chip.id !== 'free'
              ? PARTY_CATEGORY_COLORS[chip.id as PartyCategory]
              : undefined;
            return (
              <button
                key={chip.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setVibe(chip.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                  active
                    ? 'text-slate-950 border-transparent'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/30'
                }`}
                style={active ? { backgroundColor: color ?? '#fbbf24' } : undefined}
              >
                {t(chip.key)}
              </button>
            );
          })}

          {/* Dual pricing toggle */}
          <div className="ms-auto flex items-center rounded-full border border-white/10 bg-white/5 p-0.5" role="group" aria-label={t('parties.currencyToggle')}>
            {(['EGP', 'USD'] as const).map(cur => (
              <button
                key={cur}
                type="button"
                aria-pressed={currency === cur}
                onClick={() => setCurrency(cur)}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold cursor-pointer ${
                  currency === cur ? 'bg-slate-100 text-slate-950' : 'text-slate-400'
                }`}
              >
                {cur === 'EGP' ? t('parties.currencyEgp') : t('parties.currencyUsd')}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {catalogue.status === 'loading' && parties.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">{t('cmd.loading')}</div>
        ) : parties.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">{t('parties.noMatches')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {parties.map(party => (
              <PartyCard
                key={party.id}
                party={party}
                currency={currency}
                isTonight={tonightParties.some(p => p.id === party.id)}
                onOpen={() => navigateTo('/parties', { partySlug: party.id })}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const PartyCard: React.FC<{
  party: PartyView;
  currency: 'EGP' | 'USD';
  isTonight: boolean;
  onOpen: () => void;
}> = ({ party, currency, isTonight, onOpen }) => {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const name = isAr ? party.nameAr : party.nameEn;
  const zoneInfo = PARTY_ZONE_INFO[party.zone];
  const priceLabel =
    party.priceModel === 'free'
      ? t('parties.price.free')
      : currency === 'USD' && party.priceUsd !== undefined
        ? `$${party.priceUsd}`
        : `${party.priceEgp} ${t('parties.currencyEgp')}`;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group text-start rounded-3xl overflow-hidden border border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      aria-label={name}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {party.imageUrls[0] ? (
          <img
            src={party.imageUrls[0]}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1b2540] to-[#0b1020]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-transparent to-transparent" />
        {isTonight && (
          <span className="absolute top-3 start-3 px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-extrabold flex items-center gap-1">
            <Moon className="w-3 h-3" aria-hidden="true" />
            {t('parties.tonight')}
          </span>
        )}
        {party.isFeatured && (
          <span className="absolute top-3 end-3 px-2 py-1 rounded-full bg-white/15 backdrop-blur text-white text-[10px] font-extrabold flex items-center gap-1">
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            {t('parties.featured')}
          </span>
        )}
        <span
          aria-hidden="true"
          className="absolute bottom-3 start-3 w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: PARTY_CATEGORY_COLORS[party.category] }}
        />
        <span className="absolute bottom-3 end-3 flex items-center gap-1 text-[11px] font-bold text-white/90">
          <Clock className="w-3 h-3" aria-hidden="true" />
          {party.startTime}
        </span>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-extrabold leading-snug text-slate-100">{name}</h3>
          <span className="shrink-0 text-sm font-extrabold text-amber-300">{priceLabel}</span>
        </div>

        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
          <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{isAr ? zoneInfo.nameAr : zoneInfo.nameEn} · {party.venueName}</span>
        </div>

        {/* Meeting point, never hotel pickup — the Dahab contract. */}
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
          <Wallet className="w-3 h-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {t('parties.meetingPointShort')}: {party.meetingPointName}
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {party.vibeTags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">
              {t(`parties.vibe.${tag}`)}
            </span>
          ))}
          {party.priceModel === 'ticket' && party.transportEgp !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">
              +{party.transportEgp} {t('parties.transportShort')}
            </span>
          )}
        </div>

        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-amber-300/90">
          {t('parties.viewDetails')}
          <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
        </span>
      </div>
    </button>
  );
};
