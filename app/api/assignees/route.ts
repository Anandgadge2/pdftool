import { NextRequest } from 'next/server';
import { initDb, getAssignees, addAssignee, deleteAssignee } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await initDb();
    const assignees = await getAssignees();
    return Response.json({ success: true, data: assignees });
  } catch (err) {
    console.error('[GET /api/assignees]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDb();
    const { name } = await request.json();
    if (!name?.trim()) {
      return Response.json({ success: false, error: 'Name is required' }, { status: 400 });
    }
    const assignee = await addAssignee(name.trim());
    return Response.json({ success: true, data: assignee }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/assignees]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await initDb();
    const { id } = await request.json();
    if (!id) {
      return Response.json({ success: false, error: 'ID is required' }, { status: 400 });
    }
    await deleteAssignee(Number(id));
    return Response.json({ success: true, message: 'Assignee deleted' });
  } catch (err) {
    console.error('[DELETE /api/assignees]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
