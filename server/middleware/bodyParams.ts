/**
 * Request-body reading for the endpoints that move money.
 *
 * The audit records "no server-side request validation" across ~120 handlers.
 * This is not that fix; it covers the handlers where an unvalidated body has a
 * financial consequence, and the pattern is available for the rest.
 *
 * What it replaces, concretely:
 *
 *  - `amountEGP: Number(req.body.amountEGP)` on the refund endpoint. `Number()`
 *    of an absent or non-numeric field is **NaN**, and the refund path wrote it
 *    straight into a double-entry ledger row debiting PLATFORM_ESCROW_MAIN.
 *  - `passengersCount = 2` and `skuId || 'SKU-TRF-001'` style defaults, which
 *    turned a malformed request into a real hold against the demo trip and the
 *    demo traveler rather than an error.
 *  - `idempotencyKey: idempotencyKey || \`IDEMP-REF-${Date.now()}\``, which
 *    generated a fresh key whenever the caller omitted one — defeating the
 *    entire idempotency mechanism, because a double submit produced two keys
 *    and therefore two refunds.
 *
 * Nothing here asserts a type; every function narrows by checking.
 */

export class InvalidRequestBodyError extends Error {
  public readonly status = 400;
  public readonly title = 'Invalid Request';
  public readonly type = 'https://dahab.travel/errors/invalid-request-body';

  constructor(field: string, detail: string) {
    super(`"${field}" ${detail}`);
    this.name = 'InvalidRequestBodyError';
  }
}

export function requiredString(value: unknown, field: string, maxLength = 256): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new InvalidRequestBodyError(field, 'is required and must be a non-empty string.');
  }
  if (value.length > maxLength) {
    throw new InvalidRequestBodyError(field, `must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string, maxLength = 256): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredString(value, field, maxLength);
}

/**
 * A money amount. Rejects NaN, Infinity, negatives, zero and values carrying
 * sub-piastre precision, which a ledger cannot represent honestly.
 */
export function requiredAmountEGP(value: unknown, field: string, maxEGP = 1_000_000): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) {
    throw new InvalidRequestBodyError(field, 'must be a number.');
  }
  if (amount <= 0) {
    throw new InvalidRequestBodyError(field, 'must be greater than zero.');
  }
  if (amount > maxEGP) {
    throw new InvalidRequestBodyError(field, `must not exceed ${maxEGP} EGP.`);
  }
  if (Math.round(amount * 100) !== amount * 100) {
    throw new InvalidRequestBodyError(field, 'must not have more than two decimal places.');
  }
  return amount;
}

/**
 * A price that is allowed to be nothing.
 *
 * requiredAmountEGP refuses zero, which is right for a payment — nobody is
 * charged 0 EGP — and wrong for a plan. An itinerary line for a beach, a
 * sunset walk or a free reef entry costs nothing, and rejecting it stopped a
 * traveler from planning any of them: "priceEGP must be greater than zero".
 *
 * The trip-items endpoint already treated an *absent* price as 0, so the same
 * value was accepted when omitted and refused when stated. This makes the two
 * agree.
 */
export function planAmountEGP(value: unknown, field: string, maxEGP = 1_000_000): number {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) {
    throw new InvalidRequestBodyError(field, 'must be a number.');
  }
  if (amount < 0) {
    throw new InvalidRequestBodyError(field, 'must not be negative.');
  }
  if (amount > maxEGP) {
    throw new InvalidRequestBodyError(field, `must not exceed ${maxEGP} EGP.`);
  }
  if (Math.round(amount * 100) !== amount * 100) {
    throw new InvalidRequestBodyError(field, 'must not have more than two decimal places.');
  }
  return amount;
}

export function requiredCount(value: unknown, field: string, min = 1, max = 100): number {
  const count = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(count)) {
    throw new InvalidRequestBodyError(field, 'must be a whole number.');
  }
  if (count < min || count > max) {
    throw new InvalidRequestBodyError(field, `must be between ${min} and ${max}.`);
  }
  return count;
}

/** Same rules as requiredCount, but the field may be absent. */
export function optionalCount(
  value: unknown,
  field: string,
  min = 1,
  max = 100
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredCount(value, field, min, max);
}

/** A finite number, optionally bounded. Money and measurements go through here
 *  rather than `Number(x)` — a non-numeric string is a 400, not NaN flowing
 *  into a price. */
export function requiredNumber(value: unknown, field: string, min?: number, max?: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    throw new InvalidRequestBodyError(field, 'must be a number.');
  }
  if (min !== undefined && n < min) {
    throw new InvalidRequestBodyError(field, `must be at least ${min}.`);
  }
  if (max !== undefined && n > max) {
    throw new InvalidRequestBodyError(field, `must be at most ${max}.`);
  }
  return n;
}

/** Same rules as requiredNumber, but the field may be absent. */
export function optionalNumber(
  value: unknown,
  field: string,
  min?: number,
  max?: number
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredNumber(value, field, min, max);
}

/** An ISO calendar date (YYYY-MM-DD), which is what the inventory keys on. */
export function requiredCalendarDate(value: unknown, field: string): string {
  const raw = requiredString(value, field, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new InvalidRequestBodyError(field, 'must be a calendar date in YYYY-MM-DD form.');
  }
  return raw;
}

/** Same rules as requiredCalendarDate, but the field may be absent. */
export function optionalCalendarDate(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredCalendarDate(value, field);
}

/**
 * Today in the *server's* calendar, YYYY-MM-DD.
 *
 * `toISOString().slice(0, 10)` is the UTC date. Dahab runs UTC+2/+3, so
 * between midnight and 02:00/03:00 local that is still yesterday — an
 * "available tonight" probe keyed on it would read the wrong night's
 * inventory. The client twin is `localCalendarDate` in src/services/heldCheckout.ts.
 */
export function serverLocalCalendarDate(from: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`;
}

/** Returns `unknown[]` deliberately: narrowing the elements is the caller's
 *  job, and a generic here would only be an assertion in disguise. */
export function requiredArray(value: unknown, field: string, maxItems = 50): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new InvalidRequestBodyError(field, 'must be a non-empty array.');
  }
  if (value.length > maxItems) {
    throw new InvalidRequestBodyError(field, `must contain at most ${maxItems} items.`);
  }
  return value;
}

