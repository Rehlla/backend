import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Shown instead of the default panel, e.g. to keep chrome around a failed view. */
  fallback?: (reset: () => void, error: Error) => React.ReactNode;
  /** Identifies where the boundary sits, for the console log. */
  label?: string;
  /** Changing any value here clears the error — e.g. the current route. */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render/lifecycle errors in the tree below it.
 *
 * The app previously had no error boundary anywhere, so any single component
 * throwing unmounted the entire React tree and left the user on a blank page
 * with no way back other than a reload — which, with no router, also discarded
 * their trip.
 *
 * Deliberately dependency-free: no contexts, no Tailwind classes, no theme
 * variables. Whatever broke may be exactly those things, so this renders with
 * inline styles that cannot fail.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // No error-tracking service is wired up yet; the console is all there is.
    console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.error) return;
    const prev = prevProps.resetKeys;
    const next = this.props.resetKeys;
    if (!prev || !next) return;
    if (prev.length !== next.length || prev.some((k, i) => !Object.is(k, next[i]))) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) {
      return this.props.fallback(this.reset, error);
    }

    return (
      <div
        role="alert"
        style={{
          minHeight: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          background: '#141311',
          color: '#F7F3EA',
          fontFamily: 'var(--font-sans)'
        }}
      >
        <div style={{ maxWidth: '32rem', textAlign: 'center' }}>
          {/* Arabic only. This panel deliberately reads no language context and
              no translation catalogue — whatever crashed may be exactly those —
              so the copy is inlined and direction-pinned. Inlining Arabic alone
              (rather than the old Arabic + English pair) also keeps a screen
              reader from announcing the same sentence twice under two
              directions. */}
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.75rem', fontFamily: 'var(--font-sans)', direction: 'rtl' }}>
            حصلت مشكلة في عرض هذه الصفحة
          </h1>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, opacity: 0.8, marginBottom: '1.5rem', direction: 'rtl' }}>
            بيانات رحلتك محفوظة. تقدر تحاول تاني أو تعيد تحميل الصفحة.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={this.reset}
              style={{
                padding: '0.7rem 1.4rem',
                borderRadius: '0.9rem',
                border: 'none',
                background: 'var(--accent-primary)',
                color: '#141311',
                fontWeight: 800,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              حاول مرة أخرى
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '0.7rem 1.4rem',
                borderRadius: '0.9rem',
                border: '1px solid rgba(247,243,234,0.25)',
                background: 'transparent',
                color: '#F7F3EA',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              إعادة تحميل الصفحة
            </button>
          </div>
        </div>
      </div>
    );
  }
}
