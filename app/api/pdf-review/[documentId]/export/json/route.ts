import { NextRequest } from 'next/server';
import { getDocumentResponse } from '@/services/pdfReviewService';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId: idStr } = await params;
    const documentId = Number(idStr);
    const result = await getDocumentResponse(documentId);

    const exportPayload = {
      success: true,
      documentId: result.documentId,
      fileName: result.fileName,
      totalPages: result.totalPages,
      extractionType: result.extractionType,
      totalNotes: result.totalNotes,
      notes: result.notes.map((n) => ({
        pageNumber: n.pageNumber,
        noteType: n.noteType,
        extractedText: n.extractedText,
        summary: n.summary,
        author: n.author,
        subject: n.subject,
        position: n.position,
        confidence: n.confidence,
        isManual: n.isManual,
      })),
      exportedAt: new Date().toISOString(),
    };

    const filename = `${result.fileName.replace(/\.pdf$/i, '')}_review_notes.json`;

    return new Response(JSON.stringify(exportPayload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('[GET export/json]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
