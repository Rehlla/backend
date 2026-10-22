import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';

/**
 * DahabSplash — cinematic splash gate.
 *
 * Interaction philosophy adapted from the TETE reference (locked scroll →
 * cinematic crossfades → title reveal → enter), rebuilt small for React:
 *
 *   S0 (image 0) → … → S5 (image 5 + full title) → UNLOCKED (fade out, onDone)
 *
 * - Wheel / touch-swipe / keyboard (↓/Space/Enter advance, Esc skips) all feed
 *   one `advance()` with a cooldown so a single flick = one step.
 * - Every listener is passive where valid and ALL are removed on unlock/unmount.
 * - Body scroll is locked only while mounted; the original overflow is restored.
 * - `prefers-reduced-motion` (or the app's own data-reduced-motion flag) bypasses
 *   the cinema and finishes immediately.
 * - All copy goes through t(); layout follows dir (RTL/LTR) automatically.
 *
 * IMAGES — verified paths under public/images/hero/ (do not invent new ones).
 * Future `public/images/splash/*.webp` assets (<200KB each) can replace these
 * entries 1:1 — keep the array order (coast → reef → camels → kite → sunset).
 */
export const SPLASH_IMAGES: readonly string[] = [
  '/images/hero/dahab-panorama.jpg', // mountain / Blue Hole coast
  '/images/hero/blue-hole.jpg', // Blue Hole
  '/images/hero/coral-reef.jpg', // reef / diving
  '/images/hero/camels-beach.jpg', // camels on the beach
  '/images/hero/kitesurf.jpg', // kite / windsurf
  '/images/hero/sunset.jpg', // golden-hour sea terrace mood
];