/**
 * Narrows one element of a validated array to something whose fields can be
 * read. Returns `Record<string, unknown>` — every field still has to be
 * validated individually; this only says "it is an object, not a string".
 */
export function requiredObject(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new InvalidRequestBodyError(field, 'must be an object.');
  }
  const entries = Object.entries(value).filter(([key]) => key !== '__proto__');
  return Object.fromEntries(entries);
}

/** A member of a known set, or a 400 naming what was allowed. */
export function requiredEnum<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  const raw = requiredString(value, field, 64);
  const match = allowed.find(candidate => candidate === raw);
  if (match === undefined) {
    throw new InvalidRequestBodyError(field, `must be one of: ${allowed.join(', ')}.`);
  }
  return match;
}

export function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return requiredEnum(value, allowed, field);
}

export const SERVICE_TYPES = ['hotel', 'transfer', 'diving', 'safari', 'wellness', 'dining', 'rental'] as const;
export const SUBSTITUTION_SERVICE_TYPES = ['hotel', 'transfer', 'diving', 'safari', 'activity'] as const;
export const PAYMENT_PROVIDERS = ['PAYMOB', 'STRIPE', 'CASH_ON_ARRIVAL'] as const;

/**
 * Rejects a body still carrying raw card data.
 *
 * The single-item checkout has done this since Phase A; the multi-item one
 * passed `req.body` straight through, so a stale client could still put a PAN
 * into this server's memory, logs and error handler.
 */
export function rejectRawCardData(body: unknown): void {
  const candidate = typeof body === 'object' && body !== null ? Object.keys(body) : [];
  const forbidden = candidate.filter(key => /^(card[_-]?number|pan|cvv|cvc|expiry|expirydate|expirationdate)$/i.test(key));
  if (forbidden.length > 0) {
    throw new InvalidRequestBodyError(
      forbidden[0],
      'must not be sent to this API. Supply only cardLast4.'
    );
  }
}

