'use client';

import { useState, useEffect, useCallback } from 'react';
import { Markup, MarkupFilters, DashboardMetrics, Assignee } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import Dashboard from '@/components/Dashboard';
import FilterBar from '@/components/FilterBar';
import IssueTable from '@/components/IssueTable';
import EmptyState from '@/components/EmptyState';
import IssueInspector from '@/components/IssueInspector';
import ReadingFlow from '@/components/ReadingFlow';
import { LayoutGrid, List, Download, Copy, Check, X, FileText, Sparkles, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HomePage() {
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<MarkupFilters>({});
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [selectedMarkup, setSelectedMarkup] = useState<Markup | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  // Re-designed premium view states
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTab, setExportTab] = useState<'markdown' | 'notion' | 'json' | 'text'>('markdown');
  const [exportCopied, setExportCopied] = useState(false);

  const fetchMarkups = useCallback(async (f?: MarkupFilters) => {
    setLoading(true);
    try {
      const activeFilters = f ?? filters;
      const params = new URLSearchParams();
      if (activeFilters.pdf_name?.length) activeFilters.pdf_name.forEach(v => params.append('pdf_name', v));
      if (activeFilters.status?.length) activeFilters.status.forEach(v => params.append('status', v));
      if (activeFilters.priority?.length) activeFilters.priority.forEach(v => params.append('priority', v));
      if (activeFilters.assigned_to?.length) activeFilters.assigned_to.forEach(v => params.append('assigned_to', v));
      if (activeFilters.annotation_type?.length) activeFilters.annotation_type.forEach(v => params.append('annotation_type', v));

      const res = await fetch(`/api/markups?${params.toString()}`);
      const json = await res.json();
      if (json.success) setMarkups(json.data);
    } catch (err) {
      console.error('Failed to fetch markups:', err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const fetchAssignees = useCallback(async () => {
    try {
      const res = await fetch('/api/assignees');
      const json = await res.json();
      if (json.success) setAssignees(json.data);
    } catch (err) {
      console.error('Failed to fetch assignees:', err);
    }
  }, []);

  useEffect(() => {
    fetchMarkups();
    fetchAssignees();
  }, []);

  const handleFiltersChange = (newFilters: MarkupFilters) => {
    setFilters(newFilters);
    fetchMarkups(newFilters);
  };

  const handleMarkupUpdate = async (id: number, updates: Partial<Markup>) => {
    try {
      const res = await fetch(`/api/markups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        setMarkups(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
        if (selectedMarkup?.id === id) {
          setSelectedMarkup(prev => prev ? { ...prev, ...updates } : null);
        }
      }
    } catch (err) {
      console.error('Update failed:', err);
    }
  };

  const handleMarkupDelete = async (id: number) => {
    try {
      const res = await fetch(`/api/markups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setMarkups(prev => prev.filter(m => m.id !== id));
        if (selectedMarkup?.id === id) setSelectedMarkup(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleClearDb = async () => {
    if (!window.confirm('Clear ALL markup data? This cannot be undone.')) return;
    try {
      const res = await fetch('/api/db/clear', { method: 'DELETE' });
      if (res.ok) {
        setMarkups([]);
        setSelectedMarkup(null);
        setUploadSuccess(null);
      }
    } catch (err) {
      console.error('Clear failed:', err);
    }
  };

  const handleUploadComplete = (count: number, pdfName: string) => {
    setUploadSuccess(`✓ Extracted ${count} annotation${count !== 1 ? 's' : ''} from "${pdfName}"`);
    fetchMarkups();
    setViewMode('cards'); // Auto-switch to card list for instant visual feedback!
    setTimeout(() => setUploadSuccess(null), 6000);
  };

  // Compute metrics
  const metrics: DashboardMetrics = {
    total:      markups.length,
    pending:    markups.filter(m => m.status === 'Pending').length,
    inProgress: markups.filter(m => m.status === 'In Progress').length,
    resolved:   markups.filter(m => m.status === 'Resolved').length,
    closed:     markups.filter(m => m.status === 'Closed').length,
    critical:   markups.filter(m => m.priority === 'Critical').length,
  };

  // Unique values for filter dropdowns
  const uniquePdfs   = [...new Set(markups.map(m => m.pdf_name))].filter(Boolean);
  const uniqueTypes  = [...new Set(markups.map(m => m.annotation_type))].filter(Boolean);

  // ============================================================
  // Local-First Exporters Generators
  // ============================================================
  const generateMarkdown = (): string => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const pdfNames = [...new Set(markups.map(m => m.pdf_name))].join(', ');
    
    let text = `# PDF Highlights & Annotations\n`;
    text += `*Generated on ${today} | Source PDFs: ${pdfNames || 'Various'}*\n\n`;
    text += `Total Highlights: **${markups.length}**\n\n---\n\n`;

    // Map highlight color to Obsidian callout style
    const getCalloutType = (c?: string) => {
      switch (c) {
        case 'Green': return 'success';
        case 'Blue': return 'info';
        case 'Orange': return 'warning';
        case 'Pink': return 'danger';
        case 'Purple': return 'example';
        default: return 'quote'; // Yellow
      }
    };

    markups.forEach((m) => {
      text += `## Page ${m.page_number} (${m.pdf_name})\n`;
      text += `> [!${getCalloutType(m.color)}] ${m.color || 'Yellow'} Highlight\n`;
      text += `> ${m.selected_text || `[${m.annotation_type} Annotation]`}\n\n`;
      
      if (m.comment_text && !m.comment_text.startsWith('[')) {
        text += `**Note**: ${m.comment_text}\n\n`;
      }
      
      text += `*Reviewer: ${m.author}* | *Status: ${m.status}* | *Priority: ${m.priority}*\n`;
      if (m.remarks) text += `*Remarks: ${m.remarks}*\n`;
      
      text += `\n---\n\n`;
    });
    
    return text.trim();
  };

  const generateNotion = (): string => {
    let text = `### PDF Annotations Export\n`;
    text += `Total Annotations: **${markups.length}**\n\n`;
    text += `| Page | Color | Highlight | Comment | Author | Status |\n`;
    text += `| --- | --- | --- | --- | --- | --- |\n`;
    
    markups.forEach((m) => {
      const cleanHighlight = (m.selected_text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const cleanComment = (m.comment_text || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      text += `| **${m.page_number}** | ${m.color || 'Yellow'} | ${cleanHighlight || `*${m.annotation_type}*`} | ${cleanComment.startsWith('[') ? '-' : cleanComment} | ${m.author} | \`${m.status}\` |\n`;
    });
    
    return text;
  };

  const generateJson = (): string => {
    return JSON.stringify(markups.map(({ id, pdf_name, page_number, annotation_type, selected_text, comment_text, author, color, status, priority, assigned_to, remarks }) => ({
      id, pdf_name, page_number, annotation_type, selected_text, comment_text, author, color, status, priority, assigned_to, remarks
    })), null, 2);
  };

  const generateText = (): string => {
    const today = new Date().toLocaleString();
    let text = `==================================================\n`;
    text += `PDF ANNOTATION REPORT - EXTRACTED LOCALLY\n`;
    text += `Generated: ${today}\n`;
    text += `Total items: ${markups.length}\n`;
    text += `==================================================\n\n`;

    markups.forEach((m, idx) => {
      text += `[${idx + 1}] PDF: ${m.pdf_name}\n`;
      text += `    Location: Page ${m.page_number}\n`;
      text += `    Type: ${m.annotation_type} (${m.color || 'Yellow'})\n`;
      text += `    Author: ${m.author}\n`;
      if (m.selected_text) text += `    Highlight: "${m.selected_text}"\n`;
      if (m.comment_text && !m.comment_text.startsWith('[')) text += `    Comment: ${m.comment_text}\n`;
      text += `    Status: ${m.status} | Priority: ${m.priority} | Assigned: ${m.assigned_to}\n`;
      if (m.remarks) text += `    Remarks: ${m.remarks}\n`;
      text += `--------------------------------------------------\n\n`;
    });

    return text.trim();
  };

  const getExportData = (): string => {
    switch (exportTab) {
      case 'notion': return generateNotion();
      case 'json': return generateJson();
      case 'text': return generateText();
      default: return generateMarkdown();
    }
  };

  const handleCopyExport = async () => {
    try {
      await navigator.clipboard.writeText(getExportData());
      setExportCopied(true);
      setTimeout(() => setExportCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadExport = () => {
    const content = getExportData();
    let extension = 'md';
    let mime = 'text/markdown';
    
    if (exportTab === 'json') {
      extension = 'json';
      mime = 'application/json';
    } else if (exportTab === 'text') {
      extension = 'txt';
      mime = 'text/plain';
    }
    
    const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `pdf_annotations_export_${new Date().toISOString().slice(0, 10)}.${extension}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app-container">
      {/* Re-designed elegant dynamic toasts */}
      <AnimatePresence>
        {uploadSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="toast toast-success" 
            role="alert"
          >
            <span>{uploadSuccess}</span>
            <button onClick={() => setUploadSuccess(null)} className="toast-close" aria-label="Dismiss">×</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="main-content">
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(p => !p)}
          onUploadComplete={handleUploadComplete}
          onClearDb={handleClearDb}
          filters={filters}
          onFiltersChange={handleFiltersChange}
          uniquePdfs={uniquePdfs}
          uniqueTypes={uniqueTypes}
          assignees={assignees}
          onAssigneesChange={fetchAssignees}
          markupCount={markups.length}
        />

        <main className={`content-area ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
          
          {/* Re-designed premium hero / header layout */}
          {markups.length === 0 ? (
            <div className="premium-hero">
              <div className="premium-hero-glow" />
              <div className="hero-content">
                <span className="premium-badge">
                  <Sparkles size={12} />
                  Second Brain Workflow
                </span>
                <h1 className="hero-title text-gradient">
                  Private PDF Annotation Extractor
                </h1>
                <p className="hero-subtitle">
                  The fastest way to move PDF highlights, underlines, and sticky comments directly into Obsidian, Notion, or spreadsheets. No signups, no external storage leaks.
                </p>
                <div className="hero-trust-badges">
                  <span className="trust-badge">
                    <ShieldCheck size={14} />
                    100% Local-First Flow
                  </span>
                  <span className="trust-badge">
                    <Sparkles size={14} />
                    High-Fidelity Color Preservation
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <header className="page-header premium-header-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {!sidebarOpen && (
                  <button
                    id="open-sidebar-btn"
                    className="btn btn-icon"
                    onClick={() => setSidebarOpen(true)}
                    title="Open sidebar"
                    aria-label="Open sidebar"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
                    </svg>
                  </button>
                )}
                <div>
                  <h1 className="text-gradient font-bold" style={{ fontSize: '1.25rem', margin: 0, letterSpacing: '-0.025em' }}>
                    PDF Markup Workspace
                  </h1>
                  <p className="page-subtitle">Refining and exporting your PDF knowledge</p>
                </div>
              </div>

              {/* Re-designed premium layout controls & exports */}
              <div className="page-header-actions" style={{ gap: '0.625rem' }}>
                
                {/* View switcher toggle */}
                <div className="view-toggle-pill">
                  <button 
                    onClick={() => setViewMode('cards')}
                    className={`view-toggle-btn ${viewMode === 'cards' ? 'active' : ''}`}
                    title="Reading Flow View"
                  >
                    <List size={14} />
                    <span>Reading Flow</span>
                  </button>
                  <button 
                    onClick={() => setViewMode('table')}
                    className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                    title="Review Dashboard View"
                  >
                    <LayoutGrid size={14} />
                    <span>Dashboard Grid</span>
                  </button>
                </div>

                <div className="divider-vr" />

                {/* Local-first export hub trigger */}
                <button
                  onClick={() => setExportOpen(true)}
                  className="btn btn-primary btn-sm btn-glow"
                  title="Export Annotations"
                >
                  <Download size={14} />
                  <span>Export Hub</span>
                </button>
              </div>
            </header>
          )}

          {/* Dashboard metrics */}
          <Dashboard metrics={metrics} loading={loading} />

          {/* Active filters bar */}
          {markups.length > 0 && (
            <FilterBar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              uniquePdfs={uniquePdfs}
              uniqueTypes={uniqueTypes}
              assignees={assignees}
            />
          )}

          {/* Main content view switching */}
          {loading ? (
            <div className="loading-container">
              <div className="spinner" />
              <p>Extracting PDF knowledge...</p>
            </div>
          ) : markups.length === 0 ? (
            <EmptyState onOpenSidebar={() => setSidebarOpen(true)} />
          ) : viewMode === 'cards' ? (
            <ReadingFlow 
              markups={markups} 
              onInspect={setSelectedMarkup} 
            />
          ) : (
            <IssueTable
              markups={markups}
              assignees={assignees}
              onUpdate={handleMarkupUpdate}
              onDelete={handleMarkupDelete}
              onInspect={setSelectedMarkup}
            />
          )}
        </main>
      </div>

      {/* Re-designed premium full screen slide-overs and modals */}
      {selectedMarkup && (
        <IssueInspector
          markup={selectedMarkup}
          assignees={assignees}
          onClose={() => setSelectedMarkup(null)}
          onUpdate={handleMarkupUpdate}
          onDelete={handleMarkupDelete}
        />
      )}

      {/* Premium Local-First Export Hub Modal */}
      <AnimatePresence>
        {exportOpen && (
          <div className="modal-overlay" onClick={() => setExportOpen(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="modal-content export-hub-modal" 
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="modal-header">
                <div>
                  <h3 className="modal-title text-gradient">Annotation Export Hub</h3>
                  <p className="modal-subtitle">Direct local exports for your second brain</p>
                </div>
                <button className="btn-modal-close" onClick={() => setExportOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              {/* Tabs list */}
              <div className="modal-body-container">
                <div className="export-tabs-sidebar">
                  <button 
                    onClick={() => setExportTab('markdown')}
                    className={`export-sidebar-btn ${exportTab === 'markdown' ? 'active' : ''}`}
                  >
                    <span className="sidebar-tab-icon">💎</span>
                    <div style={{ textAlign: 'left' }}>
                      <span className="sidebar-tab-title">Obsidian / Markdown</span>
                      <span className="sidebar-tab-desc">For local note taking</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => setExportTab('notion')}
                    className={`export-sidebar-btn ${exportTab === 'notion' ? 'active' : ''}`}
                  >
                    <span className="sidebar-tab-icon">📌</span>
                    <div style={{ textAlign: 'left' }}>
                      <span className="sidebar-tab-title">Notion Database</span>
                      <span className="sidebar-tab-desc">Paste directly as tables</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => setExportTab('json')}
                    className={`export-sidebar-btn ${exportTab === 'json' ? 'active' : ''}`}
                  >
                    <span className="sidebar-tab-icon">⚙️</span>
                    <div style={{ textAlign: 'left' }}>
                      <span className="sidebar-tab-title">JSON Data</span>
                      <span className="sidebar-tab-desc">Raw developer payloads</span>
                    </div>
                  </button>

                  <button 
                    onClick={() => setExportTab('text')}
                    className={`export-sidebar-btn ${exportTab === 'text' ? 'active' : ''}`}
                  >
                    <span className="sidebar-tab-icon">📝</span>
                    <div style={{ textAlign: 'left' }}>
                      <span className="sidebar-tab-title">Plain Text Summary</span>
                      <span className="sidebar-tab-desc">Simple clean format</span>
                    </div>
                  </button>
                  
                  <div className="divider-hr" style={{ margin: '0.75rem 0' }} />
                  
                  <a href="/api/export/csv" className="export-sidebar-btn link-btn">
                    <span className="sidebar-tab-icon">📊</span>
                    <div style={{ textAlign: 'left' }}>
                      <span className="sidebar-tab-title">CSV Spreadsheet</span>
                      <span className="sidebar-tab-desc">Standard table format</span>
                    </div>
                  </a>
                  
                  <a href="/api/export/excel" className="export-sidebar-btn link-btn">
                    <span className="sidebar-tab-icon">📈</span>
                    <div style={{ textAlign: 'left' }}>
                      <span className="sidebar-tab-title">Microsoft Excel</span>
                      <span className="sidebar-tab-desc">Styled worksheet reports</span>
                    </div>
                  </a>
                </div>

                {/* Previews / Action area */}
                <div className="export-preview-panel">
                  <div className="preview-header">
                    <span className="preview-label">Live Preview ({markups.length} Items)</span>
                    <div className="preview-actions">
                      <button 
                        onClick={handleCopyExport}
                        className={`btn btn-secondary btn-sm ${exportCopied ? 'success' : ''}`}
                      >
                        {exportCopied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{exportCopied ? 'Copied!' : 'Copy Clipboard'}</span>
                      </button>
                      <button 
                        onClick={handleDownloadExport}
                        className="btn btn-primary btn-sm"
                      >
                        <Download size={13} />
                        <span>Download file</span>
                      </button>
                    </div>
                  </div>

                  <div className="preview-code-container">
                    <pre className="preview-code-block">
                      <code>{getExportData()}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
