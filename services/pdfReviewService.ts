/**
 * Main orchestrator for PDF Review extraction pipeline.
 */

import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { computePageImageHash } from '@/lib/pdf-review-pipeline';
import type {
  AccuracyReport,
  DigitalExtractedNote,
  NoteSource,
  NoteStatus,
  PdfExtractionType,
  PdfNoteType,
  PdfReviewDocumentResponse,
  PdfReviewNoteResponse,
  PipelineNote,
} from '@/lib/pdf-review-types';
import { copyPdfBytes } from '@/lib/pdf-buffer-utils';
import { extractDigitalAnnotations } from '@/services/pdfAnnotationExtractor';
import { convertPdfToPageImages } from '@/services/pdfToImageService';
import { isCloudinaryConfigured, uploadPageImage, uploadPdfBuffer } from '@/services/cloudinaryService';
import { extractNotesFromAllPages, isVisionConfigured } from '@/services/visionExtractorService';

function fileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 40);
}

type NoteToCreate = ReturnType<typeof mapPipelineNoteToSave> & {
  author?: string | null;
  subject?: string | null;
};

function mapDigitalNoteToSave(note: DigitalExtractedNote): NoteToCreate {
  return {
    page_id: null,
    page_number: note.pageNumber,
    note_type: note.noteType,
    extracted_text: note.extractedText,
    summary: note.summary ?? note.extractedText.slice(0, 120),
    x: note.position.x,
    y: note.position.y,
    width: note.position.width,
    height: note.position.height,
    confidence: note.confidence,
    status: 'accepted',
    is_meaningful_review_note: true,
    source: 'digital',
    author: note.author ?? null,
    subject: note.subject ?? null,
    raw_data: (note.rawData ?? {}) as Prisma.InputJsonValue,
  };
}

function mapPipelineNoteToSave(note: PipelineNote, pageId?: number) {
  return {
    page_id: pageId ?? null,
    page_number: note.pageNumber,
    note_type: note.noteType,
    extracted_text: note.extractedText,
    summary: note.summary ?? note.extractedText.slice(0, 120),
    x: note.position.x,
    y: note.position.y,
    width: note.position.width,
    height: note.position.height,
    confidence: note.confidence,
    status: note.status,
    is_meaningful_review_note: note.isMeaningfulReviewNote,
    source: note.source,
    raw_data: {
      reason: note.reason,
      duplicateGroupId: note.duplicateGroupId,
    } as Prisma.InputJsonValue,
  };
}

export async function createDocumentFromUpload(
  buffer: Buffer,
  fileName: string
): Promise<{ documentId: number; cloudinaryUrl: string | null }> {
  const hash = fileHash(buffer);
  let cloudinaryPublicId: string | null = null;
  let cloudinaryUrl: string | null = null;

  if (isCloudinaryConfigured()) {
    const uploaded = await uploadPdfBuffer(buffer, fileName);
    cloudinaryPublicId = uploaded.publicId;
    cloudinaryUrl = uploaded.url;
  }

  const doc = await prisma.pdfDocument.create({
    data: {
      original_file_name: fileName,
      cloudinary_public_id: cloudinaryPublicId,
      cloudinary_url: cloudinaryUrl,
      file_hash: hash,
      status: 'uploaded',
      extraction_type: 'none',
    },
  });

  return { documentId: doc.id, cloudinaryUrl };
}

async function tryReuseCachedExtraction(
  fileHashValue: string,
  documentId: number
): Promise<boolean> {
  const prior = await prisma.pdfDocument.findFirst({
    where: {
      file_hash: fileHashValue,
      status: 'completed',
      id: { not: documentId },
    },
    include: { notes: true, pages: true },
    orderBy: { updated_at: 'desc' },
  });

  if (!prior || prior.notes.length === 0) return false;

  console.log(`[pdfReviewService] Reusing cached extraction from doc ${prior.id}`);

  for (const page of prior.pages) {
    await prisma.pdfPage.create({
      data: {
        document_id: documentId,
        page_number: page.page_number,
        cloudinary_public_id: page.cloudinary_public_id,
        image_url: page.image_url,
        enhanced_image_url: page.enhanced_image_url,
        image_hash: page.image_hash,
        width: page.width,
        height: page.height,
      },
    });
  }

  for (const note of prior.notes) {
    const page = await prisma.pdfPage.findUnique({
      where: {
        document_id_page_number: {
          document_id: documentId,
          page_number: note.page_number,
        },
      },
    });
    await prisma.pdfExtractedNote.create({
      data: {
        document_id: documentId,
        page_id: page?.id ?? null,
        page_number: note.page_number,
        note_type: note.note_type,
        extracted_text: note.extracted_text,
        corrected_text: note.corrected_text,
        summary: note.summary,
        x: note.x,
        y: note.y,
        width: note.width,
        height: note.height,
        confidence: note.confidence,
        status: note.status,
        is_meaningful_review_note: note.is_meaningful_review_note,
        source: note.source,
        author: note.author,
        subject: note.subject,
        is_manual: note.is_manual,
        verified_by_user: note.verified_by_user,
        raw_data: note.raw_data ?? undefined,
        correction_history: note.correction_history ?? undefined,
      },
    });
  }

  await prisma.pdfDocument.update({
    where: { id: documentId },
    data: {
      status: 'completed',
      extraction_type: prior.extraction_type,
      total_pages: prior.total_pages,
    },
  });

  return true;
}