export const SPLASH_SEEN_KEY = 'dahab_splash_seen';
const EXIT_MS = 700;
const STEP_COOLDOWN_MS = 550;
const GESTURE_THRESHOLD_PX = 6;
// The first frame must explain the experience before asking a new traveler to act.
// Later frames still crossfade the imagery, but the title and subtitle remain
// available from the moment the gate opens.
const TITLE_REVEAL_INDEX = 0;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function prefersReducedMotion(): boolean {
  if (!isBrowser()) return false;
  try {
    if (document.documentElement.getAttribute('data-reduced-motion') === 'true') return true;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

interface DahabSplashProps {
  onDone: () => void;
}

export const DahabSplash: React.FC<DahabSplashProps> = ({ onDone }) => {
  const { t, isRTL } = useLanguage();
  const [index, setIndex] = useState(0);
  const [exiting, setExiting] = useState(false);
  const indexRef = useRef(0);
  const exitingRef = useRef(false);
  const cooldownUntilRef = useRef(0);
  const exitTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const onDoneRef = useRef(onDone);
  const enterBtnRef = useRef<HTMLButtonElement>(null);
  onDoneRef.current = onDone;

  const lastIndex = SPLASH_IMAGES.length - 1;
  const titleRevealed = index >= TITLE_REVEAL_INDEX;

  const finish = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    setExiting(true);
    // Persist the session mark IMMEDIATELY (not after the fade): a reload or
    // navigation during the 700ms exit must not resurrect the gate. The parent
    // repeats the write in its own done handler — both are idempotent.
    try {
      sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
    } catch {
      // Private-mode storage can throw — the fade/unmount proceeds regardless.
    }
    // The 700ms fade plays, then the parent unmounts us and reveals the site.
    if (!isBrowser()) {
      onDoneRef.current();
      return;
    }
    exitTimerRef.current = window.setTimeout(() => {
      onDoneRef.current();
    }, EXIT_MS);
  }, []);

  const advance = useCallback(() => {
    if (exitingRef.current || !isBrowser()) return;
    const now = performance.now();
    if (now < cooldownUntilRef.current) return;
    cooldownUntilRef.current = now + STEP_COOLDOWN_MS;
    if (indexRef.current >= lastIndex) {
      finish();
      return;
    }
    indexRef.current += 1;
    setIndex(indexRef.current);
  }, [finish, lastIndex]);

  // Reduced motion: no cinema — finish on mount.
  useEffect(() => {
    if (prefersReducedMotion()) {
      finish();
    }
  }, [finish]);

  // Scroll lock: preserve + restore the original body/html overflow.
  useEffect(() => {
    if (!isBrowser()) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    // The site must sit at top when revealed — no scroll jump.
    window.scrollTo(0, 0);
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      if (exitTimerRef.current !== null) {
        window.clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
    };
  }, []);

  // Gesture listeners — all detached on unmount (and parent unmounts us at done).
  useEffect(() => {
    if (!isBrowser()) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < GESTURE_THRESHOLD_PX) return;
      // Down (or up-trackpad drift): advance. Up: also advance — the gate is
      // one-way by design (Skip/Enter always available, no trap).
      advance();
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartYRef.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current === null) return;
      const y = e.touches[0]?.clientY;
      if (typeof y !== 'number') return;
      const dy = touchStartYRef.current - y; // swipe up = forward intent
      if (Math.abs(dy) < GESTURE_THRESHOLD_PX) return;
      touchStartYRef.current = null; // one flick = one step
      advance();
    };
    const onTouchEnd = () => {
      touchStartYRef.current = null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // A focused control keeps its native activation (Enter/Space click it);
      // arrows never activate controls, so they always advance the cinema.
      const target = e.target as HTMLElement | null;
      const onControl = !!target && (target.tagName === 'BUTTON' || target.tagName === 'A');
      if (e.key === 'Escape') {
        e.preventDefault();
        finish();
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        if (onControl) return;
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [advance, finish]);

  // Keyboard users operate immediately — focus Enter without scrolling.
  useEffect(() => {
    try {
      enterBtnRef.current?.focus({ preventScroll: true });
    } catch {
      // Older engines ignore the options arg; focus still lands.
      enterBtnRef.current?.focus();
    }
  }, []);

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-label={t('splash.title')}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-[90] overflow-hidden bg-[var(--bg-canvas)] text-white transition-opacity duration-700"
      style={{ opacity: exiting ? 0 : 1 }}
      data-testid="dahab-splash"
    >
      {/* Image stack — first eager, rest lazy; only opacity animates. */}
      {SPLASH_IMAGES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          draggable={false}
          loading={i === 0 ? 'eager' : 'lazy'}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-out"
          style={{ opacity: i === index ? 1 : 0, zIndex: i === index ? 1 : 0 }}
        />
      ))}

      {/* Readability scrim — functional only, theme-neutral dark veil. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.22) 42%, rgba(0,0,0,0.05) 70%, rgba(0,0,0,0.18) 100%)',
        }}
      />

      {/* Skip — always visible, 44px target. */}
      <button
        type="button"
        onClick={finish}
        aria-label={t('splash.skip')}
        className="absolute end-4 top-4 z-[5] min-h-[44px] rounded-full border border-white/30 bg-black/30 px-5 text-xs font-semibold uppercase tracking-[0.18em] text-white backdrop-blur-sm transition-colors hover:bg-black/50 focus-visible:outline-2 focus-visible:outline-white"
        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {t('splash.skip')}
      </button>

      {/* Copy block — bottom-anchored, safe-area aware, no clipping on small widths. */}
      <div className="absolute inset-x-0 bottom-0 z-[4] flex flex-col items-center px-6 pb-[max(2.5rem,env(safe-area-inset-bottom,0px))] pt-10 text-center">
        <p className="font-serif text-xs italic tracking-[0.08em] text-white/85 sm:text-sm">
          {t('splash.eyebrow')}
        </p>
        <h1
          className="mt-3 max-w-3xl font-display text-4xl leading-tight sm:text-5xl md:text-6xl"
          style={{
            opacity: titleRevealed ? 1 : 0,
            transform: titleRevealed ? 'translate3d(0,0,0)' : 'translate3d(0,4vh,0)',
            transition: 'opacity 900ms ease-out, transform 900ms ease-out',
          }}
        >
          {t('splash.title')}
        </h1>
        <p
          className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base"
          style={{
            opacity: titleRevealed ? 1 : 0,
            transition: 'opacity 900ms ease-out 150ms',
          }}
        >
          {t('splash.subtitle')}
        </p>

        {/* Progress — 6 quiet dots, never color-alone (active is wider). */}
        <div className="mt-5 flex items-center gap-2" role="status" aria-label={`${index + 1} / ${SPLASH_IMAGES.length}`}>
          {SPLASH_IMAGES.map((src, i) => (
            <span
              key={src}
              aria-hidden="true"
              className="h-1.5 rounded-full bg-white/70 transition-all duration-500"
              style={{ width: i === index ? 22 : 6, opacity: i === index ? 1 : 0.55 }}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col items-center gap-4">
          <button
            ref={enterBtnRef}
            type="button"
            onClick={finish}
            className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-full bg-[var(--accent-primary)] px-8 text-sm font-bold uppercase tracking-[0.18em] text-[var(--accent-primary-ink)] transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-white active:scale-[0.99]"
          >
            {t('splash.enter')}
          </button>
          <div className="flex flex-col items-center gap-1 text-white/70" aria-hidden="true">
            <span className="font-serif text-[11px] uppercase tracking-[0.25em]">{t('splash.scroll')}</span>
            <ChevronDown className="chart-scroll-hint h-4 w-4" />
          </div>
        </div>
      </div>
    </section>
  );
};
