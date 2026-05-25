'use client';

import { useState, useRef, useEffect } from 'react';
import { Filter, X, ChevronDown, Check, RotateCcw } from 'lucide-react';
import { MarkupFilters, Assignee, Status, Priority, STATUS_OPTIONS, PRIORITY_OPTIONS } from '@/lib/types';

interface FilterBarProps {
  filters: MarkupFilters;
  onFiltersChange: (newFilters: MarkupFilters) => void;
  uniquePdfs: string[];
  uniqueTypes: string[];
  assignees: Assignee[];
}

export default function FilterBar({
  filters,
  onFiltersChange,
  uniquePdfs,
  uniqueTypes,
  assignees,
}: FilterBarProps) {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name: string) => {
    setActiveDropdown(prev => (prev === name ? null : name));
  };

  const handleSelectOption = (category: keyof MarkupFilters, value: string) => {
    const current = filters[category] as string[] || [];
    let updated: string[];

    if (current.includes(value)) {
      updated = current.filter(v => v !== value);
    } else {
      updated = [...current, value];
    }

    onFiltersChange({
      ...filters,
      [category]: updated,
    });
  };

  const handleClearCategory = (category: keyof MarkupFilters) => {
    onFiltersChange({
      ...filters,
      [category]: [],
    });
  };

  const handleClearAll = () => {
    onFiltersChange({});
  };

  const getActiveFiltersCount = () => {
    return Object.values(filters).reduce((acc, curr) => acc + (curr?.length || 0), 0);
  };

  const activeCount = getActiveFiltersCount();

  const filterConfigs = [
    {
      key: 'pdf_name' as const,
      label: 'Drawing',
      options: uniquePdfs,
    },
    {
      key: 'status' as const,
      label: 'Status',
      options: STATUS_OPTIONS,
    },
    {
      key: 'priority' as const,
      label: 'Priority',
      options: PRIORITY_OPTIONS,
    },
    {
      key: 'assigned_to' as const,
      label: 'Assignee',
      options: assignees.map(a => a.name),
    },
    {
      key: 'annotation_type' as const,
      label: 'Type',
      options: uniqueTypes,
    },
  ];

  return (
    <div ref={containerRef} className="filter-bar" style={{ position: 'relative', zIndex: 10 }}>
      <div className="filter-bar-label">
        <Filter size={16} style={{ color: 'var(--accent-blue)' }} aria-hidden />
        <span>Filters</span>
        {activeCount > 0 && (
          <span className="filter-count-badge">{activeCount}</span>
        )}
      </div>

      <div className="filter-bar-scroll">
        {filterConfigs.map(({ key, label, options }) => {
          const selected = (filters[key] as string[]) || [];
          const isOpen = activeDropdown === key;

          return (
            <div key={key} style={{ position: 'relative' }}>
              <button
                type="button"
                className={`filter-chip ${selected.length > 0 ? 'active' : ''}`}
                onClick={() => toggleDropdown(key)}
                style={{ gap: '0.375rem' }}
              >
                <span>{label}</span>
                {selected.length > 0 && (
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    ({selected.length})
                  </span>
                )}
                <ChevronDown size={12} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {isOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '0.375rem',
                  background: 'var(--bg-secondary)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-xl)',
                  minWidth: '220px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  zIndex: 20,
                  padding: '0.375rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.125rem'
                }}>
                  {options.length === 0 ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      No options available
                    </div>
                  ) : (
                    options.map(option => {
                      const isChecked = selected.includes(option);
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => handleSelectOption(key, option)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.4rem 0.625rem',
                            fontSize: '0.75rem',
                            borderRadius: 'var(--radius-md)',
                            background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                            color: isChecked ? 'var(--accent-blue-light)' : 'var(--text-secondary)',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            width: '100%',
                            transition: 'all 0.15s ease'
                          }}
                          className="filter-option"
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '0.5rem' }}>
                            {option}
                          </span>
                          {isChecked && <Check size={12} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />}
                        </button>
                      );
                    })
                  )}
                  {selected.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.25rem', paddingTop: '0.25rem' }}>
                      <button
                        type="button"
                        onClick={() => handleClearCategory(key)}
                        style={{
                          width: '100%',
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          fontSize: '0.7rem',
                          textAlign: 'center',
                          padding: '0.375rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                      >
                        Clear Selected
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {activeCount > 0 && (
        <div className="filter-bar-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleClearAll}
            style={{ fontSize: '0.75rem', padding: '0.375rem 0.75rem', color: '#f87171', gap: '0.25rem', whiteSpace: 'nowrap' }}
          >
            <RotateCcw size={12} />
            Clear
          </button>
        </div>
      )}

      {activeCount > 0 && (
        <div className="filter-bar-active-chips">
          {filterConfigs.map(({ key, label }) => {
            const selected = (filters[key] as string[]) || [];
            if (selected.length === 0) return null;

            return selected.map(val => (
              <span
                key={`${key}-${val}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)'
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{val}</span>
                <button
                  type="button"
                  onClick={() => handleSelectOption(key, val)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: 'var(--text-muted)'
                  }}
                  title={`Remove ${val}`}
                >
                  <X size={10} className="hover-red-svg" />
                </button>
              </span>
            ));
          })}
        </div>
      )}

      <style jsx global>{`
        .filter-option:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          color: var(--text-primary) !important;
        }
      `}</style>
    </div>
  );
}
