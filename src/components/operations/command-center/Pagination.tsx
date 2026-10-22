import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({ page, totalPages, totalItems, pageSize, onPageChange, className = '' }: PaginationProps) {
  if (totalPages <= 1) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalItems);

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div className="text-[11px] text-[var(--text-muted)] font-mono">
        Showing {start}–{end} of {totalItems}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 7) {
            pageNum = i + 1;
          } else if (page <= 4) {
            pageNum = i + 1;
          } else if (page >= totalPages - 3) {
            pageNum = totalPages - 6 + i;
          } else {
            pageNum = page - 3 + i;
          }
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              className={`w-7 h-7 rounded-lg text-[11px] font-bold transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer ${
                pageNum === page
                  ? 'bg-[var(--accent-primary)] text-[var(--text-primary)]'
                  : 'bg-[var(--btn-util-bg)] text-[var(--text-muted)] hover:text-[var(--text-muted)] hover:bg-[var(--btn-util-bg)]'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded-lg bg-[var(--btn-util-bg)] hover:bg-[var(--btn-util-bg)] text-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-[background-color,border-color,color,box-shadow,transform,opacity] cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Hook for client-side pagination of an array.
 */
export function usePagination<T>(items: T[], pageSize: number = 20) {
  const [page, setPage] = React.useState(1);
  const totalPages = Math.ceil(items.length / pageSize);
  const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

  // Reset to page 1 when items change
  React.useEffect(() => {
    if (page > totalPages && totalPages > 0) setPage(totalPages);
  }, [items.length, totalPages, page]);

  return { page, setPage, totalPages, paginatedItems, totalItems: items.length, pageSize };
}
