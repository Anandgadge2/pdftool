'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FolderIcon,
  Trash2,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Users,
  Info,
  Server,
  FileSpreadsheet,
  Download,
  FileSearch,
} from 'lucide-react';
import { Assignee } from '@/lib/types';
import FileUpload from './FileUpload';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onUploadComplete: (count: number, pdfName: string) => void;
  onClearDb: () => void;
  assignees: Assignee[];
  onAssigneesChange: () => void;
  markupCount: number;
}

export default function Sidebar({
  isOpen,
  onToggle,
  onUploadComplete,
  onClearDb,
  assignees,
  onAssigneesChange,
  markupCount,
}: SidebarProps) {
  const [newAssigneeName, setNewAssigneeName] = useState('');
  const [addingAssignee, setAddingAssignee] = useState(false);
  const [assigneeError, setAssigneeError] = useState<string | null>(null);

  const handleAddAssignee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssigneeName.trim()) return;

    setAddingAssignee(true);
    setAssigneeError(null);

    try {
      const res = await fetch('/api/assignees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAssigneeName.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to add assignee');
      }

      setNewAssigneeName('');
      onAssigneesChange();
    } catch (err: unknown) {
      setAssigneeError(err instanceof Error ? err.message : 'Error adding assignee');
    } finally {
      setAddingAssignee(false);
    }
  };

  const handleDeleteAssignee = async (id: number, name: string) => {
    if (name === 'Unassigned') {
      alert('Cannot delete default Unassigned role.');
      return;
    }
    if (!window.confirm(`Remove "${name}" from assignees list?`)) return;

    try {
      const res = await fetch(`/api/assignees?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete assignee');
      }

      onAssigneesChange();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error deleting assignee');
    }
  };

  return (
    <>
      <div
        className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={onToggle}
        aria-hidden={!isOpen}
      />

      {!isOpen && (
        <button
          type="button"
          className="sidebar-toggle"
          onClick={onToggle}
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <ChevronRight size={20} />
        </button>
      )}

      <aside
        className={`sidebar ${isOpen ? 'is-open' : 'collapsed'}`}
        aria-hidden={!isOpen}
      >
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <FolderIcon size={18} />
          </div>
          <div className="sidebar-header-text">
            <h2 className="sidebar-title">PDF Annotator</h2>
            <p className="sidebar-subtitle">Next-gen Drawing Review</p>
          </div>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            onClick={onToggle}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        <div className="sidebar-scroll">
          <div className="sidebar-section">
            <h3 className="sidebar-section-title">Upload Drawing</h3>
            <FileUpload onUploadComplete={onUploadComplete} />
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <div className="sidebar-section-row">
              <h3 className="sidebar-section-title">Assignees</h3>
              <span className="sidebar-meta">
                <Users size={12} /> {assignees.length}
              </span>
            </div>

            <form className="sidebar-assignee-form" onSubmit={handleAddAssignee}>
              <input
                type="text"
                placeholder="Add name..."
                value={newAssigneeName}
                onChange={(e) => setNewAssigneeName(e.target.value)}
                disabled={addingAssignee}
                className="sidebar-input"
              />
              <button
                type="submit"
                disabled={addingAssignee || !newAssigneeName.trim()}
                className="btn btn-primary"
                title="Add Assignee"
              >
                <UserPlus size={14} />
              </button>
            </form>

            {assigneeError && <p className="sidebar-error">{assigneeError}</p>}

            <div className="sidebar-assignee-list">
              {assignees.map((assignee) => (
                <div key={assignee.id} className="sidebar-assignee-item">
                  <span>{assignee.name}</span>
                  {assignee.name !== 'Unassigned' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteAssignee(assignee.id, assignee.name)}
                      className="sidebar-assignee-delete"
                      title={`Delete ${assignee.name}`}
                    >
                      <Trash2 size={12} className="hover-red-svg" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-divider" />

          <div className="sidebar-section">
            <h3 className="sidebar-section-title">PDF Review</h3>
            <Link href="/?tab=review" className="btn btn-secondary btn-sm sidebar-action-btn">
              <FileSearch size={12} />
              Review Notes Extractor
            </Link>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-summary-card">
            <Info size={14} className="sidebar-summary-icon" />
            <div>
              <span className="sidebar-summary-title">Data Summary</span>
              <span className="sidebar-summary-value">
                Total Loaded Markups: <strong>{markupCount}</strong>
              </span>
            </div>
          </div>

          {markupCount > 0 && (
            <div className="sidebar-footer-actions">
              <a href="/api/export/csv" download className="btn btn-secondary btn-sm sidebar-action-btn">
                <Download size={12} />
                Export to CSV
              </a>
              <a href="/api/export/excel" download className="btn btn-secondary btn-sm sidebar-action-btn">
                <FileSpreadsheet size={12} />
                Export to Excel
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={onClearDb}
            className="btn btn-danger btn-sm sidebar-action-btn"
            title="Clear Database"
          >
            <Trash2 size={12} />
            Clear All Data
          </button>

          <div className="sidebar-env-badge">
            <Server size={10} />
            <span>Vercel Postgres (Neon) Connected</span>
          </div>
        </div>
      </aside>

      <style jsx global>{`
        .hover-red-svg:hover {
          color: var(--accent-rose) !important;
        }
      `}</style>
    </>
  );
}
