/**
 * Engine 1: Digital PDF Annotation Extractor
 * Extracts real PDF annotations, highlights, sticky notes, etc.
 */

import { copyPdfBytes } from '@/lib/pdf-buffer-utils';
import type { DigitalExtractedNote, PdfNoteType } from '@/lib/pdf-review-types';

const ANNOT_TYPE_MAP: Record<number, string> = {
  1: 'Text',
  2: 'Link',
  3: 'FreeText',
  4: 'Line',
  5: 'Square',
  6: 'Circle',
  7: 'Polygon',
  8: 'PolyLine',
  9: 'Highlight',
  10: 'Underline',
  11: 'Squiggly',
  12: 'StrikeOut',
  13: 'Stamp',
  14: 'Caret',
  15: 'Ink',
  16: 'Popup',
  17: 'FileAttachment',
  20: 'Widget',
};

const SKIP_TYPES = new Set(['Link', 'Widget', 'Popup']);

function mapAnnotationToNoteType(subtypeName: string): PdfNoteType {
  const map: Record<string, PdfNoteType> = {
    Text: 'sticky_note',
    FreeText: 'sticky_note',
    Highlight: 'highlight',
    Underline: 'underline',
    Squiggly: 'underline',
    StrikeOut: 'underline',
    Square: 'box',
    Circle: 'circle',
    Line: 'arrow',
    PolyLine: 'arrow',
    Polygon: 'marked_area',
    Ink: 'handwritten_note',
    Stamp: 'digital_comment',
    Caret: 'digital_comment',
    Redact: 'marked_area',
  };
  return map[subtypeName] ?? 'digital_comment';
}

function getAnnotTypeName(subtype: string | number | undefined): string {
  if (typeof subtype === 'string') return subtype || 'Unknown';
  if (typeof subtype === 'number') return ANNOT_TYPE_MAP[subtype] ?? `Unknown (${subtype})`;
  return 'Unknown';
}

function rectToBoundingBox(
  rect: number[],
  pageHeight: number
): { x: number; y: number; width: number; height: number } {
  const [x0, y0, x1, y1] = rect;
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const bottom = Math.min(y0, y1);
  const top = Math.max(y0, y1);
  // Convert PDF bottom-left origin to top-left image coordinates
  const x = Math.round(left * 10) / 10;
  const y = Math.round((pageHeight - top) * 10) / 10;
  const width = Math.round((right - left) * 10) / 10;
  const height = Math.round((top - bottom) * 10) / 10;
  return { x, y, width, height };
}

function ensureDOMMatrixPolyfill() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    (globalThis as Record<string, unknown>).DOMMatrix = class DOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      inverse() {
        return new DOMMatrix();
      }
      multiply() {
        return new DOMMatrix();
      }
      transformPoint(p: { x: number; y: number }) {
        return p || { x: 0, y: 0 };
      }
    };
  }
  if (typeof globalThis.Path2D === 'undefined') {
    (globalThis as Record<string, unknown>).Path2D = class Path2D {
      constructor() {}
    };
  }
}

async function ensurePdfWorker() {
  if ((globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker?.WorkerMessageHandler) {
    return;
  }
  const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
}

export async function extractDigitalAnnotations(
  buffer: Buffer | ArrayBuffer | Uint8Array
): Promise<{ notes: DigitalExtractedNote[]; totalPages: number }> {
  const pdfBytes = copyPdfBytes(buffer);
  ensureDOMMatrixPolyfill();

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(async () => {
    return await import('pdfjs-dist');
  });
  const pdfjs = (pdfjsLib as { default?: unknown }).default ?? pdfjsLib;
  await ensurePdfWorker();

  const loadingTask = (pdfjs as { getDocument: (opts: object) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<unknown> }> } }).getDocument({
    data: pdfBytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;
  const notes: DigitalExtractedNote[] = [];
  const numPages = doc.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = (await doc.getPage(pageNum)) as {
      getAnnotations: (opts: { intent: string }) => Promise<Array<Record<string, unknown>>>;
      getViewport: (opts: { scale: number }) => { height: number };
      getTextContent: () => Promise<{ items: Array<{ str: string; transform?: number[] }> }>;
    };
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const annotations = await page.getAnnotations({ intent: 'display' });

    for (const annot of annotations) {
      const subtypeName = getAnnotTypeName(annot.subtype as string | number | undefined);
      if (SKIP_TYPES.has(subtypeName)) continue;

      const noteType = mapAnnotationToNoteType(subtypeName);
      let position = { x: 0, y: 0, width: 0, height: 0 };
      if (annot.rect && Array.isArray(annot.rect) && (annot.rect as number[]).length === 4) {
        position = rectToBoundingBox(annot.rect as number[], pageHeight);
      }

      let extractedText = String(annot.contents ?? '').trim();
      if (!extractedText) {
        extractedText = `[${subtypeName} - no comment text]`;
      }

      const author = String(annot.title ?? '').trim() || undefined;
      const subject = String(annot.subject ?? '').trim() || undefined;

      let selectedText = '';
      const textTypes = new Set(['Highlight', 'Underline', 'StrikeOut', 'Squiggly']);
      if (textTypes.has(subtypeName) && annot.chars) {
        try {
          selectedText = (annot.chars as Array<{ unicode: string }>)
            .map((c) => c.unicode)
            .join('')
            .trim();
        } catch {
          /* ignore */
        }
      }

      if (textTypes.has(subtypeName) && !selectedText && annot.rect) {
        try {
          const textContent = await page.getTextContent();
          const [ax0, ay0, ax1, ay1] = annot.rect as number[];
          const words: string[] = [];
          for (const item of textContent.items) {
            if (!item.transform) continue;
            const tx = item.transform[4];
            const ty = item.transform[5];
            if (
              tx >= Math.min(ax0, ax1) - 2 &&
              tx <= Math.max(ax0, ax1) + 2 &&
              ty >= Math.min(ay0, ay1) - 5 &&
              ty <= Math.max(ay0, ay1) + 5
            ) {
              words.push(item.str);
            }
          }
          selectedText = words.join(' ').trim();
        } catch {
          /* best-effort */
        }
      }

      notes.push({
        pageNumber: pageNum,
        noteType,
        extractedText: selectedText || extractedText,
        summary: extractedText.slice(0, 120),
        author,
        subject,
        position,
        confidence: 0.95,
        rawData: {
          subtype: subtypeName,
          rect: annot.rect,
          contents: annot.contents,
        },
      });
    }
  }

  return { notes, totalPages: numPages };
}

export async function hasDigitalAnnotations(
  buffer: Buffer | ArrayBuffer | Uint8Array
): Promise<boolean> {
  const { notes } = await extractDigitalAnnotations(buffer);
  return notes.length > 0;
}
