import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { spring, fadeOnly } from '../../design/motion';

/**
 * Sheet — the one overlay surface. Phones get a bottom sheet you can drag
 * down to dismiss; from `sm` up it becomes a centred dialog. Focus moves in
 * on open and back to the opener on close, Escape and the scrim dismiss,
 * and the page behind stops scrolling.
 */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** Visually hide the title (it is still announced). */
  hideTitle?: boolean;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  closeLabel?: string;
  className?: string;
  /** Max width on larger screens. */
  size?: 'sm' | 'md' | 'lg';
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  title,
  hideTitle = false,
  description,
  children,
  footer,
  closeLabel = 'Close',
  className,
  size = 'md',
}) => {
  const reduce = useReducedMotion();
  // Drag starts from the grab handle and header only, so the body can scroll.
  const dragControls = useDragControls();
  const startDrag = (e: React.PointerEvent) => { if (!reduce) dragControls.start(e); };
  const panelRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open, onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-dg-scrim backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? fadeOnly : { duration: 0.24 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            tabIndex={-1}
            className={cn(
              /* Apple HIG: sheet is a functional layer; for rich backgrounds consider Liquid Glass (glass variant not enabled by default) */
              'relative w-full bg-dg-surface text-dg-ink shadow-dg-sheet outline-none',
              'rounded-t-dg-xl sm:rounded-dg-xl max-h-[92dvh] flex flex-col',
              'pb-[var(--dg-safe-bottom)] sm:pb-0 sm:mx-4',
              size === 'sm' && 'sm:max-w-md',
              size === 'md' && 'sm:max-w-lg',
              size === 'lg' && 'sm:max-w-2xl',
              className,
            )}
            initial={reduce ? { opacity: 0 } : { y: '100%' }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '100%' }}
            transition={reduce ? fadeOnly : spring.sheet}
            drag={reduce ? false : 'y'}
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={onDragEnd}
          >
            <div className="flex justify-center pt-2.5 pb-1 sm:hidden touch-none" aria-hidden="true" onPointerDown={startDrag}>
              <span className="h-1.5 w-10 rounded-full bg-dg-line-strong" />
            </div>
            <div className="flex items-start gap-3 px-5 pt-2 sm:pt-5 pb-3 touch-none sm:touch-auto" onPointerDown={startDrag}>
              <div className="min-w-0 flex-1">
                <h2 id={titleId} className={cn('font-dg-display text-xl font-semibold leading-snug', hideTitle && 'sr-only'  /* Apple HIG: title remains in DOM for aria-labelledby resolution */)}>
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-1 text-sm text-dg-ink-2">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel || "Close sheet"}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-dg-sunken text-dg-ink-2 hover:text-dg-ink transition-colors"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>
            {footer && <div className="border-t border-dg-line px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
