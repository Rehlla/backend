/**
 * Money guard (gap M-1 of report 11).
 *
 * The commerce columns are declared REAL in tableSpecs.ts — changing a column
 * type needs a full table rebuild on existing installs (SQLite cannot ALTER a
 * type), which is deliberately deferred behind plan 10 §6. Until that lands,
 * whole-EGP discipline is enforced at the write seams: every amount that
 * reaches a hold, a booking or the ledger goes through moneyInt() so no
 * fractional piaster enters the finance chain from a per_person quotation or
 * a price delta.
 */
export function moneyInt(value: number): number {
  return Math.round(value);
}
