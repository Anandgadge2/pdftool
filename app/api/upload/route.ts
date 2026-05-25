import { NextRequest } from 'next/server';
import { initDb, insertMarkups } from '@/lib/db';
import { extractAnnotations } from '@/lib/pdf-extractor';

export const dynamic = 'force-dynamic';

// Allow larger payloads for PDF uploads (up to 50 MB)
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await initDb();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return Response.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ success: false, error: 'File must be a PDF' }, { status: 400 });
    }

    const pdfName = file.name;
    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract annotations from the PDF buffer
    const annotations = await extractAnnotations(buffer, pdfName, '');

    let count = 0;
    let isScanned = false;

    if (annotations.length === 0) {
      // PDF may be scanned/image-only — still report success with 0 annotations
      isScanned = true;
    } else {
      count = await insertMarkups(annotations);
    }

    return Response.json({
      success: true,
      data: {
        count,
        pdf_name: pdfName,
        pdf_url: '',
        is_scanned: isScanned,
      },
    });
  } catch (err) {
    console.error('[POST /api/upload]', err);
    const message = err instanceof Error ? err.message : String(err);
    const isInvalidPdf =
      message.toLowerCase().includes('invalid pdf') ||
      message.toLowerCase().includes('pdf structure') ||
      message.toLowerCase().includes('missing pdf');

    return Response.json(
      {
        success: false,
        error: isInvalidPdf
          ? 'This PDF could not be parsed. It may be corrupted, encrypted, or saved in an unsupported structure.'
          : message,
      },
      { status: isInvalidPdf ? 400 : 500 }
    );
  }
}
