import React from 'react';

interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render: (item: T, index: number) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T extends { id?: string }> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
  emptyIcon?: React.ElementType;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export function DataTable<T extends { id?: string }>({
  columns,
  data,
  onRowClick,
  emptyIcon: EmptyIcon,
  emptyTitle = 'No data',
  emptyDescription,
  className = '',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className={`rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] py-12 text-center ${className}`}>
        {EmptyIcon && <EmptyIcon className="w-10 h-10 text-[var(--text-muted)]/50 mx-auto mb-3" />}
        <div className="text-sm font-bold text-[var(--text-muted)]">{emptyTitle}</div>
        {emptyDescription && <div className="text-[11px] text-[var(--text-muted)] mt-1">{emptyDescription}</div>}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-[var(--surface-container)] border border-[var(--border-subtle)] overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="bg-[var(--btn-util-bg)] border-b border-[var(--border-subtle)]">
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`py-2.5 px-3 font-bold text-[var(--text-muted)] uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                  } ${col.className || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {data.map((item, i) => (
              <tr
                key={item.id || i}
                onClick={() => onRowClick?.(item)}
                className={`transition-colors ${onRowClick ? 'cursor-pointer' : ''} hover:bg-[var(--btn-util-bg)]/50`}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={`py-2.5 px-3 ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''
                    } ${col.className || ''}`}
                  >
                    {col.render(item, i)}
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
