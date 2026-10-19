/**
 * Where a traveller sends a wallet deposit — InstaPay or Vodafone Cash.
 *
 * There is no gateway for either: the traveller pays from their own app and
 * the desk sees the money land. What the platform can do is make that send
 * one tap and impossible to mistype: the exact number or InstaPay address, the
 * exact amount, and for Vodafone Cash the transfer code that pre-fills both
 * (`*9*7*<wallet>*<amount>#`, dialled from the phone).
 *
 * Payee details come from the environment so a real merchant wallet replaces
 * the concierge line without a code change; read per call so tests can set
 * them. Nothing here is a secret — it is printed on every confirmation page.
 */

export type WalletMethod = 'INSTAPAY' | 'VODAFONE_CASH';

export interface WalletPayee {
  /** International form, for display and wa.me. */
  phone: string;
  /** The 11-digit local form a wallet app or USSD code expects (01xxxxxxxxx). */
  localPhone: string;
  /** InstaPay address, e.g. `dahab@instapay`. */
  ipa?: string;
  /** The name the payer's app shows before they confirm. */
  accountName?: string;
  /** A personal InstaPay payment link (https://ipn.eg/...), opened as-is. */
  paymentLink?: string;
  /** Vodafone Cash: the code that opens the transfer with number and amount filled. */
  ussd?: string;
}

/** The concierge line every deposit went to before payee settings existed. */
export const DEFAULT_PAYEE_PHONE = '+201002328005';

const EG_MOBILE = /^(?:\+?20|0)?(1[0125]\d{8})$/;

/** `+201002328005`, `201002328005` or `01002328005` → both forms; else null. */
export function normaliseEgyptMobile(raw: string): { phone: string; localPhone: string } | null {
  const digits = raw.replace(/[\s-]/g, '');
  const m = EG_MOBILE.exec(digits);
  if (!m) return null;
  return { phone: `+20${m[1]}`, localPhone: `0${m[1]}` };
}

function envMobile(name: string): { phone: string; localPhone: string } | null {
  const raw = process.env[name]?.trim();
  return raw ? normaliseEgyptMobile(raw) : null;
}

function envText(name: string, max: number): string | undefined {
  const raw = process.env[name]?.trim();
  return raw ? raw.slice(0, max) : undefined;
}

/** Only InstaPay's own link host: anything else on a payment page is a phishing vector. */
function envInstapayLink(): string | undefined {
  const raw = process.env.INSTAPAY_PAYMENT_LINK?.trim();
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && url.hostname === 'ipn.eg' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function walletPayee(method: string, amountEGP: number): WalletPayee | undefined {
  if (method !== 'INSTAPAY' && method !== 'VODAFONE_CASH') return undefined;

  const fallback = envMobile('STAY_PAYEE_PHONE') ?? normaliseEgyptMobile(DEFAULT_PAYEE_PHONE)!;
  const accountName = envText('WALLET_PAYEE_NAME', 80);

  if (method === 'INSTAPAY') {
    const number = envMobile('INSTAPAY_PHONE') ?? fallback;
    const ipa = envText('INSTAPAY_IPA', 80);
    return {
      ...number,
      ...(ipa && /^[\w.-]+@[\w.-]+$/.test(ipa) ? { ipa } : {}),
      ...(accountName ? { accountName } : {}),
      ...(envInstapayLink() ? { paymentLink: envInstapayLink() } : {}),
    };
  }

  const number = envMobile('VODAFONE_CASH_NUMBER') ?? fallback;
  const amount = Math.round(amountEGP);
  return {
    ...number,
    ...(accountName ? { accountName } : {}),
    ...(amount > 0 ? { ussd: `*9*7*${number.localPhone}*${amount}#` } : {}),
  };
}
