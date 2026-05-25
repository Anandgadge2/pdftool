/**
 * Convert PDF pages to high-resolution PNG images for vision/OCR extraction.
 */

import { createCanvas } from '@napi-rs/canvas';
import { copyPdfBytes } from '@/lib/pdf-buffer-utils';
import type { PdfPageImage } from '@/lib/pdf-review-types';
import { PDF_RENDER_SCALE } from '@/lib/pdf-review-types';

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
}

async function ensurePdfWorker() {
  if ((globalThis as { pdfjsWorker?: { WorkerMessageHandler?: unknown } }).pdfjsWorker?.WorkerMessageHandler) {
    return;
  }
  const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
}

type PdfJsPage = {
  getViewport: (opts: { scale: number }) => { width: number; height: number };
  render: (opts: {
    canvasContext: ReturnType<typeof createCanvas> extends infer C ? C extends { getContext: (t: string) => infer Ctx } ? Ctx : never : never;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void> };
};

export async function convertPdfToPageImages(
  buffer: Buffer | ArrayBuffer | Uint8Array,
  scale: number = PDF_RENDER_SCALE
): Promise<PdfPageImage[]> {
  const pdfBytes = copyPdfBytes(buffer);
  ensureDOMMatrixPolyfill();

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(async () => {
    return await import('pdfjs-dist');
  });
  const pdfjs = (pdfjsLib as { default?: unknown }).default ?? pdfjsLib;
  await ensurePdfWorker();

  const loadingTask = (pdfjs as {
    getDocument: (opts: object) => {
      promise: Promise<{ numPages: number; getPage: (n: number) => Promise<PdfJsPage> }>;
    };
  }).getDocument({
    data: pdfBytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  });

  const doc = await loadingTask.promise;
  const pages: PdfPageImage[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context as Parameters<PdfJsPage['render']>[0]['canvasContext'],
      viewport,
    }).promise;

    const pngBuffer = canvas.toBuffer('image/png');

    pages.push({
      pageNumber: pageNum,
      buffer: pngBuffer,
      width: Math.ceil(viewport.width),
      height: Math.ceil(viewport.height),
      mimeType: 'image/png',
    });
  }

  return pages;
}

export async function getPdfPageCount(buffer: Buffer | ArrayBuffer | Uint8Array): Promise<number> {
  const pdfBytes = copyPdfBytes(buffer);
  ensureDOMMatrixPolyfill();
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(async () => {
    return await import('pdfjs-dist');
  });
  const pdfjs = (pdfjsLib as { default?: unknown }).default ?? pdfjsLib;
  await ensurePdfWorker();

  const loadingTask = (pdfjs as {
    getDocument: (opts: object) => { promise: Promise<{ numPages: number }> };
  }).getDocument({
    data: pdfBytes,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  });

  const doc = await loadingTask.promise;
  return doc.numPages;
}
