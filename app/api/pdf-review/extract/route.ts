import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runExtraction } from '@/services/pdfReviewService';
import { MAX_PDF_SIZE_BYTES } from '@/lib/pdf-review-types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

async function loadPdfBuffer(
  documentId: number,
  file?: File | null
): Promise<Buffer> {
  if (file) {
    if (file.size > MAX_PDF_SIZE_BYTES) {
      throw new Error('PDF file exceeds maximum allowed size');
    }
    return Buffer.from(await file.arrayBuffer());
  }

  const doc = await prisma.pdfDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error('Document not found');

  if (doc.cloudinary_url) {
    const res = await fetch(doc.cloudinary_url);
    if (!res.ok) throw new Error('Failed to download PDF from Cloudinary');
    return Buffer.from(await res.arrayBuffer());
  }

  throw new Error(
    'PDF file not available. Re-upload the file with the extract request or configure Cloudinary.'
  );
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let documentId: number;
    let file: File | null = null;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      documentId = Number(formData.get('documentId'));
      file = formData.get('file') as File | null;
    } else {
      const body = await request.json();
      documentId = Number(body.documentId);
    }

    if (!documentId || Number.isNaN(documentId)) {
      return Response.json({ success: false, error: 'documentId is required' }, { status: 400 });
    }

    const existing = await prisma.pdfDocument.findUnique({ where: { id: documentId } });
    if (!existing) {
      return Response.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    if (existing.status === 'processing') {
      return Response.json({
        success: true,
        data: { documentId, status: 'processing', message: 'Extraction already in progress' },
      });
    }

    const buffer = await loadPdfBuffer(documentId, file);
    const result = await runExtraction(documentId, buffer);

    console.log(
      `[POST /api/pdf-review/extract] Document ${documentId}: ${result.totalNotes} notes (${result.extractionType})`
    );

    return Response.json({
      success: true,
      documentId: result.documentId,
      fileName: result.fileName,
      totalPages: result.totalPages,
      extractionType: result.extractionType,
      totalNotes: result.totalNotes,
      notes: result.notes,
      status: result.status,
    });
  } catch (err) {
    console.error('[POST /api/pdf-review/extract]', err);
    return Response.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
