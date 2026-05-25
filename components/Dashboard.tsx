'use client';

import { motion, Variants } from 'framer-motion';
import { ClipboardList, Clock, Activity, CheckCircle2, Archive, AlertTriangle } from 'lucide-react';
import { DashboardMetrics } from '@/lib/types';

interface DashboardProps {
  metrics: DashboardMetrics;
  loading: boolean;
}

export default function Dashboard({ metrics, loading }: DashboardProps) {
  const cards = [
    {
      key: 'total',
      label: 'Total Issues',
      value: metrics.total,
      icon: ClipboardList,
      colorClass: '', // default gradient
    },
    {
      key: 'pending',
      label: 'Pending',
      value: metrics.pending,
      icon: Clock,
      colorClass: 'amber',
    },
    {
      key: 'inProgress',
      label: 'In Progress',
      value: metrics.inProgress,
      icon: Activity,
      colorClass: 'violet',
    },
    {
      key: 'resolved',
      label: 'Resolved',
      value: metrics.resolved,
      icon: CheckCircle2,
      colorClass: 'emerald',
    },
    {
      key: 'closed',
      label: 'Closed',
      value: metrics.closed,
      icon: Archive,
      colorClass: '', // default
    },
    {
      key: 'critical',
      label: 'Critical',
      value: metrics.critical,
      icon: AlertTriangle,
      colorClass: 'rose',
    },
  ];

  const containerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 25 } },
  };

  return (
    <motion.div
      className="metrics-grid"
      variants={containerVariants}
      initial="hidden"
      animate={loading ? 'hidden' : 'show'}
    >
      {cards.map(({ key, label, value, icon: Icon, colorClass }) => (
        <motion.div
          key={key}
          className="metric-card"
          variants={cardVariants}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.98 }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          <div className={`metric-icon ${colorClass}`}>
            <Icon size={20} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{value}</span>
            <span className="metric-label">{label}</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
