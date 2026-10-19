import { describe, expect, it } from 'vitest';
import { ApiError, apiErrorFrom } from '../../src/services/apiError';
import {
  CHECKOUT_ERROR_MESSAGE_KEYS,
  checkoutIssueFrom,
  checkoutIssueMessage,
} from '../../src/services/checkoutError';
import { TRANSLATIONS, translate } from '../../src/i18n/translations';

/**
 * The checkout contract answers `{ error, code, details }`. The client must
 * branch on `code` (never the sentence), carry `details` through, and give
 * every code a translated, actionable message in both languages.
 */

const apiErr = (status: number, code?: string, details: Record<string, unknown> = {}, message = 'server sentence') =>
  new ApiError(message, status, undefined, { code, details });

describe('apiErrorFrom', () => {
  it('reads code and details from a { error, code, details } body', async () => {
    const res = new Response(
      JSON.stringify({ error: 'The price for "SKU-1" is 1500 EGP', code: 'PRICE_CHANGED', details: { skuId: 'SKU-1', currentAmountEGP: 1500, quotedAmountEGP: 1200 } }),
      { status: 409, headers: { 'content-type': 'application/json' } }
    );
    const err = await apiErrorFrom(res, 'fallback');
    expect(err.status).toBe(409);
    expect(err.code).toBe('PRICE_CHANGED');
    expect(err.details).toEqual({ skuId: 'SKU-1', currentAmountEGP: 1500, quotedAmountEGP: 1200 });
  });

  it('leaves code undefined and details empty for the older { error } shape', async () => {
    const res = new Response(JSON.stringify({ error: 'nope' }), { status: 400, headers: { 'content-type': 'application/json' } });
    const err = await apiErrorFrom(res, 'fallback');
    expect(err.code).toBeUndefined();
    expect(err.details).toEqual({});
  });
});

describe('checkoutIssueFrom', () => {
  it.each([
    ['HOLD_REQUIRED', 400, 'rehold'],
    ['HOLD_EXPIRED', 409, 'rehold'],
    ['HOLD_MISMATCH', 400, 'rehold'],
    ['HOLD_NOT_OWNED', 403, 'signIn'],
    ['SUPPLIER_UNAVAILABLE', 409, 'alternatives'],
    ['FRAUD_BLOCKED', 403, 'contactSupport'],
  ] as const)('maps %s to its recovery', (code, status, recovery) => {
    const issue = checkoutIssueFrom(apiErr(status, code, { skuId: 'SKU-X' }));
    expect(issue.code).toBe(code);
    expect(issue.recovery).toBe(recovery);
    expect(issue.skuId).toBe('SKU-X');
  });

  it('carries the new amount on PRICE_CHANGED', () => {
    const issue = checkoutIssueFrom(apiErr(409, 'PRICE_CHANGED', { skuId: 'SKU-1', currentAmountEGP: 1500, quotedAmountEGP: 1200 }));
    expect(issue).toMatchObject({ code: 'PRICE_CHANGED', recovery: 'confirmPrice', currentAmountEGP: 1500, quotedAmountEGP: 1200, skuId: 'SKU-1' });
  });

  it('branches on code, not on the status alone (FRAUD_BLOCKED vs a plain 403)', () => {
    expect(checkoutIssueFrom(apiErr(403, 'FRAUD_BLOCKED', { riskScore: 90, signals: [] })).code).toBe('FRAUD_BLOCKED');
    expect(checkoutIssueFrom(apiErr(403)).code).toBe('FORBIDDEN');
  });

  it('derives sold-out and date-blocked from the hold route’s code-less 409 details', () => {
    expect(checkoutIssueFrom(apiErr(409, undefined, { requested: 4, available: 1 })).code).toBe('SOLD_OUT');
    const blocked = checkoutIssueFrom(apiErr(409, undefined, { supplierId: 'SUP-1', date: '2026-11-12', reason: 'Eid' }));
    expect(blocked).toMatchObject({ code: 'DATE_BLOCKED', recovery: 'pickAnotherDate', date: '2026-11-12' });
  });

  it('treats the single checkout’s bare "hold token has expired" 400 as HOLD_EXPIRED', () => {
    const issue = checkoutIssueFrom(apiErr(400, undefined, {}, 'Hold token has expired or is invalid. Please select your slot again.'));
    expect(issue.code).toBe('HOLD_EXPIRED');
  });

  it('maps transport outcomes', () => {
    expect(checkoutIssueFrom(apiErr(401)).code).toBe('SIGN_IN');
    expect(checkoutIssueFrom(apiErr(429)).code).toBe('RATE_LIMITED');
    expect(checkoutIssueFrom(apiErr(503)).code).toBe('SERVER');
    expect(checkoutIssueFrom(new TypeError('Failed to fetch')).code).toBe('NETWORK');
    expect(checkoutIssueFrom(apiErr(400)).code).toBe('UNKNOWN');
  });
});

describe('checkoutIssueMessage', () => {
  const formatEGP = (n: number) => `EGP ${n.toLocaleString('en-US')}`;
  const tFor = (language: 'en' | 'ar') => (key: string, vars: Record<string, string | number>) => translate(key, language, vars);

  it('states the new price in light Egyptian Arabic and plain English', () => {
    const issue = checkoutIssueFrom(apiErr(409, 'PRICE_CHANGED', { skuId: 'SKU-1', currentAmountEGP: 1500 }));
    expect(checkoutIssueMessage(issue, tFor('ar'), formatEGP)).toBe('السعر اتغيّر من ساعة ما بدأت. السعر الجديد EGP 1,500، تحب تكمّل؟');
    expect(checkoutIssueMessage(issue, tFor('en'), formatEGP)).toContain('EGP 1,500');
  });

  it('never asks the traveller to accept a price change with no amount', () => {
    const issue = checkoutIssueFrom(apiErr(409, 'PRICE_CHANGED', { skuId: 'SKU-1' }));
    expect(checkoutIssueMessage(issue, tFor('en'), formatEGP)).toBe(translate('checkout.error.priceChangedNoAmount', 'en'));
  });

  it('never surfaces the server sentence', () => {
    const issue = checkoutIssueFrom(apiErr(409, 'HOLD_EXPIRED', {}, 'Your reservation has expired or is invalid.'));
    expect(checkoutIssueMessage(issue, tFor('en'), formatEGP)).not.toContain('invalid');
  });

  it('has every message key in both languages', () => {
    const keys = [...CHECKOUT_ERROR_MESSAGE_KEYS, 'checkout.error.priceChangedNoAmount', 'checkout.error.dateBlockedNoDate'];
    for (const key of keys) {
      expect(TRANSLATIONS[key]?.en, key).toBeTruthy();
      expect(TRANSLATIONS[key]?.ar, key).toBeTruthy();
    }
  });
});
