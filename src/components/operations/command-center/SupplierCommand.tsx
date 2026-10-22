import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Star, MapPin, ExternalLink, RefreshCw, TrendingUp, Package } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader } from './ui/SectionHeader';
import { TabBar } from './ui/TabBar';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { DashCard } from './ui/DashCard';
import { StatusBadge } from './ui/StatusBadge';

export default function SupplierCommand() {
  const { language, t } = useLanguage();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [reliability, setReliability] = useState<any[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [view, setView] = useState<'list' | 'reliability'>('list');

  const fetchSuppliers = useCallback(async () => {
    try {
      const [suppData, relData] = await Promise.allSettled([
        api.getSuppliers(),
        api.getSupplierReliability(),
      ]);
      if (suppData.status === 'fulfilled') setSuppliers((suppData.value as any)?.suppliers || []);
      if (relData.status === 'fulfilled') setReliability((relData.value as any)?.suppliers || []);
    } catch { setSuppliers([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSuppliers(); const i = setInterval(fetchSuppliers, 30_000); return () => clearInterval(i); }, [fetchSuppliers]);

  const filtered = filter === 'all' ? suppliers : suppliers.filter(s => s.status?.toLowerCase().includes(filter.toLowerCase()));

  if (selectedSupplier) {
    return <SupplierDetail supplier={selectedSupplier} onBack={() => setSelectedSupplier(null)} reliability={reliability.find(r => r.supplierId === selectedSupplier.id)} />;
  }

  return (
    <div className="space-y-4">
      <SectionHeader icon={Users} title={t('cmd.suppliers.title')} />

      <div className="flex items-center gap-2 flex-wrap">
        <TabBar
          tabs={[
            { id: 'list', label: t('cmd.suppliers.list') },
            { id: 'reliability', label: t('cmd.suppliers.reliability') },
          ]}
          activeTab={view}
          onChange={v => setView(v as typeof view)}
          variant="pill"
        />
        {view === 'list' && (
          <TabBar
            tabs={[
              { id: 'all', label: t('cmd.suppliers.all') },
              { id: 'Active', label: t('cmd.suppliers.active') },
              { id: 'Pending', label: t('cmd.suppliers.pending') },
              { id: 'Suspended', label: t('cmd.suppliers.suspended') },
            ]}
            activeTab={filter}
            onChange={f => setFilter(f as string)}
            variant="pill"
          />
        )}
        <button type="button" onClick={() => fetchSuppliers()}
          className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] cursor-pointer">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <Skeleton variant="card" count={6} />
      ) : view === 'reliability' ? (
        reliability.length === 0 ? (
          <EmptyState icon={TrendingUp} title={t('cmd.suppliers.noReliability')} />
        ) : (
          <DashCard padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono">
                <thead className="bg-[var(--btn-util-bg)] text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="py-2.5 px-3">{t('cmd.suppliers.supplierLabel')}</th>
                    <th className="py-2.5 px-3 text-center">{t('cmd.suppliers.bookingsLabel')}</th>
                    <th className="py-2.5 px-3 text-center">{t('cmd.suppliers.confirmPercent')}</th>
                    <th className="py-2.5 px-3 text-center">{t('cmd.suppliers.rejectPercent')}</th>
                    <th className="py-2.5 px-3 text-center">{t('cmd.suppliers.pendingLabel')}</th>
                    <th className="py-2.5 px-3">{t('cmd.suppliers.statusLabel')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reliability.map((r: any) => (
                    <tr key={r.supplierId} className="hover:bg-[var(--btn-util-bg)] transition-colors cursor-pointer" onClick={() => {
                      const sup = suppliers.find(s => s.id === r.supplierId);
                      if (sup) setSelectedSupplier(sup);
                    }}>
                      <td className="py-2.5 px-3">
                        <div className="text-[var(--accent-primary)] font-bold">{r.businessName}</div>
                        <div className="text-[var(--text-muted)] text-[10px]">{r.supplierId}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">{r.totalBookings}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={r.confirmationRate >= 80 ? 'text-emerald-400' : r.confirmationRate >= 50 ? 'text-amber-400' : 'text-red-400'}>
                          {r.confirmationRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={r.rejectionRate <= 10 ? 'text-emerald-400' : r.rejectionRate <= 30 ? 'text-amber-400' : 'text-red-400'}>
                          {r.rejectionRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-amber-400">{r.pendingCount}</td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={r.status || 'UNKNOWN'} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DashCard>
        )
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title={t('cmd.suppliers.noSuppliers')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(supplier => {
            const rel = reliability.find(r => r.supplierId === supplier.id);
            return (
              <button key={supplier.id} type="button" onClick={() => setSelectedSupplier(supplier)}
                className="p-4 rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/30 transition-all text-left cursor-pointer group">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-xs font-mono text-[var(--accent-primary)]">{supplier.id}</div>
                  <StatusBadge status={supplier.status || 'UNKNOWN'} size="sm" />
                </div>
                <div className="text-sm font-bold text-[var(--text-primary)]">{supplier.businessName}</div>
                <div className="text-[11px] text-[var(--text-muted)] mt-0.5">{supplier.businessNameAr}</div>
                <div className="mt-3 space-y-1 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <Shield className="w-3 h-3" /> {supplier.category} · {supplier.tier}
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                    <MapPin className="w-3 h-3" /> {supplier.area || '—'}
                  </div>
                  {supplier.rating && (
                    <div className="flex items-center gap-1.5 text-[var(--accent-secondary)]">
                      <Star className="w-3 h-3 fill-current" /> {supplier.rating} ({supplier.reviewCount || 0} {t('cmd.suppliers.reviews')})
                    </div>
                  )}
                  {rel && (
                    <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
                      <Package className="w-3 h-3" /> {rel.totalBookings} {t('cmd.suppliers.bookings')} · {rel.confirmationRate}% {t('cmd.suppliers.confirm')}
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--accent-primary)] font-bold group-hover:text-[var(--accent-primary)] flex items-center gap-1 transition-colors">
                  {t('cmd.suppliers.viewDashboard')} <ExternalLink className="w-3 h-3" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SupplierDetail({ supplier, onBack, reliability }: { supplier: any; onBack: () => void; reliability?: any }) {
  const { t } = useLanguage();
  const [dashboard, setDashboard] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bookings'>('overview');

  useEffect(() => {
    Promise.allSettled([
      api.getSupplierDashboard(supplier.id),
      api.getSupplierBookings(supplier.id),
    ]).then(([d, b]) => {
      if (d.status === 'fulfilled') setDashboard(d.value);
      if (b.status === 'fulfilled') setBookings((b.value as any)?.bookings || []);
    }).finally(() => setLoading(false));
  }, [supplier.id]);

  const handleBookingAction = async (bookingId: string, action: string) => {
    if (!confirm(t('cmd.suppliers.bookingAction').replace('${action}', action))) return;
    try {
      await api.respondSupplierBooking(bookingId, { supplierId: supplier.id, action: action as any });
      setBookings(prev => prev.map(b => b.id === bookingId ? { ...b, supplierState: action === 'ACCEPT' ? 'CONFIRMED' : action === 'REJECT' ? 'REJECTED' : b.supplierState } : b));
    } catch (err: any) { alert(`${t('cmd.suppliers.actionFailed')} ${err.message}`); }
  };

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-muted)] cursor-pointer">← {t('cmd.suppliers.backToSuppliers')}</button>
      <DashCard glow="green">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{supplier.businessName}</h3>
            <div className="text-xs text-[var(--text-muted)] mt-1">{supplier.id} · {supplier.category} · {supplier.tier}</div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={supplier.verificationStatus || 'UNKNOWN'} size="sm" />
            {supplier.status !== 'Suspended' && (
              <button type="button" onClick={() => alert(t('cmd.suppliers.suspendMsg'))}
                className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[11px] font-bold cursor-pointer">{t('cmd.suppliers.suspend')}</button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[var(--border-subtle)]">
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--accent-primary)] font-mono">{bookings.length}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.suppliers.totalBookings')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-emerald-400 font-mono">{reliability?.confirmationRate || dashboard?.metrics?.confirmationRate || '—'}{typeof reliability?.confirmationRate === 'number' ? '%' : ''}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.suppliers.confirmationRate')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-[var(--accent-secondary)] font-mono">{supplier.rating || '—'}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.suppliers.rating')}</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-sky-400 font-mono">{supplier.verificationStatus?.replace(/_/g, ' ') || '—'}</div>
            <div className="text-[11px] text-[var(--text-muted)]">{t('cmd.suppliers.verification')}</div>
          </div>
        </div>
      </DashCard>

      <TabBar
        tabs={[
          { id: 'overview', label: t('cmd.suppliers.overview') },
          { id: 'bookings', label: `${t('cmd.suppliers.bookingsLabel')} (${bookings.length})` },
        ]}
        activeTab={activeTab}
        onChange={tab => setActiveTab(tab as typeof activeTab)}
      />

      {loading ? (
        <Skeleton variant="list" count={3} />
      ) : activeTab === 'bookings' ? (
        bookings.length === 0 ? (
          <EmptyState icon={Users} title={t('cmd.suppliers.noBookings')} />
        ) : (
          <div className="space-y-2">
            {bookings.map((bk: any) => (
              <DashCard key={bk.id}>
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[var(--accent-primary)] font-mono font-bold">{bk.bookingRef || bk.id}</span>
                    <span className="text-[var(--text-muted)] ml-2">{bk.serviceType || bk.skuId}</span>
                    <span className="text-[var(--text-muted)] ml-2">{bk.scheduledDate}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={bk.supplierState || 'UNKNOWN'} size="sm" />
                    {bk.supplierState === 'PENDING_CONFIRMATION' && (
                      <div className="flex gap-1">
                        <button type="button" onClick={() => handleBookingAction(bk.id, 'ACCEPT')}
                          className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold cursor-pointer">{t('cmd.action.accept')}</button>
                        <button type="button" onClick={() => handleBookingAction(bk.id, 'REJECT')}
                          className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold cursor-pointer">{t('cmd.action.reject')}</button>
                      </div>
                    )}
                  </div>
                </div>
              </DashCard>
            ))}
          </div>
        )
      ) : (
        <DashCard>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div><span className="text-[var(--text-muted)]">{t('cmd.suppliers.categoryLabel')}</span> <span className="text-[var(--text-muted)] font-bold">{supplier.category}</span></div>
            <div><span className="text-[var(--text-muted)]">{t('cmd.suppliers.areaLabel')}</span> <span className="text-[var(--text-muted)] font-bold">{supplier.area || '—'}</span></div>
            <div><span className="text-[var(--text-muted)]">{t('cmd.suppliers.tierLabel')}</span> <span className="text-[var(--text-muted)] font-bold">{supplier.tier}</span></div>
            <div><span className="text-[var(--text-muted)]">{t('cmd.suppliers.phoneLabel')}</span> <span className="text-[var(--text-muted)] font-bold">{supplier.phone || '—'}</span></div>
          </div>
        </DashCard>
      )}
    </div>
  );
}
