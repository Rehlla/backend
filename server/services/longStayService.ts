import { db } from '../db/database';
import { AccommodationEntity, ProductSkuEntity } from '../db/schema';
import { blockPricedTotalEGP } from './hotelPricingService';

/**
 * Duration-based pricing for long-stay / nomad bookings.
 *
 * Pricing tiers (applied in order of precedence):
 *   1. Monthly rate (≥28 nights) — monthlyRateEGP per 28-night block + remainder at weekly or daily
 *   2. Weekly rate (≥7 nights)  — weeklyRateEGP per 7-night block + remainder at daily
 *   3. Daily rate               — perNightEGP × nights
 *
 * When neither weeklyRateEGP nor monthlyRateEGP is set, the flat daily rate
 * is used (existing behavior). Multi-day discounts from the rental domain do
 * NOT apply to accommodations.
 */

export interface DurationPriceBreakdown {
  nights: number;
  /** The per-night rate used for remainder days (EGP). */
  perNightEGP: number;
  /** Weekly rate used (EGP), if applicable. */
  weeklyRateEGP?: number;
  /** Monthly rate used (EGP), if applicable. */
  monthlyRateEGP?: number;
  /** Number of full 28-night blocks priced at monthlyRateEGP. */
  monthlyBlocks: number;
  /** Number of full 7-night blocks priced at weeklyRateEGP. */
  weeklyBlocks: number;
  /** Number of remaining nights priced at perNightEGP. */
  remainderNights: number;
  /** Total base price before any rounding (EGP). */
  basePriceEGP: number;
  /** The final charged amount (EGP), rounded to nearest integer. */
  totalEGP: number;
  /** Human-readable breakdown of what was applied. */
  summary: string;
}

interface PricingBasis {
  perNightEGP: number;
  weeklyRateEGP?: number;
  monthlyRateEGP?: number;
}

/**
 * The rates a long-stay figure is quoted from.
 *
 * A property with sellable room types is booked through the stay engine, which
 * prices from the room type — so the "save X% by the month" line must come
 * from the same rates, or it promises a figure checkout never charges. The
 * cheapest active room type is the "from" price the listing already shows.
 * Properties without room types keep the listing-level rates.
 */
function pricingBasisFor(accommodation: AccommodationEntity): PricingBasis {
  const roomTypes = db.roomTypes
    .filter(rt => rt.accommodationId === accommodation.id && rt.active)
    .sort((a, b) => a.baseNightlyEGP - b.baseNightlyEGP);
  const cheapest = roomTypes[0];
  if (cheapest) {
    return {
      perNightEGP: cheapest.baseNightlyEGP,
      weeklyRateEGP: cheapest.weeklyRateEGP,
      monthlyRateEGP: cheapest.monthlyRateEGP,
    };
  }
  return {
    perNightEGP: accommodation.perNightEGP,
    weeklyRateEGP: accommodation.weeklyRateEGP,
    monthlyRateEGP: accommodation.monthlyRateEGP,
  };
}

/**
 * Compute the duration-adjusted price for an accommodation stay.
 */
export function computeDurationPrice(
  accommodation: AccommodationEntity,
  nights: number
): DurationPriceBreakdown {
  if (nights <= 0) {
    throw new Error('Stay must be at least 1 night.');
  }

  const basis = pricingBasisFor(accommodation);
  const perNightEGP = basis.perNightEGP;
  const monthlyRate = basis.monthlyRateEGP;
  const weeklyRate = basis.weeklyRateEGP;

  let monthlyBlocks = 0;
  let weeklyBlocks = 0;
  let remainderNights = nights;
  let basePriceEGP = 0;
  const parts: string[] = [];

  // 1. Monthly blocks (≥28 nights and monthlyRate set)
  if (monthlyRate != null && monthlyRate > 0 && remainderNights >= 28) {
    monthlyBlocks = Math.floor(remainderNights / 28);
    remainderNights = remainderNights % 28;
    const monthlyCost = monthlyBlocks * monthlyRate;
    basePriceEGP += monthlyCost;
    parts.push(`${monthlyBlocks}× monthly block @ ${monthlyRate.toLocaleString()} EGP`);
  }

  // 2. Weekly blocks (≥7 nights and weeklyRate set)
  if (weeklyRate != null && weeklyRate > 0 && remainderNights >= 7) {
    weeklyBlocks = Math.floor(remainderNights / 7);
    remainderNights = remainderNights % 7;
    const weeklyCost = weeklyBlocks * weeklyRate;
    basePriceEGP += weeklyCost;
    parts.push(`${weeklyBlocks}× weekly block @ ${weeklyRate.toLocaleString()} EGP`);
  }

  // 3. Remainder at daily rate
  if (remainderNights > 0) {
    const remainderCost = remainderNights * perNightEGP;
    basePriceEGP += remainderCost;
    parts.push(`${remainderNights} night(s) @ ${perNightEGP.toLocaleString()} EGP`);
  }

  // The charged total comes from the stay engine's block arithmetic, so this
  // breakdown and a checkout quote can never disagree on the same nights.
  const totalEGP = Math.round(
    blockPricedTotalEGP(new Array<number>(nights).fill(perNightEGP), 1, monthlyRate, weeklyRate)
  );
  const summary = parts.join(' + ');

  return {
    nights,
    perNightEGP,
    weeklyRateEGP: weeklyRate,
    monthlyRateEGP: monthlyRate,
    monthlyBlocks,
    weeklyBlocks,
    remainderNights,
    basePriceEGP,
    totalEGP,
    summary,
  };
}

/**
 * Check whether an accommodation offers long-stay pricing (weekly or monthly).
 */
export function hasLongStayPricing(accommodation: AccommodationEntity): boolean {
  const basis = pricingBasisFor(accommodation);
  return basis.weeklyRateEGP != null || basis.monthlyRateEGP != null;
}

/**
 * Get all accommodations that offer long-stay pricing, optionally filtered by area.
 */
export function getLongStayAccommodations(areaId?: string): AccommodationEntity[] {
  let results = db.accommodations.filter(a => a.active && hasLongStayPricing(a));
  if (areaId) {
    results = results.filter(a => a.areaId === areaId);
  }
  return results;
}

/**
 * Compute a savings comparison: long-stay pricing vs. flat daily rate for the same number of nights.
 * Returns null if no long-stay pricing is set.
 */
export function computeLongStaySavings(
  accommodation: AccommodationEntity,
  nights: number
): { dailyTotalEGP: number; longStayTotalEGP: number; savingsEGP: number; savingsPercent: number } | null {
  if (!hasLongStayPricing(accommodation)) return null;

  const dailyTotal = nights * pricingBasisFor(accommodation).perNightEGP;
  const breakdown = computeDurationPrice(accommodation, nights);
  const savingsEGP = dailyTotal - breakdown.totalEGP;

  if (savingsEGP <= 0) return null;

  return {
    dailyTotalEGP: dailyTotal,
    longStayTotalEGP: breakdown.totalEGP,
    savingsEGP,
    savingsPercent: Math.round((savingsEGP / dailyTotal) * 100),
  };
}
