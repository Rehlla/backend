import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeftRight, Bus, Car, Crown, Lock } from 'lucide-react';
import { useTrip } from '../../context/TripContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';

type HubTab = 'private' | 'bus' | 'fleet';
type TierId = 'shared' | 'private' | 'premium';
type TripKind = 'one' | 'round' | 'multi';
type Luggage = 'small' | 'medium' | 'large';

interface OriginRow {
  id: string;
  labelEn: string;
  labelAr: string;
  subEn: string;
  subAr: string;
  distanceKm: number;
  durationEn: string;
  durationAr: string;
  haul: 'short' | 'long';
}

interface DestRow {
  id: string;
  labelEn: string;
  labelAr: string;
  subEn: string;
  subAr: string;
  priceAddEGP: number;
}

interface Quote {
  sellEGP: number;
  earlyDiscountEGP: number;
  busLastMileEGP: number;
  longHaul: boolean;
  distanceKm: number;
  durationEn: string;
  durationAr: string;
  freeCancelUntil: string | null;
  comparison: { privateEGP: number; sharedEGP: number; busLastMileEGP: number };
  tiers: Array<{ id: TierId; totalEGP: number }>;
  supplierCostEGP?: number;
  marginEGP?: number;
}

const TIMES = ['06:00', '08:30', '09:30', '11:00', '13:00', '15:30', '18:00', '20:30', '23:40'];
const ADDONS = ['child', 'stop', 'meet', 'pet', 'bluehole_tour', 'luggage_xl'] as const;
const ZONE_TO_DEST: Record<string, string> = {
  'ZONE-MASBAT': 'masbat',
  'ZONE-ASSALA': 'assala',
  'ZONE-EELGARDEN': 'mashraba',
  'ZONE-LAGOON': 'lagoon',
  'ZONE-BLUEHOLE': 'bluehole'
};
const DEST_TO_ZONE: Record<string, string> = {
  masbat: 'ZONE-MASBAT',
  assala: 'ZONE-ASSALA',
  mashraba: 'ZONE-EELGARDEN',
  lagoon: 'ZONE-LAGOON',
  bluehole: 'ZONE-BLUEHOLE'
};

