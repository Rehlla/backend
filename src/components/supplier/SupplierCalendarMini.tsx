import React, { useEffect, useState } from 'react';
import { Calendar } from 'lucide-react';
import { api } from '../../services/api';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * SupplierCalendarMini — the real 30-day availability view from
 * supplierCalendarService, identical to what booking flows consult.
 *
 * Replaces 'Sync Inventory' theater: that button used to fire a toast
 * claiming a sync that fetched nothing. This shows the supplier exactly
 * what a traveler sees when they try to book them — blocked days in red,
 * open days in green, hover for the block reason.
 */
export const SupplierCalendarMini: React.FC<{ supplierId: string }> = ({ supplierId }) => {
  const { language, t } = useLanguage();
  const [availability, setAvailability] = useState<Record<string, { blocked: boolean; reason?: string }>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getSupplierAvailability(supplierId).then(data => {
      if (!cancelled) setAvailability(data);
      if (!cancelled) setLoaded(true);
    }).catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [supplierId]);

  if (!loaded) return null;

  const days = Object.entries(availability).sort(([a], [b]) => a.localeCompare(b));
  if (days.length === 0) return null;

  const blockedCount = days.filter(([, v]) => v.blocked).length;

  return (
    <div
      className="p-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-container)]/50 space-y-3"
      data-testid="supplier-calendar"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
          {t('supplier.calendar30')}
        </span>
        <span className="text-[11px] text-[var(--text-secondary)]">
          {blockedCount > 0
            ? (language === 'ar' ? `${blockedCount} يوم مغلق` : `${blockedCount} blocked day${blockedCount === 1 ? '' : 's'}`)
            : (language === 'ar' ? 'كل الأيام متاحة' : 'All days open')}
        </span>
      </div>
      <div className="grid grid-cols-10 gap-1">
        {days.map(([date, info]) => (
          <div
            key={date}
            title={info.blocked ? (info.reason || 'Blocked') : date}
            aria-label={info.blocked ? `${date} blocked` : `${date} available`}
            className={`h-7 rounded-md flex items-center justify-center text-[9px] font-mono border ${
              info.blocked
                ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            }`}
          >
            {date.slice(8)}
          </div>
        ))}
      </div>
    </div>
  );
};
