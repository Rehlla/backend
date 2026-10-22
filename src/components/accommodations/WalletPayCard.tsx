import React, { useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, Phone, Send } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { api } from '../../services/api';

/**
 * Paying a stay deposit by InstaPay or Vodafone Cash, made one tap.
 *
 * There is no gateway: the traveller sends from their own wallet app. So the
 * card hands them exactly what that app needs — the number (or InstaPay
 * address), the amount, the reference — each one tap to copy, plus the
 * Vodafone Cash code that opens the transfer pre-filled. Then "I've sent it"
 * takes the number they paid from, which is how the desk finds the transfer
 * in the wallet's history ("from 010…") without waiting for a screenshot.
 */

export interface WalletPayee {
  phone: string;
  localPhone: string;
  ipa?: string;
  accountName?: string;
  paymentLink?: string;
  ussd?: string;
}

interface WalletPayCardProps {
  bookingRef: string;
  method: 'INSTAPAY' | 'VODAFONE_CASH';
  amountEGP: number;
  currency: string;
  payee: WalletPayee;
  payerNumber?: string;
  payerReference?: string;
  /** Only a booking still waiting for its deposit takes a claim. */
  canClaim: boolean;
  onClaimed: () => void;
}

const EG_MOBILE = /^(?:\+?20|0)?1[0125]\d{8}$/;

export const WalletPayCard: React.FC<WalletPayCardProps> = ({
  bookingRef, method, amountEGP, currency, payee, payerNumber, payerReference, canClaim, onClaimed,
}) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState<string | null>(null);
  const [number, setNumber] = useState('');
  const [txRef, setTxRef] = useState('');
  const [editing, setEditing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = Math.round(amountEGP);
  const claimed = Boolean(payerNumber || payerReference);
  const showForm = canClaim && (!claimed || editing);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      window.setTimeout(() => setCopied(c => (c === key ? null : c)), 1800);
    } catch {
      // Clipboard blocked (http, old browser): the value is on screen to type.
    }
  };

  const claim = async () => {
    const cleaned = number.replace(/[\s-]/g, '');
    if (cleaned && !EG_MOBILE.test(cleaned)) {
      setError(t('wallet.invalidNumber'));
      return;
    }
    if (!cleaned && !txRef.trim()) {
      setError(t('wallet.invalidNumber'));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.claimStayPayment(bookingRef, {
        ...(cleaned ? { payerNumber: cleaned } : {}),
        ...(txRef.trim() ? { payerReference: txRef.trim() } : {}),
      });
      setEditing(false);
      setNumber('');
      setTxRef('');
      onClaimed();
    } catch (e: any) {
      setError(String(e?.message || t('wallet.claimFailed')));
    } finally {
      setSending(false);
    }
  };

  const Row: React.FC<{ id: string; label: string; value: string; display?: string; hint?: string; mono?: boolean }> = ({ id, label, value, display, hint, mono }) => (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-[var(--text-secondary)]">{label}</div>
        <div className={`truncate text-sm font-black text-[var(--text-primary)] ${mono ? 'font-mono' : ''}`} dir="ltr">{display ?? value}</div>
        {hint && <div className="text-[11px] text-[var(--text-secondary)]">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => void copy(id, value)}
        aria-label={`${t('wallet.copy')} ${label}`}
        className="flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-[var(--border-subtle)] px-2.5 text-xs font-bold text-[var(--text-secondary)] transition-colors hover:bg-[var(--btn-util-hover)]"
      >
        {copied === id ? <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied === id ? t('wallet.copied') : t('wallet.copy')}
      </button>
    </div>
  );

  return (
    <div className="space-y-3" data-testid="wallet-pay-card">
      <div className="divide-y divide-[var(--border-subtle)] rounded-xl border border-[var(--border-subtle)] px-3">
        <Row id="amount" label={t('wallet.amount')} value={String(amount)} display={`${amount.toLocaleString()} ${currency}`} />
        {payee.ipa && <Row id="ipa" label={t('wallet.ipa')} value={payee.ipa} mono />}
        <Row id="number" label={t('wallet.payTo')} value={payee.localPhone} mono hint={payee.accountName ? t('wallet.accountName', { name: payee.accountName }) : undefined} />
        <Row id="ref" label={t('hotels.referenceLabel')} value={bookingRef} mono hint={method === 'INSTAPAY' ? t('wallet.referenceNote') : undefined} />
      </div>

      {method === 'VODAFONE_CASH' && payee.ussd && (
        <div className="space-y-1.5">
          <a
            href={`tel:${encodeURIComponent(payee.ussd)}`}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#e60000] text-sm font-bold text-white transition-[filter] hover:brightness-110"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
            {t('wallet.dialVodafone', { amount: amount.toLocaleString() })}
          </a>
          <p className="text-center text-[11px] text-[var(--text-secondary)]">
            <span className="font-mono font-bold" dir="ltr">{payee.ussd}</span>
            {' · '}{t('wallet.dialHint')}
          </p>
        </div>
      )}

      {method === 'INSTAPAY' && (
        <div className="space-y-1.5">
          {payee.paymentLink && (
            <a
              href={payee.paymentLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#5b2d8e] text-sm font-bold text-white transition-[filter] hover:brightness-110"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t('wallet.openInstapay')}
            </a>
          )}
          <p className="text-center text-[11px] text-[var(--text-secondary)]">{t('wallet.instapayHint')}</p>
        </div>
      )}

      {claimed && !editing && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-600" role="status">
          <span className="flex items-start gap-1.5 font-bold">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {payerNumber
              ? t('wallet.claimed', { number: payerNumber })
              : t('wallet.claimedRefOnly', { ref: String(payerReference) })}
          </span>
          {canClaim && (
            <button type="button" onClick={() => setEditing(true)} className="shrink-0 font-bold underline">
              {t('wallet.change')}
            </button>
          )}
        </div>
      )}

      {showForm && (
        <div className="space-y-2 rounded-xl border border-[var(--accent-primary)]/40 p-3">
          <p className="text-xs font-black text-[var(--text-primary)]">{t('wallet.sentTitle')}</p>
          <label className="block space-y-1 text-[11px] font-bold text-[var(--text-secondary)]">
            <span>{t('wallet.payerNumber')}</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              dir="ltr"
              value={number}
              onChange={e => setNumber(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] px-3 py-2.5 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </label>
          <label className="block space-y-1 text-[11px] font-bold text-[var(--text-secondary)]">
            <span>{t('wallet.payerReference')}</span>
            <input
              type="text"
              dir="ltr"
              value={txRef}
              onChange={e => setTxRef(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-container)] px-3 py-2.5 font-mono text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"
            />
          </label>
          {error && <p role="alert" className="text-xs text-rose-500">{error}</p>}
          <button
            type="button"
            disabled={sending || (!number.trim() && !txRef.trim())}
            onClick={() => void claim()}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] text-sm font-bold text-[var(--surface-container)] transition-[filter] hover:brightness-110 disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            {t('wallet.submitClaim')}
          </button>
        </div>
      )}
    </div>
  );
};

export default WalletPayCard;