/**
 * Keeps only the named keys, and only when their value is a primitive or an
 * array of strings.
 *
 * Two endpoints spread `req.body` straight into state that is then persisted:
 * DayGI memory preferences and the beta experiment flags. Any key a caller
 * invented was stored forever, and a nested object could be written where the
 * UI expected a string. This bounds what can be written without enumerating
 * every value union — those remain the service's own contract.
 */
/** A plain object whose own values are all scalars. */
function isFlatRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value).every(
    v => v === undefined || v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
  );
}

/** Keeps only the scalar keys of a flat record, dropping anything else. */
function pickScalars(entry: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = v;
  }
  return out;
}

export function pickAllowedKeys(
  body: unknown,
  allowed: readonly string[],
  field: string
): Record<string, string | number | boolean | string[] | Array<Record<string, unknown>>> {
  const source = requiredObject(body, field);
  const picked: Record<string, string | number | boolean | string[] | Array<Record<string, unknown>>> = {};

  for (const key of allowed) {
    const value = source[key];
    if (value === undefined) continue;

    if (typeof value === 'string' || typeof value === 'boolean') {
      picked[key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value)) {
      picked[key] = value;
    } else if (Array.isArray(value) && value.every(entry => typeof entry === 'string')) {
      picked[key] = value.slice(0, 50);
    } else if (Array.isArray(value) && value.every(entry => isFlatRecord(entry))) {
      // A list of flat records, e.g. the guests on a stay. Each entry keeps only
      // scalar values, so a nested payload cannot ride through a whitelist that
      // was written for flat fields.
      picked[key] = value.slice(0, 50).map(entry => pickScalars(entry as Record<string, unknown>));
    } else {
      throw new InvalidRequestBodyError(
        `${field}.${key}`,
        'must be a string, number, boolean, list of strings, or list of flat records.'
      );
    }
  }

  if (Object.keys(picked).length === 0) {
    throw new InvalidRequestBodyError(field, `must contain at least one of: ${allowed.join(', ')}.`);
  }
  return picked;
}

export const DAYGI_PREFERENCE_KEYS = [
  'pace',
  'morningPreference',
  'divingLevel',
  'dietaryPreferences',
  'budgetBand',
  'transferPreference',
  'seafoodPreference',
  'avoidsLongTransfers'
] as const;

export const DAYGI_EXPERIMENT_FLAG_KEYS = [
  'proactiveAlertFrequency',
  'quickPromptOrdering',
  'explanationLevel',
  'confirmationStyle',
  'recommendationCardLayout'
] as const;

export const DAYGI_ANALYTICS_KEYS = [
  'eventType',
  'payload',
  'timestamp',
  'intentKey',
  'actionType',
  'step',
  'language',
  'sessionId',
  'tripId',
  'bookingRef',
  'rating',
  'reasonTag',
  'durationMs',
  'confidence'
] as const;

export const RICH_AVAILABILITY_KEYS = [
  'serviceType',
  'skuId',
  'date',
  'timeSlot',
  'passengers',
  'passengersCount'
] as const;

/**
 * The plain availability probe. Narrower than RICH_AVAILABILITY_KEYS: it takes
 * no `passengersCount` alias, so one endpoint cannot be addressed two ways.
 */
export const AVAILABILITY_KEYS = [
  'serviceType',
  'skuId',
  'date',
  'timeSlot',
  'passengers'
] as const;

export const PRICE_COMPARISON_KEYS = [
  'accommodationId',
  'accommodationName',
  'accommodationNameAr',
  'checkIn',
  'checkOut',
  'guests',
  'rooms',
  'propertyType'
] as const;

export const STAY_QUOTE_KEYS = [
  'roomTypeId',
  'checkIn',
  'checkOut',
  'rooms',
  'adults',
  'children'
] as const;

export const STAY_RESERVE_KEYS = [
  'accommodationId',
  'roomTypeId',
  'checkIn',
  'checkOut',
  'rooms',
  'adults',
  'children',
  'guestDetails',
  'specialRequests',
  'arrivalTime',
  'paymentMethod',
  'tripId',
  'idempotencyKey'
] as const;
