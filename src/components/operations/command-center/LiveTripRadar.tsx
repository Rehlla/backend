import React, { useState, useEffect, useCallback } from 'react';
import {
  Plane, CheckCircle2, AlertTriangle, RefreshCw,
  DollarSign, User, MessageSquare, ChevronRight,
  Activity, Package, Car, Calendar,
} from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import type { TripEntity, TripItemWithSupplier, TripBookingRecord } from '../../../shared';
import { SectionHeader, TabBar, StatusBadge, EmptyState, DashCard, Skeleton } from './ui';

interface EnrichedTrip {
  trip: TripEntity;
  items: TripItemWithSupplier[];
  bookings: TripBookingRecord[];
}

export default function LiveTripRadar() {
  const { language, t } = useLanguage();
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTrips = useCallback(async () => {
    try {
      const overview = await api.getOperationsOverview();
      const ov = overview as any;
      const tripList = ov?.trips?.list || ov?.trips || [];
      if (Array.isArray(tripList) && tripList.length > 0) setTrips(tripList);
      setLastUpdated(new Date());
    } catch {
      try {
        const me = await api.getMe();
        if (me?.id) { const { trips: userTrips } = await api.getTripsForUser(me.id); setTrips(userTrips); }
      } catch { setTrips([]); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTrips(); const i = setInterval(fetchTrips, 30_000); return () => clearInterval(i); }, [fetchTrips]);

  if (selectedTripId) return <TripCommandView tripId={selectedTripId} onBack={() => setSelectedTripId(null)} />;

  const freshness = lastUpdated ? t('cmd.overview.updatedSecondsAgo').replace('${s}', String(Math.round((Date.now() - lastUpdated.getTime()) / 1000))) : undefined;

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Plane}
        title={t('cmd.trips.title')}
        subtitle={freshness}
        actions={
          <button type="button" onClick={fetchTrips}
            className="px-3 py-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--surface-container)] text-[var(--text-muted)] text-xs font-medium flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />{t('cmd.overview.refresh')}
          </button>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} variant="card" />)}
        </div>
      ) : trips.length === 0 ? (
        <EmptyState icon={Plane} title={t('cmd.trips.noTrips')} description={t('cmd.trips.noTripsDesc')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trips.map(trip => {
            const daysActive = trip.startDate ? Math.ceil((Date.now() - new Date(trip.startDate).getTime()) / 86400000) : 0;
            return (
              <DashCard key={trip.id} hover padding="md" onClick={() => setSelectedTripId(trip.id)}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-[10px] font-mono text-[var(--accent-primary)]">{trip.id}</div>
                    <div className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{trip.title}</div>
                  </div>
                  <StatusBadge status={trip.status} />
                </div>
                <div className="space-y-1.5 text-[11px]">
                  {trip.startDate && (
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                      <Calendar className="w-3 h-3" />{trip.startDate}{trip.endDate ? ` → ${trip.endDate}` : ''}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <User className="w-3 h-3" />{trip.travelersCount} {t('cmd.trips.travelers')} · {trip.lengthDays} {t('cmd.trips.days')}
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <DollarSign className="w-3 h-3" />
                    <span className="text-[var(--accent-secondary)] font-bold">{trip.totalPaidEGP.toLocaleString()}</span>
                    <span>EGP / {trip.totalEstimatedEGP.toLocaleString()} {t('cmd.trips.est')}</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                  <div className="text-[10px] text-[var(--text-muted)] font-mono">{trip.budget} · {trip.pace}</div>
                  <span className="text-[11px] text-[var(--accent-primary)] font-bold flex items-center gap-1">
                    {t('cmd.trips.openTrip')} <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </DashCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Trip Command View ──────────────────────────────────────────────────────
function TripCommandView({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const { language, t } = useLanguage();
  const [trip, setTrip] = useState<EnrichedTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [tripDetail, bookingsData] = await Promise.all([api.getTrip(tripId), api.getTripBookings(tripId)]);
        setTrip({ trip: tripDetail.trip, items: tripDetail.items as TripItemWithSupplier[], bookings: bookingsData.bookings });
      } catch (err) { console.error('Failed to load trip', err); } finally { setLoading(false); }
    };
    load();
  }, [tripId]);

  const handleTransition = async (newStatus: string) => {
    if (!trip || transitioning) return;
    if (!confirm(t('cmd.trips.confirmTransition').replace('${status}', newStatus))) return;
    setTransitioning(true);
    try {
      await api.transitionTripStatus(tripId, newStatus);
      setTrip(prev => prev ? { ...prev, trip: { ...prev.trip, status: newStatus as any } } : prev);
    } catch (err: any) { alert(`${t('cmd.trips.transitionFailed')} ${err.message}`); } finally { setTransitioning(false); }
  };

  if (loading) return <Skeleton variant="card" count={2} />;
  if (!trip) return (
    <div className="py-12 text-center">
      <div className="text-sm text-[var(--text-muted)]">{t('cmd.trips.notFound')}</div>
      <button type="button" onClick={onBack} className="mt-3 text-xs text-[var(--accent-primary)] hover:underline cursor-pointer">← {t('cmd.trips.backToRadar')}</button>
    </div>
  );

  const tripData = trip.trip;
  const possibleTransitions: Record<string, string[]> = { DRAFT: ['PLANNED'], PLANNED: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['IN_DESTINATION', 'CANCELLED'], IN_DESTINATION: ['COMPLETED'] };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-primary)] flex items-center gap-1 cursor-pointer">
        ← {t('cmd.trips.backToRadar')}
      </button>

      <DashCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-[var(--accent-primary)]">{tripData.id}</span>
              <StatusBadge status={tripData.status} />
            </div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] mt-1">{tripData.title}</h2>
            <div className="text-xs text-[var(--text-muted)] mt-1">
              {tripData.travelersCount} {t('cmd.trips.travelers')} · {tripData.lengthDays} {t('cmd.trips.days')} · {tripData.budget} · {tripData.pace}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(possibleTransitions[tripData.status] || []).map(status => (
              <button key={status} type="button" onClick={() => handleTransition(status)} disabled={transitioning}
                className="px-3 py-1.5 rounded-lg bg-[var(--accent-primary)]/15 hover:bg-[var(--accent-primary)]/25 text-[var(--accent-primary)] text-xs font-bold border border-[var(--accent-primary)]/25 transition-all cursor-pointer disabled:opacity-50">
                {status === 'CANCELLED' ? t('cmd.trips.cancelTrip') : `→ ${status.replace('_', ' ')}`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--accent-primary)] font-mono">{tripData.totalPaidEGP.toLocaleString()}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{t('cmd.trips.paidLabel')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--text-muted)] font-mono">{tripData.totalEstimatedEGP.toLocaleString()}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{t('cmd.trips.estimatedLabel')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--accent-secondary)] font-mono">{trip.items.length}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{t('cmd.trips.itineraryItems')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-sky-400 font-mono">{trip.bookings.length}</div>
            <div className="text-[10px] text-[var(--text-muted)]">{t('cmd.trips.bookings')}</div>
          </div>
        </div>
      </DashCard>

      <TabBar
        tabs={[
          { id: 'overview', label: t('cmd.trips.overview') },
          { id: 'bookings', label: `${t('cmd.trips.bookings')} (${trip.bookings.length})` },
          { id: 'timeline', label: `${t('cmd.trips.timeline')} (${trip.items.length})` },
          { id: 'transfers', label: t('cmd.trips.transfers') },
          { id: 'financial', label: t('cmd.trips.financial') },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'overview' && (
        <DashCard>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div><span className="text-[var(--text-muted)]">{t('cmd.trips.startDate')}:</span> <span className="font-bold text-[var(--text-primary)]">{tripData.startDate || '—'}</span></div>
            <div><span className="text-[var(--text-muted)]">{t('cmd.trips.endDate')}:</span> <span className="font-bold text-[var(--text-primary)]">{tripData.endDate || '—'}</span></div>
            <div><span className="text-[var(--text-muted)]">{t('cmd.trips.interests')}</span> <span className="text-[var(--text-primary)]">{tripData.interests?.join(', ') || '—'}</span></div>
            <div><span className="text-[var(--text-muted)]">{t('cmd.trips.created')}</span> <span className="text-[var(--text-primary)]">{tripData.createdAt}</span></div>
          </div>
        </DashCard>
      )}

      {activeTab === 'bookings' && (
        <div className="space-y-2">
          {trip.bookings.length === 0 ? (
            <EmptyState icon={Package} title={t('cmd.trips.noBookings')} />
          ) : trip.bookings.map(bk => (
            <DashCard key={bk.id} padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--accent-primary)] font-mono">{bk.bookingRef}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{bk.serviceType} · {bk.supplierId}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{bk.scheduledDate} {bk.scheduledTime}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={bk.paymentState} />
                  <StatusBadge status={bk.supplierState?.replace(/_/g, ' ') || 'UNKNOWN'} />
                  <span className="text-[11px] text-[var(--accent-secondary)] font-bold font-mono">{bk.amountEGP.toLocaleString()} EGP</span>
                  <button type="button" onClick={async () => {
                    const msg = prompt(t('cmd.trips.sendSms').replace('${ref}', bk.bookingRef));
                    if (!msg) return;
                    try { await api.sendOpsSmsDispatch({ to: '+201000000000', recipientName: bk.supplierId, message: msg, bookingRef: bk.bookingRef }); alert(t('cmd.trips.smsSent')); }
                    catch (err: any) { alert(`${t('cmd.trips.transitionFailed')} ${err.message}`); }
                  }} className="px-2 py-1 rounded-md bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[11px] font-bold cursor-pointer">
                    <MessageSquare className="w-3 h-3 inline mr-0.5" />SMS
                  </button>
                </div>
              </div>
            </DashCard>
          ))}
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="space-y-2">
          {trip.items.length === 0 ? (
            <EmptyState icon={Calendar} title={t('cmd.trips.noTimeline')} />
          ) : trip.items.map(item => (
            <DashCard key={item.id} padding="sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-mono font-bold text-[var(--text-muted)]">
                    D{item.dayNumber}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[var(--text-primary)]">{item.title}</div>
                    <div className="text-[11px] text-[var(--text-muted)]">{item.timeSlot || '—'} · {item.serviceType}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.status} />
                  <span className="text-[11px] text-[var(--accent-secondary)] font-mono">{item.priceEGP.toLocaleString()}</span>
                </div>
              </div>
            </DashCard>
          ))}
        </div>
      )}

      {activeTab === 'transfers' && (
        <div className="space-y-2">
          {trip.bookings.filter(b => b.serviceType === 'transfer').length === 0 ? (
            <EmptyState icon={Car} title={t('cmd.trips.noTransfers')} />
          ) : trip.bookings.filter(b => b.serviceType === 'transfer').map(bk => (
            <DashCard key={bk.id} padding="sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-bold text-[var(--accent-primary)] font-mono">{bk.bookingRef}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{bk.scheduledDate} {bk.scheduledTime}</div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={bk.supplierState?.replace(/_/g, ' ') || 'UNKNOWN'} />
                  <span className="text-[11px] text-[var(--accent-secondary)] font-bold font-mono">{bk.amountEGP.toLocaleString()} EGP</span>
                </div>
              </div>
            </DashCard>
          ))}
        </div>
      )}

      {activeTab === 'financial' && (
        <DashCard>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div><span className="text-[var(--text-muted)]">{t('cmd.trips.estimatedLabel')}:</span> <span className="font-bold text-[var(--text-primary)]">{tripData.totalEstimatedEGP.toLocaleString()} EGP</span></div>
            <div><span className="text-[var(--text-muted)]">{t('cmd.trips.paidLabel')}:</span> <span className="font-bold text-emerald-400">{tripData.totalPaidEGP.toLocaleString()} EGP</span></div>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)]">
            <span className="text-[var(--text-muted)]">{t('cmd.trips.remaining')}: </span>
            <span className="text-[var(--accent-secondary)] font-bold">{(tripData.totalEstimatedEGP - tripData.totalPaidEGP).toLocaleString()} EGP</span>
          </div>
        </DashCard>
      )}
    </div>
  );
}
