import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, Eye } from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  keyExtractor: (row: T) => string;
}

type SortDir = 'asc' | 'desc';

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage = 'אין נתונים להצגה',
  emptyDescription = 'נתונים חדשים יופיעו כאן כשיתקבלו',
  onRowClick,
  className = '',
  keyExtractor,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal), 'he');
      }

      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [data, sortKey, sortDir]);

  // Empty state
  if (data.length === 0) {
    return (
      <div className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl ${className}`}>
        <div className="flex flex-col items-center justify-center py-16 px-6">
          <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)]/5 flex items-center justify-center mb-4">
            <Eye className="w-8 h-8 text-[var(--text-muted)]" />
          </div>
          <p className="text-[var(--text-secondary)] font-medium mb-1">{emptyMessage}</p>
          <p className="text-[var(--text-muted)] text-sm">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--glass)] backdrop-blur-xl overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full" dir="rtl">
          {/* Header */}
          <thead>
            <tr className="border-b border-[var(--border)]">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`
                    px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider
                    text-[var(--text-muted)]
                    ${col.sortable ? 'cursor-pointer hover:text-[var(--text-secondary)] select-none' : ''}
                    ${col.className || ''}
                  `}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc'
                        ? <ChevronUp className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                        : <ChevronDown className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody>
            {sortedData.map(row => (
              <tr
                key={keyExtractor(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`
                  border-b border-[var(--border-subtle)] last:border-b-0
                  transition-colors duration-150
                  hover:bg-[var(--bg-card-hover)]
                  ${onRowClick ? 'cursor-pointer' : ''}
                `}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`px-4 py-3.5 text-sm text-[var(--text-primary)] ${col.className || ''}`}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
