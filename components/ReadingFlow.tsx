'use client';

import { useState } from 'react';
import { Markup } from '@/lib/types';
import { Copy, Check, Eye, MessageSquare, User, FileText, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReadingFlowProps {
  markups: Markup[];
  onInspect: (m: Markup) => void;
}

// Styling maps for colors to CSS variables/classes
const COLOR_THEMES: Record<string, {
  border: string;
  bg: string;
  badgeBg: string;
  badgeText: string;
  glow: string;
}> = {
  Yellow: {
    border: 'rgba(234, 179, 8, 0.4)',
    bg: 'rgba(234, 179, 8, 0.04)',
    badgeBg: 'rgba(234, 179, 8, 0.15)',
    badgeText: '#facc15',
    glow: 'rgba(234, 179, 8, 0.15)',
  },
  Green: {
    border: 'rgba(34, 197, 94, 0.4)',
    bg: 'rgba(34, 197, 94, 0.04)',
    badgeBg: 'rgba(34, 197, 94, 0.15)',
    badgeText: '#4ade80',
    glow: 'rgba(34, 197, 94, 0.15)',
  },
  Blue: {
    border: 'rgba(59, 130, 246, 0.4)',
    bg: 'rgba(59, 130, 246, 0.04)',
    badgeBg: 'rgba(59, 130, 246, 0.15)',
    badgeText: '#60a5fa',
    glow: 'rgba(59, 130, 246, 0.15)',
  },
  Pink: {
    border: 'rgba(236, 72, 153, 0.4)',
    bg: 'rgba(236, 72, 153, 0.04)',
    badgeBg: 'rgba(236, 72, 153, 0.15)',
    badgeText: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.15)',
  },
  Orange: {
    border: 'rgba(249, 115, 22, 0.4)',
    bg: 'rgba(249, 115, 22, 0.04)',
    badgeBg: 'rgba(249, 115, 22, 0.15)',
    badgeText: '#fb923c',
    glow: 'rgba(249, 115, 22, 0.15)',
  },
  Purple: {
    border: 'rgba(168, 85, 247, 0.4)',
    bg: 'rgba(168, 85, 247, 0.04)',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    badgeText: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.15)',
  },
};

export default function ReadingFlow({ markups, onInspect }: ReadingFlowProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopy = async (e: React.MouseEvent, m: Markup) => {
    e.stopPropagation();
    
    // Copy in perfect markdown format
    const markdown = `> ${m.selected_text || `[${m.annotation_type} Markup]`}\n\n**Comment**: ${m.comment_text}\n*— ${m.author}, Page ${m.page_number} (${m.pdf_name})*`;
    
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  };

  return (
    <div className="reading-flow-container">
      <div className="reading-flow-grid">
        <AnimatePresence mode="popLayout">
          {markups.map((m, index) => {
            const theme = COLOR_THEMES[m.color || 'Yellow'] || COLOR_THEMES.Yellow;
            
            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                className="reading-card"
                onClick={() => onInspect(m)}
                style={{
                  '--card-border': theme.border,
                  '--card-bg': theme.bg,
                  '--card-glow': theme.glow,
                } as React.CSSProperties}
              >
                {/* Header info */}
                <div className="reading-card-header">
                  <div className="reading-card-meta">
                    <span 
                      className="color-badge"
                      style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
                    >
                      <span className="color-dot" style={{ backgroundColor: theme.badgeText }} />
                      {m.color || 'Yellow'}
                    </span>
                    <span className="reading-page-badge">
                      <FileText size={12} />
                      Page {m.page_number}
                    </span>
                    <span className="reading-type-badge">
                      {m.annotation_type}
                    </span>
                  </div>

                  <div className="reading-card-actions">
                    <button
                      onClick={(e) => handleCopy(e, m)}
                      className={`btn-card-action ${copiedId === m.id ? 'success' : ''}`}
                      title="Copy to Markdown"
                      aria-label="Copy to Markdown"
                    >
                      {copiedId === m.id ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onInspect(m); }}
                      className="btn-card-action"
                      title="Inspect Markup details"
                      aria-label="Inspect Markup details"
                    >
                      <Eye size={13} />
                    </button>
                  </div>
                </div>

                {/* Highlight Content */}
                {m.selected_text && (
                  <div 
                    className="reading-highlight-quote"
                    style={{ 
                      borderLeftColor: theme.badgeText,
                      background: `linear-gradient(90deg, ${theme.bg} 0%, rgba(255, 255, 255, 0) 100%)` 
                    }}
                  >
                    <p className="highlight-quote-text">"{m.selected_text}"</p>
                  </div>
                )}

                {/* Comment / Note Content */}
                {m.comment_text && !m.comment_text.startsWith('[') && (
                  <div className="reading-card-comment">
                    <div className="comment-icon">
                      <MessageSquare size={12} />
                    </div>
                    <div className="comment-content">
                      <p className="comment-text">{m.comment_text}</p>
                    </div>
                  </div>
                )}

                {/* Footer Info */}
                <div className="reading-card-footer">
                  <div className="reading-card-author">
                    <User size={12} />
                    <span>{m.author}</span>
                  </div>
                  <div className="reading-card-date">
                    <Calendar size={12} />
                    <span>{m.created_date || 'Just now'}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
