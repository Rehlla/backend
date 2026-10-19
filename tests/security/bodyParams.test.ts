import { describe, it, expect } from 'vitest';
import {
  InvalidRequestBodyError,
  requiredString,
  optionalString,
  requiredAmountEGP,
  planAmountEGP,
  requiredCount,
  requiredCalendarDate,
  requiredArray,
  requiredObject,
  requiredEnum,
  optionalEnum,
  rejectRawCardData,
  pickAllowedKeys,
  SERVICE_TYPES,
  DAYGI_PREFERENCE_KEYS
} from '../../server/middleware/bodyParams';

/**
 * Request-body validation for the endpoints that write.
 *
 * Before this, five handlers passed `req.body` straight to a service:
 * multi-item checkout (bookings, payments, ledger rows), itinerary
 * substitution, trip create/update, DayGI memory, and the beta experiment
 * flags. The concrete failures were `Number(undefined)` becoming NaN money,
 * generated idempotency keys defeating idempotency, demo-id defaults turning a
 * malformed request into a real record, and arbitrary keys spread into
 * persisted state.
 */

describe('requiredString', () => {
  it('accepts and trims a real value', () => {
    expect(requiredString('  SKU-1  ', 'skuId')).toBe('SKU-1');
  });

  it('rejects absent, empty and whitespace-only values', () => {
    for (const bad of [undefined, null, '', '   ']) {
      expect(() => requiredString(bad, 'skuId')).toThrow(InvalidRequestBodyError);
    }
  });

  it('rejects non-strings rather than coercing them', () => {
    expect(() => requiredString(42, 'skuId')).toThrow(/non-empty string/);
    expect(() => requiredString({}, 'skuId')).toThrow(/non-empty string/);
  });

  it('bounds the length', () => {
    expect(() => requiredString('x'.repeat(300), 'reason', 200)).toThrow(/at most 200/);
  });

  it('names the field', () => {
    expect(() => requiredString(undefined, 'travelerEmail')).toThrow(/travelerEmail/);
  });
});

describe('requiredAmountEGP', () => {
  it('accepts a positive amount', () => {
    expect(requiredAmountEGP(1200, 'amountEGP')).toBe(1200);
    expect(requiredAmountEGP('1200.50', 'amountEGP')).toBe(1200.5);
  });

  it('rejects NaN, which is exactly what an absent field used to become', () => {
    expect(() => requiredAmountEGP(Number(undefined), 'amountEGP')).toThrow(/must be a number/);
    expect(() => requiredAmountEGP('abc', 'amountEGP')).toThrow(/must be a number/);
  });

  it('rejects Infinity', () => {
    expect(() => requiredAmountEGP(Infinity, 'amountEGP')).toThrow(/must be a number/);
  });

  it('rejects zero and negatives', () => {
    expect(() => requiredAmountEGP(0, 'amountEGP')).toThrow(/greater than zero/);
    expect(() => requiredAmountEGP(-1, 'amountEGP')).toThrow(/greater than zero/);
  });

  it('rejects sub-piastre precision a ledger cannot represent', () => {
    expect(() => requiredAmountEGP(10.001, 'amountEGP')).toThrow(/two decimal places/);
  });

  it('bounds the maximum', () => {
    expect(() => requiredAmountEGP(2_000_000, 'amountEGP')).toThrow(/must not exceed/);
  });
});

describe('requiredCount', () => {
  it('accepts a whole number in range', () => {
    expect(requiredCount(3, 'passengersCount', 1, 50)).toBe(3);
    expect(requiredCount('3', 'passengersCount', 1, 50)).toBe(3);
  });

  it('rejects fractions and non-numbers', () => {
    expect(() => requiredCount(2.5, 'passengersCount')).toThrow(/whole number/);
    expect(() => requiredCount('abc', 'passengersCount')).toThrow(/whole number/);
  });

  it('enforces the range', () => {
    expect(() => requiredCount(0, 'passengersCount', 1, 50)).toThrow(/between 1 and 50/);
    expect(() => requiredCount(999, 'passengersCount', 1, 50)).toThrow(/between 1 and 50/);
  });
});

describe('requiredCalendarDate', () => {
  it('accepts an ISO calendar date, which is what inventory keys on', () => {
    expect(requiredCalendarDate('2026-11-05', 'date')).toBe('2026-11-05');
  });

  it('rejects prose and other formats', () => {
    for (const bad of ['tomorrow', '05/11/2026', '2026-11-05T08:00:00Z', '2026-13-45']) {
      expect(() => requiredCalendarDate(bad, 'date')).toThrow(InvalidRequestBodyError);
    }
  });
});

describe('requiredArray and requiredObject', () => {
  it('requires a non-empty array', () => {
    expect(requiredArray([1], 'items')).toEqual([1]);
    expect(() => requiredArray([], 'items')).toThrow(/non-empty array/);
    expect(() => requiredArray('one', 'items')).toThrow(/non-empty array/);
  });

  it('bounds the item count', () => {
    expect(() => requiredArray(new Array(30).fill(1), 'items', 20)).toThrow(/at most 20/);
  });

  it('requires an object, not an array or a string', () => {
    expect(requiredObject({ a: 1 }, 'paymentParams')).toEqual({ a: 1 });
    expect(() => requiredObject([], 'paymentParams')).toThrow(/must be an object/);
    expect(() => requiredObject('x', 'paymentParams')).toThrow(/must be an object/);
    expect(() => requiredObject(null, 'paymentParams')).toThrow(/must be an object/);
  });

  it('drops an own __proto__ key rather than carrying it forward', () => {
    const hostile = JSON.parse('{"skuId":"S1","__proto__":{"polluted":true}}');
    expect(Object.keys(requiredObject(hostile, 'item'))).toEqual(['skuId']);
  });
});

