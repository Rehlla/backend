import { describe, it, expect } from 'vitest';
import { interpolate } from '../../src/i18n/interpolate';

describe('interpolate', () => {
  it('replaces {placeholder} tokens across the whole template', () => {
    expect(interpolate('Hello {name}! You have {count} trips.', { name: 'Dina', count: 3 })).toBe(
      'Hello Dina! You have 3 trips.'
    );
  });

  it('replaces repeated tokens', () => {
    expect(interpolate('{x}-{x}-{x}', { x: 'a' })).toBe('a-a-a');
  });

  it('keeps numeric placeholder values as strings', () => {
    const out = interpolate('{money} EGP', { money: 1500 });
    expect(out).toBe('1500 EGP');
    expect(typeof out).toBe('string');
  });

  it('does not throw for placeholders missing from vars', () => {
    expect(interpolate('{a} and {b}', { a: '1' })).toBe('1 and {b}');
  });
});