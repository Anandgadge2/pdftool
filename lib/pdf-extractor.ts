/**
 * PDF Annotation Extractor — JavaScript implementation
 * Mirrors the Python PyMuPDF (fitz) extractor logic using pdf.js
 */

import type { ExtractedAnnotation } from './types';

// PDF annotation type number → name mapping (matches PDF spec & Python extractor)
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
  18: 'Sound',
  19: 'Movie',
  20: 'Widget',
  21: 'Screen',
  22: 'PrinterMark',
  23: 'TrapNet',
  24: 'Watermark',
  25: '3D',
  26: 'Redact',
};

const SKIP_TYPES = new Set(['Link', 'Widget', 'Popup']);
const TEXT_EXTRACT_TYPES = new Set(['Highlight', 'Underline', 'StrikeOut', 'Squiggly']);

/**
 * Parse a PDF date string like "D:20260520220137Z" into a readable format.
 */
function parsePdfDate(dateStr: string): string {
  if (!dateStr) return '';

  let clean = dateStr;
  if (clean.startsWith('D:')) clean = clean.slice(2);
  clean = clean.replace(/'/g, '');

  try {
    if (clean.length >= 14) {
      const year   = clean.slice(0, 4);
      const month  = clean.slice(4, 6);
      const day    = clean.slice(6, 8);
      const hour   = clean.slice(8, 10);
      const min    = clean.slice(10, 12);
      const sec    = clean.slice(12, 14);
      let tz = '';
      if (clean.length > 14) {
        const tzPart = clean.slice(14);
        if (tzPart === 'Z') {
          tz = ' UTC';
        } else if (tzPart.length >= 5 && (tzPart[0] === '+' || tzPart[0] === '-')) {
          tz = ` (GMT${tzPart.slice(0, 3)}:${tzPart.slice(3, 5)})`;
        } else {
          tz = ` (${tzPart})`;
        }
      }
      return `${year}-${month}-${day} ${hour}:${min}:${sec}${tz}`;
    }
    if (clean.length >= 8) {
      return `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}`;
    }
  } catch {
    // fall through
  }
  return dateStr;
}

function getAnnotTypeName(subtype: string | number | undefined): string {
  if (typeof subtype === 'string') {
    return subtype || 'Unknown';
  }
  if (typeof subtype === 'number') {
    return ANNOT_TYPE_MAP[subtype] ?? `Unknown (${subtype})`;
  }
  return 'Unknown';
}

function nowFormatted(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function getAnnotationColor(colorArray?: any): string {
  if (!colorArray || (colorArray.length !== 3 && colorArray.length !== 4)) {
    return 'Yellow'; // Default fallback
  }

  // Handle float arrays where elements are 0-1
  const r = colorArray[0] <= 1 && colorArray[1] <= 1 && colorArray[2] <= 1
    ? Math.round(colorArray[0] * 255)
    : Math.round(colorArray[0]);
  const g = colorArray[1] <= 1 && colorArray[1] <= 1 && colorArray[2] <= 1
    ? Math.round(colorArray[1] * 255)
    : Math.round(colorArray[1]);
  const b = colorArray[2] <= 1 && colorArray[1] <= 1 && colorArray[2] <= 1
    ? Math.round(colorArray[2] * 255)
    : Math.round(colorArray[2]);

  // Curated color palette mapping closest Euclidean distance in RGB
  const targets = [
    { name: 'Yellow', r: 250, g: 220, b: 80 },
    { name: 'Green',  r: 100, g: 220, b: 120 },
    { name: 'Blue',   r: 100, g: 200, b: 250 },
    { name: 'Pink',   r: 250, g: 120, b: 180 },
    { name: 'Orange', r: 250, g: 160, b: 80 },
    { name: 'Purple', r: 180, g: 140, b: 250 },
  ];

  let closest = targets[0];
  let minDistance = Infinity;

  for (const t of targets) {
    const dist = Math.sqrt(
      Math.pow(r - t.r, 2) +
      Math.pow(g - t.g, 2) +
      Math.pow(b - t.b, 2)
    );
    if (dist < minDistance) {
      minDistance = dist;
      closest = t;
    }
  }

  return closest.name;
}

/**
 * Polyfill DOMMatrix for Node.js / Vercel serverless environments.
 * pdfjs-dist internally references DOMMatrix which only exists in browsers.
 */
function ensureDOMMatrixPolyfill() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // Minimal stub — pdfjs uses it for coordinate transforms but we only
    // need annotation metadata, not rendering, so a no-op is fine.
    (globalThis as any).DOMMatrix = class DOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      m11 = 1; m12 = 0; m13 = 0; m14 = 0;
      m21 = 0; m22 = 1; m23 = 0; m24 = 0;
      m31 = 0; m32 = 0; m33 = 1; m34 = 0;
      m41 = 0; m42 = 0; m43 = 0; m44 = 1;
      is2D = true; isIdentity = true;

      constructor(init?: any) {
        if (Array.isArray(init) && init.length === 6) {
          [this.a, this.b, this.c, this.d, this.e, this.f] = init;
          this.m11 = this.a; this.m12 = this.b;
          this.m21 = this.c; this.m22 = this.d;
          this.m41 = this.e; this.m42 = this.f;
        }
      }

      inverse() { return new DOMMatrix(); }
      multiply() { return new DOMMatrix(); }
      translate() { return new DOMMatrix(); }
      scale() { return new DOMMatrix(); }
      rotate() { return new DOMMatrix(); }
      transformPoint(p: any) { return p || { x: 0, y: 0, z: 0, w: 1 }; }
      static fromMatrix() { return new DOMMatrix(); }
      static fromFloat32Array() { return new DOMMatrix(); }
      static fromFloat64Array() { return new DOMMatrix(); }
    };
  }

  // Also stub Path2D if missing (pdfjs may reference it)
  if (typeof globalThis.Path2D === 'undefined') {
    (globalThis as any).Path2D = class Path2D {
      constructor(_d?: string | Path2D) {}
      addPath() {}
      closePath() {}
      moveTo() {}
      lineTo() {}
      bezierCurveTo() {}
      quadraticCurveTo() {}
      arc() {}
      arcTo() {}
      ellipse() {}
      rect() {}
    };
  }
}

