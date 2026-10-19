import crypto from 'crypto';
import { db } from '../db/database';
import { LedgerEntryEntity } from '../db/schema';
import { LedgerEntryType } from '../../src/shared';

export class LedgerService {
  /**
   * Re-signs every entry in the chain from genesis.
   *
   * This DESTROYS tamper-evidence and must never run automatically. It was
   * previously called from the constructor, which meant any tampering with an
   * amount was silently re-sealed as valid on the next server boot, and
   * verifyLedgerIntegrity().chainIntact could never report a break.
   *
   * Retained for deliberate, operator-initiated migrations only.
   */
  public repairAndSealLedgerChain() {
    let prevHash = 'sha256:0000000000000000000000000000000000000000';
    for (let i = 0; i < db.ledgerEntries.length; i++) {
      const entry = db.ledgerEntries[i];
      entry.previousHash = prevHash;
      const { signatureHash, ...unsigned } = entry;
      entry.signatureHash = this.calculateEntryHash(unsigned, prevHash);
      prevHash = entry.signatureHash;
    }
  }

  private calculateEntryHash(entry: Omit<LedgerEntryEntity, 'signatureHash'>, previousHash?: string): string {
    const data = `${entry.id}:${entry.transactionId}:${entry.idempotencyKey}:${entry.type}:${entry.amountEGP}:${entry.debitAccount}:${entry.creditAccount}:${entry.timestamp}:${previousHash || 'GENESIS'}`;
    return `sha256:${crypto.createHash('sha256').update(data).digest('hex')}`;
  }

  public recordDoubleEntry(params: {
    transactionId: string;
    idempotencyKey: string;
    bookingRef: string;
    tripId: string;
    type: LedgerEntryType;
    amountEGP: number;
    debitAccount: string;
    creditAccount: string;
    metadata?: Record<string, any>;
  }): LedgerEntryEntity {
    // Check idempotency
    const existing = db.ledgerEntries.find(e => e.idempotencyKey === params.idempotencyKey);
    if (existing) {
      return existing;
    }

    const previousEntry = db.ledgerEntries[db.ledgerEntries.length - 1];
    const previousHash = previousEntry?.signatureHash || 'sha256:0000000000000000000000000000000000000000';

    const entryId = `LEDGER-${String(db.ledgerEntries.length + 1).padStart(3, '0')}`;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const unsignedEntry: Omit<LedgerEntryEntity, 'signatureHash'> = {
      id: entryId,
      transactionId: params.transactionId,
      idempotencyKey: params.idempotencyKey,
      bookingRef: params.bookingRef,
      tripId: params.tripId,
      type: params.type,
      amountEGP: params.amountEGP,
      debitAccount: params.debitAccount,
      creditAccount: params.creditAccount,
      currency: 'EGP',
      timestamp,
      status: 'SETTLED',
      previousHash,
      metadata: params.metadata
    };

    const signatureHash = this.calculateEntryHash(unsignedEntry, previousHash);
    const fullEntry: LedgerEntryEntity = { ...unsignedEntry, signatureHash };

    db.runInTransaction(() => {
      db.ledgerEntries.push(fullEntry);
      db.logAudit('LedgerEngine', 'System', 'RECORD_DOUBLE_ENTRY', 'Ledger', fullEntry.id, {
        type: fullEntry.type,
        amountEGP: fullEntry.amountEGP,
        bookingRef: fullEntry.bookingRef,
        debit: fullEntry.debitAccount,
        credit: fullEntry.creditAccount
      });
    });

    return fullEntry;
  }

