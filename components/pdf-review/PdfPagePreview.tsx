'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import type { NoteStatus, PdfReviewNoteResponse } from '@/lib/pdf-review-types';

const STATUS_COLORS: Record<NoteStatus, string> = {
  accepted: '#2563eb',
  needs_review: '#d97706',
  ignored: '#94a3b8',
  verified: '#059669',
  rejected: '#dc2626',
};

interface PdfPagePreviewProps {
  imageUrl: string | null;
  pdfUrl: string | null;
  pageNumber: number;
  totalPages: number;
  imageWidth: number | null;
  imageHeight: number | null;
  notes: PdfReviewNoteResponse[];
  selectedNoteId: number | null;
  statusFilter: Set<NoteStatus> | 'all';
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
  statusFilter,
  onPageChange,
}: PdfPagePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);

  const pageNotes = notes.filter((n) => {
    if (n.pageNumber !== pageNumber) return false;
    if (statusFilter === 'all') return true;
    return statusFilter.has(n.status);
  });

  const baseScale = useCallback(() => {
    if (!imageWidth || !containerRef.current) return 1;
    const cw = containerRef.current.clientWidth - 16;
    return Math.min(1, cw / imageWidth);
  }, [imageWidth]);

  const displayScale = imageWidth ? (fitWidth ? baseScale() : 1) * zoom : 1;
  const displayW = imageWidth ? imageWidth * displayScale : undefined;
  const displayH = imageHeight ? imageHeight * displayScale : undefined;

  useEffect(() => {
    if (selectedNoteId && containerRef.current) {
      const el = containerRef.current.querySelector(`[data-note-id="${selectedNoteId}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth', inline: 'nearest' });
    }
  }, [selectedNoteId, displayScale]);

  return (
    <div className="pr-card">
      <div className="pr-card-header">
        <span>Page preview</span>
        <span className="pr-preview-meta">
          Page {pageNumber} / {totalPages || 1} · {Math.round(zoom * 100)}%
        </span>
      </div>

      <div className="pr-page-nav">
        <button type="button" className="pr-btn" disabled={pageNumber <= 1} onClick={() => onPageChange(pageNumber - 1)}>
          <ChevronLeft size={16} />
        </button>
        <select className="pr-select" value={pageNumber} onChange={(e) => onPageChange(Number(e.target.value))}>
          {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((p) => (
            <option key={p} value={p}>Page {p}</option>
          ))}
        </select>
        <button type="button" className="pr-btn" disabled={pageNumber >= totalPages} onClick={() => onPageChange(pageNumber + 1)}>
          <ChevronRight size={16} />
        </button>
        <div className="pr-zoom-controls">
          <button type="button" className="pr-btn" onClick={() => { setFitWidth(false); setZoom((z) => Math.max(0.5, z - 0.15)); }} title="Zoom out">
            <ZoomOut size={14} />
          </button>
          <button type="button" className="pr-btn" onClick={() => { setFitWidth(false); setZoom((z) => Math.min(2.5, z + 0.15)); }} title="Zoom in">
            <ZoomIn size={14} />
          </button>
          <button type="button" className="pr-btn" onClick={() => { setFitWidth(true); setZoom(1); }} title="Fit width">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="pr-preview-container" ref={containerRef}>
        {imageUrl ? (
          <div className="pr-preview-stage" style={{ width: displayW, height: displayH }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt={`Page ${pageNumber}`} className="pr-preview-image" style={{ width: displayW, height: displayH }} />
            {pageNotes.map((note) => {
              const { x, y, width, height } = note.position;
              if (!width && !height) return null;
              const color = STATUS_COLORS[note.status] ?? '#2563eb';
              return (
                <div
                  key={note.id}
                  data-note-id={note.id}
                  className={`pr-overlay-box ${selectedNoteId === note.id ? 'active' : ''}`}
                  style={{
                    left: x * displayScale,
                    top: y * displayScale,
                    width: Math.max(width * displayScale, 10),
                    height: Math.max(height * displayScale, 10),
                    borderColor: color,
                    background: `${color}22`,
                  }}
                  title={`${note.status}: ${note.correctedText || note.extractedText}`}
                >
                  <span className="pr-overlay-label">{note.noteType.replace(/_/g, ' ')}</span>
                </div>
              );
            })}
          </div>
        ) : pdfUrl ? (
          <iframe src={pdfUrl} title="PDF preview" className="pr-preview-iframe" />
        ) : (
          <div className="pr-empty">No page image. Run extraction for image-based PDFs.</div>
        )}
      </div>
    </div>
  );
}
