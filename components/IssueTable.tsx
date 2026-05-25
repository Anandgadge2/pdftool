'use client';

import { useState } from 'react';
import { 
  Eye, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpDown,
  Search
} from 'lucide-react';
import { Markup, Assignee, Status, Priority, STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/lib/types';

interface IssueTableProps {
  markups: Markup[];
  assignees: Assignee[];
  onUpdate: (id: number, updates: Partial<Markup>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onInspect: (markup: Markup) => void;
}

type SortField = 'id' | 'page_number' | 'pdf_name' | 'annotation_type' | 'author' | 'priority' | 'status';
type SortOrder = 'asc' | 'desc';

export default function IssueTable({
  markups,
  assignees,
  onUpdate,
  onDelete,
  onInspect
}: IssueTableProps) {
  // Local sorting
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Local quick search filter (table-level search)
  const [localSearch, setLocalSearch] = useState('');

  // Remarks inline edit state
  const [editingRemarksId, setEditingRemarksId] = useState<number | null>(null);
  const [editingRemarksVal, setEditingRemarksVal] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const truncateComment = (txt: string, limit = 55) => {
    if (!txt) return '';
    return txt.length > limit ? `${txt.slice(0, limit)}...` : txt;
  };

  const getStatusClass = (status: Status) => {
    switch (status) {
      case 'Pending': return 'badge-status-pending';
      case 'In Progress': return 'badge-status-progress';
      case 'Resolved': return 'badge-status-resolved';
      case 'Closed': return 'badge-status-closed';
      case 'Rejected': return 'badge-status-rejected';
      default: return '';
    }
  };

  const getPriorityClass = (priority: Priority) => {
    switch (priority) {
      case 'Critical': return 'badge-priority-critical';
      case 'High': return 'badge-priority-high';
      case 'Medium': return 'badge-priority-medium';
      case 'Low': return 'badge-priority-low';
      default: return '';
    }
  };

  const getPriorityWeight = (p: Priority): number => {
    switch (p) {
      case 'Critical': return 4;
      case 'High': return 3;
      case 'Medium': return 2;
      case 'Low': return 1;
      default: return 0;
    }
  };

  const getStatusWeight = (s: Status): number => {
    switch (s) {
      case 'Pending': return 5;
      case 'In Progress': return 4;
      case 'Resolved': return 3;
      case 'Closed': return 2;
      case 'Rejected': return 1;
      default: return 0;
    }
  };

  // Filter markups locally by quick search input
  const searchedMarkups = markups.filter(m => {
    const searchLower = localSearch.toLowerCase();
    return (
      m.comment_text?.toLowerCase().includes(searchLower) ||
      m.author?.toLowerCase().includes(searchLower) ||
      m.remarks?.toLowerCase().includes(searchLower) ||
      m.pdf_name?.toLowerCase().includes(searchLower) ||
      m.annotation_type?.toLowerCase().includes(searchLower) ||
      m.id.toString().includes(searchLower)
    );
  });

  // Sort markups
  const sortedMarkups = [...searchedMarkups].sort((a, b) => {
    let valA: any = a[sortField];
    let valB: any = b[sortField];

    // Priority weight sorting
    if (sortField === 'priority') {
      valA = getPriorityWeight(a.priority);
      valB = getPriorityWeight(b.priority);
    }
    // Status weight sorting
    if (sortField === 'status') {
      valA = getStatusWeight(a.status);
      valB = getStatusWeight(b.status);
    }

    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  // Paginated markups
  const totalPages = Math.max(1, Math.ceil(sortedMarkups.length / itemsPerPage));
  // Adjust current page if out of bounds due to filtering
  const activePage = Math.min(currentPage, totalPages);
  
  const startIndex = (activePage - 1) * itemsPerPage;
  const paginatedMarkups = sortedMarkups.slice(startIndex, startIndex + itemsPerPage);

  const startRange = startIndex + 1;
  const endRange = Math.min(startIndex + itemsPerPage, sortedMarkups.length);

  const startEditingRemarks = (id: number, currentRemarks: string) => {
    setEditingRemarksId(id);
    setEditingRemarksVal(currentRemarks || '');
  };

  const saveRemarks = async (id: number) => {
    await onUpdate(id, { remarks: editingRemarksVal.trim() });
    setEditingRemarksId(null);
  };

  const handleRemarksKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      saveRemarks(id);
    } else if (e.key === 'Escape') {
      setEditingRemarksId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm(`Delete markup issue #${id}?`)) {
      await onDelete(id);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      
      {/* Table Local Search Toolbar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap',
        gap: '1rem',
        padding: '0.25rem 0'
      }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
          <Search 
            size={14} 
            style={{ 
              position: 'absolute', 
              left: '0.75rem', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              color: 'var(--text-muted)' 
            }} 
          />
          <input
            type="text"
            className="input"
            placeholder="Search within page results..."
            value={localSearch}
            onChange={(e) => {
              setLocalSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              paddingLeft: '2.25rem',
              fontSize: '0.8125rem',
              height: '36px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(15, 23, 42, 0.3)',
              border: '1px solid var(--border-primary)',
              width: '100%'
            }}
            aria-label="Search within page results"
          />
        </div>
        
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          Showing <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{startRange}-{endRange}</span> of{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{sortedMarkups.length}</span> issues
          {localSearch && ` (filtered from ${markups.length})`}
        </div>
      </div>

      {/* Main Table */}
      <div className="table-scroll-wrap">
        <p className="table-scroll-hint">Swipe horizontally to see all columns</p>
        <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('id')} style={{ cursor: 'pointer', width: '60px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  ID <ArrowUpDown size={10} />
                </span>
              </th>
              <th onClick={() => handleSort('pdf_name')} style={{ cursor: 'pointer', maxWidth: '180px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Drawing <ArrowUpDown size={10} />
                </span>
              </th>
              <th onClick={() => handleSort('page_number')} style={{ cursor: 'pointer', width: '80px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Page <ArrowUpDown size={10} />
                </span>
              </th>
              <th onClick={() => handleSort('annotation_type')} style={{ cursor: 'pointer', width: '100px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Type <ArrowUpDown size={10} />
                </span>
              </th>
              <th style={{ minWidth: '220px' }}>Comment</th>
              <th onClick={() => handleSort('author')} style={{ cursor: 'pointer', width: '120px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Author <ArrowUpDown size={10} />
                </span>
              </th>
              <th style={{ width: '140px' }}>Assigned To</th>
              <th onClick={() => handleSort('priority')} style={{ cursor: 'pointer', width: '120px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Priority <ArrowUpDown size={10} />
                </span>
              </th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer', width: '130px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  Status <ArrowUpDown size={10} />
                </span>
              </th>
              <th style={{ minWidth: '160px' }}>Remarks</th>
              <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedMarkups.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  No issues match the search criteria.
                </td>
              </tr>
            ) : (
              paginatedMarkups.map((m) => (
                <tr key={m.id}>
                  {/* ID */}
                  <td className="mono" style={{ fontSize: '0.75rem', fontWeight: 600 }}>#{m.id}</td>
                  
                  {/* Drawing / PDF Name */}
                  <td style={{ 
                    maxWidth: '180px', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis', 
                    whiteSpace: 'nowrap',
                    fontSize: '0.8rem' 
                  }} title={m.pdf_name}>
                    {m.pdf_name}
                  </td>
                  
                  {/* Page */}
                  <td className="mono" style={{ fontSize: '0.8rem' }}>P. {m.page_number}</td>
                  
                  {/* Type */}
                  <td>
                    <span style={{ 
                      fontSize: '0.7rem', 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      padding: '0.15rem 0.4rem', 
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      textTransform: 'capitalize'
                    }}>
                      {m.annotation_type.toLowerCase()}
                    </span>
                  </td>
                  
                  {/* Comment */}
                  <td style={{ fontSize: '0.8125rem', lineHeight: '1.4' }}>
                    {truncateComment(m.comment_text)}
                  </td>
                  
                  {/* Author */}
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{m.author}</td>
                  
                  {/* Assignee */}
                  <td>
                    <select
                      className="inline-select"
                      style={{ width: '100%', fontSize: '0.75rem' }}
                      value={m.assigned_to || 'Unassigned'}
                      onChange={(e) => onUpdate(m.id, { assigned_to: e.target.value })}
                      aria-label={`Assign issue #${m.id}`}
                    >
                      {assignees.map(a => (
                        <option key={a.id} value={a.name}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Priority */}
                  <td>
                    <select
                      className={`inline-select badge ${getPriorityClass(m.priority)}`}
                      style={{ 
                        width: '100%', 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        border: '1px solid transparent',
                        padding: '0.2rem 0.4rem',
                        appearance: 'none',
                        textAlign: 'center'
                      }}
                      value={m.priority}
                      onChange={(e) => onUpdate(m.id, { priority: e.target.value as Priority })}
                      aria-label={`Set priority for issue #${m.id}`}
                    >
                      {PRIORITY_OPTIONS.map(p => (
                        <option key={p} value={p} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Status */}
                  <td>
                    <select
                      className={`inline-select badge ${getStatusClass(m.status)}`}
                      style={{ 
                        width: '100%', 
                        fontSize: '0.7rem', 
                        fontWeight: 700, 
                        border: '1px solid transparent',
                        padding: '0.2rem 0.4rem',
                        appearance: 'none',
                        textAlign: 'center'
                      }}
                      value={m.status}
                      onChange={(e) => onUpdate(m.id, { status: e.target.value as Status })}
                      aria-label={`Set status for issue #${m.id}`}
                    >
                      {STATUS_OPTIONS.map(s => (
                        <option key={s} value={s} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  
                  {/* Remarks inline edit */}
                  <td className="editable-cell" onClick={() => startEditingRemarks(m.id, m.remarks)}>
                    {editingRemarksId === m.id ? (
                      <input
                        type="text"
                        value={editingRemarksVal}
                        onChange={(e) => setEditingRemarksVal(e.target.value)}
                        onBlur={() => saveRemarks(m.id)}
                        onKeyDown={(e) => handleRemarksKeyDown(e, m.id)}
                        autoFocus
                        style={{
                          width: '100%',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--accent-blue)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '0.15rem 0.35rem',
                          fontSize: '0.75rem',
                          outline: 'none',
                        }}
                        aria-label={`Edit remarks for issue #${m.id}`}
                      />
                    ) : (
                      <span style={{ fontSize: '0.8rem', display: 'block', minHeight: '1.25rem' }}>
                        {m.remarks || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.725rem' }}>Add remarks...</span>}
                      </span>
                    )}
                  </td>
                  
                  {/* Actions */}
                  <td style={{ verticalAlign: 'middle' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
                      <button
                        onClick={() => onInspect(m)}
                        className="btn btn-icon btn-ghost btn-sm"
                        style={{ padding: '0.3rem', height: '26px', width: '26px' }}
                        title="Inspect coordinates and details"
                        aria-label={`Inspect issue #${m.id}`}
                      >
                        <Eye size={12} />
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="btn btn-icon btn-ghost btn-sm"
                        style={{ padding: '0.3rem', height: '26px', width: '26px', color: 'rgba(239, 68, 68, 0.6)' }}
                        title="Delete issue"
                        aria-label={`Delete issue #${m.id}`}
                      >
                        <Trash2 size={12} className="hover-red-svg" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0.25rem'
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Page <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{activePage}</span> of{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{totalPages}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={activePage === 1}
              className="btn btn-secondary btn-sm btn-icon"
              style={{ width: '28px', height: '28px', padding: 0 }}
              title="First Page"
              aria-label="First page"
            >
              <ChevronsLeft size={14} />
            </button>
            
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={activePage === 1}
              className="btn btn-secondary btn-sm btn-icon"
              style={{ width: '28px', height: '28px', padding: 0 }}
              title="Previous Page"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Render a compact set of page numbers */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = activePage - 2 + i;
              if (pageNum < 1) pageNum = i + 1;
              if (pageNum > totalPages) return null;
              
              const isActive = pageNum === activePage;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ 
                    minWidth: '28px', 
                    height: '28px', 
                    padding: '0 0.375rem',
                    background: isActive ? 'var(--gradient-primary)' : 'transparent',
                    border: isActive ? 'none' : '1px solid transparent'
                  }}
                  aria-label={`Page ${pageNum}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {pageNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={activePage === totalPages}
              className="btn btn-secondary btn-sm btn-icon"
              style={{ width: '28px', height: '28px', padding: 0 }}
              title="Next Page"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>

            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={activePage === totalPages}
              className="btn btn-secondary btn-sm btn-icon"
              style={{ width: '28px', height: '28px', padding: 0 }}
              title="Last Page"
              aria-label="Last page"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
