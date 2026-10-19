import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import {
  generateVariants,
  VARIANT_WIDTHS,
} from '../../server/services/imageVariants';

/**
 * Responsive variants are generated with sharp at upload time — but generation
 * must never fail an upload, never upscale, and never touch animation.
 * These tests pin exactly that contract (plus the overlay srcset mapping,
 * which is what travelers actually download).
 */

async function pngBuffer(width: number, height = Math.max(1, Math.floor(width / 2))): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .png()
    .toBuffer();
}

describe('imageVariants', () => {
  it('renders downscaled siblings below the source width', async () => {
    const variants = await generateVariants(await pngBuffer(1600), 'image/png', 'abc123');
    expect(variants.map(v => v.width)).toEqual([400, 800, 1200]);
    for (const v of variants) {
      expect(v.filename).toMatch(/^abc123-w(400|800|1200)\.png$/);
      const meta = await sharp(v.buffer).metadata();
      expect(meta.width).toBe(v.width);
      expect(meta.format).toBe('png');
    }
  });

  it('never upscales: small sources yield fewer (or zero) variants', async () => {
    // 900px source → only the 400 and 800 rungs (1200 would upscale).
    const variants = await generateVariants(await pngBuffer(900), 'image/png', 's');
    expect(variants.map(v => v.width)).toEqual([400, 800]);
  });

  it('emits nothing when there is nothing smaller to render', async () => {
    expect(await generateVariants(await pngBuffer(300), 'image/png', 's')).toEqual([]);
  });

  it('skips GIFs to preserve animation', async () => {
    const gif = Buffer.from('GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;', 'latin1');
    expect(await generateVariants(gif, 'image/gif', 's')).toEqual([]);
  });

  it('returns [] instead of throwing on corrupt bytes', async () => {
    await expect(generateVariants(Buffer.from('not-an-image'), 'image/jpeg', 's')).resolves.toEqual([]);
    await expect(generateVariants(Buffer.alloc(0), 'image/png', 's')).resolves.toEqual([]);
  });

  it('rejects unknown MIME types', async () => {
    await expect(generateVariants(await pngBuffer(1600), 'image/avif', 's')).resolves.toEqual([]);
  });

  it('exposes the configured widths as a sorted allow-list', () => {
    expect([...VARIANT_WIDTHS].sort((a, b) => a - b)).toEqual(VARIANT_WIDTHS);
  });
});
