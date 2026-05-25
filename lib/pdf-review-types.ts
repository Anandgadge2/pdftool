// ============================================================
// PDF Review Notes — Types
// ============================================================

export type PdfDocumentStatus = 'uploaded' | 'processing' | 'completed' | 'failed';

export type PdfExtractionType = 'digital' | 'image_based' | 'mixed' | 'none';

export type PdfNoteType =
  | 'digital_comment'
  | 'highlight'
  | 'sticky_note'
  | 'handwritten_note'
  | 'arrow'
  | 'box'
  | 'circle'
  | 'underline'
  | 'marked_area'
  | 'scribble'
  | 'unclear';

export type NoteStatus = 'accepted' | 'needs_review' | 'ignored' | 'verified' | 'rejected';

export type NoteSource = 'digital' | 'full_page_vision' | 'crop_vision' | 'manual';

export const PDF_NOTE_TYPES: PdfNoteType[] = [
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
];

export const NOTE_STATUSES: NoteStatus[] = [
  'accepted',
  'needs_review',
  'ignored',
  'verified',
  'rejected',
];

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DigitalExtractedNote {
  pageNumber: number;
  noteType: PdfNoteType;
  extractedText: string;
  summary?: string;
  author?: string;
  subject?: string;
  position: BoundingBox;
  confidence: number;
  rawData?: Record<string, unknown>;
}

/** Raw AI note shape (pass 1 / pass 2) */
export interface RawVisionNote {
  noteType: PdfNoteType | string;
  extractedText: string;
  summary?: string;
  isMeaningfulReviewNote?: boolean;
  position: BoundingBox;
  confidence: number;
  reason?: string;
  source?: NoteSource;
  pageNumber?: number;
}

export interface PipelineNote extends RawVisionNote {
  pageNumber: number;
  status: NoteStatus;
  source: NoteSource;
  isMeaningfulReviewNote: boolean;
  duplicateGroupId?: string;
}

export interface MarkupRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  regionType: PdfNoteType | string;
  confidence: number;
}

export interface PreprocessedPageImage {
  originalBuffer: Buffer;
  enhancedBuffer: Buffer;
  width: number;
  height: number;
}

export interface PdfPageImage {
  pageNumber: number;
  buffer: Buffer;
  enhancedBuffer?: Buffer;
  width: number;
  height: number;
  mimeType: string;
  imageHash?: string;
}

export interface PdfReviewNoteResponse {
  id: number;
  pageNumber: number;
  noteType: PdfNoteType;
  extractedText: string;
  correctedText: string | null;
  summary: string;
  author?: string | null;
  subject?: string | null;
  position: BoundingBox;
  confidence: number;
  status: NoteStatus;
  isMeaningfulReviewNote: boolean;
  source: NoteSource;
  isManual: boolean;
  verifiedByUser: boolean;
  verifiedAt: string | null;
  reason?: string | null;
}

export interface PdfReviewDocumentResponse {
  success: boolean;
  documentId: number;
  fileName: string;
  totalPages: number;
  status: PdfDocumentStatus;
  extractionType: PdfExtractionType;
  pdfUrl: string | null;
  totalNotes: number;
  notes: PdfReviewNoteResponse[];
  pages: Array<{
    id: number;
    pageNumber: number;
    imageUrl: string | null;
    width: number | null;
    height: number | null;
  }>;
}

export interface AccuracyReport {
  totalExtractedNotes: number;
  acceptedNotes: number;
  needsReviewNotes: number;
  rejectedNotes: number;
  verifiedNotes: number;
  ignoredNotes: number;
  duplicateNotesRemoved: number;
  averageConfidence: number;
  estimatedAccuracy: number;
  missingNotesCount: number;
  falsePositiveCount: number;
}

export interface NoteCreateInput {
  pageNumber: number;
  noteType: PdfNoteType;
  extractedText: string;
  summary?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  confidence?: number;
}

export interface NoteUpdateInput {
  extractedText?: string;
  correctedText?: string;
  summary?: string;
  noteType?: PdfNoteType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  confidence?: number;
  status?: NoteStatus;
  verifiedByUser?: boolean;
}

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024;

export const PDF_RENDER_SCALE = Number(process.env.PDF_RENDER_SCALE) || 3;

export const MAX_CROPS_PER_PAGE = Number(process.env.MAX_CROPS_PER_PAGE) || 12;

export const CONFIDENCE_AUTO_ACCEPT = 0.8;

export const CONFIDENCE_NEEDS_REVIEW = 0.6;
