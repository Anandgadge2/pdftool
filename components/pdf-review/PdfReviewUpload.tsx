'use client';

import React, { useRef, useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';

const MAX_SIZE_MB = 50;

interface PdfReviewUploadProps {
  onUploaded: (documentId: number, fileName: string, file: File) => void;
  disabled?: boolean;
}

export default function PdfReviewUpload({ onUploaded, disabled }: PdfReviewUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndUpload = async (file: File) => {
    setError(null);

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF file.');
      return;
    }

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File must be under ${MAX_SIZE_MB} MB.`);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/pdf-review/upload', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      onUploaded(data.data.documentId, data.data.fileName, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) await validateAndUpload(file);
  };

  return (
    <div className="pr-card">
      <div className="pr-card-header">
        <span>Upload PDF</span>
        {uploading && <span className="pr-spinner" aria-hidden />}
      </div>
      <div className="pr-card-body">
        <div
          className={`pr-upload-zone ${isDragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <Upload size={32} color="#64748b" style={{ margin: '0 auto 0.75rem' }} />
          <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>
            {uploading ? 'Uploading…' : 'Drop PDF here or click to browse'}
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--pr-muted)' }}>
            Max {MAX_SIZE_MB} MB · Review notes, highlights & handwritten markup
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            disabled={disabled || uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void validateAndUpload(file);
            }}
          />
        </div>
        {error && (
          <div className="pr-error" role="alert">
            <AlertCircle size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
