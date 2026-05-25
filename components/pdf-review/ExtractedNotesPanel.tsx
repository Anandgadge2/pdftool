'use client';

import React, { useMemo, useState } from 'react';
import {
  Download,
  FileJson,
  Pencil,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { PdfNoteType, PdfReviewNoteResponse } from '@/lib/pdf-review-types';
import { PDF_NOTE_TYPES } from '@/lib/pdf-review-types';

const NOTES_PER_PAGE = 8;

interface ExtractedNotesPanelProps {
  documentId: number | null;
  notes: PdfReviewNoteResponse[];
  totalPages: number;
  selectedNoteId: number | null;
  onSelectNote: (id: number) => void;
  onEditNote: (note: PdfReviewNoteResponse) => void;
  onDeleteNote: (id: number) => void;
  onAddNote: () => void;
  filterPage: number | 'all';
  onFilterPageChange: (page: number | 'all') => void;
}

function formatNoteType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ExtractedNotesPanel({
  documentId,
  notes,
  totalPages,
  selectedNoteId,
  onSelectNote,
  onEditNote,
  onDeleteNote,
  onAddNote,
  filterPage,
  onFilterPageChange,
}: ExtractedNotesPanelProps) {
  const [typeFilter, setTypeFilter] = useState<PdfNoteType | 'all'>('all');
  const [listPage, setListPage] = useState(1);

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (filterPage !== 'all' && n.pageNumber !== filterPage) return false;
      if (typeFilter !== 'all' && n.noteType !== typeFilter) return false;
      return true;
    });
  }, [notes, filterPage, typeFilter]);

  const totalListPages = Math.max(1, Math.ceil(filtered.length / NOTES_PER_PAGE));
  const paginated = filtered.slice(
    (listPage - 1) * NOTES_PER_PAGE,
    listPage * NOTES_PER_PAGE
  );

  React.useEffect(() => {
    setListPage(1);
  }, [filterPage, typeFilter]);

  const exportUrl = (format: 'json' | 'csv') =>
    documentId ? `/api/pdf-review/${documentId}/export/${format}` : '#';

  return (
    <div className="pr-card pr-notes-panel-mobile" style={{ display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 120px)' }}>
      <div className="pr-card-header">
        <span>Extracted notes ({notes.length})</span>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <a
            href={exportUrl('json')}
            className="pr-btn"
            style={{ padding: '0.35rem 0.5rem' }}
            download
            title="Download JSON"
          >
            <FileJson size={14} />
          </a>
          <a
            href={exportUrl('csv')}
            className="pr-btn"
            style={{ padding: '0.35rem 0.5rem' }}
            download
            title="Download CSV"
          >
            <Download size={14} />
          </a>
        </div>
      </div>

      <div className="pr-filters">
        <select
          className="pr-select"
          value={filterPage === 'all' ? 'all' : String(filterPage)}
          onChange={(e) =>
            onFilterPageChange(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
          aria-label="Filter by page"
        >
          <option value="all">All pages</option>
          {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((p) => (
            <option key={p} value={p}>
              Page {p}
            </option>
          ))}
        </select>
        <select
          className="pr-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as PdfNoteType | 'all')}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          {PDF_NOTE_TYPES.map((t) => (
            <option key={t} value={t}>
              {formatNoteType(t)}
            </option>
          ))}
        </select>
        <button type="button" className="pr-btn pr-btn-primary" onClick={onAddNote} style={{ marginLeft: 'auto' }}>
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="pr-notes-list" style={{ flex: 1 }}>
        {filtered.length === 0 ? (
          <div className="pr-empty">
            <p>No notes found.</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '0.5rem' }}>
              Upload a PDF and run extraction, or add a note manually.
            </p>
          </div>
        ) : (
          paginated.map((note) => (
            <div
              key={note.id}
              className={`pr-note-item ${selectedNoteId === note.id ? 'selected' : ''}`}
              onClick={() => onSelectNote(note.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectNote(note.id)}
              role="button"
              tabIndex={0}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                <span className="pr-note-type">
                  {formatNoteType(note.noteType)} · P{note.pageNumber}
                </span>
                <span className={`pr-confidence ${(note.confidence ?? 0) < 0.5 ? 'low' : ''}`}>
                  {Math.round((note.confidence ?? 0) * 100)}%
                </span>
              </div>
              <p style={{ margin: '0.35rem 0', fontSize: '0.875rem', lineHeight: 1.4 }}>
                {note.extractedText || '(empty)'}
              </p>
              {note.summary && note.summary !== note.extractedText && (
                <p style={{ fontSize: '0.75rem', color: 'var(--pr-muted)', margin: 0 }}>
                  {note.summary}
                </p>
              )}
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
                <button type="button" className="pr-btn" style={{ padding: '0.25rem 0.5rem' }} onClick={() => onEditNote(note)}>
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  className="pr-btn pr-btn-danger"
                  style={{ padding: '0.25rem 0.5rem' }}
                  onClick={() => onDeleteNote(note.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {filtered.length > NOTES_PER_PAGE && (
        <div className="pr-pagination">
          <button
            type="button"
            className="pr-btn"
            disabled={listPage <= 1}
            onClick={() => setListPage((p) => p - 1)}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontSize: '0.8125rem' }}>
            {listPage} / {totalListPages}
          </span>
          <button
            type="button"
            className="pr-btn"
            disabled={listPage >= totalListPages}
            onClick={() => setListPage((p) => p + 1)}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
