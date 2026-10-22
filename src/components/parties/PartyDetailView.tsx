import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarDays, Clock, ExternalLink, Flame, Instagram, MapPin,
  Minus, Music, Plus, Users, Wallet
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useUI } from '../../context/UIContext';
import { api } from '../../services/api';
import {
  PARTY_CATEGORY_COLORS,
  PARTY_ZONE_INFO,
  partyMeetingPointMapUrl,
  type PartyView
} from '../../shared/dahabParties';

/**
 * Party detail — where the Dahab-specific promises get made.
 *
 * Meeting point card with a Google Maps handoff (never "hotel pickup");
 * dual pricing with the optional transport leg priced separately (the Full
 * Moon pattern); WhatsApp as the primary CTA whose message the SERVER renders;
 * "I'll just show up" for free nights; and the cash-on-the-spot disclaimer
 * that keeps expectations honest in a market that does not run cards.
 */

const todayLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Vibe meter position: chill=0 … high_energy=1; spiritual/romantic lean low, desert mid. */
function vibeMeterValue(party: PartyView): number {
  if (party.vibeTags.includes('high_energy')) return 1;
  if (party.vibeTags.includes('desert')) return 0.66;
  if (party.vibeTags.includes('community')) return 0.5;
  if (party.vibeTags.includes('romantic')) return 0.34;
  return 0.15;
}

