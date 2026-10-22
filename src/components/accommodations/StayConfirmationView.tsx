import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check, Clock, XCircle, Loader2, AlertTriangle, Upload, Ban, RefreshCw, Printer,
} from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import StayReviewForm from './StayReviewForm';
import WalletPayCard, { type WalletPayee } from './WalletPayCard';

/**
 * After the reservation opens: what was held, what is owed, how to pay it,
 * and what to do if the plan changes.
 *
 * The page is the traveller's only persistent view of the booking — reachable
 * again by reference from "my stays" — so it shows the status, the payment
 * instructions as staff wrote them, the proof upload, the cancellation window
 * and the reschedule action in one place.
 */

interface StayConfirmationViewProps {
  bookingRef: string;
  onBack: () => void;
}

const STATUS_LABEL: Record<string, { key: string; tone: 'green' | 'amber' | 'red' | 'blue' }> = {
  PENDING_PAYMENT: { key: 'hotels.statusPendingPayment', tone: 'amber' },
  PENDING_CONFIRMATION: { key: 'hotels.statusPendingConfirmation', tone: 'amber' },
  CONFIRMED: { key: 'hotels.statusConfirmed', tone: 'green' },
  REJECTED: { key: 'hotels.statusRejected', tone: 'red' },
  CANCELLED: { key: 'hotels.statusCancelled', tone: 'red' },
  EXPIRED: { key: 'hotels.statusExpired', tone: 'red' },
  IN_HOUSE: { key: 'hotels.statusInHouse', tone: 'green' },
  COMPLETED: { key: 'hotels.statusCompleted', tone: 'green' },
  NO_SHOW: { key: 'hotels.statusNoShow', tone: 'red' },
};

const TONE_CLASS: Record<string, string> = {
  green: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  amber: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  red: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  blue: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
};

