/**
 * Secure CMS media upload — allowlist + magic bytes.
 *
 * Only the four raster image formats the media library can safely serve inline
 * are allowed. SVG (and any other script-capable type) is explicitly rejected
 * to close the stored-XSS path at `/api/media/:filename`.
 *
 * The authoritative MIME is the byte-sniffed one. Extension is derived from
 * `ALLOWED[mimeType]`, never from client-provided filename.
 *
 * Spec: Workstream 1 — .claude/plan-to-fix-all-peaceful-stearns.md §1
 * Spec files: server/utils/imageValidation.ts (this file), tests/security/mediaUpload.test.ts
 */

export const ALLOWED: Readonly<Record<string, string>> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
} as const;

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const EXTENSION_BY_MIME: Record<AllowedImageMime, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Sniff the image type from leading magic bytes.
 * Returns the authoritative MIME or null when not a supported raster format.
 *
 * Magic bytes:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 0D 0A 1A 0A
 * - WebP: RIFF....WEBP (bytes 0-3 = RIFF, 8-11 = WEBP)
 * - GIF:  GIF87a / GIF89a (47 49 46 38 37|39 61)
 */
export function sniffImageType(buffer: Buffer): AllowedImageMime | null {
  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // WebP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // GIF: GIF87a / GIF89a
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'image/gif';
  }

  return null;
}

// Alias for existing call sites (server/services/mediaUpload.ts uses sniffImageMime)
export const sniffImageMime = sniffImageType;

export function isAllowedMime(mime: string): mime is AllowedImageMime {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime);
}