function isoIn(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function monthGrid(anchor: string): Array<{ iso: string; day: number; inMonth: boolean }> {
  const [year, month] = anchor.split('-').map(Number);
  const first = new Date(year, (month || 1) - 1, 1);
  const start = new Date(first);
  const mondayIndex = (first.getDay() + 6) % 7;
  start.setDate(1 - mondayIndex);
  const cells: Array<{ iso: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const cell = new Date(start);
    cell.setDate(start.getDate() + i);
    const iso = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(cell.getDate()).padStart(2, '0')}`;
    cells.push({ iso, day: cell.getDate(), inMonth: cell.getMonth() === first.getMonth() });
  }
  return cells;
}

/**
 * One ride hub: private price lock, intercity bus plus last mile, and a 14-day fleet.
 * The server quotes every total. This view only sends the choices.
 */
export const TransfersHubView: React.FC<{ transferType: 'within_dahab' | 'anywhere' }> = ({ transferType }) => {
  const { t, language } = useLanguage();
  const { showToast, navigateTo, sessionUser, isSignedIn, activeTrip, currentParams } = useTrip();
  const ar = language === 'ar';
  const staff = sessionUser?.role === 'Operations' || sessionUser?.role === 'Admin';

  const [tab, setTab] = useState<HubTab>(currentParams.rideTab === 'bus' || currentParams.rideTab === 'fleet' ? currentParams.rideTab : 'private');
  const [origins, setOrigins] = useState<OriginRow[]>([]);
  const [destinations, setDestinations] = useState<DestRow[]>([]);
  const [originId, setOriginId] = useState(currentParams.rideFrom || (transferType === 'within_dahab' ? 'ZONE-MASBAT' : 'cairo'));
  const [destinationId, setDestinationId] = useState(
    currentParams.rideTo
    // The within-Dahab page used to open "Masbat (zone) → Masbat
    // (destination)" — the same place twice, quoted as a 2 km ride. The
    // default destination moves to another Dahab zone; both selects stay
    // fully editable.
    || (transferType === 'within_dahab' ? 'lagoon' : 'masbat')
  );
  const [tripKind, setTripKind] = useState<TripKind>('one');
  const [tier, setTier] = useState<TierId>(currentParams.rideTier === 'shared' || currentParams.rideTier === 'premium' ? currentParams.rideTier : 'private');
  const [date, setDate] = useState(() => isoIn(1));
  const [returnDate, setReturnDate] = useState(() => isoIn(4));
  const [time, setTime] = useState('09:30');
  const [asap, setAsap] = useState(false);
  const [passengers, setPassengers] = useState(2);
  const [luggage, setLuggage] = useState<Luggage>('small');
  const [addons, setAddons] = useState<string[]>([]);
  const [stops, setStops] = useState<string[]>([]);
  const [busId, setBusId] = useState<string | undefined>();
  const [buses, setBuses] = useState<Array<{ id: string; operatorName: string; operatorNameAr: string; departLabel: string; arriveLabel: string; priceEGP: number; seats: number }>>([]);
  const [fleet, setFleet] = useState<Array<{ date: string; tone: 'cheap' | 'moderate' | 'busy'; displayEGP: number }>>([]);
  const [drivers, setDrivers] = useState<Array<{ id: string; nameEn: string; nameAr: string; rating: number; trips: number; langs: string[]; carEn: string; carAr: string; initials: string }>>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [agent, setAgent] = useState(false);
  const [locking, setLocking] = useState(false);
  const [lockedRef, setLockedRef] = useState<string | null>(null);

  useEffect(() => {
    api.getTransferHub().then(data => {
      setOrigins(data.origins || []);
      setDestinations(data.destinations || []);
    }).catch(() => showToast(t('transfers.loadError')));
    api.getTransferDriverPreview().then(data => setDrivers(data.drivers || [])).catch(() => undefined);
  }, []);

  const quoteBody = useMemo(() => ({
    originId,
    destinationId,
    tierId: tier,
    tripType: tripKind,
    stops: tripKind === 'multi' ? stops : [],
    date,
    time: asap ? 'ASAP' : time,
    returnDate: tripKind === 'round' ? returnDate : undefined,
    returnTime: tripKind === 'round' ? '14:00' : undefined,
    passengers,
    luggage,
    addonIds: addons,
    mode: tab === 'bus' ? 'bus' : 'private',
    busScheduleId: tab === 'bus' ? busId : undefined
  }), [originId, destinationId, tier, tripKind, stops, date, asap, time, returnDate, passengers, luggage, addons, tab, busId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const res = await api.quoteTransferHub(quoteBody, Boolean(staff && agent));
        if (!cancelled) setQuote(res.quote);
      } catch {
        if (!cancelled) setQuote(null);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [quoteBody, staff, agent]);

  useEffect(() => {
    api.getTransferBuses(originId).then(data => {
      setBuses(data.buses || []);
      setBusId(undefined);
    }).catch(() => setBuses([]));
  }, [originId]);

  useEffect(() => {
    if (tab !== 'fleet') return;
    api.getTransferFleet(originId, destinationId, tier).then(data => setFleet(data.days || [])).catch(() => setFleet([]));
  }, [tab, originId, destinationId, tier]);

  const origin = origins.find(row => row.id === originId);
  const destination = destinations.find(row => row.id === destinationId) || origins.find(row => row.id === destinationId);
  const label = (row?: { labelEn: string; labelAr: string }) => row ? (ar ? row.labelAr : row.labelEn) : '';
  const today = isoIn(0);
  /**
   * Zone identity compare: 'ZONE-MASBAT', 'masbat' and 'ZONE-MASBAT → masbat'
   * are the same corner of Dahab through three different ids. A quote for it
   * is not an error on the server, but a traveler ordering a 2 km ride they
   * meant to be a trip deserves the tell — so the QR card shows it plainly.
   */
  const sameArea =
    originId === destinationId
    || ZONE_TO_DEST[originId] === destinationId
    || DEST_TO_ZONE[destinationId] === originId;

  const swap = () => {
    const nextOrigin = DEST_TO_ZONE[destinationId] || destinationId;
    const nextDest = ZONE_TO_DEST[originId] || originId;
    setOriginId(nextOrigin);
    setDestinationId(nextDest);
  };

  const lock = async () => {
    if (!quote) return;
    if (!isSignedIn || !sessionUser) {
      showToast(t('transfers.signInToBook'));
      navigateTo('/auth/sign-in');
      return;
    }
    if (!activeTrip) {
      showToast(t('transfers.noTrip'));
      navigateTo('/plan-for-me');
      return;
    }
    setLocking(true);
    try {
      const res = await api.lockTransferHub({
        ...quoteBody,
        tripId: activeTrip.id,
        expectedSellEGP: quote.sellEGP,
        idempotencyKey: `IDEMP-HUB-${originId}-${destinationId}-${Date.now()}`
      });
      setLockedRef(res.booking.bookingRef);
      showToast(t('transfers.hub.locked'));
    } catch {
      showToast(t('transfers.loadError'));
    } finally {
      setLocking(false);
    }
  };

  const tierPrice = (id: TierId) => {
    const total = quote?.tiers.find(row => row.id === id)?.totalEGP;
    if (total === undefined) return undefined;
    if (id === 'shared' && origin?.haul === 'short' && passengers > 0 && quote) {
      return Math.round(quote.comparison.sharedEGP / passengers);
    }
    return total;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--text-primary)]">{t('transfers.title')}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">{t('transfers.hub.freeCancel')}</p>
        </div>
        {staff && (
          <button
            type="button"
            aria-pressed={agent}
            onClick={() => setAgent(value => !value)}
            className={`rounded-full px-4 py-2 text-sm font-bold border ${agent ? 'bg-[var(--accent-primary)] text-white border-transparent' : 'border-[var(--border-subtle)]'}`}
          >
            {t('transfers.hub.agent')}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {([
          ['private', t('transfers.hub.private'), t('transfers.hub.privateDesc')],
          ['bus', t('transfers.hub.buses'), t('transfers.hub.busesDesc')],
          ['fleet', t('transfers.hub.fleet'), t('transfers.hub.fleetDesc')]
        ] as const).map(([id, title, desc]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`text-start rounded-2xl border px-4 py-4 ${tab === id ? 'border-[var(--accent-primary)] bg-[var(--surface-container)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}
          >
            <div className="font-extrabold">{title}</div>
            <div className="text-xs text-[var(--text-secondary)] mt-1">{desc}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          {tab === 'private' && (
            <>
              <div className="flex flex-wrap gap-2">
                {(['one', 'round', 'multi'] as TripKind[]).map(kind => (
                  <button key={kind} type="button" aria-pressed={tripKind === kind} onClick={() => setTripKind(kind)} className={`rounded-full px-3 py-1.5 text-sm font-bold border ${tripKind === kind ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                    {t(kind === 'one' ? 'transfers.hub.oneWay' : kind === 'round' ? 'transfers.hub.round' : 'transfers.hub.multi')}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
                <label className="text-sm font-bold">
                  {t('transfers.hub.from')}
                  <select aria-label={t('transfers.hub.from')} value={originId} onChange={event => setOriginId(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-3">
                    {origins.map(row => <option key={row.id} value={row.id}>{ar ? row.labelAr : row.labelEn}</option>)}
                  </select>
                </label>
                <button type="button" aria-label={t('transfers.hub.swap')} onClick={swap} className="mb-1 rounded-full border border-[var(--border-subtle)] p-3">
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
                <label className="text-sm font-bold">
                  {t('transfers.hub.to')}
                  <select aria-label={t('transfers.hub.to')} value={destinationId} onChange={event => setDestinationId(event.target.value)} className="mt-1 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-3">
                    {destinations.map(row => <option key={row.id} value={row.id}>{ar ? row.labelAr : row.labelEn}</option>)}
                    {destination && !destinations.some(row => row.id === destinationId) && (
                      <option value={destinationId}>{label(destination)}</option>
                    )}
                  </select>
                </label>
              </div>
              {origin && (
                <p className="text-sm text-[var(--text-secondary)]">
                  {t('transfers.hub.distance', { km: quote?.distanceKm ?? origin.distanceKm, time: ar ? (quote?.durationAr || origin.durationAr) : (quote?.durationEn || origin.durationEn) })}
                </p>
              )}
              {sameArea && (
                <p role="status" className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {t('transfers.hub.sameArea')}
                </p>
              )}

              <div className="flex gap-2">
                <button type="button" aria-pressed={!asap} onClick={() => setAsap(false)} className={`rounded-full px-3 py-1.5 text-sm font-bold border ${!asap ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>{t('transfers.hub.pickDate')}</button>
                <button type="button" aria-pressed={asap} onClick={() => setAsap(true)} className={`rounded-full px-3 py-1.5 text-sm font-bold border ${asap ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>{t('transfers.hub.asap')}</button>
              </div>
              {!asap && (
                <div className="grid grid-cols-7 gap-1">
                  {monthGrid(date).map(cell => (
                    <button
                      key={cell.iso}
                      type="button"
                      disabled={!cell.inMonth || cell.iso < today}
                      onClick={() => setDate(cell.iso)}
                      className={`h-9 rounded-lg text-sm ${cell.iso === date ? 'bg-[var(--accent-primary)] text-white' : ''} ${!cell.inMonth ? 'opacity-30' : ''}`}
                    >
                      {cell.day}
                    </button>
                  ))}
                </div>
              )}
              {!asap && (
                <div className="flex flex-wrap gap-2">
                  {TIMES.map(slot => (
                    <button key={slot} type="button" aria-pressed={time === slot} onClick={() => setTime(slot)} className={`rounded-full px-3 py-1 text-sm border ${time === slot ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>{slot}</button>
                  ))}
                </div>
              )}
              {tripKind === 'round' && (
                <label className="text-sm font-bold block">
                  {t('transfers.hub.return')}
                  <input type="date" value={returnDate} min={date} onChange={event => setReturnDate(event.target.value)} className="mt-1 block rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2" />
                </label>
              )}
              {tripKind === 'multi' && (
                <div>
                  <div className="text-sm font-bold mb-2">{t('transfers.hub.stops')}</div>
                  <div className="flex flex-wrap gap-2">
                    {destinations.filter(row => row.id !== destinationId).map(row => (
                      <button key={row.id} type="button" aria-pressed={stops.includes(row.id)} onClick={() => setStops(current => current.includes(row.id) ? current.filter(id => id !== row.id) : [...current, row.id])} className={`rounded-full px-3 py-1 text-sm border ${stops.includes(row.id) ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                        {ar ? row.labelAr : row.labelEn}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <span className="text-sm font-bold">{t('transfers.hub.passengers')}</span>
                <button type="button" onClick={() => setPassengers(value => Math.max(1, value - 1))} className="rounded-full border px-3 py-1">−</button>
                <span>{passengers}</span>
                <button type="button" onClick={() => setPassengers(value => Math.min(14, value + 1))} className="rounded-full border px-3 py-1">+</button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-sm font-bold">{t('transfers.hub.luggage')}</span>
                {(['small', 'medium', 'large'] as Luggage[]).map(size => (
                  <button key={size} type="button" aria-pressed={luggage === size} onClick={() => setLuggage(size)} className={`rounded-full px-3 py-1 text-sm border ${luggage === size ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                    {t(`transfers.hub.luggage.${size}`)}
                  </button>
                ))}
              </div>
              <div>
                <div className="text-sm font-bold mb-2">{t('transfers.hub.addons')}</div>
                <div className="flex flex-wrap gap-2">
                  {ADDONS.map(id => (
                    <button key={id} type="button" aria-pressed={addons.includes(id)} onClick={() => setAddons(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id])} className={`rounded-full px-3 py-1 text-sm border ${addons.includes(id) ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                      {t(`transfers.hub.addon.${id}`)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'bus' && (
            <div className="space-y-3">
              <p className="text-sm text-[var(--text-secondary)]">{label(origin)} → {label(destination)}</p>
              {buses.length === 0 && <p className="text-sm">{t('transfers.hub.noBuses')}</p>}
              {buses.map(bus => (
                <button key={bus.id} type="button" aria-pressed={busId === bus.id} onClick={() => setBusId(bus.id)} className={`w-full text-start rounded-2xl border px-4 py-3 ${busId === bus.id ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                  <div className="font-extrabold">{ar ? bus.operatorNameAr : bus.operatorName}</div>
                  <div className="text-sm mt-1">{bus.departLabel} → {bus.arriveLabel}</div>
                  <div className="text-sm mt-1">{bus.priceEGP} EGP · {t('transfers.hub.seats', { n: bus.seats })}</div>
                </button>
              ))}
            </div>
          )}

          {tab === 'fleet' && (
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
              {fleet.map(day => (
                <button key={day.date} type="button" onClick={() => { setDate(day.date); setTab('private'); }} className="rounded-xl border border-[var(--border-subtle)] px-2 py-3 text-start">
                  <div className="text-xs">{day.date.slice(5)}</div>
                  <div className="text-sm font-bold mt-1">{day.displayEGP}</div>
                  <div className="text-[11px] mt-1">{t(day.tone === 'busy' ? 'transfers.hub.fleetBusy' : day.tone === 'moderate' ? 'transfers.hub.fleetModerate' : 'transfers.hub.fleetCheap')}</div>
                </button>
              ))}
            </div>
          )}

          <div>
            <div className="text-sm font-bold mb-2">{t('transfers.hub.drivers')}</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {drivers.map((driver, index) => (
                <div key={driver.id} className="rounded-2xl border border-[var(--border-subtle)] p-3" style={asap || index === 0 ? undefined : { filter: 'blur(3px)' }}>
                  <div className="font-extrabold">{driver.initials} · {ar ? driver.nameAr : driver.nameEn}</div>
                  <div className="text-xs text-[var(--text-secondary)] mt-1">{driver.rating} · {driver.trips}</div>
                  <div className="text-xs mt-1">{driver.langs.join(' · ')}</div>
                  <div className="text-xs mt-1">{ar ? driver.carAr : driver.carEn}</div>
                  {!asap && index > 0 && <div className="text-[11px] mt-2">{t('transfers.hub.driverBlur')}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 space-y-4">
          <div className="text-xs font-bold">{t('transfers.hub.lockBadge')}</div>
          {quote?.earlyDiscountEGP ? <div className="text-sm font-bold">{t('transfers.hub.early', { amount: quote.earlyDiscountEGP })}</div> : null}
          <div className="space-y-2">
            {([
              ['shared', Car, t('transfers.tier.shared')],
              ['private', Bus, t('transfers.tier.private')],
              ['premium', Crown, t('transfers.tier.premium')]
            ] as const).map(([id, Icon, name]) => (
              <button key={id} type="button" aria-pressed={tier === id} onClick={() => { setTier(id); setTab('private'); }} className={`w-full text-start rounded-2xl border px-3 py-3 ${tier === id ? 'border-[var(--accent-primary)]' : 'border-[var(--border-subtle)]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-bold"><Icon className="w-4 h-4" />{name}</span>
                  <span>{tierPrice(id) ?? '—'} EGP</span>
                </div>
                {id === 'shared' && origin?.haul === 'short' && <div className="text-[11px] text-[var(--text-secondary)]">{t('transfers.hub.perPerson')}</div>}
              </button>
            ))}
          </div>
          {quote && (
            <div className="text-sm space-y-1">
              <div className="font-bold">{t('transfers.hub.compare')}</div>
              <div>{t('transfers.tier.private')} {quote.comparison.privateEGP} EGP</div>
              <div>
                {t('transfers.tier.shared')} {quote.comparison.sharedEGP} EGP
                {/* The tier card above prices the shared van per person, this
                    line shows the whole-van total — the traveler read "90 for
                    you" and "180 EGP" as different offers. Name the split. */}
                {origin?.haul === 'short' && passengers > 1 && (
                  <span className="text-[var(--text-secondary)]"> · {t('transfers.hub.perPersonAmount', { amount: Math.round(quote.comparison.sharedEGP / passengers) })}</span>
                )}
              </div>
              <div>{t('transfers.hub.buses')} {quote.comparison.busLastMileEGP} EGP</div>
            </div>
          )}
          {agent && quote?.marginEGP !== undefined && (
            <div className="text-sm font-bold space-y-1">
              <div>{t('transfers.hub.supplier', { amount: quote.supplierCostEGP || 0 })}</div>
              <div>{t('transfers.hub.margin', { amount: quote.marginEGP })}</div>
            </div>
          )}
          <button type="button" disabled={!quote || locking} onClick={lock} className="w-full rounded-2xl bg-[var(--accent-primary)] text-white font-extrabold py-3 flex items-center justify-center gap-2 disabled:opacity-50">
            <Lock className="w-4 h-4" />
            {t('transfers.hub.lockCta')} · {quote?.sellEGP ?? '—'} EGP
          </button>
          {quote?.longHaul && tab !== 'bus' && (
            <button type="button" onClick={() => setTab('bus')} className="w-full rounded-2xl border border-[var(--border-subtle)] font-bold py-3">
              {t('transfers.hub.busCta')} · {quote.comparison.busLastMileEGP} EGP
            </button>
          )}
          {lockedRef && (
            <div className="text-sm space-y-2">
              <div className="font-bold">{lockedRef}</div>
              <div>{t('transfers.hub.locked')}</div>
              <ol className="space-y-1">
                <li>{t('transfers.hub.step.booked')}</li>
                <li>{t('transfers.hub.step.driver')}</li>
                <li>{t('transfers.hub.step.pickup')}</li>
                <li>{t('transfers.hub.step.arrival')}</li>
              </ol>
              <button type="button" onClick={() => setAddons(current => current.includes('bluehole_tour') ? current : [...current, 'bluehole_tour'])} className="underline">
                {t('transfers.hub.addon.bluehole_tour')} · 200 EGP
              </button>
            </div>
          )}
          <p className="text-xs text-[var(--text-secondary)]">{t('transfers.hub.freeCancel')}</p>
        </aside>
      </div>
    </div>
  );
};
