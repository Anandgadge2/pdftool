import { NextRequest } from 'next/server';
import { getDocumentResponse } from '@/services/pdfReviewService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId: idStr } = await params;
    const documentId = Number(idStr);

    if (!documentId || Number.isNaN(documentId)) {
      return Response.json({ success: false, error: 'Invalid document ID' }, { status: 400 });
    }

    const includeIgnored = request.nextUrl.searchParams.get('includeIgnored') === 'true';
    const result = await getDocumentResponse(documentId, { includeIgnored });
    return Response.json(result);
  } catch (err) {
    console.error('[GET /api/pdf-review/:documentId]', err);
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes('not found') ? 404 : 500;
    return Response.json({ success: false, error: message }, { status });
  }
}