export async function runExtraction(
  documentId: number,
  pdfBuffer: Buffer
): Promise<PdfReviewDocumentResponse> {
  const doc = await prisma.pdfDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error(`Document ${documentId} not found`);

  const hash = fileHash(pdfBuffer);

  await prisma.pdfDocument.update({
    where: { id: documentId },
    data: { status: 'processing', error_message: null, file_hash: hash },
  });

  try {
    if (process.env.PDF_REVIEW_SKIP_CACHE !== 'true') {
      const reused = await tryReuseCachedExtraction(hash, documentId);
      if (reused) return getDocumentResponse(documentId);
    }

    await prisma.pdfExtractedNote.deleteMany({ where: { document_id: documentId } });
    await prisma.pdfPage.deleteMany({ where: { document_id: documentId } });

    const digitalPdfBytes = copyPdfBytes(pdfBuffer);
    const { notes: digitalNotes, totalPages } = await extractDigitalAnnotations(digitalPdfBytes);

    let extractionType: PdfExtractionType = digitalNotes.length > 0 ? 'digital' : 'none';
    const notesToCreate: NoteToCreate[] = [];

    for (const dn of digitalNotes) {
      notesToCreate.push(mapDigitalNoteToSave(dn));
    }

    const needsImageExtraction =
      digitalNotes.length === 0 || process.env.PDF_REVIEW_FORCE_VISION === 'true';

    let duplicateRemovedTotal = 0;

    if (needsImageExtraction) {
      if (!isVisionConfigured()) {
        throw new Error(
          'Image-based PDF requires vision API. Set GEMINI_API_KEY or OPENAI_API_KEY and VISION_PROVIDER.'
        );
      }

      console.log(`[pdfReviewService] Two-pass vision extraction for doc ${documentId}`);
      const imagePdfBytes = copyPdfBytes(pdfBuffer);
      const pageImages = await convertPdfToPageImages(imagePdfBytes);

      await prisma.pdfDocument.update({
        where: { id: documentId },
        data: { total_pages: pageImages.length || totalPages },
      });

      const pageRecords: Array<{ id: number; page_number: number }> = [];

      for (const pageImg of pageImages) {
        const imgHash = computePageImageHash(pageImg.buffer);
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
            image_hash: imgHash,
            width: pageImg.width,
            height: pageImg.height,
          },
        });
        pageRecords.push({ id: pageRecord.id, page_number: pageRecord.page_number });
      }

      const { byPage, meta, totalDuplicatesRemoved } = await extractNotesFromAllPages(
        pageImages.map((p) => ({
          pageNumber: p.pageNumber,
          buffer: p.buffer,
          width: p.width,
          height: p.height,
        }))
      );

      duplicateRemovedTotal = totalDuplicatesRemoved;

      for (const [pageNum, pipelineNotes] of byPage) {
        const pageRecord = pageRecords.find((p) => p.page_number === pageNum);
        const pageMeta = meta.get(pageNum);
        if (pageMeta?.error) {
          console.warn(`[pdfReviewService] Page ${pageNum}: ${pageMeta.error}`);
        }
        for (const note of pipelineNotes) {
          notesToCreate.push(mapPipelineNoteToSave(note, pageRecord?.id));
        }
      }

      if (digitalNotes.length > 0) {
        extractionType = byPage.size > 0 ? 'mixed' : 'digital';
      } else {
        extractionType = notesToCreate.length > 0 ? 'image_based' : 'none';
      }
    } else {
      await prisma.pdfDocument.update({
        where: { id: documentId },
        data: { total_pages: totalPages },
      });
    }

    for (const note of notesToCreate) {
      const { raw_data, ...rest } = note;
      await prisma.pdfExtractedNote.create({
        data: {
          document_id: documentId,
          ...rest,
          raw_data: raw_data ? (raw_data as Prisma.InputJsonValue) : undefined,
        },
      });
    }

    const finalType: PdfExtractionType =
      notesToCreate.length === 0 ? 'none' : extractionType;

    await prisma.pdfDocument.update({
      where: { id: documentId },
      data: {
        status: 'completed',
        extraction_type: finalType,
        error_message: null,
        extraction_meta: {
          duplicateNotesRemoved: duplicateRemovedTotal,
        } as Prisma.InputJsonValue,
      },
    });

    console.log(
      `[pdfReviewService] Doc ${documentId} done: ${notesToCreate.length} notes, ${duplicateRemovedTotal} dupes removed`
    );

    return getDocumentResponse(documentId);
  } catch (err) {
    const message = formatExtractionError(err);
    console.error(`[pdfReviewService] Extraction failed for doc ${documentId}:`, err);
    await prisma.pdfDocument.update({
      where: { id: documentId },
      data: { status: 'failed', error_message: message },
    });
    throw new Error(message);
  }
}

