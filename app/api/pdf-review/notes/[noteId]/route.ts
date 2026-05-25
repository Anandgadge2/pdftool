import { NextRequest } from 'next/server';
import { deleteNote, updateNote } from '@/lib/pdf-review-db';
import type { NoteStatus, NoteUpdateInput } from '@/lib/pdf-review-types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ noteId: string }> }
) {
  try {
    const { noteId: idStr } = await params;
    const noteId = Number(idStr);
    const body = (await request.json()) as NoteUpdateInput & {
      action?: 'verify' | 'reject';
    };

    const input: NoteUpdateInput = { ...body };

    if (body.action === 'verify') {
      input.status = 'verified';
      input.verifiedByUser = true;
    } else if (body.action === 'reject') {
      input.status = 'rejected';
    }

    const note = await updateNote(noteId, input);

    return Response.json({
      success: true,
      data: {
        id: note.id,
        pageNumber: note.page_number,
        noteType: note.note_type,
        extractedText: note.extracted_text,
        correctedText: note.corrected_text,
        summary: note.summary,
        position: { x: note.x, y: note.y, width: note.width, height: note.height },
        confidence: note.confidence,
        status: note.status as NoteStatus,
        verifiedByUser: note.verified_by_user,
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
    await deleteNote(Number(idStr));
    return Response.json({ success: true });
  } catch (err) {
    console.error('[DELETE note]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
