import React, { useCallback, useEffect, useState } from 'react';
import { Check, X, RotateCcw, Wrench, Calendar, Bike, Loader2 } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';
import type {
  RentalBookingView,
  RentalListingView,
  RentalMaintenanceBlock
} from '../../shared/types/commerce';

interface RentalsProviderPanelProps {
  showToast: (msg: string) => void;
}

const STATUS_LABEL: Record<string, { en: string; ar: string }> = {
  PENDING_PAYMENT: { en: 'Awaiting payment', ar: 'في انتظار الدفع' },
  PENDING_CONFIRMATION: { en: 'Awaiting your confirmation', ar: 'في انتظار تأكيدك' },
  CONFIRMED: { en: 'Confirmed', ar: 'مؤكد' },
  READY_FOR_PICKUP: { en: 'Ready for pickup', ar: 'جاهز للاستلام' },
  ACTIVE: { en: 'With the traveler', ar: 'مع المسافر' },
  OVERDUE: { en: 'Overdue', ar: 'متأخر' },
  RETURNED: { en: 'Returned', ar: 'تم الإرجاع' },
  COMPLETED: { en: 'Completed', ar: 'مكتمل' },
  CANCELLED: { en: 'Cancelled', ar: 'ملغي' },
  REJECTED: { en: 'Rejected', ar: 'مرفوض' }
};