  public verifyLedgerIntegrity(): {
    balanced: boolean;
    totalDebitsEGP: number;
    totalCreditsEGP: number;
    chainIntact: boolean;
    totalEntries: number;
    escrowBalanceEGP: number;
    accountBalancesEGP: Record<string, number>;
    integrityFailures: string[];
  } {
    let totalDebits = 0;
    let totalCredits = 0;
    let chainIntact = true;
    let escrowBalance = 0;

    // Net position per account: credited amounts minus debited amounts.
    // Summing an entry into both sides (as the old totals did) can never be
    // unbalanced, so it proved nothing. Per-account nets can actually break.
    const accountBalances: Record<string, number> = {};
    const integrityFailures: string[] = [];
    const credit = (account: string, amount: number) => {
      accountBalances[account] = (accountBalances[account] || 0) + amount;
    };
    const debit = (account: string, amount: number) => {
      accountBalances[account] = (accountBalances[account] || 0) - amount;
    };

    for (let i = 0; i < db.ledgerEntries.length; i++) {
      const entry = db.ledgerEntries[i];

      // Verify chain hash
      if (i > 0) {
        const expectedPrev = db.ledgerEntries[i - 1].signatureHash;
        if (entry.previousHash && entry.previousHash !== expectedPrev) {
          chainIntact = false;
          integrityFailures.push(`${entry.id}: previousHash does not match the preceding entry.`);
        }
      }

      // Recompute signature
      const { signatureHash, ...unsigned } = entry;
      const computedHash = this.calculateEntryHash(unsigned, entry.previousHash);
      if (computedHash !== signatureHash) {
        chainIntact = false;
        integrityFailures.push(`${entry.id}: signature does not match its contents (entry was altered).`);
      }

      if (!entry.debitAccount || !entry.creditAccount) {
        integrityFailures.push(`${entry.id}: missing debit or credit account.`);
      }

      totalDebits += entry.amountEGP;
      totalCredits += entry.amountEGP;

      debit(entry.debitAccount, entry.amountEGP);
      credit(entry.creditAccount, entry.amountEGP);

      // Track Escrow Balance (Credits to Escrow minus Debits from Escrow)
      if (entry.creditAccount === 'PLATFORM_ESCROW_MAIN') {
        escrowBalance += entry.amountEGP;
      }
      if (entry.debitAccount === 'PLATFORM_ESCROW_MAIN') {
        escrowBalance -= entry.amountEGP;
      }
    }

    // Deliberately NOT asserting "debits === credits" or "accounts net to zero":
    // every entry writes the same amount to one debit and one credit account, so
    // both are true by construction and can never detect a fault. The checks
    // below are the ones that can actually fail.

    // Escrow paying out more than it took in means money left that never arrived.
    if (escrowBalance < 0) {
      integrityFailures.push(`PLATFORM_ESCROW_MAIN is overdrawn by ${Math.abs(escrowBalance)} EGP.`);
    }
    // A negative balance on a revenue or payable account implies a reversal that
    // was never matched by an original capture.
    for (const [account, balance] of Object.entries(accountBalances)) {
      if (account.startsWith('PLATFORM_REVENUE_') && balance < 0) {
        integrityFailures.push(`${account} is negative (${balance} EGP) — unmatched reversal.`);
      }
    }

    return {
      balanced: integrityFailures.length === 0,
      totalDebitsEGP: totalDebits,
      totalCreditsEGP: totalCredits,
      chainIntact,
      totalEntries: db.ledgerEntries.length,
      escrowBalanceEGP: escrowBalance,
      accountBalancesEGP: accountBalances,
      integrityFailures
    };
  }

  public reconcileBooking(bookingRef: string): {
    bookingRef: string;
    bookingExists: boolean;
    bookingAmountEGP: number;
    ledgerEntries: LedgerEntryEntity[];
    totalPaidEGP: number;
    totalDisbursedEGP: number;
    platformCommissionEGP: number;
    isFullyReconciled: boolean;
    discrepancies: string[];
  } {
    const booking = db.bookings.find(b => b.bookingRef === bookingRef || b.confirmationCode === bookingRef);
    const entries = db.ledgerEntries.filter(e => e.bookingRef === bookingRef);
    const discrepancies: string[] = [];

    let totalPaid = 0;
    let totalDisbursed = 0;
    let commission = 0;

    for (const e of entries) {
      if (e.type === 'PAYMENT_CAPTURED') {
        totalPaid += e.amountEGP;
      } else if (e.type === 'SUPPLIER_PAYOUT') {
        totalDisbursed += e.amountEGP;
      } else if (e.type === 'PLATFORM_COMMISSION') {
        commission += e.amountEGP;
      }
    }

    if (booking && totalPaid !== booking.amountEGP) {
      discrepancies.push(`Payment mismatch: Booking requires ${booking.amountEGP} EGP, but ledger captured ${totalPaid} EGP.`);
    }

    if (totalDisbursed + commission > totalPaid && totalPaid > 0) {
      discrepancies.push(`Over-disbursement warning: Disbursed + Commission (${totalDisbursed + commission}) exceeds paid (${totalPaid}).`);
    }

    return {
      bookingRef,
      bookingExists: !!booking,
      bookingAmountEGP: booking?.amountEGP || 0,
      ledgerEntries: entries,
      totalPaidEGP: totalPaid,
      totalDisbursedEGP: totalDisbursed,
      platformCommissionEGP: commission,
      isFullyReconciled: discrepancies.length === 0 && entries.length > 0,
      discrepancies
    };
  }

  public detectLedgerAnomalies(): {
    anomalyCount: number;
    anomalies: Array<{ entryId: string; type: string; reason: string }>;
  } {
    const anomalies: Array<{ entryId: string; type: string; reason: string }> = [];

    for (const entry of db.ledgerEntries) {
      if (entry.amountEGP <= 0) {
        anomalies.push({
          entryId: entry.id,
          type: entry.type,
          reason: `Invalid non-positive amount: ${entry.amountEGP} EGP`
        });
      }
      if (!entry.debitAccount || !entry.creditAccount) {
        anomalies.push({
          entryId: entry.id,
          type: entry.type,
          reason: 'Missing debit or credit account identifier'
        });
      }
    }

    return {
      anomalyCount: anomalies.length,
      anomalies
    };
  }
}

export const ledgerService = new LedgerService();
