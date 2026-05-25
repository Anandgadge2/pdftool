import { prisma } from '@/lib/prisma';
import type { NoteCreateInput, NoteUpdateInput, PdfNoteType } from '@/lib/pdf-review-types';

export async function createManualNote(documentId: number, input: NoteCreateInput) {
  let pageId: number | null = null;
  const page = await prisma.pdfPage.findUnique({
    where: {
      document_id_page_number: {
        document_id: documentId,
        page_number: input.pageNumber,
      },
    },
  });
  if (page) pageId = page.id;

  return prisma.pdfExtractedNote.create({
    data: {
      document_id: documentId,
      page_id: pageId,
      page_number: input.pageNumber,
      note_type: input.noteType,
      extracted_text: input.extractedText,
      summary: input.summary ?? input.extractedText.slice(0, 120),
      x: input.x ?? 0,
      y: input.y ?? 0,
      width: input.width ?? 100,
      height: input.height ?? 40,
      confidence: input.confidence ?? 1,
      is_manual: true,
    },
  });
}

export async function updateNote(noteId: number, input: NoteUpdateInput) {
  return prisma.pdfExtractedNote.update({
    where: { id: noteId },
    data: {
      ...(input.extractedText !== undefined && { extracted_text: input.extractedText }),
      ...(input.summary !== undefined && { summary: input.summary }),
      ...(input.noteType !== undefined && { note_type: input.noteType }),
      ...(input.x !== undefined && { x: input.x }),
      ...(input.y !== undefined && { y: input.y }),
      ...(input.width !== undefined && { width: input.width }),
      ...(input.height !== undefined && { height: input.height }),
      ...(input.confidence !== undefined && { confidence: input.confidence }),
    },
  });
}

export async function deleteNote(noteId: number) {
  return prisma.pdfExtractedNote.delete({ where: { id: noteId } });
}

export async function getNotesForExport(documentId: number) {
  return prisma.pdfExtractedNote.findMany({
    where: { document_id: documentId },
    orderBy: [{ page_number: 'asc' }, { id: 'asc' }],
  });
}

export function noteTypeLabel(type: PdfNoteType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
