import { NextRequest } from 'next/server';
import { createManualNote } from '@/lib/pdf-review-db';
import type { NoteCreateInput, PdfNoteType } from '@/lib/pdf-review-types';
import { PDF_NOTE_TYPES } from '@/lib/pdf-review-types';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId: idStr } = await params;
    const documentId = Number(idStr);
    const body = (await request.json()) as NoteCreateInput;

    if (!body.pageNumber || !body.noteType || !body.extractedText) {
      return Response.json(
        { success: false, error: 'pageNumber, noteType, and extractedText are required' },
        { status: 400 }
      );
    }

    if (!PDF_NOTE_TYPES.includes(body.noteType as PdfNoteType)) {
      return Response.json({ success: false, error: 'Invalid note type' }, { status: 400 });
    }

    const note = await createManualNote(documentId, body);

    return Response.json({
      success: true,
      data: {
        id: note.id,
        pageNumber: note.page_number,
        noteType: note.note_type,
        extractedText: note.extracted_text,
        summary: note.summary,
        position: { x: note.x, y: note.y, width: note.width, height: note.height },
        confidence: note.confidence,
        isManual: note.is_manual,
      },
    });
  } catch (err) {
    console.error('[POST notes]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