export const RentalsProviderPanel: React.FC<RentalsProviderPanelProps> = ({ showToast }) => {
  const { language, t } = useLanguage();
  const isAr = language === 'ar';
  const L = (key: string, fallbackEn: string, fallbackAr: string) => (isAr ? fallbackAr : fallbackEn);

  const [listings, setListings] = useState<RentalListingView[]>([]);
  const [bookings, setBookings] = useState<RentalBookingView[]>([]);
  const [blocks, setBlocks] = useState<RentalMaintenanceBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  // Maintenance block form
  const [blockListingId, setBlockListingId] = useState('');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockQty, setBlockQty] = useState(1);
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);

  // Mark-returned form
  const [returningId, setReturningId] = useState<string | null>(null);
  const [damageReport, setDamageReport] = useState('');
  const [depositDeduction, setDepositDeduction] = useState('');
  const [lateFee, setLateFee] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, b] = await Promise.all([api.getProviderRentals(), api.getProviderRentalBookings()]);
      setListings(l.rentals);
      setBookings(b.bookings);
      const allBlocks = l.rentals.flatMap(r => r.maintenanceBlocks ?? []);
      setBlocks(allBlocks);
      if (l.rentals.length > 0 && !blockListingId) setBlockListingId(l.rentals[0].id);
    } catch (e: any) {
      setError(String(e?.message || e || ''));
    } finally {
      setLoading(false);
    }
  }, [blockListingId]);

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const listingName = (id: string) => {
    const l = listings.find(x => x.id === id);
    return isAr && l?.nameAr ? l.nameAr : l?.name || id;
  };

  const run = async (id: string | null, fn: () => Promise<any>, okMsg: string) => {
    setActingId(id);
    setError(null);
    try {
      await fn();
      showToast(okMsg);
      await load();
    } catch (e: any) {
      setError(String(e?.message || e || ''));
    } finally {
      setActingId(null);
    }
  };

  const handleReturn = async (bookingId: string) => {
    await run(bookingId, () =>
      api.markRentalReturned(bookingId, {
        damageReport: damageReport || undefined,
        depositDeductionEGP: depositDeduction ? Number(depositDeduction) : undefined,
        lateFeeEGP: lateFee ? Number(lateFee) : undefined
      }),
      L('returned', 'Rental marked returned', 'تم تسجيل الإرجاع')
    );
    setReturningId(null);
    setDamageReport('');
    setDepositDeduction('');
    setLateFee('');
  };

  const handleAddBlock = async () => {
    if (!blockListingId || !blockStart || !blockEnd) return;
    await run(null, () =>
      api.addRentalMaintenanceBlock(blockListingId, {
        startDate: blockStart,
        endDate: blockEnd,
        quantityBlocked: blockQty,
        reason: blockReason || undefined
      }),
      L('blockAdded', 'Maintenance block added', 'تمت إضافة فترة الصيانة')
    );
    setBlockStart('');
    setBlockEnd('');
    setBlockQty(1);
    setBlockReason('');
    setShowBlockForm(false);
  };

  const handleRemoveBlock = async (listingId: string, blockId: string) => {
    await run(blockId, () => api.removeRentalMaintenanceBlock(listingId, blockId), L('blockRemoved', 'Maintenance block removed', 'تمت إزالة فترة الصيانة'));
  };

  const inputCls = 'w-full rounded-xl border px-3 py-2 text-sm outline-none bg-[var(--surface-container)] border-[var(--text-primary)]/10 text-[var(--text-primary)]';
  const labelCls = 'block text-[11px] font-bold mb-1 text-[var(--text-primary)]/60';

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--text-primary)]/60">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('cmd.loading')}
      </div>
    );
  }

  if (error && listings.length === 0) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-500 font-bold">
        {error}
      </div>
    );
  }

  const pending = bookings.filter(b => b.status === 'PENDING_CONFIRMATION');
  const inProgress = bookings.filter(b =>
    ['CONFIRMED', 'READY_FOR_PICKUP', 'ACTIVE', 'OVERDUE'].includes(b.status)
  );
  const history = bookings.filter(b =>
    ['RETURNED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'PENDING_PAYMENT'].includes(b.status)
  );

  const renderStatus = (status: string) => {
    const s = STATUS_LABEL[status] || { en: status, ar: status };
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border border-[var(--text-primary)]/10 bg-[var(--surface-container)] text-[var(--text-primary)]/80">
        {isAr ? s.ar : s.en}
      </span>
    );
  };

  const renderBooking = (b: RentalBookingView) => (
    <div key={b.id} className="rounded-2xl border border-[var(--text-primary)]/10 bg-[var(--surface-card)] p-4 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bike className="w-4 h-4 text-[var(--accent-secondary)]" />
          <span className="text-sm font-bold">{listingName(b.listingId)}</span>
        </div>
        {renderStatus(b.status)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-primary)]/70">
        <span>{b.travelerName} · {b.quantity} {isAr ? 'عجلة' : 'bike(s)'}</span>
        <span>{b.startDate} → {b.endDate}</span>
        <span>{b.deliveryMode === 'DELIVERY' ? (isAr ? 'توصيل' : 'Delivery') : (isAr ? 'استلام' : 'Pickup')}</span>
        <span className="font-bold text-[var(--text-primary)]">{b.priceBreakdown.totalEGP.toLocaleString()} EGP</span>
      </div>
      {b.notes && <p className="text-xs text-[var(--text-primary)]/60 italic">{b.notes}</p>}
      {b.status === 'PENDING_CONFIRMATION' && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => run(b.id, () => api.acceptRentalBooking(b.id), L('accepted', 'Booking accepted', 'تم قبول الحجز'))}
            disabled={actingId === b.id}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-secondary)] text-white px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            {actingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isAr ? 'قبول' : 'Accept'}
          </button>
          <button
            type="button"
            onClick={() => run(b.id, () => api.rejectRentalBooking(b.id, 'Not available'), L('rejected', 'Booking rejected', 'تم رفض الحجز'))}
            disabled={actingId === b.id}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/40 text-red-500 px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
            {isAr ? 'رفض' : 'Reject'}
          </button>
        </div>
      )}
      {(b.status === 'CONFIRMED' || b.status === 'READY_FOR_PICKUP' || b.status === 'ACTIVE' || b.status === 'OVERDUE') && (
        <div className="pt-1 space-y-2">
          {returningId === b.id ? (
            <div className="space-y-2 rounded-xl border border-[var(--text-primary)]/10 bg-[var(--surface-container)] p-3">
              <input
                type="text"
                value={damageReport}
                onChange={e => setDamageReport(e.target.value)}
                placeholder={isAr ? 'تقرير الأضرار (اختياري)' : 'Damage report (optional)'}
                className={inputCls}
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>{isAr ? 'خصم التأمين (EGP)' : 'Deposit deduction (EGP)'}</label>
                  <input type="number" min={0} value={depositDeduction} onChange={e => setDepositDeduction(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>{isAr ? 'غرامة التأخير (EGP)' : 'Late fee (EGP)'}</label>
                  <input type="number" min={0} value={lateFee} onChange={e => setLateFee(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleReturn(b.id)}
                  disabled={actingId === b.id}
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] text-white px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {actingId === b.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  {isAr ? 'تأكيد الإرجاع' : 'Confirm return'}
                </button>
                <button
                  type="button"
                  onClick={() => setReturningId(null)}
                  className="rounded-xl border border-[var(--text-primary)]/15 px-3 py-2 text-xs font-bold text-[var(--text-primary)]/70 cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReturningId(b.id)}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] px-3 py-2 text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {isAr ? 'تسجيل الإرجاع' : 'Mark returned'}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500 font-bold">
          {error}
        </div>
      )}

      {/* Pending */}
      <section className="space-y-3">
        <h3 className="text-sm chart-heading font-bold">
          {isAr ? 'طلبات التأكيد' : 'Awaiting confirmation'} ({pending.length})
        </h3>
        {pending.length === 0 ? (
          <p className="text-sm text-[var(--text-primary)]/50">{isAr ? 'لا توجد طلبات معلقة.' : 'No pending requests.'}</p>
        ) : (
          <div className="space-y-3">{pending.map(renderBooking)}</div>
        )}
      </section>

      {/* In progress */}
      <section className="space-y-3">
        <h3 className="text-sm chart-heading font-bold">
          {isAr ? 'تأجير جارٍ' : 'Rentals in progress'} ({inProgress.length})
        </h3>
        {inProgress.length === 0 ? (
          <p className="text-sm text-[var(--text-primary)]/50">{isAr ? 'لا توجد تأجيرات جارية.' : 'No active rentals.'}</p>
        ) : (
          <div className="space-y-3">{inProgress.map(renderBooking)}</div>
        )}
      </section>

      {/* Maintenance blocks */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm chart-heading font-bold">
            {isAr ? 'فترات الصيانة' : 'Maintenance blocks'} ({blocks.length})
          </h3>
          <button
            type="button"
            onClick={() => setShowBlockForm(v => !v)}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--accent-primary)]/40 text-[var(--accent-primary)] px-3 py-2 text-xs font-bold cursor-pointer"
          >
            <Wrench className="w-3.5 h-3.5" />
            {showBlockForm ? (isAr ? 'إغلاق' : 'Close') : isAr ? 'إضافة فترة' : 'Add block'}
          </button>
        </div>

        {showBlockForm && (
          <div className="rounded-2xl border border-[var(--text-primary)]/10 bg-[var(--surface-card)] p-4 space-y-3">
            <div>
              <label className={labelCls}>{isAr ? 'العرض' : 'Listing'}</label>
              <select value={blockListingId} onChange={e => setBlockListingId(e.target.value)} className={inputCls}>
                {listings.map(l => (
                  <option key={l.id} value={l.id}>{isAr && l.nameAr ? l.nameAr : l.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{isAr ? 'من' : 'From'}</label>
                <input type="date" value={blockStart} onChange={e => setBlockStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'إلى' : 'To'}</label>
                <input type="date" min={blockStart} value={blockEnd} onChange={e => setBlockEnd(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{isAr ? 'عدد العجلات' : 'Bikes blocked'}</label>
                <input type="number" min={1} value={blockQty} onChange={e => setBlockQty(Math.max(1, Number(e.target.value)))} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>{isAr ? 'السبب' : 'Reason'}</label>
                <input type="text" value={blockReason} onChange={e => setBlockReason(e.target.value)} className={inputCls} />
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddBlock}
              disabled={!blockStart || !blockEnd}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] text-white px-3 py-2 text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              {actingId === null ? <Wrench className="w-3.5 h-3.5" /> : <Loader2 className="w-3 h-3 animate-spin" />}
              {isAr ? 'إضافة فترة الصيانة' : 'Add maintenance block'}
            </button>
          </div>
        )}

        {blocks.length > 0 && (
          <div className="space-y-2">
            {blocks.map(block => (
              <div key={block.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--text-primary)]/10 bg-[var(--surface-card)] p-3">
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-[var(--accent-secondary)]" />
                  <span className="font-bold">{listingName(block.listingId)}</span>
                  <span className="text-[var(--text-primary)]/70">{block.startDate} → {block.endDate}</span>
                  <span className="text-[var(--text-primary)]/50">· {block.quantityBlocked} · {block.reason}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveBlock(block.listingId, block.id)}
                  disabled={actingId === block.id}
                  className="flex items-center gap-1 text-xs font-bold text-red-500 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" />
                  {isAr ? 'إزالة' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      {history.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm chart-heading font-bold">{isAr ? 'السجل' : 'History'} ({history.length})</h3>
          <div className="space-y-2">{history.map(renderBooking)}</div>
        </section>
      )}
    </div>
  );
};