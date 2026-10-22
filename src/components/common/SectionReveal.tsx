import React, { useRef, useEffect, useState, Children, isValidElement, cloneElement } from 'react';

interface SectionRevealProps {
  children: React.ReactNode;
  /** Delay before animation starts (ms), for staggered reveals. Default: 0 */
  delay?: number;
  /** Animation duration (ms). Default: 600 */
  duration?: number;
  /** Vertical offset to slide from (px). Default: 24 */
  offset?: number;
  /** Stagger between direct children when the section is a list of siblings
   *  (e.g. a card rail). Each direct child inherits the parent motion but is
   *  delayed by `stagger * index` ms. Default: 0 (no stagger). */
  stagger?: number;
  /** When truthy, reports scroll progress of the section (0 → 1) so parents
   *  can drive scroll-linked chrome (e.g. a storytelling progress rail).
   *  Fires at most once per animation frame; reduced-motion renders final. */
  onProgress?: (progress: number) => void;
  /** Additional className to merge */
  className?: string;
}

/**
 * Scroll-triggered entrance animation using IntersectionObserver.
 *
 * Sections fade in and slide up as they enter the viewport, creating
 * a premium, layered reveal effect. Respects prefers-reduced-motion.
 *
 * `stagger` fans direct children out with a per-index delay (cap 12 children
 * so long rails never feel sluggish). `onProgress` reports the section's
 * scroll progress for scroll-linked chrome — the caller owns what to do with
 * it (e.g. a gold progress rail) and should memoize the callback.
 *
 * Lightweight: no animation library, just CSS transforms + IO.
 */
export const SectionReveal: React.FC<SectionRevealProps> = ({
  children,
  delay = 0,
  duration = 600,
  offset = 24,
  stagger = 0,
  onProgress,
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -60px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Scroll-progress reporting: rAF-throttled read of the section's travel
  // through the viewport. Reduced motion skips it (final state is static).
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  useEffect(() => {
    if (prefersReduced || !progressRef.current) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 while fully below the fold, 1 when the section's top passes ~60% up.
      const start = vh * 0.95;
      const end = vh * 0.25;
      const p = Math.min(1, Math.max(0, (start - rect.top) / (start - end)));
      progressRef.current?.(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [prefersReduced]);

  const transitionBase = `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) , transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1)`;

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  const childDelay = (index: number) => delay + Math.min(index, 12) * stagger;

  // Stagger mode: wrap each direct child in the same fade/slide motion,
  // delayed by its index. Non-element children pass through untouched.
  const staggeredChildren = stagger > 0
    ? Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        const d = childDelay(index);
        const style = {
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? 'none' : `translateY(${offset}px)`,
          transition: `${transitionBase} ${d}ms`,
          willChange: isVisible ? 'auto' : 'opacity, transform',
        };
        return cloneElement(child as React.ReactElement<{ style?: React.CSSProperties }>, { style });
      })
    : children;

  // Stagger mode: the wrapper is a plain container; each child owns its own
  // fade/slide (delayed by index). Single-section mode: the wrapper animates.
  const wrapperStyle = stagger > 0
    ? undefined
    : {
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'none' : `translateY(${offset}px)`,
        transition: `${transitionBase} ${delay}ms`,
        willChange: isVisible ? 'auto' : 'opacity, transform',
      };

  return (
    <div ref={ref} className={className} style={wrapperStyle}>
      {staggeredChildren}
    </div>
  );
};