import { describe, it, expect } from 'vitest';
import { deriveMediaFilename } from '../../src/components/operations/command-center/cms/api';

describe('deriveMediaFilename', () => {
  it('strips query strings and hash fragments', () => {
    expect(deriveMediaFilename('https://images.unsplash.com/photo-123456?q=80&w=1600&auto=format')).toBe('photo-123456');
  });

  it('decodes percent-encoding in the filename', () => {
    expect(deriveMediaFilename('https://example.com/photos/hello%20world.jpg')).toBe('hello world.jpg');
  });

  it('returns "media" for an empty URL', () => {
    expect(deriveMediaFilename('')).toBe('media');
  });

  it('keeps arbitrary strings as-is (display name, not a security boundary)', () => {
    expect(deriveMediaFilename('not-a-url')).toBe('not-a-url');
  });

  it('handles URLs with no path segments', () => {
    expect(deriveMediaFilename('https://example.com/')).toBe('media');
  });

  it('preserves extension from the original filename', () => {
    expect(deriveMediaFilename('https://cdn.example.com/img/blue-hole.png')).toBe('blue-hole.png');
  });
});
