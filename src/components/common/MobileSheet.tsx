import React, { useEffect, useRef } from 'react';

/**
 * MobileSheet — reusable bottom sheet for mobile (blueprint row #17).
 *
 * Slides up from the bottom on mobile, renders as a centered modal on desktop.
 * Supports drag-to-dismiss via backdrop click. Always includes safe-area
 * padding for modern phones.
 *
 * Usage:
 * <MobileSheet open={show} onClose={() => setShow(false)}>
 *   <MyContent />
 * </MobileSheet>
 */

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Extra class on the inner card. */
  className?: string;
  /** Hide the default close X button. */
  hideClose?: boolean;
  /** Title shown in the header. */
  title?: string;
}

export function MobileSheet({
  open,
  onClose,
  children,
  className = '',
  hideClose = false,
  title,
}: MobileSheetProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" />

      {/* Sheet */}
      <div
        className={[
          'relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto',
          'bg-[var(--surface-card)] border border-[var(--border-subtle)]',
          'rounded-t-3xl sm:rounded-3xl shadow-2xl',
          'animate-in slide-in-from-bottom duration-200',
          'pb-[env(safe-area-inset-bottom)]',
          className,
        ].join(' ')}
      >
        {/* Drag handle (mobile only) */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-[var(--text-secondary)]/30" />
        </div>

        {/* Header */}
        {(title || !hideClose) && (
          <div className="flex items-center justify-between px-6 pt-4 pb-2">
            {title && (
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                {title}
              </h3>
            )}
            {!hideClose && (
              <button
                onClick={onClose}
                className="ml-auto w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--surface-hover)] active:scale-95 transition-transform"
                aria-label="Close"
              >
                <svg className="w-5 h-5 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-6 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
