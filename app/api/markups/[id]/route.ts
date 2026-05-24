import { NextRequest } from 'next/server';
import { initDb, updateMarkup, deleteMarkup } from '@/lib/db';
import { MarkupUpdate } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return Response.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }
    const body: MarkupUpdate = await request.json();
    await updateMarkup(numId, body);
    return Response.json({ success: true, message: 'Updated successfully' });
  } catch (err) {
    console.error('[PATCH /api/markups/[id]]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initDb();
    const { id } = await params;
    const numId = parseInt(id, 10);
    if (isNaN(numId)) {
      return Response.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }
    await deleteMarkup(numId);
    return Response.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    console.error('[DELETE /api/markups/[id]]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
