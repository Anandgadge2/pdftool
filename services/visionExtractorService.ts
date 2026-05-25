/**
 * Vision extraction entry — delegates to two-pass pipeline + providers.
 */

import { extractAllPagesTwoPass, extractPageWithTwoPass } from '@/services/visionTwoPassExtractor';
import { isVisionConfigured, getVisionProviderName } from '@/services/visionProviders';
import type { PipelineNote } from '@/lib/pdf-review-types';

export { isVisionConfigured, getVisionProviderName };

export type { PipelineNote };

export async function extractNotesFromPageImage(
  buffer: Buffer,
  pageNumber: number,
  imageWidth: number,
  imageHeight: number
): Promise<PipelineNote[]> {
  const result = await extractPageWithTwoPass({
    pageNumber,
    buffer,
    width: imageWidth,
    height: imageHeight,
  });
  return result.notes;
}

export async function extractNotesFromAllPages(
  pages: Array<{
    pageNumber: number;
    buffer: Buffer;
    width: number;
    height: number;
  }>
): Promise<{
  byPage: Map<number, PipelineNote[]>;
  meta: Map<number, { duplicateRemoved: number; error?: string }>;
  totalDuplicatesRemoved: number;
}> {
  const { byPage, totalDuplicatesRemoved } = await extractAllPagesTwoPass(pages);
  const notesMap = new Map<number, PipelineNote[]>();
  const meta = new Map<number, { duplicateRemoved: number; error?: string }>();

  for (const [pageNum, out] of byPage) {
    notesMap.set(pageNum, out.notes);
    meta.set(pageNum, { duplicateRemoved: out.duplicateRemoved, error: out.error });
  }

  return { byPage: notesMap, meta, totalDuplicatesRemoved };
}
