/**
 * Detect candidate markup regions (colored ink, clusters) via pixel analysis.
 */

import sharp from 'sharp';
import type { BoundingBox, MarkupRegion, PdfNoteType } from '@/lib/pdf-review-types';
import { mergeBoxes } from '@/lib/pdf-review-pipeline';

const CELL = 24;
const MIN_CLUSTER_CELLS = 3;
const MIN_BOX_SIZE = 28;
const MAX_REGIONS = Number(process.env.MAX_CROPS_PER_PAGE) || 12;

function isInkPixel(r: number, g: number, b: number): boolean {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max < 60 || max - min < 25) return false;
  // Blue pen
  if (b > r + 35 && b > g + 25 && b > 90) return true;
  // Red pen
  if (r > g + 35 && r > b + 25 && r > 90) return true;
  // Dark ink / marker
  if (max < 120 && min < 80 && (r < 100 || b < 100)) return true;
  return false;
}

function classifyRegion(
  rSum: number,
  gSum: number,
  bSum: number,
  count: number
): PdfNoteType | 'unknown' {
  const r = rSum / count;
  const g = gSum / count;
  const b = bSum / count;
  if (b > r + 30 && b > g + 20) return 'handwritten_note';
  if (r > g + 30 && r > b + 20) return 'handwritten_note';
  return 'marked_area';
}

export async function detectMarkupRegions(
  enhancedBuffer: Buffer,
  pageWidth: number,
  pageHeight: number
): Promise<MarkupRegion[]> {
  const sampleWidth = Math.min(900, pageWidth);
  const scale = sampleWidth / pageWidth;
  const sampleHeight = Math.round(pageHeight * scale);

  const { data, info } = await sharp(enhancedBuffer)
    .resize(sampleWidth, sampleHeight, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const w = info.width;
  const h = info.height;
  const cols = Math.ceil(w / CELL);
  const rows = Math.ceil(h / CELL);

  type Cell = { count: number; r: number; g: number; b: number };
  const grid: Cell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ count: 0, r: 0, g: 0, b: 0 }))
  );

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (!isInkPixel(r, g, b)) continue;
      const cx = Math.floor(x / CELL);
      const cy = Math.floor(y / CELL);
      const cell = grid[cy][cx];
      cell.count++;
      cell.r += r;
      cell.g += g;
      cell.b += b;
    }
  }

  const visited = new Set<string>();
  const regions: MarkupRegion[] = [];

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      if (grid[cy][cx].count < 2) continue;
      const key = `${cx},${cy}`;
      if (visited.has(key)) continue;

      const stack = [[cx, cy]];
      let minX = cx;
      let maxX = cx;
      let minY = cy;
      let maxY = cy;
      let total = 0;
      let rS = 0;
      let gS = 0;
      let bS = 0;

      while (stack.length) {
        const [x, y] = stack.pop()!;
        const k = `${x},${y}`;
        if (visited.has(k)) continue;
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
        if (grid[y][x].count < 2) continue;
        visited.add(k);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        const c = grid[y][x];
        total += c.count;
        rS += c.r;
        gS += c.g;
        bS += c.b;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }

      if (total < MIN_CLUSTER_CELLS) continue;

      const pad = 1;
      const box: BoundingBox = {
        x: Math.max(0, (minX - pad) * CELL) / scale,
        y: Math.max(0, (minY - pad) * CELL) / scale,
        width: Math.min(pageWidth, ((maxX - minX + 1 + pad * 2) * CELL) / scale),
        height: Math.min(pageHeight, ((maxY - minY + 1 + pad * 2) * CELL) / scale),
      };

      if (box.width < MIN_BOX_SIZE || box.height < MIN_BOX_SIZE) continue;

      regions.push({
        ...box,
        regionType: classifyRegion(rS, gS, bS, total),
        confidence: Math.min(0.95, 0.5 + total / 80),
      });
    }
  }

  return mergeNearbyRegions(regions).slice(0, MAX_REGIONS);
}

function mergeNearbyRegions(regions: MarkupRegion[]): MarkupRegion[] {
  if (regions.length === 0) return [];
  const merged: MarkupRegion[] = [];
  const used = new Set<number>();

  for (let i = 0; i < regions.length; i++) {
    if (used.has(i)) continue;
    let box: BoundingBox = {
      x: regions[i].x,
      y: regions[i].y,
      width: regions[i].width,
      height: regions[i].height,
    };
    let conf = regions[i].confidence;
    let type = regions[i].regionType;
    used.add(i);

    for (let j = i + 1; j < regions.length; j++) {
      if (used.has(j)) continue;
      const gap =
        Math.abs(regions[i].x - regions[j].x) < 80 &&
        Math.abs(regions[i].y - regions[j].y) < 80;
      const overlap =
        boxIntersection(box, regions[j]) > 0 ||
        (gap && boxArea(box) > 0 && boxArea(regions[j]) > 0);
      if (overlap || gap) {
        box = mergeBoxes(box, regions[j]);
        conf = Math.max(conf, regions[j].confidence);
        used.add(j);
      }
    }

    merged.push({
      ...box,
      regionType: type,
      confidence: conf,
    });
  }

  return merged.sort((a, b) => b.confidence - a.confidence);
}

function boxIntersection(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

function boxArea(b: BoundingBox): number {
  return b.width * b.height;
}

export async function cropRegion(
  imageBuffer: Buffer,
  region: BoundingBox,
  pageWidth: number,
  pageHeight: number,
  padding = 24
): Promise<{ buffer: Buffer; offsetX: number; offsetY: number }> {
  const left = Math.max(0, Math.floor(region.x - padding));
  const top = Math.max(0, Math.floor(region.y - padding));
  const right = Math.min(pageWidth, Math.ceil(region.x + region.width + padding));
  const bottom = Math.min(pageHeight, Math.ceil(region.y + region.height + padding));
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  const buffer = await sharp(imageBuffer)
    .extract({ left, top, width, height })
    .png()
    .toBuffer();

  return { buffer, offsetX: left, offsetY: top };
}
