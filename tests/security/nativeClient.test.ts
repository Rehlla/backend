import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { wantsBearerToken } from '../../server/middleware/nativeClient';

const req = (headers: Record<string, string>) => ({ headers }) as unknown as Request;

describe('mobile app session transport', () => {
  it('hands the token only to a caller that asks for bearer transport', () => {
    expect(wantsBearerToken(req({}))).toBe(false);
    expect(wantsBearerToken(req({ 'x-dahab-client': 'web' }))).toBe(false);
    expect(wantsBearerToken(req({ 'x-dahab-client': 'native' }))).toBe(true);
    expect(wantsBearerToken(req({ 'x-dahab-client': 'NATIVE' }))).toBe(true);
  });
});
