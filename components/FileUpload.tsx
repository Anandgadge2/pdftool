'use client';

import React, { useState, useRef } from 'react';
import { Upload, File, AlertCircle, CheckCircle2 } from 'lucide-react';

interface FileUploadProps {
  onUploadComplete: (count: number, pdfName: string) => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  const uploadFile = async (file: File) => {
    if (file.type && file.type !== 'application/pdf') {
      setError('Please upload a valid PDF file.');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMsg(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to upload and parse PDF.');
      }

      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Extracted ${data.data.count} annotations.`);
        onUploadComplete(data.data.count, data.data.pdf_name);
        
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        throw new Error(data.error || 'Failed to process annotations.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during processing.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      <div
        className={`file-upload-zone ${isDragOver ? 'dragover' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ minHeight: '160px', padding: 'var(--space-lg)' }}
      >
        <div className="upload-icon" style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-xl)' }}>
          {uploading ? (
            <div className="spinner" style={{ width: '20px', height: '20px', borderWidth: '2px' }} />
          ) : (
            <Upload size={18} />
          )}
        </div>
        
        <div style={{ marginTop: '0.25rem' }}>
          <span className="upload-title" style={{ fontSize: '0.95rem' }}>
            {uploading ? 'Processing PDF...' : 'Drag & Drop PDF'}
          </span>
          <p className="upload-subtitle" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
            {uploading ? 'Extracting drawings and markups...' : 'or click to browse local files'}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          disabled={uploading}
          aria-label="Upload PDF Markup Drawing"
        />
      </div>

      {error && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          padding: '0.625rem 0.875rem', 
          borderRadius: 'var(--radius-md)', 
          background: 'rgba(239, 68, 68, 0.1)', 
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#f87171',
          fontSize: '0.75rem' 
        }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          padding: '0.625rem 0.875rem', 
          borderRadius: 'var(--radius-md)', 
          background: 'rgba(16, 185, 129, 0.1)', 
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: '#34d399',
          fontSize: '0.75rem' 
        }}>
          <CheckCircle2 size={14} style={{ flexShrink: 0 }} />
          <span>{successMsg}</span>
        </div>
      )}
    </div>
  );
}
