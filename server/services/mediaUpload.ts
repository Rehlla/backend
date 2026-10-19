/**
 * CMS media upload validation.
 *
 * The upload endpoint accepts base64 data URLs. Everything the client sends is
 * untrusted: the declared MIME type can claim anything, so the file's *bytes*
 * are the only thing that decides what is stored and served. Only the four
 * raster image formats the media library can safely serve inline (JPEG, PNG,
 * WebP, GIF) are allowed; anything script-capable (SVG, HTML, ...) is rejected
 * outright to close the stored-XSS path at `/api/media/:filename`.
 *
 * The authoritative MIME is the byte-sniffed one. The extension we persist is
 * derived from THAT, never from whatever the client declared.
 */

import {
  ALLOWED_IMAGE_MIME_TYPES as VALIDATED_MIME_TYPES,
  EXTENSION_BY_MIME as VALIDATED_EXT_BY_MIME,
  ALLOWED as VALIDATED_ALLOWED,
  sniffImageType as validatedSniff,
} from '../utils/imageValidation';

const ALLOWED_IMAGE_MIME_TYPE_SET: ReadonlySet<string> = new Set(
  VALIDATED_MIME_TYPES as readonly string[]
);

export const ALLOWED_IMAGE_MIME_TYPES = VALIDATED_MIME_TYPES;

export type UploadImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

export const EXTENSION_BY_MIME: Record<UploadImageMime, string> = VALIDATED_EXT_BY_MIME;

// Re-export allow-list with dot-prefixed extensions per spec §1 allowlist
export const ALLOWED = VALIDATED_ALLOWED;

/**
 * Default cap — prefer maxMediaUploadBytes(), which honors MEDIA_MAX_UPLOAD_MB.
 * Kept as a named export for callers that need a static fallback.
 */
export const DEFAULT_MAX_MEDIA_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export const MAX_MEDIA_UPLOAD_BYTES = DEFAULT_MAX_MEDIA_UPLOAD_BYTES;

/**
 * Effective upload cap in bytes. Reads MEDIA_MAX_UPLOAD_MB lazily (per call)
 * because this module is imported before dotenv.config() runs — a const
 * initialized at import time would never see .env values. Clamped to 1–50MB.
 */
export function maxMediaUploadBytes(): number {
  const raw = Number(process.env.MEDIA_MAX_UPLOAD_MB);
  if (Number.isFinite(raw) && raw >= 1 && raw <= 50) {
    return Math.floor(raw * 1024 * 1024);
  }
  return DEFAULT_MAX_MEDIA_UPLOAD_BYTES;
}

/** Effective cap in whole MB, for UI copy and the body-parser comment. */
export function maxMediaUploadMb(): number {
  return Math.max(1, Math.round(maxMediaUploadBytes() / 1024 / 1024));
}

export class MediaUploadError extends Error {
  statusCode = 400;
}

/** Raster formats that may be served inline by /api/media/:filename. */
const INLINE_MEDIA_BY_EXT: Readonly<Record<string, string>> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/**
 * Pick Content-Type / disposition from the extension *on disk* — never from
 * client-supplied headers. Unknown extensions (e.g. legacy SVGs) are served
 * as application/octet-stream + attachment so they can never render inline.
 */
export function serveMediaHeaders(ext: string): { contentType: string; disposition: 'inline' | 'attachment' } {
  const contentType = INLINE_MEDIA_BY_EXT[ext];
  if (contentType) return { contentType, disposition: 'inline' };
  return { contentType: 'application/octet-stream', disposition: 'attachment' };
}

/**
 * Build the stored filename from the *authoritative* MIME and a cleaned stem.
 * The extension comes from EXTENSION_BY_MIME[mimeType] — never from the
 * client's `filename`. The stem is collapsed to [a-zA-Z0-9_-] (dots and others
 * removed) and capped at 60 chars so the final name is predictable and safe.
 */
export function filenameFrom(mimeType: UploadImageMime, clientName: string): { stored: string; display: string } {
  const original = (clientName || '').trim();
  const stem = (
    original
      .replace(/\.[^.]*$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '') || 'upload'
  ).slice(0, 60);
  return {
    stored: `${stem}.${EXTENSION_BY_MIME[mimeType]}`,
    display: original || 'upload',
  };
}

