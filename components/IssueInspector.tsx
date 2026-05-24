'use client';

import { motion } from 'framer-motion';
import { 
  X, 
  Trash2, 
  User, 
  AlertTriangle, 
  CheckCircle, 
  FileText, 
  Calendar, 
  Compass,
  FileCheck
} from 'lucide-react';
import { Markup, Assignee, Status, Priority, STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/lib/types';

interface IssueInspectorProps {
  markup: Markup;
  assignees: Assignee[];
  onClose: () => void;
  onUpdate: (id: number, updates: Partial<Markup>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function IssueInspector({
  markup,
  assignees,
  onClose,
  onUpdate,
  onDelete,
}: IssueInspectorProps) {
  
  const handleFieldChange = async (field: keyof Markup, value: any) => {
    await onUpdate(markup.id, { [field]: value });
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete this issue #${markup.id}?`)) {
      await onDelete(markup.id);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        style={{ maxWidth: '620px' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ 
              background: 'rgba(59, 130, 246, 0.15)', 
              color: 'var(--accent-blue-light)', 
              fontWeight: 700, 
              fontSize: '0.8rem',
              padding: '0.25rem 0.5rem',
              borderRadius: 'var(--radius-md)'
            }}>
              Issue #{markup.id}
            </span>
            <h2 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
              Drawing Markup Details
            </h2>
          </div>
          <button onClick={onClose} className="modal-close" aria-label="Close Inspector">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.25rem' }}>
          
          {/* Metadata Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '1rem',
            background: 'rgba(15, 23, 42, 0.25)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            marginBottom: '0.25rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Drawing Name
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', wordBreak: 'break-all', fontWeight: 600 }}>
                {markup.pdf_name}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Page Number
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                Page {markup.page_number}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Markup Author
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                {markup.author || 'Unknown'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Annotation Type
              </span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {markup.annotation_type?.toLowerCase() || 'Unknown'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
              <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                Rectangle Coordinates [x0, y0, x1, y1]
              </span>
              <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.15)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-sm)' }}>
                {markup.rectangle_coordinates || 'N/A'}
              </span>
            </div>
          </div>

          {/* Interactive fields: Assignee, Priority, Status */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '0.75rem',
            marginTop: '0.25rem'
          }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Assigned To</label>
              <select
                className="select"
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                value={markup.assigned_to || 'Unassigned'}
                onChange={(e) => handleFieldChange('assigned_to', e.target.value)}
                aria-label="Assign issue to"
              >
                {assignees.map(a => (
                  <option key={a.id} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Priority</label>
              <select
                className="select"
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                value={markup.priority}
                onChange={(e) => handleFieldChange('priority', e.target.value as Priority)}
                aria-label="Set priority level"
              >
                {PRIORITY_OPTIONS.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.7rem' }}>Status</label>
              <select
                className="select"
                style={{ fontSize: '0.8rem', padding: '0.5rem' }}
                value={markup.status}
                onChange={(e) => handleFieldChange('status', e.target.value as Status)}
                aria-label="Set status"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Comment text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
              Original Review Comment
            </span>
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.875rem 1rem',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              lineHeight: '1.5',
              whiteSpace: 'pre-wrap',
            }}>
              {markup.comment_text || <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No comment text available.</span>}
            </div>
          </div>

          {/* Selected text (If exists) */}
          {markup.selected_text && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Selected Text in PDF Drawing
              </span>
              <div style={{
                background: 'rgba(59, 130, 246, 0.03)',
                border: '1px solid rgba(59, 130, 246, 0.1)',
                borderLeft: '3px solid var(--accent-blue)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem 1rem',
                fontSize: '0.8125rem',
                color: 'var(--accent-blue-light)',
                fontStyle: 'italic',
                lineHeight: '1.4'
              }}>
                "{markup.selected_text}"
              </div>
            </div>
          )}

          {/* Remarks text area */}
          <div className="form-group">
            <label className="form-label" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              Remarks & Action Items
            </label>
            <textarea
              className="textarea"
              style={{ fontSize: '0.8125rem', padding: '0.625rem 0.875rem', minHeight: '80px' }}
              placeholder="Add review remarks, action items, design clarifications, or resolution notes..."
              value={markup.remarks || ''}
              onChange={(e) => handleFieldChange('remarks', e.target.value)}
              aria-label="Add review remarks"
            />
          </div>

          {/* Audit dates */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '0.6875rem', 
            color: 'var(--text-muted)',
            borderTop: '1px solid var(--border-subtle)',
            paddingTop: '0.75rem',
            marginTop: '0.25rem'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Calendar size={10} />
              Created: {markup.created_date || 'N/A'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Compass size={10} />
              Updated: {markup.modified_date || 'N/A'}
            </span>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            style={{ marginRight: 'auto' }}
            title="Delete this issue"
            aria-label="Delete this issue"
          >
            <Trash2 size={14} />
            Delete Issue
          </button>
          
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            aria-label="Close modal dialog"
          >
            Close Details
          </button>
        </div>
      </motion.div>
    </div>
  );
}
