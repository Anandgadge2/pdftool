import { NextRequest } from 'next/server';
import { initDb, fetchMarkups } from '@/lib/db';
import { MarkupFilters, Markup } from '@/lib/types';
import ExcelJS from 'exceljs';

export const dynamic = 'force-dynamic';

const STATUS_COLORS: Record<string, string> = {
  Pending:     'FFFBBF24',
  'In Progress':'FF60A5FA',
  Resolved:    'FF34D399',
  Closed:      'FF9CA3AF',
  Rejected:    'FFFB7185',
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: 'FFFB7185',
  High:     'FFFB923C',
  Medium:   'FF60A5FA',
  Low:      'FF34D399',
};

function cellColor(hex: string) {
  return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: hex } };
}

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

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PDF Markup Extractor';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Markups', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
    });

    // Define columns
    ws.columns = [
      { header: 'ID',           key: 'id',                    width: 8  },
      { header: 'PDF Name',     key: 'pdf_name',              width: 28 },
      { header: 'Page',         key: 'page_number',           width: 7  },
      { header: 'Type',         key: 'annotation_type',       width: 14 },
      { header: 'Comment',      key: 'comment_text',          width: 40 },
      { header: 'Author',       key: 'author',                width: 18 },
      { header: 'Created',      key: 'created_date',          width: 22 },
      { header: 'Modified',     key: 'modified_date',         width: 22 },
      { header: 'Coordinates',  key: 'rectangle_coordinates', width: 22 },
      { header: 'Selected Text',key: 'selected_text',         width: 30 },
      { header: 'Assigned To',  key: 'assigned_to',           width: 18 },
      { header: 'Priority',     key: 'priority',              width: 12 },
      { header: 'Status',       key: 'status',                width: 14 },
      { header: 'Remarks',      key: 'remarks',               width: 30 },
      { header: 'Created At',   key: 'created_at',            width: 22 },
    ];

    // Style header row
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = cellColor('FF111827');
      cell.font = { bold: true, color: { argb: 'FFF9FAFB' }, size: 10 };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF3B82F6' } },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    });
    headerRow.height = 28;

    // Add data rows
    for (const m of markups) {
      const row = ws.addRow({
        id: m.id,
        pdf_name: m.pdf_name,
        page_number: m.page_number,
        annotation_type: m.annotation_type,
        comment_text: m.comment_text,
        author: m.author,
        created_date: m.created_date,
        modified_date: m.modified_date,
        rectangle_coordinates: m.rectangle_coordinates,
        selected_text: m.selected_text,
        assigned_to: m.assigned_to,
        priority: m.priority,
        status: m.status,
        remarks: m.remarks,
        created_at: String(m.created_at),
      });
      row.height = 20;

      // Color the Status cell
      const statusCell = row.getCell('status');
      const statusColor = STATUS_COLORS[m.status];
      if (statusColor) {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: statusColor + '33' } };
        statusCell.font = { color: { argb: statusColor }, bold: true, size: 9 };
      }
      statusCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Color the Priority cell
      const priorityCell = row.getCell('priority');
      const priorityColor = PRIORITY_COLORS[m.priority];
      if (priorityColor) {
        priorityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: priorityColor + '33' } };
        priorityCell.font = { color: { argb: priorityColor }, bold: true, size: 9 };
      }
      priorityCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // Wrap comment text
      row.getCell('comment_text').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('selected_text').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('remarks').alignment = { wrapText: true, vertical: 'top' };
    }

    // Auto-filter on header row
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to:   { row: 1, column: ws.columns.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `markups_export_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/export/excel]', err);
    return Response.json({ success: false, error: String(err) }, { status: 500 });
  }
}
