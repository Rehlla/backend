import { describe, it, expect } from 'vitest';
import {
  validateImageUpload,
  MediaUploadError,
  ALLOWED_IMAGE_MIME_TYPES,
  sniffImageMime,
  filenameFrom,
} from '../../server/services/mediaUpload';
import type { UploadImageMime } from '../../server/services/mediaUpload';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngWithDimensions(width: number, height: number): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type RGBA
  const chunk = Buffer.concat([Buffer.from('IHDR'), ihdr]);
  return Buffer.concat([PNG_SIGNATURE, Buffer.from([0, 0, 0, 13]), chunk, Buffer.from([0, 0, 0, 0])]);
}

const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from('WEBP', 'latin1'),
]);

const GIF = Buffer.from('GIF89a', 'latin1');

const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'latin1');
const HTML = Buffer.from('<!DOCTYPE html><html><body>hello</body></html>', 'latin1');

function dataUrlOf(mime: string, bytes: Buffer): string {
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

describe('validateImageUpload (§1 CMS upload security)', () => {
  it('accepts a JPEG with correct magic bytes and derives jpg extension', () => {
    const parsed = validateImageUpload(dataUrlOf('image/jpeg', JPEG));
    expect(parsed.mimeType).toBe('image/jpeg');
    expect(parsed.extension).toBe('jpg');
  });

  it('accepts PNG/WebP/GIF with correct signatures', () => {
    for (const [mime, bytes, ext] of [
      ['image/png', PNG_SIGNATURE, 'png'],
      ['image/webp', WEBP, 'webp'],
      ['image/gif', GIF, 'gif'],
    ] as const) {
      const parsed = validateImageUpload(dataUrlOf(mime, Buffer.from(bytes)));
      expect(parsed.mimeType).toBe(mime);
      expect(parsed.extension).toBe(ext);
    }
  });

  it('reads PNG dimensions from the IHDR chunk', () => {
    const parsed = validateImageUpload(dataUrlOf('image/png', pngWithDimensions(800, 600)));
    expect(parsed.width).toBe(800);
    expect(parsed.height).toBe(600);
  });

  it('rejects SVG even when it would match image/*', () => {
    expect(() => validateImageUpload(dataUrlOf('image/svg+xml', SVG))).toThrow(MediaUploadError);
    expect(() => validateImageUpload(dataUrlOf('image/svg+xml', SVG)))
      .toThrow(/Unsupported MIME type/);
  });

  it('rejects HTML payloads regardless of declared MIME', () => {
    expect(() => validateImageUpload(dataUrlOf('text/html', HTML))).toThrow(MediaUploadError);
    // An attacker pretending an HTML payload is a PNG is caught by the bytes.
    expect(() => validateImageUpload(dataUrlOf('image/png', HTML))).toThrow(/not a valid/);
  });

  it('rejects a non-image declared MIME even when the bytes are an image', () => {
    expect(() => validateImageUpload(dataUrlOf('application/pdf', JPEG))).toThrow(MediaUploadError);
  });

  it('rejects files over the size cap', () => {
    const big = Buffer.alloc(11 * 1024 * 1024);
    expect(() => validateImageUpload(dataUrlOf('image/png', big))).toThrow(/too large/i);
  });

  it('rejects empty payloads and malformed data URLs', () => {
    expect(() => validateImageUpload(`data:image/png;base64,`)).toThrow(/empty/i);
    expect(() => validateImageUpload('not-a-data-url')).toThrow(/Invalid data URL format/);
    expect(() => validateImageUpload(undefined)).toThrow(/required/);
    expect(() => validateImageUpload(12345)).toThrow(/required/);
  });

  it('only allows the four raster image types', () => {
    expect(ALLOWED_IMAGE_MIME_TYPES).toEqual(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  });

  describe('sniffImageMime (byte-level allowlist)', () => {
    it('recognizes JPEG/PNG/WebP/GIF by their magic bytes', () => {
      expect(sniffImageMime(JPEG)).toBe('image/jpeg');
      expect(sniffImageMime(PNG_SIGNATURE)).toBe('image/png');
      expect(sniffImageMime(WEBP)).toBe('image/webp');
      expect(sniffImageMime(GIF)).toBe('image/gif');
    });

    it('returns null for non-image payloads', () => {
      expect(sniffImageMime(SVG)).toBeNull();
      expect(sniffImageMime(HTML)).toBeNull();
      expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
    });
  });

  describe('stored filename is server-determined', () => {
    it('uses the sniffed MIME extension, never the client filename', () => {
      // PNG bytes + a `.svg` client filename must produce a `.png` stored name.
      const parsed = validateImageUpload(dataUrlOf('image/png', PNG_SIGNATURE));
      expect(parsed.extension).toBe('png');

      const { stored, display } = filenameFrom(
        parsed.mimeType as UploadImageMime,
        'evil.svg',
      );
      expect(stored).toMatch(/\.png$/);
      expect(display).toBe('evil.svg');
    });

    it('rejects a mismatched declared MIME vs bytes even when both are on the allow-list', () => {
      // PNG bytes advertised as JPEG.
      expect(() =>
        validateImageUpload(dataUrlOf('image/jpeg', PNG_SIGNATURE)),
      ).toThrow(/does not match the file's bytes/i);
    });
  });
});
