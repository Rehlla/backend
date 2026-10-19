import { describe, it, expect } from 'vitest';
import {
  stringParam,
  enumParam,
  InvalidQueryParameterError,
  SEVERITIES,
  REVIEW_STATUSES,
  VERIFICATION_LEVELS
} from '../../server/middleware/queryParams';

/**
 * Query-parameter reading.
 *
 * Handlers used to write `req.query.severity as any` to get a domain union out
 * of Express's `string | string[] | ParsedQs | ParsedQs[]`. That let an
 * arbitrary string — or an array, if a caller repeats the parameter — reach the
 * service layer as though it were a valid enum member. Downstream filters
 * compare with `===`, so a bad value silently matched nothing, and an object
 * could reach code expecting a string.
 *
 * Absent means "no filter". Present but invalid is a 400: quietly dropping a
 * misspelled filter would return the caller MORE rows than they asked for,
 * with nothing to say the filter had been discarded.
 */

describe('stringParam', () => {
  it('accepts a plain string', () => {
    expect(stringParam('SUP-001')).toBe('SUP-001');
  });

  it('treats an absent parameter as no filter', () => {
    expect(stringParam(undefined)).toBeUndefined();
    expect(stringParam(null)).toBeUndefined();
    expect(stringParam('')).toBeUndefined();
  });

  it('rejects a repeated parameter, which Express hands over as an array', () => {
    // ?status=A&status=B — previously cast straight through as if it were one.
    expect(() => stringParam(['A', 'B'])).toThrow(InvalidQueryParameterError);
  });

  it('rejects a nested object, which ?a[b]=c produces', () => {
    expect(() => stringParam({ b: 'c' })).toThrow(InvalidQueryParameterError);
  });

  it('names the offending parameter in the message', () => {
    expect(() => stringParam(['A', 'B'], 'supplierId')).toThrow(/supplierId/);
  });
});

describe('enumParam', () => {
  it('accepts a member of the allowed set', () => {
    expect(enumParam('CRITICAL', SEVERITIES)).toBe('CRITICAL');
    expect(enumParam('PENDING_REVIEW', REVIEW_STATUSES)).toBe('PENDING_REVIEW');
  });

  it('treats an absent parameter as no filter', () => {
    expect(enumParam(undefined, SEVERITIES)).toBeUndefined();
    expect(enumParam('', SEVERITIES)).toBeUndefined();
  });

  it('rejects a value that is not a member', () => {
    expect(() => enumParam('DROP TABLE', SEVERITIES)).toThrow(InvalidQueryParameterError);
    expect(() => enumParam('PENDING', REVIEW_STATUSES)).toThrow(InvalidQueryParameterError);
  });

  it('is case sensitive, matching how the filters compare downstream', () => {
    expect(() => enumParam('critical', SEVERITIES)).toThrow(InvalidQueryParameterError);
    expect(() => enumParam('Critical', SEVERITIES)).toThrow(InvalidQueryParameterError);
  });

  it('rejects non-strings instead of passing them to the service layer', () => {
    expect(() => enumParam(['CRITICAL'], SEVERITIES)).toThrow(InvalidQueryParameterError);
    expect(() => enumParam({ toString: () => 'CRITICAL' }, SEVERITIES)).toThrow(InvalidQueryParameterError);
  });

  it('does not fall through prototype properties', () => {
    expect(() => enumParam('constructor', SEVERITIES)).toThrow(InvalidQueryParameterError);
    expect(() => enumParam('toString', VERIFICATION_LEVELS)).toThrow(InvalidQueryParameterError);
    expect(() => enumParam('__proto__', VERIFICATION_LEVELS)).toThrow(InvalidQueryParameterError);
  });

  it('carries a 400 and lists what was allowed', () => {
    let error: InvalidQueryParameterError | undefined;
    try { enumParam('URGENT', SEVERITIES, 'severity'); } catch (e) { error = e as InvalidQueryParameterError; }
    expect(error?.status).toBe(400);
    expect(error?.message).toContain('severity');
    expect(error?.message).toContain('CRITICAL');
  });

  it('covers every member of each published set', () => {
    for (const set of [SEVERITIES, REVIEW_STATUSES, VERIFICATION_LEVELS]) {
      for (const member of set) {
        expect(enumParam(member, set)).toBe(member);
      }
    }
  });
});
