/**
 * Main orchestrator for PDF Review extraction pipeline.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type {
  DigitalExtractedNote,
  PdfExtractionType,
  PdfNoteType,
  PdfReviewDocumentResponse,
  PdfReviewNoteResponse,
} from '@/lib/pdf-review-types';
import { copyPdfBytes } from '@/lib/pdf-buffer-utils';
import { extractDigitalAnnotations } from '@/services/pdfAnnotationExtractor';
import { convertPdfToPageImages } from '@/services/pdfToImageService';
import { isCloudinaryConfigured, uploadPageImage, uploadPdfBuffer } from '@/services/cloudinaryService';
import { extractNotesFromAllPages, isVisionConfigured } from '@/services/visionExtractorService';

function mapDigitalNoteToDb(note: DigitalExtractedNote) {
  return {
    page_number: note.pageNumber,
    note_type: note.noteType,
    extracted_text: note.extractedText,
    summary: note.summary ?? note.extractedText.slice(0, 120),
    x: note.position.x,
    y: note.position.y,
    width: note.position.width,
    height: note.position.height,
    confidence: note.confidence,
    author: note.author ?? null,
    subject: note.subject ?? null,
    raw_data: note.rawData ?? undefined,
  };
}

export async function createDocumentFromUpload(
  buffer: Buffer,
  fileName: string
): Promise<{ documentId: number; cloudinaryUrl: string | null }> {
  let cloudinaryPublicId: string | null = null;
  let cloudinaryUrl: string | null = null;

  if (isCloudinaryConfigured()) {
    const uploaded = await uploadPdfBuffer(buffer, fileName);
    cloudinaryPublicId = uploaded.publicId;
    cloudinaryUrl = uploaded.url;
  } else {
    console.warn('[pdfReviewService] Cloudinary not configured — storing metadata only');
  }

  const doc = await prisma.pdfDocument.create({
    data: {
      original_file_name: fileName,
      cloudinary_public_id: cloudinaryPublicId,
      cloudinary_url: cloudinaryUrl,
      status: 'uploaded',
      extraction_type: 'none',
    },
  });

  return { documentId: doc.id, cloudinaryUrl };
}

export async function runExtraction(
  documentId: number,
  pdfBuffer: Buffer
): Promise<PdfReviewDocumentResponse> {
  const doc = await prisma.pdfDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await prisma.pdfDocument.update({
    where: { id: documentId },
    data: { status: 'processing', error_message: null },
  });

  try {
    await prisma.pdfExtractedNote.deleteMany({ where: { document_id: documentId } });
    await prisma.pdfPage.deleteMany({ where: { document_id: documentId } });

    const digitalPdfBytes = copyPdfBytes(pdfBuffer);
    const { notes: digitalNotes, totalPages } = await extractDigitalAnnotations(digitalPdfBytes);

    let extractionType: PdfExtractionType = digitalNotes.length > 0 ? 'digital' : 'none';
    type NoteToSave = ReturnType<typeof mapDigitalNoteToDb> & { page_id?: number };
    const allNotesToSave: NoteToSave[] = [];

    if (digitalNotes.length > 0) {
      for (const note of digitalNotes) {
        allNotesToSave.push(mapDigitalNoteToDb(note));
      }
    }

    const needsImageExtraction =
      digitalNotes.length === 0 || process.env.PDF_REVIEW_FORCE_VISION === 'true';

    const pageRecords: Array<{ id: number; page_number: number }> = [];

    if (needsImageExtraction) {
      console.log(`[pdfReviewService] Running image-based extraction for doc ${documentId}`);
      const imagePdfBytes = copyPdfBytes(pdfBuffer);
      const pageImages = await convertPdfToPageImages(imagePdfBytes);

      await prisma.pdfDocument.update({
        where: { id: documentId },
        data: { total_pages: pageImages.length || totalPages },
      });

      for (const pageImg of pageImages) {
        let imageUrl: string | null = null;
        let publicId: string | null = null;

        if (isCloudinaryConfigured()) {
          const uploaded = await uploadPageImage(pageImg.buffer, documentId, pageImg.pageNumber);
          imageUrl = uploaded.url;
          publicId = uploaded.publicId;
        }

        const pageRecord = await prisma.pdfPage.create({
          data: {
            document_id: documentId,
            page_number: pageImg.pageNumber,
            cloudinary_public_id: publicId,
            image_url: imageUrl,
            width: pageImg.width,
            height: pageImg.height,
          },
        });
        pageRecords.push({ id: pageRecord.id, page_number: pageRecord.page_number });
      }

      if (!isVisionConfigured()) {
        console.warn(
          '[pdfReviewService] GEMINI_API_KEY / OPENAI_API_KEY not configured — image markup detection limited'
        );
      }

      const visionResults = await extractNotesFromAllPages(
        pageImages.map((p) => ({
          pageNumber: p.pageNumber,
          buffer: p.buffer,
          width: p.width,
          height: p.height,
        }))
      );

      for (const [pageNum, visionNotes] of visionResults) {
        const pageRecord = pageRecords.find((p) => p.page_number === pageNum);
        for (const vn of visionNotes) {
          allNotesToSave.push({
            page_number: pageNum,
            page_id: pageRecord?.id,
            note_type: vn.noteType,
            extracted_text: vn.extractedText,
            summary: vn.summary ?? vn.extractedText.slice(0, 120),
            x: vn.position.x,
            y: vn.position.y,
            width: vn.position.width,
            height: vn.position.height,
            confidence: isVisionConfigured() ? vn.confidence : Math.min(vn.confidence, 0.35),
            author: null,
            subject: null,
            raw_data: { source: 'vision', visionConfigured: isVisionConfigured() },
          });
        }
      }

      if (digitalNotes.length > 0 && visionResults.size > 0) {
        const hasVisionNotes = [...visionResults.values()].some((n) => n.length > 0);
        extractionType = hasVisionNotes ? 'mixed' : 'digital';
      } else if (digitalNotes.length === 0) {
        const hasAny = [...visionResults.values()].some((n) => n.length > 0);
        extractionType = hasAny ? 'image_based' : 'none';
      }
    } else {
      await prisma.pdfDocument.update({
        where: { id: documentId },
        data: { total_pages: totalPages },
      });
    }

    for (const note of allNotesToSave) {
      const { page_id, raw_data, ...noteData } = note as typeof note & { page_id?: number };
      await prisma.pdfExtractedNote.create({
        data: {
          document_id: documentId,
          page_id: page_id ?? null,
          ...noteData,
          raw_data: raw_data ? (raw_data as Prisma.InputJsonValue) : undefined,
        },
      });
    }

    const finalType: PdfExtractionType =
      allNotesToSave.length === 0 ? 'none' : extractionType;

    await prisma.pdfDocument.update({
      where: { id: documentId },
      data: {
        status: 'completed',
        extraction_type: finalType,
        total_pages: totalPages || (await prisma.pdfPage.count({ where: { document_id: documentId } })),
      },
    });

    return getDocumentResponse(documentId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pdfReviewService] Extraction failed for doc ${documentId}:`, err);
    await prisma.pdfDocument.update({
      where: { id: documentId },
      data: { status: 'failed', error_message: message },
    });
    throw err;
  }
}

export async function getDocumentResponse(
  documentId: number
): Promise<PdfReviewDocumentResponse> {
  const doc = await prisma.pdfDocument.findUnique({
    where: { id: documentId },
    include: {
      pages: { orderBy: { page_number: 'asc' } },
      notes: { orderBy: [{ page_number: 'asc' }, { id: 'asc' }] },
    },
  });

  if (!doc) throw new Error(`Document ${documentId} not found`);

  const notes: PdfReviewNoteResponse[] = doc.notes.map((n) => ({
    id: n.id,
    pageNumber: n.page_number,
    noteType: n.note_type as PdfNoteType,
    extractedText: n.extracted_text ?? '',
    summary: n.summary ?? '',
    author: n.author,
    subject: n.subject,
    position: {
      x: n.x ?? 0,
      y: n.y ?? 0,
      width: n.width ?? 0,
      height: n.height ?? 0,
    },
    confidence: n.confidence ?? 0,
    isManual: n.is_manual,
  }));

  return {
    success: true,
    documentId: doc.id,
    fileName: doc.original_file_name,
    totalPages: doc.total_pages,
    status: doc.status as PdfReviewDocumentResponse['status'],
    extractionType: (doc.extraction_type ?? 'none') as PdfExtractionType,
    pdfUrl: doc.cloudinary_url,
    totalNotes: notes.length,
    notes,
    pages: doc.pages.map((p) => ({
      id: p.id,
      pageNumber: p.page_number,
      imageUrl: p.image_url,
      width: p.width,
      height: p.height,
    })),
  };
}
