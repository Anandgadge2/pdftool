import { NextRequest } from 'next/server';
import { initDb, fetchMarkups, insertMarkups } from '@/lib/db';
import { MarkupFilters } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await initDb();
    const sp = request.nextUrl.searchParams;

    const filters: MarkupFilters = {};
    const pdfName = sp.getAll('pdf_name');
    const status = sp.getAll('status');
    const priority = sp.getAll('priority');
    const assignedTo = sp.getAll('assigned_to');
    const annotationType = sp.getAll('annotation_type');

    if (pdfName.length) filters.pdf_name = pdfName;
    if (status.length) filters.status = status as MarkupFilters['status'];
    if (priority.length) filters.priority = priority as MarkupFilters['priority'];
    if (assignedTo.length) filters.assigned_to = assignedTo;
    if (annotationType.length) filters.annotation_type = annotationType;

    const markups = await fetchMarkups(Object.keys(filters).length ? filters : undefined);
    return Response.json({ success: true, data: markups });
  } catch (err) {
    console.error('[GET /api/markups]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await initDb();
    const body = await request.json();
    const markups = Array.isArray(body) ? body : [body];
    const count = await insertMarkups(markups);
    return Response.json({ success: true, data: { count } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/markups]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
