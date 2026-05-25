import { NextRequest } from 'next/server';
import { deleteNote, updateNote } from '@/lib/pdf-review-db';
import type { NoteUpdateInput } from '@/lib/pdf-review-types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId: idStr } = await params;
    const noteId = Number(idStr);
    const body = (await request.json()) as NoteUpdateInput;

    const note = await updateNote(noteId, body);

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
      },
    });
  } catch (err) {
    console.error('[PATCH note]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId: idStr } = await params;
    const noteId = Number(idStr);
    await deleteNote(noteId);
    return Response.json({ success: true });
  } catch (err) {
    console.error('[DELETE note]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
