import { NextRequest } from 'next/server';
import { initDb, fetchMarkups } from '@/lib/db';
import { MarkupFilters, Markup } from '@/lib/types';

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

    const markups: Markup[] = await fetchMarkups(Object.keys(filters).length ? filters : undefined);

    const csvRows: string[] = [
      [
        'ID', 'PDF Name', 'Page', 'Type', 'Comment', 'Author',
        'Created', 'Modified', 'Coordinates', 'Selected Text',
        'Assigned To', 'Priority', 'Status', 'Remarks', 'Created At',
      ].join(','),
    ];

    for (const m of markups) {
      csvRows.push([
        m.id,
        `"${(m.pdf_name ?? '').replace(/"/g, '""')}"`,
        m.page_number,
        `"${(m.annotation_type ?? '').replace(/"/g, '""')}"`,
        `"${(m.comment_text ?? '').replace(/"/g, '""')}"`,
        `"${(m.author ?? '').replace(/"/g, '""')}"`,
        `"${(m.created_date ?? '').replace(/"/g, '""')}"`,
        `"${(m.modified_date ?? '').replace(/"/g, '""')}"`,
        `"${(m.rectangle_coordinates ?? '').replace(/"/g, '""')}"`,
        `"${(m.selected_text ?? '').replace(/"/g, '""')}"`,
        `"${(m.assigned_to ?? '').replace(/"/g, '""')}"`,
        m.priority,
        m.status,
        `"${(m.remarks ?? '').replace(/"/g, '""')}"`,
        m.created_at,
      ].join(','));
    }

    const csv = csvRows.join('\r\n');
    const filename = `markups_export_${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/export/csv]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
