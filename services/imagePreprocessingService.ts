/**
 * Preprocess PDF page images before AI Vision.
 */

import sharp from 'sharp';
import type { PreprocessedPageImage } from '@/lib/pdf-review-types';

export async function preprocessPageImage(buffer: Buffer): Promise<PreprocessedPageImage> {
  const meta = await sharp(buffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const originalBuffer = buffer;

  // Enhanced: contrast, sharpen, boost ink colors (blue/red channels)
  const enhancedBuffer = await sharp(buffer)
    .normalize()
    .sharpen({ sigma: 1.2, m1: 0.5, m2: 0.3 })
    .modulate({ saturation: 1.25, brightness: 1.02 })
    .linear(1.1, -(128 * 0.1))
    .png({ compressionLevel: 6 })
    .toBuffer();

  // Ink-focused: emphasize colored pen strokes
  const inkFocusedBuffer = await sharp(enhancedBuffer)
    .recomb([
      [1.2, 0, 0],
      [0, 0.9, 0],
      [0, 0, 1.3],
    ])
    .png()
    .toBuffer();

  return {
    originalBuffer,
    enhancedBuffer: inkFocusedBuffer,
    width,
    height,
  };
}

export async function preprocessPageImages(
  pages: Array<{ pageNumber: number; buffer: Buffer }>
): Promise<Map<number, PreprocessedPageImage>> {
  const map = new Map<number, PreprocessedPageImage>();
  for (const p of pages) {
    map.set(p.pageNumber, await preprocessPageImage(p.buffer));
  }
  return map;
}
