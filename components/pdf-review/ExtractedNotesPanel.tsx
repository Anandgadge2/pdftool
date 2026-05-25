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
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import type { NoteStatus, PdfNoteType, PdfReviewNoteResponse } from '@/lib/pdf-review-types';
import { PDF_NOTE_TYPES, NOTE_STATUSES } from '@/lib/pdf-review-types';

const NOTES_PER_PAGE = 8;

interface ExtractedNotesPanelProps {
  documentId: number | null;
  notes: PdfReviewNoteResponse[];
  totalPages: number;
  selectedNoteId: number | null;
  statusFilters: Set<NoteStatus>;
  onStatusFiltersChange: (filters: Set<NoteStatus>) => void;
  onSelectNote: (id: number) => void;
  onEditNote: (note: PdfReviewNoteResponse) => void;
  onDeleteNote: (id: number) => void;
  onVerifyNote: (id: number) => void;
  onRejectNote: (id: number) => void;
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
  statusFilters,
  onStatusFiltersChange,
  onSelectNote,
  onEditNote,
  onDeleteNote,
  onVerifyNote,
  onRejectNote,
  onAddNote,
  filterPage,
  onFilterPageChange,
}: ExtractedNotesPanelProps) {
  const [typeFilter, setTypeFilter] = useState<PdfNoteType | 'all'>('all');
  const [listPage, setListPage] = useState(1);

  const toggleStatus = (s: NoteStatus) => {
    const next = new Set(statusFilters);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    if (next.size === 0) NOTE_STATUSES.forEach((x) => next.add(x));
    onStatusFiltersChange(next);
  };

  const filtered = useMemo(() => {
    return notes.filter((n) => {
      if (!statusFilters.has(n.status)) return false;
      if (filterPage !== 'all' && n.pageNumber !== filterPage) return false;
      if (typeFilter !== 'all' && n.noteType !== typeFilter) return false;
      return true;
    });
  }, [notes, filterPage, typeFilter, statusFilters]);

  const totalListPages = Math.max(1, Math.ceil(filtered.length / NOTES_PER_PAGE));
  const paginated = filtered.slice((listPage - 1) * NOTES_PER_PAGE, listPage * NOTES_PER_PAGE);

  React.useEffect(() => setListPage(1), [filterPage, typeFilter, statusFilters]);

  const exportUrl = (format: 'json' | 'csv') =>
    documentId ? `/api/pdf-review/${documentId}/export/${format}` : '#';

  return (
    <div className="pr-card pr-notes-panel-mobile pr-notes-panel">
      <div className="pr-card-header">
        <span>Notes ({filtered.length}/{notes.length})</span>
        <div className="pr-header-actions">
          <a href={exportUrl('json')} className="pr-btn pr-btn-icon-only" download title="JSON">
            <FileJson size={14} />
          </a>
          <a href={exportUrl('csv')} className="pr-btn pr-btn-icon-only" download title="CSV">
            <Download size={14} />
          </a>
        </div>
      </div>

      <div className="pr-status-toggles">
        {NOTE_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            className={`pr-status-chip pr-status-${s} ${statusFilters.has(s) ? 'on' : ''}`}
            onClick={() => toggleStatus(s)}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      <div className="pr-filters">
        <select className="pr-select" value={filterPage === 'all' ? 'all' : String(filterPage)} onChange={(e) => onFilterPageChange(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
          <option value="all">All pages</option>
          {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((p) => (
            <option key={p} value={p}>Page {p}</option>
          ))}
        </select>
        <select className="pr-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as PdfNoteType | 'all')}>
          <option value="all">All types</option>
          {PDF_NOTE_TYPES.map((t) => (
            <option key={t} value={t}>{formatNoteType(t)}</option>
          ))}
        </select>
        <button type="button" className="pr-btn pr-btn-primary" onClick={onAddNote}>
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="pr-notes-list">
        {filtered.length === 0 ? (
          <div className="pr-empty">
            <p>No notes match filters.</p>
            <p style={{ fontSize: '0.8125rem' }}>Enable more status toggles or re-run extraction.</p>
          </div>
        ) : (
          paginated.map((note) => (
            <div
              key={note.id}
              className={`pr-note-item pr-note-${note.status} ${selectedNoteId === note.id ? 'selected' : ''}`}
              onClick={() => onSelectNote(note.id)}
              onKeyDown={(e) => e.key === 'Enter' && onSelectNote(note.id)}
              role="button"
              tabIndex={0}
            >
              <div className="pr-note-top">
                <span className="pr-note-type">{formatNoteType(note.noteType)} · P{note.pageNumber}</span>
                <span className={`pr-confidence ${(note.confidence ?? 0) < 0.6 ? 'low' : ''}`}>
                  {Math.round((note.confidence ?? 0) * 100)}%
                </span>
              </div>
              <span className={`pr-status-pill pr-status-${note.status}`}>{note.status}</span>
              <p className="pr-note-text">{note.correctedText || note.extractedText || '(empty)'}</p>
              {note.summary && note.summary !== note.extractedText && (
                <p className="pr-note-summary">{note.summary}</p>
              )}
              <div className="pr-note-actions" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="pr-btn" onClick={() => onVerifyNote(note.id)} title="Verify">
                  <CheckCircle2 size={12} />
                </button>
                <button type="button" className="pr-btn" onClick={() => onEditNote(note)}>
                  <Pencil size={12} />
                </button>
                <button type="button" className="pr-btn pr-btn-danger" onClick={() => onRejectNote(note.id)} title="Reject">
                  <XCircle size={12} />
                </button>
                <button type="button" className="pr-btn pr-btn-danger" onClick={() => onDeleteNote(note.id)}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {filtered.length > NOTES_PER_PAGE && (
        <div className="pr-pagination">
          <button type="button" className="pr-btn" disabled={listPage <= 1} onClick={() => setListPage((p) => p - 1)}>
            <ChevronLeft size={14} />
          </button>
          <span>{listPage} / {totalListPages}</span>
          <button type="button" className="pr-btn" disabled={listPage >= totalListPages} onClick={() => setListPage((p) => p + 1)}>
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
