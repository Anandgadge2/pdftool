import { NextRequest } from 'next/server';
import { createDocumentFromUpload } from '@/services/pdfReviewService';
import { MAX_PDF_SIZE_BYTES } from '@/lib/pdf-review-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ success: false, error: 'File must be a PDF' }, { status: 400 });
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return Response.json(
        { success: false, error: `File exceeds maximum size of ${MAX_PDF_SIZE_BYTES / (1024 * 1024)} MB` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { documentId, cloudinaryUrl } = await createDocumentFromUpload(buffer, file.name);

    console.log(`[POST /api/pdf-review/upload] Document ${documentId} created: ${file.name}`);

    return Response.json({
      success: true,
      data: {
        documentId,
        fileName: file.name,
        pdfUrl: cloudinaryUrl,
        status: 'uploaded',
      },
    });
  } catch (err) {
    console.error('[POST /api/pdf-review/upload]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
