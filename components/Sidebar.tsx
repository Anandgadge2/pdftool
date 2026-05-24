'use client';

import { useState } from 'react';
import { 
  FolderIcon, 
  Trash2, 
  ChevronLeft, 
  UserPlus, 
  Users, 
  Info,
  Server,
  FileSpreadsheet,
  Download
} from 'lucide-react';
import { MarkupFilters, Assignee } from '@/lib/types';
import FileUpload from './FileUpload';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onUploadComplete: (count: number, pdfName: string) => void;
  onClearDb: () => void;
  filters: MarkupFilters;
  onFiltersChange: (newFilters: MarkupFilters) => void;
  uniquePdfs: string[];
  uniqueTypes: string[];
  assignees: Assignee[];
  onAssigneesChange: () => void;
  markupCount: number;
}

export default function Sidebar({
  isOpen,
  onToggle,
  onUploadComplete,
  onClearDb,
  filters,
  onFiltersChange,
  uniquePdfs,
  uniqueTypes,
  assignees,
  onAssigneesChange,
  markupCount
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
    } catch (err: any) {
      setAssigneeError(err.message || 'Error adding assignee');
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
    } catch (err: any) {
      alert(err.message || 'Error deleting assignee');
    }
  };

  return (
    <>
      <div 
        className={`sidebar-backdrop ${isOpen ? 'visible' : ''}`} 
        onClick={onToggle}
      />
      <aside className={`sidebar ${isOpen ? 'mobile-open' : 'collapsed'}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <FolderIcon size={18} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <h2 className="sidebar-title">PDF Annotator</h2>
            <p className="sidebar-subtitle">Next-gen Drawing Review</p>
          </div>
          <button 
            className="btn btn-icon btn-ghost btn-sm" 
            onClick={onToggle}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Section: Upload */}
        <div className="sidebar-section">
          <h3 className="sidebar-section-title">Upload Drawing</h3>
          <FileUpload onUploadComplete={onUploadComplete} />
        </div>

        <div className="sidebar-divider" />

        {/* Section: Assignees */}
        <div className="sidebar-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0 0.5rem' }}>
            <h3 className="sidebar-section-title" style={{ margin: 0, padding: 0 }}>Assignees</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Users size={12} /> {assignees.length}
            </span>
          </div>

          <form onSubmit={handleAddAssignee} style={{ display: 'flex', gap: '0.375rem', padding: '0 0.5rem', marginBottom: '0.75rem' }}>
            <input
              type="text"
              placeholder="Add name..."
              value={newAssigneeName}
              onChange={(e) => setNewAssigneeName(e.target.value)}
              disabled={addingAssignee}
              style={{
                flexGrow: 1,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                padding: '0.375rem 0.625rem',
                color: 'var(--text-primary)',
                fontSize: '0.75rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={addingAssignee || !newAssigneeName.trim()}
              className="btn btn-primary"
              style={{ padding: '0.375rem 0.5rem', borderRadius: 'var(--radius-md)' }}
              title="Add Assignee"
            >
              <UserPlus size={14} />
            </button>
          </form>

          {assigneeError && (
            <p style={{ color: '#f87171', fontSize: '0.6875rem', margin: '0 0 0.5rem 0.5rem' }}>{assigneeError}</p>
          )}

          {/* Assignees list */}
          <div style={{ 
            maxHeight: '130px', 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.25rem',
            padding: '0 0.5rem'
          }}>
            {assignees.map((assignee) => (
              <div
                key={assignee.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.3125rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.03)',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>{assignee.name}</span>
                {assignee.name !== 'Unassigned' && (
                  <button
                    onClick={() => handleDeleteAssignee(assignee.id, assignee.name)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '0.125rem',
                      display: 'flex',
                      alignItems: 'center',
                    }}
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

        {/* Section: Actions */}
        <div className="sidebar-section" style={{ marginTop: 'auto', paddingBottom: '1.5rem' }}>
          <div style={{ padding: '0 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            
            {/* Markup Statistics Info */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.1)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
            }}>
              <Info size={14} style={{ color: 'var(--accent-blue)', marginTop: '0.125rem', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Data Summary</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                  Total Loaded Markups: <strong style={{ color: 'var(--text-primary)' }}>{markupCount}</strong>
                </span>
              </div>
            </div>

            {/* Quick Export Panel (Only visible when items are loaded) */}
            {markupCount > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <a
                  href="/api/export/csv"
                  download
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.75rem' }}
                >
                  <Download size={12} />
                  Export to CSV
                </a>
                <a
                  href="/api/export/excel"
                  download
                  className="btn btn-secondary btn-sm"
                  style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.75rem' }}
                >
                  <FileSpreadsheet size={12} />
                  Export to Excel (Styled)
                </a>
              </div>
            )}

            {/* Database management */}
            <button
              onClick={onClearDb}
              className="btn btn-danger btn-sm"
              style={{ justifyContent: 'flex-start', width: '100%', fontSize: '0.75rem' }}
              title="Clear Database"
            >
              <Trash2 size={12} />
              Clear All Data
            </button>

            {/* Environment Indicator */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              fontSize: '0.625rem',
              color: 'var(--text-muted)',
              borderTop: '1px solid var(--border-subtle)',
              paddingTop: '0.75rem',
            }}>
              <Server size={10} />
              <span>Vercel Postgres (Neon) Connected</span>
            </div>

          </div>
        </div>
      </aside>

      {/* Styles for hover delete icon */}
      <style jsx global>{`
        .hover-red-svg:hover {
          color: var(--accent-red) !important;
        }
      `}</style>
    </>
  );
}
