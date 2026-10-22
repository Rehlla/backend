import type { LedgerEntry, LedgerEntryType } from '../../shared/types/commerce';

/**
 * Maps ledger entry types to budget categories.
 *
 * Lives in `src/components/mytrip/` (not in a shared commerce module) because it
 * reads REFUND_ISSUED / COMMISSION_REVERSAL / RECOVERY_CREDIT entries for display
 * only — refund/reconciliation work stays out of scope and out of reach.
 *
 * Deliberate deviation from the abandoned SmartBudgetSection: keys (canonical
 * entry type codes) are returned instead of translated labels, so localization
 * happens in the component via `t()` and `language` is not a memo dependency.
 */
export const CATEGORY_MAP: Record<LedgerEntryType, { en: string; ar: string; color: string }> = {
  HOLD_ESCROW: { en: 'Holds', ar: 'حجوزات مؤقتة', color: 'bg-amber-500' },
  PAYMENT_CAPTURED: { en: 'Payments', ar: 'مدفوعات', color: 'bg-teal-500' },
  SUPPLIER_PAYOUT: { en: 'Supplier Payouts', ar: 'مدفوعات الموردين', color: 'bg-purple-500' },
  PLATFORM_COMMISSION: { en: 'Commissions', ar: 'عمولات', color: 'bg-sky-500' },
  COMMISSION_REVERSAL: { en: 'Commission Reversals', ar: 'عكس عمولات', color: 'bg-rose-500' },
  REFUND_ISSUED: { en: 'Refunds', ar: 'مرتجعات', color: 'bg-rose-500' },
  RECOVERY_CREDIT: { en: 'Recovery Credits', ar: 'أرصدة تعويضية', color: 'bg-emerald-500' },
  ADJUSTMENT: { en: 'Adjustments', ar: 'تعديلات', color: 'bg-stone-500' },
};

const REFUND_TYPES: LedgerEntryType[] = ['REFUND_ISSUED', 'COMMISSION_REVERSAL', 'RECOVERY_CREDIT'];

export interface BudgetCategorySummary {
  key: LedgerEntryType;
  spent: number;
  color: string;
}

export interface BudgetSummary {
  totalSpent: number;
  totalRefunded: number;
  remaining: number;
  percentSpent: number;
  categories: BudgetCategorySummary[];
}

export function summariseBudget(entries: LedgerEntry[], tripBudgetEGP: number): BudgetSummary {
  let spent = 0;
  let refunded = 0;
  const catMap = new Map<LedgerEntryType, { key: LedgerEntryType; amount: number; color: string }>();

  for (const entry of entries) {
    const amount = Math.abs(entry.amountEGP);
    if (REFUND_TYPES.includes(entry.type)) {
      refunded += amount;
    } else {
      spent += amount;
      const existing = catMap.get(entry.type);
      if (existing) {
        existing.amount += amount;
      } else {
        catMap.set(entry.type, { key: entry.type, amount, color: CATEGORY_MAP[entry.type].color });
      }
    }
  }

  const netSpent = spent - refunded;
  const remaining = tripBudgetEGP - netSpent;
  const percentSpent = tripBudgetEGP > 0 ? Math.round((netSpent / tripBudgetEGP) * 100) : 0;

  const categories = Array.from(catMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map(({ key, amount, color }) => ({ key, spent: amount, color }));

  return { totalSpent: netSpent, totalRefunded: refunded, remaining, percentSpent, categories };
}