function formatExtractionError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('quota') || lower.includes('429')) {
    return 'AI quota exceeded. Check your Gemini/OpenAI billing and try again.';
  }
  if (lower.includes('api key') || lower.includes('gemini') || lower.includes('openai')) {
    return msg;
  }
  if (lower.includes('cloudinary')) {
    return 'Cloudinary upload failed. Check CLOUDINARY_* environment variables.';
  }
  if (lower.includes('canvas') || lower.includes('pdf')) {
    return 'PDF rendering failed. The file may be corrupted or unsupported.';
  }
  return msg;
}

export async function getDocumentResponse(
  documentId: number,
  options?: { includeIgnored?: boolean }
): Promise<PdfReviewDocumentResponse> {
  const includeIgnored = options?.includeIgnored ?? false;

  const doc = await prisma.pdfDocument.findUnique({
    where: { id: documentId },
    include: {
      pages: { orderBy: { page_number: 'asc' } },
      notes: {
        where: includeIgnored ? undefined : { status: { not: 'ignored' } },
        orderBy: [{ page_number: 'asc' }, { id: 'asc' }],
      },
    },
  });

  if (!doc) throw new Error(`Document ${documentId} not found`);

  const notes: PdfReviewNoteResponse[] = doc.notes.map((n) => ({
    id: n.id,
    pageNumber: n.page_number,
    noteType: n.note_type as PdfNoteType,
    extractedText: n.extracted_text ?? '',
    correctedText: n.corrected_text,
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
    status: n.status as NoteStatus,
    isMeaningfulReviewNote: n.is_meaningful_review_note,
    source: n.source as NoteSource,
    isManual: n.is_manual,
    verifiedByUser: n.verified_by_user,
    verifiedAt: n.verified_at?.toISOString() ?? null,
    reason:
      n.raw_data && typeof n.raw_data === 'object' && 'reason' in (n.raw_data as object)
        ? String((n.raw_data as { reason?: string }).reason ?? '')
        : null,
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

export async function getAccuracyReport(documentId: number): Promise<AccuracyReport> {
  const doc = await prisma.pdfDocument.findUnique({ where: { id: documentId } });
  const allNotes = await prisma.pdfExtractedNote.findMany({
    where: { document_id: documentId },
  });

  const visible = allNotes.filter((n) => n.status !== 'ignored');
  const verified = allNotes.filter((n) => n.verified_by_user || n.status === 'verified');
  const rejected = allNotes.filter((n) => n.status === 'rejected');
  const needsReview = allNotes.filter((n) => n.status === 'needs_review');
  const accepted = allNotes.filter((n) => n.status === 'accepted');
  const ignored = allNotes.filter((n) => n.status === 'ignored');
  const meaningful = allNotes.filter((n) => n.is_meaningful_review_note);
  const emptyText = allNotes.filter((n) => !(n.extracted_text || n.corrected_text)?.trim());

  const avgConf =
    visible.length > 0
      ? visible.reduce((s, n) => s + (n.confidence ?? 0), 0) / visible.length
      : 0;

  const meta = doc?.extraction_meta as { duplicateNotesRemoved?: number } | null;
  const duplicateRemoved = meta?.duplicateNotesRemoved ?? 0;

  const verifiedCount = verified.length;
  const totalExpected = Math.max(meaningful.length, visible.length, 1);

  let estimatedAccuracy = 0;
  if (verifiedCount > 0) {
    estimatedAccuracy = Math.round((verifiedCount / totalExpected) * 1000) / 10;
  } else {
    const penalty =
      rejected.length * 0.08 +
      emptyText.length * 0.05 +
      needsReview.length * 0.03;
    estimatedAccuracy = Math.round(Math.max(0, Math.min(98, avgConf * 100 - penalty * 100)) * 10) / 10;
  }

  return {
    totalExtractedNotes: allNotes.length,
    acceptedNotes: accepted.length,
    needsReviewNotes: needsReview.length,
    rejectedNotes: rejected.length,
    verifiedNotes: verified.length,
    ignoredNotes: ignored.length,
    duplicateNotesRemoved: duplicateRemoved,
    averageConfidence: Math.round(avgConf * 1000) / 1000,
    estimatedAccuracy,
    missingNotesCount: 0,
    falsePositiveCount: rejected.length + ignored.filter((n) => !n.is_meaningful_review_note).length,
  };
}