export const StayConfirmationView: React.FC<StayConfirmationViewProps> = ({ bookingRef, onBack }) => {
  const { language, isRTL, t } = useLanguage();
  const { isDark } = useTheme();
  const isAr = language === 'ar';
  const inputRef = useRef<HTMLInputElement>(null);

  const stay = useApiResource<Record<string, unknown> | null>(
    useCallback((signal) => api.getStay(bookingRef, signal), [bookingRef])
  );

  const [proofUrl, setProofUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // A ticking clock for the payment window, only while one is running.
  const [now, setNow] = useState(() => Date.now());
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelResult, setCancelResult] = useState<{ refundEGP: number; withinFreeWindow: boolean } | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleIn, setRescheduleIn] = useState('');
  const [rescheduleOut, setRescheduleOut] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Poll while a decision is pending — no webhook will ever arrive.
  useEffect(() => {
    const status = stay.data?.status;
    if (status !== 'PENDING_PAYMENT' && status !== 'PENDING_CONFIRMATION') return;
    const id = setInterval(() => stay.reload(), 20_000);
    return () => clearInterval(id);
  }, [stay, stay.data?.status]);

  const b = stay.data ?? null;
  const status = typeof b?.status === 'string' ? b.status : null;
  const instructions = (b?.paymentInstructions ?? {}) as Record<string, unknown>;
  // Cash on arrival takes no deposit, so its waiting state must not claim one
  // was received, and the payment box explains paying at the desk instead.
  const noDeposit = Number(b?.depositEGP ?? instructions.amountEGP ?? 0) === 0;
  const statusMeta = status
    ? status === 'PENDING_CONFIRMATION' && noDeposit
      ? { key: 'hotels.statusAwaitingPropertyNoDeposit', tone: 'amber' as const }
      : STATUS_LABEL[status] ?? { key: 'hotels.statusUnknown', tone: 'blue' as const }
    : null;
  // InstaPay / Vodafone Cash bookings carry the payee the server resolved.
  const walletMethod = instructions.method === 'INSTAPAY' || instructions.method === 'VODAFONE_CASH'
    ? (instructions.method as 'INSTAPAY' | 'VODAFONE_CASH')
    : null;
  const walletPayee = walletMethod && instructions.payee && typeof instructions.payee === 'object'
    ? (instructions.payee as WalletPayee)
    : null;
  const breakdown = (b?.priceBreakdown ?? {}) as Record<string, unknown>;
  const currency = typeof breakdown.currency === 'string' ? breakdown.currency : 'EGP';
  const freeUntil = typeof b?.freeCancellationUntil === 'string' ? b.freeCancellationUntil : null;
  const withinFree = freeUntil !== null && new Date(freeUntil) > new Date();

  const holdUntil = status === 'PENDING_PAYMENT' && typeof b?.holdExpiresAt === 'string' ? b.holdExpiresAt : null;
  useEffect(() => {
    if (!holdUntil) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [holdUntil]);
  const holdLeftMs = holdUntil ? new Date(holdUntil).getTime() - now : null;
  const holdLeft = holdLeftMs !== null && holdLeftMs > 0
    ? `${Math.floor(holdLeftMs / 60000)}:${String(Math.floor((holdLeftMs % 60000) / 1000)).padStart(2, '0')}`
    : null;

  const uploadProof = async () => {
    if (!proofUrl.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      await api.submitStayPaymentProof(bookingRef, { proofUrl: proofUrl.trim() });
      setUploadDone(true);
      setProofUrl('');
      stay.reload();
    } catch (e: any) {
      // e.g. a link that is not https:// — say so instead of failing silently.
      setUploadError(String(e?.message || t('hotels.receiptFailed')));
    } finally {
      setUploading(false);
    }
  };

  /** A photo of the receipt, straight from the camera roll. */
  const uploadReceiptFile = async (file: File) => {
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError(t('hotels.receiptNotImage'));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setUploadError(t('hotels.receiptTooLarge'));
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await api.uploadStayReceipt(bookingRef, dataUrl);
      setUploadDone(true);
      stay.reload();
    } catch (e: any) {
      setUploadError(String(e?.message || t('hotels.receiptFailed')));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      const res = (await api.cancelStay(bookingRef, cancelReason.trim() || undefined)) as {
        booking: Record<string, unknown>;
        refundEGP: number;
        withinFreeWindow: boolean;
      };
      setCancelResult({ refundEGP: res.refundEGP, withinFreeWindow: res.withinFreeWindow });
      stay.reload();
    } finally {
      setCancelling(false);
    }
  };

  const reschedule = async () => {
    setRescheduling(true);
    try {
      await api.rescheduleStay(bookingRef, { checkIn: rescheduleIn, checkOut: rescheduleOut });
      setRescheduleOpen(false);
      setRescheduleIn('');
      setRescheduleOut('');
      stay.reload();
    } finally {
      setRescheduling(false);
    }
  };

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (stay.status === 'loading' && !b) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--text-secondary)]">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!b || stay.status === 'error') {
    return (
      <div className={`min-h-[50vh] flex items-center justify-center px-4 ${isDark ? 'bg-[var(--bg-canvas)]' : 'bg-[var(--bg-canvas)]'}`}>
        <div className="max-w-sm text-center space-y-4">
          <AlertTriangle className="w-10 h-10 mx-auto text-[var(--accent-primary)]" />
          <h1 className="text-xl font-black">{t('hotels.stayNotFound')}</h1>
          <button type="button" onClick={onBack} className="text-sm font-bold text-[var(--accent-primary)]">
            {t('common.back')}
          </button>
        </div>
      </div>
    );
  }

  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      data-stay-receipt
      className={`min-h-screen ${isDark ? 'bg-[var(--bg-canvas)] text-[var(--text-primary)]' : 'bg-[var(--bg-canvas)] text-[var(--text-primary)]'}`}
    >
      {/* Only on paper: who issued this and when. */}
      <p className="hidden print:block px-4 pt-4 text-xs">
        {t('hotels.receiptPrintHeader', { date: new Date().toLocaleString(isAr ? 'ar-EG' : 'en-GB') })}
      </p>
      <div className={`print:hidden sticky top-0 z-20 border-b backdrop-blur-md ${isDark ? 'bg-[var(--surface-card)]/95 border-[var(--border-subtle)]' : 'bg-[var(--surface-card)]/95 border-[var(--border-subtle)]'}`}>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            {t('common.back')}
          </button>
          <span className={`text-xs font-black px-2.5 py-1 rounded-full border ${isDark ? 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]' : 'bg-[var(--surface-container)] border-[var(--border-subtle)] text-[var(--text-secondary)]'}`}>
            {bookingRef}
          </span>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Status banner */}
        {statusMeta && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border p-4 flex items-start gap-3 ${TONE_CLASS[statusMeta.tone]} ${isDark ? 'bg-opacity-60' : ''}`}
          >
            {status === 'CONFIRMED' || status === 'COMPLETED' || status === 'IN_HOUSE' ? (
              <Check className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : status === 'REJECTED' || status === 'CANCELLED' || status === 'EXPIRED' ? (
              <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-black">{t(statusMeta.key)}</p>
              {status === 'PENDING_PAYMENT' && holdLeft && (
                <p className="mt-1 text-sm font-bold tabular-nums" aria-live="off">
                  {t('hotels.holdCountdown', { time: holdLeft })}
                </p>
              )}
              {status === 'PENDING_PAYMENT' && holdUntil && !holdLeft && (
                <p className="mt-1 text-xs font-bold">{t('hotels.holdLapsed')}</p>
              )}
              {status === 'PENDING_PAYMENT' && (
                <p className="mt-1 text-xs opacity-80">
                  {t('hotels.holdExpiresAt', {
                    time: instructions.deadline
                      ? `${fmtDay(String(instructions.deadline))} · ${t('hotels.holdMinutes')}`
                      : t('hotels.holdMinutes'),
                  })}
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Stay facts */}
        <div className={`rounded-2xl border divide-y ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
          <div className="p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                {t('hotels.checkInLabel')}
              </div>
              <div className="font-black">{fmtDay(String(b.checkIn ?? ''))}</div>
            </div>
            <div>
              <div className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                {t('hotels.checkOutLabel')}
              </div>
              <div className="font-black">{fmtDay(String(b.checkOut ?? ''))}</div>
            </div>
            <div>
              <div className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                {t('hotels.roomsLabel')}
              </div>
              <div className="font-black">{String(b.rooms ?? '')}</div>
            </div>
            <div>
              <div className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                {t('hotels.nightsLabel')}
              </div>
              <div className="font-black">{String(b.nights ?? '')}</div>
            </div>
          </div>
          <div className="p-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">{t('hotels.stayTotal')}</span>
              <span className="font-bold">{Number(breakdown.totalEGP ?? 0).toLocaleString()} {currency}</span>
            </div>
            {/* Labels follow the money: "deposit now" / "balance on arrival"
                read as still owed on a stay the desk has already settled. */}
            <div className="flex justify-between font-bold text-[var(--accent-primary)]">
              <span>{t(b.paidAt ? 'hotels.depositPaid' : 'hotels.depositNow')}</span>
              <span>{Number(b.depositEGP ?? 0).toLocaleString()} {currency}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-secondary)]">{t(b.balanceSettledAt ? 'hotels.balancePaid' : 'hotels.balanceOnArrival')}</span>
              <span className={`font-bold ${b.balanceSettledAt ? 'text-emerald-500' : ''}`}>{Number(breakdown.balanceDueEGP ?? 0).toLocaleString()} {currency}</span>
            </div>
          </div>
        </div>

        {/* Confirmation code */}
        {typeof b.confirmationCode === 'string' && (
          <div className={`rounded-2xl border p-4 text-center ${isDark ? 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5' : 'border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/5'}`}>
            <div className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
              {t('hotels.confirmationCode')}
            </div>
            <div className="mt-1 text-2xl font-black tracking-widest text-[var(--accent-primary)]">
              {b.confirmationCode}
            </div>
          </div>
        )}

        {/* Review, once the stay is over. The server refuses an unfinished
            stay, so the form is offered only where it can succeed. */}
        {status === 'COMPLETED' && (
          <StayReviewForm bookingRef={bookingRef} />
        )}
        {/* Payment instructions */}
        {(status === 'PENDING_PAYMENT' || status === 'PENDING_CONFIRMATION') && (
          <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
            <h3 className="text-sm font-black">{t(noDeposit ? 'hotels.howToPayOnArrival' : 'hotels.howToPay')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">{t('hotels.methodLabel')}</span>
                <span className="font-bold">
                  {t(`payment.${String(instructions.method ?? '').toLowerCase().replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())}`)}
                </span>
              </div>
              {!walletPayee && Number(instructions.amountEGP ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-[var(--text-secondary)]">{t('hotels.amountLabel')}</span>
                <span className="font-black text-[var(--accent-primary)]">
                  {Number(instructions.amountEGP ?? 0).toLocaleString()} {currency}
                </span>
              </div>
              )}
              {!walletPayee && typeof instructions.reference === 'string' && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{t('hotels.referenceLabel')}</span>
                  <span className="font-bold font-mono">{instructions.reference}</span>
                </div>
              )}
              {!walletPayee && typeof instructions.contactPhone === 'string' && Number(instructions.amountEGP ?? 0) > 0 && (
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{t('hotels.payTo')}</span>
                  <span className="font-bold">{instructions.contactPhone}</span>
                </div>
              )}
              <p className={`text-xs leading-relaxed pt-1 ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                {isAr ? String(instructions.instructionsAr ?? '') : String(instructions.instructions ?? '')}
              </p>
            </div>

            {walletMethod && walletPayee && status === 'PENDING_PAYMENT' && (
              <WalletPayCard
                bookingRef={bookingRef}
                method={walletMethod}
                amountEGP={Number(instructions.amountEGP ?? 0)}
                currency={currency}
                payee={walletPayee}
                payerNumber={typeof instructions.payerNumber === 'string' ? instructions.payerNumber : undefined}
                payerReference={typeof instructions.payerReference === 'string' ? instructions.payerReference : undefined}
                canClaim={status === 'PENDING_PAYMENT'}
                onClaimed={() => stay.reload()}
              />
            )}

            {status === 'PENDING_PAYMENT' && (
              <div className="space-y-2 pt-1">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={t('hotels.uploadReceipt')}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) void uploadReceiptFile(file);
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] text-[var(--surface-container)] text-sm font-bold disabled:opacity-40 hover:brightness-110 transition-[filter]"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {t('hotels.uploadReceipt')}
                </button>
                <p className="text-[11px] text-center text-[var(--text-secondary)]">{t('hotels.orPasteLink')}</p>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="url"
                    value={proofUrl}
                    onChange={e => setProofUrl(e.target.value)}
                    placeholder={t('hotels.proofUrlPlaceholder')}
                    className={`flex-1 rounded-xl border bg-[var(--surface-card)] px-3 py-2.5 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
                  />
                  <button
                    type="button"
                    disabled={uploading || !proofUrl.trim()}
                    onClick={() => void uploadProof()}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] px-3 text-sm font-bold disabled:opacity-40 hover:bg-[var(--btn-util-hover)] transition-colors"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {t('hotels.attachProof')}
                  </button>
                </div>
                {uploadError && (
                  <p role="alert" className="text-xs text-rose-500">{uploadError}</p>
                )}
                {uploadDone && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    {t('hotels.proofAttached')}
                  </p>
                )}
                <p className={`text-[11px] ${isDark ? 'text-[var(--text-secondary)]/70' : 'text-[var(--text-secondary)]/70'}`}>
                  {t('hotels.proofNote')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Cancellation window */}
        {withinFree && (status === 'PENDING_PAYMENT' || status === 'PENDING_CONFIRMATION' || status === 'CONFIRMED') && (
          <p className={`text-xs text-center ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
            {t('hotels.freeCancellationUntil', { time: freeUntil ? fmtDateTime(freeUntil) : '' })}
          </p>
        )}

        {/* A copy for the guest's records or a visa file: the browser's own
            print dialog saves it as PDF, so no PDF library joins the bundle. */}
        {status !== null && status !== 'EXPIRED' && (
          <button
            type="button"
            onClick={() => window.print()}
            className="print:hidden w-full min-h-[44px] rounded-xl border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            {t('hotels.printReceipt')}
          </button>
        )}

        {/* Actions */}
        <div className="space-y-2 print:hidden">
          {(status === 'PENDING_PAYMENT' || status === 'PENDING_CONFIRMATION' || status === 'CONFIRMED') && (
            <>
              {!cancelOpen ? (
                <button
                  type="button"
                  onClick={() => setCancelOpen(true)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] py-2.5 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--btn-util-hover)] transition-colors flex items-center justify-center gap-2"
                >
                  <Ban className="h-4 w-4" />
                  {t('hotels.cancelReservation')}
                </button>
              ) : (
                <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'border-rose-500/30 bg-rose-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
                  <p className="text-sm font-bold text-rose-600">{t('hotels.cancelConfirmTitle')}</p>
                  <textarea
                    value={cancelReason}
                    onChange={e => setCancelReason(e.target.value)}
                    rows={2}
                    placeholder={t('hotels.cancelReasonPlaceholder')}
                    className={`w-full rounded-xl border bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={() => void cancel()}
                      className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white py-2.5 text-sm font-bold"
                    >
                      {cancelling ? t('common.working') : t('hotels.confirmCancel')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCancelOpen(false); setCancelReason(''); }}
                      className="rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold"
                    >
                      {t('common.back')}
                    </button>
                  </div>
                  {cancelResult && (
                    <p className="text-xs">
                      {cancelResult.withinFreeWindow
                        ? t('hotels.cancelRefunded', { amount: cancelResult.refundEGP.toLocaleString(), currency })
                        : t('hotels.cancelForfeited', { currency })}
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {(status === 'PENDING_PAYMENT' || status === 'PENDING_CONFIRMATION' || status === 'CONFIRMED') && (
            <>
              {!rescheduleOpen ? (
                <button
                  type="button"
                  onClick={() => {
                    setRescheduleIn(String(b.checkIn ?? ''));
                    setRescheduleOut(String(b.checkOut ?? ''));
                    setRescheduleOpen(true);
                  }}
                  className="w-full rounded-xl border border-[var(--border-subtle)] py-2.5 text-sm font-bold text-[var(--text-secondary)] hover:bg-[var(--btn-util-hover)] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  {t('hotels.reschedule')}
                </button>
              ) : (
                <div className={`rounded-2xl border p-4 space-y-3 ${isDark ? 'border-[var(--border-subtle)] bg-[var(--surface-card)]' : 'border-[var(--border-subtle)] bg-[var(--surface-card)]'}`}>
                  <h3 className="text-sm font-bold">{t('hotels.rescheduleTitle')}</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                        {t('hotels.checkInLabel')}
                      </span>
                      <input
                        type="date"
                        value={rescheduleIn}
                        onChange={e => setRescheduleIn(e.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
                      />
                    </label>
                    <label className="block">
                      <span className={`text-[11px] font-bold ${isDark ? 'text-[var(--text-secondary)]' : 'text-[var(--text-secondary)]'}`}>
                        {t('hotels.checkOutLabel')}
                      </span>
                      <input
                        type="date"
                        value={rescheduleOut}
                        onChange={e => setRescheduleOut(e.target.value)}
                        className={`mt-1 w-full rounded-xl border bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--accent-primary)] ${isDark ? 'border-[var(--border-subtle)]' : 'border-[var(--border-subtle)]'}`}
                      />
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={rescheduling || rescheduleOut <= rescheduleIn}
                      onClick={() => void reschedule()}
                      className="flex-1 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-secondary)] disabled:opacity-40 text-[var(--surface-container)] py-2.5 text-sm font-bold"
                    >
                      {rescheduling ? t('common.working') : t('hotels.confirmReschedule')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRescheduleOpen(false)}
                      className="rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-bold"
                    >
                      {t('common.back')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
