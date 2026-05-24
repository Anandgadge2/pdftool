'use client';

import { motion } from 'framer-motion';
import { FileUp, Zap, Server, Edit3, Download } from 'lucide-react';

interface EmptyStateProps {
  onOpenSidebar: () => void;
}

export default function EmptyState({ onOpenSidebar }: EmptyStateProps) {
  const features = [
    {
      title: 'Instant parsing',
      desc: 'Extract markups instantly using high-perf pdf.js',
      icon: Zap,
      color: 'rgba(59, 130, 246, 0.15)', // Blue
      iconColor: 'var(--accent-blue-light)',
    },
    {
      title: 'Vercel Postgres',
      desc: 'Seamless data sync with Neon database backend',
      icon: Server,
      color: 'rgba(16, 185, 129, 0.15)', // Emerald
      iconColor: '#34d399',
    },
    {
      title: 'Inline Editing',
      desc: 'Directly modify status, assignee and priority in real-time',
      icon: Edit3,
      color: 'rgba(139, 92, 246, 0.15)', // Violet
      iconColor: '#a78bfa',
    },
    {
      title: 'Rich Exports',
      desc: 'Download perfectly styled Excel or clean CSV reports',
      icon: Download,
      color: 'rgba(245, 158, 11, 0.15)', // Amber
      iconColor: '#fbbf24',
    },
  ];

  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <div className="empty-state-icon">
        <FileUp size={36} />
      </div>

      <h2 className="empty-state-title">No markups loaded</h2>
      <p className="empty-state-description">
        Upload a PDF drawing to extract annotations, review comments, track issues, assign status, and export reports in seconds.
      </p>

      <button
        onClick={onOpenSidebar}
        className="btn btn-primary btn-lg"
        style={{ marginBottom: 'var(--space-2xl)', cursor: 'pointer' }}
        id="upload-first-pdf-btn"
      >
        <FileUp size={16} />
        Open Sidebar & Upload PDF
      </button>

      <div className="feature-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-md)', width: '100%', maxWidth: '560px' }}>
        {features.map((feat, index) => {
          const Icon = feat.icon;
          return (
            <motion.div
              key={feat.title}
              className="feature-card"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05, duration: 0.3 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                textAlign: 'left',
                padding: 'var(--space-md)',
                gap: '0.5rem',
              }}
            >
              <div
                className="feature-card-icon"
                style={{
                  background: feat.color,
                  color: feat.iconColor,
                  width: '36px',
                  height: '36px',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <Icon size={16} />
              </div>
              <div>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 0.125rem 0' }}>
                  {feat.title}
                </h4>
                <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                  {feat.desc}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}
