import sharp from 'sharp';

/**
 * Responsive image variants, generated at upload time.
 *
 * Phones should never download a 1600px hero to render it at 390 CSS pixels.
 * For every uploaded raster image we pre-render downscaled siblings
 * (400/800/1200px wide, never upscaled) next to the original; the existing
 * /api/media/:filename route serves them with zero changes, and CmsImage
 * picks via srcset. GIFs are excluded — resizing would destroy animation.
 *
 * Generation never fails an upload: any sharp error yields [] and the
 * original still lands.
 */

export const VARIANT_WIDTHS = [400, 800, 1200];

export interface GeneratedVariant {
  width: number;
  filename: string;
  buffer: Buffer;
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function formatFor(mime: string): 'jpeg' | 'png' | 'webp' | null {
  if (mime === 'image/jpeg') return 'jpeg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return null;
}

/**
 * Build downscaled variants of an uploaded image.
 *
 * @param buffer   validated upload bytes (magic bytes already sniffed)
 * @param mimeType authoritative MIME from validateImageUpload
 * @param stem     sanitized filename stem (no extension, filesystem-safe)
 */
export async function generateVariants(
  buffer: Buffer,
  mimeType: string,
  stem: string
): Promise<GeneratedVariant[]> {
  const format = formatFor(mimeType);
  if (!format) return [];
  const ext = EXT_BY_MIME[mimeType];
  try {
    const meta = await sharp(buffer).metadata();
    const srcWidth = meta.width || 0;
    if (!srcWidth) return [];
    const out: GeneratedVariant[] = [];
    for (const width of VARIANT_WIDTHS) {
      if (width >= srcWidth) continue;
      let pipeline = sharp(buffer).resize({ width, withoutEnlargement: true });
      if (format === 'jpeg') pipeline = pipeline.jpeg({ quality: 82 });
      else if (format === 'png') pipeline = pipeline.png({ compressionLevel: 9 });
      else pipeline = pipeline.webp({ quality: 82 });
      const resized = await pipeline.toBuffer();
      out.push({ width, filename: `${stem}-w${width}.${ext}`, buffer: resized });
    }
    return out;
  } catch {
    return [];
  }
}
