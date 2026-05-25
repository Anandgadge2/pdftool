'use client';

import React, { useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PdfReviewNoteResponse } from '@/lib/pdf-review-types';

interface PdfPagePreviewProps {
  imageUrl: string | null;
  pdfUrl: string | null;
  pageNumber: number;
  totalPages: number;
  imageWidth: number | null;
  imageHeight: number | null;
  notes: PdfReviewNoteResponse[];
  selectedNoteId: number | null;
  onPageChange: (page: number) => void;
}

export default function PdfPagePreview({
  imageUrl,
  pdfUrl,
  pageNumber,
  totalPages,
  imageWidth,
  imageHeight,
  notes,
  selectedNoteId,
  onPageChange,
}: PdfPagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageNotes = notes.filter((n) => n.pageNumber === pageNumber);

  useEffect(() => {
    if (selectedNoteId && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-note-id="${selectedNoteId}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedNoteId]);

  const scale = () => {
    if (!imageWidth || !containerRef.current) return 1;
    const containerWidth = containerRef.current.clientWidth - 24;
    return Math.min(1, containerWidth / imageWidth);
  };

  const displayScale = imageWidth ? scale() : 1;
  const displayW = imageWidth ? imageWidth * displayScale : undefined;
  const displayH = imageHeight ? imageHeight * displayScale : undefined;

  return (
    <div className="pr-card">
      <div className="pr-card-header">
        <span>Page preview</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--pr-muted)', fontWeight: 400 }}>
          Page {pageNumber} of {totalPages || 1}
        </span>
      </div>

      <div className="pr-page-nav">
        <button
          type="button"
          className="pr-btn"
          disabled={pageNumber <= 1}
          onClick={() => onPageChange(pageNumber - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <select
          className="pr-select"
          value={pageNumber}
          onChange={(e) => onPageChange(Number(e.target.value))}
          aria-label="Select page"
        >
          {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((p) => (
            <option key={p} value={p}>
              Page {p}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="pr-btn"
          disabled={pageNumber >= totalPages}
          onClick={() => onPageChange(pageNumber + 1)}
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="pr-preview-container" ref={containerRef}>
        {imageUrl ? (
          <div
            style={{
              position: 'relative',
              width: displayW,
              height: displayH,
              margin: '0 auto',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={`Page ${pageNumber}`}
              className="pr-preview-image"
              style={{ width: displayW, height: displayH }}
            />
            {pageNotes.map((note) => {
              const { x, y, width, height } = note.position;
              if (!width && !height) return null;
              return (
                <div
                  key={note.id}
                  data-note-id={note.id}
                  className={`pr-overlay-box ${selectedNoteId === note.id ? 'active' : ''}`}
                  style={{
                    left: x * displayScale,
                    top: y * displayScale,
                    width: Math.max(width * displayScale, 8),
                    height: Math.max(height * displayScale, 8),
                  }}
                  title={note.extractedText}
                />
              );
            })}
          </div>
        ) : pdfUrl ? (
          <iframe
            src={pdfUrl}
            title="PDF preview"
            style={{ width: '100%', minHeight: 480, border: 'none' }}
          />
        ) : (
          <div className="pr-empty">No page image available. Run extraction for image-based PDFs.</div>
        )}
      </div>
    </div>
  );
}