describe('requiredEnum', () => {
  it('accepts a member', () => {
    expect(requiredEnum('diving', SERVICE_TYPES, 'serviceType')).toBe('diving');
  });

  it('rejects a non-member and says what was allowed', () => {
    expect(() => requiredEnum('scuba', SERVICE_TYPES, 'serviceType')).toThrow(/must be one of: hotel, transfer, diving, safari/);
  });

  it('is case sensitive', () => {
    expect(() => requiredEnum('Diving', SERVICE_TYPES, 'serviceType')).toThrow(InvalidRequestBodyError);
  });

  it('treats absent as undefined only when optional', () => {
    expect(optionalEnum(undefined, SERVICE_TYPES, 'serviceType')).toBeUndefined();
    expect(() => requiredEnum(undefined, SERVICE_TYPES, 'serviceType')).toThrow(InvalidRequestBodyError);
  });
});

describe('rejectRawCardData', () => {
  it('passes a body carrying only the last four digits', () => {
    expect(() => rejectRawCardData({ cardLast4: '4242', cardBrand: 'VISA' })).not.toThrow();
  });

  it('refuses a full PAN, CVV or expiry — the multi-item checkout had no such guard', () => {
    for (const hostile of [{ cardNumber: '4242424242424242' }, { cvv: '123' }, { expiryDate: '12/29' }, { PAN: 'x' }]) {
      expect(() => rejectRawCardData(hostile)).toThrow(InvalidRequestBodyError);
    }
  });

  it('ignores a non-object body', () => {
    expect(() => rejectRawCardData(undefined)).not.toThrow();
  });
});

describe('pickAllowedKeys', () => {
  it('keeps only the named keys', () => {
    const picked = pickAllowedKeys({ pace: 'Relaxed', evil: 'x' }, DAYGI_PREFERENCE_KEYS, 'preferences');
    expect(picked).toEqual({ pace: 'Relaxed' });
  });

  it('accepts primitives and string lists', () => {
    const picked = pickAllowedKeys(
      { pace: 'Active', seafoodPreference: true, dietaryPreferences: ['Seafood'] },
      DAYGI_PREFERENCE_KEYS,
      'preferences'
    );
    expect(picked).toEqual({ pace: 'Active', seafoodPreference: true, dietaryPreferences: ['Seafood'] });
  });

  it('refuses a nested object where a value is read as a string', () => {
    expect(() => pickAllowedKeys({ pace: { $ne: null } }, DAYGI_PREFERENCE_KEYS, 'preferences'))
      .toThrow(/preferences.pace/);
  });

  it('refuses a body with nothing recognisable rather than storing an empty update', () => {
    expect(() => pickAllowedKeys({ nothing: 'useful' }, DAYGI_PREFERENCE_KEYS, 'preferences'))
      .toThrow(/at least one of/);
  });

  it('bounds a string list', () => {
    const picked = pickAllowedKeys(
      { dietaryPreferences: new Array(200).fill('x') },
      DAYGI_PREFERENCE_KEYS,
      'preferences'
    );
    expect((picked.dietaryPreferences as string[]).length).toBe(50);
  });
});

describe('optionalString', () => {
  it('returns undefined for absent values and validates present ones', () => {
    expect(optionalString(undefined, 'holdToken')).toBeUndefined();
    expect(optionalString('', 'holdToken')).toBeUndefined();
    expect(optionalString(' HLD-1 ', 'holdToken')).toBe('HLD-1');
    expect(() => optionalString(42, 'holdToken')).toThrow(InvalidRequestBodyError);
  });
});

describe('every error is a 400', () => {
  it('carries the status the error handler reads', () => {
    let error: InvalidRequestBodyError | undefined;
    try { requiredString(undefined, 'tripId'); } catch (e) { error = e as InvalidRequestBodyError; }
    expect(error?.status).toBe(400);
    expect(error?.title).toBe('Invalid Request');
  });
});

describe('planAmountEGP', () => {
  /**
   * A trip item is a plan, not a payment. Free things exist — a beach, a
   * sunset walk, a reef you swim out to — and requiring a price above zero
   * stopped a traveler from planning any of them: adding "Eel Garden Sunset
   * Guided Snorkel" from Explore failed with "priceEGP must be greater than
   * zero". The same endpoint already treated an *absent* price as 0, so the
   * value was accepted when omitted and refused when stated.
   */
  it('accepts a free line', () => {
    expect(planAmountEGP(0, 'priceEGP')).toBe(0);
  });

  it('still refuses a negative price', () => {
    expect(() => planAmountEGP(-1, 'priceEGP')).toThrow(InvalidRequestBodyError);
  });

  it('accepts a real price', () => {
    expect(planAmountEGP(3400, 'priceEGP')).toBe(3400);
  });

  it('refuses something that is not a number', () => {
    expect(() => planAmountEGP('free', 'priceEGP')).toThrow(InvalidRequestBodyError);
    expect(() => planAmountEGP(undefined, 'priceEGP')).toThrow(InvalidRequestBodyError);
  });

  it('keeps the ceiling and the two-decimal rule', () => {
    expect(() => planAmountEGP(2_000_000, 'priceEGP')).toThrow(InvalidRequestBodyError);
    expect(() => planAmountEGP(10.005, 'priceEGP')).toThrow(InvalidRequestBodyError);
  });

  it('leaves requiredAmountEGP strict, because a payment of zero is still wrong', () => {
    expect(() => requiredAmountEGP(0, 'amountEGP')).toThrow(InvalidRequestBodyError);
  });
});
