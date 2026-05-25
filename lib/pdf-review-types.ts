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
  | 'marked_area';

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

export interface VisionExtractedNote {
  noteType: PdfNoteType;
  extractedText: string;
  summary?: string;
  position: BoundingBox;
  confidence: number;
}

export interface VisionExtractionResult {
  notes: VisionExtractedNote[];
}

export interface PdfPageImage {
  pageNumber: number;
  buffer: Buffer;
  width: number;
  height: number;
  mimeType: string;
}

export interface PdfReviewNoteResponse {
  id: number;
  pageNumber: number;
  noteType: PdfNoteType;
  extractedText: string;
  summary: string;
  author?: string | null;
  subject?: string | null;
  position: BoundingBox;
  confidence: number;
  isManual: boolean;
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
  summary?: string;
  noteType?: PdfNoteType;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  confidence?: number;
}

export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

export const PDF_RENDER_SCALE = 2;
