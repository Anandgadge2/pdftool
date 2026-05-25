import { createHash } from 'crypto';

import type {
  BoundingBox,
  NoteSource,
  NoteStatus,
  PdfNoteType,
  PipelineNote,
  RawVisionNote,
} from '@/lib/pdf-review-types';
import {
  CONFIDENCE_AUTO_ACCEPT,
  CONFIDENCE_NEEDS_REVIEW,
} from '@/lib/pdf-review-types';

const VALID_TYPES = new Set<string>([
  'digital_comment',
  'highlight',
  'sticky_note',
  'handwritten_note',
  'arrow',
  'box',
  'circle',
  'underline',
  'marked_area',
  'scribble',
  'unclear',
]);

export function normalizeNoteType(type: string): PdfNoteType {
  const t = type.toLowerCase().replace(/\s+/g, '_');
  if (VALID_TYPES.has(t)) return t as PdfNoteType;
  if (t.includes('hand')) return 'handwritten_note';
  if (t.includes('arrow')) return 'arrow';
  if (t.includes('box') || t.includes('square')) return 'box';
  if (t.includes('circle')) return 'circle';
  if (t.includes('highlight')) return 'highlight';
  if (t.includes('underline')) return 'underline';
  if (t.includes('mark')) return 'marked_area';
  if (t.includes('scribble')) return 'scribble';
  return 'unclear';
}

export function parseVisionNotesJson(content: string): RawVisionNote[] {
  let cleaned = content.trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) cleaned = fence[1].trim();
  const jsonStart = cleaned.indexOf('{');
  const jsonEnd = cleaned.lastIndexOf('}');
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    cleaned = cleaned.slice(jsonStart, jsonEnd + 1);
  }

  const parsed = JSON.parse(cleaned) as { notes?: unknown[] };
  const notes: RawVisionNote[] = [];

  if (!Array.isArray(parsed.notes)) return notes;

  for (const item of parsed.notes) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const pos = (raw.position ?? {}) as Record<string, number>;
    const meaningful = raw.isMeaningfulReviewNote !== false;
    const text = String(raw.extractedText ?? '').trim();

    notes.push({
      noteType: normalizeNoteType(String(raw.noteType ?? 'handwritten_note')),
      extractedText: text,
      summary: String(raw.summary ?? text).trim().slice(0, 200),
      isMeaningfulReviewNote: meaningful,
      position: {
        x: Number(pos.x) || 0,
        y: Number(pos.y) || 0,
        width: Math.max(0, Number(pos.width) || 0),
        height: Math.max(0, Number(pos.height) || 0),
      },
      confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.5)),
      reason: String(raw.reason ?? ''),
      source: (raw.source as NoteSource) ?? undefined,
    });
  }

  return notes;
}

export function boxArea(b: BoundingBox): number {
  return b.width * b.height;
}

export function boxIntersection(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  return (x2 - x1) * (y2 - y1);
}

export function boxOverlapRatio(a: BoundingBox, b: BoundingBox): number {
  const inter = boxIntersection(a, b);
  const union = boxArea(a) + boxArea(b) - inter;
  return union > 0 ? inter / union : 0;
}

function textSimilarity(a: string, b: string): number {
  const sa = a.toLowerCase().replace(/\s+/g, ' ').trim();
  const sb = b.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!sa && !sb) return 1;
  if (!sa || !sb) return 0;
  if (sa === sb) return 1;
  if (sa.includes(sb) || sb.includes(sa)) return 0.85;
  const wordsA = new Set(sa.split(' '));
  const wordsB = new Set(sb.split(' '));
  let overlap = 0;
  for (const w of wordsA) if (wordsB.has(w)) overlap++;
  return overlap / Math.max(wordsA.size, wordsB.size, 1);
}

export function deduplicateExtractedNotes(notes: PipelineNote[]): {
  notes: PipelineNote[];
  removedCount: number;
} {
  const sorted = [...notes].sort((a, b) => b.confidence - a.confidence);
  const kept: PipelineNote[] = [];
  let removed = 0;

  for (const note of sorted) {
    const dup = kept.find(
      (k) =>
        k.pageNumber === note.pageNumber &&
        (k.noteType === note.noteType || textSimilarity(k.extractedText, note.extractedText) > 0.7) &&
        (boxOverlapRatio(k.position, note.position) > 0.6 ||
          textSimilarity(k.extractedText, note.extractedText) > 0.9)
    );
    if (dup) {
      removed++;
      continue;
    }
    kept.push(note);
  }

  return { notes: kept, removedCount: removed };
}

export function confidenceToStatus(
  confidence: number,
  isMeaningful: boolean
): NoteStatus {
  if (!isMeaningful) return 'ignored';
  if (confidence >= CONFIDENCE_AUTO_ACCEPT) return 'accepted';
  if (confidence >= CONFIDENCE_NEEDS_REVIEW) return 'needs_review';
  return 'ignored';
}

export function rawToPipelineNotes(
  rawNotes: RawVisionNote[],
  pageNumber: number,
  source: NoteSource
): PipelineNote[] {
  return rawNotes.map((n) => {
    const meaningful = n.isMeaningfulReviewNote !== false && n.noteType !== 'scribble';
    const conf = n.confidence;
    return {
      ...n,
      noteType: normalizeNoteType(String(n.noteType)),
      pageNumber,
      source: n.source ?? source,
      isMeaningfulReviewNote: meaningful,
      status: confidenceToStatus(conf, meaningful),
    };
  });
}

export function offsetBox(box: BoundingBox, offsetX: number, offsetY: number): BoundingBox {
  return {
    x: box.x + offsetX,
    y: box.y + offsetY,
    width: box.width,
    height: box.height,
  };
}

export function mergeBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const x2 = Math.max(a.x + a.width, b.x + b.width);
  const y2 = Math.max(a.y + a.height, b.y + b.height);
  return { x, y, width: x2 - x, height: y2 - y };
}

export function computePageImageHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 32);
}
