import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { NoteCreateInput, NoteStatus, NoteUpdateInput, PdfNoteType } from '@/lib/pdf-review-types';

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
      status: 'verified',
      is_meaningful_review_note: true,
      source: 'manual',
      is_manual: true,
      verified_by_user: true,
      verified_at: new Date(),
    },
  });
}

export async function updateNote(
  noteId: number,
  input: NoteUpdateInput,
  userId = 'user'
) {
  const existing = await prisma.pdfExtractedNote.findUnique({ where: { id: noteId } });
  if (!existing) throw new Error('Note not found');

  const history = Array.isArray(existing.correction_history)
    ? (existing.correction_history as object[])
    : [];

  const entry = {
    at: new Date().toISOString(),
    by: userId,
    changes: input,
  };

  const verified = input.verifiedByUser ?? existing.verified_by_user;

  return prisma.pdfExtractedNote.update({
    where: { id: noteId },
    data: {
      ...(input.extractedText !== undefined && { extracted_text: input.extractedText }),
      ...(input.correctedText !== undefined && { corrected_text: input.correctedText }),
      ...(input.summary !== undefined && { summary: input.summary }),
      ...(input.noteType !== undefined && { note_type: input.noteType }),
      ...(input.x !== undefined && { x: input.x }),
      ...(input.y !== undefined && { y: input.y }),
      ...(input.width !== undefined && { width: input.width }),
      ...(input.height !== undefined && { height: input.height }),
      ...(input.confidence !== undefined && { confidence: input.confidence }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.verifiedByUser !== undefined && {
        verified_by_user: input.verifiedByUser,
        verified_at: input.verifiedByUser ? new Date() : existing.verified_at,
      }),
      correction_history: [...history, entry] as Prisma.InputJsonValue,
      ...(verified && input.status === undefined && { status: 'verified' as NoteStatus }),
    },
  });
}

export async function deleteNote(noteId: number) {
  return prisma.pdfExtractedNote.delete({ where: { id: noteId } });
}

export async function getNotesForExport(documentId: number, includeIgnored = false) {
  return prisma.pdfExtractedNote.findMany({
    where: {
      document_id: documentId,
      ...(includeIgnored ? {} : { status: { not: 'ignored' } }),
    },
    orderBy: [{ page_number: 'asc' }, { id: 'asc' }],
  });
}

export function noteTypeLabel(type: PdfNoteType): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