export const PartyDetailView: React.FC<{ partyId: string; onBack: () => void }> = ({ partyId, onBack }) => {
  const { language, t } = useLanguage();
  const { showToast } = useUI();
  const isAr = language === 'ar';

  const [party, setParty] = useState<PartyView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currency, setCurrency] = useState<'EGP' | 'USD'>('EGP');
  const [withTransport, setWithTransport] = useState(false);
  const [persons, setPersons] = useState(1);
  const [date, setDate] = useState<string>(todayLocal());
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setParty(null);
    setError(null);
    api
      .getDahabParty(partyId, controller.signal)
      .then(res => setParty(res.party))
      .catch((err: any) => {
        if (err?.name === 'AbortError') return;
        setError(err?.message || t('parties.loadFailed'));
      });
    return () => controller.abort();
  }, [partyId, t]);

  const whatsappHref = useMemo(() => {
    if (!party || party.bookingType !== 'whatsapp') return null;
    // Instant-open fallback while the intent POST is in flight; the POST's
    // server-rendered link is identical by construction (shared generator).
    return `https://wa.me/${(party.whatsappNumber || '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(
      isAr
        ? `مرحباً، أود حجز ${party.nameAr} يوم ${date} لعدد ${persons} ${persons === 1 ? 'شخص' : 'أشخاص'}. — أرسلت من منصة Travel.eg`
        : `Hi! I'd like to book ${party.nameEn} on ${date} for ${persons} ${persons === 1 ? 'person' : 'people'}. — Sent from Travel.eg`
    )}`;
  }, [party, isAr, date, persons]);

  if (error) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0f1e] text-slate-100 flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-sm text-slate-400">{error}</p>
        <button type="button" onClick={onBack} className="px-4 py-2 rounded-xl bg-white/10 font-bold text-sm cursor-pointer hover:bg-white/20">
          {t('parties.backToList')}
        </button>
      </div>
    );
  }

  if (!party) {
    return (
      <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0f1e] text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">{t('cmd.loading')}</p>
      </div>
    );
  }

  const name = isAr ? party.nameAr : party.nameEn;
  const description = isAr ? party.descriptionAr : party.descriptionEn;
  const zoneInfo = PARTY_ZONE_INFO[party.zone];

  const pricePrimary =
    party.priceModel === 'free'
      ? t('parties.price.free')
      : currency === 'USD' && party.priceUsd !== undefined
        ? `$${party.priceUsd}`
        : `${party.priceEgp} ${t('parties.currencyEgp')}`;

  const transportLabel =
    party.transportEgp !== undefined
      ? currency === 'USD'
        ? `+ $${Math.round((party.transportEgp / (party.priceUsd ? party.priceEgp / party.priceUsd : 50)) * 10) / 10}`
        : `+ ${party.transportEgp} ${t('parties.currencyEgp')}`
      : null;

  const canWhatsapp = party.bookingType === 'whatsapp' && Boolean(party.whatsappNumber);

  const handleWhatsApp = async () => {
    if (!party) return;
    setBooking(true);
    try {
      // Fire the intent log first: the counter is the ops signal, and the
      // returned link is the server-rendered source of truth.
      const res = await api.postDahabPartyBookIntent(party.id, {
        targetDate: date,
        persons,
        language: isAr ? 'ar' : 'en'
      });
      window.open(res.whatsappUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // The intent log is best-effort on a weak connection; the traveler
      // still gets the locally-rendered link rather than a dead button.
      if (whatsappHref) window.open(whatsappHref, '_blank', 'noopener,noreferrer');
      showToast(t('parties.whatsappOffline'));
    } finally {
      setBooking(false);
    }
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#0a0f1e] text-slate-100 pb-16">
      {/* Hero */}
      <div className="relative h-[46vh] min-h-72 overflow-hidden">
        {party.imageUrls[0] ? (
          <img src={party.imageUrls[0]} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1b2540] to-[#0b1020]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-[#0a0f1e]/40 to-transparent" />

        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 start-4 z-10 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/40 backdrop-blur text-sm font-bold text-white hover:bg-black/60 cursor-pointer"
        >
          <ArrowLeft className={`w-4 h-4 ${isAr ? 'rotate-180' : ''}`} aria-hidden="true" />
          {t('parties.backToList')}
        </button>

        <div className="absolute bottom-0 inset-x-0 p-5 sm:p-8 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <span
              aria-hidden="true"
              className="w-3 h-3 rounded-full inline-block"
              style={{ backgroundColor: PARTY_CATEGORY_COLORS[party.category] }}
            />
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-300">
              {t(`parties.category.${party.category}`)}
            </span>
            <span className="text-[11px] font-bold text-slate-300">· {isAr ? zoneInfo.nameAr : zoneInfo.nameEn}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold leading-tight text-white">{name}</h1>
          <p className="mt-1 text-xs font-bold text-slate-300">{party.venueName}</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-8 -mt-6 relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: description + facts */}
        <div className="lg:col-span-2 space-y-5">
          <p className="text-sm leading-relaxed text-slate-300">{description}</p>

          {/* When */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 flex flex-wrap gap-4">
            <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Clock className="w-4 h-4 text-amber-300" aria-hidden="true" />
              {party.startTime} · {t(`parties.frequency.${party.frequency}`)}
              {party.days.length > 0 && ` · ${party.days.join(', ')}`}
            </span>
            <span className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Users className="w-4 h-4 text-amber-300" aria-hidden="true" />
              {t(`parties.audience.${party.audience}`)}
            </span>
          </div>

          {/* Includes */}
          {party.includes.length > 0 && (
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">{t('parties.includesTitle')}</h2>
              <div className="flex flex-wrap gap-2">
                {party.includes.map(id => (
                  <span key={id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-slate-200">
                    <Flame className="w-3 h-3 text-amber-300" aria-hidden="true" />
                    {t(`parties.include.${id}`)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Music */}
          {party.musicGenres.length > 0 && (
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5" aria-hidden="true" />
                {t('parties.musicTitle')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {party.musicGenres.map(g => (
                  <span key={g} className="px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-400/20 text-xs font-bold text-purple-200">
                    {t(`parties.music.${g}`)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Vibe meter */}
          <div>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 mb-2.5">{t('parties.vibeTitle')}</h2>
            <div
              className="relative h-2 rounded-full bg-gradient-to-r from-teal-400/60 via-amber-300/50 to-fuchsia-500/60"
              role="img"
              aria-label={`${t('parties.vibe.chill')} — ${t('parties.vibe.high_energy')}`}
            >
              <span
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-amber-300 shadow"
                style={{ [isAr ? 'right' : 'left']: `calc(${(1 - vibeMeterValue(party)) * 100}% - 8px)` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-500">
              <span>{t('parties.vibe.chill')}</span>
              <span>{t('parties.vibe.high_energy')}</span>
            </div>
          </div>

          {/* Meeting point — the contract card */}
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-4">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
              {t('parties.meetingPointTitle')}
            </h2>
            <p className="text-sm font-bold text-slate-100">{party.meetingPointName}</p>
            <p className="mt-0.5 text-[11px] text-amber-200/80">{t('parties.meetingPointNote')}</p>
            <a
              href={partyMeetingPointMapUrl(party.meetingPointLat, party.meetingPointLng)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-extrabold hover:bg-amber-300"
            >
              <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              {t('parties.openInMaps')}
            </a>
          </div>
        </div>

        {/* Right column: price + booking */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 sticky top-6">
            {/* Dual pricing */}
            <div className="flex items-center justify-between">
              <span className="text-3xl font-extrabold text-amber-300">{pricePrimary}</span>
              <div className="flex items-center rounded-full border border-white/10 bg-white/5 p-0.5" role="group" aria-label={t('parties.currencyToggle')}>
                {(['EGP', 'USD'] as const).map(cur => (
                  <button
                    key={cur}
                    type="button"
                    aria-pressed={currency === cur}
                    onClick={() => setCurrency(cur)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold cursor-pointer ${
                      currency === cur ? 'bg-slate-100 text-slate-950' : 'text-slate-400'
                    }`}
                  >
                    {cur}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-[11px] font-bold text-slate-400">{t(`parties.entry.${party.entryType}`)}</p>

            {/* Transport add-on — Full Moon pattern */}
            {party.transportEgp !== undefined && (
              <label className="mt-3 flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-200">
                <input
                  type="checkbox"
                  checked={withTransport}
                  onChange={e => setWithTransport(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 cursor-pointer"
                />
                {t('parties.transportOption', { amount: transportLabel || `+ ${party.transportEgp} EGP` })}
              </label>
            )}

            {/* Persons + date for the WhatsApp message */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="party-date" className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-slate-400 mb-1">
                  <CalendarDays className="w-3 h-3" aria-hidden="true" />
                  {t('parties.dateLabel')}
                </label>
                <input
                  id="party-date"
                  type="date"
                  value={date}
                  min={todayLocal()}
                  onChange={e => setDate(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5 text-xs font-bold text-slate-100 [color-scheme:dark] cursor-pointer"
                />
              </div>
              <div>
                <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase text-slate-400 mb-1">
                  <Users className="w-3 h-3" aria-hidden="true" />
                  {t('parties.personsLabel')}
                </span>
                <div className="flex items-center rounded-lg border border-white/10 bg-white/5">
                  <button
                    type="button"
                    aria-label={t('parties.personsDecrement')}
                    onClick={() => setPersons(p => Math.max(1, p - 1))}
                    className="px-2 py-1.5 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <span className="flex-1 text-center text-xs font-extrabold">{persons}</span>
                  <button
                    type="button"
                    aria-label={t('parties.personsIncrement')}
                    onClick={() => setPersons(p => Math.min(20, p + 1))}
                    className="px-2 py-1.5 text-slate-300 hover:text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* CTAs */}
            {canWhatsapp ? (
              <button
                type="button"
                onClick={handleWhatsApp}
                disabled={booking}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#25D366] text-slate-950 text-sm font-extrabold hover:bg-[#2ee06f] disabled:opacity-60 cursor-pointer"
              >
                <WhatsAppIcon className="w-4 h-4" aria-hidden="true" />
                {booking ? t('parties.openingWhatsapp') : t('parties.bookWhatsapp')}
              </button>
            ) : (
              <div className="mt-4 w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-center text-xs font-extrabold text-slate-200">
                {t('parties.walkInOnly')}
              </div>
            )}

            {party.priceModel === 'free' && (
              <p className="mt-2 text-center text-[11px] font-bold text-teal-300">{t('parties.justShowUp')}</p>
            )}

            {/* The honest money note */}
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-400">
              <Wallet className="w-3.5 h-3.5" aria-hidden="true" />
              {t('parties.cashDisclaimer')}
            </p>

            {party.organizerInstagram && (
              <a
                href={party.organizerInstagram}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-1.5 text-[11px] font-bold text-pink-300/90 hover:text-pink-300"
              >
                <Instagram className="w-3.5 h-3.5" aria-hidden="true" />
                {t('parties.organizerInstagram')}
              </a>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

/** Inline WhatsApp glyph — lucide has none, and importing an icon pack for one
 *  path costs more bytes than the path itself. */
const WhatsAppIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2m0 1.67c2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.25 8.24-8.25m-3.53 4.44c-.16 0-.43.06-.66.31-.22.25-.87.86-.87 2.07 0 1.21.89 2.39 1 2.55.14.17 1.76 2.67 4.25 3.73.59.26 1.05.41 1.41.52.6.2 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.57.21-1.05.15-1.16-.06-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.08-.37-.12-.56.12-.17.25-.64.81-.78.97-.15.17-.3.19-.55.06-.25-.13-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.13-.25-.02-.38.11-.51.13-.13.27-.31.41-.47.13-.17.17-.29.26-.47.08-.18.04-.34-.02-.47-.06-.13-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.42z" />
  </svg>
);