export interface ParsedMediaUpload {
  buffer: Buffer;
  /** Authoritative MIME — sniffed from the bytes, never trusted from the client. */
  mimeType: UploadImageMime;
  /** File extension for the authoritative MIME (no leading dot). */
  extension: string;
  width: number;
  height: number;
}

/**
 * Sniff the image type from the leading magic bytes. Returns null when the
 * buffer is not any of the four supported raster formats.
 * Delegates to server/utils/imageValidation.ts (canonical allowlist).
 */
export function sniffImageMime(buffer: Buffer): UploadImageMime | null {
  return validatedSniff(buffer);
}

// Spec alias: plan names this function sniffImageType
export const sniffImageType = sniffImageMime;

/**
 * Parse and validate a base64 image data URL. Throws MediaUploadError with a
 * 400-family message on every rejection; on success returns the decoded bytes
 * with the byte-sniffed MIME (which wins over whatever the client declared).
 */
export function validateImageUpload(
  dataUrl: unknown,
  maxBytes: number = maxMediaUploadBytes(),
): ParsedMediaUpload {
  if (typeof dataUrl !== 'string' || dataUrl.length === 0) {
    throw new MediaUploadError('dataUrl (base64) is required');
  }

  // data:image/png;base64,<payload> — the MIME token may include '+' (svg+xml)
  const match = dataUrl.match(/^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([\s\S]*)$/);
  if (!match) {
    throw new MediaUploadError('Invalid data URL format');
  }

  const declaredMime = match[1].toLowerCase();
  const base64Data = match[2].trim();
  const buffer = Buffer.from(base64Data, 'base64');

  if (buffer.length === 0) {
    throw new MediaUploadError('Uploaded file is empty');
  }
  if (buffer.length > maxBytes) {
    throw new MediaUploadError(`File too large. Maximum: ${Math.floor(maxBytes / 1024 / 1024)}MB`);
  }

  // order matters: reject bad formats before we pay for dimension detection
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(declaredMime as UploadImageMime)) {
    throw new MediaUploadError(
      `Unsupported MIME type "${declaredMime}". Only image/jpeg, image/png, ` +
      'image/webp and image/gif may be uploaded.',
    );
  }

  // bytes win. A client that claims image/png but ships JPEG magic bytes
  // gets rejected even though the declared type is on the allow-list.
  const mimeType = sniffImageMime(buffer);
  if (!mimeType) {
    throw new MediaUploadError(
      'Uploaded content is not a valid JPEG, PNG, WebP or GIF image.',
    );
  }
  if (mimeType !== declaredMime) {
    throw new MediaUploadError(
      `Declared MIME "${declaredMime}" does not match the file's bytes ` +
      `("${mimeType}"). Send a data URL whose type matches the image.`,
    );
  }

  const dims = detectImageDimensions(buffer, mimeType);

  return {
    buffer,
    mimeType,
    extension: EXTENSION_BY_MIME[mimeType],
    width: dims.width,
    height: dims.height,
  };
}

/**
 * Detect image dimensions from raw bytes (JPEG and PNG only; WebP/GIF report
 * 0x0). No external dependencies required.
 */
export function detectImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } {
  try {
    if (mimeType === 'image/png') {
      // PNG header: 8 bytes signature, then IHDR chunk (13 bytes data)
      // Width at offset 16, Height at offset 20 (big-endian 4-byte ints)
      if (buffer.length >= 24) {
        const width = buffer.readUInt32BE(16);
        const height = buffer.readUInt32BE(20);
        if (width > 0 && width < 10000 && height > 0 && height < 10000) {
          return { width, height };
        }
      }
    }
    if (mimeType === 'image/jpeg') {
      // JPEG: scan for SOF marker
      let i = 2;
      while (i < buffer.length - 9) {
        if (buffer[i] === 0xff) {
          const marker = buffer[i + 1];
          // SOF0 (0xC0) or SOF2 (0xC2)
          if (marker === 0xc0 || marker === 0xc2) {
            const height = buffer.readUInt16BE(i + 5);
            const width = buffer.readUInt16BE(i + 7);
            if (width > 0 && width < 10000 && height > 0 && height < 10000) {
              return { width, height };
            }
          }
          // Skip to next marker
          if (marker !== 0xd8 && marker !== 0xd9) {
            const segLen = buffer.readUInt16BE(i + 2);
            i += 2 + segLen;
          } else {
            i += 2;
          }
        } else {
          i++;
        }
      }
    }
  } catch {
    // Ignore dimension detection errors
  }
  return { width: 0, height: 0 };
}