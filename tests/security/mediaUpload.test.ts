import { describe, it, expect } from 'vitest';
import {
  validateImageUpload,
  MediaUploadError,
  sniffImageMime,
  sniffImageType,
  filenameFrom,
  serveMediaHeaders,
  ALLOWED_IMAGE_MIME_TYPES,
} from '../../server/services/mediaUpload';
import { ALLOWED, sniffImageType as sniffFromUtils, isAllowedMime } from '../../server/utils/imageValidation';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const WEBP = Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from('WEBP', 'latin1')]);
const GIF = Buffer.from('GIF89a', 'latin1');
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'latin1');

function dataUrl(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

describe('WS1 secure CMS media upload — security gates', () => {
  it('allowlist is exactly four raster types and explicitly excludes SVG', () => {
    expect(ALLOWED_IMAGE_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    expect((ALLOWED_IMAGE_MIME_TYPES as readonly string[])).not.toContain('image/svg+xml');
    expect(ALLOWED['image/svg+xml' as any]).toBeUndefined();
    // utils allowlist mirrors service allowlist
    expect(Object.keys(ALLOWED).sort()).toEqual([...ALLOWED_IMAGE_MIME_TYPES].sort());
    expect(ALLOWED['image/jpeg']).toBe('.jpg');
    expect(ALLOWED['image/png']).toBe('.png');
    expect(ALLOWED['image/webp']).toBe('.webp');
    expect(ALLOWED['image/gif']).toBe('.gif');
    expect(isAllowedMime('image/svg+xml')).toBe(false);
    expect(isAllowedMime('image/jpeg')).toBe(true);
  });

  it('positive: valid JPEG and PNG within limit are accepted', () => {
    const jpeg = validateImageUpload(dataUrl('image/jpeg', JPEG));
    expect(jpeg.mimeType).toBe('image/jpeg');
    expect(jpeg.extension).toBe('jpg');

    const png = validateImageUpload(dataUrl('image/png', PNG_SIG));
    expect(png.mimeType).toBe('image/png');
    expect(png.extension).toBe('png');

    const webp = validateImageUpload(dataUrl('image/webp', WEBP));
    expect(webp.mimeType).toBe('image/webp');

    const gif = validateImageUpload(dataUrl('image/gif', GIF));
    expect(gif.mimeType).toBe('image/gif');
  });

  it('sniffImageType magic bytes match spec (JPEG FF D8 FF, PNG 89 50 4E 47, RIFF..WEBP, GIF8* a)', () => {
    // utils sniff
    expect(sniffFromUtils(JPEG)).toBe('image/jpeg');
    expect(sniffFromUtils(PNG_SIG)).toBe('image/png');
    expect(sniffFromUtils(WEBP)).toBe('image/webp');
    expect(sniffFromUtils(GIF)).toBe('image/gif');
    expect(sniffFromUtils(SVG)).toBeNull();
    // service alias
    expect(sniffImageMime(PNG_SIG)).toBe('image/png');
    expect(sniffImageType(PNG_SIG)).toBe('image/png');
    // GIF87a variant
    expect(sniffFromUtils(Buffer.from('GIF87a', 'latin1'))).toBe('image/gif');
  });

  it('negative: mismatched declared MIME vs magic bytes is rejected even when both are on allowlist', () => {
    // PNG bytes claimed as JPEG
    expect(() => validateImageUpload(dataUrl('image/jpeg', PNG_SIG))).toThrow(MediaUploadError);
    expect(() => validateImageUpload(dataUrl('image/jpeg', PNG_SIG))).toThrow(/does not match the file's bytes/i);

    // JPEG bytes claimed as PNG
    expect(() => validateImageUpload(dataUrl('image/png', JPEG))).toThrow(/does not match/i);

    // WebP bytes claimed as GIF
    expect(() => validateImageUpload(dataUrl('image/gif', WEBP))).toThrow(/does not match/i);
  });

  it('negative: .svg block — image/svg+xml is never on allowlist and SVG bytes sniff to null', () => {
    // Declared SVG mime is rejected at allowlist gate
    expect(() => validateImageUpload(dataUrl('image/svg+xml', SVG))).toThrow(MediaUploadError);
    expect(() => validateImageUpload(dataUrl('image/svg+xml', SVG))).toThrow(/Unsupported MIME type/i);

    // Even if someone lies and claims SVG bytes are PNG, the bytes gate catches it
    expect(() => validateImageUpload(dataUrl('image/png', SVG))).toThrow(/not a valid/i);
    expect(sniffFromUtils(SVG)).toBeNull();

    // Serve path: .svg must be attachment + octet-stream (never inline)
    const svgHeaders = serveMediaHeaders('.svg');
    expect(svgHeaders.contentType).toBe('application/octet-stream');
    expect(svgHeaders.disposition).toBe('attachment');
  });

  it('negative: oversized payload is rejected (400) — decoded bytes exceed cap', () => {
    // Use a small cap to simulate 400KB overflow without allocating 5MB
    const cap = 300 * 1024; // 300KB cap
    const big = Buffer.alloc(400 * 1024, 0xff); // 400KB
    // Make it look like a JPEG so it passes magic check before size check
    big[0] = 0xff; big[1] = 0xd8; big[2] = 0xff;
    expect(() => validateImageUpload(dataUrl('image/jpeg', big), cap)).toThrow(MediaUploadError);
    expect(() => validateImageUpload(dataUrl('image/jpeg', big), cap)).toThrow(/too large/i);

    // Just under cap should pass (size gate is inclusive)
    const ok = Buffer.alloc(300 * 1024, 0xff);
    ok[0] = 0xff; ok[1] = 0xd8; ok[2] = 0xff;
    expect(() => validateImageUpload(dataUrl('image/jpeg', ok), cap)).not.toThrow();
  });

  it('filename sanitization: extension comes from sniffed MIME, stem sanitized to [a-zA-Z0-9_-] and truncated', () => {
    // PNG bytes + evil.svg client name must still produce .png
    const parsed = validateImageUpload(dataUrl('image/png', PNG_SIG));
    const { stored, display } = filenameFrom(parsed.mimeType, 'evil.svg');
    expect(stored).toBe('evil.png');
    expect(display).toBe('evil.svg');

    // Dots are stripped from stem (no directory traversal) — stored has exactly one dot for the extension
    const { stored: s2 } = filenameFrom('image/jpeg', '../../etc/passwd.svg');
    expect(s2).not.toContain('/');
    expect(s2.endsWith('.jpg')).toBe(true);
    const stemOnly = s2.replace(/\.jpg$/, '');
    expect(stemOnly).not.toContain('.');
    expect(stemOnly).not.toContain('/');

    // Special chars replaced, truncation at 60
    const long = 'a'.repeat(100) + '!@#$%.svg';
    const { stored: s3 } = filenameFrom('image/png', long);
    const stem = s3.replace(/\.png$/, '');
    expect(stem.length).toBeLessThanOrEqual(60);
    expect(stem).toMatch(/^[a-zA-Z0-9_-]+$/);

    // Empty/trash name falls back to "upload"
    const { stored: s4 } = filenameFrom('image/gif', '   ');
    expect(s4).toBe('upload.gif');
  });

  it('response harden: known raster extensions are inline, unknown are attachment', () => {
    expect(serveMediaHeaders('.jpg')).toEqual({ contentType: 'image/jpeg', disposition: 'inline' });
    expect(serveMediaHeaders('.png')).toEqual({ contentType: 'image/png', disposition: 'inline' });
    expect(serveMediaHeaders('.webp')).toEqual({ contentType: 'image/webp', disposition: 'inline' });
    expect(serveMediaHeaders('.gif')).toEqual({ contentType: 'image/gif', disposition: 'inline' });
    // Unknown / legacy
    expect(serveMediaHeaders('.svg').disposition).toBe('attachment');
    expect(serveMediaHeaders('.html').contentType).toBe('application/octet-stream');
    expect(serveMediaHeaders('.exe').disposition).toBe('attachment');
    expect(serveMediaHeaders('').contentType).toBe('application/octet-stream');
  });
});
