'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PdfReviewUpload from '@/components/pdf-review/PdfReviewUpload';
import PdfPagePreview from '@/components/pdf-review/PdfPagePreview';
import ExtractedNotesPanel from '@/components/pdf-review/ExtractedNotesPanel';
import type {
  AccuracyReport,
  NoteStatus,
  PdfDocumentStatus,
  PdfExtractionType,
  PdfNoteType,
  PdfReviewDocumentResponse,
  PdfReviewNoteResponse,
} from '@/lib/pdf-review-types';
import { PDF_NOTE_TYPES, NOTE_STATUSES } from '@/lib/pdf-review-types';
import '@/components/pdf-review/pdf-review.css';

type FilterPage = number | 'all';

interface PdfReviewAppProps {
  /** When true, hides standalone back link (used on home page tab). */
  embedded?: boolean;
}

export default function PdfReviewApp({ embedded = false }: PdfReviewAppProps) {
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [status, setStatus] = useState<PdfDocumentStatus | null>(null);
  const [extractionType, setExtractionType] = useState<PdfExtractionType>('none');
  const [totalPages, setTotalPages] = useState(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState<PdfReviewNoteResponse[]>([]);
  const [pages, setPages] = useState<PdfReviewDocumentResponse['pages']>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterPage, setFilterPage] = useState<FilterPage>('all');
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [editModal, setEditModal] = useState<{
    mode: 'edit' | 'add';
    note?: PdfReviewNoteResponse;
  } | null>(null);
  const [editText, setEditText] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editType, setEditType] = useState<PdfNoteType>('handwritten_note');
  const [editCorrected, setEditCorrected] = useState('');
  const [editX, setEditX] = useState(0);
  const [editY, setEditY] = useState(0);
  const [editW, setEditW] = useState(100);
  const [editH, setEditH] = useState(40);
  const [statusFilters, setStatusFilters] = useState<Set<NoteStatus>>(
    () => new Set(['accepted', 'needs_review', 'verified'] as NoteStatus[])
  );
  const [accuracy, setAccuracy] = useState<AccuracyReport | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyDocument = useCallback((data: PdfReviewDocumentResponse) => {
    setDocumentId(data.documentId);
    setFileName(data.fileName);
    setStatus(data.status);
    setExtractionType(data.extractionType);
    setTotalPages(data.totalPages);
    setPdfUrl(data.pdfUrl);
    setNotes(data.notes);
    setPages(data.pages);
    setCurrentPage((prev) => {
      if (data.pages.length > 0 && prev > data.pages.length) return 1;
      return prev;
    });
  }, []);

  const fetchDocument = useCallback(async (id: number) => {
    const res = await fetch(`/api/pdf-review/${id}?includeIgnored=true`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load document');
    applyDocument(data as PdfReviewDocumentResponse);
    try {
      const accRes = await fetch(`/api/pdf-review/${id}/accuracy-report`);
      const accData = await accRes.json();
      if (accData.success) setAccuracy(accData as AccuracyReport);
    } catch {
      /* optional */
    }
    return data as PdfReviewDocumentResponse;
  }, [applyDocument]);

  const startPolling = useCallback(
    (id: number) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const data = await fetchDocument(id);
          if (data.status === 'completed' || data.status === 'failed') {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setExtracting(false);
            if (data.status === 'failed') {
              setError('Extraction failed. Check server logs.');
            }
          }
        } catch {
          /* ignore poll errors */
        }
      }, 2500);
    },
    [fetchDocument]
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const runExtraction = async (id: number, file?: File) => {
    setExtracting(true);
    setError(null);
    setStatus('processing');

    try {
      let res: Response;
      if (file) {
        const formData = new FormData();
        formData.append('documentId', String(id));
        formData.append('file', file);
        res = await fetch('/api/pdf-review/extract', { method: 'POST', body: formData });
      } else {
        res = await fetch('/api/pdf-review/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: id }),
        });
      }

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Extraction failed');
      }

      await fetchDocument(id);
      setExtracting(false);
    } catch (err) {
      setExtracting(false);
      setStatus('failed');
      setError(err instanceof Error ? err.message : 'Extraction failed');
      startPolling(id);
    }
  };

  const handleUploaded = async (id: number, name: string, file: File) => {
    setDocumentId(id);
    setFileName(name);
    setStatus('uploaded');
    setError(null);
    void runExtraction(id, file);
  };

  const handleSelectNote = (id: number) => {
    setSelectedNoteId(id);
    const note = notes.find((n) => n.id === id);
    if (note) {
      setCurrentPage(note.pageNumber);
      setFilterPage(note.pageNumber);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Delete this note?')) return;
    const res = await fetch(`/api/pdf-review/notes/${noteId}`, { method: 'DELETE' });
    const data = await res.json();
    if (!data.success) {
      setError(data.error || 'Delete failed');
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    if (selectedNoteId === noteId) setSelectedNoteId(null);
  };

  const patchNoteInState = (id: number, patch: Partial<PdfReviewNoteResponse>) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
  };

  const handleVerifyNote = async (noteId: number) => {
    const res = await fetch(`/api/pdf-review/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify' }),
    });
    const data = await res.json();
    if (data.success) patchNoteInState(noteId, { status: 'verified', verifiedByUser: true });
  };

  const handleRejectNote = async (noteId: number) => {
    const res = await fetch(`/api/pdf-review/notes/${noteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject' }),
    });
    const data = await res.json();
    if (data.success) patchNoteInState(noteId, { status: 'rejected' });
  };

  const openEditModal = (mode: 'edit' | 'add', note?: PdfReviewNoteResponse) => {
    setEditModal({ mode, note });
    setEditText(note?.extractedText ?? '');
    setEditCorrected(note?.correctedText ?? note?.extractedText ?? '');
    setEditSummary(note?.summary ?? '');
    setEditType((note?.noteType as PdfNoteType) ?? 'handwritten_note');
    setEditX(note?.position.x ?? 0);
    setEditY(note?.position.y ?? 0);
    setEditW(note?.position.width ?? 100);
    setEditH(note?.position.height ?? 40);
  };

  const saveEditModal = async () => {
    if (!documentId || !editModal) return;

    if (editModal.mode === 'edit' && editModal.note) {
      const res = await fetch(`/api/pdf-review/notes/${editModal.note.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          extractedText: editText,
          correctedText: editCorrected,
          summary: editSummary,
          noteType: editType,
          x: editX,
          y: editY,
          width: editW,
          height: editH,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      patchNoteInState(editModal.note.id, {
        extractedText: editText,
        correctedText: editCorrected,
        summary: editSummary,
        noteType: editType,
        position: { x: editX, y: editY, width: editW, height: editH },
      });
    } else {
      const res = await fetch(`/api/pdf-review/${documentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageNumber: currentPage,
          noteType: editType,
          extractedText: editText,
          summary: editSummary,
          confidence: 1,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error);
        return;
      }
      const created = data.data;
      setNotes((prev) => [
        ...prev,
        {
          id: created.id,
          pageNumber: created.pageNumber,
          noteType: created.noteType,
          extractedText: created.extractedText,
          correctedText: null,
          summary: created.summary ?? '',
          position: created.position ?? { x: 0, y: 0, width: 100, height: 40 },
          confidence: created.confidence ?? 1,
          status: 'verified',
          isMeaningfulReviewNote: true,
          source: 'manual',
          isManual: true,
          verifiedByUser: true,
          verifiedAt: new Date().toISOString(),
        },
      ]);
    }

    setEditModal(null);
  };

  const currentPageData = pages.find((p) => p.pageNumber === currentPage);

  return (
    <div className="pdf-review-page" data-theme="light">
      <header className="pdf-review-header">
        <div>
          {!embedded && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--pr-muted)', marginBottom: 4 }}>
              Open the home page and use the <strong>PDF Review</strong> tab
            </p>
          )}
          <h1>PDF Review Notes Extractor</h1>
          <p>Extract digital annotations and handwritten review markup from PDFs</p>
        </div>
        {documentId && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            {status && (
              <span className={`pr-status-badge pr-status-${status}`}>
                {extracting && <Loader2 size={12} style={{ width: 12, height: 12 }} />}
                {status}
              </span>
            )}
            {extractionType !== 'none' && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--pr-muted)' }}>
                {extractionType.replace(/_/g, ' ')} · {notes.length} notes
              </span>
            )}
            {fileName && <span className="pr-file-name">{fileName}</span>}
            {accuracy && (
              <span className="pr-accuracy-badge" title="Estimated accuracy">
                ~{accuracy.estimatedAccuracy}% accuracy
              </span>
            )}
          </div>
        )}
      </header>

      <main className="pdf-review-main">
        {!documentId && (
          <div style={{ maxWidth: 640, margin: '0 auto 1.5rem' }}>
            <PdfReviewUpload onUploaded={handleUploaded} disabled={extracting} />
          </div>
        )}

        {error && <div className="pr-error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {extracting && (
          <div className="pr-card" style={{ marginBottom: '1rem', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="pr-spinner" />
              <div>
                <strong>Processing PDF (two-pass vision)…</strong>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--pr-muted)' }}>
                  Preprocessing → region detection → full page + crop refinement. May take 1–2 min.
                </p>
              </div>
            </div>
            <div className="pr-progress-bar">
              <div className="pr-progress-fill" style={{ width: '60%' }} />
            </div>
          </div>
        )}

        {documentId && (
          <div className="pdf-review-grid">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <PdfPagePreview
                imageUrl={currentPageData?.imageUrl ?? null}
                pdfUrl={pdfUrl}
                pageNumber={currentPage}
                totalPages={totalPages || pages.length || 1}
                imageWidth={currentPageData?.width ?? null}
                imageHeight={currentPageData?.height ?? null}
                notes={notes}
                selectedNoteId={selectedNoteId}
                statusFilter={statusFilters}
                onPageChange={setCurrentPage}
              />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <a href={`/api/pdf-review/${documentId}/export/json`} className="pr-btn" download>
                  Download JSON
                </a>
                <a href={`/api/pdf-review/${documentId}/export/csv`} className="pr-btn" download>
                  Download CSV
                </a>
                <button
                  type="button"
                  className="pr-btn"
                  onClick={() => {
                    setDocumentId(null);
                    setNotes([]);
                    setPages([]);
                    setFileName('');
                    setStatus(null);
                  }}
                >
                  Upload new PDF
                </button>
              </div>
            </div>

            <ExtractedNotesPanel
              documentId={documentId}
              notes={notes}
              totalPages={totalPages || pages.length || 1}
              selectedNoteId={selectedNoteId}
              statusFilters={statusFilters}
              onStatusFiltersChange={setStatusFilters}
              onSelectNote={handleSelectNote}
              onEditNote={(n) => openEditModal('edit', n)}
              onDeleteNote={handleDeleteNote}
              onVerifyNote={handleVerifyNote}
              onRejectNote={handleRejectNote}
              onAddNote={() => openEditModal('add')}
              filterPage={filterPage}
              onFilterPageChange={setFilterPage}
            />
          </div>
        )}

        {documentId && status === 'completed' && notes.length === 0 && !extracting && (
          <div className="pr-card" style={{ marginTop: '1rem' }}>
            <div className="pr-empty">
              <p><strong>No review notes detected.</strong></p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
                Ensure <code>GEMINI_API_KEY</code> or <code>OPENAI_API_KEY</code> is set for handwritten/scanned PDFs. You can add notes manually.
              </p>
              <button
                type="button"
                className="pr-btn pr-btn-primary"
                style={{ marginTop: '1rem' }}
                onClick={() => openEditModal('add')}
              >
                Add note manually
              </button>
            </div>
          </div>
        )}
      </main>

      {editModal && (
        <div className="pr-modal-overlay" onClick={() => setEditModal(null)}>
          <div className="pr-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editModal.mode === 'edit' ? 'Edit note' : 'Add note'}</h3>
            <div className="pr-form-group">
              <label>Type</label>
              <select
                className="pr-select"
                value={editType}
                onChange={(e) => setEditType(e.target.value as PdfNoteType)}
                style={{ width: '100%' }}
              >
                {PDF_NOTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="pr-form-group">
              <label>Extracted text</label>
              <textarea
                className="pr-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
            </div>
            <div className="pr-form-group">
              <label>Corrected text (saved as verification)</label>
              <textarea className="pr-textarea" value={editCorrected} onChange={(e) => setEditCorrected(e.target.value)} />
            </div>
            <div className="pr-form-group">
              <label>Summary</label>
              <input className="pr-input" style={{ width: '100%' }} value={editSummary} onChange={(e) => setEditSummary(e.target.value)} />
            </div>
            {editModal.mode === 'edit' && (
              <div className="pr-bbox-grid">
                <div className="pr-form-group">
                  <label>X</label>
                  <input className="pr-input" type="number" value={editX} onChange={(e) => setEditX(Number(e.target.value))} />
                </div>
                <div className="pr-form-group">
                  <label>Y</label>
                  <input className="pr-input" type="number" value={editY} onChange={(e) => setEditY(Number(e.target.value))} />
                </div>
                <div className="pr-form-group">
                  <label>Width</label>
                  <input className="pr-input" type="number" value={editW} onChange={(e) => setEditW(Number(e.target.value))} />
                </div>
                <div className="pr-form-group">
                  <label>Height</label>
                  <input className="pr-input" type="number" value={editH} onChange={(e) => setEditH(Number(e.target.value))} />
                </div>
              </div>
            )}
            <div className="pr-actions-row">
              <button type="button" className="pr-btn pr-btn-primary" onClick={() => void saveEditModal()}>
                Save
              </button>
              <button type="button" className="pr-btn" onClick={() => setEditModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
