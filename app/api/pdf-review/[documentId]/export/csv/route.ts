import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNotesForExport, noteTypeLabel } from '@/lib/pdf-review-db';

export const dynamic = 'force-dynamic';

function escapeCsv(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId: idStr } = await params;
    const documentId = Number(idStr);

    const doc = await prisma.pdfDocument.findUnique({ where: { id: documentId } });
    if (!doc) {
      return Response.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    const notes = await getNotesForExport(documentId);

    const header = [
      'ID',
      'Page',
      'Note Type',
      'Extracted Text',
      'Summary',
      'Author',
      'Subject',
      'X',
      'Y',
      'Width',
      'Height',
      'Confidence',
      'Manual',
    ].join(',');

    const rows = notes.map((n) =>
      [
        n.id,
        n.page_number,
        escapeCsv(noteTypeLabel(n.note_type as Parameters<typeof noteTypeLabel>[0])),
        escapeCsv(n.extracted_text),
        escapeCsv(n.summary),
        escapeCsv(n.author),
        escapeCsv(n.subject),
        n.x ?? 0,
        n.y ?? 0,
        n.width ?? 0,
        n.height ?? 0,
        n.confidence ?? 0,
        n.is_manual ? 'Yes' : 'No',
      ].join(',')
    );

    const csv = [header, ...rows].join('\r\n');
    const filename = `${doc.original_file_name.replace(/\.pdf$/i, '')}_review_notes.csv`;

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[GET export/csv]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
