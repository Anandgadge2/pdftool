'use client';

import { FileText, FileSearch } from 'lucide-react';
import { motion } from 'framer-motion';

export type AppTab = 'tracker' | 'review';

interface AppModeTabsProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

const TABS: Array<{ id: AppTab; label: string; shortLabel: string; icon: typeof FileText }> = [
  { id: 'tracker', label: 'Issue Tracker', shortLabel: 'Tracker', icon: FileText },
  { id: 'review', label: 'PDF Review', shortLabel: 'Review', icon: FileSearch },
];

export default function AppModeTabs({ active, onChange }: AppModeTabsProps) {
  return (
    <nav className="app-mode-tabs" aria-label="Application mode">
      <div className="app-mode-tabs-inner">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`app-mode-tab ${isActive ? 'active' : ''}`}
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="app-tab-indicator"
                  className="app-mode-tab-indicator"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="app-mode-tab-content">
                <Icon size={16} aria-hidden />
                <span className="app-mode-tab-label">{tab.label}</span>
                <span className="app-mode-tab-label-short">{tab.shortLabel}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
