import { NextRequest } from 'next/server';
import { getAccuracyReport } from '@/services/pdfReviewService';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId: idStr } = await params;
    const documentId = Number(idStr);
    const report = await getAccuracyReport(documentId);
    return Response.json({ success: true, ...report });
  } catch (err) {
    console.error('[GET accuracy-report]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