async function ensurePdfWorker() {
  if ((globalThis as any).pdfjsWorker?.WorkerMessageHandler) {
    return;
  }

  const workerModule = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as any).pdfjsWorker = workerModule;
}

/**
 * Extract annotations from a PDF buffer using pdf.js
 * Returns a flat list of ExtractedAnnotation ready for DB insert.
 */
export async function extractAnnotations(
  buffer: ArrayBuffer,
  pdfName: string,
  pdfUrl: string = ''
): Promise<ExtractedAnnotation[]> {
  // Polyfill browser globals before importing pdfjs-dist
  ensureDOMMatrixPolyfill();

  // Dynamic import — pdf.js is an ESM package
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs').catch(async () => {
    return await import('pdfjs-dist');
  });

  const pdfjs = (pdfjsLib as any).default ?? pdfjsLib;

  await ensurePdfWorker();

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;

  const results: ExtractedAnnotation[] = [];
  const numPages = doc.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const annotations = await page.getAnnotations({ intent: 'display' });

    for (const annot of annotations) {
      const subtypeName = getAnnotTypeName(annot.subtype);

      if (SKIP_TYPES.has(subtypeName)) continue;

      // Coordinates: [x0, y0, x1, y1] — pdf.js gives rect as [x0, y0, x1, y1]
      let coordsStr = '';
      if (annot.rect && Array.isArray(annot.rect) && annot.rect.length === 4) {
        const [x0, y0, x1, y1] = annot.rect.map((v: number) => Math.round(v * 10) / 10);
        coordsStr = `[${x0}, ${y0}, ${x1}, ${y1}]`;
      }

      // Comment text (contents field)
      let commentText = (annot.contents ?? '').trim();
      if (!commentText) {
        commentText = `[${subtypeName} Markup - No comment text]`;
      }

      // Author
      let author = (annot.title ?? '').trim();
      if (!author) author = 'Unknown Reviewer';

      // Dates
      let createdDate = parsePdfDate(annot.creationDate ?? '');
      let modifiedDate = parsePdfDate(annot.modificationDate ?? '');
      if (!createdDate) createdDate = modifiedDate || nowFormatted();
      if (!modifiedDate) modifiedDate = createdDate;

      // Selected text — extract from highlighted/underlined regions
      let selectedText = '';
      if (TEXT_EXTRACT_TYPES.has(subtypeName) && annot.chars) {
        try {
          selectedText = annot.chars.map((c: { unicode: string }) => c.unicode).join('').trim();
        } catch {
          // not available
        }
      }

      // If pdf.js provides quadPoints (highlight quads), get text from content
      if (TEXT_EXTRACT_TYPES.has(subtypeName) && !selectedText && annot.rect) {
        try {
          const textContent = await page.getTextContent();
          const viewport = page.getViewport({ scale: 1 });
          const [, , , pageHeight] = [0, 0, viewport.width, viewport.height];
          const [ax0, ay0, ax1, ay1] = annot.rect;
          // PDF coordinate system: y=0 is bottom; text items use the same coords
          const words: string[] = [];
          for (const item of textContent.items as Array<{ str: string; transform: number[] }>) {
            if (!item.transform) continue;
            const tx = item.transform[4];
            const ty = item.transform[5];
            if (tx >= Math.min(ax0, ax1) - 2 &&
                tx <= Math.max(ax0, ax1) + 2 &&
                ty >= Math.min(ay0, ay1) - 5 &&
                ty <= Math.max(ay0, ay1) + 5) {
              words.push(item.str);
            }
          }
          selectedText = words.join(' ').trim();
          void pageHeight; // suppress unused warning
        } catch {
          // best-effort
        }
      }

      results.push({
        pdf_name: pdfName,
        pdf_url: pdfUrl,
        page_number: pageNum,
        annotation_type: subtypeName,
        comment_text: commentText,
        author,
        created_date: createdDate,
        modified_date: modifiedDate,
        rectangle_coordinates: coordsStr,
        selected_text: selectedText,
        assigned_to: 'Unassigned',
        priority: 'Medium',
        status: 'Pending',
        remarks: '',
        color: getAnnotationColor(annot.color),
      });
    }
  }

  return results;
}
