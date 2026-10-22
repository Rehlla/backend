import React, { useState, useEffect, useCallback } from 'react';
import { Car, Phone } from 'lucide-react';
import { api } from '../../../services/api';
import { useLanguage } from '../../../i18n/LanguageContext';
import { SectionHeader } from './ui/SectionHeader';
import { TabBar } from './ui/TabBar';
import { EmptyState } from './ui/EmptyState';
import { Skeleton } from './ui/Skeleton';
import { DashCard } from './ui/DashCard';
import { StatusBadge } from './ui/StatusBadge';
import TransferHubAdmin from './TransferHubAdmin';

function formatTelemetryAge(lastTelemetryAt: unknown, minutesAgoLabel: string, noTelemetryLabel: string) {
  if (!lastTelemetryAt) return noTelemetryLabel;

  const rawValue = String(lastTelemetryAt);
  const timestamp = Date.parse(rawValue);
  if (Number.isNaN(timestamp)) return rawValue;

  return `${Math.max(0, Math.round((Date.now() - timestamp) / 60_000))}${minutesAgoLabel}`;
}

export default function TransfersSection() {
  const { t } = useLanguage();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');
  const [typeFilter, setTypeFilter] = useState<'all' | 'within_dahab' | 'anywhere'>('all');
  const [pane, setPane] = useState<'queue' | 'matrix' | 'timetable' | 'drivers'>('queue');
  const [drivers, setDrivers] = useState<Array<{ id: string; nameEn: string }>>([]);

  const fetchTransfers = useCallback(async () => {
    try {
      const data = await api.getOperationsTransfers();
      setTransfers(data?.transfers || []);
      setLastUpdated(new Date());
    } catch { setTransfers([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTransfers(); const i = setInterval(fetchTransfers, 30_000); return () => clearInterval(i); }, [fetchTransfers]);
  useEffect(() => {
    api.getOpsTransferCatalog().then(data => {
      setDrivers((data.drivers || []).map(driver => ({ id: String(driver.id), nameEn: String(driver.nameEn) })));
    }).catch(() => undefined);
  }, []);

  const filtered = (filter === 'all' ? transfers : filter === 'active' ? transfers.filter(transfer => transfer.supplierState !== 'COMPLETED') : transfers.filter(transfer => transfer.supplierState === 'COMPLETED'))
    .filter(transfer => typeFilter === 'all' || transfer.transferType === typeFilter);

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Car}
        title={t('cmd.transfers.title')}
        subtitle={lastUpdated ? t('cmd.overview.updatedSecondsAgo').replace('${s}', String(Math.round((Date.now() - lastUpdated.getTime()) / 1000))) : undefined}
      />

      <TabBar
        tabs={[
          { id: 'queue', label: t('cmd.transfers.queue') },
          { id: 'matrix', label: t('cmd.transfers.matrix') },
          { id: 'timetable', label: t('cmd.transfers.timetable') },
          { id: 'drivers', label: t('cmd.transfers.drivers') },
        ]}
        activeTab={pane}
        onChange={tab => setPane(tab as typeof pane)}
        variant="pill"
      />

      {pane !== 'queue' && <TransferHubAdmin pane={pane} />}

      {pane === 'queue' && <>
      <div className="flex items-center gap-2 flex-wrap">
        <TabBar
          tabs={[
            { id: 'within_dahab', label: t('cmd.transfers.inside') },
            { id: 'anywhere', label: t('cmd.transfers.egypt') },
            { id: 'all', label: t('cmd.transfers.allTypes') },
          ]}
          activeTab={typeFilter}
          onChange={tab => setTypeFilter(tab as typeof typeFilter)}
          variant="pill"
        />
        <TabBar
          tabs={[
            { id: 'active', label: t('cmd.transfers.active') },
            { id: 'all', label: t('cmd.transfers.all') },
            { id: 'completed', label: t('cmd.transfers.completed') },
          ]}
          activeTab={filter}
          onChange={tab => setFilter(tab as typeof filter)}
          variant="pill"
        />
      </div>

      {loading ? (
        <Skeleton variant="list" count={4} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Car} title={t('cmd.transfers.noTransfers')} />
      ) : (
        <div className="space-y-2">
          {filtered.map(transfer => (
            <DashCard key={transfer.id} className={transfer.supplierState === 'COMPLETED' ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--btn-util-bg)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                    <Car className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-mono text-[var(--accent-primary)]">{transfer.bookingRef}</span>
                      <StatusBadge status={transfer.supplierState || 'UNKNOWN'} size="sm" />
                    </div>
                    <div className="text-xs font-bold text-[var(--text-primary)] mt-1">{transfer.driverName || t('cmd.transfers.noDriver')}</div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                      {transfer.vehiclePlate && <span>{transfer.vehiclePlate}</span>}
                      {transfer.driverPhone && <span>{transfer.driverPhone}</span>}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {transfer.pickupLocation && <span>{transfer.pickupLocation}</span>}
                      {transfer.dropoffLocation && <span>→ {transfer.dropoffLocation}</span>}
                    </div>
                    {transfer.marginEGP != null && (
                      <div className="text-[11px] mt-1">
                        {t('cmd.transfers.sell')} {transfer.sellEGP} · {t('cmd.transfers.supplierCost')} {transfer.supplierCostEGP} · {t('cmd.transfers.margin')} {transfer.marginEGP}
                      </div>
                    )}
                    {transfer.freeCancelUntil && (
                      <div className="text-[11px] text-[var(--text-muted)] mt-1">{t('cmd.transfers.cancelBy')} {String(transfer.freeCancelUntil).slice(0, 16)}</div>
                    )}
                    {transfer.freeCancelUntil && !transfer.driverName && drivers.length > 0 && (
                      <select
                        aria-label={t('cmd.transfers.assign')}
                        defaultValue=""
                        className="mt-2 rounded border bg-transparent text-[11px] px-1 py-1"
                        onChange={event => {
                          if (event.target.value) api.assignOpsTransferDriver(transfer.id, event.target.value).then(() => fetchTransfers());
                        }}
                      >
                        <option value="">{t('cmd.transfers.assign')}</option>
                        {drivers.map(driver => <option key={driver.id} value={driver.id}>{driver.nameEn}</option>)}
                      </select>
                    )}
                  </div>
                </div>
                <div className="text-end shrink-0">
                  <div className="text-[11px] text-[var(--text-muted)] font-mono">
                    {formatTelemetryAge(transfer.lastTelemetryAt, t('cmd.overview.minutesAgoShort'), t('cmd.transfers.noTelemetry'))}
                  </div>
                  {transfer.supplierState !== 'COMPLETED' && transfer.driverPhone && (
                    <a href={`tel:${transfer.driverPhone}`} className="mt-1 inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--accent-primary)]/20 hover:bg-[var(--accent-primary)]/30 text-[var(--accent-primary)] text-[11px] font-bold transition-colors">
                      <Phone className="w-3 h-3" /> {t('cmd.transfers.call')}
                    </a>
                  )}
                </div>
              </div>
            </DashCard>
          ))}
        </div>
      )}
      </>}
    </div>
  );
}
