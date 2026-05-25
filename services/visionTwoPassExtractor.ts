/**
 * Two-pass AI Vision: full page + crop refinement.
 */

import { preprocessPageImage } from '@/services/imagePreprocessingService';
import { detectMarkupRegions, cropRegion } from '@/services/markupRegionDetector';
import { getVisionProvider, isVisionConfigured } from '@/services/visionProviders';
import { VisionApiError } from '@/services/visionProviders';
import {
  deduplicateExtractedNotes,
  offsetBox,
  rawToPipelineNotes,
  boxOverlapRatio,
} from '@/lib/pdf-review-pipeline';
import type { NoteSource, PipelineNote, RawVisionNote } from '@/lib/pdf-review-types';
import { MAX_CROPS_PER_PAGE } from '@/lib/pdf-review-types';

export interface PageExtractionInput {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
}

export interface PageExtractionOutput {
  notes: PipelineNote[];
  duplicateRemoved: number;
  pass1Count: number;
  pass2Count: number;
  cropsUsed: number;
  rawPass1?: string;
  error?: string;
}

async function analyzeWithRetry(
  buffer: Buffer,
  opts: { isCrop?: boolean; pageNumber: number }
): Promise<{ notes: RawVisionNote[]; raw: string }> {
  const provider = getVisionProvider();
  try {
    const result = await provider.analyzeImage(buffer, {
      pageNumber: opts.pageNumber,
      isCrop: opts.isCrop,
    });
    return { notes: result.notes, raw: result.rawContent };
  } catch (err) {
    const visionErr = err as VisionApiError;
    if (visionErr.code === 'invalid_json') {
      const retry = await provider.analyzeImage(buffer, {
        pageNumber: opts.pageNumber,
        isCrop: opts.isCrop,
        retryStrictJson: true,
      });
      return { notes: retry.notes, raw: retry.rawContent };
    }
    throw err;
  }
}

function mergePassResults(
  pass1: PipelineNote[],
  pass2: PipelineNote[],
  pageNumber: number
): PipelineNote[] {
  const merged = [...pass1];

  for (const p2 of pass2) {
    const matchIdx = merged.findIndex(
      (p1) =>
        p1.pageNumber === pageNumber &&
        (boxOverlapRatio(p1.position, p2.position) > 0.45 ||
          (p1.extractedText && p2.extractedText && p1.extractedText === p2.extractedText))
    );
    if (matchIdx >= 0) {
      if (p2.confidence >= merged[matchIdx].confidence) {
        merged[matchIdx] = {
          ...p2,
          pageNumber,
          source: 'crop_vision',
        };
      }
    } else {
      merged.push({ ...p2, pageNumber, source: 'crop_vision' });
    }
  }

  return merged;
}

export async function extractPageWithTwoPass(
  input: PageExtractionInput
): Promise<PageExtractionOutput> {
  if (!isVisionConfigured()) {
    return {
      notes: [],
      duplicateRemoved: 0,
      pass1Count: 0,
      pass2Count: 0,
      cropsUsed: 0,
      error: 'Vision API not configured',
    };
  }

  const { pageNumber, width, height } = input;
  const preprocessed = await preprocessPageImage(input.buffer);
  const enhanced = preprocessed.enhancedBuffer;

  let pass1Raw: RawVisionNote[] = [];
  let rawPass1 = '';

  try {
    const pass1 = await analyzeWithRetry(enhanced, { pageNumber, isCrop: false });
    pass1Raw = pass1.notes;
    rawPass1 = pass1.raw;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[visionTwoPass] Pass1 failed page ${pageNumber}:`, err);
    return {
      notes: [],
      duplicateRemoved: 0,
      pass1Count: 0,
      pass2Count: 0,
      cropsUsed: 0,
      error: msg,
    };
  }

  const pass1Pipeline = rawToPipelineNotes(pass1Raw, pageNumber, 'full_page_vision');

  const regions = await detectMarkupRegions(enhanced, width, height);

  const roughFromPass1 = pass1Pipeline
    .filter((n) => n.position.width > 20 && n.position.height > 20)
    .map((n) => ({
      x: n.position.x,
      y: n.position.y,
      width: n.position.width,
      height: n.position.height,
      regionType: n.noteType,
      confidence: n.confidence,
    }));

  const allRegions = [...regions];
  for (const r of roughFromPass1) {
    const exists = allRegions.some((a) => boxOverlapRatio(a, r) > 0.5);
    if (!exists) allRegions.push(r);
  }

  const cropsToProcess = allRegions.slice(0, MAX_CROPS_PER_PAGE);
  const pass2Notes: PipelineNote[] = [];
  let cropError: string | undefined;

  for (const region of cropsToProcess) {
    if (region.confidence < 0.35 && region.width * region.height < 2000) continue;

    try {
      const { buffer: cropBuf, offsetX, offsetY } = await cropRegion(
        enhanced,
        region,
        width,
        height,
        28
      );

      if (cropBuf.length < 500) continue;

      const pass2 = await analyzeWithRetry(cropBuf, { pageNumber, isCrop: true });
      const mapped = rawToPipelineNotes(pass2.notes, pageNumber, 'crop_vision').map((n) => ({
        ...n,
        position: offsetBox(n.position, offsetX, offsetY),
        confidence: Math.min(1, n.confidence + 0.05),
      }));
      pass2Notes.push(...mapped);
    } catch (err) {
      if (err instanceof VisionApiError && (err.code === 'quota' || err.code === 'auth')) {
        cropError = err.message;
        console.warn(
          `[visionTwoPass] Stopping crop refinement page ${pageNumber}: ${err.message}`
        );
        break;
      }
      console.warn(`[visionTwoPass] Crop failed page ${pageNumber}:`, err);
    }
  }

  const merged = mergePassResults(pass1Pipeline, pass2Notes, pageNumber);
  const { notes, removedCount } = deduplicateExtractedNotes(merged);

  return {
    notes,
    duplicateRemoved: removedCount,
    pass1Count: pass1Pipeline.length,
    pass2Count: pass2Notes.length,
    cropsUsed: cropsToProcess.length,
    rawPass1,
    error: cropError,
  };
}

export async function extractAllPagesTwoPass(
  pages: PageExtractionInput[]
): Promise<{
  byPage: Map<number, PageExtractionOutput>;
  totalDuplicatesRemoved: number;
}> {
  const byPage = new Map<number, PageExtractionOutput>();
  let totalDuplicatesRemoved = 0;

  for (const page of pages) {
    const result = await extractPageWithTwoPass(page);
    byPage.set(page.pageNumber, result);
    totalDuplicatesRemoved += result.duplicateRemoved;
  }

  return { byPage, totalDuplicatesRemoved };
}
